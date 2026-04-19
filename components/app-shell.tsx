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
  LayoutGrid,
  ListTodo,
  Menu,
  MessageSquare,
  Settings,
  User,
  Users,
  Wallet,
  Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TenantLogo } from "@/components/tenant-logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { TenantBranding } from "@/lib/tenant-branding";
import { tenantPrimaryCssVars } from "@/lib/tenant-branding";

const baseGroups = [
  {
    key: "home",
    label: null as string | null,
    items: [
      { href: "/dashboard", label: "ホーム", icon: LayoutDashboard },
      { href: "/dashboard/chat", label: "チャット", icon: MessageSquare },
      { href: "/dashboard/todos", label: "ToDo", icon: ListTodo },
    ],
  },
  {
    key: "projects",
    label: "案件",
    items: [
      { href: "/dashboard/projects", label: "案件情報", icon: ClipboardList },
      { href: "/dashboard/masters", label: "マスタ", icon: Building2 },
    ],
  },
  {
    key: "staff",
    label: "スタッフ",
    items: [
      { href: "/dashboard/staff", label: "スタッフ情報", icon: Users },
      { href: "/dashboard/attendance", label: "打刻", icon: Clock3 },
    ],
  },
  {
    key: "shifts",
    label: "シフト",
    items: [
      { href: "/dashboard/my-shifts", label: "マイシフト", icon: CalendarDays },
      { href: "/dashboard/shifts", label: "シフト管理", icon: LayoutGrid },
    ],
  },
  {
    key: "finance",
    label: "経理",
    items: [
      { href: "/dashboard/billing", label: "請求/見積もり", icon: FileText },
      { href: "/dashboard/finance", label: "領収書/出納", icon: Wallet },
    ],
  },
];

type Props = {
  children: React.ReactNode;
  /** 管理者・チームリーダーのみ */
  showSettingsNav?: boolean;
  /** テナント白ラベル（未設定時は既定の EventBase 見た目） */
  tenantBranding?: TenantBranding | null;
  /** 機能フラグ: 請求・見積ナビを表示 */
  featureBilling?: boolean;
  /** anfra.jp 等 — 背景を黒ベースにして顧客ドメインと差別化 */
  anfraDarkShell?: boolean;
  unreadNotifications?: number;
  notificationPreviews?: NotificationPreview[];
  forceWhiteLogo?: boolean;
};

export type NotificationPreview = {
  id: string;
  title: string;
  body: string | null;
  created_at: string;
  read_at: string | null;
};

export function AppShell({
  children,
  showSettingsNav,
  tenantBranding,
  featureBilling = true,
  anfraDarkShell = false,
  unreadNotifications = 0,
  notificationPreviews = [],
  forceWhiteLogo = false,
}: Props) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const groups = React.useMemo(() => {
    // 非管理ユーザー向けには「シフト表（管理画面）」を隠す
    const filtered = baseGroups.map((g) => {
      let items = g.items;
      if (g.key === "finance" && !featureBilling) {
        items = items.filter((i) => i.href !== "/dashboard/billing");
      }
      if (g.key === "finance" && !showSettingsNav) {
        items = items.filter((i) => i.href !== "/dashboard/finance");
      }
      if (g.key === "shifts" && !showSettingsNav) {
        items = items.filter((i) => i.href !== "/dashboard/shifts");
      }
      return { ...g, items };
    });
    return filtered.filter((g) => g.items.length > 0);
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
          "group flex items-center gap-3 rounded-xl border px-3 py-2 text-sm font-medium transition-all",
          anfraDarkShell
            ? active
              ? "border-zinc-700 bg-zinc-800 text-white shadow-sm"
              : "border-transparent text-zinc-400 hover:border-zinc-800 hover:bg-zinc-800/70 hover:text-zinc-100"
            : active
              ? "border-primary/30 bg-primary/10 text-foreground shadow-sm"
              : "border-transparent text-muted-foreground hover:border-border hover:bg-accent/60 hover:text-foreground"
        )}
      >
        <Icon
          className={cn(
            "h-4 w-4 shrink-0 transition-transform",
            active ? "scale-105" : "group-hover:scale-105"
          )}
        />
        {label}
      </Link>
    );
  }

  const logoUrl = tenantBranding?.logoUrl ?? null;

  function dt(s: string) {
    return new Date(s).toLocaleString("ja-JP", {
      timeZone: "Asia/Tokyo",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }

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
          "hidden w-60 shrink-0 border-r md:block",
          anfraDarkShell
            ? "border-zinc-800 bg-zinc-950/95"
            : "bg-card/85 backdrop-blur supports-backdrop-filter:bg-card/75"
        )}
      >
        <div
          className={cn(
            "flex h-16 items-center gap-3 border-b px-4",
            anfraDarkShell && "border-zinc-800"
          )}
        >
          <div
            className={cn(
              "rounded-xl border p-1.5",
              anfraDarkShell
                ? "border-zinc-700 bg-zinc-900"
                : "border-border/80 bg-background/70"
            )}
          >
            <TenantLogo
              logoUrl={logoUrl}
              width={38}
              height={38}
              className="rounded"
              forceWhiteLogo={forceWhiteLogo}
            />
          </div>
          <div className="min-w-0">
            <p
              className={cn(
                "truncate text-xs font-semibold tracking-[0.18em]",
                anfraDarkShell ? "text-zinc-400" : "text-muted-foreground"
              )}
            >
              EVENT BASE
            </p>
          </div>
        </div>
        <div className="flex h-[calc(100svh-4rem)] flex-col">
          <nav className="flex-1 space-y-3 overflow-y-auto p-3">
            {groups.map((g) => (
              <div key={g.key} className="space-y-1">
                {g.label && (
                  <p
                    className={cn(
                      "px-3 pt-2 text-[11px] font-semibold tracking-[0.14em]",
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
            "sticky top-0 z-40 flex h-16 items-center justify-between gap-2 border-b px-4 backdrop-blur",
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
                "inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-colors",
                anfraDarkShell
                  ? "border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                  : "border-border text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              )}
              aria-label="メニュー"
            >
              <Menu className="h-5 w-5" />
            </button>
            <TenantLogo
              logoUrl={logoUrl}
              width={34}
              height={34}
              className="rounded"
              forceWhiteLogo={forceWhiteLogo}
            />
          </div>
          <div className="ml-auto flex items-center gap-2 md:ml-0">
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  "relative inline-flex h-9 w-9 items-center justify-center rounded-lg border",
                  anfraDarkShell
                    ? "border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                    : "border-border text-muted-foreground hover:bg-accent/50"
                )}
                aria-label="通知"
              >
                <Bell className="h-5 w-5" />
                {unreadNotifications > 0 ? (
                  <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
                    {unreadNotifications > 99 ? "99+" : unreadNotifications}
                  </span>
                ) : null}
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                sideOffset={10}
                className="w-[360px] min-w-0 rounded-xl p-2"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-2 py-1">
                    <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground">
                      NOTIFICATIONS
                    </p>
                    <Link href="/dashboard/notifications" className="text-xs text-primary hover:underline">
                      すべて見る
                    </Link>
                  </div>
                  <div className="max-h-80 space-y-1 overflow-y-auto">
                    {notificationPreviews.length === 0 ? (
                      <p className="px-2 py-4 text-sm text-muted-foreground">通知はありません。</p>
                    ) : (
                      notificationPreviews.map((n) => (
                        <Link
                          key={n.id}
                          href="/dashboard/notifications"
                          className={cn(
                            "block rounded-lg border px-2.5 py-2 transition-colors",
                            n.read_at
                              ? "border-border/70 hover:bg-muted/40"
                              : "border-primary/30 bg-primary/5 hover:bg-primary/10"
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="line-clamp-1 text-sm font-medium">{n.title}</p>
                            <p className="shrink-0 text-[11px] text-muted-foreground">{dt(n.created_at)}</p>
                          </div>
                          {n.body ? (
                            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
                          ) : null}
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main
          className={cn("flex-1 p-5 pb-8", anfraDarkShell && "bg-black")}
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
