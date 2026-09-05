'use strict';

const APP_VERSION = '1.2.0';
const MAX_CLIP_SECONDS = 30;
const MAX_FILE_BYTES = 250 * 1024 * 1024;
const SETTINGS_KEY = 'ringtone-forge-404-settings-v1';

const state = {
  file: null,
  buffer: null,
  start: 0,
  end: 30,
  audioCtx: null,
  source: null,
  stopTimer: null,
  playbackOffset: 0,
  objectUrl: null,
  pointerMode: null,
  deferredInstallPrompt: null,
  smartCutRunning: false
};

const $ = id => document.getElementById(id);
const els = {
  dropzone: $('dropzone'), fileInput: $('fileInput'), pickButton: $('pickButton'), replaceButton: $('replaceButton'), editor: $('editor'),
  fileName: $('fileName'), fileInfo: $('fileInfo'), waveform: $('waveform'), waveWrap: $('waveWrap'), overlay: $('selectionOverlay'),
  selectionLabel: $('selectionLabel'), selectedDuration: $('selectedDuration'), midTime: $('midTime'), endTime: $('endTime'),
  startInput: $('startInput'), endInput: $('endInput'), fadeIn: $('fadeIn'), fadeOut: $('fadeOut'), normalize: $('normalize'),
  playButton: $('playButton'), stopButton: $('stopButton'), rewindButton: $('rewindButton'), forwardButton: $('forwardButton'), loopPreview: $('loopPreview'),
  outputName: $('outputName'), formatSelect: $('formatSelect'), formatNote: $('formatNote'), exportButton: $('exportButton'), exportCapability: $('exportCapability'),
  progressWrap: $('progressWrap'), progressBar: $('progressBar'), progressText: $('progressText'), downloadLink: $('downloadLink'), toast: $('toast'),
  smartCutButton: $('smartCutButton'), resetSelectionButton: $('resetSelectionButton'), installButton: $('installButton')
};

function toast(message, ms = 2800) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => els.toast.classList.remove('show'), ms);
}

function formatTime(sec, tenths = false) {
  sec = Math.max(0, Number(sec) || 0);
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return tenths
    ? `${String(m).padStart(2, '0')}:${s.toFixed(1).padStart(4, '0')}`
    : `${m}:${String(Math.floor(s)).padStart(2, '0')}`;
}

function sanitizeName(value) {
  return (value || 'ringtone')
    .trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'ringtone';
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({
      fadeIn: els.fadeIn.checked,
      fadeOut: els.fadeOut.checked,
      normalize: els.normalize.checked,
      format: els.formatSelect.value
    }));
  } catch {}
}

function restoreSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
    if (!saved || typeof saved !== 'object') return;
    if (typeof saved.fadeIn === 'boolean') els.fadeIn.checked = saved.fadeIn;
    if (typeof saved.fadeOut === 'boolean') els.fadeOut.checked = saved.fadeOut;
    if (typeof saved.normalize === 'boolean') els.normalize.checked = saved.normalize;
    if ([...els.formatSelect.options].some(o => o.value === saved.format)) els.formatSelect.value = saved.format;
  } catch {}
}

function mimeSupported(type) {
  return typeof MediaRecorder !== 'undefined' &&
    typeof MediaRecorder.isTypeSupported === 'function' &&
    MediaRecorder.isTypeSupported(type);
}

const mimeMap = {
  m4r: ['audio/mp4;codecs=mp4a.40.2', 'audio/mp4'],
  m4a: ['audio/mp4;codecs=mp4a.40.2', 'audio/mp4'],
  mp3: ['audio/mpeg', 'audio/mp3'],
  ogg: ['audio/ogg;codecs=opus', 'audio/ogg']
};

function bestMime(format) {
  return (mimeMap[format] || []).find(mimeSupported) || null;
}

function updateCapabilities() {
  const labels = ['WAV ✓'];
  for (const fmt of ['m4r', 'mp3', 'ogg']) labels.push(`${fmt.toUpperCase()} ${bestMime(fmt) ? '✓' : '—'}`);
  els.exportCapability.textContent = labels.join(' · ');
  updateFormatNote();
}

function updateFormatNote() {
  const fmt = els.formatSelect.value;
  els.formatNote.className = 'format-note';
  els.exportButton.disabled = !state.buffer;

  if (fmt === 'wav') {
    els.formatNote.textContent = 'WAV se genera directamente con Web Audio: es la opción más compatible y siempre se procesa offline.';
    return;
  }

  const mime = bestMime(fmt);
  if (!mime) {
    els.formatNote.classList.add('warn');
    const fallback = fmt === 'm4r'
      ? 'Este navegador no ofrece codificación AAC/MP4. Exporta WAV y termina el tono de iPhone con GarageBand/Finder.'
      : `Este navegador no expone un codificador ${fmt.toUpperCase()} compatible. Selecciona WAV u otro formato disponible.`;
    els.formatNote.textContent = fallback;
    els.exportButton.disabled = true;
    return;
  }

  if (fmt === 'm4r') {
    els.formatNote.textContent = `M4R disponible mediante ${mime}. Se genera localmente como audio AAC/MP4 con extensión .m4r; la instalación final depende de iOS/Finder/GarageBand.`;
  } else {
    els.formatNote.textContent = `${fmt.toUpperCase()} disponible mediante el codificador multimedia del navegador (${mime}). La codificación es local y puede tardar aproximadamente lo mismo que dura el fragmento.`;
  }
}

async function ensureAudioContext() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) throw new Error('Web Audio API no está disponible');
  if (!state.audioCtx) state.audioCtx = new AudioCtx();
  if (state.audioCtx.state === 'suspended') await state.audioCtx.resume();
  return state.audioCtx;
}

function clearDownload() {
  if (state.objectUrl) {
    URL.revokeObjectURL(state.objectUrl);
    state.objectUrl = null;
  }
  els.downloadLink.hidden = true;
  els.downloadLink.removeAttribute('href');
  els.progressWrap.hidden = true;
  els.progressBar.style.width = '0%';
  els.progressText.textContent = 'Preparando…';
}

function setProgress(percent, text) {
  els.progressWrap.hidden = false;
  els.progressBar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  els.progressText.textContent = text;
}

function minClipDuration() {
  return state.buffer ? Math.min(0.1, state.buffer.duration) : 0.1;
}

function clampSelection(start, end, changed = 'both') {
  if (!state.buffer) return [0, 0];
  const dur = state.buffer.duration;
  const minClip = minClipDuration();
  if (dur <= minClip) return [0, dur];

  start = Math.max(0, Math.min(Number(start) || 0, dur - minClip));
  end = Math.max(minClip, Math.min(Number(end) || 0, dur));

  if (changed === 'start') {
    start = Math.min(start, end - minClip);
    if (end - start > MAX_CLIP_SECONDS) end = Math.min(dur, start + MAX_CLIP_SECONDS);
  } else if (changed === 'end') {
    end = Math.max(end, start + minClip);
    if (end - start > MAX_CLIP_SECONDS) start = Math.max(0, end - MAX_CLIP_SECONDS);
  } else {
    if (end <= start) end = Math.min(dur, start + minClip);
    if (end - start > MAX_CLIP_SECONDS) end = Math.min(dur, start + MAX_CLIP_SECONDS);
  }

  start = Math.max(0, Math.min(start, dur - minClip));
  end = Math.max(start + minClip, Math.min(end, dur));
  if (end - start > MAX_CLIP_SECONDS) end = start + MAX_CLIP_SECONDS;
  return [start, end];
}

function updateQuickDurationButtons() {
  const duration = state.end - state.start;
  document.querySelectorAll('[data-duration]').forEach(btn => {
    const active = Math.abs(duration - Number(btn.dataset.duration)) < 0.06;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', String(active));
  });
}

function updateSelectionUI() {
  if (!state.buffer) return;
  const dur = state.buffer.duration;
  const selected = state.end - state.start;
  els.startInput.value = state.start.toFixed(1);
  els.endInput.value = state.end.toFixed(1);
  els.selectionLabel.textContent = `${formatTime(state.start, true)} — ${formatTime(state.end, true)}`;
  els.selectedDuration.textContent = selected.toFixed(1);
  els.midTime.textContent = formatTime(dur / 2);
  els.endTime.textContent = formatTime(dur);
  const left = dur ? (state.start / dur) * 100 : 0;
  const width = dur ? (selected / dur) * 100 : 0;
  els.overlay.style.left = `${left}%`;
  els.overlay.style.width = `${Math.max(0, width)}%`;
  state.playbackOffset = Math.max(state.start, Math.min(state.playbackOffset || state.start, state.end));
  updateQuickDurationButtons();
  clearDownload();
}

function setSelection(start, end, changed = 'both') {
  [state.start, state.end] = clampSelection(start, end, changed);
  updateSelectionUI();
}

function setPresetDuration(seconds) {
  if (!state.buffer) return;
  const target = Math.min(Number(seconds) || MAX_CLIP_SECONDS, MAX_CLIP_SECONDS, state.buffer.duration);
  let start = state.start;
  if (start + target > state.buffer.duration) start = Math.max(0, state.buffer.duration - target);
  setSelection(start, start + target, 'both');
}

function resetSelection() {
  if (!state.buffer) return;
  state.start = 0;
  state.end = Math.min(MAX_CLIP_SECONDS, state.buffer.duration);
  state.playbackOffset = state.start;
  stopPlayback(false);
  updateSelectionUI();
  toast('Corte reiniciado.');
}

function drawWaveform() {
  if (!state.buffer) return;
  const canvas = els.waveform;
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(320, Math.floor(rect.width * dpr));
  const height = Math.max(160, Math.floor(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, width, height);

  const channels = Math.min(2, state.buffer.numberOfChannels);
  const length = state.buffer.length;
  const mid = height / 2;
  const amp = height * 0.40;
  const samplesPerPixel = Math.max(1, Math.floor(length / width));
  const scanStride = Math.max(1, Math.floor(samplesPerPixel / 80));

  ctx.strokeStyle = '#657386';
  ctx.globalAlpha = .55;
  ctx.lineWidth = Math.max(1, dpr);
  ctx.beginPath();
  for (let x = 0; x < width; x++) {
    const from = x * samplesPerPixel;
    const to = Math.min(length, from + samplesPerPixel);
    let peak = 0;
    for (let ch = 0; ch < channels; ch++) {
      const data = state.buffer.getChannelData(ch);
      for (let i = from; i < to; i += scanStride) peak = Math.max(peak, Math.abs(data[i] || 0));
    }
    const y = peak * amp;
    ctx.moveTo(x + .5, mid - y);
    ctx.lineTo(x + .5, mid + y);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = '#252f3d';
  ctx.beginPath(); ctx.moveTo(0, mid + .5); ctx.lineTo(width, mid + .5); ctx.stroke();
}

function secondsFromPointer(event) {
  const rect = els.waveWrap.getBoundingClientRect();
  const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  return ratio * state.buffer.duration;
}

function choosePointerMode(sec) {
  return Math.abs(sec - state.start) <= Math.abs(sec - state.end) ? 'start' : 'end';
}

async function loadFile(file) {
  if (!file) return;
  stopPlayback();
  clearDownload();
  if (file.size <= 0) return toast('El archivo está vacío.');
  if (file.size > MAX_FILE_BYTES) return toast('Archivo demasiado grande. Límite de seguridad: 250 MB.');

  const originalText = els.pickButton.textContent;
  els.pickButton.disabled = true;
  els.pickButton.textContent = 'Analizando…';

  try {
    const ctx = await ensureAudioContext();
    const arr = await file.arrayBuffer();
    const buffer = await ctx.decodeAudioData(arr.slice(0));
    if (!Number.isFinite(buffer.duration) || buffer.duration <= 0) throw new Error('Duración no válida');

    state.file = file;
    state.buffer = buffer;
    state.start = 0;
    state.end = Math.min(MAX_CLIP_SECONDS, buffer.duration);
    state.playbackOffset = 0;

    els.fileName.textContent = file.name;
    const channelLabel = buffer.numberOfChannels === 1 ? 'Mono' : buffer.numberOfChannels === 2 ? 'Estéreo' : `${buffer.numberOfChannels} canales`;
    els.fileInfo.textContent = `${formatTime(buffer.duration)} · ${buffer.sampleRate.toLocaleString('es-ES')} Hz · ${channelLabel} · ${(file.size / 1024 / 1024).toFixed(1)} MB`;
    els.outputName.value = `${sanitizeName(file.name.replace(/\.[^.]+$/, ''))}-ringtone`;
    els.startInput.max = buffer.duration.toFixed(3);
    els.endInput.max = buffer.duration.toFixed(3);
    els.editor.hidden = false;
    updateSelectionUI();
    drawWaveform();
    updateFormatNote();
    requestAnimationFrame(() => els.editor.scrollIntoView({behavior: 'smooth', block: 'start'}));
    toast('Audio cargado. Todo el procesamiento permanece en este dispositivo.');
  } catch (err) {
    console.error(err);
    toast('No se puede decodificar este audio en este navegador. Prueba otro formato o navegador.', 4200);
  } finally {
    els.pickButton.disabled = false;
    els.pickButton.textContent = originalText;
  }
}

function stopPlayback(resetOffset = true) {
  clearInterval(state.stopTimer);
  state.stopTimer = null;
  if (state.source) {
    try { state.source.onended = null; state.source.stop(); } catch {}
    state.source.disconnect?.();
    state.source = null;
  }
  if (resetOffset) state.playbackOffset = state.start;
  const icon = els.playButton.querySelector('span[aria-hidden]');
  const label = els.playButton.querySelector('span:last-child');
  if (icon) icon.textContent = '▶';
  if (label) label.textContent = 'Escuchar selección';
}

async function playSelection() {
  if (!state.buffer) return;
  if (state.source) { stopPlayback(); return; }
  const ctx = await ensureAudioContext();
  const offset = Math.max(state.start, Math.min(state.playbackOffset || state.start, Math.max(state.start, state.end - .02)));
  const duration = Math.max(.01, state.end - offset);
  const source = ctx.createBufferSource();
  source.buffer = state.buffer;
  source.connect(ctx.destination);
  state.source = source;
  const startedAt = ctx.currentTime;
  const baseOffset = offset;
  source.start(0, offset, duration);

  els.playButton.querySelector('span[aria-hidden]').textContent = 'Ⅱ';
  els.playButton.querySelector('span:last-child').textContent = 'Detener';

  source.onended = () => {
    if (state.source !== source) return;
    state.source = null;
    state.playbackOffset = state.start;
    clearInterval(state.stopTimer);
    state.stopTimer = null;
    els.playButton.querySelector('span[aria-hidden]').textContent = '▶';
    els.playButton.querySelector('span:last-child').textContent = 'Escuchar selección';
    if (els.loopPreview.checked) playSelection();
  };
  state.stopTimer = setInterval(() => {
    if (state.source === source) state.playbackOffset = Math.min(state.end, baseOffset + (ctx.currentTime - startedAt));
  }, 100);
}

async function smartCut() {
  if (!state.buffer || state.smartCutRunning) return;
  if (state.buffer.duration <= MAX_CLIP_SECONDS) {
    resetSelection();
    return toast('El audio ya cabe completo dentro del límite de 30 segundos.');
  }

  state.smartCutRunning = true;
  els.smartCutButton.disabled = true;
  const original = els.smartCutButton.textContent;
  els.smartCutButton.textContent = 'Analizando…';
  toast('Smart Cut está analizando la energía del audio localmente…', 1600);

  try {
    const buffer = state.buffer;
    const sampleRate = buffer.sampleRate;
    const binSeconds = .5;
    const binSamples = Math.max(1, Math.floor(sampleRate * binSeconds));
    const bins = Math.ceil(buffer.length / binSamples);
    const energies = new Float64Array(bins);
    const channels = Math.min(2, buffer.numberOfChannels);

    for (let b = 0; b < bins; b++) {
      const from = b * binSamples;
      const to = Math.min(buffer.length, from + binSamples);
      const stride = Math.max(1, Math.floor((to - from) / 180));
      let sum = 0, count = 0;
      for (let ch = 0; ch < channels; ch++) {
        const data = buffer.getChannelData(ch);
        for (let i = from; i < to; i += stride) {
          const v = data[i] || 0;
          sum += v * v;
          count++;
        }
      }
      energies[b] = count ? sum / count : 0;
      if (b % 180 === 0) await new Promise(requestAnimationFrame);
    }

    const windowBins = Math.max(1, Math.round(MAX_CLIP_SECONDS / binSeconds));
    let rolling = 0;
    for (let i = 0; i < Math.min(windowBins, bins); i++) rolling += energies[i];
    let bestSum = rolling;
    let bestIndex = 0;
    for (let i = windowBins; i < bins; i++) {
      rolling += energies[i] - energies[i - windowBins];
      if (rolling > bestSum) { bestSum = rolling; bestIndex = i - windowBins + 1; }
    }

    const start = Math.min(bestIndex * binSeconds, Math.max(0, buffer.duration - MAX_CLIP_SECONDS));
    setSelection(start, Math.min(buffer.duration, start + MAX_CLIP_SECONDS), 'both');
    state.playbackOffset = state.start;
    toast(`Smart Cut propone ${formatTime(state.start, true)} — ${formatTime(state.end, true)}. Puedes ajustarlo manualmente.` , 4200);
  } catch (err) {
    console.error(err);
    toast('Smart Cut no pudo analizar este archivo. El editor manual sigue disponible.', 3800);
  } finally {
    state.smartCutRunning = false;
    els.smartCutButton.disabled = false;
    els.smartCutButton.textContent = original;
  }
}

async function renderProcessedBuffer() {
  const src = state.buffer;
  const sampleRate = src.sampleRate;
  const clipDuration = Math.max(0, state.end - state.start);
  const length = Math.max(1, Math.floor(clipDuration * sampleRate));
  const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!OfflineCtx) throw new Error('OfflineAudioContext no está disponible');
  const offline = new OfflineCtx(src.numberOfChannels, length, sampleRate);
  const source = offline.createBufferSource();
  source.buffer = src;
  const gain = offline.createGain();
  source.connect(gain).connect(offline.destination);

  let peak = 0;
  if (els.normalize.checked) {
    const s0 = Math.floor(state.start * sampleRate);
    const s1 = Math.min(src.length, s0 + length);
    for (let ch = 0; ch < src.numberOfChannels; ch++) {
      const data = src.getChannelData(ch);
      for (let i = s0; i < s1; i++) peak = Math.max(peak, Math.abs(data[i]));
    }
  }

  const target = Math.pow(10, -1 / 20);
  const baseGain = els.normalize.checked && peak > 0 ? Math.min(8, target / peak) : 1;
  const renderedDuration = length / sampleRate;
  const fadeIn = Math.min(.8, renderedDuration / 3);
  const fadeOut = Math.min(1.2, renderedDuration / 3);

  gain.gain.setValueAtTime(baseGain, 0);
  if (els.fadeIn.checked && renderedDuration > .01) {
    gain.gain.setValueAtTime(0, 0);
    gain.gain.linearRampToValueAtTime(baseGain, fadeIn);
  }
  if (els.fadeOut.checked && renderedDuration > .01) {
    const fadeOutStart = Math.max(fadeIn, renderedDuration - fadeOut);
    gain.gain.setValueAtTime(baseGain, fadeOutStart);
    gain.gain.linearRampToValueAtTime(0, renderedDuration);
  }

  source.start(0, state.start, renderedDuration);
  return offline.startRendering();
}

function audioBufferToWav(buffer) {
  const channels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const frames = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const ab = new ArrayBuffer(44 + frames * blockAlign);
  const view = new DataView(ab);
  let p = 0;
  const write = str => { for (let i = 0; i < str.length; i++) view.setUint8(p++, str.charCodeAt(i)); };

  write('RIFF'); view.setUint32(p, 36 + frames * blockAlign, true); p += 4;
  write('WAVE'); write('fmt '); view.setUint32(p, 16, true); p += 4;
  view.setUint16(p, 1, true); p += 2; view.setUint16(p, channels, true); p += 2;
  view.setUint32(p, sampleRate, true); p += 4; view.setUint32(p, sampleRate * blockAlign, true); p += 4;
  view.setUint16(p, blockAlign, true); p += 2; view.setUint16(p, 16, true); p += 2;
  write('data'); view.setUint32(p, frames * blockAlign, true); p += 4;

  const channelData = [];
  for (let c = 0; c < channels; c++) channelData.push(buffer.getChannelData(c));
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < channels; c++) {
      const sample = Math.max(-1, Math.min(1, channelData[c][i]));
      view.setInt16(p, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      p += 2;
    }
  }
  return new Blob([ab], {type: 'audio/wav'});
}

async function audioBufferToMedia(buffer, mime) {
  const ctx = await ensureAudioContext();
  const dest = ctx.createMediaStreamDestination();
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(dest);
  const recorder = new MediaRecorder(dest.stream, {mimeType: mime, audioBitsPerSecond: 192000});
  const chunks = [];

  return new Promise((resolve, reject) => {
    let settled = false;
    const fail = err => { if (!settled) { settled = true; reject(err instanceof Error ? err : new Error('Error de codificación')); } };
    recorder.ondataavailable = event => { if (event.data?.size) chunks.push(event.data); };
    recorder.onerror = event => fail(event.error || new Error('Error MediaRecorder'));
    recorder.onstop = () => {
      if (settled) return;
      settled = true;
      resolve(new Blob(chunks, {type: mime}));
    };
    try {
      recorder.start(250);
      source.start();
      source.onended = () => setTimeout(() => { if (recorder.state !== 'inactive') recorder.stop(); }, 120);
    } catch (err) { fail(err); }
  });
}

async function exportRingtone() {
  if (!state.buffer) return;
  clearDownload();
  els.exportButton.disabled = true;
  const fmt = els.formatSelect.value;
  let progressTimer;

  try {
    setProgress(8, 'Renderizando el fragmento…');
    const processed = await renderProcessedBuffer();
    setProgress(35, 'Audio procesado. Preparando archivo…');
    let blob;
    let extension = fmt;

    if (fmt === 'wav') {
      blob = audioBufferToWav(processed);
      setProgress(100, 'WAV creado correctamente.');
    } else {
      const mime = bestMime(fmt);
      if (!mime) throw new Error(`Formato ${fmt.toUpperCase()} no soportado por este navegador`);
      let p = 38;
      progressTimer = setInterval(() => {
        p = Math.min(92, p + 2);
        setProgress(p, `Codificando ${fmt.toUpperCase()} localmente…`);
      }, 700);
      blob = await audioBufferToMedia(processed, mime);
      clearInterval(progressTimer);
      setProgress(100, `${fmt.toUpperCase()} creado correctamente.`);
    }

    if (!blob || blob.size < 128) throw new Error('El codificador no devolvió un archivo válido');
    const name = `${sanitizeName(els.outputName.value)}.${extension}`;
    state.objectUrl = URL.createObjectURL(blob);
    els.downloadLink.href = state.objectUrl;
    els.downloadLink.download = name;
    els.downloadLink.textContent = `Descargar ${name} · ${(blob.size / 1024).toFixed(0)} KB`;
    els.downloadLink.hidden = false;
    toast('Ringtone preparado para descargar.');
  } catch (err) {
    console.error(err);
    setProgress(0, err.message || 'No se pudo exportar.');
    toast('No se pudo exportar con este formato.', 3600);
  } finally {
    clearInterval(progressTimer);
    updateFormatNote();
  }
}

function isTypingTarget(target) {
  return target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement || target?.isContentEditable;
}

els.fileInput.addEventListener('change', event => {
  const file = event.target.files?.[0];
  if (file) loadFile(file);
  event.target.value = '';
});
els.pickButton.addEventListener('click', event => { event.stopPropagation(); els.fileInput.click(); });
els.replaceButton.addEventListener('click', () => els.fileInput.click());
els.dropzone.addEventListener('click', () => els.fileInput.click());
['dragenter', 'dragover'].forEach(type => els.dropzone.addEventListener(type, event => {
  event.preventDefault(); els.dropzone.classList.add('dragover');
}));
['dragleave', 'drop'].forEach(type => els.dropzone.addEventListener(type, event => {
  event.preventDefault(); els.dropzone.classList.remove('dragover');
}));
els.dropzone.addEventListener('drop', event => {
  const file = [...(event.dataTransfer?.files || [])].find(f => f.type.startsWith('audio/') || /\.(mp3|wav|m4a|aac|ogg|oga|flac|webm|opus|aiff?|caf)$/i.test(f.name));
  if (file) loadFile(file); else toast('No se ha encontrado un archivo de audio compatible.');
});

els.startInput.addEventListener('change', () => setSelection(els.startInput.value, state.end, 'start'));
els.endInput.addEventListener('change', () => setSelection(state.start, els.endInput.value, 'end'));
document.querySelectorAll('[data-nudge]').forEach(btn => btn.addEventListener('click', () => {
  if (!state.buffer) return;
  const [target, delta] = btn.dataset.nudge.split(':');
  const d = Number(delta);
  if (target === 'start') setSelection(state.start + d, state.end, 'start');
  else setSelection(state.start, state.end + d, 'end');
}));
document.querySelectorAll('[data-duration]').forEach(btn => btn.addEventListener('click', () => setPresetDuration(btn.dataset.duration)));
els.resetSelectionButton.addEventListener('click', resetSelection);
els.smartCutButton.addEventListener('click', smartCut);

els.waveWrap.addEventListener('pointerdown', event => {
  if (!state.buffer) return;
  els.waveWrap.setPointerCapture?.(event.pointerId);
  const sec = secondsFromPointer(event);
  state.pointerMode = choosePointerMode(sec);
  if (state.pointerMode === 'start') setSelection(sec, state.end, 'start');
  else setSelection(state.start, sec, 'end');
});
els.waveWrap.addEventListener('pointermove', event => {
  if (!state.pointerMode || !state.buffer) return;
  const sec = secondsFromPointer(event);
  if (state.pointerMode === 'start') setSelection(sec, state.end, 'start');
  else setSelection(state.start, sec, 'end');
});
window.addEventListener('pointerup', () => { state.pointerMode = null; });
window.addEventListener('pointercancel', () => { state.pointerMode = null; });

els.playButton.addEventListener('click', playSelection);
els.stopButton.addEventListener('click', () => stopPlayback());
els.rewindButton.addEventListener('click', () => {
  if (!state.buffer) return;
  state.playbackOffset = Math.max(state.start, (state.playbackOffset || state.start) - 1);
  if (state.source) { stopPlayback(false); playSelection(); }
});
els.forwardButton.addEventListener('click', () => {
  if (!state.buffer) return;
  state.playbackOffset = Math.min(Math.max(state.start, state.end - .05), (state.playbackOffset || state.start) + 1);
  if (state.source) { stopPlayback(false); playSelection(); }
});

els.formatSelect.addEventListener('change', () => { clearDownload(); saveSettings(); updateFormatNote(); });
[els.fadeIn, els.fadeOut, els.normalize].forEach(el => el.addEventListener('change', () => { clearDownload(); saveSettings(); }));
els.exportButton.addEventListener('click', exportRingtone);
window.addEventListener('resize', () => { clearTimeout(drawWaveform.timer); drawWaveform.timer = setTimeout(drawWaveform, 100); });
window.addEventListener('keydown', event => {
  if (event.code === 'Space' && state.buffer && !isTypingTarget(event.target)) {
    event.preventDefault(); playSelection();
  }
  if (event.key === 'Escape' && state.source) stopPlayback();
});
window.addEventListener('beforeunload', () => { stopPlayback(); clearDownload(); });

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  state.deferredInstallPrompt = event;
  els.installButton.hidden = false;
});
els.installButton.addEventListener('click', async () => {
  if (!state.deferredInstallPrompt) return;
  state.deferredInstallPrompt.prompt();
  try { await state.deferredInstallPrompt.userChoice; } catch {}
  state.deferredInstallPrompt = null;
  els.installButton.hidden = true;
});
window.addEventListener('appinstalled', () => { state.deferredInstallPrompt = null; els.installButton.hidden = true; toast('Ringtone Forge 404 instalada.'); });

restoreSettings();
updateCapabilities();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('./sw.js');
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) toast(`Nueva versión de Ringtone Forge 404 disponible. Recarga para actualizar.` , 5000);
        });
      });
    } catch (err) { console.warn('Service Worker no registrado:', err); }
  });
}

console.info(`Ringtone Forge 404 v${APP_VERSION} · local-first`);
