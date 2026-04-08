import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";

/** Sheets API 呼び出し用（リフレッシュトークンからアクセストークンを更新）。クライアント ID は Supabase の Google プロバイダと同一であること。 */
export function createGoogleOAuth2ClientForSheetsApi(): OAuth2Client {
  const id = process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!id || !secret) {
    throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET が未設定です");
  }
  return new google.auth.OAuth2(id, secret);
}

export function getOAuth2WithRefreshToken(refreshToken: string): OAuth2Client {
  const oauth2 = createGoogleOAuth2ClientForSheetsApi();
  oauth2.setCredentials({ refresh_token: refreshToken });
  return oauth2;
}
