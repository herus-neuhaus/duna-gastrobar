import type {Metadata} from 'next';
import { Cormorant_Garamond, Montserrat } from 'next/font/google';
import './globals.css'; // Global styles

const displayFont = Cormorant_Garamond({
  variable: '--font-display',
  subsets: ['latin'],
  weight: ['500', '600', '700'],
});

const bodyFont = Montserrat({
  variable: '--font-body',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
});

export const metadata: Metadata = {
  title: 'Duna Cozinha & Bar - Reservas',
  description: 'Sistema de reservas online do Duna Cozinha & Bar.',
  icons: {
    icon: '/Favicon-D.png',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="pt-BR">
      <body className={`${displayFont.variable} ${bodyFont.variable}`} suppressHydrationWarning>{children}</body>
    </html>
  );
}
