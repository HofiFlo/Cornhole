import Link from 'next/link';
import { notFound } from 'next/navigation';
import { KO_ROUND_LABELS, isSetRound } from '@/lib/bracket';
import { getKehren, getKoMatch, getKoSets, type KoMatchView } from '@/lib/tournament';
import FourBaggerLogger from '../../components/FourBaggerLogger';
import KehrenForm from '../../components/KehrenForm';
import SetsForm from '../../components/SetsForm';
import { StatusBadge } from '../../components/StatusBadge';

export default async function KoMatchPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  let match: KoMatchView;
  try { match = getKoMatch(id); } catch { notFound(); }
  if (!match.team_a_id || !match.team_b_id) notFound();

  const hasResult = match.status === 'finished' || match.status === 'sudden_death'
    || (isSetRound(match.round) && getKoSets(id).length > 0);

  return (
    <div className="stack">
      <Link href="/admin/ko">← KO-Runde</Link>
      <h1>{KO_ROUND_LABELS[match.round]} #{match.position + 1} · Bahn {match.lane ?? '–'} <StatusBadge status={match.status} /></h1>
      <h2 style={{ marginTop: 0 }}>{match.team_a_name} vs. {match.team_b_name}</h2>
      {isSetRound(match.round) ? (
        <>
          <SetsForm key={match.status} endpoint={`/api/admin/ko-matches/${id}`} backHref="/admin/ko"
            teamAName={match.team_a_name!} teamBName={match.team_b_name!} hasResult={hasResult}
            initial={getKoSets(id).map(s => ({ teamAScore: s.team_a_score, teamBScore: s.team_b_score }))} />
          <FourBaggerLogger matchType="ko" matchId={id}
            teams={[{ id: match.team_a_id, name: match.team_a_name! }, { id: match.team_b_id, name: match.team_b_name! }]} />
        </>
      ) : (
        <KehrenForm key={match.status} endpoint={`/api/admin/ko-matches/${id}`} backHref="/admin/ko"
          teamAName={match.team_a_name!} teamBName={match.team_b_name!} suddenDeath editable hasResult={hasResult}
          initial={getKehren('ko', id).map(k => ({
            teamA: { inHole: k.team_a_in_hole ?? 0, onBoard: k.team_a_on_board ?? 0 },
            teamB: { inHole: k.team_b_in_hole ?? 0, onBoard: k.team_b_on_board ?? 0 },
          }))} />
      )}
    </div>
  );
}
