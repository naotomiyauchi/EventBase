import Link from "next/link";
import { notFound } from "next/navigation";
import { isAppManagerRole } from "@/lib/app-role";
import { getCurrentProfile } from "@/lib/auth-profile";
import { createClient } from "@/lib/supabase/server";
import { GoogleConnectionCard } from "@/components/settings/google-connection-card";

export default async function SettingsGooglePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile || !isAppManagerRole(profile.role)) {
    notFound();
  }

  const { data: cred } = await supabase
    .from("user_google_credentials")
    .select("updated_at")
    .eq("user_id", profile.id)
    .maybeSingle();

  const updatedAtLabel =
    cred?.updated_at != null
      ? new Date(cred.updated_at).toLocaleString("ja-JP", {
          timeZone: "Asia/Tokyo",
        })
      : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Google スプレッドシート連携</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          管理者・チームリーダーは、Google でログインまたは下のボタンでアカウントを紐付けると、リフレッシュトークンが保存されます。スタッフ権限の出力は、先頭の管理者に保存されたトークンを参照します。
        </p>
      </div>

      {sp.google === "reconnected" && (
        <p className="rounded-md border border-green-600/40 bg-green-50 px-3 py-2 text-sm text-green-900 dark:bg-green-950/40 dark:text-green-100">
          Google の紐付けが完了し、トークンを保存しました。
        </p>
      )}
      {sp.google === "need_login" && (
        <p className="rounded-md border border-amber-500/50 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
          スプレッドシート用のトークンがありません。下のボタンから Google
          を紐付けてください（同一 Google クライアントでログインしたことがある場合は「再同意」が必要なことがあります）。
        </p>
      )}
      {sp.google === "sheet_failed" && (
        <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          シート作成に失敗しました。トークンを再取得するため、下のボタンで Google
          を再度紐付けてください。
        </p>
      )}

      <GoogleConnectionCard
        hasStoredToken={Boolean(cred)}
        updatedAtLabel={updatedAtLabel}
      />

      <p className="text-xs text-muted-foreground">
        <Link href="/dashboard/settings/users" className="underline">
          スタッフ（アカウント）の登録
        </Link>
        で追加したスタッフは、初回に Google でログインするとトークンが保存されます。
      </p>
    </div>
  );
}
