import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";

export type ShiftCalendarItem = {
  shiftId: string;
  projectTitle: string;
  staffName: string;
  role: "leader" | "helper";
  startAtIso: string;
  endAtIso: string;
  siteAddress: string | null;
};

const APP_SOURCE = "event-system-shifts";

async function findEventIdByShiftId(
  oauth2: OAuth2Client,
  shiftId: string,
  startAtIso: string,
  endAtIso: string
): Promise<string | null> {
  const calendar = google.calendar({ version: "v3", auth: oauth2 });
  const res = await calendar.events.list({
    calendarId: "primary",
    timeMin: new Date(new Date(startAtIso).getTime() - 24 * 60 * 60 * 1000).toISOString(),
    timeMax: new Date(new Date(endAtIso).getTime() + 24 * 60 * 60 * 1000).toISOString(),
    singleEvents: true,
    maxResults: 10,
    privateExtendedProperty: [`shift_id=${shiftId}`],
  });
  const found = res.data.items?.find((e) => e.id);
  return found?.id ?? null;
}

export async function upsertShiftEventsToGoogleCalendar(
  oauth2: OAuth2Client,
  items: ShiftCalendarItem[]
): Promise<{ created: number; updated: number }> {
  const calendar = google.calendar({ version: "v3", auth: oauth2 });
  let created = 0;
  let updated = 0;
  for (const item of items) {
    const summary = `${item.projectTitle} / ${item.staffName} (${item.role === "leader" ? "リーダー" : "ヘルパー"})`;
    const description = [
      `案件: ${item.projectTitle}`,
      `スタッフ: ${item.staffName}`,
      `役割: ${item.role === "leader" ? "リーダー" : "ヘルパー"}`,
      item.siteAddress ? `会場: ${item.siteAddress}` : null,
      "",
      "この予定はイベント管理システムから同期されています。",
    ]
      .filter(Boolean)
      .join("\n");

    const existingId = await findEventIdByShiftId(
      oauth2,
      item.shiftId,
      item.startAtIso,
      item.endAtIso
    );
    const body = {
      summary,
      description,
      location: item.siteAddress ?? undefined,
      start: { dateTime: item.startAtIso, timeZone: "Asia/Tokyo" },
      end: { dateTime: item.endAtIso, timeZone: "Asia/Tokyo" },
      source: { title: "Event System", url: APP_SOURCE },
      extendedProperties: {
        private: {
          shift_id: item.shiftId,
          source: APP_SOURCE,
        },
      },
    };

    if (existingId) {
      await calendar.events.patch({
        calendarId: "primary",
        eventId: existingId,
        requestBody: body,
      });
      updated += 1;
    } else {
      await calendar.events.insert({
        calendarId: "primary",
        requestBody: body,
      });
      created += 1;
    }
  }
  return { created, updated };
}
