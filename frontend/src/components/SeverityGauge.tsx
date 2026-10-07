import React from 'react';

interface SeverityGaugeProps {
  score: number;
  label: string;
}

function getSeverityColor(label: string): string {
  switch (label?.toLowerCase()) {
    case 'critical': return '#C93B2B';
    case 'high': return '#B86B35';
    case 'medium': return '#B86B35';
    default: return '#256E3B';
  }
}

export const SeverityGauge: React.FC<SeverityGaugeProps> = ({ score, label }) => {
  const color = getSeverityColor(label);
  const clampedScore = Math.max(0, Math.min(100, score));

  // SVG arc gauge: 180° arc from left to right
  const cx = 80;
  const cy = 75;
  const r = 56;
  const startAngle = 180; // degrees
  const totalArc = 180;   // degrees sweep

  function polarToCartesian(angle: number) {
    const rad = (angle * Math.PI) / 180;
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad),
    };
  }

  function describeArc(startDeg: number, endDeg: number) {
    const s = polarToCartesian(startDeg);
    const e = polarToCartesian(endDeg);
    const largeArc = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${largeArc} 1 ${e.x} ${e.y}`;
  }

  const fillEndAngle = startAngle + (clampedScore / 100) * totalArc;
  const trackPath = describeArc(startAngle, startAngle + totalArc);
  const fillPath = clampedScore > 0 ? describeArc(startAngle, fillEndAngle) : null;

  return (
    <div className="flex flex-col items-center justify-center gap-2 p-2">
      <svg width="160" height="90" viewBox="0 0 160 90">
        {/* Background track */}
        <path
          d={trackPath}
          fill="none"
          stroke="var(--border-color)"
          strokeWidth="10"
          strokeLinecap="round"
        />
        {/* Color fill */}
        {fillPath && (
          <path
            d={fillPath}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
          />
        )}
        {/* Center score text */}
        <text
          x={cx}
          y={cy - 2}
          textAnchor="middle"
          fill="var(--text-primary)"
          fontSize="22"
          fontFamily="JetBrains Mono, monospace"
          fontWeight="700"
        >
          {clampedScore}
        </text>
        <text
          x={cx}
          y={cy + 14}
          textAnchor="middle"
          fill="var(--text-muted)"
          fontSize="10"
          fontFamily="JetBrains Mono, monospace"
        >
          / 100
        </text>
      </svg>
      <div
        className="font-mono text-[11px] font-bold px-3 py-1 border uppercase tracking-wider"
        style={{ color, borderColor: color, background: 'var(--bg-subtle)' }}
      >
        {label?.toUpperCase() || 'HIGH'} SEVERITY
      </div>
    </div>
  );
};
