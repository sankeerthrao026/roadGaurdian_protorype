import React, { useRef, useEffect, memo, useState, useCallback } from 'react';
import { Play, Pause, RotateCcw, Eye, Cpu, Zap, Car, User, Film } from 'lucide-react';
import { apiService } from '../services/apiService';
import type { Telemetry } from '../types';

interface CameraViewProps {
  activeCameraId: string;
  streamBaseUrl: string; // stable URL, only changes when camera switches
  telemetry: Telemetry | null;
  onControlAction: (action: 'play' | 'pause' | 'restart') => void;
}

// Video is memoized on streamUrl and cameraId — telemetry changes do NOT
// cause the <img> element to re-mount or reconnect the MJPEG stream.
const MJPEGStream = memo(
  ({ streamUrl, cameraId }: { streamUrl: string; cameraId: string }) => {
    const imgRef = useRef<HTMLImageElement>(null);
    const [streamSrc, setStreamSrc] = useState(streamUrl);
    const [hasError, setHasError] = useState(false);
    const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
      setStreamSrc(streamUrl);
      setHasError(false);
      return () => {
        if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      };
    }, [streamUrl]);

    const handleError = () => {
      setHasError(true);
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      // Auto-retry reconnecting after 1.5 seconds with timestamp
      retryTimeoutRef.current = setTimeout(() => {
        setStreamSrc(`${streamUrl}${streamUrl.includes('?') ? '&' : '?'}t=${Date.now()}`);
        setHasError(false);
      }, 1500);
    };

    const handleLoad = () => {
      setHasError(false);
    };

    return (
      <div className="relative w-full h-full flex items-center justify-center">
        {hasError && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#090A0C]/90 text-[#C98255] font-mono text-xs gap-2 p-4 text-center">
            <span className="w-3 h-3 rounded-full bg-[#C98255] animate-ping" />
            <p className="font-bold">CONNECTING TO LIVE CCTV FEED ({cameraId})...</p>
            <p className="text-[#798690] text-[10px]">Initializing video pipeline and YOLOv8 inference...</p>
          </div>
        )}
        <img
          ref={imgRef}
          src={streamSrc}
          alt={`CCTV Stream ${cameraId}`}
          className={`w-full h-full object-contain ${hasError ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
          onLoad={handleLoad}
          onError={handleError}
        />
      </div>
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

  const statusColor =
    pState === 'COMPLETE'
      ? '#55C98A'
      : pState === 'FINAL_ANALYSIS'
      ? '#C98255'
      : '#C98255';

  const statusLabel =
    pState === 'COMPLETE'
      ? 'ANALYSIS COMPLETE'
      : pState === 'FINAL_ANALYSIS'
      ? 'FINAL ANALYSIS…'
      : 'MONITORING';

  // ── Footage Selector State ─────────────────────────────────────────────────
  const [footageList, setFootageList] = useState<
    { id: number; filename: string; display_name: string; size_mb: number }[]
  >([]);
  const [selectedFootageId, setSelectedFootageId] = useState<string>('');
  const [footageLoading, setFootageLoading] = useState(false);

  // Fetch available footage list whenever the active camera changes
  useEffect(() => {
    apiService
      .getFootageList()
      .then((list) => {
        setFootageList(list);
        if (list.length > 0 && !selectedFootageId) {
          setSelectedFootageId(String(list[0].id));
        }
      })
      .catch(() => {
        /* backend may still be starting — non-critical */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCameraId]);

  const handleFootageChange = useCallback(
    async (footageId: string) => {
      if (footageId === selectedFootageId || footageLoading) return;
      setFootageLoading(true);
      try {
        await apiService.setCameraFootage(Number(footageId));
        setSelectedFootageId(footageId);
        // Use the existing restart action to clear incident state in App.tsx
        onControlAction('restart');
      } catch (err) {
        console.error('[RoadGuardian] Footage swap error:', err);
      } finally {
        setFootageLoading(false);
      }
    },
    [selectedFootageId, footageLoading, onControlAction]
  );

  return (
    <div className="bg-[#141517] border border-[#394047] rounded-md overflow-hidden flex flex-col">
      {/* Section Header */}
      <div className="bg-[#1B1D20] border-b border-[#394047] px-4 py-2 flex justify-between items-center font-mono text-xs font-bold text-[#C98255] tracking-wider uppercase">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-[#C98255]" />
          <span>LIVE CCTV FEED — {activeCameraId}</span>
        </div>
        <div className="flex items-center gap-3 text-[#999EA5] font-normal text-[10px]">
          <span>
            ROAD: <strong className="text-[#D4D9DF]">{telemetry?.road_name || '—'}</strong>
          </span>
          <span className="flex items-center gap-1">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: isPlaying ? '#55C98A' : '#394047' }}
            />
            {status}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-[#0D0E10] h-1.5 border-b border-[#394047]">
        <div
          className="h-full transition-all duration-300"
          style={{
            width: `${progressPct}%`,
            backgroundColor: pState === 'COMPLETE' ? '#55C98A' : '#C98255',
          }}
        />
      </div>

      {/* Video */}
      <div className="relative bg-[#000000] aspect-video w-full flex items-center justify-center overflow-hidden">
        <MJPEGStream streamUrl={streamBaseUrl} cameraId={activeCameraId} />

        {/* Processing State Overlay Badge */}
        <div className="absolute top-3 left-3 bg-[#0D0E10]/85 backdrop-blur-sm border border-[#394047] px-3 py-1 rounded text-xs font-mono font-semibold flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{
              backgroundColor: statusColor,
              animation: pState !== 'COMPLETE' ? 'pulse 1.5s infinite' : 'none',
            }}
          />
          <span style={{ color: statusColor }}>{statusLabel}</span>
        </div>

        {/* Live Object Count Badge */}
        <div className="absolute top-3 right-3 bg-[#0D0E10]/85 backdrop-blur-sm border border-[#394047] px-3 py-1 rounded text-xs font-mono text-[#999EA5] flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Car className="w-3.5 h-3.5 text-[#C98255]" />
            {telemetry?.num_vehicles ?? 0}
          </span>
          <span className="flex items-center gap-1">
            <User className="w-3.5 h-3.5 text-[#55C98A]" />
            {telemetry?.num_persons ?? 0}
          </span>
        </div>

        {/* Frame Counter Bottom Left */}
        <div className="absolute bottom-3 left-3 bg-[#0D0E10]/85 backdrop-blur-sm border border-[#394047] px-3 py-1 rounded text-[10px] font-mono text-[#798690]">
          FRAME {telemetry?.frame_idx ?? 0} / {telemetry?.total_frames ?? 0}
        </div>
      </div>

      {/* Controls & Telemetry HUD */}
      <div className="p-4 bg-[#141517] border-t border-[#394047] flex flex-col gap-3">

        {/* ── Footage Selector ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 bg-[#0D0E10] border border-[#394047] rounded-md px-3 py-1.5">
          <Film className="w-4 h-4 text-[#C98255] shrink-0" />
          <span className="font-mono text-xs text-[#798690] uppercase font-semibold shrink-0">
            FOOTAGE:
          </span>
          {footageList.length === 0 ? (
            <span className="font-mono text-xs text-[#798690]">Loading…</span>
          ) : (
            <select
              value={selectedFootageId}
              onChange={(e) => handleFootageChange(e.target.value)}
              disabled={footageLoading}
              className="flex-1 bg-transparent font-mono text-xs text-[#D4D9DF] font-semibold focus:outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {footageList.map((f) => (
                <option
                  key={f.id}
                  value={f.id}
                  className="bg-[#141517] text-[#D4D9DF]"
                >
                  {f.filename} ({f.size_mb} MB)
                </option>
              ))}
            </select>
          )}
          {footageLoading && (
            <span className="font-mono text-[10px] text-[#C98255] animate-pulse shrink-0">
              SWITCHING…
            </span>
          )}
        </div>

        {/* Playback Buttons */}
        <div className="flex justify-between items-center flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onControlAction('play')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1F1B18] border border-[#C98255] text-[#C98255] hover:bg-[#C98255] hover:text-[#0D0E10] font-mono text-xs font-semibold rounded transition cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" /> PLAY
            </button>
            <button
              onClick={() => onControlAction('pause')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1B1D20] border border-[#394047] text-[#D4D9DF] hover:border-[#C98255] font-mono text-xs font-semibold rounded transition cursor-pointer"
            >
              <Pause className="w-3.5 h-3.5" /> PAUSE
            </button>
            <button
              onClick={() => onControlAction('restart')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1B1D20] border border-[#394047] text-[#D4D9DF] hover:border-[#C98255] font-mono text-xs font-semibold rounded transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" /> RESTART
            </button>
          </div>
          <div className="font-mono text-xs text-[#999EA5]">{progressPct}% complete</div>
        </div>

        {/* Telemetry HUD Metrics Row */}
        <div className="bg-[#0D0E10] border border-[#394047] rounded p-2.5 grid grid-cols-2 md:grid-cols-4 gap-3 font-mono text-xs text-[#999EA5]">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-[#C98255]" />
            <div>
              <div className="text-[10px] text-[#798690]">VIDEO FPS</div>
              <div className="text-[#D4D9DF] font-bold">{telemetry?.video_fps ?? '—'}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-[#C98255]" />
            <div>
              <div className="text-[10px] text-[#798690]">AI INFERENCE FPS</div>
              <div className="text-[#C98255] font-bold">{telemetry?.ai_fps ?? '—'}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-[#55C98A]" />
            <div>
              <div className="text-[10px] text-[#798690]">DISPLAY FPS</div>
              <div className="text-[#D4D9DF] font-bold">{telemetry?.display_fps ?? '—'}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Car className="w-4 h-4 text-[#999EA5]" />
            <div>
              <div className="text-[10px] text-[#798690]">PROCESSED / SKIPPED</div>
              <div className="text-[#D4D9DF] font-bold">
                {telemetry?.frames_processed ?? 0} / {telemetry?.frames_skipped ?? 0}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
