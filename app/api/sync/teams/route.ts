import { syncRoute } from '@/lib/api';
import { findAllTeams, releaseExpiredRegistrations } from '@/lib/registration';

export const GET = syncRoute(async () => {
  await releaseExpiredRegistrations();
  return Response.json(findAllTeams());
});
