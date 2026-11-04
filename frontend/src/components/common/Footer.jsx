'use client';

import React from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Clock,
  HeartHandshake,
  Lock,
  Mail,
  MapPin,
  PhoneCall,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

const exploreLinks = [
  { href: '/', label: 'Home' },
  { href: '/members', label: 'Browse Profiles' },
  { href: '/#how-it-works', label: 'How It Works' },
  { href: '/#membership', label: 'Membership Plans' },
  { href: '/#privacy', label: 'Candidate Privacy' },
  { href: '/about', label: 'About Us' },
];

const accountLinks = [
  { href: '/register', label: 'Register Free Profile' },
  { href: '/login', label: 'Member Sign In' },
  { href: '/profile', label: 'My Profile & Biodata' },
  { href: '/membership', label: 'Membership Plans' },
  { href: '/members', label: 'Search Matches' },
  { href: '/#contact', label: 'Help & Support' },
];

const trustHighlights = [
  {
    icon: ShieldCheck,
    title: '100% சரிபார்க்கப்பட்ட வரன்கள்',
    subtitle: 'Verified biodata & family background',
  },
  {
    icon: Lock,
    title: 'பாதுகாப்பான தொலைபேசி எண்கள்',
    subtitle: 'Strict privacy, numbers masked in all views',
  },
  {
    icon: Sparkles,
    title: 'பாரம்பரிய ஜாதக பொருத்தம்',
    subtitle: 'Rasi, Nakshatiram & dosham details',
  },
  {
    icon: PhoneCall,
    title: 'நேரடி அலுவலக வழிகாட்டுதல்',
    subtitle: 'Dedicated family support in Ranipet',
  },
];

const languages = ['தமிழ்', 'English', 'తెలుగు', 'ಕನ್ನಡ', 'മലയാളം'];

export const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="site-footer" aria-labelledby="footer-brand">
      {/* 1. Top Tier: 4-Card Trust & Highlights Bar */}
      <div className="site-footer-trust-bar">
        <div className="container">
          <div className="site-footer-trust-grid">
            {trustHighlights.map((item, idx) => {
              const IconComponent = item.icon;
              return (
                <div key={idx} className="site-footer-trust-card">
                  <div className="site-footer-trust-icon-wrap">
                    <IconComponent size={22} className="site-footer-trust-card-icon" />
                  </div>
                  <div className="site-footer-trust-card-text">
                    <h4 className="site-footer-trust-card-title">{item.title}</h4>
                    <p className="site-footer-trust-card-sub">{item.subtitle}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. Middle Tier: Balanced 4-Column Navigation */}
      <div className="container site-footer-main">
        {/* Col 1: Brand & Office Details */}
        <div className="site-footer-col site-footer-brand-col">
          <Link href="/" className="site-footer-brand" aria-label="Varaghi Matrimony Home">
            <img
              src="/logo.png"
              alt="Varaghi Matrimony Logo"
              className="site-footer-logo"
            />
            <div className="site-footer-brand-text">
              <span id="footer-brand" className="site-footer-brand-name">
                Varaghi Matrimony
              </span>
              <span className="site-footer-brand-tagline">
                ஸ்ரீ வாராஹி திருமண தகவல் மையம்
              </span>
            </div>
          </Link>

          <p className="site-footer-about">
            தென்னிந்திய குடும்பங்களின் நம்பிக்கையான திருமண தகவல் மையம். வரன் ஜாதகம், முழு பயோடேட்டா மற்றும் பாதுகாப்பான வரன் தேடல் தளம்.
          </p>

          <div className="site-footer-contact-list">
            <div className="site-footer-contact-item">
              <MapPin size={15} className="site-footer-contact-icon" aria-hidden="true" />
              <span>Ranipet, Tamil Nadu, India</span>
            </div>
            <div className="site-footer-contact-item">
              <Mail size={15} className="site-footer-contact-icon" aria-hidden="true" />
              <a href="mailto:varaghiimatrimony@gmail.com">varaghiimatrimony@gmail.com</a>
            </div>
            <div className="site-footer-contact-item">
              <Clock size={15} className="site-footer-contact-icon" aria-hidden="true" />
              <span>Office Hours: 9:00 AM – 7:00 PM</span>
            </div>
          </div>
        </div>

        {/* Col 2: Explore */}
        <nav className="site-footer-col" aria-label="Quick Links">
          <h3 className="site-footer-col-title">
            <span>Quick Links</span>
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

        {/* Col 3: Member Services */}
        <nav className="site-footer-col" aria-label="Member Services">
          <h3 className="site-footer-col-title">
            <span>Member Services</span>
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

        {/* Col 4: Action Card */}
        <div className="site-footer-col site-footer-cta-col">
          <div className="site-footer-cta-card">
            <div className="site-footer-cta-badge">
              <HeartHandshake size={14} />
              <span>திருமண வரம் பெற</span>
            </div>
            <h3 className="site-footer-cta-title">Find Your Life Partner</h3>
            <p className="site-footer-cta-desc">
              பதிவு முற்றிலும் இலவசம். ஆயிரக்கணக்கான வரன்களைப் பார்வையிட்டு உங்கள் விருப்பத்திற்கேற்ப இணைந்திடுங்கள்.
            </p>
            <Link href="/register" className="site-footer-btn">
              <span>Register Free Today</span>
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

      {/* 3. Sacred Blessing & Supported Languages Banner */}
      <div className="site-footer-blessing-section">
        <div className="container site-footer-blessing-inner">
          <div className="site-footer-blessing-quote">
            <Sparkles size={16} className="site-footer-blessing-sparkle" aria-hidden="true" />
            <span>&ldquo;மங்கல வாழ்க்கை மலர ஸ்ரீ வாராஹி அம்மன் அருள் துணை நிற்கட்டும்&rdquo;</span>
            <Sparkles size={16} className="site-footer-blessing-sparkle" aria-hidden="true" />
          </div>

          <div className="site-footer-langs-wrap" aria-label="Languages supported">
            <span className="site-footer-langs-label">Supported Languages:</span>
            <div className="site-footer-langs">
              {languages.map((lang) => (
                <span key={lang} className="site-footer-lang-pill">
                  {lang}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Bottom Legal & Privacy Bar */}
      <div className="site-footer-bottom">
        <div className="container site-footer-bottom-inner">
          <div className="site-footer-copy">
            &copy; {currentYear} <strong>Varaghi Matrimony</strong> (ஸ்ரீ வாராஹி திருமண தகவல் மையம்). All rights reserved.
          </div>
          <div className="site-footer-trust-badge">
            <ShieldCheck size={15} className="site-footer-trust-icon" aria-hidden="true" />
            <span>100% பாதுகாப்பான தளம் • வரன் தொலைபேசி எண்கள் எப்போதும் ரகசியமாக வைக்கப்படும்</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
