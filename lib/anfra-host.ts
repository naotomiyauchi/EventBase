import { headers } from "next/headers";

/** 合同会社 Anfra（当社）のホスト — 黒ベースのシェルに切り替える */
const ANFRA_HOSTNAMES = new Set([
  "anfra.jp",
  "www.anfra.jp",
  "event-base-chi.vercel.app",
  "localhost",
  "127.0.0.1",
]);

export function normalizeHostname(raw: string): string {
  const first = raw.split(",")[0]?.trim() ?? "";
  return first.split(":")[0]?.toLowerCase() ?? "";
}

export function isAnfraHostname(hostname: string): boolean {
  return ANFRA_HOSTNAMES.has(normalizeHostname(hostname));
}

export async function isAnfraHost(): Promise<boolean> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  return isAnfraHostname(host);
}
