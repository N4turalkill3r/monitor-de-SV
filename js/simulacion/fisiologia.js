/**
 * @file fisiologia.js
 * @description Formas de onda NO eléctricas: pletismografía (SpO2), presión arterial
 * invasiva, respiración por impedancia y capnograma (CO2).
 *
 * Se ejecuta en: AMBOS. Funciones puras (sin DOM, sin estado propio).
 */
import { gauss, limitar, sigmoide } from '../core/utilidades.js';

/**
 * Pulso de pletismografía en `t` segundos desde la llegada de la onda de pulso.
 * Ascenso rápido (sístole), descenso lento y muesca dicrótica pequeña.
 * Devuelve 0..1 (1 = pico).
 */
export function pulsoPleth(t, rr = 0.8) {
  if (t < 0) return 0;
  const tau = limitar(0.3 * (rr / 0.8), 0.1, 0.32);
  const subida = 0.13;
  if (t < subida) return Math.sin((Math.PI / 2) * (t / subida)) ** 1.5;
  const caida = Math.exp(-(t - subida) / tau);
  const dicroto = 0.1 * gauss(t, subida + 0.2 * (rr / 0.8) + 0.08, 0.04);
  return caida * 0.97 + dicroto;
}

/**
 * Pulso de presión arterial invasiva (ART). Parecido al pletismograma pero con
 * muesca dicrótica más marcada y ascenso más brusco.
 */
export function pulsoArterial(t, rr = 0.8) {
  if (t < 0) return 0;
  const k = rr / 0.8;
  const tau = limitar(0.36 * k, 0.12, 0.38);
  const subida = 0.09;
  if (t < subida) return Math.sin((Math.PI / 2) * (t / subida));
  const base = Math.exp(-(t - subida) / tau);
  const tn = subida + 0.2 * Math.max(k, 0.5); // instante de la muesca dicrótica
  const muesca = -0.09 * gauss(t, tn, 0.012) + 0.12 * gauss(t, tn + 0.05 * Math.max(k, 0.5), 0.035);
  return limitar(base + muesca, 0, 1.05);
}

/** Respiración por impedancia: onda suave y ligeramente asimétrica (fase 0..1). */
export function ondaResp(fase) {
  const x = 2 * Math.PI * fase;
  return 0.5 - 0.5 * Math.cos(x) + 0.08 * Math.sin(2 * x);
}

/**
 * Capnograma en mmHg para la fase respiratoria `fase` (0..1).
 *  - normal: línea basal → ascenso rápido → meseta ligeramente ascendente → descenso brusco.
 *  - broncoespasmo: "aleta de tiburón" (ascenso lento sin meseta).
 *  - rebreathing: línea basal elevada (reinhalación de CO2).
 * @param {number} fase 0..1 (0 = inicio de la espiración)
 * @param {number} etco2 valor de CO2 al final de la espiración
 * @param {number} fico2 CO2 inspirado (línea basal)
 * @param {string} patron normal | broncoespasmo | rebreathing
 */
export function capnograma(fase, etco2, fico2, patron = 'normal') {
  const base = patron === 'rebreathing' ? Math.max(fico2, 0.25 * etco2) : fico2;
  const amp = Math.max(etco2 - base, 0);
  const subeEn = 0.42; // la espiración comienza tras la inspiración (≈ 40 % del ciclo)
  const baja = 0.96;
  if (patron === 'broncoespasmo') {
    const a = fase < subeEn ? 0 : 1 - Math.exp(-(fase - subeEn) / 0.2);
    const d = 1 - sigmoide((fase - baja) / 0.008);
    return base + amp * a * d * 1.05;
  }
  const subida = sigmoide((fase - subeEn) / 0.012);
  const meseta = 0.9 + 0.1 * limitar((fase - subeEn) / (baja - subeEn), 0, 1);
  const bajada = 1 - sigmoide((fase - baja) / 0.007);
  return base + amp * subida * meseta * bajada;
}

/** Barra de "intensidad de pulso" (0..10 segmentos) a partir de la perfusión (%). */
export const barrasPulso = (perfusion) => Math.round(limitar(perfusion, 0, 100) / 10);
