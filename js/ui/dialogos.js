/**
 * @file dialogos.js
 * @description Ventanas emergentes DENTRO de la pantalla del monitor: menú principal,
 * ajustes de cada módulo, configuración de alarmas (como la figura "HR Alarm Setup" del
 * manual), admisión de paciente, revisión de tendencias/alarmas/PANI/arritmias y análisis
 * de 12 derivaciones.
 *
 * Se ejecuta en: AMBOS (DOM). En la proyección (`soloVista`) los diálogos no se abren.
 */
import { estado, emitir } from '../core/estado.js';
import { ETIQUETAS_ALARMA, UNIDADES, RANGOS, NIVELES, ALARMAS_ARRITMIA, TIEMPOS_PAUSA_ALARMA, CLAVE_MANTENIMIENTO, VERSION_APP, FS } from '../core/config.js';
import { el, campo, formulario } from './formularios.js';
import { MENUS, MODULOS, cambiarTipoPaciente } from './definicion-menus.js';
import { dibujarTendencia } from './ondas-canvas.js';
import { PapelEcg } from './papel-ecg.js';
import { fechaHora } from '../core/utilidades.js';

const NOMBRE_NIVEL = { alta: 'Alta', media: 'Media', baja: 'Baja' };

export class Dialogos {
  constructor(pantalla, { motor, alarmas, sonidos, soloVista }) {
    this.pantalla = pantalla;
    this.motor = motor;
    this.alarmas = alarmas;
    this.sonidos = sonidos;
    this.soloVista = soloVista;
    this.capa = el('div', { class: 'capa-dialogo', hidden: true });
    this.toast = el('div', { class: 'toast', hidden: true });
    this.capa.append(this.toast);
  }

  /** Abre una ventana con título y contenido. */
  abrir(titulo, contenido, { ancho = 560, alCerrar = null } = {}) {
    if (this.soloVista) return;
    this.cerrar();
    this._alCerrar = alCerrar;
    const ventana = el('div', { class: 'dialogo', role: 'dialog', 'aria-label': titulo, style: `width:${ancho}px` }, el('div', { class: 'dialogo-cab' }, el('span', { texto: titulo }), el('button', { class: 'cerrar', 'aria-label': 'Cerrar', texto: '✕', onClick: () => this.cerrar() })), el('div', { class: 'dialogo-cuerpo' }, contenido));
    this.ventana = ventana;
    this.capa.hidden = false;
    this.capa.append(ventana);
    this.capa.classList.add('abierta');
  }

  cerrar() {
    if (this.ventana) this.ventana.remove();
    this.ventana = null;
    this.capa.classList.remove('abierta');
    this.capa.hidden = true;
    if (this._alCerrar) this._alCerrar();
    this._alCerrar = null;
  }

  /** Mensaje breve sobre la pantalla (p. ej. cambio de volumen). */
  aviso(texto) {
    this.capa.hidden = false;
    this.toast.hidden = false;
    this.toast.textContent = texto;
    clearTimeout(this._tt);
    this._tt = setTimeout(() => {
      this.toast.hidden = true;
      if (!this.ventana) this.capa.hidden = true;
    }, 1500);
  }

  /* ----------------------------- Menú principal ----------------------------- */
  menuPrincipal() {
    const items = [
      ['Config. ECG', () => this.ajustes('Configuración de ECG', 'ecg')],
      ['Config. RESP', () => this.ajustes('Configuración de RESP', 'resp')],
      ['Config. SpO₂', () => this.ajustes('Configuración de SpO₂', 'spo2')],
      ['Config. PANI', () => this.ajustes('Configuración de PANI', 'nibp')],
      ['Config. CO₂', () => this.ajustes('Configuración de CO₂', 'co2')],
      ['Alarmas', () => this.configAlarmas()],
      ['Pantalla / vistas', () => this.vistas()],
      ['Revisión', () => this.revision()],
      ['Paciente', () => this.paciente()],
      ['Módulos', () => this.modulos()],
      ['Sistema', () => this.ajustes('Sistema', 'sistema')],
      ['Mantenimiento', () => this.mantenimiento()],
    ];
    const g = el('div', { class: 'rejilla-menu' });
    for (const [t, f] of items) g.append(el('button', { class: 'btn-menu', texto: t, onClick: () => { this.sonidos.tecla(); f(); } }));
    this.abrir('Menú principal', g, { ancho: 600 });
  }

  ajustes(titulo, clave) {
    this.abrir(titulo, formulario(MENUS[clave]()), { ancho: 540 });
  }

  vistas() {
    const g = el('div', { class: 'rejilla-menu' });
    for (const [v, t] of [['estandar', 'Estándar'], ['fuenteGrande', 'Fuente grande'], ['tendencia', 'Pantalla de tendencias'], ['oxyCRG', 'OxyCRG']]) {
      g.append(el('button', { class: 'btn-menu', texto: t, onClick: () => { estado.fijar('sistema.vista', v); this.cerrar(); } }));
    }
    this.abrir('Selección de vista', g, { ancho: 480 });
  }

  revision() {
    const g = el('div', { class: 'rejilla-menu' });
    for (const [t, f] of [['Gráfico de tendencias', () => this.tendenciaGrafica()], ['Tabla de tendencias', () => this.tendenciaTabla()], ['Revisión de alarmas', () => this.revisionAlarmas()], ['Revisión de PANI', () => this.revisionNibp()], ['Revisión de arritmias', () => this.revisionArritmias()], ['Análisis de 12 derivaciones', () => this.ecg12()]]) {
      g.append(el('button', { class: 'btn-menu', texto: t, onClick: f }));
    }
    this.abrir('Revisión', g, { ancho: 560 });
  }

  /* ------------------------------ Paciente --------------------------------- */
  paciente() {
    const caja = el('div');
    caja.append(formulario(MENUS.paciente()));
    caja.append(el('div', { class: 'fila-botones' }, el('button', { class: 'btn', texto: 'Admitir paciente nuevo', onClick: () => { cambiarTipoPaciente(estado.obtener('paciente.tipo')); estado.fijar('paciente.nombre', 'PACIENTE NUEVO'); this.cerrar(); } }), el('button', { class: 'btn', texto: 'Cerrar', onClick: () => this.cerrar() })));
    this.abrir('Admisión de paciente', caja, { ancho: 560 });
  }

  modulos() {
    const items = MODULOS.map(([k, t]) => ({ etiqueta: t, ruta: `modulos.${k}`, tipo: 'bool' }));
    this.abrir('Interruptor de módulos', formulario(items), { ancho: 460 });
  }

  mantenimiento() {
    const cuerpo = el('div');
    const entrada = el('input', { type: 'password', placeholder: 'Contraseña', autocomplete: 'off' });
    const msg = el('p', { class: 'ayuda' });
    const abrirMant = () => {
      cuerpo.innerHTML = '';
      cuerpo.append(
        el('p', { texto: `Monitor simulado · versión ${VERSION_APP} · ${fechaHora()}` }),
        el('div', { class: 'fila-botones' }, el('button', { class: 'btn', texto: 'Restablecer valores de fábrica', onClick: () => { estado.reiniciar(estado.obtener('paciente.tipo')); emitir('motor:reiniciar'); this.cerrar(); } })),
      );
    };
    cuerpo.append(el('p', { texto: 'Introduzca la contraseña de mantenimiento (ver manual).' }), entrada, el('button', { class: 'btn', texto: 'Aceptar', onClick: () => (entrada.value === CLAVE_MANTENIMIENTO ? abrirMant() : (msg.textContent = 'Contraseña incorrecta.')) }), msg);
    this.abrir('Mantenimiento', cuerpo, { ancho: 480 });
  }

  /* --------------------- Configuración de alarmas (cap. 5) ------------------- */
  configAlarmas(inicial = 'hr') {
    const cont = el('div', { class: 'alarma-cfg' });
    const lista = el('div', { class: 'alarma-lista' });
    const panel = el('div', { class: 'alarma-panel' });
    const claves = [...Object.keys(ETIQUETAS_ALARMA), 'ARR'];
    const mostrar = (k) => {
      lista.querySelectorAll('button').forEach((b) => b.classList.toggle('sel', b.dataset.k === k));
      panel.innerHTML = '';
      if (k === 'ARR') return this._panelArritmias(panel);
      const rg = RANGOS[k] || { min: 0, max: 300 };
      const ruta = `alarmas.limites.${k}`;
      panel.append(
        formulario([
          { etiqueta: `Límite alto (${UNIDADES[k] || ''})`, ruta: `${ruta}.alto`, tipo: 'num', min: rg.min, max: rg.max },
          { etiqueta: 'Límite bajo', ruta: `${ruta}.bajo`, tipo: 'num', min: rg.min, max: rg.max },
          { etiqueta: 'Alarma', ruta: `${ruta}.activa`, opciones: [[true, 'Activada'], [false, 'Desactivada']] },
          { etiqueta: 'Prioridad', ruta: `${ruta}.nivel`, opciones: NOMBRE_NIVEL },
        ], `Configuración de alarma: ${ETIQUETAS_ALARMA[k]}`),
      );
      panel.append(formulario([
        { etiqueta: 'Pausa de audio (s)', ruta: 'alarmas.tiempoPausa', opciones: [...TIEMPOS_PAUSA_ALARMA.map((t) => [t, `${t} s`])] },
        { etiqueta: 'Enclavar alarmas (latch)', ruta: 'alarmas.latch', tipo: 'bool' },
      ], 'Opciones generales'));
    };
    for (const k of claves) lista.append(el('button', { 'data-k': k, class: 'item-lista', texto: k === 'ARR' ? 'Arritmias' : ETIQUETAS_ALARMA[k], onClick: () => mostrar(k) }));
    cont.append(lista, panel);
    this.abrir('Configuración de alarmas', cont, { ancho: 720 });
    mostrar(inicial);
  }

  /** Panel con las 16 alarmas de arritmia (interruptor y prioridad individuales). */
  _panelArritmias(panel) {
    panel.append(formulario([{ etiqueta: 'Análisis de arritmias: alarmas', ruta: 'alarmas.arritmiaActiva', tipo: 'bool' }]));
    const tabla = el('table', { class: 'tabla' }, el('tr', {}, el('th', { texto: 'Alarma' }), el('th', { texto: 'Activa' }), el('th', { texto: 'Prioridad' })));
    for (const [k, d] of Object.entries(ALARMAS_ARRITMIA)) {
      const ruta = `alarmas.arritmia.${k}`;
      tabla.append(el('tr', { title: d.def }, el('td', { texto: d.txt }), el('td', {}, campo({ etiqueta: '', ruta: `${ruta}.activa`, tipo: 'bool' })), el('td', {}, campo({ etiqueta: '', ruta: `${ruta}.nivel`, opciones: NOMBRE_NIVEL }))));
    }
    panel.append(el('div', { class: 'scroll-v' }, tabla));
  }

  /* ----------------------------- Tendencias --------------------------------- */
  tendenciaGrafica() {
    const cont = el('div', { class: 'tend-dialogo' });
    const T = this.motor.tendencia;
    const defs = [['FC (lpm)', 'hr', '#22c038', 0, 200], ['SpO₂ (%)', 'spo2', '#10f0f0', 50, 100], ['FR (rpm)', 'rr', '#f0f000', 0, 60], ['PANI sis (mmHg)', 'sys', '#e8dcc0', 0, 250]];
    for (const [t, k, c, mi, ma] of defs) {
      const cv = el('canvas', { class: 'cv-tend', style: 'width:100%;height:90px' });
      cont.append(el('div', { class: 'tend-rotulo', texto: t }), cv);
      setTimeout(() => dibujarTendencia(cv, [{ color: c, datos: T.map((d) => d[k]) }], { W: cv.offsetWidth, H: 90, k: 1.5, minY: mi, maxY: ma }), 0);
    }
    cont.append(el('p', { class: 'ayuda', texto: `Última hora (1 punto cada 5 s). Puntos: ${T.length}` }));
    this.abrir('Gráfico de tendencias', cont, { ancho: 640 });
  }

  tendenciaTabla() {
    const T = this.motor.tendencia.slice().reverse().filter((_, i) => i % 6 === 0).slice(0, 40);
    const f = (x) => (x === null || x === undefined ? '---' : x);
    const tabla = el('table', { class: 'tabla' }, el('tr', {}, ...['Hora', 'FC', 'FP', 'SpO₂', 'FR', 'PANI', 'T1', 'EtCO₂'].map((h) => el('th', { texto: h }))));
    for (const d of T) tabla.append(el('tr', {}, el('td', { texto: new Date(d.t).toLocaleTimeString('es') }), el('td', { texto: f(d.hr) }), el('td', { texto: f(d.pr) }), el('td', { texto: f(d.spo2) }), el('td', { texto: f(d.rr) }), el('td', { texto: d.sys ? `${d.sys}/${d.dia}` : '---' }), el('td', { texto: f(d.t1) }), el('td', { texto: f(d.etco2) })));
    this.abrir('Tabla de tendencias (1 fila por 30 s)', el('div', { class: 'scroll-v' }, tabla), { ancho: 640 });
  }

  /* ------------------------------ Revisiones -------------------------------- */
  revisionAlarmas() {
    const R = this.alarmas.registro;
    const tabla = el('table', { class: 'tabla' }, el('tr', {}, el('th', { texto: 'Hora' }), el('th', { texto: 'Alarma' }), el('th', { texto: 'Prioridad' })));
    for (const r of R) tabla.append(el('tr', { class: `nivel-${r.nivel}` }, el('td', { texto: r.hora.toLocaleTimeString('es') }), el('td', { texto: r.texto }), el('td', { texto: NOMBRE_NIVEL[r.nivel] })));
    this.abrir('Revisión de eventos de alarma', R.length ? el('div', { class: 'scroll-v' }, tabla) : el('p', { texto: 'Sin eventos de alarma registrados.' }), { ancho: 560 });
  }

  revisionNibp() {
    const H = this.motor.historialNibp;
    const tabla = el('table', { class: 'tabla' }, el('tr', {}, ...['Hora', 'SIS', 'DIA', 'PAM', 'FP'].map((h) => el('th', { texto: h }))));
    for (const r of H) tabla.append(el('tr', {}, el('td', { texto: r.hora.toLocaleTimeString('es') }), el('td', { texto: r.sys }), el('td', { texto: r.dia }), el('td', { texto: r.map }), el('td', { texto: r.pr ?? '---' })));
    this.abrir('Revisión de PANI', H.length ? el('div', { class: 'scroll-v' }, tabla) : el('p', { texto: 'Sin mediciones de PANI.' }), { ancho: 520 });
  }

  revisionArritmias() {
    const R = this.alarmas.registro.filter((r) => r.tipo === 'arr');
    const cont = el('div', { class: 'scroll-v' });
    if (!R.length) cont.append(el('p', { texto: 'Sin eventos de arritmia registrados.' }));
    for (const r of R.slice(0, 12)) {
      const cv = el('canvas', { class: 'cv-arr', width: 600, height: 80 });
      const g = cv.getContext('2d');
      g.fillStyle = '#000';
      g.fillRect(0, 0, 600, 80);
      g.strokeStyle = '#22c038';
      g.beginPath();
      r.ecg.forEach((v, i) => {
        const x = (i / r.ecg.length) * 600;
        const y = 50 - v * 30;
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      });
      g.stroke();
      cont.append(el('div', { class: 'arr-item' }, el('b', { texto: `${r.hora.toLocaleTimeString('es')}  ${r.texto}  (${r.derivacion})` }), cv));
    }
    this.abrir('Revisión de arritmias (ARR)', cont, { ancho: 660 });
  }

  /* --------------------------- 12 derivaciones ------------------------------ */
  ecg12() {
    const cont = el('div');
    const cv = el('canvas', { class: 'papel12', style: 'width:100%;height:330px' });
    const info = el('p', { class: 'ayuda', texto: 'Toque dos puntos del trazo para medir un intervalo con el calibrador.' });
    cont.append(cv, info, el('div', { class: 'fila-botones' }, el('button', { class: 'btn', texto: 'Nueva captura', onClick: () => papel.capturar(`ECG 12 derivaciones · ${fechaHora()}`) }), el('button', { class: 'btn', texto: 'Cerrar', onClick: () => this.cerrar() })));
    const papel = new PapelEcg(cv, this.motor, { layout: 'doce' });
    papel.alMedir = (m) => (info.textContent = `Intervalo: ${m.ms} ms  →  equivale a ${m.fc} lpm`);
    this.abrir('Análisis de 12 derivaciones', cont, { ancho: 900 });
    setTimeout(() => papel.capturar(`ECG 12 derivaciones · ${fechaHora()}`), 0);
  }
}

export { FS, NIVELES };
