import Link from "next/link";
import { notFound } from "next/navigation";
import { isAppManagerRole } from "@/lib/app-role";
import { getCurrentProfile } from "@/lib/auth-profile";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

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
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">設定</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          スタッフ名簿・登録・Google/LINE 連携を行います。
        </p>
        <nav className="mt-4 flex flex-wrap gap-2 border-b pb-3">
          <Link
            href="/dashboard/settings/users"
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            スタッフ名簿
          </Link>
          <Link
            href="/dashboard/settings/google"
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            Google 連携
          </Link>
          <Link
            href="/dashboard/settings/line"
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            LINE 連携
          </Link>
        </nav>
      </div>
      {children}
    </div>
  );
}
