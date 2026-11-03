import './globals.css';
import { Playfair_Display, Inter } from 'next/font/google';
import { AuthProvider } from '@/context/AuthContext';
import { SiteChrome } from '@/components/common/SiteChrome';

const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair', display: 'swap' });
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata = {
  title: 'Varaghi Matrimony | ஸ்ரீ வாராஹி திருமண தகவல் மையம்',
  description: 'Sri Varaghi Matrimony — A dignified matrimonial platform honoring South Indian cultural traditions, family values, and candidate contact privacy.',
  keywords: ['varaghi matrimony', 'matrimony', 'south indian matrimony', 'tamil matrimony', 'matchmaking'],
  icons: {
    icon: '/logo.png',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`notranslate ${playfair.variable} ${inter.variable}`} translate="no" suppressHydrationWarning>
      <head>
        <meta name="google" content="notranslate" />
      </head>
      <body suppressHydrationWarning>
        <AuthProvider>
          <SiteChrome>{children}</SiteChrome>
        </AuthProvider>
      </body>
    </html>
  );
}
