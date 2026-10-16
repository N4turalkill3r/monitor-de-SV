/**
 * @file sw.js
 * @description Service worker: guarda la aplicación para uso SIN CONEXIÓN.
 *  - Núcleo (HTML, CSS, JS, iconos, imágenes EDAN): precaché al instalar.
 *  - Atlas ECG (assets/ekg): se guarda al verlo por primera vez (no pesa en la instalación).
 * Estrategia: caché primero, con actualización en segundo plano (stale-while-revalidate).
 * Para publicar una versión nueva, cambie VERSION.
 * Se ejecuta en: segundo plano del navegador (no tiene acceso al DOM).
 */
const VERSION = 'monitor-v1.0.0';
const NUCLEO = [
  "./",
  "assets/edan/config-alarma-fc.jpg",
  "assets/edan/electrodos-12.jpg",
  "assets/edan/electrodos-3.jpg",
  "assets/edan/electrodos-5.jpg",
  "assets/edan/frente-im50.jpg",
  "assets/edan/frente-im60.jpg",
  "assets/edan/frente-im70.jpg",
  "assets/edan/frente-im80.jpg",
  "assets/edan/grafico-tendencia.jpg",
  "assets/edan/lateral-im50-60.jpg",
  "assets/edan/pantalla-fuente-grande.jpg",
  "assets/edan/pantalla-principal.jpg",
  "assets/edan/posterior-im50.jpg",
  "assets/edan/posterior-im60-70.jpg",
  "assets/edan/posterior-im80.jpg",
  "assets/edan/simbolos-gas.jpg",
  "assets/edan/simbolos-puertos.jpg",
  "assets/edan/simbolos-seguridad.jpg",
  "assets/edan/teclas-atajo-1.jpg",
  "assets/edan/teclas-atajo-2.jpg",
  "assets/ekg/indice.json",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png",
  "css/base.css",
  "css/instructor.css",
  "css/monitor.css",
  "index.html",
  "js/audio/sonidos.js",
  "js/core/config.js",
  "js/core/estado.js",
  "js/core/sincronizacion.js",
  "js/core/utilidades.js",
  "js/docencia/casos.js",
  "js/docencia/protocolo.js",
  "js/docencia/ritmos-docencia.js",
  "js/instructor/escenarios-datos.js",
  "js/instructor/panel.js",
  "js/instructor/tab-alarmas.js",
  "js/instructor/tab-arritmias.js",
  "js/instructor/tab-docente.js",
  "js/instructor/tab-escenarios.js",
  "js/instructor/tab-monitor.js",
  "js/instructor/tab-paciente.js",
  "js/instructor/tab-proyeccion.js",
  "js/main.js",
  "js/simulacion/alarmas.js",
  "js/simulacion/ecg-modelo.js",
  "js/simulacion/fisiologia.js",
  "js/simulacion/intervenciones.js",
  "js/simulacion/motor.js",
  "js/simulacion/ritmos.js",
  "js/ui/definicion-menus.js",
  "js/ui/dialogos.js",
  "js/ui/diapositivas.js",
  "js/ui/formularios.js",
  "js/ui/iconos.js",
  "js/ui/monitor.js",
  "js/ui/ondas-canvas.js",
  "js/ui/papel-ecg.js",
  "manifest.webmanifest"
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(NUCLEO)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => {
      const red = fetch(e.request).then((r) => {
        if (r.ok) caches.open(VERSION).then((c) => c.put(e.request, r.clone()));
        return r;
      }).catch(() => hit);
      return hit || red;
    })
  );
});
