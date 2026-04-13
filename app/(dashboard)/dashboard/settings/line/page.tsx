import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth-profile";
import { isAppManagerRole } from "@/lib/app-role";
import { setupLineRichMenuAction } from "@/app/actions/line";

export default async function LineSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ richmenu?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile || !isAppManagerRole(profile.role)) notFound();

  const [{ data: cfg }, { data: links }, { data: logs }] = await Promise.all([
    supabase
      .from("tenant_plugin_configs")
      .select("config")
      .eq("tenant_id", profile.tenant_id)
      .eq("module_key", "line_config")
      .maybeSingle(),
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
  ]);

  const richMenuId =
    (cfg?.config as { rich_menu_id?: string } | null)?.rich_menu_id ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">LINE連携</h2>
        <p className="text-sm text-muted-foreground">
          公式LINEのリッチメニューを作成し、スタッフがLINE内で入力した希望休を取り込みます。
        </p>
      </div>

      {sp.richmenu ? (
        <p className="text-sm text-green-600 dark:text-green-400">リッチメニューを更新しました。</p>
      ) : null}
      {sp.error ? (
        <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {decodeURIComponent(sp.error)}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">公式LINEコンテンツ作成</CardTitle>
          <CardDescription>
            3ボタン（連携設定 / 希望休入力 / 使い方）のリッチメニューを自動作成して配信します。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <form action={setupLineRichMenuAction}>
            <Button type="submit">リッチメニューを作成 / 更新</Button>
          </form>
          <p className="text-xs text-muted-foreground">
            現在の rich_menu_id: {richMenuId ?? "未設定"}
          </p>
          <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
            <p>入力フロー:</p>
            <p>1. 「連携設定」→ メールアドレス送信</p>
            <p>2. 「希望休入力」→ 日付と理由を送信（例: 2026-04-30 私用）</p>
          </div>
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
    </div>
  );
}
