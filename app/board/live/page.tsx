import '@/styles/board.css';
import { config } from '@/lib/config';
import type { GroupStandings } from '@/lib/standings';
import { getAllStandings } from '@/lib/tournament';
import AutoRefresh from './AutoRefresh';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Live-Board' };

export default function LiveBoardPage() {
  const groups = getAllStandings();
  return (
    <div className="board-page">
      <AutoRefresh seconds={15} />
      {groups.length === 0
        ? <div className="board-empty">{config.tournamentName} – die Gruppen werden in Kürze ausgelost.</div>
        : <LiveBoard groups={groups} />}
    </div>
  );
}

function LiveBoard({ groups }: { groups: GroupStandings[] }) {
  return (
    <div className="board-grid" style={{ gridTemplateRows: `repeat(${groups.length}, 1fr)` }}>
      {groups.map(group => <GroupTable key={group.name} group={group} />)}
    </div>
  );
}

function GroupTable({ group }: { group: GroupStandings }) {
  return (
    <div className="group-card">
      <h2>Gruppe {group.name}</h2>
      <table>
        <thead><tr><th>#</th><th>Team</th><th className="n">Sp</th><th className="n">Pkt</th><th className="n">Diff</th></tr></thead>
        <tbody>
          {group.standings.map((row, i) => (
            <tr key={row.teamId} className={[i < 4 ? 'qualified' : '', i === 3 && group.standings.length > 4 ? 'cutoff' : ''].join(' ')}>
              <td className="rank">{i + 1}</td>
              <td className="team-name">{row.teamName}</td>
              <td className="n">{row.played}/{row.totalMatches}</td>
              <td className="n">{row.tablePoints}</td>
              <td className="n">{row.diff > 0 ? `+${row.diff}` : row.diff}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
