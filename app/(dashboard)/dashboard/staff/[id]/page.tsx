import Link from "next/link";
import { notFound } from "next/navigation";
import { isAppManagerRole } from "@/lib/app-role";
import { getCurrentProfile } from "@/lib/auth-profile";
import { isSupabaseConfigured } from "@/lib/env";
import { isGoogleSheetsApiConfigured } from "@/lib/google-sheets-config";
import { createClient } from "@/lib/supabase/server";
import { staffRecordToFormDefaults, type StaffRow } from "@/lib/staff-form-defaults";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StaffSkillFields } from "@/components/staff-skill-fields";
import { updateStaffSkillsOnly } from "@/app/actions/staff";
import { STAFF_GOOGLE_EXPORT_MESSAGES } from "@/lib/staff-google-export-errors";
import { CloudUpload, FileSpreadsheet, FileText } from "lucide-react";

export default async function StaffDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
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
          href="/dashboard/staff"
          className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-2.5 text-sm font-medium hover:bg-muted"
        >
          一覧へ
        </Link>
      </div>
    );
  }

  const supabase = await createClient();
  const profile = await getCurrentProfile(supabase);
  const showSettingsStaffLink =
    profile != null && isAppManagerRole(profile.role);

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

  const defaults = staffRecordToFormDefaults(staff as StaffRow, []);

  const googleSheetsExport = isGoogleSheetsApiConfigured();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link
          href="/dashboard/staff"
          className="text-xs text-muted-foreground hover:underline"
        >
          ← スタッフ一覧
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">{staff.name}</h1>
        <p className="text-sm text-muted-foreground">
          スキルはここでのみ変更できます。プロフィール・NG 現場・権限は「設定」→「スタッフ名簿」の詳細から編集します。
        </p>
        {showSettingsStaffLink && (
          <p>
            <Link
              href={`/dashboard/settings/users/staff/${id}`}
              className="text-sm text-primary underline-offset-4 hover:underline"
            >
              設定でプロフィール全体を編集
            </Link>
          </p>
        )}
      </div>

      {sp.updated && (
        <p className="text-sm text-green-600 dark:text-green-400">
          スキルを保存しました。
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">スキル</CardTitle>
          <CardDescription>ここで入力した内容だけが保存されます。</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={updateStaffSkillsOnly} className="space-y-4">
            <input type="hidden" name="id" value={staff.id} />
            <StaffSkillFields
              selectedPresets={defaults.skillPresetKeys}
              skillsCustomDefault={defaults.skillsCustom}
            />
            <Button type="submit" size="lg">
              スキルを保存
            </Button>
          </form>
        </CardContent>
      </Card>

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
    </div>
  );
}
