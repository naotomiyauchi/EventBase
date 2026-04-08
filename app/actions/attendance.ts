"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const ATTENDANCE_PATH = "/dashboard/attendance";

async function getCurrentStaffIdOrRedirect() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    redirect(`${ATTENDANCE_PATH}?error=${encodeURIComponent("ログインしてください")}`);
  }
  const email = user.email.trim().toLowerCase();
  const { data: staff } = await supabase
    .from("staff")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (!staff?.id) {
    redirect(
      `${ATTENDANCE_PATH}?error=${encodeURIComponent("名簿に紐づくスタッフが見つかりません")}`
    );
  }
  return { supabase, staffId: staff.id };
}

function optNum(formData: FormData, key: string): number | null {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const r = 6371000;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return r * c;
}

export async function checkInShiftAction(formData: FormData) {
  const { supabase, staffId } = await getCurrentStaffIdOrRedirect();
  const shiftId = String(formData.get("shift_id") ?? "").trim();
  if (!shiftId) {
    redirect(`${ATTENDANCE_PATH}?error=${encodeURIComponent("シフトIDが不正です")}`);
  }

  const { data: shift } = await supabase
    .from("project_shifts")
    .select("id, staff_id, projects ( site_lat, site_lng )")
    .eq("id", shiftId)
    .maybeSingle();
  if (!shift || shift.staff_id !== staffId) {
    redirect(`${ATTENDANCE_PATH}?error=${encodeURIComponent("対象シフトが見つかりません")}`);
  }

  const checkinLat = optNum(formData, "checkin_lat");
  const checkinLng = optNum(formData, "checkin_lng");
  const site = (shift.projects as { site_lat: number | null; site_lng: number | null }[] | null)?.[0];
  if (site?.site_lat != null && site?.site_lng != null) {
    if (checkinLat == null || checkinLng == null) {
      redirect(`${ATTENDANCE_PATH}?error=${encodeURIComponent("位置情報が必要です。現場付近で再実行してください")}`);
    }
    const d = distanceMeters(checkinLat, checkinLng, Number(site.site_lat), Number(site.site_lng));
    if (d > 100) {
      redirect(`${ATTENDANCE_PATH}?error=${encodeURIComponent(`現場から離れています（約${Math.round(d)}m）。100m以内で打刻してください`)}`);
    }
  }
  const now = new Date().toISOString();

  await supabase
    .from("shift_attendance")
    .upsert(
      {
        shift_id: shiftId,
        checkin_at: now,
        checkin_lat: checkinLat,
        checkin_lng: checkinLng,
        status: "working",
      },
      { onConflict: "shift_id" }
    );

  await supabase
    .from("project_shifts")
    .update({ status: "confirmed", confirmed_at: now })
    .eq("id", shiftId)
    .eq("staff_id", staffId);

  revalidatePath(ATTENDANCE_PATH);
  revalidatePath("/dashboard");
  redirect(`${ATTENDANCE_PATH}?checked_in=1`);
}

export async function checkoutShiftWithReportAction(formData: FormData) {
  const { supabase, staffId } = await getCurrentStaffIdOrRedirect();
  const shiftId = String(formData.get("shift_id") ?? "").trim();
  if (!shiftId) {
    redirect(`${ATTENDANCE_PATH}?error=${encodeURIComponent("シフトIDが不正です")}`);
  }

  const { data: shift } = await supabase
    .from("project_shifts")
    .select("id, staff_id")
    .eq("id", shiftId)
    .maybeSingle();
  if (!shift || shift.staff_id !== staffId) {
    redirect(`${ATTENDANCE_PATH}?error=${encodeURIComponent("対象シフトが見つかりません")}`);
  }

  const checkoutLat = optNum(formData, "checkout_lat");
  const checkoutLng = optNum(formData, "checkout_lng");
  const mnpCount = Math.max(0, Math.trunc(optNum(formData, "mnp_count") ?? 0));
  const newCount = Math.max(0, Math.trunc(optNum(formData, "new_count") ?? 0));
  const optionCount = Math.max(0, Math.trunc(optNum(formData, "option_count") ?? 0));
  const memo = String(formData.get("memo") ?? "").trim() || null;
  const now = new Date().toISOString();

  await supabase
    .from("shift_attendance")
    .upsert(
      {
        shift_id: shiftId,
        checkout_at: now,
        checkout_lat: checkoutLat,
        checkout_lng: checkoutLng,
        status: "reported",
      },
      { onConflict: "shift_id" }
    );

  await supabase
    .from("shift_results")
    .upsert(
      {
        shift_id: shiftId,
        mnp_count: mnpCount,
        new_count: newCount,
        option_count: optionCount,
        memo,
      },
      { onConflict: "shift_id" }
    );

  const transport = Math.max(0, optNum(formData, "expense_transport") ?? 0);
  const parking = Math.max(0, optNum(formData, "expense_parking") ?? 0);
  const supplies = Math.max(0, optNum(formData, "expense_supplies") ?? 0);
  const other = Math.max(0, optNum(formData, "expense_other") ?? 0);
  const receiptUrl = String(formData.get("receipt_url") ?? "").trim();
  const expenseNote = String(formData.get("expense_note") ?? "").trim();
  const totalExpense = transport + parking + supplies + other;
  if (totalExpense > 0 && !receiptUrl) {
    redirect(`${ATTENDANCE_PATH}?error=${encodeURIComponent("経費入力時はレシートURLが必須です")}`);
  }

  await supabase.from("shift_expenses").delete().eq("shift_id", shiftId);
  const inserts = [
    transport > 0
      ? {
          shift_id: shiftId,
          expense_type: "transport",
          amount: transport,
          receipt_url: receiptUrl || null,
          note: expenseNote || null,
        }
      : null,
    parking > 0
      ? {
          shift_id: shiftId,
          expense_type: "parking",
          amount: parking,
          receipt_url: receiptUrl || null,
          note: expenseNote || null,
        }
      : null,
    supplies > 0
      ? {
          shift_id: shiftId,
          expense_type: "supplies",
          amount: supplies,
          receipt_url: receiptUrl || null,
          note: expenseNote || null,
        }
      : null,
    other > 0
      ? {
          shift_id: shiftId,
          expense_type: "other",
          amount: other,
          receipt_url: receiptUrl || null,
          note: expenseNote || null,
        }
      : null,
  ].filter(Boolean) as {
    shift_id: string;
    expense_type: "transport" | "parking" | "supplies" | "other";
    amount: number;
    receipt_url: string | null;
    note: string | null;
  }[];
  if (inserts.length > 0) {
    await supabase.from("shift_expenses").insert(inserts);
  }

  revalidatePath(ATTENDANCE_PATH);
  revalidatePath("/dashboard");
  redirect(`${ATTENDANCE_PATH}?reported=1`);
}
