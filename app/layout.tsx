import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Music Price Monitor', description: 'Monitoraggio prezzi CD e LP' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
