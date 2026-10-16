/**
 * @file diapositivas.js
 * @description Capa de PRESENTACIÓN tipo PowerPoint sobre el monitor: muestra diapositivas
 * de texto o imagen a pantalla completa y una leyenda inferior sobre las diapositivas de
 * monitor. Responde a los eventos del bus 'diapositiva:mostrar', 'diapositiva:ocultar' y
 * 'diapositiva:negro'.
 *
 * Se ejecuta en: AMBOS. El overlay completo sólo se pinta en la ventana de proyección
 * o cuando el instructor activa "Presentar en esta ventana" (body.presentando).
 * Las flechas del teclado en la proyección envían comandos a la ventana maestra.
 */
import { escuchar } from '../core/estado.js';
import { el } from './formularios.js';

/**
 * @param {HTMLElement} destino contenedor donde se inserta la capa
 * @param {{rol:'maestro'|'seguidor', sync:{comando:Function}}} opc
 */
export function iniciarDiapositivas(destino, { rol, sync }) {
  const titulo = el('h1');
  const cuerpo = el('div', { class: 'diap-cuerpo' });
  const pie = el('div', { class: 'diap-pie' });
  const capa = el('div', { class: 'diapositiva', hidden: true }, titulo, cuerpo, pie);
  const leyenda = el('div', { class: 'leyenda-monitor', hidden: true });
  const negro = el('div', { class: 'pantalla-negra', hidden: true });
  destino.append(capa, leyenda, negro);

  const visible = () => rol === 'seguidor' || document.body.classList.contains('presentando');

  escuchar('diapositiva:mostrar', ({ diapositiva: d, indice, total }) => {
    negro.hidden = true;
    capa.hidden = true;
    leyenda.hidden = true;
    if (!d || !visible()) return;
    if (d.tipo === 'monitor') {
      if (d.leyenda) {
        leyenda.textContent = d.leyenda;
        leyenda.hidden = false;
      }
      return;
    }
    titulo.textContent = d.titulo || '';
    cuerpo.innerHTML = '';
    if (d.tipo === 'imagen') cuerpo.append(el('img', { src: d.imagen, alt: d.titulo || 'Imagen' }));
    else for (const linea of String(d.texto || '').split('\n')) cuerpo.append(el('p', { texto: linea }));
    pie.textContent = total ? `${(indice ?? 0) + 1} / ${total}` : '';
    capa.hidden = false;
  });
  escuchar('diapositiva:ocultar', () => {
    capa.hidden = true;
    leyenda.hidden = true;
    negro.hidden = true;
  });
  escuchar('diapositiva:negro', () => {
    if (visible()) negro.hidden = !negro.hidden;
  });

  // Teclado: la proyección pide a la maestra cambiar de diapositiva
  document.addEventListener('keydown', (e) => {
    if (!visible()) return;
    const manda = (nombre) => (rol === 'seguidor' ? sync.comando(nombre, {}) : document.dispatchEvent(new CustomEvent('cmd-diapositiva', { detail: nombre })));
    if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); manda('diapositiva:siguiente'); }
    else if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); manda('diapositiva:anterior'); }
    else if (e.key.toLowerCase() === 'b') manda('diapositiva:negro');
    else if (e.key.toLowerCase() === 'f') document.documentElement.requestFullscreen?.();
  });
}
