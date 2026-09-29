import type { RegistrationResult } from '@/lib/registration';
import { formatDate } from '@/lib/util';

export default function RegistrationResultView({ result }: { result: RegistrationResult }) {
  if ('waitlisted' in result) {
    return (
      <div className="card stack">
        <h2>„{result.teamName}“ steht auf der Warteliste</h2>
        <p>Die E-Mail-Adresse ist bestätigt, das Turnier ist aber leider bereits voll. Sobald ein Platz frei wird, bekommt ihr
          eine E-Mail mit den Zahlungsinformationen. Bitte bis dahin <strong>noch nichts überweisen</strong>.</p>
      </div>
    );
  }
  if ('confirmed' in result) {
    return (
      <div className="card stack">
        <h2>„{result.teamName}“ ist verbindlich angemeldet</h2>
        <p>Die Zahlung ist bereits eingegangen – wir freuen uns auf euch!</p>
      </div>
    );
  }
  return (
    <div className="card stack">
      <h2>Danke – „{result.teamName}“ ist angemeldet!</h2>
      <p>Verbindlich wird die Anmeldung erst nach Zahlungseingang. Bitte überweist die Teilnahmegebühr bis <strong>{formatDate(result.dueDate)}</strong>:</p>
      <dl className="payment-box">
        {result.accountHolder && <><dt>Empfänger</dt><dd>{result.accountHolder}</dd></>}
        <dt>IBAN</dt><dd className="reference">{result.iban}</dd>
        {result.entryFee && <><dt>Betrag</dt><dd>{result.entryFee}</dd></>}
        <dt>Verwendungszweck</dt><dd className="reference">{result.paymentReference}</dd>
      </dl>
      <p className="notice">Bitte unbedingt den Verwendungszweck <strong className="reference">{result.paymentReference}</strong> angeben – nur so können wir die Zahlung zuordnen.
        Die Daten wurden zusätzlich per E-Mail verschickt.</p>
    </div>
  );
}
