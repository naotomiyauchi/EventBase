import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  parseTenantBranding,
  parseTenantResolvePayload,
  type TenantResolvePayload,
} from "@/lib/tenant-branding";

/** 現在の Host に紐づくテナント（ログイン画面・未認証向け） */
export async function resolveTenantForHost(
  supabase: SupabaseClient
): Promise<TenantResolvePayload | null> {
  const h = await headers();
  const rawHost =
    h.get("x-forwarded-host")?.split(",")[0]?.trim() ??
    h.get("host") ??
    "";
  const { data, error } = await supabase.rpc("resolve_tenant_by_hostname", {
    p_hostname: rawHost,
  });
  if (error || data == null) return null;
  return parseTenantResolvePayload(data);
}

/** ログイン済みユーザーのテナント（ダッシュボードのロゴ等） */
export async function resolveTenantForProfile(
  supabase: SupabaseClient,
  tenantId: string
): Promise<TenantResolvePayload | null> {
  const { data, error } = await supabase
    .from("tenants")
    .select("id, name, slug, branding")
    .eq("id", tenantId)
    .maybeSingle();
  if (error || !data?.id) return null;
  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    branding: parseTenantBranding(data.branding),
  };
}

/**
 * ダッシュボード用: アクセス中のホストに紐づくテナントを優先（カスタムドメイン白ラベル）。
 * デフォルトテナントのホスト（localhost 等）のときはプロフィールの tenant_id を使う。
 */
export async function resolveTenantForDashboard(
  supabase: SupabaseClient,
  profileTenantId: string | null | undefined
): Promise<{
  tenant: TenantResolvePayload | null;
  /** 機能フラグ取得用のテナント ID */
  tenantIdForFlags: string | null;
}> {
  const hostTenant = await resolveTenantForHost(supabase);
  if (hostTenant && hostTenant.slug !== "default") {
    return { tenant: hostTenant, tenantIdForFlags: hostTenant.id };
  }
  if (profileTenantId) {
    const tenant = await resolveTenantForProfile(supabase, profileTenantId);
    return {
      tenant,
      tenantIdForFlags: profileTenantId,
    };
  }
  return { tenant: null, tenantIdForFlags: null };
}
