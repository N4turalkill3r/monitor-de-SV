/**
 * @file protocolo.js
 * @description Protocolo de lectura del ECG F-R-I / E-H-I (Frecuencia, Ritmo, Intervalos /
 * Eje, Hipertrofia, Isquemia) del curso de ECG, como DOCENTE INTERACTIVO:
 *  - PASOS: texto didáctico de cada letra (cómo se mide, valores normales, trampas).
 *  - analizar(): calcula la respuesta CORRECTA a partir de lo que está pasando en la
 *    simulación (para el modo "revelar" y el quiz).
 *
 * Se ejecuta en: AMBOS (sin DOM).
 */
import { PATRONES_ISQUEMIA, HIPERTROFIAS } from '../simulacion/ecg-modelo.js';
import { RITMOS } from '../simulacion/ritmos.js';

/** Características de cada ritmo para las preguntas de "Ritmo" (onda P y QRS). */
const RASGOS = {
  sinusal: { p: 'sinusal', qrs: 'estrecho', reg: 'regular' },
  bradicardia_sinusal: { p: 'sinusal', qrs: 'estrecho', reg: 'regular' },
  taquicardia_sinusal: { p: 'sinusal', qrs: 'estrecho', reg: 'regular' },
  arritmia_sinusal: { p: 'sinusal', qrs: 'estrecho', reg: 'irregular' },
  pausa_sinusal: { p: 'sinusal', qrs: 'estrecho', reg: 'irregular' },
  esv: { p: 'sinusal', qrs: 'mixto', reg: 'irregular' },
  esa: { p: 'sinusal', qrs: 'estrecho', reg: 'irregular' },
  fa: { p: 'ausente', qrs: 'estrecho', reg: 'irregular' },
  flutter: { p: 'sierra', qrs: 'estrecho', reg: 'regular' },
  tsv: { p: 'ausente', qrs: 'estrecho', reg: 'regular' },
  taq_auricular: { p: 'no_sinusal', qrs: 'estrecho', reg: 'regular' },
  nodal: { p: 'invertida', qrs: 'estrecho', reg: 'regular' },
  bav1: { p: 'sinusal', qrs: 'estrecho', reg: 'regular' },
  mobitz1: { p: 'sinusal', qrs: 'estrecho', reg: 'irregular' },
  mobitz2: { p: 'sinusal', qrs: 'estrecho', reg: 'irregular' },
  bav3: { p: 'disociada', qrs: 'ancho', reg: 'regular' },
  escape_ventricular: { p: 'ausente', qrs: 'ancho', reg: 'regular' },
  bri: { p: 'sinusal', qrs: 'ancho', reg: 'regular' },
  brd: { p: 'sinusal', qrs: 'ancho', reg: 'regular' },
  wpw: { p: 'sinusal', qrs: 'ancho', reg: 'regular' },
  hiperk: { p: 'plana', qrs: 'ancho', reg: 'regular' },
  marcapasos: { p: 'ausente', qrs: 'ancho', reg: 'regular' },
  tv: { p: 'ausente', qrs: 'ancho', reg: 'regular' },
  torsades: { p: 'ausente', qrs: 'ancho', reg: 'irregular' },
  fv: { p: 'ausente', qrs: 'ausente', reg: 'irregular' },
  asistolia: { p: 'ausente', qrs: 'ausente', reg: 'ninguno' },
  aesp: { p: 'sinusal', qrs: 'ancho', reg: 'regular' },
};

/** Pasos del protocolo con ayudas, opciones de respuesta y valores normales. */
export const PASOS = [
  {
    clave: 'F', titulo: 'FRECUENCIA', bloque: 'FRI',
    resumen: 'Número de QRS por minuto.',
    como: ['Ritmo regular: 300 ÷ nº de cuadros grandes entre dos R (o 1500 ÷ cuadritos).', 'Ritmo irregular: contar los QRS en 6 s (30 cuadros grandes) y multiplicar por 10.', 'También puede medirse la frecuencia auricular (ondas P) si difiere de la ventricular.'],
    normal: 'Adulto: 60–100 lpm. Bradicardia < 60. Taquicardia > 100.',
    pregunta: '¿Cuál es la frecuencia ventricular?',
    opciones: { bradicardia: 'Bradicardia (< 60 lpm)', normal: 'Normal (60–100 lpm)', taquicardia: 'Taquicardia (> 100 lpm)', ninguna: 'No hay QRS / no medible' },
  },
  {
    clave: 'R', titulo: 'RITMO', bloque: 'FRI',
    resumen: 'Origen del estímulo: buscar la P y su relación con el QRS; ver si el R-R es constante.',
    como: ['¿Hay onda P? ¿Es sinusal (positiva en I, II y aVF, negativa en aVR)?', '¿Cada P va seguida de un QRS? ¿Cada QRS está precedido de una P?', '¿Los R-R son regulares?', '¿El QRS es estrecho (< 0.12 s) o ancho (≥ 0.12 s)?'],
    normal: 'Ritmo sinusal: P sinusal antes de cada QRS a intervalos regulares.',
    pregunta: '¿Cómo es la onda P?',
    opciones: { sinusal: 'Sinusal, una por QRS', ausente: 'No hay ondas P', sierra: 'Ondas F en dientes de sierra', no_sinusal: 'P no sinusal', invertida: 'P invertida / retrógrada', disociada: 'P disociadas del QRS', plana: 'P aplanada o ausente (T picudas)' },
  },
  {
    clave: 'I', titulo: 'INTERVALOS', bloque: 'FRI',
    resumen: 'Medir PR, QRS y QT.',
    como: ['PR: del inicio de la P al inicio del QRS.', 'QRS: del inicio de la Q (o R) al final de la S. Preferible en derivaciones de miembros.', 'QT: del inicio del QRS al final de la T; corregir con la frecuencia (QTc). Aproximación: normal si < 50 % del R-R.'],
    normal: 'PR 0.12–0.20 s (hasta 0.22 en ancianos) · QRS ≤ 0.10 s (≥ 0.12 s = ancho) · QT absoluto ≤ 0.44 s.',
    pregunta: '¿Hay alguna alteración en los intervalos?',
    opciones: { normal: 'Todos normales', pr_largo: 'PR largo (> 0.20 s)', pr_corto: 'PR corto (< 0.12 s)', qrs_ancho: 'QRS ancho (≥ 0.12 s)', qt_largo: 'QT prolongado', variable: 'PR variable / hay P bloqueadas' },
  },
  {
    clave: 'E', titulo: 'EJE', bloque: 'EHI',
    resumen: 'Dirección de la despolarización en el plano frontal.',
    como: ['Usar I y aVF como sistema de cuatro cuadrantes.', 'I (+) y aVF (+): eje normal (0° a 90°).', 'I (+) y aVF (−): eje izquierdo (0° a −90°).', 'I (−) y aVF (+): eje derecho (90° a 180°).', 'I (−) y aVF (−): eje indeterminado.'],
    normal: 'Normal: 0° a 90° (positivo en I y aVF).',
    pregunta: '¿Hacia dónde apunta el eje?',
    opciones: { normal: 'Normal (0° a 90°)', izquierdo: 'Desviado a la izquierda', derecho: 'Desviado a la derecha', indeterminado: 'Indeterminado' },
  },
  {
    clave: 'H', titulo: 'HIPERTROFIA', bloque: 'EHI',
    resumen: 'Aumento de voltaje o cambio de morfología de la cavidad afectada.',
    como: ['Aurículas: P < 0.12 s y < 2.5 mm; mejor en II y V1. AD: P alta y picuda; AI: P ancha y bimodal.', 'VI (I, aVL, V5, V6): R > 25 mm; S en V1 + R en V5 > 35 mm; ST descendido y T invertida (sobrecarga).', 'VD (V1, V2): R dominante en V1 (R/S > 1), eje a la derecha, S profunda en V5–V6.'],
    normal: 'Ondas con voltaje y morfología normales en las derivaciones que enfrentan cada cavidad.',
    pregunta: '¿Hay signos de crecimiento de cavidades?',
    opciones: Object.fromEntries(Object.entries(HIPERTROFIAS).map(([k, v]) => [k, v])),
  },
  {
    clave: 'I2', titulo: 'ISQUEMIA', bloque: 'EHI',
    resumen: 'Buscar alteraciones de la onda T, del segmento ST y ondas Q patológicas.',
    como: ['T: asimétrica y concordante con el QRS. T invertida simétrica = isquemia subepicárdica; T alta y picuda = hiperaguda.', 'ST: isoeléctrico; anormal si se desvía ≥ 1 mm. Elevación en derivaciones contiguas = lesión transmural (STEMI).', 'Q patológica: > 0.04 s o > 25 % de la R (necrosis).', 'Localizar: inferior (II, III, aVF), anterior (V1–V4), lateral (I, aVL, V5–V6), posterior (descenso ST en V1–V3).'],
    normal: 'ST isoeléctrico (±0.5 mm), T normal, sin Q patológicas.',
    pregunta: '¿Qué patrón isquémico se observa?',
    opciones: Object.fromEntries(Object.entries(PATRONES_ISQUEMIA).map(([k, v]) => [k, v.nombre])),
  },
];

/** Clasifica el eje (grados) en los cuatro cuadrantes del método I–aVF. */
export function clasificarEje(eje) {
  const rad = (eje * Math.PI) / 180;
  const I = Math.cos(rad) >= 0;
  const aVF = Math.sin(rad) >= 0;
  if (I && aVF) return 'normal';
  if (I && !aVF) return 'izquierdo';
  if (!I && aVF) return 'derecho';
  return 'indeterminado';
}

/**
 * Calcula las respuestas correctas del protocolo con el estado y el motor actuales.
 * @returns {{F:string,R:string,I:string,E:string,H:string,I2:string, datos:object}}
 */
export function analizar(motor, estado) {
  const ecg = estado.obtener('ecg');
  const id = ecg.ritmo;
  const def = RITMOS[id];
  const op = ecg.opciones || {};
  const rasgos = RASGOS[id] || RASGOS.sinusal;
  const hr = motor.vivo.hr;
  const fcRitmo = estado.obtener('vitales.hr');
  const fc = hr ?? (def && def.fc[2] === 0 ? null : fcRitmo);

  // Frecuencia
  let F = 'ninguna';
  if (fc !== null && fc !== undefined) F = fc < 60 ? 'bradicardia' : fc > 100 ? 'taquicardia' : 'normal';

  // Intervalos
  const rr = fc ? 60 / fc : 1;
  const pr = ['wpw'].includes(id) ? 0.1 : op.pr ?? (['fa', 'flutter', 'tsv', 'nodal', 'tv', 'fv', 'asistolia', 'escape_ventricular', 'torsades'].includes(id) ? null : 0.16);
  const qrs = op.qrs ?? ({ bri: 0.14, brd: 0.14, wpw: 0.13, tv: 0.16, bav3: op.escape === 'nodal' ? 0.09 : 0.15, escape_ventricular: 0.18, marcapasos: 0.16, aesp: 0.12 }[id] ?? 0.09);
  const qtc = op.qtc ?? 0.4;
  const qt = qtc * Math.sqrt(rr);
  let I = 'normal';
  if (['mobitz1', 'mobitz2', 'bav3'].includes(id)) I = 'variable';
  else if (pr !== null && pr > 0.2) I = 'pr_largo';
  else if (pr !== null && pr < 0.12) I = 'pr_corto';
  else if (qrs >= 0.12 && rasgos.qrs !== 'ausente') I = 'qrs_ancho';
  else if (qtc > 0.45) I = 'qt_largo';

  const datos = { fc, pr, qrs, qt, qtc, eje: ecg.eje, rr, regularidad: rasgos.reg };
  return {
    F, R: rasgos.p, I, E: clasificarEje(ecg.eje), H: ecg.hipertrofia || 'ninguna',
    I2: ecg.patron && ecg.patron !== 'ninguno' && ecg.st > 0 ? ecg.patron : 'ninguno',
    datos,
  };
}
