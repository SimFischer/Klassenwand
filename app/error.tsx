"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="legal">
      <h1>Die Verbindung fehlt gerade.</h1>
      <p>
        Bitte versuche es gleich erneut. Für den Betrieb muss eine
        PostgreSQL-Datenbank eingerichtet sein.
      </p>
      <button onClick={reset}>Erneut versuchen</button>
    </main>
  );
}
