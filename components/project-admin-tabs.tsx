"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/dashboard/projects", label: "案件情報", icon: ClipboardList },
  { href: "/dashboard/masters", label: "マスタ", icon: Building2 },
];

export function ProjectAdminTabs() {
  const pathname = usePathname();

  return (
    <nav className="mt-5 grid gap-2 rounded-xl border bg-card/70 p-2 sm:grid-cols-2">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = tab.href === "/dashboard/projects"
          ? pathname === tab.href || pathname.startsWith("/dashboard/projects/")
          : pathname === tab.href || pathname.startsWith("/dashboard/masters/");
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
              isActive
                ? "bg-zinc-900 text-white shadow-sm dark:bg-zinc-100 dark:text-zinc-900"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
