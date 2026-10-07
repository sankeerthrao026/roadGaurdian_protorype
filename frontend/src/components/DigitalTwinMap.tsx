import React from 'react';
import { MapPin, Navigation, Radio } from 'lucide-react';

interface DigitalTwinMapProps {
  cameraId: string;
  roadName: string;
  location?: { lat?: number; lon?: number; name?: string } | null;
  incidentLocation?: string | null;
}

export const DigitalTwinMap: React.FC<DigitalTwinMapProps> = ({
  cameraId,
  roadName,
  location,
  incidentLocation,
}) => {
  const lat = location?.lat ?? 37.7749;
  const lon = location?.lon ?? -122.4194;
  const latStr = `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? 'N' : 'S'}`;
  const lonStr = `${Math.abs(lon).toFixed(4)}° ${lon >= 0 ? 'E' : 'W'}`;

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] flex flex-col">
      
      {/* Editorial Header */}
      <div className="border-b border-[var(--border-color)] px-5 py-3 flex justify-between items-center font-mono text-xs">
        <div className="flex items-center gap-2 font-bold tracking-widest uppercase text-[var(--text-primary)]">
          <Navigation className="w-4 h-4 text-[var(--text-primary)]" strokeWidth={1.5} />
          <span>DIGITAL TWIN / GIS TELEMETRY</span>
        </div>
        <span className="flex items-center gap-1.5 text-[10px] text-[var(--accent-success)] font-bold uppercase tracking-wider">
          <Radio className="w-3 h-3 animate-pulse" /> LIVE TELEMETRY
        </span>
      </div>

      <div className="p-4 font-mono text-xs text-[var(--text-secondary)] space-y-3">
        
        {/* Node Metadata Matrix */}
        <div className="bg-[var(--bg-subtle)] border border-[var(--border-color)] p-3 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <MapPin className="w-4 h-4 text-[var(--text-muted)] shrink-0" strokeWidth={1.5} />
            <div>
              <div className="text-[9px] uppercase tracking-wider text-[var(--text-muted)]">Active Camera Node</div>
              <div className="text-[var(--text-primary)] font-bold">{cameraId} — {roadName}</div>
            </div>
          </div>
          <div className="text-[10px] bg-[var(--bg-surface)] border border-[var(--border-color)] px-2.5 py-1 text-[var(--text-primary)] font-bold">
            GPS: {latStr}, {lonStr}
          </div>
        </div>

        {/* Technical GIS Corridor Visualization */}
        <div className="relative bg-[#080808] border border-[var(--border-color)] h-36 flex items-center justify-center overflow-hidden">
          {/* Architectural Grid Background */}
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: 'linear-gradient(#444 1px, transparent 1px), linear-gradient(90deg, #444 1px, transparent 1px)',
              backgroundSize: '16px 16px',
            }}
          />
          
          {/* Radar Node Visualization */}
          <div className="w-28 h-28 border border-[#333333] flex items-center justify-center relative">
            <div className="w-16 h-16 border border-[#555555] animate-ping opacity-30" />
            <div className="w-2 h-2 bg-white absolute" />
          </div>

          <div className="absolute top-2.5 left-3 text-[10px] font-mono text-[#4EAD6B] flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-[#4EAD6B]" />
            <span>NODE: {location?.name || roadName}</span>
          </div>

          <div className="absolute bottom-2.5 left-3 text-[10px] font-mono text-[#888888] tracking-wider uppercase">
            CORRIDOR SENSORS ACTIVE {incidentLocation ? `• TARGET: ${incidentLocation}` : ''}
          </div>
        </div>

      </div>
    </div>
  );
};
