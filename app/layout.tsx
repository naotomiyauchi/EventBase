import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Sans_JP } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  preload: true,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  preload: true,
});

/** 日本語。subsets は Google が列挙するものを広めに（latin のみだと環境によって読み込みが薄くなることがある） */
const notoSansJp = Noto_Sans_JP({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin", "latin-ext", "cyrillic", "vietnamese"],
  variable: "--font-noto-sans-jp",
  display: "swap",
  preload: true,
});

export const metadata: Metadata = {
  title: "EventBase",
  description: "Mobile Event Management",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "EventBase",
    statusBarStyle: "default",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${notoSansJp.variable} h-full`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
