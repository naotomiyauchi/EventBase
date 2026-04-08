/** ?google_export= のコード → 表示メッセージ */
export const STAFF_GOOGLE_EXPORT_MESSAGES: Record<string, string> = {
  env: "サーバーに GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET が設定されていません（Supabase の Google プロバイダと同じ OAuth クライアント）。.env を確認してください。",
  rpc:
    "データベースの関数が見つかりません。supabase db push 等でマイグレーション（get_google_refresh_token_for_export）を適用してください。",
  no_token:
    "Google 連携用のリフレッシュトークンがありません。管理者が Google でログインするか、設定の「Google 連携」からアカウントを紐付けてください。",
  sheet:
    "スプレッドシートの作成に失敗しました。管理者のトークンが無効な可能性があります。設定 → Google 連携から Google を再度紐付けてください。",
  not_found: "スタッフが見つかりません。",
};
