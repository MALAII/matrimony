'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Sparkles, ArrowLeft, CheckCircle2, AlertCircle, Mail, ArrowRight } from 'lucide-react';
import { forgotPasswordApi } from '@/lib/api';
import styles from '../auth.module.css';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [serverMessage, setServerMessage] = useState('');

  const validate = () => {
    if (!email.trim()) {
      setError('Email address is required');
      return false;
    }
    if (!EMAIL_REGEX.test(email.trim())) {
      setError('Please enter a valid email address');
      return false;
    }
    setError('');
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!validate()) return;

    setIsSubmitting(true);
    setError('');

    try {
      const res = await forgotPasswordApi(email.trim());
      setIsSubmitted(true);
      setServerMessage(
        res.message ||
          'If an account exists with this email address, you will receive a password reset link shortly.'
      );
    } catch (err) {
      setError('Unable to connect to the server. Please check your network connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.bgGlowTop} aria-hidden="true" />
      <div className={styles.bgGlowBottom} aria-hidden="true" />

      <div className={styles.authContainerNarrow}>
        <header className={styles.formHeader}>
          <span className={styles.kicker}>Account Recovery</span>
          <h1 className={styles.formTitle}>Forgot Password</h1>
          <p className={styles.formSubtitle}>
            {isSubmitted
              ? 'Check your inbox for password reset instructions.'
              : 'Enter the email address registered with your account, and we will send you a secure password reset link.'}
          </p>
        </header>

        {isSubmitted ? (
          <div className={styles.successCard}>
            <div className={styles.successIconCircle} aria-hidden="true">
              <CheckCircle2 size={32} />
            </div>

            <h2>Reset Link Dispatched</h2>
            <p>{serverMessage}</p>

            <div className={styles.userInfoBox}>
              <strong style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--plum)' }}>Next steps:</strong>
              <div style={{ fontSize: '0.85rem', color: 'var(--muted)', lineHeight: 1.5 }}>
                • Check your spam or promotions folder if the email does not arrive in a few minutes.<br />
                • The reset link is single-use and will expire in 1 hour.
              </div>
            </div>

            <Link href="/login" className={styles.btnPrimary}>
              Return to Sign In <ArrowRight size={16} />
            </Link>
          </div>
        ) : (
          <div>
            {error && (
              <div className={`${styles.alert} ${styles.alertDanger}`} role="alert">
                <AlertCircle size={18} color="#dc2626" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className={styles.authForm} noValidate>
              <div className={styles.formGroup}>
                <label htmlFor="email" className={styles.label}>
                  Email Address <span className={styles.reqMark}>*</span>
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError('');
                  }}
                  className={`${styles.input} ${error ? styles.inputError : ''}`}
                  disabled={isSubmitting}
                  autoComplete="email"
                  autoFocus
                />
                {error && <span className={styles.errorText}>{error}</span>}
              </div>

              <button
                type="submit"
                className={styles.btnPrimary}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Sending Reset Link...' : 'Send Reset Link'} <ArrowRight size={16} />
              </button>
            </form>

            <div className={styles.footerLinks}>
              Remember your password?{' '}
              <Link href="/login">
                Sign in here
              </Link>
            </div>

            <div className={styles.returnHome}>
              <Link href="/login" className={styles.returnHomeLink}>
                <ArrowLeft size={14} /> Back to Sign In
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
