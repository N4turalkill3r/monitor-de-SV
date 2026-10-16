/**
 * @file definicion-menus.js
 * @description Definición DECLARATIVA de los ajustes del monitor (menús de ECG, RESP,
 * SpO2, PANI, TEMP, CO2, sistema...). Es la fuente única: la usan tanto los menús del
 * monitor (dialogos.js) como el panel del instructor, para que el instructor pueda
 * cambiar exactamente lo mismo que se cambia en el monitor real.
 *
 * Se ejecuta en: AMBOS. Sólo datos y funciones auxiliares (sin DOM).
 */
import { estado, crearLimites, emitir } from '../core/estado.js';
import { VITALES_POR_DEFECTO, DERIVACIONES, GANANCIAS_ECG, VELOCIDADES, FILTROS_ECG, TIEMPOS_APNEA, TIEMPOS_PAUSA_ALARMA, INTERVALOS_NIBP, TIPOS_PACIENTE, RANGOS, UNIDADES, ETIQUETAS_ALARMA } from '../core/config.js';

/** Derivaciones disponibles según el tipo de cable (3, 5 o 12). */
export function derivacionesPermitidas() {
  const t = estado.obtener('ecg.tipoDerivaciones');
  if (t === '3') return ['I', 'II', 'III'];
  if (t === '5') return ['I', 'II', 'III', 'aVR', 'aVL', 'aVF', 'V'];
  return DERIVACIONES;
}

/** Cambia el tipo de paciente: restablece vitales y límites de alarma de la categoría. */
export function cambiarTipoPaciente(tipo) {
  estado.fijar('paciente.tipo', tipo);
  const v = VITALES_POR_DEFECTO[tipo];
  for (const [k, val] of Object.entries(v)) estado.fijar(`vitales.${k}`, val);
  estado.fijar('alarmas.limites', crearLimites(tipo));
  estado.fijar('ecg.ritmo', 'sinusal');
  estado.fijar('ecg.opciones', {});
  emitir('motor:reiniciar');
}

const OPC_ON_OFF = [[true, 'Sí'], [false, 'No']];

/** Items de cada menú (se evalúan al abrir para tomar valores actuales). */
export const MENUS = {
  ecg: () => [
    { etiqueta: 'Tipo de derivaciones', ruta: 'ecg.tipoDerivaciones', opciones: [['3', '3 derivaciones'], ['5', '5 derivaciones'], ['12', '12 derivaciones']], alCambiar: () => estado.fijar('ecg.derivaciones', ['II', estado.obtener('ecg.tipoDerivaciones') === '3' ? 'I' : estado.obtener('ecg.tipoDerivaciones') === '5' ? 'V' : 'V1']) },
    { etiqueta: 'Derivación 1', ruta: 'ecg.derivaciones.0', opciones: derivacionesPermitidas() },
    { etiqueta: 'Derivación 2', ruta: 'ecg.derivaciones.1', opciones: derivacionesPermitidas() },
    { etiqueta: 'Ganancia', ruta: 'ecg.ganancia', opciones: Object.keys(GANANCIAS_ECG) },
    { etiqueta: 'Filtro', ruta: 'ecg.filtro', opciones: FILTROS_ECG },
    { etiqueta: 'Velocidad (mm/s)', ruta: 'ecg.velocidad', opciones: VELOCIDADES },
    { etiqueta: 'Análisis del ST', ruta: 'ecg.stAnalisis', tipo: 'bool' },
    { etiqueta: 'Electrodo V (precordial)', ruta: 'ecg.derV', opciones: ['V1', 'V2', 'V3', 'V4', 'V5', 'V6'] },
    { etiqueta: 'Paciente con marcapasos', ruta: 'paciente.marcapasos', tipo: 'bool' },
  ],
  resp: () => [
    { etiqueta: 'Amplitud', ruta: 'resp.amplitud', opciones: [[0.25, 'x0.25'], [0.5, 'x0.5'], [1, 'x1'], [2, 'x2'], [4, 'x4']] },
    { etiqueta: 'Tiempo de apnea (s)', ruta: 'resp.tiempoApnea', opciones: TIEMPOS_APNEA },
  ],
  spo2: () => [
    { etiqueta: 'Tono de pulso (SpO₂)', ruta: 'spo2.tono', tipo: 'bool' },
    { etiqueta: 'Sensibilidad', ruta: 'spo2.sensibilidad', opciones: { alta: 'Alta', media: 'Media', baja: 'Baja' } },
  ],
  nibp: () => [
    { etiqueta: 'Modo', ruta: 'nibp.modo', opciones: { manual: 'Manual', auto: 'Automático' } },
    { etiqueta: 'Intervalo automático (min)', ruta: 'nibp.intervalo', opciones: INTERVALOS_NIBP },
    { etiqueta: 'Iniciar medición', tipo: 'boton', accion: () => emitir('nibp:iniciar', { id: Date.now() }) },
    { etiqueta: 'Cancelar medición', tipo: 'boton', accion: () => emitir('nibp:cancelar') },
  ],
  temp: () => [{ etiqueta: 'Unidad', ruta: () => '°C', tipo: 'select', opciones: ['°C'] }],
  co2: () => [{ etiqueta: 'Forma del capnograma', ruta: 'co2.patron', opciones: { normal: 'Normal', broncoespasmo: 'Broncoespasmo (aleta de tiburón)', rebreathing: 'Reinhalación' } }],
  sistema: () => [
    { etiqueta: 'Brillo (1-10)', ruta: 'sistema.brillo', tipo: 'rango', min: 1, max: 10 },
    { etiqueta: 'Volumen de alarma (1-5)', ruta: 'sistema.volAlarma', tipo: 'rango', min: 1, max: 5 },
    { etiqueta: 'Volumen de latido (0-5)', ruta: 'sistema.volLatido', tipo: 'rango', min: 0, max: 5 },
    { etiqueta: 'Volumen de teclas (0-5)', ruta: 'sistema.volTeclas', tipo: 'rango', min: 0, max: 5 },
    { etiqueta: 'Silenciar audio de ESTA ventana', ruta: 'sistema.silencioLocal', tipo: 'bool' },
    { etiqueta: 'Alimentación por CA', ruta: 'sistema.conAC', tipo: 'bool' },
    { etiqueta: 'Batería (%)', ruta: 'sistema.bateria', tipo: 'num', min: 0, max: 100, paso: 5 },
  ],
  paciente: () => [
    { etiqueta: 'Nombre', ruta: 'paciente.nombre', tipo: 'texto' },
    { etiqueta: 'N.º de historia', ruta: 'paciente.mrn', tipo: 'texto' },
    { etiqueta: 'Sexo', ruta: 'paciente.sexo', opciones: ['N/D', 'Masculino', 'Femenino'] },
    { etiqueta: 'Edad (años)', ruta: 'paciente.edad', tipo: 'num', min: 0, max: 120 },
    { etiqueta: 'Estatura (cm)', ruta: 'paciente.altura', tipo: 'num', min: 20, max: 230 },
    { etiqueta: 'Peso (kg)', ruta: 'paciente.peso', tipo: 'num', min: 1, max: 250 },
    { etiqueta: 'Cama', ruta: 'paciente.cama', tipo: 'texto' },
    { etiqueta: 'Departamento', ruta: 'paciente.departamento', tipo: 'texto' },
    { etiqueta: 'Tipo de paciente', ruta: () => estado.obtener('paciente.tipo'), opciones: TIPOS_PACIENTE, alCambiar: (v) => cambiarTipoPaciente(v) },
  ],
};

/** Módulos de medición (interruptores de módulos). */
export const MODULOS = [
  ['ecg', 'ECG / FC'], ['resp', 'Respiración'], ['spo2', 'SpO₂ / FP'], ['nibp', 'PANI'], ['temp', 'Temperatura'], ['co2', 'CO₂ (capnografía)'], ['ibp', 'Presión arterial invasiva (ART)'],
];

/** Items de vitales editables por el instructor (valores objetivo con su rango). */
export function itemsVitales() {
  const def = (k, etiqueta, extra = {}) => ({ etiqueta, ruta: `vitales.${k}`, tipo: 'num', min: RANGOS[k]?.min ?? 0, max: RANGOS[k]?.max ?? 300, unidad: UNIDADES[k], ...extra });
  return [
    def('hr', 'Frecuencia cardíaca objetivo', { min: 15, max: 300 }),
    def('spo2', 'SpO₂'),
    def('perfusion', 'Índice de perfusión (%)', { min: 0, max: 100, unidad: '%' }),
    def('sys', 'PANI sistólica', { min: 30, max: 270 }),
    def('dia', 'PANI diastólica', { min: 10, max: 215 }),
    def('rr', 'Frecuencia respiratoria'),
    def('t1', 'Temperatura T1', { paso: 0.1, min: 20, max: 45 }),
    def('t2', 'Temperatura T2', { paso: 0.1, min: 20, max: 45 }),
    def('etco2', 'EtCO₂'),
    def('fico2', 'FiCO₂', { min: 0, max: 20 }),
    def('awrr', 'FR de vía aérea'),
    def('artSys', 'ART sistólica', { min: 0, max: 300 }),
    def('artDia', 'ART diastólica', { min: 0, max: 300 }),
  ];
}

/** Claves de límites de alarma que pertenecen a un módulo dado. */
export const PARAMETROS_ALARMA = Object.keys(ETIQUETAS_ALARMA);
export { TIEMPOS_PAUSA_ALARMA, OPC_ON_OFF };
