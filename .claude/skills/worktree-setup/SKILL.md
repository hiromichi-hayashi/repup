---
name: worktree-setup
description: "Linear Issue ID を起点に git worktree を作成し、並列開発環境をセットアップするスキル。使用タイミング: (1) チケットを並列で作業したい時、(2) /worktree-setup または /worktree-setup DEV-123 と呼ばれた時、(3) 複数の Issue を同時進行したい時。worktree 作成後はそのディレクトリで spec-driven-dev を実行する前提。"
---

# Worktree Setup

Linear Issue ID から git worktree を作成し、独立した開発環境を構築するスキル。各 worktree でポートを分離し、Claude の設定を共有する。

## ワークフロー

### Step 1: Issue ID の取得

1. 引数から Linear Issue ID を取得する（例: `DEV-9`）
2. Issue ID がなければ AskUserQuestion で確認する
3. Linear MCP ツール (`get_issue`) で Issue の内容を取得し、タイトルを確認する

### Step 2: ブランチ名の決定

Issue の情報からブランチ名を生成する:

```
feature/{Issue ID}-{Feature Name}
```

- Feature Name は Issue タイトルから kebab-case で生成
- 例: Issue ID = `DEV-12`, タイトル = "記事一覧画面の実装" → `feature/DEV-12-article-list`
- 同名ブランチが既に存在する場合はそのブランチを使用する

### Step 3: Worktree の作成と環境セットアップ

バンドルされたセットアップスクリプトを実行する:

```bash
bash "$(git rev-parse --show-toplevel)/.claude/skills/worktree-setup/scripts/setup-worktree.sh" "<branch-name>"
```

スクリプトが自動で行うこと:
- `.worktrees/` ディレクトリに worktree を作成（gitignore 自動追加）
- `.env`, `.env.local` 等の環境変数ファイルをコピー
- ポート番号を自動割り当て（`.env.local` に `PORT=<番号>` を追記）
- `.claude/` ディレクトリを完全コピー（スキル・設定を共有）
- その他の AI 設定ファイル（`.cursorrules` 等）をコピー
- `npm install` と `prisma generate` を実行

### Step 4: 結果の報告とガイド

セットアップ完了後、以下を報告する:

```
Worktree ready!
  Path:   .worktrees/<branch-name>
  Branch: <branch-name>
  Port:   <port>

次のステップ:
  1. cd <worktree-path>
  2. claude を起動
  3. /spec-driven-dev <Issue ID> を実行
```

## 管理コマンド

worktree の一覧・削除はスキル外で直接 git コマンドを使う:

```bash
git worktree list          # 一覧
git worktree remove <path> # 削除
```

## 注意事項

- worktree 側で `next dev` を実行する際は自動割り当てのポートが使われる
- メインリポジトリと worktree は同じ `.git` を共有するため、ブランチの重複は不可
- worktree 内で spec-driven-dev を実行する際、ブランチの作成やチェックアウトは不要（既に正しいブランチにいるため）
