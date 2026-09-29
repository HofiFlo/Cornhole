import { adminRoute, readJson } from '@/lib/api';
import { setSetting } from '@/lib/db';

export const POST = adminRoute(async (req) => {
  const { tournamentStart, durationMin } = await readJson<{ tournamentStart?: string; durationMin?: number }>(req);
  if (tournamentStart !== undefined) setSetting('tournament_start', tournamentStart || null);
  if (durationMin !== undefined) setSetting('match_duration_min', String(Math.max(5, Math.min(120, Number(durationMin) || 20))));
});
