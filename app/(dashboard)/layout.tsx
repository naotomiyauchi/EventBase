import { AppShell } from "@/components/app-shell";
import { SetupBanner } from "@/components/setup-banner";
import { Toaster } from "@/components/ui/sonner";
import { isAppManagerRole } from "@/lib/app-role";
import { getCurrentProfile } from "@/lib/auth-profile";
import { getTenantFeatureFlag } from "@/lib/feature-flags";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { isAnfraHost } from "@/lib/anfra-host";
import { resolveTenantForDashboard } from "@/lib/tenant-resolve";
import type { TenantBranding } from "@/lib/tenant-branding";

export default async function DashboardGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let userEmail: string | null | undefined;
  let showSettingsNav = false;
  let tenantBranding: TenantBranding | null = null;
  let featureBilling = true;
  let unreadNotifications = 0;
  const configured = isSupabaseConfigured();
  const anfraDarkShell = await isAnfraHost();

  if (configured) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userEmail = user?.email;
    const profile = await getCurrentProfile(supabase);
    showSettingsNav = profile ? isAppManagerRole(profile.role) : false;
    if (profile) {
      const { tenant, tenantIdForFlags } = await resolveTenantForDashboard(
        supabase,
        profile.tenant_id
      );
      tenantBranding = tenant?.branding ?? null;
      if (tenantIdForFlags) {
        featureBilling = await getTenantFeatureFlag(
          supabase,
          tenantIdForFlags,
          "billing",
          true
        );
      }
      const { count } = await supabase
        .from("app_notifications")
        .select("id", { head: true, count: "exact" })
        .is("read_at", null);
      unreadNotifications = count ?? 0;
    }
  }

  return (
    <>
      <AppShell
        userEmail={userEmail}
        showAuth={configured}
        showSettingsNav={showSettingsNav}
        tenantBranding={tenantBranding}
        featureBilling={featureBilling}
        anfraDarkShell={anfraDarkShell}
        unreadNotifications={unreadNotifications}
      >
        {!configured && <SetupBanner />}
        {children}
      </AppShell>
      <Toaster position="top-center" />
    </>
  );
}
