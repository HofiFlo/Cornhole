import { adminRoute, idParam, type IdParams } from '@/lib/api';
import { sendMail } from '@/lib/mail';
import { getTeam } from '@/lib/registration';
import { confirmPaymentSynced, isStandalone } from '@/lib/sync';

export const POST = adminRoute(async (_req, ctx: IdParams) => {
  const id = await idParam(ctx);
  await confirmPaymentSynced(id);
  // Im Standalone-Betrieb verschickt die lokale App die Bestätigung selbst
  if (isStandalone()) await sendMail(getTeam(id), 'registration_confirmed');
});
