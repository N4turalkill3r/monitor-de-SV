# Monitor de signos vitales · Simulador para paramédicos (PWA)

Simulador didáctico, 100 % en español, basado en el diseño y las alarmas de los monitores EDAN iM50/60/70/80. Funciona sin conexión y se puede instalar en móvil y escritorio. No es un dispositivo médico.

## Publicar en GitHub Pages
1. Suba esta carpeta completa a un repositorio.
2. *Settings → Pages → Deploy from a branch → `main` / `(root)`*.
3. Abra `https://<usuario>.github.io/<repositorio>/`. Todas las rutas son relativas.
4. Al cambiar archivos, incremente `VERSION` en `sw.js` para que los clientes actualicen la caché.

Para probar en local: `python3 -m http.server 8000` y abra `http://localhost:8000`. (Los módulos ES y el service worker requieren http, no `file://`.)

## Uso rápido
- Botón verde (abajo a la derecha): encender. El audio se activa con ese primer toque.
- Lengüeta **INSTRUCTOR** (borde derecho): abre el panel. Esc lo cierra.
- Pestañas: Paciente · Arritmias · Monitor · Alarmas · Escenarios · Proyectar.
- **Arritmias**: Ritmos (27) con opciones por ritmo y parámetros F‑R‑I‑E‑H‑I; Docente (protocolo FRI‑EHI interactivo, papel ECG con calibradores, 12 derivaciones, tira); Casos y quiz (21); Intervenciones (desfibrilación, cardioversión, adenosina, atropina); Atlas ECG (71 imágenes).
- **Proyectar**: abre una ventana solo con el monitor, sincronizada con el panel (para el proyector). Presentación tipo PowerPoint: diapositivas de monitor, texto, imagen y caso. Teclas ← → (cambiar), B (negro), F (pantalla completa). En la proyección, el botón "Activar audio" habilita el sonido.
- Mantenimiento del monitor: contraseña `ABC`.

## Estructura
```
index.html · manifest.webmanifest · sw.js
css/        base.css (escena y bisel) · monitor.css (pantalla 1024×768) · instructor.css (controles)
js/core/        config, estado (store observable + bus), sincronización (BroadcastChannel), utilidades
js/simulacion/  ecg-modelo, ritmos, fisiología, motor (250 Hz), alarmas, intervenciones
js/audio/       sonidos (Web Audio, sin archivos)
js/docencia/    protocolo FRI‑EHI, fichas de ritmos, casos clínicos
js/ui/          monitor, diálogos, menús declarativos, ondas, papel ECG, diapositivas, iconos
js/instructor/  panel y pestañas
assets/edan/    arte extraído del manual · assets/ekg/ atlas · assets/icons/
```
Cada archivo indica en su cabecera dónde se ejecuta (ventana maestra, proyección o ambas).

## Sincronización
La ventana maestra emite el estado completo y los eventos (PANI, descargas, diapositivas…) por `BroadcastChannel`; la proyección usa la misma semilla y los aplica. Ambas ventanas deben estar en el mismo navegador y origen.
