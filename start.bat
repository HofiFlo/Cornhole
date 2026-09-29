:: start.bat — lokale App am Turniertag
:: Einmalig vorher: npm install && npm run build
set APP_MODE=local
set HOSTED_URL=https://anmeldung.eure-domain.at
set SYNC_TOKEN=hier-den-geheimen-schluessel-eintragen
npm run start -- -H 0.0.0.0
