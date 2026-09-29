import { publicRoute } from '@/lib/api';
import { listClubs } from '@/lib/registration';

export const GET = publicRoute(() => ({ clubs: listClubs() }));
