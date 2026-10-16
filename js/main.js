/**
 * @file main.js
 * @description Arranque de la aplicación: decide el rol de la ventana (maestra = instructor
 * con monitor y panel; seguidor = proyección sólo con el monitor), crea motor, alarmas,
 * sonidos y pantalla, conecta la sincronización y registra el service worker (PWA).
 *
 * Se ejecuta en: AMBOS (el rol se deduce de la URL: ?modo=proyeccion → seguidor).
 */
import { estado, emitir } from './core/estado.js';
import { iniciarSincronizacion } from './core/sincronizacion.js';
import { Motor } from './simulacion/motor.js';
import { GestorAlarmas } from './simulacion/alarmas.js';
import { iniciarIntervenciones } from './simulacion/intervenciones.js';
import { Sonidos } from './audio/sonidos.js';
import { Monitor } from './ui/monitor.js';
import { iniciarDiapositivas } from './ui/diapositivas.js';

const $ = (id) => document.getElementById(id);
const rol = new URLSearchParams(location.search).get('modo') === 'proyeccion' ? 'seguidor' : 'maestro';
document.body.dataset.rol = rol;

/* ---- Núcleo ---- */
const motor = new Motor(estado);
const alarmas = new GestorAlarmas(estado, motor);
const sonidos = new Sonidos(estado);
const sync = iniciarSincronizacion(rol);
const monitor = new Monitor($('pantalla-host'), { motor, alarmas, sonidos, soloVista: rol === 'seguidor' });
iniciarDiapositivas(document.body, { rol, sync });
window.__sim = { estado, motor, alarmas, sonidos, monitor, rol }; // útil para depurar desde la consola

/* ---- Audio: la proyección arranca silenciada (evita doble sonido con la maestra) ---- */
if (rol === 'seguidor') {
  sonidos.silenciado = true;
  sonidos.usarAjusteEstado = false;
  const b = document.createElement('button');
  b.className = 'btn-audio-proy';
  b.textContent = '🔇 Activar audio';
  b.addEventListener('click', () => {
    sonidos.activar();
    sonidos.silenciado = !sonidos.silenciado;
    b.textContent = sonidos.silenciado ? '🔇 Activar audio' : '🔊 Audio activo';
  });
  document.body.append(b);
}

/* ---- Rol maestro: panel, intervenciones y teclas físicas ---- */
if (rol === 'maestro') {
  iniciarIntervenciones(motor, sonidos);
  import('./instructor/panel.js').then(({ montarPanel }) => montarPanel($('instructor'), { motor, alarmas, sonidos, monitor, sync }));

  const encendido = () => estado.obtener('sistema.encendido');
  $('k-encendido').addEventListener('click', () => {
    sonidos.activar(); // el navegador exige un gesto del usuario para iniciar el audio
    estado.fijar('sistema.encendido', !encendido());
    if (encendido()) { motor.reiniciarMediciones(); emitir('motor:reiniciar'); }
  });
  const fisica = (id, f) => $(id).addEventListener('click', () => { sonidos.activar(); if (encendido()) { sonidos.tecla(); f(); } });
  fisica('k-alarma', () => emitir('alarma:silenciar'));
  fisica('k-pani', () => monitor._toggleNibp());
  fisica('k-tend', () => estado.fijar('sistema.vista', estado.obtener('sistema.vista') === 'tendencia' ? 'estandar' : 'tendencia'));
  fisica('k-congelar', () => estado.fijar('sistema.congelado', !estado.obtener('sistema.congelado')));
  fisica('k-menu', () => monitor.dialogos.menuPrincipal());
  fisica('k-perilla', () => monitor.dialogos.menuPrincipal());

  // LEDs del panel frontal: verde = encendido; naranja = alarma activa
  setInterval(() => {
    $('led-verde').classList.toggle('on', !!encendido());
    $('led-naranja').classList.toggle('on', !!encendido() && !!alarmas.nivelMax);
  }, 400);
}

/* ---- Motor y PWA ---- */
motor.iniciar();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch((e) => console.warn('Sin modo sin conexión:', e));
}
