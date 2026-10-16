/**
 * @file intervenciones.js
 * @description Respuesta del paciente simulado a intervenciones del alumno: desfibrilación,
 * cardioversión sincronizada, adenosina, marcapasos y RCP. El instructor puede forzar el
 * resultado ("convierte" / "no convierte") o dejar el modo automático (realista).
 *
 * Se ejecuta en: SOLO la ventana maestra (instructor). La proyección recibe el cambio de
 * ritmo por la sincronización del estado (los eventos llegan con `remoto: true` y se ignoran).
 *
 * Reglas del modo automático (docentes, simplificadas):
 *  - Desfibrilación (no sincronizada): FV / TV sin pulso / torsades sin pulso con
 *    energía ≥ 120 J (adulto) → ritmo sinusal tras 2 s de asistolia. Con energía menor, sin cambio.
 *    Sobre ritmos CON pulso → riesgo de inducir FV (descarga en la onda T).
 *    Sobre asistolia → sin efecto (no es ritmo desfibrilable).
 *  - Cardioversión sincronizada: TSV, FA, flúter, TV con pulso → sinusal si la energía es suficiente.
 *    Sobre FV sincronizada: el monitor no encuentra la onda R y no descarga.
 *  - Adenosina: TSV → asistolia breve (6 s) y luego sinusal (dosis ≥ 6 mg).
 */
import { estado, escuchar, emitir } from '../core/estado.js';

/** Energía mínima eficaz (J) por tipo de intervención en adultos. */
const UMBRAL = { desfibrilar: 120, sincronizada: { tsv: 50, fa: 120, flutter: 50, tv: 100, taq_auricular: 50 } };

/** Resultado forzado por el instructor: 'auto' | 'convierte' | 'no' */
export const configIntervencion = { resultado: 'auto', respuesta: 'sinusal' };

let temporizador = null;

/** Cambia al ritmo `id` tras `retardo` ms, pasando antes por asistolia si se pide. */
function irARitmo(motor, id, { retardo = 0, asistolia = 0, hr = 75 } = {}) {
  clearTimeout(temporizador);
  const aplicar = () => {
    motor.aplicarRitmo(id);
    if (hr) estado.fijar('vitales.hr', hr);
    if (id === 'sinusal' || id === 'bradicardia_sinusal') {
      estado.fijar('ecg.pulso', 'auto');
    }
  };
  if (asistolia > 0) {
    motor.aplicarRitmo('asistolia');
    temporizador = setTimeout(aplicar, asistolia);
  } else {
    temporizador = setTimeout(aplicar, retardo);
  }
}

/** Registra los manejadores de eventos (llamar una sola vez en la ventana maestra). */
export function iniciarIntervenciones(motor, sonidos) {
  escuchar('intervencion:carga', (d) => {
    sonidos.carga(d.duracion || 2);
  });

  escuchar('intervencion:descarga', (d) => {
    sonidos.descarga(); // suena en todas las ventanas
    if (d.remoto) return; // la lógica sólo corre en la maestra
    const id = estado.obtener('ecg.ritmo');
    const forzado = configIntervencion.resultado;
    const energia = d.energia ?? 150;
    const sincronizada = !!d.sincronizada;
    const sinPulso = ['fv', 'torsades', 'tv'].includes(id) && estado.obtener('ecg.pulso') === 'no';
    const desfibrilable = id === 'fv' || sinPulso;

    if (id === 'asistolia' || id === 'aesp') return; // no desfibrilables
    if (sincronizada) {
      if (id === 'fv') return; // sin onda R reconocible no hay disparo sincronizado
      const umbral = UMBRAL.sincronizada[id];
      const ok = forzado === 'convierte' || (forzado === 'auto' && umbral !== undefined && energia >= umbral);
      if (ok) irARitmo(motor, configIntervencion.respuesta, { asistolia: 1200 });
      return;
    }
    if (desfibrilable) {
      const ok = forzado === 'convierte' || (forzado === 'auto' && energia >= UMBRAL.desfibrilar);
      if (ok) {
        estado.fijar('ecg.pulso', 'auto');
        irARitmo(motor, configIntervencion.respuesta, { asistolia: 2000 });
      }
      return;
    }
    // Descarga no sincronizada sobre un ritmo con pulso: puede inducir FV (error didáctico)
    if (forzado === 'auto') {
      emitir('intervencion:resultado', { texto: 'Descarga no sincronizada sobre ritmo con pulso: se induce FV.' });
      irARitmo(motor, 'fv', { retardo: 150, hr: 0 });
      estado.fijar('ecg.pulso', 'no');
    }
  });

  escuchar('intervencion:adenosina', (d) => {
    if (d.remoto) return;
    const id = estado.obtener('ecg.ritmo');
    const ok = d.forzar || (configIntervencion.resultado !== 'no' && id === 'tsv' && (d.dosis ?? 6) >= 6);
    if (ok) irARitmo(motor, 'sinusal', { asistolia: 5000 });
  });

  // Atropina: acelera bradicardias supranodales; poco eficaz en bloqueo infranodal (BAV completo con QRS ancho)
  escuchar('intervencion:atropina', (d) => {
    if (d.remoto) return;
    const id = estado.obtener('ecg.ritmo');
    const hr = estado.obtener('vitales.hr');
    const responde = ['bradicardia_sinusal', 'nodal', 'mobitz1', 'bav1', 'sinusal', 'pausa_sinusal'].includes(id);
    const parcial = id === 'bav3' && estado.obtener('ecg.opciones.escape') === 'nodal';
    if (configIntervencion.resultado === 'no') return;
    if (responde || parcial || configIntervencion.resultado === 'convierte') {
      estado.fijar('vitales.hr', Math.min(hr + (parcial ? 12 : 30), 120));
      if (id === 'bradicardia_sinusal' && hr + 30 >= 60) motor.aplicarRitmo('sinusal'), estado.fijar('vitales.hr', Math.min(hr + 30, 120));
    }
  });
}
