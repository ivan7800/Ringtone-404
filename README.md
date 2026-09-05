# Ringtone Forge 404

PWA estática y local-first para GitHub Pages que permite cargar un archivo de audio, seleccionar un fragmento de hasta 30 segundos, previsualizarlo, aplicar procesado básico y exportarlo como ringtone sin subir el audio a ningún servidor.

## Estado

**v1.3.0 · Final Polish local-first.** Se elimina por completo la integración de YouTube de v1.1.x porque añadía una dependencia remota que podía fallar por políticas del reproductor, red, privacidad o bloqueo de embeds. La función principal vuelve a depender exclusivamente del archivo del usuario.

## Funciones

- Selector de archivo y drag & drop.
- Decodificación mediante Web Audio API.
- Forma de onda local optimizada para audios largos.
- Selección visual y numérica con precisión de 0,1 s.
- Límite estricto de 30 segundos.
- Presets de 15, 20 y 30 segundos.
- Ajuste fino ±0,1 s / ±1 s.
- Preview procesado, stop, desplazamiento y loop: lo que se escucha usa el mismo render que se exporta.
- Playhead en tiempo real sobre la forma de onda durante la reproducción.
- Fade in de 0,8 s y fade out de 1,2 s.
- Normalización de pico a -1 dBFS con ganancia máxima limitada.
- Ganancia manual de −12 dB a +6 dB con aviso de posible clipping.
- **Smart Cut:** heurística local de energía que propone un fragmento de 30 s. No es IA y el usuario puede reajustarlo.
- Exportación WAV generada internamente y offline.
- M4R/M4A/MP3/OGG solo cuando `MediaRecorder` declara soporte para el MIME correspondiente.
- Validación posterior del archivo generado mediante redecodificación antes de ofrecer la descarga; WAV incluye además comprobación estructural RIFF/WAVE.
- Preferencias de procesado guardadas en `localStorage`.
- PWA instalable cuando el navegador lo permita.
- Service Worker con actualización de caché y navegación offline.
- CSP restrictiva y cero recursos remotos en runtime.

## Compatibilidad real

"Archivo compatible" significa que `AudioContext.decodeAudioData()` del navegador puede decodificar ese archivo. El soporte exacto depende del navegador, sistema operativo y códecs disponibles.

### Exportación

- **WAV:** siempre que Web Audio funcione. Se genera directamente en JavaScript y no depende de un códec externo.
- **M4R/M4A:** solo si `MediaRecorder` declara explícitamente AAC mediante `audio/mp4;codecs=mp4a.40.2`. El soporte genérico `audio/mp4` no basta, porque algunos navegadores pueden generar Opus dentro de MP4. Para M4R se usa el contenedor AAC/MP4 generado por el navegador y extensión `.m4r`; la instalación final depende de iOS/Finder/GarageBand.
- **MP3:** solo si el navegador declara soporte de grabación `audio/mpeg`/`audio/mp3`.
- **OGG:** solo si el navegador expone `audio/ogg`/Opus.

La interfaz bloquea un formato no soportado en vez de fingir una conversión.

## Smart Cut

Smart Cut no usa IA ni servicios remotos. Divide el audio en ventanas, estima energía RMS con muestreo reducido y busca la ventana de 30 segundos con mayor energía acumulada. Es una sugerencia útil para canciones, no una detección semántica de estribillos.

## Privacidad

- Sin backend.
- Sin analytics.
- Sin telemetría.
- Sin cuentas.
- Sin uploads.
- Sin iframes ni APIs remotas.
- El audio se procesa en memoria dentro del navegador.
- Solo se usa `localStorage` para preferencias no sensibles del editor.

## GitHub Pages

1. Crea un repositorio, por ejemplo `Ringtone-Forge-404`.
2. Sube el contenido del ZIP a la raíz.
3. En **Settings → Pages**, elige **Deploy from a branch**.
4. Rama `main`, carpeta `/ (root)`.
5. Abre la URL HTTPS publicada.

No necesita npm, Node.js, build, backend ni variables de entorno.

## Desarrollo local

Para probar PWA/service worker usa HTTP local:

```bash
python -m http.server 8080
```

Abre `http://localhost:8080`.

## Atajos

- `Espacio`: reproducir/detener el resultado procesado cuando el foco no está en un campo.
- `Esc`: detener reproducción.

## Licencia

MIT. Ver `LICENSE`.
