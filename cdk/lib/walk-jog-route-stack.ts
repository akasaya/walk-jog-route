import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";

const GITHUB_OWNER = "akasaya";
const GITHUB_REPO = "walk-jog-route";

export class WalkJogRouteStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ── DynamoDB ────────────────────────────────────────────────────────────
    const table = dynamodb.Table.fromTableName(this, "RouteTable", "walk-jog-routes");

    // ── SSM Parameter（Secrets Manager の代替・$0/月）──────────────────────
    // cdk deploy 後に実際の値を設定:
    //   aws ssm put-parameter --name /walk-jog-route/graphhopper-api-key \
    //     --value "YOUR_KEY" --type SecureString --overwrite --region ap-northeast-1
    const apiKeyParam = new ssm.StringParameter(this, "GraphhopperApiKeyParam", {
      parameterName: "/walk-jog-route/graphhopper-api-key",
      stringValue: "PLACEHOLDER",
      description: "GraphHopper Routing API Key",
      tier: ssm.ParameterTier.STANDARD,
    });

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
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      actions: ["ssm:GetParameter"],
      resources: [apiKeyParam.parameterArn],
    }));

    // ── Lambda（Zip）+ Function URL ────────────────────────────────────────
    // コードは CI が function.zip でデプロイする（cdk deploy はプレースホルダーを使用）
    const fn = new lambda.Function(this, "ApiFunction", {
      functionName: "walk-jog-route-backend",
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: "backend.main.handler",
      code: lambda.Code.fromAsset("lambda_placeholder"),
      timeout: cdk.Duration.minutes(1),
      memorySize: 512,
      role: lambdaRole,
      environment: {
        ENV: "production",
        GRAPHHOPPER_API_KEY_PARAM: apiKeyParam.parameterName,
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
        LambdaDeploy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: ["lambda:UpdateFunctionCode"],
              resources: [fn.functionArn],
            }),
          ],
        }),
      },
    });

    // ── Outputs ───────────────────────────────────────────────────────────
    new cdk.CfnOutput(this, "ApiUrl", {
      value: fnUrl.url,
      description: "Lambda Function URL (API endpoint)",
      exportName: "WalkJogRouteApiUrl",
    });

    new cdk.CfnOutput(this, "DeployRoleArn", {
      value: deployRole.roleArn,
      description: "GitHub Actions deploy role ARN",
      exportName: "WalkJogRouteDeployRoleArn",
    });
  }
}
