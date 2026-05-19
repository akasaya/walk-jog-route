# 技術設計: route-suggestion-mvp

**フィーチャー名**: route-suggestion-mvp  
**ステータス**: 設計生成済み（承認待ち）  
**作成日**: 2026-05-19  
**要件トレーサビリティ**: requirements.md 要件 1.x〜7.x に対応

---

## 1. アーキテクチャパターン・境界マップ

```
┌─────────────────────────────────────────────────────┐
│  Browser (React + TypeScript)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │  Home Page   │  │ ActiveRoute  │  │  History  │ │
│  │  (提案画面)   │  │  (実行中)    │  │  (履歴)   │ │
│  └──────┬───────┘  └──────┬───────┘  └─────┬─────┘ │
│         │                 │                 │        │
│  ┌──────▼─────────────────▼─────────────────▼─────┐ │
│  │        API Client Layer  (routes.ts)           │ │
│  └────────────────────────┬───────────────────────┘ │
│                           │ HTTPS                   │
└───────────────────────────┼─────────────────────────┘
                            │ Lambda Function URL
┌───────────────────────────▼─────────────────────────┐
│  FastAPI Backend (Lambda Container Image)            │
│  ┌────────────────────────────────────────────────┐ │
│  │  API Layer  (routers/routes.py, history.py)    │ │
│  └────────────────────────┬───────────────────────┘ │
│                           │                          │
│  ┌────────────────────────▼───────────────────────┐ │
│  │  Service Layer                                 │ │
│  │  ┌──────────────┐  ┌──────────────────────┐   │ │
│  │  │ RouteService │  │   HistoryService     │   │ │
│  │  └──────┬───────┘  └──────────────────────┘   │ │
│  │         │                                      │ │
│  │  ┌──────▼──────┐ ┌─────────────┐ ┌──────────┐ │ │
│  │  │  AIService  │ │WeatherSvc   │ │RoutingSvc│ │ │
│  │  └──────┬──────┘ └──────┬──────┘ └────┬─────┘ │ │
│  └─────────┼───────────────┼─────────────┼────────┘ │
└────────────┼───────────────┼─────────────┼──────────┘
             │               │             │
    ┌────────▼───┐  ┌────────▼───┐  ┌─────▼────────┐
    │ Claude API │  │ Open-Meteo │  │ GraphHopper  │
    │ (Anthropic)│  │ (無料・無認証) │ │ Cloud API    │
    └────────────┘  └────────────┘  └──────────────┘
             │
    ┌────────▼────────┐
    │   DynamoDB      │
    │ walk-jog-routes │
    └─────────────────┘
```

**境界の原則**:
- Frontend は API Client を通じてのみバックエンドと通信する
- 各 Service は単一の外部依存を持つ（AIService → Claude API のみ）
- RouteService が 3 つのサービスを順次オーケストレーションする

---

## 2. 技術スタック・整合性

| レイヤー | 技術 | バージョン目安 | 選定理由 |
|---------|------|------------|---------|
| Frontend Framework | React + TypeScript | 19.x | 型安全な UI 開発 |
| 地図ライブラリ | React Leaflet | 4.x | OSM 対応、軽量 |
| パッケージマネージャ | pnpm | 9.x | 既存ルールに従う |
| Backend Framework | FastAPI | 0.115.x | 非同期・Pydantic 統合 |
| Lambda アダプタ | Mangum | 0.19.x | FastAPI → Lambda 変換 |
| AI SDK | anthropic | 0.51.x+ | `client.messages.parse` で構造化出力 |
| Pydantic | Pydantic | 2.x | バリデーション・型変換 |
| AWS SDK | boto3 | 1.35.x | DynamoDB アクセス |
| HTTP クライアント | httpx | 0.27.x | 非同期 HTTP（天気 API 等） |
| テスト | pytest + httpx | 8.x / 0.27.x | 既存ルールに従う |

---

## 3. コンポーネントとインターフェースコントラクト

### 3.1 API エンドポイント定義

#### `POST /routes/suggest`（要件 2.1〜2.7）

```
Request Body:
  lat:         float   # 緯度 [-90, 90]
  lon:         float   # 経度 [-180, 180]
  distance_km: float   # 目標距離 [0.5, 50]
  mode:        "walk" | "jog"

Response 200:
  route_id:          str    # UUID
  polyline:          str    # Google Encoded Polyline
  distance_m:        int    # 実際のルート距離（メートル）
  estimated_minutes: int    # 推定所要時間
  waypoints:         list[{lat: float, lon: float}]
  weather:           {temp_c: float, condition: str} | null

Response 422: バリデーションエラー（7.2）
Response 503: 外部サービス利用不能（7.3）
Response 429: レートリミット超過（7.5）
```

#### `POST /routes/{route_id}/start`（要件 4.1）

```
Path Parameter:
  route_id: str  # URL パスから取得（ボディに含めない）

Request Body:
  polyline: str
  distance_km: float
  mode: "walk" | "jog"
  weather: {temp_c: float, condition: str} | null

Response 201:
  route_id: str
  started_at: str  # ISO8601
```

#### `POST /routes/{route_id}/track`（要件 4.2〜4.3）

```
Request Body:
  points: list[{lat: float, lon: float, timestamp: str}]
  status: "tracking" | "completed" | "abandoned"

Response 200:
  saved_count: int
```

#### `GET /routes/history`（要件 5.1〜5.3）

```
Response 200:
  routes: list[RouteHistoryItem]

RouteHistoryItem:
  route_id:     str
  started_at:   str
  mode:         "walk" | "jog"
  distance_km:  float
  has_track:    bool
  polyline:     str
```

#### `GET /health`

```
Response 200: {"status": "ok"}
```

---

### 3.2 Pydantic モデル定義

```python
# models/route.py

from pydantic import BaseModel, Field
from typing import Literal

class RouteRequest(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)
    distance_km: float = Field(ge=0.5, le=50)
    mode: Literal["walk", "jog"]

class WeatherData(BaseModel):
    temp_c: float
    condition: str  # WMO weathercode を文字列に変換

class WaypointItem(BaseModel):
    lat: float
    lon: float

class RouteWaypoints(BaseModel):
    """Claude API 構造化出力スキーマ"""
    waypoints: list[WaypointItem]
    reasoning: str  # デバッグ・将来の表示用

class RouteSuggestionResponse(BaseModel):
    route_id: str
    polyline: str
    distance_m: int
    estimated_minutes: int
    waypoints: list[WaypointItem]
    weather: WeatherData | None

class TrackPoint(BaseModel):
    lat: float
    lon: float
    timestamp: str  # ISO8601

class TrackRequest(BaseModel):
    points: list[TrackPoint]
    status: Literal["tracking", "completed", "abandoned"]
```

---

### 3.3 Service インターフェース

#### AIService（要件 2.2, 2.5）

```python
class AIService:
    def generate_waypoints(
        self,
        lat: float,
        lon: float,
        distance_km: float,
        mode: str,
        history: list[RouteHistoryItem],
        weather: WeatherData | None,
    ) -> RouteWaypoints:
        """
        Claude API に文脈を渡し、経由地候補を生成する。
        構造化出力（Pydantic）で RouteWaypoints を返す。
        """
```

**プロンプト設計**:
```
システム: あなたは散歩・ジョギングルートの設計者です。
ユーザーの現在地・目標距離・過去のルート履歴・天気を考慮して、
今日のルートの経由地（緯度・経度）を JSON で提案してください。

コンテキスト:
- 現在地: {lat}, {lon}
- 目標距離: {distance_km}km ({mode})
- 現在の天気: {weather_summary}
- 過去ルート（直近 {n} 件）:
  {history_summary}  ← エリア・日時のみ、詳細座標は省略

指示:
- 現在地から{distance_km / 4}km 程度の範囲内で経由地を 2〜4 点選ぶ
- 過去に通行した方角・エリアとは異なるエリアを優先する
- reasoning に選んだ理由を日本語で記述する
```

#### WeatherService（要件 6.1〜6.2）

```python
class WeatherService:
    async def get_current_weather(
        self, lat: float, lon: float
    ) -> WeatherData | None:
        """
        Open-Meteo API から現在の天気を取得する。
        失敗時は None を返す（例外を伝播させない）。
        """
```

**API 呼び出し**:
```
GET https://api.open-meteo.com/v1/forecast
  ?latitude={lat}&longitude={lon}
  &current=temperature_2m,weathercode,windspeed_10m
  &timezone=auto
```

#### RoutingService（要件 2.3〜2.4）

```python
class RoutingService:
    async def generate_route(
        self,
        origin_lat: float,
        origin_lon: float,
        waypoints: list[WaypointItem],
        profile: str,  # "foot"
    ) -> tuple[str, int, int]:
        """
        GraphHopper Routing API を呼び出す。
        現在地 → waypoints → 現在地 の順で経路を生成（周回ルート）。
        Returns: (encoded_polyline, actual_distance_m, estimated_minutes)
        estimated_minutes = GraphHopper レスポンスの "time"（ms）/ 60,000 の整数値
        """
```

**API 呼び出し**:
```
GET https://graphhopper.com/api/1/route
  ?point={origin_lat},{origin_lon}         ← 起点（現在地）
  &point={wp1_lat},{wp1_lon}               ← AI 経由地 1
  &point={wp2_lat},{wp2_lon}               ← AI 経由地 2（〜4点）
  &point={origin_lat},{origin_lon}         ← 終点（現在地 = 周回）
  &profile=foot
  &key={GRAPHHOPPER_API_KEY}
```

**注**: `walk` / `jog` いずれも `profile=foot` を使用。
ジョギングは歩行可能な道を使い、GraphHopper が速度を適切に推定する。
距離の ±20% 保証: レスポンスの `distance`（m）で判定し、超過時は waypoints を 1 点間引いて再試行（最大 1 回）。

#### RouteService（オーケストレーター）

```python
class RouteService:
    async def suggest(self, request: RouteRequest) -> RouteSuggestionResponse:
        """
        1. WeatherService.get_current_weather()
        2. HistoryService.get_recent(n=10)
        3. AIService.generate_waypoints()
        4. RoutingService.generate_route(現在地, waypoints, 現在地) を呼ぶ
        5. 実距離が目標の ±20% を超える場合は waypoints を 1 点間引いて再試行（最大 1 回）
        6. RouteSuggestionResponse を構築して返す
        """
```

---

### 3.4 DynamoDB アクセスパターン（HistoryService）

```python
class HistoryService:
    def save_route(self, route: RouteRecord) -> None:
        """PK=userId, SK=routeId でルートを保存"""

    def get_recent(self, user_id: str, n: int = 10) -> list[RouteHistoryItem]:
        """
        Query: PK=userId, ScanIndexForward=False, Limit=n
        SK は ISO8601 timestamp を先頭に含めた設計のため
        時系列降順でクエリ可能。
        SK フォーマット: "{started_at}#{route_id}"
        """

    def update_track(self, user_id: str, route_id: str,
                     points: list[TrackPoint], status: str) -> None:
        """GPS 実績を append して status を更新"""
```

---

### 3.5 Frontend コンポーネント設計

#### ディレクトリ構造

```
frontend/src/
  pages/
    Home.tsx           # 提案フォーム + 地図（要件 1〜3）
    ActiveRoute.tsx    # 実行中トラッキング（要件 4）
    History.tsx        # 過去ルート一覧（要件 5）
  components/
    RouteMap.tsx       # Leaflet ラッパー（MapContainer + TileLayer）
    RouteRequestForm.tsx  # 距離スライダー + モード選択 + 提案ボタン
    GpsTracker.tsx     # navigator.geolocation.watchPosition ラッパー
    RouteCard.tsx      # 履歴1件表示
    ErrorBanner.tsx    # エラーメッセージ表示
  hooks/
    useGeolocation.ts  # 現在地取得 hook（要件 1.1〜1.3）
    useRouteTracking.ts # GPS トラッキング hook（要件 4.2〜4.3）
  api/
    client.ts          # fetch ラッパー（baseURL + エラー処理）
    routes.ts          # API 関数定義（型付き）
  types/
    route.ts           # 共通型定義
  utils/
    userId.ts          # localStorage UUID 管理
```

#### RouteRequestForm インターフェース

起点は常にユーザーの現在地（GPS）。`lat`/`lon` はフォームで入力するのではなく、
`useGeolocation` hook から取得してフォーム送信時に自動付与する。
手動入力（要件 1.2）は GPS 許可拒否時のフォールバックとしてのみ表示する。

```typescript
interface RouteRequestFormProps {
  currentLocation: { lat: number; lon: number } | null;
  onSubmit: (request: RouteRequest) => void;
  isLoading: boolean;
}

interface RouteRequest {
  lat: number;          // useGeolocation から自動取得（ユーザーが変更不可）
  lon: number;          // useGeolocation から自動取得（ユーザーが変更不可）
  distance_km: number;  // スライダーで入力（0.5〜50）
  mode: "walk" | "jog";
}
```

#### useGeolocation インターフェース（要件 1.1〜1.3）

```typescript
interface GeolocationState {
  lat: number | null;
  lon: number | null;
  error: "denied" | "timeout" | "unavailable" | null;
  loading: boolean;
}

function useGeolocation(): GeolocationState & { retry: () => void }
```

---

## 4. データフロー

### ルート提案フロー（要件 2.1）

```
User                Frontend              Backend              External
  │                    │                     │                     │
  │ 距離+モード入力      │                     │                     │
  │ → 提案ボタン押下     │                     │                     │
  │──────────────────> │                     │                     │
  │                    │ POST /routes/suggest│                     │
  │                    │────────────────────>│                     │
  │                    │                     │ GET /v1/forecast    │
  │                    │                     │──────────────────>  │
  │                    │                     │ <──────────────────  │
  │                    │                     │ messages.parse()    │
  │                    │                     │──────────────────>  │
  │                    │                     │ <──────────────────  │
  │                    │                     │ GET /route          │
  │                    │                     │ (現在地→WP→現在地)  │
  │                    │                     │──────────────────>  │
  │                    │                     │ <──────────────────  │
  │                    │ 200 {polyline, ...} │                     │
  │                    │<────────────────────│                     │
  │ 地図にポリライン表示  │                     │                     │
  │<─────────────────── │                     │                     │
```

### ユーザー識別（MVP）

- 初回アクセス時に `crypto.randomUUID()` で UUID を生成
- `localStorage["userId"]` に保存
- 全 API リクエストの `X-User-Id` ヘッダーで送信
- バックエンドはこの値を DynamoDB の PK として使用

---

## 5. エラーハンドリング戦略

| シナリオ | バックエンド挙動 | フロントエンド表示 |
|--------|--------------|----------------|
| バリデーション失敗 | HTTP 422 | フォーム inline エラー |
| Open-Meteo 失敗 | 天気なしで続行 | エラー非表示（6.2） |
| Claude API 失敗 | HTTP 503 | 「サービス一時停止中」バナー |
| GraphHopper 失敗 | HTTP 503 | 「サービス一時停止中」バナー |
| 30 秒タイムアウト | HTTP 503 | ローディング → エラー表示（2.6） |
| 位置情報拒否 | - | 許可促進 UI + 手動入力（1.2） |

---

## 6. セキュリティ設計（要件 7.4〜7.5）

- GPS 座標はログに小数点 1 桁精度で記録（詳細座標は除外）
- レートリミット: `slowapi` で `10 req/min` per `X-User-Id`
- Lambda Function URL の CORS: `https://*.amplifyapp.com` のみ許可
- Claude API キー: Secrets Manager 経由（環境変数に直書きしない）
- GraphHopper API キー: Secrets Manager 経由

---

## 7. 非機能要件・既知リスク

| リスク | 影響 | 対策 |
|-------|------|------|
| Lambda コールドスタート（5〜10 秒） + Claude API（10〜20 秒） | 合計で要件 2.1「30 秒以内」を超える可能性がある | Lambda timeout = 60 秒（Function URL）。フロントエンドは 30 秒 UX タイマーを表示し、超過時は再試行 UI を提供。MVP では Provisioned Concurrency は使用しない（コスト優先） |
| GraphHopper が ±20% を超える距離を返す | 要件 2.4 違反 | waypoints 1 点間引いて 1 回再試行。それでも超過する場合は再試行結果をそのまま返し、フロントエンドで実距離を表示 |
| GraphHopper 無料枠（500 req/日）超過 | API エラー | 個人利用では超えない想定。超えた場合は self-hosted GraphHopper に切り替え |

---

## 8. 要件トレーサビリティ

| 要件 | 設計コンポーネント |
|-----|----------------|
| 1.1 | `useGeolocation` hook |
| 1.2 | `useGeolocation.error === "denied"` → 手動入力フォールバック |
| 1.3 | `useGeolocation.error === "timeout"` → retry 関数 |
| 2.1 | `POST /routes/suggest`（30 秒タイムアウト） |
| 2.2 | `RouteService.suggest()` → 天気 + 履歴 + AI |
| 2.3 | `RoutingService.generate_route(origin, waypoints, origin)` — 起点 = 現在地 |
| 2.4 | GraphHopper レスポンス `distance`（m）で ±20% 判定、超過時 waypoints 間引きで再試行 |
| 2.5 | `AIService.generate_waypoints()` プロンプト設計 |
| 2.6 | `httpx.AsyncClient(timeout=28)` + 503 返却 |
| 2.7 | `RouteRequestForm` スライダー（min=0.5, max=50） |
| 3.1 | `<Polyline positions={...} />` |
| 3.2 | `<Marker position={[lat, lon]} />` |
| 3.3 | `map.fitBounds(polyline.getBounds())` |
| 3.4 | TileLayer エラーハンドリング |
| 4.1 | `POST /routes/{id}/start` |
| 4.2 | `useRouteTracking` → `watchPosition` |
| 4.3 | `POST /routes/{id}/track` with `status="completed"` |
| 4.4 | ActiveRoute ページで現在地マーカーを更新 |
| 5.1 | `GET /routes/history` |
| 5.2 | `RouteCard` コンポーネント |
| 5.3 | History ページで RouteCard 選択 → RouteMap 表示 |
| 6.1 | `WeatherService.get_current_weather()` |
| 6.2 | `WeatherService` 失敗時 `None` を返す |
| 7.1 | React + Vite ビルド（標準ブラウザ対応） |
| 7.2 | Pydantic `RouteRequest` バリデーション |
| 7.3 | 外部サービス失敗時 `HTTPException(503)` |
| 7.4 | `round(lat, 1)` でログ出力 |
| 7.5 | `slowapi` レートリミット |
