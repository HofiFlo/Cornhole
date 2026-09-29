import Link from 'next/link';
import { config } from '@/lib/config';
import { isMailConfigured } from '@/lib/mail';
import { getPhase } from '@/lib/tournament';
import { PHASE_LABELS } from './labels';

export const dynamic = 'force-dynamic';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-shell">
      <nav className="admin-nav">
        <Link href="/admin" className="brand">{config.tournamentName}</Link>
        <Link href="/admin/anmeldungen">Anmeldungen</Link>
        <Link href="/admin/mails">E-Mails</Link>
        <Link href="/admin/gruppen">Gruppen</Link>
        <Link href="/admin/spielplan">Spielplan &amp; Ergebnisse</Link>
        <Link href="/admin/ko">KO-Runde</Link>
        <Link href="/admin/freigetraenke">Freigetränke</Link>
        {!isMailConfigured() && <Link href="/admin/postausgang">Postausgang (Test)</Link>}
        <span className="spacer" />
        <span className="badge">{PHASE_LABELS[getPhase()]}</span>
        <a href="/anmeldung" target="_blank" rel="noreferrer">Anmeldeformular ↗</a>
        <a href="/board/live" target="_blank" rel="noreferrer">Live-Board ↗</a>
      </nav>
      <main className="admin-main">{children}</main>
    </div>
  );
}
