# Security & Privacy

## Modelo de seguridad

Ringtone Forge 404 v1.2.0 es una PWA estática y local-first. No contiene backend, autenticación, telemetría, analytics ni subida de archivos.

## Datos

- El archivo seleccionado se lee mediante APIs del navegador y se decodifica en memoria.
- No se envía a ningún servidor.
- No se guarda el audio en `localStorage` ni IndexedDB.
- `localStorage` se usa únicamente para preferencias del editor: fade, normalización y formato elegido.
- Las descargas se generan mediante URLs `blob:` locales y se revocan al sustituirse o cerrar la página.

## Red

El runtime no requiere recursos remotos. La política CSP limita scripts, estilos, imágenes, media, conexiones, workers y manifest al mismo origen, salvo `blob:`/`data:` donde son necesarios para contenido local.

## Archivos

Existe un límite preventivo de 250 MB por archivo para reducir riesgo de agotamiento de memoria. El archivo sigue pudiendo requerir mucha memoria tras su decodificación PCM; dispositivos con poca RAM pueden fallar antes de ese límite.

## Limitaciones

La seguridad depende también del navegador y del sistema operativo. No se afirma seguridad absoluta ni compatibilidad con códecs que el navegador no soporte.
