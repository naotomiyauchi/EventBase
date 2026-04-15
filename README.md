# 携帯イベント管理（初期版）

Next.js + Supabase + Tailwind/shadcn で動く案件・イベント・スタッフの土台です。PWA 用の `manifest.json` を同梱しています。

## セットアップ

```bash
npm install
cp .env.example .env.local
# .env.local に Supabase の URL と anon key を記入
```

1. [Supabase](https://supabase.com) でプロジェクトを作成する。
2. SQL Editor で `supabase/migrations/` 内の SQL を **上から順に** 実行する（`initial` → `staff_module` → `staff_profile_extended`）。
3. Authentication で Email プロバイダを有効にし、必要ならサイト URL を設定する。
4. `npm run dev` で http://localhost:3000 を開く。

`.env.local` が空のままではログインできず、ダッシュボードはデモ表示のみです（データは保存されません）。

## スクリプト

| コマンド | 説明 |
|----------|------|
| `npm run dev` | 開発サーバー |
| `npm run build` | 本番ビルド |
| `npm run start` | 本番起動 |
| `npm run lint` | ESLint |

## 初期版の範囲

- キャリア（シード）・代理店・イベントマスタ・案件（ステータス）・**スタッフ**（プリセット＋自由入力スキル、生年月日からの**年齢自動計算**、プロフィールの **Excel / PDF 出力**、NG イベント／出禁、一覧検索・詳細編集・削除）
- 案件へのファイルアップロード（Storage バケット `project-files`）
- メール / パスワード認証、モバイル向けボトムナビ

今後の拡張用に、勤怠・LINE・AI・請求 PDF などは未実装です。

## LINE連携（運用メモ）

以下を `.env.local` に設定すると、Webhook / 一斉通知が有効になります。

- `LINE_CHANNEL_ACCESS_TOKEN`
- `LINE_CHANNEL_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY`（Webhookで希望休登録を行うため）
- `RESEND_API_KEY`（6桁連携コードメール送信）
- `LINE_LINK_MAIL_FROM`（例: `EventBase <no-reply@example.com>`）

Webhook URL（LINE Developers 側）:

- `https://<your-domain>/api/line/webhook`

**307 Temporary Redirect になる場合:** Vercel などで **apex（`example.com`）→ `www` にリダイレクト**していると、`https://event-base.app/...` への POST が **307** になり、LINE の検証は失敗します。**リダイレクト後の正規 URL** を登録してください（例: `https://www.event-base.app/api/line/webhook`）。`curl -sI -X POST "https://あなたのドメイン/api/line/webhook"` で `location:` やステータスを確認できます。

### リッチメニュー（手動作成・本システムと連携）

アプリからリッチメニューは自動生成しません。**LINE Official Account Manager / LINE Developers** で作成し、各タップ領域は **「メッセージを送信」** にします。送信テキストは次と **完全一致** にしてください。

| ボタン例 | 送信するテキスト | 続けてユーザーが送る内容 |
|----------|------------------|---------------------------|
| 連携設定 | `連携設定` | 管理者メールの6桁コード（例: `連携 123456`） |
| 希望休入力 | `希望休入力` | `2026-04-30 私用` または `希望休 2026-04-30 私用` |
| 使い方 | `使い方`（または `help` / `ヘルプ`） | 案内のみ |

任意で `領収書` などのメッセージボタンを付けると、領収書画像アップロードモードに入れます。手順の詳細は [リッチメニューの使い方（LINE Developers）](https://developers.line.biz/ja/docs/messaging-api/use-rich-menus/) と、管理画面 `/dashboard/settings/line` を参照。

運用の流れ:

1. 上記どおりリッチメニューを LINE 側で作成・公開する。
2. 管理者が `/dashboard/settings/line` で対象スタッフへ連携コードメールを送信。
3. スタッフはLINEで `連携 123456` を送信し連携完了。
4. スタッフは「希望休入力」→ 日付と理由を送信。
5. 管理画面「シフト管理」の「LINE一斉通知」から期間指定で通知送信。
