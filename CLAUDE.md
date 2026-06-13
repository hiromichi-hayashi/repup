# RepUp

筋トレに「行かなきゃ」の気持ちを仕組みで作り、朝ジム習慣へのシフトを支える iOS アプリ。
個人習慣化を軸に簡易チームを同梱。記録の積み重ね・トロフィー・チーム内ランキングで継続を後押しする。

このファイルは全会話で自動読み込みされる。詳細は `docs/` を参照する。

---

## 設計書 (Single Source of Truth)

実装と設計書が食い違ったら、**コードを直す前に設計書を直す**。

| ファイル | 役割 |
|---|---|
| `docs/01_concept.md` | コンセプト/要件 (As-Is→To-Be→GAP、スコープ) |
| `docs/02_function_design.md` | 機能設計 (BASE-01〜02, F01〜F06)・API・状態遷移 |
| `docs/03_database_design.md` | DB 定義 (Prisma スキーマ前提) |
| `docs/04_screen_design.md` | 画面 (SC-01〜SC-11) |
| `docs/05_tech_stack.md` | 採用技術と棄却理由 |
| `docs/06_notification_design.md` | 通知・リマインド (cron / Expo Push) |
| `docs/07_implementation_roadmap.md` | スプリント計画・依存グラフ |

HTML 版は `docs/html/`。Markdown が正本。`npm run docs:build` で再生成する。

---

## スコープ

- **今回のスコープ**: 個人習慣化(記録・連続・トロフィー)+ 簡易チーム + チーム内ランキング。証明は自己申告。通知は iOS プッシュのみ
- **2nd 以降**: GPS チェックイン / 全国ランキング「日本で○位」/ 育成マッチョ / LINE・カレンダー連携

## 技術スタック

- モバイル: React Native + Expo (iOS 優先) / TanStack Query / Expo Notifications
- バックエンド: Hono (TypeScript) / Prisma / Neon (PostgreSQL)
- 認証: Better Auth (Sign in with Apple / メール+パスワード)
- スケジューラ: cron (リマインド配信)

## ドキュメントのビルド

```bash
npm install
npm run docs:build   # docs/*.md → docs/html/*.html
```
