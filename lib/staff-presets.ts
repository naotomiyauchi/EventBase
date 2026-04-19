/** スキルプリセット（チェックボックス用）。自由入力とマージして保存 */
export const STAFF_SKILL_PRESETS = [
  "キャッチ",
  "興味ずけ",
  "クローズ",
  "受付",
  "デュレクター",
] as const;

export type StaffSkillPreset = (typeof STAFF_SKILL_PRESETS)[number];

const PRESET_SET = new Set<string>(STAFF_SKILL_PRESETS);

/** DB の skills 配列をプリセット選択と「その他」文字列に分ける */
export function splitStaffSkills(skills: string[]): {
  selectedPresets: Set<string>;
  skillsCustom: string;
} {
  const selectedPresets = new Set<string>();
  const other: string[] = [];
  for (const s of skills) {
    if (PRESET_SET.has(s)) {
      selectedPresets.add(s);
    } else {
      other.push(s);
    }
  }
  return {
    selectedPresets,
    skillsCustom: other.join(", "),
  };
}
