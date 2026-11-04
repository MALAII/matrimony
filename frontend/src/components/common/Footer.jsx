'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, Mail, MapPin, ShieldCheck, Sparkles } from 'lucide-react';

const exploreLinks = [
  { href: '/', label: 'Home' },
  { href: '/members', label: 'Browse Profiles' },
  { href: '/#how-it-works', label: 'How It Works' },
  { href: '/#membership', label: 'Membership Plans' },
  { href: '/#privacy', label: 'Candidate Privacy' },
];

const accountLinks = [
  { href: '/register', label: 'Create Free Profile' },
  { href: '/login', label: 'Member Sign In' },
  { href: '/membership', label: 'My Membership' },
  { href: '/profile', label: 'My Profile' },
  { href: '/forgot-password', label: 'Forgot Password' },
];

export const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="site-footer" aria-labelledby="footer-brand">
      <div className="container site-footer-main">
        {/* Brand & Mission Column */}
        <div className="site-footer-brand-col">
          <Link href="/" className="site-footer-brand" aria-label="Varaghi Matrimony Home">
            <img
              src="/logo.png"
              alt="Varaghi Matrimony Logo"
              className="site-footer-logo"
            />
            <div className="site-footer-brand-text">
              <span id="footer-brand" className="site-footer-brand-name">Varaghi Matrimony</span>
              <span className="site-footer-brand-tagline">ஸ்ரீ வாராஹி திருமண தகவல் மையம்</span>
            </div>
          </Link>

          <p className="site-footer-about">
            தென்னிந்திய குடும்பங்களின் நம்பிக்கையான திருமண தகவல் மையம். பாரம்பரிய வரன் ஜாதகம், முழு பயோடேட்டா மற்றும் பாதுகாப்பான திருமண உறவுகளுக்கான உன்னத தளம்.
          </p>

          <div className="site-footer-contact-list">
            <div className="site-footer-contact-item">
              <MapPin size={14} className="site-footer-contact-icon" aria-hidden="true" />
              <span>Ranipet, Tamil Nadu</span>
            </div>
            <div className="site-footer-contact-item">
              <Mail size={14} className="site-footer-contact-icon" aria-hidden="true" />
              <a href="mailto:varaghiimatrimony@gmail.com">varaghiimatrimony@gmail.com</a>
            </div>
          </div>

          <div className="site-footer-blessing">
            <Sparkles size={14} className="site-footer-blessing-icon" aria-hidden="true" />
            <span>&ldquo;மங்கல வாழ்க்கை மலர ஸ்ரீ வாராஹி அம்மன் அருள் துணை நிற்கட்டும்&rdquo;</span>
          </div>

          <div className="site-footer-langs" aria-label="Languages supported">
            <span className="site-footer-lang-pill">தமிழ்</span>
            <span className="site-footer-lang-pill">English</span>
            <span className="site-footer-lang-pill">తెలుగు</span>
            <span className="site-footer-lang-pill">ಕನ್ನಡ</span>
          </div>
        </div>

        {/* Explore Links */}
        <nav className="site-footer-col" aria-label="Explore Links">
          <h3 className="site-footer-col-title">
            <span>Explore</span>
            <span className="site-footer-title-bar" aria-hidden="true" />
          </h3>
          <ul className="site-footer-links">
            {exploreLinks.map((l) => (
              <li key={l.href}>
                <Link href={l.href}>{l.label}</Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Account Links */}
        <nav className="site-footer-col" aria-label="Account Links">
          <h3 className="site-footer-col-title">
            <span>Account</span>
            <span className="site-footer-title-bar" aria-hidden="true" />
          </h3>
          <ul className="site-footer-links">
            {accountLinks.map((l) => (
              <li key={l.href}>
                <Link href={l.href}>{l.label}</Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* CTA Card */}
        <div className="site-footer-cta-col">
          <div className="site-footer-cta-card">
            <h3 className="site-footer-col-title">
              <span>Get Started</span>
              <span className="site-footer-title-bar" aria-hidden="true" />
            </h3>
            <p className="site-footer-cta-desc">
              பதிவு முற்றிலும் இலவசம். தகுதியான வரன்களைப் பார்வையிட்டு, பிரத்யேக கிரெடிட்கள் மூலம் பாதுகாப்பாகத் தொடர்புகளைப் பெறுங்கள்.
            </p>
            <Link href="/register" className="site-footer-btn">
              <span>Register Free</span>
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
            <div className="site-footer-signin-wrap">
              <Link href="/login" className="site-footer-signin">
                Already a member? Sign In &rarr;
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Legal & Trust Bar */}
      <div className="site-footer-bottom">
        <div className="container site-footer-bottom-inner">
          <div className="site-footer-copy">
            &copy; {currentYear} <strong>Varaghi Matrimony</strong> (ஸ்ரீ வாராஹி திருமண தகவல் மையம்). All rights reserved.
          </div>
          <div className="site-footer-trust-badge">
            <ShieldCheck size={14} className="site-footer-trust-icon" aria-hidden="true" />
            <span>100% பாதுகாப்பான வரன் விவரங்கள் • தொலைபேசி எண்கள் எப்போதும் ரகசியமாக வைக்கப்படும்</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
