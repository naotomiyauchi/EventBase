"use client";

import { useTransition } from "react";
import { setShiftBoardCellAction } from "@/app/actions/shift-board";

type Props = {
  date: string; // YYYY-MM-DD (JST)
  staffId: string;
  currentProjectId: string | null;
  currentRole: "leader" | "helper" | null;
  projects: { id: string; title: string }[];
  isUnavailable?: boolean;
  unavailableReason?: string | null;
};

export function ShiftBoardCell({
  date,
  staffId,
  currentProjectId,
  currentRole,
  projects,
  isUnavailable = false,
  unavailableReason = null,
}: Props) {
  const [pending, startTransition] = useTransition();

  function submit(fd: FormData) {
    startTransition(async () => {
      await setShiftBoardCellAction(fd);
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <select
        disabled={pending || isUnavailable}
        value={currentProjectId ?? ""}
        onChange={(e) => {
          const fd = new FormData();
          fd.set("shift_date", date);
          fd.set("staff_id", staffId);
          fd.set("project_id", e.target.value);
          fd.set("role", currentRole ?? "helper");
          submit(fd);
        }}
        className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm outline-none"
      >
        <option value="">—</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.title}
          </option>
        ))}
      </select>
      {currentProjectId && (
        <select
          disabled={pending || isUnavailable}
          value={currentRole ?? "helper"}
          onChange={(e) => {
            const fd = new FormData();
            fd.set("shift_date", date);
            fd.set("staff_id", staffId);
            fd.set("project_id", currentProjectId);
            fd.set("role", e.target.value);
            submit(fd);
          }}
          className="h-7 w-full rounded-md border border-input bg-muted/30 px-2 text-xs outline-none"
        >
          <option value="leader">リーダー</option>
          <option value="helper">ヘルパー</option>
        </select>
      )}
      {isUnavailable ? (
        <p className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
          希望休{unavailableReason ? `: ${unavailableReason}` : ""}
        </p>
      ) : null}
    </div>
  );
}

