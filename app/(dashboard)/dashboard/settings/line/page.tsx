import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth-profile";
import { isAppManagerRole } from "@/lib/app-role";
import { sendLineLinkCodeAction } from "@/app/actions/line-link";

function jpDate(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function jpTime(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export default async function LineSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; code_sent?: string; warn?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile || !isAppManagerRole(profile.role)) notFound();

  const [{ data: links }, { data: staffRows }, { data: codes }] = await Promise.all([
    supabase
      .from("line_user_links")
      .select("staff ( name, email ), line_user_id, linked_at")
      .order("linked_at", { ascending: false })
      .limit(50),
    supabase
      .from("staff")
      .select("id, name, email")
      .eq("tenant_id", profile.tenant_id)
      .order("name", { ascending: true })
      .limit(100),
    supabase
      .from("line_link_codes")
      .select("id, email, code, expires_at, used_at, created_at")
      .eq("tenant_id", profile.tenant_id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  const nameByEmail = new Map(
    (staffRows ?? [])
      .filter((s) => s.email)
      .map((s) => [String(s.email).toLowerCase(), s.name || "名前未設定"])
  );

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-linear-to-b from-card to-card/60 p-5 shadow-xs">
        <h2 className="text-lg font-semibold tracking-tight">LINE連携</h2>
        <p className="text-sm text-muted-foreground">
          リッチメニューは LINE 側で作成し、下記の「送信する文言」と一致させてください。Webhook がメッセージ内容で連携・希望休などを判別します。
        </p>
      </div>

      {sp.error ? (
        <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {decodeURIComponent(sp.error)}
        </p>
      ) : null}
      {sp.code_sent ? (
        <p className="text-sm text-green-600 dark:text-green-400">連携コードを生成しました。</p>
      ) : null}
      {sp.warn === "smtp_not_configured" ? (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          メール設定が未完了のため、コードは発行済みですがメール送信はスキップしました。
        </p>
      ) : null}
      {sp.warn === "mail_send_failed" ? (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          コードは発行済みですが、メール送信に失敗しました。履歴からコードを確認できます。
        </p>
      ) : null}

      <details className="rounded-2xl border bg-card/70 shadow-xs">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold hover:bg-muted/40">
          LINE連携を開始する
        </summary>
        <div className="border-t p-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">6桁コードを生成</CardTitle>
              <CardDescription>
                スタッフへ「連携 123456」形式のコードを送信します。スタッフは公式LINEにコードを送るだけで連携できます。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {(staffRows ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">送信対象スタッフが見つかりません。</p>
              ) : (
                (staffRows ?? []).map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm">
                    <div>
                      <p className="font-medium">{s.name || "名前未設定"}</p>
                      <p className="text-xs text-muted-foreground">{s.email || "メール未設定"}</p>
                    </div>
                    <form action={sendLineLinkCodeAction}>
                      <input type="hidden" name="staff_id" value={s.id} />
                      <button
                        type="submit"
                        disabled={!s.email}
                        className="inline-flex h-8 min-w-24 items-center justify-center rounded-md border border-transparent bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        コード生成
                      </button>
                    </form>
                  </div>
                ))
              )}
              <p className="text-xs text-muted-foreground">
                スタッフ操作: メール受信後、公式LINEに <code>連携 123456</code> を送信（コードは30分で失効）
              </p>
            </CardContent>
          </Card>
        </div>
      </details>

      <Card className="shadow-xs">
        <CardHeader>
          <CardTitle className="text-base">連携済みスタッフ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(links ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">まだ連携はありません。</p>
          ) : (
            (links ?? []).map((l, i) => {
              const s = Array.isArray(l.staff) ? l.staff[0] : l.staff;
              return (
                <div key={`${l.line_user_id}-${i}`} className="rounded-xl border px-3 py-2 text-sm">
                  <p className="font-medium">{s?.name ?? "スタッフ不明"}</p>
                  <p className="text-xs text-muted-foreground">
                    {s?.email ?? "メール未設定"} / LINE: {l.line_user_id}
                  </p>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card className="shadow-xs">
        <CardHeader>
          <CardTitle className="text-base">連携コード発行履歴（最新20件）</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(codes ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">履歴はまだありません。</p>
          ) : (
            (codes ?? []).map((c) => {
              const userName = nameByEmail.get(String(c.email ?? "").toLowerCase()) ?? "名前未設定";
              return (
                <div key={c.id} className="rounded-xl border px-3 py-2 text-sm">
                  <p>
                    【コード：{c.code}】{jpDate(c.created_at)} / {jpTime(c.created_at)} / {userName}
                  </p>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
