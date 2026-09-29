import { idParam, syncRoute, type IdParams } from '@/lib/api';
import { sendMail } from '@/lib/mail';
import { confirmPayment } from '@/lib/registration';

export const POST = syncRoute(async (_req, ctx: IdParams) => {
  const team = confirmPayment(await idParam(ctx));
  await sendMail(team, 'registration_confirmed');
  return { ok: true };
});
