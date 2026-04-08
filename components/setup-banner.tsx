import Link from "next/link";
import { AlertCircle } from "lucide-react";

export function SetupBanner() {
  return (
    <div className="mb-4 flex gap-3 rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="space-y-1">
        <p className="font-medium">デモ表示中</p>
        <p className="text-muted-foreground">
          Supabase を未設定のためデータは保存されません。{" "}
          <Link href="/login" className="underline underline-offset-4">
            ログイン
          </Link>
          ページに環境変数の手順があります。
        </p>
      </div>
    </div>
  );
}
