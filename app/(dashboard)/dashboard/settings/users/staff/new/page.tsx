import Link from "next/link";
import { notFound } from "next/navigation";
import type { AppRole } from "@/lib/app-role";
import { APP_ROLE_LABELS } from "@/lib/app-role";
import { isAppManagerRole } from "@/lib/app-role";
import { getCurrentProfile } from "@/lib/auth-profile";
import { isServiceRoleConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { registerStaffWithAccount } from "@/app/actions/staff";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StaffProfileFormFields } from "@/components/staff-profile-form-fields";
import { emptyStaffFormDefaults } from "@/lib/staff-form-defaults";

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

export default async function RegisterStaffPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile || !isAppManagerRole(profile.role)) {
    notFound();
  }

  const serviceOk = isServiceRoleConfigured();

  const roleOptions: AppRole[] =
    profile.role === "admin"
      ? ["admin", "team_leader", "staff"]
      : ["team_leader", "staff"];

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link
          href="/dashboard/settings/users"
          className="text-xs text-muted-foreground hover:underline"
        >
          ← スタッフ名簿
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">スタッフ登録</h1>
        <p className="text-sm text-muted-foreground">
          ログインアカウントと名簿の基本情報・スキル・職務経歴をまとめて登録します。
        </p>
      </div>

      {sp.error && (
        <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {decodeURIComponent(sp.error)}
        </p>
      )}

      {!serviceOk && (
        <p className="text-sm text-amber-800 dark:text-amber-200">
          SUPABASE_SERVICE_ROLE_KEY をサーバーに設定すると登録できます。
        </p>
      )}

      <form action={registerStaffWithAccount} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">ログインアカウント</CardTitle>
            <CardDescription>
              メール・パスワード・権限。管理者・チームリーダーは Google 連携も利用できます。
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="reg-email">メールアドレス</Label>
              <Input
                id="reg-email"
                name="email"
                type="email"
                required
                autoComplete="email"
                disabled={!serviceOk}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="reg-password">初期パスワード</Label>
              <Input
                id="reg-password"
                name="password"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                disabled={!serviceOk}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="reg-display">表示名（ログイン）</Label>
              <Input
                id="reg-display"
                name="display_name"
                autoComplete="off"
                disabled={!serviceOk}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="reg-role">ログイン権限</Label>
              <select
                id="reg-role"
                name="role"
                className={selectClass}
                defaultValue="staff"
                disabled={!serviceOk}
              >
                {roleOptions.map((r) => (
                  <option key={r} value={r}>
                    {APP_ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-start gap-2 rounded-md border p-3 sm:col-span-2">
              <input
                type="checkbox"
                name="send_google_guide"
                value="1"
                defaultChecked
                disabled={!serviceOk}
                className="mt-0.5 h-4 w-4 rounded border-input"
              />
              <span className="text-sm text-muted-foreground">
                登録と同時に Google 連携通知を送信する
              </span>
            </label>
          </CardContent>
        </Card>

        <StaffProfileFormFields
          defaults={emptyStaffFormDefaults()}
          hideEmailField
        />

        <Button type="submit" size="lg" disabled={!serviceOk}>
          登録する
        </Button>
      </form>
    </div>
  );
}
