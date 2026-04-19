"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isAppManagerRole } from "@/lib/app-role";
import { getCurrentProfile } from "@/lib/auth-profile";
import { createClient } from "@/lib/supabase/server";

function isoFromJstDateAndTime(dateStr: string, timeStr: string): string {
  const iso = `${dateStr}T${timeStr}:00+09:00`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new Error("invalid datetime");
  return d.toISOString();
}

export async function setShiftBoardCellAction(formData: FormData) {
  const supabase = await createClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile || !isAppManagerRole(profile.role)) {
    redirect("/dashboard?error=forbidden");
  }

  const shiftDate = String(formData.get("shift_date") ?? "").trim(); // YYYY-MM-DD
  const staffId = String(formData.get("staff_id") ?? "").trim();
  const projectId = String(formData.get("project_id") ?? "").trim();
  const roleRaw = String(formData.get("role") ?? "helper").trim();
  const role = roleRaw === "leader" ? "leader" : "helper";

  if (!shiftDate || !/^\d{4}-\d{2}-\d{2}$/.test(shiftDate) || !staffId) {
    return;
  }

  if (!projectId) {
    await supabase
      .from("project_shifts")
      .delete()
      .eq("staff_id", staffId)
      .eq("shift_date", shiftDate);
    revalidatePath("/dashboard/shift-board");
    revalidatePath("/dashboard/shifts/board");
    revalidatePath("/dashboard");
    return;
  }

  const startIso = isoFromJstDateAndTime(shiftDate, "10:00");
  const endIso = isoFromJstDateAndTime(shiftDate, "18:00");

  await supabase.from("project_shifts").upsert(
    {
      staff_id: staffId,
      project_id: projectId,
      role,
      status: "assigned",
      publish_status: "draft",
      staff_response_status: "unread",
      shift_date: shiftDate,
      scheduled_start_at: startIso,
      scheduled_end_at: endIso,
    },
    { onConflict: "staff_id,shift_date" }
  );

  revalidatePath("/dashboard/shift-board");
  revalidatePath("/dashboard/shifts/board");
  revalidatePath("/dashboard");
}

