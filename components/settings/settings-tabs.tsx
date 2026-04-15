"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ContactRound, Link2, MessageCircleMore } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/dashboard/settings/users", label: "スタッフ一覧", icon: ContactRound },
  { href: "/dashboard/settings/google", label: "Google 連携", icon: Link2 },
  { href: "/dashboard/settings/line", label: "LINE 連携", icon: MessageCircleMore },
];

export function SettingsTabs() {
  const pathname = usePathname();

  return (
    <nav className="mt-5 grid gap-2 rounded-xl border bg-card/70 p-2 sm:grid-cols-3">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive =
          pathname === tab.href ||
          (tab.href === "/dashboard/settings/users" &&
            pathname.startsWith("/dashboard/settings/users/"));
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all",
              isActive
                ? "bg-zinc-900 text-white shadow-sm dark:bg-zinc-100 dark:text-zinc-900"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon className="h-4 w-4" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
