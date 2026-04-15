"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

type Props = {
  logoUrl?: string | null;
  width: number;
  height: number;
  className?: string;
  forceWhiteLogo?: boolean;
};

/** テナント固有 URL またはデフォルトの EventBase ロゴ */
export function TenantLogo({ logoUrl, width, height, className, forceWhiteLogo = false }: Props) {
  if (forceWhiteLogo) {
    return (
      <Image
        src="/logo-transparent_white.png"
        alt=""
        width={width}
        height={height}
        className={className}
        style={{ width: "auto", height: "auto" }}
      />
    );
  }

  const u = logoUrl?.trim();
  if (u) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- テナント任意ドメインのため next/image の remotePatterns を要求しない
      <img
        src={u}
        alt=""
        width={width}
        height={height}
        className={cn(className)}
        style={{ width: "auto", height: "auto", maxHeight: height }}
      />
    );
  }
  return (
    <Image
      src="/eventbase-logo.png"
      alt=""
      width={width}
      height={height}
      className={className}
      style={{ width: "auto", height: "auto" }}
    />
  );
}
