import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { CameraView } from './components/CameraView';
import { PriorityList } from './components/PriorityList';
import { DetailInspector } from './components/DetailInspector';
import { CopilotChat } from './components/CopilotChat';
import { DigitalTwinMap } from './components/DigitalTwinMap';
import { AuthorityAlertBanner } from './components/AuthorityAlertBanner';
import { soundManager } from './utils/sound';
import { apiService } from './services/apiService';
import type { Camera, Telemetry, Incident, Dispatch, ModelComparisonResponse, AuthorityAlert } from './types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export const App: React.FC = () => {
  // ── Theme State (Editorial Light by default, Dark toggleable) ──────────────
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('rg_theme') as 'light' | 'dark') || 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('rg_theme', theme);
  }, [theme]);

  const handleToggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  // ── Camera State ──────────────────────────────────────────────────────────
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [activeCameraId, setActiveCameraId] = useState<string>('CAM-01');

  // ── Video stream URL — STABLE, only changes on camera switch ─────────────
  // Does NOT include a timestamp. Browser holds one persistent MJPEG connection.
  const [streamUrl, setStreamUrl] = useState<string>(`${API_BASE}/api/stream/CAM-01`);

  // ── Telemetry — updates every second, does NOT affect video URL ───────────
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);

  // ── Incident State ────────────────────────────────────────────────────────
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);

  // finalResult is SET ONCE when processing_state reaches COMPLETE and never cleared
  const [finalResult, setFinalResult] = useState<Incident | null>(null);
  const finalResultLocked = useRef(false);

  // ── Authority Alert State + Audio Deduplication ────────────────────────────
  const [activeAlert, setActiveAlert] = useState<AuthorityAlert | null>(null);
  const [isAlertDismissed, setIsAlertDismissed] = useState<boolean>(false);
  const playedAlertIds = useRef<Set<string>>(new Set());
  const inspectorRef = useRef<HTMLDivElement>(null);

  // ── Dispatch + Model Comparison State ─────────────────────────────────────
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [modelComparison, setModelComparison] = useState<ModelComparisonResponse | null>(null);

  // ── Initial Load & Camera Discovery with Auto-Retry ───────────────────────
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const loadCameras = async () => {
      try {
        const camData = await apiService.getCameras();
        if (cancelled) return;
        if (camData?.cameras && camData.cameras.length > 0) {
          setCameras(camData.cameras);
          const activeCam = camData.active_camera_id ?? camData.cameras[0].id ?? 'CAM-01';
          setActiveCameraId((prev) => prev || activeCam);
          setStreamUrl((prev) => prev || `${API_BASE}/api/stream/${activeCam}`);
        } else {
          timer = setTimeout(loadCameras, 2000);
        }
      } catch (err) {
        if (!cancelled) {
          timer = setTimeout(loadCameras, 1500);
        }
      }

      try {
        const mc = await apiService.getModelComparison();
        if (!cancelled) setModelComparison(mc);
      } catch (_) { /* non-critical */ }
    };

    loadCameras();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  // ── Telemetry Polling — every 1s, completely independent of video ─────────
  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;
      try {
        const telem = await apiService.getTelemetry();
        if (cancelled) return;
        setTelemetry(telem);

        // Sync backend active alerts
        if (telem.active_alerts && telem.active_alerts.length > 0) {
          const latestAlert = telem.active_alerts[0];
          setActiveAlert((prev) => {
            if (prev && prev.alert_id === latestAlert.alert_id && prev.status === 'ACKNOWLEDGED') {
              return prev; // Preserve local acknowledged state
            }
            return latestAlert;
          });

          // Play emergency chime once per incident_id
          if (latestAlert.incident_id && !playedAlertIds.current.has(latestAlert.incident_id)) {
            playedAlertIds.current.add(latestAlert.incident_id);
            soundManager.playAlertChime();
            setIsAlertDismissed(false);
          }
        }

        // Lock finalResult once COMPLETE — never overwrite after that
        if (
          telem.processing_state === 'COMPLETE' &&
          !finalResultLocked.current
        ) {
          let confirmedInc: Incident | null = null;
          // Try telemetry embedded result first, then fetch from /api/incidents
          if (telem.final_result) {
            confirmedInc = telem.final_result;
            setFinalResult(telem.final_result);
            setSelectedIncident(telem.final_result);
            finalResultLocked.current = true;
          } else {
            try {
              const incList = await apiService.getIncidents();
              if (incList.length > 0) {
                // Fetch full incident detail including similar_incidents (RAG)
                try {
                  const fullInc = await apiService.getIncidentDetails(incList[0].incident_id);
                  confirmedInc = fullInc;
                  setFinalResult(fullInc);
                  setSelectedIncident(fullInc);
                } catch {
                  confirmedInc = incList[0];
                  setFinalResult(incList[0]);
                  setSelectedIncident(incList[0]);
                }
                finalResultLocked.current = true;
              }
            } catch (_) { /* degraded */ }
          }

          // Trigger Authority Alert for confirmed incident if not already active
          if (confirmedInc && String(confirmedInc.type).toUpperCase() !== 'MONITORING' && confirmedInc.severity_score > 0) {
            const incId = confirmedInc.incident_id;
            const syntheticAlert: AuthorityAlert = {
              alert_id: `ALERT_${incId}`,
              incident_id: incId,
              incident_type: (confirmedInc.type || 'ACCIDENT').toUpperCase(),
              severity_label: confirmedInc.severity_label || 'High',
              severity_score: confirmedInc.severity_score || 75,
              camera_id: confirmedInc.camera_id || activeCameraId,
              road_name: confirmedInc.location?.road_name || telem.road_name || 'Highway Corridor',
              location: telem.location || { name: telem.road_name },
              timestamp: confirmedInc.timestamp || new Date().toLocaleTimeString(),
              authorities: [
                'Highway Patrol & Traffic Enforcement',
                'Emergency Medical Services (EMS)',
                confirmedInc.features?.fire_smoke ? 'Fire & Rescue Department' : 'Roadside Assistance & Towing'
              ],
              status: 'GENERATED',
              badge: 'DISPATCH SIMULATED',
              created_at: new Date().toISOString()
            };

            setActiveAlert((prev) => (prev && prev.incident_id === incId ? prev : syntheticAlert));

            if (!playedAlertIds.current.has(incId)) {
              playedAlertIds.current.add(incId);
              soundManager.playAlertChime();
              setIsAlertDismissed(false);
            }
          }
        }
      } catch (err) {
        console.warn('[RoadGuardian] Telemetry poll error:', err);
      }
    };

    const interval = setInterval(poll, 1000);
    poll(); // immediate first poll
    return () => { cancelled = true; clearInterval(interval); };
  }, [activeCameraId]);

  // ── Incidents Polling — every 2s ──────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const pollIncidents = async () => {
      if (cancelled) return;
      try {
        const incList = await apiService.getIncidents();
        if (!cancelled) setIncidents(incList);
      } catch (_) { /* degraded */ }
    };
    const interval = setInterval(pollIncidents, 2000);
    pollIncidents();
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  // ── Dispatches Polling — every 2s ─────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const pollDispatches = async () => {
      if (cancelled) return;
      try {
        const d = await apiService.getDispatches();
        if (!cancelled) setDispatches(d);
      } catch (_) { /* degraded */ }
    };
    const interval = setInterval(pollDispatches, 2000);
    pollDispatches();
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  // ── Camera Switch ─────────────────────────────────────────────────────────
  const handleSelectCamera = useCallback(async (id: string) => {
    if (id === activeCameraId) return;
    try {
      await apiService.setActiveCamera(id);
      setActiveCameraId(id);
      setStreamUrl(`${API_BASE}/api/stream/${id}?t=${Date.now()}`);
      setSelectedIncident(null);
      setFinalResult(null);
      setIncidents([]);
      setActiveAlert(null);
      setIsAlertDismissed(false);
      finalResultLocked.current = false;
    } catch (err) {
      console.error('[RoadGuardian] Camera switch error:', err);
    }
  }, [activeCameraId]);

  // ── Playback Control ──────────────────────────────────────────────────────
  const handleControlAction = useCallback(async (action: 'play' | 'pause' | 'restart') => {
    try {
      // User gesture initializes / unlocks Web Audio API
      soundManager.unlock();
      await apiService.controlCamera(action);
      if (action === 'restart' || action === 'play') {
        setStreamUrl(`${API_BASE}/api/stream/${activeCameraId}?t=${Date.now()}`);
      }
      if (action === 'restart') {
        // On restart: unlock final result & clear alert so it can be re-triggered cleanly
        setFinalResult(null);
        setSelectedIncident(null);
        setIncidents([]);
        setActiveAlert(null);
        setIsAlertDismissed(false);
        playedAlertIds.current.clear();
        finalResultLocked.current = false;
      }
    } catch (err) {
      console.error('[RoadGuardian] Control error:', err);
    }
  }, [activeCameraId]);

  // ── Alert Actions ─────────────────────────────────────────────────────────
  const handleViewIncident = useCallback((incidentId: string) => {
    const matched =
      incidents.find((i) => i.incident_id === incidentId) ||
      (finalResult?.incident_id === incidentId ? finalResult : finalResult);
    if (matched) {
      setSelectedIncident(matched);
    }
    // Smoothly scroll to the existing Detail Inspector component
    setTimeout(() => {
      inspectorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }, [incidents, finalResult]);

  const handleAcknowledgeAlert = useCallback(async (alertId: string) => {
    try {
      await apiService.acknowledgeAlert(alertId);
      setActiveAlert((prev) =>
        prev
          ? {
              ...prev,
              status: 'ACKNOWLEDGED',
              acknowledged_at: new Date().toISOString(),
            }
          : null
      );
    } catch (err) {
      console.warn('[RoadGuardian] Acknowledge alert fallback:', err);
      setActiveAlert((prev) =>
        prev
          ? {
              ...prev,
              status: 'ACKNOWLEDGED',
              acknowledged_at: new Date().toISOString(),
            }
          : null
      );
    }
  }, []);

  const handleDismissAlert = useCallback(() => {
    setIsAlertDismissed(true);
  }, []);

  // ── Derived display state ─────────────────────────────────────────────────
  const processingState = telemetry?.processing_state ?? 'ANALYZING';
  const displayIncident = selectedIncident ?? finalResult;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col font-sans transition-colors duration-200">
      
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <Header
        cameras={cameras}
        activeCameraId={activeCameraId}
        onSelectCamera={handleSelectCamera}
        status={telemetry?.status ?? 'PAUSED'}
        processingState={processingState}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />

      {/* ── Global Pipeline State Notification Strip ────────────────────────── */}
      {processingState === 'FINAL_ANALYSIS' && (
        <div className="bg-[var(--accent-warning-bg)] border-b border-[var(--accent-warning)] px-6 py-2.5 text-xs font-mono font-semibold text-[var(--accent-warning)] flex items-center justify-between gap-4 max-w-[1800px] mx-auto w-full">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--accent-warning)] animate-ping" />
            <span>FINAL ANALYSIS PIPELINE RUNNING — XGBoost → SHAP → ChromaDB RAG → LangGraph Agents → Dispatch Synthesis</span>
          </div>
          <span className="hidden md:inline uppercase text-[10px] tracking-widest text-[var(--text-muted)]">
            STANDBY FOR DOSSIER GENERATION
          </span>
        </div>
      )}

      {/* ── Main Editorial Operations Grid ─────────────────────────────────── */}
      <main className="flex-1 p-4 md:p-6 max-w-[1800px] w-full mx-auto space-y-6">
        
        {/* ── Authority Emergency Bulletin Banner ──────────────────────────── */}
        {activeAlert && !isAlertDismissed && (
          <AuthorityAlertBanner
            alert={activeAlert}
            onViewIncident={handleViewIncident}
            onAcknowledge={handleAcknowledgeAlert}
            onDismiss={handleDismissAlert}
          />
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT (8 cols): Primary CCTV Stream + Incident Dossier */}
          <div className="lg:col-span-8 space-y-6">
            <CameraView
              activeCameraId={activeCameraId}
              streamBaseUrl={streamUrl}
              telemetry={telemetry}
              onControlAction={handleControlAction}
            />

            <div ref={inspectorRef} className="scroll-mt-6">
              <DetailInspector
                incident={displayIncident}
                dispatches={dispatches}
                modelComparison={modelComparison}
                processingState={processingState}
                videoFps={telemetry?.video_fps}
                aiFps={telemetry?.ai_fps}
                displayFps={telemetry?.display_fps}
                framesProcessed={telemetry?.frames_processed}
                framesSkipped={telemetry?.frames_skipped}
                totalFrames={telemetry?.total_frames}
                videoDuration={telemetry?.video_duration_s}
                processingDuration={telemetry?.processing_duration_s}
              />
            </div>
          </div>

          {/* RIGHT (4 cols): Priority Queue + GIS Map + Copilot */}
          <div className="lg:col-span-4 space-y-6 flex flex-col">
            <PriorityList
              incidents={incidents.length > 0 ? incidents : (finalResult ? [finalResult] : [])}
              selectedIncidentId={displayIncident?.incident_id ?? null}
              onSelectIncident={(inc) => setSelectedIncident(inc)}
              processingState={processingState}
            />

            <DigitalTwinMap
              cameraId={activeCameraId}
              roadName={telemetry?.road_name ?? 'Highway Corridor'}
              location={telemetry?.location}
              incidentLocation={displayIncident?.location?.road_name}
            />

            <CopilotChat incidentId={displayIncident?.incident_id} />
          </div>

        </div>
      </main>

      {/* ── Editorial Footer ───────────────────────────────────────────────── */}
      <footer className="border-t border-[var(--border-color)] bg-[var(--bg-surface)] py-4 px-6 font-mono text-xs text-[var(--text-muted)] mt-8">
        <div className="max-w-[1800px] mx-auto flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[var(--text-primary)]">ROADGUARDIAN AI</span>
            <span>—</span>
            <span>REAL-TIME INTELLIGENT HIGHWAY CCTV SURVEILLANCE &amp; EMERGENCY ORCHESTRATION</span>
          </div>
          <div className="flex items-center gap-4 text-[11px] tracking-wider uppercase">
            <span>YOLOv8n + BYTETRACK</span>
            <span>•</span>
            <span>FASTAPI :8000</span>
            <span>•</span>
            <span>CHROMADB RAG</span>
            <span>•</span>
            <span>LANGGRAPH AGENTS</span>
          </div>
        </div>
      </footer>

    </div>
  );
};

export default App;
