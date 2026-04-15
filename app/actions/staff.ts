"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { AppRole } from "@/lib/app-role";
import { isAppManagerRole } from "@/lib/app-role";
import { createGoogleLinkNotification } from "@/app/actions/google-link";
import { findAuthUserByEmail } from "@/lib/auth-admin-lookup";
import { getCurrentProfile } from "@/lib/auth-profile";
import { isSupabaseConfigured } from "@/lib/env";
import {
  createServiceRoleClient,
  isServiceRoleConfigured,
} from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { computeAgeFromBirthDate } from "@/lib/staff-age";
import {
  parseWorkHistoryJson,
  type WorkHistoryInput,
} from "@/lib/staff-work-history";

function parseSkills(raw: string): string[] {
  return raw
    .split(/[,、\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function mergeSkills(formData: FormData): string[] {
  const presets = formData.getAll("skill_preset").map(String);
  const custom = parseSkills(String(formData.get("skills_custom") ?? ""));
  return [...new Set([...presets, ...custom])];
}

function parseAppRole(v: FormDataEntryValue | null): AppRole | null {
  const s = String(v ?? "").trim();
  if (s === "admin" || s === "team_leader" || s === "staff") return s;
  return null;
}

function optStr(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s.length > 0 ? s : null;
}

function parseHasCar(v: string): boolean | null {
  if (v === "true") return true;
  if (v === "false") return false;
  return null;
}

function parseYesNo(v: string): string | null {
  const t = v.trim();
  if (t === "yes" || t === "no") return t;
  return null;
}

function staffRowFromForm(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const name_kana = optStr(formData.get("name_kana"));
  const gender = optStr(formData.get("gender"));
  const birth_date = optStr(formData.get("birth_date"));
  const age_years = computeAgeFromBirthDate(birth_date);
  const address = optStr(formData.get("address"));
  const preferred_work_location = optStr(formData.get("preferred_work_location"));
  const nearest_station = optStr(formData.get("nearest_station"));
  const has_car = parseHasCar(String(formData.get("has_car") ?? ""));
  const commute_time_preference = optStr(formData.get("commute_time_preference"));
  const can_business_trip = parseYesNo(String(formData.get("can_business_trip") ?? ""));
  const can_weekend_holiday = parseYesNo(
    String(formData.get("can_weekend_holiday") ?? "")
  );
  const preferred_shift_start = optStr(formData.get("preferred_shift_start"));
  const email = optStr(formData.get("email"));
  const phone = optStr(formData.get("phone"));
  const notes = optStr(formData.get("notes"));
  const pr_notes = optStr(formData.get("pr_notes"));
  const skills = mergeSkills(formData);

  return {
    name,
    name_kana,
    gender,
    birth_date,
    age_years,
    address,
    base_address: address,
    preferred_work_location,
    nearest_station,
    has_car,
    commute_time_preference,
    can_business_trip,
    can_weekend_holiday,
    preferred_shift_start,
    email,
    phone,
    notes,
    pr_notes,
    skills,
  };
}

async function replaceWorkHistory(
  staffId: string,
  rows: WorkHistoryInput[]
) {
  const supabase = await createClient();
  await supabase.from("staff_work_history").delete().eq("staff_id", staffId);

  const filtered = rows.filter(
    (r) =>
      (r.job_content && r.job_content.trim()) ||
      (r.period_label && r.period_label.trim()) ||
      r.year != null ||
      r.month != null
  );
  if (filtered.length === 0) return;

  const inserts = filtered.map((r, i) => ({
    staff_id: staffId,
    year: r.year,
    month: r.month,
    period_label: r.period_label,
    job_content: r.job_content,
    sort_order: i,
  }));

  const { error } = await supabase.from("staff_work_history").insert(inserts);
  if (error) throw new Error(error.message);
}

function staffUpdateRedirectBase(
  id: string,
  returnTo: string
): { list: string; detail: string } {
  if (returnTo === "settings") {
    return {
      list: "/dashboard/settings/users",
      detail: `/dashboard/settings/users/staff/${id}`,
    };
  }
  return {
    list: "/dashboard/staff",
    detail: `/dashboard/staff/${id}`,
  };
}

/** ダッシュボードのスタッフ詳細: スキルのみ更新 */
export async function updateStaffSkillsOnly(formData: FormData) {
  if (!isSupabaseConfigured()) {
    redirect("/dashboard/staff?error=not_configured");
  }
  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    redirect("/dashboard/staff?error=invalid");
  }

  const skills = mergeSkills(formData);
  const supabase = await createClient();
  const { error } = await supabase.from("staff").update({ skills }).eq("id", id);

  if (error) {
    redirect(
      `/dashboard/staff/${id}?error=${encodeURIComponent(error.message)}`
    );
  }

  revalidatePath("/dashboard/staff");
  revalidatePath(`/dashboard/staff/${id}`);
  revalidatePath("/dashboard/settings/users");
  revalidatePath(`/dashboard/settings/users/staff/${id}`);
  revalidatePath("/dashboard");
  redirect(`/dashboard/staff/${id}?updated=1`);
}

export async function updateStaff(formData: FormData) {
  if (!isSupabaseConfigured()) {
    redirect("/dashboard/staff?error=not_configured");
  }
  const id = String(formData.get("id") ?? "").trim();
  const returnTo = String(formData.get("return_to") ?? "dashboard");
  if (!id) {
    redirect("/dashboard/staff?error=invalid");
  }

  const paths = staffUpdateRedirectBase(id, returnTo);

  const supabase = await createClient();
  const row = staffRowFromForm(formData);
  const editMode = String(formData.get("staff_edit_mode") ?? "");
  if (editMode === "settings_no_skills") {
    const { data: cur } = await supabase
      .from("staff")
      .select("skills")
      .eq("id", id)
      .maybeSingle();
    row.skills = Array.isArray(cur?.skills) ? (cur!.skills as string[]) : [];
  }

  if (!row.name) {
    redirect(`${paths.detail}?error=name`);
  }

  const history = parseWorkHistoryJson(
    String(formData.get("work_history_json") ?? "")
  );

  const { error } = await supabase.from("staff").update(row).eq("id", id);

  if (error) {
    redirect(`${paths.detail}?error=${encodeURIComponent(error.message)}`);
  }

  try {
    await replaceWorkHistory(id, history);
  } catch (e) {
    redirect(
      `${paths.detail}?error=${encodeURIComponent(e instanceof Error ? e.message : "history")}`
    );
  }

  revalidatePath("/dashboard/staff");
  revalidatePath(`/dashboard/staff/${id}`);
  revalidatePath("/dashboard/settings/users");
  revalidatePath(`/dashboard/settings/users/staff/${id}`);
  revalidatePath("/dashboard");
  redirect(`${paths.detail}?updated=1`);
}

export async function deleteStaff(formData: FormData) {
  if (!isSupabaseConfigured()) {
    redirect("/dashboard/settings/users?error=not_configured");
  }
  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    redirect("/dashboard/settings/users?error=invalid");
  }

  const supabase = await createClient();
  const actor = await getCurrentProfile(supabase);
  if (!actor || !isAppManagerRole(actor.role)) {
    redirect(
      `/dashboard/settings/users/staff/${id}?error=${encodeURIComponent("権限がありません")}`
    );
  }

  const { data: staffRow, error: fetchErr } = await supabase
    .from("staff")
    .select("id, email")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr || !staffRow) {
    redirect("/dashboard/settings/users?error=not_found");
  }

  let authUserId: string | null = null;
  let targetRole: AppRole | null = null;
  if (isServiceRoleConfigured() && staffRow.email?.trim()) {
    try {
      const admin = createServiceRoleClient();
      const u = await findAuthUserByEmail(admin, staffRow.email.trim());
      if (u) {
        authUserId = u.id;
        const { data: pr } = await admin
          .from("profiles")
          .select("role")
          .eq("id", u.id)
          .maybeSingle();
        targetRole = (pr?.role as AppRole) ?? "staff";
      }
    } catch {
      authUserId = null;
    }
  }

  if (authUserId && authUserId === actor.id) {
    redirect(
      `/dashboard/settings/users/staff/${id}?error=${encodeURIComponent("自分自身の名簿は削除できません")}`
    );
  }
  if (actor.role === "team_leader" && targetRole === "admin") {
    redirect(
      `/dashboard/settings/users/staff/${id}?error=${encodeURIComponent("管理者のアカウントは削除できません")}`
    );
  }

  const { error } = await supabase.from("staff").delete().eq("id", id);

  if (error) {
    redirect(
      `/dashboard/settings/users/staff/${id}?error=${encodeURIComponent(error.message)}`
    );
  }

  if (authUserId && isServiceRoleConfigured()) {
    const admin = createServiceRoleClient();
    const { error: authErr } = await admin.auth.admin.deleteUser(authUserId);
    if (authErr) {
      revalidatePath("/dashboard/staff");
      revalidatePath("/dashboard/settings/users");
      revalidatePath("/dashboard");
      redirect("/dashboard/settings/users?staff_deleted=1&auth_orphan=1");
    }
  }

  revalidatePath("/dashboard/staff");
  revalidatePath("/dashboard/settings/users");
  revalidatePath("/dashboard");
  redirect("/dashboard/settings/users?staff_deleted=1");
}

/** 名簿のメールに紐づくログインのパスワードを再設定（管理者・TL、サービスロール必須） */
export async function resetStaffAccountPassword(formData: FormData) {
  const staffId = String(formData.get("staff_id") ?? "").trim();
  const password = String(formData.get("new_password") ?? "");
  const confirm = String(formData.get("confirm_password") ?? "");
  const base = `/dashboard/settings/users/staff/${staffId}`;

  if (!isSupabaseConfigured() || !staffId) {
    redirect(`${base}?error=${encodeURIComponent("不正なリクエストです")}`);
  }

  const supabase = await createClient();
  const actor = await getCurrentProfile(supabase);
  if (!actor || !isAppManagerRole(actor.role)) {
    redirect(`${base}?error=${encodeURIComponent("権限がありません")}`);
  }
  if (!isServiceRoleConfigured()) {
    redirect(
      `${base}?error=${encodeURIComponent("SUPABASE_SERVICE_ROLE_KEY が必要です")}`
    );
  }

  if (password.length < 6) {
    redirect(
      `${base}?error=${encodeURIComponent("パスワードは6文字以上にしてください")}`
    );
  }
  if (password !== confirm) {
    redirect(`${base}?error=${encodeURIComponent("パスワードが一致しません")}`);
  }

  const { data: staffRow, error: fetchErr } = await supabase
    .from("staff")
    .select("email")
    .eq("id", staffId)
    .maybeSingle();

  if (fetchErr || !staffRow?.email?.trim()) {
    redirect(
      `${base}?error=${encodeURIComponent("名簿にメールが登録されていません")}`
    );
  }

  const admin = createServiceRoleClient();
  let authUserId: string | null = null;
  let targetRole: AppRole | null = null;
  try {
    const u = await findAuthUserByEmail(admin, staffRow.email.trim());
    if (u) {
      authUserId = u.id;
      const { data: pr } = await admin
        .from("profiles")
        .select("role")
        .eq("id", u.id)
        .maybeSingle();
      targetRole = (pr?.role as AppRole) ?? "staff";
    }
  } catch (e) {
    redirect(
      `${base}?error=${encodeURIComponent(e instanceof Error ? e.message : "ユーザーの検索に失敗しました")}`
    );
  }

  if (!authUserId) {
    redirect(
      `${base}?error=${encodeURIComponent("このメールのログインアカウントが見つかりません")}`
    );
  }

  if (actor.role === "team_leader" && targetRole === "admin") {
    redirect(
      `${base}?error=${encodeURIComponent("管理者のパスワードは変更できません")}`
    );
  }

  const { error: upErr } = await admin.auth.admin.updateUserById(authUserId, {
    password,
  });

  if (upErr) {
    redirect(
      `${base}?error=${encodeURIComponent(upErr.message ?? "パスワードの更新に失敗しました")}`
    );
  }

  revalidatePath(base);
  redirect(`${base}?password_reset=1`);
}

export async function addStaffNgStore(formData: FormData) {
  if (!isSupabaseConfigured()) {
    redirect("/dashboard/settings/users?error=not_configured");
  }
  const staff_id = String(formData.get("staff_id") ?? "").trim();
  const store_id = String(formData.get("store_id") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim() || null;
  const formContext = String(formData.get("form_context") ?? "dashboard");
  if (!staff_id || !store_id) {
    const base =
      formContext === "settings"
        ? `/dashboard/settings/users/staff/${staff_id}`
        : `/dashboard/staff/${staff_id}`;
    redirect(`${base}?error=ng_required`);
  }

  const supabase = await createClient();
  const { error } = await supabase.from("staff_ng_stores").insert({
    staff_id,
    store_id,
    reason,
  });

  if (error) {
    const base =
      formContext === "settings"
        ? `/dashboard/settings/users/staff/${staff_id}`
        : `/dashboard/staff/${staff_id}`;
    redirect(`${base}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/dashboard/staff/${staff_id}`);
  revalidatePath(`/dashboard/settings/users/staff/${staff_id}`);
  if (formContext === "settings") {
    redirect(`/dashboard/settings/users/staff/${staff_id}?ng_added=1`);
  }
  redirect(`/dashboard/staff/${staff_id}?ng_added=1`);
}

export async function removeStaffNgStore(formData: FormData) {
  if (!isSupabaseConfigured()) {
    redirect("/dashboard/settings/users?error=not_configured");
  }
  const rowId = String(formData.get("ng_id") ?? "").trim();
  const staff_id = String(formData.get("staff_id") ?? "").trim();
  const formContext = String(formData.get("form_context") ?? "dashboard");
  if (!rowId || !staff_id) {
    redirect("/dashboard/settings/users?error=invalid");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("staff_ng_stores")
    .delete()
    .eq("id", rowId);

  if (error) {
    const base =
      formContext === "settings"
        ? `/dashboard/settings/users/staff/${staff_id}`
        : `/dashboard/staff/${staff_id}`;
    redirect(`${base}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/dashboard/staff/${staff_id}`);
  revalidatePath(`/dashboard/settings/users/staff/${staff_id}`);
  if (formContext === "settings") {
    redirect(`/dashboard/settings/users/staff/${staff_id}?ng_removed=1`);
  }
  redirect(`/dashboard/staff/${staff_id}?ng_removed=1`);
}

const STAFF_NEW = "/dashboard/settings/users/staff/new";

/** ログイン作成 + 名簿フル登録（設定のスタッフ登録） */
export async function registerStaffWithAccount(formData: FormData) {
  const supabase = await createClient();
  const actor = await getCurrentProfile(supabase);
  if (!actor || !isAppManagerRole(actor.role)) {
    redirect(`${STAFF_NEW}?error=${encodeURIComponent("権限がありません")}`);
  }
  if (!isSupabaseConfigured()) {
    redirect(`${STAFF_NEW}?error=${encodeURIComponent("Supabase が未設定です")}`);
  }
  if (!isServiceRoleConfigured()) {
    redirect(
      `${STAFF_NEW}?error=${encodeURIComponent("SUPABASE_SERVICE_ROLE_KEY が必要です")}`
    );
  }

  const emailRaw = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("display_name") ?? "").trim();
  const role = parseAppRole(formData.get("role"));
  const sendGoogleGuide = String(formData.get("send_google_guide") ?? "") === "1";

  if (!emailRaw || !password) {
    redirect(
      `${STAFF_NEW}?error=${encodeURIComponent("メールアドレスとパスワードは必須です")}`
    );
  }
  if (!role) {
    redirect(`${STAFF_NEW}?error=${encodeURIComponent("権限を選択してください")}`);
  }
  if (actor.role === "team_leader" && role === "admin") {
    redirect(
      `${STAFF_NEW}?error=${encodeURIComponent("チームリーダーは管理者ロールを付与できません")}`
    );
  }

  const row = staffRowFromForm(formData);
  if (!row.name) {
    redirect(`${STAFF_NEW}?error=${encodeURIComponent("氏名は必須です")}`);
  }

  const emailNorm = emailRaw.toLowerCase();
  const rowEmail = row.email?.trim().toLowerCase();
  if (rowEmail && rowEmail !== emailNorm) {
    redirect(
      `${STAFF_NEW}?error=${encodeURIComponent("ログイン用メールと基本情報のメールが一致しません")}`
    );
  }

  const admin = createServiceRoleClient();

  const { data: dup } = await admin
    .from("staff")
    .select("id")
    .eq("email", emailNorm)
    .maybeSingle();
  if (dup) {
    redirect(
      `${STAFF_NEW}?error=${encodeURIComponent("このメールのスタッフは既に登録されています")}`
    );
  }

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: emailNorm,
    password,
    email_confirm: true,
    user_metadata: {
      display_name: displayName || row.name || emailNorm.split("@")[0],
      app_role: role,
    },
  });

  if (createErr || !created.user) {
    redirect(
      `${STAFF_NEW}?error=${encodeURIComponent(createErr?.message ?? "アカウントの作成に失敗しました")}`
    );
  }

  const insertRow = { ...row, email: emailNorm, tenant_id: actor.tenant_id };

  const { data: inserted, error: insErr } = await admin
    .from("staff")
    .insert(insertRow)
    .select("id")
    .single();

  if (insErr || !inserted) {
    await admin.auth.admin.deleteUser(created.user.id);
    redirect(
      `${STAFF_NEW}?error=${encodeURIComponent(insErr?.message ?? "名簿の登録に失敗しました")}`
    );
  }

  try {
    const history = parseWorkHistoryJson(
      String(formData.get("work_history_json") ?? "")
    );
    await replaceWorkHistory(inserted.id, history);
  } catch (e) {
    await admin.from("staff").delete().eq("id", inserted.id);
    await admin.auth.admin.deleteUser(created.user.id);
    redirect(
      `${STAFF_NEW}?error=${encodeURIComponent(e instanceof Error ? e.message : "職務経歴の保存に失敗しました")}`
    );
  }

  revalidatePath("/dashboard/settings/users");
  revalidatePath(`/dashboard/settings/users/staff/${inserted.id}`);
  revalidatePath("/dashboard/staff");
  revalidatePath("/dashboard");
  if (sendGoogleGuide) {
    const notice = await createGoogleLinkNotification({
      staffId: inserted.id,
      tenantId: actor.tenant_id,
      staffName: row.name,
      staffEmail: emailNorm,
    });
    if (!notice.ok) {
      redirect(
        `/dashboard/settings/users/staff/${inserted.id}?registered=1&google_notice_failed=1`
      );
    }
    redirect(
      `/dashboard/settings/users/staff/${inserted.id}?registered=1&google_notice_sent=1`
    );
  }
  redirect(`/dashboard/settings/users/staff/${inserted.id}?registered=1`);
}
