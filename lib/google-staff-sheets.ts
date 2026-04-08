import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import {
  buildStaffExportPairs,
  type StaffExportHistoryRow,
  type StaffExportRecord,
} from "@/lib/staff-export";

const SHEET_TITLE = "プロフィール";

/** lib/staff-export-pdf.ts の ORANGE / LABEL_BG と揃える */
const HEADER_ORANGE = { red: 1, green: 140 / 255, blue: 0 };
const LABEL_BG = { red: 1, green: 1, blue: 153 / 255 };
const WHITE = { red: 1, green: 1, blue: 1 };
const BLACK = { red: 0, green: 0, blue: 0 };

function safeSpreadsheetTitle(name: string): string {
  const base = name.replace(/[\\/:*?"<>|]/g, "_").trim().slice(0, 60);
  return `スタッフプロフィール_${base || "export"}_${Date.now()}`;
}

/**
 * ユーザーの Google ドライブに新規スプレッドシートを作成し、データを書き込む。
 * 返す URL はブラウザで開ける編集画面。
 */
export async function createStaffGoogleSpreadsheet(
  oauth2: OAuth2Client,
  staff: StaffExportRecord,
  history: StaffExportHistoryRow[]
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  const sheets = google.sheets({ version: "v4", auth: oauth2 });
  const pairs = buildStaffExportPairs(staff, history);
  const title = safeSpreadsheetTitle(staff.name || "staff");

  const created = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title },
      sheets: [
        {
          properties: {
            title: SHEET_TITLE,
            gridProperties: { frozenRowCount: 2 },
          },
        },
      ],
    },
  });

  const spreadsheetId = created.data.spreadsheetId;
  if (!spreadsheetId) {
    throw new Error("スプレッドシートの作成に失敗しました");
  }

  const sheetId = created.data.sheets?.[0]?.properties?.sheetId;
  if (sheetId == null) {
    throw new Error("シート ID の取得に失敗しました");
  }

  const values: (string | number | boolean | null)[][] = [
    ["Profile Sheet", ""],
    ["項目", "内容"],
    ...pairs.map((p) => [p.label, p.value]),
  ];

  const totalRows = values.length;

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${SHEET_TITLE}'!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });

  const requests: Record<string, unknown>[] = [
    {
      mergeCells: {
        range: {
          sheetId,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: 0,
          endColumnIndex: 2,
        },
        mergeType: "MERGE_ALL",
      },
    },
    {
      updateDimensionProperties: {
        range: {
          sheetId,
          dimension: "COLUMNS",
          startIndex: 0,
          endIndex: 1,
        },
        properties: { pixelSize: 140 },
        fields: "pixelSize",
      },
    },
    {
      updateDimensionProperties: {
        range: {
          sheetId,
          dimension: "COLUMNS",
          startIndex: 1,
          endIndex: 2,
        },
        properties: { pixelSize: 400 },
        fields: "pixelSize",
      },
    },
    {
      updateDimensionProperties: {
        range: {
          sheetId,
          dimension: "ROWS",
          startIndex: 0,
          endIndex: 1,
        },
        properties: { pixelSize: 40 },
        fields: "pixelSize",
      },
    },
    {
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: 0,
          endColumnIndex: 2,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: HEADER_ORANGE,
            horizontalAlignment: "CENTER",
            verticalAlignment: "MIDDLE",
            textFormat: {
              bold: true,
              foregroundColor: WHITE,
            },
          },
        },
        fields:
          "userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,textFormat)",
      },
    },
    {
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 1,
          endRowIndex: 2,
          startColumnIndex: 0,
          endColumnIndex: 2,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: LABEL_BG,
            horizontalAlignment: "CENTER",
            verticalAlignment: "MIDDLE",
            textFormat: {
              bold: true,
              foregroundColor: BLACK,
            },
          },
        },
        fields:
          "userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,textFormat)",
      },
    },
  ];

  if (totalRows > 2) {
    requests.push(
      {
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: 2,
            endRowIndex: totalRows,
            startColumnIndex: 0,
            endColumnIndex: 1,
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: LABEL_BG,
              verticalAlignment: "MIDDLE",
              horizontalAlignment: "CENTER",
              textFormat: { foregroundColor: BLACK },
            },
          },
          fields:
            "userEnteredFormat(backgroundColor,verticalAlignment,horizontalAlignment,textFormat)",
        },
      },
      {
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: 2,
            endRowIndex: totalRows,
            startColumnIndex: 1,
            endColumnIndex: 2,
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: WHITE,
              verticalAlignment: "TOP",
              wrapStrategy: "WRAP",
              textFormat: { foregroundColor: BLACK },
            },
          },
          fields:
            "userEnteredFormat(backgroundColor,verticalAlignment,wrapStrategy,textFormat)",
        },
      }
    );
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests },
  });

  return {
    spreadsheetId,
    spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
  };
}
