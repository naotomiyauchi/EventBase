import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth-profile";
import { isAppManagerRole } from "@/lib/app-role";

export default async function LineSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile || !isAppManagerRole(profile.role)) notFound();

  const [{ data: links }, { data: logs }] = await Promise.all([
    supabase
      .from("line_user_links")
      .select("staff ( name, email ), line_user_id, linked_at")
      .order("linked_at", { ascending: false })
      .limit(50),
    supabase
      .from("line_webhook_logs")
      .select("event_type, line_user_id, status, note, created_at")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">LINE連携</h2>
        <p className="text-sm text-muted-foreground">
          リッチメニューは LINE 側で作成し、下記の「送信する文言」と一致させてください。Webhook がメッセージ内容で連携・希望休などを判別します。
        </p>
      </div>

      {sp.error ? (
        <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {decodeURIComponent(sp.error)}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">このシステムと連携するリッチメニューの作り方</CardTitle>
          <CardDescription>
            LINE Official Account Manager または LINE Developers のリッチメニュー機能で、手動作成・公開します。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <ol className="list-decimal space-y-2 pl-5 text-muted-foreground">
            <li>
              <span className="text-foreground">サイズ</span>
              ：テンプレートは LINE の指定サイズに合わせます（例: フル幅 2500×1686）。画像をアップロードし、タップ領域を配置します。
            </li>
            <li>
              <span className="text-foreground">アクション種別</span>
              ：各ボタンは「
              <strong className="text-foreground">メッセージを送信</strong>
              」（Messaging API では <code className="text-xs">type: message</code>
              ）にします。URI オープンやポストバックだけでは、本システムの会話フローは動きません。
            </li>
            <li>
              <span className="text-foreground">送信テキスト（必ず一致）</span>
              ：ボタンごとに送る文字列は次のいずれかと
              <strong className="text-foreground">完全一致</strong>
              にしてください（前後に空白・改行を付けない）。
              <ul className="mt-2 list-disc space-y-1 pl-5 font-mono text-xs text-foreground">
                <li>
                  <code>連携設定</code> … スタッフがメールアドレスを送る前の案内を返します。
                </li>
                <li>
                  <code>希望休入力</code> … 希望休の入力モードに入ります。
                </li>
                <li>
                  <code>使い方</code> … 簡易ヘルプを返します（<code>help</code> / <code>ヘルプ</code> でも可）。
                </li>
                <li>
                  <code>シフト</code> … 連携済みの場合、管理画面の「通知」に届きます（希望休入力モードには入りません）。
                </li>
              </ul>
            </li>
            <li>
              <span className="text-foreground">希望休の送り方（メッセージ本文）</span>
              ：モード案内後、ユーザーが送るテキスト例は{" "}
              <code className="text-xs">2026-04-30 私用</code> または{" "}
              <code className="text-xs">希望休 2026-04-30 私用</code> です。
            </li>
            <li>
              <span className="text-foreground">領収書（任意）</span>
              ：トークで <code className="text-xs">領収書</code> などと送ると画像受付モードに入ります。リッチメニューに同じ文言のボタンを付けても構いません。
            </li>
            <li>
              <span className="text-foreground">公開</span>
              ：リッチメニューを作成したら、デフォルト表示や対象ユーザーへのリンクを LINE 管理画面で有効化します。
            </li>
          </ol>
          <p className="text-xs text-muted-foreground">
            公式ドキュメント:{" "}
            <a
              href="https://developers.line.biz/ja/docs/messaging-api/use-rich-menus/"
              className="underline underline-offset-2"
              target="_blank"
              rel="noreferrer"
            >
              リッチメニューの使い方（LINE Developers）
            </a>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">連携済みスタッフ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(links ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">まだ連携はありません。</p>
          ) : (
            (links ?? []).map((l, i) => {
              const s = Array.isArray(l.staff) ? l.staff[0] : l.staff;
              return (
                <div key={`${l.line_user_id}-${i}`} className="rounded border px-3 py-2 text-sm">
                  <p className="font-medium">{s?.name ?? "スタッフ不明"}</p>
                  <p className="text-xs text-muted-foreground">
                    {s?.email ?? "メール未設定"} / LINE: {l.line_user_id}
                  </p>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Webhookログ（最新20件）</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(logs ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">ログはまだありません。</p>
          ) : (
            (logs ?? []).map((l, i) => (
              <div key={`${l.created_at}-${i}`} className="rounded border px-3 py-2 text-xs">
                <p>
                  {l.created_at} / {l.event_type} / {l.status}
                </p>
                <p className="text-muted-foreground">
                  {l.line_user_id ?? "line_user_idなし"} {l.note ? `/ ${l.note}` : ""}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
