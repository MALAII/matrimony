'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getAdminMeApi } from '@/lib/api';
import { AdminNav } from '@/components/admin/AdminNav';

export default function AdminDashboardPage() {
  const router = useRouter();
  const [adminUser, setAdminUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function verifyAdminSession() {
      try {
        const res = await getAdminMeApi();

        if (!isMounted) return;

        if (res.status === 401) {
          // Unauthenticated -> redirect to login
          router.replace('/login');
          return;
        }

        if (res.status === 403 || (res.data && res.data.role !== 'admin')) {
          // Authenticated but not admin
          setAccessDenied(true);
          setLoading(false);
          return;
        }

        if (res.success && res.data) {
          setAdminUser(res.data);
        } else {
          setErrorMessage(res.message || 'Unable to verify administrator session.');
        }
      } catch (err) {
        if (isMounted) {
          setErrorMessage('A network error occurred while verifying administrator credentials.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    verifyAdminSession();

    return () => {
      isMounted = false;
    };
  }, [router]);

  // 1. Loading State
  if (loading) {
    return (
      <main className="admin-page">
        <div className="admin-container text-center" style={{ paddingTop: '5rem', textAlign: 'center' }}>
          <div className="status-spinner" style={{ margin: '0 auto 1.5rem auto' }}></div>
          <h2 style={{ fontSize: '1.25rem', color: 'var(--text-muted)' }}>
            Verifying administrator credentials...
          </h2>
        </div>
      </main>
    );
  }

  // 2. Access Denied (Authenticated but not administrator)
  if (accessDenied) {
    return (
      <main className="admin-page">
        <div className="admin-container">
          <div className="admin-state-box" style={{ maxWidth: '580px', margin: '4rem auto' }}>
            <span className="admin-state-icon" role="img" aria-label="Access Denied">
              🚫
            </span>
            <h1 className="admin-state-title" style={{ color: 'var(--danger)' }}>
              Access Denied
            </h1>
            <p className="admin-state-desc">
              Your account does not possess administrator privileges. Access to the administration console is strictly restricted to verified administrators.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <Link href="/" className="btn-secondary" style={{ padding: '0.65rem 1.5rem' }}>
                Return to Home
              </Link>
              <Link href="/login" className="btn-upload" style={{ padding: '0.65rem 1.5rem' }}>
                Sign In with Different Account
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // 3. Error state
  if (errorMessage || !adminUser) {
    return (
      <main className="admin-page">
        <div className="admin-container">
          <div className="admin-state-box" style={{ maxWidth: '580px', margin: '4rem auto' }}>
            <span className="admin-state-icon" role="img" aria-label="Error">
              ⚠️
            </span>
            <h1 className="admin-state-title">Verification Error</h1>
            <p className="admin-state-desc">
              {errorMessage || 'Unable to load administrator profile.'}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="btn-search"
            >
              Retry Session Verification
            </button>
          </div>
        </div>
      </main>
    );
  }

  // 4. Authenticated Administrator Dashboard
  return (
    <main className="admin-page">
      <div className="admin-container">
        {/* Header Area */}
        <div className="admin-header-area">
          <div className="admin-title-group">
            <h1>Administration Console</h1>
            <p>
              Welcome back, <strong>{adminUser.name}</strong> ({adminUser.email})
            </p>
          </div>
          <span className="badge badge-success">
            Admin Verified
          </span>
        </div>

        {/* Admin Navigation Tabs */}
        <AdminNav />

        {/* Section Cards Grid */}
        <div className="admin-cards-grid">
          {/* User Management Card */}
          <div className="admin-nav-card">
            <div>
              <span className="admin-card-icon" role="img" aria-label="Users">
                👥
              </span>
              <h2 className="admin-card-title">User Accounts Management</h2>
              <p className="admin-card-desc">
                Review registered member accounts, inspect emails, check assigned roles, registration dates, and perform name or email lookups.
              </p>
            </div>
            <Link
              href="/admin/users"
              className="btn-primary"
              style={{ padding: '0.75rem 1.25rem', fontSize: '0.9rem', textAlign: 'center' }}
            >
              View User Directory →
            </Link>
          </div>

          {/* Matrimonial Profile Management Card */}
          <div className="admin-nav-card">
            <div>
              <span className="admin-card-icon" role="img" aria-label="Profiles">
                💍
              </span>
              <h2 className="admin-card-title">Matrimonial Profiles Directory</h2>
              <p className="admin-card-desc">
                Inspect member profiles, personal details, education, occupation, family backgrounds, partner preferences, and uploaded photographs.
              </p>
            </div>
            <Link
              href="/admin/profiles"
              className="btn-primary"
              style={{ padding: '0.75rem 1.25rem', fontSize: '0.9rem', textAlign: 'center' }}
            >
              View Profile Directory →
            </Link>
          </div>
        </div>

        {/* Administrator Session Summary Card */}
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.75rem',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <h3
            style={{
              fontSize: '1.1rem',
              fontWeight: 700,
              color: 'var(--text-main)',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span>🔐</span> Administrator Session Identity
          </h3>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '1.25rem',
              fontSize: '0.9rem',
            }}
          >
            <div>
              <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                Administrator Name
              </span>
              <strong>{adminUser.name}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                Email Address
              </span>
              <strong>{adminUser.email}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                Role Privilege
              </span>
              <span className="badge badge-success" style={{ display: 'inline-block' }}>
                {adminUser.role}
              </span>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                System Identifier
              </span>
              <code style={{ fontSize: '0.85rem', color: '#475569' }}>{adminUser.id}</code>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
