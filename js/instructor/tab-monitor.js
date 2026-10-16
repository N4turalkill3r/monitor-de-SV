/**
 * @file tab-monitor.js
 * @description Pestaña "Monitor": reproduce los MISMOS menús del monitor (ECG, RESP, SpO2,
 * PANI, CO2, Sistema, Módulos) a partir de definicion-menus.js, para que el instructor
 * tenga el mismo control que tiene el usuario del equipo, y además la vista de la pantalla.
 *
 * Se ejecuta en: SOLO la ventana maestra (instructor).
 */
import { estado } from '../core/estado.js';
import { formulario } from '../ui/formularios.js';
import { MENUS, MODULOS } from '../ui/definicion-menus.js';
import { seccion } from './panel.js';

export function construirMonitor(cont) {
  const vista = formulario([
    { etiqueta: 'Vista de pantalla', ruta: 'sistema.vista', opciones: { estandar: 'Estándar', fuenteGrande: 'Fuente grande', tendencia: 'Tendencias', oxyCRG: 'OxyCRG' } },
    { etiqueta: 'Modo', ruta: 'sistema.modo', opciones: { normal: 'Normal', noche: 'Noche', standby: 'Standby' } },
  ]);
  cont.append(
    seccion('Vista y modo', vista, true),
    seccion('Módulos', formulario(MODULOS.map(([k, t]) => ({ etiqueta: t, ruta: `modulos.${k}`, tipo: 'bool' })))),
    seccion('ECG', formulario(MENUS.ecg())),
    seccion('RESP', formulario(MENUS.resp())),
    seccion('SpO₂', formulario(MENUS.spo2())),
    seccion('PANI', formulario(MENUS.nibp())),
    seccion('CO₂', formulario(MENUS.co2())),
    seccion('Sistema (volumen, brillo, batería)', formulario(MENUS.sistema())),
  );
  void estado;
}
