'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Header } from '@/components/common/Header';
import { Footer } from '@/components/common/Footer';

const AUTH_PAGES = ['/login', '/register', '/forgot-password', '/reset-password', '/setup-password'];

/**
 * Wraps public/member pages with the site header and footer.
 * Admin routes render their own dedicated shell (sidebar layout), so chrome is skipped there.
 * Auth routes render without the full sitemap footer so auth forms fit seamlessly in the viewport without page scroll.
 */
export function SiteChrome({ children }) {
  const pathname = usePathname() || '';
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    return <>{children}</>;
  }
  const isAuthPage = AUTH_PAGES.includes(pathname);

  return (
    <div className="site-container">
      <Header />
      <main className="main-content">{children}</main>
      {!isAuthPage && <Footer />}
    </div>
  );
}
