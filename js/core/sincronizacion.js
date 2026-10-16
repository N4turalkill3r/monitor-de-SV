/**
 * @file sincronizacion.js
 * @description Comunicación entre la ventana del instructor (MAESTRA) y las ventanas de
 * proyección (SEGUIDORAS) mediante BroadcastChannel (mismo navegador y mismo origen).
 *
 * Se ejecuta en: AMBOS.
 *  - Maestra: envía el estado completo cada vez que cambia y reenvía los eventos del bus
 *    de la lista EVENTOS_SYNC (iniciar PANI, silenciar alarma, descargas...).
 *  - Seguidora: aplica el estado recibido y re-emite los eventos con `remoto: true` para
 *    que las acciones con efecto sobre el estado (p. ej. una descarga) no se repitan.
 */
import { estado, escuchar, emitir } from './estado.js';
import { CANAL_SINCRONIZACION } from './config.js';
import { antirrebote } from './utilidades.js';

/** Eventos del bus que se transmiten a las ventanas seguidoras. */
export const EVENTOS_SYNC = [
  'nibp:iniciar', 'nibp:cancelar', 'ecg:esv', 'ecg:ron_t', 'alarma:silenciar', 'alarma:reconocer',
  'intervencion:descarga', 'intervencion:carga', 'motor:reiniciar', 'diapositiva:mostrar', 'diapositiva:ocultar', 'diapositiva:negro', 'pantalla:vista',
];

/**
 * Inicia la sincronización.
 * @param {'maestro'|'seguidor'} rol
 * @returns {{cerrar: () => void, conectado: () => boolean}}
 */
export function iniciarSincronizacion(rol) {
  if (typeof BroadcastChannel === 'undefined') {
    console.warn('BroadcastChannel no disponible: la proyección no se sincronizará.');
    return { cerrar() {}, conectado: () => false };
  }
  const canal = new BroadcastChannel(CANAL_SINCRONIZACION);
  let ultimoMensaje = 0;

  if (rol === 'maestro') {
    const enviarEstado = () => canal.postMessage({ tipo: 'estado', datos: estado.instantanea() });
    const diferido = antirrebote(enviarEstado, 40);
    estado.suscribir('*', diferido);
    for (const ev of EVENTOS_SYNC) {
      escuchar(ev, (d) => {
        if (!d || !d.remoto) canal.postMessage({ tipo: 'evento', nombre: ev, detalle: d });
      });
    }
    canal.onmessage = (m) => {
      ultimoMensaje = Date.now();
      if (m.data.tipo === 'hola') enviarEstado(); // una proyección acaba de abrirse
      // Comandos enviados por la proyección (p. ej. flechas del teclado para pasar diapositivas)
      if (m.data.tipo === 'ctl') emitir(m.data.nombre, m.data.detalle || {});
    };
  } else {
    canal.onmessage = (m) => {
      ultimoMensaje = Date.now();
      const d = m.data;
      if (d.tipo === 'estado') estado.aplicar(d.datos);
      else if (d.tipo === 'evento') emitir(d.nombre, { ...(d.detalle || {}), remoto: true });
    };
    canal.postMessage({ tipo: 'hola' }); // pedir el estado actual a la ventana maestra
  }
  return {
    cerrar: () => canal.close(),
    conectado: () => Date.now() - ultimoMensaje < 5000,
    /** (Seguidor) envía un comando a la ventana maestra, que lo emite en su bus. */
    comando: (nombre, detalle) => canal.postMessage({ tipo: 'ctl', nombre, detalle }),
  };
}
