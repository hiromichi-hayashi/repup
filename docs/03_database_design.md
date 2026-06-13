<!-- nav: 03 | DB設計 -->

# データベース設計書

**バージョン**: 1.0
**作成日**: 2026年6月
**スコープ**: Prisma スキーマ / テーブル定義

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
User 1──n Schedule
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
| purpose | text | null可 | 目的・動機(自由記述。例「継続したい」) |
| defaultTimeOfDay | enum | default `MORNING` | 既定時間帯(MORNING/NOON/NIGHT)。新規スケジュールの初期値 |
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

通う日(= 行く予定)。単発・繰り返しを表現し、**予定日(オカレンス)を生成する基準**。リマインドと連続カウント(F04 §6.1)の両方がこの予定日に依存する。

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| id | text | PK | |
| userId | text | FK→User | |
| date | date | null可 | 単発予定の日付(繰り返し時は null) |
| recurrenceRule | jsonb | null可 | 繰り返し定義([02](02_function_design.html) §4.2)。weekly(interval+weekdays)/ monthly(days)/ single |
| startDate | date | null可 | N週ごと(interval≥2)の基準週。週次の起点 |
| timeOfDay | enum | | MORNING/NOON/NIGHT |
| startTime | time | null可 | 開始予定時刻(任意) |
| active | boolean | default true | 繰り返しの有効/無効 |
| createdAt | timestamptz | default now | |

`recurrenceRule` の例:

```
単発:     { "type": "single",  "date": "2026-06-15" }
毎週:     { "type": "weekly",  "interval": 1, "weekdays": [1,3,5] }
2週に1回: { "type": "weekly",  "interval": 2, "weekdays": [1] }
毎月:     { "type": "monthly", "days": [1,15] }
```

> 単発は `date`、繰り返しは `recurrenceRule`(+ interval≥2 は `startDate`)を持つ。アプリ/cron は指定期間に対して**予定日の集合**を生成し、`Record`(達成判定)・リマインド・連続カウントの基準にする。

### 3.4 Record(F03)

その日の確定状態。RECORDED / SKIPPED を保持(BLANK はレコード不在で表す)。

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| id | text | PK | |
| userId | text | FK→User | |
| date | date | | 実施(対象)日 |
| status | enum | | RECORDED / SKIPPED |
| scheduleId | text | FK→Schedule, null可 | 紐づく予定(任意日記録は null) |
| memo | text | null可 | メモ(任意) |
| tags | text[] | null可 | 部位/種目タグ(任意) |
| durationMin | int | null可 | 所要時間(任意) |
| createdAt | timestamptz | default now | |

制約: `(userId, date)` で一意(1 日 1 確定)。BLANK はレコードを作らないことで表現する。

> 状態遷移の定義は [02 機能設計](02_function_design.html) §F03 を参照。

### 3.5 UserStats(F04)

集計のキャッシュ(導出値)。リアルタイム算出が重い場合の高速化用。

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| userId | text | PK, FK→User | |
| currentStreak | int | default 0 | 現在の連続カウント(未達でリセット) |
| longestStreak | int | default 0 | 全期間の最長連続 |
| seasonBestStreak | int | default 0 | 現シーズン内の最高連続(ランク算出の元) |
| currentRank | enum | default `NONE` | NONE/BRONZE/SILVER/GOLD/PLATINUM/DIAMOND/MASTER。`seasonBestStreak` から導出 |
| seasonStartedAt | timestamptz | | 現シーズンの開始時刻(既定 1 年) |
| totalRecords | int | default 0 | 累積記録数 |
| updatedAt | timestamptz | | |

> UserStats は Record 確定時 / cron 評価時に更新する派生データ。真実は Record 群 + Schedule。ランクは**昇格のみ**、シーズン境界(年次 cron)で `seasonBestStreak` / `currentRank` をリセット([02](02_function_design.html) §6.2)。

### 3.6 Trophy(F04)

**シーズンごとの最高ランク履歴**(過去シーズンの実績)。降格による失効は持たない。

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| id | text | PK | |
| userId | text | FK→User | |
| season | text | | シーズン識別子(例 `"2026"`) |
| rank | enum | | そのシーズンの最高到達ランク |
| reachedAt | timestamptz | default now | そのランクへの到達日時 |

制約: `(userId, season, rank)` で一意(同一シーズン・同一ランクは 1 行)。シーズンの最高ランク = 当該 season の最大 rank。

### 3.7 Team(F06)

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| id | text | PK | |
| name | text | | チーム名 |
| ownerId | text | FK→User | オーナー |
| inviteCode | text | unique | 招待コード |
| createdAt | timestamptz | default now | |

### 3.8 Membership(F06)

User と Team の中間。進捗共有の単位。

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| id | text | PK | |
| teamId | text | FK→Team | |
| userId | text | FK→User | |
| role | enum | default `MEMBER` | OWNER/MEMBER |
| joinedAt | timestamptz | default now | |

制約: `(teamId, userId)` で一意。

### 3.9 NotificationLog(通知の冪等性)

プッシュ通知の二重送信を防ぐ送信記録。定義・用途は [06 通知設計](06_notification_design.html) §5 に対応。

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| id | text | PK | |
| userId | text | FK→User | |
| scheduleId | text | FK→Schedule, null可 | |
| type | enum | | N01/N02/N03 |
| targetDate | date | | 対象日 |
| sentAt | timestamptz | default now | 送信日時 |

制約: `(userId, scheduleId, type, targetDate)` で一意。cron は送信前にこのキーで存在チェックする。

---

## 4. Prisma スキーマ(抜粋)

```prisma
enum TimeOfDay { MORNING NOON NIGHT }
enum RecordStatus { RECORDED SKIPPED }
enum Rank { NONE BRONZE SILVER GOLD PLATINUM DIAMOND MASTER }
enum Role { OWNER MEMBER }

model User {
  id               String   @id @default(cuid())
  email            String   @unique
  displayName      String?
  purpose          String?
  defaultTimeOfDay TimeOfDay @default(MORNING)
  onboardedAt      DateTime?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  schedules        Schedule[]
  records          Record[]
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

> 全 model の完全版は実装時に `schema.prisma` として確定する。本書は必要なテーブルと主要カラム・制約を定義する。

---

## 5. インデックス方針

| テーブル | インデックス | 目的 |
|---|---|---|
| Record | `(userId, date)` unique | 1日1確定・期間取得 |
| Schedule | `(userId, date)`, `(userId, active)` | 当日対象抽出 |
| Membership | `(teamId)`, `(userId)` | チーム集計・所属取得 |
| Trophy | `(userId, season)` | シーズン実績取得 |
