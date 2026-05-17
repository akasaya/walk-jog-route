# AWS / CI/CD Rule

このプロジェクトのインフラ構成と CI/CD パイプラインを定義します。

---

## アーキテクチャ全体図

```
GitHub Actions (OIDC)
    ↓
Docker build → ECR push
    ↓
App Runner（自動デプロイ）
    ├─ HTTPS / オートスケール: 組み込み済み
    └─ VPC Connector → DynamoDB（IAM認証）

Web フロントエンド
    S3 → CloudFront（OAC）
```

---

## コスト概算（個人・低トラフィック想定）

| リソース | 月額目安 |
|---------|---------|
| App Runner（0.25 vCPU / 0.5 GB） | ~$5–10 |
| ECR | ~$1 |
| DynamoDB（オンデマンド） | 無料枠内 |
| S3 + CloudFront | ~$0–1 |
| **合計** | **~$6–12** |

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
    - apprunner:StartDeployment（手動トリガーの場合）
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

## 3. App Runner

```typescript
const appRunner = new apprunner.Service(this, 'ApiService', {
  source: apprunner.Source.fromEcr({
    imageConfiguration: {
      port: 8000,
      environmentVariables: {
        ENV: 'production',
      },
      environmentSecrets: {
        MAPS_API_KEY: apprunner.Secret.fromSecretsManager(mapsApiKeySecret),
      },
    },
    repository: repo,
    tagOrDigest: process.env.IMAGE_TAG ?? 'latest', // CI から git SHA を渡す（IMAGE_TAG 環境変数）
  }),
  instanceRole: instanceRole, // DynamoDB アクセス用
  accessRole: accessRole,     // ECR アクセス用
  cpu: apprunner.Cpu.QUARTER_VCPU,   // 最小サイズでコスト抑制
  memory: apprunner.Memory.HALF_GB,
  autoDeploymentsEnabled: true,      // ECR push で自動デプロイ
});
```

### インスタンスロール（App Runner → DynamoDB）
```typescript
const instanceRole = new iam.Role(this, 'AppRunnerInstanceRole', {
  assumedBy: new iam.ServicePrincipal('tasks.apprunner.amazonaws.com'),
});
table.grantReadWriteData(instanceRole);
```

### アクセスロール（App Runner → ECR）
```typescript
const accessRole = new iam.Role(this, 'AppRunnerAccessRole', {
  assumedBy: new iam.ServicePrincipal('build.apprunner.amazonaws.com'),
});
repo.grantPull(accessRole);
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

## 5. Web フロントエンド（S3 + CloudFront）

```typescript
const bucket = new s3.Bucket(this, 'FrontendBucket', {
  blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL, // OAC 経由のみ許可
  removalPolicy: cdk.RemovalPolicy.DESTROY,
  autoDeleteObjects: true,
});

const distribution = new cloudfront.Distribution(this, 'Distribution', {
  defaultBehavior: {
    origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
  },
  priceClass: cloudfront.PriceClass.PRICE_CLASS_100, // US/EU/日本のみ（コスト削減）
  defaultRootObject: 'index.html',
  errorResponses: [
    { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html' }, // SPA 用
  ],
});
```

---

## 6. Secrets Manager

API キーなど秘密情報は Secrets Manager に置く。コードにハードコードしない。

```typescript
const mapsApiKeySecret = new secretsmanager.Secret(this, 'MapsApiKey', {
  secretName: 'walk-jog-route/maps-api-key',
});
```

---

## 7. GitHub Actions パイプライン

→ `.github/workflows/deploy.yml`

- `test` ジョブ（lint / type check / pytest）が通過してから `deploy` ジョブが実行される
- AWS 認証は OIDC（`AWS_DEPLOY_ROLE_ARN` を GitHub Secrets に設定）
- イメージタグは `github.sha` を使用

---

## 8. セキュリティチェックリスト

```
[ ] OIDC を使い、静的クレデンシャルを GitHub Secrets に置いていない
[ ] ECR リポジトリはプライベート
[ ] App Runner の環境変数に秘密情報を直書きしていない（Secrets Manager 経由）
[ ] S3 バケットはパブリックアクセスブロック済み（CloudFront OAC のみ）
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
- App Runner の設定変更（CPU/Memory/環境変数）は CDK で行い、コンソールで直接変更しない（ドリフトを避ける）。
