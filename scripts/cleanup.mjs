// Aufruf ausschließlich innerhalb des privaten Render-Netzwerks.
// Secrets und Verbindungsadressen werden nicht protokolliert.
async function main() {
  const { APP_HOSTPORT, CRON_SECRET } = process.env;
  if (!APP_HOSTPORT || !CRON_SECRET || CRON_SECRET.length < 32) {
    throw new Error("Konfiguration für den Aufräumjob fehlt.");
  }
  const response = await fetch(`http://${APP_HOSTPORT}/api/cron/cleanup`, {
    method: "POST",
    headers: { Authorization: `Bearer ${CRON_SECRET}` },
    signal: AbortSignal.timeout(30_000),
    redirect: "error",
  });
  if (!response.ok) throw new Error("Aufräum-Endpunkt nicht erfolgreich.");
  const result = await response.json();
  if (!Number.isInteger(result.deleted) || result.deleted < 0) {
    throw new Error("Ungültige Antwort des Aufräum-Endpunkts.");
  }
  console.log(
    `Aufräumen abgeschlossen: ${result.deleted} Aktivitäten gelöscht.`,
  );
}
main().catch(() => {
  console.error(
    "Aufräumjob fehlgeschlagen. Bitte Dienststatus und Konfiguration prüfen.",
  );
  process.exitCode = 1;
});
