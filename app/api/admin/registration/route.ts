import { adminRoute, readJson } from '@/lib/api';
import { setRegistrationOpenSynced } from '@/lib/sync';
import { getPhase, setPhase } from '@/lib/tournament';

export const POST = adminRoute(async (req) => {
  const { open } = await readJson<{ open: boolean }>(req);
  await setRegistrationOpenSynced(!!open);
  if (!open && getPhase() === 'registration') setPhase('setup');
  if (open && getPhase() === 'setup') setPhase('registration');
});
