/**
 * @file panel.js
 * @description Panel lateral del INSTRUCTOR: un cajón discreto en el borde derecho que se
 * despliega con una lengüeta. Contiene pestañas con TODOS los ajustes del monitor y las
 * herramientas docentes (simulador de arritmias FRI-EHI, escenarios, proyección).
 *
 * Se ejecuta en: SOLO la ventana maestra (instructor). La proyección no carga este panel.
 */
import { el } from '../ui/formularios.js';
import { construirPaciente } from './tab-paciente.js';
import { construirMonitor } from './tab-monitor.js';
import { construirAlarmas } from './tab-alarmas.js';
import { construirArritmias } from './tab-arritmias.js';
import { construirEscenarios } from './tab-escenarios.js';
import { construirProyeccion } from './tab-proyeccion.js';

/** Definición de pestañas: id, rótulo y constructor (se ejecuta al abrir por primera vez). */
const PESTANAS = [
  { id: 'paciente', texto: 'Paciente', icono: '🧑‍⚕️', f: construirPaciente },
  { id: 'arritmias', texto: 'Arritmias', icono: '〰️', f: construirArritmias },
  { id: 'monitor', texto: 'Monitor', icono: '🖥️', f: construirMonitor },
  { id: 'alarmas', texto: 'Alarmas', icono: '🔔', f: construirAlarmas },
  { id: 'escenarios', texto: 'Escenarios', icono: '🎬', f: construirEscenarios },
  { id: 'proyeccion', texto: 'Proyectar', icono: '📽️', f: construirProyeccion },
];

/** Crea una sección plegable (acordeón) con `<details>`. */
export function seccion(titulo, contenido, abierta = false) {
  const d = el('details', { class: 'seccion' }, el('summary', { texto: titulo }), el('div', { class: 'seccion-cuerpo' }, contenido));
  if (abierta) d.open = true;
  return d;
}

/**
 * Monta el panel.
 * @param {HTMLElement} raiz elemento <aside> contenedor
 * @param {object} ctx { motor, alarmas, sonidos, monitor, sync }
 */
export function montarPanel(raiz, ctx) {
  raiz.innerHTML = '';
  const lengueta = el('button', { class: 'lengueta', 'aria-label': 'Abrir panel del instructor', 'aria-expanded': 'false', title: 'Panel del instructor' }, el('span', { texto: 'INSTRUCTOR' }));
  const cuerpo = el('div', { class: 'panel-cuerpo' });
  const cab = el('div', { class: 'panel-cab' }, el('b', { texto: 'Panel del instructor' }), el('button', { class: 'cerrar', 'aria-label': 'Cerrar panel', texto: '✕', onClick: () => alternar(false) }));
  const barra = el('div', { class: 'pestanas', role: 'tablist' });
  const vistas = el('div', { class: 'vistas' });
  cuerpo.append(cab, barra, vistas);
  raiz.append(lengueta, cuerpo);

  const construidas = new Set();
  const activar = (id) => {
    barra.querySelectorAll('button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.id === id)));
    vistas.querySelectorAll('.vista').forEach((v) => (v.hidden = v.dataset.id !== id));
    if (!construidas.has(id)) {
      construidas.add(id);
      const def = PESTANAS.find((p) => p.id === id);
      def.f(vistas.querySelector(`.vista[data-id="${id}"]`), ctx);
    }
    try { localStorage.setItem('monitor.pestana', id); } catch { /* almacenamiento no disponible */ }
  };
  for (const p of PESTANAS) {
    barra.append(el('button', { role: 'tab', 'data-id': p.id, title: p.texto, onClick: () => activar(p.id) }, el('span', { class: 'p-ico', texto: p.icono }), el('span', { class: 'p-txt', texto: p.texto })));
    vistas.append(el('div', { class: 'vista', role: 'tabpanel', 'data-id': p.id, hidden: true }));
  }

  function alternar(abrir) {
    const abierto = abrir ?? !raiz.classList.contains('abierto');
    raiz.classList.toggle('abierto', abierto);
    document.body.classList.toggle('panel-abierto', abierto);
    lengueta.setAttribute('aria-expanded', String(abierto));
    // Reajustar el escalado del monitor tras la animación
    setTimeout(() => window.dispatchEvent(new Event('resize')), 300);
  }
  lengueta.addEventListener('click', () => alternar());
  document.addEventListener('cerrar-panel', () => alternar(false)); // lo emite 'Presentar en esta ventana'
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && raiz.classList.contains('abierto') && !document.body.classList.contains('presentando')) alternar(false);
  });

  let inicial = 'paciente';
  try { inicial = localStorage.getItem('monitor.pestana') || inicial; } catch { /* sin almacenamiento */ }
  if (!PESTANAS.some((p) => p.id === inicial)) inicial = 'paciente';
  activar(inicial);
  return { alternar, activar };
}
