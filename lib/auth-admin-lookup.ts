import type { SupabaseClient, User } from "@supabase/supabase-js";

/**
 * Service Role クライアントで auth.users を走査し、メール一致ユーザーを返す。
 */
export async function findAuthUserByEmail(
  admin: SupabaseClient,
  email: string
): Promise<User | null> {
  const target = email.trim().toLowerCase();
  if (!target) return null;
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;
    const found = data.users.find(
      (u) => (u.email ?? "").toLowerCase() === target
    );
    if (found) return found;
    if (!data.nextPage) return null;
    page = data.nextPage;
  }
}
