import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
export const metadata: Metadata = {
  title: "Klassenwand",
  description:
    "Wortwolken, Text-Pinnwände, Umfragen und Quiz für deinen Unterricht. Ohne Anmeldung.",
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
        </header>
        {children}
      </body>
    </html>
  );
}
