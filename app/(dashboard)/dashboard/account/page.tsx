import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { AccountSignOutButton } from "@/components/account-signout-button";
import { GoogleSheetsOAuthButton } from "@/components/google-sheets-oauth-button";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ google_linked?: string; connect_google?: string }>;
}) {
  const sp = await searchParams;
  if (!isSupabaseConfigured()) {
    redirect("/login");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">アカウント</h1>
        <p className="text-sm text-muted-foreground">ログイン情報と連携状態を管理します。</p>
      </div>

      <Card className="shadow-xs">
        <CardHeader>
          <CardTitle className="text-base">基本情報</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">メールアドレス</p>
            <p className="font-medium">{user?.email ?? "—"}</p>
          </div>
          <div className="pt-1">
            <AccountSignOutButton />
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-xs">
        <CardHeader>
          <CardTitle className="text-base">Google連携</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {sp.google_linked ? (
            <p className="text-sm text-green-600 dark:text-green-400">
              Google連携が完了しました。
            </p>
          ) : null}
          {sp.connect_google ? (
            <p className="text-xs text-muted-foreground">
              下のボタンを押してGoogle連携を完了してください。
            </p>
          ) : null}
          <GoogleSheetsOAuthButton
            mode="signIn"
            nextPath="/dashboard/account?google_linked=1"
            variant="default"
            className="h-10 rounded-lg border border-primary/40 px-4 text-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/70 hover:shadow-md hover:text-white"
          >
            Google連携を開始
          </GoogleSheetsOAuthButton>
        </CardContent>
      </Card>
    </div>
  );
}

