/**
 * @file utilidades.js
 * @description Funciones matemáticas y auxiliares reutilizables.
 * Se ejecuta en: AMBOS. Sin dependencias del DOM.
 */

/** Limita un valor entre un mínimo y un máximo. */
export const limitar = (v, min, max) => Math.min(max, Math.max(min, v));

/** Interpolación lineal entre a y b con factor t (0..1). */
export const lerp = (a, b, t) => a + (b - a) * t;

/** Gaussiana centrada en `c` con desviación `s` (se usa para modelar ondas P, R, T...). */
export const gauss = (x, c, s) => {
  const z = (x - c) / s;
  return Math.exp(-0.5 * z * z);
};

/** Sigmoide suave (0..1), útil para dibujar mesetas del segmento ST. */
export const sigmoide = (x) => 1 / (1 + Math.exp(-x));

/**
 * Generador pseudo-aleatorio determinista (mulberry32).
 * Permite reproducir ritmos con una misma semilla (útil en pruebas).
 * @param {number} semilla
 * @returns {() => number} función que devuelve un número en [0,1)
 */
export function crearAleatorio(semilla = Date.now() >>> 0) {
  let a = semilla >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Número aleatorio con distribución aproximadamente normal (Box-Muller). */
export function normal(rnd, media = 0, desv = 1) {
  const u = Math.max(rnd(), 1e-9);
  const v = rnd();
  return media + desv * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Redondea a `d` decimales. */
export const redondear = (v, d = 0) => {
  const f = 10 ** d;
  return Math.round(v * f) / f;
};

/** Convierte una frecuencia (lpm) en intervalo R-R (s). */
export const rrDesdeFc = (fc) => 60 / Math.max(fc, 1);

/** Formatea número con decimales fijos o devuelve '---' si no es un número válido. */
export const fmt = (v, d = 0) => (Number.isFinite(v) ? v.toFixed(d) : '---');

/** Añade cero a la izquierda. */
export const dos = (n) => String(n).padStart(2, '0');

/** Fecha y hora en formato del monitor: AAAA-MM-DD HH:MM:SS. */
export function fechaHora(d = new Date()) {
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())} ${dos(d.getHours())}:${dos(d.getMinutes())}:${dos(d.getSeconds())}`;
}

/** Hora corta HH:MM:SS. */
export const horaCorta = (d = new Date()) => `${dos(d.getHours())}:${dos(d.getMinutes())}:${dos(d.getSeconds())}`;

/** Copia profunda sencilla (el estado es JSON puro). */
export const clonar = (o) => JSON.parse(JSON.stringify(o));

/** Lee una ruta con puntos ("alarmas.limites.hr.alto") dentro de un objeto. */
export function leerRuta(obj, ruta) {
  return ruta.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

/** Escribe un valor en una ruta con puntos, creando objetos intermedios si hace falta. */
export function escribirRuta(obj, ruta, valor) {
  const partes = ruta.split('.');
  const ultimo = partes.pop();
  let o = obj;
  for (const p of partes) {
    if (typeof o[p] !== 'object' || o[p] === null) o[p] = {};
    o = o[p];
  }
  o[ultimo] = valor;
}

/** Retrasa la ejecución de `fn` hasta que pasen `ms` sin nuevas llamadas. */
export function antirrebote(fn, ms = 60) {
  let id;
  return (...a) => {
    clearTimeout(id);
    id = setTimeout(() => fn(...a), ms);
  };
}
