# Development Flow

このプロジェクトの開発フローを定義します。

---

## フロー全体像

```
Issue 作成
    ↓
kiro で仕様化（機能ごとに毎回）
    ↓
feature ブランチ作成（issue番号入り）
    ↓
TDD: Red → Green → Refactor
    ↓
ローカルチェック（lint + type check + test）
    ↓
/review でローカルレビュー
    ↓
commit → PR 作成
    ↓
CI（自動）+ AI レビュー（Claude API → PR コメント）
    ↓
指摘対応 → main merge
    ↓
CD: staging デプロイ → smoke test → 本番デプロイ
    ↓
観察（CloudWatch / フィードバック）→ Issue → ループ
```

---

## スキル・コマンド対応表

各フェーズで使うスキルとコマンドの一覧。エージェントはこの表を参照して適切なスキルを選択すること。

| フェーズ | スキル / コマンド | 用途 |
|---------|----------------|------|
| 企画・アイデア整理 | `superpowers:brainstorming` | 機能アイデアを設計に落とし込む |
| 仕様化（全体） | `/kiro:spec-init` `/kiro:spec-requirements` `/kiro:spec-design` `/kiro:spec-tasks` | kiro スペック駆動開発 |
| 実装 | `/kiro:spec-impl {feature}` | タスクをTDDで実装 |
| TDD サポート | `superpowers:test-driven-development` | Red→Green→Refactor サイクルの補助 |
| ローカルレビュー | `/review`（`code-review:code-review`） | PR 作成前のセルフレビュー |
| コミット | `commit-commands:commit` | Conventional Commits に沿ったコミット生成 |
| PR 作成 | `commit-commands:commit-push-pr` | コミット〜PR 作成までを一括実行 |
| 深いレビュー | `/ultrareview <PR番号>` | 設計変更・大規模リファクタリング時 |
| フロントデプロイ | `cloudflare-pages-deploy` | 静的サイトを Cloudflare Pages へデプロイ |
| 仕様進捗確認 | `/kiro:spec-status {feature}` | 現在のスペック進捗をいつでも確認 |

### ルール
- スキルはフェーズ開始前に確認し、該当するスキルがあれば必ず使う。
- `superpowers:brainstorming` は kiro 仕様化の「前段」として任意で使う（大きな機能や方針が曖昧な場合）。
- `/review` は Phase 6 で必須。`/ultrareview` は設計変更を含む PR に使う。

---

## Phase 1: Issue 作成

**すべての作業は Issue から始まる。** バグ修正・機能追加・リファクタリング問わず。

### Issue に書くこと
- 何を・なぜ実装するか（背景と目的）
- 受け入れ条件（完了の定義）
- 関連する既存 Issue / PR 番号

### エージェントへのルール
- Issue なしでコードを書き始めない。
- 作業中に別の問題を見つけた場合、その場で直さず新しい Issue を作る。

---

## Phase 2: kiro で仕様化

**機能ごとに毎回実行する。** プロジェクト開始時の一度だけではない。

```bash
/kiro:spec-init "機能の説明"
/kiro:spec-requirements {feature}
/kiro:spec-design {feature}
/kiro:spec-tasks {feature}
```

3 フェーズ（要件 → 設計 → タスク）それぞれで人間の承認を得てから次へ進む。
急ぐ場合のみ `-y` フラグで承認をスキップできるが、原則スキップしない。

---

## Phase 3: ブランチ作成

### 命名規則
```
feature/{issue番号}-{slug}   # 機能追加
fix/{issue番号}-{slug}       # バグ修正
refactor/{issue番号}-{slug}  # リファクタリング
```

例:
```
feature/12-route-suggestion-api
fix/34-distance-calculation-overflow
```

### ルール
- `main` に直接コミットしない。
- 1 ブランチ = 1 Issue（複数の関心事を混ぜない）。
- ブランチ名は kebab-case、英語。

---

## Phase 4: TDD サイクル

```
Red   → テストを先に書いて失敗させる
Green → 最小限の実装でテストを通す
Refactor → コードを整理する（テストが通ったまま）
```

### ルール
- テストは実装の後に書かない。最低でも実装と同時に書く。
- Refactor 後に必ずテストを再実行して通過を確認する。
- 1 サイクルは小さく保つ（数時間以内に完結する粒度）。

---

## Phase 5: ローカルチェック（PR 前）

PR を出す前に以下を全て通す。

```bash
# Backend
ruff check .          # lint
mypy .                # type check
pytest                # test

# Frontend
pnpm lint
pnpm type-check
pnpm test
```

1 つでも失敗した状態で PR を出さない。

---

## Phase 6: ローカルレビュー

PR 作成前に Claude Code でセルフレビューを実施する。

```
/review
```

指摘があれば対応してからコミットする。

---

## Phase 7: commit & PR 作成

### commit
- `20-conventional-commits.md` のルールに従う。
- 1 コミット = 1 目的。

### PR
- タイトルに Conventional Commits の type を含める。
- 本文に `Closes #issue番号` を記載して Issue と紐付ける。
- 差分は 400 行以内を目安にする。大きくなる場合はブランチを分割する。

---

## Phase 8: CI + AI レビュー

### CI（GitHub Actions）が行うこと
- lint / type check / test / build の自動実行
- 全チェック通過が merge の必須条件

### AI レビュー（Claude API）
- PR 作成をトリガーに GitHub Actions ワークフローが起動
- PR の diff を Claude API に投げてレビューコメントを自動投稿
- 指摘内容を確認し、対応 or 理由を添えて Resolve する

### 重要な PR には ultrareview
```
/ultrareview <PR番号>
```
設計変更・大きなリファクタリングなど、深いレビューが必要な場合に使う。

---

## Phase 9: CD（main merge 後）

### 自動フロー
```
main merge
    ↓
GitHub Actions: Docker build → ECR push
    ↓
staging（App Runner）へデプロイ
    ↓
smoke test（ヘルスチェック + 主要エンドポイント疎通確認）
    ↓
smoke test 通過 → 本番デプロイ
smoke test 失敗 → 自動ロールバック + Slack / メール通知
```

### ルール
- staging をスキップして本番に直接デプロイしない。
- smoke test が失敗した場合、手動で原因を確認してから再デプロイする。
- 本番デプロイ後は CloudWatch でエラーレートを 10 分間監視する。

---

## Phase 10: 観察とフィードバック

- CloudWatch のエラーレート・レイテンシを定期的に確認する。
- 改善点・不具合を発見したら **その場で Issue を作成する**。
- Issue を作ったら Phase 1 からループする。

---

## エージェントへのルール（全フェーズ共通）

- Issue なしで実装を始めない。
- kiro の仕様化を省略しない（緊急の hotfix を除く）。
- ローカルチェックが通らない状態でコミットしない。
- CI が赤い状態で merge しない。
- staging smoke test が失敗した場合は本番デプロイを止め、ユーザーに報告する。
- `50-agent-safety.md` の制約を全フェーズで遵守する。

---

## コード設計原則

- 関心の分離を保つ。
- 状態とロジックを分離する。
- 可読性と保守性を重視する。
- コントラクト層（API/型）を厳密に定義し、実装層は再生成可能に保つ。
- 静的検査可能なルールはプロンプトではなく、linter か ast-grep で記述する。

---

## 技術スタック

### Frontend
- TypeScript
- React Native / Expo

### Backend
- Python 3.12
- FastAPI
- pytest

### Infrastructure
- GitHub / GitHub Actions
- Docker
- AWS（CLI / CDK）
- Amazon ECR / App Runner
- DynamoDB
- CloudWatch
- OIDC
