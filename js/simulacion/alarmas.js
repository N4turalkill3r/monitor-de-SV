/**
 * @file alarmas.js
 * @description Gestor de alarmas según el capítulo 4–5 del manual: prioridades
 * (alta ***, media **, baja *), alarmas fisiológicas por límites, de arritmia (16),
 * técnicas, pausa temporal de audio (tecla Mute), enclavamiento (latch) y retraso.
 *
 * Se ejecuta en: AMBOS. No reproduce sonido (eso lo hace audio/sonidos.js); sólo
 * calcula la lista de alarmas activas y el estado del audio.
 */
import { ETIQUETAS_ALARMA, ALARMAS_ARRITMIA, ALARMAS_TECNICAS, NIVELES, SIMBOLOS_NIVEL } from '../core/config.js';
import { emitir, escuchar } from '../core/estado.js';

/** Retraso (s) que debe persistir una condición antes de convertirse en alarma. */
const RETRASO = 2;

/** Género del sustantivo para "Baja/Alta" vs "Bajo/Alto". */
const FEMENINAS = new Set(['hr', 'pr', 'rr', 'awrr', 'spo2']);

export class GestorAlarmas {
  /**
   * @param {import('../core/estado.js').Estado} estado
   * @param {import('./motor.js').Motor} motor
   */
  constructor(estado, motor) {
    this.e = estado;
    this.motor = motor;
    this.activas = []; // [{id, texto, nivel, tipo, desde}]
    this.desde = {}; // id → instante en que empezó a cumplirse la condición
    this.retenidas = {}; // alarmas enclavadas (latch) pendientes de reconocer
    this.pausaHasta = 0; // instante (reloj del motor) en que termina la pausa de audio
    this.previas = new Set();
    this.registro = []; // historial para "Revisión de alarmas" y "Revisión ARR"
    escuchar('alarma:silenciar', () => this.silenciar());
    escuchar('alarma:reconocer', () => this.reconocer());
  }

  /** Valor actual de un parámetro con límites, o null si no hay medición. */
  _valor(clave) {
    const v = this.motor.vivo;
    const mods = this.e.obtener('modulos');
    const nb = v.nibp;
    const nbOk = nb.estado === 'ok' && mods.nibp;
    switch (clave) {
      case 'hr': return mods.ecg ? v.hr : null;
      case 'pr': return v.pr;
      case 'spo2': return v.spo2;
      case 'rr': return mods.resp && !this.e.obtener('resp.apnea') ? v.rr : null;
      case 'sys': return nbOk ? nb.sys : null;
      case 'dia': return nbOk ? nb.dia : null;
      case 'map': return nbOk ? nb.map : null;
      case 't1': return v.t1;
      case 't2': return v.t2;
      case 'td': return v.td;
      case 'etco2': return mods.co2 && v.awrr > 0 ? v.etco2 : null;
      case 'fico2': return mods.co2 ? v.fico2 : null;
      case 'awrr': return mods.co2 && v.awrr > 0 ? v.awrr : null;
      case 'artSys': return mods.ibp ? v.artSys : null;
      case 'artDia': return mods.ibp ? v.artDia : null;
      case 'artMap': return mods.ibp ? v.artMap : null;
      default: return null;
    }
  }

  /** Recalcula la lista de alarmas. Llamar ~4 veces por segundo. */
  evaluar() {
    const ahora = this.motor.t;
    const al = this.e.obtener('alarmas');
    const cond = []; // condiciones cumplidas ahora {id, texto, nivel, tipo, retraso}

    // 1) Límites fisiológicos
    for (const [clave, lim] of Object.entries(al.limites)) {
      if (!lim.activa) continue;
      const val = this._valor(clave);
      if (val === null || val === undefined) continue;
      const fem = FEMENINAS.has(clave);
      if (val < lim.bajo) cond.push({ id: `${clave}:bajo`, texto: `${ETIQUETAS_ALARMA[clave]} ${fem ? 'Baja' : 'Bajo'}`, nivel: lim.nivel, tipo: 'fisio' });
      else if (val > lim.alto) cond.push({ id: `${clave}:alto`, texto: `${ETIQUETAS_ALARMA[clave]} ${fem ? 'Alta' : 'Alto'}`, nivel: lim.nivel, tipo: 'fisio' });
    }

    // 2) Apnea
    if (this.e.obtener('modulos.resp') && this.motor.vivo.apneaS >= this.e.obtener('resp.tiempoApnea')) {
      cond.push({ id: 'apnea', texto: 'APNEA', nivel: 'alta', tipo: 'fisio', retraso: 0 });
    }

    // 3) Arritmias
    if (al.arritmiaActiva) {
      for (const k of this.motor.vivo.arr) {
        const cfg = al.arritmia[k];
        if (cfg && cfg.activa) cond.push({ id: `arr:${k}`, texto: ALARMAS_ARRITMIA[k].txt, nivel: cfg.nivel, tipo: 'arr', retraso: 0 });
      }
    }

    // 4) Técnicas
    const tec = this.e.obtener('tecnicas');
    for (const [k, def] of Object.entries(ALARMAS_TECNICAS)) {
      if (tec[k]) cond.push({ id: `tec:${k}`, texto: def.txt, nivel: def.nivel, tipo: 'tecnica', retraso: 0 });
    }
    if (this.motor.vivo.pulsoPerdido && this.e.obtener('modulos.spo2') && !tec.spo2SensorFuera) {
      cond.push({ id: 'tec:pulso', texto: 'SPO2 BUSCANDO PULSO', nivel: 'baja', tipo: 'tecnica', retraso: 0 });
    }
    const nb = this.motor.vivo.nibp;
    if (nb.estado === 'error') cond.push({ id: 'tec:nibp', texto: `PANI ${nb.error}`, nivel: 'baja', tipo: 'tecnica', retraso: 0 });

    // Aplicar retraso de persistencia
    const vigentes = [];
    const ids = new Set();
    for (const c of cond) {
      ids.add(c.id);
      if (this.desde[c.id] === undefined) this.desde[c.id] = ahora;
      if (ahora - this.desde[c.id] >= (c.retraso ?? RETRASO)) vigentes.push({ ...c, desde: this.desde[c.id] });
    }
    for (const k of Object.keys(this.desde)) if (!ids.has(k)) delete this.desde[k];

    // Enclavamiento (latch): lo que se disparó se conserva hasta reconocerlo
    if (al.latch) {
      for (const v of vigentes) this.retenidas[v.id] = v;
      for (const [id, v] of Object.entries(this.retenidas)) if (!ids.has(id)) vigentes.push({ ...v, retenida: true });
    } else {
      this.retenidas = {};
    }

    vigentes.sort((a, b) => NIVELES[b.nivel] - NIVELES[a.nivel]);
    // Evitar duplicados por la mezcla de retenidas
    const visto = new Set();
    this.activas = vigentes.filter((v) => !visto.has(v.id) && visto.add(v.id));

    // Aviso de alarmas nuevas (para el registro de eventos y la animación)
    for (const a of this.activas) {
      if (!this.previas.has(a.id)) {
        // Guardar en el registro; en arritmias se conserva además la tira de ECG de 6 s
        const reg = { hora: new Date(), texto: a.texto, nivel: a.nivel, tipo: a.tipo, id: a.id };
        if (a.tipo === 'arr') {
          const b = this.motor.canales.ecg1;
          const n = Math.min(b.n, 6 * 250);
          reg.ecg = Float32Array.from({ length: n }, (_, i) => b.leer(b.n - n + i));
          reg.derivacion = this.e.obtener('ecg.derivaciones.0');
        }
        this.registro.unshift(reg);
        if (this.registro.length > 100) this.registro.pop();
        emitir('alarma:nueva', { alarma: a });
      }
    }
    this.previas = new Set(this.activas.map((a) => a.id));
  }

  /** Nivel más alto actualmente activo o null. */
  get nivelMax() {
    return this.activas.length ? this.activas[0].nivel : null;
  }

  /** Segundos restantes de pausa de audio (0 si no hay). */
  get pausaRestante() {
    return Math.max(0, Math.ceil(this.pausaHasta - this.motor.t));
  }

  /** ¿Debe sonar la alarma ahora? Hay alarma audible y no hay pausa ni silencio total. */
  get sonando() {
    const al = this.e.obtener('alarmas');
    if (al.tiempoPausa === 0) return false;
    return this.activas.length > 0 && this.pausaRestante === 0;
  }

  /** Tecla Mute: inicia la pausa temporal de audio; una segunda pulsación la cancela. */
  silenciar() {
    if (this.pausaRestante > 0) {
      this.pausaHasta = 0;
    } else {
      this.pausaHasta = this.motor.t + (this.e.obtener('alarmas.tiempoPausa') || 120);
    }
    // En modo latch, silenciar también reconoce las condiciones ya resueltas
    this.retenidas = {};
  }

  /** Reconoce (limpia) las alarmas retenidas. */
  reconocer() {
    this.retenidas = {};
  }

  /** Texto con símbolos de prioridad para el área de alarmas: "**FC Baja". */
  static etiqueta(a) {
    return `${SIMBOLOS_NIVEL[a.nivel]}${a.texto}`;
  }
}
