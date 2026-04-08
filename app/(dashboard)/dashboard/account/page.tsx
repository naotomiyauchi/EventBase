import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { AccountSignOutButton } from "@/components/account-signout-button";

export default async function AccountPage() {
  if (!isSupabaseConfigured()) {
    redirect("/login");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">アカウント</h1>
        <p className="text-sm text-muted-foreground">ログイン中のアカウント情報</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">基本情報</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">メールアドレス</p>
            <p className="font-medium">{user?.email ?? "—"}</p>
          </div>
          <div className="pt-2">
            <AccountSignOutButton />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

