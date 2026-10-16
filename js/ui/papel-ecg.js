/**
 * @file papel-ecg.js
 * @description Papel de ECG milimetrado (25 mm/s, 10 mm/mV): informe de 12 derivaciones
 * (3×4 + tira de ritmo) o tira de una derivación, con calibrador (calipers) para medir
 * intervalos y frecuencia como indica el protocolo FRI-EHI.
 *
 * Se ejecuta en: AMBOS (canvas). Lee del motor con `segmentoEcg` (calidad diagnóstica).
 */
import { FS, DERIVACIONES } from '../core/config.js';

/** Disposición estándar 3×4 del ECG de 12 derivaciones. */
const DISPOSICION = [
  ['I', 'aVR', 'V1', 'V4'],
  ['II', 'aVL', 'V2', 'V5'],
  ['III', 'aVF', 'V3', 'V6'],
];

export class PapelEcg {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {import('../simulacion/motor.js').Motor} motor
   * @param {{layout?:'doce'|'tira', lead?:string, dur?:number}} opc
   */
  constructor(canvas, motor, { layout = 'doce', lead = 'II', dur = 10 } = {}) {
    this.c = canvas;
    this.motor = motor;
    this.layout = layout;
    this.lead = lead;
    this.dur = layout === 'doce' ? 10 : dur;
    this.datos = {};
    this.marcas = []; // posiciones x (en s desde el inicio de la tira) del calibrador
    this.titulo = '';
    this.pie = '';
    canvas.addEventListener('pointerdown', (e) => this._clic(e));
  }

  /** Captura los últimos `dur` segundos de las derivaciones necesarias. */
  capturar(titulo = '') {
    const leads = this.layout === 'doce' ? DERIVACIONES : [this.lead];
    const tFin = this.motor.t - 0.3;
    this.datos = {};
    for (const l of leads) this.datos[l] = this.motor.segmentoEcg(l, tFin, this.dur);
    if (this.layout === 'doce') this.datos.ritmo = this.datos.II;
    this.titulo = titulo;
    this.marcas = [];
    this.render();
  }

  /** Cambia la derivación de la tira y recaptura. */
  fijarDerivacion(lead) {
    this.lead = lead;
    this.capturar(this.titulo);
  }

  _clic(e) {
    const r = this.c.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * this.W;
    const t = (x - this.margen) / (this.pxMm * 25);
    if (t < 0 || t > this.dur) return;
    if (this.marcas.length >= 2) this.marcas = [];
    this.marcas.push(t);
    this.render();
    if (this.alMedir && this.marcas.length === 2) {
      const d = Math.abs(this.marcas[1] - this.marcas[0]);
      this.alMedir({ ms: Math.round(d * 1000), fc: Math.round(60 / d) });
    }
  }

  render() {
    const c = this.c;
    const rect = c.getBoundingClientRect();
    const W = Math.max(rect.width, 300);
    const filas = this.layout === 'doce' ? 4 : 1;
    const H = this.layout === 'doce' ? Math.max(rect.height, 260) : Math.max(rect.height, 140);
    const k = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.round(W * k);
    c.height = Math.round(H * k);
    const g = c.getContext('2d');
    g.setTransform(k, 0, 0, k, 0, 0);
    this.W = W;
    this.margen = 8;
    const util = W - this.margen * 2;
    this.pxMm = util / (this.dur * 25);
    const pxMm = this.pxMm;
    // Fondo y rejilla (1 mm fina, 5 mm gruesa)
    g.fillStyle = '#fff8f6';
    g.fillRect(0, 0, W, H);
    for (let x = this.margen; x <= W - this.margen + 0.1; x += pxMm) {
      const gruesa = Math.round((x - this.margen) / pxMm) % 5 === 0;
      g.strokeStyle = gruesa ? '#f0a8a0' : '#f9d6d1';
      g.lineWidth = gruesa ? 0.9 : 0.5;
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, H);
      g.stroke();
    }
    for (let y = 0; y <= H; y += pxMm) {
      const gruesa = Math.round(y / pxMm) % 5 === 0;
      g.strokeStyle = gruesa ? '#f0a8a0' : '#f9d6d1';
      g.lineWidth = gruesa ? 0.9 : 0.5;
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(W, y);
      g.stroke();
    }
    g.strokeStyle = '#111';
    g.fillStyle = '#111';
    g.lineWidth = 1.1;
    g.font = '11px sans-serif';

    const mmPorMv = 10;
    const trazar = (arr, x0, ini, n, yBase, etiqueta) => {
      g.beginPath();
      for (let i = 0; i < n; i++) {
        const x = x0 + (i / FS) * 25 * pxMm;
        const y = yBase - (arr[ini + i] || 0) * mmPorMv * pxMm;
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
      if (etiqueta) g.fillText(etiqueta, x0 + 4, yBase - 12 * pxMm);
    };

    if (this.layout === 'doce') {
      const alturaFila = (H - 14) / 4;
      const nCol = Math.round(2.5 * FS);
      DISPOSICION.forEach((fila, r) => {
        const yBase = 14 + alturaFila * r + alturaFila * 0.58;
        this._calibracion(g, this.margen, yBase, pxMm);
        fila.forEach((lead, col) => {
          const colW = util / 4;
          const desp = col === 0 ? 6 * pxMm : 0; // la 1.ª columna deja sitio al pulso de calibración
          const x0 = this.margen + col * colW + desp;
          trazar(this.datos[lead] || [], x0, col * nCol, nCol - (col === 0 ? 60 : 1), yBase, lead);
          if (col > 0) {
            g.strokeStyle = '#555';
            g.beginPath();
            g.moveTo(x0, yBase - 3 * pxMm);
            g.lineTo(x0, yBase + 3 * pxMm);
            g.stroke();
            g.strokeStyle = '#111';
          }
        });
      });
      const yR = 14 + alturaFila * 3 + alturaFila * 0.58;
      this._calibracion(g, this.margen, yR, pxMm);
      trazar(this.datos.ritmo || [], this.margen + 6 * pxMm, 0, this.dur * FS - 60, yR, 'II (ritmo)');
      g.fillStyle = '#333';
      g.fillText(`${this.titulo}  ·  25 mm/s  ·  10 mm/mV`, this.margen + 2, 11);
    } else {
      const yBase = H * 0.6;
      this._calibracion(g, this.margen, yBase, pxMm);
      trazar(this.datos[this.lead] || [], this.margen + 6 * pxMm, 0, this.dur * FS - 60, yBase, this.lead);
      g.fillStyle = '#333';
      g.fillText(`${this.titulo}  ·  25 mm/s  ·  10 mm/mV  ·  cuadro grande = 0.20 s`, this.margen + 2, 11);
    }
    // Calibrador
    if (this.marcas.length) {
      g.strokeStyle = '#1565c0';
      g.fillStyle = '#1565c0';
      g.lineWidth = 1.2;
      const xs = this.marcas.map((t) => this.margen + t * 25 * pxMm);
      for (const x of xs) {
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x, H);
        g.stroke();
      }
      if (xs.length === 2) {
        const d = Math.abs(this.marcas[1] - this.marcas[0]);
        g.beginPath();
        g.moveTo(xs[0], 24);
        g.lineTo(xs[1], 24);
        g.stroke();
        g.font = 'bold 12px sans-serif';
        g.fillText(`${Math.round(d * 1000)} ms  (${(d * 25).toFixed(1)} mm)  →  ${Math.round(60 / d)} lpm`, Math.min(xs[0], xs[1]) + 4, 20);
      }
    }
  }

  /** Pulso de calibración de 1 mV (10 mm de alto, 5 mm de ancho). */
  _calibracion(g, x, yBase, pxMm) {
    g.beginPath();
    g.moveTo(x, yBase);
    g.lineTo(x + 1 * pxMm, yBase);
    g.lineTo(x + 1 * pxMm, yBase - 10 * pxMm);
    g.lineTo(x + 4 * pxMm, yBase - 10 * pxMm);
    g.lineTo(x + 4 * pxMm, yBase);
    g.lineTo(x + 5 * pxMm, yBase);
    g.stroke();
  }
}
