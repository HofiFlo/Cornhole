import { adminRoute, idParam, readJson, type IdParams } from '@/lib/api';
import { resetGroupResult, saveGroupResult } from '@/lib/tournament';
import type { KehreEntry } from '@/lib/types';

export const POST = adminRoute(async (req, ctx: IdParams) => {
  const { kehren } = await readJson<{ kehren: KehreEntry[] }>(req);
  return saveGroupResult(await idParam(ctx), Array.isArray(kehren) ? kehren : []);
});

export const DELETE = adminRoute(async (_req, ctx: IdParams) => { resetGroupResult(await idParam(ctx)); });
