<!-- nav: 06 | 通知設計 -->

# 通知・リマインド設計

**バージョン**: 1.0
**作成日**: 2026年6月
**スコープ**: プッシュ通知の種別・配信タイミング・cron・冪等性

> MVP の通知は **iOS プッシュ(Expo Push)のみ**(対象外は [01](01_concept.html) §7.3)。

---

## 1. 通知の種別

| ID | 通知 | トリガ | 対応機能 |
|---|---|---|---|
| N-01 | 当日リマインド | 行く日の当日、設定時刻 | F01 |
| N-02 | 前日リマインド | 行く日の前日 | F01 |
| N-03 | チェックリスト未達アラート | 前日時点で未チェック項目あり | F02 |
| N-04 | 連続途切れ警告(任意) | 連続が途切れそう/途切れた | F04 §7.4 |

> N-04 は MVP では任意。最小は N-01〜N-03。

---

## 2. 配信アーキテクチャ

```
[cron] 定期実行(例: 5〜15分間隔)
   │  対象抽出: Schedule + Checklist + User設定 + PushToken
   ▼
[配信判定] 送る/送らない・冪等性チェック(NotificationLog)
   │
   ▼
[Expo Push API] へバッチ送信
   │
   ▼
端末(iOS)に通知表示
```

- cron は **Cloudflare Cron Triggers**(Workers 採用時)または **Render Cron**
- 送信は Expo Push のバッチ API を利用

---

## 3. タイミング定義

| 通知 | 既定タイミング | ユーザー調整 |
|---|---|---|
| N-01 当日 | 予定の `startTime`、無ければ時間帯の既定(朝=例 7:00) | 設定で時刻変更可 |
| N-02 前日 | 前日の夜(例 20:00) | ON/OFF 可 |
| N-03 チェックリスト | 前日の夜(N-02 と同時 or 直後) | ON/OFF 可 |

> 既定時刻の具体値は実装時に確定し本表を更新する。時刻は **JST 表示 / UTC 保存**。

---

## 4. 対象抽出ロジック

cron 実行ごとに、現在時刻(UTC)を基準に以下を抽出する。

1. **当日リマインド(N-01)**: 今日が**予定日(オカレンス)**である `active=true` の予定(`recurrenceRule` を展開して判定: single / weekly+interval / monthly。展開仕様は [02](02_function_design.html) §4.2)。配信予定時刻に達したもの
2. **前日リマインド(N-02)**: 明日が予定日の予定。前日配信時刻に達したもの
3. **チェックリスト未達(N-03)**: N-02 対象のうち、紐づく `Checklist` に `checked=false` の項目が残るもの
4. 各対象ユーザーの有効な `PushToken` を解決

---

## 5. 冪等性(二重送信の防止)

cron は短間隔で回るため、同じ通知を二重に送らない仕組みが要る。

- `NotificationLog(userId, scheduleId, type, targetDate)` を一意キーにして送信記録を残す
- 送信前に存在チェック → 無ければ送信し記録を作成
- 送信失敗は記録せず次回 cron で再試行

### 5.1 NotificationLog(テーブル追加)

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| id | text | PK | |
| userId | text | FK→User | |
| scheduleId | text | FK→Schedule, null可 | |
| type | enum | | N01/N02/N03/N04 |
| targetDate | date | | 対象日 |
| sentAt | timestamptz | default now | |

制約: `(userId, scheduleId, type, targetDate)` で一意。

> [03 DB設計](03_database_design.html) に本テーブルを追補する。

---

## 6. 通知ペイロード(例)

```json
{
  "to": "ExpoPushToken[xxx]",
  "title": "今日は朝ジムの日 💪",
  "body": "そのまま仕事に行く流れ、作っていこう",
  "data": { "type": "N01", "scheduleId": "sch_123", "targetDate": "2026-06-11" }
}
```

- `data.type` と `scheduleId` で、タップ時にホーム(SC-01)や記録(SC-07)へディープリンク
- N-03 は本文に未達項目数を含める(例: 「準備が2つ残っています」)

---

## 7. 権限・失敗時

- 通知許可はオンボーディング(SC-02)で取得。未許可なら設定(SC-11)から再取得導線
- Expo Push が `DeviceNotRegistered` を返したトークンは無効化(`PushToken` を削除/失効)
- 配信失敗はログのみ。ユーザー操作はブロックしない

---

## 8. 未確定事項

- 各通知の既定時刻の具体値(§3)
- cron 実行間隔(§2)
- N-04(連続途切れ警告)を MVP に含めるか(§1)
