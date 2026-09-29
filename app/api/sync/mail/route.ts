import { readJson, syncRoute } from '@/lib/api';
import { sendTeamMails, type TeamMailRequest } from '@/lib/registration';

export const POST = syncRoute(async (req) => sendTeamMails(await readJson<TeamMailRequest>(req)));
