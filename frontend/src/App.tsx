import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { CameraView } from './components/CameraView';
import { PriorityList } from './components/PriorityList';
import { DetailInspector } from './components/DetailInspector';
import { CopilotChat } from './components/CopilotChat';
import { DigitalTwinMap } from './components/DigitalTwinMap';
import { apiService } from './services/apiService';
import type { Camera, Telemetry, Incident, Dispatch, ModelComparisonResponse } from './types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export const App: React.FC = () => {
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

  // ── Dispatch + Model Comparison State ─────────────────────────────────────
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [modelComparison, setModelComparison] = useState<ModelComparisonResponse | null>(null);

  // ── Initial Load ──────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        const camData = await apiService.getCameras();
        setCameras(camData.cameras ?? []);
        const activeCam = camData.active_camera_id ?? camData.cameras?.[0]?.id ?? 'CAM-01';
        setActiveCameraId(activeCam);
        setStreamUrl(`${API_BASE}/api/stream/${activeCam}`);
      } catch (err) {
        console.warn('[RoadGuardian] Camera init error (backend may still be starting):', err);
      }

      try {
        const mc = await apiService.getModelComparison();
        setModelComparison(mc);
      } catch (_) { /* non-critical */ }
    };
    init();
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

        // Lock finalResult once COMPLETE — never overwrite after that
        if (
          telem.processing_state === 'COMPLETE' &&
          !finalResultLocked.current
        ) {
          // Try telemetry embedded result first, then fetch from /api/incidents
          if (telem.final_result) {
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
                  setFinalResult(fullInc);
                  setSelectedIncident(fullInc);
                } catch {
                  setFinalResult(incList[0]);
                  setSelectedIncident(incList[0]);
                }
                finalResultLocked.current = true;
              }
            } catch (_) { /* degraded */ }
          }
        }
      } catch (err) {
        console.warn('[RoadGuardian] Telemetry poll error:', err);
      }
    };

    const interval = setInterval(poll, 1000);
    poll(); // immediate first poll
    return () => { cancelled = true; clearInterval(interval); };
  }, []); // no dependency on activeCameraId — avoids restart on camera switch

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
      // ONLY time we change the stream URL — camera switch
      setStreamUrl(`${API_BASE}/api/stream/${id}`);
      // Reset incident state for new camera
      setSelectedIncident(null);
      setFinalResult(null);
      setIncidents([]);
      finalResultLocked.current = false;
    } catch (err) {
      console.error('[RoadGuardian] Camera switch error:', err);
    }
  }, [activeCameraId]);

  // ── Playback Control ──────────────────────────────────────────────────────
  const handleControlAction = useCallback(async (action: 'play' | 'pause' | 'restart') => {
    try {
      await apiService.controlCamera(action);
      if (action === 'restart') {
        // On restart: unlock final result so it can be set again
        setFinalResult(null);
        setSelectedIncident(null);
        setIncidents([]);
        finalResultLocked.current = false;
      }
    } catch (err) {
      console.error('[RoadGuardian] Control error:', err);
    }
  }, []);

  // ── Derived display state ─────────────────────────────────────────────────
  const processingState = telemetry?.processing_state ?? 'ANALYZING';
  const displayIncident = selectedIncident ?? finalResult;

  return (
    <div className="min-h-screen bg-[#0D0E10] text-[#D4D9DF] flex flex-col font-sans selection:bg-[#C98255] selection:text-[#0D0E10]">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <Header
        cameras={cameras}
        activeCameraId={activeCameraId}
        onSelectCamera={handleSelectCamera}
        status={telemetry?.status ?? 'PAUSED'}
        processingState={processingState}
      />

      {/* ── Global Processing State Banner ─────────────────────────────────── */}
      {processingState === 'FINAL_ANALYSIS' && (
        <div className="bg-[#1B1714] border-b border-[#C98255]/30 px-6 py-2 text-xs font-mono font-semibold text-[#C98255] flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#C98255] animate-pulse" />
          FINAL ANALYSIS PIPELINE RUNNING — XGBoost → SHAP → RAG → LangGraph Agent → Dispatch → Report
        </div>
      )}

      {/* ── Main Grid ──────────────────────────────────────────────────────── */}
      <main className="flex-1 p-4 max-w-[1800px] w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* LEFT (8 cols): CCTV + Inspector */}
        <div className="lg:col-span-8 space-y-4">
          <CameraView
            activeCameraId={activeCameraId}
            streamBaseUrl={streamUrl}
            telemetry={telemetry}
            onControlAction={handleControlAction}
          />

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

        {/* RIGHT (4 cols): Priority Queue + Map + Copilot */}
        <div className="lg:col-span-4 space-y-4 flex flex-col">
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
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-[#394047] bg-[#141517] py-2.5 px-6 font-mono text-xs text-[#798690] flex flex-wrap justify-between items-center gap-2">
        <div>🛡️ ROADGUARDIAN AI — REAL-TIME INTELLIGENT CCTV MONITORING INFRASTRUCTURE</div>
        <div className="flex gap-4">
          <span>YOLOv8n + ByteTrack</span>
          <span>FastAPI :8000</span>
          <span>ChromaDB RAG</span>
          <span>LangGraph Agents</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
