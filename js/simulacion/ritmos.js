/**
 * @file ritmos.js
 * @description Catálogo de ritmos cardíacos y su GENERADOR de eventos.
 *
 * Se ejecuta en: AMBOS (monitor y proyección). No usa el DOM.
 *
 * Idea central: cada ritmo es una función `paso(g)` que, al llamarse, añade a la cola
 * los eventos (ondas P, complejos QRS, espículas) de UN ciclo y adelanta el reloj
 * `g.t`. El modelo de ondas (ecg-modelo.js) convierte esos eventos en voltaje.
 *
 * Formato de los eventos (ver ecg-modelo.js):
 *   { tipo:'P',     t, f:{ amp } }
 *   { tipo:'QRS',   t, f:{ morf, ancho, amp, qt, tAmp, tSigma, delta, spike, vMorf,
 *                          polaridad, perf } }
 *   { tipo:'SPIKE', t }
 * `f.perf` (0..1) = eficacia mecánica del latido (alimenta la pletismografía y el
 * pulso). Un latido ventricular prematuro tiene perf ≈ 0.4; la AESP tiene perf = 0.
 *
 * Opciones comunes a todos los ritmos con conducción sinusal (campo `g.op`):
 *   pr (s), qrs (s), qtc (s)   ← los modifica el instructor en "Intervalos".
 */
import { limitar, normal } from '../core/utilidades.js';
import { PESO_FONDO } from './ecg-modelo.js';

/* ------------------------------------------------------------------ *
 * Ayudantes comunes
 * ------------------------------------------------------------------ */

/** QT según Bazett: QT = QTc · √RR, acotado a valores fisiológicos. */
const qtDe = (rr, qtc = 0.4) => limitar(qtc * Math.sqrt(rr), 0.18, 0.72);

/** Intervalo PR por defecto: se acorta ligeramente al subir la frecuencia. */
const prAuto = (g) => g.op.pr ?? limitar(0.16 - (g.fc - 75) * 0.0004, 0.11, 0.2);

/** Forma base de un latido conducido normalmente (QRS estrecho). */
const formaBase = (g, rr, extra = {}) => ({
  ancho: g.op.qrs ?? 0.09,
  qt: qtDe(rr, g.op.qtc ?? 0.4),
  perf: 1,
  ...extra,
});

/** Inserta onda P (opcional) en `tp` y QRS en `tp + pr`. */
function latido(g, tp, pr, f, conP = true, fP = { amp: 1 }) {
  if (conP) g.ev.push({ tipo: 'P', t: tp, f: fP });
  g.ev.push({ tipo: 'QRS', t: tp + pr, f });
}

/** Onda P sin QRS posterior (P bloqueada o P dentro de la T de un latido prematuro). */
const pSola = (g, tp, fP = { amp: 1 }) => g.ev.push({ tipo: 'P', t: tp, f: fP });

/** Latido ventricular prematuro / ectópico ancho. */
const formaEsv = (g, rr, alterna) => ({
  morf: 'V',
  ancho: 0.14,
  amp: 1.15,
  qt: qtDe(rr, 0.44),
  tAmp: 1,
  vMorf: alterna ? 'brd' : 'bri',
  perf: 0.4,
});

/** Decide si el hueco sinusal `k` se sustituye por extrasístole según el patrón. */
function hayExtrasistole(g, k) {
  const p = g.op.patron || 'ocasional';
  switch (p) {
    case 'bigeminismo': return k % 2 === 1;
    case 'trigeminismo': return k % 3 === 2;
    case 'frecuente': case 'multifocal': return g.rnd() < 0.35;
    case 'pares': return k % 7 === 5;
    case 'salvas': return k % 9 === 6;
    default: return g.rnd() < 0.1; // ocasional
  }
}

/** Fondo fibrilatorio (ondas f): suma de senoides incommensurables, de amplitud irregular. */
function fondoFib(ts, lead, amp) {
  const w = PESO_FONDO.fib[lead] ?? 0.5;
  const v =
    Math.sin(2 * Math.PI * 6.7 * ts + 1.3 * Math.sin(2 * Math.PI * 0.37 * ts)) +
    0.7 * Math.sin(2 * Math.PI * 8.9 * ts + 0.8 * Math.sin(2 * Math.PI * 0.23 * ts)) +
    0.5 * Math.sin(2 * Math.PI * 11.3 * ts);
  return amp * w * v * (0.7 + 0.3 * Math.sin(2 * Math.PI * 0.29 * ts));
}

/** Ondas F del flúter (dientes de sierra), periodo = 60 / frecuencia auricular. */
function fondoFlutter(ts, lead, fcAur) {
  const w = PESO_FONDO.flutter[lead] ?? 0.4;
  const fase = (ts * fcAur) / 60;
  const x = 2 * Math.PI * (fase % 1);
  return 0.2 * w * (-Math.sin(x) - 0.35 * Math.sin(2 * x));
}

/* ------------------------------------------------------------------ *
 * Metadatos de opciones (el panel del instructor construye controles con esto)
 * ------------------------------------------------------------------ */
const OPC_PATRON_ESV = {
  clave: 'patron', tipo: 'select', etiqueta: 'Patrón de ectopia', def: 'ocasional',
  valores: {
    ocasional: 'Aisladas ocasionales', frecuente: 'Frecuentes', bigeminismo: 'Bigeminismo',
    trigeminismo: 'Trigeminismo', pares: 'Parejas (dobletes)', salvas: 'Salvas de 3 (TV no sostenida)',
    multifocal: 'Multifocales (2 morfologías)',
  },
};

/* ------------------------------------------------------------------ *
 * CATÁLOGO DE RITMOS
 *  id → { nombre, grupo, fc:[min,max,def], perf, fcFija?, base?, opciones?, paso, continuo? }
 *  - perf: 1 = hay pulso; 0 = ritmo sin pulso (AESP, FV, asistolia).
 *  - fcFija: la frecuencia la determina el ritmo (flúter, BAV III...).
 * ------------------------------------------------------------------ */
export const RITMOS = {
  /* ---------- Ritmos sinusales ---------- */
  sinusal: {
    nombre: 'Ritmo sinusal normal', grupo: 'Sinusales', fc: [30, 220, 75], perf: 1,
    paso(g) {
      const rr = g.rr();
      latido(g, g.t, prAuto(g), formaBase(g, rr));
      g.t += rr * (1 + normal(g.rnd, 0, 0.012));
    },
  },
  bradicardia_sinusal: { nombre: 'Bradicardia sinusal', grupo: 'Sinusales', fc: [20, 59, 45], perf: 1, base: 'sinusal' },
  taquicardia_sinusal: { nombre: 'Taquicardia sinusal', grupo: 'Sinusales', fc: [101, 220, 130], perf: 1, base: 'sinusal' },
  arritmia_sinusal: {
    nombre: 'Arritmia sinusal respiratoria', grupo: 'Sinusales', fc: [50, 110, 70], perf: 1,
    paso(g) {
      const rr = g.rr() * (1 + 0.14 * Math.sin((2 * Math.PI * g.t) / 4)); // modulación a 15 rpm
      latido(g, g.t, prAuto(g), formaBase(g, rr));
      g.t += rr;
    },
  },
  pausa_sinusal: {
    nombre: 'Paro / pausa sinusal', grupo: 'Sinusales', fc: [40, 100, 70], perf: 1,
    opciones: [{ clave: 'pausa', tipo: 'range', etiqueta: 'Duración de la pausa (s)', min: 2, max: 8, paso: 0.5, def: 3.5 }],
    paso(g) {
      const rr = g.rr();
      g.s.k = (g.s.k || 0) + 1;
      latido(g, g.t, prAuto(g), formaBase(g, rr));
      g.t += g.s.k % 6 === 0 ? g.op.pausa ?? 3.5 : rr; // cada 6 latidos: pausa sin P ni QRS
    },
  },

  /* ---------- Extrasístoles ---------- */
  esv: {
    nombre: 'Extrasístoles ventriculares (ESV)', grupo: 'Extrasístoles', fc: [40, 160, 75], perf: 1,
    opciones: [OPC_PATRON_ESV],
    paso(g) {
      const rr = g.rr();
      const k = (g.s.k = (g.s.k || 0) + 1);
      const pr = prAuto(g);
      if (hayExtrasistole(g, k)) {
        const patron = g.op.patron || 'ocasional';
        const alterna = patron === 'multifocal' && k % 2 === 0;
        // La ESV se adelanta (acoplamiento corto), sin P previa; la P sinusal sigue su ritmo
        // y queda "escondida" en la T → pausa compensadora COMPLETA.
        pSola(g, g.t);
        let tv = g.t + pr - 0.42 * rr;
        g.ev.push({ tipo: 'QRS', t: tv, f: formaEsv(g, rr, alterna) });
        if (patron === 'pares' || patron === 'salvas') {
          const n = patron === 'pares' ? 1 : 2;
          for (let i = 0; i < n; i++) {
            tv += 0.5 * rr;
            g.ev.push({ tipo: 'QRS', t: tv, f: formaEsv(g, rr, false) });
          }
        }
      } else {
        latido(g, g.t, pr, formaBase(g, rr));
      }
      g.t += rr * (1 + normal(g.rnd, 0, 0.01));
    },
  },
  esa: {
    nombre: 'Extrasístoles auriculares (ESA)', grupo: 'Extrasístoles', fc: [50, 140, 75], perf: 1,
    opciones: [{
      clave: 'patron', tipo: 'select', etiqueta: 'Patrón', def: 'ocasional',
      valores: { ocasional: 'Aisladas', bigeminismo: 'Bigeminismo auricular', frecuente: 'Frecuentes' },
    }],
    paso(g) {
      const rr = g.rr();
      const k = (g.s.k = (g.s.k || 0) + 1);
      const patron = g.op.patron || 'ocasional';
      const dispara = patron === 'bigeminismo' ? k % 2 === 1 : g.rnd() < (patron === 'frecuente' ? 0.3 : 0.1);
      if (dispara) {
        // P' prematura de morfología distinta, QRS idéntico, pausa compensadora INCOMPLETA
        const tp = g.t - 0.35 * rr;
        latido(g, tp, 0.13, formaBase(g, rr, { perf: 0.8 }), true, { amp: 0.6 });
        g.t = tp + rr;
      } else {
        latido(g, g.t, prAuto(g), formaBase(g, rr));
        g.t += rr;
      }
    },
  },

  /* ---------- Taquiarritmias supraventriculares ---------- */
  fa: {
    nombre: 'Fibrilación auricular (FA)', grupo: 'Taquiarritmias supraventriculares', fc: [40, 200, 110], perf: 1,
    opciones: [{ clave: 'fina', tipo: 'bool', etiqueta: 'Ondas f finas', def: false }],
    paso(g) {
      // R-R "irregularmente irregular": cada intervalo es aleatorio, media = 60/FC
      const base = g.rr();
      const rr = limitar(base * (0.5 + 1.0 * g.rnd()), 0.24, 2.5);
      const perf = limitar(0.55 + 0.45 * Math.min(rr / base, 1.2), 0.3, 1);
      g.ev.push({ tipo: 'QRS', t: g.t, f: formaBase(g, rr, { perf, amp: 0.92 + 0.16 * g.rnd() }) });
      g.t += rr;
    },
    continuo: (g, ts, lead) => fondoFib(ts, lead, g.op.fina ? 0.03 : 0.08),
  },
  flutter: {
    nombre: 'Flúter auricular', grupo: 'Taquiarritmias supraventriculares', fc: [75, 300, 150], perf: 1, fcFija: true,
    opciones: [
      {
        clave: 'ratio', tipo: 'select', etiqueta: 'Conducción AV', def: '2',
        valores: { 2: '2:1 (≈150 lpm)', 3: '3:1 (≈100 lpm)', 4: '4:1 (≈75 lpm)', variable: 'Variable (irregular)' },
      },
      { clave: 'fcAur', tipo: 'range', etiqueta: 'Frecuencia auricular (lpm)', min: 250, max: 350, paso: 5, def: 300 },
    ],
    paso(g) {
      const fa = g.op.fcAur ?? 300;
      const tf = 60 / fa; // periodo de una onda F
      const r = g.op.ratio === 'variable' || !g.op.ratio ? [2, 3, 4][Math.floor(g.rnd() * 3)] : Number(g.op.ratio);
      g.ev.push({ tipo: 'QRS', t: g.t, f: formaBase(g, r * tf, { st: -0.03 }) });
      g.t += r * tf;
      g.s.fcMedida = 60 / (r * tf);
    },
    continuo: (g, ts, lead) => fondoFlutter(ts, lead, g.op.fcAur ?? 300),
  },
  tsv: {
    nombre: 'Taquicardia supraventricular (TSV)', grupo: 'Taquiarritmias supraventriculares', fc: [140, 250, 180], perf: 1,
    paso(g) {
      // Regular, QRS estrecho; P no visible (dentro del QRS); leve descenso ST por frecuencia
      const rr = g.rr() * (1 + normal(g.rnd, 0, 0.003));
      g.ev.push({ tipo: 'QRS', t: g.t, f: formaBase(g, rr, { st: -0.05, tAmp: 0.7, perf: 0.85 }) });
      g.t += rr;
    },
  },
  taq_auricular: {
    nombre: 'Taquicardia auricular', grupo: 'Taquiarritmias supraventriculares', fc: [101, 230, 150], perf: 1,
    paso(g) {
      const rr = g.rr();
      latido(g, g.t, 0.14, formaBase(g, rr, { perf: 0.9 }), true, { amp: 0.55 }); // P no sinusal, PR normal
      g.t += rr * (1 + normal(g.rnd, 0, 0.004));
    },
  },
  nodal: {
    nombre: 'Ritmo de la unión AV (nodal)', grupo: 'Escapes y ritmos lentos', fc: [30, 100, 50], perf: 1,
    opciones: [{
      clave: 'p', tipo: 'select', etiqueta: 'Actividad auricular', def: 'invertida',
      valores: { invertida: 'P invertida (retrógrada) antes del QRS', ausente: 'P no visible' },
    }],
    paso(g) {
      const rr = g.rr();
      latido(g, g.t, 0.09, formaBase(g, rr), g.op.p !== 'ausente', { amp: -0.9 });
      g.t += rr * (1 + normal(g.rnd, 0, 0.008));
    },
  },

  /* ---------- Bloqueos AV ---------- */
  bav1: {
    nombre: 'Bloqueo AV de 1.er grado', grupo: 'Bloqueos', fc: [40, 120, 70], perf: 1,
    opciones: [{ clave: 'pr', tipo: 'range', etiqueta: 'Intervalo PR (s)', min: 0.21, max: 0.5, paso: 0.01, def: 0.32 }],
    paso(g) {
      const rr = g.rr();
      latido(g, g.t, g.op.pr ?? 0.32, formaBase(g, rr));
      g.t += rr;
    },
  },
  mobitz1: {
    nombre: 'BAV 2.º grado Mobitz I (Wenckebach)', grupo: 'Bloqueos', fc: [50, 110, 75], perf: 1,
    opciones: [{ clave: 'ciclo', tipo: 'range', etiqueta: 'P por ciclo (3–6)', min: 3, max: 6, paso: 1, def: 4 }],
    paso(g) {
      const rr = g.rr();
      const n = g.op.ciclo ?? 4;
      const k = (g.s.k = ((g.s.k ?? -1) + 1) % n);
      // El PR se alarga cada vez menos hasta que una P no conduce; luego el ciclo se repite
      const incr = [0, 0.1, 0.16, 0.2, 0.22, 0.23];
      if (k === n - 1) pSola(g, g.t);
      else latido(g, g.t, 0.16 + incr[k], formaBase(g, rr));
      g.t += rr;
    },
  },
  mobitz2: {
    nombre: 'BAV 2.º grado Mobitz II', grupo: 'Bloqueos', fc: [50, 110, 75], perf: 1,
    opciones: [{ clave: 'n', tipo: 'range', etiqueta: 'Se bloquea 1 de cada N ondas P', min: 2, max: 5, paso: 1, def: 3 }],
    paso(g) {
      const rr = g.rr();
      const n = g.op.n ?? 3;
      const k = (g.s.k = ((g.s.k ?? -1) + 1) % n);
      if (k === n - 1) pSola(g, g.t); // P bloqueada, sin Wenckebach
      else latido(g, g.t, g.op.pr ?? 0.2, formaBase(g, rr, { ancho: g.op.qrs ?? 0.1 }));
      g.t += rr;
    },
  },
  bav3: {
    nombre: 'BAV completo (3.er grado)', grupo: 'Bloqueos', fc: [20, 60, 35], perf: 1, fcFija: false,
    opciones: [
      { clave: 'fcP', tipo: 'range', etiqueta: 'Frecuencia auricular (lpm)', min: 50, max: 120, paso: 1, def: 80 },
      {
        clave: 'escape', tipo: 'select', etiqueta: 'Ritmo de escape', def: 'ventricular',
        valores: { nodal: 'Nodal (QRS estrecho)', ventricular: 'Ventricular (QRS ancho)' },
      },
    ],
    paso(g) {
      // Disociación AV: las P marchan a su ritmo, el QRS de escape al suyo
      const rr = g.rr();
      const ancho = g.op.escape === 'nodal';
      g.ev.push({
        tipo: 'QRS', t: g.t,
        f: ancho ? formaBase(g, rr, { perf: 0.8 }) : { morf: 'escape', ancho: 0.15, amp: 1.1, qt: qtDe(rr, 0.46), vMorf: 'bri', perf: 0.8 },
      });
      const tpp = 60 / (g.op.fcP ?? 80);
      g.s.tP = g.s.tP ?? g.t - 0.5;
      while (g.s.tP < g.t + rr) {
        pSola(g, g.s.tP);
        g.s.tP += tpp;
      }
      g.t += rr * (1 + normal(g.rnd, 0, 0.006));
    },
  },
  escape_ventricular: {
    nombre: 'Ritmo idioventricular (escape)', grupo: 'Escapes y ritmos lentos', fc: [15, 50, 30], perf: 1,
    paso(g) {
      const rr = g.rr();
      g.ev.push({ tipo: 'QRS', t: g.t, f: { morf: 'escape', ancho: 0.18, amp: 1.1, qt: qtDe(rr, 0.48), vMorf: 'bri', perf: 0.7 } });
      g.t += rr * (1 + normal(g.rnd, 0, 0.02));
    },
  },

  /* ---------- Conducción intraventricular / preexcitación / metabólicos ---------- */
  bri: {
    nombre: 'Bloqueo de rama izquierda (BRI)', grupo: 'Conducción y metabólicos', fc: [40, 160, 75], perf: 1,
    paso(g) {
      const rr = g.rr();
      latido(g, g.t, prAuto(g), formaBase(g, rr, { morf: 'BRI', ancho: g.op.qrs ?? 0.14, amp: 0.9, tAmp: 1 }));
      g.t += rr * (1 + normal(g.rnd, 0, 0.012));
    },
  },
  brd: {
    nombre: 'Bloqueo de rama derecha (BRD)', grupo: 'Conducción y metabólicos', fc: [40, 160, 75], perf: 1,
    paso(g) {
      const rr = g.rr();
      latido(g, g.t, prAuto(g), formaBase(g, rr, { morf: 'BRD', ancho: g.op.qrs ?? 0.14 }));
      g.t += rr * (1 + normal(g.rnd, 0, 0.012));
    },
  },
  wpw: {
    nombre: 'Preexcitación (WPW)', grupo: 'Conducción y metabólicos', fc: [50, 160, 75], perf: 1,
    paso(g) {
      const rr = g.rr();
      latido(g, g.t, g.op.pr ?? 0.1, formaBase(g, rr, { ancho: g.op.qrs ?? 0.13, delta: 0.9, tAmp: 0.6 }));
      g.t += rr * (1 + normal(g.rnd, 0, 0.012));
    },
  },
  hiperk: {
    nombre: 'Hiperpotasemia', grupo: 'Conducción y metabólicos', fc: [30, 130, 70], perf: 1,
    opciones: [{ clave: 'k', tipo: 'range', etiqueta: 'K⁺ sérico (mEq/L)', min: 5.5, max: 9, paso: 0.1, def: 7 }],
    paso(g) {
      const rr = g.rr();
      const k = g.op.k ?? 7;
      const sev = Math.max(0, k - 6.5);
      const f = formaBase(g, rr, {
        tAmp: 1 + (k - 5.5) * 0.75, tSigma: 0.8 - Math.min(sev, 1.5) * 0.15,
        ancho: 0.09 + sev * 0.035, qt: 0.3,
      });
      if (k >= 8.5) {
        // Onda sinusoidal prefinal: QRS y T fusionados
        Object.assign(f, { morf: 'V', amp: 0.8, vMorf: 'bri', ancho: 0.24 });
        g.ev.push({ tipo: 'QRS', t: g.t, f });
      } else {
        const pamp = Math.max(0, 1 - (k - 6) * 0.35);
        latido(g, g.t, 0.16 + sev * 0.05, f, pamp > 0.05, { amp: pamp });
      }
      g.t += rr;
    },
  },

  /* ---------- Marcapasos ---------- */
  marcapasos: {
    nombre: 'Ritmo de marcapasos', grupo: 'Marcapasos', fc: [40, 160, 70], perf: 1,
    opciones: [
      { clave: 'modo', tipo: 'select', etiqueta: 'Modo', def: 'VVI', valores: { VVI: 'VVI (espícula ventricular)', DDD: 'DDD (espícula auricular + ventricular)' } },
      { clave: 'captura', tipo: 'bool', etiqueta: 'Captura ventricular', def: true },
    ],
    paso(g) {
      const rr = g.rr();
      const captura = g.op.captura !== false;
      const ddd = g.op.modo === 'DDD';
      let tq = g.t;
      if (ddd) {
        g.ev.push({ tipo: 'SPIKE', t: g.t - 0.17 });
        pSola(g, g.t - 0.15, { amp: 0.9 }); // la espícula auricular captura la aurícula
        tq = g.t;
      }
      if (captura) {
        g.ev.push({ tipo: 'QRS', t: tq, f: { morf: 'marcapasos', spike: true, ancho: 0.16, amp: 1.0, qt: qtDe(rr, 0.46), vMorf: 'bri', perf: 1 } });
      } else {
        g.ev.push({ tipo: 'SPIKE', t: tq - 0.01 }); // fallo de captura: espícula sin QRS
      }
      g.t += rr;
    },
  },

  /* ---------- Ritmos de parada y TV ---------- */
  tv: {
    nombre: 'Taquicardia ventricular monomorfa (TV)', grupo: 'Ritmos ventriculares y de paro', fc: [120, 300, 180], perf: 1,
    paso(g) {
      const rr = g.rr();
      g.ev.push({ tipo: 'QRS', t: g.t, f: { morf: 'V', ancho: Math.min(0.16, rr * 0.7), amp: 1.1, qt: rr * 0.7, vMorf: 'bri', tAmp: 0.6, perf: 0.7 } });
      g.t += rr * (1 + normal(g.rnd, 0, 0.004));
    },
  },
  torsades: {
    nombre: 'Torsades de pointes (TV polimorfa)', grupo: 'Ritmos ventriculares y de paro', fc: [180, 300, 230], perf: 1,
    paso(g) {
      const rr = g.rr();
      // Husos de amplitud: la polaridad rota alrededor de la línea de base (≈ 2.4 s por huso)
      const fase = (2 * Math.PI * g.t) / 2.4;
      const amp = 0.25 + 0.9 * Math.abs(Math.sin(fase));
      g.ev.push({
        tipo: 'QRS', t: g.t,
        f: { morf: 'V', ancho: Math.min(0.15, rr * 0.7), amp, polaridad: Math.sign(Math.sin(fase)) || 1, qt: rr * 0.7, vMorf: 'bri', tAmp: 0.3, perf: 0.5 },
      });
      g.t += rr;
    },
  },
  fv: {
    nombre: 'Fibrilación ventricular (FV)', grupo: 'Ritmos ventriculares y de paro', fc: [0, 0, 0], perf: 0, fcFija: true,
    opciones: [{ clave: 'fina', tipo: 'bool', etiqueta: 'FV fina (baja amplitud)', def: false }],
    paso(g) { g.t += 1; },
    continuo(g, ts, lead) {
      const A = g.op.fina ? 0.18 : 0.9;
      const w = 0.55 + 0.45 * (PESO_FONDO.fib[lead] ?? 0.5);
      const v =
        0.6 * Math.sin(2 * Math.PI * 4.1 * ts + 1.7 * Math.sin(2 * Math.PI * 0.31 * ts)) +
        0.4 * Math.sin(2 * Math.PI * 6.3 * ts + 1.1 * Math.sin(2 * Math.PI * 0.17 * ts)) +
        0.2 * Math.sin(2 * Math.PI * 9.1 * ts);
      return A * w * v * (0.65 + 0.35 * Math.sin(2 * Math.PI * 0.23 * ts));
    },
  },
  asistolia: {
    nombre: 'Asistolia', grupo: 'Ritmos ventriculares y de paro', fc: [0, 0, 0], perf: 0, fcFija: true,
    paso(g) { g.t += 1; },
    continuo: (g, ts) => 0.015 * Math.sin(2 * Math.PI * 0.3 * ts), // línea casi plana con ligera deriva
  },
  aesp: {
    nombre: 'Actividad eléctrica sin pulso (AESP)', grupo: 'Ritmos ventriculares y de paro', fc: [20, 140, 50], perf: 0,
    paso(g) {
      const rr = g.rr();
      // Complejos organizados (aquí QRS ancho-bradicárdico) sin eficacia mecánica
      latido(g, g.t, 0.18, formaBase(g, rr, { ancho: 0.12, perf: 0 }), true, { amp: 0.7 });
      g.t += rr * (1 + normal(g.rnd, 0, 0.03));
    },
  },
};

/** Resuelve alias (`base`) y devuelve la definición completa de un ritmo. */
export function definicionRitmo(id) {
  const r = RITMOS[id] || RITMOS.sinusal;
  return r.base ? { ...RITMOS[r.base], ...r, paso: RITMOS[r.base].paso, continuo: RITMOS[r.base].continuo } : r;
}

/** Valores por defecto de las opciones de un ritmo (para reiniciarlas al cambiarlo). */
export function opcionesPorDefecto(id) {
  const o = {};
  for (const op of definicionRitmo(id).opciones || []) o[op.clave] = op.def;
  return o;
}

/** Lista agrupada [{grupo, items:[{id, nombre}]}] para construir selectores. */
export function ritmosAgrupados() {
  const m = new Map();
  for (const [id, r] of Object.entries(RITMOS)) {
    if (!m.has(r.grupo)) m.set(r.grupo, []);
    m.get(r.grupo).push({ id, nombre: r.nombre });
  }
  return [...m].map(([grupo, items]) => ({ grupo, items }));
}

/* ------------------------------------------------------------------ *
 * GENERADOR: mantiene la cola de eventos del ritmo vigente
 * ------------------------------------------------------------------ */
export class GeneradorRitmo {
  /**
   * @param {() => number} rnd generador aleatorio (utilidades.crearAleatorio)
   * @param {number} t0 instante inicial (s)
   */
  constructor(rnd, t0 = 0) {
    this.rnd = rnd;
    this.ev = []; // cola de eventos ordenable por tiempo
    this.t = t0 + 0.4; // reloj del próximo ciclo
    this.s = {}; // estado interno propio de cada ritmo
    this.fc = 75;
    this.op = {};
    this.id = 'sinusal';
    this.def = definicionRitmo('sinusal');
  }

  /** Intervalo R-R nominal (s) con la frecuencia vigente. */
  rr() {
    return 60 / Math.max(this.fc, 1);
  }

  /** Cambia de ritmo: conserva el reloj para no crear huecos y reinicia el estado interno. */
  cambiar(id, ahora) {
    this.id = RITMOS[id] ? id : 'sinusal';
    this.def = definicionRitmo(this.id);
    this.s = {};
    // Descarta eventos futuros del ritmo anterior (los pasados siguen terminando su onda)
    this.ev = this.ev.filter((e) => e.t <= ahora + 0.02);
    this.t = ahora + 0.25;
  }

  /** Genera ciclos hasta cubrir `hasta` (segundos) con la frecuencia y opciones vigentes. */
  avanzar(hasta, fc, op) {
    this.fc = fc;
    this.op = op || {};
    let guarda = 0;
    while (this.t < hasta && guarda++ < 400) this.def.paso(this);
    this.ev.sort((a, b) => a.t - b.t);
  }

  /** Elimina eventos ya irrelevantes (más antiguos que `antes`). */
  podar(antes) {
    if (this.ev.length && this.ev[0].t < antes) this.ev = this.ev.filter((e) => e.t >= antes);
  }

  /** Componente continua (FV, ondas f/F, deriva) para la derivación `lead` en `ts`. */
  continuo(ts, lead) {
    return this.def.continuo ? this.def.continuo(this, ts, lead) : 0;
  }

  /** Frecuencia ventricular "teórica" del ritmo (para fcFija como flúter). */
  get fcTeorica() {
    return this.s.fcMedida ?? this.fc;
  }
}
