import { adminRoute, readJson } from '@/lib/api';
import type { TeamMailRequest } from '@/lib/registration';
import { sendTeamMailsSynced } from '@/lib/sync';

export const POST = adminRoute(async (req) => sendTeamMailsSynced(await readJson<TeamMailRequest>(req)));
