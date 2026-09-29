import type { KoStatus, RegistrationStatus, TournamentPhase } from '@/lib/types';

export const REGISTRATION_LABELS: Record<RegistrationStatus | 'all', string> = {
  pending: 'Offen', confirmed: 'Bestätigt', waitlist: 'Warteliste', expired: 'Verfallen', rejected: 'Abgelehnt', all: 'Alle',
};

export const PHASE_LABELS: Record<TournamentPhase, string> = {
  registration: 'Anmeldung läuft', setup: 'Anmeldung geschlossen – Gruppenzuteilung',
  group_stage_active: 'Gruppenphase', ko_active: 'KO-Runde', finished: 'Turnier beendet',
};

export const MATCH_STATUS_LABELS: Record<KoStatus, string> = {
  waiting: 'wartet', scheduled: 'offen', sudden_death: 'Verlängerung', finished: 'beendet',
};
