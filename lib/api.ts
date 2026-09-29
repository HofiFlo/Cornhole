import 'server-only';
import { config } from './config';
import { UserError } from './registration';
import { isAuthorizedSyncRequest } from './sync';

type Handler<C> = (req: Request, ctx: C) => Promise<Response | unknown> | Response | unknown;

function toResponse(result: unknown) {
  return result instanceof Response ? result : Response.json(result ?? { ok: true });
}

function errorResponse(err: unknown, exposeAll: boolean) {
  if (err instanceof UserError || (exposeAll && err instanceof Error)) {
    return Response.json({ error: err.message }, { status: err instanceof UserError ? 400 : 500 });
  }
  console.error(err);
  return Response.json({ error: 'Interner Fehler – bitte später erneut versuchen' }, { status: 500 });
}

/** Öffentliche Endpunkte (Anmeldung). */
export function publicRoute<C>(fn: Handler<C>) {
  return async (req: Request, ctx: C) => {
    try { return toResponse(await fn(req, ctx)); } catch (err) { return errorResponse(err, false); }
  };
}

/** Verwaltungs-Endpunkte: nur im lokalen Modus erreichbar (zusätzlich zum Proxy). */
export function adminRoute<C>(fn: Handler<C>) {
  return async (req: Request, ctx: C) => {
    if (config.appMode !== 'local') return new Response(null, { status: 404 });
    try { return toResponse(await fn(req, ctx)); } catch (err) { return errorResponse(err, true); }
  };
}

/** Sync-Endpunkte der gehosteten Instanz: nur im Public-Modus und mit gültigem Sync-Token. */
export function syncRoute<C>(fn: Handler<C>) {
  return async (req: Request, ctx: C) => {
    if (config.appMode !== 'public') return new Response(null, { status: 404 });
    if (!isAuthorizedSyncRequest(req)) return new Response(null, { status: 401 });
    try { return toResponse(await fn(req, ctx)); } catch (err) { return errorResponse(err, true); }
  };
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  try { return (await req.json()) as T; } catch { throw new UserError('Ungültige Anfrage'); }
}

export type IdParams = { params: Promise<{ id: string }> };
export async function idParam(ctx: IdParams) {
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0) throw new UserError('Ungültige ID');
  return id;
}
