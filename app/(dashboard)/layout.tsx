import { AppShell } from "@/components/app-shell";
import { SetupBanner } from "@/components/setup-banner";
import { Toaster } from "@/components/ui/sonner";
import { isAppManagerRole } from "@/lib/app-role";
import { getCurrentProfile } from "@/lib/auth-profile";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let userEmail: string | null | undefined;
  let showSettingsNav = false;
  const configured = isSupabaseConfigured();

  if (configured) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userEmail = user?.email;
    const profile = await getCurrentProfile(supabase);
    showSettingsNav = profile ? isAppManagerRole(profile.role) : false;
  }

  return (
    <>
      <AppShell
        userEmail={userEmail}
        showAuth={configured}
        showSettingsNav={showSettingsNav}
      >
        {!configured && <SetupBanner />}
        {children}
      </AppShell>
      <Toaster position="top-center" />
    </>
  );
}
