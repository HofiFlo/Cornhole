import { publicRoute, readJson } from '@/lib/api';
import { createRegistration, parseRegistrationInput } from '@/lib/registration';

export const POST = publicRoute(async (req) => createRegistration(parseRegistrationInput(await readJson(req))));
