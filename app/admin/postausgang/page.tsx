import { db } from '@/lib/db';
import { formatDateTime } from '@/lib/util';

type OutboxMail = { id: number; template: string; recipients: string; subject: string; body: string; created_at: string };

/** Links auf den Pfad kürzen, damit sie unter jeder Adresse (localhost, Codespaces, WLAN-IP) funktionieren. */
function linkify(text: string) {
  return text.split(/(https?:\/\/\S+)/g).map((part, i) => {
    if (!/^https?:\/\//.test(part)) return part;
    const url = new URL(part);
    return <a key={i} href={url.pathname + url.search}>{url.pathname + url.search}</a>;
  });
}

export default function PostausgangPage() {
  const mails = db().prepare('SELECT * FROM mail_outbox ORDER BY id DESC LIMIT 200').all() as OutboxMail[];
  return (
    <div className="stack">
      <h1>Postausgang (Testbetrieb)</h1>
      <p className="notice">
        Es ist kein Mailserver eingerichtet (<code>SMTP_HOST</code> leer). Deshalb werden Mails nicht verschickt,
        sondern hier abgelegt – so lässt sich alles ausprobieren, inklusive Bestätigungslink.
      </p>
      {mails.length === 0 && <p className="muted">Noch keine Mails.</p>}
      {mails.map(m => (
        <article key={m.id} className="card stack">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <strong>{m.subject}</strong>
            <span className="muted">{formatDateTime(m.created_at)} · an {m.recipients}</span>
          </div>
          <div className="mail-preview">{linkify(m.body)}</div>
        </article>
      ))}
    </div>
  );
}
