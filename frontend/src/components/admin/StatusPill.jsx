import React from 'react';
import { toneOf } from './adminFormat';

export function StatusPill({ status }) {
  return <span className={`adm-pill ${toneOf(status)}`}>{String(status || '—').replace(/_/g, ' ')}</span>;
}
