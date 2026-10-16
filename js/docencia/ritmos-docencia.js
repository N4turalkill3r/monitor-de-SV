/**
 * @file ritmos-docencia.js
 * @description Contenido DOCENTE de cada ritmo, organizado según el protocolo
 * F-R-I (Frecuencia, Ritmo, Intervalos) del curso de ECG. Se muestra en la pestaña
 * "Arritmias" del instructor y alimenta el modo quiz.
 *
 * Se ejecuta en: AMBOS (sólo datos).
 *
 * Nota: las pautas de manejo son un RESUMEN DOCENTE basado en las guías ACLS/AHA
 * (adulto). Deben adaptarse al protocolo local y a la valoración clínica del paciente.
 */

/**
 * Estructura de cada entrada:
 *  f: frecuencia · r: ritmo (regularidad/origen) · p: onda P · pr · qrs · qt
 *  claves: signos que permiten reconocerlo · causas · manejo (pasos)
 *  grave: true si es ritmo de parada o potencialmente letal
 */
export const DOCENCIA = {
  sinusal: {
    f: '60–100 lpm', r: 'Regular. Origen en el nodo sinusal.', p: 'Positiva en I, II y aVF; negativa en aVR. Una P por cada QRS.', pr: '0.12–0.20 s', qrs: '≤ 0.10 s', qt: '≤ 0.44 s (QTc); < 50 % del R-R',
    claves: ['Toda P va seguida de un QRS', 'R-R constante', 'P positiva en II y negativa en aVR'],
    causas: ['Ritmo normal'], manejo: ['Sin tratamiento. Seguir monitorizando.'],
  },
  bradicardia_sinusal: {
    f: '< 60 lpm', r: 'Regular, sinusal.', p: 'Sinusal normal.', pr: '0.12–0.20 s', qrs: '≤ 0.10 s', qt: 'Prolongado en valor absoluto, normal al corregirlo',
    claves: ['Ritmo sinusal con frecuencia baja'],
    causas: ['Atletas y sueño (normal)', 'Fármacos (β-bloqueantes, digoxina)', 'Hipotiroidismo, hipotermia', 'Aumento de tono vagal', 'Infarto inferior', 'Hipertensión intracraneal'],
    manejo: ['Valorar síntomas y perfusión (hipotensión, alteración del estado mental, dolor torácico, shock).', 'Estable: observar y tratar la causa.', 'Inestable: atropina 1 mg IV (repetir cada 3–5 min, máx. 3 mg); si no responde, marcapasos transcutáneo o perfusión de dopamina/adrenalina.'],
  },
  taquicardia_sinusal: {
    f: '> 100 lpm (habitual 100–160 lpm)', r: 'Regular, sinusal; inicio y fin graduales.', p: 'Sinusal normal (puede fundirse con la T).', pr: 'Se acorta pero normal', qrs: '≤ 0.10 s', qt: 'Se acorta con la frecuencia',
    claves: ['P sinusal visible antes de cada QRS', 'Responde a la causa (fiebre, dolor, hipovolemia...)'],
    causas: ['Fiebre, dolor, ansiedad', 'Hipovolemia/hemorragia', 'Hipoxia', 'Anemia, sepsis', 'Embolia pulmonar', 'Fármacos y estimulantes'],
    manejo: ['Buscar y tratar la causa; no se trata la frecuencia en sí.', 'Evitar cardioversión: es una respuesta fisiológica.'],
  },
  arritmia_sinusal: {
    f: '60–100 lpm, variable', r: 'Irregular en relación con la respiración (se acorta al inspirar).', p: 'Sinusal normal.', pr: '0.12–0.20 s', qrs: '≤ 0.10 s', qt: 'Normal',
    claves: ['Variación fásica del R-R con la respiración', 'P sinusal siempre presente'],
    causas: ['Frecuente y normal en jóvenes y niños'], manejo: ['Sin tratamiento.'],
  },
  pausa_sinusal: {
    f: 'Variable', r: 'Regular con pausas que no son múltiplo del R-R basal.', p: 'Ausente durante la pausa; sinusal cuando reaparece.', pr: 'Normal', qrs: '≤ 0.10 s', qt: 'Normal',
    claves: ['Pausa sin P ni QRS', 'Si hay ritmo de escape, aparece un latido nodal o ventricular tardío'],
    causas: ['Enfermedad del nodo sinusal', 'Aumento vagal', 'Fármacos', 'Isquemia del nodo sinusal'],
    manejo: ['Valorar síntomas (síncope, mareo).', 'Pausas sintomáticas: atropina/marcapasos y derivación a cardiología.'],
  },
  esv: {
    f: 'Del ritmo de base', r: 'Irregular por latidos prematuros; pausa compensadora COMPLETA.', p: 'Ausente o retrógrada, oculta en el QRS.', pr: 'No aplicable en la ESV', qrs: '≥ 0.12 s, empastado, de morfología distinta', qt: 'T discordante (opuesta al QRS)',
    claves: ['QRS ancho prematuro', 'T opuesta al QRS', 'Pausa compensadora completa (R-R A = R-R B)', 'Bigeminismo: N-V-N-V; trigeminismo: N-N-V'],
    causas: ['Cardiopatía isquémica o estructural', 'Hipopotasemia / hipomagnesemia', 'Estimulantes, cafeína, estrés', 'Hipoxia', 'Intoxicación digitálica'],
    manejo: ['Aisladas sin cardiopatía: observación.', 'Frecuentes, en salvas o con isquemia: corregir causa (K⁺, Mg²⁺, oxígeno) y vigilar.', 'Sostenida/inestable: seguir pautas de TV.', 'Vigilar la ESV sobre T (R sobre T): riesgo de TV/FV.'],
  },
  esa: {
    f: 'Del ritmo de base', r: 'Irregular por latidos prematuros; pausa compensadora INCOMPLETA.', p: 'P prematura de morfología distinta a la sinusal.', pr: 'Normal o corto', qrs: '≤ 0.10 s, igual al basal', qt: 'Normal',
    claves: ['QRS estrecho prematuro precedido de una P diferente', 'Pausa compensadora incompleta'],
    causas: ['Normal en muchas personas', 'Cafeína, estrés', 'Valvulopatía, aurícula dilatada', 'EPOC'], manejo: ['Generalmente sin tratamiento; tratar la causa.'],
  },
  fa: {
    f: 'Auricular 400–600 lpm; ventricular variable', r: 'IRREGULARMENTE IRREGULAR (R-R sin patrón).', p: 'Ausente; línea de base oscilante (ondas f).', pr: 'No medible', qrs: '≤ 0.10 s (ancho si hay bloqueo de rama o aberrancia)', qt: 'Difícil de medir (promediar varios latidos)',
    claves: ['Irregularidad total del R-R', 'No hay ondas P', 'Línea de base fibrilatoria', 'Medir la FC contando QRS en 6 s × 10'],
    causas: ['Hipertensión, cardiopatía isquémica', 'Valvulopatía mitral', 'Hipertiroidismo', 'Alcohol, sepsis, postoperatorio', 'Embolia pulmonar'],
    manejo: ['Inestable (hipotensión, shock, dolor torácico, edema pulmonar): cardioversión sincronizada (120–200 J bifásico).', 'Estable: control de frecuencia (diltiazem o β-bloqueante) y valorar anticoagulación según riesgo.', 'Con preexcitación (WPW): evitar bloqueadores AV.', 'Con pulso deficitario: la FP medida por SpO₂ es menor que la FC del ECG.'],
  },
  flutter: {
    f: 'Auricular 250–350 lpm (típica 300); ventricular 150 / 100 / 75 lpm según conducción 2:1 / 3:1 / 4:1', r: 'Regular si la conducción es fija; irregular si es variable.', p: 'Ondas F en dientes de sierra, sobre todo en II, III y aVF.', pr: 'No medible', qrs: '≤ 0.10 s', qt: 'Difícil de medir',
    claves: ['Dientes de sierra sin línea isoeléctrica', 'Una frecuencia fija de ~150 lpm debe hacer sospechar un flúter 2:1', 'Maniobras vagales/adenosina frenan el QRS y revelan las ondas F'],
    causas: ['Cardiopatía estructural', 'EPOC', 'Postoperatorio cardíaco', 'Hipertiroidismo'],
    manejo: ['Inestable: cardioversión sincronizada (50–100 J).', 'Estable: control de frecuencia; valorar anticoagulación y ablación.'],
  },
  tsv: {
    f: '150–250 lpm', r: 'Muy regular; inicio y fin bruscos.', p: 'No visible (dentro del QRS) o falsa r\' / pseudo-S al final.', pr: 'No medible', qrs: '< 0.12 s', qt: 'Descenso del ST por frecuencia',
    claves: ['QRS estrecho y regular a más de 150 lpm', 'No se ven ondas P', 'Comienzo y final súbitos'],
    causas: ['Reentrada intranodal (la más frecuente)', 'Vía accesoria (WPW)', 'Cafeína, estrés'],
    manejo: ['Inestable: cardioversión sincronizada 50–100 J.', 'Estable: maniobras vagales (Valsalva modificada), luego adenosina 6 mg IV rápida y, si no cede, 12 mg.', 'Registrar ECG de 12 derivaciones durante y después del episodio si es posible.'],
  },
  taq_auricular: {
    f: '101–230 lpm', r: 'Regular (o irregular si es multifocal con ≥ 3 morfologías de P).', p: 'P no sinusal ante cada QRS.', pr: 'Habitualmente normal', qrs: '< 0.12 s', qt: 'Normal',
    claves: ['P no sinusal visible', 'En pacientes con patología respiratoria (multifocal)'],
    causas: ['EPOC y patología respiratoria', 'Intoxicación digitálica', 'Cardiopatía estructural'], manejo: ['Tratar la causa; control de frecuencia. Hipoxemia: oxigenar.'],
  },
  nodal: {
    f: '40–60 lpm', r: 'Regular.', p: 'Ausente, invertida antes del QRS o retrógrada después de él.', pr: '< 0.12 s si hay P', qrs: '≤ 0.10 s', qt: 'Normal',
    claves: ['QRS estrecho lento y regular', 'P negativa en la cara inferior o ausente'],
    causas: ['Fallo del nodo sinusal', 'Infarto inferior', 'Digital, β-bloqueantes', 'Aumento vagal'], manejo: ['Valorar perfusión; seguir el algoritmo de bradicardia si es sintomática.'],
  },
  bav1: {
    f: 'La del ritmo sinusal', r: 'Regular.', p: 'Sinusal, una P por QRS.', pr: '> 0.20 s y CONSTANTE', qrs: '≤ 0.10 s', qt: 'Normal',
    claves: ['PR largo y fijo', 'Todas las P conducen'],
    causas: ['Aumento vagal', 'β-bloqueantes, calcioantagonistas, digoxina', 'Infarto inferior', 'Fibrosis degenerativa'], manejo: ['Generalmente sin tratamiento; vigilar progresión si hay infarto o fármacos.'],
  },
  mobitz1: {
    f: 'Ventricular menor que la auricular', r: 'Irregularmente irregular en grupos (R-R se acorta hasta la pausa).', p: 'Una P no conduce tras alargarse progresivamente el PR.', pr: 'Se alarga progresivamente hasta el bloqueo', qrs: '≤ 0.10 s', qt: 'Normal',
    claves: ['PR progresivamente más largo', 'La pausa es menor que el doble del R-R más corto', 'Fenómeno de Wenckebach'],
    causas: ['Aumento vagal', 'Infarto inferior', 'Fármacos'], manejo: ['Suele ser benigno; observar. Si hay síntomas: atropina o marcapasos transitorio.'],
  },
  mobitz2: {
    f: 'Ventricular menor que la auricular', r: 'Regular o con pausas bruscas.', p: 'Algunas P no conducen sin alargamiento previo del PR.', pr: 'CONSTANTE en los latidos conducidos', qrs: 'A menudo ancho (bloqueo infrahisiano)', qt: 'Normal',
    claves: ['PR fijo con P bloqueadas (3:1, 4:1 o variable)', 'Si hay 2 o más P bloqueadas seguidas: bloqueo avanzado'],
    causas: ['Infarto anterior', 'Enfermedad del sistema His-Purkinje', 'Fibrosis'], manejo: ['Riesgo de progresar a BAV completo: preparar marcapasos transcutáneo.', 'La atropina puede ser ineficaz o empeorar el bloqueo infranodal.', 'Derivar a marcapasos definitivo.'],
  },
  bav3: {
    f: 'Auricular normal; ventricular lenta (< 60, a menudo 30–45 lpm)', r: 'Ambos ritmos regulares pero DISOCIADOS.', p: 'Marchan independientes del QRS (P sobre QRS y T).', pr: 'Variable (no hay relación)', qrs: 'Estrecho (escape nodal) o ancho (escape ventricular)', qt: 'Prolongado',
    claves: ['P-P regular y R-R regular, sin relación entre ellos', 'QRS lento de escape'],
    causas: ['Infarto inferior o anterior', 'Fibrosis degenerativa', 'Fármacos', 'Miocarditis'],
    manejo: ['Inestable: marcapasos transcutáneo inmediato; atropina 1 mg puede intentarse mientras se prepara (poco eficaz si el bloqueo es infranodal).', 'Perfusión de dopamina/adrenalina como puente.', 'Crisis de Stokes-Adams: BAV completo sin escape → asistolia intermitente.'],
    grave: true,
  },
  escape_ventricular: {
    f: '15–40 lpm', r: 'Regular o ligeramente irregular.', p: 'Ausente.', pr: 'No aplicable', qrs: 'Ancho (≥ 0.12 s)', qt: 'Prolongado',
    claves: ['QRS ancho muy lento', 'Último marcapasos de seguridad: no suprimir'],
    causas: ['Fallo de marcapasos superiores', 'Isquemia o hiperpotasemia graves', 'Fase final de la parada'],
    manejo: ['Evitar fármacos que supriman el escape (antiarrítmicos).', 'Marcapasos transcutáneo; tratar causas reversibles.', 'Sin pulso: tratar como AESP.'],
    grave: true,
  },
  bri: {
    f: 'Del ritmo de base', r: 'Regular (si el ritmo de base lo es).', p: 'Sinusal.', pr: 'Normal', qrs: '≥ 0.12 s', qt: 'Prolongado por el QRS',
    claves: ['QRS predominantemente negativo en V1 (QS/rS)', 'R ancha y empastada en I, aVL, V5 y V6 SIN q septal', 'ST descendido y T negativa en V5–V6', 'Eje a la izquierda'],
    causas: ['Cardiopatía isquémica, miocardiopatía', 'Hipertrofia ventricular izquierda', 'Fibrosis degenerativa'],
    manejo: ['Un BRI nuevo con dolor torácico se trata como posible infarto (equivalente de STEMI según el contexto).', 'Dificulta interpretar la isquemia en el ECG.'],
  },
  brd: {
    f: 'Del ritmo de base', r: 'Regular (si el ritmo de base lo es).', p: 'Sinusal.', pr: 'Normal', qrs: '≥ 0.12 s', qt: 'Prolongado por el QRS',
    claves: ['rsR\' ("orejas de conejo") en V1–V2', 'S ancha y empastada en I, aVL, V5 y V6', 'T invertida en V1–V3', 'Eje a la derecha'],
    causas: ['Variante normal', 'Sobrecarga del VD (embolia pulmonar, cor pulmonale)', 'Cardiopatía congénita o isquémica'],
    manejo: ['Aislado, sin síntomas: observación.', 'De aparición brusca + disnea: considerar embolia pulmonar.'],
  },
  wpw: {
    f: 'Del ritmo de base', r: 'Regular en ritmo sinusal.', p: 'Sinusal.', pr: '< 0.12 s', qrs: '> 0.10–0.12 s por onda delta', qt: 'Alterado por repolarización secundaria',
    claves: ['PR corto + onda delta (empastamiento inicial del QRS)', 'Eje variable (izquierdo o derecho)', 'Riesgo de FA preexcitada (QRS ancho, irregular y muy rápido)'],
    causas: ['Vía accesoria (haz de Kent)'],
    manejo: ['Asintomático: observación y derivación.', 'Taquicardia regular estrecha (ortodrómica): maniobras vagales/adenosina.', 'FA preexcitada: EVITAR adenosina, β-bloqueantes, calcioantagonistas y digoxina; cardioversión si inestable; procainamida si estable.'],
  },
  hiperk: {
    f: 'Variable', r: 'Regular, puede llegar a bradicardia.', p: 'Aplanada y luego ausente.', pr: 'Alargado', qrs: 'Ensanchado progresivamente', qt: 'T alta, picuda y simétrica; en fase final onda sinusoidal',
    claves: ['T picuda en tienda de campaña (K⁺ ≈ 5.5–6.5)', 'P plana y QRS ancho (K⁺ ≈ 7–8)', 'Onda sinusoidal → riesgo de FV/asistolia'],
    causas: ['Insuficiencia renal', 'Rabdomiólisis, quemaduras, acidosis', 'IECA/ARA-II, ahorradores de potasio'],
    manejo: ['Estabilizar la membrana: gluconato o cloruro de calcio IV.', 'Desplazar el K⁺: insulina con glucosa, salbutamol nebulizado, bicarbonato si hay acidosis.', 'Eliminar: diuréticos, resinas o diálisis.'],
    grave: true,
  },
  marcapasos: {
    f: 'Frecuencia programada', r: 'Regular.', p: 'Espícula auricular + P (DDD) o ausente/disociada (VVI).', pr: 'Intervalo AV programado (DDD)', qrs: 'Ancho, morfología tipo BRI, precedido de espícula', qt: 'Prolongado; T discordante',
    claves: ['Espícula al inicio de cada QRS', 'Fallo de captura: espícula SIN QRS', 'Fallo de sensado: espículas que caen sobre latidos propios'],
    causas: ['Marcapasos definitivo o transcutáneo'],
    manejo: ['Fallo de captura: comprobar electrodos y aumentar la intensidad de salida; confirmar pulso mecánico (el ECG puede mostrar captura eléctrica sin pulso).', 'No confundir las espículas con QRS al medir la FC: el monitor puede no alarmar en asistolia.'],
  },
  tv: {
    f: '120–300 lpm (habitual 150–200)', r: 'Regular (monomorfa).', p: 'Disociada o no visible.', pr: 'No aplicable', qrs: '≥ 0.12 s, morfología constante', qt: 'No valorable',
    claves: ['3 o más ESV seguidas a > 100–120 lpm', 'QRS ancho monomorfo', 'Ante taquicardia de QRS ancho, asumir TV hasta demostrar lo contrario (sobre todo con cardiopatía)'],
    causas: ['Cardiopatía isquémica y miocardiopatía', 'Alteraciones electrolíticas', 'Fármacos proarrítmicos'],
    manejo: ['SIN pulso: tratar como FV (RCP, desfibrilación, adrenalina, amiodarona).', 'CON pulso e inestable: cardioversión sincronizada (100 J).', 'CON pulso y estable: ECG de 12 derivaciones; amiodarona 150 mg IV en 10 min o procainamida.'],
    grave: true,
  },
  torsades: {
    f: '200–250 lpm', r: 'Irregular, amplitud que "gira" alrededor de la línea de base.', p: 'No visible.', pr: 'No aplicable', qrs: 'Ancho, polimorfo', qt: 'QT largo en ritmo basal',
    claves: ['Husos de amplitud creciente y decreciente', 'Se inicia tras ESV con QT prolongado'],
    causas: ['QT largo congénito o adquirido', 'Fármacos (antiarrítmicos, macrólidos, antipsicóticos)', 'Hipopotasemia, hipomagnesemia, bradicardia'],
    manejo: ['Sulfato de magnesio 1–2 g IV.', 'Sin pulso: desfibrilación y RCP.', 'Corregir K⁺ y suspender fármacos que alarguen el QT.'],
    grave: true,
  },
  fv: {
    f: 'No medible', r: 'Caótico, sin complejos reconocibles.', p: 'Ausente.', pr: 'Ausente', qrs: 'Ausente', qt: 'Ausente',
    claves: ['Ondulaciones irregulares de amplitud variable', 'Sin pulso, inconsciente, no respira'],
    causas: ['Infarto agudo, isquemia', 'Cardiopatía estructural', 'Electrólitos, intoxicaciones, electrocución'],
    manejo: ['Iniciar RCP de calidad y desfibrilar lo antes posible (bifásico 120–200 J; monofásico 360 J).', 'Adrenalina 1 mg cada 3–5 min tras la 2.ª descarga.', 'Amiodarona 300 mg tras la 3.ª descarga (luego 150 mg) o lidocaína.', 'Buscar causas reversibles (5H y 5T).'],
    grave: true,
  },
  asistolia: {
    f: '0 lpm', r: 'Línea isoeléctrica.', p: 'Ausente.', pr: 'Ausente', qrs: 'Ausente', qt: 'Ausente',
    claves: ['Confirmar en dos derivaciones y con ganancia aumentada', 'Descartar electrodo desconectado o ganancia baja', 'NO desfibrilar'],
    causas: ['Hipoxia, hipovolemia, acidosis, hiperpotasemia, hipotermia', 'Neumotórax a tensión, taponamiento, trombosis, tóxicos'],
    manejo: ['RCP de alta calidad inmediata, adrenalina 1 mg lo antes posible y cada 3–5 min.', 'Buscar y tratar causas reversibles (5H y 5T).', 'No es ritmo desfibrilable.'],
    grave: true,
  },
  aesp: {
    f: 'Variable (a menudo lenta)', r: 'Organizado, sin pulso palpable.', p: 'Variable.', pr: 'Variable', qrs: 'Estrecho o ancho', qt: 'Variable',
    claves: ['ECG con complejos pero SIN pulso central', 'La FP del pletismograma/ SpO₂ desaparece ("buscando pulso")', 'Confirmar siempre con la palpación del pulso'],
    causas: ['5H: hipovolemia, hipoxia, hidrogeniones (acidosis), hipo/hiperpotasemia, hipotermia', '5T: neumotórax a tensión, taponamiento, tóxicos, trombosis pulmonar, trombosis coronaria'],
    manejo: ['RCP de alta calidad inmediata.', 'Adrenalina 1 mg lo antes posible y cada 3–5 min.', 'Identificar y corregir la causa reversible; no desfibrilar.'],
    grave: true,
  },
};

/** Devuelve la ficha docente de un ritmo (resuelve alias como bradicardia sinusal). */
export const fichaRitmo = (id) => DOCENCIA[id] || DOCENCIA.sinusal;
