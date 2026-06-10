<!-- nav: 05 | 技術スタック -->

# 技術スタック

**バージョン**: 1.0
**作成日**: 2026年6月
**スコープ**: 採用技術・選定根拠・棄却した選択肢

---

## 1. 採用スタック

| レイヤ | 採用 | 補足 |
|---|---|---|
| モバイル | **React Native + Expo** | iOS 優先。将来 Android も同コードで射程 |
| サーバー状態 | **TanStack Query** | API キャッシュ。サーバーが SSoT |
| プッシュ通知 | **Expo Notifications + Expo Push** | 生 APNs を避ける |
| バックエンド | **Hono(TypeScript)** | 既存資産(TS/Hono)が活きる |
| ORM | **Prisma** | Neon serverless driver adapter 利用 |
| DB | **Neon(PostgreSQL)** | サーバーレス。チーム集計を SQL で |
| 認証 | **Better Auth** | Sign in with Apple / メール+パスワード、Hono/Prisma 統合 |
| スケジューラ | **cron** | リマインド/アラート配信(§06) |
| バリデーション | **zod** | API スキーマをフロント/バックで共有 |

ホスティングは後述(§3)。

---

## 2. 各採用の理由

### 2.1 React Native + Expo

- iOS 優先だが Android 展開の余地を残せる
- **Expo Notifications** で生 APNs 証明書を扱わずプッシュを実装でき、リマインド中心の本アプリと相性が良い
- EAS によるクラウドビルドで Mac の Xcode 作業を最小化

### 2.2 オンラインファースト + TanStack Query

- チーム共有・サーバー集計のランキングがあるため、**サーバーが真実のソース**であるべき
- 端末はキャッシュのみ持ち、ローカル DB の同期・衝突解決の複雑さを負わない

### 2.3 Hono + Prisma + Neon

- Hono は TypeScript で軽量。既存の知見を活かせる
- Neon はサーバーレス Postgres。Prisma の **Neon driver adapter** で接続
- チーム内ランキング等のリレーショナル集計を SQL で素直に書ける

### 2.4 Better Auth

- Sign in with Apple とメール+パスワードの両対応(パスワードリセット含む)
- Hono / Prisma と統合でき、認証テーブルを Prisma 管理下に置ける

---

## 3. ホスティング(候補)

| 候補 | 長所 | 留意点 |
|---|---|---|
| **Cloudflare Workers**(推奨) | Hono と好相性、Cron Triggers でリマインド配信が容易、スケール | 実行時間制約。Prisma は driver adapter 前提 |
| Render | 常駐サーバー・cron ジョブが分かりやすい | スケール時コスト |

> 最終決定は実装初期に PoC で確認し、本節を更新する。

---

## 4. 記録送信のリトライ方針

オンラインファーストだが、ジムの電波が悪い瞬間に「記録する」が失われると体験を損なう。

- **F03 の記録送信のみ**、失敗時に端末側で**リトライキュー**(永続化)を持ち、復帰時に再送
- それ以外の操作は通常のオンライン送信(失敗時は再試行 UI)
- これはローカル DB による全体同期とは異なる、**限定的な保険**

---

## 5. 棄却した選択肢

設計判断の根拠として残す。

### 5.1 オフラインファースト(WatermelonDB 等)— 棄却

- 当初ローカル DB + 同期を検討したが、**チーム共有・サーバー集計が前提**のアプリでありオンラインが本質
- 同期・衝突解決の複雑さに見合わない。記録送信の限定リトライ(§4)で必要十分

### 5.2 Supabase(バックエンド一式)— 不採用

- 認証/Postgres/cron が揃い MVP 構築は速いが、**DB を Neon、バックエンドを Hono で自前管理**する方針を採用
- 既存の TS/Hono 資産を活かし、構成の主導権を握るため

### 5.3 Firebase / Firestore — 棄却

- 認証・FCM は手軽だが、**Firestore(NoSQL)はチーム内ランキングのような集計が苦手**
- リレーショナルな集計を素直に書ける Postgres を優先

### 5.4 Drizzle(ORM)— 不採用

- Neon と好相性で候補だったが、**Prisma を採用**(既存資産・スキーマ駆動の体験を優先、お手本プロジェクトとも体裁が揃う)

### 5.5 生 APNs 直叩き — 不採用

- 証明書管理が重い。**Expo Push** に委譲して実装を軽くする

---

## 6. コーディング規約(抜粋)

- TypeScript でフロント/バック統一
- API スキーマは zod で定義し共有
- 文字コード UTF-8 / 内部 UTC / 表示 JST
- 命名: ファイル kebab-case / 関数・変数 camelCase / 型・コンポーネント PascalCase
- コメントは「なぜ非自明か」のみ
- 機密情報を log/commit に出さない
