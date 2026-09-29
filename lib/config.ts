// Zentrale Konfiguration aus Umgebungsvariablen (nur serverseitig verwenden).

export const config = {
  get appMode(): 'public' | 'local' {
    return process.env.APP_MODE === 'public' ? 'public' : 'local';
  },
  get tournamentName() { return process.env.TOURNAMENT_NAME || 'Cornhole-Turnier'; },
  get iban() { return process.env.TOURNAMENT_IBAN || 'AT00 0000 0000 0000 0000'; },
  get accountHolder() { return process.env.TOURNAMENT_ACCOUNT_HOLDER || ''; },
  get entryFee() { return process.env.ENTRY_FEE || ''; },
  get paymentRefPrefix() { return process.env.PAYMENT_REF_PREFIX || 'CH2026'; },
  get paymentDays() { return Number(process.env.PAYMENT_DAYS) || 14; },
  get maxTeams() { return Number(process.env.MAX_TEAMS) || 64; },
  get syncToken() { return process.env.SYNC_TOKEN || ''; },
  /** Öffentliche Basis-URL für Links in Mails (sonst aus der Anfrage abgeleitet). */
  get publicUrl() { return (process.env.PUBLIC_URL || '').replace(/\/+$/, ''); },
  get hostedUrl() { return (process.env.HOSTED_URL || '').replace(/\/+$/, ''); },
};
