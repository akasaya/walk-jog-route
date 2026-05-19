# AWS / CI/CD Rule

このプロジェクトのインフラ構成と CI/CD パイプラインを定義します。

---

## アーキテクチャ全体図

```
GitHub Actions (OIDC)
    ↓
Docker build → ECR push
    ↓
Lambda（Container Image）+ Function URL
    └─ DynamoDB（IAM認証）

Web フロントエンド
    Amplify Hosting（GitHub 連携デプロイ）
```

> ⚠️ **App Runner はメンテナンスモードのため使用しない。** Lambda Container Image を使う。

---

## コスト概算（個人・低トラフィック想定）

| リソース | 月額目安 |
|---------|---------|
| Lambda（Container Image）+ Function URL | ~$0–3 |
| ECR | ~$1 |
| DynamoDB（オンデマンド） | 無料枠内 |
| Amplify Hosting | ~$0–5 |
| **合計** | **~$1–9** |

---

## 1. 認証・認可（OIDC）

GitHub Actions から AWS へのアクセスは **OIDC** で行う。
長期間有効な静的クレデンシャル（Access Key）はコードにもシークレットにも置かない。

### IAM ロール
```
GitHub Actions 用ロール（deploy-role）
  Trust: token.actions.githubusercontent.com
  Condition: repo:owner/walk-jog-route:ref:refs/heads/main
  Policy:
    - ecr:GetAuthorizationToken
    - ecr:BatchCheckLayerAvailability
    - ecr:PutImage
    - ecr:InitiateLayerUpload
    - ecr:UploadLayerPart
    - ecr:CompleteLayerUpload
    - lambda:UpdateFunctionCode
```

### CDK での定義例
```typescript
const githubProvider = new iam.OpenIdConnectProvider(this, 'GithubOidc', {
  url: 'https://token.actions.githubusercontent.com',
  clientIds: ['sts.amazonaws.com'],
});

const deployRole = new iam.Role(this, 'DeployRole', {
  assumedBy: new iam.WebIdentityPrincipal(
    githubProvider.openIdConnectProviderArn,
    {
      StringEquals: {
        'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
        'token.actions.githubusercontent.com:sub':
          'repo:owner/walk-jog-route:ref:refs/heads/main',
      },
    }
  ),
});
```

---

## 2. ECR

```typescript
const repo = new ecr.Repository(this, 'AppRepo', {
  repositoryName: 'walk-jog-route',
  lifecycleRules: [
    { maxImageCount: 5 }, // 古いイメージを自動削除してコスト抑制
  ],
  removalPolicy: cdk.RemovalPolicy.DESTROY,
});
```

- イメージタグは `git SHA` を使う（`latest` のみは追跡不能になるため使わない）。

---

## 3. Lambda（Container Image）+ Function URL

App Runner に代わるバックエンド実行環境。ECR のイメージをそのまま Lambda で動かす。
FastAPI には `mangum` アダプターを追加する（1 パッケージのみ）。

```typescript
const lambdaRole = new iam.Role(this, 'LambdaExecutionRole', {
  assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
  managedPolicies: [
    iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
  ],
});
table.grantReadWriteData(lambdaRole); // DynamoDB アクセス

const fn = new lambda.DockerImageFunction(this, 'ApiFunction', {
  code: lambda.DockerImageCode.fromEcr(repo, {
    tagOrDigest: process.env.IMAGE_TAG ?? 'latest', // CI から git SHA を渡す
  }),
  timeout: cdk.Duration.minutes(1),  // Claude API の応答を考慮して 60 秒
  memorySize: 512,
  environment: {
    ENV: 'production',
  },
  role: lambdaRole,
});

const fnUrl = fn.addFunctionUrl({
  authType: lambda.FunctionUrlAuthType.NONE, // 個人用途のため簡易化
  cors: {
    allowedOrigins: ['https://*.amplifyapp.com'],
    allowedMethods: [lambda.HttpMethod.ALL],
    allowedHeaders: ['*'],
  },
});
```

### FastAPI への追加（最小変更）

```python
# requirements.txt に追加
mangum

# main.py に追加
from mangum import Mangum
handler = Mangum(app, lifespan="off")
```

### GitHub Actions でのデプロイ（ECR push → Lambda 更新）

```yaml
- name: Update Lambda function
  run: |
    aws lambda update-function-code \
      --function-name walk-jog-route-api \
      --image-uri $ECR_REGISTRY/$ECR_REPOSITORY:${{ github.sha }}
```

---

## 4. DynamoDB

```typescript
const table = new dynamodb.Table(this, 'RouteTable', {
  tableName: 'walk-jog-routes',
  partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
  sortKey:      { name: 'routeId', type: dynamodb.AttributeType.STRING },
  billing: dynamodb.Billing.onDemand(), // 個人用途はオンデマンドが安い
  removalPolicy: cdk.RemovalPolicy.RETAIN, // データ保護
  pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
});
```

---

## 5. Web フロントエンド（Amplify Hosting）

S3 + CloudFront より簡単。CI/CD・HTTPS・CDN が GitHub 連携で自動構成される。

### GitHub 連携デプロイ（推奨）

Amplify コンソールまたは CDK で GitHub リポジトリを連携し、`main` ブランチへの push で自動ビルド・デプロイ。

```typescript
// CDK での Amplify Hosting 定義
import * as amplify from '@aws-cdk/aws-amplify-alpha';

const amplifyApp = new amplify.App(this, 'FrontendApp', {
  appName: 'walk-jog-route',
  sourceCodeProvider: new amplify.GitHubSourceCodeProvider({
    owner: 'your-github-username',
    repository: 'walk-jog-route',
    oauthToken: cdk.SecretValue.secretsManager('github-token'),
  }),
  buildSpec: codebuild.BuildSpec.fromObjectToYaml({
    version: '1.0',
    frontend: {
      phases: {
        preBuild: { commands: ['cd frontend && pnpm install'] },
        build: { commands: ['pnpm build'] },
      },
      artifacts: { baseDirectory: 'frontend/dist', files: ['**/*'] },
      cache: { paths: ['frontend/node_modules/**/*'] },
    },
  }),
});

amplifyApp.addBranch('main');
```

---

## 6. Secrets Manager

API キーなど秘密情報は Secrets Manager に置く。コードにハードコードしない。

```typescript
const claudeApiKeySecret = new secretsmanager.Secret(this, 'ClaudeApiKey', {
  secretName: 'walk-jog-route/claude-api-key',
});

// Lambda の環境変数（Secrets Manager ARN を渡し、起動時に取得）
environmentSecrets: {
  CLAUDE_API_KEY: lambda.Secret.fromSecretsManager(claudeApiKeySecret),
},
```

---

## 7. GitHub Actions パイプライン

→ `.github/workflows/deploy.yml`

- `test` ジョブ（lint / type check / pytest）が通過してから `deploy` ジョブが実行される
- AWS 認証は OIDC（`AWS_DEPLOY_ROLE_ARN` を GitHub Secrets に設定）
- イメージタグは `github.sha` を使用
- デプロイ: ECR push → `aws lambda update-function-code`

---

## 8. セキュリティチェックリスト

```
[ ] OIDC を使い、静的クレデンシャルを GitHub Secrets に置いていない
[ ] ECR リポジトリはプライベート
[ ] Lambda の環境変数に秘密情報を直書きしていない（Secrets Manager 経由）
[ ] Lambda Function URL の CORS を Amplify ドメインのみに制限している
[ ] DynamoDB は IAM 認証のみ（パブリックエンドポイントへの直接アクセスなし）
[ ] IAM ロールは最小権限（必要なアクションのみ許可）
[ ] CloudWatch Logs でアプリログを収集している
```

---

## エージェントへのルール

- CDK スタックの変更は `cdk diff` で差分を確認してからユーザーに提示し、`cdk deploy` はユーザーが実行する。
- `aws` CLI で本番リソースを直接変更しない（CDK 経由で管理する）。
- 静的クレデンシャルをコードに書かない。
- イメージタグは `latest` のみにしない（`git SHA` を必ず付ける）。
- **App Runner を提案・使用しない**（メンテナンスモード）。バックエンドは Lambda Container Image を使う。
- Lambda の設定変更（timeout/memory/環境変数）は CDK で行い、コンソールで直接変更しない（ドリフトを避ける）。
