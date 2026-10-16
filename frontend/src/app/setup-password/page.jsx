'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { verifySetupTokenApi, setupPasswordApi } from '@/lib/api';

function SetupPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  // State
  const [tokenStatus, setTokenStatus] = useState('verifying'); // 'verifying' | 'valid' | 'invalid'
  const [tokenError, setTokenError] = useState('');
  const [candidateInfo, setCandidateInfo] = useState({ name: '', email: '' });

  // Form State
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  // 1. Verify token on mount (read-only verification without consuming token)
  useEffect(() => {
    let isMounted = true;

    async function checkToken() {
      if (!token || !token.trim()) {
        if (isMounted) {
          setTokenStatus('invalid');
          setTokenError('Invitation token is missing from the URL. Please verify your invitation link.');
        }
        return;
      }

      try {
        const res = await verifySetupTokenApi(token.trim());
        if (!isMounted) return;

        if (res.success && res.data) {
          setTokenStatus('valid');
          setCandidateInfo(res.data);
        } else {
          setTokenStatus('invalid');
          setTokenError(res.message || 'This invitation link is invalid, expired, or has already been used.');
        }
      } catch (err) {
        if (isMounted) {
          setTokenStatus('invalid');
          setTokenError('Unable to connect to the server to verify your invitation link.');
        }
      }
    }

    checkToken();

    return () => {
      isMounted = false;
    };
  }, [token]);

  // Form Validation
  const validateForm = () => {
    const errors = {};

    if (!password) {
      errors.password = 'Password is required.';
    } else if (password.length < 12) {
      errors.password = 'Password must be at least 12 characters long for security.';
    }

    if (!confirmPassword) {
      errors.confirmPassword = 'Please confirm your password.';
    } else if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submit Password Setup
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    setSubmitError('');

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await setupPasswordApi({
        token: token.trim(),
        password,
      });

      if (res.success) {
        setIsSuccess(true);
      } else {
        setSubmitError(res.message || 'Failed to configure your password. Please try again.');
      }
    } catch (err) {
      setSubmitError('A network error occurred while submitting your password. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1. Token Verification Loading State
  if (tokenStatus === 'verifying') {
    return (
      <div className="auth-card" style={{ textAlign: 'center' }}>
        <div className="status-spinner" style={{ margin: '0 auto 1.5rem auto' }}></div>
        <h2 className="auth-title" style={{ fontSize: '1.25rem' }}>Verifying Invitation Link...</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
          Validating your single-use security token.
        </p>
      </div>
    );
  }

  // 2. Token Invalid or Expired State
  if (tokenStatus === 'invalid') {
    return (
      <div className="auth-card" style={{ textAlign: 'center' }}>
        <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>⚠️</span>
        <h1 className="auth-title" style={{ color: 'var(--danger)', fontSize: '1.4rem' }}>
          Invitation Link Expired or Invalid
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', margin: '1rem 0 2rem', lineHeight: 1.6 }}>
          {tokenError}
        </p>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '2rem' }}>
          If your invitation has expired, please contact the marriage bureau administrator to request a new invitation link.
        </p>
        <Link href="/login" className="btn-primary" style={{ display: 'inline-block', padding: '0.75rem 1.75rem' }}>
          Go to Sign In
        </Link>
      </div>
    );
  }

  // 3. Success State
  if (isSuccess) {
    return (
      <div className="auth-card" style={{ textAlign: 'center' }}>
        <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>🎉</span>
        <h1 className="auth-title" style={{ color: '#166534', fontSize: '1.4rem' }}>
          Password Configured Successfully!
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', margin: '1rem 0 2rem', lineHeight: 1.6 }}>
          Your matrimonial candidate account has been activated. You can now log in using your email address (<strong>{candidateInfo.email}</strong>) and your chosen password.
        </p>
        <Link href="/login" className="btn-primary" style={{ display: 'inline-block', padding: '0.75rem 2rem' }}>
          Sign In to Your Dashboard →
        </Link>
      </div>
    );
  }

  // 4. Password Setup Form State
  return (
    <div className="auth-card">
      <div className="auth-header">
        <span className="auth-header-icon" role="img" aria-label="Key">
          🔐
        </span>
        <h1 className="auth-title">Activate Candidate Account</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
          Welcome, <strong>{candidateInfo.name || 'Candidate'}</strong> ({candidateInfo.email}). Please choose a secure password to activate your account.
        </p>
      </div>

      {submitError && (
        <div
          style={{
            padding: '0.85rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            backgroundColor: '#fef2f2',
            color: 'var(--danger)',
            border: '1px solid #fecaca',
            marginBottom: '1.5rem',
            fontSize: '0.9rem',
          }}
        >
          ⚠️ {submitError}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="form-group" style={{ marginBottom: '1.25rem' }}>
          <label htmlFor="newPasswordInput" className="form-label">
            New Password <span style={{ color: 'var(--danger)' }}>*</span>
          </label>
          <input
            id="newPasswordInput"
            type="password"
            autoComplete="new-password"
            required
            placeholder="At least 12 characters"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (formErrors.password) setFormErrors((prev) => ({ ...prev, password: '' }));
            }}
            className="form-input"
          />
          {formErrors.password && <span className="form-error">{formErrors.password}</span>}
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.35rem' }}>
            Must be at least 12 characters long.
          </span>
        </div>

        <div className="form-group" style={{ marginBottom: '1.75rem' }}>
          <label htmlFor="confirmPasswordInput" className="form-label">
            Confirm Password <span style={{ color: 'var(--danger)' }}>*</span>
          </label>
          <input
            id="confirmPasswordInput"
            type="password"
            autoComplete="new-password"
            required
            placeholder="Re-enter your new password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              if (formErrors.confirmPassword) setFormErrors((prev) => ({ ...prev, confirmPassword: '' }));
            }}
            className="form-input"
          />
          {formErrors.confirmPassword && <span className="form-error">{formErrors.confirmPassword}</span>}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="btn-primary"
          style={{ width: '100%', padding: '0.85rem', fontSize: '1rem', fontWeight: 600 }}
        >
          {isSubmitting ? 'Activating Account...' : 'Set Password & Activate Account'}
        </button>
      </form>
    </div>
  );
}

export default function SetupPasswordPage() {
  return (
    <main className="auth-page">
      <Suspense
        fallback={
          <div className="auth-card" style={{ textAlign: 'center' }}>
            <div className="status-spinner" style={{ margin: '0 auto 1.5rem auto' }}></div>
            <p style={{ color: 'var(--text-muted)' }}>Loading invitation verification...</p>
          </div>
        }
      >
        <SetupPasswordContent />
      </Suspense>
    </main>
  );
}
