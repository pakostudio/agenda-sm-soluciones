import { NextResponse } from "next/server";
import { Resend } from "resend";

type EmailBody = {
  to?: string[];
  subject?: string;
  message?: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as EmailBody;

  if (!body.to?.length || !body.subject || !body.message) {
    return NextResponse.json({ error: "to, subject and message are required" }, { status: 400 });
  }

  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    return NextResponse.json({
      queued: false,
      warning: "RESEND_API_KEY o EMAIL_FROM no configurados. Email registrado como preparado, no enviado."
    });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const result = await resend.emails.send({
    from: process.env.EMAIL_FROM,
    to: body.to,
    subject: body.subject,
    text: body.message
  });

  return NextResponse.json({ queued: true, result });
}
