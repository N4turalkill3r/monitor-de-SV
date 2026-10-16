/**
 * @file estado.js
 * @description Almacén de estado compartido (patrón observable) y bus de eventos.
 *
 * Se ejecuta en: AMBOS (cada ventana tiene su propia copia; la ventana de
 * proyección se mantiene sincronizada mediante js/core/sincronizacion.js).
 *
 * El estado contiene SOLO configuración y "valores objetivo" que el instructor
 * puede modificar. Los datos que cambian cada milisegundo (muestras de ondas,
 * tendencias, presión del manguito...) viven en los módulos de simulación.
 */
import { clonar, leerRuta, escribirRuta } from './utilidades.js';
import { VITALES_POR_DEFECTO, LIMITES_POR_DEFECTO, ALARMAS_ARRITMIA } from './config.js';

/** Construye las alarmas de límites con los valores por defecto para un tipo de paciente. */
export function crearLimites(tipo) {
  const lim = {};
  for (const [clave, porTipo] of Object.entries(LIMITES_POR_DEFECTO)) {
    const [bajo, alto] = porTipo[tipo];
    lim[clave] = { bajo, alto, activa: true, nivel: 'media' };
  }
  return lim;
}

/** Configuración por defecto de las 16 alarmas de arritmia. */
export function crearAlarmasArritmia() {
  const o = {};
  for (const [k, v] of Object.entries(ALARMAS_ARRITMIA)) o[k] = { activa: true, nivel: v.nivel };
  return o;
}

/** Crea el estado completo inicial (equivale a "Default" de fábrica del monitor). */
export function crearEstadoInicial(tipo = 'ADU') {
  return {
    sistema: {
      encendido: false, // el monitor arranca apagado: obliga a un gesto del usuario (audio)
      semilla: 20260101, // semilla común: ambas ventanas generan los mismos números aleatorios
      modo: 'normal', // normal | standby | noche
      brillo: 8, // 1..10
      volTeclas: 3, // 0..5
      volLatido: 3, // 0..5
      volAlarma: 3, // 1..5
      silencioLocal: false, // silencia el audio de ESTA ventana (útil al proyectar)
      congelado: false,
      bateria: 100, // porcentaje simulado
      conAC: true,
      vista: 'estandar', // estandar | tendencia | oxyCRG | fuenteGrande
    },
    paciente: {
      nombre: 'PACIENTE SIMULADO',
      mrn: '00000001',
      tipo,
      sexo: 'N/D',
      edad: 45,
      altura: 170,
      peso: 70,
      cama: '01',
      departamento: 'UCI',
      marcapasos: false,
    },
    modulos: { ecg: true, resp: true, spo2: true, nibp: true, temp: true, co2: true, ibp: false },
    vitales: {
      ...VITALES_POR_DEFECTO[tipo],
      artSys: 120,
      artDia: 80,
    },
    ecg: {
      ritmo: 'sinusal',
      opciones: {}, // opciones específicas del ritmo (patrón de ectopia, relación del flúter...)
      derivaciones: ['II', 'V'], // 'V' = electrodo precordial (ver derV) // derivaciones mostradas en las dos ondas de ECG
      tipoDerivaciones: '5', // 3 | 5 | 12
      ganancia: 'x1',
      filtro: 'monitor',
      velocidad: 25,
      eje: 60, // eje eléctrico del QRS en grados (plano frontal)
      st: 0, // INTENSIDAD (mV, 0..0.6) del patrón de isquemia elegido en `patron`
      patron: 'ninguno', // clave de PATRONES_ISQUEMIA (ecg-modelo.js)
      hipertrofia: 'ninguna', // clave de HIPERTROFIAS (ecg-modelo.js)
      derV: 'V1', // derivación precordial del electrodo V (monitor de 5 derivaciones)
      voltaje: 1, // multiplicador global de voltaje del QRS
      ruido: 0, // 0..1 interferencia (artefacto muscular / 60 Hz)
      pulso: 'auto', // auto | si | no  (AESP = ECG organizado pero sin pulso)
      stAnalisis: true,
    },
    resp: { amplitud: 1, apnea: false, tiempoApnea: 20, ruido: 0 },
    co2: { patron: 'normal' }, // normal | broncoespasmo | rebreathing
    spo2: { tono: true, sensibilidad: 'media' },
    alarmas: {
      limites: crearLimites(tipo),
      tiempoPausa: 120,
      latch: false,
      silenciarPermitido: true,
      arritmia: crearAlarmasArritmia(), // clave -> { activa, nivel } (16 alarmas, Apéndice C.3)
      arritmiaActiva: true,
    },
    tecnicas: {
      electrodoDesconectado: false,
      spo2SensorFuera: false,
      nibpManguitoFlojo: false,
      nibpFuga: false,
      co2Oclusion: false,
      bateriaBaja: false,
      ruidoECG: false,
    },
    nibp: { modo: 'manual', intervalo: 15, duracion: 28 },
    escenario: { titulo: '', descripcion: '' },
    // Transición de valores (rampa) entre estados fisiológicos, en segundos.
    transicion: 8,
  };
}

/** Bus de eventos (no forman parte del estado): ej. 'nibp:iniciar', 'congelar'. */
export const bus = new EventTarget();

/** Emite un evento en el bus con un `detalle` opcional. */
export const emitir = (tipo, detalle = {}) => bus.dispatchEvent(new CustomEvent(tipo, { detail: detalle }));

/** Escucha un evento del bus. Devuelve función para cancelar la suscripción. */
export function escuchar(tipo, fn) {
  const h = (e) => fn(e.detail);
  bus.addEventListener(tipo, h);
  return () => bus.removeEventListener(tipo, h);
}

/** Almacén observable con rutas "a.b.c". */
export class Estado {
  constructor(inicial) {
    this.datos = inicial;
    this.oyentes = new Set(); // { ruta, fn }
  }

  /** Lee una ruta (o todo el estado si no se indica). */
  obtener(ruta) {
    return ruta ? leerRuta(this.datos, ruta) : this.datos;
  }

  /**
   * Escribe un valor y notifica a quienes escuchan esa ruta (o sus padres/hijos).
   * @param {string} ruta
   * @param {*} valor
   * @param {{silencioso?: boolean}} opciones silencioso = no notificar
   */
  fijar(ruta, valor, opciones = {}) {
    escribirRuta(this.datos, ruta, valor);
    if (!opciones.silencioso) this._notificar(ruta);
  }

  /** Suscribe a cambios de una ruta ('*' = cualquier cambio). Devuelve función de baja. */
  suscribir(ruta, fn) {
    const oyente = { ruta, fn };
    this.oyentes.add(oyente);
    return () => this.oyentes.delete(oyente);
  }

  /** Copia serializable del estado (para sincronizar o guardar). */
  instantanea() {
    return clonar(this.datos);
  }

  /** Reemplaza todo el estado por una instantánea y notifica globalmente. */
  aplicar(instantanea) {
    this.datos = clonar(instantanea);
    this._notificar('*');
  }

  /** Restablece la configuración de fábrica para un tipo de paciente (conserva encendido). */
  reiniciar(tipo) {
    const encendido = this.datos.sistema.encendido;
    this.datos = crearEstadoInicial(tipo);
    this.datos.sistema.encendido = encendido;
    this._notificar('*');
  }

  _notificar(ruta) {
    for (const o of this.oyentes) {
      if (o.ruta === '*' || ruta === '*' || ruta.startsWith(o.ruta) || o.ruta.startsWith(ruta)) {
        try {
          o.fn(this.obtener(o.ruta === '*' ? undefined : o.ruta), ruta);
        } catch (e) {
          console.error('Error en oyente de estado', o.ruta, e);
        }
      }
    }
  }
}

/** Instancia única usada por toda la aplicación. */
export const estado = new Estado(crearEstadoInicial('ADU'));
