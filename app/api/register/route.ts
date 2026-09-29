import { publicRoute, readJson } from '@/lib/api';
import { config } from '@/lib/config';
import { createRegistration, parseRegistrationInput } from '@/lib/registration';

export const POST = publicRoute(async (req) =>
  createRegistration(parseRegistrationInput(await readJson(req)), config.publicUrl || new URL(req.url).origin));
