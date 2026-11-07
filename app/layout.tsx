import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
export const metadata: Metadata = {
  title: "Klassenwand · Gemeinsam denken",
  description:
    "Wortwolken und Text-Pinnwände für deinen Unterricht. Ohne Anmeldung.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>
        <header className="site-header">
          <Link className="brand" href="/">
            <span className="brand-icon">
              k<span>•</span>
            </span>
            klassenwand<span className="brand-dot">.</span>
          </Link>
          <span className="header-note">Ein Raum für alle Gedanken.</span>
        </header>
        {children}
        <footer>
          <span>Gemeinsam denken. Einfach mitmachen.</span>
          <nav>
            <Link href="/impressum">Impressum</Link>
            <Link href="/datenschutz">Datenschutz</Link>
          </nav>
        </footer>
      </body>
    </html>
  );
}
