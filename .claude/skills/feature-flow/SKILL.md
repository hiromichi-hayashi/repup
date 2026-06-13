---
name: feature-flow
description: worktree 内で 1 タスク(GitHub issue / 説明)を end-to-end 実装するオーケストレーター。spec-driven-dev で設計書グラウンディング付きの実装を回し、各ステップで step-complete を gate として通す (Must-fix = 規約違反・型安全性違反・明らかな不具合・設計書逸脱 はその場で修正→再レビュー、Defer = 主観的 style は記録)。最終に requesting-code-review、残った Must-fix をまとめて修正、ユーザー確認のうえ PR を作成する。worktree-setup で作った worktree 内・対象ブランチ上で実行する前提。使用タイミング (1) /feature-flow <task> と呼ばれた時、(2) worktree に入って 1 タスクを実装〜PR まで通したい時。
---

# feature-flow: 1 issue を実装〜PR まで

worktree 内で 1 タスク(GitHub issue / 説明)を end-to-end で実装し、PR まで上げるオーケストレーター。

## 前提

- `worktree-setup` で worktree + branch を作成済みで、**その worktree 内で claude を起動している** (= 既に対象ブランチにいる)
- まだなら以下を案内して停止する:
  > 先に `/worktree-setup <issue-id>` を実行し、生成された worktree に `cd` して claude を起動してから `/feature-flow <issue-id>` を呼んでください。
- 現在のブランチ名に issue ID が含まれているか確認し、含まれていなければ AskUserQuestion で続行可否を確認

## フロー

### 1. 実装 (spec-driven-dev)

`Skill` ツールで `spec-driven-dev <issue-id>` を invoke。Phase 0-4 (タスク把握・設計書読込・整合チェック・ブレスト・計画・実装) を駆動する。

CLAUDE.md のルールにより、spec-driven-dev 実行中に以下が効く:

- **計画書セルフレビュー** (writing-plans 後): 計画を自己レビューする。観点 = 他コードとの平仄 / データ不整合・不具合が起きないことを事実ベースで検証 / 全ステップが設計書に根拠を持つか。問題あれば計画を修正。**ユーザー承認は取らず即実装へ**
- **各ステップ step-complete** (executing-plans の各ステップ後): step-complete を呼ぶ。`superpowers:code-reviewer` agent でレビューし、指摘を **Must-fix (品質クリティカル: 規約違反 / 型安全性違反 (any/as 等) / 明らかな不具合 / 設計書逸脱)** と **Defer (主観的 style/設計提案)** に分類する。
  - **Must-fix があれば NEEDS_FIX が返るので、その場で修正 → 再度 step-complete → PASS するまで loop** (品質を per-step で担保)
  - Defer 指摘は記録のみ、最終レビューで再評価
  - 3回連続 NEEDS_FIX なら escalate

### 2. 最終レビュー

`Skill` ツールで `superpowers:requesting-code-review` を invoke。ブランチ全体を comprehensive にレビューし、critical / high / minor を確定する。

### 3. 全レビュー後の一括修正

最終レビューで挙がった **Must-fix** 指摘 (Step 1 で per-step に拾えなかったクロス cutting 問題や、Step 1 で Defer された中で最終時点で重要と判明したもの) をまとめて修正する。修正後、テストを再度通す (プロジェクトのテストコマンド)。

- 主観的な軽微 Defer は修正必須ではなく、PR 本文に「既知事項」として残してよい
- 修正により diff が変わるので、最後にもう一度テストが緑であることを確認 (`superpowers:verification-before-completion`)

### 4. PR 作成確認

`AskUserQuestion` で「この内容で PR を作成して良いか」をユーザーに確認する。

- 変更サマリ・テスト結果・残す minor 指摘を提示してから聞く
- ユーザーが否なら PR は作らず、指示を仰ぐ

### 5. PR 作成

承認されたら `gh` で PR を作成する (CLAUDE.md の git ルール準拠):

```bash
git push -u origin <branch-name>

gh pr create --title "[<issue-id>] <issue title>" --body "$(cat <<'EOF'
## 課題
<GitHub issue URL / タスク説明>

## 概要
<issue 由来の1-2行サマリ>

## 変更点
<commit log を要約した bullet list>

## 設計書根拠
- docs/0X_xxx.md §Y.Y
- ...

## テスト計画
- [x] ユニット / 統合テスト
- [ ] 手動確認: <該当画面/フロー>

## 既知の minor 指摘 (今回は見送り)
- <ある場合のみ>

🤖 Generated with Claude Code
EOF
)"
```

base は `main`。PR URL をユーザーに返して終了。

## 禁止事項

- 計画書のユーザー承認待ち (不要、セルフレビュー後そのまま実装へ)
- per-step の Must-fix 指摘を放置して次のステップへ進む (品質が per-step で崩れる)
- per-step で Defer 指摘 (主観的 style) をその場で修正する (最終レビューに送る)
- ユーザー確認なしの PR 作成
- `--no-verify` で hook を skip
- `main` に直 push
