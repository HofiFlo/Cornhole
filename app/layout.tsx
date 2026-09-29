import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: process.env.TOURNAMENT_NAME || 'Cornhole-Turnier',
  description: 'Anmeldung und Turnierverwaltung',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
