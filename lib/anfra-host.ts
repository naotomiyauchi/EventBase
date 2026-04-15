import { headers } from "next/headers";

/** 合同会社 Anfra（当社）のホスト — 黒ベースのシェルに切り替える */
const ANFRA_HOSTNAMES = new Set([
  "anfra.jp",
  "www.anfra.jp",
  "event-base-chi.vercel.app",
  "localhost",
  "127.0.0.1",
]);

/** white logo を表示したいホスト */
const WHITE_LOGO_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "www.anfra.jp",
  "event-base-chi.vercel.app",
  "event-base-naotomiyauchis-projects.vercel.app",
]);

export function normalizeHostname(raw: string): string {
  const first = raw.split(",")[0]?.trim() ?? "";
  return first.split(":")[0]?.toLowerCase() ?? "";
}

export function isAnfraHostname(hostname: string): boolean {
  return ANFRA_HOSTNAMES.has(normalizeHostname(hostname));
}

export function isWhiteLogoHostname(hostname: string): boolean {
  return WHITE_LOGO_HOSTNAMES.has(normalizeHostname(hostname));
}

export async function isAnfraHost(): Promise<boolean> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  return isAnfraHostname(host);
}

export async function isWhiteLogoHost(): Promise<boolean> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  return isWhiteLogoHostname(host);
}
