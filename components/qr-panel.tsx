"use client";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
export function QRPanel({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <aside className="qr-panel">
      <QRCodeSVG
        value={url}
        size={216}
        marginSize={3}
        level="M"
        title="QR-Code zum Mitmachen"
      />
      <h3>Scannen. Mitmachen.</h3>
      <p>
        Handykamera öffnen und loslegen.
        <br />
        Ganz ohne Anmeldung.
      </p>
      <a href={url} target="_blank" rel="noreferrer">
        Schülerseite öffnen ↗
      </a>
      <button
        className="subtle"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? "Link kopiert ✓" : "Teilnahmelink kopieren"}
      </button>
    </aside>
  );
}
