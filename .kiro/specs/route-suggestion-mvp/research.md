# リサーチログ: route-suggestion-mvp

**Discovery タイプ**: フルディスカバリー（新規グリーンフィールド）  
**調査日**: 2026-05-19

---

## サマリ

外部 API 4 件（GraphHopper、Open-Meteo、Claude API、React Leaflet）の最新仕様を調査した。
Claude API の構造化出力が `output_config.format` に移行済みであることと、
GraphHopper Round Trip が `round_trip.distance`（メートル）+ `round_trip.seed` で制御可能であることが主要発見。

---

## リサーチログ

### GraphHopper Round Trip API

**ソース**: https://docs.graphhopper.com/openapi/routing/getroute  
**調査内容**: 周回ルート生成に使うパラメータ

| パラメータ | 型 | 必須 | 内容 |
|-----------|-----|------|------|
| `point` | string | Yes | `lat,lon` 形式（1点でも周回可） |
| `algorithm` | string | Yes | `round_trip` を指定 |
| `profile` | string | Yes | `foot`（散歩・ジョギング両対応） |
| `round_trip.distance` | integer | No | 目標距離（メートル） |
| `round_trip.seed` | integer | No | 乱数シード（異なる値で異なるルート） |

**重要制約**:
- `round_trip.distance` は近似値。実際の距離は多少前後する（要件 2.4 の ±20% と整合）
- 無料枠: 500リクエスト/日（個人用途には十分）
- API キーが必要（Cloud API を使う場合）

**設計への影響**:
- `distance_km × 1000` をメートルに変換して渡す
- `seed` はリクエストごとに変えることで毎回違うルートを返せる

---

### Open-Meteo API

**ソース**: https://open-meteo.com/en/docs  
**調査内容**: 現在地の天気取得

**エンドポイント**:
```
GET https://api.open-meteo.com/v1/forecast
  ?latitude={lat}
  &longitude={lon}
  &current=temperature_2m,weathercode,windspeed_10m
  &timezone=auto
```

**レスポンス（current）**:
```json
{
  "current": {
    "temperature_2m": 22.3,
    "weathercode": 1,
    "windspeed_10m": 5.2
  }
}
```

**重要制約**:
- API キー不要、完全無料
- `weathercode` は WMO 天気コード（0=晴れ、45=霧、61=雨など）
- 過去データは `/v1/archive` エンドポイントで取得可能（履歴保存時に使う）

---

### Claude API 構造化出力

**ソース**: https://platform.claude.com/docs/en/build-with-claude/structured-outputs  
**調査内容**: JSON 構造化出力の最新実装方法

**重要変更（2025年）**:
- `output_format` パラメータ → `output_config.format` に移行済み
- beta ヘッダー不要（`structured-outputs-2025-11-13` は後方互換で残るが非推奨）

**推奨実装（Pydantic）**:
```python
from pydantic import BaseModel
from anthropic import Anthropic

class WaypointItem(BaseModel):
    lat: float
    lon: float

class RouteWaypoints(BaseModel):
    waypoints: list[WaypointItem]
    reasoning: str  # デバッグ・将来の表示用

client = Anthropic()
response = client.messages.parse(
    model="claude-sonnet-4-6",
    max_tokens=1024,
    messages=[{"role": "user", "content": prompt}],
    output_format=RouteWaypoints,
)
result: RouteWaypoints = response.parsed_output
```

**設計への影響**:
- Pydantic モデルを使うことで型安全かつバリデーション自動化
- `reasoning` フィールドを含めることで将来の UI 表示に対応できる

---

### React Leaflet

**ソース**: https://react-leaflet.js.org/  
**調査内容**: ポリライン描画・現在地表示の実装方法

**主要コンポーネント**:
- `<MapContainer>` → 地図コンテナ
- `<TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png">` → OSM タイル
- `<Polyline positions={[[lat,lon], ...]} />` → ポリライン
- `<Marker position={[lat,lon]} />` → 現在地マーカー
- `useMap()` フック → 地図インスタンスへのアクセス（`fitBounds` 等）

**Geolocation**:
- `navigator.geolocation.watchPosition()` で継続的に位置を追跡
- `map.fitBounds(polylineBounds)` でルート全体を表示（要件 3.3）

---

## アーキテクチャパターン評価

### AI 統合パターン

選択肢:
1. **直接 waypoint 生成**（採用）: Claude → waypoints → GraphHopper。責務分離が明確
2. **AI フィルタリング**: GraphHopper 複数候補 → Claude が選択。AI の出力が小さく安定
3. **自然言語 → ジオコーディング**: Claude → 地名 → Nominatim。ジオコーディング失敗リスクあり

→ パターン1 を採用。ただし GraphHopper が waypoints を無視して自律的に周回を生成する場合もあるため、AI は「ヒント」として扱う

### GraphHopper への AI waypoints の渡し方

Round Trip API は起点 1 点のみを受け取る設計。AI が返した waypoints を活かすには:
- **方式 A**: waypoints の重心を Round Trip の起点として渡す（シンプル）
- **方式 B**: waypoints を経由地として Routing API（非 Round Trip）で周回を構成する

→ MVP では **方式 A** を採用。AI が大まかな「方角・エリア」を提案し、GraphHopper がそのエリア周辺で Round Trip を生成する

---

## リスクと軽減策

| リスク | 影響度 | 軽減策 |
|-------|-------|-------|
| GraphHopper が指定距離から大幅に外れる | 中 | ±30% まで許容し、それ以上は再試行 |
| Claude API レスポンスが 30 秒超過 | 高 | Lambda timeout 60 秒、フロントエンドに 30 秒 UX タイマー表示 |
| GraphHopper 無料枠超過（500req/日） | 低 | 個人用途では超えない。超えた場合は self-hosted に切り替え |
| Open-Meteo が利用不能 | 低 | 要件 6.2 どおり天気なしで続行 |
