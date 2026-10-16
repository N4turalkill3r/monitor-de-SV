/**
 * @file iconos.js
 * @description Iconos SVG vectoriales de las teclas del monitor (basados en los
 * pictogramas de las teclas de acceso rápido del manual EDAN). Se dibujan con
 * `currentColor` para heredar el color de la tecla.
 *
 * Se ejecuta en: AMBOS (sólo se usan al construir el DOM del monitor).
 */

/** Envuelve un trazo en un SVG de 32×32. */
const svg = (c) => `<svg viewBox="0 0 32 32" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${c}</svg>`;

export const ICONOS = {
  silencio: svg('<path d="M9 22V15a7 7 0 0 1 14 0v7l2 2H7z"/><path d="M14 27h4"/><path d="M5 5l22 22"/>'),
  campana: svg('<path d="M9 22V15a7 7 0 0 1 14 0v7l2 2H7z"/><path d="M14 27h4"/>'),
  menu: svg('<rect x="4" y="6" width="24" height="18" rx="4"/><rect x="9" y="11" width="14" height="8" fill="currentColor"/><path d="M12 27h8"/>'),
  pani: svg('<path d="M3 20c0-5 4-7 8-7h9c3 0 4 2 4 3s-1 3-4 3h-6"/><path d="M5 24c4 2 12 2 20-1"/><path d="M24 9h5M26.5 6.5v5"/>'),
  tendencia: svg('<path d="M5 4v24h3M5 8h3M5 14h3M5 20h3"/><path d="M10 22c4-8 7 2 12-6"/>'),
  tabla: svg('<rect x="6" y="4" width="20" height="24" rx="2"/><path d="M6 12h20M6 19h20M14 4v24"/>'),
  alarmaRev: svg('<path d="M4 14a8 8 0 0 1 8-8"/><path d="M4 14l3-3M4 14l3 3"/><path d="M15 25V17a5 5 0 0 1 10 0v8l1.5 1.5h-13z"/>'),
  arr: svg('<path d="M3 18h5l3-10 4 18 3-12 2 4h9"/>'),
  estandar: svg('<rect x="4" y="5" width="24" height="22" rx="2"/><path d="M7 11c3-3 4 3 7 0s4 3 7 0M7 17c3-3 4 3 7 0s4 3 7 0M7 23c3-3 4 3 7 0"/>'),
  oxycrg: svg('<circle cx="11" cy="8" r="3"/><path d="M6 27v-9c0-3 10-3 10 0v9"/><rect x="19" y="14" width="9" height="10" rx="1"/>'),
  fuente: svg('<rect x="3" y="7" width="26" height="18" rx="2"/><path d="M7 21l3-9 3 9M8 18h4M17 21l4-9 4 9M18.5 18h5"/>'),
  ecg12: svg('<path d="M3 20h5l3-12 4 18 3-10 2 4h9"/><path d="M24 4h4M26 4v6" />'),
  salir12: svg('<rect x="4" y="4" width="24" height="24" rx="2"/><path d="M10 10l12 12M22 10L10 22"/>'),
  admision: svg('<circle cx="10" cy="7" r="3"/><path d="M6 27l3-10 4 4v6M9 17l-3 4"/><rect x="18" y="5" width="9" height="22" rx="1"/><circle cx="22" cy="17" r="1" fill="currentColor"/>'),
  congelar: svg('<rect x="4" y="5" width="24" height="22" rx="5"/><path d="M10 11l5 5-5 5zM22 11l-5 5 5 5z" fill="currentColor"/>'),
  registro: svg('<rect x="7" y="4" width="18" height="24" rx="1"/><path d="M10 16l3-4 3 8 3-6 2 2"/>'),
  modulos: svg('<circle cx="16" cy="16" r="5"/><path d="M16 3v4M16 25v4M3 16h4M25 16h4M7 7l3 3M22 22l3 3M25 7l-3 3M7 25l3-3"/>'),
  volTeclas: svg('<path d="M4 12l5-2v7l-5 2zM13 21h4M18 21h4M23 21h4M13 17h4M18 17h4M18 13h4"/>'),
  volLatido: svg('<path d="M16 14c-4-6-10-1-6 4l6 5 6-5c4-5-2-10-6-4z"/><path d="M5 28h4M11 28h4M17 28h4M23 28h4"/>'),
  brillo: svg('<circle cx="16" cy="16" r="6" fill="currentColor"/><path d="M16 3v4M16 25v4M3 16h4M25 16h4M7 7l3 3M22 22l3 3M25 7l-3 3M7 25l3-3"/>'),
  alarmaCfg: svg('<path d="M4 24l8-15 6 15"/><path d="M18 24V10h9"/>'),
  standby: svg('<path d="M16 4v12"/><path d="M9 8a11 11 0 1 0 14 0"/>'),
  noche: svg('<path d="M24 20A11 11 0 0 1 12 4a11 11 0 1 0 12 16z" fill="currentColor"/><path d="M25 5l1 3 3 1-3 1-1 3-1-3-3-1 3-1z"/>'),
  izq: svg('<path d="M20 6L10 16l10 10" fill="currentColor"/>'),
  der: svg('<path d="M12 6l10 10-10 10" fill="currentColor"/>'),
  cama: svg('<path d="M3 24V10M3 19h26v5M29 19v-4a4 4 0 0 0-4-4H13v8"/><circle cx="8" cy="15" r="2"/>'),
  persona: svg('<circle cx="16" cy="8" r="4"/><path d="M9 28V15c0-3 14-3 14 0v13"/>'),
  corazon: svg('<path d="M16 28C5 20 4 12 8 8s8-1 8 3c0-4 4-7 8-3s3 12-8 20z" fill="currentColor"/>'),
  ca: svg('<path d="M3 16c3-6 6-6 9 0s6 6 9 0 6-6 8 0"/>'),
  bateria: svg('<rect x="3" y="10" width="22" height="12" rx="2"/><path d="M27 14v4"/><rect x="6" y="13" width="14" height="6" fill="currentColor"/>'),
  red: svg('<rect x="11" y="3" width="10" height="7"/><path d="M16 10v6M6 16h20M6 16v4M26 16v4M16 16v4"/><rect x="2" y="20" width="8" height="7"/><rect x="22" y="20" width="8" height="7"/><rect x="12" y="20" width="8" height="7"/>'),
};

/** Devuelve el SVG de un icono (cadena vacía si no existe). */
export const icono = (nombre) => ICONOS[nombre] || '';
