# walk-jog-route MVP 設計仕様

**作成日**: 2026-05-19  
**ステータス**: 承認済み

---

## 概要

現在地から散歩・ジョギングルートを AI が提案する Web アプリの MVP。
個人利用（GitHub 公開）を前提とし、コスト・学習効果・拡張性のバランスを重視する。

---

## 確定要件

| 項目 | 内容 |
|------|------|
| 利用対象 | 個人利用（GitHub は公開） |
| 初期プラットフォーム | Web（React）。Android は後フェーズ |
| ルーティングエンジン | GraphHopper（Round Trip API） |
| AI の役割 | 文脈（履歴・天気）から経由地（lat/lon）を生成 → GraphHopper で路結 |
| AI モデル | Claude API（claude-sonnet-4-6） |
| 地図表示 | Leaflet + OpenStreetMap タイル |
| 出力 | ポリライン（地図上に描画） |
| 履歴収集 | 計画ルート保存 ＋ GPS 実績追記（Geolocation API） |
| 未探索判定 | AI が過去コンテキストから推論（グリッド分析なし） |
| 天気 API | Open-Meteo（無料・API キー不要・履歴取得可） |
| バックエンド | FastAPI + Python 3.12 |
| データ | DynamoDB（既存 IaC 定義） |

---

## アーキテクチャ

```
[React Web Frontend]
    │
    │ POST /routes/suggest
    ▼
[FastAPI Backend on Lambda]
    │
    ├─ Open-Meteo API ──→ 現在の天気・気温を取得
    ├─ DynamoDB ────────→ 過去ルート履歴を取得（直近 10 件）
    │
    ├─ Claude API ──────→ コンテキスト（履歴・天気・現在地）→ 経由地 JSON
    │                      {"waypoints": [{"lat":…,"lon":…}]}
    │
    └─ GraphHopper ────→ 経由地 + 目標距離で Round Trip 生成
                          → エンコードポリライン返却

[React Web Frontend]
    └─ Leaflet でポリラインを地図描画
    └─ Geolocation API で GPS 実績を記録
```

---

## コンポーネント設計

### Frontend（React + TypeScript）

| コンポーネント | 役割 |
|--------------|------|
| `RouteMap` | Leaflet 地図 + ポリライン描画 |
| `RouteRequestForm` | 距離 / 移動モード（walk/jog）入力 + 提案ボタン |
| `GpsTracker` | Geolocation API でリアルタイム座標を収集 |
| `RouteCard` | 履歴1件の表示 |
| `HistoryList` | 過去ルート一覧 |
| Pages | `Home`・`ActiveRoute`・`History` |

### Backend API（FastAPI）

| エンドポイント | 用途 |
|--------------|------|
| `POST /routes/suggest` | AI + GraphHopper でルート生成 |
| `POST /routes/{id}/start` | ルート開始を記録 |
| `POST /routes/{id}/track` | GPS 点を実績に追記 |
| `GET /routes/history` | 過去ルート一覧取得 |
| `GET /health` | ヘルスチェック |

### AI パイプライン（Claude API）

**入力プロンプトの構成要素:**
- 現在地（lat/lon）
- 目標距離・移動モード
- 過去ルートのサマリ（直近 10 件: エリア・日時・天気）
- 現在の天気・気温

**期待出力（JSON）:**
```json
{
  "waypoints": [
    {"lat": 35.123, "lon": 139.456},
    {"lat": 35.130, "lon": 139.462}
  ]
}
```

### DynamoDB スキーマ

```
Table: walk-jog-routes
  PK: userId （個人用途は固定値または localStorage UUID）
  SK: routeId（UUID）

Attributes:
  planned_polyline : string  （エンコードポリライン）
  actual_track     : list    （[{lat, lon, ts}, ...]）
  distance_km      : number
  mode             : string  （"walk" | "jog"）
  started_at       : string  （ISO8601）
  completed_at     : string  （nullable）
  weather          : map     （{temp_c, condition, ...}）
  ai_waypoints     : list    （[{lat, lon}, ...] ← デバッグ用）
```

---

## AWS デプロイ構成

> ⚠️ App Runner はメンテナンスモード。使用しない。

| コンポーネント | サービス | 月額目安 |
|--------------|---------|---------|
| バックエンド | Lambda（Container Image）+ Function URL | $0–3 |
| フロントエンド | Amplify Hosting | $0–5 |
| DB | DynamoDB（オンデマンド） | $0（無料枠内） |
| コンテナ | ECR | $1 |
| **合計** | | **$1–9/月** |

**FastAPI → Lambda に必要な追加（既存コードへの変更は最小）:**
```python
# requirements.txt
mangum

# main.py
from mangum import Mangum
handler = Mangum(app, lifespan="off")
```

---

## MVP 機能スコープ

### 含む
- ルート提案（AI経由地 → GraphHopper → ポリライン）
- 地図表示（Leaflet + OSM タイル）
- ルート開始ボタン → 計画ルートを DynamoDB に保存
- GPS 実績収集（Geolocation API、タブ開いている間）
- 履歴一覧表示

### 含まない（後フェーズ）
- 提案理由テキストの UI 表示（内部には保存する）
- Android アプリ（背景 GPS トラッキング）
- お気に入りマーク
- ルート評価・フィードバック

---

## 外部 API まとめ

| API | 用途 | 料金 |
|-----|------|------|
| GraphHopper Cloud | Round Trip ルーティング | 無料枠あり（500req/日） |
| Open-Meteo | 天気・気温（現在 + 履歴） | 完全無料・APIキー不要 |
| Claude API | 経由地生成 | トークン従量 |
| OpenStreetMap | 地図タイル | 無料 |

---

## 未決定事項（kiro 仕様化フェーズで詰める）

- GraphHopper: クラウド API vs. セルフホスト（MVP はクラウド推奨）
- Claude API のプロンプト設計・プロンプトキャッシュ有無
- GPS 実績の収集間隔（1秒 / 5秒 / 距離ベース）
- 「ルート完了」の判定方法（手動ボタン / 自動）
- Web でのユーザー識別方法（localStorage UUID で十分か）
