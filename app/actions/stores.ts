"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export async function createStore(formData: FormData) {
  if (!isSupabaseConfigured()) {
    redirect("/dashboard/stores?error=not_configured");
  }
  const agency_id = String(formData.get("agency_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!agency_id || !name) {
    redirect("/dashboard/stores?error=required");
  }

  const address = String(formData.get("address") ?? "").trim() || null;
  const access_notes = String(formData.get("access_notes") ?? "").trim() || null;
  const contact_name = String(formData.get("contact_name") ?? "").trim() || null;
  const contact_phone = String(formData.get("contact_phone") ?? "").trim() || null;
  const entry_rules = String(formData.get("entry_rules") ?? "").trim() || null;

  const supabase = await createClient();
  const { error } = await supabase.from("stores").insert({
    agency_id,
    name,
    address,
    access_notes,
    contact_name,
    contact_phone,
    entry_rules,
  });

  if (error) {
    redirect(`/dashboard/stores?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/dashboard/stores");
  revalidatePath("/dashboard/projects");
  redirect("/dashboard/stores?created=1");
}

export async function updateStore(formData: FormData) {
  if (!isSupabaseConfigured()) {
    redirect("/dashboard/stores?error=not_configured");
  }
  const id = String(formData.get("id") ?? "").trim();
  const agency_id = String(formData.get("agency_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !agency_id || !name) {
    redirect("/dashboard/stores?error=required");
  }

  const address = String(formData.get("address") ?? "").trim() || null;
  const access_notes = String(formData.get("access_notes") ?? "").trim() || null;
  const contact_name = String(formData.get("contact_name") ?? "").trim() || null;
  const contact_phone = String(formData.get("contact_phone") ?? "").trim() || null;
  const entry_rules = String(formData.get("entry_rules") ?? "").trim() || null;

  const supabase = await createClient();
  const { error } = await supabase
    .from("stores")
    .update({
      agency_id,
      name,
      address,
      access_notes,
      contact_name,
      contact_phone,
      entry_rules,
    })
    .eq("id", id);

  if (error) {
    redirect(`/dashboard/stores?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/dashboard/stores");
  revalidatePath("/dashboard/projects");
  redirect("/dashboard/stores?updated=1");
}

export async function deleteStore(formData: FormData) {
  if (!isSupabaseConfigured()) {
    redirect("/dashboard/stores?error=not_configured");
  }
  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    redirect("/dashboard/stores?error=required");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("stores").delete().eq("id", id);

  if (error) {
    redirect(`/dashboard/stores?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/dashboard/stores");
  revalidatePath("/dashboard/projects");
  redirect("/dashboard/stores?deleted=1");
}
