"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";
import {
  Building2,
  CalendarDays,
  ClipboardList,
  Clock3,
  LayoutDashboard,
  Menu,
  Settings,
  Store,
  User,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UserMenu } from "@/components/user-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const baseGroups = [
  {
    key: "home",
    label: null as string | null,
    items: [{ href: "/dashboard", label: "ホーム", icon: LayoutDashboard }],
  },
  {
    key: "projects",
    label: "案件",
    items: [
      { href: "/dashboard/projects", label: "案件情報", icon: ClipboardList },
      { href: "/dashboard/stores", label: "イベント", icon: Store },
      { href: "/dashboard/masters", label: "マスタ", icon: Building2 },
    ],
  },
  {
    key: "staff",
    label: "スタッフ",
    items: [
      { href: "/dashboard/staff", label: "スタッフ情報", icon: Users },
      { href: "/dashboard/attendance", label: "打刻", icon: Clock3 },
      { href: "/dashboard/my-shifts", label: "シフト", icon: CalendarDays },
    ],
  },
];

type Props = {
  children: React.ReactNode;
  userEmail?: string | null;
  showAuth: boolean;
  /** 管理者・チームリーダーのみ */
  showSettingsNav?: boolean;
};

export function AppShell({
  children,
  userEmail,
  showAuth,
  showSettingsNav,
}: Props) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const groups = React.useMemo(() => {
    // 非管理ユーザー向けには「シフト表（管理画面）」を隠す
    const filtered = baseGroups.map((g) => ({
      ...g,
      items:
        g.key === "staff" && showSettingsNav
          ? [
              ...g.items,
              { href: "/dashboard/shift-board", label: "シフト表（管理）", icon: CalendarDays },
            ]
          : g.items,
    }));
    return filtered;
  }, [showSettingsNav]);

  const bottomItems = React.useMemo(
    () =>
      [
        ...(showSettingsNav
          ? [{ href: "/dashboard/settings", label: "設定", icon: Settings }]
          : []),
        { href: "/dashboard/account", label: "アカウント", icon: User },
      ] as { href: string; label: string; icon: React.ComponentType<{ className?: string }> }[],
    [showSettingsNav]
  );

  function NavLink({
    href,
    label,
    icon: Icon,
    onClick,
  }: {
    href: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    onClick?: () => void;
  }) {
    const active =
      href === "/dashboard"
        ? pathname === "/dashboard"
        : pathname.startsWith(href);
    return (
      <Link
        href={href}
        onClick={onClick}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          active
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {label}
      </Link>
    );
  }

  return (
    <div className="flex min-h-svh flex-col md:flex-row">
      <aside className="hidden w-56 shrink-0 border-r bg-card md:block">
        <div className="flex h-14 items-center gap-2 border-b px-4">
          <Image
            src="/eventbase-logo.png"
            alt="EventBase"
            width={44}
            height={44}
            className="rounded"
            style={{ width: "auto", height: "auto" }}
          />
        </div>
        <div className="flex h-[calc(100svh-3.5rem)] flex-col">
          <nav className="flex-1 space-y-3 overflow-y-auto p-3">
            {groups.map((g) => (
              <div key={g.key} className="space-y-1">
                {g.label && (
                  <p className="px-3 pt-2 text-xs font-medium text-muted-foreground">
                    {g.label}
                  </p>
                )}
                {g.items.map((item) => (
                  <NavLink key={item.href} {...item} />
                ))}
              </div>
            ))}
          </nav>
          <div className="border-t p-3">
            <div className="space-y-1">
              {bottomItems.map((item) => (
                <NavLink key={item.href} {...item} />
              ))}
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-2 border-b bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/80">
          <div className="flex items-center gap-2 md:hidden">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              aria-label="メニュー"
            >
              <Menu className="h-5 w-5" />
            </button>
            <Image
              src="/eventbase-logo.png"
              alt="EventBase"
              width={34}
              height={34}
              className="rounded"
              style={{ width: "auto", height: "auto" }}
            />
          </div>
          <div className="ml-auto md:ml-0">
            <UserMenu email={userEmail} canSignOut={showAuth} />
          </div>
        </header>

        <main className="flex-1 p-4 pb-6">{children}</main>

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="p-0">
            <SheetHeader className="border-b">
              <SheetTitle className="flex items-center gap-2">
                <Image
                  src="/eventbase-logo.png"
                  alt="EventBase"
                  width={40}
                  height={40}
                  className="rounded"
                  style={{ width: "auto", height: "auto" }}
                />
              </SheetTitle>
            </SheetHeader>
            <div className="flex h-full flex-col">
              <nav className="flex-1 space-y-3 overflow-y-auto p-3">
                {groups.map((g) => (
                  <div key={g.key} className="space-y-1">
                    {g.label && (
                      <p className="px-3 pt-2 text-xs font-medium text-muted-foreground">
                        {g.label}
                      </p>
                    )}
                    {g.items.map((item) => (
                      <NavLink
                        key={item.href}
                        {...item}
                        onClick={() => setMobileOpen(false)}
                      />
                    ))}
                  </div>
                ))}
              </nav>
              <div className="border-t p-3">
                <div className="space-y-1">
                  {bottomItems.map((item) => (
                    <NavLink
                      key={item.href}
                      {...item}
                      onClick={() => setMobileOpen(false)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
