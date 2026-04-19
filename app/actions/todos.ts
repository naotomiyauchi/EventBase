"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth-profile";
import { createClient } from "@/lib/supabase/server";

const TODOS_PATH = "/dashboard/todos";

type Visibility = "private" | "public";

function parseVisibility(raw: string): Visibility | null {
  return raw === "private" || raw === "public" ? raw : null;
}

export async function createTodoAction(formData: FormData) {
  const supabase = await createClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile) redirect(`/login?next=${encodeURIComponent(TODOS_PATH)}`);

  const title = String(formData.get("title") ?? "").trim();
  const visibility = parseVisibility(String(formData.get("visibility") ?? "private"));
  const ownerIdRaw = String(formData.get("owner_id") ?? "").trim();
  const owner_id = ownerIdRaw || profile.id;

  if (!title || !visibility) {
    redirect(`${TODOS_PATH}?error=invalid`);
  }

  const { error } = await supabase.from("tenant_todos").insert({
    tenant_id: profile.tenant_id,
    owner_id,
    created_by: profile.id,
    title,
    visibility,
    done: false,
  });

  if (error) {
    redirect(`${TODOS_PATH}?error=create`);
  }

  revalidatePath(TODOS_PATH);
}

export async function toggleTodoAction(formData: FormData) {
  const supabase = await createClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile) redirect(`/login?next=${encodeURIComponent(TODOS_PATH)}`);

  const id = String(formData.get("id") ?? "").trim();
  const doneRaw = String(formData.get("done") ?? "");
  if (!id) redirect(`${TODOS_PATH}?error=invalid`);

  const done = doneRaw === "true" || doneRaw === "on";

  const { error } = await supabase.from("tenant_todos").update({ done }).eq("id", id);

  if (error) {
    redirect(`${TODOS_PATH}?error=update`);
  }

  revalidatePath(TODOS_PATH);
}

export async function deleteTodoAction(formData: FormData) {
  const supabase = await createClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile) redirect(`/login?next=${encodeURIComponent(TODOS_PATH)}`);

  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirect(`${TODOS_PATH}?error=invalid`);

  const { error } = await supabase.from("tenant_todos").delete().eq("id", id);

  if (error) {
    redirect(`${TODOS_PATH}?error=delete`);
  }

  revalidatePath(TODOS_PATH);
}
