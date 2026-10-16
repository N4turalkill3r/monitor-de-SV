/**
 * @file config.js
 * @description Constantes y valores por defecto del simulador.
 *
 * Se ejecuta en: AMBOS (monitor y panel del instructor). No depende del DOM,
 * por lo que también puede importarse desde pruebas en Node.
 *
 * Los valores por defecto provienen del Apéndice C ("Default Settings") y del
 * capítulo 5.4 ("Adjustable Range of Alarm Limits") del manual del monitor.
 */

/** Versión de la aplicación (se usa también para invalidar la caché del Service Worker). */
export const VERSION_APP = '1.0.0';

/** Frecuencia de muestreo de las formas de onda (muestras por segundo). */
export const FS = 250;

/** Duración (segundos) del historial de ondas que se conserva en memoria. */
export const SEGUNDOS_BUFER = 30;

/** Tipos de paciente soportados por el monitor (Adulto, Pediátrico, Neonato). */
export const TIPOS_PACIENTE = {
  ADU: 'Adulto',
  PED: 'Pediátrico',
  NEO: 'Neonato',
};

/** Colores de parámetros y ondas (esquema similar al del monitor real). */
export const COLORES = {
  ecg: '#18ff3a',
  spo2: '#19e6ff',
  resp: '#ffe600',
  nibp: '#ffffff',
  temp: '#ff9d2e',
  co2: '#ffd34d',
  ibp: '#ff3b3b',
  cvp: '#5aa0ff',
  alarmaAlta: '#ff1c1c',
  alarmaMedia: '#ffd400',
  alarmaBaja: '#19e6ff',
};

/** Derivaciones de ECG que el monitor puede mostrar (plano frontal y precordial). */
export const DERIVACIONES = ['I', 'II', 'III', 'aVR', 'aVL', 'aVF', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6'];

/** Opciones de ganancia de ECG (manual 8.3.1): factor -> mm por mV. */
export const GANANCIAS_ECG = {
  'x0.125': 1.25,
  'x0.25': 2.5,
  'x0.5': 5,
  x1: 10,
  x2: 20,
  x4: 40,
  Auto: 0, // 0 = automática
};

/** Velocidades de barrido disponibles (mm/s). */
export const VELOCIDADES = [6.25, 12.5, 25, 50];

/** Filtros de ECG (manual 8.3.2). */
export const FILTROS_ECG = {
  monitor: 'Monitor',
  cirugia: 'Cirugía',
  diagnostico: 'Diagnóstico',
};

/** Tiempos de apnea configurables (s). Por defecto 20 s. */
export const TIEMPOS_APNEA = [10, 15, 20, 25, 30, 35, 40];

/** Tiempos de pausa temporal de alarma (s). Por defecto 120 s. */
export const TIEMPOS_PAUSA_ALARMA = [60, 120, 180];

/** Intervalos del modo automático de PANI (minutos). */
export const INTERVALOS_NIBP = [1, 2, 3, 4, 5, 10, 15, 30, 60, 90, 120, 240, 480];

/**
 * Valores vitales iniciales por tipo de paciente.
 * (Elegidos dentro de los rangos normales de cada categoría.)
 */
export const VITALES_POR_DEFECTO = {
  ADU: { hr: 75, spo2: 98, perfusion: 70, sys: 120, dia: 80, rr: 16, t1: 36.8, t2: 36.5, etco2: 38, fico2: 0, awrr: 16 },
  PED: { hr: 100, spo2: 98, perfusion: 65, sys: 100, dia: 60, rr: 22, t1: 36.8, t2: 36.5, etco2: 36, fico2: 0, awrr: 22 },
  NEO: { hr: 140, spo2: 96, perfusion: 55, sys: 70, dia: 45, rr: 40, t1: 36.8, t2: 36.5, etco2: 40, fico2: 0, awrr: 40 },
};

/**
 * Límites de alarma por defecto (Apéndice C del manual).
 * Cada entrada: [bajo, alto] por tipo de paciente. Nivel por defecto: media.
 */
const L = (adu, ped, neo) => ({ ADU: adu, PED: ped, NEO: neo });
export const LIMITES_POR_DEFECTO = {
  hr: L([50, 120], [75, 160], [100, 200]),
  pr: L([50, 120], [75, 160], [100, 200]),
  spo2: L([90, 100], [90, 100], [88, 95]),
  rr: L([8, 30], [8, 30], [30, 100]),
  sys: L([90, 160], [70, 120], [40, 90]),
  dia: L([50, 90], [40, 70], [20, 60]),
  map: L([60, 110], [50, 90], [30, 70]),
  t1: L([36, 39], [36, 39], [36, 39]),
  t2: L([36, 39], [36, 39], [36, 39]),
  td: L([0, 2], [0, 2], [0, 2]),
  etco2: L([15, 50], [20, 50], [30, 45]),
  fico2: L([0, 4], [0, 4], [0, 4]),
  awrr: L([8, 30], [8, 30], [30, 100]),
  artSys: L([90, 160], [90, 160], [90, 160]),
  artDia: L([50, 90], [50, 90], [50, 90]),
  artMap: L([70, 110], [70, 110], [70, 110]),
};

/** Etiquetas legibles de cada alarma fisiológica con límites. */
export const ETIQUETAS_ALARMA = {
  hr: 'FC',
  pr: 'FP',
  spo2: 'SpO2',
  rr: 'FR',
  sys: 'PANI SIS',
  dia: 'PANI DIA',
  map: 'PANI PAM',
  t1: 'T1',
  t2: 'T2',
  td: 'TD',
  etco2: 'EtCO2',
  fico2: 'FiCO2',
  awrr: 'FRva',
  artSys: 'ART SIS',
  artDia: 'ART DIA',
  artMap: 'ART PAM',
};

/** Unidades de cada parámetro (para el panel del instructor). */
export const UNIDADES = {
  hr: 'lpm', pr: 'lpm', spo2: '%', rr: 'rpm', sys: 'mmHg', dia: 'mmHg', map: 'mmHg',
  t1: '°C', t2: '°C', td: '°C', etco2: 'mmHg', fico2: 'mmHg', awrr: 'rpm',
  artSys: 'mmHg', artDia: 'mmHg', artMap: 'mmHg',
};

/** Rangos absolutos ajustables (capítulo 5.4 del manual). */
export const RANGOS = {
  hr: { min: 15, max: 300 },
  pr: { min: 30, max: 300 },
  spo2: { min: 0, max: 100 },
  rr: { min: 0, max: 120 },
  sys: { min: 40, max: 270 },
  dia: { min: 10, max: 215 },
  map: { min: 20, max: 235 },
  t1: { min: 0, max: 50 },
  t2: { min: 0, max: 50 },
  td: { min: 0, max: 50 },
  etco2: { min: 0, max: 150 },
  fico2: { min: 0, max: 50 },
  awrr: { min: 0, max: 150 },
  artSys: { min: 0, max: 300 },
  artDia: { min: 0, max: 300 },
  artMap: { min: 0, max: 300 },
};

/** Prioridades de alarma. El orden numérico sirve para comparar severidad. */
export const NIVELES = { baja: 1, media: 2, alta: 3 };

/** Símbolos que muestra el monitor en el área de alarmas según prioridad (manual 4.2). */
export const SIMBOLOS_NIVEL = { alta: '***', media: '**', baja: '*' };

/** Contraseña del menú de mantenimiento (según el manual). */
export const CLAVE_MANTENIMIENTO = 'ABC';

/** Nombre del canal de comunicación entre la ventana del instructor y la de proyección. */
export const CANAL_SINCRONIZACION = 'monitor-paramedicos-sync';

/**
 * Alarmas de arritmia (manual, cap. 8.11.1 y Apéndice C.3). Las 16 son configurables.
 * `nivel` = prioridad por defecto; `txt` = texto que muestra el área de alarmas.
 */
export const ALARMAS_ARRITMIA = {
  ASYSTOLE: { txt: 'ASISTOLIA', nivel: 'alta', def: 'Sin QRS durante 4 s consecutivos' },
  VFIB_VTAC: { txt: 'FV/TV', nivel: 'alta', def: 'Onda de fibrilación durante 4 s, o 5 latidos ventriculares seguidos con R-R < 600 ms' },
  R_ON_T: { txt: 'R SOBRE T', nivel: 'media', def: 'ESV aislada con R-R < 1/3 del promedio y pausa compensadora de 1.25×' },
  VT_MAS_2: { txt: 'VT>2', nivel: 'media', def: 'Salva de 3 a 4 ESV consecutivas' },
  COUPLET: { txt: 'PAREADAS', nivel: 'media', def: '2 ESV consecutivas' },
  PVC: { txt: 'ESV', nivel: 'media', def: 'Una ESV aislada entre latidos normales' },
  BIGEMINY: { txt: 'BIGEMINISMO', nivel: 'media', def: 'Bigeminismo ventricular' },
  TRIGEMINY: { txt: 'TRIGEMINISMO', nivel: 'media', def: 'Trigeminismo ventricular' },
  TACHY: { txt: 'TAQUICARDIA', nivel: 'media', def: 'Adulto: 5 QRS con R-R < 0.5 s (120–300 lpm)' },
  BRADY: { txt: 'BRADICARDIA', nivel: 'media', def: 'Adulto: 5 QRS con R-R ≥ 1.5 s (15–40 lpm)' },
  MISSED_BEATS: { txt: 'LATIDOS OMITIDOS', nivel: 'media', def: 'FC<120: sin latido en 1.75× R-R; FC≥120: sin latido en 1 s' },
  IRR: { txt: 'RITMO IRREGULAR', nivel: 'media', def: 'Frecuencia cardíaca irregular' },
  PNC: { txt: 'MARCAPASOS SIN CAPTURA', nivel: 'media', def: 'Tras la espícula no hay QRS en 300 ms' },
  PNP: { txt: 'MARCAPASOS SIN DISPARO', nivel: 'media', def: 'Tras el QRS no hay espícula en 1.75× R-R' },
  VBRADY: { txt: 'BRADICARDIA VENT.', nivel: 'media', def: '5 latidos ventriculares con intervalo > 1000 ms' },
  VENT: { txt: 'RITMO VENTRICULAR', nivel: 'media', def: '5 latidos ventriculares con intervalo de 600 a 1000 ms' },
};

/** Alarmas técnicas (texto, prioridad) que el instructor puede provocar. */
export const ALARMAS_TECNICAS = {
  electrodoDesconectado: { txt: 'ECG ELECTRODO DESCONECTADO', nivel: 'baja' },
  spo2SensorFuera: { txt: 'SPO2 SENSOR DESCONECTADO', nivel: 'baja' },
  nibpManguitoFlojo: { txt: 'PANI MANGUITO FLOJO', nivel: 'baja' },
  nibpFuga: { txt: 'PANI FUGA DE AIRE', nivel: 'baja' },
  co2Oclusion: { txt: 'CO2 OCLUSIÓN DE VÍA', nivel: 'baja' },
  bateriaBaja: { txt: 'BATERÍA BAJA', nivel: 'media' },
  ruidoECG: { txt: 'ECG INTERFERENCIA', nivel: 'baja' },
};
