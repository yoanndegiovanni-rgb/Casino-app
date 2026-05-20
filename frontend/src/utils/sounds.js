let ctx = null;

function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  return ctx;
}

function tone(freq, dur, type = 'sine', vol = 0.35, startDelay = 0) {
  try {
    const c = ac();
    const osc = c.createOscillator();
    const g   = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, c.currentTime + startDelay);
    g.gain.setValueAtTime(vol, c.currentTime + startDelay);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + startDelay + dur);
    osc.connect(g);
    g.connect(c.destination);
    osc.start(c.currentTime + startDelay);
    osc.stop(c.currentTime + startDelay + dur);
  } catch { /* silently ignore if audio not available */ }
}

export const sounds = {
  deal()  { tone(900, 0.06, 'square', 0.2); tone(700, 0.06, 'square', 0.15, 0.06); },
  flip()  { tone(1100, 0.07, 'sawtooth', 0.18); },
  chip()  { tone(1400, 0.12, 'triangle', 0.35); },
  win()   { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'sine', 0.3, i * 0.1)); },
  lose()  { [350, 280, 220].forEach((f, i) => tone(f, 0.25, 'sine', 0.25, i * 0.12)); },
  bust()  { tone(200, 0.4, 'sawtooth', 0.3); },
  push()  { tone(600, 0.2, 'sine', 0.2); tone(600, 0.2, 'sine', 0.2, 0.25); },
};
