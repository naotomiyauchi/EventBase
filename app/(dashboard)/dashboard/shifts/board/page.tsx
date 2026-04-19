import Link from "next/link";
import { ChevronLeft, ChevronRight, LayoutGrid } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { ShiftBoardCell } from "@/components/shift-board-cell";

function ymFromOffset(offset: number) {
  const base = new Date(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
    }).format(new Date()) + "-01T00:00:00+09:00"
  );
  base.setMonth(base.getMonth() + offset);
  const y = Number(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric" }).format(base)
  );
  const m = Number(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", month: "2-digit" }).format(base)
  );
  return { y, m };
}

function daysInMonth(y: number, m: number) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export default async function ShiftBoardTabPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const sp = await searchParams;
  const offsetRaw = Number(String(sp.m ?? "0"));
  const offset = Number.isFinite(offsetRaw) ? Math.max(-24, Math.min(24, Math.trunc(offsetRaw))) : 0;

  const supabase = await createClient();

  const { y, m } = ymFromOffset(offset);
  const totalDays = daysInMonth(y, m);
  const dateList = Array.from({ length: totalDays }, (_, i) => {
    const dd = String(i + 1).padStart(2, "0");
    return `${y}-${String(m).padStart(2, "0")}-${dd}`;
  });

  const [staffRes, projRes, shiftRes, unavailableRes] = await Promise.all([
    supabase.from("staff").select("id, name").order("name"),
    supabase
      .from("projects")
      .select(
        "id, title, related_entities, overview, event_period_start, event_period_end, assigned_staff_ids"
      )
      .order("updated_at", { ascending: false })
      .limit(500),
    supabase
      .from("project_shifts")
      .select("staff_id, shift_date, project_id, role")
      .gte("shift_date", dateList[0])
      .lte("shift_date", dateList[dateList.length - 1])
      .neq("status", "cancelled"),
    supabase
      .from("staff_unavailable_dates")
      .select("staff_id, unavailable_date, reason")
      .gte("unavailable_date", dateList[0])
      .lte("unavailable_date", dateList[dateList.length - 1]),
  ]);

  const staffs = (staffRes.data ?? []) as { id: string; name: string }[];
  const projects = (projRes.data ?? []) as {
    id: string;
    title: string;
    related_entities: string | null;
    overview: string | null;
    event_period_start: string | null;
    event_period_end: string | null;
    assigned_staff_ids: string[] | null;
  }[];
  const shifts = (shiftRes.data ?? []) as {
    staff_id: string;
    shift_date: string;
    project_id: string;
    role: "leader" | "helper";
  }[];
  const unavailable = (unavailableRes.data ?? []) as {
    staff_id: string;
    unavailable_date: string;
    reason: string | null;
  }[];

  const shiftMap = new Map<string, { projectId: string; role: "leader" | "helper" }>();
  for (const s of shifts) {
    shiftMap.set(`${s.staff_id}:${s.shift_date}`, { projectId: s.project_id, role: s.role });
  }
  const unavailableMap = new Map<string, string | null>();
  for (const u of unavailable) {
    unavailableMap.set(`${u.staff_id}:${u.unavailable_date}`, u.reason ?? null);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-2xl border bg-card/40 p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border bg-background">
            <LayoutGrid className="size-5 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold tracking-tight">月間シフト表</h2>
            <p className="text-sm text-muted-foreground">
              シフトの作成・修正はこの画面で行います。セルを選ぶだけで案件へアサインできます。
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Link
            href={`/dashboard/shifts/board?m=${offset - 1}`}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground shadow-xs transition-all hover:border-primary/30 hover:bg-muted/60 hover:text-foreground"
            aria-label="前月"
          >
            <ChevronLeft className="size-4" />
          </Link>
          <span className="min-w-28 text-center text-sm font-semibold tabular-nums">
            {y}年{m}月
          </span>
          <Link
            href={`/dashboard/shifts/board?m=${offset + 1}`}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground shadow-xs transition-all hover:border-primary/30 hover:bg-muted/60 hover:text-foreground"
            aria-label="次月"
          >
            <ChevronRight className="size-4" />
          </Link>
          <Link
            href="/dashboard/shifts/board?m=0"
            className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-background px-3 text-xs font-medium shadow-xs transition-all hover:border-primary/30 hover:bg-muted/60"
          >
            今月
          </Link>
        </div>
      </div>

      <Card className="border-border/80 shadow-xs">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">ここがシフト入力のメイン画面です</p>
            <p className="text-sm text-muted-foreground">
              手入力で配置したあと、公開・LINE通知・Google同期は `シフト運用` から実行します。
            </p>
          </div>
          <Link
            href="/dashboard/shifts"
            className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-background px-3 text-sm font-medium shadow-xs transition-all hover:border-primary/30 hover:bg-muted/60"
          >
            公開・連携へ戻る
          </Link>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-border/80 shadow-xs">
        <CardHeader className="border-b bg-muted/30">
          <CardTitle className="text-base">スタッフ × 日付</CardTitle>
          <CardDescription>横スクロールで全スタッフ列を表示します。</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <table className="min-w-[960px] border-separate border-spacing-0 text-sm">
              <thead className="sticky top-0 z-10 bg-background">
                <tr>
                  <th className="sticky left-0 z-20 w-28 border-b border-r bg-background px-2 py-2.5 text-left text-xs font-medium text-muted-foreground">
                    日付
                  </th>
                  {staffs.map((s) => (
                    <th
                      key={s.id}
                      className="min-w-[180px] border-b border-r bg-background px-2 py-2.5 text-left text-xs font-medium text-muted-foreground"
                    >
                      {s.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dateList.map((d) => (
                  <tr key={d} className="hover:bg-muted/20">
                    <td className="sticky left-0 z-10 border-b border-r bg-background px-2 py-2 text-xs font-medium tabular-nums">
                      {d}
                    </td>
                    {staffs.map((s) => {
                      const cur = shiftMap.get(`${s.id}:${d}`) ?? null;
                      const unavailableReason = unavailableMap.get(`${s.id}:${d}`);
                      const isUnavailable = unavailableReason !== undefined;
                      return (
                        <td key={`${s.id}:${d}`} className="border-b border-r bg-card/20 p-1.5 align-top">
                          <ShiftBoardCell
                            date={d}
                            staffId={s.id}
                            currentProjectId={cur?.projectId ?? null}
                            currentRole={cur?.role ?? null}
                            projects={projects}
                            isUnavailable={isUnavailable}
                            unavailableReason={unavailableReason ?? null}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
