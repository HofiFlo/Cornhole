import 'server-only';
import nodemailer from 'nodemailer';
import { config } from './config';
import type { Team } from './types';
import { formatDate } from './util';

export type MailTemplate = 'registration_pending' | 'waitlisted' | 'registration_expired' | 'registration_confirmed';

type MailData = { paymentReference?: string; iban?: string; paymentDueDate?: string };

function render(team: Team, template: MailTemplate, data: MailData): { subject: string; text: string } {
  const t = config.tournamentName;
  const hello = `Hallo ${team.player1_name},\n\n`;
  const bye = `\n\nSportliche Grüße\nEure Turnierleitung – ${t}`;
  switch (template) {
    case 'registration_pending':
      return {
        subject: `${t}: Anmeldung eingegangen – bitte Teilnahmegebühr überweisen`,
        text: hello +
          `danke für die Anmeldung von „${team.team_name}“! Die Anmeldung ist erst nach Zahlungseingang bestätigt.\n\n` +
          `Bitte überweise die Teilnahmegebühr${config.entryFee ? ` von ${config.entryFee}` : ''} bis ${formatDate(data.paymentDueDate)}:\n\n` +
          (config.accountHolder ? `Empfänger:  ${config.accountHolder}\n` : '') +
          `IBAN:       ${data.iban}\n` +
          `Verwendungszweck (unbedingt angeben): ${data.paymentReference}\n\n` +
          `Ohne Zahlungseingang bis zur Frist verfällt die Anmeldung und der Platz geht an die Warteliste.` + bye,
      };
    case 'waitlisted':
      return {
        subject: `${t}: Du stehst auf der Warteliste`,
        text: hello +
          `das Turnier ist leider bereits voll. „${team.team_name}“ steht auf der Warteliste – sobald ein Platz frei wird, ` +
          `melden wir uns mit den Zahlungsinformationen. Bitte bis dahin noch nichts überweisen.` + bye,
      };
    case 'registration_expired':
      return {
        subject: `${t}: Anmeldung verfallen`,
        text: hello +
          `für „${team.team_name}“ ist bis zur Frist leider keine Zahlung eingegangen, die Anmeldung ist daher verfallen. ` +
          `Falls du bereits überwiesen hast, melde dich bitte umgehend bei uns.` + bye,
      };
    case 'registration_confirmed':
      return {
        subject: `${t}: Anmeldung bestätigt`,
        text: hello + `die Zahlung ist eingegangen – „${team.team_name}“ ist verbindlich angemeldet. Wir freuen uns auf euch!` + bye,
      };
  }
}

let transporter: ReturnType<typeof nodemailer.createTransport> | null | undefined;
function getTransporter() {
  if (transporter !== undefined) return transporter;
  const host = process.env.SMTP_HOST;
  transporter = host
    ? nodemailer.createTransport({
        host,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: Number(process.env.SMTP_PORT) === 465,
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      })
    : null;
  return transporter;
}

/** Versendet eine Mail an beide Spieler. Fehler werden geloggt, brechen den Ablauf aber nicht ab. */
export async function sendMail(team: Team, template: MailTemplate, data: MailData = {}) {
  const { subject, text } = render(team, template, data);
  const to = [team.player1_email, team.player2_email].filter(Boolean).join(', ');
  const tx = getTransporter();
  if (!tx) {
    console.log(`[mail:${template}] an ${to}\nBetreff: ${subject}\n${text}\n`);
    return;
  }
  try {
    await tx.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to, subject, text });
  } catch (err) {
    console.error(`[mail:${template}] Versand an ${to} fehlgeschlagen`, err);
  }
}
