"use client";

import React from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  HeartHandshake,
  KeyRound,
  ShieldCheck,
  UsersRound,
  ScrollText,
  UserRoundPlus,
  Search,
  Check,
  Crown,
  Sparkles,
  Grid3X3,
  Sun,
  FileText,
  Lock,
  Info,
} from "lucide-react";
import styles from "./home-landing-design.module.css";

const benefits = [
  {
    Icon: UsersRound,
    title: "Direct & broker-assisted profiles",
    description: "Flexible profile options for individuals and families.",
  },
  {
    Icon: ScrollText,
    title: "Individual South Indian Jathagam details",
    description: "Rasi, Nakshatra, Lagnam and related details in one place.",
  },
  {
    Icon: ShieldCheck,
    title: "Candidate contact privacy",
    description: "Contact numbers are not displayed in public profile views.",
  },
  {
    Icon: HeartHandshake,
    title: "Rooted in South Indian traditions",
    description: "A thoughtful space for family values and preferences.",
  },
];

const processSteps = [
  {
    number: "01",
    stage: "Profile & Heritage",
    Icon: UserRoundPlus,
    title: "Create your profile",
    description:
      "Register for free and share your personal, education, career, family background, and structured Vedic Jathagam records.",
    perks: ["Free account creation", "Vedic Jathagam records"],
  },
  {
    number: "02",
    stage: "Choose Access",
    Icon: CalendarDays,
    title: "Choose membership",
    description:
      "Select a three-month or six-month membership duration to activate full access to our curated member directory.",
    perks: ["3 or 6 month terms", "50 monthly contact credits"],
  },
  {
    number: "03",
    stage: "Discreet Search",
    Icon: Search,
    title: "Explore member profiles",
    description:
      "Review prospective alliances with family-oriented filters. Candidate phone numbers remain completely hidden in directory views.",
    perks: ["Hidden contact numbers", "Direct & broker profiles"],
  },
  {
    number: "04",
    stage: "Dignified Connect",
    Icon: KeyRound,
    title: "Unlock contact details",
    description:
      "Use your monthly credits to reveal verified phone numbers. Viewing an unlocked contact again costs zero additional credits forever.",
    perks: ["1 credit first view", "Lifetime 0-credit re-views"],
  },
];

const plans = [
  {
    id: "gold",
    name: "Gold Plan",
    tierSubtitle: "Three-Month Membership",
    badge: "Quarterly Duration",
    duration: "3 Months",
    durationDays: "90 days active directory access",
    priceText: "Price announced soon",
    priceSub: "Official tariffs published upon launch",
    featured: false,
    Icon: Sparkles,
    features: [
      "Full member directory access while active",
      "50 contact credits per monthly cycle (150 total)",
      "1 credit on first view; 0 credits on repeat views",
      "Unused monthly credits do not carry forward",
      "7-day browsing grace period upon expiry",
    ],
    ctaText: "Register Free for Gold",
    ctaLink: "/register",
  },
  {
    id: "platinum",
    name: "Platinum Plan",
    tierSubtitle: "Six-Month Membership",
    badge: "Traditional Choice • Most Popular",
    duration: "6 Months",
    durationDays: "180 days active directory access",
    priceText: "Price announced soon",
    priceSub: "Official tariffs published upon launch",
    featured: true,
    Icon: Crown,
    features: [
      "Full member directory access while active",
      "50 contact credits per monthly cycle (300 total)",
      "1 credit on first view; 0 credits on repeat views",
      "Unused monthly credits do not carry forward",
      "7-day browsing grace period upon expiry",
      "Extended 6-month continuous matrimonial search",
    ],
    ctaText: "Register Free for Platinum",
    ctaLink: "/register",
  },
];

function KolamOrnament() {
  return (
    <svg
      viewBox="0 0 240 240"
      className={styles.kolamSvg}
      fill="none"
      aria-hidden="true"
    >
      <g stroke="currentColor" strokeWidth="1.15">
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
  );
}

export default function HomeLandingDesign({
  // Panoramic wedding artwork uploaded by user:
  heroImage = "/images/hero-wedding-panorama.png",
}) {
  return (
    <div className={styles.page}>
      <section
        className={styles.hero}
        style={{ "--hero-image": `url("${heroImage}")` }}
        aria-labelledby="matrimony-home-title"
      >
        <div className={`${styles.ornament} ${styles.ornamentTopLeft}`}>
          <KolamOrnament />
        </div>
        <div className={`${styles.ornament} ${styles.ornamentBottomLeft}`}>
          <KolamOrnament />
        </div>
        <div className={`${styles.ornament} ${styles.ornamentBottomRight}`}>
          <KolamOrnament />
        </div>
        <div className={styles.heroKolamWatermark} aria-hidden="true">
          <KolamOrnament />
        </div>
        <div className={styles.heroPhoto} aria-hidden="true" />

        <div className={styles.heroContent}>
          <div className={styles.eyebrowBadge}>
            <Sparkles size={13} className={styles.eyebrowSparkle} aria-hidden="true" />
            <span>South Indian Matrimonial Traditions</span>
          </div>
          <h1 id="matrimony-home-title" className={styles.heroTitle}>
            Meaningful Matches,
            <span>Rooted in Tradition.</span>
          </h1>
          <p className={styles.heroDescription}>
            A thoughtful matrimonial space for South Indian families, bringing
            together tradition, family values and modern aspirations, with
            individual Jathagam details and considered contact privacy.
          </p>

          <div className={styles.heroActions}>
            <Link href="/register" className={styles.primaryButton}>
              Create Your Profile <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <Link href="/login" className={styles.secondaryButton}>
              Member Sign In
            </Link>
          </div>

          <p className={styles.heroNote}>
            Free registration <span aria-hidden="true">•</span> Member directory
            access requires an active subscription
          </p>

          <div className={styles.heroPromises}>
            <span>
              <ShieldCheck size={17} aria-hidden="true" />
              Hidden contact numbers
            </span>
            <span>
              <ScrollText size={17} aria-hidden="true" />
              Individual Jathagam details
            </span>
            <span>
              <UsersRound size={17} aria-hidden="true" />
              Family & broker-assisted profiles
            </span>
          </div>
        </div>
      </section>

      <section className={styles.benefits} aria-label="Platform features">
        <div className={styles.benefitGrid}>
          {benefits.map(({ Icon, title, description }) => (
            <article className={styles.benefit} key={title}>
              <div className={styles.benefitIcon}>
                <Icon size={27} strokeWidth={1.55} aria-hidden="true" />
              </div>
              <div>
                <h2>{title}</h2>
                <p>{description}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section
        id="how-it-works"
        className={styles.processSection}
        aria-labelledby="matrimony-process-title"
      >
        <div className={styles.sectionHeadingLight}>
          <p className={styles.eyebrow}>
            <span className={styles.eyebrowRuleLight} />
            A clear and thoughtful process
            <span className={styles.eyebrowRuleLight} />
          </p>
          <h2 id="matrimony-process-title">How It Works</h2>
          <div className={styles.headingDivider} aria-hidden="true">
            <span />
            <i />
            <span />
          </div>
          <p>
            A straightforward, transparent four-step journey designed to unite South Indian families
            with cultural harmony, astrological clarity, and absolute privacy.
          </p>
        </div>

        {/* Connected Journey Milestones Ribbon on Desktop */}
        <div className={styles.journeyTrackWrap} aria-hidden="true">
          <div className={styles.journeyTrackLine} />
          <div className={styles.journeyTrackNodes}>
            {processSteps.map(({ number, stage }) => (
              <div className={styles.journeyTrackNode} key={number}>
                <span className={styles.journeyNodeDot}>
                  <span className={styles.journeyNodeInnerDot} />
                </span>
                <span className={styles.journeyNodeLabel}>Step {number}</span>
                <span className={styles.journeyNodeStage}>{stage}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.processGrid}>
          {processSteps.map(({ number, stage, Icon, title, description, perks }) => (
            <article className={styles.processCard} key={number}>
              {/* Subtle ornamental watermark */}
              <div className={styles.processCardWatermark} aria-hidden="true">
                <KolamOrnament />
              </div>

              <div className={styles.processCardTop}>
                <span className={styles.processIcon}>
                  <Icon size={24} strokeWidth={1.6} aria-hidden="true" />
                </span>
                <div className={styles.processStepBadge}>
                  <span className={styles.stepNumber}>STEP {number}</span>
                  <span className={styles.stepStageName}>{stage}</span>
                </div>
              </div>

              <h3>{title}</h3>
              <p className={styles.processDesc}>{description}</p>

              <div className={styles.processPerksList}>
                {perks.map((perk) => (
                  <span className={styles.processPerkItem} key={perk}>
                    <Check size={13} className={styles.processPerkCheck} aria-hidden="true" />
                    {perk}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* =========================================================================
          SOUTH INDIAN JATHAGAM SECTION (Matching Stitch Mockup)
          ========================================================================= */}
      <section
        id="jathagam"
        className={styles.jathagamSection}
        aria-labelledby="matrimony-jathagam-title"
      >
        <div className={styles.sectionHeading}>
          <div className={styles.jathagamBadge}># ASTROLOGICAL HERITAGE</div>
          <h2 id="matrimony-jathagam-title">South Indian Jathagam</h2>
          <div className={styles.headingDivider} aria-hidden="true">
            <span />
            <i />
            <span />
          </div>
          <p>
            Traditional 12-square South Indian Rasi charts generated and associated with member profiles.
          </p>
        </div>

        <div className={styles.jathagamContainer}>
          {/* Left Column: Individual Rasi Chart (ராசி கட்டம்) Card */}
          <div className={styles.rasiCard}>
            <div className={styles.rasiCardHeader}>
              <div>
                <p className={styles.rasiCardEyebrow}>Individual Horoscope</p>
                <h3 className={styles.rasiCardTitle}>Individual Rasi Chart (ராசி கட்டம்)</h3>
              </div>
              <span className={styles.rasiPill}>12 Bhavas Attached</span>
            </div>

            {/* 12-Square South Indian Rasi Chart (இராசி கட்டம்) */}
            <div className={styles.rasiGrid} aria-label="Traditional South Indian 12-house Rasi Chart layout">
              {/* Row 1 */}
              <div key="house-12" className={styles.rasiCell}>
                <span className={styles.rasiHouseLabel}>12. Meenam</span>
                <span className={styles.rasiPlanetValue}>சுக் (Ven)</span>
              </div>
              <div key="house-1" className={styles.rasiCell}>
                <span className={styles.rasiHouseLabel}>1. Mesham</span>
                <span className={styles.rasiPlanetValue}>சூரி (Sun)</span>
              </div>
              <div key="house-2" className={styles.rasiCell}>
                <span className={styles.rasiHouseLabel}>2. Rishabam</span>
                <span className={styles.rasiPlanetValue}>புத (Mer)</span>
              </div>
              <div key="house-3" className={styles.rasiCell}>
                <span className={styles.rasiHouseLabel}>3. Mithunam</span>
                <span className={styles.rasiPlanetValue}>-</span>
              </div>

              {/* Row 2 */}
              <div key="house-11" className={styles.rasiCell}>
                <span className={styles.rasiHouseLabel}>11. Kumbam</span>
                <span className={styles.rasiPlanetValue}>-</span>
              </div>

              {/* Merged 2x2 Center Box */}
              <div key="house-center" className={styles.rasiCenterBox}>
                <h4 className={styles.rasiCenterTitle}>இராசி கட்டம்</h4>
                <p className={styles.rasiCenterSubtitle}>Suddha Jathagam</p>
                <span className={styles.rasiDoshamBadge}>Sevvai Dosham Cleared</span>
                <span className={styles.rasiAyanamsa}>Lahiri Ayanamsa • Thiru Kanitha</span>
              </div>

              <div key="house-4" className={styles.rasiCell}>
                <span className={styles.rasiHouseLabel}>4. Katakam</span>
                <span className={styles.rasiPlanetValue}>ல (Lagna)</span>
              </div>

              {/* Row 3 */}
              <div key="house-10" className={styles.rasiCell}>
                <span className={styles.rasiHouseLabel}>10. Makaram</span>
                <span className={styles.rasiPlanetValue}>குரு (Jup)</span>
              </div>

              <div key="house-5" className={styles.rasiCell}>
                <span className={styles.rasiHouseLabel}>5. Simmam</span>
                <span className={styles.rasiPlanetValue}>-</span>
              </div>

              {/* Row 4 */}
              <div key="house-9" className={styles.rasiCell}>
                <span className={styles.rasiHouseLabel}>9. Dhanusu</span>
                <span className={styles.rasiPlanetValue}>சனி (Sat)</span>
              </div>
              <div key="house-8" className={styles.rasiCell}>
                <span className={styles.rasiHouseLabel}>8. Vrichigam</span>
                <span className={styles.rasiPlanetValue}>செவ் (Mars)</span>
              </div>
              <div key="house-7" className={styles.rasiCell}>
                <span className={styles.rasiHouseLabel}>7. Thulam</span>
                <span className={styles.rasiPlanetValue}>சந் (Moon)</span>
              </div>
              <div key="house-6" className={styles.rasiCell}>
                <span className={styles.rasiHouseLabel}>6. Kanni</span>
                <span className={styles.rasiPlanetValue}>ராகு (Rah) • கேது (Ket)</span>
              </div>
            </div>

            {/* Card Footer Bar */}
            <div className={styles.rasiCardFooter}>
              <span className={styles.rasiFooterBadge}>
                <Check size={14} className={styles.rasiFooterCheck} aria-hidden="true" />
                South Indian Rasi Chart (ராசி கட்டம்)
              </span>
              <span className={styles.rasiFooterLayout}>Traditional 12-Bhavas Layout</span>
            </div>
          </div>

          {/* Right Column: Features and Action */}
          <div className={styles.jathagamInfo}>
            <div className={styles.jathagamFeatures}>
              <div className={styles.jathagamFeatureItem}>
                <div className={styles.jathagamIconTeal}>
                  <Grid3X3 size={22} strokeWidth={1.8} aria-hidden="true" />
                </div>
                <div>
                  <h3>South Indian 12-Bhavas Rasi Chart</h3>
                  <p>Clear South Indian 12-square chart layout displaying planetary placements for family review.</p>
                </div>
              </div>

              <div className={styles.jathagamFeatureItem}>
                <div className={styles.jathagamIconGold}>
                  <Sun size={22} strokeWidth={1.8} aria-hidden="true" />
                </div>
                <div>
                  <h3>Planetary Placements &amp; Lagnam</h3>
                  <p>Displays Rasi, planetary positions, and Lagna for astrological review.</p>
                </div>
              </div>

              <div className={styles.jathagamFeatureItem}>
                <div className={styles.jathagamIconTeal}>
                  <FileText size={22} strokeWidth={1.8} aria-hidden="true" />
                </div>
                <div>
                  <h3>Verified Profile Horoscope</h3>
                  <p>Accurate birth-chart details are carefully recorded and linked directly to candidate profiles for family review.</p>
                </div>
              </div>

              <div className={styles.jathagamFeatureItem}>
                <div className={styles.jathagamIconTeal}>
                  <Lock size={22} strokeWidth={1.8} aria-hidden="true" />
                </div>
                <div>
                  <h3>Protected Directory Privacy</h3>
                  <p>Horoscope details are kept confidential and accessible only to verified members with an active directory subscription.</p>
                </div>
              </div>
            </div>

            {/* Consultation Disclaimer */}
            <div className={styles.jathagamDisclaimerBox}>
              <Info size={20} className={styles.jathagamDisclaimerIcon} aria-hidden="true" />
              <p>
                <strong>Traditional Consultation Preserved:</strong> We provide structured individual birth-chart information so families can consult their chosen family astrologers directly. Our platform does not generate automated Porutham scores.
              </p>
            </div>

            <div className={styles.jathagamActionWrap}>
              <Link href="/members" className={styles.jathagamActionBtn}>
                View Jathagam Information <ArrowRight size={17} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section
        id="membership"
        className={styles.membershipSection}
        aria-labelledby="matrimony-membership-title"
      >
        {/* Themed ornamental background motifs */}
        <div className={`${styles.ornament} ${styles.membershipOrnamentLeft}`} aria-hidden="true">
          <KolamOrnament />
        </div>
        <div className={`${styles.ornament} ${styles.membershipOrnamentRight}`} aria-hidden="true">
          <KolamOrnament />
        </div>

        <div className={styles.sectionHeading}>
          <p className={styles.eyebrow}>
            <span className={styles.eyebrowRule} />
            Transparent &amp; Dignified Access
            <span className={styles.eyebrowRule} />
          </p>
          <h2 id="matrimony-membership-title">Membership Plans</h2>
          <div className={styles.headingDivider} aria-hidden="true">
            <span />
            <i />
            <span />
          </div>
          <p>
            Choose between our Gold and Platinum plans for complete directory privileges.
            All plans include monthly contact unlocking credits with zero repeat deductions.
          </p>
        </div>

        <div className={styles.planGrid}>
          {plans.map((plan) => (
            <article
              className={`${styles.planCard} ${plan.featured ? styles.planCardFeatured : styles.planCardGold}`}
              key={plan.id}
            >
              {/* Featured Ribbon for Platinum */}
              {plan.featured && (
                <div className={styles.planFeaturedRibbon}>
                  <Sparkles size={13} aria-hidden="true" />
                  <span>{plan.badge}</span>
                </div>
              )}

              {/* Watermark Kolam inside card */}
              <div className={styles.planCardWatermark} aria-hidden="true">
                <KolamOrnament />
              </div>

              <div className={styles.planHeader}>
                <div className={plan.featured ? styles.planIconPlatinum : styles.planIconGold}>
                  <plan.Icon size={26} strokeWidth={1.7} aria-hidden="true" />
                </div>
                {!plan.featured && <p className={styles.planTierBadge}>{plan.badge}</p>}
                <h3 className={styles.planTitle}>{plan.name}</h3>
                <p className={styles.planDuration}>{plan.duration}</p>
                <p className={styles.planDurationSub}>{plan.durationDays}</p>

                <div className={styles.planPriceBox}>
                  <p className={styles.planPrice}>{plan.priceText}</p>
                  <p className={styles.planPriceSub}>{plan.priceSub}</p>
                </div>
              </div>

              <div className={styles.planDivider} />

              <ul className={styles.planFeatures}>
                {plan.features.map((feature) => (
                  <li key={feature}>
                    <ShieldCheck size={18} className={styles.planFeatureCheck} aria-hidden="true" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <div className={styles.planActionWrap}>
                <Link
                  href={plan.ctaLink}
                  className={plan.featured ? styles.primaryButton : styles.planGoldButton}
                >
                  {plan.ctaText} <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </div>
            </article>
          ))}
        </div>

        <p className={styles.membershipNote}>
          Online membership payments will be enabled once pricing tariffs and payment gateway setup are finalized. Registration remains 100% free.
        </p>
      </section>

      <section
        id="privacy"
        className={styles.privacySection}
        aria-labelledby="matrimony-privacy-title"
      >
        <div className={styles.privacyIntro}>
          <p className={styles.eyebrow}>Privacy and discretion</p>
          <h2 id="matrimony-privacy-title">Candidate Privacy by Design</h2>
          <p>
            Candidate contact details are not displayed in public profile views.
            Access to phone numbers is controlled through the member contact
            unlock process.
          </p>
        </div>
        <div className={styles.privacyGrid}>
          <article>
            <span className={styles.privacyIcon}>
              <ShieldCheck size={24} strokeWidth={1.6} aria-hidden="true" />
            </span>
            <h3>Hidden contact numbers</h3>
            <p>Candidate phone numbers are not exposed in public directory views.</p>
          </article>
          <article>
            <span className={styles.privacyIcon}>
              <KeyRound size={24} strokeWidth={1.6} aria-hidden="true" />
            </span>
            <h3>Controlled contact access</h3>
            <p>Contact unlocking is available to eligible signed-in members.</p>
          </article>
          <article>
            <span className={styles.privacyIcon}>
              <HeartHandshake size={24} strokeWidth={1.6} aria-hidden="true" />
            </span>
            <h3>No repeat credit deduction</h3>
            <p>Revisiting an already unlocked contact does not cost another credit.</p>
          </article>
        </div>
      </section>

      <section className={styles.finalCta}>
        <div className={styles.finalCtaOrnament} aria-hidden="true">
          <KolamOrnament />
        </div>
        <p className={styles.eyebrow}>Begin your journey</p>
        <h2>Begin Your Matrimonial Journey with Confidence</h2>
        <p>
          Create a profile, share the details that matter to your family, and
          take the next step at your own pace.
        </p>
        <div className={styles.finalCtaActions}>
          <Link href="/register" className={styles.goldButton}>
            Create Your Profile <ArrowRight size={18} aria-hidden="true" />
          </Link>
          <Link href="/login" className={styles.darkSecondaryButton}>
            Member Sign In
          </Link>
        </div>
      </section>
    </div>
  );
}
