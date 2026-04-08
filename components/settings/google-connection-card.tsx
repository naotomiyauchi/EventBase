"use client";

import { GoogleSheetsOAuthButton } from "@/components/google-sheets-oauth-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Props = {
  hasStoredToken: boolean;
  /** サーバーで整形済み（クライアントで toLocaleString しない＝TZ 差でハイドレーションしない） */
  updatedAtLabel: string | null;
};

export function GoogleConnectionCard({ hasStoredToken, updatedAtLabel }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Google スプレッドシート用トークン</CardTitle>
        <CardDescription>
          {hasStoredToken
            ? `保存済み（更新: ${updatedAtLabel ?? "—"}）。`
            : "未登録です。下のボタンで Google を紐付けると、ログイン時に取得したリフレッシュトークンが保存されます。"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Supabase の Google ログインに Sheets
          用スコープを付けており、このアプリの OAuth クライアント ID と同一のものを
          .env に設定してください。初回または再連携時は Google の同意画面で
          <strong className="font-medium">オフラインアクセス</strong>
          が含まれることを確認してください。
        </p>
        <GoogleSheetsOAuthButton
          mode="link"
          nextPath="/dashboard/settings/google?google=reconnected"
          variant="default"
        >
          Google アカウントを紐付けてトークンを保存
        </GoogleSheetsOAuthButton>
        <p className="text-xs text-muted-foreground">
          メール／パスワードのみの場合: 上記で Google
          を追加すると、スプレッドシート出力に使えるトークンが保存されます（Supabase
          で「Manual Linking」が有効なこと）。
        </p>
      </CardContent>
    </Card>
  );
}
