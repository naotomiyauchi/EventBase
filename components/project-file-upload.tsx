"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  projectId: string;
};

export function ProjectFileUpload({ projectId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setLoading(true);
    const supabase = createClient();
    const path = `${projectId}/${Date.now()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
    const { error: upErr } = await supabase.storage
      .from("project-files")
      .upload(path, file, { upsert: false });
    if (upErr) {
      alert(upErr.message);
      setLoading(false);
      return;
    }
    const { error: dbErr } = await supabase.from("project_attachments").insert({
      project_id: projectId,
      file_path: path,
      original_name: file.name,
    });
    setLoading(false);
    if (dbErr) {
      alert(dbErr.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="file">ファイルを追加</Label>
      <Input
        id="file"
        type="file"
        accept="image/*,.pdf,.doc,.docx"
        disabled={loading}
        onChange={(e) => void onFile(e)}
      />
      <p className="text-xs text-muted-foreground">
        レイアウト図・実施要領書など（PDF・画像）
      </p>
      {loading && <p className="text-xs text-muted-foreground">アップロード中…</p>}
    </div>
  );
}
