'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, Heart, Lock } from 'lucide-react';

const exploreLinks = [
  { href: '/', label: 'Home' },
  { href: '/members', label: 'Browse Profiles' },
  { href: '/#how-it-works', label: 'How It Works' },
  { href: '/#membership', label: 'Membership Plans' },
  { href: '/#privacy', label: 'Candidate Privacy' },
];

const accountLinks = [
  { href: '/register', label: 'Create Profile' },
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
        <div>
          <Link href="/" className="brand-logo site-footer-brand" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none' }}>
            <img
              src="/logo.png"
              alt="Varaghi Matrimony"
              style={{ width: '44px', height: '44px', objectFit: 'contain' }}
            />
            <span className="brand-text-wrap">
              <span id="footer-brand" className="brand-name" style={{ fontSize: '1.25rem', fontWeight: 800 }}>Varaghi Matrimony</span>
              <span className="brand-tagline" style={{ color: '#f0c354', fontSize: '0.74rem' }}>ஸ்ரீ வாராஹி திருமண தகவல் மையம்</span>
            </span>
          </Link>
          <p className="site-footer-about">
            தென்னிந்திய குடும்பங்களின் நம்பிக்கையான திருமண தகவல் மையம். வரன் ஜாதகம், முழு பயோடேட்டா மற்றும் பாதுகாப்பான வரன் தேடல் தளம்.
          </p>
          <p style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#f7d794', opacity: 0.9 }}>
            📍 Ranipet, Tamil Nadu &bull; ✉️ varaghiimatrimony@gmail.com
          </p>
          <p style={{ marginTop: '0.65rem', fontSize: '0.85rem', color: '#f0c354', fontStyle: 'italic', fontFamily: 'var(--font-serif)', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <img
              src="/images/varaghi/motifs/varaghi-bottom-emblem.png"
              alt=""
              aria-hidden="true"
              style={{ width: '22px', height: '18px', objectFit: 'contain' }}
            />
            <span>&ldquo;மங்கல வாழ்க்கை மலர ஸ்ரீ வாராஹி அம்மன் அருள் துணை நிற்கட்டும்&rdquo;</span>
          </p>
          <p style={{ marginTop: '0.5rem', fontSize: '0.74rem', color: 'rgba(255,248,233,0.7)', lineHeight: 1.5 }}>
            மணமக்கள் பற்றிய தகவல்களை நீங்களே நன்கு விசாரித்து முடிவுக்கு வரவும். எமது நிறுவனத்தின் சேவை தகவல் தருவதற்காக மட்டுமே.
          </p>
          <div className="site-footer-langs" aria-label="Languages served">
            <span>தமிழ்</span>
            <span>English</span>
            <span>தெலுங்கு</span>
            <span>கன்னடம்</span>
          </div>
        </div>

        <nav aria-label="Explore">
          <h3>Explore</h3>
          <ul className="site-footer-links">
            {exploreLinks.map((l) => (
              <li key={l.href}><Link href={l.href}>{l.label}</Link></li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Account">
          <h3>Account</h3>
          <ul className="site-footer-links">
            {accountLinks.map((l) => (
              <li key={l.href}><Link href={l.href}>{l.label}</Link></li>
            ))}
          </ul>
        </nav>

        <div className="site-footer-cta">
          <h3>Get started</h3>
          <p>Registration is free. Browse with a membership and unlock contacts with monthly credits.</p>
          <Link href="/register" className="site-footer-btn">
            Register free <ArrowRight size={15} aria-hidden="true" />
          </Link>
          <br />
          <Link href="/login" className="site-footer-signin">Already a member? Sign in</Link>
        </div>
      </div>

      <div className="site-footer-bottom">
        <div className="container">
          <span>&copy; {currentYear} <strong>Varaghi Matrimony</strong> (ஸ்ரீ வாராஹி திருமண தகவல் மையம்). All rights reserved.</span>
          <span><Lock size={13} aria-hidden="true" /> வரன் தொலைபேசி எண்கள் எப்போதும் ரகசியமாக வைக்கப்படும்</span>
        </div>
      </div>
    </footer>
  );
};
