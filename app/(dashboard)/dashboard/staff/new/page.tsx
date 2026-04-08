import { redirect } from "next/navigation";

/** スタッフの新規登録は設定の「スタッフ（アカウント）の登録」のみ */
export default function StaffNewRedirectPage() {
  redirect("/dashboard/settings/users");
}
