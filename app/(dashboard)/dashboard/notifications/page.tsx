import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { isAppManagerRole } from "@/lib/app-role";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth-profile";
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
  if (!profile) notFound();

  const { data: rows } = await supabase
    .from("app_notifications")
    .select("id, type, title, body, metadata, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  const isManager = isAppManagerRole(profile.role);
  const visibleRows = (rows ?? []).filter((r) => {
    if (!isManager) return true;
    return r.type !== "google_link_guide" && r.type !== "google_link_completed_staff";
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">通知</h1>
          <p className="text-sm text-muted-foreground">お知らせと連携案内を表示します。</p>
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
          {visibleRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">通知はまだありません。</p>
          ) : (
            visibleRows.map((r) => (
              <div key={r.id} className={`rounded border px-3 py-3 text-sm ${r.read_at ? "" : "bg-muted/30"}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{r.title}</p>
                  <p className="text-xs text-muted-foreground">{dt(r.created_at)}</p>
                </div>
                {r.body ? <p className="mt-1 text-xs text-muted-foreground">{r.body}</p> : null}
                {(() => {
                  const isGoogleGuide = r.type === "google_link_guide";
                  const isGoogleGuideForStaff = r.type === "google_link_guide";
                  const actionUrl =
                    isGoogleGuide
                      ? "/dashboard/account?connect_google=1"
                      : typeof r.metadata === "object" &&
                          r.metadata &&
                          "action_url" in r.metadata &&
                          typeof r.metadata.action_url === "string"
                        ? r.metadata.action_url
                        : "";
                  if (!actionUrl) return null;
                  const actionLabel =
                    isGoogleGuide
                      ? "こちら"
                      : typeof r.metadata === "object" &&
                          r.metadata &&
                          "action_label" in r.metadata &&
                          typeof r.metadata.action_label === "string" &&
                          r.metadata.action_label
                        ? r.metadata.action_label
                        : "詳細はこちら";
                  return (
                    <div className="mt-2 space-y-1">
                      <a
                        href={actionUrl}
                        className={
                          isGoogleGuideForStaff
                            ? "inline-flex rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                            : "inline-flex text-xs font-medium text-primary underline-offset-4 hover:underline"
                        }
                      >
                        {actionLabel}
                      </a>
                      {isGoogleGuideForStaff ? (
                        <p className="text-[11px] text-muted-foreground break-all">{actionUrl}</p>
                      ) : null}
                    </div>
                  );
                })()}
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
