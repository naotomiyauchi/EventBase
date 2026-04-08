import { STAFF_SKILL_PRESETS } from "@/lib/staff-presets";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  selectedPresets: Set<string>;
  skillsCustomDefault: string;
};

export function StaffSkillFields({ selectedPresets, skillsCustomDefault }: Props) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-sm font-medium leading-none">スキル（プリセット）</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {STAFF_SKILL_PRESETS.map((s) => (
            <label
              key={s}
              className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-accent/40"
            >
              <input
                type="checkbox"
                name="skill_preset"
                value={s}
                defaultChecked={selectedPresets.has(s)}
                className="size-4 rounded border-input"
              />
              {s}
            </label>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="skills_custom">その他スキル（カンマ区切り）</Label>
        <Input
          id="skills_custom"
          name="skills_custom"
          placeholder="例: 新人フォロー, 夜間のみ"
          defaultValue={skillsCustomDefault}
        />
      </div>
    </div>
  );
}
