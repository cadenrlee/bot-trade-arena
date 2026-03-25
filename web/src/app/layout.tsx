import type { Metadata } from 'next';
import './globals.css';
import { AppShell } from './app-shell';

export const metadata: Metadata = {
  title: 'Bot Trade Arena — Competitive Bot Trading',
  description: 'Build trading bots. Compete head-to-head. Climb the ranks.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full dark">
      <head>
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
        />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="h-full bg-[var(--bg-primary)] text-[var(--text-primary)] font-[family-name:var(--font-body)] antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
