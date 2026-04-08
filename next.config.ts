import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /** 同一 LAN の端末から `next dev` に IP でアクセスするとき（HMR / webpack）。必要なら IP を追加 */
  allowedDevOrigins: ["192.168.3.58"],
};

export default nextConfig;
