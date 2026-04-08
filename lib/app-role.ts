export type AppRole = "admin" | "team_leader" | "staff";

export const APP_ROLE_LABELS: Record<AppRole, string> = {
  admin: "管理者",
  team_leader: "チームリーダー",
  staff: "スタッフ",
};

export function isAppManagerRole(role: AppRole): boolean {
  return role === "admin" || role === "team_leader";
}
