"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

function resolveStoreRedirectBase(formData: FormData): "/dashboard/projects" | "/dashboard/masters" {
  const returnTo = String(formData.get("return_to") ?? "").trim();
  return returnTo === "masters" ? "/dashboard/masters" : "/dashboard/projects";
}

export async function createStore(formData: FormData) {
  const redirectBase = resolveStoreRedirectBase(formData);
  if (!isSupabaseConfigured()) {
    redirect(
      redirectBase === "/dashboard/masters"
        ? "/dashboard/masters?store_error=not_configured"
        : "/dashboard/projects?event_error=not_configured"
    );
  }
  const agency_id = String(formData.get("agency_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!agency_id || !name) {
    redirect(
      redirectBase === "/dashboard/masters"
        ? "/dashboard/masters?store_error=required"
        : "/dashboard/projects?event_error=required"
    );
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
    redirect(
      redirectBase === "/dashboard/masters"
        ? `/dashboard/masters?store_error=${encodeURIComponent(error.message)}`
        : `/dashboard/projects?event_error=${encodeURIComponent(error.message)}`
    );
  }

  revalidatePath("/dashboard/stores");
  revalidatePath("/dashboard/projects");
  revalidatePath("/dashboard/masters");
  redirect(
    redirectBase === "/dashboard/masters"
      ? "/dashboard/masters?store_created=1"
      : "/dashboard/projects?event_created=1"
  );
}

export async function updateStore(formData: FormData) {
  const redirectBase = resolveStoreRedirectBase(formData);
  if (!isSupabaseConfigured()) {
    redirect(
      redirectBase === "/dashboard/masters"
        ? "/dashboard/masters?store_error=not_configured"
        : "/dashboard/projects?event_error=not_configured"
    );
  }
  const id = String(formData.get("id") ?? "").trim();
  const agency_id = String(formData.get("agency_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !agency_id || !name) {
    redirect(
      redirectBase === "/dashboard/masters"
        ? "/dashboard/masters?store_error=required"
        : "/dashboard/projects?event_error=required"
    );
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
    redirect(
      redirectBase === "/dashboard/masters"
        ? `/dashboard/masters?store_error=${encodeURIComponent(error.message)}`
        : `/dashboard/projects?event_error=${encodeURIComponent(error.message)}`
    );
  }

  revalidatePath("/dashboard/stores");
  revalidatePath("/dashboard/projects");
  revalidatePath("/dashboard/masters");
  redirect(
    redirectBase === "/dashboard/masters"
      ? "/dashboard/masters?store_updated=1"
      : "/dashboard/projects?event_updated=1"
  );
}

export async function deleteStore(formData: FormData) {
  const redirectBase = resolveStoreRedirectBase(formData);
  if (!isSupabaseConfigured()) {
    redirect(
      redirectBase === "/dashboard/masters"
        ? "/dashboard/masters?store_error=not_configured"
        : "/dashboard/projects?event_error=not_configured"
    );
  }
  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    redirect(
      redirectBase === "/dashboard/masters"
        ? "/dashboard/masters?store_error=required"
        : "/dashboard/projects?event_error=required"
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.from("stores").delete().eq("id", id);

  if (error) {
    redirect(
      redirectBase === "/dashboard/masters"
        ? `/dashboard/masters?store_error=${encodeURIComponent(error.message)}`
        : `/dashboard/projects?event_error=${encodeURIComponent(error.message)}`
    );
  }

  revalidatePath("/dashboard/stores");
  revalidatePath("/dashboard/projects");
  revalidatePath("/dashboard/masters");
  redirect(
    redirectBase === "/dashboard/masters"
      ? "/dashboard/masters?store_deleted=1"
      : "/dashboard/projects?event_deleted=1"
  );
}
