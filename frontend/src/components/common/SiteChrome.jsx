'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Header } from '@/components/common/Header';
import { Footer } from '@/components/common/Footer';

const AUTH_PAGES = ['/login', '/register', '/forgot-password', '/reset-password', '/setup-password'];

/**
 * Wraps public/member pages with the site header and footer.
 * Admin routes render their own dedicated shell (sidebar layout), so chrome is skipped there.
 * Auth routes render without the full sitemap footer so auth forms fit seamlessly in the viewport without page scroll.
 *
 * Strict Role Separation:
 * If an administrator is logged in and navigates to public/member pages, they are automatically
 * redirected to the Admin Console (/admin), keeping the administrative workspace isolated from member browsing.
 */
export function SiteChrome({ children }) {
  const pathname = usePathname() || '';
  const router = useRouter();
  const { currentUser, authLoading } = useAuth();

  const isAdminRoute = pathname === '/admin' || pathname.startsWith('/admin/');
  const isAuthPage = AUTH_PAGES.includes(pathname);
  const isAdminUser = currentUser?.role === 'admin';

  // Strict Admin Isolation: Automatically redirect administrators away from user pages to /admin
  useEffect(() => {
    if (!authLoading && isAdminUser && !isAdminRoute) {
      router.replace('/admin');
    }
  }, [authLoading, isAdminUser, isAdminRoute, router]);

  // Admin routes render in their own dedicated AdminLayout
  if (isAdminRoute) {
    return <>{children}</>;
  }

  // If logged-in admin is on a public/user page, do not flash member pages while redirecting
  if (!authLoading && isAdminUser) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#FFF8E9',
          color: '#650D18',
          fontFamily: 'var(--font-sans, sans-serif)',
          gap: '1rem',
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            border: '3px solid #E8D3BC',
            borderTopColor: '#A20D16',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <p style={{ fontWeight: 600, fontSize: '0.95rem' }}>Opening Admin Console…</p>
      </div>
    );
  }

  return (
    <div className="site-container">
      {/* Universal Water Ripple Blur Filter for Contact Numbers */}
      <svg style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }} aria-hidden="true">
        <defs>
          <filter id="water-blur" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.04 0.08" numOctaves="3" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="9" xChannelSelector="R" yChannelSelector="G" result="displaced" />
            <feGaussianBlur in="displaced" stdDeviation="3.6" />
          </filter>
        </defs>
      </svg>
      <Header />
      <main className="main-content">{children}</main>
      {!isAuthPage && <Footer />}
    </div>
  );
}
