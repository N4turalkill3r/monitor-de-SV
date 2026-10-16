/**
 * @file tab-proyeccion.js
 * @description Pestaña "Proyectar": abre la ventana de proyección (sólo el monitor, para el
 * proyector o la pantalla de la clase) y gestiona una PRESENTACIÓN estilo PowerPoint:
 * diapositivas de monitor (con el estado guardado), texto, imagen y casos clínicos; con
 * navegación, pantalla negra, guardado local e importación/exportación JSON.
 *
 * Se ejecuta en: SOLO la ventana maestra (instructor).
 */
import { estado, emitir, escuchar } from '../core/estado.js';
import { el } from '../ui/formularios.js';
import { CASOS } from '../docencia/casos.js';
import { seccion } from './panel.js';
import { aplicarCaso } from './tab-docente.js';

const CLAVE = 'monitor.diapositivas.v1';
const leer = () => { try { return JSON.parse(localStorage.getItem(CLAVE) || '[]'); } catch { return []; } };
const guardar = (l) => { try { localStorage.setItem(CLAVE, JSON.stringify(l)); } catch { alert('No hay espacio para guardar la presentación (¿imágenes muy grandes?).'); } };

export function construirProyeccion(cont, { motor, sync }) {
  let diaps = leer();
  let indice = -1;
  const estadoConexion = el('p', { class: 'ayuda' });
  const lista = el('ol', { class: 'diaps' });

  /* ---- Ventana de proyección ---- */
  const abrir = () => {
    const url = new URL(location.href);
    url.search = '?modo=proyeccion';
    window.open(url.toString(), 'proyeccion-monitor', 'popup,width=1280,height=800');
  };
  const presentar = () => {
    document.body.classList.add('presentando');
    document.documentElement.requestFullscreen?.().catch(() => {});
    document.dispatchEvent(new CustomEvent('cerrar-panel'));
  };
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') document.body.classList.remove('presentando');
  });
  setInterval(() => (estadoConexion.textContent = sync && sync.conectado() ? '● Proyección conectada' : '○ Sin proyección abierta'), 1000);

  /* ---- Mostrar una diapositiva ---- */
  function ir(i) {
    if (!diaps.length) return;
    indice = Math.max(0, Math.min(diaps.length - 1, i));
    const d = diaps[indice];
    if (d.tipo === 'monitor' && d.estado) {
      estado.aplicar({ ...d.estado, sistema: { ...d.estado.sistema, encendido: true } });
      emitir('motor:reiniciar');
    }
    if (d.tipo === 'monitor' && d.casoId) {
      const c = CASOS.find((x) => x.id === d.casoId);
      if (c) aplicarCaso(motor, c);
    }
    const { estado: _omitido, ...ligera } = d;
    emitir('diapositiva:mostrar', { diapositiva: ligera, indice, total: diaps.length });
    pintar();
  }
  escuchar('diapositiva:siguiente', () => ir(indice + 1));
  escuchar('diapositiva:anterior', () => ir(indice - 1));
  document.addEventListener('cmd-diapositiva', (e) => {
    if (e.detail === 'diapositiva:siguiente') ir(indice + 1);
    else if (e.detail === 'diapositiva:anterior') ir(indice - 1);
    else emitir(e.detail);
  });

  /* ---- Lista editable ---- */
  function pintar() {
    lista.innerHTML = '';
    if (!diaps.length) lista.append(el('li', { class: 'vacio', texto: 'La presentación está vacía. Añada diapositivas abajo.' }));
    diaps.forEach((d, i) => {
      lista.append(el('li', { class: i === indice ? 'actual' : '' },
        el('button', { class: 'diap-ir', onClick: () => ir(i) }, el('b', { texto: `${i + 1}. ${d.titulo || '(sin título)'}` }), el('small', { texto: d.tipo })),
        el('button', { class: 'mini', 'aria-label': 'Subir', texto: '▲', onClick: () => mover(i, -1) }),
        el('button', { class: 'mini', 'aria-label': 'Bajar', texto: '▼', onClick: () => mover(i, 1) }),
        el('button', { class: 'mini', 'aria-label': 'Eliminar', texto: '🗑', onClick: () => { diaps.splice(i, 1); guardar(diaps); pintar(); } }),
      ));
    });
  }
  function mover(i, d) {
    const j = i + d;
    if (j < 0 || j >= diaps.length) return;
    [diaps[i], diaps[j]] = [diaps[j], diaps[i]];
    guardar(diaps);
    pintar();
  }
  const añadir = (d) => { diaps.push({ id: Date.now(), ...d }); guardar(diaps); pintar(); };

  /* ---- Formularios de alta ---- */
  const tit = el('input', { type: 'text', placeholder: 'Título', maxlength: 80 });
  const txt = el('textarea', { rows: 3, placeholder: 'Texto de la diapositiva (una línea por párrafo)' });
  const ley = el('input', { type: 'text', placeholder: 'Leyenda sobre el monitor (opcional)', maxlength: 140 });
  const selCaso = el('select', {}, ...CASOS.map((c) => el('option', { value: c.id, texto: c.nombre })));
  const archivo = el('input', { type: 'file', accept: 'image/*', hidden: true, onChange: (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => añadir({ tipo: 'imagen', titulo: tit.value || f.name, imagen: r.result });
    r.readAsDataURL(f);
    e.target.value = '';
  } });
  const alta = el('div', {},
    tit, txt, ley,
    el('div', { class: 'fila-botones' },
      el('button', { class: 'btn', texto: '+ Texto', onClick: () => añadir({ tipo: 'texto', titulo: tit.value, texto: txt.value }) }),
      el('button', { class: 'btn', texto: '+ Monitor (estado actual)', onClick: () => añadir({ tipo: 'monitor', titulo: tit.value || estado.obtener('escenario.titulo') || 'Monitor', leyenda: ley.value, estado: estado.instantanea() }) }),
      el('label', { class: 'btn' }, '+ Imagen', archivo),
    ),
    el('div', { class: 'campo' }, el('label', { texto: 'Caso clínico' }), selCaso),
    el('div', { class: 'fila-botones' }, el('button', { class: 'btn', texto: '+ Caso (monitor + viñeta)', onClick: () => {
      const c = CASOS.find((x) => x.id === selCaso.value);
      añadir({ tipo: 'monitor', titulo: c.nombre, casoId: c.id, leyenda: ley.value || c.clinica });
    } })),
  );

  const nav = el('div', { class: 'fila-botones nav-diaps' },
    el('button', { class: 'btn', texto: '⏮ Anterior', onClick: () => ir(indice - 1) }),
    el('button', { class: 'btn', texto: 'Siguiente ⏭', onClick: () => ir(indice + 1) }),
    el('button', { class: 'btn', texto: '▣ Mostrar monitor', onClick: () => emitir('diapositiva:ocultar') }),
    el('button', { class: 'btn', texto: '■ Pantalla negra', onClick: () => emitir('diapositiva:negro') }),
  );
  const archivoPres = el('div', { class: 'fila-botones' },
    el('button', { class: 'btn', texto: 'Exportar presentación', onClick: () => {
      const a = el('a', { href: URL.createObjectURL(new Blob([JSON.stringify(diaps)], { type: 'application/json' })), download: 'presentacion-monitor.json' });
      a.click();
      URL.revokeObjectURL(a.href);
    } }),
    el('label', { class: 'btn' }, 'Importar', el('input', { type: 'file', accept: 'application/json', hidden: true, onChange: async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      try { diaps = JSON.parse(await f.text()); guardar(diaps); pintar(); } catch { alert('Archivo de presentación no válido.'); }
      e.target.value = '';
    } })),
  );

  cont.append(
    seccion('Ventana de proyección', el('div', {}, el('p', { class: 'ayuda', texto: 'Abra la proyección en la pantalla/proyector de la clase: mostrará solo el monitor, sincronizado con este panel. Flechas ← → para pasar diapositivas, B pantalla negra, F pantalla completa.' }), estadoConexion, el('div', { class: 'fila-botones' }, el('button', { class: 'btn btn-primario', texto: '🖥 Abrir ventana de proyección', onClick: abrir }), el('button', { class: 'btn', texto: 'Presentar en esta ventana', onClick: presentar }), el('button', { class: 'btn', texto: 'Pantalla completa', onClick: () => document.documentElement.requestFullscreen?.() }))), true),
    seccion('Presentación', el('div', {}, nav, lista), true),
    seccion('Añadir diapositiva', alta),
    seccion('Guardar / cargar', archivoPres),
  );
  pintar();
}
