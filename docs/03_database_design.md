<!-- nav: 03 | DB設計 -->

# データベース設計書

**バージョン**: 1.0
**作成日**: 2026年6月
**スコープ**: MVP の Prisma スキーマ / テーブル定義

> DB は **Neon(PostgreSQL)**、ORM は **Prisma**(Neon serverless driver adapter)。機能との対応は [02 機能設計](02_function_design.html) を参照。

---

## 1. 方針

- **オンラインファースト**。サーバーが SSoT。端末はキャッシュのみ
- 内部時刻は **UTC**(`timestamptz`)。表示時に JST へ変換
- ID は `cuid`/`uuid`。論理削除はせず、必要箇所のみ `deletedAt` を検討
- 認証関連テーブル(User / Session / Account 等)は **Better Auth** が管理。本書はアプリ固有テーブルを定義し、認証テーブルは概略のみ記す

---

## 2. ER 概要

```
User 1──n Schedule 1──1 Checklist 1──n ChecklistItem
User 1──n ChecklistTemplateItem
User 1──n Record
User 1──1 UserStats
User 1──n Trophy
User n──n Team  (via Membership)
Team 1──n Membership
User 1──n NotificationLog
```

---

## 3. テーブル定義

### 3.1 User

アプリ利用者。認証情報は Better Auth が別途保持し、本テーブルはアプリ属性を持つ。

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| id | text | PK | ユーザーID |
| email | text | unique | メール |
| displayName | text | | 表示名 |
| goal | text | null可 | 目的(自由記述) |
| weeklyTarget | int | default 3 | 週あたり目標回数 |
| defaultTimeOfDay | enum | default `MORNING` | 既定時間帯(MORNING/NOON/NIGHT) |
| onboardedAt | timestamptz | null可 | 初回設定(目標設定)完了時刻。初回の目標保存時に記録 |
| createdAt | timestamptz | default now | |
| updatedAt | timestamptz | | |

### 3.2 PushToken

Expo Push トークン(端末ごと)。

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| id | text | PK | |
| userId | text | FK→User | |
| token | text | unique | Expo Push Token |
| platform | enum | | iOS/Android |
| updatedAt | timestamptz | | |

### 3.3 Schedule(F01)

行く予定。単発・繰り返しを表現。

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| id | text | PK | |
| userId | text | FK→User | |
| date | date | null可 | 単発予定の日付(繰り返し時は null) |
| recurrenceRule | jsonb | null可 | 繰り返し定義(例 `{ "weekdays": [1,3,5] }`) |
| timeOfDay | enum | | MORNING/NOON/NIGHT |
| startTime | time | null可 | 開始予定時刻(任意) |
| active | boolean | default true | 繰り返しの有効/無効 |
| createdAt | timestamptz | default now | |

> 単発は `date` を持つ。繰り返しは `recurrenceRule` を持ち、cron が当日該当分を `Record` の評価対象として展開する。

### 3.4 ChecklistTemplateItem(F02)

ユーザーごとの準備項目テンプレート(再利用される定義)。

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| id | text | PK | |
| userId | text | FK→User | |
| label | text | | 例: タオル / コワーキング予約済み? |
| sortOrder | int | | 表示順 |
| active | boolean | default true | |

### 3.5 Checklist(F02)

特定の予定に対するチェックリスト実体。

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| id | text | PK | |
| scheduleId | text | FK→Schedule, unique | 1 予定 1 チェックリスト |
| createdAt | timestamptz | default now | |

### 3.6 ChecklistItem(F02)

チェックリストの各項目(テンプレートから複製、状態を持つ)。

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| id | text | PK | |
| checklistId | text | FK→Checklist | |
| label | text | | 複製時点のラベル |
| checked | boolean | default false | |
| checkedAt | timestamptz | null可 | |

### 3.7 Record(F03)

その日の確定状態。RECORDED / SKIPPED を保持(BLANK はレコード不在で表す)。

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| id | text | PK | |
| userId | text | FK→User | |
| date | date | | 実施(対象)日 |
| status | enum | | RECORDED / SKIPPED |
| scheduleId | text | FK→Schedule, null可 | 紐づく予定(任意日記録は null) |
| memo | text | null可 | メモ(MVP 任意) |
| tags | text[] | null可 | 部位/種目タグ(任意) |
| durationMin | int | null可 | 所要時間(任意) |
| createdAt | timestamptz | default now | |

制約: `(userId, date)` で一意(1 日 1 確定)。BLANK はレコードを作らないことで表現する。

> 状態遷移の定義は [02 機能設計](02_function_design.html) §F03 を参照。

### 3.8 UserStats(F04)

集計のキャッシュ(導出値)。リアルタイム算出が重い場合の高速化用。

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| userId | text | PK, FK→User | |
| currentStreak | int | default 0 | 現在の連続カウント |
| longestStreak | int | default 0 | 最長連続 |
| totalRecords | int | default 0 | 累積記録数 |
| currentRank | enum | default `NONE` | NONE/BRONZE/SILVER/GOLD |
| updatedAt | timestamptz | | |

> UserStats は Record 確定時 / cron 評価時に更新する派生データ。真実は Record 群。

### 3.9 Trophy(F04)

獲得トロフィーの履歴。

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| id | text | PK | |
| userId | text | FK→User | |
| rank | enum | | BRONZE/SILVER/GOLD |
| awardedAt | timestamptz | default now | 獲得日時 |
| revokedAt | timestamptz | null可 | 降格で失効した日時 |

### 3.10 Team(F06)

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| id | text | PK | |
| name | text | | チーム名 |
| ownerId | text | FK→User | オーナー |
| inviteCode | text | unique | 招待コード |
| createdAt | timestamptz | default now | |

### 3.11 Membership(F06)

User と Team の中間。進捗共有の単位。

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| id | text | PK | |
| teamId | text | FK→Team | |
| userId | text | FK→User | |
| role | enum | default `MEMBER` | OWNER/MEMBER |
| joinedAt | timestamptz | default now | |

制約: `(teamId, userId)` で一意。

### 3.12 NotificationLog(通知の冪等性)

プッシュ通知の二重送信を防ぐ送信記録。定義・用途は [06 通知設計](06_notification_design.html) §5 に対応。

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| id | text | PK | |
| userId | text | FK→User | |
| scheduleId | text | FK→Schedule, null可 | |
| type | enum | | N01/N02/N03/N04 |
| targetDate | date | | 対象日 |
| sentAt | timestamptz | default now | 送信日時 |

制約: `(userId, scheduleId, type, targetDate)` で一意。cron は送信前にこのキーで存在チェックする。

---

## 4. Prisma スキーマ(抜粋)

```prisma
enum TimeOfDay { MORNING NOON NIGHT }
enum RecordStatus { RECORDED SKIPPED }
enum Rank { NONE BRONZE SILVER GOLD }
enum Role { OWNER MEMBER }

model User {
  id               String   @id @default(cuid())
  email            String   @unique
  displayName      String?
  goal             String?
  weeklyTarget     Int      @default(3)
  defaultTimeOfDay TimeOfDay @default(MORNING)
  onboardedAt      DateTime?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  schedules        Schedule[]
  records          Record[]
  templateItems    ChecklistTemplateItem[]
  memberships      Membership[]
  trophies         Trophy[]
  stats            UserStats?
  pushTokens       PushToken[]
}

model Record {
  id         String       @id @default(cuid())
  userId     String
  date       DateTime     @db.Date
  status     RecordStatus
  scheduleId String?
  memo       String?
  tags       String[]
  durationMin Int?
  createdAt  DateTime     @default(now())
  user       User         @relation(fields: [userId], references: [id])
  schedule   Schedule?    @relation(fields: [scheduleId], references: [id])
  @@unique([userId, date])
}
```

> 全 model の完全版は実装時に `schema.prisma` として確定する。本書は MVP に必要なテーブルと主要カラム・制約を定義する。

---

## 5. インデックス方針

| テーブル | インデックス | 目的 |
|---|---|---|
| Record | `(userId, date)` unique | 1日1確定・期間取得 |
| Schedule | `(userId, date)`, `(userId, active)` | 当日対象抽出 |
| Membership | `(teamId)`, `(userId)` | チーム集計・所属取得 |
| Trophy | `(userId, awardedAt)` | 履歴取得 |
