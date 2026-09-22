/**
 * Invitación de calendario compatible con Google, Outlook y Apple.
 *
 * El archivo .ics (iCalendar) es el formato que esos calendarios aceptan sin
 * conectar una cuenta. En el correo va como invitación; en la página, como
 * enlace directo o descarga.
 */

export type CalendarEvent = {
  uid: string;
  title: string;
  startsAt: string;
  endsAt: string;
  location?: string;
  description?: string;
  organizerName?: string;
  organizerEmail?: string;
  attendeeName?: string;
  attendeeEmail?: string;
};

export type VisitCalendarInput = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  organizationName?: string;
  locationName?: string;
  locationAddress?: string;
  internalPlace?: string;
  meetingUrl?: string;
  purpose?: string;
  invitationUrl?: string;
  organizerName?: string;
  organizerEmail?: string;
  attendeeName?: string;
  attendeeEmail?: string;
};

export function visitCalendarEvent(input: VisitCalendarInput): CalendarEvent {
  const place = [input.locationName, input.internalPlace, input.locationAddress]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");
  const details = [
    input.organizationName,
    input.purpose,
    input.meetingUrl ? `Junta en línea: ${input.meetingUrl}` : "",
    input.invitationUrl ? `Registro: ${input.invitationUrl}` : "",
  ]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join("\n");

  return {
    uid: `visit-${input.id}@nexa.visit`,
    title: input.title,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    location: place || undefined,
    description: details || undefined,
    organizerName: input.organizerName,
    organizerEmail: input.organizerEmail,
    attendeeName: input.attendeeName,
    attendeeEmail: input.attendeeEmail,
  };
}

export function utcStamp(value: string) {
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, "0");
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}

export function googleCalendarUrl(event: CalendarEvent) {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${utcStamp(event.startsAt)}/${utcStamp(event.endsAt)}`,
    details: event.description ?? "",
    location: event.location ?? "",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function outlookCalendarUrl(event: CalendarEvent) {
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: event.title,
    startdt: new Date(event.startsAt).toISOString(),
    enddt: new Date(event.endsAt).toISOString(),
    body: event.description ?? "",
    location: event.location ?? "",
  });
  return `https://outlook.office.com/calendar/0/deeplink/compose?${params.toString()}`;
}

function escapeIcs(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\n|\r/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function fold(line: string) {
  const chunks: string[] = [];
  let rest = line;
  let first = true;
  while (rest.length > 73) {
    const size = first ? 73 : 72;
    chunks.push(`${first ? "" : " "}${rest.slice(0, size)}`);
    rest = rest.slice(size);
    first = false;
  }
  chunks.push(`${first ? "" : " "}${rest}`);
  return chunks.join("\r\n");
}

export function buildIcs(event: CalendarEvent, method: "REQUEST" | "PUBLISH" = "PUBLISH") {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//NEXA VISIT//Visitas//ES",
    "CALSCALE:GREGORIAN",
    `METHOD:${method}`,
    "BEGIN:VEVENT",
    `UID:${escapeIcs(event.uid)}`,
    `DTSTAMP:${utcStamp(new Date().toISOString())}`,
    `DTSTART:${utcStamp(event.startsAt)}`,
    `DTEND:${utcStamp(event.endsAt)}`,
    `SUMMARY:${escapeIcs(event.title)}`,
  ];
  if (event.location) lines.push(`LOCATION:${escapeIcs(event.location)}`);
  if (event.description) lines.push(`DESCRIPTION:${escapeIcs(event.description)}`);
  if (event.organizerEmail) {
    const name = event.organizerName ? `;CN=${escapeIcs(event.organizerName)}` : "";
    lines.push(`ORGANIZER${name}:MAILTO:${event.organizerEmail}`);
  }
  if (method === "REQUEST" && event.attendeeEmail) {
    const name = event.attendeeName ? `;CN=${escapeIcs(event.attendeeName)}` : "";
    lines.push(
      `ATTENDEE${name};ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:MAILTO:${event.attendeeEmail}`,
    );
  }
  lines.push("END:VEVENT", "END:VCALENDAR");
  return `${lines.map(fold).join("\r\n")}\r\n`;
}
