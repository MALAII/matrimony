import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { Header } from '@/components/common/Header';
import { Footer } from '@/components/common/Footer';

export const metadata = {
  title: 'Matrimony Platform | South Indian Matrimonial Traditions & Privacy',
  description: 'A dignified matrimonial platform honoring South Indian cultural traditions, individual Jathagam particulars, and candidate contact privacy.',
  keywords: ['matrimony', 'south indian matrimony', 'jathagam', 'rasi', 'nakshatram', 'matchmaking'],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="notranslate" translate="no" suppressHydrationWarning>
      <head>
        <meta name="google" content="notranslate" />
      </head>
      <body suppressHydrationWarning>
        <AuthProvider>
          <div className="site-container">
            <Header />
            <main className="main-content">{children}</main>
            <Footer />
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
