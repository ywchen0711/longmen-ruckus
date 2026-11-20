// Keyboard, gamepad and touch merged into one stick + one button: {x, y, a, n} (n counts presses).
// Menus get onNav(dx, dy) / onOk() from arrow keys, the d-pad and the A button.
export class Input {
  constructor(el) {
    this.el = el; this.keys = new Set(); this.n = 0; this.touchy = (navigator.maxTouchPoints || 0) > 0 || 'ontouchstart' in window;
    this.stick = null; this.tA = false; this.onNav = null; this.onOk = null; this.padPrev = {}; this.active = false;
    const A = ['Space', 'Enter', 'KeyZ', 'KeyJ', 'NumpadEnter'];
    addEventListener('keydown', (e) => {
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (!this.keys.has(e.code)) {
        if (A.includes(e.code)) { this.n++; if (!this.active && this.onOk) { this.onOk(); e.preventDefault(); } }
        const nav = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1], KeyA: [-1, 0], KeyD: [1, 0], KeyW: [0, -1], KeyS: [0, 1] }[e.code];
        if (nav && !this.active && this.onNav) { this.onNav(nav[0], nav[1]); e.preventDefault(); }
      }
      this.keys.add(e.code);
      if (this.active && (e.code.startsWith('Arrow') || e.code === 'Space')) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    // touch: left half is a floating stick, right half is the A button
    const pad = document.getElementById('pad');
    const stickEl = document.getElementById('stick'), knob = document.getElementById('knob'), btnA = document.getElementById('btnA');
    this.stickEl = stickEl; this.knob = knob; this.btnA = btnA;
    pad.addEventListener('touchstart', (e) => {
      for (const t of e.changedTouches) {
        if (t.clientX < innerWidth / 2 && !this.stick) { this.stick = { id: t.identifier, x0: t.clientX, y0: t.clientY, x: 0, y: 0 }; stickEl.style.left = t.clientX + 'px'; stickEl.style.top = t.clientY + 'px'; stickEl.classList.add('on'); }
        else if (t.clientX >= innerWidth / 2) { this.tA = t.identifier; this.n++; btnA.classList.add('down'); }
      }
      e.preventDefault();
    }, { passive: false });
    pad.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) if (this.stick && t.identifier === this.stick.id) {
        let dx = t.clientX - this.stick.x0, dy = t.clientY - this.stick.y0; const m = Math.hypot(dx, dy), R = 46;
        if (m > R) { dx *= R / m; dy *= R / m; }
        this.stick.x = dx / R; this.stick.y = dy / R; knob.style.transform = `translate(${dx}px, ${dy}px)`;
      }
      e.preventDefault();
    }, { passive: false });
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (this.stick && t.identifier === this.stick.id) { this.stick = null; stickEl.classList.remove('on'); knob.style.transform = ''; }
        if (t.identifier === this.tA) { this.tA = false; btnA.classList.remove('down'); }
      }
    };
    pad.addEventListener('touchend', end); pad.addEventListener('touchcancel', end);
    // mouse fallback on the pad (desktop testing): click = A
    pad.addEventListener('mousedown', () => { this.n++; this.mouseA = true; });
    addEventListener('mouseup', () => { this.mouseA = false; });
  }
  pollPad() {
    const gps = navigator.getGamepads ? navigator.getGamepads() : [];
    let x = 0, y = 0, a = false;
    for (const g of gps) {
      if (!g) continue;
      const ax = g.axes[0] || 0, ay = g.axes[1] || 0;
      if (Math.abs(ax) > 0.25) x = ax; if (Math.abs(ay) > 0.25) y = ay;
      const b = (k) => g.buttons[k] && g.buttons[k].pressed;
      if (b(14)) x = -1; if (b(15)) x = 1; if (b(12)) y = -1; if (b(13)) y = 1;
      if (b(0) || b(1)) a = true;
    }
    const pv = this.padPrev;
    if (a && !pv.a) { this.n++; if (!this.active && this.onOk) this.onOk(); }
    if (!this.active && this.onNav) {
      const sx = x > 0.6 ? 1 : x < -0.6 ? -1 : 0, sy = y > 0.6 ? 1 : y < -0.6 ? -1 : 0;
      if ((sx && sx !== pv.sx) || (sy && sy !== pv.sy)) this.onNav(sx, sy);
      pv.sx = sx; pv.sy = sy;
    }
    pv.a = a; return { x, y, a };
  }
  state() {
    const k = this.keys; const g = this.pollPad();
    let x = (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0);
    let y = (k.has('ArrowDown') || k.has('KeyS') ? 1 : 0) - (k.has('ArrowUp') || k.has('KeyW') ? 1 : 0);
    if (g.x) x = g.x; if (g.y) y = g.y;
    if (this.stick) { x = Math.abs(this.stick.x) > 0.2 ? this.stick.x : 0; y = Math.abs(this.stick.y) > 0.2 ? this.stick.y : 0; }
    const a = g.a || this.tA !== false || !!this.mouseA || ['Space', 'Enter', 'KeyZ', 'KeyJ'].some(c => k.has(c));
    return { x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)), a, n: this.n };
  }
}
