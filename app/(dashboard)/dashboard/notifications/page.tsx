import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth-profile";
import { isAppManagerRole } from "@/lib/app-role";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/app/actions/notifications";

function dt(s: string) {
  return new Date(s).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ read?: string; read_all?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile || !isAppManagerRole(profile.role)) notFound();

  const { data: rows } = await supabase
    .from("app_notifications")
    .select("id, type, title, body, read_at, created_at")
    .eq("tenant_id", profile.tenant_id)
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">通知</h1>
          <p className="text-sm text-muted-foreground">LINE経由の領収書アップロード・希望休追加を表示します。</p>
        </div>
        <form action={markAllNotificationsReadAction}>
          <Button type="submit" variant="outline">すべて既読にする</Button>
        </form>
      </div>

      {sp.read ? <p className="text-sm text-green-600 dark:text-green-400">既読にしました。</p> : null}
      {sp.read_all ? <p className="text-sm text-green-600 dark:text-green-400">すべて既読にしました。</p> : null}
      {sp.error ? (
        <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {decodeURIComponent(sp.error)}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">最新通知</CardTitle>
          <CardDescription>未読は背景が強調表示されます。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {(rows ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">通知はまだありません。</p>
          ) : (
            (rows ?? []).map((r) => (
              <div
                key={r.id}
                className={`rounded border px-3 py-3 text-sm ${r.read_at ? "" : "bg-muted/30"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{r.title}</p>
                  <p className="text-xs text-muted-foreground">{dt(r.created_at)}</p>
                </div>
                {r.body ? <p className="mt-1 text-xs text-muted-foreground">{r.body}</p> : null}
                {!r.read_at ? (
                  <form action={markNotificationReadAction} className="mt-2">
                    <input type="hidden" name="id" value={r.id} />
                    <Button type="submit" size="sm" variant="outline">
                      既読にする
                    </Button>
                  </form>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">既読</p>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
