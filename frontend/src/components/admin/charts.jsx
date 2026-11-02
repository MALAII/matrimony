'use client';

import React, { useState } from 'react';

export const CHART_COLORS = ['#B85C78', '#A78345', '#49343B', '#15803d', '#CC6B88', '#8F757E'];

/** Smooth-ish area/line chart. data: [{label, value}] */
export function AreaChart({ data, height = 220, color = '#B85C78', format = (v) => v }) {
  const [hover, setHover] = useState(null);
  const W = 640;
  const pad = { l: 34, r: 12, t: 14, b: 26 };
  const max = Math.max(1, ...data.map((d) => d.value));
  const niceMax = max <= 4 ? 4 : Math.ceil(max / 4) * 4;
  const x = (i) => pad.l + (i * (W - pad.l - pad.r)) / Math.max(1, data.length - 1);
  const y = (v) => height - pad.b - (v / niceMax) * (height - pad.t - pad.b);
  const line = data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(' ');
  const area = `${line} L${x(data.length - 1)},${height - pad.b} L${x(0)},${height - pad.b} Z`;
  const ticks = [0, 1, 2, 3, 4].map((t) => (niceMax / 4) * t);
  const gid = `g${color.replace('#', '')}`;
  const step = Math.ceil(data.length / 6);

  return (
    <div className="adm-chart" style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${height}`} width="100%" role="img" aria-label="Trend chart"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          const i = Math.round(((px - pad.l) / (W - pad.l - pad.r)) * (data.length - 1));
          setHover(Math.min(data.length - 1, Math.max(0, i)));
        }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="#EBDADF" strokeDasharray={t ? '3 4' : '0'} />
            <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill="#8F757E">{Math.round(t)}</text>
          </g>
        ))}
        <path d={area} fill={`url(#${gid})`} />
        <path d={line} fill="none" stroke={color} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
        {data.map((d, i) => i % step === 0 && (
          <text key={i} x={x(i)} y={height - 8} textAnchor="middle" fontSize="10" fill="#8F757E">{d.label}</text>
        ))}
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={height - pad.b} stroke={color} strokeOpacity="0.4" />
            <circle cx={x(hover)} cy={y(data[hover].value)} r="5" fill="#fff" stroke={color} strokeWidth="2.5" />
          </g>
        )}
      </svg>
      {hover !== null && (
        <div className="adm-tip" style={{ left: `${(x(hover) / W) * 100}%` }}>
          <b>{format(data[hover].value)}</b>
          <span>{data[hover].full || data[hover].label}</span>
        </div>
      )}
    </div>
  );
}

/** Vertical bars. data: [{label, value, key?, full?}] */
export function BarChart({ data, height = 220, color = '#A78345', format = (v) => v }) {
  const [hover, setHover] = useState(null);
  const W = 640;
  const pad = { l: 40, r: 10, t: 14, b: 28 };
  const rawMax = Math.max(1, ...data.map((d) => d.value));
  const max = rawMax <= 4 ? 4 : Math.ceil(rawMax / 4) * 4;
  const bw = (W - pad.l - pad.r) / Math.max(1, data.length);
  const y = (v) => height - pad.b - (v / max) * (height - pad.t - pad.b);
  const step = data.length > 20 ? 5 : data.length > 10 ? 2 : 1;

  return (
    <div className="adm-chart" style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${height}`} width="100%" role="img" aria-label="Bar chart" onMouseLeave={() => setHover(null)}>
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(max * t)} y2={y(max * t)} stroke="#EBDADF" strokeDasharray={t ? '3 4' : '0'} />
            <text x={pad.l - 6} y={y(max * t) + 4} textAnchor="end" fontSize="10" fill="#8F757E">{format(Math.round(max * t))}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const h = height - pad.b - y(d.value);
          const showLabel =
            i % step === 0 || (i === data.length - 1 && data.length - 1 - (i - (i % step)) >= step * 0.75);
          return (
            <g key={d.key || `${d.label}-${i}`} onMouseEnter={() => setHover(i)}>
              {/* Full-column hit target so zero-value bars can also show hover tooltip */}
              <rect
                x={pad.l + i * bw}
                y={pad.t}
                width={bw}
                height={height - pad.t - pad.b}
                fill="transparent"
                style={{ cursor: 'pointer' }}
              />
              <rect
                x={pad.l + i * bw + bw * 0.18}
                y={y(d.value)}
                width={Math.max(2, bw * 0.64)}
                height={Math.max(h, d.value ? 2 : 0)}
                rx={Math.min(6, Math.max(2, bw * 0.25))}
                fill={color}
                opacity={hover === null || hover === i ? 1 : 0.45}
              />
              {showLabel && (
                <text x={pad.l + i * bw + bw / 2} y={height - 9} textAnchor="middle" fontSize="10" fill="#8F757E">
                  {d.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div
          className="adm-tip"
          style={{ left: `${Math.min(95, Math.max(5, ((pad.l + hover * bw + bw / 2) / W) * 100))}%` }}
        >
          <b>{format(data[hover].value)}</b>
          <span>{data[hover].full || data[hover].label}</span>
        </div>
      )}
    </div>
  );
}

/** Donut with centre total and legend. data: [{label, value, color?}] */
export function Donut({ data, size = 150, centerLabel = 'Total' }) {
  const total = data.reduce((a, d) => a + d.value, 0);
  const r = 54;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="adm-donut">
      <svg viewBox="0 0 140 140" width={size} height={size} role="img" aria-label={`${centerLabel} breakdown`}>
        <circle cx="70" cy="70" r={r} fill="none" stroke="#F2DDE3" strokeWidth="16" />
        {total > 0 && data.map((d, i) => {
          const len = (d.value / total) * c;
          const el = (
            <circle key={d.label} cx="70" cy="70" r={r} fill="none" stroke={d.color || CHART_COLORS[i % CHART_COLORS.length]}
              strokeWidth="16" strokeDasharray={`${Math.max(len - 2, 0)} ${c - Math.max(len - 2, 0)}`}
              strokeDashoffset={-offset} transform="rotate(-90 70 70)" />
          );
          offset += len;
          return el;
        })}
        <text x="70" y="68" textAnchor="middle" fontSize="24" fontWeight="800" fill="#49343B">{total}</text>
        <text x="70" y="86" textAnchor="middle" fontSize="10" fill="#8F757E">{centerLabel}</text>
      </svg>
      <ul>
        {data.map((d, i) => (
          <li key={d.label}>
            <i style={{ background: d.color || CHART_COLORS[i % CHART_COLORS.length] }} />
            <span>{d.label}</span>
            <b>{d.value}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Horizontal bars for ranked categories. data: [{label, value}] */
export function HBars({ data, color = '#B85C78' }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (data.length === 0) return <p className="adm-empty">No data yet.</p>;
  return (
    <ul className="adm-hbars">
      {data.map((d) => (
        <li key={d.label}>
          <div><span>{d.label}</span><b>{d.value}</b></div>
          <div className="adm-hbar-track"><div style={{ width: `${(d.value / max) * 100}%`, background: color }} /></div>
        </li>
      ))}
    </ul>
  );
}

/** Tiny inline trend line for KPI cards. */
export function Sparkline({ values, color = '#B85C78' }) {
  const max = Math.max(1, ...values);
  const W = 90;
  const H = 28;
  const pts = values.map((v, i) => `${(i * W) / Math.max(1, values.length - 1)},${H - 2 - (v / max) * (H - 4)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} preserveAspectRatio="none" aria-hidden="true">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
