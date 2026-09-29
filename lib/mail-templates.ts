// Mail-Texte (rein, ohne Versand – damit testbar)
import { config } from './config';
import type { Team } from './types';
import { formatDate } from './util';

export type MailTemplate =
  | 'verify_email' | 'registration_pending' | 'waitlisted' | 'registration_expired'
  | 'registration_confirmed' | 'payment_reminder' | 'custom';

export type MailData = { verifyUrl?: string; subject?: string; body?: string };

type TeamForMail = Pick<Team, 'team_name' | 'player1_name' | 'payment_reference' | 'payment_due_date'>;

/** Platzhalter für freie Mails der Turnierleitung. */
export const PLACEHOLDERS: Record<string, string> = {
  '{team}': 'Teamname',
  '{spieler1}': 'Name Spieler 1',
  '{referenz}': 'Zahlungsreferenz',
  '{frist}': 'Zahlungsfrist',
  '{iban}': 'IBAN',
  '{betrag}': 'Teilnahmegebühr',
};

export function fillPlaceholders(
  text: string, team: TeamForMail, settings: { iban: string; entryFee: string } = { iban: config.iban, entryFee: config.entryFee },
): string {
  const values: Record<string, string> = {
    '{team}': team.team_name,
    '{spieler1}': team.player1_name,
    '{referenz}': team.payment_reference ?? '–',
    '{frist}': formatDate(team.payment_due_date) || '–',
    '{iban}': settings.iban,
    '{betrag}': settings.entryFee || '–',
  };
  return text.replace(/\{(team|spieler1|referenz|frist|iban|betrag)\}/g, m => values[m]);
}

function paymentBlock(team: TeamForMail) {
  return (config.accountHolder ? `Empfänger:  ${config.accountHolder}\n` : '') +
    `IBAN:       ${config.iban}\n` +
    (config.entryFee ? `Betrag:     ${config.entryFee}\n` : '') +
    `Verwendungszweck (unbedingt angeben): ${team.payment_reference}\n`;
}

export function renderMail(team: TeamForMail, template: MailTemplate, data: MailData = {}): { subject: string; text: string } {
  const t = config.tournamentName;
  const hello = `Hallo ${team.player1_name},\n\n`;
  const bye = `\n\nSportliche Grüße\nEure Turnierleitung – ${t}`;
  switch (template) {
    case 'verify_email':
      return {
        subject: `${t}: Bitte Anmeldung bestätigen`,
        text: hello +
          `danke für die Anmeldung von „${team.team_name}“! Bitte bestätige deine E-Mail-Adresse über diesen Link, ` +
          `erst dann ist die Anmeldung gültig:\n\n${data.verifyUrl}\n\n` +
          `Falls du dich nicht angemeldet hast, kannst du diese Mail ignorieren.` + bye,
      };
    case 'registration_pending':
      return {
        subject: `${t}: Anmeldung eingegangen – bitte Teilnahmegebühr überweisen`,
        text: hello +
          `die Anmeldung von „${team.team_name}“ ist eingegangen. Verbindlich ist sie erst nach Zahlungseingang.\n\n` +
          `Bitte überweise die Teilnahmegebühr bis ${formatDate(team.payment_due_date)}:\n\n` + paymentBlock(team) +
          `\nWird bis zur Frist nicht bezahlt, kann der Platz an die Warteliste vergeben werden.` + bye,
      };
    case 'payment_reminder':
      return {
        subject: `${t}: Erinnerung – Teilnahmegebühr noch offen`,
        text: hello +
          `für „${team.team_name}“ ist bei uns noch keine Zahlung eingegangen. Bitte überweise die Teilnahmegebühr ` +
          `bis ${formatDate(team.payment_due_date)}:\n\n` + paymentBlock(team) +
          `\nFalls du bereits überwiesen hast, betrachte diese Mail bitte als gegenstandslos.` + bye,
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
    case 'custom':
      return {
        subject: fillPlaceholders(data.subject ?? '', team),
        text: fillPlaceholders(data.body ?? '', team),
      };
  }
}
