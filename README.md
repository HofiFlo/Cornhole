# Cornhole-Turnier-App

Next.js 16 (App Router) + SQLite (better-sqlite3). Eine Codebasis, zwei Betriebsmodi über `APP_MODE`:

| Modus | Wo | Erreichbar |
|---|---|---|
| `public` | gehostet (Fly.io/VPS mit Volume) | nur `/anmeldung`, `/api/register`, `/api/club-teams`, `/api/clubs` und die tokengeschützten `/api/sync/*` |
| `local` | Laptop am Turniertag, lokales WLAN, kein Login | Verwaltung unter `/admin`, Live-Board unter `/board/live` |

## Testapp ausprobieren

### Variante A: im Browser mit GitHub Codespaces (keine Installation)

1. Auf GitHub das Repository öffnen und oben links den Branch `claude/cornhole-tournament-app-xl4i57` wählen.
2. Grüner Button **Code** → Reiter **Codespaces** → **Create codespace on claude/cornhole-tournament-app-xl4i57**.
3. Warten (beim ersten Mal ca. 2–4 Minuten): Pakete werden installiert, die App gebaut und Demo-Daten angelegt.
4. Die App öffnet sich automatisch in einem neuen Tab (sonst unten im Reiter **Ports** bei Port 3000 auf die Weltkugel klicken).

### Variante B: auf dem eigenen Computer

1. [Node.js 22 LTS](https://nodejs.org) installieren.
2. Im Terminal:
   ```bash
   git clone https://github.com/HofiFlo/Cornhole && cd Cornhole
   git checkout claude/cornhole-tournament-app-xl4i57
   npm install
   npm run build
   npm run demo
   ```
3. Im Browser <http://localhost:3000> öffnen.

`npm run demo` setzt die Testdatenbank jedes Mal zurück: 60 bezahlte Teams, 3 offene Zahlungen (1 überfällig),
2 auf der Warteliste. Ohne Mailserver landen alle Mails unter **Postausgang (Test)** – dort kann man auch den
Bestätigungslink anklicken.

### Was man ausprobieren kann

1. **Anmeldeformular ↗** (oben rechts) → Team anmelden, Verein „CC Donaustadt“ eintippen → Zusatz-Vorschlag erscheint.
2. **Postausgang (Test)** → Bestätigungslink klicken → „Anmeldung jetzt bestätigen“ → Zahlungsdaten.
   Das 64. Team bekommt einen Platz, ab dem 65. geht es auf die Warteliste.
3. **Anmeldungen** → „Zahlung bestätigt“, „Erinnern“, „Verfallen lassen“ (Warteliste rückt nach), Filter „Überfällig“.
4. **E-Mails** → Rundmail mit Platzhaltern und Vorschau.
5. **Übersicht** → Anmeldung schließen. **Gruppen** → „Rest zufällig verteilen“ → „Gruppen fixieren & Spielplan generieren“.
6. **Spielplan & Ergebnisse** → Spiele erfassen (pro Kehre Säckchen im Loch / auf dem Brett), **Live-Board ↗** in
   einem zweiten Tab beobachten (aktualisiert sich alle 15 s).
7. Nach dem letzten Gruppenspiel **KO-Runde** erzeugen und bis zum Finale spielen.

## Schnellstart (lokal)

```bash
npm install
cp .env.example .env.local        # Werte anpassen (APP_MODE=local)
npm run dev                       # http://localhost:3000 → /admin
```

Ohne `HOSTED_URL` läuft die lokale App **standalone**: Anmeldungen landen direkt in der lokalen DB (praktisch zum Testen).

Demo-Daten (64 bestätigte Teams, drei Vereine mit je 8 Teams):

```bash
npm run seed -- 64 --reset
```

Tests und Typprüfung:

```bash
npm test
npm run typecheck
```

## Anmeldung (öffentlich)

1. Team füllt das Formular aus → Spieler 1 bekommt eine Mail mit **Bestätigungslink** (Double-Opt-in).
2. Erst mit Klick auf „Anmeldung jetzt bestätigen“ wird ein Platz vergeben (bzw. Warteliste bei vollem Turnier)
   und die Zahlungsdaten (IBAN, Referenz, Frist) werden angezeigt und gemailt.
3. Nicht bestätigte Anmeldungen geben den Teamnamen nach 48 Stunden wieder frei.

## Zahlungen & E-Mails (Turnierleitung)

- **Anmeldungen** (`/admin/anmeldungen`): „Zahlung bestätigt“, „Erinnern“ (Zahlungserinnerung an ein Team),
  „Verfallen lassen“ und „Mail“. Überfällige Zahlungen sind rot markiert – **Anmeldungen verfallen nie automatisch**,
  die Turnierleitung entscheidet. Beim Verfall rückt das erste Team der Warteliste nach und bekommt die Zahlungsdaten.
- **E-Mails** (`/admin/mails`): Rundmail an eine Empfängergruppe (alle, bestätigt, Zahlung offen, überfällig,
  Warteliste) oder einzelne Teams; Zahlungserinnerung als Vorlage oder freie Nachricht mit Platzhaltern
  `{team}`, `{spieler1}`, `{referenz}`, `{frist}`, `{iban}`, `{betrag}` und Vorschau.
- Versendet wird über die gehostete Instanz (dort liegen die SMTP-Zugangsdaten); im Standalone-Betrieb direkt lokal.

## Turniertag

1. **Übersicht** (`/admin`): Anmeldungen synchronisieren, Anmeldung schließen, Turnierbeginn + Minuten pro Slot setzen.
2. **Anmeldungen** (`/admin/anmeldungen`): Zahlungseingänge per Referenz (z. B. `CH2026-0012`) suchen und bestätigen.
   Die Bestätigung wird an die gehostete Instanz gesendet, die dem Team die Bestätigungsmail schickt.
3. **Gruppen** (`/admin/gruppen`): Teams per Dropdown oder „Rest zufällig verteilen“ auf A–H verteilen.
   Teams desselben Vereins werden getrennt, Konflikte sind rot markiert. „Fixieren & Spielplan generieren“
   erzeugt den Round-Robin-Plan (fehlende Teams → Freilos = automatischer Sieg, Bahnen A–D je 2, E–H je 1).
4. **Spielplan & Ergebnisse** (`/admin/spielplan`): nächstes Spiel je Bahn, Suche nach Team, Erfassung des
   Papier-Turnierzettels: pro Kehre Säckchen im Loch / auf dem Brett je Team (Cancellation Scoring wird berechnet).
   4 Säckchen im Loch = 4-Bagger → automatisch unter **Freigetränke** eingetragen.
5. **KO-Runde** (`/admin/ko`): nach dem letzten Gruppenspiel auslosen. Top 4 je Gruppe → 16tel-Finale,
   Gruppensieger vs. Gruppenvierte, Zweite vs. Dritte; Teams derselben Gruppe erst ab Viertelfinale.
   16tel/8tel mit 8 Kehren + Verlängerung, ab Viertelfinale Sätze bis 21 (Best of 3) vom Schiedsrichter-Zettel.
6. **Live-Board** (`/board/live`): Hochformat-Display, alle Gruppen einspaltig mit Sp/Pkt/Diff, aktualisiert alle 15 s.

Wertung Gruppenphase: Sieg 2, Unentschieden 1, Niederlage 0 Tabellenpunkte; Reihenfolge nach Punkten, Differenz, erzielten Punkten.

## Synchronisation

Die lokale App holt per `GET {HOSTED_URL}/api/sync/teams` alle Anmeldungen (lokale Gruppenzuteilung bleibt erhalten)
und sendet Zahlungsbestätigungen bzw. „Anmeldung schließen“ an die gehostete Instanz. Authentifizierung
ausschließlich über `Authorization: Bearer $SYNC_TOKEN` – derselbe Wert muss auf beiden Instanzen gesetzt sein.

Die Zahlungsfrist beträgt `PAYMENT_DAYS` (Standard 14) Tage ab Bestätigung der E-Mail-Adresse. Verfall und
Mails lösen die Turnierleitung lokal aus, ausgeführt werden sie auf der gehosteten Instanz.

## Deployment (gehostet)

```bash
fly launch --no-deploy
fly volumes create cornhole_data --size 1
fly secrets set PUBLIC_URL=https://anmeldung.eure-domain.at SYNC_TOKEN=... TOURNAMENT_IBAN=... TOURNAMENT_ACCOUNT_HOLDER=... ENTRY_FEE="30,00 €" \
  SMTP_HOST=... SMTP_USER=... SMTP_PASS=... MAIL_FROM="Cornhole-Turnier <turnier@…>"
fly deploy
```

Subdomain (z. B. `anmeldung.eure-domain.at`) per `fly certs add` verbinden und von der Homepage verlinken.
Die DB-Datei liegt unter `/data/cornhole.db` – täglich sichern (z. B. `fly ssh sftp get /data/cornhole.db`).

Lokal am Turniertag: `npm run build` einmal vorab, dann `start.bat` (Windows) bzw.
`APP_MODE=local HOSTED_URL=… SYNC_TOKEN=… npm run start -- -H 0.0.0.0`. Die anderen Geräte im WLAN
öffnen `http://<IP-des-Laptops>:3000/admin`.

## Umgebungsvariablen

Siehe `.env.example`. Ohne `SMTP_HOST` werden Mails nur in der Konsole ausgegeben.

## Abweichungen/Ergänzungen zur Spezifikation

- `middleware.ts` heißt in Next.js 16 `proxy.ts` (gleiche Logik; `/` leitet im Public-Modus auf `/anmeldung` weiter).
- Schema ergänzt (in `db/schema.sql` markiert): `kehren.match_type` + Säckchen-Zählung, `ko_matches.position`/Punkte/
  Status `waiting`, `four_baggers.match_type`/`player_name`/`auto`/`redeemed`.
- KO-Setzung nutzt die Standard-Setzliste (1–32) statt reiner Topf-Reihenfolge, damit Gruppensieger nicht
  gegeneinander spielen; die Vereins-/Gruppen-Trennung pro 8tel-Viertel aus der Spezifikation bleibt erhalten.
- Anmeldung mit Double-Opt-in (neuer Status `unverified`), kein automatischer Verfall, Zahlungserinnerungen und
  Rundmails; Spalten `email_verify_token`, `email_verified_at`, `last_reminder_at` (werden bei bestehenden DBs ergänzt).
- Ergebnisse können korrigiert werden (Gruppenspiele während der Gruppenphase, KO-Spiele solange das Folgespiel
  noch kein Ergebnis hat).
