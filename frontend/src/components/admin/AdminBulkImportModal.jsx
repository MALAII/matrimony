'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle2,
  X,
  Shield,
  FileText,
  Check,
} from 'lucide-react';
import {
  validateCandidateImportApi,
  commitCandidateImportApi,
  getCandidateImportTemplateUrl,
  getCandidateImportErrorsCsvUrl,
} from '@/lib/api';

/**
 * AdminBulkImportModal
 * 
 * 2-Phase Excel candidate import:
 * - Phase 1: Upload & Dry-Run Validation (detects duplicates & schema errors; 0 DB writes)
 * - Review: Displays validation statistics and downloadable CSV error report
 * - Phase 2: Chunked Execution (forces pending_approval, source='broker', user=null)
 */
export function AdminBulkImportModal({ isOpen, onClose, onImportCompleted }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [validationResult, setValidationResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const fileInputRef = useRef(null);

  // Reset state when modal opens or closes
  useEffect(() => {
    if (isOpen) {
      setSelectedFile(null);
      setValidationResult(null);
      setCommitResult(null);
      setErrorMessage('');
      setLoading(false);
      setCommitting(false);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !loading && !committing) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, loading, committing, onClose]);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const lower = file.name.toLowerCase();
      if (!lower.endsWith('.xlsx') && !lower.endsWith('.xls')) {
        setErrorMessage('Please select a valid Excel spreadsheet (.xlsx or .xls)');
        return;
      }
      if (file.size > 25 * 1024 * 1024) {
        setErrorMessage('File size exceeds the maximum limit of 25 MB');
        return;
      }
      setSelectedFile(file);
      setErrorMessage('');
      setValidationResult(null);
      setCommitResult(null);
    }
  };

  const handleValidate = async () => {
    if (!selectedFile) return;
    setLoading(true);
    setErrorMessage('');

    try {
      const res = await validateCandidateImportApi(selectedFile);
      if (res.success && res.data) {
        setValidationResult(res.data);
      } else {
        setErrorMessage(res.message || 'Spreadsheet validation failed.');
      }
    } catch (err) {
      setErrorMessage('Network connection error while validating spreadsheet.');
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!validationResult?.batchId) return;
    setCommitting(true);
    setErrorMessage('');

    try {
      const res = await commitCandidateImportApi(validationResult.batchId);
      if (res.success && res.data) {
        setCommitResult(res.data);
        if (onImportCompleted) {
          onImportCompleted(res.data.importedRows);
        }
      } else {
        setErrorMessage(res.message || 'Failed to complete candidate import.');
      }
    } catch (err) {
      setErrorMessage('Network connection error while executing import.');
    } finally {
      setCommitting(false);
    }
  };

  const stats = validationResult?.stats || {};
  const hasErrors = stats.duplicateRows > 0 || stats.invalidRows > 0;

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
        if (e.target === e.currentTarget && !loading && !committing) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="bulk-import-modal-title"
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '760px',
          boxShadow: '0 25px 50px -12px rgba(73, 52, 59, 0.35)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '92vh',
          border: '1px solid var(--border-color, #EBDADF)',
        }}
      >
        {/* Header */}
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
            <h2
              id="bulk-import-modal-title"
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
              <FileSpreadsheet size={20} color="#0284c7" /> Bulk Candidate Import (Excel)
            </h2>
            <p
              style={{
                margin: '0.25rem 0 0 0',
                fontSize: '0.85rem',
                color: 'var(--text-muted, #6E565E)',
              }}
            >
              Import broker-sourced candidate profiles with pre-flight dry-run validation.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading || committing}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: loading || committing ? 'not-allowed' : 'pointer',
              color: 'var(--text-muted, #6E565E)',
              padding: '0.25rem',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="Close bulk import modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div
            style={{
              padding: '0.75rem 1.25rem',
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#fef2f2',
              color: '#991b1b',
              borderBottom: '1px solid #fecaca',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertCircle size={16} color="var(--danger)" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', display: 'flex', alignItems: 'center' }}
              aria-label="Dismiss error"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Body Content */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
          {!commitResult ? (
            <>
              {/* Step 1: Upload File & Template Download */}
              {!validationResult && (
                <div>
                  {/* File Dropzone */}
                  <div
                    onClick={() => !loading && fileInputRef.current?.click()}
                    style={{
                      border: '2px dashed var(--border-color, #EBDADF)',
                      borderRadius: '12px',
                      padding: '2.5rem 1.5rem',
                      textAlign: 'center',
                      backgroundColor: 'var(--bg-primary, #FFF8F2)',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s ease',
                      marginBottom: '1.25rem',
                    }}
                  >
                    <div
                      style={{
                        width: '52px',
                        height: '52px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--primary-light, #F2DDE3)',
                        color: 'var(--primary, #A20D16)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 1rem auto',
                      }}
                    >
                      <FileSpreadsheet size={26} />
                    </div>
                    {selectedFile ? (
                      <div>
                        <strong style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-main, #49343B)', fontSize: '1rem' }}>
                          <FileText size={16} /> {selectedFile.name}
                        </strong>
                        <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted, #6E565E)', marginTop: '0.2rem' }}>
                          {(selectedFile.size / 1024).toFixed(1)} KB • Click to choose different file
                        </span>
                      </div>
                    ) : (
                      <div>
                        <strong style={{ display: 'block', color: 'var(--text-main, #49343B)', fontSize: '1rem', marginBottom: '0.3rem' }}>
                          Click to select Excel spreadsheet (.xlsx, .xls)
                        </strong>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted, #6E565E)' }}>
                          Supports up to 10,000 candidate rows (Max 25 MB)
                        </span>
                      </div>
                    )}
                  </div>

                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".xlsx,.xls"
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                  />

                  {/* Template & Guidelines Banner */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: '#ffffff',
                      border: '1px solid var(--border-color, #EBDADF)',
                      borderRadius: '10px',
                      padding: '0.85rem 1.25rem',
                      marginBottom: '1.25rem',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-main, #49343B)' }}>
                        Need the official Excel template?
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted, #6E565E)' }}>
                        Includes all 24 supported column headers with sample candidate rows.
                      </div>
                    </div>
                    <a
                      href={getCandidateImportTemplateUrl()}
                      download="broker_candidate_import_template.xlsx"
                      className="btn-secondary"
                      style={{
                        padding: '0.45rem 0.85rem',
                        fontSize: '0.8rem',
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                      }}
                    >
                      <Download size={14} /> Download Template
                    </a>
                  </div>

                  {/* Import Invariants Notice */}
                  <div
                    style={{
                      backgroundColor: 'var(--bg-primary, #FFF8F2)',
                      border: '1px solid var(--border-color, #EBDADF)',
                      borderRadius: '10px',
                      padding: '0.85rem 1.25rem',
                      fontSize: '0.82rem',
                      color: 'var(--text-muted, #6E565E)',
                      lineHeight: 1.5,
                    }}
                  >
                    <strong style={{ color: 'var(--text-main, #49343B)', display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.25rem' }}>
                      <Shield size={14} color="var(--primary)" /> Safety &amp; Business Rules:
                    </strong>
                    <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
                      <li><strong>Candidate Phone and Email</strong> are strictly mandatory for all imported rows.</li>
                      <li>Duplicates within the file or existing in the database are automatically skipped and reported.</li>
                      <li>Imported profiles start as <strong>Broker Origin</strong> and <strong>Pending Admin Approval</strong>.</li>
                      <li>Candidate login accounts are <strong>never</strong> created automatically during import.</li>
                      <li>Candidate photographs are managed separately via the <strong>Manage Photos</strong> interface (Max 3 photos).</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* Step 2: Dry-Run Validation Preview */}
              {validationResult && (
                <div>
                  <div style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-main, #49343B)' }}>
                        Validation Preview ({validationResult.fileName})
                      </h3>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted, #6E565E)' }}>
                        Batch ID: <code>{validationResult.batchId}</code> • 0 records written to database
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setValidationResult(null);
                        setSelectedFile(null);
                      }}
                      disabled={committing}
                      className="btn-reset"
                      style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                    >
                      ← Choose Another File
                    </button>
                  </div>

                  {/* Summary Metric Cards */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(4, 1fr)',
                      gap: '0.75rem',
                      marginBottom: '1.25rem',
                    }}
                  >
                    <div style={{ backgroundColor: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                      <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Total Rows</span>
                      <strong style={{ fontSize: '1.3rem', color: '#1e293b' }}>{stats.totalRows || 0}</strong>
                    </div>
                    <div style={{ backgroundColor: '#f0fdf4', padding: '0.75rem', borderRadius: '8px', border: '1px solid #bbf7d0', textAlign: 'center' }}>
                      <span style={{ fontSize: '0.75rem', color: '#166534', display: 'block' }}>Valid to Import</span>
                      <strong style={{ fontSize: '1.3rem', color: '#16a34a' }}>{stats.validRows || 0}</strong>
                    </div>
                    <div style={{ backgroundColor: '#fefce8', padding: '0.75rem', borderRadius: '8px', border: '1px solid #fef08a', textAlign: 'center' }}>
                      <span style={{ fontSize: '0.75rem', color: '#854d0e', display: 'block' }}>Duplicates (Skipped)</span>
                      <strong style={{ fontSize: '1.3rem', color: '#ca8a04' }}>{stats.duplicateRows || 0}</strong>
                    </div>
                    <div style={{ backgroundColor: '#fef2f2', padding: '0.75rem', borderRadius: '8px', border: '1px solid #fecaca', textAlign: 'center' }}>
                      <span style={{ fontSize: '0.75rem', color: '#991b1b', display: 'block' }}>Invalid Rows</span>
                      <strong style={{ fontSize: '1.3rem', color: '#dc2626' }}>{stats.invalidRows || 0}</strong>
                    </div>
                  </div>

                  {/* Error Report Download & Table */}
                  {hasErrors && (
                    <div style={{ marginBottom: '1.25rem' }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: '0.65rem',
                        }}
                      >
                        <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main, #49343B)' }}>
                          Skipped or Invalid Rows ({validationResult.totalErrors})
                        </span>
                        <a
                          href={getCandidateImportErrorsCsvUrl(validationResult.batchId)}
                          download={`import_errors_${validationResult.batchId}.csv`}
                          className="btn-secondary"
                          style={{
                            fontSize: '0.78rem',
                            padding: '0.35rem 0.75rem',
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            color: '#b91c1c',
                            borderColor: '#fca5a5',
                            backgroundColor: '#fff5f5',
                          }}
                        >
                          <Download size={13} /> Download Error Report (.csv)
                        </a>
                      </div>

                      {/* Preview Table of First Errors */}
                      <div
                        style={{
                          maxHeight: '220px',
                          overflowY: 'auto',
                          border: '1px solid #fee2e2',
                          borderRadius: '8px',
                          backgroundColor: '#ffffff',
                          fontSize: '0.8rem',
                        }}
                      >
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                          <thead style={{ backgroundColor: '#fef2f2', color: '#991b1b', position: 'sticky', top: 0 }}>
                            <tr>
                              <th style={{ padding: '0.5rem 0.65rem', width: '60px' }}>Row</th>
                              <th style={{ padding: '0.5rem 0.65rem' }}>Candidate</th>
                              <th style={{ padding: '0.5rem 0.65rem' }}>Contact</th>
                              <th style={{ padding: '0.5rem 0.65rem' }}>Reason(s)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {validationResult.errorsPreview?.map((err, idx) => (
                              <tr key={idx} style={{ borderBottom: '1px solid #fecaca' }}>
                                <td style={{ padding: '0.45rem 0.65rem', fontWeight: 600 }}>#{err.rowNumber}</td>
                                <td style={{ padding: '0.45rem 0.65rem' }}>{err.candidateName}</td>
                                <td style={{ padding: '0.45rem 0.65rem', color: '#64748b' }}>
                                  {err.candidatePhone || 'No Phone'}<br />
                                  {err.candidateEmail || 'No Email'}
                                </td>
                                <td style={{ padding: '0.45rem 0.65rem', color: '#b91c1c' }}>
                                  {(err.reasons || []).join('; ')}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            /* Step 3: Success Completion State */
            <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  backgroundColor: '#dcfce7',
                  color: '#166534',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1.25rem auto',
                }}
              >
                <CheckCircle2 size={36} color="#166534" />
              </div>
              <h3 style={{ fontSize: '1.3rem', color: 'var(--text-main, #49343B)', margin: '0 0 0.5rem 0' }}>
                Import Completed Successfully!
              </h3>
              <p style={{ fontSize: '0.92rem', color: 'var(--text-muted, #6E565E)', maxWidth: '480px', margin: '0 auto 1.5rem auto' }}>
                <strong>{commitResult.importedRows}</strong> broker candidate profiles were created in the database with status <strong>Pending Approval</strong>.
              </p>
              <div
                style={{
                  display: 'inline-block',
                  backgroundColor: 'var(--bg-primary, #FFF8F2)',
                  border: '1px solid var(--border-color, #EBDADF)',
                  borderRadius: '8px',
                  padding: '0.75rem 1.25rem',
                  fontSize: '0.85rem',
                  color: 'var(--text-muted, #6E565E)',
                  marginBottom: '1.5rem',
                }}
              >
                Batch Reference: <code>{commitResult.batchId}</code>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
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
          <div>
            {loading && <span style={{ fontSize: '0.85rem', color: 'var(--primary, #A20D16)' }}>Validating spreadsheet rows...</span>}
            {committing && <span style={{ fontSize: '0.85rem', color: 'var(--primary, #A20D16)' }}>Executing chunked database import...</span>}
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {!commitResult ? (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading || committing}
                  className="btn-secondary"
                  style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem' }}
                >
                  Cancel
                </button>

                {!validationResult ? (
                  <button
                    type="button"
                    onClick={handleValidate}
                    disabled={!selectedFile || loading}
                    className="btn-primary"
                    style={{
                      padding: '0.5rem 1.35rem',
                      fontSize: '0.85rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      opacity: !selectedFile || loading ? 0.6 : 1,
                      cursor: !selectedFile || loading ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {loading ? 'Validating...' : 'Validate Spreadsheet (Dry-Run) →'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleCommit}
                    disabled={!validationResult.canCommit || committing}
                    className="btn-primary"
                    style={{
                      padding: '0.5rem 1.35rem',
                      fontSize: '0.85rem',
                      backgroundColor: '#16a34a',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      opacity: !validationResult.canCommit || committing ? 0.6 : 1,
                      cursor: !validationResult.canCommit || committing ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {committing ? (
                      'Importing...'
                    ) : (
                      <>
                        <Check size={14} /> Import {stats.validRows} Candidates
                      </>
                    )}
                  </button>
                )}
              </>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="btn-primary"
                style={{ padding: '0.5rem 1.5rem', fontSize: '0.85rem' }}
              >
                Close &amp; View Profiles
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
