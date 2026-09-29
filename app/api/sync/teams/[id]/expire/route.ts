import { idParam, syncRoute, type IdParams } from '@/lib/api';
import { expireRegistration } from '@/lib/registration';

export const POST = syncRoute(async (_req, ctx: IdParams) => expireRegistration(await idParam(ctx)));
