/**
 * @file tab-escenarios.js
 * @description Pestaña "Escenarios": aplica escenarios clínicos predefinidos, guarda y
 * carga escenarios propios (localStorage), exporta/importa archivos JSON y define el
 * título/descripción del escenario para el instructor.
 *
 * Se ejecuta en: SOLO la ventana maestra (instructor).
 */
import { estado, emitir } from '../core/estado.js';
import { el, formulario } from '../ui/formularios.js';
import { ESCENARIOS } from './escenarios-datos.js';
import { seccion } from './panel.js';

const CLAVE = 'monitor.escenarios.v1';

/** Lee la lista de escenarios guardados (tolerante a almacenamiento no disponible). */
function leerGuardados() {
  try { return JSON.parse(localStorage.getItem(CLAVE) || '[]'); } catch { return []; }
}
function escribirGuardados(lista) {
  try { localStorage.setItem(CLAVE, JSON.stringify(lista)); } catch { /* sin almacenamiento */ }
}

/** Aplica un conjunto de rutas → valores al estado. */
export function aplicarConjunto(set) {
  if (set['paciente.tipo']) estado.fijar('paciente.tipo', set['paciente.tipo']);
  for (const [ruta, valor] of Object.entries(set)) if (ruta !== 'paciente.tipo') estado.fijar(ruta, valor);
  emitir('motor:reiniciar');
}

export function construirEscenarios(cont) {
  const lista = el('div', { class: 'tarjetas' });
  for (const e of ESCENARIOS) {
    lista.append(el('button', { class: 'tarjeta', onClick: () => { aplicarConjunto(e.set); estado.fijar('escenario', { titulo: e.nombre, descripcion: e.descripcion }); } }, el('b', { texto: e.nombre }), el('small', { texto: e.descripcion })));
  }

  const guardados = el('div', { class: 'tarjetas' });
  const nombre = el('input', { type: 'text', placeholder: 'Nombre del escenario', maxlength: 40 });
  const pintar = () => {
    guardados.innerHTML = '';
    const g = leerGuardados();
    if (!g.length) guardados.append(el('i', { texto: 'No hay escenarios guardados.' }));
    g.forEach((s, i) => guardados.append(el('div', { class: 'tarjeta fila' }, el('b', { texto: s.nombre }), el('button', { class: 'btn', texto: 'Cargar', onClick: () => estado.aplicar(s.estado) }), el('button', { class: 'btn', texto: '🗑', 'aria-label': 'Eliminar', onClick: () => { g.splice(i, 1); escribirGuardados(g); pintar(); } }))));
  };
  const guardar = el('div', { class: 'fila-botones' }, nombre, el('button', { class: 'btn', texto: 'Guardar estado actual', onClick: () => {
    const g = leerGuardados();
    g.push({ nombre: nombre.value.trim() || `Escenario ${g.length + 1}`, estado: estado.instantanea() });
    escribirGuardados(g);
    nombre.value = '';
    pintar();
  } }));

  const exportar = el('div', { class: 'fila-botones' },
    el('button', { class: 'btn', texto: 'Exportar JSON', onClick: () => {
      const blob = new Blob([JSON.stringify(estado.instantanea(), null, 2)], { type: 'application/json' });
      const a = el('a', { href: URL.createObjectURL(blob), download: 'escenario-monitor.json' });
      a.click();
      URL.revokeObjectURL(a.href);
    } }),
    el('label', { class: 'btn' }, 'Importar JSON', el('input', { type: 'file', accept: 'application/json', hidden: true, onChange: async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      try { estado.aplicar(JSON.parse(await f.text())); } catch { alert('El archivo no es un escenario válido.'); }
      e.target.value = '';
    } })),
    el('button', { class: 'btn', texto: 'Restablecer fábrica', onClick: () => { estado.reiniciar(estado.obtener('paciente.tipo')); emitir('motor:reiniciar'); } }),
  );

  cont.append(
    seccion('Notas del escenario (sólo instructor)', formulario([
      { etiqueta: 'Título', ruta: 'escenario.titulo', tipo: 'texto', max: 60 },
      { etiqueta: 'Descripción', ruta: 'escenario.descripcion', tipo: 'texto', max: 140 },
    ]), true),
    seccion('Escenarios predefinidos', lista, true),
    seccion('Mis escenarios', el('div', {}, guardar, guardados)),
    seccion('Archivo', exportar),
  );
  pintar();
}
