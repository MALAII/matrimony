'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera,
  Star,
  RotateCw,
  Trash2,
  X,
  AlertCircle,
  CheckCircle2,
  Phone,
  Info,
} from 'lucide-react';
import {
  getAdminCandidatePhotosApi,
  addAdminCandidatePhotoApi,
  replaceAdminCandidatePhotoApi,
  deleteAdminCandidatePhotoApi,
  setAdminCandidatePrimaryPhotoApi,
} from '@/lib/api';

const MAX_PHOTOS = 3;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

/**
 * AdminPhotoManagerModal
 * 
 * Manages up to 3 candidate photos for a profile:
 * - Direct upload for empty slots
 * - Replace existing photo
 * - Delete with confirmation and automatic primary promotion
 * - Set explicit primary photo
 * - Synchronizes with backend Cloudinary storage and MongoDB
 */
export function AdminPhotoManagerModal({ profile, isOpen, onClose, onPhotosUpdated }) {
  const [photos, setPhotos] = useState([]);
  const [primaryPhoto, setPrimaryPhoto] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeSlotAction, setActiveSlotAction] = useState(null); // 'upload', 'replace-photoId', 'delete-photoId'
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  // Hidden file inputs
  const addFileInputRef = useRef(null);
  const replaceFileInputRefs = useRef({});

  const candidateDisplayName =
    profile?.candidateName || profile?.user?.name || 'Candidate';

  // Load photos from API
  const loadPhotos = useCallback(async () => {
    if (!profile?._id) return;
    setLoading(true);
    setFeedback({ type: '', message: '' });

    try {
      const res = await getAdminCandidatePhotosApi(profile._id);
      if (res.success && res.data) {
        setPhotos(res.data.photos || []);
        setPrimaryPhoto(res.data.primaryPhoto || null);
      } else {
        setFeedback({
          type: 'error',
          message: res.message || 'Failed to load candidate photos.',
        });
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: 'Network error while loading photos.',
      });
    } finally {
      setLoading(false);
    }
  }, [profile?._id]);

  useEffect(() => {
    if (isOpen && profile?._id) {
      loadPhotos();
      setConfirmDeleteId(null);
    }
  }, [isOpen, profile?._id, loadPhotos]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !actionLoading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, actionLoading, onClose]);

  // Validates file client-side before sending to backend
  const validateFile = (file) => {
    if (!file) return 'No file selected.';
    if (!ALLOWED_MIME_TYPES.includes(file.type.toLowerCase())) {
      return `Invalid format (${file.type}). Only JPEG, PNG, and WebP are allowed.`;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      return `File size (${sizeMB} MB) exceeds the 5 MB limit.`;
    }
    return null;
  };

  // Upload new photo
  const handleAddPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input value so same file can be re-selected if needed
    e.target.value = '';

    const validationErr = validateFile(file);
    if (validationErr) {
      setFeedback({ type: 'error', message: validationErr });
      return;
    }

    setActionLoading(true);
    setActiveSlotAction('upload');
    setFeedback({ type: '', message: '' });

    try {
      const res = await addAdminCandidatePhotoApi(profile._id, file);
      if (res.success && res.data) {
        setPhotos(res.data.photos || []);
        setPrimaryPhoto(res.data.primaryPhoto || null);
        setFeedback({
          type: 'success',
          message: 'Photo uploaded successfully.',
        });
        if (onPhotosUpdated) {
          onPhotosUpdated(profile._id, res.data.primaryPhoto?.url, res.data.count);
        }
      } else {
        setFeedback({
          type: 'error',
          message: res.message || 'Failed to upload photo.',
        });
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: 'Network connection error during upload. Please retry.',
      });
    } finally {
      setActionLoading(false);
      setActiveSlotAction(null);
    }
  };

  // Replace existing photo
  const handleReplacePhoto = async (photoId, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const validationErr = validateFile(file);
    if (validationErr) {
      setFeedback({ type: 'error', message: validationErr });
      return;
    }

    setActionLoading(true);
    setActiveSlotAction(`replace-${photoId}`);
    setFeedback({ type: '', message: '' });

    try {
      const res = await replaceAdminCandidatePhotoApi(profile._id, photoId, file);
      if (res.success && res.data) {
        setPhotos(res.data.photos || []);
        setPrimaryPhoto(res.data.primaryPhoto || null);
        setFeedback({
          type: 'success',
          message: 'Photo replaced successfully.',
        });
        if (onPhotosUpdated) {
          onPhotosUpdated(profile._id, res.data.primaryPhoto?.url, res.data.photos?.length);
        }
      } else {
        setFeedback({
          type: 'error',
          message: res.message || 'Failed to replace photo.',
        });
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: 'Network error during photo replacement.',
      });
    } finally {
      setActionLoading(false);
      setActiveSlotAction(null);
    }
  };

  // Delete photo
  const handleDeletePhoto = async (photoId) => {
    setActionLoading(true);
    setActiveSlotAction(`delete-${photoId}`);
    setFeedback({ type: '', message: '' });
    setConfirmDeleteId(null);

    try {
      const res = await deleteAdminCandidatePhotoApi(profile._id, photoId);
      if (res.success && res.data) {
        setPhotos(res.data.photos || []);
        setPrimaryPhoto(res.data.primaryPhoto || null);
        setFeedback({
          type: 'success',
          message: 'Photo deleted successfully.',
        });
        if (onPhotosUpdated) {
          onPhotosUpdated(profile._id, res.data.primaryPhoto?.url, res.data.count);
        }
      } else {
        setFeedback({
          type: 'error',
          message: res.message || 'Failed to delete photo.',
        });
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: 'Network error during deletion.',
      });
    } finally {
      setActionLoading(false);
      setActiveSlotAction(null);
    }
  };

  // Set primary photo
  const handleSetPrimary = async (photoId) => {
    setActionLoading(true);
    setActiveSlotAction(`primary-${photoId}`);
    setFeedback({ type: '', message: '' });

    try {
      const res = await setAdminCandidatePrimaryPhotoApi(profile._id, photoId);
      if (res.success && res.data) {
        setPhotos(res.data.photos || []);
        setPrimaryPhoto(res.data.primaryPhoto || null);
        setFeedback({
          type: 'success',
          message: 'Primary photo updated.',
        });
        if (onPhotosUpdated) {
          onPhotosUpdated(profile._id, res.data.primaryPhoto?.url, res.data.photos?.length);
        }
      } else {
        setFeedback({
          type: 'error',
          message: res.message || 'Failed to update primary photo.',
        });
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: 'Network error while updating primary photo.',
      });
    } finally {
      setActionLoading(false);
      setActiveSlotAction(null);
    }
  };

  if (!isOpen) return null;

  const currentCount = photos.length;
  const canAddMore = currentCount < MAX_PHOTOS;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(35, 21, 26, 0.65)',
        backdropFilter: 'blur(3px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !actionLoading) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="photo-modal-title"
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '720px',
          boxShadow: '0 25px 50px -12px rgba(73, 52, 59, 0.35)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '92vh',
          border: '1px solid var(--border-color, #EBDADF)',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-color, #EBDADF)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-primary, #FFF8F2)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <h2
                id="photo-modal-title"
                style={{
                  margin: 0,
                  fontSize: '1.2rem',
                  fontWeight: 700,
                  color: 'var(--text-main, #49343B)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                }}
              >
                <Camera size={20} color="var(--primary, #A20D16)" /> Candidate Photo Gallery
              </h2>
              <span
                style={{
                  display: 'inline-block',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '999px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  backgroundColor: currentCount === 3 ? '#dcfce7' : '#fef3c7',
                  color: currentCount === 3 ? '#166534' : '#92400e',
                }}
              >
                {currentCount} / {MAX_PHOTOS} Photos
              </span>
            </div>
            <p
              style={{
                margin: '0.25rem 0 0 0',
                fontSize: '0.85rem',
                color: 'var(--text-muted, #6E565E)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                flexWrap: 'wrap',
              }}
            >
              <span>Candidate: <strong>{candidateDisplayName}</strong></span>
              {profile?.candidatePhone && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                  • <Phone size={12} /> {profile.candidatePhone}
                </span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={actionLoading}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: actionLoading ? 'not-allowed' : 'pointer',
              color: 'var(--text-muted, #6E565E)',
              padding: '0.25rem',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="Close photo manager"
          >
            <X size={20} />
          </button>
        </div>

        {/* Feedback Alert */}
        {feedback.message && (
          <div
            style={{
              padding: '0.75rem 1.25rem',
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: feedback.type === 'error' ? '#fef2f2' : '#f0fdf4',
              color: feedback.type === 'error' ? '#991b1b' : '#166534',
              borderBottom: `1px solid ${feedback.type === 'error' ? '#fecaca' : '#bbf7d0'}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {feedback.type === 'error' ? (
                <AlertCircle size={16} color="var(--danger)" />
              ) : (
                <CheckCircle2 size={16} color="#16a34a" />
              )}
              <span>{feedback.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedback({ type: '', message: '' })}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'inherit',
                display: 'flex',
                alignItems: 'center',
              }}
              aria-label="Dismiss feedback"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted, #6E565E)' }}>
              <div
                className="status-spinner"
                style={{
                  width: '32px',
                  height: '32px',
                  margin: '0 auto 1rem auto',
                  border: '3px solid #EBDADF',
                  borderTopColor: 'var(--primary, #A20D16)',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }}
              />
              <p style={{ margin: 0, fontSize: '0.9rem' }}>Loading candidate photos...</p>
            </div>
          ) : (
            <div>
              {/* Photo Grid (Strict 3 Slots) */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '1rem',
                  marginBottom: '1.5rem',
                }}
              >
                {[0, 1, 2].map((slotIndex) => {
                  const photo = photos[slotIndex];
                  const slotNumber = slotIndex + 1;
                  const isSlotActionInFlight =
                    actionLoading &&
                    (activeSlotAction === `replace-${photo?._id}` ||
                      activeSlotAction === `delete-${photo?._id}` ||
                      activeSlotAction === `primary-${photo?._id}`);

                  if (photo) {
                    const isPrimary = photo.isPrimary || primaryPhoto?.publicId === photo.publicId;
                    const isConfirmingDelete = confirmDeleteId === photo._id;

                    return (
                      <div
                        key={photo._id || slotIndex}
                        style={{
                          borderRadius: '12px',
                          border: isPrimary
                            ? '2px solid var(--accent, #A78345)'
                            : '1px solid var(--border-color, #EBDADF)',
                          overflow: 'hidden',
                          backgroundColor: '#ffffff',
                          display: 'flex',
                          flexDirection: 'column',
                          boxShadow: isPrimary
                            ? '0 4px 12px rgba(167, 131, 69, 0.2)'
                            : '0 2px 6px rgba(0,0,0,0.05)',
                          position: 'relative',
                        }}
                      >
                        {/* Slot Badge */}
                        <div
                          style={{
                            position: 'absolute',
                            top: '8px',
                            left: '8px',
                            backgroundColor: 'rgba(46, 29, 35, 0.8)',
                            color: '#ffffff',
                            padding: '0.15rem 0.45rem',
                            borderRadius: '4px',
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            zIndex: 2,
                          }}
                        >
                          Slot {slotNumber}
                        </div>

                        {/* Primary Badge */}
                        {isPrimary && (
                          <div
                            style={{
                              position: 'absolute',
                              top: '8px',
                              right: '8px',
                              backgroundColor: 'var(--accent, #A78345)',
                              color: '#ffffff',
                              padding: '0.2rem 0.5rem',
                              borderRadius: '4px',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              zIndex: 2,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                            }}
                          >
                            <Star size={11} fill="currentColor" /> Primary
                          </div>
                        )}

                        {/* Image Preview */}
                        <div
                          style={{
                            width: '100%',
                            height: '190px',
                            backgroundColor: '#f9f5f6',
                            position: 'relative',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={photo.url}
                            alt={`Candidate photo ${slotNumber}`}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                            }}
                          />

                          {/* Loading overlay for active slot */}
                          {isSlotActionInFlight && (
                            <div
                              style={{
                                position: 'absolute',
                                inset: 0,
                                backgroundColor: 'rgba(255, 255, 255, 0.75)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <div
                                style={{
                                  width: '24px',
                                  height: '24px',
                                  border: '3px solid #EBDADF',
                                  borderTopColor: 'var(--primary, #A20D16)',
                                  borderRadius: '50%',
                                  animation: 'spin 0.8s linear infinite',
                                }}
                              />
                            </div>
                          )}
                        </div>

                        {/* Slot Action Controls */}
                        <div
                          style={{
                            padding: '0.65rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.4rem',
                            backgroundColor: '#ffffff',
                            borderTop: '1px solid var(--border-color, #EBDADF)',
                          }}
                        >
                          {/* Primary Button */}
                          {!isPrimary && (
                            <button
                              type="button"
                              onClick={() => handleSetPrimary(photo._id)}
                              disabled={actionLoading}
                              style={{
                                padding: '0.35rem 0.5rem',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                borderRadius: '6px',
                                border: '1px solid var(--accent, #A78345)',
                                backgroundColor: 'var(--accent-light, #FDF6ED)',
                                color: 'var(--accent, #A78345)',
                                cursor: actionLoading ? 'not-allowed' : 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.25rem',
                              }}
                            >
                              <Star size={11} /> Set as Primary
                            </button>
                          )}

                          {/* Action Toolbar */}
                          <div style={{ display: 'flex', gap: '0.35rem' }}>
                            {/* Replace button */}
                            <button
                              type="button"
                              onClick={() => replaceFileInputRefs.current[photo._id]?.click()}
                              disabled={actionLoading}
                              style={{
                                flex: 1,
                                padding: '0.35rem 0.5rem',
                                fontSize: '0.75rem',
                                borderRadius: '6px',
                                border: '1px solid var(--border-color, #EBDADF)',
                                backgroundColor: '#ffffff',
                                color: 'var(--text-main, #49343B)',
                                cursor: actionLoading ? 'not-allowed' : 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.25rem',
                              }}
                              title="Replace with another image"
                            >
                              <RotateCw size={11} /> Replace
                            </button>
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              style={{ display: 'none' }}
                              ref={(el) => {
                                replaceFileInputRefs.current[photo._id] = el;
                              }}
                              onChange={(e) => handleReplacePhoto(photo._id, e)}
                            />

                            {/* Delete button */}
                            {!isConfirmingDelete ? (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(photo._id)}
                                disabled={actionLoading}
                                style={{
                                  padding: '0.35rem 0.5rem',
                                  fontSize: '0.75rem',
                                  borderRadius: '6px',
                                  border: '1px solid #fecaca',
                                  backgroundColor: '#fef2f2',
                                  color: '#dc2626',
                                  cursor: actionLoading ? 'not-allowed' : 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                                title="Delete this photo"
                              >
                                <Trash2 size={13} />
                              </button>
                            ) : (
                              <div
                                style={{
                                  display: 'flex',
                                  gap: '0.25rem',
                                  width: '100%',
                                }}
                              >
                                <button
                                  type="button"
                                  onClick={() => handleDeletePhoto(photo._id)}
                                  disabled={actionLoading}
                                  style={{
                                    flex: 1,
                                    padding: '0.35rem',
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    borderRadius: '6px',
                                    border: 'none',
                                    backgroundColor: '#dc2626',
                                    color: '#ffffff',
                                    cursor: 'pointer',
                                  }}
                                >
                                  Confirm?
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(null)}
                                  style={{
                                    padding: '0.35rem 0.5rem',
                                    fontSize: '0.7rem',
                                    borderRadius: '6px',
                                    border: '1px solid #d1d5db',
                                    backgroundColor: '#f3f4f6',
                                    color: '#4b5563',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                  aria-label="Cancel delete"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // Empty Slot
                  const isThisSlotUploading =
                    actionLoading && activeSlotAction === 'upload' && slotIndex === currentCount;

                  return (
                    <div
                      key={`empty-${slotIndex}`}
                      onClick={() => {
                        if (canAddMore && !actionLoading) {
                          addFileInputRef.current?.click();
                        }
                      }}
                      style={{
                        borderRadius: '12px',
                        border: '2px dashed var(--border-color, #EBDADF)',
                        backgroundColor: 'var(--bg-primary, #FFF8F2)',
                        minHeight: '260px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: canAddMore && !actionLoading ? 'pointer' : 'default',
                        padding: '1rem',
                        textAlign: 'center',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {isThisSlotUploading ? (
                        <div>
                          <div
                            style={{
                              width: '28px',
                              height: '28px',
                              border: '3px solid #EBDADF',
                              borderTopColor: 'var(--primary, #A20D16)',
                              borderRadius: '50%',
                              animation: 'spin 0.8s linear infinite',
                              margin: '0 auto 0.75rem auto',
                            }}
                          />
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted, #6E565E)' }}>
                            Uploading to Cloudinary...
                          </span>
                        </div>
                      ) : (
                        <>
                          <div
                            style={{
                              width: '44px',
                              height: '44px',
                              borderRadius: '50%',
                              backgroundColor: 'var(--primary-light, #F2DDE3)',
                              color: 'var(--primary, #A20D16)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '1.4rem',
                              marginBottom: '0.75rem',
                            }}
                          >
                            +
                          </div>
                          <strong
                            style={{
                              display: 'block',
                              fontSize: '0.85rem',
                              color: 'var(--text-main, #49343B)',
                              marginBottom: '0.2rem',
                            }}
                          >
                            Slot {slotNumber} (Empty)
                          </strong>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              color: 'var(--text-muted, #6E565E)',
                              maxWidth: '140px',
                            }}
                          >
                            Click to upload photo
                          </span>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Hidden Global Add File Input */}
              <input
                type="file"
                ref={addFileInputRef}
                accept="image/jpeg,image/png,image/webp"
                style={{ display: 'none' }}
                onChange={handleAddPhoto}
              />

              {/* Informational Guidance Footer */}
              <div
                style={{
                  backgroundColor: 'var(--bg-primary, #FFF8F2)',
                  border: '1px solid var(--border-color, #EBDADF)',
                  borderRadius: '10px',
                  padding: '0.85rem 1rem',
                  fontSize: '0.8rem',
                  color: 'var(--text-muted, #6E565E)',
                  lineHeight: 1.5,
                }}
              >
                <div style={{ fontWeight: 600, color: 'var(--text-main, #49343B)', marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Info size={14} color="var(--primary, #A20D16)" /> Photo Guidelines &amp; Rules:
                </div>
                <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                  <li>Strict maximum of <strong>3 photos</strong> per candidate profile.</li>
                  <li>The <strong>first uploaded photo</strong> automatically becomes the primary photo displayed in the public member directory.</li>
                  <li>Deleting the primary photo will automatically promote another remaining photo.</li>
                  <li>Supported formats: <strong>JPEG, PNG, WebP</strong> up to <strong>5 MB</strong>.</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--border-color, #EBDADF)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#ffffff',
          }}
        >
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted, #6E565E)' }}>
            {currentCount === 0 && 'No photos uploaded yet.'}
            {currentCount > 0 && currentCount < 3 && `${3 - currentCount} more photo slot(s) available.`}
            {currentCount === 3 && 'All 3 photo slots filled.'}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={actionLoading}
              className="btn-secondary"
              style={{
                padding: '0.5rem 1.25rem',
                fontSize: '0.85rem',
              }}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
