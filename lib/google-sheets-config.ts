/**
 * Sheets API でリフレッシュに使う Google OAuth クライアント（ID/シークレット）。
 * Supabase の Google ログインで使うクライアントと同一である必要があります。
 */
export function isGoogleSheetsApiConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  );
}
