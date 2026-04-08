import Link from "next/link";
import { ChevronLeft, ChevronRight, ClipboardList, Store, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminShiftCalendar } from "@/components/admin-shift-calendar";
import { isAppManagerRole } from "@/lib/app-role";
import { getCurrentProfile } from "@/lib/auth-profile";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { PROJECT_STATUS_LABELS } from "@/lib/project-status";

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

function firstRel<T>(v: T[] | T | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export default async function DashboardHomePage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const sp = await searchParams;
  const monthOffsetRaw = Number(String(sp.m ?? "0"));
  const monthOffset = Number.isFinite(monthOffsetRaw)
    ? Math.max(-24, Math.min(24, Math.trunc(monthOffsetRaw)))
    : 0;
  let activeProjects = 0;
  let storeCount = 0;
  let staffCount = 0;
  let recent: { title: string; status: keyof typeof PROJECT_STATUS_LABELS }[] =
    [];
  let todayPlanned = 0;
  let todayCheckedIn = 0;
  let todayAcquisitions = 0;
  let todayGrossProfit = 0;
  let todayByProject: {
    projectId: string;
    title: string;
    planned: number;
    checkedIn: number;
    acquisition: number;
    grossProfit: number;
  }[] = [];
  let showAdminCalendar = false;
  let monthCalendar: {
    title: string;
    startWeekday: number;
    daysInMonth: number;
    rows: {
      day: number;
      dateLabel: string;
      shifts: {
        id: string;
        projectId: string;
        time: string;
        projectTitle: string;
        staffName: string;
        siteAddress: string | null;
        unitPrice: number | null;
        requiredHeadcount: number | null;
        checkedIn: boolean;
      }[];
    }[];
  } | null = null;

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const [{ count: p }, { count: s }, { count: st }, recentRes] =
      await Promise.all([
        supabase
          .from("projects")
          .select("*", { count: "exact", head: true })
          .in("status", ["staffing", "in_progress"]),
        supabase.from("stores").select("*", { count: "exact", head: true }),
        supabase.from("staff").select("*", { count: "exact", head: true }),
        supabase
          .from("projects")
          .select("title, status")
          .order("updated_at", { ascending: false })
          .limit(5),
      ]);
    activeProjects = p ?? 0;
    storeCount = s ?? 0;
    staffCount = st ?? 0;
    recent = (recentRes.data ?? []) as typeof recent;

    const { startIso, endIso } = getJstDayRange();
    const { data: shifts } = await supabase
      .from("project_shifts")
      .select("id, project_id, staff_id")
      .gte("scheduled_start_at", startIso)
      .lt("scheduled_start_at", endIso)
      .neq("status", "cancelled");

    const shiftRows =
      (shifts ?? []) as { id: string; project_id: string; staff_id: string }[];
    todayPlanned = shiftRows.length;

    if (shiftRows.length > 0) {
      const shiftIds = shiftRows.map((r) => r.id);
      const projectIds = [...new Set(shiftRows.map((r) => r.project_id))];
      const staffIds = [...new Set(shiftRows.map((r) => r.staff_id))];

      const [attRes, resultRes, expenseRes, projectRes, staffRes] =
        await Promise.all([
          supabase
            .from("shift_attendance")
            .select("shift_id, checkin_at, checkout_at")
            .in("shift_id", shiftIds),
          supabase
            .from("shift_results")
            .select("shift_id, mnp_count, new_count, option_count")
            .in("shift_id", shiftIds),
          supabase
            .from("shift_expenses")
            .select("shift_id, amount")
            .in("shift_id", shiftIds),
          supabase
            .from("projects")
            .select("id, title, unit_price")
            .in("id", projectIds),
          supabase.from("staff").select("id, hourly_cost").in("id", staffIds),
        ]);

      const attendance = (attRes.data ?? []) as {
        shift_id: string;
        checkin_at: string | null;
        checkout_at: string | null;
      }[];
      const results = (resultRes.data ?? []) as {
        shift_id: string;
        mnp_count: number | null;
        new_count: number | null;
        option_count: number | null;
      }[];
      const expenses = (expenseRes.data ?? []) as {
        shift_id: string;
        amount: number | null;
      }[];
      const projects = (projectRes.data ?? []) as {
        id: string;
        title: string;
        unit_price: number | null;
      }[];
      const staffs = (staffRes.data ?? []) as {
        id: string;
        hourly_cost: number | null;
      }[];

      const attendanceMap = new Map(attendance.map((a) => [a.shift_id, a]));
      const resultMap = new Map(results.map((r) => [r.shift_id, r]));
      const projectMap = new Map(projects.map((p2) => [p2.id, p2]));
      const staffMap = new Map(staffs.map((s2) => [s2.id, s2]));
      const expenseSumMap = new Map<string, number>();
      for (const e of expenses) {
        expenseSumMap.set(e.shift_id, (expenseSumMap.get(e.shift_id) ?? 0) + Number(e.amount ?? 0));
      }

      todayCheckedIn = attendance.filter((a) => Boolean(a.checkin_at)).length;
      for (const r of results) {
        todayAcquisitions +=
          Number(r.mnp_count ?? 0) +
          Number(r.new_count ?? 0) +
          Number(r.option_count ?? 0);
      }

      const nowMs = Date.now();
      const byProject = new Map<
        string,
        {
          projectId: string;
          title: string;
          planned: number;
          checkedIn: number;
          acquisition: number;
          grossProfit: number;
        }
      >();

      for (const sft of shiftRows) {
        const att = attendanceMap.get(sft.id);
        const r = resultMap.get(sft.id);
        const p2 = projectMap.get(sft.project_id);
        const stf = staffMap.get(sft.staff_id);
        const expense = expenseSumMap.get(sft.id) ?? 0;

        let laborCost = 0;
        if (att?.checkin_at) {
          const startMs = new Date(att.checkin_at).getTime();
          const endMs = att.checkout_at ? new Date(att.checkout_at).getTime() : nowMs;
          const minutes = Math.max(0, (endMs - startMs) / (1000 * 60));
          laborCost = (minutes / 60) * Number(stf?.hourly_cost ?? 0);
        }
        const revenue = Number(p2?.unit_price ?? 0);
        const shiftGross = revenue - (laborCost + expense);
        todayGrossProfit += shiftGross;

        const acquisition =
          Number(r?.mnp_count ?? 0) +
          Number(r?.new_count ?? 0) +
          Number(r?.option_count ?? 0);
        const cur = byProject.get(sft.project_id) ?? {
          projectId: sft.project_id,
          title: p2?.title ?? "（案件不明）",
          planned: 0,
          checkedIn: 0,
          acquisition: 0,
          grossProfit: 0,
        };
        cur.planned += 1;
        cur.checkedIn += att?.checkin_at ? 1 : 0;
        cur.acquisition += acquisition;
        cur.grossProfit += shiftGross;
        byProject.set(sft.project_id, cur);
      }

      todayByProject = [...byProject.values()].sort((a, b) => b.planned - a.planned);
    }

    const profile = await getCurrentProfile(supabase);
    showAdminCalendar = Boolean(profile && isAppManagerRole(profile.role));
    if (showAdminCalendar) {
      const now = new Date();
      const jp = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "2-digit",
      }).formatToParts(now);
      const baseY = Number(jp.find((p2) => p2.type === "year")?.value ?? 0);
      const baseM = Number(jp.find((p2) => p2.type === "month")?.value ?? 0);
      const firstOfTargetMonth = new Date(
        `${baseY}-${String(baseM).padStart(2, "0")}-01T00:00:00+09:00`
      );
      firstOfTargetMonth.setMonth(firstOfTargetMonth.getMonth() + monthOffset);
      const y = Number(
        new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric" }).format(
          firstOfTargetMonth
        )
      );
      const m = Number(
        new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", month: "2-digit" }).format(
          firstOfTargetMonth
        )
      );
      const monthStartUtc = new Date(Date.UTC(y, m - 1, 1, -9, 0, 0));
      const nextMonthStartUtc = new Date(Date.UTC(y, m, 1, -9, 0, 0));
      const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
      const startWeekday = new Date(`${y}-${String(m).padStart(2, "0")}-01T00:00:00+09:00`).getDay();

      const monthStartDate = `${y}-${String(m).padStart(2, "0")}-01`;
      const nextMonthStartDate = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(Date.UTC(y, m, 1, -9, 0, 0)));

      const { data: monthShifts } = await supabase
        .from("project_shifts")
        .select(
          `
          id,
          project_id,
          staff_id,
          shift_date,
          scheduled_start_at,
          scheduled_end_at
        `
        )
        .gte("shift_date", monthStartDate)
        .lt("shift_date", nextMonthStartDate)
        .neq("status", "cancelled")
        .order("scheduled_start_at", { ascending: true });

      const shifts = (monthShifts ?? []) as unknown as {
        id: string;
        project_id: string;
        staff_id: string;
        shift_date: string;
        scheduled_start_at: string;
        scheduled_end_at: string;
      }[];
      const shiftIds = shifts.map((sft) => sft.id).filter(Boolean);
      const projectIds = [...new Set(shifts.map((sft) => sft.project_id).filter(Boolean))];
      const staffIds = [...new Set(shifts.map((sft) => sft.staff_id).filter(Boolean))];
      const [{ data: projectRows }, { data: staffRows }, { data: attendanceRows }] = await Promise.all([
        projectIds.length > 0
          ? supabase
              .from("projects")
              .select("id, title, site_address, unit_price, required_headcount")
              .in("id", projectIds)
          : Promise.resolve({ data: [] }),
        staffIds.length > 0
          ? supabase.from("staff").select("id, name").in("id", staffIds)
          : Promise.resolve({ data: [] }),
        shiftIds.length > 0
          ? supabase
              .from("shift_attendance")
              .select("shift_id, checkin_at")
              .in("shift_id", shiftIds)
          : Promise.resolve({ data: [] }),
      ]);
      const projectMap = new Map(
        (
          (projectRows ?? []) as {
            id: string;
            title: string | null;
            site_address: string | null;
            unit_price: number | null;
            required_headcount: number | null;
          }[]
        ).map((p2) => [
          p2.id,
          {
            title: p2.title ?? "案件未設定",
            siteAddress: p2.site_address ?? null,
            unitPrice: p2.unit_price ?? null,
            requiredHeadcount: p2.required_headcount ?? null,
          },
        ])
      );
      const staffMap = new Map(
        ((staffRows ?? []) as { id: string; name: string | null }[]).map((s2) => [
          s2.id,
          s2.name ?? "スタッフ未設定",
        ])
      );
      const attendanceMap = new Map(
        ((attendanceRows ?? []) as { shift_id: string; checkin_at: string | null }[]).map(
          (a) => [a.shift_id, Boolean(a.checkin_at)] as const
        )
      );
      const byDay = new Map<number, { id: string; time: string; projectTitle: string; staffName: string }[]>();
      const byDayWithAddress = new Map<
        number,
        {
          id: string;
          projectId: string;
          time: string;
          projectTitle: string;
          staffName: string;
          siteAddress: string | null;
          unitPrice: number | null;
          requiredHeadcount: number | null;
          checkedIn: boolean;
        }[]
      >();
      for (const sft of shifts) {
        const jstDay = Number(String(sft.shift_date).slice(-2));
        const time = new Intl.DateTimeFormat("ja-JP", {
          timeZone: "Asia/Tokyo",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).format(new Date(sft.scheduled_start_at));
        const arr = byDayWithAddress.get(jstDay) ?? [];
        const pj = projectMap.get(sft.project_id);
        arr.push({
          id: sft.id,
          projectId: sft.project_id,
          time,
          projectTitle: pj?.title ?? "案件未設定",
          staffName: staffMap.get(sft.staff_id) ?? "スタッフ未設定",
          siteAddress: pj?.siteAddress ?? null,
          unitPrice: pj?.unitPrice ?? null,
          requiredHeadcount: pj?.requiredHeadcount ?? null,
          checkedIn: attendanceMap.get(sft.id) ?? false,
        });
        byDayWithAddress.set(jstDay, arr);
      }

      monthCalendar = {
        title: `${y}年${m}月`,
        startWeekday,
        daysInMonth,
        rows: Array.from({ length: daysInMonth }, (_, i) => ({
          day: i + 1,
          dateLabel: `${y}-${String(m).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`,
          shifts: byDayWithAddress.get(i + 1) ?? [],
        })),
      };
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">ダッシュボード</h1>
        <p className="text-sm text-muted-foreground">
          今日の概要（初期版 — 詳細分析は今後追加）
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">稼働中の案件</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{activeProjects}</p>
            <p className="text-xs text-muted-foreground">
              手配中・実施中ステータス
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">現場マスタ</CardTitle>
            <Store className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{storeCount}</p>
            <p className="text-xs text-muted-foreground">登録店舗数</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">スタッフ</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{staffCount}</p>
            <p className="text-xs text-muted-foreground">登録人数</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">本日の案件稼働状況（試作）</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">出勤状況</p>
              <p className="text-xl font-semibold tabular-nums">
                {todayCheckedIn} / {todayPlanned}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">獲得件数（合計）</p>
              <p className="text-xl font-semibold tabular-nums">
                {todayAcquisitions}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">見込み粗利（円）</p>
              <p className="text-xl font-semibold tabular-nums">
                {Math.round(todayGrossProfit).toLocaleString("ja-JP")}
              </p>
            </div>
          </div>

          {todayByProject.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              本日のシフトはまだありません。
            </p>
          ) : (
            <div className="space-y-2">
              {todayByProject.map((row) => (
                <div
                  key={row.projectId}
                  className="flex items-center justify-between gap-3 border-b border-border/60 pb-2 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{row.title}</p>
                    <p className="text-xs text-muted-foreground">
                      出勤 {row.checkedIn}/{row.planned} ・ 獲得 {row.acquisition}件
                    </p>
                  </div>
                  <p className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    粗利 {Math.round(row.grossProfit).toLocaleString("ja-JP")} 円
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">直近の案件</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!isSupabaseConfigured() && (
            <p className="text-sm text-muted-foreground">
              Supabase 接続後に表示されます。
            </p>
          )}
          {isSupabaseConfigured() && recent.length === 0 && (
            <p className="text-sm text-muted-foreground">
              案件がまだありません。
            </p>
          )}
          {recent.map((r, i) => (
            <div
              key={`${r.title}-${i}`}
              className="flex items-center justify-between gap-2 border-b border-border/60 pb-2 last:border-0 last:pb-0"
            >
              <span className="truncate text-sm font-medium">{r.title}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {PROJECT_STATUS_LABELS[r.status]}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      {showAdminCalendar && monthCalendar && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">全員シフトカレンダー（{monthCalendar.title}）</CardTitle>
            <div className="flex items-center gap-2">
              <Link
                href={`/dashboard?m=${monthOffset - 1}`}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border hover:bg-muted"
                aria-label="前月"
              >
                <ChevronLeft className="size-4" />
              </Link>
              <Link
                href="/dashboard?m=0"
                className="inline-flex h-8 items-center justify-center rounded-md border px-2 text-xs hover:bg-muted"
              >
                今月
              </Link>
              <Link
                href={`/dashboard?m=${monthOffset + 1}`}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border hover:bg-muted"
                aria-label="次月"
              >
                <ChevronRight className="size-4" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <AdminShiftCalendar
              title={monthCalendar.title}
              startWeekday={monthCalendar.startWeekday}
              days={monthCalendar.rows}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
