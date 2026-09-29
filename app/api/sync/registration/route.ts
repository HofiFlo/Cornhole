import { readJson, syncRoute } from '@/lib/api';
import { setSetting } from '@/lib/db';

export const POST = syncRoute(async (req) => {
  const { open } = await readJson<{ open: boolean }>(req);
  setSetting('registration_open', String(!!open));
  return { ok: true };
});
