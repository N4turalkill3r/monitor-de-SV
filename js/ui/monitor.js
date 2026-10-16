/**
 * @file monitor.js
 * @description Pantalla del monitor (réplica de la interfaz EDAN iM50/60/70/80 de 1024×768):
 * encabezado, ondas, bloques numéricos, área de alarmas, barra de estado y teclas de
 * acceso rápido. Maneja las vistas Estándar, Fuente grande, Tendencias y OxyCRG.
 *
 * Se ejecuta en: AMBOS. La ventana de proyección usa `soloVista = true`
 * (las teclas se muestran pero no responden).
 *
 * Estructura del módulo:
 *   Monitor.construir()      → crea el DOM según la vista y los módulos activos
 *   Monitor._bucleOndas()    → requestAnimationFrame: dibuja ondas
 *   Monitor._ciclo()         → 4 veces/s: números, alarmas y audio
 */
import { estado, emitir, escuchar } from '../core/estado.js';
import { COLORES, GANANCIAS_ECG, ETIQUETAS_ALARMA, TIPOS_PACIENTE, ALARMAS_ARRITMIA, SIMBOLOS_NIVEL } from '../core/config.js';
import { fechaHora, limitar } from '../core/utilidades.js';
import { barrasPulso } from '../simulacion/fisiologia.js';
import { el } from './formularios.js';
import { icono } from './iconos.js';
import { LienzoOnda, PX_MM, dibujarTendencia } from './ondas-canvas.js';
import { Dialogos } from './dialogos.js';

const ANCHO = 1024;
const ALTO = 768;

/** Colores del tema del monitor (coinciden con la captura del manual). */
const C = { hr: '#f020f0', ecg: '#22c038', rr: '#f0f000', spo2: '#10f0f0', temp: '#e8a000', nibp: '#e8dcc0', co2: '#f0e040', art: '#ff3b3b', resp: '#c8c020' };

export class Monitor {
  /**
   * @param {HTMLElement} contenedor elemento que alberga el monitor (se escala dentro de él)
   * @param {object} deps { motor, alarmas, sonidos, soloVista }
   */
  constructor(contenedor, { motor, alarmas, sonidos, soloVista = false }) {
    this.cont = contenedor;
    this.motor = motor;
    this.alarmas = alarmas;
    this.sonidos = sonidos;
    this.soloVista = soloVista;
    this.esc = 1;
    this.lienzos = [];
    this.refs = {};
    this.primeraTecla = 0;
    this.gananciaAuto = [1, 1];
    this.indiceAlarma = 0;
    this.flash = false;

    this.raiz = el('div', { class: 'monitor-escala' });
    this.pantalla = el('div', { class: 'monitor', id: 'monitor' });
    this.raiz.append(this.pantalla);
    this.cont.append(this.raiz);
    this.dialogos = new Dialogos(this.pantalla, { motor, alarmas, sonidos, soloVista });

    this._observarTamano();
    this.construir();
    this._suscribir();
    this._bucleOndas = this._bucleOndas.bind(this);
    requestAnimationFrame(this._bucleOndas);
    this._timer = setInterval(() => this._ciclo(), 250);
    motor.alLatido = (b) => this._alLatido(b);
  }

  /* ------------------------------------------------------------------ *
   * Escalado y suscripciones
   * ------------------------------------------------------------------ */
  _observarTamano() {
    const ajustar = () => {
      const r = this.cont.getBoundingClientRect();
      this.esc = Math.max(0.2, Math.min(r.width / ANCHO, r.height / ALTO));
      this.raiz.style.width = `${ANCHO * this.esc}px`;
      this.raiz.style.height = `${ALTO * this.esc}px`;
      this.pantalla.style.transform = `scale(${this.esc})`;
      const k = this.esc * Math.min(window.devicePixelRatio || 1, 2);
      for (const l of this.lienzos) l.ajustar(l.cfg.W, l.cfg.H, k);
    };
    this._ajustar = ajustar;
    new ResizeObserver(ajustar).observe(this.cont);
    window.addEventListener('orientationchange', () => setTimeout(ajustar, 200));
  }

  _suscribir() {
    // Cualquier cambio estructural reconstruye la pantalla (módulos, vista, derivaciones...)
    const reconstruir = () => {
      this._firmaPrev = this._firma();
      this.construir();
    };
    for (const r of ['modulos', 'sistema.vista', 'ecg.derivaciones', 'ecg.tipoDerivaciones', 'sistema.encendido', 'sistema.modo']) {
      estado.suscribir(r, reconstruir);
    }
    estado.suscribir('sistema', () => this._aplicarBrillo());
    // Estado reemplazado completo (proyección / escenario): reconstruir sólo si cambió la estructura
    this._firmaPrev = this._firma();
    estado.suscribir('*', (_, ruta) => {
      const f = this._firma();
      if (ruta === '*' && f !== this._firmaPrev) this.construir();
      this._firmaPrev = f;
    });
    escuchar('nibp:resultado', () => this.sonidos.nibpFin());
  }

  /** Firma de los ajustes que obligan a reconstruir el DOM. */
  _firma() {
    const e = estado.obtener();
    return JSON.stringify([e.modulos, e.sistema.vista, e.sistema.encendido, e.sistema.modo, e.ecg.derivaciones, e.ecg.tipoDerivaciones, e.ecg.stAnalisis, e.paciente.nombre, e.paciente.cama, e.paciente.departamento, e.paciente.tipo]);
  }

  /* ------------------------------------------------------------------ *
   * Construcción del DOM
   * ------------------------------------------------------------------ */
  construir() {
    const s = estado.obtener('sistema');
    this.lienzos = [];
    this.refs = {};
    this.pantalla.innerHTML = '';
    this.pantalla.classList.toggle('apagado', !s.encendido);
    this._aplicarBrillo();
    if (!s.encendido) {
      this.pantalla.append(el('div', { class: 'pantalla-apagada' }));
      return;
    }
    if (s.modo === 'standby') {
      this.pantalla.append(el('div', { class: 'standby' }, el('div', { texto: 'MODO STANDBY' }), el('small', { texto: 'Pulse la pantalla o Menú para reanudar' })));
      this.pantalla.addEventListener('click', () => !this.soloVista && estado.fijar('sistema.modo', 'normal'), { once: true });
      return;
    }
    this.pantalla.append(this._encabezado());
    const zona = el('div', { class: 'zona' });
    this.zona = zona;
    this.pantalla.append(zona);
    switch (s.vista) {
      case 'fuenteGrande': this._vistaFuente(zona); break;
      case 'tendencia': this._vistaTendencia(zona); break;
      case 'oxyCRG': this._vistaOxy(zona); break;
      default: this._vistaEstandar(zona);
    }
    this.pantalla.append(this._barraEstado(), this._teclas());
    this.pantalla.append(this.dialogos.capa);
    this._ajustar();
    this._ciclo();
  }

  _aplicarBrillo() {
    const s = estado.obtener('sistema');
    const b = s.modo === 'noche' ? 0.35 : 0.3 + s.brillo * 0.07;
    this.pantalla.style.filter = `brightness(${b.toFixed(2)})`;
  }

  /** Encabezado gris: departamento, cama, nombre, tipo y área de alarmas. */
  _encabezado() {
    const p = estado.obtener('paciente');
    const r = (this.refs.cabecera = {});
    r.alarma = el('div', { class: 'area-alarma' });
    r.silencio = el('span', { class: 'ico-silencio', html: icono('silencio') });
    return el(
      'header',
      { class: 'cabecera' },
      el('span', { class: 'cab-dep', texto: p.departamento }),
      el('span', { class: 'cab-cama', html: icono('cama') }, el('b', { texto: p.cama })),
      el('span', { class: 'cab-nombre', texto: p.nombre }),
      el('span', { class: 'cab-tipo', html: icono('persona') }, TIPOS_PACIENTE[p.tipo]),
      r.silencio,
      r.alarma,
    );
  }

  /** Bloque numérico genérico. */
  _bloque({ clave, titulo, unidad, color, grande = true, limites = null, extra = null, clase = '' }) {
    const num = el('div', { class: 'num', style: `color:${color}` });
    const lim = limites ? el('div', { class: 'lims', style: `color:${color}` }, el('span', { 'data-lim': `${limites}:alto` }), el('span', { 'data-lim': `${limites}:bajo` })) : null;
    const b = el(
      'section',
      { class: `bloque b-${clave} ${clase}`, 'data-bloque': clave, style: `--c:${color}` },
      el('div', { class: 'tit', style: `color:${color}` }, el('b', { texto: titulo }), el('small', { texto: unidad })),
      lim,
      num,
      extra,
    );
    (this.refs[clave] = this.refs[clave] || []).push(num);
    if (limites) b.querySelectorAll('[data-lim]').forEach((n) => (this.refs.lim = (this.refs.lim || []).concat(n)));
    this.refs[`bloque:${clave}`] = b;
    return b;
  }

  /** Vista ESTÁNDAR: ondas a la izquierda, números a la derecha, PANI abajo-izquierda. */
  _vistaEstandar(zona) {
    const m = estado.obtener('modulos');
    const ecg = estado.obtener('ecg');
    const izq = el('div', { class: 'col-ondas' });
    const filas = [];
    if (m.ecg) {
      filas.push({ canal: 'ecg1', i: 0, color: C.ecg });
      if (ecg.tipoDerivaciones !== '3') filas.push({ canal: 'ecg2', i: 1, color: C.ecg });
    }
    if (m.spo2) filas.push({ canal: 'pleth', color: C.spo2, etiqueta: 'Pleth' });
    if (m.resp) filas.push({ canal: 'resp', color: C.resp, etiqueta: 'RESP' });
    if (m.co2) filas.push({ canal: 'co2', color: C.co2, etiqueta: 'CO2' });
    if (m.ibp) filas.push({ canal: 'art', color: C.art, etiqueta: 'ART' });
    const wrap = el('div', { class: 'ondas' });
    for (const f of filas) wrap.append(this._filaOnda(f));
    izq.append(wrap, this._bloqueNibp());

    const der = el('div', { class: 'col-num' });
    if (m.ecg) {
      der.append(
        this._bloque({
          clave: 'hr', titulo: 'FC', unidad: '(lpm)', color: C.hr, limites: 'hr', clase: 'b-hr',
          extra: el('div', { class: 'hr-extra' }, el('span', { 'data-ref': 'marcapasos' }), el('span', { 'data-ref': 'pvcs' }), el('i', { class: 'ico-alarma-off', 'data-ref': 'hr-off', html: icono('silencio') })),
        }),
      );
      if (ecg.stAnalisis) der.append(this._bloqueSt());
    }
    const fila1 = el('div', { class: 'par' });
    if (m.resp) fila1.append(this._bloque({ clave: 'rr', titulo: 'FR', unidad: '(rpm)', color: C.rr, limites: 'rr' }));
    if (m.spo2) fila1.append(this._bloque({ clave: 'pr', titulo: 'FP', unidad: '(lpm)', color: C.spo2, limites: 'pr', clase: 'b-pr' }));
    if (fila1.children.length) der.append(fila1);
    const fila2 = el('div', { class: 'par' });
    if (m.spo2) fila2.append(this._bloque({ clave: 'spo2', titulo: 'SpO₂', unidad: '(%)', color: C.spo2, limites: 'spo2', extra: (this.refs.barras = el('div', { class: 'barras' })) }));
    if (m.temp) fila2.append(this._bloqueTemp());
    if (fila2.children.length) der.append(fila2);
    if (m.co2) der.append(this._bloqueCo2());
    if (m.ibp) der.append(this._bloqueArt());
    zona.append(izq, der);
  }

  _filaOnda({ canal, i, color, etiqueta }) {
    const fila = el('div', { class: 'fila-onda' });
    const ecgEtq = i !== undefined ? el('div', { class: 'etq-ecg', style: `color:${color}` }, el('b', { 'data-ref': `der${i}` }), el('span', { 'data-ref': `gan${i}` }), el('span', { 'data-ref': `fil${i}` })) : el('div', { class: 'etq-ecg', style: `color:${color}` }, el('b', { texto: etiqueta }));
    const canvas = el('canvas', { class: 'cv' });
    fila.append(ecgEtq, canvas);
    if (i !== undefined) fila.append(el('div', { class: 'cal-mv' }, el('span', { texto: '1 mV' })));
    const cfg = this._cfgOnda(canal, i, color);
    const l = new LienzoOnda(canvas, cfg);
    this.lienzos.push(l);
    // Dimensiones de diseño: se miden tras insertarse en el DOM (en _ajustar)
    fila._lienzo = l;
    return fila;
  }

  /** Configuración de escala por tipo de canal. */
  _cfgOnda(canal, i, color) {
    const buf = this.motor.canales[canal];
    const vel = () => (canal === 'resp' || canal === 'co2' ? 6.25 : estado.obtener('ecg.velocidad'));
    let escala;
    if (canal === 'ecg1' || canal === 'ecg2') {
      escala = (v) => {
        const g = estado.obtener('ecg.ganancia');
        const mm = g === 'Auto' ? this.gananciaAuto[i] : GANANCIAS_ECG[g] ?? 10;
        const H = cfg.H || 100;
        return limitar(0.55 - (v * mm * PX_MM) / H, 0.02, 0.98);
      };
    } else if (canal === 'pleth') escala = (v) => limitar(0.9 - v * 0.72, 0.03, 0.95);
    else if (canal === 'resp') escala = (v) => limitar(0.82 - v * 0.62, 0.05, 0.95);
    else if (canal === 'co2') escala = (v) => limitar(0.92 - (v / 60) * 0.8, 0.03, 0.95);
    else escala = (v) => limitar(0.96 - (v / 200) * 0.92, 0.02, 0.97); // ART 0–200 mmHg
    const cfg = { color, buf, escala, velocidad: vel, W: 600, H: 100 };
    return cfg;
  }

  _bloqueSt() {
    const celdas = [['I', 'I'], ['aVR', 'aVR'], ['V', 'V'], ['II', 'II'], ['aVL', 'aVL'], ['III', 'III'], ['aVF', 'aVF']];
    const g = el('div', { class: 'st-grid' });
    for (const [k, t] of celdas) g.append(el('span', { class: 'st-it' }, el('i', { texto: t }), el('b', { 'data-st': k })));
    return el('section', { class: 'bloque b-st' }, el('div', { class: 'tit', style: `color:${C.ecg}` }, el('b', { texto: 'ST' }), el('small', { texto: '(mV)' })), g);
  }

  _bloqueTemp() {
    const f = (k, t) => el('div', { class: 'tfila' }, el('i', { texto: t }), el('b', { 'data-ref': k }));
    return el('section', { class: 'bloque b-temp', 'data-bloque': 'temp' }, el('div', { class: 'tit', style: `color:${C.temp}` }, el('b', { texto: 'TEMP' }), el('small', { texto: '(°C)' })), f('t1', 'T1'), f('t2', 'T2'), f('td', 'TD'));
  }

  _bloqueCo2() {
    const f = (k, t, u) => el('div', { class: 'cfila' }, el('i', { texto: t }), el('b', { 'data-ref': k }), el('small', { texto: u }));
    const b = el('section', { class: 'bloque b-co2', 'data-bloque': 'co2' }, el('div', { class: 'tit', style: `color:${C.co2}` }, el('b', { texto: 'CO₂' }), el('small', { texto: '(mmHg)' })), f('etco2', 'EtCO₂', ''), f('fico2', 'FiCO₂', ''), f('awrr', 'FRva', 'rpm'));
    return b;
  }

  _bloqueArt() {
    return el('section', { class: 'bloque b-art', 'data-bloque': 'art' }, el('div', { class: 'tit', style: `color:${C.art}` }, el('b', { texto: 'ART' }), el('small', { texto: '(mmHg)' })), el('div', { class: 'art-num', style: `color:${C.art}` }, el('b', { 'data-ref': 'art' }), el('span', { 'data-ref': 'artmap' })));
  }

  /** Bloque PANI (abajo-izquierda). */
  _bloqueNibp() {
    const b = el(
      'section',
      { class: 'bloque b-nibp', 'data-bloque': 'nibp' },
      el('div', { class: 'tit', style: `color:${C.nibp}` }, el('b', { texto: 'PANI' }), el('small', { texto: '(mmHg)' }), el('span', { class: 'nibp-modo', 'data-ref': 'nibp-modo' }), el('span', { class: 'nibp-pr', 'data-ref': 'nibp-pr' })),
      el('div', { class: 'nibp-lims' }, el('span', { 'data-lim': 'sys:alto' }), el('span', { 'data-lim': 'dia:bajo' })),
      el('div', { class: 'nibp-num', 'data-ref': 'nibp-num' }),
      el('div', { class: 'nibp-pie' }, el('span', { 'data-ref': 'nibp-msg' }), el('span', { 'data-ref': 'nibp-man' })),
    );
    this.refs['bloque:nibp'] = b;
    return b;
  }

  /** Vista FUENTE GRANDE (manual 7.7): cuatro cuadrantes con números enormes. */
  _vistaFuente(zona) {
    const q = el('div', { class: 'fuente' });
    const cuad = (clave, titulo, unidad, color, lim) => this._bloque({ clave, titulo, unidad, color, limites: lim, clase: 'b-grande' });
    q.append(
      cuad('hr', 'FC', '(lpm)', C.ecg, 'hr'),
      this._bloqueNibpGrande(),
      cuad('spo2', 'SpO₂', '(%)', C.spo2, 'spo2'),
      cuad('rr', 'FR', '(rpm)', C.rr, 'rr'),
    );
    zona.append(q);
  }

  _bloqueNibpGrande() {
    const b = this._bloqueNibp();
    b.classList.add('b-grande');
    return b;
  }

  /** Vista TENDENCIAS (TrendScreen): gráficas de FC, SpO2, FR y PANI de la última hora. */
  _vistaTendencia(zona) {
    const w = el('div', { class: 'vista-tend' });
    const defs = [['FC', 'hr', C.ecg, 0, 200], ['SpO₂', 'spo2', C.spo2, 50, 100], ['FR', 'rr', C.rr, 0, 60], ['PANI sis/dia', 'sys', C.nibp, 0, 250]];
    this.tendCanvas = [];
    for (const [t, k, c, mi, ma] of defs) {
      const cv = el('canvas', { class: 'cv-tend' });
      w.append(el('div', { class: 'tend-fila' }, el('b', { texto: t, style: `color:${c}` }), cv));
      this.tendCanvas.push({ cv, k, c, mi, ma });
    }
    zona.append(w);
  }

  /** Vista OxyCRG: tendencias comprimidas (FC, SpO2, respiración) de los últimos 10 min. */
  _vistaOxy(zona) {
    const w = el('div', { class: 'vista-tend oxy' });
    const defs = [['FC', 'hr', C.ecg, 60, 200], ['SpO₂', 'spo2', C.spo2, 60, 100], ['FR', 'rr', C.rr, 0, 80]];
    this.tendCanvas = [];
    for (const [t, k, c, mi, ma] of defs) {
      const cv = el('canvas', { class: 'cv-tend' });
      w.append(el('div', { class: 'tend-fila' }, el('b', { texto: t, style: `color:${c}` }), cv));
      this.tendCanvas.push({ cv, k, c, mi, ma, ultimos: 120 });
    }
    w.append(el('div', { class: 'oxy-num' }, this._bloque({ clave: 'hr', titulo: 'FC', unidad: '(lpm)', color: C.hr, limites: 'hr' }), this._bloque({ clave: 'spo2', titulo: 'SpO₂', unidad: '(%)', color: C.spo2, limites: 'spo2' }), this._bloque({ clave: 'rr', titulo: 'FR', unidad: '(rpm)', color: C.rr, limites: 'rr' })));
    zona.append(w);
  }

  /** Barra de estado: símbolos de CA, batería, red y fecha/hora. */
  _barraEstado() {
    const s = estado.obtener('sistema');
    const r = (this.refs.estado = {});
    r.hora = el('span', { class: 'hora' });
    r.marca = el('span', { class: 'marca' });
    return el('div', { class: 'barra-estado' }, r.marca, el('span', { class: 'ico-ca', html: s.conAC ? icono('ca') : '' }), el('span', { class: 'ico-bat', html: icono('bateria') }, el('i', { texto: `${Math.round(s.bateria)}%` })), el('span', { class: 'ico-red', html: icono('red') }), r.hora);
  }

  /* ------------------------------------------------------------------ *
   * Teclas
   * ------------------------------------------------------------------ */
  _definirTeclas() {
    const d = this.dialogos;
    return [
      { id: 'admision', ic: 'admision', t: 'Admisión', f: () => d.paciente() },
      { id: 'tendg', ic: 'tendencia', t: 'Gráf. tend.', f: () => d.tendenciaGrafica() },
      { id: 'tendt', ic: 'tabla', t: 'Tabla tend.', f: () => d.tendenciaTabla() },
      { id: 'alrev', ic: 'alarmaRev', t: 'Rev. alarmas', f: () => d.revisionAlarmas() },
      { id: 'nibp', ic: 'pani', t: 'PANI', f: () => this._toggleNibp() },
      { id: 'nibprev', ic: 'tabla', t: 'Rev. PANI', f: () => d.revisionNibp() },
      { id: 'arrrev', ic: 'arr', t: 'Rev. ARR', f: () => d.revisionArritmias() },
      { id: 'estandar', ic: 'estandar', t: 'Estándar', f: () => estado.fijar('sistema.vista', 'estandar') },
      { id: 'tendencia', ic: 'estandar', t: 'Tendencias', f: () => estado.fijar('sistema.vista', 'tendencia') },
      { id: 'oxy', ic: 'oxycrg', t: 'OxyCRG', f: () => estado.fijar('sistema.vista', 'oxyCRG') },
      { id: 'fuente', ic: 'fuente', t: 'Fuente grande', f: () => estado.fijar('sistema.vista', 'fuenteGrande') },
      { id: 'ecg12', ic: 'ecg12', t: 'Análisis 12 der.', f: () => d.ecg12() },
      { id: 'congelar', ic: 'congelar', t: 'Congelar', f: () => estado.fijar('sistema.congelado', !estado.obtener('sistema.congelado')) },
      { id: 'volteclas', ic: 'volTeclas', t: 'Vol. teclas', f: () => this._ciclarVol('sistema.volTeclas', 0, 5) },
      { id: 'vollat', ic: 'volLatido', t: 'Vol. latido', f: () => this._ciclarVol('sistema.volLatido', 0, 5) },
      { id: 'brillo', ic: 'brillo', t: 'Brillo', f: () => this._ciclarVol('sistema.brillo', 1, 10) },
      { id: 'alcfg', ic: 'alarmaCfg', t: 'Config. alarmas', f: () => d.configAlarmas() },
      { id: 'modulos', ic: 'modulos', t: 'Módulos', f: () => d.modulos() },
      { id: 'standby', ic: 'standby', t: 'Standby', f: () => estado.fijar('sistema.modo', 'standby') },
      { id: 'noche', ic: 'noche', t: 'Modo noche', f: () => estado.fijar('sistema.modo', estado.obtener('sistema.modo') === 'noche' ? 'normal' : 'noche') },
    ];
  }

  _teclas() {
    const barra = el('nav', { class: 'teclas' });
    const defs = this._definirTeclas();
    const visibles = 5;
    this.primeraTecla = Math.min(this.primeraTecla, defs.length - visibles);
    const pulsar = (f) => () => {
      if (this.soloVista) return;
      this.sonidos.tecla();
      f();
    };
    const mute = el('button', { class: 'tecla tecla-mute', onClick: pulsar(() => emitir('alarma:silenciar')) }, el('span', { html: icono('silencio') }), el('em', { texto: 'Silenciar' }));
    const izq = el('button', { class: 'tecla tecla-nav', html: icono('izq'), 'aria-label': 'Anterior', onClick: () => { this.primeraTecla = Math.max(0, this.primeraTecla - 1); this._repintarTeclas(); } });
    const der = el('button', { class: 'tecla tecla-nav', html: icono('der'), 'aria-label': 'Siguiente', onClick: () => { this.primeraTecla = Math.min(defs.length - visibles, this.primeraTecla + 1); this._repintarTeclas(); } });
    const medio = el('div', { class: 'teclas-medio' });
    const menu = el('button', { class: 'tecla tecla-menu', onClick: pulsar(() => this.dialogos.menuPrincipal()) }, el('span', { html: icono('menu') }), el('em', { texto: 'Menú' }));
    this._teclasDefs = defs;
    this._medio = medio;
    this._pulsar = pulsar;
    this._visibles = visibles;
    barra.append(mute, izq, medio, der, menu);
    this.refs.mute = mute;
    this._repintarTeclas();
    return barra;
  }

  _repintarTeclas() {
    if (!this._medio) return;
    this._medio.innerHTML = '';
    for (const t of this._teclasDefs.slice(this.primeraTecla, this.primeraTecla + this._visibles)) {
      this._medio.append(el('button', { class: 'tecla', 'data-tecla': t.id, onClick: this._pulsar(t.f) }, el('span', { html: icono(t.ic) }), el('em', { texto: t.t })));
    }
  }

  _toggleNibp() {
    if (this.motor.vivo.nibp.estado === 'midiendo') emitir('nibp:cancelar');
    else emitir('nibp:iniciar', { id: Date.now() });
  }

  _ciclarVol(ruta, min, max) {
    const v = estado.obtener(ruta);
    estado.fijar(ruta, v >= max ? min : v + 1);
    this.dialogos.aviso(`${ruta.endsWith('brillo') ? 'Brillo' : 'Volumen'}: ${estado.obtener(ruta)}`);
  }

  /* ------------------------------------------------------------------ *
   * Bucle de ondas (cada cuadro) y ciclo de datos (4 Hz)
   * ------------------------------------------------------------------ */
  _bucleOndas() {
    requestAnimationFrame(this._bucleOndas);
    if (!estado.obtener('sistema.encendido') || estado.obtener('sistema.congelado')) return;
    for (const l of this.lienzos) {
      if (!l.W || !l.c.width) {
        this._medirLienzo(l);
        continue;
      }
      l.dibujar();
    }
  }

  /** Mide el tamaño de diseño de un canvas tras insertarse (usa el tamaño CSS sin escala). */
  _medirLienzo(l) {
    const w = l.c.offsetWidth;
    const h = l.c.offsetHeight;
    if (!w || !h) return;
    l.cfg.W = w;
    l.cfg.H = h;
    l.ajustar(w, h, this.esc * Math.min(window.devicePixelRatio || 1, 2));
  }

  /** Marca latido del QRS: pitido y destello del corazón. */
  _alLatido(b) {
    if (estado.obtener('sistema.congelado')) return;
    const v = this.motor.vivo;
    this.sonidos.latido(v.spo2 !== null && estado.obtener('modulos.spo2') ? v.spo2 : null);
    void b;
  }

  _poner(clave, texto) {
    for (const n of this.refs[clave] || []) n.textContent = texto;
  }

  _ref(nombre, texto) {
    this.pantalla.querySelectorAll(`[data-ref="${nombre}"]`).forEach((n) => (n.textContent = texto));
  }

  /** Llamado 4 veces por segundo: alarmas, audio, números y rótulos. */
  _ciclo() {
    const s = estado.obtener('sistema');
    if (!s.encendido) return;
    this.flash = !this.flash;
    this.alarmas.evaluar();
    // Audio de alarma
    this.sonidos.alarma(this.alarmas.nivelMax, this.alarmas.sonando && s.modo !== 'standby', performance.now() / 1000);
    if (s.modo === 'standby') return;

    const v = this.motor.vivo;
    const fmt = (x, d = 0) => (x === null || x === undefined ? '---' : Number(x).toFixed(d));
    this._poner('hr', fmt(v.hr));
    this._poner('rr', v.rr ? fmt(v.rr) : estado.obtener('resp.apnea') ? '---' : fmt(v.rr));
    this._poner('pr', fmt(v.pr));
    this._poner('spo2', fmt(v.spo2));
    this._ref('t1', fmt(v.t1, 1));
    this._ref('t2', fmt(v.t2, 1));
    this._ref('td', fmt(v.td, 1));
    this._ref('etco2', v.awrr ? fmt(v.etco2) : '---');
    this._ref('fico2', v.awrr ? fmt(v.fico2) : '---');
    this._ref('awrr', v.awrr ? fmt(v.awrr) : '---');
    this._ref('art', v.artSys ? `${v.artSys}/${v.artDia}` : '---/---');
    this._ref('artmap', v.artSys ? `(${v.artMap})` : '(---)');
    this._ref('marcapasos', `Marc. ${estado.obtener('paciente.marcapasos') ? 'Sí' : 'No'}`);
    this._ref('pvcs', `ESV ${v.pvcs}`);
    this.pantalla.querySelectorAll('[data-st]').forEach((n) => {
      const x = v.st[n.dataset.st];
      n.textContent = x === undefined ? '---' : (x > 0 ? '' : '') + x.toFixed(2);
    });
    this._rotulos(v);
    this._limites();
    this._alarmaVisual();
    this._nibpTexto(v.nibp);
    this._barrasPulso(v);
    this._autoGanancia();
    // Reloj y marca de congelado
    if (this.refs.estado) {
      this.refs.estado.hora.textContent = fechaHora();
      this.refs.estado.marca.textContent = s.congelado ? '❄ CONGELADO' : '';
    }
    if (this.tendCanvas) this._pintarTendencias();
  }

  /** Rótulos de derivación, ganancia y filtro en las filas de ECG. */
  _rotulos(v) {
    const e = estado.obtener('ecg');
    const fil = { monitor: 'Monitor', cirugia: 'Cirugía', diagnostico: 'Diagnóstico' };
    for (let i = 0; i < 2; i++) {
      this._ref(`der${i}`, e.derivaciones[i] || '');
      this._ref(`gan${i}`, e.ganancia === 'Auto' ? 'X Auto' : e.ganancia.toUpperCase().replace('X', 'X'));
      this._ref(`fil${i}`, i === 0 ? fil[e.filtro] : '');
    }
    void v;
  }

  /** Límites de alarma pequeños junto a cada número. */
  _limites() {
    const lim = estado.obtener('alarmas.limites');
    this.pantalla.querySelectorAll('[data-lim]').forEach((n) => {
      const [k, lado] = n.dataset.lim.split(':');
      const l = lim[k];
      n.textContent = l ? (l.activa ? l[lado] : '') : '';
    });
    const hrOff = !lim.hr.activa;
    this.pantalla.querySelectorAll('[data-ref="hr-off"]').forEach((n) => (n.style.visibility = hrOff ? 'visible' : 'hidden'));
  }

  /** Área de alarmas del encabezado y parpadeo de los números en alarma. */
  _alarmaVisual() {
    const cab = this.refs.cabecera;
    if (!cab) return;
    const act = this.alarmas.activas;
    if (act.length) {
      this.indiceAlarma = this.flash && Math.random() < 0 ? 0 : this.indiceAlarma; // sin efecto: reservado
      const a = act[Math.floor(performance.now() / 2000) % act.length];
      cab.alarma.textContent = `${SIMBOLOS_NIVEL[a.nivel]}${a.texto}`;
      cab.alarma.className = `area-alarma nivel-${a.nivel}${a.nivel === 'alta' && this.flash ? ' parpadeo' : ''}`;
    } else {
      cab.alarma.textContent = '';
      cab.alarma.className = 'area-alarma';
    }
    // Símbolo de audio pausado y cuenta atrás
    const p = this.alarmas.pausaRestante;
    cab.silencio.style.visibility = p > 0 ? 'visible' : 'hidden';
    cab.silencio.title = p > 0 ? `Audio en pausa: ${p} s` : '';
    cab.silencio.dataset.seg = p > 0 ? `${p}` : '';
    // Bloques en alarma
    const mapa = { hr: 'hr', pr: 'pr', spo2: 'spo2', rr: 'rr', apnea: 'rr', sys: 'nibp', dia: 'nibp', map: 'nibp', t1: 'temp', t2: 'temp', td: 'temp', etco2: 'co2', fico2: 'co2', awrr: 'co2', artSys: 'art', artDia: 'art', artMap: 'art', arr: 'hr' };
    const enAlarma = new Map();
    for (const a of act) {
      if (a.tipo === 'tecnica') continue;
      const clave = mapa[a.id.split(':')[0]];
      if (clave && !enAlarma.has(clave)) enAlarma.set(clave, a.nivel);
    }
    this.pantalla.querySelectorAll('[data-bloque]').forEach((b) => {
      const nivel = enAlarma.get(b.dataset.bloque);
      b.classList.toggle('en-alarma', !!nivel && this.flash);
      b.dataset.nivel = nivel || '';
    });
  }

  _nibpTexto(n) {
    const modo = estado.obtener('nibp.modo');
    this._ref('nibp-modo', modo === 'auto' ? `Auto ${estado.obtener('nibp.intervalo')} min` : 'Manual');
    this._ref('nibp-pr', `FP ${n.pr ?? '-?-'}`);
    const num = this.pantalla.querySelectorAll('[data-ref="nibp-num"]');
    let txt;
    if (n.estado === 'midiendo' && n.manguito) txt = `${Math.round(n.manguito)}`;
    else if (n.sys === null) txt = '-?-/-?-(-?-)';
    else txt = `${n.sys}/${n.dia}(${n.map})`;
    num.forEach((x) => {
      x.textContent = txt;
      x.classList.toggle('midiendo', n.estado === 'midiendo');
    });
    const msg = n.estado === 'midiendo' ? 'Midiendo…' : n.estado === 'error' ? n.error : n.estado === 'ok' ? '' : 'Pulse Iniciar';
    this._ref('nibp-msg', msg);
    this._ref('nibp-man', `Manguito ${n.manguito ? Math.round(n.manguito) : '-?-'}`);
    if (n.hora) this._ref('nibp-msg', msg || (n.hora instanceof Date ? n.hora.toLocaleTimeString('es') : ''));
    // Límites de la PANI
    const lim = estado.obtener('alarmas.limites');
    this.pantalla.querySelectorAll('.nibp-lims [data-lim]').forEach((x) => {
      const [k, lado] = x.dataset.lim.split(':');
      x.textContent = lim[k][lado];
    });
  }

  _barrasPulso(v) {
    const b = this.refs.barras;
    if (!b) return;
    const n = v.pr === null ? 0 : barrasPulso(v.perfusion);
    if (b.children.length !== 10) {
      b.innerHTML = '';
      for (let i = 0; i < 10; i++) b.append(el('i'));
    }
    [...b.children].forEach((x, i) => x.classList.toggle('on', 9 - i < n));
  }

  /** Ganancia automática del ECG: ajusta mm/mV para que el QRS ocupe ~35 % de la fila. */
  _autoGanancia() {
    if (estado.obtener('ecg.ganancia') !== 'Auto') return;
    const e = estado.obtener('ecg');
    ['ecg1', 'ecg2'].forEach((c, i) => {
      const b = this.motor.canales[c];
      let mx = 0.2;
      for (let k = 1; k < 750 && k < b.n; k++) mx = Math.max(mx, Math.abs(b.leer(b.n - k)));
      const H = this.lienzos[i]?.cfg.H || 100;
      this.gananciaAuto[i] = limitar((H * 0.34) / (mx * PX_MM), 1.25, 40);
    });
    void e;
  }

  _pintarTendencias() {
    const T = this.motor.tendencia;
    for (const t of this.tendCanvas) {
      const w = t.cv.offsetWidth;
      const h = t.cv.offsetHeight;
      if (!w || !h) continue;
      const datos = T.slice(-(t.ultimos || 720));
      const series = [{ color: t.c, datos: datos.map((d) => d[t.k]) }];
      if (t.k === 'sys') series.push({ color: '#9ec', datos: datos.map((d) => d.dia) });
      dibujarTendencia(t.cv, series, { W: w, H: h, k: this.esc, minY: t.mi, maxY: t.ma });
    }
  }
}

export { ETIQUETAS_ALARMA, ALARMAS_ARRITMIA, COLORES };
