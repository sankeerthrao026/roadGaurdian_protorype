/**
 * RoadGuardian AI — Emergency Warning Buzzer & Alarm Audio Engine
 * Synthesizes an authentic industrial emergency warning buzzer / alarm
 * with continuous frequency sweep and rich harmonic layering using the HTML5 Web Audio API.
 * 
 * Character: Sustained dual-cycle siren-buzzer (WAAAAAAAH -> WAAAAAAAH)
 * Duration: ~1.25 seconds total
 * Waveform: Sawtooth + Square + Triangle harmonic blend with continuous frequency sweep
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
   * Synthesizes an industrial emergency warning buzzer / siren alarm.
   * Character: Rich multi-oscillator frequency sweep (460 Hz <-> 760 Hz) over 2 sustained cycles.
   * Duration: ~1.25s. Non-looping, attention-grabbing, no stuttered beeps.
   */
  public playAlertChime(): void {
    this.playEmergencyBuzzer();
  }

  public playEmergencyBuzzer(): void {
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const now = ctx.currentTime;
      const duration = 1.25; // seconds total

      // Master Compressor / Limiter to prevent clipping while maintaining loud punch
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-14, now);
      compressor.knee.setValueAtTime(8, now);
      compressor.ratio.setValueAtTime(6, now);
      compressor.attack.setValueAtTime(0.003, now);
      compressor.release.setValueAtTime(0.08, now);
      compressor.connect(ctx.destination);

      // Master Gain Envelope
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.001, now);
      // Fast attack to full commanding volume
      masterGain.gain.linearRampToValueAtTime(0.38, now + 0.02);
      // Sustain across two siren cycles with a subtle dip between cycles for natural acoustic alarm phrasing
      masterGain.gain.setValueAtTime(0.38, now + 0.55);
      masterGain.gain.linearRampToValueAtTime(0.28, now + 0.60);
      masterGain.gain.linearRampToValueAtTime(0.38, now + 0.65);
      masterGain.gain.setValueAtTime(0.38, now + 1.15);
      // Clean fast fade-out at end
      masterGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      masterGain.connect(compressor);

      // Low-pass Filter to shape the buzzer body and remove harsh ultrasonic grit
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2400, now);
      filter.Q.setValueAtTime(2.0, now);
      filter.connect(masterGain);

      // --- Oscillator 1: Primary Siren Sawtooth (460 Hz -> 760 Hz -> 460 Hz x 2 cycles) ---
      const osc1 = ctx.createOscillator();
      osc1.type = 'sawtooth';

      // Cycle 1: 0.00s -> 0.60s (Sweep up to 760 Hz, then down to 460 Hz)
      osc1.frequency.setValueAtTime(460, now);
      osc1.frequency.exponentialRampToValueAtTime(760, now + 0.28);
      osc1.frequency.exponentialRampToValueAtTime(460, now + 0.58);

      // Cycle 2: 0.60s -> 1.25s (Sweep up to 760 Hz, then down to 460 Hz)
      osc1.frequency.setValueAtTime(460, now + 0.60);
      osc1.frequency.exponentialRampToValueAtTime(760, now + 0.88);
      osc1.frequency.exponentialRampToValueAtTime(460, now + 1.20);

      const gain1 = ctx.createGain();
      gain1.gain.setValueAtTime(0.70, now);
      osc1.connect(gain1);
      gain1.connect(filter);

      // --- Oscillator 2: Harmonic Square Buzzer Core (adds raspy industrial alarm body) ---
      const osc2 = ctx.createOscillator();
      osc2.type = 'square';

      // Tuned at 1.5x fifth harmonic / octave sweep for authentic alarm resonance
      osc2.frequency.setValueAtTime(690, now);
      osc2.frequency.exponentialRampToValueAtTime(1140, now + 0.28);
      osc2.frequency.exponentialRampToValueAtTime(690, now + 0.58);

      osc2.frequency.setValueAtTime(690, now + 0.60);
      osc2.frequency.exponentialRampToValueAtTime(1140, now + 0.88);
      osc2.frequency.exponentialRampToValueAtTime(690, now + 1.20);

      const gain2 = ctx.createGain();
      gain2.gain.setValueAtTime(0.30, now);
      osc2.connect(gain2);
      gain2.connect(filter);

      // --- Oscillator 3: Sub-Buzzer Triangle (230 Hz base for heavy low-end authority) ---
      const osc3 = ctx.createOscillator();
      osc3.type = 'triangle';

      osc3.frequency.setValueAtTime(230, now);
      osc3.frequency.exponentialRampToValueAtTime(380, now + 0.28);
      osc3.frequency.exponentialRampToValueAtTime(230, now + 0.58);

      osc3.frequency.setValueAtTime(230, now + 0.60);
      osc3.frequency.exponentialRampToValueAtTime(380, now + 0.88);
      osc3.frequency.exponentialRampToValueAtTime(230, now + 1.20);

      const gain3 = ctx.createGain();
      gain3.gain.setValueAtTime(0.40, now);
      osc3.connect(gain3);
      gain3.connect(filter);

      // Start & Stop all sound generators synchronously
      osc1.start(now);
      osc2.start(now);
      osc3.start(now);

      osc1.stop(now + duration);
      osc2.stop(now + duration);
      osc3.stop(now + duration);
    } catch (err) {
      console.warn('[RoadGuardian:Sound] Emergency buzzer audio synthesis error:', err);
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
