/**
 * @file ecg-modelo.js
 * @description Modelo matemático de la señal de ECG (12 derivaciones).
 *
 * Se ejecuta en: AMBOS (monitor y proyección). No usa el DOM.
 *
 * ¿Cómo funciona?
 *  - Un "generador de ritmo" (ver ritmos.js) produce EVENTOS en el tiempo:
 *      · { tipo: 'P',   t, f }   onda P (activación auricular)
 *      · { tipo: 'QRS', t, f }   complejo QRS + segmento ST + onda T
 *      · { tipo: 'SPIKE', t }    espícula de marcapasos sin complejo
 *  - Este módulo convierte esos eventos en voltaje (mV) para cualquier
 *    derivación y cualquier instante, sumando gaussianas (P, Q, R, S, T).
 *  - La proyección en cada derivación sigue la regla del manual del curso:
 *    "cuando el vector se aproxima al electrodo se inscribe una onda positiva".
 */
import { gauss, sigmoide, limitar } from '../core/utilidades.js';

/** Ángulo de cada derivación del plano frontal (sistema hexaaxial de Bailey). */
const ANGULO = { I: 0, II: 60, III: 120, aVR: -150, aVL: -30, aVF: 90 };

/** Eje medio de la onda P (grados). */
const EJE_P = 55;

/**
 * Pesos precordiales [r, s, q, t, p] relativos a una R de 1 mV.
 * Reproducen la "progresión de la R de V1 a V6" (rS en V1-V2 → qR en V5-V6).
 */
const PRECORDIALES = {
  V1: { r: 0.18, s: 1.0, q: 0, t: 0.15, p: 0.5 },
  V2: { r: 0.35, s: 1.1, q: 0, t: 0.65, p: 0.5 },
  V3: { r: 0.7, s: 0.7, q: 0, t: 0.8, p: 0.4 },
  V4: { r: 1.2, s: 0.35, q: 0.05, t: 0.8, p: 0.4 },
  V5: { r: 1.3, s: 0.12, q: 0.12, t: 0.65, p: 0.35 },
  V6: { r: 1.1, s: 0.06, q: 0.15, t: 0.5, p: 0.3 },
};

/** Pesos (con signo) de complejos ANCHOS ventriculares por derivación. */
const ANCHO_PESOS = {
  // Morfología tipo bloqueo de rama izquierda (BRI) / origen ventricular derecho
  bri: { I: 0.9, II: 0.55, III: -0.2, aVR: -0.75, aVL: 0.85, aVF: 0.15, V1: -1.1, V2: -1.1, V3: -0.8, V4: -0.2, V5: 0.9, V6: 1.0 },
  // Morfología tipo bloqueo de rama derecha (BRD) / origen ventricular izquierdo
  brd: { I: -0.5, II: -0.5, III: -0.4, aVR: 0.6, aVL: -0.2, aVF: -0.6, V1: 1.0, V2: 0.9, V3: 0.5, V4: 0.1, V5: -0.5, V6: -0.8 },
};

/**
 * Patrones de isquemia/lesión: peso del ST por derivación (+ elevación / − descenso)
 * y factor de la onda T (para isquemia subepicárdica con T invertida o hiperaguda).
 * Fuente: secciones "El ECG en la cardiopatía isquémica" y "Localización del IAM".
 */
export const PATRONES_ISQUEMIA = {
  ninguno: { nombre: 'Sin alteraciones', st: {}, t: {}, q: {} },
  iam_inferior: {
    nombre: 'IAM inferior (II, III, aVF)',
    st: { II: 1, III: 1.3, aVF: 1.15, aVL: -0.7, I: -0.4, V1: -0.25, V2: -0.3, V5: 0.2, V6: 0.3 },
    t: {},
    q: { III: 1, aVF: 0.8, II: 0.5 },
  },
  iam_anterior: {
    nombre: 'IAM anterior (V1–V4)',
    st: { V1: 0.6, V2: 1.2, V3: 1.35, V4: 1.0, V5: 0.5, V6: 0.2, I: 0.3, aVL: 0.4, III: -0.3, aVF: -0.3 },
    t: {},
    q: { V1: 0.6, V2: 1, V3: 1, V4: 0.7 },
  },
  iam_anterolateral: {
    nombre: 'IAM anterolateral (extenso)',
    st: { I: 0.8, aVL: 1, V1: 0.5, V2: 1, V3: 1.2, V4: 1.2, V5: 1, V6: 0.9, III: -0.5, aVF: -0.4 },
    t: {},
    q: { I: 0.5, aVL: 0.7, V3: 0.8, V4: 0.8, V5: 0.6 },
  },
  iam_lateral: {
    nombre: 'IAM lateral (I, aVL, V5–V6)',
    st: { I: 0.8, aVL: 1, V5: 0.9, V6: 0.8, II: 0.2, III: -0.5, aVF: -0.4 },
    t: {},
    q: { aVL: 0.7, I: 0.5 },
  },
  iam_posterior: {
    nombre: 'IAM posterior (descenso ST en V1–V3)',
    st: { V1: -1, V2: -1.2, V3: -0.8 },
    t: { V1: 1.8, V2: 2 },
    q: {},
  },
  subendocardica: {
    nombre: 'Lesión subendocárdica (descenso difuso del ST)',
    st: { I: -0.8, II: -1, III: -0.5, aVF: -0.9, aVL: -0.4, V3: -0.9, V4: -1.1, V5: -1.2, V6: -1.1, aVR: 0.8 },
    t: {},
    q: {},
  },
  pericarditis: {
    nombre: 'Pericarditis (ST cóncavo difuso, sin cambios recíprocos)',
    st: { I: 0.7, II: 0.8, III: 0.5, aVF: 0.7, aVL: 0.3, V2: 0.5, V3: 0.8, V4: 0.9, V5: 0.9, V6: 0.8, aVR: -0.7 },
    t: {},
    q: {},
  },
  isquemia_subepicardica: {
    nombre: 'Isquemia subepicárdica (T invertida simétrica)',
    st: {},
    t: { I: -1.6, II: -1.4, aVL: -1.5, aVF: -1.2, V2: -1.8, V3: -2.2, V4: -2.4, V5: -2.2, V6: -1.8 },
    q: {},
  },
  isquemia_hiperaguda: {
    nombre: 'Isquemia subendocárdica / T hiperaguda (alta y picuda)',
    st: {},
    t: { V2: 2.2, V3: 2.8, V4: 2.8, V5: 2.2, V6: 1.6, II: 1.4, aVF: 1.4 },
    q: {},
  },
};

/** Opciones de hipertrofia/crecimiento de cavidades (sección HIPERTROFIA del manual). */
export const HIPERTROFIAS = {
  ninguna: 'Sin hipertrofia',
  HVI: 'Hipertrofia ventricular izquierda',
  HVD: 'Hipertrofia ventricular derecha',
  AI: 'Crecimiento auricular izquierdo (P mitral)',
  AD: 'Crecimiento auricular derecho (P pulmonale)',
  biauricular: 'Crecimiento biauricular',
};

/**
 * Pesos [r, s, q, t, p] de una derivación para un eje dado.
 * @param {string} lead derivación
 * @param {number} eje eje del QRS en grados
 */
export function pesosDerivacion(lead, eje) {
  if (PRECORDIALES[lead]) return { ...PRECORDIALES[lead] };
  const ang = ANGULO[lead];
  const n = Math.cos(((ang - eje) * Math.PI) / 180); // proyección del vector QRS
  const ejeT = limitar(eje - 15, -30, 75);
  return {
    r: Math.max(n, 0) + 0.05,
    s: 0.9 * Math.max(-n, 0) + 0.04,
    q: 0.1 * Math.max(n, 0.2),
    t: Math.cos(((ang - ejeT) * Math.PI) / 180),
    p: Math.cos(((ang - EJE_P) * Math.PI) / 180),
  };
}

/**
 * Aplica los efectos de la hipertrofia a los pesos de una derivación.
 * Devuelve además un ST adicional (mV) por "sobrecarga" de repolarización.
 */
function aplicarHipertrofia(hip, lead, w) {
  let stExtra = 0;
  if (hip === 'HVI') {
    if (['V4', 'V5', 'V6', 'I', 'aVL'].includes(lead)) w.r *= lead.startsWith('V') ? 1.9 : 1.5;
    if (['V1', 'V2'].includes(lead)) w.s *= 1.8;
    if (['V5', 'V6', 'I', 'aVL'].includes(lead)) {
      stExtra = -0.13;
      w.t *= -0.5;
    }
  } else if (hip === 'HVD') {
    if (lead === 'V1') {
      w.r = 1.2;
      w.s = 0.5;
    }
    if (lead === 'V2') w.r *= 2.2;
    if (['V5', 'V6'].includes(lead)) w.s = 0.65;
    if (['V1', 'V2', 'V3'].includes(lead)) {
      w.t *= -0.7;
      stExtra = lead === 'V1' ? -0.08 : 0;
    }
  }
  return stExtra;
}

/** Onda P: gaussiana (o bimodal si hay crecimiento auricular izquierdo). */
function ondaP(t, ev, lead, hip) {
  const f = ev.f || {};
  let amp = 0.14 * (f.amp ?? 1);
  const w = lead.startsWith('V') ? PRECORDIALES[lead].p : Math.cos(((ANGULO[lead] - EJE_P) * Math.PI) / 180);
  if (hip === 'AD' || hip === 'biauricular') amp *= 2.2; // P alta y picuda (≥ 2.5 mm)
  let sigma = 0.022;
  if (hip === 'AI' || hip === 'biauricular') sigma = 0.034; // P ancha (≥ 0.12 s)
  let v = amp * w * gauss(t, 0, sigma);
  if (hip === 'AI' || hip === 'biauricular') {
    v = amp * w * 0.8 * (gauss(t, -0.022, 0.026) + 0.9 * gauss(t, 0.028, 0.026)); // P bimodal ("P mitral")
    if (lead === 'V1') v -= amp * 0.6 * gauss(t, 0.035, 0.022); // fase negativa terminal en V1
  }
  return v;
}

/**
 * Voltaje de un complejo QRS-ST-T en `t` segundos desde el inicio del QRS.
 * @param {number} t tiempo relativo al inicio del QRS
 * @param {object} f forma del latido (morf, ancho, amp, tAmp, qt, st, ...)
 * @param {string} lead derivación
 * @param {object} cfg configuración global del ECG (eje, voltaje, st, patrón, hipertrofia)
 */
function ondaQRST(t, f, lead, cfg) {
  const W = f.ancho ?? 0.09;
  const R0 = (f.amp ?? 1) * cfg.voltaje;
  const morf = f.morf || 'normal';
  const qt = f.qt ?? 0.4;
  let v = 0;

  // Espícula de marcapasos (marca visible en todas las derivaciones)
  if (f.spike && t >= -0.012 && t < -0.002) v += 1.3;

  if (morf === 'V' || morf === 'marcapasos' || morf === 'escape' || morf === 'BRI') {
    // Complejos anchos: deflexión principal ancha + T discordante
    const tipo = f.vMorf === 'brd' ? 'brd' : 'bri';
    const peso = ANCHO_PESOS[tipo][lead] ?? 0.5;
    const A = 1.35 * R0 * (f.polaridad ?? 1);
    v += A * peso * gauss(t, 0.48 * W, 0.2 * W);
    if (morf === 'BRI') v += 0.45 * A * peso * gauss(t, 0.72 * W, 0.09 * W); // empastamiento/muesca
    const sg = Math.sign(peso) || 1;
    v += -sg * Math.abs(A) * 0.4 * (f.tAmp ?? 1) * gauss(t, W + 0.1, 0.08);
    return v;
  }

  if (morf === 'BRD') {
    // rsR' en V1-V2; S ancha y empastada en I, aVL, V5, V6; T discordante
    const izq = ['I', 'aVL', 'V5', 'V6', 'II'].includes(lead);
    if (['V1', 'V2'].includes(lead)) {
      v += 0.35 * R0 * gauss(t, 0.18 * W, 0.07 * W);
      v -= 0.3 * R0 * gauss(t, 0.42 * W, 0.08 * W);
      v += 1.15 * R0 * gauss(t, 0.74 * W, 0.15 * W);
      v -= 0.4 * R0 * gauss(t, W + 0.12, 0.08);
    } else if (izq) {
      v -= 0.1 * R0 * gauss(t, 0.15 * W, 0.06 * W);
      v += 1.0 * R0 * gauss(t, 0.32 * W, 0.1 * W);
      v -= 0.55 * R0 * gauss(t, 0.8 * W, 0.18 * W);
      v += 0.2 * R0 * gauss(t, W + 0.12, 0.08);
    } else {
      const w = pesosDerivacion(lead, cfg.eje);
      v += R0 * (w.r * gauss(t, 0.4 * W, 0.12 * W) - w.s * gauss(t, 0.75 * W, 0.14 * W));
    }
    return v;
  }

  // ----- Morfología normal (también HiperK, WPW) -----
  const w = pesosDerivacion(lead, cfg.eje);
  const ea = aplicarHipertrofia(cfg.hipertrofia, lead, w);
  const pat = PATRONES_ISQUEMIA[cfg.patron] || PATRONES_ISQUEMIA.ninguno;
  const q = R0 * (w.q + (pat.q[lead] || 0) * 0.9 * (cfg.st > 0 ? 1 : 0) * (cfg.st > 0.25 ? 1 : 0.5));
  const qAncho = pat.q[lead] && cfg.st > 0 ? 1.7 : 1; // onda Q patológica: más ancha/profunda

  v += -q * gauss(t, 0.16 * W, 0.06 * W * qAncho);
  v += R0 * w.r * gauss(t, 0.45 * W, 0.1 * W);
  v += -R0 * w.s * gauss(t, 0.72 * W, 0.09 * W);

  // Onda delta (preexcitación, WPW): empastamiento inicial del QRS
  if (f.delta) v += f.delta * R0 * Math.max(w.r, 0.2) * gauss(t, 0.1 * W, 0.12 * W);

  // Segmento ST: meseta entre el punto J y la onda T
  const tc = qt - 0.1; // centro de la onda T
  const stLead = cfg.st * (pat.st[lead] ?? 0) + (f.st || 0) * Math.max(w.r, 0.2) + ea;
  if (stLead !== 0) v += stLead * (sigmoide((t - W) / 0.01) - sigmoide((t - (tc + 0.02)) / 0.035));

  // Onda T asimétrica (ascenso lento, descenso rápido)
  let tw = w.t * (pat.t[lead] ?? 1) * (f.tAmp ?? 1);
  if (cfg.st <= 0 && cfg.patron !== 'ninguno') tw = w.t * (f.tAmp ?? 1);
  const amp = 0.32 * R0 * tw;
  const sUp = (f.tSigma ?? 1) * 0.065;
  const sDn = (f.tSigma ?? 1) * 0.045;
  v += amp * gauss(t, tc, t < tc ? sUp : sDn);
  return v;
}

/** Duración de la ventana (s) durante la cual un evento puede aportar señal. */
function ventana(ev) {
  if (ev.tipo === 'P') return { ini: -0.15, fin: 0.15 };
  if (ev.tipo === 'SPIKE') return { ini: -0.02, fin: 0.01 };
  const f = ev.f || {};
  const qt = f.qt ?? 0.4;
  return { ini: -0.03, fin: Math.max(qt + 0.25, (f.ancho ?? 0.09) + 0.35) };
}

/**
 * Calcula el voltaje total (mV) de una derivación en el instante `ts`.
 * @param {Array} eventos eventos activos (ordenados por t)
 * @param {number} ts instante en segundos
 * @param {string} lead derivación
 * @param {object} cfg configuración global del ECG
 */
export function voltajeEventos(eventos, ts, lead, cfg) {
  let v = 0;
  for (const ev of eventos) {
    const t = ts - ev.t;
    const { ini, fin } = ventana(ev);
    if (t < ini || t > fin) continue;
    if (ev.f && ev.f.visible === false) continue;
    if (ev.tipo === 'P') {
      v += ondaP(t, ev, lead, cfg.hipertrofia);
    } else if (ev.tipo === 'QRS') {
      v += ondaQRST(t, ev.f, lead, cfg);
    } else if (ev.tipo === 'SPIKE') {
      if (t >= -0.012 && t < -0.002) v += 1.3;
    }
  }
  return v;
}

/** Peso del fondo fibrilatorio/flúter por derivación (ondas f / F continuas). */
export const PESO_FONDO = {
  fib: { I: 0.5, II: 0.6, III: 0.5, aVR: 0.4, aVL: 0.4, aVF: 0.5, V1: 1, V2: 0.8, V3: 0.6, V4: 0.5, V5: 0.4, V6: 0.4 },
  flutter: { I: 0.25, II: 1, III: 1, aVR: -0.8, aVL: 0.2, aVF: 1, V1: -0.5, V2: -0.4, V3: 0.3, V4: 0.4, V5: 0.5, V6: 0.5 },
};
