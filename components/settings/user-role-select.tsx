"use client";

import { useRouter } from "next/navigation";
import type { AppRole } from "@/lib/app-role";
import { APP_ROLE_LABELS } from "@/lib/app-role";
import { updateUserRoleAction } from "@/app/actions/users";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  userId: string;
  currentRole: AppRole;
};

export function UserRoleSelect({ userId, currentRole }: Props) {
  const router = useRouter();

  async function onChange(next: AppRole) {
    if (next === currentRole) return;
    const fd = new FormData();
    fd.set("user_id", userId);
    fd.set("role", next);
    const res = await updateUserRoleAction(fd);
    if (res.ok) {
      router.refresh();
    } else {
      window.alert(res.error);
    }
  }

  return (
    <Select
      value={currentRole}
      onValueChange={(v) => onChange(v as AppRole)}
    >
      <SelectTrigger className="h-8 w-[140px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(APP_ROLE_LABELS) as AppRole[]).map((r) => (
          <SelectItem key={r} value={r}>
            {APP_ROLE_LABELS[r]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
