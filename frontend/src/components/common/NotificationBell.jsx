'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  Check,
  CheckCheck,
  CalendarClock,
  AlertCircle,
  ShieldAlert,
  Sparkles,
  ArrowRight,
  RefreshCw,
  X,
} from 'lucide-react';
import {
  getNotificationsApi,
  getNotificationsUnreadCountApi,
  markNotificationReadApi,
  markAllNotificationsReadApi,
} from '@/lib/api';

/** Formats ISO timestamp to human-friendly relative time */
function formatTimeAgo(isoDate) {
  if (!isoDate) return '';
  const date = new Date(isoDate);
  const now = new Date();
  const diffSec = Math.floor((now - date) / 1000);

  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Resolves an icon based on notification type */
function getNotificationIcon(type) {
  switch (type) {
    case 'subscription_expiry_reminder':
      return <CalendarClock size={16} color="#D99A24" />;
    case 'subscription_expired':
      return <ShieldAlert size={16} color="#A20D16" />;
    case 'payment_failed':
      return <AlertCircle size={16} color="#A20D16" />;
    case 'admin_subscription_expiry_digest':
      return <Sparkles size={16} color="#D99A24" />;
    default:
      return <Bell size={16} color="var(--a-muted, #6B5555)" />;
  }
}

/**
 * Reusable in-website notification bell component.
 * Supports independent 'user' and 'admin' notification feeds.
 *
 * @param {object} props
 * @param {'user'|'admin'} [props.feed='user']
 */
export function NotificationBell({ feed = 'user' }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'unread'
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [actionError, setActionError] = useState('');
  const [error, setError] = useState('');
  const containerRef = useRef(null);

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await getNotificationsUnreadCountApi(feed);
      if (res.success && res.data && typeof res.data.unreadCount === 'number') {
        setUnreadCount(res.data.unreadCount);
      }
    } catch {
      // Keep existing unread count on background network failure
    }
  }, [feed]);

  // Fetch paginated notification list when popover is open
  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError('');
    setActionError('');
    try {
      const res = await getNotificationsApi(feed, { page: 1, limit: 20 });
      if (res.success && res.data && Array.isArray(res.data.notifications)) {
        setNotifications(res.data.notifications);
        if (res.data.pagination && typeof res.data.pagination.unreadCount === 'number') {
          setUnreadCount(res.data.pagination.unreadCount);
        }
      } else {
        setError(res.message || 'Could not load notifications.');
      }
    } catch {
      setError('Network error loading notifications.');
    } finally {
      setLoading(false);
    }
  }, [feed]);

  // Initial unread count fetch and periodic polling (every 60s)
  useEffect(() => {
    let alive = true;
    fetchUnreadCount();

    const intervalId = setInterval(() => {
      if (alive) fetchUnreadCount();
    }, 60000);

    const handleFocus = () => {
      if (alive) fetchUnreadCount();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      alive = false;
      clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchUnreadCount]);

  // Load notifications whenever popover opens
  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen, fetchNotifications]);

  // Click-outside listener & escape key to dismiss
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Handle Mark All as Read with rollback on failure
  const handleMarkAllRead = async () => {
    if (unreadCount === 0 || markingAll) return;
    setMarkingAll(true);
    setActionError('');

    // Snapshot prior state for rollback on error
    const previousNotifications = notifications;
    const previousUnreadCount = unreadCount;

    // Optimistic update
    setUnreadCount(0);
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() }))
    );

    try {
      const res = await markAllNotificationsReadApi(feed);
      if (!res.success) {
        // Rollback state on API failure
        setNotifications(previousNotifications);
        setUnreadCount(previousUnreadCount);
        setActionError(res.message || 'Failed to mark all as read.');
      }
    } catch {
      setNotifications(previousNotifications);
      setUnreadCount(previousUnreadCount);
      setActionError('Network error while marking all as read.');
    } finally {
      setMarkingAll(false);
    }
  };

  // Handle marking a single notification as read WITHOUT navigating
  const handleMarkSingleAsRead = async (notificationId, e) => {
    if (e && typeof e.stopPropagation === 'function') {
      e.stopPropagation();
    }
    setActionError('');

    const target = notifications.find((n) => n._id === notificationId);
    if (!target || target.isRead) return;

    // Snapshot previous state
    const previousNotifications = notifications;
    const previousUnreadCount = unreadCount;

    // Optimistically update
    setNotifications((prev) =>
      prev.map((n) => (n._id === notificationId ? { ...n, isRead: true, readAt: new Date().toISOString() } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    try {
      const res = await markNotificationReadApi(feed, notificationId);
      if (!res.success) {
        // Rollback
        setNotifications(previousNotifications);
        setUnreadCount(previousUnreadCount);
        setActionError(res.message || 'Failed to update read status.');
      }
    } catch {
      setNotifications(previousNotifications);
      setUnreadCount(previousUnreadCount);
      setActionError('Network error updating read status.');
    }
  };

  // Handle clicking a notification item: marks as read AND navigates to destination
  const handleNotificationClick = async (notification) => {
    if (!notification) return;

    if (!notification.isRead) {
      // Optimistically update state
      setNotifications((prev) =>
        prev.map((n) => (n._id === notification._id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      // Await database update before navigation
      try {
        await markNotificationReadApi(feed, notification._id);
      } catch {
        // Continue navigation if link present even if mark-as-read encounters network error
      }
    }

    setIsOpen(false);

    // Navigate to notification destination link if specified
    if (notification.link) {
      router.push(notification.link);
    }
  };

  // Filtered notifications based on active tab
  const displayedNotifications =
    activeTab === 'unread'
      ? notifications.filter((n) => !n.isRead)
      : notifications;

  const badgeText = unreadCount > 99 ? '99+' : unreadCount;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
      }}
    >
      {/* Trigger Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications'}
        aria-expanded={isOpen}
        aria-haspopup="true"
        style={{
          position: 'relative',
          background: 'none',
          border: '1px solid var(--a-line, #EBDADF)',
          borderRadius: '10px',
          padding: '0.45rem',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--a-text, #142D28)',
          backgroundColor: isOpen ? 'var(--a-brand-soft, #FAF5F7)' : 'transparent',
          transition: 'all 0.15s ease',
        }}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '-5px',
              right: '-5px',
              backgroundColor: '#b91c1c',
              color: '#ffffff',
              fontSize: '0.68rem',
              fontWeight: '700',
              lineHeight: 1,
              padding: '2px 5px',
              borderRadius: '999px',
              minWidth: '16px',
              textAlign: 'center',
              boxShadow: '0 0 0 2px #ffffff',
            }}
          >
            {badgeText}
          </span>
        )}
      </button>

      {/* Notifications Dropdown Panel */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Notifications popover"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: '360px',
            maxWidth: '92vw',
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.14), 0 8px 10px -6px rgba(0, 0, 0, 0.08)',
            border: '1px solid var(--a-line, #EBDADF)',
            zIndex: 1000,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Popover Header */}
          <div
            style={{
              padding: '0.75rem 0.95rem 0.5rem',
              borderBottom: '1px solid var(--a-line, #EBDADF)',
              backgroundColor: 'var(--a-card, #FDFBF7)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '0.5rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <strong style={{ fontSize: '0.92rem', color: 'var(--a-text, #142D28)' }}>
                  Notifications
                </strong>
                {unreadCount > 0 && (
                  <span
                    style={{
                      fontSize: '0.72rem',
                      backgroundColor: '#FEF2F2',
                      color: '#b91c1c',
                      fontWeight: 700,
                      padding: '1px 7px',
                      borderRadius: '99px',
                      border: '1px solid #FECACA',
                    }}
                  >
                    {unreadCount} unread
                  </span>
                )}
              </div>

              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  disabled={markingAll}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '0.75rem',
                    color: '#A20D16',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    padding: '3px 6px',
                    borderRadius: '4px',
                  }}
                  title="Mark all notifications as read"
                >
                  <CheckCheck size={14} />
                  <span>{markingAll ? 'Updating...' : 'Mark all read'}</span>
                </button>
              )}
            </div>

            {/* Filter Tabs (All vs Unread) */}
            <div
              style={{
                display: 'flex',
                gap: '0.4rem',
                borderTop: '1px solid #f1f5f9',
                paddingTop: '0.45rem',
              }}
            >
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                style={{
                  background: activeTab === 'all' ? 'var(--a-brand, #A20D16)' : 'transparent',
                  color: activeTab === 'all' ? '#ffffff' : 'var(--a-muted, #64748b)',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '3px 9px',
                  fontSize: '0.74rem',
                  fontWeight: activeTab === 'all' ? 600 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                All ({notifications.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('unread')}
                style={{
                  background: activeTab === 'unread' ? 'var(--a-brand, #A20D16)' : 'transparent',
                  color: activeTab === 'unread' ? '#ffffff' : 'var(--a-muted, #64748b)',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '3px 9px',
                  fontSize: '0.74rem',
                  fontWeight: activeTab === 'unread' ? 600 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                Unread ({unreadCount})
              </button>
            </div>
          </div>

          {/* Action Error Banner if update fails */}
          {actionError && (
            <div
              style={{
                backgroundColor: '#FEF2F2',
                color: '#b91c1c',
                padding: '0.4rem 0.95rem',
                fontSize: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid #FECACA',
              }}
            >
              <span>{actionError}</span>
              <button
                type="button"
                onClick={() => setActionError('')}
                style={{ background: 'none', border: 'none', color: '#b91c1c', cursor: 'pointer' }}
              >
                <X size={12} />
              </button>
            </div>
          )}

          {/* Popover Notification List */}
          <div
            style={{
              maxHeight: '380px',
              overflowY: 'auto',
              overscrollBehavior: 'contain',
            }}
          >
            {loading ? (
              <div
                style={{
                  padding: '2.5rem 1rem',
                  textAlign: 'center',
                  color: 'var(--a-muted, #8F757E)',
                  fontSize: '0.85rem',
                }}
              >
                <div className="status-spinner" style={{ margin: '0 auto 0.5rem' }}></div>
                Loading notifications...
              </div>
            ) : error ? (
              <div
                style={{
                  padding: '1.5rem 1rem',
                  textAlign: 'center',
                  color: '#b91c1c',
                  fontSize: '0.82rem',
                }}
              >
                <p style={{ margin: '0 0 0.5rem' }}>{error}</p>
                <button
                  type="button"
                  onClick={fetchNotifications}
                  style={{
                    background: 'none',
                    border: '1px solid #b91c1c',
                    color: '#b91c1c',
                    fontSize: '0.75rem',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                  }}
                >
                  <RefreshCw size={12} /> Retry
                </button>
              </div>
            ) : displayedNotifications.length === 0 ? (
              <div
                style={{
                  padding: '2.5rem 1rem',
                  textAlign: 'center',
                  color: 'var(--a-muted, #8F757E)',
                  fontSize: '0.85rem',
                }}
              >
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--a-brand-soft, #FAF5F7)',
                    display: 'grid',
                    placeItems: 'center',
                    margin: '0 auto 0.5rem',
                    color: '#A20D16',
                  }}
                >
                  <Bell size={18} />
                </div>
                <strong>{activeTab === 'unread' ? 'No unread notifications' : 'All caught up!'}</strong>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.78rem' }}>
                  {activeTab === 'unread'
                    ? 'You have read all your notifications.'
                    : 'You have no notifications right now.'}
                </p>
              </div>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {displayedNotifications.map((item) => {
                  const isUnread = !item.isRead;

                  return (
                    <li
                      key={item._id}
                      onClick={() => handleNotificationClick(item)}
                      style={{
                        padding: '0.75rem 0.95rem',
                        borderBottom: '1px solid #f1f5f9',
                        borderLeft: isUnread ? '4px solid #A78345' : '4px solid transparent',
                        backgroundColor: isUnread ? '#FDFBF7' : '#ffffff',
                        cursor: item.link ? 'pointer' : 'default',
                        transition: 'background-color 0.15s ease',
                        display: 'flex',
                        gap: '0.65rem',
                        alignItems: 'flex-start',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = isUnread ? '#F7F3EB' : '#f8fafc';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = isUnread ? '#FDFBF7' : '#ffffff';
                      }}
                    >
                      {/* Notification Type Icon */}
                      <div
                        style={{
                          padding: '0.35rem',
                          borderRadius: '8px',
                          backgroundColor: isUnread ? '#FAF5F7' : '#f1f5f9',
                          border: `1px solid ${isUnread ? '#EBDADF' : '#e2e8f0'}`,
                          flexShrink: 0,
                          marginTop: '2px',
                        }}
                      >
                        {getNotificationIcon(item.type)}
                      </div>

                      {/* Notification Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '0.5rem',
                            marginBottom: '0.15rem',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', minWidth: 0 }}>
                            <strong
                              style={{
                                fontSize: '0.82rem',
                                color: isUnread ? '#0f172a' : '#64748b',
                                fontWeight: isUnread ? 700 : 500,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {item.title}
                            </strong>
                            {isUnread && (
                              <span
                                style={{
                                  fontSize: '0.62rem',
                                  backgroundColor: '#A78345',
                                  color: '#ffffff',
                                  padding: '1px 5px',
                                  borderRadius: '999px',
                                  fontWeight: 700,
                                  lineHeight: 1.2,
                                  flexShrink: 0,
                                }}
                              >
                                NEW
                              </span>
                            )}
                          </div>
                          <span
                            style={{
                              fontSize: '0.7rem',
                              color: isUnread ? '#A20D16' : '#94a3b8',
                              fontWeight: isUnread ? 600 : 400,
                              flexShrink: 0,
                            }}
                          >
                            {formatTimeAgo(item.createdAt)}
                          </span>
                        </div>
                        <p
                          style={{
                            margin: 0,
                            fontSize: '0.78rem',
                            color: isUnread ? '#334155' : '#94a3b8',
                            lineHeight: 1.35,
                            wordBreak: 'break-word',
                          }}
                        >
                          {item.message}
                        </p>
                      </div>

                      {/* Actions Column (Mark Read button or status tag) */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          flexShrink: 0,
                          marginTop: '4px',
                        }}
                      >
                        {isUnread ? (
                          <button
                            type="button"
                            onClick={(e) => handleMarkSingleAsRead(item._id, e)}
                            style={{
                              backgroundColor: '#ffffff',
                              border: '1px solid #EBDADF',
                              borderRadius: '6px',
                              padding: '3px 6px',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.2rem',
                              fontSize: '0.7rem',
                              color: '#A20D16',
                              fontWeight: 600,
                            }}
                            title="Mark as read without navigating"
                            aria-label={`Mark "${item.title}" as read`}
                          >
                            <Check size={12} />
                            <span>Read</span>
                          </button>
                        ) : (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.2rem',
                              fontSize: '0.68rem',
                              color: '#94a3b8',
                            }}
                            title="Read notification"
                          >
                            <CheckCheck size={13} color="#94a3b8" />
                          </span>
                        )}

                        {/* Navigation link arrow indicator */}
                        {item.link && (
                          <ArrowRight
                            size={12}
                            color={isUnread ? '#A20D16' : '#cbd5e1'}
                            style={{ flexShrink: 0 }}
                          />
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
