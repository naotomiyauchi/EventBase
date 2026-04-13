"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth-profile";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export async function createAgency(formData: FormData) {
  if (!isSupabaseConfigured()) {
    redirect("/dashboard/masters?error=not_configured");
  }
  const carrier_id = String(formData.get("carrier_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const feeRateRaw = Number(String(formData.get("fee_rate") ?? "0"));
  const fee_rate = Number.isFinite(feeRateRaw) ? Math.max(0, feeRateRaw) : 0;
  if (!carrier_id || !name) {
    redirect("/dashboard/masters?error=required");
  }

  const supabase = await createClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile?.tenant_id) {
    redirect("/dashboard/masters?error=tenant");
  }

  const { error } = await supabase.from("agencies").insert({
    carrier_id,
    name,
    fee_rate,
    tenant_id: profile.tenant_id,
  });

  if (error) {
    redirect(`/dashboard/masters?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/dashboard/masters");
  revalidatePath("/dashboard/stores");
  redirect("/dashboard/masters?created=agency");
}
