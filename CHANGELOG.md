# Changelog

## 1.2.0 — Final local-first

### Eliminado
- Integración de YouTube completa: pestaña, iframe, IFrame API, parser de URLs, `origin`, `referrerpolicy`, estados y lógica asociada.
- Cualquier recurso remoto en runtime.

### Añadido
- Smart Cut local basado en energía RMS.
- Presets rápidos de 15, 20 y 30 segundos.
- Reinicio de selección.
- Exportación OGG cuando el navegador la soporte.
- Preferencias locales para fade/normalización/formato.
- Botón de instalación PWA cuando `beforeinstallprompt` esté disponible.
- Aviso de actualización del service worker.
- CSP restrictiva.
- Atajos de teclado Espacio/Esc.
- Consejos de instalación Android/iPhone.

### Mejorado
- Waveform optimizada mediante muestreo limitado por píxel.
- Clamp de selección robusto para audios muy cortos.
- Gestión de errores de MediaRecorder.
- Service worker con estrategia network-first para navegación y cache-first para assets.
- UI móvil, estados, documentación y mensajes de compatibilidad.

## 1.1.1
- Intento de corrección de YouTube Error 153 mediante `origin` y `referrerpolicy`.

## 1.1.0
- Añadido selector opcional de YouTube.

## 1.0.0
- Primera release local-first.
