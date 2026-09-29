import 'server-only';
import nodemailer from 'nodemailer';
import { db } from './db';
import { renderMail, type MailData, type MailTemplate } from './mail-templates';
import type { Team } from './types';

export type { MailTemplate } from './mail-templates';

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

type Recipient = Pick<Team, 'team_name' | 'player1_name' | 'player1_email' | 'player2_email' | 'payment_reference' | 'payment_due_date'>;

/**
 * Versendet eine Mail an beide Spieler (Spieler 2 nur, falls E-Mail angegeben).
 * Fehler werden geloggt und als `false` zurückgegeben, brechen den Ablauf aber nicht ab.
 */
export async function sendMail(team: Recipient, template: MailTemplate, data: MailData = {}): Promise<boolean> {
  const { subject, text } = renderMail(team, template, data);
  const to = [team.player1_email, team.player2_email].filter(Boolean).join(', ');
  const tx = getTransporter();
  if (!tx) {
    // Testbetrieb ohne Mailserver: Mail in den Postausgang (/admin/postausgang) und in die Konsole
    console.log(`[mail:${template}] an ${to}\nBetreff: ${subject}\n${text}\n`);
    db().prepare('INSERT INTO mail_outbox (template, recipients, subject, body) VALUES (?, ?, ?, ?)')
      .run(template, to, subject, text);
    return true;
  }
  try {
    await tx.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to, subject, text });
    return true;
  } catch (err) {
    console.error(`[mail:${template}] Versand an ${to} fehlgeschlagen`, err);
    return false;
  }
}

export const isMailConfigured = () => !!process.env.SMTP_HOST;
