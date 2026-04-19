import { redirect } from "next/navigation";

/** 旧URL: シフト管理内のタブへ統合 */
export default async function LegacyShiftBoardRedirect({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const sp = await searchParams;
  const m = sp.m;
  if (m !== undefined && m !== "") {
    redirect(`/dashboard/shifts/board?m=${encodeURIComponent(m)}`);
  }
  redirect("/dashboard/shifts/board");
}
