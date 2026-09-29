import { adminRoute, idParam, type IdParams } from '@/lib/api';
import { expireRegistrationSynced } from '@/lib/sync';

export const POST = adminRoute(async (_req, ctx: IdParams) => expireRegistrationSynced(await idParam(ctx)));
