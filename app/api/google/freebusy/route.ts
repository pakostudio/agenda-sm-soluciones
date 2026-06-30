import { NextResponse } from "next/server";

type FreeBusyBody = {
  timeMin?: string;
  timeMax?: string;
  users?: string[];
  accessToken?: string;
  calendarIds?: string[];
};

export async function POST(request: Request) {
  const body = (await request.json()) as FreeBusyBody;

  if (!body.timeMin || !body.timeMax) {
    return NextResponse.json({ error: "timeMin and timeMax are required" }, { status: 400 });
  }

  if (!body.accessToken || !body.calendarIds?.length) {
    return NextResponse.json({
      busy: {},
      warning: "Google Free/Busy no esta conectado. La app continua con Agenda SM y bloqueos internos."
    });
  }

  const response = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${body.accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      timeMin: body.timeMin,
      timeMax: body.timeMax,
      items: body.calendarIds.map((id) => ({ id }))
    })
  });

  if (!response.ok) {
    return NextResponse.json({
      busy: {},
      warning: "Google Free/Busy fallo. Se continua sin mostrar detalles privados de Google."
    });
  }

  const data = await response.json();
  const busy = Object.fromEntries(
    Object.entries(data.calendars || {}).map(([calendarId, value]) => [
      calendarId,
      (value as { busy?: { start: string; end: string }[] }).busy || []
    ])
  );

  return NextResponse.json({ busy });
}
