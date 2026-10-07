import React, { useEffect, memo, useState, useCallback } from 'react';
import { Play, Pause, RotateCcw, Eye, Cpu, Zap, Car, User, Film } from 'lucide-react';
import { apiService } from '../services/apiService';
import type { Telemetry } from '../types';

interface CameraViewProps {
  activeCameraId: string;
  streamBaseUrl: string; // stable URL, only changes when camera switches
  telemetry: Telemetry | null;
  onControlAction: (action: 'play' | 'pause' | 'restart') => void;
}

// Direct MJPEG Stream with clean reconnection
const MJPEGStream = memo(
  ({ streamUrl, cameraId }: { streamUrl: string; cameraId: string }) => {
    return (
      <img
        key={streamUrl}
        src={streamUrl}
        alt={`Live CCTV Stream ${cameraId}`}
        className="w-full h-full object-contain block select-none pointer-events-none"
        onError={(e) => {
          const target = e.currentTarget;
          const cleanUrl = streamUrl.split('?')[0];
          setTimeout(() => {
            if (target) {
              target.src = `${cleanUrl}?t=${Date.now()}`;
            }
          }, 1000);
        }}
      />
    );
  },
  (prev, next) => prev.streamUrl === next.streamUrl && prev.cameraId === next.cameraId
);

export const CameraView: React.FC<CameraViewProps> = ({
  activeCameraId,
  streamBaseUrl,
  telemetry,
  onControlAction,
}) => {
  const progressPct = telemetry?.progress_pct ?? 0;
  const status = telemetry?.status ?? 'PAUSED';
  const pState = telemetry?.processing_state ?? 'ANALYZING';
  const isPlaying = status === 'PLAYING';

  const statusLabel =
    pState === 'COMPLETE'
      ? 'ANALYSIS COMPLETE'
      : pState === 'FINAL_ANALYSIS'
      ? 'FINAL ANALYSIS RUNNING'
      : 'MONITORING';

  // ── Footage Selector State ─────────────────────────────────────────────────
  const [footageList, setFootageList] = useState<
    { id: number; filename: string; display_name: string; size_mb: number }[]
  >([]);
  const [selectedFootageId, setSelectedFootageId] = useState<string>('');
  const [footageLoading, setFootageLoading] = useState(false);

  // Fetch available footage list with auto-retry
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const fetchFootage = async () => {
      try {
        const list = await apiService.getFootageList();
        if (cancelled) return;
        if (list && list.length > 0) {
          setFootageList(list);
          setSelectedFootageId((prev) => {
            if (!prev || !list.some((item) => String(item.id) === prev || item.filename === prev)) {
              return String(list[0].id);
            }
            return prev;
          });
        } else {
          timer = setTimeout(fetchFootage, 2000);
        }
      } catch {
        if (!cancelled) {
          timer = setTimeout(fetchFootage, 1500);
        }
      }
    };

    fetchFootage();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [activeCameraId]);

  const handleFootageChange = useCallback(
    async (footageId: string) => {
      if (footageLoading) return;
      setFootageLoading(true);
      try {
        await apiService.setCameraFootage(footageId);
        setSelectedFootageId(footageId);
        onControlAction('restart');
      } catch (err) {
        console.error('[RoadGuardian] Footage swap error:', err);
      } finally {
        setFootageLoading(false);
      }
    },
    [footageLoading, onControlAction]
  );

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] flex flex-col">
      
      {/* Editorial Section Header */}
      <div className="border-b border-[var(--border-color)] px-5 py-3 flex justify-between items-center font-mono text-xs">
        <div className="flex items-center gap-3">
          <Eye className="w-4 h-4 text-[var(--text-primary)]" strokeWidth={1.5} />
          <span className="font-bold tracking-widest uppercase text-[var(--text-primary)]">
            LIVE CCTV / {activeCameraId}
          </span>
          <span className="hidden sm:inline text-[var(--border-color)]">|</span>
          <span className="hidden sm:inline font-sans font-medium text-[var(--text-secondary)]">
            {telemetry?.road_name || 'Highway Corridor'}
          </span>
        </div>

        <div className="flex items-center gap-4 text-[var(--text-muted)] text-[11px]">
          <span className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-[var(--accent-success)]' : 'bg-[var(--border-color)]'}`}
            />
            <span className="uppercase font-semibold text-[var(--text-primary)]">{status}</span>
          </span>
        </div>
      </div>

      {/* Thin Editorial Progress Indicator */}
      <div className="w-full bg-[var(--bg-subtle)] h-1 border-b border-[var(--border-color)]">
        <div
          className="h-full transition-all duration-300 bg-[var(--text-primary)]"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Video Container (Deep Neutral Studio Frame) */}
      <div className="relative bg-[#050505] aspect-video w-full flex items-center justify-center overflow-hidden border-b border-[var(--border-color)]">
        <MJPEGStream streamUrl={streamBaseUrl} cameraId={activeCameraId} />

        {/* State Badge Top Left */}
        <div className="absolute top-3 left-3 bg-[#0A0A0A]/90 border border-[#333333] px-3 py-1 text-[11px] font-mono text-white flex items-center gap-2 select-none">
          <span
            className={`w-2 h-2 rounded-full ${
              pState === 'COMPLETE'
                ? 'bg-[#4EAD6B]'
                : pState === 'FINAL_ANALYSIS'
                ? 'bg-[#D98248] animate-pulse'
                : 'bg-[#D98248]'
            }`}
          />
          <span className="tracking-wider uppercase font-semibold">{statusLabel}</span>
        </div>

        {/* Real-time Detections Top Right */}
        <div className="absolute top-3 right-3 bg-[#0A0A0A]/90 border border-[#333333] px-3 py-1 text-[11px] font-mono text-white flex items-center gap-3 select-none">
          <span className="flex items-center gap-1.5">
            <Car className="w-3.5 h-3.5 text-[#D98248]" strokeWidth={1.5} />
            <span className="font-bold">{telemetry?.num_vehicles ?? 0}</span>
          </span>
          <span className="text-[#555555]">/</span>
          <span className="flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-[#4EAD6B]" strokeWidth={1.5} />
            <span className="font-bold">{telemetry?.num_persons ?? 0}</span>
          </span>
        </div>

        {/* Frame Metric Bottom Left */}
        <div className="absolute bottom-3 left-3 bg-[#0A0A0A]/90 border border-[#333333] px-2.5 py-0.5 text-[10px] font-mono text-[#A0A0A0] select-none">
          FRAME {telemetry?.frame_idx ?? 0} / {telemetry?.total_frames ?? 0}
        </div>
      </div>

      {/* Editorial Control Strip & Instrumentation */}
      <div className="p-4 bg-[var(--bg-surface)] flex flex-col gap-3 font-mono text-xs">
        
        {/* Footage Selector & Playback Controls Row */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          
          {/* Footage Dropdown */}
          <div className="flex items-center gap-2 px-3 py-1.5 border border-[var(--border-color)] bg-[var(--bg-subtle)] flex-1">
            <Film className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" strokeWidth={1.5} />
            <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider shrink-0">
              FOOTAGE:
            </span>
            {footageList.length === 0 ? (
              <span className="text-[var(--text-muted)]">Loading available clips…</span>
            ) : (
              <select
                value={selectedFootageId}
                onChange={(e) => handleFootageChange(e.target.value)}
                disabled={footageLoading}
                className="w-full bg-transparent font-mono text-xs font-semibold text-[var(--text-primary)] focus:outline-none cursor-pointer disabled:opacity-50"
              >
                {footageList.map((f) => (
                  <option key={f.id} value={f.id} className="bg-[var(--bg-surface)] text-[var(--text-primary)]">
                    {f.filename} ({f.size_mb} MB)
                  </option>
                ))}
              </select>
            )}
            {footageLoading && (
              <span className="text-[10px] font-bold text-[var(--accent-warning)] animate-pulse shrink-0">
                SWITCHING…
              </span>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onControlAction('play')}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-[var(--text-primary)] hover:bg-[var(--text-secondary)] text-[var(--bg-primary)] font-bold text-xs uppercase tracking-wider border border-[var(--text-primary)] transition cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              <span>PLAY</span>
            </button>
            <button
              onClick={() => onControlAction('pause')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-surface)] hover:bg-[var(--bg-subtle)] text-[var(--text-primary)] font-bold text-xs uppercase tracking-wider border border-[var(--border-color)] transition cursor-pointer"
            >
              <Pause className="w-3.5 h-3.5" />
              <span>PAUSE</span>
            </button>
            <button
              onClick={() => onControlAction('restart')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-surface)] hover:bg-[var(--bg-subtle)] text-[var(--text-primary)] font-bold text-xs uppercase tracking-wider border border-[var(--border-color)] transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>RESTART</span>
            </button>
          </div>

        </div>

        {/* Monospace Performance Instrumentation Matrix */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1 border-t border-[var(--border-color)]">
          <div className="bg-[var(--bg-subtle)] border border-[var(--border-color)] p-2">
            <div className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1">
              <Cpu className="w-3 h-3 text-[var(--text-muted)]" strokeWidth={1.5} />
              <span>VIDEO FPS</span>
            </div>
            <div className="font-bold text-sm text-[var(--text-primary)] mt-0.5">
              {telemetry?.video_fps ?? '—'}
            </div>
          </div>

          <div className="bg-[var(--bg-subtle)] border border-[var(--border-color)] p-2">
            <div className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1">
              <Zap className="w-3 h-3 text-[var(--accent-warning)]" strokeWidth={1.5} />
              <span>AI INFERENCE FPS</span>
            </div>
            <div className="font-bold text-sm text-[var(--accent-warning)] mt-0.5">
              {telemetry?.ai_fps ?? '—'}
            </div>
          </div>

          <div className="bg-[var(--bg-subtle)] border border-[var(--border-color)] p-2">
            <div className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1">
              <Eye className="w-3 h-3 text-[var(--accent-success)]" strokeWidth={1.5} />
              <span>DISPLAY FPS</span>
            </div>
            <div className="font-bold text-sm text-[var(--text-primary)] mt-0.5">
              {telemetry?.display_fps ?? '—'}
            </div>
          </div>

          <div className="bg-[var(--bg-subtle)] border border-[var(--border-color)] p-2">
            <div className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1">
              <Film className="w-3 h-3 text-[var(--text-muted)]" strokeWidth={1.5} />
              <span>FRAMES (PROC / SKIP)</span>
            </div>
            <div className="font-bold text-sm text-[var(--text-primary)] mt-0.5">
              {telemetry?.frames_processed ?? 0} / {telemetry?.frames_skipped ?? 0}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};
