import './globals.css';
import { Playfair_Display, Inter } from 'next/font/google';
import { AuthProvider } from '@/context/AuthContext';
import { SiteChrome } from '@/components/common/SiteChrome';

const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair', display: 'swap' });
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata = {
  title: 'Matrimony Platform | South Indian Matrimonial Traditions & Privacy',
  description: 'A dignified matrimonial platform honoring South Indian cultural traditions, family values, and candidate contact privacy.',
  keywords: ['matrimony', 'south indian matrimony', 'tamil matrimony', 'telugu matrimony', 'kannada matrimony', 'malayalam matrimony', 'matchmaking'],
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
