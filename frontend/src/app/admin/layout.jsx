'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Users, Heart, LogOut, Menu, CreditCard, Receipt, X, ExternalLink, ShieldCheck, Sparkles } from 'lucide-react';
import { getAdminMeApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { NotificationBell } from '@/components/common/NotificationBell';
import './admin.css';

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/profiles', label: 'Profiles', icon: Heart, exact: false },
  { href: '/admin/horoscope', label: 'Horoscope', icon: Sparkles, exact: false },
  { href: '/admin/users', label: 'User Accounts', icon: Users, exact: false },
  { href: '/admin/subscriptions', label: 'Subscriptions', icon: CreditCard, exact: false },
  { href: '/admin/payments', label: 'Payments', icon: Receipt, exact: false },
];

function isActive(pathname, item) {
  if (item.exact) return pathname === item.href;
  if (item.href === '/admin/profiles') return pathname === '/admin/profiles';
  if (item.href === '/admin/horoscope') return pathname.startsWith('/admin/horoscope');
  return pathname.startsWith(item.href);
}

export default function AdminLayout({ children }) {
  const pathname = usePathname() || '';
  const router = useRouter();
  const { logout } = useAuth();
  const [admin, setAdmin] = useState(null);
  const [state, setState] = useState('loading'); // loading | ok | denied | error
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await getAdminMeApi();
        if (!alive) return;
        if (res.status === 401) return router.replace('/login');
        if (res.status === 403 || (res.data && res.data.role !== 'admin')) return setState('denied');
        if (res.success && res.data) {
          setAdmin(res.data);
          setState('ok');
        } else setState('error');
      } catch {
        if (alive) setState('error');
      }
    })();
    return () => {
      alive = false;
    };
  }, [router]);

  useEffect(() => setOpen(false), [pathname]);

  const signOut = async () => {
    await logout();
    window.location.href = '/login';
  };

  if (state !== 'ok') {
    return (
      <div className="adm adm-center">
        {state === 'loading' ? (
          <div className="adm-card adm-state">
            <div className="status-spinner" />
            <p>Verifying administrator session…</p>
          </div>
        ) : (
          <div className="adm-card adm-state">
            <ShieldCheck size={36} />
            <h1>{state === 'denied' ? 'Access denied' : 'Could not verify session'}</h1>
            <p>
              {state === 'denied'
                ? 'This area is restricted to administrators.'
                : 'The service is temporarily unreachable. Please check your network connection or try again shortly.'}
            </p>
            <div className="adm-row">
              <Link href="/login" className="btn-primary">Sign in</Link>
            </div>
          </div>
        )}
      </div>
    );
  }

  const current = NAV.find((n) => isActive(pathname, n));

  return (
    <div className="adm">
      <aside className={`adm-side ${open ? 'open' : ''}`}>
        <Link href="/admin" className="adm-brand" style={{ textDecoration: 'none' }}>
          <img
            src="/logo.png"
            alt="Varaghi Matrimony"
            className="adm-brand-logo-img"
          />
          <div className="adm-brand-text">
            <strong>Varaghi Matrimony</strong>
            <small>Admin Console</small>
          </div>
        </Link>
        <nav className="adm-menu" aria-label="Admin">
          <span className="adm-menu-label">Manage</span>
          {NAV.map((n) => {
            const Icon = n.icon;
            return (
              <Link key={n.href} href={n.href} className={isActive(pathname, n) ? 'active' : ''}>
                <Icon size={18} />
                <span>{n.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="adm-user">
          <span className="adm-avatar">{(admin.name || 'A').charAt(0).toUpperCase()}</span>
          <div className="adm-user-text">
            <strong>{admin.name}</strong>
            <small>{admin.email}</small>
          </div>
          <button type="button" onClick={signOut} title="Sign out" aria-label="Sign out">
            <LogOut size={18} />
          </button>
        </div>
      </aside>
      {open && <div className="adm-scrim" onClick={() => setOpen(false)} />}

      <div className="adm-main">
        <header className="adm-top" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button type="button" className="adm-burger" onClick={() => setOpen((o) => !o)} aria-label="Toggle menu">
              {open ? <X size={22} /> : <Menu size={22} />}
            </button>
            <span className="adm-crumb">
              Admin <i>·</i> <b>{current ? current.label : 'Console'}</b>
            </span>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <NotificationBell feed="admin" />
          </div>
        </header>
        <div className="adm-content">{children}</div>
      </div>
    </div>
  );
}
