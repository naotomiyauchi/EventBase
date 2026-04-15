import Link from "next/link";
import { notFound } from "next/navigation";
import type { AppRole } from "@/lib/app-role";
import { APP_ROLE_LABELS, isAppManagerRole } from "@/lib/app-role";
import { findAuthUserByEmail } from "@/lib/auth-admin-lookup";
import { getCurrentProfile } from "@/lib/auth-profile";
import { isSupabaseConfigured } from "@/lib/env";
import { isGoogleSheetsApiConfigured } from "@/lib/google-sheets-config";
import { createClient } from "@/lib/supabase/server";
import {
  staffRecordToFormDefaults,
  type StaffHistoryRow,
  type StaffRow,
} from "@/lib/staff-form-defaults";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StaffProfileFormFields } from "@/components/staff-profile-form-fields";
import { UserRoleSelect } from "@/components/settings/user-role-select";
import { StaffAccountPasswordForm } from "@/components/staff-account-password-form";
import { StaffDeleteForm } from "@/components/staff-delete-form";
import {
  createServiceRoleClient,
  isServiceRoleConfigured,
} from "@/lib/supabase/admin";
import {
  updateStaff,
  addStaffNgStore,
  removeStaffNgStore,
} from "@/app/actions/staff";
import { STAFF_GOOGLE_EXPORT_MESSAGES } from "@/lib/staff-google-export-errors";
import { CloudUpload, FileSpreadsheet, FileText } from "lucide-react";

export default async function SettingsStaffDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    ng_added?: string;
    ng_removed?: string;
    updated?: string;
    registered?: string;
    google_notice_sent?: string;
    google_notice_failed?: string;
    error?: string;
    google_export?: string;
    password_reset?: string;
  }>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Supabase を設定するとスタッフ詳細を表示できます。
        </p>
        <Link
          href="/dashboard/settings/users"
          className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-2.5 text-sm font-medium hover:bg-muted"
        >
          設定に戻る
        </Link>
      </div>
    );
  }

  const supabase = await createClient();
  const actor = await getCurrentProfile(supabase);
  if (!actor || !isAppManagerRole(actor.role)) {
    notFound();
  }

  const { data: staff, error } = await supabase
    .from("staff")
    .select(
      `
      id,
      name,
      name_kana,
      gender,
      birth_date,
      age_years,
      address,
      base_address,
      email,
      phone,
      preferred_work_location,
      nearest_station,
      has_car,
      commute_time_preference,
      can_business_trip,
      can_weekend_holiday,
      preferred_shift_start,
      notes,
      pr_notes,
      skills,
      created_at,
      updated_at
    `
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !staff) {
    notFound();
  }

  let linkedUserId: string | null = null;
  let linkedAppRole: AppRole | null = null;
  if (isServiceRoleConfigured() && staff.email?.trim()) {
    try {
      const admin = createServiceRoleClient();
      const u = await findAuthUserByEmail(admin, String(staff.email).trim());
      if (u) {
        linkedUserId = u.id;
        const { data: pr } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", u.id)
          .maybeSingle();
        linkedAppRole = (pr?.role as AppRole) ?? "staff";
      }
    } catch {
      linkedUserId = null;
    }
  }

  const { data: whRows } = await supabase
    .from("staff_work_history")
    .select("year, month, period_label, job_content")
    .eq("staff_id", id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  const defaults = staffRecordToFormDefaults(
    staff as StaffRow,
    (whRows ?? []) as StaffHistoryRow[]
  );

  const googleSheetsExport = isGoogleSheetsApiConfigured();

  const [{ data: stores }, { data: ngRows }] = await Promise.all([
    supabase
      .from("stores")
      .select(
        `
        id,
        name,
        agencies (
          name,
          carriers ( name )
        )
      `
      )
      .order("name"),
    supabase
      .from("staff_ng_stores")
      .select(
        `
        id,
        reason,
        created_at,
        stores (
          id,
          name,
          agencies (
            name,
            carriers ( name )
          )
        )
      `
      )
      .eq("staff_id", id)
      .order("created_at", { ascending: false }),
  ]);

  const storeList = (stores ?? []) as unknown as {
    id: string;
    name: string;
    agencies: {
      name: string;
      carriers: { name: string } | null;
    } | null;
  }[];

  const ngList = (ngRows ?? []) as unknown as {
    id: string;
    reason: string | null;
    created_at: string;
    stores: {
      id: string;
      name: string;
      agencies: { name: string; carriers: { name: string } | null } | null;
    } | null;
  }[];

  const ngStoreIds = new Set(ngList.map((n) => n.stores?.id).filter(Boolean));
  const availableStores = storeList.filter((s) => !ngStoreIds.has(s.id));

  function storeLabel(s: (typeof storeList)[0]) {
    const c = s.agencies?.carriers?.name;
    const a = s.agencies?.name;
    return [c, a, s.name].filter(Boolean).join(" / ");
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link
          href="/dashboard/settings/users"
          className="text-xs text-muted-foreground hover:underline"
        >
          ← 設定（スタッフ一覧）
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">{staff.name}</h1>
        <p className="text-sm text-muted-foreground">
          プロフィール・職務経歴・NG イベント・出力を編集できます。スキルはダッシュボードの「スタッフ」からのみ変更できます。
        </p>
      </div>

      {sp.ng_added && (
        <p className="text-sm text-green-600 dark:text-green-400">
          NGイベントを追加しました。
        </p>
      )}
      {sp.ng_removed && (
        <p className="text-sm text-green-600 dark:text-green-400">
          NGイベントを解除しました。
        </p>
      )}
      {sp.updated && (
        <p className="text-sm text-green-600 dark:text-green-400">
          保存しました。
        </p>
      )}
      {sp.password_reset && (
        <p className="text-sm text-green-600 dark:text-green-400">
          ログインのパスワードを更新しました。
        </p>
      )}
      {sp.registered && (
        <p className="text-sm text-green-600 dark:text-green-400">
          スタッフを登録しました。
        </p>
      )}
      {sp.google_notice_sent && (
        <p className="text-sm text-green-600 dark:text-green-400">
          Google 連携通知を送信しました。
        </p>
      )}
      {sp.google_notice_failed && (
        <p className="rounded-md border border-amber-500/50 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:bg-amber-950/40 dark:text-amber-50">
          スタッフ登録は完了しましたが、Google 連携通知の送信に失敗しました。
        </p>
      )}
      {sp.error && (
        <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {decodeURIComponent(sp.error)}
        </p>
      )}
      {sp.google_export &&
        STAFF_GOOGLE_EXPORT_MESSAGES[sp.google_export] && (
          <p className="rounded-md border border-amber-500/50 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:bg-amber-950/40 dark:text-amber-50">
            {STAFF_GOOGLE_EXPORT_MESSAGES[sp.google_export]}
          </p>
        )}

      {linkedUserId && linkedAppRole && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">ログイン権限</CardTitle>
            <CardDescription>
              このスタッフ名簿のメールと同じログインアカウントに付与される権限です。
            </CardDescription>
          </CardHeader>
          <CardContent>
            {actor.role === "admin" ? (
              <UserRoleSelect
                userId={linkedUserId}
                currentRole={linkedAppRole}
              />
            ) : (
              <p className="text-sm">{APP_ROLE_LABELS[linkedAppRole]}</p>
            )}
          </CardContent>
        </Card>
      )}

      {isServiceRoleConfigured() &&
        staff.email?.trim() &&
        linkedUserId &&
        (actor.role === "admin" ||
          (actor.role === "team_leader" && linkedAppRole !== "admin")) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">ログインパスワード</CardTitle>
              <CardDescription>
                名簿のメールと一致する Supabase
                ログインのパスワードを再設定します。本人に新しいパスワードを安全に伝えてください。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <StaffAccountPasswordForm staffId={staff.id} />
            </CardContent>
          </Card>
        )}

      {isServiceRoleConfigured() && staff.email?.trim() && !linkedUserId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">ログインパスワード</CardTitle>
            <CardDescription>
              名簿のメールに一致するログインアカウントが見つかりません。メールを登録直した場合は、スタッフ登録で新規アカウントを作成するか、Supabase
              でユーザーを確認してください。
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <form action={updateStaff} className="space-y-6">
        <StaffProfileFormFields
          defaults={defaults}
          showId={staff.id}
          returnToSettings
          hideSkills
        />
        <Button type="submit" size="lg">
          保存
        </Button>
      </form>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">出力</CardTitle>
          <CardDescription>
            {googleSheetsExport ? (
              <>
                <span className="block">
                  Google
                  ドライブに新規スプレッドシートを作成して開きます。Supabase の
                  Google ログインで保存したリフレッシュトークンを使います（管理者・チームリーダーは設定の「Google
                  連携」からも再紐付けできます）。
                </span>
                <span className="mt-1 block text-muted-foreground">
                  ファイルを端末に落とすだけなら Excel / PDF も利用できます。
                </span>
              </>
            ) : (
              <>
                Excel（.xlsx）・PDF
                をダウンロードできます。Google
                スプレッドシートへ自動作成するには、管理者が Google Cloud
                の OAuth クライアントを環境変数に設定してください。
              </>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {googleSheetsExport && (
            <a
              href={`/api/staff/${staff.id}/export/google`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-primary bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <CloudUpload className="size-4" />
              Google スプレッドシートに出力
            </a>
          )}
          <a
            href={`/api/staff/${staff.id}/export?format=xlsx`}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium hover:bg-muted"
          >
            <FileSpreadsheet className="size-4" />
            Excel（.xlsx）
          </a>
          <a
            href={`/api/staff/${staff.id}/export?format=pdf`}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium hover:bg-muted"
          >
            <FileText className="size-4" />
            PDF
          </a>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">NGイベント（出禁）</CardTitle>
          <CardDescription>
            マッチング時に除外する店舗。理由を残して運用できます。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <ul className="space-y-3">
            {ngList.length === 0 && (
              <li className="text-sm text-muted-foreground">
                NG 登録はありません。
              </li>
            )}
            {ngList.map((row) => {
              const st = row.stores;
              const label = st
                ? [st.agencies?.carriers?.name, st.agencies?.name, st.name]
                    .filter(Boolean)
                    .join(" / ")
                : "（不明な店舗）";
              return (
                <li
                  key={row.id}
                  className="flex flex-col gap-2 rounded-lg border px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{label}</p>
                    {row.reason && (
                      <p className="text-xs text-muted-foreground">
                        理由: {row.reason}
                      </p>
                    )}
                  </div>
                  <form action={removeStaffNgStore}>
                    <input type="hidden" name="ng_id" value={row.id} />
                    <input type="hidden" name="staff_id" value={staff.id} />
                    <input type="hidden" name="form_context" value="settings" />
                    <Button type="submit" variant="outline" size="sm">
                      解除
                    </Button>
                  </form>
                </li>
              );
            })}
          </ul>

          {availableStores.length > 0 ? (
            <form action={addStaffNgStore} className="space-y-3 max-w-md border-t pt-4">
              <input type="hidden" name="staff_id" value={staff.id} />
              <input type="hidden" name="form_context" value="settings" />
              <div className="space-y-2">
                <Label htmlFor="store_id">店舗を NG に追加</Label>
                <select
                  id="store_id"
                  name="store_id"
                  required
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                  defaultValue=""
                >
                  <option value="" disabled>
                    選択してください
                  </option>
                  {availableStores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {storeLabel(s)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reason">理由（任意）</Label>
                <Input id="reason" name="reason" placeholder="例: トラブルにより出禁" />
              </div>
              <Button type="submit" size="sm" variant="secondary">
                NG に追加
              </Button>
            </form>
          ) : (
            <p className="text-xs text-muted-foreground">
              追加できる店舗がありません（未登録の店舗は「イベント」マスタから登録してください）。
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-base text-destructive">危険な操作</CardTitle>
          <CardDescription>
            名簿と、名簿のメールに紐づくログインアカウントの両方を削除します。元に戻せません。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StaffDeleteForm
            staffId={staff.id}
            hasLinkedAccount={Boolean(linkedUserId)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
