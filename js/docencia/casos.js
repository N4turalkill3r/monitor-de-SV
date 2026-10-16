/**
 * @file casos.js
 * @description Casos clínicos predefinidos para el simulador de arritmias. Cada caso fija
 * ritmo, frecuencia, eje, patrón de isquemia, hipertrofia, constantes vitales y una viñeta
 * clínica. El instructor los carga con un clic o los usa en el modo quiz.
 *
 * Se ejecuta en: AMBOS (sólo datos). Campos:
 *  ritmo, hr, eje, patron, st (mV), hipertrofia, opciones, vitales {sys,dia,spo2,rr,...},
 *  pulso ('auto'|'si'|'no'), clinica, objetivo (qué debe reconocer el alumno), dx (diagnóstico).
 */
export const CASOS = [
  {
    id: 'normal', nombre: 'ECG normal', dx: 'Ritmo sinusal normal', ritmo: 'sinusal', hr: 75, eje: 60, patron: 'ninguno', st: 0, hipertrofia: 'ninguna',
    vitales: { sys: 120, dia: 80, spo2: 98, rr: 16 }, clinica: 'Mujer de 30 años, revisión rutinaria, asintomática.', objetivo: 'Aplicar F-R-I-E-H-I a un ECG normal.',
  },
  {
    id: 'iam_inf', nombre: 'IAM inferior', dx: 'Infarto agudo con elevación del ST inferior', ritmo: 'sinusal', hr: 52, eje: 50, patron: 'iam_inferior', st: 0.3, hipertrofia: 'ninguna',
    vitales: { sys: 95, dia: 60, spo2: 94, rr: 20 }, clinica: 'Varón de 58 años con dolor torácico opresivo irradiado a mandíbula, sudoración y náuseas desde hace 40 minutos.',
    objetivo: 'Elevación del ST en II, III y aVF con descenso recíproco en I y aVL. Vigilar bradicardia/BAV y no dar nitratos si se sospecha afectación del VD o hipotensión.',
  },
  {
    id: 'iam_ant', nombre: 'IAM anterior', dx: 'Infarto agudo con elevación del ST anterior', ritmo: 'sinusal', hr: 98, eje: 40, patron: 'iam_anterior', st: 0.35, hipertrofia: 'ninguna',
    vitales: { sys: 100, dia: 65, spo2: 93, rr: 22 }, clinica: 'Varón de 62 años, diabético, dolor precordial intenso de 1 hora de evolución y disnea.',
    objetivo: 'Elevación del ST de V1 a V4 con ondas Q. Territorio de la descendente anterior: alto riesgo de TV/FV y shock cardiogénico.',
  },
  {
    id: 'iam_post', nombre: 'IAM posterior', dx: 'Infarto posterior (descenso ST V1–V3)', ritmo: 'sinusal', hr: 80, eje: 60, patron: 'iam_posterior', st: 0.25, hipertrofia: 'ninguna',
    vitales: { sys: 125, dia: 80, spo2: 96, rr: 18 }, clinica: 'Mujer de 66 años con dolor torácico atípico y malestar desde hace 2 horas.',
    objetivo: 'Descenso del ST y T alta en V1–V3: imagen en espejo de la elevación posterior. Registrar V7–V9.',
  },
  {
    id: 'hvi', nombre: 'Hipertrofia ventricular izquierda', dx: 'HVI con sobrecarga (strain)', ritmo: 'sinusal', hr: 68, eje: -20, patron: 'ninguno', st: 0, hipertrofia: 'HVI',
    vitales: { sys: 175, dia: 100, spo2: 97, rr: 16 }, clinica: 'Varón de 64 años hipertenso de larga evolución, disnea de esfuerzo.',
    objetivo: 'Voltajes altos (R en V5–V6, S en V1–V2), eje izquierdo y ST descendido con T negativa en precordiales izquierdas.',
  },
  {
    id: 'hvd', nombre: 'Hipertrofia ventricular derecha', dx: 'HVD con desviación del eje a la derecha', ritmo: 'sinusal', hr: 88, eje: 115, patron: 'ninguno', st: 0, hipertrofia: 'HVD',
    vitales: { sys: 110, dia: 70, spo2: 91, rr: 22 }, clinica: 'Mujer de 45 años con disnea progresiva e hipertensión pulmonar.',
    objetivo: 'Eje a la derecha, R dominante en V1 (R/S > 1), S profunda en V5–V6.',
  },
  {
    id: 'bri', nombre: 'Bloqueo de rama izquierda', dx: 'Bloqueo completo de rama izquierda', ritmo: 'bri', hr: 72, eje: -20, patron: 'ninguno', st: 0, hipertrofia: 'ninguna',
    vitales: { sys: 130, dia: 80, spo2: 96, rr: 16 }, clinica: 'Varón de 70 años con disnea y fatiga. QRS ancho en monitor.', objetivo: 'QRS ≥ 0.12 s, QS en V1, R empastada sin q en I, aVL, V5–V6.',
  },
  {
    id: 'brd', nombre: 'Bloqueo de rama derecha', dx: 'Bloqueo completo de rama derecha', ritmo: 'brd', hr: 76, eje: 100, patron: 'ninguno', st: 0, hipertrofia: 'ninguna',
    vitales: { sys: 118, dia: 76, spo2: 95, rr: 18 }, clinica: 'Mujer de 55 años con disnea súbita tras un vuelo largo.', objetivo: 'rsR\' en V1, S ancha en I y V6. Considerar embolia pulmonar si es de aparición aguda.',
  },
  {
    id: 'hbai', nombre: 'Hemibloqueo anterior izquierdo', dx: 'HBAI (eje muy izquierdo, QRS < 0.12 s)', ritmo: 'sinusal', hr: 70, eje: -55, patron: 'ninguno', st: 0, hipertrofia: 'ninguna', opciones: { qrs: 0.1 },
    vitales: { sys: 125, dia: 80, spo2: 97, rr: 16 }, clinica: 'Varón de 68 años asintomático con ECG de control.', objetivo: 'Eje más negativo de −45°, qR en I y aVL, rS en II, III y aVF, QRS estrecho.',
  },
  {
    id: 'fa_rapida', nombre: 'FA con respuesta ventricular rápida', dx: 'Fibrilación auricular rápida', ritmo: 'fa', hr: 140, eje: 60, patron: 'ninguno', st: 0, hipertrofia: 'ninguna',
    vitales: { sys: 105, dia: 70, spo2: 94, rr: 24, perfusion: 40 }, clinica: 'Mujer de 74 años con palpitaciones y mareo desde esta mañana.',
    objetivo: 'R-R irregularmente irregular, ausencia de P. Comparar la FC del ECG con la FP del pulsioxímetro (déficit de pulso).',
  },
  {
    id: 'flutter21', nombre: 'Flúter auricular 2:1', dx: 'Flúter auricular con conducción 2:1', ritmo: 'flutter', hr: 150, eje: 60, patron: 'ninguno', st: 0, hipertrofia: 'ninguna', opciones: { ratio: '2', fcAur: 300 },
    vitales: { sys: 110, dia: 70, spo2: 95, rr: 20 }, clinica: 'Varón de 60 años con EPOC y palpitaciones. FC fija en 150 lpm.', objetivo: 'Sospechar flúter 2:1 ante una FC fija de ~150 lpm; buscar los dientes de sierra en II, III y aVF.',
  },
  {
    id: 'tsv', nombre: 'Taquicardia supraventricular', dx: 'TSV por reentrada', ritmo: 'tsv', hr: 190, eje: 60, patron: 'ninguno', st: 0, hipertrofia: 'ninguna',
    vitales: { sys: 100, dia: 60, spo2: 97, rr: 24 }, clinica: 'Mujer de 28 años con palpitaciones súbitas que comenzaron "de golpe" hace 20 minutos.',
    objetivo: 'QRS estrecho, regular, a ~190 lpm, sin P visible. Maniobras vagales y adenosina 6–12 mg si está estable.',
  },
  {
    id: 'tv_pulso', nombre: 'TV monomorfa con pulso', dx: 'Taquicardia ventricular con pulso', ritmo: 'tv', hr: 170, eje: -60, patron: 'ninguno', st: 0, hipertrofia: 'ninguna', pulso: 'auto',
    vitales: { sys: 78, dia: 45, spo2: 92, rr: 26, perfusion: 25 }, clinica: 'Varón de 66 años con infarto previo, mareo intenso, sudoración y TA 78/45. Está consciente pero confuso.',
    objetivo: 'QRS ancho regular y rápido: asumir TV. Paciente inestable → cardioversión sincronizada.',
  },
  {
    id: 'fv', nombre: 'Parada por FV', dx: 'Fibrilación ventricular', ritmo: 'fv', hr: 0, eje: 60, patron: 'ninguno', st: 0, hipertrofia: 'ninguna', pulso: 'no',
    vitales: { sys: 0, dia: 0, spo2: 0, rr: 0, perfusion: 0 }, clinica: 'Varón de 55 años que se desploma en la calle: inconsciente, sin pulso, no respira.',
    objetivo: 'RCP inmediata y desfibrilación lo antes posible (ritmo desfibrilable).',
  },
  {
    id: 'asistolia', nombre: 'Parada por asistolia', dx: 'Asistolia', ritmo: 'asistolia', hr: 0, eje: 60, patron: 'ninguno', st: 0, hipertrofia: 'ninguna', pulso: 'no',
    vitales: { sys: 0, dia: 0, spo2: 0, rr: 0, perfusion: 0 }, clinica: 'Paciente encontrado inconsciente en cama, sin pulso. Línea plana en el monitor.',
    objetivo: 'Verificar electrodos y ganancia; RCP + adrenalina; NO desfibrilar; buscar causas reversibles (5H y 5T).',
  },
  {
    id: 'aesp', nombre: 'AESP', dx: 'Actividad eléctrica sin pulso', ritmo: 'aesp', hr: 45, eje: 60, patron: 'ninguno', st: 0, hipertrofia: 'ninguna', pulso: 'no',
    vitales: { sys: 0, dia: 0, spo2: 0, rr: 0, perfusion: 0 }, clinica: 'Politraumatizado con hemorragia, pierde el pulso. El monitor muestra complejos lentos.',
    objetivo: 'Complejos en el ECG pero sin pulso (el pletismograma desaparece). RCP, adrenalina y tratar la causa (hipovolemia).',
  },
  {
    id: 'bav3', nombre: 'Bloqueo AV completo sintomático', dx: 'BAV de 3.er grado con escape ventricular', ritmo: 'bav3', hr: 32, eje: 60, patron: 'ninguno', st: 0, hipertrofia: 'ninguna', opciones: { fcP: 85, escape: 'ventricular' },
    vitales: { sys: 82, dia: 48, spo2: 93, rr: 20, perfusion: 30 }, clinica: 'Mujer de 80 años con síncope y mareo. Pulso 32 lpm.',
    objetivo: 'P y QRS disociados con QRS lento. Atropina 1 mg mientras se prepara el marcapasos transcutáneo.',
  },
  {
    id: 'mobitz2', nombre: 'BAV Mobitz II', dx: 'Bloqueo AV de 2.º grado Mobitz II', ritmo: 'mobitz2', hr: 75, eje: 40, patron: 'ninguno', st: 0, hipertrofia: 'ninguna', opciones: { n: 3, pr: 0.2 },
    vitales: { sys: 105, dia: 65, spo2: 95, rr: 18 }, clinica: 'Varón de 72 años con infarto anterior reciente y episodios de mareo.', objetivo: 'PR constante con P bloqueada 3:1: alto riesgo de progresar a BAV completo.',
  },
  {
    id: 'hiperk', nombre: 'Hiperpotasemia grave', dx: 'Hiperpotasemia con ensanchamiento del QRS', ritmo: 'hiperk', hr: 55, eje: 60, patron: 'ninguno', st: 0, hipertrofia: 'ninguna', opciones: { k: 7.8 },
    vitales: { sys: 95, dia: 55, spo2: 96, rr: 20 }, clinica: 'Paciente en diálisis que faltó a su sesión, con debilidad muscular y bradicardia.', objetivo: 'T picudas, P plana y QRS ancho. Gluconato de calcio IV como cardioprotector.',
  },
  {
    id: 'wpw', nombre: 'Síndrome de WPW', dx: 'Preexcitación ventricular', ritmo: 'wpw', hr: 78, eje: 30, patron: 'ninguno', st: 0, hipertrofia: 'ninguna',
    vitales: { sys: 120, dia: 75, spo2: 98, rr: 16 }, clinica: 'Varón de 22 años con episodios de palpitaciones. ECG basal en ritmo sinusal.', objetivo: 'PR corto y onda delta. Evitar bloqueadores AV si hay FA preexcitada.',
  },
  {
    id: 'torsades', nombre: 'Torsades de pointes', dx: 'TV polimorfa tipo torsades', ritmo: 'torsades', hr: 230, eje: 60, patron: 'ninguno', st: 0, hipertrofia: 'ninguna',
    vitales: { sys: 70, dia: 40, spo2: 90, rr: 26, perfusion: 15 }, clinica: 'Mujer de 50 años en tratamiento con un macrólido y un diurético, con síncopes repetidos. QT largo previo.',
    objetivo: 'Husos de amplitud con giro de QRS: sulfato de magnesio 1–2 g IV; desfibrilar si pierde el pulso.',
  },
  {
    id: 'pericarditis', nombre: 'Pericarditis aguda', dx: 'Pericarditis (ST cóncavo difuso)', ritmo: 'sinusal', hr: 95, eje: 55, patron: 'pericarditis', st: 0.2, hipertrofia: 'ninguna',
    vitales: { sys: 122, dia: 78, spo2: 97, rr: 20, t1: 38.1 }, clinica: 'Varón de 30 años con dolor torácico que mejora al inclinarse hacia delante, febrícula y roce pericárdico.',
    objetivo: 'Elevación difusa y cóncava del ST sin imagen en espejo (excepto aVR). Diferenciar del IAM.',
  },
];

/** Busca un caso por id. */
export const casoPorId = (id) => CASOS.find((c) => c.id === id);
