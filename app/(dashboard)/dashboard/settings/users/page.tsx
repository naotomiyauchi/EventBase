import { isAppManagerRole } from "@/lib/app-role";
import { getCurrentProfile } from "@/lib/auth-profile";
import { isServiceRoleConfigured } from "@/lib/supabase/admin";
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

  return (
    <div className="space-y-8">
      {sp.staff_deleted && (
        <p className="rounded-md border border-green-600/40 bg-green-50 px-3 py-2 text-sm text-green-900 dark:bg-green-950/40 dark:text-green-100">
          スタッフ名簿から削除しました。
        </p>
      )}
      {sp.auth_orphan && (
        <p className="rounded-md border border-amber-500/50 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:bg-amber-950/40 dark:text-amber-50">
          名簿は削除しましたが、Supabase
          上のログインアカウントの削除に失敗しました。ダッシュボードの認証ユーザーから手動で削除してください。
        </p>
      )}
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <CardTitle className="text-base">スタッフ名簿</CardTitle>
            <CardDescription>
              プロフィール・職務経歴・NG 現場・ログイン権限・パスワード再設定・出力は詳細から。スキルはダッシュボードの「スタッフ」からのみ変更できます。
            </CardDescription>
          </div>
          {serviceOk ? (
            <Link
              href="/dashboard/settings/users/staff/new"
              className="inline-flex h-7 shrink-0 items-center justify-center gap-1 rounded-[min(var(--radius-md),12px)] border border-transparent bg-primary px-2.5 text-[0.8rem] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              スタッフ登録
            </Link>
          ) : (
            <Button type="button" size="sm" className="shrink-0" disabled>
              スタッフ登録
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>氏名</TableHead>
                <TableHead>メール</TableHead>
                <TableHead className="w-[100px] text-right">詳細</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staffList.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground">
                    スタッフがいません。右上の「スタッフ登録」から追加してください。
                  </TableCell>
                </TableRow>
              )}
              {staffList.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {s.email ?? "—"}
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
        </CardContent>
      </Card>
    </div>
  );
}
