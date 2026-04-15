import { isAppManagerRole } from "@/lib/app-role";
import { findAuthUsersByEmails } from "@/lib/auth-admin-lookup";
import { getCurrentProfile } from "@/lib/auth-profile";
import {
  createServiceRoleClient,
  isServiceRoleConfigured,
} from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function SettingsUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ staff_deleted?: string; auth_orphan?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile || !isAppManagerRole(profile.role)) {
    notFound();
  }

  const serviceOk = isServiceRoleConfigured();

  const { data: staffListRows } = await supabase
    .from("staff")
    .select("id, name, email")
    .order("name");

  const staffList = (staffListRows ?? []) as {
    id: string;
    name: string;
    email: string | null;
  }[];

  const staffIds = staffList.map((s) => s.id);
  const { data: lineLinks } =
    staffIds.length > 0
      ? await supabase
          .from("line_user_links")
          .select("staff_id")
          .in("staff_id", staffIds)
      : { data: [] as { staff_id: string }[] };
  const lineLinkedSet = new Set((lineLinks ?? []).map((r) => r.staff_id));

  let googleLinkedUserIds = new Set<string>();
  let authUserIdByEmail = new Map<string, string>();
  if (serviceOk) {
    try {
      const admin = createServiceRoleClient();
      const emails = Array.from(
        new Set(
          staffList
            .map((s) => (s.email ?? "").trim().toLowerCase())
            .filter(Boolean)
        )
      );
      const usersByEmail = await findAuthUsersByEmails(admin, emails);
      authUserIdByEmail = new Map(
        Array.from(usersByEmail.entries()).map(([email, user]) => [email, user.id])
      );
      const userIds = Array.from(
        new Set(Array.from(usersByEmail.values()).map((u) => u.id))
      );
      if (userIds.length > 0) {
        const { data: creds } = await admin
          .from("user_google_credentials")
          .select("user_id")
          .in("user_id", userIds);
        googleLinkedUserIds = new Set((creds ?? []).map((r) => String(r.user_id)));
      }
    } catch {
      googleLinkedUserIds = new Set();
      authUserIdByEmail = new Map();
    }
  }

  return (
    <div className="space-y-8">
      {sp.staff_deleted && (
        <p className="rounded-md border border-green-600/40 bg-green-50 px-3 py-2 text-sm text-green-900 dark:bg-green-950/40 dark:text-green-100">
          スタッフ一覧から削除しました。
        </p>
      )}
      {sp.auth_orphan && (
        <p className="rounded-md border border-amber-500/50 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:bg-amber-950/40 dark:text-amber-50">
          名簿は削除しましたが、Supabase
          上のログインアカウントの削除に失敗しました。ダッシュボードの認証ユーザーから手動で削除してください。
        </p>
      )}
      <Card className="border-border/70 shadow-xs">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <CardTitle className="text-lg">スタッフ一覧</CardTitle>
            <CardDescription>
              プロフィール・職務経歴・NG イベント・ログイン権限・パスワード再設定・出力は詳細から。スキルはダッシュボードの「スタッフ」からのみ変更できます。
            </CardDescription>
          </div>
          {serviceOk ? (
            <Link
              href="/dashboard/settings/users/staff/new"
              className="inline-flex h-9 shrink-0 items-center justify-center gap-1 rounded-lg border border-primary/40 bg-primary px-3 text-sm font-medium text-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/70 hover:bg-primary/90 hover:shadow-md hover:text-white"
            >
              スタッフ追加
            </Link>
          ) : (
            <Button type="button" size="sm" className="shrink-0" disabled>
              スタッフ追加
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg border bg-muted/20 px-3 py-2">
              <p className="text-[11px] text-muted-foreground">登録スタッフ</p>
              <p className="text-lg font-semibold">{staffList.length}</p>
            </div>
            <div className="rounded-lg border bg-muted/20 px-3 py-2">
              <p className="text-[11px] text-muted-foreground">Google連携済み</p>
              <p className="text-lg font-semibold">
                {
                  staffList.filter((s) => {
                    const email = (s.email ?? "").trim().toLowerCase();
                    const authUserId = authUserIdByEmail.get(email) ?? null;
                    return authUserId ? googleLinkedUserIds.has(authUserId) : false;
                  }).length
                }
              </p>
            </div>
            <div className="rounded-lg border bg-muted/20 px-3 py-2">
              <p className="text-[11px] text-muted-foreground">LINE連携済み</p>
              <p className="text-lg font-semibold">
                {staffList.filter((s) => lineLinkedSet.has(s.id)).length}
              </p>
            </div>
          </div>
          <div className="overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>氏名</TableHead>
                <TableHead>メール</TableHead>
                <TableHead className="w-[110px]">Google</TableHead>
                <TableHead className="w-[110px]">LINE</TableHead>
                <TableHead className="w-[100px] text-right">詳細</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staffList.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    スタッフがいません。右上の「スタッフ追加」から追加してください。
                  </TableCell>
                </TableRow>
              )}
              {staffList.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {s.email ?? "—"}
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const email = (s.email ?? "").trim().toLowerCase();
                      const authUserId = authUserIdByEmail.get(email) ?? null;
                      const linked = authUserId
                        ? googleLinkedUserIds.has(authUserId)
                        : false;
                      return (
                        <span
                          className={
                            linked
                              ? "inline-flex rounded bg-green-100 px-2 py-1 text-xs text-green-700 dark:bg-green-900/40 dark:text-green-300"
                              : "inline-flex rounded bg-zinc-100 px-2 py-1 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                          }
                        >
                          {linked ? "連携済み" : "未連携"}
                        </span>
                      );
                    })()}
                  </TableCell>
                  <TableCell>
                    <span
                      className={
                        lineLinkedSet.has(s.id)
                          ? "inline-flex rounded bg-green-100 px-2 py-1 text-xs text-green-700 dark:bg-green-900/40 dark:text-green-300"
                          : "inline-flex rounded bg-zinc-100 px-2 py-1 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                      }
                    >
                      {lineLinkedSet.has(s.id) ? "連携済み" : "未連携"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/dashboard/settings/users/staff/${s.id}`}
                      className="text-primary text-sm underline-offset-4 hover:underline"
                    >
                      開く
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
