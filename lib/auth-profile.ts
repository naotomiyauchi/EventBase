import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppRole } from "@/lib/app-role";

export type AuthProfile = {
  id: string;
  display_name: string | null;
  role: AppRole;
  tenant_id: string;
};

export async function getCurrentProfile(
  supabase: SupabaseClient
): Promise<AuthProfile | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, role, tenant_id")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data) return null;
  return {
    id: data.id,
    display_name: data.display_name,
    role: data.role as AppRole,
    tenant_id: data.tenant_id as string,
  };
}
