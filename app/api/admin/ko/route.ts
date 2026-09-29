import { adminRoute } from '@/lib/api';
import { generateKo } from '@/lib/tournament';

export const POST = adminRoute(() => { generateKo(); });
