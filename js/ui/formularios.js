/**
 * @file formularios.js
 * @description Constructor de controles de formulario enlazados al estado. Lo usan
 * tanto los menús del monitor como el panel del instructor, de modo que el instructor
 * puede modificar exactamente los mismos ajustes que el monitor real.
 *
 * Se ejecuta en: AMBOS (DOM). Un "item" es un objeto:
 *   { etiqueta, ruta, tipo:'select'|'num'|'bool'|'texto'|'rango'|'boton', opciones, min, max,
 *     paso, unidad, ayuda, alCambiar, accion }
 *  - `ruta`: ruta del estado ("ecg.ganancia"). Si es una función, se usa como lector.
 *  - `opciones`: array de valores, o de [valor, etiqueta], o un objeto {valor: etiqueta}.
 */
import { estado, emitir } from '../core/estado.js';

/** Crea un elemento con atributos y hijos. */
export function el(tag, attrs = {}, ...hijos) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k === 'texto') n.textContent = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v !== false && v !== null && v !== undefined) n.setAttribute(k, v === true ? '' : v);
  }
  for (const h of hijos.flat()) if (h !== null && h !== undefined) n.append(h.nodeType ? h : document.createTextNode(h));
  return n;
}

/** Normaliza opciones a [[valor, etiqueta], ...]. */
function normalizar(opc) {
  if (Array.isArray(opc)) return opc.map((o) => (Array.isArray(o) ? o : [o, String(o)]));
  return Object.entries(opc);
}

/** Convierte el texto de un <option> al tipo original del valor (número/booleano). */
function tipar(texto, muestra) {
  if (typeof muestra === 'number') return Number(texto);
  if (typeof muestra === 'boolean') return texto === 'true';
  return texto;
}

/**
 * Crea una fila de formulario enlazada al estado.
 * Devuelve el nodo; el campo se refresca solo cuando cambia la ruta del estado.
 */
export function campo(item) {
  const fila = el('div', { class: `campo campo-${item.tipo || 'select'}` });
  const etiqueta = el('label', { texto: item.etiqueta });
  if (item.ayuda) etiqueta.title = item.ayuda;
  fila.append(etiqueta);
  const leer = () => (typeof item.ruta === 'function' ? item.ruta() : estado.obtener(item.ruta));
  const escribir = (v) => {
    if (typeof item.ruta !== 'function') estado.fijar(item.ruta, v);
    if (item.alCambiar) item.alCambiar(v);
  };
  let control;
  let refrescar;

  switch (item.tipo || 'select') {
    case 'select': {
      const opc = normalizar(item.opciones);
      control = el('select', { onChange: (e) => escribir(tipar(e.target.value, opc[0]?.[0])) });
      for (const [v, t] of opc) control.append(el('option', { value: String(v), texto: t }));
      refrescar = () => (control.value = String(leer()));
      break;
    }
    case 'num': {
      const min = item.min ?? 0;
      const max = item.max ?? 999;
      const paso = item.paso ?? 1;
      control = el('div', { class: 'stepper' });
      const inp = el('input', { type: 'number', min, max, step: paso, inputmode: 'decimal' });
      const aplicar = (v) => {
        v = Math.min(max, Math.max(min, Number.isFinite(v) ? v : min));
        const d = (String(paso).split('.')[1] || '').length;
        escribir(Number(v.toFixed(d)));
      };
      const menos = el('button', { type: 'button', texto: '−', 'aria-label': 'Disminuir', onClick: () => aplicar(Number(inp.value) - paso) });
      const mas = el('button', { type: 'button', texto: '+', 'aria-label': 'Aumentar', onClick: () => aplicar(Number(inp.value) + paso) });
      inp.addEventListener('change', () => aplicar(Number(inp.value)));
      control.append(menos, inp, mas);
      if (item.unidad) control.append(el('span', { class: 'unidad', texto: item.unidad }));
      refrescar = () => {
        if (document.activeElement !== inp) inp.value = leer() ?? '';
      };
      break;
    }
    case 'rango': {
      const out = el('output');
      const inp = el('input', { type: 'range', min: item.min ?? 0, max: item.max ?? 100, step: item.paso ?? 1 });
      inp.addEventListener('input', () => {
        out.textContent = inp.value + (item.unidad ? ` ${item.unidad}` : '');
        escribir(Number(inp.value));
      });
      control = el('div', { class: 'rango' }, inp, out);
      refrescar = () => {
        inp.value = leer();
        out.textContent = inp.value + (item.unidad ? ` ${item.unidad}` : '');
      };
      break;
    }
    case 'bool': {
      control = el('label', { class: 'interruptor' });
      const inp = el('input', { type: 'checkbox', onChange: (e) => escribir(e.target.checked) });
      control.append(inp, el('span', { class: 'pista' }));
      refrescar = () => (inp.checked = !!leer());
      break;
    }
    case 'texto': {
      control = el('input', { type: 'text', maxlength: item.max ?? 32, onChange: (e) => escribir(e.target.value) });
      refrescar = () => {
        if (document.activeElement !== control) control.value = leer() ?? '';
      };
      break;
    }
    case 'boton': {
      fila.removeChild(etiqueta);
      control = el('button', { type: 'button', class: 'btn', texto: item.etiqueta, onClick: () => item.accion && item.accion() });
      refrescar = () => {};
      break;
    }
    default:
      control = el('span', { texto: '?' });
      refrescar = () => {};
  }
  fila.append(control);
  // Refresco automático; se da de baja solo cuando el campo sale del DOM (evita fugas al reconstruir menús)
  let conectado = false;
  let baja = () => {};
  const vigilante = (...a) => {
    if (fila.isConnected) conectado = true;
    else if (conectado) return baja();
    refrescar(...a);
  };
  if (item.ruta) baja = estado.suscribir(typeof item.ruta === 'function' ? '*' : item.ruta, vigilante);
  refrescar();
  return fila;
}

/** Crea un bloque de campos a partir de una lista de items. */
export function formulario(items, titulo) {
  const f = el('div', { class: 'formulario' });
  if (titulo) f.append(el('h4', { texto: titulo }));
  for (const it of items) f.append(it.nodo ? it.nodo : campo(it));
  return f;
}

/** Emite un evento del bus (atajo usado por botones). */
export const lanzar = (tipo, detalle) => emitir(tipo, detalle);
