'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { getAdminUserDetailApi } from '@/lib/api';
import { StatusPill } from '@/components/admin/StatusPill';
import { rupees, shortDate, dateTime, PLAN_LABEL } from '@/components/admin/adminFormat';

export default function AdminUserDetailPage() {
  const { id } = useParams();
  const [d, setD] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    getAdminUserDetailApi(id).then((res) => {
      if (!alive) return;
      if (res.success) setD(res.data);
      else setError(res.message || 'Could not load this user.');
    });
    return () => {
      alive = false;
    };
  }, [id]);

  if (error) return <div className="adm-card adm-empty">{error} <Link href="/admin/users" className="adm-link">Back to users</Link></div>;
  if (!d) return <div className="adm-card adm-empty">Loading…</div>;

  const { user, profile, subscriptions, payments, creditCycle, unlockCount } = d;
  const activeSub = subscriptions.find((s) => s.status === 'active' || s.status === 'grace_period');

  return (
    <>
      <div className="adm-page-head">
        <div>
          <Link href="/admin/users" className="adm-link" style={{ fontSize: '.85rem' }}>← All users</Link>
          <h1 style={{ marginTop: '.35rem' }}>{user.name}</h1>
          <p>{user.email}</p>
        </div>
        <div className="adm-chips">
          <span className="adm-pill neutral">{user.role}</span>
          <StatusPill status={user.accountStatus} />
        </div>
      </div>

      <div className="adm-grid2" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="adm-card">
          <h2>Account</h2>
          <dl className="adm-dl">
            <div><dt>Registered</dt><dd>{dateTime(user.createdAt)}</dd></div>
            <div><dt>Sign-up source</dt><dd>{user.registrationSource || '—'}</dd></div>
            <div><dt>Email verified</dt><dd>{user.emailVerifiedAt ? shortDate(user.emailVerifiedAt) : 'No'}</dd></div>
            <div><dt>Invite sent</dt><dd>{user.invitationSentAt ? dateTime(user.invitationSentAt) : '—'}</dd></div>
          </dl>
        </div>

        <div className="adm-card">
          <h2>Profile</h2>
          {profile ? (
            <dl className="adm-dl">
              <div><dt>Name</dt><dd>{profile.candidateName || user.name}</dd></div>
              <div><dt>Approval</dt><dd><StatusPill status={profile.approvalStatus} /></dd></div>
              <div><dt>Activity</dt><dd><StatusPill status={profile.profileStatus} /></dd></div>
              <div><dt>Location</dt><dd>{profile.personalDetails?.location || '—'}</dd></div>
              <div><dt>Created</dt><dd>{shortDate(profile.createdAt)}</dd></div>
            </dl>
          ) : (
            <p className="adm-empty">No profile created yet.</p>
          )}
        </div>

        <div className="adm-card">
          <h2>Membership</h2>
          {activeSub ? (
            <dl className="adm-dl">
              <div><dt>Plan</dt><dd>{PLAN_LABEL[activeSub.planCode]}</dd></div>
              <div><dt>Status</dt><dd><StatusPill status={activeSub.status} /></dd></div>
              <div><dt>Ends</dt><dd>{shortDate(activeSub.endDate)}</dd></div>
            </dl>
          ) : (
            <p className="adm-empty">No active membership.</p>
          )}
          <Link href="/admin/subscriptions" className="adm-link" style={{ fontSize: '.85rem' }}>Manage subscriptions →</Link>
        </div>

        <div className="adm-card">
          <h2>Contact credits</h2>
          {creditCycle ? (
            <dl className="adm-dl">
              <div><dt>This cycle</dt><dd>{shortDate(creditCycle.cycleStart)} → {shortDate(creditCycle.cycleEnd)}</dd></div>
              <div><dt>Allocated</dt><dd>{creditCycle.creditsAllocated}</dd></div>
              <div><dt>Used</dt><dd>{creditCycle.creditsUsed}</dd></div>
              <div><dt>Remaining</dt><dd><strong>{creditCycle.creditsRemaining}</strong></dd></div>
              <div><dt>Contacts unlocked (all time)</dt><dd>{unlockCount}</dd></div>
            </dl>
          ) : (
            <p className="adm-empty">No credits allocated.</p>
          )}
        </div>
      </div>

      <div className="adm-card" style={{ marginTop: '1rem' }}>
        <h2>Payment history</h2>
        {payments.length === 0 ? (
          <p className="adm-empty">No payment transactions recorded.</p>
        ) : (
          <div className="admin-table-container" style={{ border: 0 }}>
            <table className="admin-table">
              <thead><tr><th>Date</th><th>Plan</th><th>Amount</th><th>Status</th><th style={{ textAlign: 'right' }}>Gateway Reference</th></tr></thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p._id}>
                    <td>{dateTime(p.createdAt)}</td>
                    <td>{PLAN_LABEL[p.planCode] || (p.planCode === 'SIX_MONTHS' ? '6 months' : '3 months')}</td>
                    <td><strong>{rupees(p.amount)}</strong></td>
                    <td><StatusPill status={p.status} /></td>
                    <td style={{ textAlign: 'right' }}><code className="adm-code">{p.razorpayPaymentId || p.razorpayOrderId || '—'}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
