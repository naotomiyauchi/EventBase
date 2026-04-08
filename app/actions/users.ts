"use server";

import { revalidatePath } from "next/cache";
import type { AppRole } from "@/lib/app-role";
import { getCurrentProfile } from "@/lib/auth-profile";
import { createServiceRoleClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function parseRole(v: FormDataEntryValue | null): AppRole | null {
  const s = String(v ?? "").trim();
  if (s === "admin" || s === "team_leader" || s === "staff") return s;
  return null;
}

export async function updateUserRoleAction(formData: FormData) {
  const supabase = await createClient();
  const actor = await getCurrentProfile(supabase);
  if (!actor || actor.role !== "admin") {
    return { ok: false as const, error: "管理者のみが権限を変更できます" };
  }

  if (!isServiceRoleConfigured()) {
    return {
      ok: false as const,
      error: "SUPABASE_SERVICE_ROLE_KEY が未設定です",
    };
  }

  const targetId = String(formData.get("user_id") ?? "").trim();
  const role = parseRole(formData.get("role"));
  if (!targetId || !role) {
    return { ok: false as const, error: "入力が不正です" };
  }

  if (targetId === actor.id && role !== "admin") {
    return { ok: false as const, error: "自分自身を管理者以外にできません" };
  }

  const admin = createServiceRoleClient();
  const { error: upErr } = await admin
    .from("profiles")
    .update({ role })
    .eq("id", targetId);

  if (upErr) {
    return { ok: false as const, error: upErr.message };
  }

  revalidatePath("/dashboard/settings/users");
  return { ok: true as const };
}
