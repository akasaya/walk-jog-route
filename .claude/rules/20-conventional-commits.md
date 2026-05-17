# Conventional Commits Rule

このリポジトリのコミットメッセージは Conventional Commits に従います。

## Format

```text
<type> (<scope>): <description>
```

- scopeは任意です。

```text
<type>: <description>
```
も許可します。

## Allowed types
- feat: ユーザー向け機能の追加
- fix: バグ修正
- docs: ドキュメントのみの変更
- test: テストの追加・修正
- refactor: 振る舞いを変えない内部構造の変更
- perf: パフォーマンス改善
- style: フォーマット、空白、命名などの変更
- build: ビルド、依存関係、パッケージ管理の変更
- ci: GitHub Actions などCI/CD設定の変更
- chore: その他の雑務
- infra: AWS/CDK/IaCなどインフラ構成の変更

## Allowed scopes
推奨scope:
- backend
- route-core
- route-harness
- mobile
- web
- infra
- ci
- docs
- deps

### Example
```
feat(backend): add health check endpoint
test(route-core): add distance calculation tests
ci(backend): run pytest on pull requests
infra(cdk): add app runner service
docs(readme): add local setup guide
chore(repo): initialize project files
```

## Breaking changes
- 破壊的変更は `!` またはfooterを使います。
```text
feat(api)!: change route suggestion response format
```
または
```text
feat(api): change route suggestion response format
BREAKING CHANGE: routes[].points was renamed to routes[].polyline.
```

## Rules for agents
- コミットメッセージを提案するときは、このファイルに従う。
- 1コミットは1目的にする。
- 複数の関心事が混ざる場合は、コミットを分ける提案をする。
- description は英語の命令形または簡潔な現在形にする。
- 末尾にピリオドを付けない。
- 迷ったら chore ではなく、変更の目的に近い type を選ぶ。