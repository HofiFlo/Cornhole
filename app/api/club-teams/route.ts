import { publicRoute } from '@/lib/api';
import { suggestSuffixForClub } from '@/lib/registration';

export const GET = publicRoute((req) => {
  const club = new URL(req.url).searchParams.get('club') ?? '';
  return { suffix: suggestSuffixForClub(club) };
});
