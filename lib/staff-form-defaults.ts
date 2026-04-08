import type { StaffProfileFormDefaults } from "@/components/staff-profile-form-fields";
import { workHistoryToRowsForEditor } from "@/lib/staff-work-history";
import { splitStaffSkills } from "@/lib/staff-presets";

export function emptyStaffFormDefaults(): StaffProfileFormDefaults {
  return {
    name: "",
    name_kana: "",
    gender: "",
    birth_date: "",
    address: "",
    preferred_work_location: "",
    nearest_station: "",
    has_car: "",
    commute_time_preference: "",
    can_business_trip: "",
    can_weekend_holiday: "",
    preferred_shift_start: "",
    email: "",
    phone: "",
    notes: "",
    pr_notes: "",
    skillPresetKeys: new Set(),
    skillsCustom: "",
    workHistoryRows: [],
  };
}

export type StaffRow = {
  name: string;
  name_kana?: string | null;
  gender?: string | null;
  birth_date?: string | null;
  age_years?: number | null;
  address?: string | null;
  base_address?: string | null;
  preferred_work_location?: string | null;
  nearest_station?: string | null;
  has_car?: boolean | null;
  commute_time_preference?: string | null;
  can_business_trip?: string | null;
  can_weekend_holiday?: string | null;
  preferred_shift_start?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  pr_notes?: string | null;
  skills?: string[] | null;
};

export type StaffHistoryRow = {
  year: number | null;
  month: number | null;
  period_label: string | null;
  job_content: string | null;
};

export function staffRecordToFormDefaults(
  staff: StaffRow,
  history: StaffHistoryRow[]
): StaffProfileFormDefaults {
  const skills = (staff.skills ?? []) as string[];
  const { selectedPresets, skillsCustom } = splitStaffSkills(skills);

  const birth = staff.birth_date;
  const birthDate =
    typeof birth === "string" && birth.length >= 10 ? birth.slice(0, 10) : "";

  const addr = staff.address ?? staff.base_address ?? "";

  return {
    name: staff.name,
    name_kana: staff.name_kana ?? "",
    gender: staff.gender ?? "",
    birth_date: birthDate,
    address: addr,
    preferred_work_location: staff.preferred_work_location ?? "",
    nearest_station: staff.nearest_station ?? "",
    has_car:
      staff.has_car === true ? "true" : staff.has_car === false ? "false" : "",
    commute_time_preference: staff.commute_time_preference ?? "",
    can_business_trip: staff.can_business_trip ?? "",
    can_weekend_holiday: staff.can_weekend_holiday ?? "",
    preferred_shift_start: staff.preferred_shift_start ?? "",
    email: staff.email ?? "",
    phone: staff.phone ?? "",
    notes: staff.notes ?? "",
    pr_notes: staff.pr_notes ?? "",
    skillPresetKeys: selectedPresets,
    skillsCustom: skillsCustom,
    workHistoryRows: workHistoryToRowsForEditor(history),
  };
}
