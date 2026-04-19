"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isAppManagerRole } from "@/lib/app-role";
import { getCurrentProfile } from "@/lib/auth-profile";
import { createClient } from "@/lib/supabase/server";

function safeMonth(month: string | null): string | null {
  if (!month) return null;
  return /^\d{4}-\d{2}$/.test(month) ? month : null;
}

export async function updateFinanceReceiptAction(formData: FormData) {
  const supabase = await createClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile || !isAppManagerRole(profile.role)) {
    redirect("/dashboard/finance?error=forbidden");
  }

  const id = String(formData.get("id") ?? "").trim();
  const month = safeMonth(String(formData.get("month") ?? "").trim());
  const vendor = String(formData.get("vendor") ?? "").trim() || null;
  const category = String(formData.get("category") ?? "").trim() || "other";
  const payment_method = String(formData.get("payment_method") ?? "").trim() || "other";
  const project_id = String(formData.get("project_id") ?? "").trim() || null;
  const memo = String(formData.get("memo") ?? "").trim() || null;
  const amountRaw = Number(String(formData.get("amount") ?? "0"));
  const taxRaw = Number(String(formData.get("tax_amount") ?? "0"));

  if (!id) {
    redirect(`/dashboard/finance${month ? `?month=${month}` : ""}&error=invalid`);
  }

  const amount = Number.isFinite(amountRaw) ? Math.max(0, Math.round(amountRaw)) : 0;
  const tax_amount = Number.isFinite(taxRaw) ? Math.max(0, Math.round(taxRaw)) : 0;

  const { error } = await supabase
    .from("finance_receipts")
    .update({
      vendor,
      category,
      payment_method,
      project_id,
      amount,
      tax_amount,
      memo,
    })
    .eq("id", id);
  if (error) {
    redirect(
      `/dashboard/finance${month ? `?month=${month}&` : "?"}error=${encodeURIComponent(error.message)}`
    );
  }

  revalidatePath("/dashboard/finance");
  redirect(`/dashboard/finance${month ? `?month=${month}&` : "?"}updated=receipt`);
}

export async function deleteFinanceReceiptAction(formData: FormData) {
  const supabase = await createClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile || !isAppManagerRole(profile.role)) {
    redirect("/dashboard/finance?error=forbidden");
  }

  const id = String(formData.get("id") ?? "").trim();
  const month = safeMonth(String(formData.get("month") ?? "").trim());
  const filePath = String(formData.get("file_path") ?? "").trim();
  if (!id) {
    redirect(`/dashboard/finance${month ? `?month=${month}` : ""}&error=invalid`);
  }

  const { error } = await supabase.from("finance_receipts").delete().eq("id", id);
  if (error) {
    redirect(
      `/dashboard/finance${month ? `?month=${month}&` : "?"}error=${encodeURIComponent(error.message)}`
    );
  }

  if (filePath) {
    await supabase.storage.from("receipt-files").remove([filePath]);
  }

  revalidatePath("/dashboard/finance");
  redirect(`/dashboard/finance${month ? `?month=${month}&` : "?"}deleted=receipt`);
}
