import { StaffBirthDateWithAge } from "@/components/staff-birth-date-age";
import { StaffSkillFields } from "@/components/staff-skill-fields";
import { StaffWorkHistoryEditor } from "@/components/staff-work-history-editor";
import type { WorkHistoryRowState } from "@/components/staff-work-history-editor";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";

export type StaffProfileFormDefaults = {
  name: string;
  name_kana: string;
  gender: string;
  birth_date: string;
  address: string;
  preferred_work_location: string;
  nearest_station: string;
  has_car: string;
  commute_time_preference: string;
  can_business_trip: string;
  can_weekend_holiday: string;
  preferred_shift_start: string;
  email: string;
  phone: string;
  notes: string;
  pr_notes: string;
  skillPresetKeys: Set<string>;
  skillsCustom: string;
  workHistoryRows: WorkHistoryRowState[];
};

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

type Props = {
  defaults: StaffProfileFormDefaults;
  showId?: string;
  /** 設定のスタッフ詳細: 保存後のリダイレクト先 */
  returnToSettings?: boolean;
  /** 設定詳細ではスキルを編集しない（DB のスキルはサーバーで維持） */
  hideSkills?: boolean;
  /** 登録フォームでメールは別カードに置く場合 */
  hideEmailField?: boolean;
};

export function StaffProfileFormFields({
  defaults,
  showId,
  returnToSettings,
  hideSkills,
  hideEmailField,
}: Props) {
  return (
    <div className="space-y-6 max-w-2xl">
      {showId && <input type="hidden" name="id" value={showId} />}
      {returnToSettings && (
        <input type="hidden" name="return_to" value="settings" />
      )}
      {hideSkills && (
        <input type="hidden" name="staff_edit_mode" value="settings_no_skills" />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">基本</CardTitle>
          <CardDescription>氏名・連絡先・属性</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="name">氏名</Label>
              <Input
                id="name"
                name="name"
                required
                autoComplete="name"
                defaultValue={defaults.name}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="name_kana">氏名（ふりがな）</Label>
              <Input
                id="name_kana"
                name="name_kana"
                placeholder="やまだ たろう"
                defaultValue={defaults.name_kana}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gender">性別</Label>
              <select
                id="gender"
                name="gender"
                className={selectClass}
                defaultValue={defaults.gender}
              >
                <option value="">未選択</option>
                <option value="male">男性</option>
                <option value="female">女性</option>
                <option value="other">その他</option>
                <option value="unspecified">回答しない</option>
              </select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <StaffBirthDateWithAge
                key={showId ?? "new"}
                defaultBirthDate={defaults.birth_date}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="address">住所</Label>
              <Input
                id="address"
                name="address"
                autoComplete="street-address"
                defaultValue={defaults.address}
              />
            </div>
            {!hideEmailField && (
              <div className="space-y-2">
                <Label htmlFor="email">メール</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  defaultValue={defaults.email}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="phone">電話</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                defaultValue={defaults.phone}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">勤務・通勤</CardTitle>
          <CardDescription>希望条件・稼働可否</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="preferred_work_location">希望勤務地</Label>
            <Input
              id="preferred_work_location"
              name="preferred_work_location"
              placeholder="例: 首都圏 / 大阪府内"
              defaultValue={defaults.preferred_work_location}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nearest_station">最寄駅</Label>
            <Input
              id="nearest_station"
              name="nearest_station"
              defaultValue={defaults.nearest_station}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="has_car">車の有無</Label>
              <select
                id="has_car"
                name="has_car"
                className={selectClass}
                defaultValue={defaults.has_car}
              >
                <option value="">未選択</option>
                <option value="true">あり</option>
                <option value="false">なし</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="commute_time_preference">通勤希望時間</Label>
              <Input
                id="commute_time_preference"
                name="commute_time_preference"
                placeholder="例: 片道90分まで"
                defaultValue={defaults.commute_time_preference}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="can_business_trip">出張</Label>
              <select
                id="can_business_trip"
                name="can_business_trip"
                className={selectClass}
                defaultValue={defaults.can_business_trip}
              >
                <option value="">未選択</option>
                <option value="yes">可能</option>
                <option value="no">不可</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="can_weekend_holiday">土日祝の出勤</Label>
              <select
                id="can_weekend_holiday"
                name="can_weekend_holiday"
                className={selectClass}
                defaultValue={defaults.can_weekend_holiday}
              >
                <option value="">未選択</option>
                <option value="yes">可能</option>
                <option value="no">不可</option>
              </select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="preferred_shift_start">出勤開始希望時間</Label>
              <Input
                id="preferred_shift_start"
                name="preferred_shift_start"
                placeholder="例: 10時以降 / 9:00〜"
                defaultValue={defaults.preferred_shift_start}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {!hideSkills && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">スキル</CardTitle>
          </CardHeader>
          <CardContent>
            <StaffSkillFields
              selectedPresets={defaults.skillPresetKeys}
              skillsCustomDefault={defaults.skillsCustom}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">PR・共有メモ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pr_notes">その他 PR ポイント</Label>
            <Textarea
              id="pr_notes"
              name="pr_notes"
              rows={4}
              placeholder="アピールしたい経験・資格など"
              defaultValue={defaults.pr_notes}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">注意・キャンセル履歴・共有メモ</Label>
            <Textarea
              id="notes"
              name="notes"
              rows={4}
              placeholder="運用共有・トラブル注意など"
              defaultValue={defaults.notes}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">職務経歴</CardTitle>
          <CardDescription>
            年・月・勤務期間・職務内容を行で追加できます。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StaffWorkHistoryEditor initialRows={defaults.workHistoryRows} />
        </CardContent>
      </Card>

      <Separator />
    </div>
  );
}
