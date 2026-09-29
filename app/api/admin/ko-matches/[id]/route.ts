import { adminRoute, idParam, readJson, type IdParams } from '@/lib/api';
import { resetKoMatch, saveKoKehren, saveKoSets, setKoLane } from '@/lib/tournament';
import type { KehreEntry, SetEntry } from '@/lib/types';

type Body = { kehren?: KehreEntry[]; sets?: SetEntry[]; enteredByReferee?: boolean };

export const POST = adminRoute(async (req, ctx: IdParams) => {
  const id = await idParam(ctx);
  const body = await readJson<Body>(req);
  if (Array.isArray(body.sets)) return saveKoSets(id, body.sets, !!body.enteredByReferee);
  return saveKoKehren(id, Array.isArray(body.kehren) ? body.kehren : []);
});

export const PATCH = adminRoute(async (req, ctx: IdParams) => {
  const { lane } = await readJson<{ lane: number | null }>(req);
  setKoLane(await idParam(ctx), lane === null ? null : Number(lane));
});

export const DELETE = adminRoute(async (_req, ctx: IdParams) => { resetKoMatch(await idParam(ctx)); });
