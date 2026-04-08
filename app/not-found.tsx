import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6">
      <p className="text-lg font-medium">ページが見つかりません</p>
      <Link
        href="/dashboard"
        className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-2.5 text-sm font-medium hover:bg-muted"
      >
        ダッシュボードへ
      </Link>
    </div>
  );
}
