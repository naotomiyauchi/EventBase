"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isAppManagerRole } from "@/lib/app-role";
import { getCurrentProfile } from "@/lib/auth-profile";
import { getOAuth2WithRefreshToken } from "@/lib/google-oauth-client";
import { upsertShiftEventsToGoogleCalendar } from "@/lib/google-shift-calendar";
import { isGoogleSheetsApiConfigured } from "@/lib/google-sheets-config";
import { isLineConfigured, pushLineMessages } from "@/lib/line-messaging";
import { createClient } from "@/lib/supabase/server";

function parseJstLocalToIso(v: string): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const d = new Date(`${s}:00+09:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function parseJstDateTimeToIso(dateStr: string, timeStr: string): string | null {
  const d = String(dateStr ?? "").trim();
  const t = String(timeStr ?? "").trim();
  if (!d || !t) return null;
  const iso = `${d}T${t}:00+09:00`;
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString();
}

function jstDate(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  const a1 = new Date(aStart).getTime();
  const a2 = new Date(aEnd).getTime();
  const b1 = new Date(bStart).getTime();
  const b2 = new Date(bEnd).getTime();
  return a1 < b2 && b1 < a2;
}

function restHours(prevEnd: string, nextStart: string): number {
  return (new Date(nextStart).getTime() - new Date(prevEnd).getTime()) / (1000 * 60 * 60);
}

export async function createShiftAction(formData: FormData) {
  const supabase = await createClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile || !isAppManagerRole(profile.role)) {
    redirect("/dashboard/shifts?error=権限がありません");
  }

  const projectId = String(formData.get("project_id") ?? "").trim();
  const staffId = String(formData.get("staff_id") ?? "").trim();
  const roleRaw = String(formData.get("role") ?? "helper");
  const startIso = parseJstLocalToIso(String(formData.get("scheduled_start_at") ?? ""));
  const endIso = parseJstLocalToIso(String(formData.get("scheduled_end_at") ?? ""));
  if (!projectId || !staffId || !startIso || !endIso) {
    redirect("/dashboard/shifts?error=入力が不足しています");
  }
  if (new Date(endIso).getTime() <= new Date(startIso).getTime()) {
    redirect("/dashboard/shifts?error=終了は開始より後にしてください");
  }
  const role = roleRaw === "leader" ? "leader" : "helper";

  const jstDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(startIso));
  const { data: ng } = await supabase
    .from("staff_unavailable_dates")
    .select("id")
    .eq("staff_id", staffId)
    .eq("unavailable_date", jstDate)
    .maybeSingle();
  if (ng) {
    redirect("/dashboard/shifts?error=このスタッフは希望休です（NG日）");
  }

  const { error } = await supabase.from("project_shifts").insert({
    project_id: projectId,
    staff_id: staffId,
    scheduled_start_at: startIso,
    scheduled_end_at: endIso,
    role,
    status: "assigned",
  });
  if (error) {
    redirect(`/dashboard/shifts?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/dashboard/shifts");
  revalidatePath("/dashboard/attendance");
  revalidatePath("/dashboard");
  redirect("/dashboard/shifts?created=1");
}

export async function sendShiftReminderAction(formData: FormData) {
  const supabase = await createClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile || !isAppManagerRole(profile.role)) {
    redirect("/dashboard/shifts?error=権限がありません");
  }
  const shiftId = String(formData.get("shift_id") ?? "").trim();
  if (!shiftId) redirect("/dashboard/shifts?error=invalid");
  await supabase
    .from("project_shifts")
    .update({ reminder_sent_at: new Date().toISOString() })
    .eq("id", shiftId);
  revalidatePath("/dashboard/shifts");
  redirect("/dashboard/shifts?reminded=1");
}

export async function publishDraftShiftsAction(formData: FormData) {
  const supabase = await createClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile || !isAppManagerRole(profile.role)) {
    redirect("/dashboard/shifts?error=権限がありません");
  }
  const startDate = String(formData.get("start_date") ?? "").trim();
  const endDate = String(formData.get("end_date") ?? "").trim();
  if (!startDate || !endDate) {
    redirect("/dashboard/shifts?error=期間を指定してください");
  }
  const startIso = parseJstDateTimeToIso(startDate, "00:00");
  const endIso = parseJstDateTimeToIso(endDate, "23:59");
  if (!startIso || !endIso) {
    redirect("/dashboard/shifts?error=日付が不正です");
  }
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("project_shifts")
    .update({
      publish_status: "published",
      published_at: now,
      notified_at: now,
      staff_response_status: "unread",
    })
    .eq("publish_status", "draft")
    .gte("scheduled_start_at", startIso)
    .lte("scheduled_start_at", endIso);
  if (error) {
    redirect(`/dashboard/shifts?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath("/dashboard/shifts");
  revalidatePath("/dashboard/attendance");
  redirect("/dashboard/shifts?published=1");
}

export async function sendLineShiftBroadcastAction(formData: FormData) {
  const supabase = await createClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile || !isAppManagerRole(profile.role)) {
    redirect("/dashboard/shifts?error=権限がありません");
  }
  if (!isLineConfigured()) {
    redirect("/dashboard/shifts?error=LINE設定が未完了です");
  }

  const startDate = String(formData.get("start_date") ?? "").trim();
  const endDate = String(formData.get("end_date") ?? "").trim();
  const startIso = parseJstDateTimeToIso(startDate, "00:00");
  const endIso = parseJstDateTimeToIso(endDate, "23:59");
  if (!startIso || !endIso) {
    redirect("/dashboard/shifts?error=期間を指定してください");
  }

  const { data: shifts } = await supabase
    .from("project_shifts")
    .select(
      `
      id, staff_id, scheduled_start_at, scheduled_end_at, role,
      projects ( title )
    `
    )
    .gte("scheduled_start_at", startIso)
    .lte("scheduled_start_at", endIso)
    .neq("status", "cancelled")
    .eq("publish_status", "published");

  const rows = (shifts ?? []) as {
    id: string;
    staff_id: string;
    scheduled_start_at: string;
    scheduled_end_at: string;
    role: "leader" | "helper";
    projects: { title?: string }[] | null;
  }[];

  if (rows.length === 0) {
    redirect("/dashboard/shifts?error=送信対象シフトがありません");
  }

  const staffIds = [...new Set(rows.map((r) => r.staff_id))];
  const { data: links } = await supabase
    .from("line_user_links")
    .select("staff_id, line_user_id")
    .in("staff_id", staffIds);
  const lineByStaff = new Map((links ?? []).map((l) => [l.staff_id, l.line_user_id]));

  let sent = 0;
  for (const row of rows) {
    const lineUserId = lineByStaff.get(row.staff_id);
    if (!lineUserId) continue;
    const projectTitle = row.projects?.[0]?.title ?? "案件未設定";
    const msg = [
      "【シフト通知】",
      `案件: ${projectTitle}`,
      `日時: ${new Date(row.scheduled_start_at).toLocaleString("ja-JP", {
        timeZone: "Asia/Tokyo",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })} - ${new Date(row.scheduled_end_at).toLocaleTimeString("ja-JP", {
        timeZone: "Asia/Tokyo",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })}`,
      `役割: ${row.role === "leader" ? "リーダー" : "ヘルパー"}`,
      "希望休は「希望休 YYYY-MM-DD 理由」で送信できます。",
    ].join("\n");

    const result = await pushLineMessages([lineUserId], [{ type: "text", text: msg }]);
    await supabase.from("line_shift_notifications").insert({
      tenant_id: profile.tenant_id,
      shift_id: row.id,
      staff_id: row.staff_id,
      line_user_id: lineUserId,
      notification_type: "shift_publish",
      message: msg,
      status: result.ok ? "sent" : "error",
      provider_message_id: result.ok ? "line_multicast" : null,
    });
    if (result.ok) sent += 1;
  }

  revalidatePath("/dashboard/shifts");
  redirect(`/dashboard/shifts?line_sent=${sent}`);
}

export async function syncShiftsToGoogleCalendarAction(formData: FormData) {
  const supabase = await createClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile || !isAppManagerRole(profile.role)) {
    redirect("/dashboard/shifts?error=権限がありません");
  }
  if (!isGoogleSheetsApiConfigured()) {
    redirect("/dashboard/shifts?error=Google OAuth クライアントが未設定です");
  }

  const startDate = String(formData.get("start_date") ?? "").trim();
  const endDate = String(formData.get("end_date") ?? "").trim();
  const startIso = parseJstDateTimeToIso(startDate, "00:00");
  const endIso = parseJstDateTimeToIso(endDate, "23:59");
  if (!startIso || !endIso) {
    redirect("/dashboard/shifts?error=同期期間が不正です");
  }

  const { data: token, error: tokenErr } = await supabase.rpc(
    "get_google_refresh_token_for_export"
  );
  if (tokenErr || !token) {
    redirect("/dashboard/shifts?error=Google連携トークンが見つかりません");
  }
  const refreshToken = String(token);

  const { data: shifts } = await supabase
    .from("project_shifts")
    .select(
      `
      id,
      role,
      scheduled_start_at,
      scheduled_end_at,
      projects ( title, site_address ),
      staff ( name )
    `
    )
    .gte("scheduled_start_at", startIso)
    .lte("scheduled_start_at", endIso)
    .neq("status", "cancelled");

  const rows = (shifts ?? []) as unknown as {
    id: string;
    role: "leader" | "helper";
    scheduled_start_at: string;
    scheduled_end_at: string;
    projects: { title: string; site_address: string | null }[] | null;
    staff: { name: string }[] | null;
  }[];

  const oauth2 = getOAuth2WithRefreshToken(refreshToken);
  const { created, updated } = await upsertShiftEventsToGoogleCalendar(
    oauth2,
    rows.map((r) => ({
      shiftId: r.id,
      projectTitle: r.projects?.[0]?.title ?? "案件未設定",
      staffName: r.staff?.[0]?.name ?? "スタッフ未設定",
      role: r.role,
      startAtIso: r.scheduled_start_at,
      endAtIso: r.scheduled_end_at,
      siteAddress: r.projects?.[0]?.site_address ?? null,
    }))
  );

  redirect(
    `/dashboard/shifts?synced=1&gcal_created=${created}&gcal_updated=${updated}`
  );
}

export async function bulkGenerateShiftsAction(formData: FormData) {
  const supabase = await createClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile || !isAppManagerRole(profile.role)) {
    redirect("/dashboard/shifts?error=権限がありません");
  }

  const projectIds = formData.getAll("project_ids").map(String).filter(Boolean);
  const staffIds = formData.getAll("staff_ids").map(String).filter(Boolean);
  const startDate = String(formData.get("start_date") ?? "").trim();
  const endDate = String(formData.get("end_date") ?? "").trim();
  const startTime = String(formData.get("start_time") ?? "10:00");
  const endTime = String(formData.get("end_time") ?? "18:00");
  const leaderSlots = Math.max(0, Number(formData.get("leader_slots") ?? 1));
  const helperSlots = Math.max(0, Number(formData.get("helper_slots") ?? 2));
  const weekdays = new Set(
    formData.getAll("weekdays").map((x) => Number(x)).filter((n) => Number.isInteger(n))
  );
  if (!startDate || !endDate || projectIds.length === 0 || staffIds.length === 0) {
    redirect("/dashboard/shifts?error=案件・スタッフ・期間は必須です");
  }
  if (leaderSlots + helperSlots <= 0) {
    redirect("/dashboard/shifts?error=必要人数を設定してください");
  }
  if (weekdays.size === 0) {
    redirect("/dashboard/shifts?error=繰り返し曜日を1つ以上選択してください");
  }

  const start = new Date(`${startDate}T00:00:00+09:00`);
  const end = new Date(`${endDate}T00:00:00+09:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    redirect("/dashboard/shifts?error=期間が不正です");
  }

  const projectRes = await supabase
    .from("projects")
    .select("id, store_id")
    .in("id", projectIds);
  const projects = (projectRes.data ?? []) as { id: string; store_id: string | null }[];
  const projectStoreMap = new Map(projects.map((p) => [p.id, p.store_id]));

  const ngDayRes = await supabase
    .from("staff_unavailable_dates")
    .select("staff_id, unavailable_date")
    .in("staff_id", staffIds)
    .gte("unavailable_date", startDate)
    .lte("unavailable_date", endDate);
  const ngDays = new Set((ngDayRes.data ?? []).map((r) => `${r.staff_id}:${r.unavailable_date}`));

  const ngStoreRes = await supabase
    .from("staff_ng_stores")
    .select("staff_id, store_id")
    .in("staff_id", staffIds);
  const ngStores = new Set((ngStoreRes.data ?? []).map((r) => `${r.staff_id}:${r.store_id}`));

  const lookBackStart = new Date(start.getTime() - 8 * 24 * 60 * 60 * 1000);
  const lookAheadEnd = new Date(end.getTime() + 2 * 24 * 60 * 60 * 1000);
  const existingRes = await supabase
    .from("project_shifts")
    .select("id, staff_id, scheduled_start_at, scheduled_end_at")
    .in("staff_id", staffIds)
    .gte("scheduled_start_at", lookBackStart.toISOString())
    .lte("scheduled_start_at", lookAheadEnd.toISOString())
    .neq("status", "cancelled");
  const existingByStaff = new Map<
    string,
    { start: string; end: string; jstDate: string }[]
  >();
  for (const row of (existingRes.data ?? []) as {
    staff_id: string;
    scheduled_start_at: string;
    scheduled_end_at: string;
  }[]) {
    const arr = existingByStaff.get(row.staff_id) ?? [];
    arr.push({
      start: row.scheduled_start_at,
      end: row.scheduled_end_at,
      jstDate: jstDate(row.scheduled_start_at),
    });
    existingByStaff.set(row.staff_id, arr);
  }

  const plannedByStaff = new Map<string, { start: string; end: string; jstDate: string }[]>();
  const inserts: {
    project_id: string;
    staff_id: string;
    scheduled_start_at: string;
    scheduled_end_at: string;
    role: "leader" | "helper";
    status: "assigned";
    publish_status: "draft";
    staff_response_status: "unread";
  }[] = [];
  const reasons = new Map<string, number>();
  const addReason = (r: string) => reasons.set(r, (reasons.get(r) ?? 0) + 1);

  let staffCursor = 0;
  for (
    let d = new Date(start.getTime());
    d <= end;
    d = new Date(d.getTime() + 24 * 60 * 60 * 1000)
  ) {
    const day = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
    }).formatToParts(d);
    const yyyy = day.find((p) => p.type === "year")?.value ?? "";
    const mm = day.find((p) => p.type === "month")?.value ?? "";
    const dd = day.find((p) => p.type === "day")?.value ?? "";
    const dayStr = `${yyyy}-${mm}-${dd}`;
    const wd = new Date(`${dayStr}T00:00:00+09:00`).getUTCDay();
    if (weekdays.size > 0 && !weekdays.has(wd)) continue;

    for (const projectId of projectIds) {
      const startIso = parseJstDateTimeToIso(dayStr, startTime);
      const endIso = parseJstDateTimeToIso(dayStr, endTime);
      if (!startIso || !endIso) continue;
      const slots: ("leader" | "helper")[] = [
        ...Array.from({ length: leaderSlots }, () => "leader" as const),
        ...Array.from({ length: helperSlots }, () => "helper" as const),
      ];

      for (const role of slots) {
        let assigned = false;
        for (let i = 0; i < staffIds.length; i++) {
          const idx = (staffCursor + i) % staffIds.length;
          const staffId = staffIds[idx];
          const storeId = projectStoreMap.get(projectId);

          if (ngDays.has(`${staffId}:${dayStr}`)) {
            addReason("希望休");
            continue;
          }
          if (storeId && ngStores.has(`${staffId}:${storeId}`)) {
            addReason("NG店舗");
            continue;
          }

          const ex = existingByStaff.get(staffId) ?? [];
          const pl = plannedByStaff.get(staffId) ?? [];
          const all = [...ex, ...pl].sort((a, b) => a.start.localeCompare(b.start));
          if (all.some((x) => overlaps(x.start, x.end, startIso, endIso))) {
            addReason("ダブルブッキング");
            continue;
          }

          const prev = [...all].reverse().find((x) => new Date(x.end) <= new Date(startIso));
          if (prev && restHours(prev.end, startIso) < 12) {
            addReason("休息12h不足");
            continue;
          }
          const next = all.find((x) => new Date(x.start) >= new Date(endIso));
          if (next && restHours(endIso, next.start) < 12) {
            addReason("休息12h不足");
            continue;
          }

          const dates = new Set(all.map((x) => x.jstDate));
          dates.add(dayStr);
          const ordered = [...dates].sort();
          let streak = 1;
          let maxStreak = 1;
          for (let j = 1; j < ordered.length; j++) {
            const prevDay = new Date(`${ordered[j - 1]}T00:00:00+09:00`).getTime();
            const currDay = new Date(`${ordered[j]}T00:00:00+09:00`).getTime();
            if (currDay - prevDay === 24 * 60 * 60 * 1000) {
              streak++;
            } else {
              streak = 1;
            }
            maxStreak = Math.max(maxStreak, streak);
          }
          if (maxStreak > 6) {
            addReason("連勤上限超過");
            continue;
          }

          inserts.push({
            project_id: projectId,
            staff_id: staffId,
            scheduled_start_at: startIso,
            scheduled_end_at: endIso,
            role,
            status: "assigned",
            publish_status: "draft",
            staff_response_status: "unread",
          });
          const arr = plannedByStaff.get(staffId) ?? [];
          arr.push({ start: startIso, end: endIso, jstDate: dayStr });
          plannedByStaff.set(staffId, arr);
          staffCursor = idx + 1;
          assigned = true;
          break;
        }
        if (!assigned) addReason("空きスタッフ不足");
      }
    }
  }

  if (inserts.length > 0) {
    const { error } = await supabase.from("project_shifts").insert(inserts);
    if (error) {
      redirect(`/dashboard/shifts?error=${encodeURIComponent(error.message)}`);
    }
  }

  const reasonText = [...reasons.entries()]
    .slice(0, 4)
    .map(([k, v]) => `${k}:${v}`)
    .join(", ");
  revalidatePath("/dashboard/shifts");
  revalidatePath("/dashboard/attendance");
  revalidatePath("/dashboard");
  redirect(
    `/dashboard/shifts?generated=${inserts.length}&skipped=${Math.max(0, reasons.size)}${
      reasonText ? `&warn=${encodeURIComponent(reasonText)}` : ""
    }`
  );
}

export async function confirmOwnShiftAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    redirect("/dashboard/attendance?error=ログインしてください");
  }
  const shiftId = String(formData.get("shift_id") ?? "").trim();
  if (!shiftId) {
    redirect("/dashboard/attendance?error=invalid");
  }
  const email = user.email.trim().toLowerCase();
  const { data: staff } = await supabase
    .from("staff")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (!staff) {
    redirect("/dashboard/attendance?error=名簿に未登録です");
  }
  await supabase
    .from("project_shifts")
    .update({
      staff_confirmed_at: new Date().toISOString(),
      staff_response_status: "accepted",
    })
    .eq("id", shiftId)
    .eq("staff_id", staff.id);
  revalidatePath("/dashboard/attendance");
  revalidatePath("/dashboard/shifts");
  redirect("/dashboard/attendance?confirmed=1");
}

export async function saveUnavailableDateAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    redirect("/dashboard/attendance?error=ログインしてください");
  }
  const email = user.email.trim().toLowerCase();
  const { data: staff } = await supabase
    .from("staff")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (!staff) {
    redirect("/dashboard/attendance?error=名簿に未登録です");
  }

  const unavailableDate = String(formData.get("unavailable_date") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim() || null;
  if (!unavailableDate) {
    redirect("/dashboard/attendance?error=日付を選択してください");
  }
  const { error } = await supabase.from("staff_unavailable_dates").upsert(
    {
      staff_id: staff.id,
      unavailable_date: unavailableDate,
      reason,
    },
    { onConflict: "staff_id,unavailable_date" }
  );
  if (error) {
    redirect(`/dashboard/attendance?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath("/dashboard/attendance");
  revalidatePath("/dashboard/shifts");
  redirect("/dashboard/attendance?off_saved=1");
}

export async function deleteUnavailableDateAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    redirect("/dashboard/attendance?error=ログインしてください");
  }
  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirect("/dashboard/attendance?error=invalid");
  await supabase.from("staff_unavailable_dates").delete().eq("id", id);
  revalidatePath("/dashboard/attendance");
  revalidatePath("/dashboard/shifts");
  redirect("/dashboard/attendance?off_deleted=1");
}
