import { publicRoute, readJson } from '@/lib/api';
import { verifyRegistration } from '@/lib/registration';

export const POST = publicRoute(async (req) => {
  const { token } = await readJson<{ token?: string }>(req);
  return verifyRegistration(String(token ?? ''));
});
