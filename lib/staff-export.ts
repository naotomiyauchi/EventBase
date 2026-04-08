import { computeAgeFromBirthDate } from "@/lib/staff-age";

export type StaffExportRecord = {
  name: string;
  name_kana: string | null;
  gender: string | null;
  birth_date: string | null;
  age_years: number | null;
  address: string | null;
  base_address: string | null;
  preferred_work_location: string | null;
  nearest_station: string | null;
  has_car: boolean | null;
  commute_time_preference: string | null;
  can_business_trip: string | null;
  can_weekend_holiday: string | null;
  preferred_shift_start: string | null;
  pr_notes: string | null;
};

export type StaffExportHistoryRow = {
  year: number | null;
  month: number | null;
  period_label: string | null;
  job_content: string | null;
};

function genderJa(v: string | null | undefined): string {
  switch (v) {
    case "male":
      return "男性";
    case "female":
      return "女性";
    case "other":
      return "その他";
    case "unspecified":
      return "回答しない";
    default:
      return "—";
  }
}

function hasCarJa(v: boolean | null | undefined): string {
  if (v === true) return "あり";
  if (v === false) return "なし";
  return "—";
}

function yesNoJa(v: string | null | undefined): string {
  if (v === "yes") return "可能";
  if (v === "no") return "不可";
  return "—";
}

function formatDateJa(iso: string | null | undefined): string {
  if (!iso) return "—";
  const s = String(iso).trim().slice(0, 10);
  return s.length >= 10 ? s : "—";
}

/** 出力用の表示年齢（生年月日優先で自動計算、なければ DB の age_years） */
export function displayExportAge(
  staff: StaffExportRecord
): string {
  const fromBirth = computeAgeFromBirthDate(staff.birth_date);
  if (fromBirth != null) return String(fromBirth);
  if (staff.age_years != null && Number.isFinite(staff.age_years)) {
    return String(staff.age_years);
  }
  return "—";
}

/** ユーザー指定の項目のみ（ラベル・値のペア） */
export function buildStaffExportPairs(
  staff: StaffExportRecord,
  history: StaffExportHistoryRow[]
): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [
    { label: "氏名", value: staff.name || "—" },
    { label: "氏名（ふりがな）", value: staff.name_kana?.trim() || "—" },
    { label: "性別", value: genderJa(staff.gender) },
    { label: "生年月日", value: formatDateJa(staff.birth_date) },
    { label: "年齢", value: displayExportAge(staff) },
    {
      label: "住所",
      value: (staff.address ?? staff.base_address)?.trim() || "—",
    },
    {
      label: "希望勤務地",
      value: staff.preferred_work_location?.trim() || "—",
    },
    { label: "最寄駅", value: staff.nearest_station?.trim() || "—" },
    { label: "車の有無", value: hasCarJa(staff.has_car) },
    {
      label: "通勤希望時間",
      value: staff.commute_time_preference?.trim() || "—",
    },
    { label: "出張", value: yesNoJa(staff.can_business_trip) },
    {
      label: "土日祝の出勤",
      value: yesNoJa(staff.can_weekend_holiday),
    },
    {
      label: "出勤開始希望時間",
      value: staff.preferred_shift_start?.trim() || "—",
    },
  ];

  if (history.length === 0) {
    rows.push({ label: "職務経歴", value: "—" });
  } else {
    history.forEach((h, i) => {
      const parts = [
        h.year != null ? `年: ${h.year}` : null,
        h.month != null ? `月: ${h.month}` : null,
        h.period_label?.trim() ? `勤務期間: ${h.period_label.trim()}` : null,
        h.job_content?.trim() ? `職務内容: ${h.job_content.trim()}` : null,
      ].filter(Boolean);
      rows.push({
        label: `職務経歴 ${i + 1}`,
        value: parts.length > 0 ? parts.join(" / ") : "—",
      });
    });
  }

  rows.push({
    label: "その他 PR ポイント",
    value: staff.pr_notes?.trim() || "—",
  });

  return rows;
}

export function safeFilenameBase(name: string, id: string): string {
  const ascii = name.replace(/[^\w\-._\s]/g, "").trim().slice(0, 40);
  if (ascii.length > 0) return ascii;
  return `staff-${id.slice(0, 8)}`;
}
