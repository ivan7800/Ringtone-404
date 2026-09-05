# AUDIT · Ringtone Forge 404 v1.2.0

## Objetivo

Cerrar la aplicación como PWA estática, local-first y publicable en GitHub Pages, eliminando por completo la integración de YouTube y reforzando el flujo principal: **cargar → seleccionar ≤30 s → previsualizar → procesar → exportar**.

## Nivel y módulos aplicados

- Nivel 3 · proyecto/release.
- Software Auditor.
- Bug Hunter.
- UX/UI.
- Multimedia/Web Audio.
- PWA/GitHub Pages.
- Security/Privacy.
- Accessibility.
- QA y revisión adversarial.
- Release Gate.

## Hallazgo principal

### [404-YT-REMOVE] Integración YouTube no fiable para el objetivo del producto

- **Severidad:** ALTA
- **Estado:** CORREGIDO
- **Impacto:** la versión 1.1.x dependía de red, políticas de embed y comportamiento de un tercero; se observó Error 153 incluso tras endurecer `origin/referrerpolicy`.
- **Decisión:** eliminar YouTube en lugar de mantener una función secundaria frágil.
- **Corrección:** eliminada UI, parser, IFrame API, iframes, estados, estilos, documentación funcional y cualquier URL remota del runtime.
- **Resultado:** la app vuelve a ser totalmente local-first y no necesita servicios externos.

## Mejoras v1.2.0

- Smart Cut local por energía RMS, declarado explícitamente como heurística y no como IA.
- Presets de 15/20/30 s.
- Reinicio de corte.
- Exportación OGG cuando el navegador la ofrece.
- Preferencias locales de procesado/formato.
- Botón PWA cuando `beforeinstallprompt` existe.
- Aviso de actualización del Service Worker.
- CSP restrictiva.
- Iconos maskable dedicados.
- Waveform optimizada para evitar recorrer cada muestra de audios largos.
- Clamp robusto para audios cortos.
- 404 compatible con subcarpeta de GitHub Pages.
- Atajos Espacio/Esc.
- Estados y mensajes de compatibilidad más honestos.

## Matriz de verificación

| Comprobación | Estado | Evidencia |
|---|---|---|
| Sintaxis `app.js` | ✅ Verificado | `node --check` |
| Sintaxis `sw.js` | ✅ Verificado | `node --check` |
| Sintaxis `404.js` | ✅ Verificado | `node --check` |
| Manifest | ✅ Verificado | parse JSON correcto |
| IDs DOM usados por JS | ✅ Verificado | 37 referencias, 0 IDs ausentes |
| IDs duplicados | ✅ Verificado | 0 |
| Botones con ID sin referencia JS | ✅ Verificado | 0 |
| Recursos remotos runtime | ✅ Verificado | 0 URLs HTTP/HTTPS |
| Referencias YouTube runtime | ✅ Verificado | 0 |
| CSP | ✅ Verificado estáticamente | solo `self`, `blob:`/`data:` necesarios |
| Carga HTTP de recursos | ✅ Verificado | 12 recursos críticos respondieron HTTP 200 |
| Límite 30 s | ✅ Verificado | tests de `clampSelection()` |
| Audio muy corto | ✅ Verificado a nivel lógico | clamp mínimo sin valores negativos |
| Smart Cut | ✅ Verificado a nivel lógico | audio sintético: zona fuerte 40–70 s → selección 40–70 s |
| WAV interno | ✅ Verificado | archivo generado por el encoder; `ffprobe`: PCM16, 48 kHz, estéreo, 1.000 s |
| WAV tamaño/cabecera | ✅ Verificado | RIFF/WAVE válido según `ffprobe` |
| Inicialización JS | ✅ Verificado con smoke VM | sin excepción al inicializar |
| 404 GitHub Pages | ✅ Verificado a nivel lógico | `/Ringtone-Forge-404/foo/bar` → `/Ringtone-Forge-404/` |
| Service Worker assets | ✅ Verificado | todos los recursos CORE existen |
| Iconos | ✅ Verificado | 192×192 y 512×512; variantes maskable |
| GitHub Pages/subcarpeta | ✅ Verificado estáticamente | rutas relativas, scope/start_url `./` |
| M4R/M4A/MP3/OGG | ⚠️ Verificado parcialmente | la UI solo habilita MIME declarado por `MediaRecorder`; no se probaron todos los códecs en navegadores reales |
| PWA instalada | ⏳ No ejecutado | requiere navegador/dispositivo real |
| iPhone/iPad físico | ⏳ No ejecutado | no disponible en este entorno |
| Android físico | ⏳ No ejecutado | no disponible en este entorno |

## Matriz navegador × dispositivo

| Entorno | Desktop | Móvil/Tablet | Estado | Evidencia |
|---|---:|---:|---|---|
| Chrome/Chromium | Sí | Android cuando aplique | ⏳ No ejecutado | no se completó una sesión de navegador real |
| Microsoft Edge | Sí | — | ⏳ No ejecutado | no disponible |
| Firefox | Sí | Android cuando aplique | ⏳ No ejecutado | no disponible |
| Safari macOS | Sí | — | ⏳ No ejecutado | no disponible |
| Safari iPhone | — | Sí | ⏳ No ejecutado | no disponible |
| Safari iPad | — | Sí | ⏳ No ejecutado | no disponible |

## Funciones REAL / PARCIAL

- **REAL:** carga/decodificación mediante Web Audio cuando el códec es soportado.
- **REAL:** waveform, selección ≤30 s, presets, ajuste fino, preview, loop, fade y normalización.
- **REAL:** Smart Cut heurístico local.
- **REAL:** exportación WAV PCM16.
- **PARCIAL POR ENTORNO:** M4R/M4A/MP3/OGG; dependen de `MediaRecorder.isTypeSupported()` y se bloquean cuando no existen.
- **AUSENTE DELIBERADAMENTE:** YouTube, backend, telemetría, uploads y dependencias remotas.

## Riesgos residuales

1. El soporte de formatos de entrada depende de `decodeAudioData()` del navegador y sus códecs.
2. Los archivos comprimidos grandes pueden expandirse mucho en PCM; existe límite preventivo de 250 MB, pero un dispositivo con poca RAM puede fallar antes.
3. M4R requiere codificación AAC/MP4 disponible y un flujo de instalación compatible en iOS/Finder/GarageBand.
4. No se han probado dispositivos físicos ni todos los navegadores principales.

## Resultado

La función principal queda centrada en una sola promesa que sí controla la aplicación: crear un fragmento de audio local de hasta 30 segundos y exportarlo sin enviar el archivo a terceros.

**RELEASE GATE: PASS CON LIMITACIONES**

**Motivo:** no quedan bloqueantes conocidos en el código o paquete para GitHub Pages; el flujo lógico, encoder WAV, estructura PWA, rutas y seguridad estática están verificados. La validación física multi-navegador y los codificadores opcionales continúan sin ejecutar.

**Bloqueantes:** ninguno conocido.

**No verificado:** instalación PWA real, Safari/iPhone/iPad, Android, Edge/Firefox y exportadores opcionales en cada navegador.
