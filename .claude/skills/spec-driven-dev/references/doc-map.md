# 設計書マップ (RepUp)

設計書は `docs/*.md` が正本。`docs/html/*.html` は同内容の静的レンダリング(ビルド機構は持たない。Markdown を直したら HTML も合わせて更新する)。

## ドキュメント一覧

| ID | ファイル | 主な内容 |
|----|---------|---------|
| **CN** | `docs/01_concept.md` | コンセプト/要件 (As-Is→To-Be→GAP/HOW)、ペルソナ、機能スコープ、対象外(NA §7.3)、成功指標 |
| **FN** | `docs/02_function_design.md` | 機能設計 (BASE-01/02, F01/F03/F04/F06)、API、記録の状態遷移、連続/シーズンランクのロジック、未確定事項(§8) |
| **DB** | `docs/03_database_design.md` | テーブル定義 (Prisma 前提)、ER、`recurrenceRule`、インデックス方針 |
| **SC** | `docs/04_screen_design.md` | 画面 (SC-01〜SC-09)、ナビ構造、状態/空表示 |
| **TS** | `docs/05_tech_stack.md` | 採用技術と**棄却した選択肢**、ホスティング候補、記録送信リトライ方針 |
| **NT** | `docs/06_notification_design.md` | 通知 (N-01〜N-03)、cron、Expo Push、対象抽出、冪等性 |
| **RM** | `docs/07_implementation_roadmap.md` | BASE / P1〜P6 計画、依存グラフ、段階移行 |

## 機能ID と該当ドキュメント

機能IDは **BASE-01/02, F01, F03, F04, F06**。F02(準備チェックリスト)と F05 は対象外/統合済みで**欠番**(CN §7.3)。

| 機能ID | 内容 | 必読セクション |
|---|---|---|
| BASE-01 | 認証 (Sign in with Apple / メール+パスワード, Better Auth) | FN §2, DB §3.1 (User) |
| BASE-02 | アカウント / 目標設定 (初回設定=設定の目標設定フォーム流用) | FN §3, DB §3.1 (User) |
| F01 | スケジュール & リマインド (通う日 = 繰り返し、予定日=オカレンス生成) | FN §4, DB §3.3 (Schedule), SC SC-04 |
| F03 | 記録 (行った証明・自己申告・BLANK/RECORDED/SKIPPED 状態遷移) | FN §5, DB §3.4 (Record), SC SC-05 |
| F04 | 報酬・ペナルティ (連続カウント・トロフィー=シーズン制ランク・成長) | FN §6, DB §3.5-3.6 (UserStats/Trophy), SC SC-06 |
| F06 | チーム (進捗共有・チーム内ランキング・チーム目標) | FN §7, DB §3.7-3.8 (Team/Membership), SC SC-07/SC-08 |
| (対象外) | 準備チェックリスト / GPS チェックイン / 全国ランキング / 育成マッチョ / 外部連携 | CN §7.3 |

## 画面ID と該当API

| 画面ID | 主機能 | 主要API | 対応機能 |
|---|---|---|---|
| SC-01 | ホーム | `GET /account/stats`, `GET /rank/users/:userId` | F01/F03/F04 |
| SC-02 | 初回設定 (設定の目標設定を流用 + 通知許可) | `PATCH /account`, `POST /schedules`, `POST /account/push-token` | BASE-02 |
| SC-03 | サインイン | `/auth/*` (Better Auth) | BASE-01 |
| SC-04 | スケジュール一覧/編集 (通う日) | `GET/POST/PATCH/DELETE /schedules` | F01 |
| SC-05 | 記録入力 | `POST /records`, `POST /records/skip` | F03 |
| SC-06 | 成長・トロフィー | `GET /account/stats`, `GET /rank/users/:userId` | F04 |
| SC-07 | チーム | `POST/GET/PATCH /teams`, `/teams/:id/join`, `/teams/:id/adopt-schedule` | F06 |
| SC-08 | チーム内ランキング | `GET /teams/:id/ranking` | F06 |
| SC-09 | 設定 | `GET/PATCH /account` | BASE-02 |

## タスク別 必読ドキュメント

| 実装フェーズ | 必読 | 補足参照 |
|---|---|---|
| 新規DB追加・変更 | DB (該当テーブル §3.X) | RM (依存・フェーズ) |
| API実装 | FN (該当機能 §X), DB (関連テーブル) | TS (採用技術の境界) |
| 画面実装 | SC (該当画面), FN (該当API) | — |
| 連続/ランク実装 | FN §6.1 (連続), §6.2 (トロフィー), §6.4 (ペナルティ) | DB §3.5-3.6 |
| 通知実装 | NT 全体, FN §4.4 | DB §3.9 (NotificationLog) |
| 着手前のスコープ確認 | RM (該当フェーズ §2), CN §7 | — |

## 横断的な必読 (どのタスクでも一度は確認)

| 観点 | ファイル §章 |
|---|---|
| オンラインファースト (サーバーが SSoT) | DB §1, TS §2.2 |
| 内部 UTC / 表示 JST、命名規約、zod 共有 | FN §1.2, TS §6 |
| 共通エラー形式 | FN §1.2 |
| **不変条件**: 連続カウント・リマインドは各自の `Schedule`(個人の通う日)が基準 | FN §6.1, §7.2 |
| **不変条件**: トロフィーは昇格のみ・降格なし・年次リセット | FN §6.2 |
| **不変条件**: 行った証明は自己申告(記録完了=行った) | CN §5, FN §5 |
| スコープ境界 (対象外 NA) | CN §7.3 |

## 設計書変更時の整合性チェック対象

| 変更対象 | 影響を受ける可能性があるドキュメント |
|---------|--------------------------------|
| DB 変更 | FN (API), SC (UI 表示項目), RM (依存) |
| FN 変更 | DB (新カラム), SC (画面の API 呼出), NT (通知), RM |
| SC 変更 | FN (新規 API) |
| TS 変更 | RM (採用技術前提) |
| NT 変更 | FN §4.4, DB §3.9 (NotificationLog) |
| CN スコープ変更 | 全 docs (機能の増減) |
| **HTML** | Markdown を変えたら `docs/html/` も再生成して併せて更新 |

## 大きなドキュメントから情報を素早く探す grep パターン

| 探したい情報 | grep パターン | 対象ファイル |
|---|---|---|
| 機能ID 見出し | `^## [0-9]+\. (F0[1-6]\|BASE-0[12])` | docs/02 |
| API endpoint 全般 | `(GET\|POST\|PATCH\|DELETE) /` | docs/02 |
| テーブル定義 | `^### 3\.[0-9]+ ` | docs/03 |
| 画面ID 見出し | `^### SC-` | docs/04 |
| 棄却した選択肢 | `棄却` | docs/05 |
| 対象外(NA) | `対象外\|NA` | docs/01 |
| 未確定事項 | `未確定` | docs/02, 05, 06 |
| 通知種別 | `^\| N-0` | docs/06 |
