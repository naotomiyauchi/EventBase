import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * テナント単位の機能フラグ（tenant_feature_flags）
 * 未設定のキーは defaultValue を返す（既存挙動を変えない）。
 */
export async function getTenantFeatureFlag(
  supabase: SupabaseClient,
  tenantId: string,
  key: string,
  defaultValue = true
): Promise<boolean> {
  const { data, error } = await supabase
    .from("tenant_feature_flags")
    .select("value")
    .eq("tenant_id", tenantId)
    .eq("flag_key", key)
    .maybeSingle();

  if (error || !data?.value) return defaultValue;
  const v = data.value as unknown;
  if (typeof v === "boolean") return v;
  if (v && typeof v === "object" && "enabled" in (v as object)) {
    const e = (v as { enabled?: unknown }).enabled;
    if (typeof e === "boolean") return e;
  }
  if (v === "true" || v === true) return true;
  if (v === "false" || v === false) return false;
  return defaultValue;
}
