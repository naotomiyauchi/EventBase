"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth-profile";
import { isAppManagerRole } from "@/lib/app-role";

export async function markNotificationReadAction(formData: FormData) {
  const supabase = await createClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile || !isAppManagerRole(profile.role)) {
    redirect("/dashboard?error=forbidden");
  }
  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirect("/dashboard/notifications?error=invalid");

  const { error } = await supabase
    .from("app_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    redirect(`/dashboard/notifications?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/dashboard/notifications");
  revalidatePath("/dashboard");
  redirect("/dashboard/notifications?read=1");
}

export async function markAllNotificationsReadAction() {
  const supabase = await createClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile || !isAppManagerRole(profile.role)) {
    redirect("/dashboard?error=forbidden");
  }
  const { error } = await supabase
    .from("app_notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);
  if (error) {
    redirect(`/dashboard/notifications?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/dashboard/notifications");
  revalidatePath("/dashboard");
  redirect("/dashboard/notifications?read_all=1");
}
