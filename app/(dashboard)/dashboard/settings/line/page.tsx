import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth-profile";
import { isAppManagerRole } from "@/lib/app-role";
import { sendLineLinkCodeAction } from "@/app/actions/line-link";

export default async function LineSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; code_sent?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile || !isAppManagerRole(profile.role)) notFound();

  const [{ data: links }, { data: logs }, { data: staffRows }, { data: codes }] = await Promise.all([
    supabase
      .from("line_user_links")
      .select("staff ( name, email ), line_user_id, linked_at")
      .order("linked_at", { ascending: false })
      .limit(50),
    supabase
      .from("line_webhook_logs")
      .select("event_type, line_user_id, status, note, created_at")
      .order("created_at", { ascending: false })
      .limit(20),
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

  return (
    <div className="space-y-6">
      <div>
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
        <p className="text-sm text-green-600 dark:text-green-400">連携コードメールを送信しました。</p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">6桁コードをメール送信（推奨）</CardTitle>
          <CardDescription>
            スタッフへ「連携 123456」形式のコードを送信します。スタッフは公式LINEにコードを送るだけで連携できます。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {(staffRows ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">送信対象スタッフが見つかりません。</p>
          ) : (
            (staffRows ?? []).map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 rounded border px-3 py-2 text-sm">
                <div>
                  <p className="font-medium">{s.name || "名前未設定"}</p>
                  <p className="text-xs text-muted-foreground">{s.email || "メール未設定"}</p>
                </div>
                <form action={sendLineLinkCodeAction}>
                  <input type="hidden" name="staff_id" value={s.id} />
                  <button
                    type="submit"
                    disabled={!s.email}
                    className="inline-flex h-8 min-w-24 items-center justify-center rounded-md border border-zinc-500 bg-zinc-900 px-3 text-xs font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    コード送信
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

      <Card>
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
                <div key={`${l.line_user_id}-${i}`} className="rounded border px-3 py-2 text-sm">
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Webhookログ（最新20件）</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(logs ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">ログはまだありません。</p>
          ) : (
            (logs ?? []).map((l, i) => (
              <div key={`${l.created_at}-${i}`} className="rounded border px-3 py-2 text-xs">
                <p>
                  {l.created_at} / {l.event_type} / {l.status}
                </p>
                <p className="text-muted-foreground">
                  {l.line_user_id ?? "line_user_idなし"} {l.note ? `/ ${l.note}` : ""}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">連携コード発行履歴（最新20件）</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(codes ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">履歴はまだありません。</p>
          ) : (
            (codes ?? []).map((c) => (
              <div key={c.id} className="rounded border px-3 py-2 text-xs">
                <p>
                  {c.created_at} / {c.email} / code: {c.code}
                </p>
                <p className="text-muted-foreground">
                  expires: {c.expires_at} / {c.used_at ? `used: ${c.used_at}` : "unused"}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
