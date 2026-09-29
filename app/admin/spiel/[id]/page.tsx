import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getGroupMatch, getKehren, getPhase, type GroupMatchView } from '@/lib/tournament';
import KehrenForm from '../../components/KehrenForm';
import { StatusBadge } from '../../components/StatusBadge';

export default async function GroupMatchPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  let match: GroupMatchView;
  try { match = getGroupMatch(id); } catch { notFound(); }
  if (match.is_bye) notFound();

  const kehren = getKehren('group', id).map(k => ({
    teamA: { inHole: k.team_a_in_hole ?? 0, onBoard: k.team_a_on_board ?? 0 },
    teamB: { inHole: k.team_b_in_hole ?? 0, onBoard: k.team_b_on_board ?? 0 },
  }));
  const editable = getPhase() === 'group_stage_active';

  return (
    <div className="stack">
      <Link href="/admin/spielplan">← Spielplan</Link>
      <h1>Gruppe {match.group_id}, Runde {match.round} · Bahn {match.lane} <StatusBadge status={match.status} /></h1>
      <h2 style={{ marginTop: 0 }}>{match.team_a_name} vs. {match.team_b_name}</h2>
      {!editable && <p className="notice">Die Gruppenphase ist abgeschlossen – Ergebnisse können nicht mehr geändert werden.</p>}
      <KehrenForm key={match.status} endpoint={`/api/admin/group-matches/${id}`} backHref="/admin/spielplan"
        teamAName={match.team_a_name} teamBName={match.team_b_name ?? ''} initial={kehren}
        suddenDeath={false} editable={editable} hasResult={match.status === 'finished'} />
    </div>
  );
}
