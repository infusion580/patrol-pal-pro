/**
 * Sonido de alertas
 * -----------------
 * Genera un tono corto con WebAudio (sin assets) cuyo patrón depende de la
 * severidad de la alerta. Los navegadores bloquean el audio hasta que el
 * usuario interactúa, por eso el contexto se "desbloquea" en el primer
 * gesto (click / tecla / touch) y queda listo para sonar después.
 */
import type { NotifSeveridad } from './notification-types';

let ctx: AudioContext | null = null;
let unlocked = false;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || (window as any).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  return ctx;
}

/** Registra los listeners que habilitan el audio tras el primer gesto. */
export function initAlertSound() {
  if (typeof window === 'undefined' || unlocked) return;
  const unlock = () => {
    const c = getCtx();
    if (c && c.state === 'suspended') void c.resume();
    unlocked = true;
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
    window.removeEventListener('touchstart', unlock);
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
  window.addEventListener('touchstart', unlock);
}

/** Patrón de tonos por severidad: [frecuencia Hz, duración s] */
const PATTERNS: Record<NotifSeveridad, Array<[number, number]>> = {
  critica: [[880, 0.16], [660, 0.16], [880, 0.16], [660, 0.22]],
  alta: [[784, 0.14], [988, 0.2]],
  media: [[659, 0.12], [880, 0.16]],
  info: [[698, 0.12]],
};

const SILENT_KEY = 'defender_alert_sound_off';

export function isAlertSoundEnabled() {
  try { return localStorage.getItem(SILENT_KEY) !== '1'; } catch { return true; }
}

export function setAlertSoundEnabled(on: boolean) {
  try { localStorage.setItem(SILENT_KEY, on ? '0' : '1'); } catch { /* noop */ }
}

/** Reproduce el tono de una alerta. Silencioso si el usuario lo desactivó. */
export function playAlertSound(severidad: NotifSeveridad = 'info') {
  if (!isAlertSoundEnabled()) return;
  const c = getCtx();
  if (!c) return;
  if (c.state === 'suspended') void c.resume();

  let t = c.currentTime;
  for (const [freq, dur] of PATTERNS[severidad]) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
    t += dur + 0.05;
  }

  // Vibración en móvil para severidades altas.
  if (severidad === 'critica' || severidad === 'alta') {
    try { navigator.vibrate?.([120, 60, 120]); } catch { /* noop */ }
  }
}
