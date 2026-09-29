import { syncRoute } from '@/lib/api';
import { findAllTeams } from '@/lib/registration';

export const GET = syncRoute(() => Response.json(findAllTeams().map(({ email_verify_token: _, ...t }) => t)));
