"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { ProjectStatus } from "@/lib/types/database";

function parseDate(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function parseDateOnly(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function parseTimeOnly(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  return /^\d{2}:\d{2}$/.test(s) ? s : null;
}

function parseDateTimeFromDateAndTime(dateStr: string | null, timeStr: string | null): string | null {
  if (!dateStr || !timeStr) return null;
  const iso = `${dateStr}T${timeStr}:00+09:00`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function parseCompensationType(v: FormDataEntryValue | null): "daily" | "commission" | null {
  const s = String(v ?? "").trim();
  if (s === "daily" || s === "commission") return s;
  return null;
}

function parseAssignedStaffIds(formData: FormData): string[] {
  return formData
    .getAll("assigned_staff_ids")
    .map(String)
    .map((v) => v.trim())
    .filter((v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v));
}

function parseProjectForm(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const storeRaw = String(formData.get("store_id") ?? "").trim();
  const store_id = storeRaw.length > 0 ? storeRaw : null;
  const event_period_start = parseDateOnly(formData.get("event_period_start"));
  const event_period_end = parseDateOnly(formData.get("event_period_end"));
  const work_start_time = parseTimeOnly(formData.get("event_start_time"));
  const work_end_time = parseTimeOnly(formData.get("event_end_time"));

  return {
    title,
    store_id,
    assigned_staff_ids: parseAssignedStaffIds(formData),
    status: String(formData.get("status") ?? "proposal") as ProjectStatus,
    start_at: parseDateTimeFromDateAndTime(event_period_start, work_start_time),
    end_at: parseDateTimeFromDateAndTime(event_period_end ?? event_period_start, work_end_time),
    notes: String(formData.get("event_notes") ?? "").trim() || null,
    overview: String(formData.get("overview") ?? "").trim() || null,
    event_period_start,
    event_period_end,
    event_start_at: parseDateTimeFromDateAndTime(event_period_start, work_start_time),
    event_end_at: parseDateTimeFromDateAndTime(event_period_end ?? event_period_start, work_end_time),
    event_location: String(formData.get("event_location") ?? "").trim() || null,
    event_location_map_url:
      String(formData.get("event_location_map_url") ?? "").trim() || null,
    event_contact_name: String(formData.get("event_contact_name") ?? "").trim() || null,
    event_contact_phone: String(formData.get("event_contact_phone") ?? "").trim() || null,
    event_notes: String(formData.get("event_notes") ?? "").trim() || null,
    related_entities: String(formData.get("related_entities") ?? "").trim() || null,
    direct_supervisor_entity:
      String(formData.get("direct_supervisor_entity") ?? "").trim() || null,
    billing_target_entity:
      String(formData.get("billing_target_entity") ?? "").trim() || null,
    compensation_type: parseCompensationType(formData.get("compensation_type")),
    brokerage_rate: (() => {
      const raw = String(formData.get("brokerage_rate") ?? "").trim();
      if (!raw) return null;
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    })(),
    brokerage_notes: String(formData.get("brokerage_notes") ?? "").trim() || null,
  };
}

export async function createProject(formData: FormData) {
  if (!isSupabaseConfigured()) {
    redirect("/dashboard/projects?error=not_configured");
  }
  const payload = parseProjectForm(formData);
  const title = payload.title;
  if (!title) {
    redirect("/dashboard/projects?error=title");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .insert(payload)
    .select("id")
    .single();

  if (error || !data) {
    redirect(`/dashboard/projects?error=${encodeURIComponent(error?.message ?? "insert")}`);
  }

  revalidatePath("/dashboard/projects");
  revalidatePath("/dashboard");
  redirect("/dashboard/projects?created=1&tab=projects-list");
}

export async function updateProjectStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const status = String(formData.get("status") ?? "") as ProjectStatus;
  if (!id || !status) {
    redirect("/dashboard/projects?error=invalid");
  }
  if (!isSupabaseConfigured()) {
    redirect(`/dashboard/projects/${id}?error=not_configured`);
  }

  const supabase = await createClient();
  const { error } = await supabase.from("projects").update({ status }).eq("id", id);

  if (error) {
    redirect(
      `/dashboard/projects/${id}?error=${encodeURIComponent(error.message)}`
    );
  }

  revalidatePath(`/dashboard/projects/${id}`);
  revalidatePath("/dashboard/projects");
  revalidatePath("/dashboard");
  redirect(`/dashboard/projects/${id}?updated=status`);
}

export async function updateProject(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const payload = parseProjectForm(formData);
  if (!id) {
    redirect("/dashboard/projects?error=invalid");
  }
  if (!isSupabaseConfigured()) {
    redirect(`/dashboard/projects/${id}?error=not_configured`);
  }

  const supabase = await createClient();
  const { error } = await supabase.from("projects").update(payload).eq("id", id);

  if (error) {
    redirect(
      `/dashboard/projects/${id}?error=${encodeURIComponent(error.message)}`
    );
  }

  revalidatePath(`/dashboard/projects/${id}`);
  revalidatePath("/dashboard/projects");
  revalidatePath("/dashboard");
  redirect(`/dashboard/projects/${id}?updated=project`);
}

export async function deleteProject(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    redirect("/dashboard/projects?error=invalid");
  }
  if (!isSupabaseConfigured()) {
    redirect(`/dashboard/projects/${id}?error=not_configured`);
  }

  const supabase = await createClient();
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) {
    redirect(`/dashboard/projects/${id}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/dashboard/projects");
  revalidatePath("/dashboard");
  redirect("/dashboard/projects?deleted=1");
}
