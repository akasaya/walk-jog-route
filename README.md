# Walk Jog Route

現在地から散歩・ジョギングコースを AI が提案するWebアプリ。

**本番URL**: デプロイ後に Cloudflare Workers のダッシュボードで確認できます

---

## 機能

- 現在地（GPS）を起点にした周回ルートの自動生成
- 距離・モード（散歩 / ジョギング）の指定
- ルート走行中のリアルタイムトラッキング
- 走行履歴の保存・閲覧

---

## アーキテクチャ

```
ブラウザ (Cloudflare Workers Assets)
    │  HTTPS
    ▼
AWS Lambda (Function URL)  ←── GitHub Actions (OIDC) でデプロイ
    │
    ├── GraphHopper API  （ルート生成）
    ├── Claude API via Bedrock  （ルート提案 AI）
    ├── DynamoDB  （履歴保存）
    └── SSM Parameter Store  （APIキー管理）
```

| レイヤー | 技術 |
|---------|------|
| フロントエンド | React 19 + TypeScript + Leaflet、Cloudflare Workers Assets |
| バックエンド | Python 3.12 + FastAPI + Mangum、AWS Lambda (Zip) |
| インフラ | AWS CDK (TypeScript)、GitHub Actions (OIDC) |
| DB | DynamoDB (オンデマンド) |

---

## ローカル開発

### 前提

- Node.js 20 + pnpm 10
- Python 3.12
- AWS CLI（バックエンドのSSM/DynamoDBアクセス用、任意）

### フロントエンド

```bash
cd frontend
pnpm install
pnpm dev        # http://localhost:5173
```

環境変数（省略時は `http://localhost:8000` に接続）:

```bash
# frontend/.env.local
VITE_API_BASE_URL=https://<lambda-function-url>.lambda-url.ap-northeast-1.on.aws
```

### バックエンド

```bash
pip install -r backend/requirements.txt -r backend/requirements-dev.txt
uvicorn backend.main:app --reload   # http://localhost:8000
```

環境変数:

```bash
# .env.local（uvicorn 起動前に export）
GRAPHHOPPER_API_KEY=<your-key>      # GraphHopper APIキー（直接指定）
# または
GRAPHHOPPER_API_KEY_PARAM=/walk-jog-route/graphhopper-api-key  # SSM パラメータ名
```

### テスト

```bash
# Backend
ruff check backend/
mypy backend/
pytest tests/

# Frontend
cd frontend
pnpm test
pnpm lint
```

---

## インフラ管理（CDK）

```bash
cd cdk
npm install
npx cdk diff    # 差分確認
# デプロイはユーザーが手動で実行
npx cdk deploy
```

初回デプロイ後、SSM に GraphHopper API キーを設定:

```bash
aws ssm put-parameter \
  --name /walk-jog-route/graphhopper-api-key \
  --value "YOUR_KEY" \
  --type SecureString \
  --overwrite \
  --region ap-northeast-1
```

---

## CI/CD

`main` ブランチへの push で自動実行:

1. `test-backend` — ruff / mypy / pytest
2. `test-frontend` — pnpm test
3. `deploy` — Lambda zip ビルド & デプロイ（OIDC）
4. `deploy-frontend` — Cloudflare Workers へビルド & デプロイ

### 必要な GitHub Secrets

| シークレット名 | 内容 |
|--------------|------|
| `AWS_DEPLOY_ROLE_ARN` | GitHub Actions 用 IAM ロール ARN |
| `VITE_API_BASE_URL` | Lambda Function URL |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API トークン（Workers 編集権限） |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare アカウント ID |
