import React from 'react';
import {
  Siren,
  MapPin,
  Video,
  Clock,
  CheckCircle,
  Eye,
  X,
  Radio,
  AlertTriangle
} from 'lucide-react';
import type { AuthorityAlert } from '../types';

interface AuthorityAlertBannerProps {
  alert: AuthorityAlert | null;
  onViewIncident: (incidentId: string) => void;
  onAcknowledge: (alertId: string) => void;
  onDismiss: () => void;
}

export const AuthorityAlertBanner: React.FC<AuthorityAlertBannerProps> = ({
  alert,
  onViewIncident,
  onAcknowledge,
  onDismiss,
}) => {
  if (!alert) return null;

  const isAcknowledged = alert.status === 'ACKNOWLEDGED';
  const isCritical = alert.severity_label?.toLowerCase() === 'critical' || alert.severity_score >= 75;
  const isHigh = alert.severity_label?.toLowerCase() === 'high' || (alert.severity_score >= 50 && alert.severity_score < 75);

  const borderClass = isAcknowledged
    ? 'border-[var(--accent-success)] bg-[var(--accent-success-bg)]'
    : isCritical
    ? 'border-[var(--accent-emergency)] bg-[var(--accent-emergency-bg)]'
    : isHigh
    ? 'border-[var(--accent-warning)] bg-[var(--accent-warning-bg)]'
    : 'border-[var(--border-color)] bg-[var(--bg-surface)]';

  const badgeBg = isAcknowledged
    ? 'border-[var(--accent-success)] text-[var(--accent-success)] bg-[var(--bg-surface)]'
    : isCritical
    ? 'border-[var(--accent-emergency)] text-[var(--accent-emergency)] bg-[var(--bg-surface)]'
    : 'border-[var(--accent-warning)] text-[var(--accent-warning)] bg-[var(--bg-surface)]';

  const formatAuthority = (auth: string) => {
    if (auth.toLowerCase().includes('police') || auth.toLowerCase().includes('patrol')) {
      return { icon: '🚓', label: 'Highway Patrol' };
    }
    if (auth.toLowerCase().includes('medical') || auth.toLowerCase().includes('ems') || auth.toLowerCase().includes('trauma')) {
      return { icon: '🚑', label: 'EMS / Medical' };
    }
    if (auth.toLowerCase().includes('fire') || auth.toLowerCase().includes('rescue')) {
      return { icon: '🚒', label: 'Fire & Rescue' };
    }
    if (auth.toLowerCase().includes('towing') || auth.toLowerCase().includes('recovery')) {
      return { icon: '🚗', label: 'Towing & Recovery' };
    }
    return { icon: '🚨', label: auth };
  };

  const roadName = alert.road_name || alert.location?.road_name || alert.location?.name || 'Highway Corridor';

  return (
    <div className="w-full transition-all duration-300 animate-[fadeIn_0.3s_ease-in-out]">
      <div
        className={`border-2 ${borderClass} p-5 md:p-6 text-[var(--text-primary)] space-y-4`}
        role="alert"
        aria-live="assertive"
      >
        {/* Top Bulletin Header Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-color)] pb-3">
          <div className="flex items-center gap-3">
            <div className={`p-2 border ${badgeBg} flex items-center justify-center shrink-0`}>
              <Siren className="w-5 h-5" strokeWidth={1.5} />
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-mono font-bold text-xs tracking-widest uppercase flex items-center gap-1.5">
                  🚨 AUTHORITY EMERGENCY BULLETIN
                </span>
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 border uppercase tracking-wider ${badgeBg}`}>
                  {isAcknowledged ? 'STATUS / ACKNOWLEDGED' : 'STATUS / GENERATED'}
                </span>
              </div>
              <div className="text-[11px] font-mono text-[var(--text-muted)] mt-0.5">
                AUTONOMOUS HIGHWAY CCTV INCIDENT ORCHESTRATION PIPELINE
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 font-mono text-xs">
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-secondary)] flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-[var(--accent-warning)] animate-pulse" />
              {alert.badge || 'DISPATCH SIMULATED'}
            </span>
            <button
              onClick={onDismiss}
              className="p-1 border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition cursor-pointer"
              title="Dismiss Alert"
              aria-label="Dismiss Alert"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Editorial Incident Core Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          
          {/* Main Incident Details (8 cols) */}
          <div className="lg:col-span-8 space-y-3">
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="font-serif italic font-semibold text-2xl md:text-3xl text-[var(--text-primary)] capitalize">
                {alert.incident_type?.toLowerCase()}
              </span>
              <span className="font-sans font-bold text-lg md:text-xl tracking-wider uppercase text-[var(--text-primary)]">
                Accident Confirmed
              </span>
              <span className="font-mono text-xs px-2 py-0.5 border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-muted)] font-semibold">
                ID: {alert.incident_id}
              </span>
            </div>

            {/* Technical Metadata Matrix */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs">
              <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-2.5 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[var(--text-muted)] shrink-0" strokeWidth={1.5} />
                <div className="truncate">
                  <div className="text-[9px] uppercase tracking-wider text-[var(--text-muted)]">Location</div>
                  <div className="font-bold text-[var(--text-primary)] truncate" title={roadName}>
                    {roadName}
                  </div>
                </div>
              </div>

              <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-2.5 flex items-center gap-2">
                <Video className="w-4 h-4 text-[var(--text-muted)] shrink-0" strokeWidth={1.5} />
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-[var(--text-muted)]">Camera</div>
                  <div className="font-bold text-[var(--text-primary)]">{alert.camera_id}</div>
                </div>
              </div>

              <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-2.5 flex items-center gap-2">
                <AlertTriangle className={`w-4 h-4 shrink-0 ${isCritical ? 'text-[var(--accent-emergency)]' : 'text-[var(--accent-warning)]'}`} strokeWidth={1.5} />
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-[var(--text-muted)]">Severity</div>
                  <div className={`font-bold ${isCritical ? 'text-[var(--accent-emergency)]' : 'text-[var(--accent-warning)]'}`}>
                    {alert.severity_label?.toUpperCase()} • {alert.severity_score}/100
                  </div>
                </div>
              </div>

              <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-2.5 flex items-center gap-2">
                <Clock className="w-4 h-4 text-[var(--text-muted)] shrink-0" strokeWidth={1.5} />
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-[var(--text-muted)]">Timestamp</div>
                  <div className="font-bold text-[var(--text-primary)]">{alert.timestamp}</div>
                </div>
              </div>
            </div>

            {/* Response Units */}
            {alert.authorities && alert.authorities.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap pt-1 font-mono text-xs">
                <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">
                  UNITS DISPATCHED:
                </span>
                {alert.authorities.map((auth, idx) => {
                  const { icon, label } = formatAuthority(auth);
                  return (
                    <span
                      key={idx}
                      className="text-[11px] bg-[var(--bg-surface)] border border-[var(--border-color)] px-2.5 py-1 text-[var(--text-primary)] flex items-center gap-1.5"
                    >
                      <span>{icon}</span>
                      <span className="font-sans font-medium">{label}</span>
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {/* Action CTAs (4 cols) */}
          <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col gap-2.5 justify-center font-mono">
            <button
              onClick={() => onViewIncident(alert.incident_id)}
              className="flex-1 bg-[var(--text-primary)] hover:bg-[var(--text-secondary)] text-[var(--bg-primary)] font-bold py-3 px-5 border border-[var(--text-primary)] flex items-center justify-center gap-2 text-xs uppercase tracking-wider transition cursor-pointer"
            >
              <Eye className="w-4 h-4" />
              <span>VIEW INCIDENT DOSSIER</span>
            </button>

            {!isAcknowledged ? (
              <button
                onClick={() => onAcknowledge(alert.alert_id)}
                className="bg-[var(--bg-surface)] hover:bg-[var(--bg-subtle)] border border-[var(--border-color)] hover:border-[var(--text-primary)] text-[var(--text-primary)] font-bold py-2.5 px-4 flex items-center justify-center gap-2 text-xs uppercase tracking-wider transition cursor-pointer"
              >
                <CheckCircle className="w-4 h-4 text-[var(--accent-success)]" />
                <span>ACKNOWLEDGE ALERT</span>
              </button>
            ) : (
              <div className="bg-[var(--bg-surface)] border border-[var(--accent-success)] text-[var(--accent-success)] font-bold py-2.5 px-4 flex items-center justify-center gap-2 text-xs uppercase tracking-wider">
                <CheckCircle className="w-4 h-4" />
                <span>ACKNOWLEDGED BY OPERATOR</span>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};
