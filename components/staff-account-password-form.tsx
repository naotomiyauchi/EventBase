import { resetStaffAccountPassword } from "@/app/actions/staff";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function StaffAccountPasswordForm({ staffId }: { staffId: string }) {
  return (
    <form action={resetStaffAccountPassword} className="max-w-md space-y-4">
      <input type="hidden" name="staff_id" value={staffId} />
      <div className="space-y-2">
        <Label htmlFor="new_password">新しいパスワード</Label>
        <Input
          id="new_password"
          name="new_password"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm_password">新しいパスワード（確認）</Label>
        <Input
          id="confirm_password"
          name="confirm_password"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
        />
      </div>
      <Button type="submit" variant="secondary" size="sm">
        パスワードを更新
      </Button>
    </form>
  );
}
