/**
 * @file tab-alarmas.js
 * @description Pestaña "Alarmas": límites de todas las alarmas fisiológicas, las 16 alarmas
 * de arritmia (interruptor y prioridad), opciones generales y provocación de alarmas
 * TÉCNICAS (electrodo suelto, sensor de SpO2 fuera, manguito flojo...).
 *
 * Se ejecuta en: SOLO la ventana maestra (instructor).
 */
import { estado } from '../core/estado.js';
import { ETIQUETAS_ALARMA, UNIDADES, RANGOS, ALARMAS_ARRITMIA, ALARMAS_TECNICAS, TIEMPOS_PAUSA_ALARMA } from '../core/config.js';
import { el, campo, formulario } from '../ui/formularios.js';
import { seccion } from './panel.js';

const NIVELES = { baja: 'Baja', media: 'Media', alta: 'Alta' };

export function construirAlarmas(cont, { alarmas }) {
  // Opciones generales
  const general = formulario([
    { etiqueta: 'Pausa de audio (s)', ruta: 'alarmas.tiempoPausa', opciones: TIEMPOS_PAUSA_ALARMA.map((t) => [t, `${t} s`]) },
    { etiqueta: 'Enclavar alarmas (latch)', ruta: 'alarmas.latch', tipo: 'bool' },
    { etiqueta: 'Alarmas de arritmia activas', ruta: 'alarmas.arritmiaActiva', tipo: 'bool' },
    { etiqueta: 'Tiempo de apnea (s)', ruta: 'resp.tiempoApnea', opciones: [10, 15, 20, 25, 30, 35, 40] },
  ]);

  // Tabla de límites (una fila por parámetro)
  const tabla = el('table', { class: 'tabla tabla-limites' }, el('tr', {}, ...['Parámetro', 'Bajo', 'Alto', 'On', 'Prioridad'].map((t) => el('th', { texto: t }))));
  for (const k of Object.keys(ETIQUETAS_ALARMA)) {
    const r = RANGOS[k] || { min: 0, max: 300 };
    const p = `alarmas.limites.${k}`;
    const celda = (it) => el('td', {}, campo({ etiqueta: '', ...it }));
    tabla.append(
      el('tr', {}, el('td', { texto: `${ETIQUETAS_ALARMA[k]} (${UNIDADES[k]})` }), celda({ ruta: `${p}.bajo`, tipo: 'num', min: r.min, max: r.max }), celda({ ruta: `${p}.alto`, tipo: 'num', min: r.min, max: r.max }), celda({ ruta: `${p}.activa`, tipo: 'bool' }), celda({ ruta: `${p}.nivel`, opciones: NIVELES })),
    );
  }

  // Alarmas de arritmia
  const tArr = el('table', { class: 'tabla' }, el('tr', {}, el('th', { texto: 'Arritmia' }), el('th', { texto: 'On' }), el('th', { texto: 'Prioridad' })));
  for (const [k, d] of Object.entries(ALARMAS_ARRITMIA)) {
    const p = `alarmas.arritmia.${k}`;
    tArr.append(el('tr', { title: d.def }, el('td', { texto: d.txt }), el('td', {}, campo({ etiqueta: '', ruta: `${p}.activa`, tipo: 'bool' })), el('td', {}, campo({ etiqueta: '', ruta: `${p}.nivel`, opciones: NIVELES }))));
  }

  // Alarmas técnicas provocables
  const tecnicas = formulario(Object.entries(ALARMAS_TECNICAS).map(([k, d]) => ({ etiqueta: d.txt, ruta: `tecnicas.${k}`, tipo: 'bool' })));

  // Registro en vivo de alarmas activas
  const activas = el('div', { class: 'alarmas-vivo' });
  const pintar = () => {
    activas.innerHTML = '';
    if (!alarmas.activas.length) activas.append(el('i', { texto: 'Sin alarmas activas' }));
    for (const a of alarmas.activas) activas.append(el('span', { class: `chip nivel-${a.nivel}`, texto: a.texto }));
  };
  setInterval(() => cont.isConnected && !cont.hidden && pintar(), 500);
  pintar();

  cont.append(
    seccion('Alarmas activas ahora', el('div', {}, activas, el('div', { class: 'fila-botones' }, el('button', { class: 'btn', texto: 'Silenciar / pausa', onClick: () => alarmas.silenciar() }), el('button', { class: 'btn', texto: 'Reconocer retenidas', onClick: () => alarmas.reconocer() }))), true),
    seccion('Opciones generales', general),
    seccion('Límites fisiológicos', el('div', { class: 'scroll-x' }, tabla)),
    seccion('Alarmas de arritmia (16)', el('div', { class: 'scroll-x' }, tArr)),
    seccion('Provocar alarmas técnicas', tecnicas),
  );
  void estado;
}
