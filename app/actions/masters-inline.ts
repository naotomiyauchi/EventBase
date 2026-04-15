"use server";

import { getCurrentProfile } from "@/lib/auth-profile";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

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

export async function createCarrierInline(input: {
  name: string;
}): Promise<ActionResult<{ id: string; name: string }>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  const name = input.name.trim();
  if (!name) return { ok: false, error: "required" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("carriers")
    .insert({ name, code: carrierCodeFromName(name) })
    .select("id, name")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "insert_failed" };
  return { ok: true, data };
}

export async function createAgencyInline(input: {
  name: string;
  carrier_ids: string[];
}): Promise<ActionResult<{ id: string; name: string; carrier_ids: string[] }>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  const name = input.name.trim();
  const carrierIds = input.carrier_ids.map((v) => v.trim()).filter(Boolean);
  if (!name || carrierIds.length === 0) return { ok: false, error: "required" };

  const supabase = await createClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile?.tenant_id) return { ok: false, error: "tenant" };

  const { data: agency, error } = await supabase
    .from("agencies")
    .insert({
      name,
      carrier_id: carrierIds[0],
      tenant_id: profile.tenant_id,
    })
    .select("id, name")
    .single();
  if (error || !agency) return { ok: false, error: error?.message ?? "insert_failed" };

  const { error: mapErr } = await supabase.from("agency_carriers").insert(
    carrierIds.map((carrier_id) => ({
      agency_id: agency.id,
      carrier_id,
      tenant_id: profile.tenant_id,
    }))
  );
  if (mapErr) {
    await supabase.from("agencies").delete().eq("id", agency.id);
    return { ok: false, error: mapErr.message };
  }

  return { ok: true, data: { id: agency.id, name: agency.name, carrier_ids: carrierIds } };
}

export async function createStoreInline(input: {
  agency_id: string;
  name: string;
  address?: string;
  access_notes?: string;
  contact_name?: string;
  contact_phone?: string;
  entry_rules?: string;
}): Promise<ActionResult<{ id: string; agency_id: string; name: string }>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  const agency_id = input.agency_id.trim();
  const name = input.name.trim();
  if (!agency_id || !name) return { ok: false, error: "required" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stores")
    .insert({
      agency_id,
      name,
      address: input.address?.trim() || null,
      access_notes: input.access_notes?.trim() || null,
      contact_name: input.contact_name?.trim() || null,
      contact_phone: input.contact_phone?.trim() || null,
      entry_rules: input.entry_rules?.trim() || null,
    })
    .select("id, agency_id, name")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "insert_failed" };
  return { ok: true, data };
}
