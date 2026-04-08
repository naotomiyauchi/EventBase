import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isAppManagerRole } from "@/lib/app-role";
import { getCurrentProfile } from "@/lib/auth-profile";
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

export default async function ShiftBoardPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const sp = await searchParams;
  const offsetRaw = Number(String(sp.m ?? "0"));
  const offset = Number.isFinite(offsetRaw) ? Math.max(-24, Math.min(24, Math.trunc(offsetRaw))) : 0;

  const supabase = await createClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile || !isAppManagerRole(profile.role)) notFound();

  const { y, m } = ymFromOffset(offset);
  const totalDays = daysInMonth(y, m);
  const dateList = Array.from({ length: totalDays }, (_, i) => {
    const dd = String(i + 1).padStart(2, "0");
    return `${y}-${String(m).padStart(2, "0")}-${dd}`;
  });

  const [staffRes, projRes, shiftRes] = await Promise.all([
    supabase.from("staff").select("id, name").order("name"),
    supabase.from("projects").select("id, title").order("updated_at", { ascending: false }).limit(500),
    supabase
      .from("project_shifts")
      .select("staff_id, shift_date, project_id, role")
      .gte("shift_date", dateList[0])
      .lte("shift_date", dateList[dateList.length - 1])
      .neq("status", "cancelled"),
  ]);

  const staffs = (staffRes.data ?? []) as { id: string; name: string }[];
  const projects = (projRes.data ?? []) as { id: string; title: string }[];
  const shifts = (shiftRes.data ?? []) as {
    staff_id: string;
    shift_date: string;
    project_id: string;
    role: "leader" | "helper";
  }[];

  const shiftMap = new Map<string, { projectId: string; role: "leader" | "helper" }>();
  for (const s of shifts) {
    shiftMap.set(`${s.staff_id}:${s.shift_date}`, { projectId: s.project_id, role: s.role });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">シフト表（一覧）</h1>
          <p className="text-sm text-muted-foreground">セルを「選ぶだけ」でアサインできます。</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/shift-board?m=${offset - 1}`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border hover:bg-muted"
            aria-label="前月"
          >
            <ChevronLeft className="size-4" />
          </Link>
          <span className="text-sm font-medium tabular-nums">
            {y}年{m}月
          </span>
          <Link
            href={`/dashboard/shift-board?m=${offset + 1}`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border hover:bg-muted"
            aria-label="次月"
          >
            <ChevronRight className="size-4" />
          </Link>
          <Link
            href="/dashboard/shift-board?m=0"
            className="inline-flex h-8 items-center justify-center rounded-md border px-2 text-xs hover:bg-muted"
          >
            今月
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">月間一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <table className="min-w-[960px] border-separate border-spacing-0 text-sm">
              <thead className="sticky top-0 z-10 bg-background">
                <tr>
                  <th className="sticky left-0 z-20 w-28 border-b border-r bg-background px-2 py-2 text-left text-xs text-muted-foreground">
                    日付
                  </th>
                  {staffs.map((s) => (
                    <th
                      key={s.id}
                      className="min-w-[220px] border-b border-r bg-background px-2 py-2 text-left text-xs text-muted-foreground"
                    >
                      {s.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dateList.map((d) => (
                  <tr key={d}>
                    <td className="sticky left-0 z-10 border-b border-r bg-background px-2 py-2 text-xs font-medium">
                      {d}
                    </td>
                    {staffs.map((s) => {
                      const cur = shiftMap.get(`${s.id}:${d}`) ?? null;
                      return (
                        <td key={`${s.id}:${d}`} className="border-b border-r p-2 align-top">
                          <ShiftBoardCell
                            date={d}
                            staffId={s.id}
                            currentProjectId={cur?.projectId ?? null}
                            currentRole={cur?.role ?? null}
                            projects={projects}
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

