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

Webhook URL（LINE Developers 側）:

- `https://<your-domain>/api/line/webhook`

スタッフの連携手順:

1. LINEで Bot に `連携 staff@example.com` を送信
2. シフト管理画面の「LINE一斉通知」から通知送信
3. 希望休は `希望休 2026-04-30 私用` の形式で送信
