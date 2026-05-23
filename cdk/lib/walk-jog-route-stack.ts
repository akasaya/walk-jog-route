import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as amplify from "aws-cdk-lib/aws-amplify";
import { Construct } from "constructs";

const GITHUB_OWNER = "akasaya";
const GITHUB_REPO = "walk-jog-route";

export class WalkJogRouteStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ── DynamoDB ────────────────────────────────────────────────────────────
    // テーブルは初回デプロイ時に作成済み（RETAIN ポリシーのためロールバックされなかった）
    const table = dynamodb.Table.fromTableName(this, "RouteTable", "walk-jog-routes");

    // ── ECR ─────────────────────────────────────────────────────────────────
    // リポジトリは初回デプロイ前に手動作成済み（aws ecr create-repository）
    const repo = ecr.Repository.fromRepositoryName(this, "AppRepo", "walk-jog-route");

    // ── Secrets ──────────────────────────────────────────────────────────────
    // Claude は Bedrock 経由のため API キー不要
    const graphhopperApiKeySecret = new secretsmanager.Secret(
      this,
      "GraphhopperApiKey",
      {
        secretName: "walk-jog-route/graphhopper-api-key",
        description: "GraphHopper Routing API Key",
      },
    );

    // ── Lambda 実行ロール ──────────────────────────────────────────────────
    const lambdaRole = new iam.Role(this, "LambdaExecutionRole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AWSLambdaBasicExecutionRole",
        ),
      ],
    });
    table.grantReadWriteData(lambdaRole);
    graphhopperApiKeySecret.grantRead(lambdaRole);
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      actions: ["bedrock:InvokeModel"],
      resources: ["*"],
    }));
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        "aws-marketplace:ViewSubscriptions",
        "aws-marketplace:Subscribe",
        "aws-marketplace:Unsubscribe",
      ],
      resources: ["*"],
    }));

    // ── Lambda (Container Image) + Function URL ────────────────────────────
    const imageTag = process.env.IMAGE_TAG ?? "latest";
    const fn = new lambda.DockerImageFunction(this, "ApiFunction", {
      functionName: "walk-jog-route-api",
      code: lambda.DockerImageCode.fromEcr(repo, { tagOrDigest: imageTag }),
      timeout: cdk.Duration.minutes(1),
      memorySize: 512,
      role: lambdaRole,
      environment: {
        ENV: "production",
        GRAPHHOPPER_API_KEY_SECRET: graphhopperApiKeySecret.secretName,
      },
    });

    const fnUrl = fn.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      cors: {
        allowedOrigins: ["*"],
        allowedMethods: [lambda.HttpMethod.ALL],
        allowedHeaders: ["*"],
      },
    });

    // ── GitHub Actions OIDC デプロイロール ────────────────────────────────
    const githubProvider = new iam.OpenIdConnectProvider(this, "GithubOidc", {
      url: "https://token.actions.githubusercontent.com",
      clientIds: ["sts.amazonaws.com"],
    });

    const deployRole = new iam.Role(this, "DeployRole", {
      roleName: "walk-jog-route-deploy-role",
      assumedBy: new iam.WebIdentityPrincipal(
        githubProvider.openIdConnectProviderArn,
        {
          StringEquals: {
            "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
            "token.actions.githubusercontent.com:sub": `repo:${GITHUB_OWNER}/${GITHUB_REPO}:ref:refs/heads/main`,
          },
        },
      ),
      inlinePolicies: {
        EcrAndLambdaDeploy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: ["ecr:GetAuthorizationToken"],
              resources: ["*"],
            }),
            new iam.PolicyStatement({
              actions: [
                "ecr:BatchCheckLayerAvailability",
                "ecr:PutImage",
                "ecr:InitiateLayerUpload",
                "ecr:UploadLayerPart",
                "ecr:CompleteLayerUpload",
              ],
              resources: [repo.repositoryArn],
            }),
            new iam.PolicyStatement({
              actions: ["lambda:UpdateFunctionCode"],
              resources: [fn.functionArn],
            }),
          ],
        }),
      },
    });

    // ── Amplify Hosting ───────────────────────────────────────────────────
    // GitHub OAuth トークンを Secrets Manager に保存してから cdk deploy すること:
    //   aws secretsmanager create-secret \
    //     --name walk-jog-route/github-token \
    //     --secret-string "<your-github-pat>"
    const amplifyApp = new amplify.CfnApp(this, "FrontendApp", {
      name: "walk-jog-route",
      // amplify.yml をリポジトリルートから自動検出
      buildSpec: [
        "version: 1",
        "frontend:",
        "  phases:",
        "    preBuild:",
        "      commands:",
        "        - cd frontend && pnpm install --frozen-lockfile",
        "    build:",
        "      commands:",
        "        - pnpm build",
        "  artifacts:",
        "    baseDirectory: frontend/dist",
        "    files:",
        "      - '**/*'",
        "  cache:",
        "    paths:",
        "      - frontend/node_modules/**/*",
      ].join("\n"),
      environmentVariables: [
        {
          name: "VITE_API_BASE_URL",
          value: fnUrl.url,
        },
      ],
    });

    new amplify.CfnBranch(this, "MainBranch", {
      appId: amplifyApp.attrAppId,
      branchName: "main",
      enableAutoBuild: true,
    });

    // ── Outputs ───────────────────────────────────────────────────────────
    new cdk.CfnOutput(this, "ApiUrl", {
      value: fnUrl.url,
      description: "Lambda Function URL (API endpoint)",
      exportName: "WalkJogRouteApiUrl",
    });

    new cdk.CfnOutput(this, "DeployRoleArn", {
      value: deployRole.roleArn,
      description:
        "GitHub Actions deploy role — set as AWS_DEPLOY_ROLE_ARN in GitHub Secrets",
      exportName: "WalkJogRouteDeployRoleArn",
    });

    new cdk.CfnOutput(this, "AmplifyAppId", {
      value: amplifyApp.attrAppId,
      description: "Amplify App ID",
    });
  }
}
