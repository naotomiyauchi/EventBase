import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchStaffExportBundle } from "@/lib/fetch-staff-export-bundle";
import { safeFilenameBase } from "@/lib/staff-export";
import { staffExportToPdfBytes } from "@/lib/staff-export-pdf";
import { staffExportToXlsxBuffer } from "@/lib/staff-export-xlsx";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const formatRaw = request.nextUrl.searchParams.get("format") ?? "xlsx";
  const format =
    formatRaw === "spreadsheet" ? "xlsx" : formatRaw;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bundle = await fetchStaffExportBundle(supabase, id);
  if (!bundle) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { record, history } = bundle;
  const base = safeFilenameBase(record.name, id);

  if (format === "xlsx") {
    try {
      const buf = await staffExportToXlsxBuffer(record, history);
      return new NextResponse(new Blob([new Uint8Array(buf)]), {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${base}.xlsx"`,
        },
      });
    } catch (e) {
      console.error("[staff export xlsx]", e);
      return NextResponse.json(
        {
          error: "Excel の生成に失敗しました",
          detail: e instanceof Error ? e.message : String(e),
        },
        { status: 500 }
      );
    }
  }

  if (format === "pdf") {
    try {
      const bytes = await staffExportToPdfBytes(record, history);
      return new NextResponse(Buffer.from(bytes), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${base}.pdf"`,
        },
      });
    } catch (e) {
      console.error("[staff export pdf]", e);
      return NextResponse.json(
        {
          error: "PDF の生成に失敗しました",
          detail: e instanceof Error ? e.message : String(e),
        },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ error: "Invalid format" }, { status: 400 });
}
