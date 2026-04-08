"use client";

import { deleteStaff } from "@/app/actions/staff";
import { Button } from "@/components/ui/button";

export function StaffDeleteForm({
  staffId,
  hasLinkedAccount,
}: {
  staffId: string;
  hasLinkedAccount?: boolean;
}) {
  const msg = hasLinkedAccount
    ? "このスタッフ名簿と、同じメールのログインアカウントを削除します。NGイベントの登録もまとめて削除されます。よろしいですか？"
    : "このスタッフ名簿を削除しますか？NGイベントの登録もまとめて削除されます。";

  return (
    <form
      action={deleteStaff}
      onSubmit={(e) => {
        if (!confirm(msg)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={staffId} />
      <Button type="submit" variant="destructive" size="sm">
        スタッフを削除
      </Button>
    </form>
  );
}
