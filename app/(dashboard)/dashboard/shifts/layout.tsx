import { notFound } from "next/navigation";
import { ShiftAdminTabs } from "@/components/shift-admin-tabs";
import { isAppManagerRole } from "@/lib/app-role";
import { getCurrentProfile } from "@/lib/auth-profile";
import { createClient } from "@/lib/supabase/server";

export default async function ShiftsAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile || !isAppManagerRole(profile.role)) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="rounded-2xl border bg-linear-to-b from-card to-card/60 p-5 shadow-xs">
        <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground">
          SHIFT ADMIN
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">シフト管理</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          運用（作成・公開・通知）と月間シフト表を、同じ画面構成で切り替えられます。
        </p>
        <ShiftAdminTabs />
      </div>
      {children}
    </div>
  );
}
