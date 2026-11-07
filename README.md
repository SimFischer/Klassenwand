# Klassenwand

Eine deutschsprachige Unterrichts-App mit **Wortwolke** und **Text-Pinnwand**. Die Klasse nimmt über einen QR-Code ohne Konto teil. Die Datei-Pinnwand ist ausschließlich eine inaktive „Kommt bald“-Karte. `/b/...` und `/api/boards/...` sind reserviert.

## Lokal starten

Voraussetzungen: Node.js **22.9 oder neuer**, npm und PostgreSQL 17 (oder eine kompatible aktuelle PostgreSQL-Version). Optional Docker Compose für die lokale Datenbank.

```sh
npm ci
cp .env.example .env.local
docker compose up -d db
npm run db:migrate
npm run dev
```

Unter Windows statt `cp`: `Copy-Item .env.example .env.local`. Ohne Docker die Datenbank selbst anlegen und `DATABASE_URL` anpassen. Öffne [localhost:3000](http://localhost:3000). Die App verwendet Webpack, damit auch Windows-Umgebungen ohne Berechtigung für Turbopack-Junctions funktionieren.

Für Tests mit echten Handys muss der Entwicklungsrechner im lokalen Netz erreichbar sein. Öffne die App bereits vor dem Erstellen über dessen Netzwerkadresse: Der QR-Code verwendet die aktuelle Seitenadresse. Für den produktiven Einsatz HTTPS verwenden; für anonyme Gerätekennungen ist die Web-Crypto-API erforderlich.

## Umgebungsvariablen

| Variable       | Bedeutung                                                                                                                                                                                       |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL` | PostgreSQL-Verbindung, z. B. `postgresql://user:password@host:5432/klassenwand`. Bei verwalteten Datenbanken TLS nach Vorgabe des Anbieters konfigurieren; Zertifikatsprüfung nicht abschalten. |
| `CRON_SECRET`  | Zufälliges Secret mit mindestens 32 Zeichen, ausschließlich serverseitig.                                                                                                                       |

Ein Secret lässt sich mit `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` erzeugen. Keine Secrets in Git einchecken. Es gibt keine `NEXT_PUBLIC_`-Secrets.

## Datenbank und Migrationen

`lib/db/schema.ts` definiert das Drizzle-Schema. `lib/db/repository.ts` kapselt Erstellung, Lesen, transaktionale Änderung und Löschung. Nur diese Schicht kennt die Datenhaltung. Jeder Aktivitätsdatensatz enthält den typsicheren Zustand als JSONB. Änderungen sperren seine Zeile mittels `SELECT … FOR UPDATE` und erhöhen die Revision atomar. Das verhindert verlorene Änderungen sowie das Umgehen von Limits durch parallele Requests. Dieser Ansatz ist für Unterrichtsgruppen ausgelegt; sehr große öffentliche Veranstaltungen benötigen eine stärker aufgeteilte Datenhaltung.

```sh
npm run db:generate  # nach Schemaänderungen; DATABASE_URL bei Bedarf als Umgebung setzen
npm run db:migrate  # liest .env.local; bereits angewandte Migrationen werden übersprungen
```

Die initiale SQL-Migration und das Drizzle-Journal sind eingecheckt. In Produktion Migrationen einmal vor dem Start der neuen Version ausführen, nicht in jedem Request. PostgreSQL mit persistentem Speicher betreiben.

## Bedienung

- Startseite: Werkzeug wählen, Frage bzw. Titel und Spalten eingeben, Aktivität erstellen. Der geheime Lehrkraft-Link wird lokal in „Deine Aktivitäten“ gemerkt. Er ist eine Zugangsberechtigung: nur den **Teilnahmelink oder QR-Code** weitergeben.
- Wortwolke: standardmäßig drei Begriffe pro Person, maximal 30 Zeichen. Randzeichen, Leerzeichen und Groß-/Kleinschreibung werden normalisiert. Die häufigste Schreibweise wird angezeigt. Ein Klick oder Enter/Leertaste auf ein Wort blendet es dauerhaft aus. „Ausgeblendete Wörter“ erlaubt Wiederherstellen. Blockierte neue Begriffe erhalten die gleiche Bestätigung wie andere Eingaben und zählen zum persönlichen Limit. Sie werden nicht gespeichert. Beim Zurücksetzen werden Begriffe, Blacklist und persönliche Begriffsbudgets zurückgesetzt; das kurzfristige Rate-Limit bleibt bestehen. PNG-Export enthält die sichtbare Wolke.
- Pinnwand: Spalten bearbeiten, schließen, umsortieren oder löschen. Beiträge mit optionalem Kürzel, Antworten und Querverweisen verfassen. Antworten auf Antworten werden in einer Ebene mit Bezugsangabe geführt. Eigene Texte können zehn Minuten lang geändert oder gelöscht werden. Ein gelöschter Hauptbeitrag entfernt auch seine Antworten. Gelöschte Bezüge zeigen einen neutralen Hinweis.
- Moderation: Beiträge und Antworten ein- oder ausblenden, freigeben oder löschen. Im Freigabe-Modus bleiben neue Beiträge und spätere Schüleränderungen bis zur Freigabe für andere unsichtbar. Eigene wartende Beiträge sind für das jeweilige Gerät sichtbar. Ausgeblendete Beiträge bleiben für die Lehrkraft blass sichtbar. Hauptbeiträge lassen sich per Drag & Drop oder über „Verschieben“ samt Antworten in andere Spalten und vor andere Beiträge verschieben.
- Export: „Drucken / PDF“ verwendet ein eigenes Print-Stylesheet. In der Lehrkraft-Ansicht enthält der Druck alle Spalten, Beiträge und Antworten, einschließlich als ausgeblendet oder wartend markierter Inhalte. Im Browser „Als PDF speichern“ wählen. Vollbild und QR-Anzeige stehen in beiden Host-Ansichten bereit.

## Rechte, Datenschutz und Grenzen

- Zufällige Aktivitäts-ID mit 64 Bit Entropie; unabhängiger Host-Schlüssel mit 256 Bit, serverseitig nur als SHA-256-Hash gespeichert. API-Übertragung im Header `x-host-key`, Prüfung mit `timingSafeEqual` gegen gleich lange Hashes.
- Zufällige Gerätekennung als UUID in `localStorage` und Header `x-participant-id`; keine Namen, Konten oder IP-Adressen als Identifikator. Fremde Gerätekennungen, Host-Hashes und Rohdaten werden nicht in API-Snapshots ausgegeben. Benutzertexte werden ausschließlich als React-Text gerendert.
- Pro Gerät/Aktivität maximal 20 Schreibaktionen pro Minute und bei Pinnwänden 100 Beiträge einschließlich Antworten. Wortwolkenbudget konfigurierbar von 1 bis 20. Maximal 1.000 Geräte, 10.000 gespeicherte Worteinreichungen bzw. 3.000 Pinnwandbeiträge und 12 Spalten. Die API begrenzt JSON-Bodys auf 16 KiB.
- Aktivitätserstellung: zehn pro Gerätekennung und Stunde sowie global 200 pro Stunde, persistent in PostgreSQL. Schüler können durch Löschen ihres Browserspeichers eine neue Kennung erzeugen. Diese einfachen Limits sind kein Schutz gegen gezielte verteilte Angriffe; am Hosting können anonyme globale Request-Limits ergänzt werden.
- Live-Polling alle 2,5 Sekunden mit `?since=<revision>`, `{ unchanged: true }` bei unverändertem Zustand, exponentiellem Backoff bis 30 Sekunden und Pause bei verborgenem Tab. Keine WebSockets.
- Keine Cookies, Analytics, externen CDNs oder Google Fonts. Systemschriften, QR-Code und Layoutbibliothek werden lokal ausgeliefert. `d3-cloud` ist BSD-3-Clause-lizenziert (vergleichbare freie Bibliothek); weitere Lizenzen liegen in den jeweiligen npm-Paketen. Host-URLs werden durch `Referrer-Policy: no-referrer` nicht als Referrer weitergegeben. API-Antworten sind `no-store`.
- Aktivitäten sind **exakt sieben Tage** erreichbar. Sowohl Server-Seiten als auch sämtliche API-Lese-/Schreibzugriffe prüfen `expiresAt`. Abgelaufene Aktivitäten liefern sofort 404. Die Lehrkraft kann jederzeit vollständig löschen.
- Vor produktivem Betrieb **Impressum und Datenschutzerklärung vervollständigen**, EU-Hosting auswählen und Auftragsverarbeitung klären. Zugriffslogs von Next.js-Hosting und Reverse-Proxy dürfen keine IP-Adressen oder geheime Host-URLs aufbewahren. Der Anwendungscode schreibt keine solchen Logs. Backups und deren Löschfristen liegen in der Verantwortung des Betreibers; die physische Löschung in der laufenden Datenbank entfernt keine externen Backups.
- Lokale Aktivitätslinks werden nach Ablauf nicht mehr dargestellt. Auf gemeinsam genutzten Geräten die Links aus dem Verlauf entfernen bzw. Browserspeicher löschen. Der lokale Verlauf ist kein Wiederherstellungssystem: Bei Verlust des geheimen Links kann die Lehrkraft ihn nicht zurücksetzen.

## Deployment

Die App braucht einen Node.js-Server (kein statischer Export/GitHub Pages) und eine PostgreSQL-Datenbank. Sie ist unabhängig von einem bestimmten Hosting-Anbieter.

```sh
npm ci
npm run db:migrate
npm run build
npm start
```

`DATABASE_URL` und `CRON_SECRET` als geschützte Servervariablen hinterlegen. HTTPS und korrekte Weiterleitung von Host/Protokoll konfigurieren. Mehrere Instanzen können dieselbe Datenbank nutzen. Secrets und Datenbank nicht in Browser-Bundles einbetten. Der Code ist für EU-Hosting vorbereitet; dieser Commit richtet keinen Hosting-Vertrag oder produktive Datenbank ein.

## Aufräum-Cron

Mindestens stündlich, empfohlen alle 15 Minuten:

```sh
curl --fail --request POST https://DEINE-DOMAIN/api/cron/cleanup \
  --header "Authorization: Bearer $CRON_SECRET"
```

Beispiel für einen System-Cron (Secret über die geschützte Umgebung des Jobs laden):

```cron
*/15 * * * * curl --fail --silent --show-error --request POST https://DEINE-DOMAIN/api/cron/cleanup --header "Authorization: Bearer $CRON_SECRET"
```

Der Endpunkt erlaubt ausschließlich POST mit gültigem Bearer-Secret. Antwort: `{"deleted": <Anzahl>}`. Er löscht abgelaufene Aktivitäten einschließlich aller Wörter, Blacklists, Beiträge, Antworten und Gerätebudgets sowie abgelaufene Erstellungszähler. Fehlgeschlagene Cron-Jobs beim Anbieter überwachen. Bei gestörtem Cron bleiben Aktivitäten weiterhin sofort ab Ablauf unzugänglich; die physische Löschung erfolgt beim nächsten erfolgreichen Lauf.

## Qualität prüfen

```sh
npm test
npm run typecheck
npm run build
```

Unit-Tests prüfen Normalisierung, häufigste Schreibweise, Blacklist und Wiederherstellung, Schlüsselprüfung, Zehn-Minuten-Regel, Moderation, Antworten, Freigaben und Limits. API-Integrationstests verwenden eine echte eingebettete PostgreSQL-Engine (PGlite, nur als Testabhängigkeit), führen die SQL-Migration aus und prüfen Erstellung, Polling, Blacklist, Löschung, Ablauf und Cron-Authentifizierung ohne externe Datenbank.

Eine GitHub-Actions-Vorlage liegt unter `ci/github-actions.yml`. Zur Aktivierung mit einem dafür berechtigten GitHub-Zugang nach `.github/workflows/checks.yml` kopieren. Der für die erstmalige Übertragung verfügbare OAuth-Zugang besitzt keine Berechtigung zum Anlegen von Workflows; deshalb ist die CI noch nicht automatisch aktiv.

## Struktur

```text
app/w, app/t          Schüler- und Lehrkraftseiten
app/api/w, app/api/t  getrennte Werkzeug-Endpunkte
app/api/activities   Erstellung
app/api/cron/cleanup Löschung abgelaufener Daten
components           QR, Wolke, Text-Pinnwand, gemeinsame Aktivitätsansicht
lib/wordcloud        Normalisierung, Blacklist, Aggregation
lib/board            Pinnwand-Aktionen und Rechte
lib/db               PostgreSQL/Drizzle und Repository
lib                  gemeinsame Validierung, Rechte, Polling, Serialisierung
drizzle              versionierte Datenbank-Migrationen
tests                Unit- und API-Integrationstests
```
