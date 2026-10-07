import React from 'react';

interface ShapChartProps {
  shapValues: Record<string, number>;
}

const FRIENDLY_NAMES: Record<string, string> = {
  vehicle_count: 'Vehicle Density / Count',
  person_on_road: 'Pedestrian on Roadway',
  fire_smoke: 'Fire & Smoke Detection',
  rollover: 'Vehicle Rollover Geometry',
  traffic_impact: 'Corridor Traffic Impact',
};

export const ShapChart: React.FC<ShapChartProps> = ({ shapValues }) => {
  const entries = Object.entries(shapValues);
  if (!entries.length) return null;

  const maxAbs = Math.max(...entries.map(([, v]) => Math.abs(v)), 0.01);

  return (
    <div className="w-full space-y-3 font-mono">
      <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2 border-b border-[var(--border-color)] pb-1.5">
        SHAP Feature Attribution (TreeExplainer)
      </div>
      {entries.map(([feat, val]) => {
        const isPositive = val >= 0;
        const pct = Math.min(Math.abs(val) / maxAbs, 1) * 100;
        const color = isPositive ? 'var(--accent-warning)' : 'var(--accent-success)';
        const label = FRIENDLY_NAMES[feat] ?? feat.replace(/_/g, ' ');

        return (
          <div key={feat} className="text-xs">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[var(--text-secondary)] capitalize font-sans text-xs">{label}</span>
              <span
                className="font-bold text-[11px]"
                style={{ color }}
              >
                {val > 0 ? `+${val.toFixed(2)}` : val.toFixed(2)}
              </span>
            </div>
            {/* Bar track */}
            <div className="w-full bg-[var(--bg-subtle)] h-1.5 border border-[var(--border-color)] overflow-hidden">
              <div
                className="h-full transition-all duration-500"
                style={{ width: `${pct}%`, backgroundColor: color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
