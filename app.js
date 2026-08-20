// Referencias DOM
const imageInput = document.getElementById('imageInput');
const canvas = document.getElementById('imageCanvas');
const ctx = canvas.getContext('2d');
const placeholder = document.getElementById('placeholder');
const statusText = document.getElementById('status');
const btnStartAudio = document.getElementById('btnStartAudio');

// Indicadores visuales
const valR = document.getElementById('val-r');
const valG = document.getElementById('val-g');
const valB = document.getElementById('val-b');

// Web Audio API variables
let audioCtx;
let isAudioActive = false;
let lastNoteIndex = -1; // Para evitar re-disparar la misma nota miles de veces por segundo

// Escala Pentatónica Mayor (Garantiza armonia constante sin notas disonantes)
const scaleNotes = [
  { note: 'Do3 (C3)', freq: 130.81 }, { note: 'Re3 (D3)', freq: 146.83 }, { note: 'Mi3 (E3)', freq: 164.81 }, { note: 'Sol3 (G3)', freq: 196.00 }, { note: 'La3 (A3)', freq: 220.00 },
  { note: 'Do4 (C4)', freq: 261.63 }, { note: 'Re4 (D4)', freq: 293.66 }, { note: 'Mi4 (E4)', freq: 329.63 }, { note: 'Sol4 (G4)', freq: 392.00 }, { note: 'La4 (A4)', freq: 440.00 },
  { note: 'Do5 (C5)', freq: 523.25 }, { note: 'Re5 (D5)', freq: 587.33 }, { note: 'Mi5 (E5)', freq: 659.25 }, { note: 'Sol5 (G5)', freq: 783.99 }, { note: 'La5 (A5)', freq: 880.00 },
  { note: 'Do6 (C6)', freq: 1046.50 }
];

// Activar Audio Context
btnStartAudio.addEventListener('click', () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    isAudioActive = true;
    btnStartAudio.disabled = true;
    btnStartAudio.innerHTML = `✓ Audio Activo`;
    statusText.innerHTML = "¡Piano activado! Desliza el cursor sobre la imagen.";
  }
});

// Carga de la Imagen
imageInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const img = new Image();
  img.onload = () => {
    placeholder.style.display = 'none';
    canvas.style.display = 'block';

    const maxDim = 500;
    let scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  };
  img.src = URL.createObjectURL(file);
});

// Sintetizador de Piano Acústico/Eléctrico
function playPianoNote(freq, volume, blueVal) {
  if (!isAudioActive || volume <= 0.02) return;

  const now = audioCtx.currentTime;

  // 1. Oscilador Fundamental (Triangular = cuerpo suave de la nota)
  const osc1 = audioCtx.createOscillator();
  osc1.type = 'triangle';
  osc1.frequency.setValueAtTime(freq, now);

  // 2. Oscilador Armónico (Senoidal octava arriba = brillo metálico de cuerda)
  const osc2 = audioCtx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(freq * 2, now);

  // 3. Filtro Paso Bajo (Controlado por B - Azul)
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  // B define si el tono del piano es opaco/cálido (bajo B) o brillante (alto B)
  const cutoffFreq = 300 + (blueVal / 255) * 3500;
  filter.frequency.setValueAtTime(cutoffFreq, now);

  // 4. Envolvente de Ganancia (Simula la pulsación del piano)
  const noteGain = audioCtx.createGain();
  const osc2Gain = audioCtx.createGain();
  osc2Gain.gain.setValueAtTime(0.25, now); // Volumen de la octava superior

  // Duración de la resonancia (Azul amplía la resonancia/sustain)
  const decayTime = 0.5 + (blueVal / 255) * 1.2;

  // Golpeteo inicial (Attack de 0.005s)
  noteGain.gain.setValueAtTime(0.0001, now);
  noteGain.gain.linearRampToValueAtTime(volume, now + 0.008);

  // Caída natural de la nota (Exponential Decay)
  noteGain.gain.exponentialRampToValueAtTime(0.0001, now + decayTime);

  // Conectar nodos
  osc1.connect(filter);
  osc2.connect(osc2Gain);
  osc2Gain.connect(filter);
  filter.connect(noteGain);
  noteGain.connect(audioCtx.destination);

  // Disparar y limpiar memoria al terminar la nota
  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + decayTime);
  osc2.stop(now + decayTime);
}

// Procesar posición del mouse
canvas.addEventListener('mousemove', (e) => {
  if (!isAudioActive) return;

  const rect = canvas.getBoundingClientRect();
  const x = Math.floor(e.clientX - rect.left);
  const y = Math.floor(e.clientY - rect.top);

  const pixel = ctx.getImageData(x, y, 1, 1).data;
  const [r, g, b] = pixel;

  // --- MAPEO RGB ---
  // 1. Rojo (R) -> VOLUMEN (Fuerza del martilleo del piano)
  const volume = (r / 255) * 0.7;

  // 2. Verde (G) -> NOTA MUSICAL (Cuantizada a la Escala Pentatónica)
  const noteIndex = Math.floor((g / 256) * scaleNotes.length);
  const selectedNote = scaleNotes[noteIndex];

  // 3. Azul (B) -> TIMBRE/SUSTAIN (Brillo de la cuerda)

  // Disparar la nota únicamente si el cursor cambió de bloque de tono
  if (noteIndex !== lastNoteIndex) {
    lastNoteIndex = noteIndex;
    playPianoNote(selectedNote.freq, volume, b);
  }

  // Actualizar Interfaz
  valR.innerText = `${Math.round((r / 255) * 100)}%`;
  valG.innerText = selectedNote.note;
  valB.innerText = b > 180 ? 'Brillante' : b > 80 ? 'Cálido' : 'Suave';
});

// Reiniciar cuando el mouse sale de la imagen
canvas.addEventListener('mouseleave', () => {
  lastNoteIndex = -1;
  valR.innerText = '0%';
});