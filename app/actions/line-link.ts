"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth-profile";
import { isAppManagerRole } from "@/lib/app-role";

function generateSixDigitCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function sendLineLinkCodeAction(formData: FormData) {
  const supabase = await createClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile || !isAppManagerRole(profile.role)) {
    redirect("/dashboard/settings/line?error=forbidden");
  }

  const staffId = String(formData.get("staff_id") ?? "").trim();
  if (!staffId) {
    redirect("/dashboard/settings/line?error=staff_required");
  }

  const { data: staff, error: staffErr } = await supabase
    .from("staff")
    .select("id, tenant_id, name, email")
    .eq("id", staffId)
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();
  if (staffErr || !staff?.id || !staff.email) {
    redirect("/dashboard/settings/line?error=staff_not_found_or_email_missing");
  }

  const code = generateSixDigitCode();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const { error: insErr } = await supabase.from("line_link_codes").insert({
    tenant_id: staff.tenant_id,
    staff_id: staff.id,
    email: staff.email,
    code,
    expires_at: expiresAt,
    created_by: profile.id,
  });
  if (insErr) {
    redirect(`/dashboard/settings/line?error=${encodeURIComponent(insErr.message)}`);
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.LINE_LINK_MAIL_FROM || process.env.BILLING_MAIL_FROM;
  if (!apiKey || !from) {
    redirect("/dashboard/settings/line?error=resend_not_configured");
  }

  const subject = "【EventBase】LINE連携コード";
  const body = [
    `${staff.name ?? "スタッフ"} 様`,
    "",
    "LINE連携コードを発行しました。",
    "このコードを公式LINEへ送信してください。",
    "",
    `連携 ${code}`,
    "",
    "有効期限: 30分",
  ].join("\n");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [staff.email],
      subject,
      text: body,
    }),
  });
  if (!response.ok) {
    redirect("/dashboard/settings/line?error=mail_send_failed");
  }

  revalidatePath("/dashboard/settings/line");
  redirect("/dashboard/settings/line?code_sent=1");
}
