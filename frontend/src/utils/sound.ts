/**
 * RoadGuardian AI — Emergency Alert Sound Engine
 * Synthesizes a clean, professional dual-tone emergency notification chime
 * using the HTML5 Web Audio API without external asset dependencies.
 */

class SoundManager {
  private ctx: AudioContext | null = null;
  private isUnlocked: boolean = false;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Unlock AudioContext on initial user gesture (click, keypress, play button).
   */
  public unlock(): void {
    if (this.isUnlocked) return;
    const ctx = this.getContext();
    if (ctx) {
      if (ctx.state === 'suspended') {
        ctx.resume().then(() => {
          this.isUnlocked = true;
        }).catch(() => {});
      } else {
        this.isUnlocked = true;
      }
    }
  }

  /**
   * Plays a professional emergency notification chime (Tone 1: 880Hz -> Tone 2: 1174Hz).
   * Short, audible, non-looping.
   */
  public playAlertChime(): void {
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const now = ctx.currentTime;

      // --- Tone 1 (880 Hz - A5) ---
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, now);
      gain1.gain.setValueAtTime(0.18, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.22);

      // --- Tone 2 (1174.66 Hz - D6) ---
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1174.66, now + 0.10);
      gain2.gain.setValueAtTime(0.22, now + 0.10);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.10);
      osc2.stop(now + 0.42);
    } catch (err) {
      console.warn('[RoadGuardian:Sound] Emergency chime audio synthesis error:', err);
    }
  }
}

export const soundManager = new SoundManager();

// Automatically attach unlock listener to first user gesture in browser
if (typeof window !== 'undefined') {
  const unlockHandler = () => {
    soundManager.unlock();
    window.removeEventListener('pointerdown', unlockHandler);
    window.removeEventListener('keydown', unlockHandler);
  };
  window.addEventListener('pointerdown', unlockHandler, { once: true });
  window.addEventListener('keydown', unlockHandler, { once: true });
}
