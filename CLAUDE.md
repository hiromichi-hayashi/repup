# RepUp

筋トレに「行かなきゃ」の気持ちを仕組みで作り、ジム習慣の継続を支える iOS アプリ。
個人習慣化を軸に簡易チームを同梱。記録の積み重ね・トロフィー(シーズン制ランク)・チーム内ランキングで継続を後押しする。

このファイルは全会話で自動読み込みされる。詳細は `docs/` を参照する。

---

## 設計書 (Single Source of Truth)

実装と設計書が食い違ったら、**コードを直す前に設計書を直す**。

| ファイル | 役割 |
|---|---|
| `docs/01_concept.md` | コンセプト/要件 (As-Is→To-Be→GAP、スコープ、対象外 §7.3) |
| `docs/02_function_design.md` | 機能設計 (BASE-01/02, F01/F03/F04/F06)・API・状態遷移・連続/ランクのロジック |
| `docs/03_database_design.md` | DB 定義 (Prisma スキーマ前提) |
| `docs/04_screen_design.md` | 画面 (SC-01〜SC-09) |
| `docs/05_tech_stack.md` | 採用技術と棄却理由 |
| `docs/06_notification_design.md` | 通知・リマインド (cron / Expo Push) |
| `docs/07_implementation_roadmap.md` | BASE / P1〜P6 計画・依存グラフ |

機能IDは **BASE-01/02, F01, F03, F04, F06**(F02/F05 は対象外/統合済みで欠番)。
HTML 版は `docs/html/`。Markdown が正本で、HTML は同じ体裁の静的ファイルとして併置する(ビルド機構は持たない。Markdown を更新したら HTML も合わせて更新する)。

---

## スコープ

- **今回のスコープ**: 個人習慣化(記録・連続・トロフィー)+ 簡易チーム(目標・進捗共有・チーム内ランキング)。証明は自己申告。通知は iOS プッシュのみ
- **対象外 (2nd 以降)**: 準備チェックリスト / GPS チェックイン / 全国ランキング「日本で○位」/ 育成マッチョ / LINE・カレンダー連携 (`docs/01` §7.3)

## 技術スタック

- モバイル: React Native + Expo (iOS 優先) / TanStack Query / Expo Notifications
- バックエンド: Hono (TypeScript) / Prisma / Neon (PostgreSQL) / cron
- 認証: Better Auth (Sign in with Apple / メール+パスワード)
- ホスティング: Cloudflare Workers 推奨(PoC で確定、`docs/05` §3)

---

## 標準ワークフロー (タスク → PR)

1 タスク(GitHub issue / 説明)を実装〜PR まで通す手順。並列でやる時は worktree ごとに別セッションで同じ手順を回す。

```
[セッション準備 — タスクごとに1回]
  /worktree-setup <task>               worktree + branch 作成
  cd .worktrees/<branch> && claude     ← 作業場所に入る

[worktree 内のセッションで]
  /feature-flow <task>
    1. spec-driven-dev <task>          Phase 0-4 (タスク把握・doc読込・整合・ブレスト・計画・実装)
         ├─ 計画書セルフレビュー        writing-plans 後 — ユーザー承認は取らず即実装
         └─ 各ステップ /step-complete   superpowers:code-reviewer でレビュー → Must-fix なら即修正→再レビュー
    2. superpowers:requesting-code-review   ブランチ全体の最終レビュー
    3. 全レビュー後の一括修正           Must-fix をまとめて修正 → テスト緑を確認
    4. AskUserQuestion                  PR を作成して良いか確認
    5. gh pr create                     1 タスク = 1 PR (課題リンク/説明 + 設計書根拠)
```

ユーザー設定: **完全自動モード**。計画書はセルフレビュー後ユーザー承認なしで即実装へ。各ステップのレビュー指摘は最終 requesting-code-review 後にまとめて修正する(per-step では報告のみ)。テストは各ステップで通過必須。設計書間の矛盾・不明点を検出した場合と PR 作成前のみ人に確認する。

---

## 絶対ルール

### スキル invocation (必須)
- 1 タスクを実装〜PR まで通す時は worktree に入って `/feature-flow <task>` を呼ぶ
- 実装ステップが一段落・commit 直前に **必ず** `/step-complete` を呼ぶ
- 新機能・コンポーネント作成の前に `superpowers:brainstorming` を呼ぶ(spec-driven-dev Phase 1 内で発動)
- 実装の前に `superpowers:test-driven-development` を意識する
- 完了主張・PR の前に `superpowers:verification-before-completion` を呼ぶ
- バグや予期しない挙動に当たったら `superpowers:systematic-debugging` を呼ぶ

### Must-fix の判定基準 (step-complete でその場修正)
以下のいずれかは severity に関わらず Must-fix:
- critical / high severity
- 規約違反(下記コーディング規約)
- 型安全性違反(`any` / `as` / `@ts-ignore` / non-null assertion `!`)
- 明らかな不具合(null deref / データ不整合 / 例外握り潰し / 認証・権限漏れ / 越権 / SQLi・XSS)
- **設計書逸脱 / 不変条件違反**(下記)
- テスト未整備(主要パスのカバー漏れ)

### 開発規律 (repup 固有)
- 設計書 `docs/01-07` から外れる「自走」をしない。逸脱が必要なら設計書を先に更新
- **不変条件を壊さない**:
  - 連続カウント・リマインドは各自の `Schedule`(個人の通う日)が基準。チームの推奨通う日は取り込み元テンプレートで個人を置き換えない(`docs/02` §6.1, §7.2)
  - トロフィーは**昇格のみ・降格なし・年次(シーズン)リセット**(`docs/02` §6.2)
  - 行った証明は**自己申告**(記録完了=行った。GPS判定はしない、`docs/01` §5)
- **オンラインファースト**: サーバーが SSoT。端末にローカル DB を持たない
- **対象外(NA, `docs/01` §7.3)を実装に混ぜない**(チェックリスト/GPS/全国ランキング/育成マッチョ/外部連携)
- **旧名を使わない**: `/me`・`/trophies`・`/account/goal`(廃止)/ `weeklyTarget`(廃止)/ Checklist 系テーブル(対象外)
- `main` に直 push しない / `--no-verify` で git hook を skip しない
- Markdown を直したら `docs/html/` も合わせて更新する

### コーディング規約
- TypeScript でフロント・バック統一
- API スキーマは zod で定義しフロント・バックで共有
- 文字コード UTF-8 / 内部 UTC / 表示 JST 固定
- 命名: ファイル kebab-case / 関数・変数 camelCase / 型・コンポーネント PascalCase
- コメントは「なぜ非自明か」のみ書く(HOW・WHAT を書かない)
- 機密情報を log/commit に出さない

### git
- ブランチ命名: `<task>-<short-slug>`(例 `12-team-goal` / `feat-rank-api`)
- commit message: `<type>(<scope>): <subject>`(type: feat / fix / refactor / test / docs / chore)
- PR はタスクごとに **1つ**。本文に課題(issue URL / 説明)と設計書根拠(`docs/xx §y`)を含める

---

## 利用可能なスキル / エージェント

### このプロジェクト固有 (`.claude/`)
- `/feature-flow <task>` — worktree 内で 1 タスクを実装〜PR まで通すオーケストレーター
- `/worktree-setup <task>` — タスクから worktree + branch を作成(並列開発)
- `/spec-driven-dev [<task>]` — 設計書を SSoT として Phase 0〜4 を駆動
  - `references/doc-map.md` — repup の設計書ナビ(CN/FN/DB/SC/TS/NT/RM、機能ID、画面ID、grepパターン)
  - `references/consistency-checks.md` — 実装 vs 設計書 / 設計書間の整合チェック(不変条件含む)
- `/step-complete` — 各ステップのレビューゲート(superpowers:code-reviewer を spawn → Must-fix/Defer 分類)
- agent: `scope-investigator` — タスク + 設計書を事実ベースで突き合わせ(Phase 1 のオプション)

### 標準 (superpowers / 他)
- `superpowers:brainstorming` / `test-driven-development` / `verification-before-completion`
- `superpowers:writing-plans` / `executing-plans` / `systematic-debugging`
- `superpowers:requesting-code-review` / `receiving-code-review`
- `code-review` — diff レビュー(high/max で高網羅)

---

## 困ったとき

- 設計判断の根拠 → `docs/05_tech_stack.md` の「棄却した選択肢」
- 実装順序・依存 → `docs/07_implementation_roadmap.md` §3 依存グラフ
- DB スキーマ → `docs/03_database_design.md`
- API/画面の細部 → `docs/02_function_design.md` / `docs/04_screen_design.md`
- 連続/ランクのロジック → `docs/02_function_design.md` §6
- 未確定事項 → `docs/02` §8(トロフィー閾値・ランキング指標)/ `docs/05` §3(ホスティング)
- 不明点があれば **推測せず人間に確認**(設計書にない実装は禁止)
