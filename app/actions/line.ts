"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth-profile";
import { isAppManagerRole } from "@/lib/app-role";
import { createClient } from "@/lib/supabase/server";
import { createDefaultRichMenu, isLineConfigured } from "@/lib/line-messaging";

export async function setupLineRichMenuAction() {
  const supabase = await createClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile || !isAppManagerRole(profile.role)) {
    redirect("/dashboard/settings/line?error=forbidden");
  }
  if (!isLineConfigured()) {
    redirect("/dashboard/settings/line?error=line_not_configured");
  }

  const result = await createDefaultRichMenu();
  if (!result.ok || !result.richMenuId) {
    redirect(`/dashboard/settings/line?error=${encodeURIComponent(result.error ?? "line_api_error")}`);
  }

  await supabase.from("tenant_plugin_configs").upsert(
    {
      tenant_id: profile.tenant_id,
      module_key: "line_config",
      config: {
        rich_menu_id: result.richMenuId,
        updated_at: new Date().toISOString(),
      },
    },
    { onConflict: "tenant_id,module_key" }
  );

  revalidatePath("/dashboard/settings/line");
  redirect("/dashboard/settings/line?richmenu=1");
}
