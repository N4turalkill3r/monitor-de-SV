/**
 * @file tab-arritmias.js
 * @description Pestaña "Arritmias": SIMULADOR DE ARRITMIAS con sub-pestañas
 *   1. Ritmos      → elegir ritmo y modificar todos sus parámetros (FC, PR, QRS, QTc, eje,
 *                    isquemia, hipertrofia, ruido, opciones propias de cada ritmo).
 *   2. Docente     → protocolo F-R-I / E-H-I interactivo (tab-docente.js).
 *   3. Casos y quiz→ casos clínicos y modo examen (tab-docente.js).
 *   4. Intervenciones → desfibrilador, cardioversión, adenosina, atropina.
 *   5. Atlas       → galería de trazados reales extraídos del manual del curso de ECG.
 *
 * Se ejecuta en: SOLO la ventana maestra (instructor).
 */
import { estado, emitir, escuchar } from '../core/estado.js';
import { el, campo, formulario } from '../ui/formularios.js';
import { RITMOS, definicionRitmo, ritmosAgrupados } from '../simulacion/ritmos.js';
import { PATRONES_ISQUEMIA, HIPERTROFIAS } from '../simulacion/ecg-modelo.js';
import { clasificarEje } from '../docencia/protocolo.js';
import { configIntervencion } from '../simulacion/intervenciones.js';
import { construirDocente, construirCasos } from './tab-docente.js';

const SUBTABS = [
  ['ritmos', 'Ritmos'],
  ['docente', 'Docente F-R-I-E-H-I'],
  ['casos', 'Casos y quiz'],
  ['interv', 'Intervenciones'],
  ['atlas', 'Atlas ECG'],
];

export function construirArritmias(cont, ctx) {
  const barra = el('div', { class: 'subtabs', role: 'tablist' });
  const zona = el('div', { class: 'subvistas' });
  cont.append(barra, zona);
  const cuerpos = {};
  const hechos = new Set();
  const constructores = { ritmos: construirRitmos, docente: construirDocente, casos: construirCasos, interv: construirIntervenciones, atlas: construirAtlas };
  const mostrar = (id) => {
    barra.querySelectorAll('button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.id === id)));
    for (const [k, n] of Object.entries(cuerpos)) n.hidden = k !== id;
    if (!hechos.has(id)) {
      hechos.add(id);
      constructores[id](cuerpos[id], ctx);
    }
  };
  for (const [id, t] of SUBTABS) {
    barra.append(el('button', { role: 'tab', 'data-id': id, texto: t, onClick: () => mostrar(id) }));
    cuerpos[id] = el('div', { class: 'subvista', hidden: true });
    zona.append(cuerpos[id]);
  }
  mostrar('ritmos');
}

/* ------------------------------------------------------------------ *
 * 1. RITMOS
 * ------------------------------------------------------------------ */
function construirRitmos(cont, { motor }) {
  // Selector agrupado de ritmos
  const sel = el('select', { 'aria-label': 'Ritmo cardíaco' });
  for (const g of ritmosAgrupados()) {
    const og = el('optgroup', { label: g.grupo });
    for (const r of g.items) og.append(el('option', { value: r.id, texto: r.nombre }));
    sel.append(og);
  }
  sel.addEventListener('change', () => motor.aplicarRitmo(sel.value));
  const nota = el('p', { class: 'ayuda' });
  const opcionesRitmo = el('div');
  const info = el('div', { class: 'ayuda' });

  // Se redibujan las opciones propias cuando cambia el ritmo desde cualquier sitio
  const refrescar = () => {
    const id = estado.obtener('ecg.ritmo');
    sel.value = id;
    const def = definicionRitmo(id);
    opcionesRitmo.innerHTML = '';
    const items = (def.opciones || []).map((o) => {
      const ruta = `ecg.opciones.${o.clave}`;
      if (o.tipo === 'select') return { etiqueta: o.etiqueta, ruta, opciones: o.valores };
      if (o.tipo === 'bool') return { etiqueta: o.etiqueta, ruta, tipo: 'bool' };
      return { etiqueta: o.etiqueta, ruta, tipo: 'num', min: o.min, max: o.max, paso: o.paso };
    });
    if (items.length) opcionesRitmo.append(formulario(items, 'Opciones de este ritmo'));
    nota.textContent = def.fcFija ? 'En este ritmo la frecuencia la determina el propio ritmo (no depende de la FC objetivo).' : `FC habitual: ${def.fc[0]}–${def.fc[1]} lpm.`;
    info.textContent = '';
  };
  const baja = estado.suscribir('ecg.ritmo', () => (cont.isConnected ? refrescar() : baja()));
  refrescar();

  const intervalos = formulario([
    { etiqueta: 'FC objetivo (lpm)', ruta: 'vitales.hr', tipo: 'num', min: 15, max: 300 },
    { etiqueta: 'Intervalo PR (s)', ruta: () => estado.obtener('ecg.opciones.pr') ?? '', tipo: 'num', min: 0.08, max: 0.6, paso: 0.01, alCambiar: (v) => estado.fijar('ecg.opciones.pr', v), ayuda: 'Normal 0.12–0.20 s' },
    { etiqueta: 'Duración del QRS (s)', ruta: () => estado.obtener('ecg.opciones.qrs') ?? '', tipo: 'num', min: 0.06, max: 0.3, paso: 0.01, alCambiar: (v) => estado.fijar('ecg.opciones.qrs', v), ayuda: 'Normal ≤ 0.10 s; ancho ≥ 0.12 s' },
    { etiqueta: 'QTc (s)', ruta: () => estado.obtener('ecg.opciones.qtc') ?? '', tipo: 'num', min: 0.3, max: 0.7, paso: 0.01, alCambiar: (v) => estado.fijar('ecg.opciones.qtc', v), ayuda: 'Normal ≤ 0.44 s' },
    { tipo: 'boton', etiqueta: 'PR/QRS/QTc automáticos', accion: () => { for (const k of ['pr', 'qrs', 'qtc']) estado.fijar(`ecg.opciones.${k}`, undefined); } },
  ], 'Frecuencia e intervalos (F-R-I)');

  const ejeEtq = el('small', { class: 'etq-eje' });
  const actEje = () => (ejeEtq.textContent = `Eje: ${estado.obtener('ecg.eje')}° → ${clasificarEje(estado.obtener('ecg.eje'))}`);
  estado.suscribir('ecg.eje', actEje);
  actEje();
  const forma = formulario([
    { etiqueta: 'Eje eléctrico del QRS (°)', ruta: 'ecg.eje', tipo: 'rango', min: -90, max: 180, paso: 5 },
    { nodo: ejeEtq },
    { etiqueta: 'Voltaje del QRS (×)', ruta: 'ecg.voltaje', tipo: 'rango', min: 0.2, max: 2.5, paso: 0.1 },
    { etiqueta: 'Interferencia / ruido', ruta: 'ecg.ruido', tipo: 'rango', min: 0, max: 1, paso: 0.05 },
  ], 'Eje y voltaje (E)');

  const isquemia = formulario([
    { etiqueta: 'Patrón de isquemia / lesión', ruta: 'ecg.patron', opciones: Object.fromEntries(Object.entries(PATRONES_ISQUEMIA).map(([k, v]) => [k, v.nombre])), alCambiar: (v) => { if (v !== 'ninguno' && !(estado.obtener('ecg.st') > 0)) estado.fijar('ecg.st', 0.25); } },
    { etiqueta: 'Intensidad (mV)', ruta: 'ecg.st', tipo: 'rango', min: 0, max: 0.6, paso: 0.05, ayuda: '1 mm = 0.1 mV. ST anormal si ≥ 1 mm' },
  ], 'Isquemia (I)');

  const hip = formulario([{ etiqueta: 'Crecimiento de cavidades', ruta: 'ecg.hipertrofia', opciones: HIPERTROFIAS }], 'Hipertrofia (H)');
  const manual = el('div', { class: 'fila-botones' },
    el('button', { class: 'btn', texto: '＋ ESV ahora', onClick: () => emitir('ecg:esv') }),
    el('button', { class: 'btn', texto: '＋ R sobre T', onClick: () => emitir('ecg:ron_t') }),
  );
  cont.append(el('div', { class: 'campo' }, el('label', { texto: 'Ritmo' }), sel), nota, opcionesRitmo, intervalos, forma, isquemia, hip, manual, info);
  void RITMOS;
  void campo;
}

/* ------------------------------------------------------------------ *
 * 4. INTERVENCIONES
 * ------------------------------------------------------------------ */
function construirIntervenciones(cont) {
  const fis = { energia: 150, sincronizada: false };
  const registro = el('ul', { class: 'registro' });
  const anotar = (t) => registro.prepend(el('li', { texto: `${new Date().toLocaleTimeString('es')} · ${t}` }));
  escuchar('intervencion:resultado', (d) => anotar(d.texto));

  const energias = [50, 70, 100, 120, 150, 200, 300, 360];
  const selE = el('select', { onChange: (e) => (fis.energia = Number(e.target.value)) }, ...energias.map((j) => el('option', { value: j, texto: `${j} J`, selected: j === 150 })));
  const sync = el('input', { type: 'checkbox', onChange: (e) => (fis.sincronizada = e.target.checked) });
  const desf = el('div', { class: 'bloque-interv' },
    el('h4', { texto: 'Desfibrilador / cardioversor' }),
    el('div', { class: 'campo' }, el('label', { texto: 'Energía' }), selE),
    el('div', { class: 'campo' }, el('label', { texto: 'Modo SINCRONIZADO' }), el('label', { class: 'interruptor' }, sync, el('span', { class: 'pista' }))),
    el('div', { class: 'fila-botones' },
      el('button', { class: 'btn', texto: '⚡ Cargar', onClick: () => { emitir('intervencion:carga', { duracion: 2 }); anotar(`Cargando ${fis.energia} J${fis.sincronizada ? ' (sinc.)' : ''}`); } }),
      el('button', { class: 'btn btn-peligro', texto: '⚡ DESCARGAR', onClick: () => { emitir('intervencion:descarga', { energia: fis.energia, sincronizada: fis.sincronizada }); anotar(`Descarga ${fis.energia} J${fis.sincronizada ? ' sincronizada' : ' NO sincronizada'}`); } }),
    ),
  );
  const farm = el('div', { class: 'bloque-interv' },
    el('h4', { texto: 'Fármacos' }),
    el('div', { class: 'fila-botones' },
      el('button', { class: 'btn', texto: 'Adenosina 6 mg', onClick: () => { emitir('intervencion:adenosina', { dosis: 6 }); anotar('Adenosina 6 mg IV rápida'); } }),
      el('button', { class: 'btn', texto: 'Adenosina 12 mg', onClick: () => { emitir('intervencion:adenosina', { dosis: 12 }); anotar('Adenosina 12 mg IV rápida'); } }),
      el('button', { class: 'btn', texto: 'Atropina 1 mg', onClick: () => { emitir('intervencion:atropina', {}); anotar('Atropina 1 mg IV'); } }),
    ),
  );
  const cfg = formulario([
    { etiqueta: 'Resultado de la intervención', ruta: () => configIntervencion.resultado, opciones: { auto: 'Automático (realista)', convierte: 'Siempre convierte', no: 'Nunca convierte' }, alCambiar: (v) => (configIntervencion.resultado = v) },
    { etiqueta: 'Ritmo tras convertir', ruta: () => configIntervencion.respuesta, opciones: { sinusal: 'Sinusal normal', bradicardia_sinusal: 'Bradicardia sinusal', nodal: 'Ritmo nodal', escape_ventricular: 'Escape ventricular', aesp: 'AESP (sin pulso)' }, alCambiar: (v) => (configIntervencion.respuesta = v) },
  ], 'Control del instructor');
  cont.append(desf, farm, cfg, el('h4', { texto: 'Registro' }), registro);
}

/* ------------------------------------------------------------------ *
 * 5. ATLAS
 * ------------------------------------------------------------------ */
function construirAtlas(cont) {
  cont.append(el('p', { class: 'ayuda', texto: 'Trazados reales del manual del curso de ECG. Toque una imagen para ampliarla o proyectarla.' }));
  const filtro = el('input', { type: 'number', min: 1, placeholder: 'Filtrar por página' });
  const grid = el('div', { class: 'atlas' });
  cont.append(el('div', { class: 'campo' }, el('label', { texto: 'Página' }), filtro), grid);
  let datos = [];
  const pintar = () => {
    grid.innerHTML = '';
    const p = Number(filtro.value);
    for (const d of datos.filter((x) => !p || x.pagina === p)) {
      const ruta = `assets/ekg/${d.archivo}`;
      grid.append(el('button', { class: 'atlas-it', title: `Página ${d.pagina}`, onClick: () => ampliar(ruta, d.pagina) }, el('img', { src: ruta, loading: 'lazy', alt: `Trazado de ECG, página ${d.pagina} del manual` }), el('small', { texto: `p. ${d.pagina}` })));
    }
  };
  filtro.addEventListener('input', pintar);
  fetch('assets/ekg/indice.json').then((r) => r.json()).then((j) => { datos = Array.isArray(j) ? j : j.imagenes || []; pintar(); }).catch(() => grid.append(el('i', { texto: 'No se pudo cargar el índice del atlas.' })));

  function ampliar(ruta, pagina) {
    const capa = el('div', { class: 'visor' },
      el('img', { src: ruta, alt: `ECG página ${pagina}` }),
      el('div', { class: 'fila-botones' },
        el('button', { class: 'btn', texto: '📽 Proyectar', onClick: () => emitir('diapositiva:mostrar', { diapositiva: { tipo: 'imagen', titulo: `Trazado de ECG (manual, p. ${pagina})`, imagen: ruta } }) }),
        el('button', { class: 'btn', texto: 'Cerrar', onClick: () => capa.remove() }),
      ),
    );
    document.body.append(capa);
  }
}
