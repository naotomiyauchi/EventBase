import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  StaffExportHistoryRow,
  StaffExportRecord,
} from "@/lib/staff-export";

const STAFF_SELECT = `
  id,
  name,
  name_kana,
  gender,
  birth_date,
  age_years,
  address,
  base_address,
  preferred_work_location,
  nearest_station,
  has_car,
  commute_time_preference,
  can_business_trip,
  can_weekend_holiday,
  preferred_shift_start,
  pr_notes
`;

/** スタッフ詳細＋職務経歴をエクスポート用にまとめて取得 */
export async function fetchStaffExportBundle(
  supabase: SupabaseClient,
  staffId: string
): Promise<{ record: StaffExportRecord; history: StaffExportHistoryRow[] } | null> {
  const { data: staff, error } = await supabase
    .from("staff")
    .select(STAFF_SELECT)
    .eq("id", staffId)
    .maybeSingle();

  if (error || !staff) return null;

  const { data: wh } = await supabase
    .from("staff_work_history")
    .select("year, month, period_label, job_content")
    .eq("staff_id", staffId)
    .order("sort_order", { ascending: true });

  return {
    record: staff as unknown as StaffExportRecord,
    history: (wh ?? []) as StaffExportHistoryRow[],
  };
}
