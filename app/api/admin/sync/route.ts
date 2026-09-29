import { adminRoute } from '@/lib/api';
import { pullRegistrations } from '@/lib/sync';

export const POST = adminRoute(async () => { await pullRegistrations(); });
