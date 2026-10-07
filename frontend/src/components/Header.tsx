import React, { useEffect, useState } from 'react';
import { Shield, Sun, Moon, Radio } from 'lucide-react';
import type { Camera } from '../types';

interface HeaderProps {
  cameras: Camera[];
  activeCameraId: string;
  onSelectCamera: (id: string) => void;
  status: string;
  processingState: string;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  cameras,
  activeCameraId,
  onSelectCamera,
  status,
  processingState,
  theme = 'light',
  onToggleTheme,
}) => {
  const [timeStr, setTimeStr] = useState<string>('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTimeStr(now.toTimeString().split(' ')[0]);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const isOnline = status === 'PLAYING';

  return (
    <header className="w-full bg-[var(--bg-surface)] border-b border-[var(--border-color)] transition-colors duration-200">
      {/* Top Editorial Operational Bar */}
      <div className="max-w-[1800px] mx-auto px-6 py-4 flex flex-wrap justify-between items-center gap-6">
        
        {/* Brand Identity */}
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 border border-[var(--border-color)] bg-[var(--bg-subtle)] flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5 text-[var(--text-primary)]" strokeWidth={1.5} />
          </div>
          <div>
            <div className="flex items-baseline gap-2.5">
              <h1 className="font-sans font-bold text-lg md:text-xl tracking-wider text-[var(--text-primary)] uppercase">
                ROADGUARDIAN <span className="font-serif italic font-normal text-base text-[var(--text-secondary)]">AI</span>
              </h1>
              <span className="font-mono text-[10px] tracking-widest px-1.5 py-0.5 border border-[var(--border-color)] text-[var(--text-muted)] uppercase">
                v2.0
              </span>
            </div>
            <p className="font-mono text-[11px] tracking-widest text-[var(--text-muted)] uppercase mt-0.5">
              Real-Time Road Incident Intelligence &amp; Emergency Orchestration
            </p>
          </div>
        </div>

        {/* Operational System Metadata Strip */}
        <div className="flex items-center gap-4 md:gap-6 flex-wrap font-mono text-xs">
          
          {/* Feed Selector */}
          <div className="flex items-center gap-2 px-3 py-1.5 border border-[var(--border-color)] bg-[var(--bg-subtle)]">
            <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">FEED /</span>
            <select
              value={activeCameraId}
              onChange={(e) => onSelectCamera(e.target.value)}
              className="bg-transparent font-mono text-xs font-semibold text-[var(--text-primary)] focus:outline-none cursor-pointer"
            >
              {cameras.map((cam) => (
                <option key={cam.id} value={cam.id} className="bg-[var(--bg-surface)] text-[var(--text-primary)]">
                  {cam.id} — {cam.name}
                </option>
              ))}
            </select>
          </div>

          {/* System Status Indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 border border-[var(--border-color)] bg-[var(--bg-surface)]">
            <span
              className={`w-2 h-2 rounded-full ${isOnline ? 'bg-[var(--accent-success)]' : 'bg-[var(--accent-warning)]'}`}
            />
            <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">SYSTEM /</span>
            <span className="font-bold text-[var(--text-primary)]">{isOnline ? 'ACTIVE' : status}</span>
          </div>

          {/* Pipeline Stage */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 border border-[var(--border-color)] bg-[var(--bg-surface)]">
            <Radio className="w-3.5 h-3.5 text-[var(--accent-warning)] animate-pulse" />
            <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">STATE /</span>
            <span className="font-bold text-[var(--text-primary)]">{processingState}</span>
          </div>

          {/* Real-time Clock */}
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 border border-[var(--border-color)] text-[var(--text-muted)]">
            <span className="text-[10px] uppercase tracking-wider">UTC /</span>
            <span className="font-bold text-[var(--text-primary)]">{timeStr || '—'}</span>
          </div>

          {/* Theme Switcher */}
          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              className="p-1.5 border border-[var(--border-color)] bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-primary)] transition cursor-pointer"
              title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
              aria-label="Toggle Theme"
            >
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>
          )}

        </div>

      </div>

      {/* Editorial System Sub-line */}
      <div className="border-t border-[var(--border-color)] bg-[var(--bg-primary)] px-6 py-1.5 text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wider flex justify-between items-center max-w-[1800px] mx-auto">
        <div className="flex items-center gap-4">
          <span>HIGHWAY CORRIDOR TELEMETRY</span>
          <span className="hidden sm:inline">•</span>
          <span className="hidden sm:inline">AUTONOMOUS SENSOR NETWORK</span>
        </div>
        <div className="flex items-center gap-3">
          <span>YOLOv8n + BYTETRACK</span>
          <span>•</span>
          <span>LANGGRAPH AGENTS</span>
        </div>
      </div>
    </header>
  );
};
