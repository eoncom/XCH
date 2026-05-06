import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { headers } from 'next/headers';
import './globals.css';
import { Providers } from './providers';
import { Toaster } from 'react-hot-toast';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'XCH - Gestion IT Sites',
  description: 'Application de gestion IT pour sites temporaires',
  manifest: '/manifest.json',
  themeColor: '#3b82f6',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'XCH',
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // S9 PR17 — read the per-request CSP nonce that middleware.ts injects
  // as the `x-nonce` request header. Future <Script nonce={nonce}> tags
  // (Sentry SDK, analytics, etc.) consume this. The nonce is read here
  // even when no <Script> currently renders so it stays a stable contract
  // and so any client component rendered below `<Providers>` can also
  // pick it up via a context if needed. headers() is async in Next 15.
  const nonce = (await headers()).get('x-nonce') ?? '';

  return (
    <html lang="fr" suppressHydrationWarning data-csp-nonce={nonce || undefined}>
      <body className={`${inter.className} antialiased`}>
        <Providers>
          {children}
          <Toaster position="bottom-right" toastOptions={{ style: { zIndex: 9999 } }} />
        </Providers>
      </body>
    </html>
  );
}
