import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/server";
import { confirmOwnShiftAction, deleteUnavailableDateAction, saveUnavailableDateAction } from "@/app/actions/shifts";

function dt(s: string | null | undefined) {
  if (!s) return "—";
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

export default async function MyShiftsPage({
  searchParams,
}: {
  searchParams: Promise<{ confirmed?: string; off_saved?: string; off_deleted?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    notFound();
  }

  const { data: staff } = await supabase
    .from("staff")
    .select("id, name, email")
    .eq("email", user.email.trim().toLowerCase())
    .maybeSingle();
  if (!staff) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold tracking-tight">シフト</h1>
        <p className="text-sm text-muted-foreground">
          ログインメールに紐づくスタッフ名簿がありません。管理者に「スタッフ名簿」のメール一致を依頼してください。
        </p>
      </div>
    );
  }

  const todayEndIso = (() => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const y = Number(parts.find((p) => p.type === "year")?.value ?? 0);
    const m = Number(parts.find((p) => p.type === "month")?.value ?? 0);
    const d = Number(parts.find((p) => p.type === "day")?.value ?? 0);
    return new Date(Date.UTC(y, m - 1, d + 1, -9, 0, 0, 0)).toISOString();
  })();

  const [{ data: upcoming }, { data: offDays }] = await Promise.all([
    supabase
      .from("project_shifts")
      .select(
        `
        id,
        scheduled_start_at,
        scheduled_end_at,
        role,
        status,
        staff_confirmed_at,
        projects ( title )
      `
      )
      .eq("staff_id", staff.id)
      .gte("scheduled_start_at", todayEndIso)
      .order("scheduled_start_at", { ascending: true })
      .limit(30),
    supabase
      .from("staff_unavailable_dates")
      .select("id, unavailable_date, reason")
      .eq("staff_id", staff.id)
      .gte(
        "unavailable_date",
        new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Tokyo",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date())
      )
      .order("unavailable_date", { ascending: true })
      .limit(50),
  ]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">シフト</h1>
        <p className="text-sm text-muted-foreground">
          希望休（NG日）の登録と、今後の担当シフトの確認ができます。
        </p>
      </div>

      {sp.confirmed && (
        <p className="text-sm text-green-600 dark:text-green-400">シフト確認を記録しました。</p>
      )}
      {sp.off_saved && (
        <p className="text-sm text-green-600 dark:text-green-400">希望休（NG日）を登録しました。</p>
      )}
      {sp.off_deleted && (
        <p className="text-sm text-green-600 dark:text-green-400">希望休（NG日）を削除しました。</p>
      )}
      {sp.error && (
        <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {decodeURIComponent(sp.error)}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">今後のシフト確認</CardTitle>
          <CardDescription>前日確認に備えて、担当予定をここで確認できます。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {(upcoming ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">今後の予定はありません。</p>
          ) : (
            (upcoming ?? []).map((u) => (
              <div key={u.id} className="flex items-center justify-between gap-3 rounded border px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {(u.projects as { title?: string }[] | null)?.[0]?.title ?? "（案件不明）"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {dt(u.scheduled_start_at)} - {dt(u.scheduled_end_at)} /{" "}
                    {u.role === "leader" ? "リーダー" : "ヘルパー"}
                  </p>
                </div>
                {u.staff_confirmed_at ? (
                  <p className="shrink-0 text-xs text-muted-foreground">確認済み</p>
                ) : (
                  <form action={confirmOwnShiftAction}>
                    <input type="hidden" name="shift_id" value={u.id} />
                    <Button type="submit" size="sm" variant="outline">
                      確認する
                    </Button>
                  </form>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">希望休（NG日）</CardTitle>
          <CardDescription>登録した日付は管理者のシフト作成でアラートされます。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            action={saveUnavailableDateAction}
            className="grid gap-3 sm:grid-cols-[1fr_2fr_auto]"
          >
            <Input name="unavailable_date" type="date" required />
            <Input name="reason" placeholder="理由（任意）" />
            <Button type="submit" size="sm">
              追加
            </Button>
          </form>
          {(offDays ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">登録はありません。</p>
          ) : (
            <div className="space-y-2">
              {(offDays ?? []).map((o) => (
                <div key={o.id} className="flex items-center justify-between rounded border px-3 py-2">
                  <p className="text-sm">
                    {o.unavailable_date}
                    {o.reason ? ` / ${o.reason}` : ""}
                  </p>
                  <form action={deleteUnavailableDateAction}>
                    <input type="hidden" name="id" value={o.id} />
                    <Button type="submit" size="sm" variant="outline">
                      削除
                    </Button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

