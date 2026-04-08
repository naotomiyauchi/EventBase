"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export async function createAgency(formData: FormData) {
  if (!isSupabaseConfigured()) {
    redirect("/dashboard/masters?error=not_configured");
  }
  const carrier_id = String(formData.get("carrier_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!carrier_id || !name) {
    redirect("/dashboard/masters?error=required");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("agencies").insert({ carrier_id, name });

  if (error) {
    redirect(`/dashboard/masters?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/dashboard/masters");
  revalidatePath("/dashboard/stores");
  redirect("/dashboard/masters?created=agency");
}
