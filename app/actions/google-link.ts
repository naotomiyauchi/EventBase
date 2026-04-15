"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isAppManagerRole } from "@/lib/app-role";
import { getCurrentProfile } from "@/lib/auth-profile";
import { createClient } from "@/lib/supabase/server";

type SendGoogleLinkMailArgs = {
  staffId: string;
  tenantId: string;
  staffName?: string | null;
  staffEmail: string;
};

export async function createGoogleLinkNotification({
  staffId,
  tenantId,
  staffName,
  staffEmail,
}: SendGoogleLinkMailArgs): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!staffId || !tenantId || !staffEmail?.trim()) {
    return { ok: false, reason: "staff_not_found_or_email_missing" };
  }
  const supabase = await createClient();
  const actionUrl = "/dashboard/account?connect_google=1";
  const staffBody = [
    "管理者がGoogle連携を依頼しました。Google連携のご案内",
    "Google連携はこちらから実行してください。スタッフ名簿に登録済みのメールアドレスと同じ Google アカウントをご利用ください。",
  ].join("\n");
  try {
    const { error } = await supabase.from("app_notifications").insert([
      {
        tenant_id: tenantId,
        type: "google_link_guide_manager",
        title: `${staffName ?? "スタッフ"}さんへGoogle連携の通知を送信しました。`,
        body: null,
        metadata: {
          target_staff_id: staffId,
          target_email: staffEmail.toLowerCase(),
          staff_name: staffName ?? null,
        },
      },
      {
        tenant_id: tenantId,
        type: "google_link_guide",
        title: "Google連携のご案内",
        body: staffBody,
        metadata: {
          target_staff_id: staffId,
          target_email: staffEmail.toLowerCase(),
          action_url: actionUrl,
          action_label: "こちら",
          staff_name: staffName ?? null,
        },
      },
    ]);
    if (error) return { ok: false, reason: error.message };
  } catch (e) {
    const detail =
      e instanceof Error ? e.message : typeof e === "string" ? e : "unknown";
    return { ok: false, reason: `notification_create_failed:${detail}` };
  }

  return { ok: true };
}

export async function sendGoogleLinkMailAction(formData: FormData) {
  const supabase = await createClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile || !isAppManagerRole(profile.role)) {
    redirect("/dashboard/settings/google?error=forbidden");
  }

  const staffId = String(formData.get("staff_id") ?? "").trim();
  if (!staffId) {
    redirect("/dashboard/settings/google?error=staff_required");
  }

  const { data: staff, error: staffErr } = await supabase
    .from("staff")
    .select("id, tenant_id, name, email")
    .eq("id", staffId)
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();
  if (staffErr || !staff?.id || !staff.email) {
    redirect("/dashboard/settings/google?error=staff_not_found_or_email_missing");
  }

  const result = await createGoogleLinkNotification({
    staffId: staff.id,
    tenantId: staff.tenant_id,
    staffName: staff.name,
    staffEmail: staff.email,
  });
  if (!result.ok) {
    redirect(`/dashboard/settings/google?error=${encodeURIComponent(result.reason)}`);
  }

  revalidatePath("/dashboard/settings/google");
  revalidatePath("/dashboard/notifications");
  redirect("/dashboard/settings/google?google_notice_sent=1");
}
