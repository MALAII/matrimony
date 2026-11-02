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
            <ShieldCheck size={13} aria-hidden="true" /> Free registration &middot; Contact numbers always private
          </span>
          <span className="header-topbar-langs">Tamil &middot; Telugu &middot; Kannada &middot; Malayalam</span>
        </div>
      </div>
      <div className="container header-inner">
        {/* Brand Logo & Identity */}
        <Link href="/" className="brand-logo" onClick={closeMobileMenu}>
          <span className="brand-emblem" aria-hidden="true">
            <Heart size={17} fill="currentColor" />
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

          <div className="nav-auth-actions" aria-busy={authLoading}>
            {authLoading ? (
              <div className="nav-auth-placeholder" aria-hidden="true" />
            ) : currentUser ? (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.65rem' }}>
                <NotificationBell feed="user" />
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
                      <strong style={{ display: 'block', fontSize: '0.88rem', color: 'var(--text-main, #142D28)' }}>
                        {currentUser.name}
                      </strong>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748b)', fontFamily: 'monospace' }}>
                        {currentUser.email}
                      </span>
                    </div>

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

                    {currentUser.role === 'admin' && (
                      <Link
                        href="/admin"
                        className="user-nav-dropdown-item"
                        role="menuitem"
                        onClick={closeMobileMenu}
                      >
                        <ShieldCheck size={15} color="#b08d4c" /> Admin Console
                      </Link>
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
