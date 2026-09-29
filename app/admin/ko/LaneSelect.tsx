'use client';

import { useRouter } from 'next/navigation';
import { api } from '@/lib/client';
import { TOTAL_LANES } from '@/lib/schedule';

export default function LaneSelect({ matchId, lane, disabled }: { matchId: number; lane: number | null; disabled?: boolean }) {
  const router = useRouter();
  async function change(value: string) {
    try {
      await api(`/api/admin/ko-matches/${matchId}`, 'PATCH', { lane: value ? Number(value) : null });
      router.refresh();
    } catch (e) { alert((e as Error).message); }
  }
  return (
    <select value={lane ?? ''} disabled={disabled} onChange={e => change(e.target.value)} style={{ padding: '0.1rem 0.3rem' }}>
      <option value="">–</option>
      {Array.from({ length: TOTAL_LANES }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
    </select>
  );
}
