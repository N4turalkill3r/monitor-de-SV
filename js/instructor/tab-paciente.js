/**
 * @file tab-paciente.js
 * @description Pestaña "Paciente": datos del paciente y constantes vitales objetivo.
 * El monitor "mide" estos valores y los hace converger gradualmente (tiempo de transición).
 *
 * Se ejecuta en: SOLO la ventana maestra (instructor).
 */
import { estado, emitir } from '../core/estado.js';
import { el, campo, formulario } from '../ui/formularios.js';
import { itemsVitales, MENUS } from '../ui/definicion-menus.js';
import { seccion } from './panel.js';

export function construirPaciente(cont, { motor }) {
  const sistema = formulario([
    { etiqueta: 'Monitor encendido', ruta: 'sistema.encendido', tipo: 'bool' },
    { etiqueta: 'Congelar pantalla', ruta: 'sistema.congelado', tipo: 'bool' },
    { etiqueta: 'Tiempo de transición (s)', ruta: 'transicion', tipo: 'num', min: 0, max: 120, paso: 1, ayuda: 'Los valores cambian de forma gradual en este tiempo' },
  ]);
  const vitales = formulario(itemsVitales());
  const accion = el('div', { class: 'fila-botones' },
    el('button', { class: 'btn', texto: '▶ Medir PANI', onClick: () => emitir('nibp:iniciar', { id: Date.now() }) }),
    el('button', { class: 'btn', texto: '■ Cancelar PANI', onClick: () => emitir('nibp:cancelar') }),
    el('button', { class: 'btn', texto: 'Silenciar alarma', onClick: () => emitir('alarma:silenciar') }),
  );
  const fisio = formulario([
    { etiqueta: 'Pulso periférico', ruta: 'ecg.pulso', opciones: { auto: 'Automático (según el ritmo)', si: 'Presente', no: 'Ausente (sin pulso)' }, ayuda: 'Con "Ausente" el ECG puede mostrar complejos pero no hay pletismografía ni presión (AESP)' },
    { etiqueta: 'Apnea (sin respiración)', ruta: 'resp.apnea', tipo: 'bool' },
    { etiqueta: 'Amplitud respiratoria', ruta: 'resp.amplitud', opciones: [[0.25, 'x0.25'], [0.5, 'x0.5'], [1, 'x1'], [2, 'x2'], [4, 'x4']] },
    { etiqueta: 'Capnograma', ruta: 'co2.patron', opciones: { normal: 'Normal', broncoespasmo: 'Broncoespasmo', rebreathing: 'Reinhalación' } },
  ]);
  cont.append(
    seccion('Control del monitor', sistema, true),
    seccion('Constantes vitales (valores objetivo)', vitales, true),
    accion,
    seccion('Fisiología avanzada', fisio),
    seccion('Datos del paciente', formulario(MENUS.paciente())),
  );
  void motor;
  void campo;
}
