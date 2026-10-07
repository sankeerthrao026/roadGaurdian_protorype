import React, { useState } from 'react';
import {
  FileText,
  BarChart2,
  Shield,
  Clock,
  Database,
  Cpu,
  Trophy,
  AlertCircle,
  Siren,
  Flame,
  RotateCw,
  User,
  Car,
  CheckCircle,
  Loader,
} from 'lucide-react';
import type { Incident, Dispatch, ModelComparisonResponse } from '../types';
import { SeverityGauge } from './SeverityGauge';
import { ShapChart } from './ShapChart';

interface DetailInspectorProps {
  incident: Incident | null;
  dispatches: Dispatch[];
  modelComparison: ModelComparisonResponse | null;
  processingState: string;
  videoFps?: number;
  aiFps?: number;
  displayFps?: number;
  framesProcessed?: number;
  framesSkipped?: number;
  totalFrames?: number;
  videoDuration?: number;
  processingDuration?: number;
}

type TabKey = 'overview' | 'severity' | 'dispatches' | 'report' | 'rag' | 'performance';

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'overview',     label: 'OVERVIEW',       icon: <Shield className="w-3.5 h-3.5" strokeWidth={1.5} /> },
  { key: 'severity',    label: 'SEVERITY & SHAP',icon: <BarChart2 className="w-3.5 h-3.5" strokeWidth={1.5} /> },
  { key: 'dispatches',  label: 'RESPONSE',       icon: <Siren className="w-3.5 h-3.5" strokeWidth={1.5} /> },
  { key: 'report',      label: 'FINAL REPORT',   icon: <FileText className="w-3.5 h-3.5" strokeWidth={1.5} /> },
  { key: 'rag',         label: 'RAG CONTEXT',    icon: <Database className="w-3.5 h-3.5" strokeWidth={1.5} /> },
  { key: 'performance', label: 'PERFORMANCE',    icon: <Cpu className="w-3.5 h-3.5" strokeWidth={1.5} /> },
];

export const DetailInspector: React.FC<DetailInspectorProps> = ({
  incident,
  dispatches,
  modelComparison,
  processingState,
  videoFps,
  aiFps,
  displayFps,
  framesProcessed,
  framesSkipped,
  totalFrames,
  videoDuration,
  processingDuration,
}) => {
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  // ── State-aware Empty State ──────────────────────────────────────────────────
  if (!incident) {
    return (
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-8 font-mono text-xs">
        {processingState === 'FINAL_ANALYSIS' ? (
          <div className="text-center space-y-4 max-w-xl mx-auto">
            <Loader className="w-8 h-8 text-[var(--text-primary)] mx-auto animate-spin" strokeWidth={1.5} />
            <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">
              FINAL ANALYSIS PIPELINE IN PROGRESS
            </h3>
            <p className="text-[var(--text-muted)] leading-relaxed font-sans text-xs">
              Orchestrating XGBoost severity regression → SHAP attribution → ChromaDB RAG recall → LangGraph multi-agent synthesis → Emergency response dispatch.
            </p>
            <div className="flex flex-wrap justify-center gap-3 pt-2 text-[10px] text-[var(--text-muted)]">
              {['XGBoost Severity', 'SHAP Attribution', 'ChromaDB RAG', 'LangGraph Synthesis', 'Dispatch Matrix', 'Dossier Generation'].map((step) => (
                <span key={step} className="px-2 py-1 border border-[var(--border-color)] bg-[var(--bg-subtle)] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-warning)] animate-ping" />
                  {step}
                </span>
              ))}
            </div>
          </div>
        ) : processingState === 'ANALYZING' ? (
          <div className="text-center space-y-3 max-w-lg mx-auto">
            <AlertCircle className="w-8 h-8 text-[var(--text-muted)] mx-auto" strokeWidth={1.5} />
            <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">
              HIGHWAY CCTV MONITORING ACTIVE
            </h3>
            <p className="text-[var(--text-muted)] leading-relaxed font-sans text-xs">
              YOLOv8 vehicle detection &amp; ByteTrack trajectory tracking running in real-time. Comprehensive incident dossier and severity models will engage upon detected anomaly.
            </p>
          </div>
        ) : (
          <div className="text-center space-y-2">
            <CheckCircle className="w-8 h-8 text-[var(--accent-success)] mx-auto" strokeWidth={1.5} />
            <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">
              NO INCIDENT CLASSIFIED
            </h3>
            <p className="text-[var(--text-muted)] font-sans text-xs">
              All pipeline stages completed. Monitored video frames are below threshold.
            </p>
          </div>
        )}
      </div>
    );
  }

  const inc = incident;
  const shapEntries = Object.entries(inc.shap_values ?? {});

  // Dispatches matched to this incident
  const matchedDispatches = dispatches.filter(
    (d) => !d.target_incident || d.target_incident === inc.incident_id
  );

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] flex flex-col">
      
      {/* Editorial Incident Hero Header */}
      <div className="p-6 md:p-8 border-b border-[var(--border-color)] bg-[var(--bg-surface)]">
        
        {/* Status Line */}
        <div className="flex items-center justify-between gap-4 flex-wrap mb-3 font-mono text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--accent-success)]" />
            <span className="font-bold tracking-widest uppercase text-[var(--text-primary)]">
              {processingState === 'COMPLETE' ? 'FINAL ANALYSIS COMPLETE' : 'INCIDENT CONFIRMED'}
            </span>
            <span className="text-[var(--border-color)]">|</span>
            <span className="text-[var(--text-muted)]">ID: {inc.incident_id}</span>
          </div>

          <span
            className={`px-2.5 py-1 border font-bold uppercase tracking-wider text-[11px] ${
              inc.severity_label?.toLowerCase() === 'critical' || inc.severity_label?.toLowerCase() === 'high'
                ? 'text-[var(--accent-emergency)] border-[var(--accent-emergency)] bg-[var(--accent-emergency-bg)]'
                : 'text-[var(--accent-warning)] border-[var(--accent-warning)] bg-[var(--accent-warning-bg)]'
            }`}
          >
            {inc.severity_label?.toUpperCase()} SEVERITY • {inc.severity_score}/100
          </span>
        </div>

        {/* Large Editorial Title */}
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="font-serif italic font-semibold text-3xl md:text-4xl text-[var(--text-primary)] capitalize">
            {inc.type?.toLowerCase()}
          </span>
          <span className="font-sans font-bold text-xl md:text-2xl tracking-wider uppercase text-[var(--text-primary)]">
            Accident Dossier
          </span>
        </div>

        {/* Technical Sub-metadata */}
        <div className="flex items-center gap-6 mt-3 pt-3 border-t border-[var(--border-color)] font-mono text-xs text-[var(--text-muted)] flex-wrap">
          <div>
            CAMERA: <strong className="text-[var(--text-primary)]">{inc.camera_id}</strong>
          </div>
          <div>
            LOCATION: <strong className="text-[var(--text-primary)]">{inc.location?.road_name || 'Highway Corridor'}</strong>
          </div>
          <div>
            TIMESTAMP: <strong className="text-[var(--text-primary)]">{inc.timestamp || '2026-10-07 11:08:05'}</strong>
          </div>
        </div>

      </div>

      {/* Editorial Tab Bar */}
      <div className="bg-[var(--bg-subtle)] border-b border-[var(--border-color)] px-4 py-1.5 flex flex-wrap gap-1">
        {TABS.map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-3 py-2 font-mono text-xs font-semibold uppercase tracking-wider border transition cursor-pointer ${
              activeTab === key
                ? 'bg-[var(--bg-surface)] border-[var(--border-color)] text-[var(--text-primary)] font-bold shadow-sm'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-color)]'
            }`}
          >
            {icon}
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content Container */}
      <div className="p-6">

        {/* TAB 1: OVERVIEW ─────────────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            
            {/* Editorial KPI Blocks */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
              {[
                { label: 'VEHICLES INVOLVED', value: String(inc.features?.vehicle_count ?? 0), icon: <Car className="w-4 h-4 text-[var(--text-muted)]" strokeWidth={1.5} /> },
                { label: 'PEDESTRIAN ON ROAD', value: inc.features?.person_on_road ? 'YES' : 'NO', alert: inc.features?.person_on_road, icon: <User className="w-4 h-4 text-[var(--text-muted)]" strokeWidth={1.5} /> },
                { label: 'FIRE / SMOKE DETECTED', value: inc.features?.fire_smoke ? 'YES' : 'NO', alert: inc.features?.fire_smoke, icon: <Flame className="w-4 h-4 text-[var(--text-muted)]" strokeWidth={1.5} /> },
                { label: 'ROLLOVER GEOMETRY', value: inc.features?.rollover ? 'YES' : 'NO', alert: inc.features?.rollover, icon: <RotateCw className="w-4 h-4 text-[var(--text-muted)]" strokeWidth={1.5} /> },
              ].map(({ label, value, alert, icon }) => (
                <div
                  key={label}
                  className={`p-4 border bg-[var(--bg-surface)] flex flex-col justify-between ${
                    alert
                      ? 'border-[var(--accent-emergency)] bg-[var(--accent-emergency-bg)]'
                      : 'border-[var(--border-color)]'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-2">
                    <span>{label}</span>
                    {icon}
                  </div>
                  <div className={`font-bold text-2xl ${alert ? 'text-[var(--accent-emergency)]' : 'text-[var(--text-primary)]'}`}>
                    {value}
                  </div>
                </div>
              ))}
            </div>

            {/* Evidence Summary & Timeline */}
            {inc.evidence && (
              <div className="border border-[var(--border-color)] p-5 bg-[var(--bg-subtle)] space-y-4 font-mono text-xs">
                <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-[var(--text-primary)] border-b border-[var(--border-color)] pb-2">
                  <Clock className="w-4 h-4 text-[var(--text-primary)]" strokeWidth={1.5} />
                  <span>CCTV EVIDENCE CHRONOLOGY</span>
                </div>
                
                <p className="font-sans text-xs text-[var(--text-secondary)] leading-relaxed">
                  {inc.evidence.summary}
                </p>

                {inc.evidence.timeline?.length > 0 && (
                  <div className="space-y-2 pl-4 border-l-2 border-[var(--text-primary)] pt-1">
                    {inc.evidence.timeline.map((ev, idx) => (
                      <div key={idx} className="flex items-baseline gap-3 text-xs">
                        <span className="font-bold text-[var(--text-primary)] shrink-0">{ev.timestamp}</span>
                        <span className="text-[var(--text-secondary)] font-sans">— {ev.event}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>
        )}

        {/* TAB 2: SEVERITY & SHAP ───────────────────────────────────────────── */}
        {activeTab === 'severity' && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            
            {/* Left: Severity Gauge (5 cols) */}
            <div className="md:col-span-5 border border-[var(--border-color)] p-6 bg-[var(--bg-subtle)] flex flex-col items-center justify-center gap-4">
              <div className="font-mono text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest self-start">
                SEVERITY REGRESSION GAUGE
              </div>
              <SeverityGauge score={inc.severity_score} label={inc.severity_label ?? 'High'} />
              <div className="text-[11px] font-mono text-[var(--text-muted)] text-center leading-relaxed">
                Trained XGBoost Severity Model • Calibrated against Federal DOT incident datasets
              </div>
            </div>

            {/* Right: SHAP Feature Attribution (7 cols) */}
            <div className="md:col-span-7 border border-[var(--border-color)] p-6 bg-[var(--bg-surface)]">
              {shapEntries.length > 0 ? (
                <ShapChart shapValues={inc.shap_values!} />
              ) : (
                <div className="text-xs font-mono text-[var(--text-muted)] text-center py-8">
                  SHAP feature attribution not available for this incident.
                </div>
              )}
            </div>

          </div>
        )}

        {/* TAB 3: RESPONSE MATRIX ─────────────────────────────────────────── */}
        {activeTab === 'dispatches' && (
          <div className="space-y-3 font-mono text-xs">
            {matchedDispatches.length === 0 ? (
              <div className="text-center text-[var(--text-muted)] py-8 border border-[var(--border-color)] bg-[var(--bg-subtle)]">
                <Siren className="w-6 h-6 mx-auto mb-2 text-[var(--text-muted)]" strokeWidth={1.5} />
                <p className="font-bold uppercase tracking-wider text-[var(--text-primary)]">NO DISPATCH RECORDS</p>
                <p className="text-[11px] font-sans mt-1">Simulated emergency dispatches will populate when threshold is reached.</p>
              </div>
            ) : (
              matchedDispatches.map((d, idx) => (
                <div
                  key={idx}
                  className="border border-[var(--border-color)] border-l-4 border-l-[var(--text-primary)] p-4 bg-[var(--bg-subtle)]"
                >
                  <div className="flex justify-between items-center mb-1.5 flex-wrap gap-2">
                    <span className="font-bold text-[var(--text-primary)] text-sm font-sans">{d.service}</span>
                    <span className="px-2 py-0.5 border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-muted)] text-[10px] font-bold uppercase tracking-wider">
                      {d.badge || 'SIMULATED DISPATCH'}
                    </span>
                  </div>
                  <p className="font-sans text-xs text-[var(--text-secondary)] leading-relaxed">{d.message}</p>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 4: FINAL REPORT ────────────────────────────────────────────── */}
        {activeTab === 'report' && (
          <div
            className="border border-[var(--border-color)] p-6 bg-[var(--bg-subtle)] font-mono text-xs text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed overflow-y-auto max-h-[460px]"
          >
            {inc.report_text || 'GenAI structured incident report will appear here upon completion of multi-agent synthesis.'}
          </div>
        )}

        {/* TAB 5: RAG CONTEXT ─────────────────────────────────────────────── */}
        {activeTab === 'rag' && (
          <div className="space-y-4 font-mono text-xs">
            {!inc.similar_incidents || inc.similar_incidents.length === 0 ? (
              <div className="text-center text-[var(--text-muted)] py-8 border border-[var(--border-color)] bg-[var(--bg-subtle)]">
                <Database className="w-6 h-6 mx-auto mb-2 text-[var(--text-muted)]" strokeWidth={1.5} />
                <p className="font-bold uppercase tracking-wider text-[var(--text-primary)]">NO RAG CONTEXT</p>
                <p className="text-[11px] font-sans mt-1">ChromaDB semantic retrieval records will appear upon query.</p>
              </div>
            ) : (
              inc.similar_incidents.map((sim) => (
                <div key={sim.incident_id} className="border border-[var(--border-color)] p-4 bg-[var(--bg-surface)] space-y-2">
                  <div className="flex justify-between font-bold text-[var(--text-primary)] flex-wrap gap-2">
                    <span className="uppercase tracking-wider">REF #{sim.incident_id} — {sim.type?.toUpperCase()}</span>
                    <span className="text-[var(--text-muted)] font-normal">
                      Severity: {sim.severity} ({sim.severity_score}/100)
                    </span>
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)]">
                    LOCATION: {sim.location} | TIMESTAMP: {sim.timestamp}
                  </div>
                  <p className="font-sans text-xs text-[var(--text-secondary)] leading-relaxed pt-1 border-t border-[var(--border-color)]">
                    {sim.summary}
                  </p>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 6: PERFORMANCE & MLFLOW ────────────────────────────────────── */}
        {activeTab === 'performance' && (
          <div className="space-y-6 font-mono text-xs">
            
            {/* System Performance Matrix */}
            <div className="border border-[var(--border-color)] p-5 bg-[var(--bg-subtle)]">
              <div className="font-bold uppercase tracking-widest text-[var(--text-primary)] mb-3 text-[10px]">
                SYSTEM BENCHMARK INSTRUMENTATION
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { label: 'VIDEO DURATION',    value: `${videoDuration ?? 0}s` },
                  { label: 'PROCESSING TIME',   value: `${processingDuration ?? 0}s` },
                  { label: 'INFERENCE FPS',     value: `${aiFps ?? 0} FPS`, highlight: true },
                  { label: 'DISPLAY FPS',       value: `${displayFps ?? 0} FPS`, highlight: true },
                  { label: 'FRAMES INFERRED',   value: String(framesProcessed ?? 0) },
                  { label: 'FRAMES SKIPPED',    value: String(framesSkipped ?? 0) },
                  { label: 'TOTAL FRAMES',      value: String(totalFrames ?? 0) },
                  { label: 'VIDEO FPS',         value: String(videoFps ?? 0) },
                  { label: 'VISION ENGINE',     value: 'YOLOv8n + ByteTrack' },
                ].map(({ label, value, highlight }) => (
                  <div key={label} className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-3">
                    <div className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] mb-1">{label}</div>
                    <div className={`font-bold text-sm ${highlight ? 'text-[var(--accent-warning)]' : 'text-[var(--text-primary)]'}`}>
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* MLflow Model Comparison Table */}
            {modelComparison && (
              <div className="border border-[var(--border-color)] p-5 bg-[var(--bg-surface)]">
                <div className="flex items-center gap-2 mb-3">
                  <Trophy className="w-4 h-4 text-[var(--accent-success)]" strokeWidth={1.5} />
                  <span className="font-bold text-[var(--accent-success)] text-[10px] uppercase tracking-widest">
                    MLFLOW CHAMPION MODEL: {modelComparison.winner}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="border-b border-[var(--border-color)] text-[var(--text-muted)]">
                        {['MODEL', 'R² SCORE', 'RMSE', 'ACCURACY', 'F1 WEIGHTED'].map((h) => (
                          <th key={h} className="text-left py-2 pr-4 font-bold uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(modelComparison.models).map(([name, m]) => (
                        <tr
                          key={name}
                          className={`border-b border-[var(--border-color)] ${name === modelComparison.winner ? 'font-bold text-[var(--accent-success)]' : 'text-[var(--text-secondary)]'}`}
                        >
                          <td className="py-2 pr-4">{name}</td>
                          <td className="py-2 pr-4">{m.r2_score?.toFixed(3)}</td>
                          <td className="py-2 pr-4">{m.rmse?.toFixed(3)}</td>
                          <td className="py-2 pr-4">{((m.accuracy ?? 0) * 100).toFixed(1)}%</td>
                          <td className="py-2 pr-4">{m.f1_weighted?.toFixed(3)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
};
