// audio.js — every sound in Tumble Towers is synthesised with WebAudio.
//
// No audio files ship with the game: a thud is a short sine burst whose
// pitch follows the impact, glass is filtered noise, and the gem chime is a
// little arpeggio. The context is created lazily on the first user gesture
// (browsers refuse sound before one) and every call is safe before that.

let ctx = null;
let master = null;

export function unlockAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.42;
  master.connect(ctx.destination);
}

function tone(freqFrom, freqTo, seconds, type, volume, when = 0) {
  if (!ctx) return;
  const t0 = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freqFrom, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqTo), t0 + seconds);
  gain.gain.setValueAtTime(volume, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + seconds);
  osc.connect(gain);
  gain.connect(master);
  osc.start(t0);
  osc.stop(t0 + seconds + 0.02);
}

function noise(seconds, volume, filterFreq, type = 'highpass') {
  if (!ctx) return;
  const t0 = ctx.currentTime;
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = filterFreq;
  const gain = ctx.createGain();
  gain.gain.value = volume;
  src.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  src.start(t0);
}

export const sfx = {
  click() {
    tone(660, 520, 0.07, 'triangle', 0.25);
  },
  stretch(pull) {
    tone(90 + pull * 1.2, 70 + pull, 0.08, 'sawtooth', 0.05);
  },
  launch(power) {
    noise(0.22, 0.2 + power * 0.002, 500, 'bandpass');
    tone(300 + power * 2, 90, 0.2, 'sine', 0.22);
  },
  thud(strength) {
    const s = Math.min(1, strength / 700);
    tone(120 - s * 50 + Math.random() * 14, 45, 0.1 + s * 0.08, 'sine', 0.12 + s * 0.3);
    if (s > 0.35) noise(0.06, s * 0.12, 900, 'lowpass');
  },
  glassBreak() {
    noise(0.28, 0.3, 2600);
    tone(1900 + Math.random() * 500, 900, 0.18, 'triangle', 0.1);
    tone(2500 + Math.random() * 600, 1300, 0.12, 'triangle', 0.07, 0.03);
  },
  gemFreed() {
    tone(880, 880, 0.12, 'sine', 0.22);
    tone(1174, 1174, 0.12, 'sine', 0.22, 0.09);
    tone(1568, 1568, 0.22, 'sine', 0.24, 0.18);
  },
  topple() {
    tone(220, 160, 0.09, 'triangle', 0.14);
  },
  win() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((f, i) => tone(f, f, 0.16, 'triangle', 0.22, i * 0.11));
  },
  lose() {
    tone(330, 196, 0.35, 'triangle', 0.2);
    tone(262, 147, 0.4, 'triangle', 0.18, 0.16);
  },
};
