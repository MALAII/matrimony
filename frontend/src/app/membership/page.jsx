'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Crown,
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
  HelpCircle,
  CreditCard,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  getMySubscriptionApi,
  getMemberCreditsApi,
  createSubscriptionOrderApi,
  verifySubscriptionPaymentApi,
} from '@/lib/api';

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
    name: 'Gold Plan',
    tierSubtitle: 'Three-Month Membership',
    badge: 'Quarterly Duration',
    durationText: '3 Months (90 Days)',
    priceText: 'Price announced soon',
    priceSub: 'Official tariffs published upon launch',
    sandboxPriceText: '₹1.00 (100 paise)',
    sandboxNote: 'Temporary sandbox test amount — not official tariff',
    featured: false,
    icon: Sparkles,
    features: [
      'Full member directory access while active',
      '50 contact credits per monthly cycle (150 total)',
      '1 credit on first view; 0 credits on repeat views',
      'Unused monthly credits do not carry forward',
      '7-day browsing grace period upon expiry',
    ],
  },
  {
    code: 'SIX_MONTHS',
    name: 'Platinum Plan',
    tierSubtitle: 'Six-Month Membership',
    badge: 'Traditional Choice • Most Popular',
    durationText: '6 Months (180 Days)',
    priceText: 'Price announced soon',
    priceSub: 'Official tariffs published upon launch',
    sandboxPriceText: '₹2.00 (200 paise)',
    sandboxNote: 'Temporary sandbox test amount — not official tariff',
    featured: true,
    icon: Crown,
    features: [
      'Full member directory access while active',
      '50 contact credits per monthly cycle (300 total)',
      '1 credit on first view; 0 credits on repeat views',
      'Unused monthly credits do not carry forward',
      '7-day browsing grace period upon expiry',
      'Extended 6-month continuous matrimonial search',
    ],
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

  const loadMembershipDetails = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');

    try {
      // 1. Fetch Subscription status
      const subRes = await getMySubscriptionApi();

      if (subRes.status === 401) {
        // Not logged in or session expired
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

      // 2. Fetch Credit Balance (if member is active/has subscription)
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

    // 0. Environment guard: disallow checkout when flag is not enabled
    if (!isCheckoutEnabled) {
      setCheckoutNotice({
        type: 'error',
        message: 'Online subscription checkout is currently unavailable while official tariffs are finalized.',
      });
      return;
    }

    // 1. Authentication check
    if (!currentUser) {
      router.push('/login?redirect=/membership');
      return;
    }

    // 2. Existing active subscription check (renewal rules pending confirmation)
    if (hasSubscription && subscriptionStatus === 'active') {
      setCheckoutNotice({
        type: 'info',
        message: 'You currently have an active subscription. Subscription renewal features will be available soon.',
      });
      return;
    }

    setProcessingPlan(plan.code);
    setCheckoutNotice({
      type: 'loading',
      message: `Creating payment order for ${plan.name}...`,
    });

    try {
      // Step A: Request server to create Razorpay Order
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

      // Step B: Load Razorpay Checkout modal script
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
        message: 'Opening Razorpay test payment window...',
      });

      // Step C: Initialize Razorpay instance
      const options = {
        key: keyId,
        amount: amount,
        currency: currency || 'INR',
        name: 'Vivahaa Matrimony',
        description: `${planName || plan.name} (Test Mode Sandbox)`,
        order_id: orderId,
        prefill: {
          name: currentUser?.name || '',
          email: currentUser?.email || '',
          contact: currentUser?.phone || '',
        },
        theme: {
          color: '#0B5D52',
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
          // IMPORTANT: Never activate subscription on client callback alone.
          // ALWAYS send credentials to backend verification API.
          setProcessingPlan(plan.code);
          setCheckoutNotice({
            type: 'loading',
            message: 'Payment received by provider. Verifying signature on server and activating subscription...',
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
              // Refresh subscription and credits state
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

  return (
    <div
      style={{
        backgroundColor: '#FBF8F1',
        minHeight: '85vh',
        padding: '2.5rem 1rem 4rem 1rem',
      }}
    >
      <div style={{ maxWidth: '1080px', margin: '0 auto' }}>
        {/* Header Breadcrumb & Title */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <p
            style={{
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              fontSize: '0.78rem',
              fontWeight: 700,
              color: '#C5A15B',
              marginBottom: '0.5rem',
            }}
          >
            Matrimonial Privileges &amp; Contact Access
          </p>
          <h1
            style={{
              fontFamily: 'Playfair Display, Georgia, serif',
              fontSize: '2.2rem',
              fontWeight: 700,
              color: '#07463F',
              marginBottom: '0.75rem',
            }}
          >
            Membership &amp; Credits Dashboard
          </h1>
          <p
            style={{
              fontSize: '0.98rem',
              color: '#5e5952',
              maxWidth: '620px',
              margin: '0 auto',
              lineHeight: 1.6,
            }}
          >
            Review your active matrimonial subscription term, monthly contact unlocking credits, and transparent quarterly/half-yearly membership tiers.
          </p>
        </div>

        {/* Global Error Banner */}
        {errorMessage && (
          <div
            style={{
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              padding: '1rem 1.25rem',
              marginBottom: '2rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              color: '#991b1b',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <AlertCircle size={20} />
              <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={loadMembershipDetails}
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #fca5a5',
                color: '#991b1b',
                padding: '0.4rem 0.85rem',
                borderRadius: '6px',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <RefreshCw size={14} /> Retry
            </button>
          </div>
        )}

        {/* Interactive Payment Checkout Notice Banner */}
        {checkoutNotice && (
          <div
            style={{
              backgroundColor:
                checkoutNotice.type === 'success'
                  ? '#ecfdf5'
                  : checkoutNotice.type === 'error'
                  ? '#fef2f2'
                  : checkoutNotice.type === 'loading'
                  ? '#f0fdfa'
                  : '#fffbeb',
              border:
                checkoutNotice.type === 'success'
                  ? '1.5px solid #6ee7b7'
                  : checkoutNotice.type === 'error'
                  ? '1.5px solid #fca5a5'
                  : checkoutNotice.type === 'loading'
                  ? '1.5px solid #5eead4'
                  : '1.5px solid #fcd34d',
              borderRadius: '10px',
              padding: '1rem 1.25rem',
              marginBottom: '2rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              color:
                checkoutNotice.type === 'success'
                  ? '#065f46'
                  : checkoutNotice.type === 'error'
                  ? '#991b1b'
                  : checkoutNotice.type === 'loading'
                  ? '#0f766e'
                  : '#92400e',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              {checkoutNotice.type === 'success' ? (
                <CheckCircle2 size={20} color="#059669" />
              ) : checkoutNotice.type === 'error' ? (
                <AlertCircle size={20} color="#dc2626" />
              ) : checkoutNotice.type === 'loading' ? (
                <RefreshCw size={18} className="animate-spin" color="#0d9488" />
              ) : (
                <AlertCircle size={20} color="#d97706" />
              )}
              <span style={{ fontSize: '0.92rem', fontWeight: 600 }}>
                {checkoutNotice.message}
              </span>
            </div>
            {checkoutNotice.type !== 'loading' && (
              <button
                type="button"
                onClick={() => setCheckoutNotice(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'inherit',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Dismiss
              </button>
            )}
          </div>
        )}

        {/* SECTION 1: Active Member Status Banner / Guest Sign-In */}
        <div style={{ marginBottom: '3rem' }}>
          {authLoading || loading ? (
            /* Loading Skeleton State */
            <div
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #e5ded2',
                borderRadius: '12px',
                padding: '2.5rem',
                textAlign: 'center',
                boxShadow: '0 2px 8px rgba(11, 93, 82, 0.04)',
              }}
            >
              <RefreshCw
                size={28}
                className="animate-spin"
                style={{ color: '#0B5D52', margin: '0 auto 1rem' }}
              />
              <p style={{ color: '#5e5952', fontSize: '0.95rem' }}>
                Loading membership status and contact credit balance...
              </p>
            </div>
          ) : !currentUser ? (
            /* Logged Out / Guest State */
            <div
              style={{
                backgroundColor: '#ffffff',
                border: '1.5px solid #dfcc9f',
                borderRadius: '12px',
                padding: '2.25rem 2rem',
                textAlign: 'center',
                boxShadow: '0 4px 16px rgba(197, 161, 91, 0.08)',
              }}
            >
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  backgroundColor: '#fbf6ec',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1rem',
                  color: '#C5A15B',
                }}
              >
                <User size={28} strokeWidth={1.8} />
              </div>
              <h2
                style={{
                  fontSize: '1.3rem',
                  fontWeight: 700,
                  color: '#07463F',
                  marginBottom: '0.5rem',
                }}
              >
                Sign In to View Your Membership &amp; Credits
              </h2>
              <p
                style={{
                  fontSize: '0.92rem',
                  color: '#5e5952',
                  maxWidth: '520px',
                  margin: '0 auto 1.5rem',
                  lineHeight: 1.55,
                }}
              >
                Already have an account? Sign in to review your current plan duration, active monthly contact credits, and member directory access privileges.
              </p>
              <div
                style={{
                  display: 'flex',
                  gap: '0.75rem',
                  justifyContent: 'center',
                  flexWrap: 'wrap',
                }}
              >
                <Link
                  href="/login?redirect=/membership"
                  style={{
                    backgroundColor: '#0B5D52',
                    color: '#ffffff',
                    padding: '0.65rem 1.4rem',
                    borderRadius: '6px',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}
                >
                  Sign In <ArrowRight size={16} />
                </Link>
                <Link
                  href="/register"
                  style={{
                    backgroundColor: '#ffffff',
                    color: '#07463F',
                    border: '1.5px solid #C5A15B',
                    padding: '0.65rem 1.4rem',
                    borderRadius: '6px',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                  }}
                >
                  Register Free
                </Link>
              </div>
            </div>
          ) : hasSubscription && subscriptionStatus === 'active' ? (
            /* Active Subscription State */
            <div
              style={{
                backgroundColor: '#ffffff',
                border: '1.5px solid #a7f3d0',
                borderRadius: '12px',
                padding: '2rem',
                boxShadow: '0 4px 18px rgba(16, 185, 129, 0.08)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                  gap: '1rem',
                  marginBottom: '1.5rem',
                  borderBottom: '1px solid #f1f5f9',
                  paddingBottom: '1.25rem',
                }}
              >
                <div>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      backgroundColor: '#ecfdf5',
                      border: '1px solid #6ee7b7',
                      color: '#065f46',
                      padding: '0.3rem 0.75rem',
                      borderRadius: '9999px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                      marginBottom: '0.6rem',
                    }}
                  >
                    <ShieldCheck size={14} /> ACTIVE MEMBERSHIP
                  </span>
                  <h2 style={{ fontSize: '1.45rem', fontWeight: 700, color: '#07463F' }}>
                    {subscription.planCode === 'SIX_MONTHS'
                      ? 'Platinum Plan (6 Months)'
                      : 'Gold Plan (3 Months)'}
                  </h2>
                </div>
                <Link
                  href="/members"
                  style={{
                    backgroundColor: '#0B5D52',
                    color: '#ffffff',
                    padding: '0.6rem 1.25rem',
                    borderRadius: '6px',
                    fontWeight: 600,
                    fontSize: '0.88rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}
                >
                  Browse Member Directory <ArrowRight size={16} />
                </Link>
              </div>

              {/* Status Details Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '1.25rem',
                }}
              >
                {/* 1. Subscription Period */}
                <div
                  style={{
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '1.25rem',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      color: '#0B5D52',
                      marginBottom: '0.6rem',
                    }}
                  >
                    <Calendar size={18} />
                    <span style={{ fontSize: '0.88rem', fontWeight: 700 }}>
                      Validity &amp; Dates
                    </span>
                  </div>
                  <div style={{ fontSize: '0.88rem', color: '#334155', lineHeight: 1.6 }}>
                    <div>
                      <span style={{ color: '#64748b' }}>Activated: </span>
                      <strong>{formatDate(subscription.startDate)}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Expires On: </span>
                      <strong>{formatDate(subscription.endDate)}</strong>
                    </div>
                    {subscription.gracePeriodEndDate && (
                      <div style={{ fontSize: '0.8rem', color: '#047857', marginTop: '0.3rem' }}>
                        7-day browsing grace period through{' '}
                        {formatDate(subscription.gracePeriodEndDate)}
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Contact View Credits */}
                <div
                  style={{
                    backgroundColor: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: '8px',
                    padding: '1.25rem',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      color: '#065f46',
                      marginBottom: '0.6rem',
                    }}
                  >
                    <Phone size={18} />
                    <span style={{ fontSize: '0.88rem', fontWeight: 700 }}>
                      Contact Unlocking Credits
                    </span>
                  </div>
                  {credits ? (
                    <div>
                      <div
                        style={{
                          fontSize: '1.4rem',
                          fontWeight: 800,
                          color: '#065f46',
                          marginBottom: '0.2rem',
                        }}
                      >
                        {credits.creditsRemaining}{' '}
                        <span style={{ fontSize: '0.9rem', fontWeight: 500, color: '#047857' }}>
                          / {credits.creditsAllocated} Available
                        </span>
                      </div>
                      <p style={{ fontSize: '0.8rem', color: '#047857', lineHeight: 1.45 }}>
                        Cycle #{credits.cycleNumber} • {credits.creditsUsed} used this cycle.
                        <br />
                        Viewing an already unlocked candidate costs 0 credits forever.
                      </p>
                    </div>
                  ) : (
                    <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
                      50 credits allocated per monthly cycle.
                    </p>
                  )}
                </div>

                {/* 3. Directory Access Privileges */}
                <div
                  style={{
                    backgroundColor: '#fbf6ec',
                    border: '1px solid #dfcc9f',
                    borderRadius: '8px',
                    padding: '1.25rem',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      color: '#ad8a45',
                      marginBottom: '0.6rem',
                    }}
                  >
                    <CheckCircle2 size={18} />
                    <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#07463F' }}>
                      Directory Privileges
                    </span>
                  </div>
                  <ul
                    style={{
                      listStyle: 'none',
                      padding: 0,
                      margin: 0,
                      fontSize: '0.85rem',
                      color: '#343434',
                      lineHeight: 1.5,
                    }}
                  >
                    <li style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Check size={14} color="#0B5D52" /> Full Jathagam &amp; candidate browsing
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Check size={14} color="#0B5D52" /> Zero repeat credit deductions
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Check size={14} color="#0B5D52" /> 7-day post-expiry browsing grace period
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          ) : subscriptionStatus === 'grace_period' ? (
            /* Grace Period Active State */
            <div
              style={{
                backgroundColor: '#fffbeb',
                border: '1.5px solid #fde68a',
                borderRadius: '12px',
                padding: '2rem',
                boxShadow: '0 4px 18px rgba(217, 119, 6, 0.08)',
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  backgroundColor: '#fef3c7',
                  border: '1px solid #fcd34d',
                  color: '#92400e',
                  padding: '0.3rem 0.75rem',
                  borderRadius: '9999px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  marginBottom: '0.75rem',
                }}
              >
                <Clock size={14} /> 7-DAY BROWSING GRACE PERIOD
              </span>
              <h2
                style={{
                  fontSize: '1.35rem',
                  fontWeight: 700,
                  color: '#78350f',
                  marginBottom: '0.5rem',
                }}
              >
                Your Active Term Has Ended
              </h2>
              <p
                style={{
                  fontSize: '0.92rem',
                  color: '#92400e',
                  maxWidth: '680px',
                  lineHeight: 1.6,
                  marginBottom: '1.25rem',
                }}
              >
                Your membership ended on <strong>{formatDate(subscription?.endDate)}</strong>. You are currently browsing in your complimentary 7-day grace period ending on <strong>{formatDate(subscription?.gracePeriodEndDate)}</strong>. Directory viewing remains active; new contact unlocking is paused until plan renewal.
              </p>
              <Link
                href="/members"
                style={{
                  backgroundColor: '#0B5D52',
                  color: '#ffffff',
                  padding: '0.6rem 1.25rem',
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                Browse Directory in Grace Period <ArrowRight size={16} />
              </Link>
            </div>
          ) : subscriptionStatus === 'expired' ? (
            /* Expired State */
            <div
              style={{
                backgroundColor: '#ffffff',
                border: '1.5px solid #fecaca',
                borderRadius: '12px',
                padding: '2rem',
                boxShadow: '0 4px 18px rgba(239, 68, 68, 0.06)',
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  backgroundColor: '#fee2e2',
                  border: '1px solid #fca5a5',
                  color: '#991b1b',
                  padding: '0.3rem 0.75rem',
                  borderRadius: '9999px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  marginBottom: '0.75rem',
                }}
              >
                <AlertCircle size={14} /> SUBSCRIPTION EXPIRED
              </span>
              <h2
                style={{
                  fontSize: '1.35rem',
                  fontWeight: 700,
                  color: '#07463F',
                  marginBottom: '0.5rem',
                }}
              >
                Membership &amp; Grace Period Expired
              </h2>
              <p
                style={{
                  fontSize: '0.92rem',
                  color: '#64748b',
                  maxWidth: '680px',
                  lineHeight: 1.6,
                  marginBottom: '0.75rem',
                }}
              >
                Your subscription and 7-day browsing grace period expired on{' '}
                <strong>{formatDate(subscription?.gracePeriodEndDate || subscription?.endDate)}</strong>. Member directory privileges and contact view credits are currently disabled.
              </p>
              <p style={{ fontSize: '0.85rem', color: '#0B5D52', fontWeight: 600 }}>
                Choose a plan below to renew your membership via secure test sandbox checkout.
              </p>
            </div>
          ) : (
            /* Registered User Without Active Subscription */
            <div
              style={{
                backgroundColor: '#ffffff',
                border: '1.5px solid #dfcc9f',
                borderRadius: '12px',
                padding: '2rem',
                boxShadow: '0 4px 16px rgba(11, 93, 82, 0.05)',
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  backgroundColor: '#fbf6ec',
                  border: '1px solid #dfcc9f',
                  color: '#07463F',
                  padding: '0.3rem 0.75rem',
                  borderRadius: '9999px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  marginBottom: '0.75rem',
                }}
              >
                <Sparkles size={14} /> REGISTERED ACCOUNT • NO ACTIVE PLAN
              </span>
              <h2
                style={{
                  fontSize: '1.35rem',
                  fontWeight: 700,
                  color: '#07463F',
                  marginBottom: '0.5rem',
                }}
              >
                Welcome, {currentUser?.name || 'Member'}
              </h2>
              <p
                style={{
                  fontSize: '0.92rem',
                  color: '#5e5952',
                  maxWidth: '660px',
                  lineHeight: 1.6,
                }}
              >
                Your account is registered. To access verified candidate profiles and receive 50 monthly contact credits, select our Gold or Platinum plan below using secure sandbox checkout.
              </p>
            </div>
          )}
        </div>

        {/* SECTION 2: Checkout Notice */}
        {isCheckoutEnabled ? (
          <div
            style={{
              backgroundColor: '#fdfbf7',
              border: '1.5px solid #dfcc9f',
              borderRadius: '10px',
              padding: '1.25rem 1.5rem',
              marginBottom: '3rem',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
            }}
          >
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                backgroundColor: '#fbf6ec',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color: '#C5A15B',
              }}
            >
              <CreditCard size={20} />
            </div>
            <div>
              <h3
                style={{
                  fontSize: '0.96rem',
                  fontWeight: 700,
                  color: '#07463F',
                  marginBottom: '0.2rem',
                }}
              >
                Razorpay Test Mode Sandbox Environment
              </h3>
              <p style={{ fontSize: '0.86rem', color: '#5e5952', lineHeight: 1.5 }}>
                Online checkout is configured with Razorpay Test Mode credentials for sandbox verification. Nominal amounts (₹1.00 and ₹2.00) are temporary test values and not official membership tariffs. Production payment checkout remains disabled until public tariffs are officially released.
              </p>
            </div>
          </div>
        ) : (
          <div
            style={{
              backgroundColor: '#fdfbf7',
              border: '1.5px solid #dfcc9f',
              borderRadius: '10px',
              padding: '1.25rem 1.5rem',
              marginBottom: '3rem',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
            }}
          >
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                backgroundColor: '#fbf6ec',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color: '#C5A15B',
              }}
            >
              <Lock size={20} />
            </div>
            <div>
              <h3
                style={{
                  fontSize: '0.96rem',
                  fontWeight: 700,
                  color: '#07463F',
                  marginBottom: '0.2rem',
                }}
              >
                Online Subscription Checkout Notice
              </h3>
              <p style={{ fontSize: '0.86rem', color: '#5e5952', lineHeight: 1.5 }}>
                Online payment gateway checkout is currently unavailable while official pricing tariffs and payment gateway setup are finalized. Registration, profile creation, and horoscope entry remain 100% free.
              </p>
            </div>
          </div>
        )}

        {/* SECTION 3: Membership Plan Comparison Cards */}
        <div style={{ marginBottom: '3.5rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h2
              style={{
                fontFamily: 'Playfair Display, Georgia, serif',
                fontSize: '1.8rem',
                fontWeight: 700,
                color: '#07463F',
                marginBottom: '0.5rem',
              }}
            >
              Subscription Plan Options
            </h2>
            <p style={{ fontSize: '0.92rem', color: '#5e5952' }}>
              Choose quarterly or half-yearly terms with 50 contact unlocking credits per monthly cycle.
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '1.75rem',
              alignItems: 'stretch',
            }}
          >
            {MEMBERSHIP_PLANS.map((plan) => {
              const PlanIcon = plan.icon;
              const isCurrentActive = hasSubscription && subscriptionStatus === 'active';
              const isProcessing = processingPlan === plan.code;

              return (
                <div
                  key={plan.code}
                  style={{
                    backgroundColor: '#ffffff',
                    border: plan.featured ? '2px solid #C5A15B' : '1px solid #e5ded2',
                    borderRadius: '14px',
                    padding: '2rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: plan.featured
                      ? '0 8px 24px rgba(197, 161, 91, 0.14)'
                      : '0 4px 12px rgba(11, 93, 82, 0.04)',
                    position: 'relative',
                  }}
                >
                  {plan.featured && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '-12px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        backgroundColor: '#C5A15B',
                        color: '#ffffff',
                        padding: '0.25rem 0.85rem',
                        borderRadius: '9999px',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        letterSpacing: '0.04em',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                      }}
                    >
                      <Sparkles size={12} /> {plan.badge}
                    </div>
                  )}

                  <div>
                    {/* Header */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        marginBottom: '0.75rem',
                        marginTop: plan.featured ? '0.5rem' : 0,
                      }}
                    >
                      <div
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '8px',
                          backgroundColor: plan.featured ? '#fbf6ec' : '#e8f4f2',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: plan.featured ? '#C5A15B' : '#0B5D52',
                        }}
                      >
                        <PlanIcon size={22} strokeWidth={1.8} />
                      </div>
                      <div>
                        <h3
                          style={{
                            fontSize: '1.25rem',
                            fontWeight: 700,
                            color: '#07463F',
                            lineHeight: 1.2,
                          }}
                        >
                          {plan.name}
                        </h3>
                        <p style={{ fontSize: '0.82rem', color: '#64748b' }}>
                          {plan.tierSubtitle}
                        </p>
                      </div>
                    </div>

                    {/* Price Box with Sandbox Badge */}
                    <div
                      style={{
                        backgroundColor: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        padding: '0.9rem 1.1rem',
                        marginBottom: '1.5rem',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '1.15rem',
                          fontWeight: 700,
                          color: '#07463F',
                        }}
                      >
                        {plan.priceText}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.15rem' }}>
                        {plan.priceSub}
                      </div>
                      {isCheckoutEnabled && plan.sandboxPriceText && (
                        <div
                          style={{
                            marginTop: '0.5rem',
                            padding: '0.35rem 0.6rem',
                            backgroundColor: '#fef3c7',
                            border: '1px dashed #d97706',
                            borderRadius: '6px',
                            fontSize: '0.74rem',
                            color: '#92400e',
                            fontWeight: 600,
                            lineHeight: 1.4,
                          }}
                        >
                          Sandbox Test Price: {plan.sandboxPriceText}
                          <br />
                          <span style={{ fontWeight: 400, fontSize: '0.7rem', color: '#78350f' }}>
                            ({plan.sandboxNote})
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Features List */}
                    <ul
                      style={{
                        listStyle: 'none',
                        padding: 0,
                        margin: '0 0 1.75rem 0',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.65rem',
                      }}
                    >
                      {plan.features.map((feat) => (
                        <li
                          key={feat}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '0.5rem',
                            fontSize: '0.88rem',
                            color: '#334155',
                            lineHeight: 1.45,
                          }}
                        >
                          <ShieldCheck
                            size={16}
                            color="#0B5D52"
                            style={{ flexShrink: 0, marginTop: '2px' }}
                          />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Action / Checkout Button */}
                  <div>
                    {isCurrentActive ? (
                      <button
                        type="button"
                        disabled
                        style={{
                          width: '100%',
                          backgroundColor: '#f1f5f9',
                          color: '#64748b',
                          border: '1px solid #cbd5e1',
                          padding: '0.75rem 1rem',
                          borderRadius: '6px',
                          fontSize: '0.88rem',
                          fontWeight: 600,
                          cursor: 'not-allowed',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.4rem',
                        }}
                      >
                        <Check size={16} /> Plan Already Active
                      </button>
                    ) : !isCheckoutEnabled ? (
                      <button
                        type="button"
                        disabled
                        style={{
                          width: '100%',
                          backgroundColor: '#f1f5f9',
                          color: '#64748b',
                          border: '1px solid #cbd5e1',
                          padding: '0.75rem 1rem',
                          borderRadius: '6px',
                          fontSize: '0.88rem',
                          fontWeight: 600,
                          cursor: 'not-allowed',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.4rem',
                        }}
                      >
                        <Lock size={15} /> Checkout Unavailable
                      </button>
                    ) : isProcessing ? (
                      <button
                        type="button"
                        disabled
                        style={{
                          width: '100%',
                          backgroundColor: '#0B5D52',
                          color: '#ffffff',
                          border: 'none',
                          padding: '0.75rem 1rem',
                          borderRadius: '6px',
                          fontSize: '0.88rem',
                          fontWeight: 600,
                          cursor: 'wait',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.4rem',
                        }}
                      >
                        <RefreshCw size={15} className="animate-spin" /> Processing Payment...
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleInitiateCheckout(plan)}
                        disabled={Boolean(processingPlan)}
                        data-plan-btn={plan.code}
                        style={{
                          width: '100%',
                          backgroundColor: plan.featured ? '#0B5D52' : '#ffffff',
                          color: plan.featured ? '#ffffff' : '#07463F',
                          border: plan.featured ? 'none' : '1.5px solid #0B5D52',
                          padding: '0.75rem 1rem',
                          borderRadius: '6px',
                          fontSize: '0.88rem',
                          fontWeight: 600,
                          cursor: processingPlan ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.4rem',
                          boxShadow: plan.featured ? '0 2px 8px rgba(11, 93, 82, 0.2)' : 'none',
                        }}
                      >
                        <Sparkles size={15} /> Select Plan (Test Checkout)
                      </button>
                    )}
                    <p
                      style={{
                        fontSize: '0.74rem',
                        color: '#94a3b8',
                        textAlign: 'center',
                        marginTop: '0.45rem',
                      }}
                    >
                      {isCurrentActive
                        ? 'Renewal rules will open upon term expiry'
                        : !isCheckoutEnabled
                        ? 'Tariffs published upon payment gateway launch'
                        : 'Simulated Razorpay sandbox payment'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* SECTION 4: Credit System Integrity & Principles */}
        <div
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e5ded2',
            borderRadius: '12px',
            padding: '2rem',
            boxShadow: '0 2px 10px rgba(11, 93, 82, 0.03)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              marginBottom: '1.25rem',
              color: '#07463F',
            }}
          >
            <HelpCircle size={22} color="#C5A15B" />
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>
              Dignified &amp; Transparent Contact Credits Model
            </h3>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '1.5rem',
              fontSize: '0.88rem',
              color: '#5e5952',
              lineHeight: 1.55,
            }}
          >
            <div>
              <strong style={{ color: '#07463F', display: 'block', marginBottom: '0.25rem' }}>
                Zero Repeat Deductions
              </strong>
              Once you unlock a verified candidate contact, you can re-view it anytime during your membership without consuming another credit.
            </div>
            <div>
              <strong style={{ color: '#07463F', display: 'block', marginBottom: '0.25rem' }}>
                50 Monthly Credits
              </strong>
              Each 30-day monthly cycle provides a fresh quota of 50 contact view credits. Unused credits expire at cycle end and do not roll over.
            </div>
            <div>
              <strong style={{ color: '#07463F', display: 'block', marginBottom: '0.25rem' }}>
                7-Day Browsing Grace Period
              </strong>
              If your plan lapses, enjoy a full 7-day grace period to continue browsing eligible candidate profiles before renewal.
            </div>
            <div>
              <strong style={{ color: '#07463F', display: 'block', marginBottom: '0.25rem' }}>
                Candidate Phone Privacy
              </strong>
              Raw telephone numbers are strictly protected and never displayed in directory search cards or public profile listings.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
