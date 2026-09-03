import { createFileRoute } from "@tanstack/react-router";

function icsEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function toUtcStamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export const Route = createFileRoute("/api/ics")({
  server: {
    handlers: {
      GET: ({ request }) => {
        const url = new URL(request.url);
        const title = url.searchParams.get("title") || "Vidalia plan";
        const start = url.searchParams.get("start") || "";
        const location = url.searchParams.get("location") || "";
        const details = url.searchParams.get("details") || "";
        const stamp = toUtcStamp(start);
        if (!stamp) {
          return new Response("Need a start time.", { status: 400 });
        }
        const endDate = new Date(start);
        endDate.setHours(endDate.getHours() + 2);
        const end = toUtcStamp(endDate.toISOString());
        const body = [
          "BEGIN:VCALENDAR",
          "VERSION:2.0",
          "PRODID:-//Neighborly//Vidalia weekend//EN",
          "CALSCALE:GREGORIAN",
          "METHOD:PUBLISH",
          "BEGIN:VEVENT",
          `UID:${stamp}-${encodeURIComponent(title.slice(0, 24))}@neighborly.unitedundergod.org`,
          `DTSTAMP:${stamp}`,
          `DTSTART:${stamp}`,
          `DTEND:${end}`,
          `SUMMARY:${icsEscape(title)}`,
          `LOCATION:${icsEscape(location)}`,
          `DESCRIPTION:${icsEscape(details)}`,
          "END:VEVENT",
          "END:VCALENDAR",
          "",
        ].join("\r\n");
        return new Response(body, {
          headers: {
            "Content-Type": "text/calendar; charset=utf-8",
            "Content-Disposition": `attachment; filename="vidalia.ics"`,
          },
        });
      },
    },
  },
});
