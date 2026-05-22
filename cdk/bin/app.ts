#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { WalkJogRouteStack } from "../lib/walk-jog-route-stack";

const app = new cdk.App();

new WalkJogRouteStack(app, "WalkJogRouteStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? "ap-northeast-1",
  },
  description: "Walk Jog Route MVP — Lambda + DynamoDB + Amplify",
});
