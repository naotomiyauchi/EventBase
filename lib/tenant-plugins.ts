import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * テナント別の「プラグイン」設定（給与計算・手当などのパラメータを DB に逃がす）。
 * 実行ロジックはアプリ側で module_key に応じて分岐する想定（本体アップデートと独立させやすい）。
 */
export async function getTenantPluginConfig(
  supabase: SupabaseClient,
  tenantId: string,
  moduleKey: string
): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase
    .from("tenant_plugin_configs")
    .select("config")
    .eq("tenant_id", tenantId)
    .eq("module_key", moduleKey)
    .maybeSingle();

  if (error || !data?.config || typeof data.config !== "object") return null;
  return data.config as Record<string, unknown>;
}
