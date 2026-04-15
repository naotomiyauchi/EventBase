import { redirect } from "next/navigation";

export default async function StoresPage({
  searchParams: _searchParams,
}: {
  searchParams: Promise<{ created?: string; updated?: string; deleted?: string; error?: string }>;
}) {
  await _searchParams;
  redirect("/dashboard/projects");
}
