"use client";

import { useMemo, useState } from "react";
import { computeAgeFromBirthDate } from "@/lib/staff-age";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  defaultBirthDate: string;
};

export function StaffBirthDateWithAge({ defaultBirthDate }: Props) {
  const [birthDate, setBirthDate] = useState(defaultBirthDate);

  const age = useMemo(
    () => computeAgeFromBirthDate(birthDate || null),
    [birthDate]
  );

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="birth_date">生年月日</Label>
        <Input
          id="birth_date"
          name="birth_date"
          type="date"
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>年齢（自動計算）</Label>
        <div className="flex h-9 items-center rounded-md border border-dashed border-border bg-muted/50 px-3 text-sm text-muted-foreground">
          {age != null ? <span className="text-foreground">{age} 歳</span> : "—"}
        </div>
        <p className="text-xs text-muted-foreground">
          保存時に DB にも反映されます。
        </p>
      </div>
    </div>
  );
}
