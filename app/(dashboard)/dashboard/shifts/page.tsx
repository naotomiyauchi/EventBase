import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { isAppManagerRole } from "@/lib/app-role";
import { getCurrentProfile } from "@/lib/auth-profile";
import { createClient } from "@/lib/supabase/server";
import {
  createShiftAction,
  publishDraftShiftsAction,
  sendShiftReminderAction,
  syncShiftsToGoogleCalendarAction,
} from "@/app/actions/shifts";

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

function firstRel<T>(v: T[] | T | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export default async function ShiftManagementPage({
  searchParams,
}: {
  searchParams: Promise<{
    created?: string;
    reminded?: string;
    published?: string;
    synced?: string;
    gcal_created?: string;
    gcal_updated?: string;
    error?: string;
  }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile || !isAppManagerRole(profile.role)) {
    notFound();
  }

  const [{ data: projects }, { data: staffs }, { data: shifts }, { data: ngs }] =
    await Promise.all([
      supabase
        .from("projects")
        .select("id, title, store_id")
        .order("updated_at", { ascending: false })
        .limit(200),
      supabase.from("staff").select("id, name, email").order("name"),
      supabase
        .from("project_shifts")
        .select(
          `
          id,
          staff_id,
          scheduled_start_at,
          scheduled_end_at,
          role,
          status,
          publish_status,
          staff_response_status,
          reminder_sent_at,
          staff_confirmed_at,
          projects ( title ),
          staff ( name )
        `
        )
        .order("scheduled_start_at", { ascending: true })
        .limit(200),
      supabase
        .from("staff_unavailable_dates")
        .select("staff_id, unavailable_date")
        .gte(
          "unavailable_date",
          new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Tokyo",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).format(new Date())
        )
        .limit(500),
    ]);

  const ngSet = new Set((ngs ?? []).map((x) => `${x.staff_id}:${x.unavailable_date}`));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">シフト管理</h1>
        <p className="text-sm text-muted-foreground">
          指名アサイン、希望休回避、確認リマインドを管理します。
        </p>
      </div>

      {sp.created && <p className="text-sm text-green-600 dark:text-green-400">シフトを作成しました。</p>}
      {sp.published && (
        <p className="text-sm text-green-600 dark:text-green-400">
          下書きシフトを一括公開しました（通知送信記録つき）。
        </p>
      )}
      {sp.synced && (
        <p className="text-sm text-green-600 dark:text-green-400">
          Googleカレンダー同期完了（新規: {sp.gcal_created ?? "0"}件 / 更新: {sp.gcal_updated ?? "0"}件）
        </p>
      )}
      {sp.reminded && <p className="text-sm text-green-600 dark:text-green-400">確認リマインドを記録しました。</p>}
      {sp.error && (
        <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {decodeURIComponent(sp.error)}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Googleカレンダー同期</CardTitle>
          <CardDescription>
            期間内のシフトを管理者の Google カレンダー（primary）へ同期します。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={syncShiftsToGoogleCalendarAction} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <Input name="start_date" type="date" required />
            <Input name="end_date" type="date" required />
            <Button type="submit">Googleカレンダーへ同期</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">新規アサイン（指名）</CardTitle>
          <CardDescription>
            希望休（NG日）は作成時にブロックされます。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createShiftAction} className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="project_id">案件</Label>
              <select
                id="project_id"
                name="project_id"
                required
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none"
                defaultValue=""
              >
                <option value="" disabled>
                  案件を選択
                </option>
                {(projects ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="staff_id">スタッフ</Label>
              <select
                id="staff_id"
                name="staff_id"
                required
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none"
                defaultValue=""
              >
                <option value="" disabled>
                  スタッフを選択
                </option>
                {(staffs ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.email ? `(${s.email})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="scheduled_start_at">開始（JST）</Label>
              <Input id="scheduled_start_at" name="scheduled_start_at" type="datetime-local" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="scheduled_end_at">終了（JST）</Label>
              <Input id="scheduled_end_at" name="scheduled_end_at" type="datetime-local" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">役割</Label>
              <select
                id="role"
                name="role"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none"
                defaultValue="helper"
              >
                <option value="leader">リーダー</option>
                <option value="helper">ヘルパー</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <Button type="submit">シフト作成</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">シフト公開（一括）</CardTitle>
          <CardDescription>
            期間内の下書きシフトを公開ステータスへ変更し、通知送信時刻を記録します。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={publishDraftShiftsAction} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <Input name="start_date" type="date" required />
            <Input name="end_date" type="date" required />
            <Button type="submit">一括公開</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">シフト一覧（直近）</CardTitle>
          <CardDescription>未確認のスタッフを優先してフォローしてください。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {(shifts ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">シフトがありません。</p>
          ) : (
            (shifts ?? []).map((s) => {
              const staffName =
                firstRel<{ name?: string }>(s.staff as { name?: string }[] | { name?: string } | null)
                  ?.name ?? "—";
              const projectTitle =
                firstRel<{ title?: string }>(
                  s.projects as { title?: string }[] | { title?: string } | null
                )?.title ?? "—";
              const shiftDate = new Intl.DateTimeFormat("en-CA", {
                timeZone: "Asia/Tokyo",
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
              }).format(new Date(s.scheduled_start_at));
              const isNg = ngSet.has(`${s.staff_id}:${shiftDate}`);
              return (
                <div
                  key={s.id}
                  className="flex flex-col gap-2 rounded-lg border px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {projectTitle} / {staffName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {dt(s.scheduled_start_at)} - {dt(s.scheduled_end_at)} / {s.role === "leader" ? "リーダー" : "ヘルパー"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      公開:{" "}
                      {s.publish_status === "published" ? "公開済み" : "下書き"} / 返信:{" "}
                      {s.staff_response_status === "accepted"
                        ? "承諾"
                        : s.staff_response_status === "declined"
                          ? "辞退"
                          : s.staff_response_status === "read"
                            ? "既読"
                            : "未読"}{" "}
                      /{" "}
                      確認: {s.staff_confirmed_at ? "済み" : "未確認"} / リマインド:{" "}
                      {s.reminder_sent_at ? dt(s.reminder_sent_at) : "未送信"}
                      {isNg ? " / NG日注意" : ""}
                    </p>
                  </div>
                  {!s.staff_confirmed_at && (
                    <form action={sendShiftReminderAction}>
                      <input type="hidden" name="shift_id" value={s.id} />
                      <Button type="submit" size="sm" variant="outline">
                        前日確認リマインド
                      </Button>
                    </form>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
