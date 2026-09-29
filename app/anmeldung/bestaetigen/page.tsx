import { config } from '@/lib/config';
import { findTeamByVerifyToken, verifyRegistration, type RegistrationResult } from '@/lib/registration';
import RegistrationResultView from '../RegistrationResult';
import VerifyButton from './VerifyButton';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Anmeldung bestätigen' };

export default async function BestaetigenPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token ?? '';
  const team = findTeamByVerifyToken(token);

  let content: React.ReactNode;
  if (!team) {
    content = <p className="error">Dieser Bestätigungslink ist ungültig oder abgelaufen. Bitte melde dich erneut an.</p>;
  } else if (team.registration_status === 'unverified') {
    content = (
      <div className="card stack">
        <p>Anmeldung von <strong>„{team.team_name}“</strong> ({team.player1_name} &amp; {team.player2_name}) abschließen:</p>
        <VerifyButton token={token} />
      </div>
    );
  } else {
    // Link erneut geöffnet: aktuellen Stand anzeigen (keine Änderung)
    let result: RegistrationResult | null = null;
    try { result = await verifyRegistration(token); } catch { /* verfallen o. Ä. */ }
    content = result
      ? <RegistrationResultView result={result} />
      : <p className="error">Diese Anmeldung ist nicht mehr gültig – bitte bei der Turnierleitung melden.</p>;
  }

  return (
    <main className="public-page stack">
      <h1>{config.tournamentName} – Anmeldung bestätigen</h1>
      {content}
    </main>
  );
}
