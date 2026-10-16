/**
 * @file ondas-canvas.js
 * @description Dibujo de ondas en canvas con barrido tipo monitor (el trazo avanza de
 * izquierda a derecha y borra por delante). También dibuja gráficas de tendencia.
 *
 * Se ejecuta en: AMBOS (DOM/canvas). Lee los búferes de motor.js; no modifica estado.
 */
import { FS } from '../core/config.js';

/** Píxeles de diseño por milímetro (pantalla de ~12" en 1024 px de ancho). */
export const PX_MM = 4;

/** Un canvas de onda con barrido. */
export class LienzoOnda {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {object} cfg { color, buf, escala:(v)=>y(0..1 desde arriba), velocidad:()=>mm/s, auto?:bool }
   */
  constructor(canvas, cfg) {
    this.c = canvas;
    this.ctx = canvas.getContext('2d');
    this.cfg = cfg;
    this.nDib = 0; // índice de la última muestra dibujada
    this.xPrev = null;
    this.yPrev = null;
    this.k = 1; // factor de resolución (escala × dpr)
    this.W = 0;
    this.H = 0;
  }

  /** Ajusta la resolución interna al tamaño de diseño `W×H` y al factor `k`. */
  ajustar(W, H, k) {
    const px = Math.max(1, Math.round(k));
    this.W = W;
    this.H = H;
    this.k = k;
    this.c.width = Math.round(W * k);
    this.c.height = Math.round(H * k);
    this.limpiar();
    void px;
  }

  limpiar() {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.c.width, this.c.height);
    this.xPrev = null;
    this.nDib = this.cfg.buf.n;
  }

  /** Dibuja las muestras nuevas desde el último cuadro. */
  dibujar() {
    const { buf, color, escala, velocidad } = this.cfg;
    const ctx = this.ctx;
    const W = this.W;
    const H = this.H;
    const pxMuestra = (velocidad() * PX_MM) / FS; // px de diseño por muestra
    let n = buf.n - this.nDib;
    if (n <= 0) return;
    if (n > FS * 2) {
      this.nDib = buf.n - FS * 2;
      n = FS * 2;
    }
    ctx.setTransform(this.k, 0, 0, this.k, 0, 0);
    ctx.lineWidth = 1.7;
    ctx.strokeStyle = color;
    ctx.lineJoin = 'round';
    const hueco = 14; // ancho del borrado por delante del trazo
    ctx.beginPath();
    let pen = this.xPrev !== null;
    let x = this.xPrev ?? 0;
    let y = this.yPrev ?? 0;
    for (let i = 0; i < n; i++) {
      const idx = this.nDib + i;
      const xn = (idx * pxMuestra) % W;
      const yn = escala(buf.leer(idx)) * H;
      if (xn < x) pen = false; // se cerró el barrido: levantar el lápiz
      // borrar la franja por delante
      ctx.clearRect(xn - 0.5, 0, pxMuestra + hueco, H);
      if (pen) ctx.lineTo(xn, yn);
      else ctx.moveTo(xn, yn);
      pen = true;
      x = xn;
      y = yn;
      // trazar por tramos para que el borrado no cubra lo recién dibujado
      if (i % 8 === 7) {
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y);
      }
    }
    ctx.stroke();
    this.xPrev = x;
    this.yPrev = y;
    this.nDib += n;
  }
}

/** Gráfica de tendencia simple (líneas) sobre un canvas. */
export function dibujarTendencia(canvas, series, { W, H, k = 1, minY = 0, maxY = 100, rejilla = 4, etiquetaY = true } = {}) {
  canvas.width = Math.round(W * k);
  canvas.height = Math.round(H * k);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#2a2a2a';
  ctx.fillStyle = '#9a9a9a';
  ctx.font = '10px sans-serif';
  ctx.lineWidth = 1;
  for (let i = 0; i <= rejilla; i++) {
    const y = 4 + ((H - 8) * i) / rejilla;
    ctx.beginPath();
    ctx.moveTo(30, y);
    ctx.lineTo(W, y);
    ctx.stroke();
    if (etiquetaY) ctx.fillText(String(Math.round(maxY - ((maxY - minY) * i) / rejilla)), 2, y + 3);
  }
  for (const s of series) {
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    let pen = false;
    const n = s.datos.length;
    s.datos.forEach((v, i) => {
      if (v === null || v === undefined) {
        pen = false;
        return;
      }
      const x = 30 + ((W - 34) * i) / Math.max(n - 1, 1);
      const y = 4 + (H - 8) * (1 - (v - minY) / (maxY - minY));
      if (pen) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
      pen = true;
    });
    ctx.stroke();
  }
}
