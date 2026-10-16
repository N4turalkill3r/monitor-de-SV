/**
 * @file motor.js
 * @description MOTOR DE SIMULACIÓN del monitor: genera las ondas (ECG, pletismografía,
 * respiración, CO2, presión arterial), mide los valores numéricos como lo haría el
 * monitor real (FC por promedio de R-R, FP por pulso, SpO2, FR...), analiza arritmias
 * (16 tipos del manual), simula la PANI y guarda las tendencias.
 *
 * Se ejecuta en: AMBOS. Cada ventana (instructor y proyección) tiene su propio motor;
 * ambos reciben el mismo estado y los mismos eventos mediante sincronizacion.js, y usan
 * la misma semilla aleatoria, por lo que muestran lo mismo.
 *
 * Flujo (cada ~25 ms): tick() → rampas de vitales → generador de ritmo → muestreo a
 * 250 Hz de todos los canales → detección de latidos → numéricos y arritmias (cada 0.5–1 s).
 */
import { FS, SEGUNDOS_BUFER } from '../core/config.js';
import { limitar, crearAleatorio, normal, redondear } from '../core/utilidades.js';
import { estado as estadoGlobal, escuchar, emitir } from '../core/estado.js';
import { voltajeEventos } from './ecg-modelo.js';
import { GeneradorRitmo, definicionRitmo, opcionesPorDefecto } from './ritmos.js';
import { pulsoPleth, pulsoArterial, ondaResp, capnograma } from './fisiologia.js';

/** Búfer circular de muestras de una onda. `n` = muestras escritas desde el inicio. */
export class Bufer {
  constructor(segundos = SEGUNDOS_BUFER, fs = FS) {
    this.fs = fs;
    this.datos = new Float32Array(Math.round(segundos * fs));
    this.n = 0;
  }
  /** Añade una muestra. */
  poner(v) {
    this.datos[this.n % this.datos.length] = v;
    this.n++;
  }
  /** Lee la muestra con índice absoluto `i` (debe estar dentro de la ventana conservada). */
  leer(i) {
    return this.datos[((i % this.datos.length) + this.datos.length) % this.datos.length];
  }
}

/** Tipos de latido ventricular (para el análisis de arritmias). */
const MORF_VENT = new Set(['V', 'escape']);

/** Constantes del filtro de ECG según el modo (Hz): paso-alto y paso-bajo. */
const FILTROS = { monitor: { hp: 0.5, lp: 0 }, cirugia: { hp: 1.0, lp: 20 }, diagnostico: { hp: 0, lp: 0 } };

export class Motor {
  /** @param {import('../core/estado.js').Estado} estado */
  constructor(estado = estadoGlobal) {
    this.e = estado;
    this.rnd = crearAleatorio(this.e.obtener('sistema.semilla'));
    this.gen = new GeneradorRitmo(this.rnd, 0);
    this.t = 0; // reloj de simulación (s)
    this.tGen = 0; // instante hasta el que se han generado muestras
    this.ultimoReal = null;
    this.corriendo = false;

    // Canales de onda
    this.canales = {
      ecg1: new Bufer(),
      ecg2: new Bufer(),
      pleth: new Bufer(),
      resp: new Bufer(),
      co2: new Bufer(),
      art: new Bufer(),
    };

    // Valores "actuales" que se acercan al objetivo fijado por el instructor (rampa)
    this.act = {};
    this._copiarObjetivos(true);

    // Estado de detección y mediciones
    this.beats = []; // latidos detectados {t, vent, perf, rOnT}
    this.pulsos = []; // ondas de pulso {tp, ta, a, rr}
    this.spikes = []; // espículas de marcapasos detectadas
    this.arrHasta = {}; // clave de arritmia → instante en que caduca el aviso
    this.tRitmoDesde = 0;
    this.ritmoActual = null;
    this.fase = { resp: 0, co2: 0 };
    this.apneaDesde = null;
    this.filtro = { ecg1: { x: 0, y: 0, lp: 0 }, ecg2: { x: 0, y: 0, lp: 0 } };
    this.artBase = 0;
    this.ultimoNumerico = 0;
    this.ultimoArr = 0;
    this.ultimaTendencia = 0;
    this.ultimoSt = -10;
    this.historialNibp = []; // mediciones de PANI para la revisión
    this.tendencia = []; // {t, hr, spo2, rr, sys, dia, map, pr, t1, etco2}
    this.cfgEcg = { eje: 60, voltaje: 1, st: 0, patron: 'ninguno', hipertrofia: 'ninguna' };

    /** Valores numéricos medidos (los que muestra la pantalla). */
    this.vivo = {
      hr: null, pr: null, spo2: null, rr: 0, etco2: 0, fico2: 0, awrr: 0, t1: 0, t2: 0, td: 0,
      artSys: 0, artDia: 0, artMap: 0, perfusion: 0, pvcs: 0, arr: [], apneaS: 0,
      st: {}, nibp: this._nibpVacio(), hrIrregular: false, pulsoPerdido: false,
    };
    this.nibp = { estado: 'inactivo', t0: 0, cfg: null, proximo: null, rnd: null };

    /** Callback opcional (la UI lo asigna para el pitido de cada latido): (latido) => void */
    this.alLatido = null;
    this._engancharEventos();
  }

  /* ------------------------------------------------------------------ *
   * Ciclo de vida
   * ------------------------------------------------------------------ */
  iniciar() {
    if (this.corriendo) return;
    this.corriendo = true;
    this.ultimoReal = performance.now() / 1000;
    this._timer = setInterval(() => this.tick(performance.now() / 1000), 25);
  }
  detener() {
    this.corriendo = false;
    clearInterval(this._timer);
  }

  /** Reinicia buffers y mediciones (p. ej. al cambiar de paciente o encender el monitor). */
  reiniciarMediciones() {
    this.beats = [];
    this.pulsos = [];
    this.spikes = [];
    this.arrHasta = {};
    this.gen.ev = [];
    this.tRitmoDesde = this.t;
    this.apneaDesde = null;
    this._copiarObjetivos(true);
  }

  /* ------------------------------------------------------------------ *
   * Bucle principal
   * ------------------------------------------------------------------ */
  tick(ahoraReal) {
    const dt = limitar(ahoraReal - this.ultimoReal, 0, 5);
    this.ultimoReal = ahoraReal;
    const s = this.e.obtener('sistema');
    if (!s.encendido || s.modo === 'standby') return; // apagado: no se simula

    this.t += dt;
    this._rampas(dt);
    this._comprobarRitmo();
    this._actualizarCfg();

    // Mantener la cola de eventos del ritmo ~1.2 s por delante del tiempo actual
    const ecg = this.e.obtener('ecg');
    this.gen.avanzar(this.t + 1.2, Math.max(this.act.hr, 1), ecg.opciones);

    // Muestreo de todas las ondas a 250 Hz hasta el instante actual
    const paso = 1 / FS;
    let guarda = 0;
    while (this.tGen + paso <= this.t && guarda++ < FS * 6) {
      this.tGen += paso;
      this._muestra(this.tGen, paso);
    }
    if (this.t - this.tGen > 6) this.tGen = this.t; // tras una pausa larga, no rellenar

    this.gen.podar(this.t - 16);
    this.pulsos = this.pulsos.filter((p) => this.t - p.tp < 12);
    this.spikes = this.spikes.filter((p) => this.t - p < 12);
    if (this.beats.length > 60) this.beats.splice(0, this.beats.length - 60);

    if (this.t - this.ultimoNumerico >= 1) {
      this.ultimoNumerico = this.t;
      this._actualizarNumericos();
    }
    if (this.t - this.ultimoArr >= 0.4) {
      this.ultimoArr = this.t;
      this._analizarArritmias();
    }
    if (this.t - this.ultimaTendencia >= 5) {
      this.ultimaTendencia = this.t;
      this._guardarTendencia();
    }
    if (this.t - this.ultimoSt >= 2) {
      this.ultimoSt = this.t;
      this._calcularST();
    }
    this._nibpPaso();
  }

  /* ------------------------------------------------------------------ *
   * Objetivos, rampas y configuración
   * ------------------------------------------------------------------ */
  _copiarObjetivos(inmediato) {
    const v = this.e.obtener('vitales');
    const claves = ['hr', 'spo2', 'rr', 'etco2', 'fico2', 'awrr', 't1', 't2', 'perfusion', 'artSys', 'artDia'];
    for (const k of claves) if (inmediato || this.act[k] === undefined) this.act[k] = v[k] ?? 0;
  }

  /** Acerca cada valor actual a su objetivo con una exponencial (tiempo de transición). */
  _rampas(dt) {
    const v = this.e.obtener('vitales');
    const tr = Math.max(this.e.obtener('transicion') || 0, 0.01);
    const k = 1 - Math.exp(-dt / (tr / 3));
    for (const c of Object.keys(this.act)) {
      const obj = v[c] ?? 0;
      this.act[c] += (obj - this.act[c]) * k;
      if (Math.abs(obj - this.act[c]) < 0.02) this.act[c] = obj;
    }
  }

  /** Detecta cambio de ritmo en el estado y reinicia el generador. */
  _comprobarRitmo() {
    const id = this.e.obtener('ecg.ritmo');
    if (id !== this.ritmoActual) {
      this.ritmoActual = id;
      this.gen.cambiar(id, this.t);
      this.tRitmoDesde = this.t;
      this.beats = this.beats.filter((b) => this.t - b.t < 0.5);
    }
  }

  _actualizarCfg() {
    const ecg = this.e.obtener('ecg');
    this.cfgEcg = {
      eje: ecg.eje, voltaje: ecg.voltaje, st: ecg.st, patron: ecg.patron || 'ninguno',
      hipertrofia: ecg.hipertrofia || 'ninguna',
    };
  }

  /* ------------------------------------------------------------------ *
   * Muestreo
   * ------------------------------------------------------------------ */

  /** Voltaje (mV) "limpio" de una derivación en el instante `ts`. */
  ecgLimpio(lead, ts) {
    if (lead === 'V') lead = this.e.obtener('ecg.derV') || 'V1'; // monitor de 5 derivaciones
    return voltajeEventos(this.gen.ev, ts, lead, this.cfgEcg) + this.gen.continuo(ts, lead);
  }

  /** Segmento de ECG de calidad diagnóstica (sin filtro ni ruido) para papel 12 derivaciones. */
  segmentoEcg(lead, tFin, dur) {
    const n = Math.round(dur * FS);
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) out[i] = this.ecgLimpio(lead, tFin - dur + i / FS);
    return out;
  }

  /** Genera UNA muestra de todos los canales. */
  _muestra(ts, dt) {
    const ecg = this.e.obtener('ecg');
    const tec = this.e.obtener('tecnicas');
    this._detectar(ts);

    // Fases respiratorias
    const apnea = this.e.obtener('resp.apnea');
    this.fase.resp = (this.fase.resp + (dt * Math.max(this.act.rr, 0)) / 60) % 1;
    this.fase.co2 = (this.fase.co2 + (dt * Math.max(this.act.awrr, 0)) / 60) % 1;
    const deriva = 0.025 * Math.sin(2 * Math.PI * this.fase.resp); // línea de base respira

    // ----- ECG (2 canales) -----
    const ruido = limitar(ecg.ruido + (tec.ruidoECG ? 0.7 : 0), 0, 1);
    const f = FILTROS[ecg.filtro] || FILTROS.monitor;
    for (let i = 0; i < 2; i++) {
      const nombre = i === 0 ? 'ecg1' : 'ecg2';
      let v;
      if (tec.electrodoDesconectado) v = 0.0;
      else {
        v = this.ecgLimpio(ecg.derivaciones[i] || 'II', ts) + deriva;
        if (ruido > 0) {
          v += normal(this.rnd, 0, 0.06 * ruido) + 0.12 * ruido * Math.sin(2 * Math.PI * 60 * ts);
        }
      }
      v = this._filtrar(this.filtro[nombre], v, f, dt);
      this.canales[nombre].poner(v);
    }

    // ----- Pletismografía y arterial a partir de los pulsos detectados -----
    const sensor = !this.e.obtener('tecnicas.spo2SensorFuera');
    let pl = 0;
    let ar = 0;
    for (const p of this.pulsos) {
      const d1 = ts - p.tp;
      if (d1 >= 0 && d1 < 1.6) pl = Math.max(pl, p.a * pulsoPleth(d1, p.rr));
      const d2 = ts - p.ta;
      if (d2 >= 0 && d2 < 1.6) ar = Math.max(ar, p.a * pulsoArterial(d2, p.rr));
    }
    const ampPl = limitar(this.act.perfusion / 70, 0.08, 1.4);
    this.canales.pleth.poner(sensor ? pl * ampPl + 0.03 * Math.sin(2 * Math.PI * this.fase.resp) : 0);

    // Presión arterial invasiva (mmHg): la presión de base cae a 0 si no hay pulso
    const hayPulso = this.pulsos.some((p) => ts - p.tp < 2.5 && p.a > 0.2);
    const objBase = hayPulso ? this.act.artDia : 0;
    this.artBase += (objBase - this.artBase) * (1 - Math.exp(-dt / 1.2));
    this.canales.art.poner(this.artBase + (this.act.artSys - this.act.artDia) * ar);

    // ----- Respiración y CO2 -----
    this.canales.resp.poner(apnea ? 0.5 : ondaResp(this.fase.resp) * this.e.obtener('resp.amplitud'));
    const ocl = tec.co2Oclusion;
    const co2 = apnea || ocl ? 0 : capnograma(this.fase.co2, this.act.etco2, this.act.fico2, this.e.obtener('co2.patron'));
    this.canales.co2.poner(co2);
  }

  /** Filtro simple: paso-alto de 1.er orden y paso-bajo de 1.er orden opcionales. */
  _filtrar(est, x, f, dt) {
    let y = x;
    if (f.hp > 0) {
      const rc = 1 / (2 * Math.PI * f.hp);
      const a = rc / (rc + dt);
      y = a * (est.y + x - est.x);
      est.x = x;
      est.y = y;
    }
    if (f.lp > 0) {
      const rc = 1 / (2 * Math.PI * f.lp);
      const b = dt / (rc + dt);
      est.lp += b * (y - est.lp);
      y = est.lp;
    }
    return y;
  }

  /* ------------------------------------------------------------------ *
   * Detección de latidos (se "ven" cuando el reloj pasa por el evento)
   * ------------------------------------------------------------------ */
  _eficacia(f) {
    const modo = this.e.obtener('ecg.pulso');
    const base = f.perf ?? 1;
    if (modo === 'no') return 0;
    if (modo === 'si') return Math.max(base, 0.8);
    return base;
  }

  _detectar(ts) {
    for (const ev of this.gen.ev) {
      if (ev._p || ev.t > ts) continue;
      ev._p = true;
      if (ev.tipo === 'SPIKE') this.spikes.push(ev.t);
      if (ev.tipo !== 'QRS' || ev.f.visible === false) continue;
      if (ev.f.spike) this.spikes.push(ev.t - 0.01);
      const prev = this.beats[this.beats.length - 1];
      const rr = prev ? ev.t - prev.t : 60 / Math.max(this.act.hr, 1);
      const a = this._eficacia(ev.f);
      this.beats.push({ t: ev.t, vent: MORF_VENT.has(ev.f.morf), perf: a, rOnT: !!ev.f.rOnT });
      if (this.alLatido) this.alLatido({ t: ev.t, vent: MORF_VENT.has(ev.f.morf), perf: a });
      if (a > 0.02) this.pulsos.push({ tp: ev.t + 0.2, ta: ev.t + 0.08, a, rr: limitar(rr, 0.25, 2) });
    }
  }

  /* ------------------------------------------------------------------ *
   * Valores numéricos medidos
   * ------------------------------------------------------------------ */

  /** Promedio de intervalos descartando el mayor y el menor (método del manual, cap. 8.9). */
  _promedioRR(tiempos, maximo = 13) {
    const t = tiempos.slice(-maximo);
    if (t.length < 3) return null;
    const rr = [];
    for (let i = 1; i < t.length; i++) rr.push(t[i] - t[i - 1]);
    let usar = rr;
    if (rr.length >= 4) {
      const orden = [...rr].sort((a, b) => a - b);
      usar = orden.slice(1, -1); // sin mínimo ni máximo
    }
    return usar.reduce((a, b) => a + b, 0) / usar.length;
  }

  _actualizarNumericos() {
    const v = this.vivo;
    const tec = this.e.obtener('tecnicas');
    const mods = this.e.obtener('modulos');
    const ahora = this.t;

    // --- FC por ECG ---
    const sinEcg = tec.electrodoDesconectado || !mods.ecg;
    const ultimo = this.beats.length ? this.beats[this.beats.length - 1].t : -99;
    const rrMedio = this._promedioRR(this.beats.map((b) => b.t));
    v.hr = sinEcg || rrMedio === null || ahora - ultimo > 4 || this.ritmoActual === 'fv' ? null : redondear(60 / rrMedio);
    v.hrIrregular = false;

    // --- FP por pulso (solo cuentan los pulsos con amplitud suficiente) ---
    const pulsosBuenos = this.pulsos.filter((p) => p.a > 0.5).map((p) => p.tp);
    const rrP = this._promedioRR(pulsosBuenos, 9);
    const ultP = pulsosBuenos.length ? pulsosBuenos[pulsosBuenos.length - 1] : -99;
    const sensor = !tec.spo2SensorFuera && mods.spo2;
    v.pr = sensor && rrP !== null && ahora - ultP < 4 ? redondear(60 / rrP) : null;
    v.pulsoPerdido = sensor && v.pr === null;

    // --- SpO2 (pierde la señal si no hay pulso o el sensor está fuera) ---
    if (!sensor || v.pr === null) v.spo2 = null;
    else v.spo2 = limitar(Math.round(this.act.spo2 + (this.rnd() < 0.15 ? Math.sign(this.rnd() - 0.5) : 0)), 0, 100);
    v.perfusion = sensor && v.pr !== null ? this.act.perfusion : 0;

    // --- Respiración (impedancia) y apnea ---
    const apnea = this.e.obtener('resp.apnea');
    if (apnea) {
      this.apneaDesde = this.apneaDesde ?? ahora;
      v.apneaS = ahora - this.apneaDesde;
      v.rr = 0;
    } else {
      this.apneaDesde = null;
      v.apneaS = 0;
      v.rr = mods.resp ? Math.round(this.act.rr) : 0;
    }

    // --- CO2 ---
    const noCo2 = !mods.co2 || apnea || tec.co2Oclusion;
    v.etco2 = noCo2 ? 0 : Math.round(this.act.etco2);
    v.fico2 = noCo2 ? 0 : Math.round(this.act.fico2);
    v.awrr = noCo2 ? 0 : Math.round(this.act.awrr);

    // --- Temperatura ---
    v.t1 = mods.temp ? redondear(this.act.t1, 1) : null;
    v.t2 = mods.temp ? redondear(this.act.t2, 1) : null;
    v.td = mods.temp ? redondear(Math.abs(this.act.t1 - this.act.t2), 1) : null;

    // --- Presión arterial invasiva ---
    if (mods.ibp) {
      v.artSys = this.artBase < 5 ? 0 : Math.round(this.act.artSys);
      v.artDia = this.artBase < 5 ? 0 : Math.round(this.act.artDia);
      v.artMap = Math.round((v.artSys + 2 * v.artDia) / 3);
    }

    // --- PVCs por minuto ---
    v.pvcs = this.beats.filter((b) => b.vent && ahora - b.t < 60).length;
  }

  /** Desviación del ST (mV) medida 60 ms después del punto J en cada derivación. */
  _calcularST() {
    const ev = [{ tipo: 'QRS', t: 0, f: { ancho: 0.09, qt: 0.4, perf: 1 } }];
    const out = {};
    const derV = this.e.obtener('ecg.derV') || 'V1';
    for (const l of ['I', 'II', 'III', 'aVR', 'aVL', 'aVF', derV]) {
      const v = voltajeEventos(ev, 0.15, l, this.cfgEcg) - voltajeEventos(ev, -0.04, l, this.cfgEcg);
      out[l === derV ? 'V' : l] = redondear(v, 2);
    }
    this.vivo.st = out;
  }

  _guardarTendencia() {
    const v = this.vivo;
    this.tendencia.push({
      t: Date.now(), hr: v.hr, spo2: v.spo2, rr: v.rr, pr: v.pr, t1: v.t1, etco2: v.etco2,
      sys: this.vivo.nibp.sys, dia: this.vivo.nibp.dia, map: this.vivo.nibp.map,
    });
    if (this.tendencia.length > 720) this.tendencia.shift();
  }

  /* ------------------------------------------------------------------ *
   * Análisis de arritmias (cap. 8.11 del manual)
   * ------------------------------------------------------------------ */
  _analizarArritmias() {
    const ahora = this.t;
    const ecgOn = this.e.obtener('modulos.ecg') && !this.e.obtener('tecnicas.electrodoDesconectado');
    const activas = [];
    const marca = (clave, dur = 1.2) => {
      this.arrHasta[clave] = Math.max(this.arrHasta[clave] || 0, ahora + dur);
    };
    if (ecgOn && ahora - this.tRitmoDesde > 0.5) {
      const tipoPac = this.e.obtener('paciente.tipo');
      const B = this.beats.slice(-14);
      const ult = B.length ? B[B.length - 1].t : this.tRitmoDesde;
      const rr = [];
      for (let i = 1; i < B.length; i++) rr.push(B[i].t - B[i - 1].t);
      const rrMedio = rr.length ? rr.slice(-5).reduce((a, b) => a + b, 0) / Math.min(rr.length, 5) : 1;
      const hr = 60 / rrMedio;

      // Fibrilación ventricular y asistolia
      if (this.ritmoActual === 'fv') {
        if (ahora - this.tRitmoDesde >= 4) marca('VFIB_VTAC');
      } else if (ahora - ult >= 4 && ahora - this.tRitmoDesde >= 4) {
        marca('ASYSTOLE');
      }

      // Racha final de latidos ventriculares
      let n = 0;
      for (let i = B.length - 1; i >= 0 && B[i].vent; i--) n++;
      const reciente = B.length && ahora - ult < 3;
      if (reciente && n >= 5) {
        const r5 = rr.slice(-4);
        if (r5.every((x) => x < 0.6)) marca('VFIB_VTAC', 2);
        else if (r5.every((x) => x > 1.0)) marca('VBRADY', 2);
        else marca('VENT', 2);
      } else if (reciente && n >= 3) marca('VT_MAS_2', 6);
      else if (reciente && n === 2) marca('COUPLET', 6);
      else if (reciente && n === 1 && B.length > 1 && !B[B.length - 2].vent) {
        if (B[B.length - 1].rOnT) marca('R_ON_T', 6);
        else marca('PVC', 6);
      }

      // Bigeminismo / trigeminismo (patrón en los últimos 6 latidos)
      if (reciente && B.length >= 6) {
        const u = B.slice(-6).map((b) => (b.vent ? 1 : 0));
        if (u.join('') === '010101' || u.join('') === '101010') marca('BIGEMINY', 3);
        const pos = u.map((x, i) => (x ? i : -1)).filter((i) => i >= 0);
        if (pos.length === 2 && pos[1] - pos[0] === 3) marca('TRIGEMINY', 3);
      }

      // Taquicardia / bradicardia (5 QRS consecutivos)
      const limT = tipoPac === 'ADU' ? 0.5 : 0.375;
      const limB = tipoPac === 'ADU' ? 1.5 : 1.0;
      if (reciente && rr.length >= 4) {
        const u4 = rr.slice(-4);
        if (u4.every((x) => x < limT)) marca('TACHY', 2);
        if (u4.every((x) => x >= limB)) marca('BRADY', 2);
      }

      // Latidos omitidos: pausa sin llegar a asistolia
      if (B.length >= 5) {
        const umbral = hr < 120 ? 1.75 * rrMedio : 1.0;
        if (ahora - ult > umbral && ahora - ult < 4 && this.ritmoActual !== 'fv') marca('MISSED_BEATS', 2);
      }

      // Ritmo irregular (sin ectopia ventricular y coeficiente de variación alto)
      if (reciente && rr.length >= 7) {
        const u = rr.slice(-8);
        const m = u.reduce((a, b) => a + b, 0) / u.length;
        const sd = Math.sqrt(u.reduce((a, b) => a + (b - m) ** 2, 0) / u.length);
        if (sd / m > 0.15 && !B.slice(-8).some((b) => b.vent)) marca('IRR', 2);
      }

      // Marcapasos: espícula sin captura (no hay QRS en los 300 ms siguientes)
      for (const sp of this.spikes) {
        if (ahora - sp > 0.35 && ahora - sp < 5 && !B.some((b) => b.t >= sp - 0.02 && b.t <= sp + 0.3)) marca('PNC', 4);
      }
    }
    for (const [k, hasta] of Object.entries(this.arrHasta)) if (hasta > ahora) activas.push(k);
    this.vivo.arr = activas;
  }

  /* ------------------------------------------------------------------ *
   * PANI (presión no invasiva) — máquina de estados
   * ------------------------------------------------------------------ */
  _nibpVacio() {
    return { estado: 'inactivo', sys: null, dia: null, map: null, pr: null, hora: null, manguito: 0, error: '' };
  }

  /** Inicia una medición (id = semilla del ruido, igual en ambas ventanas). */
  iniciarNibp(id = Date.now()) {
    if (!this.e.obtener('modulos.nibp')) return;
    const dur = this.e.obtener('nibp.duracion') || 28;
    const sys = this.e.obtener('vitales.sys');
    this.nibp = {
      estado: 'midiendo', t0: this.t, dur, rnd: crearAleatorio(id >>> 0),
      objetivo: Math.max(sys * 1.2, 150), proximo: this.nibp.proximo,
    };
    this.vivo.nibp = { ...this._nibpVacio(), estado: 'midiendo', sys: this.vivo.nibp.sys, dia: this.vivo.nibp.dia, map: this.vivo.nibp.map, hora: this.vivo.nibp.hora, pr: this.vivo.nibp.pr };
    this._nibpProgramar();
  }

  cancelarNibp() {
    this.nibp.estado = 'inactivo';
    this.vivo.nibp.estado = 'inactivo';
    this.vivo.nibp.manguito = 0;
  }

  _nibpProgramar() {
    if (this.e.obtener('nibp.modo') === 'auto') this.nibp.proximo = this.t + this.e.obtener('nibp.intervalo') * 60;
    else this.nibp.proximo = null;
  }

  _nibpPaso() {
    const n = this.nibp;
    const vn = this.vivo.nibp;
    const tec = this.e.obtener('tecnicas');
    if (n.estado === 'midiendo') {
      const x = (this.t - n.t0) / n.dur;
      // Inflado rápido (30 % del tiempo) y desinflado escalonado
      vn.manguito = x < 0.3 ? (x / 0.3) * n.objetivo : n.objetivo * (1 - 0.88 * ((x - 0.3) / 0.7));
      if (tec.nibpManguitoFlojo && x > 0.2) return this._nibpError('MANGUITO FLOJO');
      if (tec.nibpFuga && x > 0.45) return this._nibpError('FUGA DE AIRE');
      if (x >= 1) {
        const v = this.e.obtener('vitales');
        const r = n.rnd;
        const sys = Math.round(v.sys + normal(r, 0, 1.8));
        const dia = Math.round(v.dia + normal(r, 0, 1.5));
        Object.assign(vn, {
          estado: 'ok', sys, dia, map: Math.round((sys + 2 * dia) / 3), pr: this.vivo.pr ?? 0,
          hora: new Date(), manguito: 0, error: '',
        });
        n.estado = 'ok';
        this.historialNibp.unshift({ hora: new Date(), sys, dia, map: Math.round((sys + 2 * dia) / 3), pr: this.vivo.pr });
        if (this.historialNibp.length > 200) this.historialNibp.pop();
        emitir('nibp:resultado', { sys, dia });
      }
    } else if (n.proximo && this.t >= n.proximo && this.e.obtener('nibp.modo') === 'auto') {
      this.iniciarNibp(Math.floor(this.t * 1000));
    }
  }

  _nibpError(texto) {
    this.nibp.estado = 'error';
    Object.assign(this.vivo.nibp, { estado: 'error', error: texto, manguito: 0 });
  }

  /* ------------------------------------------------------------------ *
   * Eventos del bus
   * ------------------------------------------------------------------ */
  _engancharEventos() {
    escuchar('nibp:iniciar', (d) => this.iniciarNibp(d.id));
    escuchar('nibp:cancelar', () => this.cancelarNibp());
    // Inyección manual de latidos ectópicos (instructor)
    escuchar('ecg:esv', () => this.inyectarEsv(false));
    escuchar('ecg:ron_t', () => this.inyectarEsv(true));
    escuchar('motor:reiniciar', () => this.reiniciarMediciones());
  }

  /** Inserta un latido ventricular prematuro (opcionalmente "R sobre T"). */
  inyectarEsv(rOnT) {
    const ult = this.beats.length ? this.beats[this.beats.length - 1].t : this.t;
    const rr = 60 / Math.max(this.act.hr, 30);
    const t = Math.max(this.t + 0.15, ult + (rOnT ? 0.28 * rr : 0.55 * rr));
    this.gen.ev.push({
      tipo: 'QRS', t,
      f: { morf: 'V', ancho: 0.14, amp: 1.2, qt: 0.42, vMorf: 'bri', perf: 0.4, rOnT },
    });
    this.gen.ev.sort((a, b) => a.t - b.t);
  }

  /** Aplica un ritmo desde el instructor: fija ritmo, opciones y FC por defecto. */
  aplicarRitmo(id) {
    const def = definicionRitmo(id);
    this.e.fijar('ecg.opciones', opcionesPorDefecto(id));
    this.e.fijar('ecg.ritmo', id);
    if (def.fc[2] > 0) this.e.fijar('vitales.hr', def.fc[2]);
  }
}
