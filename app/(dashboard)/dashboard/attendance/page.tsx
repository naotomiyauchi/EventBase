import { notFound } from "next/navigation";
import { CheckCircle2, ReceiptText } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/server";
import {
  checkoutShiftWithReportAction,
  checkInShiftAction,
  linkReceiptToShiftAction,
} from "@/app/actions/attendance";
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

function firstRel<T>(v: T[] | T | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{
    checked_in?: string;
    reported?: string;
    confirmed?: string;
    receipt_linked?: string;
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
  const [{ data: shifts }, { data: upcoming }, { data: receipts }] = await Promise.all([
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
    supabase
      .from("finance_receipts")
      .select("id, shift_id, expense_date, vendor, amount, file_path, project_id")
      .eq("staff_id", staff.id)
      .order("expense_date", { ascending: false })
      .limit(50),
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
  const receiptRows = (receipts ?? []) as {
    id: string;
    shift_id: string | null;
    expense_date: string;
    vendor: string | null;
    amount: number;
    file_path: string;
    project_id: string | null;
  }[];
  const receiptPaths = receiptRows.map((r) => r.file_path);
  const signedReceiptMap = new Map<string, string>();
  if (receiptPaths.length > 0) {
    const { data: signed } = await supabase.storage
      .from("receipt-files")
      .createSignedUrls(receiptPaths, 60 * 60);
    for (let i = 0; i < receiptPaths.length; i += 1) {
      const url = signed?.[i]?.signedUrl;
      if (url) signedReceiptMap.set(receiptPaths[i], url);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border bg-linear-to-b from-card to-card/60 shadow-xs">
        <CardHeader className="space-y-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground">
              ATTENDANCE STUDIO
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">打刻</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              出勤時に打刻し、終了時に実績と経費を入力して退勤報告してください。
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border bg-card/70 p-4">
              <p className="text-xs font-medium text-muted-foreground">本日の対象シフト</p>
              <p className="mt-2 text-2xl font-semibold">{rows.length}件</p>
            </div>
            <div className="rounded-xl border bg-card/70 p-4">
              <p className="text-xs font-medium text-muted-foreground">これからの予定</p>
              <p className="mt-2 text-2xl font-semibold">{(upcoming ?? []).length}件</p>
            </div>
            <div className="rounded-xl border bg-card/70 p-4">
              <p className="text-xs font-medium text-muted-foreground">スタッフ名</p>
              <p className="mt-2 text-lg font-semibold">{staff.name}</p>
            </div>
          </div>
        </CardHeader>
      </Card>

      {sp.checked_in && (
        <p className="rounded-lg border border-green-600/30 bg-green-600/10 px-3 py-2 text-sm text-green-700 dark:text-green-300">
          出勤打刻を記録しました。
        </p>
      )}
      {sp.reported && (
        <p className="rounded-lg border border-green-600/30 bg-green-600/10 px-3 py-2 text-sm text-green-700 dark:text-green-300">
          退勤と実績報告を記録しました。
        </p>
      )}
      {sp.confirmed && (
        <p className="rounded-lg border border-green-600/30 bg-green-600/10 px-3 py-2 text-sm text-green-700 dark:text-green-300">
          シフト確認を記録しました。
        </p>
      )}
      {sp.receipt_linked && (
        <p className="rounded-lg border border-green-600/30 bg-green-600/10 px-3 py-2 text-sm text-green-700 dark:text-green-300">
          領収書をこのシフトに紐付けました。
        </p>
      )}
      {sp.error && (
        <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {decodeURIComponent(sp.error)}
        </p>
      )}

      {rows.length === 0 ? (
        <Card className="border-border/80 shadow-xs">
          <CardContent className="py-8 text-sm text-muted-foreground">
            本日のシフトはありません。
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {rows.map((r) => {
            const project = firstRel(r.projects);
            const att = firstRel(r.shift_attendance);
            const result = firstRel(r.shift_results);
            const hasCheckin = Boolean(att?.checkin_at);
            const hasCheckout = Boolean(att?.checkout_at);
            const linkedReceipts = receiptRows.filter((receipt) => receipt.shift_id === r.id);
            const availableReceipts = receiptRows.filter(
              (receipt) => receipt.shift_id == null || receipt.shift_id === r.id
            );
            const statusLabel = hasCheckout ? "退勤済み" : hasCheckin ? "出勤中" : "未出勤";
            const statusClass = hasCheckout
              ? "border-zinc-500/30 bg-zinc-500/10 text-zinc-700 dark:text-zinc-300"
              : hasCheckin
                ? "border-emerald-600/30 bg-emerald-600/10 text-emerald-700 dark:text-emerald-300"
                : "border-rose-600/30 bg-rose-600/10 text-rose-700 dark:text-rose-300";
            return (
              <Card key={r.id} className="overflow-hidden border-border/80 shadow-xs">
                <CardHeader className="border-b bg-muted/30">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-base">{project?.title ?? "（案件不明）"}</CardTitle>
                      <CardDescription>
                        {dt(r.scheduled_start_at)} - {dt(r.scheduled_end_at)}
                        {project?.site_address ? ` / ${project.site_address}` : ""}
                      </CardDescription>
                    </div>
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass}`}>
                      {statusLabel}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-xl border bg-muted/20 p-3 text-xs text-muted-foreground">
                    出勤: {dt(att?.checkin_at)} / 退勤: {dt(att?.checkout_at)}
                  </div>

                  {!hasCheckin && (
                    <form action={checkInShiftAction}>
                      <input type="hidden" name="shift_id" value={r.id} />
                      <input type="hidden" name="checkin_lat" />
                      <input type="hidden" name="checkin_lng" />
                      <LocationSubmitButton
                        label="出勤"
                        latFieldName="checkin_lat"
                        lngFieldName="checkin_lng"
                        size="lg"
                        className="w-full border border-white bg-primary text-base text-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-white hover:bg-primary/90 hover:text-white hover:shadow-md"
                      />
                    </form>
                  )}

                  {!hasCheckout && (
                    <form action={checkoutShiftWithReportAction} className="space-y-4 rounded-2xl border bg-card/40 p-4">
                      <input type="hidden" name="shift_id" value={r.id} />
                      <input type="hidden" name="checkout_lat" />
                      <input type="hidden" name="checkout_lng" />

                      <div className="space-y-1">
                        <p className="flex items-center gap-2 text-sm font-medium">
                          <ReceiptText className="size-4" />
                          退勤・実績報告
                        </p>
                        <p className="text-xs text-muted-foreground">
                          件数とメモを入力してから退勤してください。経費は領収書の紐付けで管理します。
                        </p>
                      </div>

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

                      <div className="space-y-2">
                        <Label htmlFor={`memo-${r.id}`}>メモ（実績/経費）</Label>
                        <Textarea id={`memo-${r.id}`} name="memo" defaultValue={result?.memo ?? ""} />
                      </div>

                      <Button
                        type="submit"
                        size="lg"
                        className="w-full border border-white bg-primary text-base text-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-white hover:bg-primary/90 hover:text-white hover:shadow-md"
                      >
                        退勤
                      </Button>
                    </form>
                  )}

                  <div className="space-y-3 rounded-2xl border bg-card/40 p-4">
                    <div className="space-y-1">
                      <p className="flex items-center gap-2 text-sm font-medium">
                        <ReceiptText className="size-4" />
                        領収書
                      </p>
                    </div>

                    {linkedReceipts.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">紐付け済み領収書</p>
                        {linkedReceipts.map((receipt) => (
                          <div
                            key={receipt.id}
                            className="flex flex-col gap-2 rounded-xl border bg-background px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">
                                {receipt.vendor || "支払先未設定"} / {Math.round(Number(receipt.amount ?? 0)).toLocaleString("ja-JP")}円
                              </p>
                              <p className="text-xs text-muted-foreground">{receipt.expense_date}</p>
                            </div>
                            {signedReceiptMap.get(receipt.file_path) ? (
                              <a
                                href={signedReceiptMap.get(receipt.file_path)}
                                className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-white bg-background px-3 text-xs font-medium shadow-sm transition-all hover:-translate-y-0.5 hover:border-white hover:bg-muted/80 hover:shadow-md"
                                target="_blank"
                                rel="noreferrer"
                              >
                                領収書を開く
                              </a>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {availableReceipts.length > 0 ? (
                      <form action={linkReceiptToShiftAction} className="space-y-3">
                        <input type="hidden" name="shift_id" value={r.id} />
                        <div className="space-y-2">
                          <Label htmlFor={`receipt-link-${r.id}`}>LINE登録済み領収書</Label>
                          <select
                            id={`receipt-link-${r.id}`}
                            name="receipt_id"
                            defaultValue=""
                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                          >
                            <option value="">選択してください</option>
                            {availableReceipts.map((receipt) => (
                              <option key={receipt.id} value={receipt.id}>
                                {receipt.expense_date} / {receipt.vendor || "支払先未設定"} / {Math.round(Number(receipt.amount ?? 0)).toLocaleString("ja-JP")}円
                              </option>
                            ))}
                          </select>
                        </div>
                        <Button
                          type="submit"
                          variant="outline"
                          className="w-full border-white text-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:border-white hover:bg-muted/80 hover:shadow-md"
                        >
                          このシフトに紐付ける
                        </Button>
                      </form>
                    ) : (
                      <div className="rounded-xl border bg-muted/20 p-3 text-sm text-muted-foreground">
                        まだ紐付けできる領収書がありません。
                      </div>
                    )}
                  </div>

                  {hasCheckout && (
                    <p className="rounded-lg border border-zinc-500/20 bg-zinc-500/5 px-3 py-2 text-sm text-muted-foreground">
                      このシフトは報告済みです。
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="border-border/80 shadow-xs">
        <CardHeader className="border-b bg-muted/30">
          <CardTitle className="text-base">今後のシフト確認</CardTitle>
          <CardDescription>前日確認に備えて、担当予定をここで確認できます。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {(upcoming ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">今後の予定はありません。</p>
          ) : (
            (upcoming ?? []).map((u) => (
              <div key={u.id} className="flex items-center justify-between gap-3 rounded-xl border bg-card/40 px-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {(u.projects as { title?: string }[] | null)?.[0]?.title ?? "（案件不明）"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {dt(u.scheduled_start_at)} - {dt(u.scheduled_end_at)}
                  </p>
                </div>
                {u.staff_confirmed_at ? (
                  <p className="inline-flex shrink-0 items-center gap-1 rounded-full border border-green-600/30 bg-green-600/10 px-2.5 py-1 text-xs text-green-700 dark:text-green-300">
                    <CheckCircle2 className="size-3.5" />
                    確認済み
                  </p>
                ) : (
                  <form action={confirmOwnShiftAction}>
                    <input type="hidden" name="shift_id" value={u.id} />
                    <Button
                      type="submit"
                      size="sm"
                      variant="outline"
                      className="border-white text-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:border-white hover:bg-muted/80 hover:shadow-md"
                    >
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
