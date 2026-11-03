'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Crown,
  Gem,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  Calendar,
  Lock,
  Phone,
  ArrowRight,
  User,
  RefreshCw,
  Check,
  ChevronRight,
  ChevronDown,
  Zap,
  Award,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  getMySubscriptionApi,
  getMemberCreditsApi,
  createSubscriptionOrderApi,
  verifySubscriptionPaymentApi,
} from '@/lib/api';
import styles from './membership.module.css';

function formatDate(dateVal) {
  if (!dateVal) return '—';
  const d = new Date(dateVal);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && window.Razorpay) {
      return resolve(true);
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

const MEMBERSHIP_PLANS = [
  {
    code: 'THREE_MONTHS',
    name: 'Gold',
    term: '3 Months',
    blurb: 'A focused quarter of searching.',
    total: '150',
    featured: false,
    icon: Gem,
    features: [
      'Full candidate profile access',
      '50 contact credits every month',
      '1 credit on first view, 0 on repeat views',
      'Unused monthly credits do not carry forward',
      '7-day browsing grace period',
    ],
  },
  {
    code: 'SIX_MONTHS',
    name: 'Platinum',
    term: '6 Months',
    blurb: 'Unhurried, continuous search.',
    total: '300',
    tag: 'Most popular',
    featured: true,
    icon: Crown,
    features: [
      'Full candidate profile access',
      '50 contact credits every month',
      '1 credit on first view, 0 on repeat views',
      'Unused monthly credits do not carry forward',
      '7-day browsing grace period',
      'Best value for a longer search',
    ],
  },
];

const FAQ_ITEMS = [
  {
    q: 'How do contact view credits work?',
    a: 'Each plan allocates 50 fresh contact unlocking credits per 30-day monthly cycle. When you unlock a candidate contact for the first time, 1 credit is consumed. Viewing that same candidate again in the future costs 0 credits forever.',
  },
  {
    q: 'Do unused monthly credits carry forward?',
    a: 'No. Unused credits expire at the end of each 30-day cycle to ensure active matchmaking engagement. A fresh quota of 50 credits is automatically allocated at the start of each new monthly cycle.',
  },
  {
    q: 'What is the 7-day browsing grace period?',
    a: 'When your subscription reaches its expiration date, you automatically enter a 7-day complimentary browsing grace period. You can continue searching candidate profiles; new contact unlocking resumes as soon as you renew.',
  },
  {
    q: 'Why are candidate telephone numbers protected?',
    a: 'To safeguard candidate privacy and maintain family dignity, phone numbers are never displayed publicly. They are strictly revealed only to verified members who consciously unlock a profile using their contact credits.',
  },
  {
    q: 'Are online membership payments safe and verified?',
    a: 'Yes. All subscription payments are encrypted using 256-bit industry-standard banking gateways with instant digital verification and automated credit allocation.',
  },
];

export default function MembershipPage() {
  const router = useRouter();
  const { currentUser, authLoading } = useAuth();

  const isCheckoutEnabled = process.env.NEXT_PUBLIC_ENABLE_CHECKOUT === 'true';

  const [loading, setLoading] = useState(true);
  const [subscriptionData, setSubscriptionData] = useState(null);
  const [creditData, setCreditData] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [processingPlan, setProcessingPlan] = useState(null);
  const [checkoutNotice, setCheckoutNotice] = useState(null);
  const [openFaqIndex, setOpenFaqIndex] = useState(0);

  const toggleFaq = (index) => {
    setOpenFaqIndex(openFaqIndex === index ? -1 : index);
  };

  const loadMembershipDetails = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');

    try {
      const subRes = await getMySubscriptionApi();
      if (subRes.status === 401) {
        setSubscriptionData(null);
        setCreditData(null);
        setLoading(false);
        return;
      }

      if (subRes.success && subRes.data) {
        setSubscriptionData(subRes.data);
      } else {
        setSubscriptionData(null);
      }

      const credRes = await getMemberCreditsApi();
      if (credRes.success && credRes.data) {
        setCreditData(credRes.data);
      } else {
        setCreditData(null);
      }
    } catch (err) {
      setErrorMessage('Unable to load subscription details. Please check your network connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading) {
      if (currentUser) {
        loadMembershipDetails();
      } else {
        setLoading(false);
      }
    }
  }, [authLoading, currentUser, loadMembershipDetails]);

  const subscription = subscriptionData?.subscription;
  const hasSubscription = subscriptionData?.hasSubscription && Boolean(subscription);
  const subscriptionStatus = subscription?.status || 'none';
  const credits = creditData?.credits;

  const handleInitiateCheckout = async (plan) => {
    setCheckoutNotice(null);

    if (!isCheckoutEnabled) {
      setCheckoutNotice({
        type: 'error',
        message: 'Online subscription checkout is currently unavailable while official tariffs are finalized.',
      });
      return;
    }

    if (!currentUser) {
      router.push('/login?redirect=/membership');
      return;
    }

    if (hasSubscription && subscriptionStatus === 'active') {
      setCheckoutNotice({
        type: 'info',
        message: 'You already have an active subscription. You can renew or extend your plan as your current cycle approaches its expiration date.',
      });
      return;
    }

    setProcessingPlan(plan.code);
    setCheckoutNotice({
      type: 'loading',
      message: `Creating payment order for ${plan.name}...`,
    });

    try {
      const orderRes = await createSubscriptionOrderApi(plan.code);

      if (!orderRes.success) {
        setCheckoutNotice({
          type: 'error',
          message: orderRes.message || 'Unable to create payment order. Online checkout is currently disabled.',
        });
        setProcessingPlan(null);
        return;
      }

      const { orderId, amount, currency, planName, keyId } = orderRes.data || {};
      if (!orderId || !keyId) {
        setCheckoutNotice({
          type: 'error',
          message: 'Received invalid order response from the payment server.',
        });
        setProcessingPlan(null);
        return;
      }

      const scriptReady = await loadRazorpayScript();
      if (!scriptReady) {
        setCheckoutNotice({
          type: 'error',
          message: 'Failed to load Razorpay payment checkout script. Please check your connection.',
        });
        setProcessingPlan(null);
        return;
      }

      setCheckoutNotice({
        type: 'loading',
        message: 'Opening secure payment gateway...',
      });

      const options = {
        key: keyId,
        amount: amount,
        currency: currency || 'INR',
        name: 'Varaghi Matrimony',
        description: `${planName || plan.name} Membership`,
        order_id: orderId,
        prefill: {
          name: currentUser?.name || '',
          email: currentUser?.email || '',
          contact: currentUser?.phone || '',
        },
        theme: {
          color: '#A20D16',
        },
        modal: {
          ondismiss: function () {
            setProcessingPlan(null);
            setCheckoutNotice({
              type: 'info',
              message: 'Payment checkout was cancelled. No charges were made.',
            });
          },
        },
        handler: async function (paymentResponse) {
          setProcessingPlan(plan.code);
          setCheckoutNotice({
            type: 'loading',
            message: 'Payment received. Verifying transaction and activating membership credits...',
          });

          try {
            const verifyRes = await verifySubscriptionPaymentApi({
              razorpay_order_id: paymentResponse.razorpay_order_id,
              razorpay_payment_id: paymentResponse.razorpay_payment_id,
              razorpay_signature: paymentResponse.razorpay_signature,
            });

            if (verifyRes.success) {
              setCheckoutNotice({
                type: 'success',
                message: 'Payment verified successfully! Your subscription and 50 monthly contact view credits are now active.',
              });
              await loadMembershipDetails();
            } else {
              setCheckoutNotice({
                type: 'error',
                message: verifyRes.message || 'Payment verification failed on the server. Subscription was not activated.',
              });
            }
          } catch (verifyErr) {
            setCheckoutNotice({
              type: 'error',
              message: 'Network error occurred while verifying payment. Please refresh your membership dashboard.',
            });
          } finally {
            setProcessingPlan(null);
          }
        },
      };

      const rzpInstance = new window.Razorpay(options);

      rzpInstance.on('payment.failed', function (failureData) {
        setProcessingPlan(null);
        const desc = failureData.error?.description || failureData.error?.reason || 'Payment could not be completed.';
        setCheckoutNotice({
          type: 'error',
          message: `Payment failed: ${desc}`,
        });
      });

      rzpInstance.open();
    } catch (err) {
      setProcessingPlan(null);
      setCheckoutNotice({
        type: 'error',
        message: 'An unexpected error occurred while launching payment checkout.',
      });
    }
  };

  const creditRemaining = credits?.creditsRemaining ?? 0;
  const creditAllocated = credits?.creditsAllocated || 50;
  const creditPercent = Math.min(100, Math.max(0, Math.round((creditRemaining / creditAllocated) * 100)));

  return (
    <div className={styles.page}>
      {/* Editorial Luxury Hero */}
      <section className={styles.hero}>
        <div className={styles.heroBg} aria-hidden="true" />
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

        <div className={styles.heroInner}>
          <div className={styles.heroContent}>
            <nav className={styles.crumbs} aria-label="Breadcrumb">
              <Link href="/">Home</Link>
              <ChevronRight size={13} />
              <span>Membership Plans</span>
            </nav>
            <div className={styles.kickerPill}>
              <Sparkles size={13} /> ஸ்ரீ வாராஹி திருமண தகவல் மையம் &bull; Membership &amp; Privileges
            </div>
            <h1>Membership &amp; Credits Dashboard</h1>
            <img
              src="/images/varaghi/gold-divider.svg"
              alt=""
              className={styles.goldDivider}
              aria-hidden="true"
            />
            <p className={styles.heroDesc}>
              Review your active matrimonial subscription term, monthly contact unlocking credits, and transparent quarterly/half-yearly membership tiers.
            </p>

            <div className={styles.heroTrustStrip}>
              <span className={styles.heroTrustPill}>
                <ShieldCheck size={14} /> Phone Privacy Shield
              </span>
              <span className={styles.heroTrustPill}>
                <Zap size={14} /> Zero Repeat Deductions (மீண்டும் கிரெடிட் இல்லை)
              </span>
              <span className={styles.heroTrustPill}>
                <Clock size={14} /> 7-Day Browsing Grace Period
              </span>
            </div>
          </div>

          {/* Quick Credit Summary for Active Members */}
          {currentUser && credits && (
            <aside className={styles.heroCreditsCard} aria-label="Available contact credits">
              <div className={styles.heroCreditsTop}>
                <span><Phone size={15} /> Contact Credits</span>
                <em>Cycle #{credits.cycleNumber || 1}</em>
              </div>
              <div className={styles.heroCreditsNum}>
                <strong>{creditRemaining}</strong>
                <span>/ {creditAllocated} remaining</span>
              </div>
              <div className={styles.heroBar} role="progressbar" aria-valuenow={creditRemaining} aria-valuemin="0" aria-valuemax={creditAllocated}>
                <i style={{ width: `${creditPercent}%` }} />
              </div>
              <div className={styles.heroCreditsNote}>
                {credits.creditsUsed || 0} unlocked this cycle • 0 credits on repeat views
              </div>
            </aside>
          )}
        </div>
      </section>

      {/* Main Container */}
      <main className={styles.mainContainer}>
        {/* Global Error Banner */}
        {errorMessage && (
          <div className={`${styles.noticeBanner} ${styles.noticeError}`} role="alert">
            <div className={styles.noticeContent}>
              <AlertCircle size={20} />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={loadMembershipDetails}
              className={styles.noticeRetry}
            >
              <RefreshCw size={13} /> Retry
            </button>
          </div>
        )}

        {/* Interactive Payment Checkout Notice Banner */}
        {checkoutNotice && (
          <div
            className={`${styles.noticeBanner} ${
              checkoutNotice.type === 'success'
                ? styles.noticeSuccess
                : checkoutNotice.type === 'error'
                ? styles.noticeError
                : checkoutNotice.type === 'loading'
                ? styles.noticeLoading
                : styles.noticeInfo
            }`}
            role="status"
          >
            <div className={styles.noticeContent}>
              {checkoutNotice.type === 'success' ? (
                <CheckCircle2 size={20} color="#15803d" />
              ) : checkoutNotice.type === 'error' ? (
                <AlertCircle size={20} color="#dc2626" />
              ) : checkoutNotice.type === 'loading' ? (
                <RefreshCw size={18} className="animate-spin" color="#D99A24" />
              ) : (
                <AlertCircle size={20} color="#d97706" />
              )}
              <span>{checkoutNotice.message}</span>
            </div>
            {checkoutNotice.type !== 'loading' && (
              <button
                type="button"
                onClick={() => setCheckoutNotice(null)}
                className={styles.noticeDismiss}
              >
                Dismiss
              </button>
            )}
          </div>
        )}

        {/* SECTION 1: Member Status Banner / Guest Welcome Panel / Active VIP Dashboard */}
        <div className={styles.statusWrapper}>
          {authLoading || loading ? (
            /* Loading Skeleton State */
            <div className={styles.loadingSkeleton}>
              <RefreshCw size={30} className="animate-spin" style={{ color: 'var(--rose-deep)', margin: '0 auto' }} />
              <p>Loading membership status and contact credit balance...</p>
            </div>
          ) : !currentUser ? (
            /* Guest Welcome Panel matching Homepage CTA Style */
            <div className={styles.guestPanel}>
              <div className={styles.guestLeft}>
                <span className={styles.guestTag}>Matrimonial Membership</span>
                <h2>Sign In to View Your Membership &amp; Credits</h2>
                <p>
                  Already have an account? Sign in to review your current plan duration, active monthly contact credits, and candidate profile privileges.
                </p>
                <div className={styles.guestActions}>
                  <Link href="/login?redirect=/membership" className={styles.btnPrimary}>
                    Sign In <ArrowRight size={16} />
                  </Link>
                  <Link href="/register" className={styles.btnOutline}>
                    Register Free
                  </Link>
                </div>
              </div>

              {/* Quick Perks Strip for Guests */}
              <div className={styles.guestPerksStrip}>
                <div className={styles.guestPerkItem}>
                  <div className={styles.guestPerkIcon}>
                    <Phone size={18} />
                  </div>
                  <strong>50 Credits/Month</strong>
                  <span>Unlock candidate contacts directly</span>
                </div>
                <div className={styles.guestPerkItem}>
                  <div className={styles.guestPerkIcon}>
                    <Zap size={18} />
                  </div>
                  <strong>Zero Repeat Costs</strong>
                  <span>Re-view candidates anytime at 0 credits</span>
                </div>
                <div className={styles.guestPerkItem}>
                  <div className={styles.guestPerkIcon}>
                    <Clock size={18} />
                  </div>
                  <strong>7-Day Grace Period</strong>
                  <span>Continued profile browsing upon expiry</span>
                </div>
                <div className={styles.guestPerkItem}>
                  <div className={styles.guestPerkIcon}>
                    <ShieldCheck size={18} />
                  </div>
                  <strong>Phone Privacy</strong>
                  <span>Candidate numbers remain shielded</span>
                </div>
              </div>
            </div>
          ) : hasSubscription && subscriptionStatus === 'active' ? (
            /* 1. ACTIVE MEMBERSHIP — HOMEPAGE-INSPIRED EXECUTIVE CTA PASS */
            <div className={styles.activeDashboard}>
              <div className={styles.activeDashHeader}>
                <div className={styles.activeHeaderLeft}>
                  <div className={styles.liveIndicator}>
                    <span className={styles.liveDot} /> Active Membership Privileges
                  </div>
                  <h2>
                    {subscription.planCode === 'SIX_MONTHS'
                      ? 'Platinum Plan (6 Months)'
                      : 'Gold Plan (3 Months)'}
                  </h2>
                  <p className={styles.activeDashSub}>
                    <Award size={16} /> Certified Matrimonial Search &amp; Candidate Access Pass
                  </p>
                </div>
                <Link href="/members" className={styles.btnGold}>
                  Browse Candidate Profiles <ArrowRight size={16} />
                </Link>
              </div>

              {/* 3 Frosted Metric Cards */}
              <div className={styles.activeMetricsGrid}>
                {/* 1. Validity & Term */}
                <div className={styles.metricCard}>
                  <div className={styles.metricHead}>
                    <div className={styles.metricIconWrap}>
                      <Calendar size={18} />
                    </div>
                    <span>Term Validity &amp; Timeline</span>
                  </div>
                  <div className={styles.metricBody}>
                    <div className={styles.metricRow}>
                      <label>Activated On:</label>
                      <strong>{formatDate(subscription.startDate)}</strong>
                    </div>
                    <div className={styles.metricRow}>
                      <label>Term Ends On:</label>
                      <strong>{formatDate(subscription.endDate)}</strong>
                    </div>
                  </div>
                </div>

                {/* 2. Contact View Credits */}
                <div className={styles.metricCard}>
                  <div className={styles.metricHead}>
                    <div className={styles.metricIconWrap}>
                      <Phone size={18} />
                    </div>
                    <span>Contact Unlocking Credits</span>
                  </div>
                  <div className={styles.metricBody}>
                    <div className={styles.metricCreditsBig}>
                      {credits ? credits.creditsRemaining : 50}{' '}
                      <span className={styles.metricCreditsSub}>
                        / {credits ? credits.creditsAllocated : 50} Available
                      </span>
                    </div>
                    <div
                      className={styles.creditProgressBar}
                      role="progressbar"
                      aria-valuenow={creditRemaining}
                      aria-valuemin="0"
                      aria-valuemax={creditAllocated}
                    >
                      <i style={{ width: `${creditPercent}%` }} />
                    </div>
                    <p style={{ fontSize: '0.82rem', color: 'rgba(255, 255, 255, 0.72)', margin: 0, lineHeight: 1.45 }}>
                      Cycle #{credits?.cycleNumber || 1} • {credits?.creditsUsed || 0} unlocked this cycle.
                      <br />
                      Re-viewing unlocked candidates costs 0 credits forever.
                    </p>
                  </div>
                </div>

                {/* 3. Directory Access Privileges */}
                <div className={styles.metricCard}>
                  <div className={styles.metricHead}>
                    <div className={styles.metricIconWrap}>
                      <ShieldCheck size={18} />
                    </div>
                    <span>Certified Member Privileges</span>
                  </div>
                  <ul className={styles.metricList}>
                    <li>
                      <span className={styles.metricCheckIcon}><Check size={12} strokeWidth={3} /></span>
                      <span>Unrestricted Verified Profile Access</span>
                    </li>
                    <li>
                      <span className={styles.metricCheckIcon}><Check size={12} strokeWidth={3} /></span>
                      <span>Zero Repeat Deductions for Unlocked Contacts</span>
                    </li>
                    <li>
                      <span className={styles.metricCheckIcon}><Check size={12} strokeWidth={3} /></span>
                      <span>7-Day Complimentary Post-Expiry Grace Period</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          ) : subscriptionStatus === 'grace_period' ? (
            /* Grace Period Active State */
            <div className={styles.gracePanel}>
              <span className={styles.kicker} style={{ color: 'var(--gold)' }}>7-Day Browsing Grace Period</span>
              <h2 style={{ marginTop: '0.4rem' }}>Your Active Term Has Ended</h2>
              <p>
                Your membership ended on <strong>{formatDate(subscription?.endDate)}</strong>. You are currently browsing in your complimentary 7-day grace period ending on <strong>{formatDate(subscription?.gracePeriodEndDate)}</strong>. Profile viewing remains active; new contact unlocking is paused until plan renewal.
              </p>
              <Link href="/members" className={styles.btnPrimary}>
                Browse Profiles in Grace Period <ArrowRight size={16} />
              </Link>
            </div>
          ) : subscriptionStatus === 'expired' ? (
            /* Expired State */
            <div className={styles.expiredPanel}>
              <span className={styles.kicker} style={{ color: 'var(--rose-deep)' }}>Subscription Expired</span>
              <h2 style={{ marginTop: '0.4rem' }}>Membership &amp; Grace Period Expired</h2>
              <p>
                Your subscription and 7-day browsing grace period expired on{' '}
                <strong>{formatDate(subscription?.gracePeriodEndDate || subscription?.endDate)}</strong>. Candidate contact view credits are currently disabled.
              </p>
              <p style={{ fontSize: '0.94rem', color: 'var(--rose-deep)', fontWeight: 600, marginBottom: '1.25rem' }}>
                Choose a plan below to renew your membership and unlock verified candidate contacts.
              </p>
            </div>
          ) : (
            /* Registered User Without Active Subscription */
            <div className={styles.registeredPanel}>
              <span className={styles.kicker}>Registered Account • No Active Plan</span>
              <h2 style={{ marginTop: '0.4rem' }}>Welcome, {currentUser?.name || 'Member'}</h2>
              <p>
                Your account is registered. To access verified candidate profiles and receive 50 monthly contact credits, select our Gold or Platinum plan below.
              </p>
            </div>
          )}
        </div>

        {/* ==========================================================================
            2. SUBSCRIPTION PLAN OPTIONS — EXACT HOMEPAGE WORDINGS & STYLE
            ========================================================================== */}
        <section className={styles.plansSection} aria-labelledby="plans-heading">
          <div className={styles.sectionHeading}>
            <span className={styles.kicker}>Membership</span>
            <h2 id="plans-heading">Choose how long you search</h2>
          </div>

          <div className={styles.plansGrid}>
            {MEMBERSHIP_PLANS.map((plan) => {
              const PlanIcon = plan.icon;
              const isCurrentActive = hasSubscription && subscriptionStatus === 'active';
              const isProcessing = processingPlan === plan.code;

              return (
                <article
                  key={plan.code}
                  className={`${styles.planCard} ${plan.featured ? styles.planFeatured : ''}`}
                >
                  {plan.featured && (
                    <span className={styles.planTag}>
                      {plan.tag}
                    </span>
                  )}

                  <div>
                    {/* Header */}
                    <header className={styles.planHead}>
                      <span className={styles.planIcon}>
                        <PlanIcon size={24} strokeWidth={1.6} />
                      </span>
                      <div>
                        <h3>{plan.name}</h3>
                        <p>{plan.blurb}</p>
                      </div>
                    </header>

                    {/* Exact Homepage 2-Box Stat Body */}
                    <div className={styles.planBody}>
                      <div>
                        <strong>{plan.term}</strong>
                        <span>of full profile<br />access</span>
                      </div>
                      <div>
                        <strong>{plan.total}</strong>
                        <span>contact credits<br />in total</span>
                      </div>
                    </div>

                    {/* Features List with Homepage Bullets */}
                    <ul className={styles.planFeaturesList}>
                      {plan.features.map((feat) => (
                        <li key={feat}>
                          <span className={styles.featureBullet}>
                            <Check size={13} strokeWidth={3} />
                          </span>
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Foot Action */}
                  <div className={styles.planFoot}>
                    <p className={styles.priceLabel}>
                      Pricing announced soon
                    </p>

                    {isCurrentActive ? (
                      <button
                        type="button"
                        disabled
                        className={styles.btnOutline}
                        style={{ cursor: 'not-allowed', opacity: 0.65 }}
                      >
                        <Check size={16} /> Plan Already Active
                      </button>
                    ) : !isCheckoutEnabled ? (
                      <button
                        type="button"
                        disabled
                        className={styles.btnOutline}
                        style={{ cursor: 'not-allowed', opacity: 0.65 }}
                      >
                        <Lock size={15} /> Checkout Unavailable
                      </button>
                    ) : isProcessing ? (
                      <button
                        type="button"
                        disabled
                        className={styles.btnPrimary}
                        style={{ cursor: 'wait' }}
                      >
                        <RefreshCw size={15} className="animate-spin" /> Processing Payment...
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleInitiateCheckout(plan)}
                        disabled={Boolean(processingPlan)}
                        data-plan-btn={plan.code}
                        className={plan.featured ? styles.btnGold : styles.btnPrimary}
                      >
                        Get started <ArrowRight size={16} />
                      </button>
                    )}
                    <p className={styles.planFootNote}>
                      {isCurrentActive
                        ? 'Renewal rules will open upon term expiry'
                        : !isCheckoutEnabled
                        ? 'Tariffs published upon payment gateway launch'
                        : 'Instant digital activation upon order completion'}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>

          <p className={styles.note}>
            Registration is free. Online payments open once pricing is finalised.
          </p>
        </section>

        {/* SECTION 3: Interactive FAQ Accordion */}
        <section className={styles.faqSection} aria-labelledby="faq-heading">
          <div className={styles.faqSectionHeader}>
            <span className={styles.kicker}>Common Inquiries</span>
            <h3 id="faq-heading" style={{ marginTop: '0.6rem' }}>Frequently Asked Questions</h3>
            <p>Everything you need to know about contact unlocking and membership terms</p>
          </div>

          <div className={styles.accordionList}>
            {FAQ_ITEMS.map((item, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div
                  key={item.q}
                  className={`${styles.accordionItem} ${isOpen ? styles.accordionItemOpen : ''}`}
                >
                  <button
                    type="button"
                    onClick={() => toggleFaq(idx)}
                    className={styles.accordionTrigger}
                    aria-expanded={isOpen}
                  >
                    <span>{item.q}</span>
                    <span className={`${styles.accordionChevron} ${isOpen ? styles.accordionChevronRotated : ''}`}>
                      <ChevronDown size={16} />
                    </span>
                  </button>
                  {isOpen && (
                    <div className={styles.accordionBody}>
                      <p>{item.a}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ==========================================================================
            4. THE CARDS BEFORE THE FOOTER — EXACT HOMEPAGE "WHY CHOOSE US" GRID
            ========================================================================== */}
        <section className={styles.charterSection} aria-labelledby="charter-heading">
          <div className={styles.charterHeader}>
            <span className={styles.kicker}>Platform Integrity</span>
            <h3 id="charter-heading" style={{ marginTop: '0.6rem' }}>Our Matrimonial Charter</h3>
            <p>Four dignified principles safeguarding candidate privacy and genuine matrimonial alliances</p>
          </div>

          <div className={styles.whyGrid}>
            <article>
              <div className={styles.whyTop}>
                <div className={styles.featIcon}>
                  <Zap size={22} />
                </div>
                <span className={styles.whyNum}>01</span>
              </div>
              <h3>Zero Repeat Deductions</h3>
              <p>
                Once you unlock a verified candidate contact, you can re-view and reference it anytime throughout your membership without consuming an additional credit.
              </p>
            </article>

            <article>
              <div className={styles.whyTop}>
                <div className={styles.featIcon}>
                  <Phone size={22} />
                </div>
                <span className={styles.whyNum}>02</span>
              </div>
              <h3>50 Monthly Unlocks</h3>
              <p>
                Each 30-day monthly cycle provides a fresh allocation of 50 contact view credits, enabling meaningful family discussions without artificial throttling.
              </p>
            </article>

            <article>
              <div className={styles.whyTop}>
                <div className={styles.featIcon}>
                  <Clock size={22} />
                </div>
                <span className={styles.whyNum}>03</span>
              </div>
              <h3>7-Day Grace Period</h3>
              <p>
                If your subscription lapses, you automatically receive a full 7-day complimentary browsing grace period to keep reviewing profiles without interruption.
              </p>
            </article>

            <article>
              <div className={styles.whyTop}>
                <div className={styles.featIcon}>
                  <ShieldCheck size={22} />
                </div>
                <span className={styles.whyNum}>04</span>
              </div>
              <h3>Phone Privacy Shield</h3>
              <p>
                Raw telephone numbers are strictly protected and never displayed in candidate search cards, public listing pages, or search engine indexes.
              </p>
            </article>
          </div>
        </section>
      </main>
    </div>
  );
}
