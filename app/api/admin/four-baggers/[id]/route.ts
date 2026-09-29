import { adminRoute, idParam, readJson, type IdParams } from '@/lib/api';
import { deleteFourBagger, setFourBaggerRedeemed } from '@/lib/tournament';

export const PATCH = adminRoute(async (req, ctx: IdParams) => {
  const { redeemed } = await readJson<{ redeemed: boolean }>(req);
  setFourBaggerRedeemed(await idParam(ctx), !!redeemed);
});

export const DELETE = adminRoute(async (_req, ctx: IdParams) => { deleteFourBagger(await idParam(ctx)); });
