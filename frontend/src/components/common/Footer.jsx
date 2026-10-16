'use client';

import React from 'react';
import Link from 'next/link';
import {
  Sparkles,
  ShieldCheck,
  ScrollText,
  Award,
  ArrowRight,
  Lock,
  Heart,
  CheckCircle2,
} from 'lucide-react';

export const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer" aria-labelledby="footer-heading-brand">
      {/* Subtle Background Kolam Watermark */}
      <div className="footer-kolam-watermark" aria-hidden="true">
        <svg viewBox="0 0 240 240" fill="none">
          <g stroke="currentColor" strokeWidth="1.2">
            <circle cx="120" cy="120" r="24" />
            <circle cx="120" cy="120" r="43" />
            <circle cx="120" cy="120" r="63" />
            <path d="M120 22 C145 54 145 82 120 120 C95 82 95 54 120 22Z" />
            <path d="M120 218 C145 186 145 158 120 120 C95 158 95 186 120 218Z" />
            <path d="M22 120 C54 95 82 95 120 120 C82 145 54 145 22 120Z" />
            <path d="M218 120 C186 95 158 95 120 120 C158 145 186 145 218 120Z" />
            <path d="M49 49 C88 55 105 78 120 120 C78 105 55 88 49 49Z" />
            <path d="M191 49 C152 55 135 78 120 120 C162 105 185 88 191 49Z" />
            <path d="M49 191 C88 185 105 162 120 120 C78 135 55 152 49 191Z" />
            <path d="M191 191 C152 185 135 162 120 120 C162 135 185 152 191 191Z" />
            <circle cx="120" cy="22" r="4" />
            <circle cx="120" cy="218" r="4" />
            <circle cx="22" cy="120" r="4" />
            <circle cx="218" cy="120" r="4" />
          </g>
        </svg>
      </div>

      <div className="container footer-inner">
        {/* Top Catchy Trust Highlights Ribbon */}
        <div className="footer-trust-ribbon">
          <div className="footer-trust-card">
            <div className="footer-trust-icon">
              <ShieldCheck size={22} strokeWidth={1.8} aria-hidden="true" />
            </div>
            <div>
              <h4 className="footer-trust-title">Candidate Privacy Safeguard</h4>
              <p className="footer-trust-desc">
                Contact numbers remain shielded from public web scraping and are accessible only to verified members.
              </p>
            </div>
          </div>

          <div className="footer-trust-card">
            <div className="footer-trust-icon footer-trust-icon-gold">
              <ScrollText size={22} strokeWidth={1.8} aria-hidden="true" />
            </div>
            <div>
              <h4 className="footer-trust-title">Traditional South Indian Jathagam</h4>
              <p className="footer-trust-desc">
                Authentic 12-house South Indian Rasi charts recorded for consultation with your family astrologer.
              </p>
            </div>
          </div>

          <div className="footer-trust-card">
            <div className="footer-trust-icon">
              <Award size={22} strokeWidth={1.8} aria-hidden="true" />
            </div>
            <div>
              <h4 className="footer-trust-title">Cultural Reverence &amp; Trust</h4>
              <p className="footer-trust-desc">
                Dedicated to honoring sacred South Indian customs, direct alliances, and broker-assisted family profiles.
              </p>
            </div>
          </div>
        </div>

        {/* Main Footer Columns */}
        <div className="footer-top-grid">
          {/* Column 1: Brand & Heritage */}
          <div className="footer-brand-col">
            <Link href="/" className="brand-logo footer-brand-logo">
              <span className="brand-emblem" aria-hidden="true">
                <Sparkles size={18} />
              </span>
              <div className="brand-text-wrap">
                <span id="footer-heading-brand" className="brand-name footer-brand-name">
                  Matrimony Platform
                </span>
                <span className="brand-tagline footer-brand-tagline">South Indian Traditions</span>
              </div>
            </Link>

            <p className="footer-brand-desc">
              A dignified matrimonial sanctuary honoring South Indian cultural traditions, authentic astrological charts, and considered candidate privacy.
            </p>

            <div className="footer-community-tags">
              <span className="footer-tag">Tamil</span>
              <span className="footer-tag">Telugu</span>
              <span className="footer-tag">Kannada</span>
              <span className="footer-tag">Malayalam</span>
            </div>
          </div>

          {/* Column 2: Platform Navigation */}
          <div>
            <h3 className="footer-heading">Platform Navigation</h3>
            <ul className="footer-links">
              <li>
                <Link href="/">
                  <span className="footer-link-dot" aria-hidden="true">•</span> Home
                </Link>
              </li>
              <li>
                <Link href="/members">
                  <span className="footer-link-dot" aria-hidden="true">•</span> Browse Profiles
                </Link>
              </li>
              <li>
                <Link href="/#how-it-works">
                  <span className="footer-link-dot" aria-hidden="true">•</span> How It Works
                </Link>
              </li>
              <li>
                <Link href="/#jathagam">
                  <span className="footer-link-dot" aria-hidden="true">•</span> South Indian Jathagam
                </Link>
              </li>
              <li>
                <Link href="/#membership">
                  <span className="footer-link-dot" aria-hidden="true">•</span> Membership Plans
                </Link>
              </li>
              <li>
                <Link href="/admin">
                  <span className="footer-link-dot" aria-hidden="true">•</span> Admin Console
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Heritage & Privacy Standards */}
          <div>
            <h3 className="footer-heading">Heritage &amp; Privacy</h3>
            <ul className="footer-links">
              <li className="footer-feature-item">
                <CheckCircle2 size={15} className="footer-check-bullet" aria-hidden="true" />
                <span>Protected Contact Numbers</span>
              </li>
              <li className="footer-feature-item">
                <CheckCircle2 size={15} className="footer-check-bullet" aria-hidden="true" />
                <span>Traditional 12-House Rasi Format</span>
              </li>
              <li className="footer-feature-item">
                <CheckCircle2 size={15} className="footer-check-bullet" aria-hidden="true" />
                <span>Lagnam &amp; Planetary Details</span>
              </li>
              <li className="footer-feature-item">
                <CheckCircle2 size={15} className="footer-check-bullet" aria-hidden="true" />
                <span>Verified Directory Access</span>
              </li>
              <li className="footer-feature-item">
                <CheckCircle2 size={15} className="footer-check-bullet" aria-hidden="true" />
                <span>Zero Redundant Deductions</span>
              </li>
            </ul>
          </div>

          {/* Column 4: Catchy Quick Registration Card */}
          <div className="footer-cta-col">
            <div className="footer-cta-card">
              <div className="footer-cta-badge">
                <Sparkles size={12} aria-hidden="true" />
                <span>Begin Your Journey</span>
              </div>
              <h4 className="footer-cta-title">Find Meaningful Alliances</h4>
              <p className="footer-cta-text">
                Join verified South Indian families uniting through traditional heritage and shared values.
              </p>
              <div className="footer-cta-buttons">
                <Link href="/register" className="footer-btn-primary">
                  <span>Register Free Account</span>
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
                <Link href="/login" className="footer-btn-secondary">
                  Member Sign In
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Legal / Copyright Bar */}
        <div className="footer-bottom-bar">
          <div className="footer-copyright">
            &copy; {currentYear} <strong>Matrimony Platform</strong>. All rights reserved.
          </div>

          <div className="footer-mantra">
            <Heart size={13} className="footer-heart-icon" aria-hidden="true" />
            <span>சுபமங்கலம் • Mangalyam Tantunanena • Sacred Traditions</span>
          </div>

          <div className="footer-badges">
            <span className="footer-security-pill">
              <Lock size={11} aria-hidden="true" /> 256-Bit SSL
            </span>
            <span className="footer-security-pill">
              <ShieldCheck size={11} aria-hidden="true" /> Verified Profiles
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};
