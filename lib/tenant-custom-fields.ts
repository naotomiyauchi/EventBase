import type { SupabaseClient } from "@supabase/supabase-js";

export type TenantCustomFieldDefinition = {
  id: string;
  entity: string;
  field_key: string;
  label: string;
  data_type: string;
  sort_order: number;
  options: Record<string, unknown>;
};

/** テナントが定義した拡張項目（実績フォーム等で利用する前提） */
export async function listTenantCustomFieldDefinitions(
  supabase: SupabaseClient,
  tenantId: string,
  entity: string
): Promise<TenantCustomFieldDefinition[]> {
  const { data, error } = await supabase
    .from("tenant_custom_field_definitions")
    .select("id, entity, field_key, label, data_type, sort_order, options")
    .eq("tenant_id", tenantId)
    .eq("entity", entity)
    .order("sort_order", { ascending: true });

  if (error || !data) return [];
  return data.map((row) => ({
    ...row,
    options:
      row.options && typeof row.options === "object"
        ? (row.options as Record<string, unknown>)
        : {},
  }));
}
