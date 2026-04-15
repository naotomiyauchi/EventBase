import { notFound } from "next/navigation";
import { SettingsTabs } from "@/components/settings/settings-tabs";
import { isAppManagerRole } from "@/lib/app-role";
import { getCurrentProfile } from "@/lib/auth-profile";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsLayout({
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
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="rounded-2xl border bg-linear-to-b from-card to-card/60 p-5 shadow-xs">
        <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground">
          SETTINGS
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">設定</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          スタッフ・連携設定をひとつの画面で管理します。
        </p>
        <SettingsTabs />
      </div>
      {children}
    </div>
  );
}
