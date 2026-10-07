import React from 'react';
import { MapPin, ChevronRight, Flame, RotateCw, Car, ShieldAlert, CheckCircle, Eye } from 'lucide-react';
import type { Incident } from '../types';

interface PriorityListProps {
  incidents: Incident[];
  selectedIncidentId: string | null;
  onSelectIncident: (incident: Incident) => void;
  processingState: string;
}

export const PriorityList: React.FC<PriorityListProps> = ({
  incidents,
  selectedIncidentId,
  onSelectIncident,
  processingState,
}) => {
  const getSeverityStyle = (label?: string) => {
    switch (label?.toLowerCase()) {
      case 'critical':
      case 'high':
        return 'text-[var(--accent-emergency)] border-[var(--accent-emergency)] bg-[var(--accent-emergency-bg)]';
      case 'medium':
        return 'text-[var(--accent-warning)] border-[var(--accent-warning)] bg-[var(--accent-warning-bg)]';
      default:
        return 'text-[var(--accent-success)] border-[var(--accent-success)] bg-[var(--accent-success-bg)]';
    }
  };

  const getIcon = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes('fire')) return <Flame className="w-3.5 h-3.5 text-[var(--accent-emergency)]" strokeWidth={1.5} />;
    if (t.includes('rollover')) return <RotateCw className="w-3.5 h-3.5 text-[var(--accent-warning)]" strokeWidth={1.5} />;
    return <Car className="w-3.5 h-3.5 text-[var(--text-muted)]" strokeWidth={1.5} />;
  };

  const emptyContent = () => {
    if (processingState === 'COMPLETE') {
      return (
        <div className="p-6 text-center font-mono text-xs border border-[var(--border-color)] bg-[var(--bg-subtle)] space-y-2">
          <CheckCircle className="w-5 h-5 mx-auto text-[var(--accent-success)]" strokeWidth={1.5} />
          <p className="text-[var(--text-primary)] font-bold tracking-wider uppercase">NO ACTIVE INCIDENT</p>
          <p className="text-[var(--text-muted)] text-[11px] leading-relaxed">
            All analysis stages completed below alert thresholds.
          </p>
        </div>
      );
    }
    if (processingState === 'FINAL_ANALYSIS') {
      return (
        <div className="p-6 text-center font-mono text-xs border border-[var(--accent-warning)] bg-[var(--accent-warning-bg)] space-y-2">
          <RotateCw className="w-5 h-5 mx-auto text-[var(--accent-warning)] animate-spin" strokeWidth={1.5} />
          <p className="text-[var(--accent-warning)] font-bold tracking-wider uppercase">FINAL ANALYSIS RUNNING</p>
          <p className="text-[var(--text-muted)] text-[11px] leading-relaxed">
            ML severity scoring, SHAP, and emergency dispatch orchestrating…
          </p>
        </div>
      );
    }
    return (
      <div className="p-6 text-center font-mono text-xs border border-[var(--border-color)] bg-[var(--bg-subtle)] space-y-2">
        <Eye className="w-5 h-5 mx-auto text-[var(--text-muted)]" strokeWidth={1.5} />
        <p className="text-[var(--text-primary)] font-bold tracking-wider uppercase">MONITORING CORRIDOR</p>
        <p className="text-[var(--text-muted)] text-[11px] leading-relaxed">
          Incident queue will populate upon confirmed detection.
        </p>
      </div>
    );
  };

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] flex flex-col">
      
      {/* Editorial Header */}
      <div className="border-b border-[var(--border-color)] px-5 py-3 flex justify-between items-center font-mono text-xs">
        <div className="flex items-center gap-2 font-bold tracking-widest uppercase text-[var(--text-primary)]">
          <ShieldAlert className="w-4 h-4 text-[var(--text-primary)]" strokeWidth={1.5} />
          <span>PRIORITY QUEUE / {String(incidents.length).padStart(2, '0')}</span>
        </div>
        <span className="text-[10px] tracking-wider text-[var(--text-muted)] px-2 py-0.5 border border-[var(--border-color)] uppercase">
          OPERATIONAL LIST
        </span>
      </div>

      <div className="p-4 space-y-2.5">
        {incidents.length === 0 ? (
          emptyContent()
        ) : (
          incidents.map((inc, idx) => {
            const isSelected = selectedIncidentId === inc.incident_id;
            const rank = inc.priority_rank ?? idx + 1;
            const rankFormatted = `#${String(rank).padStart(2, '0')}`;

            return (
              <div
                key={inc.incident_id}
                onClick={() => onSelectIncident(inc)}
                className={`p-3.5 border transition-all cursor-pointer ${
                  isSelected
                    ? 'border-[var(--text-primary)] bg-[var(--bg-subtle)]'
                    : 'border-[var(--border-color)] bg-[var(--bg-surface)] hover:border-[var(--text-muted)]'
                }`}
              >
                <div className="flex justify-between items-start mb-2 gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold px-1.5 py-0.5 border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)]">
                      {rankFormatted}
                    </span>
                    <div className="flex items-center gap-1.5 text-sm">
                      {getIcon(inc.type)}
                      <span className="font-serif italic font-semibold text-[var(--text-primary)] capitalize">
                        {inc.type?.toLowerCase()}
                      </span>
                    </div>
                  </div>
                  
                  <span className={`font-mono text-xs font-bold px-2 py-0.5 border uppercase ${getSeverityStyle(inc.severity_label)}`}>
                    {inc.severity_label?.toUpperCase()} {inc.severity_score}/100
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs font-mono text-[var(--text-muted)] pt-1 border-t border-[var(--border-color)]">
                  <div className="flex items-center gap-1 truncate">
                    <MapPin className="w-3 h-3 text-[var(--text-muted)] shrink-0" strokeWidth={1.5} />
                    <span className="truncate">{inc.location?.road_name || 'Corridor'} ({inc.camera_id})</span>
                  </div>
                  <ChevronRight className={`w-4 h-4 shrink-0 ${isSelected ? 'text-[var(--text-primary)]' : 'text-[var(--border-color)]'}`} />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
