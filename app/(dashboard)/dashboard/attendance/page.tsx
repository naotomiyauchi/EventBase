import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/server";
import { checkoutShiftWithReportAction, checkInShiftAction } from "@/app/actions/attendance";
import { confirmOwnShiftAction } from "@/app/actions/shifts";
import { LocationSubmitButton } from "@/components/location-submit-button";

function getJstDayRange(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = Number(parts.find((p) => p.type === "year")?.value ?? 0);
  const m = Number(parts.find((p) => p.type === "month")?.value ?? 0);
  const d = Number(parts.find((p) => p.type === "day")?.value ?? 0);
  const start = new Date(Date.UTC(y, m - 1, d, -9, 0, 0, 0));
  const end = new Date(Date.UTC(y, m - 1, d + 1, -9, 0, 0, 0));
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

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

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{
    checked_in?: string;
    reported?: string;
    confirmed?: string;
    error?: string;
  }>;
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
        <h1 className="text-xl font-semibold tracking-tight">本日の打刻</h1>
        <p className="text-sm text-muted-foreground">
          ログインメールに紐づくスタッフ名簿がありません。管理者に「スタッフ名簿」のメール一致を依頼してください。
        </p>
      </div>
    );
  }

  const { startIso, endIso } = getJstDayRange();
  const [{ data: shifts }, { data: upcoming }] = await Promise.all([
    supabase
    .from("project_shifts")
    .select(
      `
      id,
      role,
      status,
      scheduled_start_at,
      scheduled_end_at,
      projects ( id, title, site_address, unit_price, required_headcount, stores ( name, address ) ),
      shift_attendance ( checkin_at, checkout_at, status ),
      shift_results ( mnp_count, new_count, option_count, memo ),
      shift_expenses ( expense_type, amount, note, receipt_url )
    `
    )
    .eq("staff_id", staff.id)
    .gte("scheduled_start_at", startIso)
    .lt("scheduled_start_at", endIso)
    .order("scheduled_start_at", { ascending: true }),
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
      .gte("scheduled_start_at", endIso)
      .order("scheduled_start_at", { ascending: true })
      .limit(14),
  ]);

  const rows = (shifts ?? []) as unknown as {
    id: string;
    role: "leader" | "helper";
    status: "assigned" | "confirmed" | "cancelled";
    scheduled_start_at: string;
    scheduled_end_at: string;
    projects:
      | {
          id: string;
          title: string;
          site_address: string | null;
          unit_price: number | null;
          required_headcount: number | null;
          stores: { name: string | null; address: string | null }[] | null;
        }[]
      | null;
    shift_attendance:
      | { checkin_at: string | null; checkout_at: string | null; status: string | null }[]
      | null;
    shift_results:
      | { mnp_count: number | null; new_count: number | null; option_count: number | null; memo: string | null }[]
      | null;
    shift_expenses:
      | { expense_type: string; amount: number | null; note: string | null; receipt_url: string | null }[]
      | null;
  }[];

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">本日の打刻</h1>
        <p className="text-sm text-muted-foreground">
          出勤時に打刻し、終了時に実績と経費を入力して退勤報告してください。
        </p>
      </div>

      {sp.checked_in && (
        <p className="text-sm text-green-600 dark:text-green-400">出勤打刻を記録しました。</p>
      )}
      {sp.reported && (
        <p className="text-sm text-green-600 dark:text-green-400">退勤と実績報告を記録しました。</p>
      )}
      {sp.confirmed && (
        <p className="text-sm text-green-600 dark:text-green-400">シフト確認を記録しました。</p>
      )}
      {sp.error && (
        <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {decodeURIComponent(sp.error)}
        </p>
      )}

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            本日のシフトはありません。
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {rows.map((r) => {
            const project = r.projects?.[0] ?? null;
            const store = project?.stores?.[0] ?? null;
            const att = r.shift_attendance?.[0];
            const result = r.shift_results?.[0];
            const hasCheckin = Boolean(att?.checkin_at);
            const hasCheckout = Boolean(att?.checkout_at);
            const expenseMap = new Map(
              (r.shift_expenses ?? []).map((e) => [e.expense_type, Number(e.amount ?? 0)])
            );
            return (
              <Card key={r.id}>
                <CardHeader>
                  <CardTitle className="text-base">{project?.title ?? "（案件不明）"}</CardTitle>
                  <CardDescription>
                    {dt(r.scheduled_start_at)} - {dt(r.scheduled_end_at)} / 役割:{" "}
                    {r.role === "leader" ? "リーダー" : "ヘルパー"}
                    {project?.site_address ? ` / ${project.site_address}` : ""}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2 rounded-lg border bg-muted/20 p-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">本日の案件</p>
                      <p className="font-medium">{project?.title ?? "（案件不明）"}</p>
                    </div>
                    <div className="grid gap-1 text-xs text-muted-foreground">
                      <p>
                        現場:{" "}
                        {store?.name
                          ? `${store.name}${store.address ? ` / ${store.address}` : ""}`
                          : "—"}
                      </p>
                      <p>住所: {project?.site_address ?? "—"}</p>
                      <p>
                        単価:{" "}
                        {project?.unit_price == null
                          ? "—"
                          : `${Number(project.unit_price).toLocaleString("ja-JP")}円`}
                      </p>
                      <p>
                        必要人数:{" "}
                        {project?.required_headcount == null
                          ? "—"
                          : `${project.required_headcount}人`}
                      </p>
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    出勤: {dt(att?.checkin_at)} / 退勤: {dt(att?.checkout_at)}
                  </div>

                  {!hasCheckin && (
                    <div className="space-y-2">
                      <form action={checkInShiftAction}>
                        <input type="hidden" name="shift_id" value={r.id} />
                        <input type="hidden" name="checkin_lat" />
                        <input type="hidden" name="checkin_lng" />
                        <LocationSubmitButton
                          label="出勤打刻（位置情報あり）"
                          latFieldName="checkin_lat"
                          lngFieldName="checkin_lng"
                        />
                      </form>
                      <form action={checkInShiftAction}>
                        <input type="hidden" name="shift_id" value={r.id} />
                        <Button type="submit" variant="outline" className="w-full">
                          出勤打刻（位置情報なし）
                        </Button>
                      </form>
                      <p className="text-xs text-muted-foreground">
                        現場の緯度経度が設定されている場合は位置情報ありで打刻してください。
                      </p>
                    </div>
                  )}

                  {hasCheckin && !hasCheckout && (
                    <form action={checkoutShiftWithReportAction} className="space-y-4">
                      <input type="hidden" name="shift_id" value={r.id} />
                      <input type="hidden" name="checkout_lat" />
                      <input type="hidden" name="checkout_lng" />

                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="space-y-2">
                          <Label htmlFor={`mnp-${r.id}`}>MNP件数</Label>
                          <Input id={`mnp-${r.id}`} name="mnp_count" type="number" min={0} defaultValue={result?.mnp_count ?? 0} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`new-${r.id}`}>新規件数</Label>
                          <Input id={`new-${r.id}`} name="new_count" type="number" min={0} defaultValue={result?.new_count ?? 0} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`opt-${r.id}`}>オプション件数</Label>
                          <Input id={`opt-${r.id}`} name="option_count" type="number" min={0} defaultValue={result?.option_count ?? 0} />
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor={`tr-${r.id}`}>交通費</Label>
                          <Input id={`tr-${r.id}`} name="expense_transport" type="number" min={0} step="1" defaultValue={expenseMap.get("transport") ?? 0} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`pk-${r.id}`}>駐車場代</Label>
                          <Input id={`pk-${r.id}`} name="expense_parking" type="number" min={0} step="1" defaultValue={expenseMap.get("parking") ?? 0} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`sp-${r.id}`}>備品代</Label>
                          <Input id={`sp-${r.id}`} name="expense_supplies" type="number" min={0} step="1" defaultValue={expenseMap.get("supplies") ?? 0} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`ot-${r.id}`}>その他経費</Label>
                          <Input id={`ot-${r.id}`} name="expense_other" type="number" min={0} step="1" defaultValue={expenseMap.get("other") ?? 0} />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`receipt-${r.id}`}>レシートURL（任意）</Label>
                        <Input
                          id={`receipt-${r.id}`}
                          name="receipt_url"
                          type="url"
                          placeholder="https://..."
                          defaultValue={r.shift_expenses?.[0]?.receipt_url ?? ""}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`memo-${r.id}`}>メモ（実績/経費）</Label>
                        <Textarea id={`memo-${r.id}`} name="memo" defaultValue={result?.memo ?? ""} />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`expense-note-${r.id}`}>経費メモ（任意）</Label>
                        <Textarea
                          id={`expense-note-${r.id}`}
                          name="expense_note"
                          defaultValue={r.shift_expenses?.[0]?.note ?? ""}
                        />
                      </div>

                      <div className="space-y-2">
                        <LocationSubmitButton
                          label="退勤 + 実績報告（位置情報あり）"
                          latFieldName="checkout_lat"
                          lngFieldName="checkout_lng"
                          variant="default"
                        />
                        <Button type="submit" variant="outline" className="w-full">
                          退勤 + 実績報告（位置情報なし）
                        </Button>
                        <p className="text-xs text-muted-foreground">
                          経費入力時はレシートURLが必須です。
                        </p>
                      </div>
                    </form>
                  )}

                  {hasCheckout && (
                    <p className="text-sm text-muted-foreground">このシフトは報告済みです。</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
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
    </div>
  );
}
