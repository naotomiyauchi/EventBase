import { notFound } from "next/navigation";
import { sendGoogleLinkMailAction } from "@/app/actions/google-link";
import { isAppManagerRole } from "@/lib/app-role";
import { findAuthUsersByEmails } from "@/lib/auth-admin-lookup";
import { getCurrentProfile } from "@/lib/auth-profile";
import {
  createServiceRoleClient,
  isServiceRoleConfigured,
} from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

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

  const { data: staffRows } = await supabase
      .from("staff")
      .select("id, name, email")
      .eq("tenant_id", profile.tenant_id)
      .order("name", { ascending: true })
      .limit(100);

  let googleLinkedUserIds = new Set<string>();
  let authUserIdByEmail = new Map<string, string>();
  if (isServiceRoleConfigured()) {
    try {
      const admin = createServiceRoleClient();
      const emails = Array.from(
        new Set(
          (staffRows ?? [])
            .map((s) => (s.email ?? "").trim().toLowerCase())
            .filter(Boolean)
        )
      );
      const usersByEmail = await findAuthUsersByEmails(admin, emails);
      authUserIdByEmail = new Map(
        Array.from(usersByEmail.entries()).map(([email, user]) => [email, user.id])
      );
      const userIds = Array.from(
        new Set(Array.from(usersByEmail.values()).map((u) => u.id))
      );
      if (userIds.length > 0) {
        const { data: creds } = await admin
          .from("user_google_credentials")
          .select("user_id")
          .in("user_id", userIds);
        googleLinkedUserIds = new Set((creds ?? []).map((r) => String(r.user_id)));
      }
    } catch {
      googleLinkedUserIds = new Set();
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-linear-to-b from-card to-card/60 p-5 shadow-xs">
        <h2 className="text-lg font-semibold">Google連携</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          スタッフへ通知を送り、Google連携状況を管理します。
        </p>
      </div>

      {sp.google === "reconnected" && (
        <p className="rounded-md border border-green-600/40 bg-green-50 px-3 py-2 text-sm text-green-900 dark:bg-green-950/40 dark:text-green-100">
          Google の紐付けが完了し、トークンを保存しました。
        </p>
      )}
      {sp.google_notice_sent === "1" && (
        <p className="rounded-md border border-green-600/40 bg-green-50 px-3 py-2 text-sm text-green-900 dark:bg-green-950/40 dark:text-green-100">
          Google 連携通知を送信しました。
        </p>
      )}
      {sp.error && (
        <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {decodeURIComponent(sp.error)}
        </p>
      )}

      <div className="rounded-2xl border p-5 shadow-xs">
        <h3 className="text-base font-semibold">スタッフへ Google 連携通知を送信</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          管理画面からスタッフの通知タブへ Google 連携案内を送れます。
        </p>
        <div className="mt-3 space-y-2">
          {(staffRows ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">送信対象スタッフが見つかりません。</p>
          ) : (
            (staffRows ?? []).map((s) => {
              const email = (s.email ?? "").trim().toLowerCase();
              const authUserId = authUserIdByEmail.get(email) ?? null;
              const linked = authUserId ? googleLinkedUserIds.has(authUserId) : false;
              return (
                <div key={s.id} className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium">{s.name || "名前未設定"}</p>
                    <p className="text-xs text-muted-foreground">{s.email || "メール未設定"}</p>
                  </div>
                  <form action={sendGoogleLinkMailAction} className="flex items-center gap-2">
                    <span
                      className={
                        linked
                          ? "rounded bg-green-100 px-2 py-1 text-xs text-green-700 dark:bg-green-900/40 dark:text-green-300"
                          : "rounded bg-zinc-100 px-2 py-1 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                      }
                    >
                      {linked ? "連携済み" : "未連携"}
                    </span>
                    <input type="hidden" name="staff_id" value={s.id} />
                    <button
                      type="submit"
                      disabled={!s.email}
                      className="inline-flex h-8 min-w-24 items-center justify-center rounded-md border border-transparent bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      通知送信
                    </button>
                  </form>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
