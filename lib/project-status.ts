import type { ProjectStatus } from "@/lib/types/database";

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  proposal: "提案中",
  ordered: "受注",
  staffing: "スタッフ手配中",
  in_progress: "実施中",
  completed: "完了",
  invoiced: "請求済",
};

export const PROJECT_STATUS_ORDER: ProjectStatus[] = [
  "proposal",
  "ordered",
  "staffing",
  "in_progress",
  "completed",
  "invoiced",
];
