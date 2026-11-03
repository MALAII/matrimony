"use client";

import React, { useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  BookUser,
  CalendarClock,
  Crown,
  Eye,
  Gem,
  Languages,
  Mail,
  Search,
  UserRoundPlus,
  Check,
  HeartHandshake,
  KeyRound,
  Lock,
  Phone,
  PhoneCall,
  ScrollText,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";
import styles from "./home-landing-design.module.css";

const languages = ["தமிழ்", "తెలుగు", "ಕನ್ನಡ", "മലയാളം"];

const bottomFeatures = [
  {
    Icon: ShieldCheck,
    title: "Verified Profiles",
    tamilTitle: "100% சரிபார்க்கப்பட்ட வரன்கள்",
    text: "Curated matrimonial profiles verified with genuine family details and biodata.",
  },
  {
    Icon: Lock,
    title: "Privacy First",
    tamilTitle: "பாதுகாப்பான தொலைபேசி எண்கள்",
    text: "Contact numbers remain masked in every view and revealed only with your consent.",
  },
  {
    Icon: HeartHandshake,
    title: "Traditional Values",
    tamilTitle: "பாரம்பரிய கலாச்சார முறை",
    text: "Rooted in Tamil, Telugu, Kannada and Malayalam cultural customs and horoscope respect.",
  },
  {
    Icon: PhoneCall,
    title: "Dedicated Support",
    tamilTitle: "நேரடி அலுவலக வழிகாட்டுதல்",
    text: "Attentive administrative assistance to guide families through matches smoothly.",
  },
];

const facts = [
  { Icon: Languages, value: "4", label: "South Indian languages" },
  { Icon: KeyRound, value: "50", label: "Contact credits per month" },
  { Icon: Eye, value: "0", label: "Cost to re-view a contact" },
  { Icon: CalendarClock, value: "7 days", label: "Grace period after expiry" },
];

const features = [
  { Icon: Lock, title: "Private contact numbers", text: "Phone numbers are masked in every view and revealed only to active members." },
  { Icon: BookUser, title: "Detailed biodata", text: "Education, career, family background and partner preferences in one profile." },
  { Icon: UsersRound, title: "Verified candidate profiles", text: "Curated matrimonial profiles verified with genuine biodata and family details." },
  { Icon: Sparkles, title: "Horoscope support", text: "Generate a traditional horoscope and keep it with the candidate's biodata." },
  { Icon: ScrollText, title: "Family-first filters", text: "Search the way families do, by community, language and values." },
  { Icon: HeartHandshake, title: "Rooted in tradition", text: "Built for Tamil, Telugu, Kannada and Malayalam customs and respect." },
];

const faqs = [
  { q: "Is registration free?", a: "Yes. A membership is only needed to browse all profiles and unlock contacts." },
  { q: "How do contact credits work?", a: "You get 50 credits each monthly cycle. The first unlock costs 1 credit; viewing it again is free." },
  { q: "Do unused credits carry over?", a: "No. Credits belong to their monthly cycle and do not roll over." },
  { q: "What happens when a plan ends?", a: "You get a 7-day browsing grace period, and unlocked contacts stay free to view." },
];

const steps = [
  { n: "01", Icon: UserRoundPlus, title: "Create a profile", text: "Register free and share your biodata and family details." },
  { n: "02", Icon: CalendarClock, title: "Choose a plan", text: "Three or six months of full profile browsing access." },
  { n: "03", Icon: Search, title: "Browse privately", text: "Every phone number stays hidden while you explore." },
  { n: "04", Icon: KeyRound, title: "Unlock & connect", text: "One credit reveals a contact. Re-viewing is always free." },
];

const plans = [
  {
    name: "Gold",
    term: "3 Months",
    blurb: "A focused quarter of searching.",
    Icon: Gem,
    total: "150",
    points: [
      "Full candidate profile access",
      "50 contact credits every month",
      "1 credit on first view, 0 on repeat views",
      "Unused monthly credits do not carry forward",
      "7-day browsing grace period",
    ],
  },
  {
    name: "Platinum",
    term: "6 Months",
    blurb: "Unhurried, continuous search.",
    Icon: Crown,
    total: "300",
    featured: true,
    points: [
      "Full candidate profile access",
      "50 contact credits every month",
      "1 credit on first view, 0 on repeat views",
      "Unused monthly credits do not carry forward",
      "7-day browsing grace period",
      "Best value for a longer search",
    ],
  },
];

/** Reveals `.reveal` elements as they scroll into view. */
function useReveal(ref) {
  useEffect(() => {
    const root = ref.current;
    if (!root) return undefined;
    const els = root.querySelectorAll(".reveal");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add(styles.in));
      return undefined;
    }
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add(styles.in);
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.15 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [ref]);
}

function Heading({ id, kicker, children }) {
  return (
    <header className={`${styles.heading} reveal`}>
      <div className={styles.headingMotif} aria-hidden="true">
        <img
          src="/images/varaghi/motifs/varaghi-bottom-emblem.png"
          alt=""
          className={styles.headingEmblem}
        />
      </div>
      <span className={styles.kicker}>{kicker}</span>
      <h2 id={id}>{children}</h2>
    </header>
  );
}

export default function HomeLandingDesign({
  heroImage = "/images/varaghi/south-indian-wedding-couple.jpg",
}) {
  const ref = useRef(null);
  useReveal(ref);

  return (
    <div className={styles.page} ref={ref}>
      {/* ------------------------------ HERO ------------------------------ */}
      <div className={styles.heroWrap}>
        {/* Decorative Background Assets */}
        <img
          src="/images/varaghi/floral-left.png"
          alt=""
          className={styles.floralLeft}
          aria-hidden="true"
        />
        <img
          src="/images/varaghi/mandala-watermark.png"
          alt=""
          className={styles.mandalaWatermark}
          aria-hidden="true"
        />
        <img
          src="/images/varaghi/gold-corner.png"
          alt=""
          className={styles.goldCornerTopRight}
          aria-hidden="true"
        />
        <img
          src="/images/varaghi/gold-corner.png"
          alt=""
          className={styles.goldCornerTopLeft}
          aria-hidden="true"
        />

        <section className={styles.hero} aria-labelledby="home-title">
          <div className={styles.heroText}>
            <span className={styles.heroTrustBadge}>
              <ShieldCheck size={14} aria-hidden="true" />
              தமிழர்களின் நீண்ட நாள் தேடலுக்கு ஓர் நிரந்தர தீர்வு &bull; TRUSTED MATRIMONY
            </span>
            <h1 id="home-title">
              A Trusted Matrimony for <em>Meaningful Relationships</em>
            </h1>
            <img
              src="/images/varaghi/gold-divider.svg"
              alt=""
              className={styles.goldDivider}
              aria-hidden="true"
            />
            <p>
              Rooted in South Indian cultural values and sacred traditions. Connecting compatible brides
              and grooms with authentic biodata, verified family backgrounds, and complete contact privacy.
            </p>
            <div className={styles.actions}>
              <Link href="/register" className={styles.btnPrimary}>
                Create Free Profile <ArrowRight size={17} aria-hidden="true" />
              </Link>
              <Link href="/members" className={styles.btnOutline}>
                Browse Profiles
              </Link>
            </div>
            <div className={styles.served}>
              <span>Serving families in</span>
              <ul className={styles.langs} aria-label="Languages served">
                {languages.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className={styles.heroArt}>
            <div className={styles.arch}>
              <Image
                src={heroImage}
                alt="Traditional South Indian wedding bride and groom"
                fill
                priority
                sizes="(max-width: 900px) 80vw, 420px"
                className={styles.archImg}
              />
            </div>
            <svg className={styles.ring} viewBox="0 0 200 200" aria-hidden="true">
              <defs>
                <path id="ringPath" d="M100,100 m-78,0 a78,78 0 1,1 156,0 a78,78 0 1,1 -156,0" />
              </defs>
              <text>
                <textPath href="#ringPath" textLength="480" lengthAdjust="spacing">VARAGHI MATRIMONY • TRUST • TRADITION • PRIVACY •</textPath>
              </text>
              <circle cx="100" cy="100" r="4" />
            </svg>
          </div>
        </section>
      </div>

      {/* ----------------------- BOTTOM FEATURE STRIP ----------------------- */}
      <section className={styles.featureStrip} aria-label="Key Platform Guarantees">
        <div className={styles.featureStripEmblem} aria-hidden="true">
          <img
            src="/images/varaghi/motifs/varaghi-bottom-emblem.png"
            alt=""
            className={styles.featureEmblemImg}
          />
        </div>
        <div className={styles.featureGrid}>
          {bottomFeatures.map(({ Icon, title, tamilTitle, text }) => (
            <div key={title} className={styles.featureItem}>
              <div className={styles.featureIconWrap}>
                <Icon size={24} aria-hidden="true" />
              </div>
              <div className={styles.featureText}>
                <h3>{title}</h3>
                {tamilTitle && <span className={styles.featureTamilSub}>{tamilTitle}</span>}
                <p>{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ----------------------- COMMUNITY RIBBON ----------------------- */}
      <div className={styles.communityRibbon} aria-label="Communities Served">
        <div className="container">
          <p className={styles.communityRibbonText}>
            <strong>அனைத்து சமூக வரன்களும் ஒரே தளத்தில்:</strong> வன்னியர் &bull; முதலியார் &bull; நாடார் &bull; நாயுடு &bull; பிள்ளை &bull; பிராமணர் &bull; யாதவர் &bull; செட்டியார் &bull; விஸ்வகர்மா &bull; மற்றும் அனைத்து தென்னிந்திய சமூகங்களும்
          </p>
        </div>
      </div>

      {/* ------------------------------ FACTS ------------------------------ */}
      <section className={styles.facts} aria-label="At a glance">
        <div className={styles.factsInner}>
          {facts.map((f) => (
            <div key={f.label} className="reveal">
              <span className={styles.factIcon}><f.Icon size={22} strokeWidth={1.6} aria-hidden="true" /></span>
              <p>
                <strong>{f.value}</strong>
                <span>{f.label}</span>
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ----------------------------- FEATURES ----------------------------- */}
      <section className={styles.section} aria-labelledby="why-title">
        <div className={styles.why}>
          <aside className={`${styles.whyIntro} reveal`}>
            <span className={styles.whyKicker}>Why choose us</span>
            <h2 id="why-title">Built around what matters to your family</h2>
            <p>
              Matchmaking works best when families feel safe. Every detail of the platform is
              designed to protect privacy while giving you the full picture of a candidate.
            </p>
            <Link href="/register" className={styles.btnGold}>
              Create free profile <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </aside>

          <div className={styles.whyGrid}>
            {features.map(({ Icon, title, text }, i) => (
              <article key={title} className="reveal" style={{ transitionDelay: `${i * 60}ms` }}>
                <div className={styles.whyTop}>
                  <span className={styles.featIcon}><Icon size={22} strokeWidth={1.7} aria-hidden="true" /></span>
                  <span className={styles.whyNum}>0{i + 1}</span>
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* --------------------------- HOW IT WORKS --------------------------- */}
      <section id="how-it-works" className={`${styles.section} ${styles.lotusDecoWrap}`} aria-labelledby="how-title">
        <img
          src="/images/varaghi/motifs/lotus-ornament.svg"
          alt=""
          className={styles.lotusDecoLeft}
          aria-hidden="true"
        />
        <img
          src="/images/varaghi/motifs/lotus-ornament.svg"
          alt=""
          className={styles.lotusDecoRight}
          aria-hidden="true"
        />
        <Heading id="how-title" kicker="How it works">
          Find your match in 4 easy steps
        </Heading>
        <ol className={styles.steps}>
          {steps.map((s, i) => (
            <li
              key={s.n}
              className="reveal"
              style={{ transitionDelay: `${i * 80}ms` }}
            >
              <span className={styles.stepIcon}>
                <s.Icon size={28} strokeWidth={1.6} aria-hidden="true" />
                <b>{s.n}</b>
              </span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ----------------------------- PRIVACY ----------------------------- */}
      <section id="privacy" className={styles.privacy} aria-labelledby="privacy-title">
        <div className={styles.privacyInner}>
          <div className="reveal">
            <span className={styles.kicker}>Privacy by design</span>
            <h2 id="privacy-title">
              Your privacy is our priority
            </h2>
            <p>
              Contact details never appear in public views. Only active members can reveal
              a number, and only by using a monthly credit.
            </p>
            <ul className={styles.points}>
              <li><span><ShieldCheck size={16} aria-hidden="true" /></span> Masked in every candidate view</li>
              <li><span><KeyRound size={16} aria-hidden="true" /></span> Unlocked with monthly credits</li>
              <li><span><Check size={16} aria-hidden="true" /></span> Re-viewing costs nothing, ever</li>
            </ul>
          </div>

          <div className={`${styles.lockCard} reveal`} aria-hidden="true">
            <span className={styles.lockLabel}>Contact</span>
            <div className={styles.lockNumber}>
              <Phone size={18} />
              <span>+91 98••• ••210</span>
              <Lock size={16} />
            </div>
            <div className={styles.lockBtn}>
              <KeyRound size={16} /> Unlock · 1 credit
            </div>
          </div>
        </div>
      </section>

      {/* ----------------------------- MEMBERSHIP ----------------------------- */}
      <section id="membership" className={styles.section} aria-labelledby="plans-title">
        <Heading id="plans-title" kicker="Membership">
          Choose how long you search
        </Heading>
        <div className={styles.plans}>
          {plans.map((p, i) => (
            <article
              key={p.name}
              className={`${styles.plan} ${p.featured ? styles.planFeatured : ""} reveal`}
              style={{ transitionDelay: `${i * 90}ms` }}
            >
              {p.featured && <span className={styles.tag}>Most popular</span>}
              <header className={styles.planHead}>
                <span className={styles.planIcon}><p.Icon size={24} strokeWidth={1.6} aria-hidden="true" /></span>
                <div>
                  <h3>{p.name}</h3>
                  <p>{p.blurb}</p>
                </div>
              </header>

              <div className={styles.planBody}>
                <div className={styles.planTerm}>
                  <strong>{p.term}</strong>
                  <span>membership</span>
                </div>
                <div className={styles.planCredits}>
                  <strong>{p.total}</strong>
                  <span>contact credits<br />in total</span>
                </div>
              </div>

              <ul>
                {p.points.map((pt) => (
                  <li key={pt}>
                    <span><Check size={13} strokeWidth={3} aria-hidden="true" /></span> {pt}
                  </li>
                ))}
              </ul>

              <div className={styles.planFoot}>
                <p className={styles.price}>Pricing announced soon</p>
                <Link href="/register" className={p.featured ? styles.btnGold : styles.btnPrimary}>
                  Get started <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </div>
            </article>
          ))}
        </div>
        <p className={styles.note}>Registration is free. Online payments open once pricing is finalised.</p>
      </section>

      {/* ------------------------------- FAQ ------------------------------- */}
      <section className={styles.faqSectionWrap} aria-labelledby="faq-title">
        <img
          src="/images/varaghi/motifs/lotus-ornament.svg"
          alt=""
          className={styles.faqLotusLeft}
          aria-hidden="true"
        />
        <img
          src="/images/varaghi/motifs/lotus-ornament.svg"
          alt=""
          className={styles.faqLotusRight}
          aria-hidden="true"
        />
        <div className={`${styles.section} ${styles.faqSection}`}>
          <div className={styles.faqWrap}>
            <aside className={`${styles.faqIntro} reveal`}>
              <span className={styles.kicker}>FAQ</span>
              <h2 id="faq-title">Frequently asked questions</h2>
              <p>Everything you need to know about registration, credits and memberships.</p>
              <div className={styles.faqHelp}>
                <Mail size={18} aria-hidden="true" />
                <span>Registration is free, so you can explore the platform at your own pace before choosing a plan.</span>
              </div>
            </aside>
            <div className={styles.faq}>
              {faqs.map(({ q, a }, i) => (
                <details key={q} className="reveal" open={i === 0}>
                  <summary>{q}</summary>
                  <p>{a}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------- CTA ------------------------------- */}
      <section className={styles.ctaWrap} aria-labelledby="cta-title">
        <div className={`${styles.cta} reveal`}>
          <div className={styles.ctaText}>
            <div className={styles.ctaEmblemWrap} aria-hidden="true">
              <img
                src="/images/varaghi/motifs/varaghi-bottom-emblem.png"
                alt=""
                className={styles.ctaEmblem}
              />
            </div>
            <span className={styles.whyKicker}>Get started today</span>
            <h2 id="cta-title">Begin your story with a trusted match.</h2>
            <p>
              Create your free profile in minutes. Browse privately, unlock contacts only when
              you are ready, and take every step at your family&apos;s pace.
            </p>
            <div className={styles.ctaActions}>
              <Link href="/register" className={styles.btnGold}>
                Create free profile <ArrowRight size={17} aria-hidden="true" />
              </Link>
              <Link href="/login" className={styles.btnGhost}>
                Member sign in
              </Link>
            </div>
            <ul className={styles.ctaPoints}>
              <li><Check size={15} aria-hidden="true" /> Free to register</li>
              <li><Check size={15} aria-hidden="true" /> Private contact numbers</li>
              <li><Check size={15} aria-hidden="true" /> No obligation</li>
            </ul>
          </div>
          <div className={styles.ctaPhoto} aria-hidden="true">
            <Image src={heroImage} alt="Auspicious South Indian wedding couple" fill sizes="(max-width: 900px) 100vw, 480px" className={styles.ctaImg} />
          </div>
        </div>
      </section>
    </div>
  );
}
