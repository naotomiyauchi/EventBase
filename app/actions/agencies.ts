"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth-profile";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

function carrierCodeFromName(name: string): string {
  const base = name
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  const suffix = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");
  return `${base || "carrier"}-${suffix}`;
}

export async function createCarrier(formData: FormData) {
  if (!isSupabaseConfigured()) {
    redirect("/dashboard/masters?error=not_configured&error_target=carrier");
  }
  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    redirect("/dashboard/masters?error=required&error_target=carrier");
  }

  const supabase = await createClient();
  const code = carrierCodeFromName(name);
  const { error } = await supabase.from("carriers").insert({
    code,
    name,
  });
  if (error) {
    redirect(
      `/dashboard/masters?error=${encodeURIComponent(error.message)}&error_target=carrier`
    );
  }

  revalidatePath("/dashboard/masters");
  revalidatePath("/dashboard/stores");
  redirect("/dashboard/masters?created=carrier");
}

export async function createAgency(formData: FormData) {
  if (!isSupabaseConfigured()) {
    redirect("/dashboard/masters?error=not_configured&error_target=agency");
  }
  const carrierIds = formData
    .getAll("carrier_ids")
    .map((v) => String(v).trim())
    .filter(Boolean);
  const name = String(formData.get("name") ?? "").trim();
  if (carrierIds.length === 0 || !name) {
    redirect("/dashboard/masters?error=required&error_target=agency");
  }

  const supabase = await createClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile?.tenant_id) {
    redirect("/dashboard/masters?error=tenant&error_target=agency");
  }

  const primaryCarrierId = carrierIds[0];
  const { data: agency, error } = await supabase
    .from("agencies")
    .insert({
      carrier_id: primaryCarrierId,
      name,
      tenant_id: profile.tenant_id,
    })
    .select("id, tenant_id")
    .single();

  if (error || !agency) {
    redirect(
      `/dashboard/masters?error=${encodeURIComponent(error?.message ?? "insert_failed")}&error_target=agency`
    );
  }

  const { error: mapErr } = await supabase.from("agency_carriers").insert(
    carrierIds.map((carrier_id) => ({
      agency_id: agency.id,
      carrier_id,
      tenant_id: agency.tenant_id,
    }))
  );
  if (mapErr) {
    await supabase.from("agencies").delete().eq("id", agency.id);
    redirect(
      `/dashboard/masters?error=${encodeURIComponent(mapErr.message)}&error_target=agency`
    );
  }

  revalidatePath("/dashboard/masters");
  revalidatePath("/dashboard/stores");
  redirect("/dashboard/masters?created=agency");
}
