# 整合性チェックリスト (RepUp)

実装が設計書(`docs/01-07`)から逸脱していないか、設計書同士に矛盾がないかをチェックする。

設計書と実装が食い違ったら **コードより設計書を先に直す**(CLAUDE.md / RM §5)。

---

## A. 実装 vs 設計書

### A-1. DB スキーマ (Prisma)

- [ ] テーブル名・カラム名・型が `docs/03` §3.X と一致(User / PushToken / Schedule / Record / UserStats / Trophy / Team / Membership / NotificationLog)
- [ ] `Record` に `(userId, date)` の unique 制約(1 日 1 確定)
- [ ] `Membership` に `(teamId, userId)` unique、`Trophy` に `(userId, season, rank)` unique
- [ ] `Schedule.recurrenceRule` の形が DB §3.3 / FN §4.2 の例と一致(single / weekly(interval+weekdays) / monthly(days))。interval≥2 は `startDate` を持つ
- [ ] enum 値が一致: `RecordStatus`(RECORDED/SKIPPED)、`Rank`(NONE/BRONZE/SILVER/GOLD/PLATINUM/DIAMOND/MASTER)、`TimeOfDay`、`Role`、`NotificationLog.type`(N01/N02/N03)
- [ ] **廃止済みを持ち込まない**: `User.weeklyTarget`(廃止)/ Checklist 系テーブル(対象外)を追加していない
- [ ] 認証テーブル(User/Session/Account 等)は Better Auth 管理(DB §1)
- [ ] 内部時刻は `timestamptz`(UTC)

### A-2. API Route (Hono)

- [ ] エンドポイントパス・HTTP メソッドが FN §X と一致。**正となる命名**:
  - アカウント/目標: `GET/PATCH /account`、`POST /account/push-token`、`GET /account/stats`(`/me` は使わない)
  - 通う日: `GET/POST/PATCH/DELETE /schedules`
  - 記録: `POST /records`、`POST /records/skip`、`PATCH/DELETE /records/:id`
  - ランク: `GET /rank/users/:userId`(`/rank/me`・`/trophies` は使わない)
  - チーム: `POST/GET/PATCH /teams`、`/teams/:id/join`、`/teams/:id/adopt-schedule`、`/teams/:id/ranking`、`DELETE /teams/:id/members/:userId`
- [ ] リクエスト/レスポンスが **zod** で定義され、フロント・バックで共有(TS §6)
- [ ] エラー形式が FN §1.2 通り(`{ error: { code, message } }`)
- [ ] 認証(Bearer / Better Auth セッション)が必要 endpoint で確認されている
- [ ] サーバーが SSoT(オンラインファースト)。端末ローカル DB を持たない(TS §2.2)

### A-3. UI コンポーネント (React Native + Expo)

- [ ] 画面の表示要素・操作フローが SC §SC-XX 通り
- [ ] **初回設定(SC-02)は専用 UI を作らず、設定(SC-09)の目標設定フォームを流用** + 通知許可(FN §3.3)
- [ ] ホーム(SC-01)の連続表示が「○回連続いけてる!💪」、ランクは 6 段階
- [ ] サーバー状態は TanStack Query(キャッシュ)。ローカル DB 同期はしない

### A-4. 採用技術 (`docs/05` TS)

- [ ] **棄却された選択肢**を持ち込んでいない:
  - オフラインファースト(WatermelonDB 等)/ Supabase / Firebase・Firestore / Drizzle / 生 APNs 直叩き
- [ ] **未確定事項**を勝手に確定させていない:
  - ホスティング(Cloudflare Workers 推奨だが PoC で確定、TS §3)
  - トロフィー閾値・頻度別到達上限・シーズン境界(FN §6.2 / §8)
  - ランキング指標の既定(連続 / 記録数 / ランク、FN §8)
- [ ] スタックが正: RN+Expo / Hono / Prisma / **Neon(Postgres)** / Better Auth / Expo Push / cron

### A-5. フェーズ依存 (`docs/07` RM)

- [ ] **BASE で全テーブルを一括作成**してから機能を積む(RM BASE)。機能フェーズで新規マイグレーションを基本伴わない
- [ ] 連続カウント(F04)は **予定日(P1 スケジュール)× 記録(P2)** に依存。通う日は P1 で先に用意(RM §3)
- [ ] このタスクの前提フェーズが完了済み

---

## B. 設計書間の整合性

### B-1. DB ↔ FN

- [ ] FN の機能要件がすべて DB のテーブル/カラムでカバーされている
- [ ] FN の API 型に対応するカラム/関連が DB に存在
- [ ] enum 値が DB と FN で一致

### B-2. FN ↔ SC

- [ ] FN の API が SC のどの画面から呼ばれるか追跡可能(doc-map「画面ID と該当API」)
- [ ] SC が必要とする情報を FN の API レスポンスが返している
- [ ] ランキング指標の選択肢(連続 / 記録数 / ランク)が FN §7.1 と SC SC-08 で一致

### B-3. DB ↔ SC

- [ ] SC で表示する項目が DB のカラムから取得可能
- [ ] SC の状態表示(BLANK/RECORDED/SKIPPED、ランク)が DB の enum と一致

### B-4. 不変条件(設計の核。崩していないか)

- [ ] **連続カウント・リマインドは各自の `Schedule`(個人の通う日)が基準**。チームの推奨通う日は「取り込み元テンプレート」で個人スケジュールを置き換えない(FN §6.1, §7.2)
- [ ] **トロフィーは昇格のみ・降格なし・年次(シーズン)リセット**。`seasonBestStreak` から `currentRank` を導出(FN §6.2)
- [ ] **ペナルティは連続リセットのみ**(トロフィー降格・チーム晒しはしない、FN §6.4 / CN §7.3)
- [ ] **行った証明は自己申告**(記録完了=行った、GPS は対象外、CN §5)
- [ ] 予定外(オカレンス外)の RECORDED は連続に作用しない(ボーナス、FN §6.1)

### B-5. スコープ整合

- [ ] 対象外(CN §7.3)の機能を実装に紛れ込ませていない(チェックリスト/GPS/全国ランキング/育成マッチョ/外部連携)
- [ ] 機能ID の欠番(F02/F05)を復活させていない

---

## C. 設計書間に矛盾を発見した場合の手順

1. 矛盾を **明示的に整理**(ファイル名 + 章番号 + 矛盾内容を文章化)
2. `AskUserQuestion` で「どちらを正とするか」を確認
3. 正とする方に他設計書を更新(コードより設計書を先に直す)
4. **Markdown を直したら `docs/html/` も再生成**して併せて更新
5. その後にコードを書く

矛盾を放置して実装に進むのは禁止。
