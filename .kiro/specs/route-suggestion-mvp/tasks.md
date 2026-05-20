# 実装タスク: route-suggestion-mvp

**フィーチャー名**: route-suggestion-mvp  
**ステータス**: タスク生成済み（承認待ち）  
**作成日**: 2026-05-19  
**要件カバレッジ**: 1.1〜7.5 全要件

> `(P)` マーク付きタスクは前のタスクの完了を待たずに並行して開始できる。

---

## 1. バックエンド基盤を構築する

**要件**: 7.1, 7.2, 7.3  
**完了条件**: FastAPI が起動し、ヘルスチェックが 200 を返す。Lambda 用コンテナが buildできる。

- [x] 1.1 FastAPI プロジェクトを初期化し、Pydantic モデル（RouteRequest, WeatherData, WaypointItem, RouteWaypoints, RouteSuggestionResponse, TrackRequest）を `models/route.py` に定義する
- [x] 1.2 DynamoDB `HistoryService` を実装する（ルート保存・時系列降順取得・GPS 実績追記。PK=userId, SK=`{started_at}#{routeId}`）
- [x] 1.3 Lambda Container Image 対応の `Dockerfile` を作成し、`main.py` に `Mangum(app, lifespan="off")` アダプタを追加する
- [x] 1.4 `GET /health` エンドポイントを実装し、`{"status": "ok"}` を返すことを確認する

---

## 2. 天気情報サービスを実装する (P)

**要件**: 6.1, 6.2  
**完了条件**: Open-Meteo から天気取得できる。失敗時に None を返す（例外を伝播しない）。

- [x] 2.1 `WeatherService.get_current_weather(lat, lon)` を実装する（Open-Meteo `/v1/forecast?current=temperature_2m,weathercode,windspeed_10m`）
- [x] 2.2 `WeatherService` の単体テストを書く（正常系・Open-Meteo 失敗時の None 返却）

---

## 3. AI 経由地生成サービスを実装する (P)

**要件**: 2.2, 2.5  
**完了条件**: Claude API が RouteWaypoints（waypoints + reasoning）を構造化出力で返す。

- [x] 3.1 `AIService.generate_waypoints()` を実装する（`client.messages.parse(output_format=RouteWaypoints)` で構造化出力）
- [x] 3.2 プロンプトテンプレートを実装する（現在地・目標距離・移動モード・天気・過去履歴サマリを埋め込む。生座標はプロンプトに含めず 1 桁精度に丸める）
- [x] 3.3 `AIService` の単体テストを書く（Claude API をモック、RouteWaypoints の型を検証）

---

## 4. GraphHopper ルーティングサービスを実装する (P)

**要件**: 2.3, 2.4  
**完了条件**: GraphHopper Routing API が呼ばれ、エンコードポリラインと実距離が返る。距離超過時に再試行する。

- [x] 4.1 `RoutingService.generate_route(origin, waypoints, profile)` を実装する（`GET /route?point=origin&point=wp1&...&point=origin&profile=foot`）
- [x] 4.2 実距離が目標距離の ±20% を超えた場合、waypoints を 1 点間引いて 1 回再試行するロジックを実装する
- [x] 4.3 `estimated_minutes` の計算を実装する（GraphHopper レスポンス `time`（ms）/ 60,000 の整数値）
- [x] 4.4 `RoutingService` の単体テストを書く（外部 API はモック、再試行ロジックを含む）

---

## 5. ルート提案 API エンドポイントを実装する

**要件**: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 7.2, 7.3, 7.5  
**完了条件**: `POST /routes/suggest` が 30 秒以内にポリラインを返す。異常系で適切なステータスコードを返す。

- [ ] 5.1 `RouteService.suggest(request)` を `async def` で実装する（Weather → History → AI → Routing を順次オーケストレーション）
- [ ] 5.2 `POST /routes/suggest` エンドポイントを実装する（`httpx.AsyncClient(timeout=28)` で 30 秒超過を HTTP 503 に変換）
- [ ] 5.3 `slowapi` でレートリミット（`10 req/min` per `X-User-Id` ヘッダー）を設定する
- [ ] 5.4 `POST /routes/suggest` の統合テストを書く（200 正常系・422 バリデーション失敗・503 外部サービスエラー）

---

## 6. ルート実行・GPS 記録 API を実装する

**要件**: 4.1, 4.2, 4.3  
**完了条件**: 開始・追跡・完了/中断がそれぞれ DynamoDB に保存される。

- [ ] 6.1 `POST /routes/{route_id}/start` を実装する（ボディから polyline・distance_km・mode・weather を受け取り DynamoDB に保存。`route_id` はパスパラメータのみ）
- [ ] 6.2 `POST /routes/{route_id}/track` を実装する（GPS 点リストを実績に追記し、`status` を更新する）

---

## 7. ルート履歴 API を実装する

**要件**: 5.1, 5.2, 5.3  
**完了条件**: `GET /routes/history` が時系列降順で RouteHistoryItem のリストを返す。

- [ ] 7.1 `GET /routes/history` エンドポイントを実装する（`X-User-Id` ヘッダーの userId で DynamoDB をクエリし、直近 20 件を返す）

---

## 8. フロントエンド基盤を構築する (P)

**要件**: 1.1, 1.2, 1.3, 7.1  
**完了条件**: React 開発サーバーが起動し、Geolocation が取得できる。API Client が動作する。

- [ ] 8.1 Vite + React + TypeScript + React Leaflet プロジェクトを `frontend/` に初期化する（pnpm）
- [ ] 8.2 API Client Layer（`api/client.ts`）と型付き API 関数（`api/routes.ts`）を実装する（`X-User-Id` ヘッダーの自動付与を含む）
- [ ] 8.3 `useGeolocation` hook を実装する（取得中・成功・拒否・タイムアウトの各状態と `retry` 関数）
- [ ] 8.4 `utils/userId.ts` を実装する（`localStorage` に UUID を永続化。`crypto.randomUUID()` で初回生成）

---

## 9. ルート提案画面を実装する

**要件**: 1.1, 1.2, 1.3, 2.1, 2.6, 2.7, 3.1, 3.2, 3.3, 3.4  
**完了条件**: 現在地取得 → 距離指定 → 提案ボタン → 地図にポリライン表示の一連フローが動作する。

- [x] 9.1 `RouteMap` コンポーネントを実装する（`MapContainer` + `TileLayer`（OSM） + `Polyline` + 現在地 `Marker`。オフライン時に「地図を表示できません」を表示）
- [x] 9.2 `RouteRequestForm` コンポーネントを実装する（距離スライダー min=0.5/max=50/step=0.5 + モード選択ボタン + 提案ボタン。`lat`/`lon` は `useGeolocation` から自動取得）
- [x] 9.3 `Home` ページを実装する（位置情報許可促進 UI・手動入力フォールバック・30 秒ローディング表示・エラーバナーを含む）
- [x] 9.4 地図の初期表示範囲をポリライン全体が収まるよう `map.fitBounds()` で自動調整する（要件 3.3）

---

## 10. ルート実行画面を実装する

**要件**: 4.1, 4.2, 4.3, 4.4  
**完了条件**: 開始ボタン押下 → GPS 追跡開始 → リアルタイム地図更新 → 完了/中断で記録が保存される。

- [ ] 10.1 `useRouteTracking` hook を実装する（`navigator.geolocation.watchPosition` で定期収集し、バッファが一定数に達したら `POST /track` を呼び出す）
- [ ] 10.2 `ActiveRoute` ページを実装する（提案ルートのポリライン表示・現在地マーカーのリアルタイム更新・完了/中断ボタン）

---

## 11. ルート履歴画面を実装する

**要件**: 5.1, 5.2, 5.3  
**完了条件**: 履歴一覧が表示され、ルートを選択すると地図にポリラインが表示される。

- [ ] 11.1 `RouteCard` コンポーネントを実装する（実施日時・移動モード・計画距離・実績記録の有無を表示）
- [ ] 11.2 `History` ページを実装する（ルート一覧 → 選択 → `RouteMap` でポリライン表示の連携）

---

## 12. セキュリティ・非機能要件を確認・実装する (P)

**要件**: 7.2, 7.4, 7.5  
**完了条件**: 範囲外入力が 422 を返す。ログに生座標が含まれない。レートリミットが動作する。

- [ ] 12.1 Pydantic `RouteRequest` の `Field` 範囲制約（lat: -90〜90、lon: -180〜180、distance_km: 0.5〜50）と 422 レスポンスを統合テストで確認する
- [ ] 12.2 ログ出力で GPS 座標を `round(lat, 1), round(lon, 1)` に丸めていることを確認し、必要な箇所に追加する

---

## 13. デプロイ設定を準備する

**要件**: 7.1  
**完了条件**: CDK diff が通り、Amplify ビルド設定が正しく動作する。

- [ ] 13.1 Amplify Hosting の `amplify.yml`（pnpm install + build + `frontend/dist` を成果物に指定）を作成する
- [ ] 13.2 CDK スタック（Lambda DockerImageFunction + DynamoDB + Amplify App）を確認し、`cdk diff` の結果をユーザーに提示する（`cdk deploy` はユーザーが実行）

---

## タスク依存関係

```
1（基盤）
  ├─ 2（Weather）   ─→  5（提案API）
  ├─ 3（AI）        ─→  5
  └─ 4（Routing）   ─→  5
                         ├─ 6（実行API）
                         └─ 7（履歴API）

8（FE基盤）  ─→  9（提案画面）  ─→  10（実行画面）
                              └─→  11（履歴画面）

5,6,7 + 9,10,11 完了 ─→ 13（デプロイ）
12（セキュリティ）: タスク 5 以降と並行して随時確認
```
