"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";
import {
  Building2,
  CalendarDays,
  ClipboardList,
  Clock3,
  FileText,
  LayoutDashboard,
  Menu,
  Settings,
  Store,
  User,
  Users,
  Wallet,
  Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TenantLogo } from "@/components/tenant-logo";
import { UserMenu } from "@/components/user-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { TenantBranding } from "@/lib/tenant-branding";
import { tenantPrimaryCssVars } from "@/lib/tenant-branding";

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
      { href: "/dashboard/billing", label: "請求・見積", icon: FileText },
      { href: "/dashboard/finance", label: "領収書・出納", icon: Wallet },
      { href: "/dashboard/masters", label: "マスタ", icon: Building2 },
    ],
  },
  {
    key: "staff",
    label: "スタッフ",
    items: [
      { href: "/dashboard/staff", label: "スタッフ情報", icon: Users },
      { href: "/dashboard/attendance", label: "打刻", icon: Clock3 },
      { href: "/dashboard/my-shifts", label: "マイシフト", icon: CalendarDays },
    ],
  },
];

type Props = {
  children: React.ReactNode;
  userEmail?: string | null;
  showAuth: boolean;
  /** 管理者・チームリーダーのみ */
  showSettingsNav?: boolean;
  /** テナント白ラベル（未設定時は既定の EventBase 見た目） */
  tenantBranding?: TenantBranding | null;
  /** 機能フラグ: 請求・見積ナビを表示 */
  featureBilling?: boolean;
  /** anfra.jp 等 — 背景を黒ベースにして顧客ドメインと差別化 */
  anfraDarkShell?: boolean;
  unreadNotifications?: number;
  forceWhiteLogo?: boolean;
};

export function AppShell({
  children,
  userEmail,
  showAuth,
  showSettingsNav,
  tenantBranding,
  featureBilling = true,
  anfraDarkShell = false,
  unreadNotifications = 0,
  forceWhiteLogo = false,
}: Props) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const groups = React.useMemo(() => {
    // 非管理ユーザー向けには「シフト表（管理画面）」を隠す
    const filtered = baseGroups.map((g) => {
      let items = g.items;
      if (g.key === "projects" && !featureBilling) {
        items = items.filter((i) => i.href !== "/dashboard/billing");
      }
      if (g.key === "projects" && !showSettingsNav) {
        items = items.filter((i) => i.href !== "/dashboard/finance");
      }
      return {
        ...g,
        items:
          g.key === "staff" && showSettingsNav
            ? [
                ...items,
                { href: "/dashboard/shifts", label: "シフト管理", icon: CalendarDays },
                { href: "/dashboard/shift-board", label: "シフト表（管理）", icon: CalendarDays },
              ]
            : items,
      };
    });
    return filtered;
  }, [showSettingsNav, featureBilling]);

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
          anfraDarkShell
            ? active
              ? "bg-zinc-800 text-white"
              : "text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-100"
            : active
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {label}
      </Link>
    );
  }

  const logoUrl = tenantBranding?.logoUrl ?? null;

  return (
    <div
      className={cn(
        "flex min-h-svh flex-col md:flex-row",
        /* dark: トークンでカード・ページも黒基調に */
        anfraDarkShell && "bg-black text-zinc-100 dark"
      )}
      style={tenantPrimaryCssVars(tenantBranding ?? {})}
    >
      <aside
        className={cn(
          "hidden w-56 shrink-0 border-r md:block",
          anfraDarkShell
            ? "border-zinc-800 bg-zinc-950"
            : "bg-card"
        )}
      >
        <div
          className={cn(
            "flex h-14 items-center gap-2 border-b px-4",
            anfraDarkShell && "border-zinc-800"
          )}
        >
          <TenantLogo logoUrl={logoUrl} width={44} height={44} className="rounded" forceWhiteLogo={forceWhiteLogo} />
        </div>
        <div className="flex h-[calc(100svh-3.5rem)] flex-col">
          <nav className="flex-1 space-y-3 overflow-y-auto p-3">
            {groups.map((g) => (
              <div key={g.key} className="space-y-1">
                {g.label && (
                  <p
                    className={cn(
                      "px-3 pt-2 text-xs font-medium",
                      anfraDarkShell ? "text-zinc-500" : "text-muted-foreground"
                    )}
                  >
                    {g.label}
                  </p>
                )}
                {g.items.map((item) => (
                  <NavLink key={item.href} {...item} />
                ))}
              </div>
            ))}
          </nav>
          <div
            className={cn("border-t p-3", anfraDarkShell && "border-zinc-800")}
          >
            <div className="space-y-1">
              {bottomItems.map((item) => (
                <NavLink key={item.href} {...item} />
              ))}
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className={cn(
            "sticky top-0 z-40 flex h-14 items-center justify-between gap-2 border-b px-4 backdrop-blur",
            anfraDarkShell
              ? "border-zinc-800 bg-black/90 supports-backdrop-filter:bg-black/80"
              : "bg-background/95 supports-backdrop-filter:bg-background/80"
          )}
        >
          <div className="flex items-center gap-2 md:hidden">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className={cn(
                "inline-flex h-9 w-9 items-center justify-center rounded-md",
                anfraDarkShell
                  ? "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              )}
              aria-label="メニュー"
            >
              <Menu className="h-5 w-5" />
            </button>
            <TenantLogo logoUrl={logoUrl} width={34} height={34} className="rounded" forceWhiteLogo={forceWhiteLogo} />
          </div>
          <div className="ml-auto flex items-center gap-2 md:ml-0">
            <Link
              href="/dashboard/notifications"
              className={cn(
                "relative inline-flex h-9 w-9 items-center justify-center rounded-md",
                anfraDarkShell
                  ? "text-zinc-300 hover:bg-zinc-800"
                  : "text-muted-foreground hover:bg-accent/50"
              )}
              aria-label="通知"
            >
              <Bell className="h-5 w-5" />
              {unreadNotifications > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
                  {unreadNotifications > 99 ? "99+" : unreadNotifications}
                </span>
              ) : null}
            </Link>
            <UserMenu email={userEmail} canSignOut={showAuth} />
          </div>
        </header>

        <main
          className={cn("flex-1 p-4 pb-6", anfraDarkShell && "bg-black")}
        >
          {children}
        </main>

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent
            side="left"
            className={cn(
              "p-0",
              anfraDarkShell &&
                "border-zinc-800 bg-zinc-950 text-zinc-100 **:data-[slot=sheet-close]:text-zinc-400"
            )}
          >
            <SheetHeader
              className={cn("border-b", anfraDarkShell && "border-zinc-800")}
            >
              <SheetTitle className="flex items-center gap-2">
                <TenantLogo logoUrl={logoUrl} width={40} height={40} className="rounded" forceWhiteLogo={forceWhiteLogo} />
              </SheetTitle>
            </SheetHeader>
            <div className="flex h-full flex-col">
              <nav className="flex-1 space-y-3 overflow-y-auto p-3">
                {groups.map((g) => (
                  <div key={g.key} className="space-y-1">
                    {g.label && (
                      <p
                        className={cn(
                          "px-3 pt-2 text-xs font-medium",
                          anfraDarkShell ? "text-zinc-500" : "text-muted-foreground"
                        )}
                      >
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
              <div
                className={cn("border-t p-3", anfraDarkShell && "border-zinc-800")}
              >
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
