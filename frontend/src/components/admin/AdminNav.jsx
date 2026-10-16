'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export const AdminNav = () => {
  const pathname = usePathname();

  return (
    <nav className="admin-nav-tabs" aria-label="Admin Navigation Tabs">
      <Link
        href="/admin"
        className={`admin-nav-tab ${pathname === '/admin' ? 'active' : ''}`}
        aria-current={pathname === '/admin' ? 'page' : undefined}
      >
        <span>📊</span>
        <span>Dashboard Overview</span>
      </Link>
      <Link
        href="/admin/users"
        className={`admin-nav-tab ${pathname === '/admin/users' ? 'active' : ''}`}
        aria-current={pathname === '/admin/users' ? 'page' : undefined}
      >
        <span>👥</span>
        <span>User Accounts</span>
      </Link>
      <Link
        href="/admin/profiles"
        className={`admin-nav-tab ${pathname === '/admin/profiles' ? 'active' : ''}`}
        aria-current={pathname === '/admin/profiles' ? 'page' : undefined}
      >
        <span>💍</span>
        <span>Matrimonial Profiles</span>
      </Link>
    </nav>
  );
};
