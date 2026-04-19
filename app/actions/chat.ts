"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth-profile";
import { createClient } from "@/lib/supabase/server";

const CHAT_PATH = "/dashboard/chat";

export async function sendChatMessageAction(formData: FormData) {
  const supabase = await createClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile) redirect(`/login?next=${encodeURIComponent(CHAT_PATH)}`);

  const body = String(formData.get("body") ?? "").trim();
  if (!body) {
    redirect(`${CHAT_PATH}?error=empty`);
  }

  const { error } = await supabase.from("tenant_chat_messages").insert({
    tenant_id: profile.tenant_id,
    author_id: profile.id,
    body,
  });

  if (error) {
    redirect(`${CHAT_PATH}?error=send`);
  }

  revalidatePath(CHAT_PATH);
}

export async function deleteChatMessageAction(formData: FormData) {
  const supabase = await createClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile) redirect(`/login?next=${encodeURIComponent(CHAT_PATH)}`);

  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirect(`${CHAT_PATH}?error=invalid`);

  const { error } = await supabase.from("tenant_chat_messages").delete().eq("id", id);

  if (error) {
    redirect(`${CHAT_PATH}?error=delete`);
  }

  revalidatePath(CHAT_PATH);
}
