---
name: step-complete
description: 実装ステップごとのレビューゲート。superpowers:code-reviewer agent で diff をレビューし、結果を Must-fix (即修正) と Defer (最終レビュー送り) に分類する。Must-fix があれば NEEDS_FIX を返してその場で修正させる。判定基準は CLAUDE.md と spec-driven-dev/references/consistency-checks.md。テスト・lint は executing-plans 側の責務で本スキルは介入しない。sentinel で重複起動を防ぐ。各ステップ末や commit 直前に呼ぶ。
---

# step-complete: 実装ステップのレビューゲート

各ステップで `superpowers:code-reviewer` agent を走らせ、結果を **Must-fix / Defer** に分類するゲート。

**役割**: 「コード品質・データ品質に関わる指摘 (Must-fix) は per-step で即修正する。主観的な提案 (Defer) は最終レビューに回す」。

テスト・型チェック・lint は executing-plans の verifications 側で実行される前提のため、本スキルはそれらに介入しない。

## Must-fix vs Defer の判定基準

`superpowers:code-reviewer` の指摘を以下のルールで分類する (呼び出し側で適用):

### Must-fix (このステップで即修正、PASS には全件解消が必要)

severity が **critical / high**、または severity が minor でも次のカテゴリに該当するもの:

| カテゴリ | 具体例 |
|---|---|
| **規約違反** | CLAUDE.md コーディング規約 (kebab-case ファイル / camelCase 関数 / PascalCase 型 / zod スキーマ未共有 / 内部時刻が UTC でない / JST 固定でない / WHAT/HOW コメント) |
| **型安全性違反** | `any` 型 / `as` 強制キャスト / `@ts-ignore` / `@ts-nocheck` / non-null assertion `!` / unsafe な型 narrowing |
| **明らかな不具合** | null/undefined 無防備アクセス / データ不整合 (重複・欠落・順序破壊) / 例外を握り潰す `catch {}` / 認証・権限チェック漏れ / 他ユーザーデータへの越権 / SQLi/XSS / レースコンディション |
| **設計書逸脱** | docs/01-07 と矛盾 / 棄却技術 (Supabase・Firebase・Drizzle・オフラインファースト, docs/05) の混入 / 不変条件違反 (連続=個人スケジュール基準でない / トロフィー降格実装 / 自己申告でなく勝手にGPS判定) / 対象外機能 (チェックリスト等, docs/01 §7.3) の混入 / `/me`・`/trophies` 等の旧エンドポイント名 |
| **テスト未整備** | 主要パスのカバー漏れ / mock/stub での DB テスト (実 DB integration が原則) |

### Defer (記録のみ、最終 requesting-code-review で再評価)

- 主観的な命名・スタイル提案 (規約に明記されていない範囲)
- 非自明な設計改善提案 (議論を要するもの)
- 軽微な可読性・冗長性指摘 (YAGNI レベル)
- ドキュメント更新漏れの軽微な指摘

## 手順

### 1. レビュー済み判定 (sentinel)

```bash
current_sha=$(git rev-parse HEAD 2>/dev/null || echo "no-commits-yet")
last_reviewed=$(cat .claude/.last-reviewed-sha 2>/dev/null || echo "")
status_porcelain=$(git status --porcelain 2>/dev/null)
```

- `current_sha == last_reviewed` **かつ** `status_porcelain` が空 → **✓ レビュー済み・skip (PASS)**
- それ以外 → reviewer 起動

### 2. レビュー実行 (superpowers:code-reviewer agent)

`Agent` ツールで `subagent_type: "superpowers:code-reviewer"` を spawn する。プロンプトに以下を明示:

- レビュー対象: 現在の diff (未コミット変更 + 直近 commit からの累積)
- 必ず参照する文書:
  - `CLAUDE.md` (プロジェクト全体ルール・コーディング規約)
  - `.claude/skills/spec-driven-dev/references/consistency-checks.md` (実装 vs 設計書 / 設計書間の整合チェック)
  - 該当する `docs/` セクション (機能ID / 画面ID から `doc-map.md` で特定)
- 出力フォーマット: 指摘ごとに `[file:line] [severity] <内容> — 根拠: <docs/xx §y or CLAUDE.md 規則>`
- レビュー観点: 設計書整合 / セキュリティ / コーディング規約 / 型安全性 / テスト / 棄却された技術選択肢 / YAGNI

### 3. 分類

reviewer の出力を読み、各指摘を上記「Must-fix / Defer」ルールで分類する。

### 4. 判定

#### Must-fix > 0 件: NEEDS_FIX

Must-fix 指摘リストを呼び出し元に返し、**修正を求めて停止**する。**sentinel は更新しない**。

```
✗ step-complete NEEDS_FIX — Must-fix <n> 件 / Defer <n> 件

[Must-fix リスト]
- <file>:<line> [severity, category] <指摘>
  根拠: <...>
  推奨修正: <...>
...

呼び出し元: Must-fix 指摘を修正してから step-complete を再実行してください。
(Defer 指摘は最終レビュー時に再評価されます)
```

#### Must-fix == 0 件: PASS

Defer 指摘は会話上で報告 (最終レビューで再評価される)、sentinel 更新、advance OK を返す。

```
✓ step-complete PASS — reviewed <sha> (Must-fix 0 / Defer <n>)

[Defer リスト — 最終 requesting-code-review で再評価]
- <file>:<line> [severity, category] <指摘>
...
```

sentinel 更新:

```bash
git rev-parse HEAD > .claude/.last-reviewed-sha
```

## 呼び出し元との連携 (feature-flow / 手動)

- **PASS** → 次のステップへ進む
- **NEEDS_FIX** → 呼び出し元が Must-fix 指摘を読んで修正 → コミット (新 sha) → 再度 step-complete → 再レビュー → PASS まで loop
- 3回連続で NEEDS_FIX なら escalate

## 振る舞いの確認

| 状況 | sentinel | working tree | アクション |
|---|---|---|---|
| 初回 / sentinel なし | - | - | reviewer 起動・分類 |
| PASS 後の再呼び出し (同 sha) | == HEAD | クリーン | **skip (PASS)** |
| Must-fix 修正後の新 commit | != HEAD | クリーン | reviewer 再起動 |
| 未コミット編集あり | == HEAD | dirty | reviewer 起動 |
| 前回 NEEDS_FIX で修正中 | 未更新 | dirty | reviewer 起動 |

## sentinel ファイル仕様

- パス: `.claude/.last-reviewed-sha` (1行、直近 PASS した sha)
- `.gitignore` 済み (個人ステート)
- 削除されても安全 (次回フルにレビューが走るだけ)

## 引数

なし。

## このスキルが呼ばれるべき場所

- spec-driven-dev Phase 4 で executing-plans が各タスク/バッチを終えた直後
- 手動実装時、ステップ区切りごと
- commit する直前

## 禁止事項

- Must-fix 指摘を放置して次のステップへ進む
- Defer 指摘をこの場で逐次修正する (主観的・style 系は最終レビュー後にまとめて検討)
- テスト・lint をここで実行する (executing-plans の責務、二重実行しない)
- sentinel を NEEDS_FIX のまま更新する (未修正のコードを「レビュー済み」にしない)
- sentinel を git 管理下に置く
