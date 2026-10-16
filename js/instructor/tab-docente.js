/**
 * @file tab-docente.js
 * @description DOCENTE INTERACTIVO del protocolo F-R-I / E-H-I y modo de casos/quiz.
 *  - construirDocente: tira de ritmo con calibrador, mediciones automáticas, los seis pasos
 *    (cómo medir, valores normales, pregunta al alumno, comprobar/revelar) y ficha del ritmo.
 *  - construirCasos: casos clínicos predefinidos y examen de opción múltiple.
 *
 * Se ejecuta en: SOLO la ventana maestra (instructor).
 */
import { estado, emitir } from '../core/estado.js';
import { el } from '../ui/formularios.js';
import { PapelEcg } from '../ui/papel-ecg.js';
import { DERIVACIONES } from '../core/config.js';
import { RITMOS, opcionesPorDefecto } from '../simulacion/ritmos.js';
import { fichaRitmo } from '../docencia/ritmos-docencia.js';
import { PASOS, analizar } from '../docencia/protocolo.js';
import { CASOS } from '../docencia/casos.js';

/** Carga un caso clínico completo en el simulador. */
export function aplicarCaso(motor, c) {
  estado.fijar('ecg.ritmo', c.ritmo);
  estado.fijar('ecg.opciones', { ...opcionesPorDefecto(c.ritmo), ...(c.opciones || {}) });
  estado.fijar('vitales.hr', c.hr || RITMOS[c.ritmo]?.fc?.[2] || 0);
  estado.fijar('ecg.eje', c.eje ?? 60);
  estado.fijar('ecg.patron', c.patron || 'ninguno');
  estado.fijar('ecg.st', c.st || 0);
  estado.fijar('ecg.hipertrofia', c.hipertrofia || 'ninguna');
  estado.fijar('ecg.pulso', c.pulso || 'auto');
  estado.fijar('ecg.ruido', 0);
  estado.fijar('ecg.voltaje', 1);
  estado.fijar('resp.apnea', c.ritmo === 'asistolia' || c.ritmo === 'fv' || c.ritmo === 'aesp');
  for (const [k, v] of Object.entries(c.vitales || {})) estado.fijar(`vitales.${k}`, v);
  estado.fijar('escenario', { titulo: c.nombre, descripcion: c.clinica });
  emitir('motor:reiniciar');
}

/** Lista <ul> con textos. */
const lista = (arr) => el('ul', {}, ...arr.map((t) => el('li', { texto: t })));

/* ------------------------------------------------------------------ *
 * DOCENTE
 * ------------------------------------------------------------------ */
export function construirDocente(cont, { motor }) {
  let ocultar = false;
  const medidas = el('div', { class: 'medidas' });
  const ficha = el('div', { class: 'ficha' });

  // --- Tira de ritmo con calibrador ---
  const cv = el('canvas', { class: 'papel-tira', style: 'width:100%;height:150px' });
  const resMed = el('p', { class: 'ayuda', texto: 'Toque dos puntos del trazo para medir (calibrador).' });
  const papel = new PapelEcg(cv, motor, { layout: 'tira', lead: 'II', dur: 6 });
  papel.alMedir = (m) => (resMed.textContent = `Calibrador: ${m.ms} ms → ${m.fc} lpm (si fuera un R-R). Cuadro grande = 200 ms.`);
  const selLead = el('select', { 'aria-label': 'Derivación de la tira', onChange: () => papel.fijarDerivacion(selLead.value) }, ...DERIVACIONES.map((d) => el('option', { value: d, texto: d, selected: d === 'II' })));
  const selDur = el('select', { 'aria-label': 'Duración', onChange: () => { papel.dur = Number(selDur.value); papel.capturar(); } }, el('option', { value: 6, texto: '6 s' }), el('option', { value: 10, texto: '10 s' }));
  const cap = el('button', { class: 'btn', texto: '⟳ Capturar tira', onClick: () => papel.capturar(`Tira ${selLead.value}`) });
  const doce = el('button', { class: 'btn', texto: '12 derivaciones', onClick: () => abrir12() });
  setTimeout(() => papel.capturar('Tira II'), 100);

  function abrir12() {
    const capa = el('div', { class: 'modal-papel' });
    const c12 = el('canvas', { style: 'width:100%;height:min(70vh,520px)', class: 'papel12' });
    const info = el('p', { class: 'ayuda', texto: 'Toque dos puntos para medir un intervalo.' });
    capa.append(c12, info, el('div', { class: 'fila-botones' }, el('button', { class: 'btn', texto: '⟳ Nueva captura', onClick: () => p12.capturar('ECG 12 derivaciones') }), el('button', { class: 'btn', texto: '📽 Proyectar', onClick: () => { const url = c12.toDataURL('image/png'); emitir('diapositiva:mostrar', { diapositiva: { tipo: 'imagen', titulo: 'ECG de 12 derivaciones', imagen: url } }); } }), el('button', { class: 'btn', texto: 'Cerrar', onClick: () => capa.remove() })));
    document.body.append(capa);
    const p12 = new PapelEcg(c12, motor, { layout: 'doce' });
    p12.alMedir = (m) => (info.textContent = `Intervalo: ${m.ms} ms → ${m.fc} lpm`);
    setTimeout(() => p12.capturar('ECG 12 derivaciones'), 50);
  }

  // --- Medidas automáticas y ficha ---
  const pintarFicha = () => {
    const id = estado.obtener('ecg.ritmo');
    const f = fichaRitmo(id);
    const a = analizar(motor, estado);
    const d = a.datos;
    const nombre = RITMOS[id]?.nombre || id;
    medidas.innerHTML = '';
    medidas.append(
      el('div', { class: 'rejilla-medidas' },
        el('span', {}, el('small', { texto: 'FC' }), el('b', { texto: d.fc ?? '---' })),
        el('span', {}, el('small', { texto: 'PR' }), el('b', { texto: d.pr ? `${Math.round(d.pr * 1000)} ms` : '—' })),
        el('span', {}, el('small', { texto: 'QRS' }), el('b', { texto: `${Math.round(d.qrs * 1000)} ms` })),
        el('span', {}, el('small', { texto: 'QT / QTc' }), el('b', { texto: `${Math.round(d.qt * 1000)} / ${Math.round(d.qtc * 1000)}` })),
        el('span', {}, el('small', { texto: 'Eje' }), el('b', { texto: `${d.eje}°` })),
        el('span', {}, el('small', { texto: 'R-R' }), el('b', { texto: d.regularidad })),
      ),
    );
    ficha.innerHTML = '';
    if (ocultar) {
      ficha.append(el('p', { class: 'ayuda', texto: 'Ritmo oculto (modo examen). Pulse "Revelar diagnóstico".' }));
      return;
    }
    ficha.append(
      el('h4', { texto: nombre }),
      el('dl', {},
        el('dt', { texto: 'Frecuencia' }), el('dd', { texto: f.f }),
        el('dt', { texto: 'Ritmo' }), el('dd', { texto: f.r }),
        el('dt', { texto: 'Onda P' }), el('dd', { texto: f.p }),
        el('dt', { texto: 'PR' }), el('dd', { texto: f.pr }),
        el('dt', { texto: 'QRS' }), el('dd', { texto: f.qrs }),
        el('dt', { texto: 'QT / T' }), el('dd', { texto: f.qt }),
      ),
      el('h5', { texto: 'Claves para reconocerlo' }), lista(f.claves),
      el('h5', { texto: 'Causas frecuentes' }), lista(f.causas),
      el('h5', { texto: 'Manejo (resumen docente)' }), lista(f.manejo),
      el('p', { class: 'aviso', texto: 'Resumen basado en guías ACLS/AHA de adulto. Adapte al protocolo local y a la valoración clínica.' }),
    );
  };
  estado.suscribir('ecg', () => cont.isConnected && pintarFicha());
  setInterval(() => cont.isConnected && !cont.hidden && pintarFicha(), 2000);

  const toggle = el('button', { class: 'btn', texto: 'Ocultar ritmo (examen)', onClick: () => { ocultar = !ocultar; toggle.textContent = ocultar ? 'Revelar diagnóstico' : 'Ocultar ritmo (examen)'; pintarFicha(); } });

  // --- Pasos del protocolo ---
  let aciertos = 0;
  let intentos = 0;
  const marcador = el('p', { class: 'marcador', texto: 'Aciertos: 0 / 0' });
  const pasos = el('div', { class: 'pasos' });
  for (const p of PASOS) {
    const respuesta = el('select', {}, el('option', { value: '', texto: '— elija —' }), ...Object.entries(p.opciones).map(([k, t]) => el('option', { value: k, texto: t })));
    const fb = el('p', { class: 'feedback' });
    const comprobar = () => {
      if (!respuesta.value) return;
      const ok = analizar(motor, estado)[p.clave] === respuesta.value;
      intentos++;
      if (ok) aciertos++;
      marcador.textContent = `Aciertos: ${aciertos} / ${intentos}`;
      fb.className = `feedback ${ok ? 'ok' : 'mal'}`;
      fb.textContent = ok ? '✔ Correcto' : '✘ Incorrecto. Revise cómo se mide e inténtelo de nuevo.';
    };
    const revelar = () => {
      const c = analizar(motor, estado)[p.clave];
      fb.className = 'feedback info';
      fb.textContent = `Respuesta: ${p.opciones[c] ?? c}`;
      respuesta.value = c;
    };
    pasos.append(
      el('details', { class: 'paso' },
        el('summary', {}, el('b', { class: 'letra', texto: p.clave === 'I2' ? 'I' : p.clave }), ` ${p.titulo}`),
        el('p', { texto: p.resumen }),
        lista(p.como),
        el('p', { class: 'normal', texto: `Normal: ${p.normal}` }),
        el('div', { class: 'campo' }, el('label', { texto: p.pregunta }), respuesta),
        el('div', { class: 'fila-botones' }, el('button', { class: 'btn', texto: 'Comprobar', onClick: comprobar }), el('button', { class: 'btn', texto: 'Revelar', onClick: revelar })),
        fb,
      ),
    );
  }

  cont.append(
    el('div', { class: 'tira-ctl' }, selLead, selDur, cap, doce),
    cv, resMed,
    el('h4', { texto: 'Medición automática' }), medidas,
    el('div', { class: 'fila-botones' }, toggle),
    el('h4', { texto: 'Protocolo F-R-I · E-H-I' }), marcador, pasos,
    el('h4', { texto: 'Ficha del ritmo' }), ficha,
  );
  pintarFicha();
}

/* ------------------------------------------------------------------ *
 * CASOS Y QUIZ
 * ------------------------------------------------------------------ */
export function construirCasos(cont, { motor }) {
  const vineta = el('div', { class: 'vineta' });
  const lista1 = el('div', { class: 'tarjetas' });
  const mostrarCaso = (c, conDx = true) => {
    vineta.innerHTML = '';
    vineta.append(el('h4', { texto: c.nombre }), el('p', { texto: c.clinica }), conDx ? el('p', {}, el('b', { texto: 'Diagnóstico: ' }), c.dx) : null, conDx ? el('p', { class: 'normal', texto: `Objetivo: ${c.objetivo}` }) : null);
  };
  for (const c of CASOS) {
    lista1.append(el('button', { class: 'tarjeta', onClick: () => { aplicarCaso(motor, c); mostrarCaso(c); } }, el('b', { texto: c.nombre }), el('small', { texto: c.clinica })));
  }

  // --- Quiz ---
  const quiz = el('div', { class: 'quiz' });
  let actual = null;
  let puntos = 0;
  let total = 0;
  const marcador = el('p', { class: 'marcador', texto: 'Puntaje: 0 / 0' });
  function nuevo() {
    let c;
    do { c = CASOS[Math.floor(Math.random() * CASOS.length)]; } while (c === actual && CASOS.length > 1);
    actual = c;
    aplicarCaso(motor, c);
    mostrarCaso(c, false);
    const otros = CASOS.filter((x) => x !== c).sort(() => Math.random() - 0.5).slice(0, 3);
    const opciones = [c, ...otros].sort(() => Math.random() - 0.5);
    quiz.innerHTML = '';
    const fb = el('p', { class: 'feedback' });
    quiz.append(el('p', { texto: 'Observe el monitor y aplique F-R-I-E-H-I. ¿Cuál es el diagnóstico?' }));
    for (const o of opciones) {
      quiz.append(el('button', { class: 'btn opcion', texto: o.dx, onClick: () => {
        total++;
        const ok = o === c;
        if (ok) puntos++;
        marcador.textContent = `Puntaje: ${puntos} / ${total}`;
        fb.className = `feedback ${ok ? 'ok' : 'mal'}`;
        fb.textContent = ok ? '✔ Correcto.' : `✘ Era: ${c.dx}.`;
        mostrarCaso(c, true);
        quiz.querySelectorAll('.opcion').forEach((b) => (b.disabled = true));
      } }));
    }
    quiz.append(fb);
  }
  cont.append(
    el('h4', { texto: 'Modo examen' }), marcador,
    el('div', { class: 'fila-botones' }, el('button', { class: 'btn', texto: '🎲 Caso aleatorio', onClick: nuevo })),
    quiz, vineta,
    el('h4', { texto: 'Casos clínicos' }), lista1,
  );
}
