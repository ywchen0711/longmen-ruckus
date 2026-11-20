// Music (one reused <audio> element - iOS only lets the first unlocked element play) and synthesised slapstick sfx.
const TRACKS = { title: 'title', town: 'town', mountain: 'mountain', river: 'river', mg: 'minigame', mg2: 'minigame2', results: 'results', final: 'final' };
export class Sound {
  constructor() {
    this.ctx = null; this.musicOn = true; this.sfxOn = true; this.cur = null; this.vol = 0.55;
    try { const m = localStorage.getItem('lr-music'); if (m === '0') this.musicOn = false; } catch (e) { /* private */ }
    this.el = new Audio(); this.el.loop = true; this.el.preload = 'auto'; this.el.volume = this.vol; this.el.setAttribute('playsinline', '');
    const unlock = () => this.init();
    for (const ev of ['touchend', 'click', 'keydown']) addEventListener(ev, unlock, { passive: true });
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.el.pause(); else if (this.cur && this.musicOn) this.el.play().catch(() => {}); });
  }
  init() {
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* old Safari */ }
    if (!this.ctx) { try { const AC = window.AudioContext || window.webkitAudioContext; if (AC) { this.ctx = new AC(); this.master = this.ctx.createGain(); this.master.gain.value = 0.5; this.master.connect(this.ctx.destination); } } catch (e) { this.ctx = null; } }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    if (!this.unlocked) { this.unlocked = true; if (this.cur && this.musicOn) this.el.play().catch(() => {}); }
  }
  music(key) {
    if (key === this.cur) { if (this.musicOn && this.el.paused && this.unlocked) this.el.play().catch(() => {}); return; }
    this.cur = key;
    if (!key) { this.el.pause(); return; }
    this.el.loop = key !== 'results' && key !== 'final';
    this.el.src = 'audio/' + TRACKS[key] + '.m4a?v=1';
    if (this.musicOn && this.unlocked) this.el.play().catch(() => {});
  }
  toggleMusic() { this.musicOn = !this.musicOn; try { localStorage.setItem('lr-music', this.musicOn ? '1' : '0'); } catch (e) { /* private */ } if (this.musicOn) { if (this.cur) this.el.play().catch(() => {}); } else this.el.pause(); return this.musicOn; }
  // -------------------------------------------------- sfx
  tone(f, t0, dur, type = 'square', vol = 0.2, f2 = null) {
    const c = this.ctx; const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t0); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(this.master); o.start(t0); o.stop(t0 + dur + 0.02);
  }
  noise(t0, dur, vol = 0.2, freq = 1200, q = 1) {
    const c = this.ctx; const n = Math.floor(c.sampleRate * dur); const b = c.createBuffer(1, n, c.sampleRate); const d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = c.createBufferSource(); s.buffer = b; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); g.gain.value = vol; s.connect(f); f.connect(g); g.connect(this.master); s.start(t0);
  }
  sfx(k) {
    if (!this.ctx || !this.sfxOn) return; const t = this.ctx.currentTime;
    switch (k) {
      case 'click': this.tone(880, t, 0.06, 'square', 0.08); break;
      case 'dice': for (let i = 0; i < 4; i++) this.noise(t + i * 0.05, 0.04, 0.25, 2500 + i * 300, 4); break;
      case 'diceStop': this.tone(520, t, 0.08, 'square', 0.15); this.tone(1040, t + 0.07, 0.18, 'square', 0.12); this.noise(t, 0.1, 0.3, 900, 2); break;
      case 'hop': this.tone(300, t, 0.09, 'triangle', 0.18, 600); break;
      case 'coin': this.tone(988, t, 0.07, 'square', 0.1); this.tone(1319, t + 0.07, 0.22, 'square', 0.1); break;
      case 'lose': this.tone(440, t, 0.15, 'sawtooth', 0.12, 220); this.tone(330, t + 0.14, 0.25, 'sawtooth', 0.1, 140); break;
      case 'bonk': this.tone(180, t, 0.12, 'sine', 0.4, 60); this.noise(t, 0.08, 0.35, 600, 1.5); this.tone(1200, t + 0.03, 0.15, 'triangle', 0.08, 2400); break;
      case 'whoosh': this.noise(t, 0.35, 0.3, 700, 0.6); break;
      case 'jump': this.tone(330, t, 0.15, 'square', 0.1, 880); break;
      case 'item': [660, 880, 1100].forEach((f, i) => this.tone(f, t + i * 0.06, 0.12, 'triangle', 0.14)); break;
      case 'manual': [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, t + i * 0.09, 0.35, 'triangle', 0.16)); this.noise(t + 0.45, 0.6, 0.12, 6000, 0.5); break;
      case 'gong': this.tone(110, t, 1.4, 'sine', 0.35, 100); this.tone(277, t, 1.0, 'sine', 0.12, 260); this.noise(t, 0.4, 0.15, 3000, 0.7); break;
      case 'drum': this.tone(120, t, 0.18, 'sine', 0.45, 50); this.noise(t, 0.05, 0.2, 300, 1); break;
      case 'cheer': this.noise(t, 0.9, 0.25, 1800, 0.4); [784, 988, 1175].forEach((f, i) => this.tone(f, t + i * 0.08, 0.3, 'square', 0.07)); break;
      case 'bad': this.tone(220, t, 0.3, 'square', 0.1, 110); break;
      case 'laugh': for (let i = 0; i < 3; i++) this.tone(260 - i * 20, t + i * 0.28, 0.14, 'sawtooth', 0.09, 200 - i * 20); break;
      case 'go': this.tone(784, t, 0.12, 'square', 0.14); this.tone(1568, t + 0.1, 0.3, 'square', 0.12); break;
      case 'tick': this.tone(660, t, 0.08, 'square', 0.1); break;
      case 'hit': this.noise(t, 0.06, 0.3, 1500, 2); this.tone(500, t, 0.06, 'square', 0.08, 250); break;
      case 'chomp': for (let i = 0; i < 3; i++) { this.noise(t + i * 0.16, 0.08, 0.3, 500, 1.2); this.tone(160, t + i * 0.16, 0.08, 'square', 0.1, 90); } break;
      case 'shatter': for (let i = 0; i < 5; i++) this.noise(t + i * 0.03, 0.06, 0.18, 4000 + i * 700, 3); break;
    }
  }
}
