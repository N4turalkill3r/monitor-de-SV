/**
 * @file sonidos.js
 * @description Sonidos sintetizados con Web Audio: pitido de latido (con tono de SpO2
 * que baja al disminuir la saturación), alarmas por prioridad (patrones tipo
 * IEC 60601-1-8), clic de teclas, fin de PANI y sonidos del desfibrilador.
 *
 * Se ejecuta en: AMBOS. El audio sólo puede iniciarse tras un gesto del usuario
 * (por eso el monitor "arranca apagado": el botón de encendido crea el contexto).
 * No hay archivos de audio: todo se genera, así funciona sin conexión.
 */

/** Patrón de cada prioridad: frecuencia, nº de pulsos por ráfaga, ráfagas y periodo (s). */
const PATRONES = {
  alta: { f: 988, pulsos: 5, rafagas: 2, gap: 0.2, entreRafagas: 0.35, periodo: 4.5 },
  media: { f: 784, pulsos: 3, rafagas: 1, gap: 0.24, entreRafagas: 0, periodo: 6 },
  baja: { f: 659, pulsos: 2, rafagas: 1, gap: 0.3, entreRafagas: 0, periodo: 12 },
};

export class Sonidos {
  /** @param {import('../core/estado.js').Estado} estado */
  constructor(estado) {
    this.e = estado;
    this.ctx = null;
    this.proximaAlarma = 0;
    this.nivelPrevio = null;
    /** Silencio local de esta ventana (la proyección arranca silenciada hasta que se active el audio). */
    this.silenciado = false;
    /** Si es true, también se respeta el ajuste compartido 'sistema.silencioLocal' (sólo en la maestra). */
    this.usarAjusteEstado = true;
  }

  /** Crea/reanuda el AudioContext (llamar desde un gesto del usuario). */
  activar() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.maestro = this.ctx.createGain();
        this.maestro.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch (e) {
      console.warn('Audio no disponible', e);
    }
  }

  /** ¿Se puede emitir sonido en esta ventana? */
  _ok() {
    return this.ctx && this.ctx.state === 'running' && !this.silenciado && !(this.usarAjusteEstado && this.e.obtener('sistema.silencioLocal')) && this.e.obtener('sistema.encendido');
  }

  /** Reproduce un tono corto. `tipo`: sine | square | triangle. */
  _tono({ f, dur = 0.08, vol = 0.3, tipo = 'sine', t0 = 0, f2 = null, arm = false }) {
    if (!this._ok()) return;
    const c = this.ctx;
    const t = c.currentTime + t0;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = tipo;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.linearRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(vol, 0.0002), t + 0.008);
    g.gain.setValueAtTime(Math.max(vol, 0.0002), t + Math.max(dur - 0.02, 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.maestro);
    if (arm) {
      // Armónico para sonido más "electrónico" (alarmas)
      const o2 = c.createOscillator();
      o2.type = 'sine';
      o2.frequency.setValueAtTime(f * 2, t);
      const g2 = c.createGain();
      g2.gain.value = 0.35;
      o2.connect(g2).connect(g);
      o2.start(t);
      o2.stop(t + dur + 0.02);
    }
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  /** Pitido de latido. Si hay SpO2, el tono sube/baja con la saturación (manual cap. 11). */
  latido(spo2 = null) {
    const vol = this.e.obtener('sistema.volLatido');
    if (!vol) return;
    const usaSpo2 = spo2 !== null && this.e.obtener('spo2.tono');
    const f = usaSpo2 ? 420 + Math.max(0, Math.min(30, spo2 - 70)) * 25 : 900;
    this._tono({ f, dur: 0.07, vol: 0.05 * vol });
  }

  /** Clic de tecla (volumen de teclas). */
  tecla() {
    const vol = this.e.obtener('sistema.volTeclas');
    if (vol) this._tono({ f: 1800, dur: 0.025, vol: 0.03 * vol, tipo: 'square' });
  }

  /** Doble pitido al terminar una medición de PANI. */
  nibpFin() {
    this._tono({ f: 880, dur: 0.12, vol: 0.12 });
    this._tono({ f: 1175, dur: 0.18, vol: 0.12, t0: 0.16 });
  }

  /** Carga del desfibrilador: tono ascendente que termina en pitido continuo corto. */
  carga(dur = 2) {
    this._tono({ f: 300, f2: 1400, dur, vol: 0.12, tipo: 'sawtooth' });
    this._tono({ f: 1400, dur: 0.5, vol: 0.12, t0: dur });
  }

  /** Descarga: golpe grave breve. */
  descarga() {
    this._tono({ f: 120, f2: 40, dur: 0.25, vol: 0.45, tipo: 'triangle' });
  }

  /**
   * Gestiona el sonido de alarma. Se llama ~10 veces por segundo con el nivel más alto
   * activo (o null) y si el audio está permitido (no hay pausa ni apagado).
   */
  alarma(nivel, permitido, ahoraReal) {
    if (!nivel || !permitido) {
      this.nivelPrevio = null;
      return;
    }
    const subio = this.nivelPrevio !== nivel;
    this.nivelPrevio = nivel;
    if (!subio && ahoraReal < this.proximaAlarma) return;
    const p = PATRONES[nivel];
    const vol = 0.06 * this.e.obtener('sistema.volAlarma');
    let t = 0;
    for (let r = 0; r < p.rafagas; r++) {
      for (let i = 0; i < p.pulsos; i++) {
        this._tono({ f: p.f, dur: 0.11, vol, tipo: 'triangle', t0: t, arm: true });
        t += p.gap;
      }
      t += p.entreRafagas;
    }
    this.proximaAlarma = ahoraReal + p.periodo;
  }
}
