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

export async function createProject(formData: FormData) {
  if (!isSupabaseConfigured()) {
    redirect("/dashboard/projects?error=not_configured");
  }
  const title = String(formData.get("title") ?? "").trim();
  if (!title) {
    redirect("/dashboard/projects?error=title");
  }
  const storeRaw = String(formData.get("store_id") ?? "").trim();
  const store_id = storeRaw.length > 0 ? storeRaw : null;
  const status = String(formData.get("status") ?? "proposal") as ProjectStatus;
  const start_at = parseDate(formData.get("start_at"));
  const end_at = parseDate(formData.get("end_at"));
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .insert({
      title,
      store_id,
      status,
      start_at,
      end_at,
      notes,
    })
    .select("id")
    .single();

  if (error || !data) {
    redirect(`/dashboard/projects?error=${encodeURIComponent(error?.message ?? "insert")}`);
  }

  revalidatePath("/dashboard/projects");
  revalidatePath("/dashboard");
  redirect(`/dashboard/projects/${data.id}`);
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

export async function updateProjectNotes(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;
  if (!id) {
    redirect("/dashboard/projects?error=invalid");
  }
  if (!isSupabaseConfigured()) {
    redirect(`/dashboard/projects/${id}?error=not_configured`);
  }

  const supabase = await createClient();
  const { error } = await supabase.from("projects").update({ notes }).eq("id", id);

  if (error) {
    redirect(
      `/dashboard/projects/${id}?error=${encodeURIComponent(error.message)}`
    );
  }

  revalidatePath(`/dashboard/projects/${id}`);
  redirect(`/dashboard/projects/${id}?updated=notes`);
}
