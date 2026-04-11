import type { CSSProperties } from "react";

/**
 * テナントごとの白ラベル設定（public.tenants.branding JSON）
 * 既存デプロイはすべて空オブジェクト → 従来の EventBase 見た目のまま。
 */
export type TenantBranding = {
  /** 公開 URL または / から始まるパス（例: https://cdn.example.com/logo.png） */
  logoUrl?: string;
  /** Tailwind / shadcn の primary 用 HSL 3値（例: "221 83% 53%"） */
  primaryHsl?: string;
  /** ログインカード横のキャッチ（未設定時はデフォルト文言） */
  loginTagline?: string;
  /** プロダクト表示名（メタデータは別途将来対応可） */
  productName?: string;
};

export type TenantResolvePayload = {
  id: string;
  name: string;
  slug: string;
  branding: TenantBranding;
};

export function parseTenantBranding(raw: unknown): TenantBranding {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const logoUrl = typeof o.logoUrl === "string" ? o.logoUrl : undefined;
  const primaryHsl = typeof o.primaryHsl === "string" ? o.primaryHsl : undefined;
  const loginTagline = typeof o.loginTagline === "string" ? o.loginTagline : undefined;
  const productName = typeof o.productName === "string" ? o.productName : undefined;
  return { logoUrl, primaryHsl, loginTagline, productName };
}

/** ラッパーに付与して子の `bg-primary` / `text-primary` をテナント色に寄せる */
export function tenantPrimaryCssVars(branding: TenantBranding): CSSProperties {
  if (!branding.primaryHsl?.trim()) return {};
  return {
    ["--primary" as string]: branding.primaryHsl.trim(),
  };
}

export function parseTenantResolvePayload(raw: unknown): TenantResolvePayload | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id : null;
  const name = typeof o.name === "string" ? o.name : "";
  const slug = typeof o.slug === "string" ? o.slug : "";
  if (!id) return null;
  return {
    id,
    name,
    slug,
    branding: parseTenantBranding(o.branding),
  };
}
