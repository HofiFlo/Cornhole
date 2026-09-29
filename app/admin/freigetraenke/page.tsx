import { listFourBaggers } from '@/lib/tournament';
import { formatDateTime } from '@/lib/util';
import { ActionButton } from '../components/ActionButton';

export default function FreigetraenkePage() {
  const entries = listFourBaggers();
  const open = entries.filter(e => !e.redeemed).length;

  return (
    <div className="stack">
      <h1>4-Bagger &amp; Freigetränke</h1>
      <p className="muted">{entries.length} 4-Bagger insgesamt, {open} Freigetränke noch nicht ausgegeben.
        4-Bagger aus Kehren-Spielen werden automatisch erkannt; in Satz-Spielen (ab Viertelfinale) auf der Spielseite erfassen.</p>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Zeit</th><th>Team</th><th>Info</th><th>Spiel</th><th>Freigetränk</th><th></th></tr></thead>
          <tbody>
            {entries.map(e => (
              <tr key={e.id} style={e.redeemed ? { opacity: 0.55 } : undefined}>
                <td>{formatDateTime(e.created_at)}</td>
                <td><strong>{e.team_name}</strong></td>
                <td>{e.player_name}</td>
                <td>{e.match_type === 'group' ? 'Gruppe' : 'KO'} #{e.match_id}</td>
                <td>
                  <ActionButton url={`/api/admin/four-baggers/${e.id}`} method="PATCH" body={{ redeemed: !e.redeemed }}
                    className={e.redeemed ? 'small secondary' : 'small'}>
                    {e.redeemed ? 'ausgegeben ✓' : 'als ausgegeben markieren'}
                  </ActionButton>
                </td>
                <td>{!e.auto && (
                  <ActionButton url={`/api/admin/four-baggers/${e.id}`} method="DELETE" className="small danger"
                    confirmText="Eintrag löschen?">Löschen</ActionButton>
                )}</td>
              </tr>
            ))}
            {entries.length === 0 && <tr><td colSpan={6} className="muted">Noch keine 4-Bagger.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
