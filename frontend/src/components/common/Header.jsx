'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Heart,
  Menu,
  X,
  User,
  Users,
  CreditCard,
  ShieldCheck,
  LogOut,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { NotificationBell } from '@/components/common/NotificationBell';

export const Header = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const pathname = usePathname();
  const { currentUser, authLoading, logout } = useAuth();
  const headerRef = useRef(null);

  // Close menus on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setUserMenuOpen(false);
  }, [pathname]);

  // Click-outside listener to dismiss menus
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (headerRef.current && !headerRef.current.contains(e.target)) {
        setMobileMenuOpen(false);
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
    setUserMenuOpen(false);
  };

  const userInitial = currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'U';

  return (
    <header className="header" ref={headerRef}>
      <div className="header-topbar">
        <div className="container header-topbar-inner">
          <span>
            <ShieldCheck size={14} aria-hidden="true" /> 100% Verified Profiles &bull; Contact Numbers Kept Strictly Private
          </span>
          <span className="header-topbar-langs" aria-label="Languages">
            <span style={{ color: 'var(--accent, #D99A24)', fontWeight: 600 }}>Languages:</span>{' '}
            <span style={{ cursor: 'pointer' }} title="Tamil">தமிழ்</span> &middot;{' '}
            <span style={{ cursor: 'pointer' }} title="Telugu">తెలుగు</span> &middot;{' '}
            <span style={{ cursor: 'pointer' }} title="Kannada">ಕನ್ನಡ</span> &middot;{' '}
            <span style={{ cursor: 'pointer' }} title="Malayalam">മലയാളം</span>
          </span>
        </div>
      </div>
      <div className="container header-inner">
        {/* Brand Logo & Identity */}
        <Link href="/" className="brand-logo" onClick={closeMobileMenu}>
          <img
            src="/logo.png"
            alt="Varaghi Matrimony"
            className="brand-logo-img"
          />
          <div className="brand-text-wrap">
            <span className="brand-name">VARAGHI MATRIMONY</span>
            <img
              src="/images/varaghi/gold-divider.png"
              alt=""
              aria-hidden="true"
              className="brand-divider"
            />
            <span className="brand-tagline">ஸ்ரீ வாராஹி திருமண தகவல் மையம்</span>
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
          {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
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
            className={`nav-link ${pathname === '/members' || pathname.startsWith('/members/') ? 'nav-link-active' : ''}`}
            onClick={closeMobileMenu}
          >
            Browse Profiles
          </Link>
          <Link
            href="/membership"
            className={`nav-link ${pathname === '/membership' ? 'nav-link-active' : ''}`}
            onClick={closeMobileMenu}
          >
            Membership Plans
          </Link>
          <Link
            href="/#how-it-works"
            className="nav-link"
            onClick={closeMobileMenu}
          >
            How It Works
          </Link>
          <Link
            href="/about"
            className={`nav-link ${pathname === '/about' ? 'nav-link-active' : ''}`}
            onClick={closeMobileMenu}
          >
            About Us
          </Link>
          <Link
            href="/contact"
            className={`nav-link ${pathname === '/contact' ? 'nav-link-active' : ''}`}
            onClick={closeMobileMenu}
          >
            Contact
          </Link>

          <div className="nav-auth-actions" aria-busy={authLoading}>
            {authLoading ? (
              <div className="nav-auth-placeholder" aria-hidden="true" />
            ) : currentUser ? (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.65rem' }}>
                {currentUser.role === 'admin' ? (
                  <Link
                    href="/admin"
                    className="nav-link nav-link-btn"
                    onClick={closeMobileMenu}
                    style={{
                      background: 'linear-gradient(135deg, #2b1a21 0%, #3a1c28 100%)',
                      border: '1px solid #b08d4c',
                      color: '#e0bd77',
                      padding: '0.45rem 1rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      borderRadius: '9999px',
                      textDecoration: 'none',
                    }}
                  >
                    <ShieldCheck size={15} color="#e0bd77" />
                    <span>Admin Console</span>
                  </Link>
                ) : (
                  <NotificationBell feed="user" />
                )}

                <div className="user-menu-container">
                  <button
                    type="button"
                    className="user-menu-trigger"
                    onClick={() => setUserMenuOpen((prev) => !prev)}
                    aria-expanded={userMenuOpen}
                    aria-label="Toggle user account menu"
                  >
                  <span className="user-nav-avatar">{userInitial}</span>
                  <span style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {currentUser.name || 'Account'}
                  </span>
                  <ChevronDown
                    size={14}
                    style={{
                      transform: userMenuOpen ? 'rotate(180deg)' : 'rotate(0)',
                      transition: 'transform 0.2s ease',
                    }}
                  />
                </button>

                {userMenuOpen && (
                  <div className="user-nav-dropdown" role="menu">
                    <div className="user-nav-dropdown-header">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                        <strong style={{ fontSize: '0.88rem', color: 'var(--text-main, #142D28)' }}>
                          {currentUser.name}
                        </strong>
                        {currentUser.role === 'admin' && (
                          <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.5px', background: '#fef7ee', color: '#8c6a28', border: '1px solid #e0bd77', padding: '1px 6px', borderRadius: '999px', fontWeight: 700 }}>
                            Admin
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748b)', fontFamily: 'monospace' }}>
                        {currentUser.email}
                      </span>
                    </div>

                    {currentUser.role === 'admin' ? (
                      /* Admin-only menu items */
                      <Link
                        href="/admin"
                        className="user-nav-dropdown-item"
                        role="menuitem"
                        onClick={closeMobileMenu}
                        style={{ fontWeight: 600, color: 'var(--primary, #7d3147)' }}
                      >
                        <ShieldCheck size={15} color="#b08d4c" /> Admin Console
                      </Link>
                    ) : (
                      /* Candidate user menu items */
                      <>
                        <Link
                          href="/profile"
                          className="user-nav-dropdown-item"
                          role="menuitem"
                          onClick={closeMobileMenu}
                        >
                          <User size={15} /> My Profile
                        </Link>

                        <Link
                          href="/membership"
                          className="user-nav-dropdown-item"
                          role="menuitem"
                          onClick={closeMobileMenu}
                        >
                          <CreditCard size={15} /> Membership Plans
                        </Link>
                      </>
                    )}

                    <div className="user-nav-dropdown-divider" />

                    <button
                      type="button"
                      className="user-nav-dropdown-item"
                      role="menuitem"
                      onClick={() => {
                        closeMobileMenu();
                        handleLogout();
                      }}
                      style={{ color: 'var(--danger, #dc2626)' }}
                    >
                      <LogOut size={15} /> Sign Out
                    </button>
                  </div>
                )}
              </div>
            </div>
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
