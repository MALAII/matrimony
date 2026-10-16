'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export const Header = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const { currentUser, authLoading, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
      if (pathname === '/profile' || pathname.startsWith('/admin')) {
        window.location.href = '/';
      }
    } catch (e) {
      window.location.href = '/';
    }
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen((prev) => !prev);
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  return (
    <header className="header">
      <div className="container header-inner">
        {/* Brand Logo & Identity */}
        <Link href="/" className="brand-logo" onClick={closeMobileMenu}>
          <span className="brand-emblem" aria-hidden="true">
            <Sparkles size={18} />
          </span>
          <div className="brand-text-wrap">
            <span className="brand-name">Matrimony Platform</span>
            <span className="brand-tagline">South Indian Traditions</span>
          </div>
        </Link>

        {/* Mobile Navigation Toggle Button */}
        <button
          type="button"
          className="header-mobile-toggle"
          onClick={toggleMobileMenu}
          aria-expanded={mobileMenuOpen}
          aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
        >
          {mobileMenuOpen ? '✕' : '☰'}
        </button>

        {/* Navigation Links Group */}
        <nav
          className={`nav-group ${mobileMenuOpen ? 'mobile-open' : ''}`}
          aria-label="Main Navigation"
        >
          <Link
            href="/"
            className={`nav-link ${pathname === '/' ? 'nav-link-active' : ''}`}
            onClick={closeMobileMenu}
          >
            Home
          </Link>
          <Link
            href="/members"
            className={`nav-link ${pathname === '/members' ? 'nav-link-active' : ''}`}
            onClick={closeMobileMenu}
          >
            Browse Profiles
          </Link>
          <Link
            href="/#how-it-works"
            className="nav-link"
            scroll={false}
            onClick={closeMobileMenu}
          >
            How It Works
          </Link>
          <Link
            href="/#jathagam"
            className="nav-link"
            scroll={false}
            onClick={closeMobileMenu}
          >
            Jathagam
          </Link>
          <Link
            href="/#membership"
            className="nav-link"
            scroll={false}
            onClick={closeMobileMenu}
          >
            Membership
          </Link>

          {/* Role-based navigation for authenticated users */}
          {currentUser && currentUser.role === 'admin' && (
            <Link
              href="/admin"
              className={`nav-link ${pathname.startsWith('/admin') ? 'nav-link-active' : ''}`}
              onClick={closeMobileMenu}
            >
              Admin Dashboard
            </Link>
          )}

          {currentUser && (
            <Link
              href="/profile"
              className={`nav-link ${pathname === '/profile' ? 'nav-link-active' : ''}`}
              onClick={closeMobileMenu}
            >
              My Profile
            </Link>
          )}

          <div className="nav-auth-actions" aria-busy={authLoading}>
            {authLoading ? (
              <div className="nav-auth-placeholder" aria-hidden="true" />
            ) : currentUser ? (
              <button
                type="button"
                onClick={() => {
                  closeMobileMenu();
                  handleLogout();
                }}
                className="nav-link nav-link-secondary"
                style={{
                  background: 'transparent',
                  cursor: 'pointer',
                  border: '1px solid var(--border-gold)',
                  fontFamily: 'inherit',
                }}
              >
                Sign Out
              </button>
            ) : (
              <>
                <Link
                  href="/login"
                  className="nav-link nav-link-secondary"
                  onClick={closeMobileMenu}
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className="nav-link nav-link-btn"
                  onClick={closeMobileMenu}
                >
                  <Sparkles size={14} className="btn-sparkle" aria-hidden="true" />
                  <span>Register Free</span>
                </Link>
              </>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
};
