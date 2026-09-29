import { adminRoute, readJson } from '@/lib/api';
import { UserError } from '@/lib/registration';
import { logFourBagger } from '@/lib/tournament';

export const POST = adminRoute(async (req) => {
  const { matchType, matchId, teamId, playerName } =
    await readJson<{ matchType: 'group' | 'ko'; matchId: number; teamId: number; playerName?: string }>(req);
  if (!['group', 'ko'].includes(matchType) || !matchId || !teamId) throw new UserError('Unvollständige Angaben');
  logFourBagger(matchType, Number(matchId), Number(teamId), playerName);
});
