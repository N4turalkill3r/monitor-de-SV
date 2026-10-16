/**
 * @file escenarios-datos.js
 * @description Escenarios clínicos predefinidos (no arrítmicos): conjunto de valores del
 * estado que se aplican de una vez. Los casos con ritmo/ECG están en docencia/casos.js.
 *
 * Se ejecuta en: AMBOS (sólo datos). Cada escenario: { nombre, descripcion, set:{ruta:valor} }.
 */
export const ESCENARIOS = [
  { nombre: 'Paciente estable', descripcion: 'Adulto sano en reposo.', set: { 'ecg.ritmo': 'sinusal', 'vitales.hr': 75, 'vitales.spo2': 98, 'vitales.sys': 120, 'vitales.dia': 80, 'vitales.rr': 16, 'vitales.t1': 36.8, 'vitales.etco2': 38, 'vitales.perfusion': 70, 'ecg.pulso': 'auto' } },
  { nombre: 'Shock hipovolémico', descripcion: 'Hemorragia: taquicardia, hipotensión, taquipnea, mala perfusión.', set: { 'ecg.ritmo': 'taquicardia_sinusal', 'vitales.hr': 135, 'vitales.spo2': 94, 'vitales.sys': 78, 'vitales.dia': 45, 'vitales.rr': 28, 'vitales.perfusion': 18, 'vitales.etco2': 28, 'vitales.t1': 35.9 } },
  { nombre: 'Sepsis', descripcion: 'Fiebre, taquicardia, hipotensión y taquipnea.', set: { 'ecg.ritmo': 'taquicardia_sinusal', 'vitales.hr': 125, 'vitales.spo2': 93, 'vitales.sys': 85, 'vitales.dia': 48, 'vitales.rr': 30, 'vitales.t1': 39.4, 'vitales.t2': 39.0, 'vitales.perfusion': 30, 'vitales.etco2': 29 } },
  { nombre: 'Hipoxia progresiva', descripcion: 'Desaturación con taquicardia y taquipnea.', set: { 'ecg.ritmo': 'taquicardia_sinusal', 'vitales.hr': 118, 'vitales.spo2': 82, 'vitales.sys': 150, 'vitales.dia': 95, 'vitales.rr': 32, 'vitales.etco2': 33 } },
  { nombre: 'Crisis asmática / broncoespasmo', descripcion: 'Taquicardia, SpO2 baja y capnograma en aleta de tiburón.', set: { 'ecg.ritmo': 'taquicardia_sinusal', 'vitales.hr': 125, 'vitales.spo2': 88, 'vitales.sys': 140, 'vitales.dia': 85, 'vitales.rr': 34, 'co2.patron': 'broncoespasmo', 'vitales.etco2': 45, 'vitales.awrr': 34, 'modulos.co2': true } },
  { nombre: 'Depresión respiratoria (opioides)', descripcion: 'Bradipnea, hipercapnia y desaturación.', set: { 'ecg.ritmo': 'bradicardia_sinusal', 'vitales.hr': 52, 'vitales.spo2': 86, 'vitales.sys': 100, 'vitales.dia': 60, 'vitales.rr': 6, 'vitales.etco2': 62, 'vitales.awrr': 6, 'modulos.co2': true } },
  { nombre: 'Hipotermia', descripcion: 'Temperatura baja con bradicardia.', set: { 'ecg.ritmo': 'bradicardia_sinusal', 'vitales.hr': 48, 'vitales.t1': 32.0, 'vitales.t2': 31.6, 'vitales.sys': 95, 'vitales.dia': 60, 'vitales.rr': 10, 'vitales.spo2': 94 } },
  { nombre: 'Hipertermia / golpe de calor', descripcion: 'Fiebre alta, taquicardia y taquipnea.', set: { 'ecg.ritmo': 'taquicardia_sinusal', 'vitales.hr': 140, 'vitales.t1': 41.0, 'vitales.t2': 40.5, 'vitales.sys': 100, 'vitales.dia': 55, 'vitales.rr': 30, 'vitales.spo2': 95 } },
  { nombre: 'Neonato estable', descripcion: 'Recién nacido a término (cambia a categoría neonatal).', set: { 'paciente.tipo': 'NEO', 'vitales.hr': 140, 'vitales.spo2': 96, 'vitales.sys': 70, 'vitales.dia': 45, 'vitales.rr': 40, 'ecg.ritmo': 'sinusal' } },
  { nombre: 'Parada cardiorrespiratoria', descripcion: 'Sin pulso, apnea y asistolia (valores a cero).', set: { 'ecg.ritmo': 'asistolia', 'ecg.pulso': 'no', 'resp.apnea': true, 'vitales.hr': 0, 'vitales.spo2': 0, 'vitales.sys': 0, 'vitales.dia': 0, 'vitales.rr': 0, 'vitales.etco2': 0, 'vitales.perfusion': 0 } },
];
