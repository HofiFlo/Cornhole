import { MATCH_STATUS_LABELS, REGISTRATION_LABELS } from '../labels';

export function StatusBadge({ status }: { status: string }) {
  const label = (REGISTRATION_LABELS as Record<string, string>)[status] ?? (MATCH_STATUS_LABELS as Record<string, string>)[status] ?? status;
  return <span className={`badge ${status}`}>{label}</span>;
}
