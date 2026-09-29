import { config } from '@/lib/config';
import { getSetting } from '@/lib/db';
import { findAllTeams } from '@/lib/registration';
import { formatDateTime } from '@/lib/util';
import { ActionButton } from '../components/ActionButton';
import AdminRegistrations from './AdminRegistrations';

export default function AnmeldungenPage() {
  const lastSync = getSetting('last_sync_at');
  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0 }}>Anmeldungen &amp; Zahlungsabgleich</h1>
        <div className="row">
          <span className="muted">Letzter Sync: {lastSync ? formatDateTime(lastSync) : 'noch nie'}</span>
          <ActionButton url="/api/admin/sync" className="secondary">Jetzt synchronisieren</ActionButton>
        </div>
      </div>
      <AdminRegistrations teams={findAllTeams()} maxTeams={config.maxTeams} />
    </div>
  );
}
