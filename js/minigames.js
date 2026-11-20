// Fifteen original wuxia-comic minigames. Each is a small simulation the host runs at 30 steps a second:
//   init(S)            set up state S (plain JSON: it is sent to the other players as snapshots)
//   step(S, I, dt)     advance; I[i] = {x, y, a, p} (stick, button held, presses this step)
//   bot(S, i, sk, M)   a bot's input (sk 0..1 skill, M its private memory)
//   draw(c, S, A)      draw on a 640x360 arena (A = art helpers)
//   score(S)           one number per player, higher is better (teammates share a number)
// S always has: n (4), t (seconds, negative during the countdown), dur, team[] (2v2), solo (1v3).
const R = Math.random;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const gauss = () => (R() + R() + R() - 1.5) / 0.75;
const GROUND = 300;
const ang = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

// ---------- shared drawing bits
function sky(c, top, bot) { const g = c.createLinearGradient(0, 0, 0, 360); g.addColorStop(0, top); g.addColorStop(1, bot); c.fillStyle = g; c.fillRect(0, 0, 640, 360); }
function ground(c, y, col, edge) { c.fillStyle = col; c.fillRect(0, y, 640, 360 - y); c.fillStyle = edge; c.fillRect(0, y, 640, 5); }
function hearts(c, x, y, n, max) { for (let k = 0; k < max; k++) { c.fillStyle = k < n ? '#ff4a6a' : 'rgba(0,0,0,0.25)'; const hx = x - (max - 1) * 7 + k * 14; c.beginPath(); c.arc(hx - 3, y, 3.6, 0, 7); c.arc(hx + 3, y, 3.6, 0, 7); c.moveTo(hx - 6.5, y + 1); c.lineTo(hx, y + 8); c.lineTo(hx + 6.5, y + 1); c.fill(); } }
function stars(c, x, y, t) { for (let k = 0; k < 3; k++) { const a = t * 6 + k * 2.1; c.fillStyle = '#ffe040'; c.font = '14px sans-serif'; c.textAlign = 'center'; c.fillText('★', x + Math.cos(a) * 16, y + Math.sin(a) * 5); } }
function shadow(c, x, y, w) { c.fillStyle = 'rgba(0,0,0,0.22)'; c.beginPath(); c.ellipse(x, y, w, w * 0.32, 0, 0, 7); c.fill(); }
function wallBg(c) { c.fillStyle = '#e8d8b8'; c.fillRect(0, 120, 640, 180); c.fillStyle = '#c8b090'; for (let x = 0; x < 640; x += 64) c.fillRect(x, 120, 3, 180); c.fillStyle = '#3a4a5a'; c.fillRect(0, 100, 640, 26); c.fillStyle = '#2a3a4a'; for (let x = 0; x < 640; x += 16) c.fillRect(x, 100, 10, 26); }
// a porcelain tea cup (blue band, gold rim) w wide, h tall, centred on x
function cup(c, x, y, w, h) { c.fillStyle = '#f8f4ec'; c.beginPath(); c.moveTo(x - w / 2, y); c.lineTo(x + w / 2, y); c.lineTo(x + w / 2 - 4, y + h - 2); c.lineTo(x - w / 2 + 4, y + h - 2); c.fill(); c.fillStyle = '#2a6ab8'; c.fillRect(x - w / 2 + 2, y + 5, w - 4, 3); c.fillStyle = '#e0b040'; c.fillRect(x - w / 2, y, w, 2); c.strokeStyle = '#c8c0b0'; c.lineWidth = 1; c.strokeRect(x - w / 2 + 0.5, y + 0.5, w - 1, h - 3); if (w > 16) { c.fillStyle = '#2a6ab8'; c.beginPath(); c.arc(x, y + 10, 1.8, 0, 7); c.fill(); } }
// dodge input shared by the falling-things games: move away from what will land near me
function dodgeBot(S, p, items, landY, sk, M, speed) {
  M.re = (M.re || 0) - 1 / 30;
  if (M.re <= 0) {
    M.re = 0.28 - 0.22 * sk + R() * 0.1;
    let best = null, bt = 9;
    for (const o of items) { const vy = Math.max(o.vy || 0, 160); const tt = (landY - o.y) / vy; if (tt > 0 && tt < 0.5 + 0.5 * sk && Math.abs(o.x - p.x) < 40 && tt < bt) { bt = tt; best = o; } }
    if (best) { let d = p.x >= best.x ? 1 : -1; if (p.x > 590) d = -1; if (p.x < 50) d = 1; M.dir = d; M.hold = 0.25 + R() * 0.2; }
    else if ((M.hold = (M.hold || 0) - 0.3) <= 0) M.dir = R() < 0.4 ? 0 : (M.tx = 80 + R() * 480) > p.x ? 1 : -1;
  }
  if (R() > 0.9 + sk * 0.1) return { x: 0, y: 0, a: false, p: 0 };
  return { x: M.dir || 0, y: 0, a: false, p: 0 };
}

export const MINIGAMES = {
  // =================================================================== 1. tile rain
  tiles: {
    name: { zh: '屋瓦雨', en: 'Roof-Tile Rain' }, mode: 'ffa', dur: 35, icon: '瓦',
    desc: { zh: '客棧屋頂在打架，瓦片像雨一樣掉下來！看著地上的影子閃開。被砸三次就出局。', en: 'Somebody is brawling on the inn roof and tiles are raining down! Watch the shadows and dodge. Three hits and you\'re out.' },
    ctrl: { zh: '← → 移動', en: '← → move' },
    init(S) { S.p = [0, 1, 2, 3].map(i => ({ x: 110 + i * 140, hp: 3, st: 0, out: false, ot: 0, f: 1 })); S.tl = []; S.sp = 0.6; S.fx = []; },
    step(S, I, dt) {
      S.p.forEach((p, i) => { if (p.out) return; if (p.st > 0) { p.st -= dt; return; } p.x = clamp(p.x + I[i].x * 240 * dt, 30, 610); if (I[i].x) p.f = Math.sign(I[i].x); });
      if ((S.sp -= dt) <= 0) {
        S.sp = Math.max(0.16, 0.62 - S.t * 0.014);
        const alive = S.p.filter(p => !p.out); const aim = R() < 0.45 && alive.length ? alive[R() * alive.length | 0].x + gauss() * 30 : 30 + R() * 580;
        S.tl.push({ x: clamp(aim, 20, 620), y: -20, vy: 60 + R() * 60, r: R() * 6 });
      }
      for (const o of S.tl) { o.vy += 700 * dt; o.y += o.vy * dt; o.r += dt * 8; }
      S.tl = S.tl.filter(o => {
        if (o.y < GROUND - 30) return true;
        S.p.forEach(p => { if (!p.out && p.st <= 0 && Math.abs(p.x - o.x) < 24) { p.hp--; p.st = 1.0; if (p.hp <= 0) { p.out = true; p.ot = S.t; } } });
        S.fx.push({ x: o.x, t: S.t }); return false;
      });
      S.fx = S.fx.filter(f => S.t - f.t < 0.5);
    },
    done: (S) => S.p.filter(p => !p.out).length <= 1,
    score: (S) => S.p.map(p => p.out ? p.ot : 100 + p.hp),
    bot(S, i, sk, M) { return dodgeBot(S, S.p[i], S.tl, GROUND - 30, sk, M); },
    draw(c, S, A) {
      sky(c, '#9ad0f0', '#e8f4ff'); wallBg(c); ground(c, GROUND, '#c8b48e', '#a8946a');
      for (const o of S.tl) { const k = clamp(o.y / GROUND, 0, 1); shadow(c, o.x, GROUND + 4, 6 + 16 * k); }
      S.p.forEach((p, i) => { if (p.out) { A.spr(c, i, p.x, GROUND + 2, 3, { rot: Math.PI / 2, alpha: 0.6 }); return; } A.spr(c, i, p.x, GROUND + 2, 3, { walk: p.st <= 0 && S.t > 0, flip: p.f < 0, blink: p.st > 0 }); hearts(c, p.x, GROUND - 82, p.hp, 3); if (p.st > 0) stars(c, p.x, GROUND - 70, S.t); A.tag(c, i, p.x, GROUND + 22); });
      for (const o of S.tl) { c.save(); c.translate(o.x, o.y); c.rotate(o.r); c.fillStyle = '#4a5a6a'; c.beginPath(); c.moveTo(-14, -6); c.quadraticCurveTo(0, -14, 14, -6); c.lineTo(12, 6); c.quadraticCurveTo(0, -2, -12, 6); c.fill(); c.restore(); }
      for (const f of S.fx) { const k = (S.t - f.t) / 0.5; c.fillStyle = 'rgba(80,90,100,' + (1 - k) + ')'; for (let j = 0; j < 5; j++) c.fillRect(f.x + Math.cos(j * 1.3) * 30 * k, GROUND - 8 - Math.abs(Math.sin(j * 2)) * 30 * k, 6, 4); }
    },
  },

  // =================================================================== 2. pressure-point rhythm
  rhythm: {
    name: { zh: '點穴節拍', en: 'Pressure-Point Rhythm' }, mode: 'ffa', dur: 26, icon: '穴',
    desc: { zh: '金色穴位飄到木人身上時按下按鍵點穴！準確得 2 分，稍偏得 1 分，亂點會扣分。', en: 'Press when a golden pressure point reaches the wooden dummy! Spot-on scores 2, close scores 1, wild jabs cost a point.' },
    ctrl: { zh: 'A / 空白鍵 / 點擊 點穴', en: 'A / Space / tap to strike' },
    init(S) {
      const notes = []; let t = 2;
      while (t < 24) { notes.push(+t.toFixed(3)); const r = R(); t += r < 0.25 ? 0.25 : r < 0.75 ? 0.5 : r < 0.92 ? 0.75 : 1.0; }
      S.notes = notes; S.h = [0, 1, 2, 3].map(() => notes.map(() => 0)); S.sc = [0, 0, 0, 0]; S.j = [null, null, null, null]; S.cb = [0, 0, 0, 0];
    },
    step(S, I) {
      for (let i = 0; i < 4; i++) {
        const h = S.h[i];
        S.notes.forEach((n, k) => { if (h[k] === 0 && S.t > n + 0.16) { h[k] = -1; S.cb[i] = 0; } });
        if (I[i].p > 0) {
          let best = -1, bd = 9; S.notes.forEach((n, k) => { if (h[k] === 0) { const d = Math.abs(n - S.t); if (d < bd) { bd = d; best = k; } } });
          if (best >= 0 && bd < 0.16) { const pf = bd < 0.065; h[best] = pf ? 2 : 1; S.sc[i] += pf ? 2 : 1; S.cb[i]++; S.j[i] = { k: pf ? 2 : 1, t: S.t }; }
          else { S.sc[i] = Math.max(0, S.sc[i] - 1); S.cb[i] = 0; S.j[i] = { k: 0, t: S.t }; }
        }
      }
    },
    done: (S) => S.t > S.notes[S.notes.length - 1] + 0.8,
    score: (S) => S.sc.slice(),
    bot(S, i, sk, M) {
      const k = S.h[i].findIndex((v, kk) => v === 0 && S.notes[kk] > S.t - 0.1);
      if (k < 0) return { x: 0, y: 0, a: false, p: 0 };
      if (M.k !== k) { M.k = k; M.at = S.notes[k] + gauss() * (0.1 - 0.075 * sk); M.skip = R() < 0.22 - 0.2 * sk; }
      if (!M.skip && S.t >= M.at) { M.k = -1; M.skip = true; return { x: 0, y: 0, a: true, p: 1 }; }
      return { x: 0, y: 0, a: false, p: 0 };
    },
    draw(c, S, A) {
      sky(c, '#3a2a4a', '#6a4a5a');
      for (let i = 0; i < 4; i++) {
        const y = 60 + i * 76;
        c.fillStyle = i % 2 ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.1)'; c.fillRect(0, y - 34, 640, 70);
        c.strokeStyle = A.col(i); c.lineWidth = 3; c.beginPath(); c.moveTo(150, y); c.lineTo(640, y); c.stroke();
        // the wooden dummy at the strike point
        const j = S.j[i]; const jig = j && S.t - j.t < 0.2 && j.k ? Math.sin((S.t - j.t) * 60) * 4 : 0;
        c.fillStyle = '#a0703a'; c.fillRect(146 + jig, y - 30, 22, 52); c.fillRect(132 + jig, y - 18, 50, 8); c.beginPath(); c.arc(157 + jig, y - 36, 11, 0, 7); c.fill();
        c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.arc(157, y, 15, 0, 7); c.stroke();
        A.spr(c, i, 95, y + 30, 2.4, { frame: j && S.t - j.t < 0.15 ? 1 : 0 });
        A.txt(c, String(S.sc[i]), 40, y + 6, { size: 22, color: '#fff', stroke: A.col(i) });
        S.notes.forEach((n, k) => {
          const st = S.h[i][k]; if (st !== 0 && !(st > 0 && S.t - n < 0.2)) return;
          const x = 157 + (n - S.t) * 240; if (x > 660 || x < 120) return;
          c.fillStyle = st > 0 ? '#ffffff' : '#ffd040'; c.beginPath(); c.arc(x, y, st > 0 ? 14 : 10, 0, 7); c.fill();
          c.fillStyle = st > 0 ? 'rgba(255,255,255,0.4)' : 'rgba(255,200,40,0.35)'; c.beginPath(); c.arc(x, y, 16, 0, 7); c.fill();
        });
        if (j && S.t - j.t < 0.5) A.txt(c, j.k === 2 ? A.L({ zh: '妙！', en: 'Perfect!' }) : j.k === 1 ? A.L({ zh: '好', en: 'Good' }) : A.L({ zh: '亂點！', en: 'Oops!' }), 200, y - 18 - (S.t - j.t) * 30, { size: 16, color: j.k === 2 ? '#ffe040' : j.k ? '#a0ffa0' : '#ff7070' });
      }
    },
  },

  // =================================================================== 3. qinggong rooftop race
  rooftop: {
    name: { zh: '輕功屋頂賽', en: 'Qinggong Rooftop Race' }, mode: 'ffa', dur: 34, icon: '飛',
    desc: { zh: '在屋頂上一路飛奔，遇到屋縫就跳！掉下去要爬回來。先到終點的人贏。', en: 'Dash across the rooftops and leap every gap! Fall in and you lose time climbing out. First to the finish wins.' },
    ctrl: { zh: 'A / 空白鍵 / 點擊 跳', en: 'A / Space / tap to jump' },
    init(S) {
      const gaps = []; let x = 420;
      while (x < 3800) { const len = 46 + R() * 58; gaps.push([Math.round(x), Math.round(len)]); x += len + 170 + R() * 230; }
      S.gaps = gaps; S.goal = 4000; S.p = [0, 1, 2, 3].map(() => ({ d: 40, y: 0, vy: 0, fall: 0, fin: 0 }));
    },
    step(S, I, dt) {
      S.p.forEach((p, i) => {
        if (p.fin) return;
        if (p.fall > 0) { p.fall -= dt; p.y -= 300 * dt; if (p.fall <= 0) { const g = S.gaps.find(g => p.d >= g[0] - 30 && p.d <= g[0] + g[1] + 5); p.d = g ? g[0] - 36 : p.d; p.y = 0; p.vy = 0; } return; }
        p.d += 185 * dt;
        if (p.y > 0 || p.vy > 0) { p.vy -= 1500 * dt; p.y += p.vy * dt; if (p.y <= 0) { p.y = 0; p.vy = 0; } }
        else if (I[i].p > 0) p.vy = 520;
        if (p.y <= 0 && S.gaps.some(g => p.d > g[0] + 6 && p.d < g[0] + g[1] - 6)) { p.fall = 0.9; }
        if (p.d >= S.goal) p.fin = S.t;
      });
    },
    done: (S) => S.p.every(p => p.fin),
    score: (S) => S.p.map(p => p.fin ? 10000 - p.fin * 10 : p.d),
    bot(S, i, sk, M) {
      const p = S.p[i]; const g = S.gaps.find(g => g[0] + g[1] > p.d);
      if (!g || p.y > 0 || p.fall > 0) return { x: 0, y: 0, a: false, p: 0 };
      if (M.g !== g[0]) { M.g = g[0]; M.at = g[0] - (128 - g[1]) / 2 - 6 + gauss() * (1 - sk) * 30; }
      if (p.d >= M.at) { M.g = -1; return { x: 0, y: 0, a: true, p: 1 }; }
      return { x: 0, y: 0, a: false, p: 0 };
    },
    draw(c, S, A) {
      for (let i = 0; i < 4; i++) {
        const p = S.p[i], y0 = i * 90, cam = p.d - 150;
        c.save(); c.beginPath(); c.rect(0, y0, 640, 90); c.clip();
        const g = c.createLinearGradient(0, y0, 0, y0 + 90); g.addColorStop(0, '#ffb070'); g.addColorStop(1, '#ffe0b0'); c.fillStyle = g; c.fillRect(0, y0, 640, 90);
        c.fillStyle = 'rgba(90,60,110,0.35)'; for (let k = -1; k < 8; k++) { const bx = k * 120 - ((cam * 0.3) % 120); c.fillRect(bx, y0 + 40, 90, 50); c.beginPath(); c.moveTo(bx - 12, y0 + 42); c.lineTo(bx + 45, y0 + 26); c.lineTo(bx + 102, y0 + 42); c.fill(); }
        // roofs between gaps
        const top = y0 + 70; let x = -1000;
        const segs = []; for (const gp of S.gaps) { segs.push([x, gp[0]]); x = gp[0] + gp[1]; } segs.push([x, S.goal + 600]);
        for (const [a, b] of segs) { const sa = a - cam, sb = b - cam; if (sb < 0 || sa > 640) continue; c.fillStyle = '#2a3a5a'; c.fillRect(sa, top, sb - sa, 20); c.fillStyle = '#3a5078'; for (let k = Math.max(sa, 0) - ((Math.max(sa, 0) - sa) % 14); k < Math.min(sb, 640); k += 14) c.fillRect(k, top, 9, 6); c.fillStyle = '#c0302a'; c.fillRect(sa, top + 14, sb - sa, 4); }
        const gx = S.goal - cam; if (gx < 680) { c.fillStyle = '#fff'; c.fillRect(gx, y0 + 10, 4, 60); c.fillStyle = '#e83a2a'; c.fillRect(gx + 4, y0 + 10, 30, 18); }
        A.spr(c, i, 150, top - p.y + (p.fall > 0 ? 0 : 0), 2.3, { side: true, walk: !p.fin && p.y <= 0 && p.fall <= 0 && S.t > 0, alpha: p.fall > 0 ? 0.6 : 1 });
        A.txt(c, Math.min(100, Math.round(p.d / S.goal * 100)) + '%', 540, y0 + 22, { size: 14, color: '#fff', stroke: A.col(i) });
        if (p.fin) A.txt(c, A.L({ zh: '到！', en: 'Done!' }), 320, y0 + 40, { size: 20, color: '#ffe040', stroke: '#6a3a00' });
        c.restore(); c.fillStyle = A.col(i); c.fillRect(0, y0, 6, 90);
      }
    },
  },

  // =================================================================== 4. bun-eating contest
  buns: {
    name: { zh: '包子大胃王', en: 'Bun-Eating Contest' }, mode: 'ffa', dur: 20, icon: '包',
    desc: { zh: '狂按吃包子！可是小心——紅色的辣椒包一咬就噴火，要等它被收走再吃。', en: 'Mash to eat buns! But beware - bite a red chilli bun and you breathe fire. Wait for it to be taken away.' },
    ctrl: { zh: '連按 A / 空白鍵 / 點擊', en: 'Mash A / Space / tap' },
    init(S) { S.p = [0, 1, 2, 3].map(() => ({ b: 0, buns: 0, hot: 0, ht: 1.5 + R() * 3, st: 0 })); },
    step(S, I, dt) {
      S.p.forEach((p, i) => {
        if (p.st > 0) { p.st -= dt; return; }
        if (p.hot > 0) { p.hot -= dt; if (p.hot <= 0) p.ht = 1.8 + R() * 3; }
        else if ((p.ht -= dt) <= 0) p.hot = 1.3;
        for (let k = 0; k < I[i].p; k++) {
          if (p.hot > 0) { p.st = 1.6; p.hot = 0; p.ht = 2 + R() * 2.5; break; }
          if (++p.b >= 6) { p.b = 0; p.buns++; }
        }
      });
    },
    score: (S) => S.p.map(p => p.buns * 6 + p.b),
    bot(S, i, sk, M) {
      const p = S.p[i]; M.acc = (M.acc || 0) + (6 + sk * 5 + gauss()) / 30;
      if (p.hot > 0) { M.seen = (M.seen || 0) + 1 / 30; if (M.seen > 0.5 - 0.38 * sk) M.acc = 0; } else M.seen = 0;
      const n = Math.floor(M.acc); M.acc -= n; return { x: 0, y: 0, a: n > 0, p: n };
    },
    draw(c, S, A) {
      sky(c, '#f8d8a0', '#f0b878'); c.fillStyle = '#8a4a2a'; c.fillRect(0, 230, 640, 130); c.fillStyle = '#a0603a'; c.fillRect(0, 230, 640, 10);
      c.fillStyle = '#c0302a'; c.fillRect(0, 0, 640, 26); A.txt(c, A.L({ zh: '包子大胃王 擂台', en: 'BUN CHAMPIONSHIP' }), 480, 14, { size: 14, color: '#ffe040' });
      S.p.forEach((p, i) => {
        const x = 80 + i * 160;
        A.spr(c, i, x, 232, 4, { frame: (p.b % 2), blink: false });
        if (p.st > 0) { for (let k = 0; k < 6; k++) { c.fillStyle = k % 2 ? '#ff8a20' : '#ffd040'; c.beginPath(); c.arc(x + 20 + k * 8 + R() * 4, 150 + Math.sin(S.t * 30 + k) * 4, 8 - k, 0, 7); c.fill(); } A.txt(c, A.L({ zh: '辣！', en: 'HOT!' }), x, 120, { size: 20, color: '#ff4020', stroke: '#fff' }); }
        // stack of eaten plates + the bun
        for (let k = 0; k < Math.min(p.buns, 12); k++) { c.fillStyle = '#f0f0f0'; c.fillRect(x - 60, 296 - k * 5, 28, 4); c.fillStyle = '#c8c8c8'; c.fillRect(x - 60, 299 - k * 5, 28, 1); }
        const hot = p.hot > 0; const bite = 1 - p.b / 6;
        c.fillStyle = hot ? '#e83a2a' : '#fff4e0'; c.beginPath(); c.ellipse(x + 10, 262, 26 * (0.4 + 0.6 * bite), 18 * (0.5 + 0.5 * bite), 0, 0, 7); c.fill();
        c.strokeStyle = hot ? '#8a1a10' : '#d8c0a0'; c.lineWidth = 2; c.stroke();
        if (hot) { c.fillStyle = '#2a8a2a'; c.fillRect(x + 6, 240, 6, 8); }
        c.fillStyle = '#8a6a4a'; c.fillRect(x - 20, 280, 60, 6);
        A.txt(c, String(p.buns), x + 50, 330, { size: 26, color: '#fff', stroke: A.col(i) });
        A.tag(c, i, x, 350);
      });
    },
  },

  // =================================================================== 5. lantern catching
  lanterns: {
    name: { zh: '接燈籠', en: 'Lantern Catch' }, mode: 'ffa', dur: 30, icon: '燈',
    desc: { zh: '元宵夜，燈籠飄下來了！紅燈籠 1 分，金燈籠 3 分；黑色的鞭炮會炸你一臉，扣 2 分。', en: 'Lantern festival night! Red lanterns are 1 point, gold ones 3. Black firecrackers blow up in your face: -2.' },
    ctrl: { zh: '← → 移動', en: '← → move' },
    init(S) { S.p = [0, 1, 2, 3].map(i => ({ x: 110 + i * 140, sc: 0, st: 0, f: 1 })); S.o = []; S.sp = 0.3; S.fx = []; },
    step(S, I, dt) {
      S.p.forEach((p, i) => { if (p.st > 0) { p.st -= dt; return; } p.x = clamp(p.x + I[i].x * 230 * dt, 24, 616); if (I[i].x) p.f = Math.sign(I[i].x); });
      if ((S.sp -= dt) <= 0) { S.sp = 0.32 + R() * 0.25; const r = R(); S.o.push({ x: 30 + R() * 580, y: -20, vy: r < 0.2 ? 150 : 90 + R() * 50, k: r < 0.2 ? 3 : r < 0.42 ? -2 : 1, ph: R() * 6 }); }
      for (const o of S.o) { o.y += o.vy * dt; o.x += Math.sin(S.t * 2 + o.ph) * 20 * dt; }
      S.o = S.o.filter(o => {
        if (o.y > 236 && o.y < 272) { const hit = S.p.find(p => p.st <= 0 && Math.abs(p.x - o.x) < 26); if (hit) { if (o.k < 0) { hit.sc = Math.max(0, hit.sc - 2); hit.st = 1.0; } else hit.sc += o.k; S.fx.push({ x: o.x, y: o.y, k: o.k, t: S.t }); return false; } }
        return o.y < 380;
      });
      S.fx = S.fx.filter(f => S.t - f.t < 0.6);
    },
    score: (S) => S.p.map(p => p.sc),
    bot(S, i, sk, M) {
      const p = S.p[i]; M.re = (M.re || 0) - 1 / 30;
      if (M.re <= 0) {
        M.re = 0.3 - 0.2 * sk; let best = null, bv = -1;
        for (const o of S.o) { const tt = (250 - o.y) / o.vy; if (tt < 0.05) continue; const reach = Math.abs(o.x - p.x) / 230; if (reach > tt + 0.1) continue; const rival = S.p.some((q, j) => j !== i && Math.abs(q.x - o.x) < Math.abs(p.x - o.x) - 10); const v = o.k < 0 ? -1 : o.k / (0.3 + tt) * (rival ? 0.3 : 1); if (v > bv) { bv = v; best = o; } }
        M.tx = best ? best.x : p.x; M.bomb = S.o.find(o => o.k < 0 && o.y > 170 && o.y < 260 && Math.abs(o.x - p.x) < 34);
      }
      if (M.bomb && sk > R() * 0.8) return { x: p.x > M.bomb.x ? 1 : -1, y: 0, a: false, p: 0 };
      const crowd = S.p.find((q, j) => j !== i && Math.abs(q.x - p.x) < 26);
      if (crowd && (M.cr = (M.cr || 0) + 1) % 40 < 12) return { x: p.x >= crowd.x ? (p.x > 580 ? -1 : 1) : (p.x < 60 ? 1 : -1), y: 0, a: false, p: 0 };
      const d = M.tx - p.x; return { x: Math.abs(d) < 8 ? 0 : Math.sign(d), y: 0, a: false, p: 0 };
    },
    draw(c, S, A) {
      sky(c, '#1a1a4a', '#3a2a6a'); c.fillStyle = '#fff'; for (let k = 0; k < 30; k++) c.fillRect((k * 97) % 640, (k * 53) % 200, 2, 2);
      c.fillStyle = '#2a1a3a'; for (let k = 0; k < 8; k++) { c.fillRect(k * 86, 200, 70, 100); c.beginPath(); c.moveTo(k * 86 - 10, 204); c.lineTo(k * 86 + 35, 180); c.lineTo(k * 86 + 80, 204); c.fill(); }
      ground(c, GROUND, '#5a4a6a', '#3a2a4a');
      for (const o of S.o) {
        if (o.k < 0) { c.fillStyle = '#2a2a2a'; c.fillRect(o.x - 6, o.y - 14, 12, 26); c.fillStyle = '#e83a2a'; c.fillRect(o.x - 6, o.y - 6, 12, 4); c.fillStyle = (S.t * 10 | 0) % 2 ? '#ffe040' : '#ff8020'; c.beginPath(); c.arc(o.x, o.y - 18, 4, 0, 7); c.fill(); continue; }
        const gold = o.k === 3; c.fillStyle = gold ? 'rgba(255,220,80,0.3)' : 'rgba(255,90,60,0.25)'; c.beginPath(); c.arc(o.x, o.y, 24, 0, 7); c.fill();
        c.fillStyle = gold ? '#ffcc30' : '#e83a2a'; c.beginPath(); c.ellipse(o.x, o.y, 13, 16, 0, 0, 7); c.fill(); c.fillStyle = '#ffe080'; c.fillRect(o.x - 7, o.y - 17, 14, 4); c.fillRect(o.x - 7, o.y + 13, 14, 4);
      }
      S.p.forEach((p, i) => { A.spr(c, i, p.x, GROUND + 2, 3, { walk: p.st <= 0 && S.t > 0, flip: p.f < 0, blink: p.st > 0 }); if (p.st > 0) { stars(c, p.x, GROUND - 70, S.t); c.fillStyle = 'rgba(40,40,40,0.5)'; c.beginPath(); c.arc(p.x, GROUND - 50, 20, 0, 7); c.fill(); } A.txt(c, String(p.sc), p.x, GROUND - 82, { size: 16, color: '#fff', stroke: A.col(i) }); A.tag(c, i, p.x, GROUND + 22); });
      for (const f of S.fx) A.txt(c, (f.k > 0 ? '+' : '') + f.k, f.x, f.y - 30 - (S.t - f.t) * 40, { size: 18, color: f.k > 0 ? '#ffe040' : '#ff6060' });
    },
  },

  // =================================================================== 6. sword-catch reflex
  swordcatch: {
    name: { zh: '接劍！', en: 'Catch the Sword!' }, mode: 'ffa', dur: 40, icon: '劍',
    desc: { zh: '白先生會丟出一把劍。看到「接！」就搶著按！太早按會被扣分——他有時候丟的是雞腿。', en: 'Mr Bai tosses a sword. When you see "CATCH!", press first! Press early and you lose a point - sometimes he throws a chicken leg.' },
    ctrl: { zh: 'A / 空白鍵 / 點擊', en: 'A / Space / tap' },
    init(S) { S.sc = [0, 0, 0, 0]; S.r = 0; this.next(S); },
    next(S) { S.r++; S.ph = 'wait'; S.sig = S.t + 1.6 + R() * 2.4; S.fake = R() < 0.45 ? S.t + 0.8 + R() * (S.sig - S.t - 1.2) : -1; S.ord = []; S.fault = [0, 0, 0, 0]; S.end = 0; },
    step(S, I) {
      if (S.ph === 'res') { if (S.t > S.end) { if (S.r >= 5) S.fin = true; else this.next(S); } return; }
      const sig = S.t >= S.sig;
      for (let i = 0; i < 4; i++) {
        if (!I[i].p || S.fault[i] || S.ord.includes(i)) continue;
        if (!sig) { S.fault[i] = 1; S.sc[i] = Math.max(0, S.sc[i] - 1); } else S.ord.push(i);
      }
      if (sig && (S.t > S.sig + 1.4 || S.ord.length + S.fault.reduce((a, b) => a + b, 0) >= 4)) { S.ord.forEach((i, k) => { if (k < 3) S.sc[i] += 3 - k; }); S.ph = 'res'; S.end = S.t + 1.6; }
    },
    done: (S) => !!S.fin,
    score: (S) => S.sc.slice(),
    bot(S, i, sk, M) {
      if (S.ph !== 'wait') { M.r = 0; return { x: 0, y: 0, a: false, p: 0 }; }
      if (M.r !== S.r) { M.r = S.r; M.rt = 0.2 + (1 - sk) * 0.32 + R() * 0.12; M.fk = R() < 0.35 * (1 - sk); }
      if (S.t >= S.sig + M.rt) return { x: 0, y: 0, a: true, p: 1 };
      if (M.fk && S.fake > 0 && S.t > S.fake + 0.25 && S.t < S.sig) { M.fk = false; return { x: 0, y: 0, a: true, p: 1 }; }
      return { x: 0, y: 0, a: false, p: 0 };
    },
    draw(c, S, A) {
      sky(c, '#a8d8f0', '#f0f4e0'); ground(c, 270, '#d8c090', '#b8a070');
      A.npc(c, 'baixian', 320, 150, 3.4, { frame: S.t >= S.sig || (S.fake > 0 && S.t > S.fake && S.t < S.fake + 0.6) ? 1 : 0 });
      const sig = S.t >= S.sig && S.ph !== 'res';
      if (S.fake > 0 && S.t > S.fake && S.t < S.fake + 0.7) { A.txt(c, A.L({ zh: '雞腿！', en: 'Drumstick!' }), 320, 60, { size: 30, color: '#f0a040', stroke: '#6a3a00' }); c.fillStyle = '#c87a3a'; c.beginPath(); c.ellipse(370, 90, 16, 11, 0.5, 0, 7); c.fill(); c.fillStyle = '#fff'; c.fillRect(380, 96, 10, 4); }
      if (sig) { A.txt(c, A.L({ zh: '接！', en: 'CATCH!' }), 320, 62, { size: 48, color: '#ff3a3a', stroke: '#fff' }); }
      S.sc.forEach((s, i) => {
        const x = 110 + i * 140; const got = S.ord.indexOf(i);
        A.spr(c, i, x, 330, 3.2, { frame: got >= 0 ? 1 : 0, blink: S.fault[i] && (S.t * 8 | 0) % 2 });
        A.txt(c, String(s), x, 352, { size: 18, color: '#fff', stroke: A.col(i) });
        if (S.fault[i]) A.txt(c, A.L({ zh: '太早！', en: 'Too soon!' }), x, 220, { size: 16, color: '#ff5050', stroke: '#fff' });
        if (got >= 0) { A.txt(c, ['1', '2', '3', '4'][got], x, 220, { size: 26, color: '#ffe040', stroke: '#6a3a00' }); if (got === 0) { c.save(); c.translate(x + 26, 240); c.rotate(-0.6); c.fillStyle = '#d8e0e8'; c.fillRect(-3, -40, 6, 46); c.fillStyle = '#8a5a2a'; c.fillRect(-8, 6, 16, 5); c.fillRect(-2.5, 10, 5, 14); c.restore(); } }
      });
      A.txt(c, (S.r) + ' / 5', 40, 46, { size: 16, color: '#3a2a1a' });
    },
  },

  // =================================================================== 7. bamboo balance
  balance: {
    name: { zh: '竹竿平衡', en: 'Bamboo Balance' }, mode: 'ffa', dur: 30, icon: '竹',
    desc: { zh: '站在竹竿頂上，山風一陣陣吹來！往反方向壓住，別掉下去。撐最久的人贏。', en: 'Stand on top of a bamboo pole while the mountain wind gusts! Lean against it and don\'t fall. Last one up wins.' },
    ctrl: { zh: '← → 保持平衡', en: '← → keep your balance' },
    init(S) { S.p = [0, 1, 2, 3].map(() => ({ a: gauss() * 0.04, w: 0, out: false, ot: 0 })); S.wind = 0; S.gust = 0; },
    step(S, I, dt) {
      S.gust += dt; const amp = 0.35 + S.t * 0.045;
      S.wind = Math.sin(S.t * 0.9) * amp + Math.sin(S.t * 2.3 + 1) * amp * 0.5;
      S.p.forEach((p, i) => {
        if (p.out) { p.a += Math.sign(p.a) * dt * 3; return; }
        p.w += (2.6 * Math.sin(p.a) + S.wind * 0.9 + I[i].x * 4.2 + gauss() * 0.3) * dt; p.w *= 1 - 0.9 * dt; p.a += p.w * dt;
        if (Math.abs(p.a) > 0.95) { p.out = true; p.ot = S.t; }
      });
    },
    done: (S) => S.p.filter(p => !p.out).length <= 1 && S.t > 3,
    score: (S) => S.p.map(p => p.out ? p.ot : 100 - Math.abs(p.a)),
    bot(S, i, sk, M) {
      const p = S.p[i]; M.re = (M.re || 0) - 1 / 30;
      if (M.re <= 0) { M.re = 0.06 + (1 - sk) * 0.22; const u = -(p.a * (2.2 + sk * 2) + p.w * (0.8 + sk) + S.wind * 0.2 * sk); M.u = clamp(u + gauss() * (1 - sk) * 0.5, -1, 1); }
      return { x: Math.abs(M.u) < 0.15 ? 0 : M.u, y: 0, a: false, p: 0 };
    },
    draw(c, S, A) {
      sky(c, '#c8e8f8', '#e8f8e0'); c.fillStyle = '#9ac88a'; c.beginPath(); c.moveTo(0, 300); c.quadraticCurveTo(320, 250, 640, 300); c.lineTo(640, 360); c.lineTo(0, 360); c.fill();
      for (let k = 0; k < 5; k++) { c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 2; const y = 60 + k * 40, x = ((S.t * 120 * Math.sign(S.wind || 1) + k * 170) % 760 + 760) % 760 - 60; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 40 * Math.sign(S.wind || 1), y); c.stroke(); }
      A.txt(c, (S.wind > 0 ? '→' : '←').repeat(1 + Math.min(3, Math.abs(S.wind) * 2 | 0)), 320, 30, { size: 20, color: '#4a7a9a' });
      S.p.forEach((p, i) => {
        const bx = 100 + i * 147, by = 320; const top = [bx + Math.sin(p.a) * 200, by - Math.cos(p.a) * 200];
        c.strokeStyle = '#6a9a3a'; c.lineWidth = 9; c.beginPath(); c.moveTo(bx, by); c.lineTo(top[0], top[1]); c.stroke();
        c.strokeStyle = '#4a7a2a'; c.lineWidth = 9; for (let k = 1; k < 5; k++) { c.beginPath(); c.moveTo(bx + Math.sin(p.a) * 40 * k - 0.5, by - Math.cos(p.a) * 40 * k); c.lineTo(bx + Math.sin(p.a) * (40 * k + 3), by - Math.cos(p.a) * (40 * k + 3)); c.stroke(); }
        A.spr(c, i, top[0], top[1] + 2, 2.6, { rot: p.a * 1.1, alpha: p.out ? 0.5 : 1 });
        if (p.out) A.txt(c, A.L({ zh: '哇啊！', en: 'Waah!' }), top[0], top[1] - 70, { size: 16, color: '#ff5050', stroke: '#fff' });
        A.tag(c, i, bx, 345);
      });
    },
  },

  // =================================================================== 8. ring pushing match
  sumo: {
    name: { zh: '擂台推手', en: 'Ring Push-Out' }, mode: 'ffa', dur: 40, icon: '擂',
    desc: { zh: '在擂台上把別人推下去！按 A 衝撞。最後還站在台上的人贏。', en: 'Shove everyone off the stage! Press A to charge. The last one standing wins.' },
    ctrl: { zh: '方向 移動　A 衝撞', en: 'Stick move, A charge' },
    init(S) { S.R = 150; S.p = [0, 1, 2, 3].map(i => { const a = i * Math.PI / 2 + Math.PI / 4; return { x: 320 + Math.cos(a) * 80, y: 190 + Math.sin(a) * 80, vx: 0, vy: 0, cd: 0, dash: 0, out: false, ot: 0, f: 1 }; }); },
    step(S, I, dt) {
      const P = S.p;
      P.forEach((p, i) => {
        if (p.out) { p.fz = (p.fz || 0) + dt; return; }
        const ix = I[i].x, iy = I[i].y; p.vx += ix * 620 * dt; p.vy += iy * 620 * dt; if (ix) p.f = Math.sign(ix);
        p.cd -= dt; p.dash -= dt;
        if (I[i].p > 0 && p.cd <= 0) { let dx = ix, dy = iy; if (!dx && !dy) dx = p.f; const m = Math.hypot(dx, dy); p.vx += dx / m * 430; p.vy += dy / m * 430; p.cd = 1.1; p.dash = 0.3; }
        p.vx *= 1 - 3 * dt; p.vy *= 1 - 3 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      });
      for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) {
        const p = P[a], q = P[b]; if (p.out || q.out) continue; const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy) || 1;
        if (d < 36) { const nx = dx / d, ny = dy / d; const rel = (p.vx - q.vx) * nx + (p.vy - q.vy) * ny; const push = Math.max(0, rel) * 1.1 + 40; const kp = p.dash > 0 ? 0.4 : 1, kq = q.dash > 0 ? 0.4 : 1;
          p.vx -= nx * push * kp; p.vy -= ny * push * kp; q.vx += nx * push * kq; q.vy += ny * push * kq; const o = (36 - d) / 2; p.x -= nx * o; p.y -= ny * o; q.x += nx * o; q.y += ny * o; }
      }
      P.forEach(p => { if (!p.out && Math.hypot(p.x - 320, p.y - 190) > S.R + 6) { p.out = true; p.ot = S.t; } });
    },
    done: (S) => S.p.filter(p => !p.out).length <= 1,
    score: (S) => S.p.map(p => p.out ? p.ot : 100),
    bot(S, i, sk, M) {
      const p = S.p[i]; if (p.out) return { x: 0, y: 0, a: false, p: 0 };
      const dc = Math.hypot(p.x - 320, p.y - 190);
      let tx, ty; let tgt = null, bd = 1e9; S.p.forEach((q, j) => { if (j !== i && !q.out) { const d = Math.hypot(q.x - p.x, q.y - p.y); if (d < bd) { bd = d; tgt = q; } } });
      if (dc > S.R * (0.55 + 0.15 * sk) || !tgt) { tx = 320; ty = 190; } else { tx = tgt.x + (tgt.x - 320) * 0.15; ty = tgt.y + (tgt.y - 190) * 0.15; }
      const dx = tx - p.x, dy = ty - p.y, m = Math.hypot(dx, dy) || 1;
      const jit = (1 - sk) * 0.6; const x = clamp(dx / m + gauss() * jit, -1, 1), y = clamp(dy / m + gauss() * jit, -1, 1);
      const dash = tgt && bd < 70 && p.cd <= 0 && dc < S.R * 0.8 && R() < 0.15 + sk * 0.3;
      return { x, y, a: dash, p: dash ? 1 : 0 };
    },
    draw(c, S, A) {
      sky(c, '#3a6a4a', '#2a4a3a');
      c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(320, 200, S.R + 26, (S.R + 26) * 0.95, 0, 0, 7); c.fill();
      c.fillStyle = '#c84a3a'; c.beginPath(); c.arc(320, 190, S.R + 18, 0, 7); c.fill();
      c.fillStyle = '#f0d8a8'; c.beginPath(); c.arc(320, 190, S.R, 0, 7); c.fill();
      c.strokeStyle = '#c8a878'; c.lineWidth = 3; c.beginPath(); c.arc(320, 190, S.R * 0.55, 0, 7); c.stroke();
      A.txt(c, '擂', 320, 200, { size: 40, color: 'rgba(200,74,58,0.25)' });
      const order = S.p.map((p, i) => i).sort((a, b) => S.p[a].y - S.p[b].y);
      for (const i of order) { const p = S.p[i]; if (p.out) { const k = Math.min(1, (p.fz || 0) * 2); A.spr(c, i, p.x, p.y + 14 + k * 60, 2.6 * (1 - k * 0.5), { alpha: 1 - k, rot: k * 3 }); continue; } shadow(c, p.x, p.y + 14, 14); A.spr(c, i, p.x, p.y + 14, 2.6, { walk: Math.hypot(p.vx, p.vy) > 30, flip: p.f < 0 }); if (p.dash > 0) { c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 3; c.beginPath(); c.arc(p.x, p.y - 10, 26, 0, 7); c.stroke(); } A.tag(c, i, p.x, p.y + 30); }
    },
  },

  // =================================================================== 9. hidden-weapon targets
  darts: {
    name: { zh: '暗器打靶', en: 'Hidden-Weapon Targets' }, mode: 'ffa', dur: 30, icon: '鏢',
    desc: { zh: '用飛鏢射冒出來的靶！木靶 1 分、小金靶 3 分。射到白先生的紙板人像要扣 2 分。', en: 'Throw darts at targets as they pop up! Wooden ones are 1, little gold ones 3. Hit the cardboard Mr Bai and lose 2.' },
    ctrl: { zh: '方向 瞄準　A 發射', en: 'Stick aim, A throw' },
    init(S) { S.p = [0, 1, 2, 3].map(i => ({ x: 160 + i * 110, y: 200, cd: 0, sc: 0 })); S.tg = []; S.sp = 0.5; S.hits = []; S.nid = 0; },
    step(S, I, dt) {
      if ((S.sp -= dt) <= 0 && S.tg.length < 5) { S.sp = 0.5 + R() * 0.4; const r = R(); S.tg.push({ id: S.nid++, x: 60 + R() * 520, y: 70 + R() * 200, k: r < 0.18 ? 3 : r < 0.36 ? -2 : 1, life: r < 0.18 ? 1.3 : 2.0 }); }
      S.tg.forEach(t => t.life -= dt); S.tg = S.tg.filter(t => t.life > 0);
      S.p.forEach((p, i) => {
        p.x = clamp(p.x + I[i].x * 300 * dt, 20, 620); p.y = clamp(p.y + I[i].y * 300 * dt, 40, 320); p.cd -= dt;
        if (I[i].p > 0 && p.cd <= 0) {
          p.cd = 0.35; const t = S.tg.find(t => Math.hypot(t.x - p.x, t.y - p.y) < (t.k === 3 ? 13 : t.k < 0 ? 22 : 19));
          S.hits.push({ x: p.x, y: p.y, i, t: S.t, k: t ? t.k : 0 });
          if (t) { p.sc = Math.max(0, p.sc + t.k); S.tg = S.tg.filter(o => o !== t); }
        }
      });
      S.hits = S.hits.filter(h => S.t - h.t < 0.7);
    },
    score: (S) => S.p.map(p => p.sc),
    bot(S, i, sk, M) {
      const p = S.p[i]; M.re = (M.re || 0) - 1 / 30;
      if (M.re <= 0 || !S.tg.find(t => t.id === M.id)) {
        M.re = 0.4; let best = null, bv = -1;
        for (const t of S.tg) { const fool = t.k < 0 && R() < 0.15 * (1 - sk); if (t.k < 0 && !fool) continue; const d = Math.hypot(t.x - p.x, t.y - p.y); const v = Math.abs(t.k) / (60 + d); if (v > bv) { bv = v; best = t; } }
        M.id = best ? best.id : -1;
      }
      const t = S.tg.find(t => t.id === M.id); if (!t) return { x: 0, y: 0, a: false, p: 0 };
      const dx = t.x - p.x, dy = t.y - p.y, d = Math.hypot(dx, dy); const sp = 0.45 + 0.55 * sk;
      const fire = d < 9 + (1 - sk) * 6 && p.cd <= 0;
      return { x: d > 4 ? clamp(dx / 30, -1, 1) * sp : 0, y: d > 4 ? clamp(dy / 30, -1, 1) * sp : 0, a: fire, p: fire ? 1 : 0 };
    },
    draw(c, S, A) {
      c.fillStyle = '#a0703a'; c.fillRect(0, 0, 640, 360); c.fillStyle = '#8a5a2a'; for (let y = 0; y < 360; y += 30) c.fillRect(0, y, 640, 3);
      for (const t of S.tg) {
        const pop = Math.min(1, (t.k === 3 ? 1.3 : 2.0) - t.life < 0.15 ? ((t.k === 3 ? 1.3 : 2.0) - t.life) / 0.15 : t.life < 0.15 ? t.life / 0.15 : 1);
        if (t.k < 0) { A.npc(c, 'baixian', t.x, t.y + 30 * pop, 2.2 * pop, {}); A.txt(c, '-2', t.x + 22, t.y - 30, { size: 12, color: '#ff5050' }); continue; }
        const r = (t.k === 3 ? 13 : 20) * pop; const cols = t.k === 3 ? ['#ffd040', '#e8a020', '#ffd040'] : ['#f0e0c0', '#e83a2a', '#f0e0c0'];
        for (let k = 0; k < 3; k++) { c.fillStyle = cols[k]; c.beginPath(); c.arc(t.x, t.y, r * (1 - k * 0.32), 0, 7); c.fill(); }
      }
      for (const h of S.hits) { c.fillStyle = '#d0d8e0'; c.save(); c.translate(h.x, h.y); c.rotate(-0.8); c.fillRect(-1.5, -16, 3, 16); c.restore(); if (h.k) A.txt(c, (h.k > 0 ? '+' : '') + h.k, h.x, h.y - 22 - (S.t - h.t) * 30, { size: 16, color: h.k > 0 ? '#ffe040' : '#ff5050', stroke: '#3a2a1a' }); }
      S.p.forEach((p, i) => { c.strokeStyle = A.col(i); c.lineWidth = 3; c.beginPath(); c.arc(p.x, p.y, 14, 0, 7); c.moveTo(p.x - 20, p.y); c.lineTo(p.x - 6, p.y); c.moveTo(p.x + 6, p.y); c.lineTo(p.x + 20, p.y); c.moveTo(p.x, p.y - 20); c.lineTo(p.x, p.y - 6); c.moveTo(p.x, p.y + 6); c.lineTo(p.x, p.y + 20); c.stroke(); });
      S.p.forEach((p, i) => { A.port(c, i, 8 + i * 160, 326, 26); A.txt(c, String(p.sc), 60 + i * 160, 346, { size: 20, color: '#fff', stroke: A.col(i) }); });
    },
  },

  // =================================================================== 10. find the real Mr Bai
  findbai: {
    name: { zh: '真假白先生', en: 'Find the Real Mr Bai' }, mode: 'ffa', dur: 45, icon: '真',
    desc: { zh: '瘦猴們假扮成白先生混在一起！盯住真的那位，等他們換完位置再選出來。', en: 'The Skinny Monkeys are disguised as Mr Bai! Keep your eye on the real one while they shuffle, then pick him.' },
    ctrl: { zh: '← → 選　A 確定', en: '← → choose, A confirm' },
    init(S) { S.sc = [0, 0, 0, 0]; S.r = 0; S.slot = [0, 1, 2, 3, 4]; this.next(S); },
    next(S) {
      S.r++; S.ph = 'show'; S.pt = S.t + 1.8; S.sw = []; const n = 4 + S.r * 2; let last = -1;
      for (let k = 0; k < n; k++) { let a, b; do { a = R() * 5 | 0; b = R() * 5 | 0; } while (a === b || a * 5 + b === last); last = a * 5 + b; S.sw.push([a, b]); }
      S.swd = Math.max(0.28, 0.6 - S.r * 0.08); S.k = 0; S.sel = [2, 2, 2, 2]; S.lock = [0, 0, 0, 0]; S.lx = [0, 0, 0, 0]; S.first = -1;
    },
    // which slot each bai stands in after k swaps (swaps exchange the bais standing in two slots)
    step(S, I) {
      if (S.ph === 'show' && S.t > S.pt) { S.ph = 'shuf'; S.pt = S.t; }
      if (S.ph === 'shuf') { const k = Math.floor((S.t - S.pt) / S.swd); while (S.k < Math.min(k, S.sw.length)) { const [a, b] = S.sw[S.k]; const ia = S.slot.indexOf(a), ib = S.slot.indexOf(b); S.slot[ia] = b; S.slot[ib] = a; S.k++; } if (S.k >= S.sw.length) { S.ph = 'pick'; S.pt = S.t + 7; } }
      if (S.ph === 'pick') {
        for (let i = 0; i < 4; i++) {
          if (S.lock[i]) continue; const sx = I[i].x > 0.5 ? 1 : I[i].x < -0.5 ? -1 : 0;
          if (sx && sx !== S.lx[i]) S.sel[i] = clamp(S.sel[i] + sx, 0, 4); S.lx[i] = sx;
          if (I[i].p > 0) { S.lock[i] = S.t; if (S.sel[i] === S.slot[0] && S.first < 0) S.first = i; }
        }
        if (S.t > S.pt || S.lock.every(v => v)) { for (let i = 0; i < 4; i++) if (S.lock[i] && S.sel[i] === S.slot[0]) S.sc[i] += 2 + (S.first === i ? 1 : 0); S.ph = 'rev'; S.pt = S.t + 2; }
      }
      if (S.ph === 'rev' && S.t > S.pt) { if (S.r >= 4) S.fin = true; else this.next(S); }
    },
    done: (S) => !!S.fin,
    score: (S) => S.sc.slice(),
    bot(S, i, sk, M) {
      if (S.ph !== 'pick' || S.lock[i]) { M.goal = null; return { x: 0, y: 0, a: false, p: 0 }; }
      if (M.goal == null) { M.goal = R() < 0.42 + 0.5 * sk ? S.slot[0] : R() * 5 | 0; M.at = S.t + 0.8 + R() * 2.5 * (1.2 - sk); M.mv = 0; }
      M.mv = (M.mv || 0) + 1;
      if (S.sel[i] !== M.goal) return { x: M.mv % 6 < 3 ? Math.sign(M.goal - S.sel[i]) : 0, y: 0, a: false, p: 0 };
      if (S.t > M.at) return { x: 0, y: 0, a: true, p: 1 };
      return { x: 0, y: 0, a: false, p: 0 };
    },
    draw(c, S, A) {
      sky(c, '#f0e0c0', '#d8c098'); c.fillStyle = '#7a3a2a'; c.fillRect(0, 0, 640, 40); c.fillStyle = '#c03a2a'; for (let x = 0; x < 640; x += 40) { c.beginPath(); c.moveTo(x, 40); c.quadraticCurveTo(x + 20, 64, x + 40, 40); c.fill(); }
      ground(c, 250, '#a8784a', '#8a5a3a');
      const sx = (s) => 100 + s * 110;
      // positions: during a swap the two slots trade with an arc
      for (let b = 0; b < 5; b++) {
        let x = sx(S.slot[b]), y = 240;
        if (S.ph === 'shuf' && S.k < S.sw.length) { const f = ((S.t - S.pt) / S.swd) - S.k; const [a, bb] = S.sw[S.k]; const s = S.slot[b]; if (s === a || s === bb) { const to = s === a ? bb : a; const e = clamp(f, 0, 1); x = sx(s) + (sx(to) - sx(s)) * e; y = 240 + Math.sin(e * Math.PI) * (s === a ? -40 : 30); } }
        const real = b === 0; const rev = S.ph === 'rev';
        if (rev && !real) { A.npc(c, 'shouhou', x, y, 3, {}); c.fillStyle = 'rgba(255,255,255,0.5)'; c.beginPath(); c.arc(x, y - 40, 30 * (1 - (S.pt - S.t) / 2), 0, 7); c.fill(); }
        else A.npc(c, 'baixian', x, y, 3, { frame: (S.t * 4 | 0) % 2 });
        if ((S.ph === 'show' || rev) && real) { c.fillStyle = 'rgba(255,230,80,0.35)'; c.beginPath(); c.arc(x, y - 36, 44, 0, 7); c.fill(); A.txt(c, A.L({ zh: '我才是真的！', en: 'I\'m the real one!' }), x, y - 92, { size: 14, color: '#3a2a1a', bubble: true }); }
      }
      for (let i = 0; i < 4; i++) {
        const x = sx(S.sel[i]) - 30 + i * 20; const y = 284 + (S.lock[i] ? 0 : Math.sin(S.t * 6 + i) * 3);
        if (S.ph === 'pick' || S.ph === 'rev') { c.fillStyle = A.col(i); c.beginPath(); c.moveTo(x, y - 12); c.lineTo(x - 8, y); c.lineTo(x + 8, y); c.fill(); if (S.lock[i]) A.txt(c, '✓', x, y + 14, { size: 12, color: A.col(i) }); }
        A.port(c, i, 10 + i * 160, 318, 32); A.txt(c, String(S.sc[i]), 70 + i * 160, 344, { size: 20, color: '#fff', stroke: A.col(i) });
      }
      A.txt(c, S.r + ' / 4', 600, 64, { size: 14, color: '#3a2a1a' });
      if (S.ph === 'pick') A.txt(c, A.L({ zh: '哪一個是真的？', en: 'Which one is real?' }) + ' ' + Math.max(0, Math.ceil(S.pt - S.t)), 320, 70, { size: 20, color: '#3a2a1a' });
    },
  },

  // =================================================================== 11. stacking tea cups
  teacups: {
    name: { zh: '疊茶杯', en: 'Tea-Cup Tower' }, mode: 'ffa', dur: 32, icon: '杯',
    desc: { zh: '茶杯左右晃，按下去放杯子！對不準的部分會掉下去，杯子越疊越窄。疊最高的人贏。', en: 'The cup swings side to side - press to drop it! Whatever overhangs breaks off, so the tower narrows. Tallest tower wins.' },
    ctrl: { zh: 'A / 空白鍵 / 點擊 放下', en: 'A / Space / tap to drop' },
    init(S) { S.p = [0, 1, 2, 3].map(i => ({ st: [[0, 64]], ph: R() * 6, out: false, fx: 0, pf: 0 })); },
    step(S, I, dt) {
      S.p.forEach((p, i) => {
        if (p.out) return; const h = p.st.length; p.ph += dt * (1.6 + h * 0.22);
        if (I[i].p > 0 && S.t > 0.2) {
          const top = p.st[h - 1]; const mx = Math.sin(p.ph) * 52; const w = top[1];
          if (Math.abs(mx - top[0]) < 3) { p.st.push([top[0], w]); p.pf = S.t; }
          else { const L = Math.max(mx - w / 2, top[0] - w / 2), Rr = Math.min(mx + w / 2, top[0] + w / 2); if (Rr - L < 6) { p.out = true; p.fx = S.t; } else p.st.push([(L + Rr) / 2, Rr - L]); }
        }
      });
    },
    done: (S) => S.p.every(p => p.out),
    score: (S) => S.p.map(p => p.st.length * 100 + p.st[p.st.length - 1][1]),
    bot(S, i, sk, M) {
      const p = S.p[i]; if (p.out) return { x: 0, y: 0, a: false, p: 0 };
      const top = p.st[p.st.length - 1]; const mx = Math.sin(p.ph) * 52; M.cd = (M.cd || 0) - 1 / 30;
      const tol = 3 + (1 - sk) * 16 + (M.miss ? 30 : 0);
      if (M.cd <= 0 && Math.abs(mx - top[0]) < tol) { M.cd = 0.5 + R() * 0.4; M.miss = R() < 0.05 + 0.05 * p.st.length * (1 - sk); return { x: 0, y: 0, a: true, p: 1 }; }
      return { x: 0, y: 0, a: false, p: 0 };
    },
    draw(c, S, A) {
      sky(c, '#f4e4c8', '#e0c8a0'); c.fillStyle = '#c8a070'; for (let y = 60; y < 300; y += 80) c.fillRect(0, y, 640, 6); c.fillStyle = '#b08050'; for (let k = 0; k < 14; k++) { c.beginPath(); c.arc(30 + k * 46, 52 + (k % 3) * 80, 9, Math.PI, 0); c.fill(); } c.fillStyle = '#8a5a3a'; c.fillRect(0, 300, 640, 60);
      S.p.forEach((p, i) => {
        const cx = 80 + i * 160, base = 300, ch = 16; const h = p.st.length; const off = Math.max(0, h - 10) * ch;
        c.fillStyle = 'rgba(255,255,255,0.3)'; c.fillRect(cx - 74, 20, 148, 280);
        p.st.forEach(([o, w], k) => { const y = base - (k + 1) * ch + off; if (y > 300 || y < 20) return; if (k === 0) { c.fillStyle = '#6a4a3a'; c.fillRect(cx + o - w / 2, y, w, ch - 2); } else cup(c, cx + o, y, w, ch); });
        if (!p.out) { const top = p.st[h - 1]; const mx = Math.sin(p.ph) * 52; const y = base - (h + 1) * ch + off - 26; cup(c, cx + mx, y, top[1], ch); c.strokeStyle = 'rgba(0,0,0,0.15)'; c.setLineDash([3, 3]); c.beginPath(); c.moveTo(cx + mx, y + ch); c.lineTo(cx + mx, base - h * ch + off); c.stroke(); c.setLineDash([]); }
        else { A.txt(c, A.L({ zh: '碎了！', en: 'Smash!' }), cx, 120, { size: 18, color: '#e84a4a', stroke: '#fff' }); }
        if (S.t - p.pf < 0.6) A.txt(c, A.L({ zh: '完美！', en: 'Perfect!' }), cx, 60, { size: 16, color: '#e8a020', stroke: '#fff' });
        A.spr(c, i, cx - 52, 352, 2, {}); A.txt(c, String(h - 1), cx + 30, 336, { size: 22, color: '#fff', stroke: A.col(i) });
      });
    },
  },

  // =================================================================== 12. dragon-boat race (2 vs 2)
  boat: {
    name: { zh: '划龍舟', en: 'Dragon-Boat Dash' }, mode: '2v2', dur: 30, icon: '舟',
    desc: { zh: '兩人一條龍舟！跟著鼓聲按，剛好在鼓點上划得最有力。先到終點的隊伍贏。', en: 'Two to a dragon boat! Press with the drum - strokes right on the beat pull hardest. First boat home wins.' },
    ctrl: { zh: '跟著鼓點按 A / 空白鍵 / 點擊', en: 'Press A / Space / tap on the drum beat' },
    init(S) { S.b = [{ d: 0, v: 0, fin: 0 }, { d: 0, v: 0, fin: 0 }]; S.goal = 1500; S.beat = 0.5; S.j = [null, null, null, null]; },
    step(S, I, dt) {
      for (let i = 0; i < 4; i++) {
        const b = S.b[S.team[i]]; if (b.fin) continue;
        for (let k = 0; k < Math.min(2, I[i].p); k++) { const ph = (S.t % S.beat) / S.beat; const off = Math.min(ph, 1 - ph) * S.beat; const on = off < 0.11; b.v += on ? 26 : 8; S.j[i] = { k: on ? 1 : 0, t: S.t }; }
      }
      for (const b of S.b) { if (b.fin) continue; b.v *= 1 - 0.9 * dt; b.d += b.v * dt; if (b.d >= S.goal) b.fin = S.t; }
    },
    done: (S) => S.b.every(b => b.fin),
    score: (S) => S.team.map(t => { const b = S.b[t]; return b.fin ? 10000 - b.fin * 10 : b.d; }),
    bot(S, i, sk, M) {
      const ph = (S.t % S.beat) / S.beat; const beatNo = Math.floor(S.t / S.beat);
      if (M.bn !== beatNo) { M.bn = beatNo; M.at = beatNo * S.beat + S.beat + gauss() * (0.11 - 0.08 * sk); M.extra = R() < 0.5 * (1 - sk); }
      if (S.t >= M.at && M.at > 0) { M.at = -1; return { x: 0, y: 0, a: true, p: 1 }; }
      if (M.extra && ph > 0.45 && ph < 0.55) { M.extra = false; return { x: 0, y: 0, a: true, p: 1 }; }
      return { x: 0, y: 0, a: false, p: 0 };
    },
    draw(c, S, A) {
      const cam = Math.max(S.b[0].d, S.b[1].d) - 380;
      c.fillStyle = '#7ac860'; c.fillRect(0, 0, 640, 60); c.fillRect(0, 320, 640, 40);
      const g = c.createLinearGradient(0, 60, 0, 320); g.addColorStop(0, '#4aa8e0'); g.addColorStop(1, '#2a80c8'); c.fillStyle = g; c.fillRect(0, 60, 640, 260);
      c.strokeStyle = 'rgba(255,255,255,0.45)'; c.lineWidth = 2; for (let k = 0; k < 30; k++) { const x = ((k * 83 - cam) % 680 + 680) % 680 - 20, y = 80 + (k * 37) % 230; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 18, y); c.stroke(); }
      for (let k = 0; k < 12; k++) { const x = ((k * 140 - cam * 1.0) % 700 + 700) % 700 - 30; c.fillStyle = '#4a9a3a'; c.beginPath(); c.arc(x, 40, 22, 0, 7); c.fill(); c.beginPath(); c.arc(x + 60, 345, 20, 0, 7); c.fill(); }
      const gx = S.goal - cam + 60; if (gx < 680) { c.fillStyle = '#fff'; c.fillRect(gx, 60, 6, 260); c.fillStyle = '#e83a2a'; for (let y = 60; y < 320; y += 24) c.fillRect(gx, y, 6, 12); }
      const beatPh = (S.t % S.beat) / S.beat;
      S.b.forEach((b, t) => {
        const y = t ? 250 : 150; const x = b.d - cam + 60;
        c.fillStyle = t ? '#3a6ae8' : '#e84a3a'; c.beginPath(); c.moveTo(x - 110, y); c.lineTo(x + 70, y); c.quadraticCurveTo(x + 100, y - 4, x + 110, y - 24); c.lineTo(x + 92, y + 14); c.lineTo(x - 100, y + 14); c.fill();
        c.fillStyle = '#ffd040'; c.beginPath(); c.arc(x + 108, y - 28, 9, 0, 7); c.fill(); c.fillStyle = '#222'; c.fillRect(x + 108, y - 31, 3, 3);
        c.fillStyle = '#8a4a2a'; c.beginPath(); c.arc(x - 92, y - 6, 9 + (beatPh < 0.15 ? 2 : 0), 0, 7); c.fill();
        const mem = [0, 1, 2, 3].filter(i => S.team[i] === t);
        mem.forEach((i, k) => { const px = x - 40 + k * 60; const j = S.j[i]; const stroke = j && S.t - j.t < 0.2; A.spr(c, i, px, y + 2, 2.4, { side: true, frame: stroke ? 1 : 0 }); c.strokeStyle = '#8a5a2a'; c.lineWidth = 4; c.beginPath(); c.moveTo(px + 6, y - 20); c.lineTo(px + (stroke ? -22 : 18), y + 26); c.stroke(); if (j && S.t - j.t < 0.4 && j.k) A.txt(c, '♪', px, y - 60, { size: 16, color: '#ffe040' }); });
        if (b.fin) A.txt(c, A.L({ zh: '到！', en: 'Home!' }), x, y - 70, { size: 22, color: '#ffe040', stroke: '#6a3a00' });
      });
      A.txt(c, '咚', 320, 34, { size: beatPh < 0.15 ? 34 : 24, color: beatPh < 0.15 ? '#e83a2a' : '#6a3a2a' });
    },
  },

  // =================================================================== 13. tug of war (2 vs 2)
  tug: {
    name: { zh: '泥坑拔河', en: 'Mud-Pit Tug of War' }, mode: '2v2', dur: 25, icon: '拔',
    desc: { zh: '左右左右交替按，用力拉！把另一隊拉進泥坑就贏了。只按 A 也能拉，但力氣比較小。', en: 'Alternate left-right-left-right to heave! Drag the other team into the mud. Pressing A pulls too, just weaker.' },
    ctrl: { zh: '← → 交替（或連按 A）', en: 'Alternate ← → (or mash A)' },
    init(S) { S.r = 0; S.ls = [0, 0, 0, 0]; S.pw = [0, 0, 0, 0]; },
    step(S, I, dt) {
      let f = 0;
      for (let i = 0; i < 4; i++) {
        const sx = I[i].x > 0.5 ? 1 : I[i].x < -0.5 ? -1 : 0; let s = 0;
        if (sx && sx === -S.ls[i]) s += 1; if (sx) S.ls[i] = sx; s += Math.min(2, I[i].p) * 0.45;
        S.pw[i] = S.pw[i] * 0.9 + s; f += (S.team[i] ? 1 : -1) * s;
      }
      S.r = clamp(S.r + f * 3.6, -150, 150);
      if (Math.abs(S.r) >= 150) S.fin = true;
    },
    done: (S) => !!S.fin,
    score: (S) => S.team.map(t => (t ? 1 : -1) * S.r),
    bot(S, i, sk, M) {
      M.acc = (M.acc || 0) + (4 + 5 * sk + gauss()) / 30;
      if (M.acc >= 1) { M.acc -= 1; M.s = -(M.s || 1); return { x: M.s, y: 0, a: false, p: 0 }; }
      return { x: M.s || 1, y: 0, a: false, p: 0 };
    },
    draw(c, S, A) {
      sky(c, '#b8e0f8', '#e8f0d0'); ground(c, 250, '#8ac060', '#6aa040');
      c.fillStyle = '#6a4a2a'; c.beginPath(); c.ellipse(320, 280, 70, 22, 0, 0, 7); c.fill(); c.fillStyle = '#8a6a3a'; c.beginPath(); c.ellipse(320, 278, 58, 15, 0, 0, 7); c.fill();
      const off = S.r * 1.2;
      c.strokeStyle = '#c8a060'; c.lineWidth = 6; c.beginPath(); c.moveTo(40 + off, 240); c.lineTo(600 + off, 240); c.stroke();
      c.fillStyle = '#e83a2a'; c.fillRect(316 + off, 232, 8, 18);
      [0, 1, 2, 3].forEach(i => { const t = S.team[i]; const k = [0, 1, 2, 3].filter(j => S.team[j] === t).indexOf(i); const x = (t ? 400 + k * 70 : 240 - k * 70) + off; const lean = (t ? 1 : -1) * Math.min(0.4, S.pw[i] * 0.06); A.spr(c, i, x, 262, 3, { rot: lean, flip: !t, frame: (S.pw[i] > 0.5 && (S.t * 8 | 0) % 2) ? 1 : 0 }); A.tag(c, i, x, 282); });
      A.txt(c, A.L({ zh: '紅隊', en: 'Red' }), 80, 40, { size: 20, color: '#e84a4a', stroke: '#fff' }); A.txt(c, A.L({ zh: '藍隊', en: 'Blue' }), 560, 40, { size: 20, color: '#3a6ae8', stroke: '#fff' });
      c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(170, 70, 300, 10); c.fillStyle = '#fff'; c.fillRect(318 + S.r, 66, 4, 18);
    },
  },

  // =================================================================== 14. the drunk master (1 vs 3)
  drunk: {
    name: { zh: '醉拳棍掃', en: 'Drunken Staff Sweep' }, mode: '1v3', dur: 30, icon: '醉',
    desc: { zh: '一人喝醉了掄起長棍轉圈掃！三人要算準時間跳起來。醉俠把三人都掃倒就贏，否則三人贏。', en: 'One player is tipsy and sweeping a long staff in circles! The other three must time their jumps. The drunkard wins by sweeping all three; otherwise the three win.' },
    ctrl: { zh: '醉俠：← → 轉棍　A 加速／三人：方向移動　A 跳', en: 'Drunkard: ← → swing, A burst. Others: stick move, A jump' },
    init(S) { S.sa = 0; S.sv = 1.6; S.burst = 0; S.bcd = 0; S.p = [0, 1, 2, 3].map(i => ({ x: 320 + Math.cos(i * 2.1) * 110, y: 190 + Math.sin(i * 2.1) * 110, z: 0, vz: 0, hp: 2, inv: 0, out: false, f: 1 })); },
    step(S, I, dt) {
      const so = S.solo, ii = I[so];
      const want = ii.x ? ii.x * 2.6 : S.sv > 0 ? 1.6 : -1.6;
      S.sv += (want - S.sv) * Math.min(1, dt * 3); S.bcd -= dt; S.burst -= dt;
      if (ii.p > 0 && S.bcd <= 0) { S.burst = 0.6; S.bcd = 2.2; }
      const sp = S.sv * (S.burst > 0 ? 2.4 : 1); const old = S.sa; S.sa = ang(S.sa + sp * dt);
      S.p.forEach((p, i) => {
        if (i === so || p.out) return;
        p.x += I[i].x * 170 * dt; p.y += I[i].y * 170 * dt; if (I[i].x) p.f = Math.sign(I[i].x);
        const dx = p.x - 320, dy = p.y - 190, d = Math.hypot(dx, dy); if (d > 165) { p.x = 320 + dx / d * 165; p.y = 190 + dy / d * 165; } if (d < 45) { p.x = 320 + dx / (d || 1) * 45; p.y = 190 + dy / (d || 1) * 45; }
        if (p.z > 0 || p.vz > 0) { p.vz -= 1500 * dt; p.z += p.vz * dt; if (p.z <= 0) { p.z = 0; p.vz = 0; } } else if (I[i].p > 0) p.vz = 430;
        p.inv -= dt;
        const pa = Math.atan2(dy, dx); const swept = Math.abs(ang(pa - old)) + Math.abs(ang(S.sa - pa)) <= Math.abs(ang(S.sa - old)) + 0.06;
        if (swept && p.z < 14 && p.inv <= 0) { p.hp--; p.inv = 1.2; p.x += dx / d * 30; p.y += dy / d * 30; if (p.hp <= 0) p.out = true; }
      });
    },
    done: (S) => S.p.every((p, i) => i === S.solo || p.out),
    score: (S) => { const win = S.p.every((p, i) => i === S.solo || p.out); return S.p.map((p, i) => (i === S.solo) === win ? 1 : 0); },
    bot(S, i, sk, M) {
      if (i === S.solo) {
        let best = 9, tgt = null; S.p.forEach((p, j) => { if (j !== i && !p.out) { const a = ang(Math.atan2(p.y - 190, p.x - 320) - S.sa); if (Math.abs(a) < Math.abs(best)) { best = a; tgt = p; } } });
        if (!tgt) return { x: 0, y: 0, a: false, p: 0 };
        M.fl = (M.fl || 0) - 1 / 30; if (M.fl <= 0) { M.fl = 0.6 + R() * 1.2; M.dir = R() < 0.25 * sk ? -Math.sign(best) : Math.sign(best); }
        const b = Math.abs(best) < 0.9 && R() < 0.05 + 0.08 * sk;
        return { x: M.dir || 1, y: 0, a: b, p: b ? 1 : 0 };
      }
      const p = S.p[i]; if (p.out) return { x: 0, y: 0, a: false, p: 0 };
      const pa = Math.atan2(p.y - 190, p.x - 320); const sp = S.sv * (S.burst > 0 ? 2.4 : 1); const gap = ang(pa - S.sa) * Math.sign(sp || 1);
      const tt = gap > 0 ? gap / Math.abs(sp || 1) : 9;
      M.re = (M.re || 0) - 1 / 30; if (M.re <= 0) { M.re = 0.04 + (1 - sk) * 0.12; M.jt = 0.12 + (1 - sk) * 0.16 * gauss(); }
      const jump = tt < Math.max(0.05, M.jt) && p.z <= 0 && R() < 0.5 + 0.5 * sk;
      M.w = (M.w || 0) - 1 / 30; if (M.w <= 0) { M.w = 1 + R(); M.mx = gauss() * 0.6; M.my = gauss() * 0.6; }
      return { x: M.mx, y: M.my, a: jump, p: jump ? 1 : 0 };
    },
    draw(c, S, A) {
      sky(c, '#5a3a2a', '#3a2a1a'); c.fillStyle = '#c8a070'; c.beginPath(); c.arc(320, 190, 175, 0, 7); c.fill(); c.strokeStyle = '#8a6a40'; c.lineWidth = 4; c.stroke();
      c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = 16; c.beginPath(); c.arc(320, 190, 110, S.sa - 0.5 * Math.sign(S.sv), S.sa, S.sv < 0); c.stroke();
      const ex = 320 + Math.cos(S.sa) * 180, ey = 190 + Math.sin(S.sa) * 180;
      c.strokeStyle = '#6a3a1a'; c.lineWidth = 9; c.beginPath(); c.moveTo(320, 190); c.lineTo(ex, ey); c.stroke(); c.strokeStyle = '#b07a3a'; c.lineWidth = 4; c.stroke();
      A.spr(c, S.solo, 320, 206, 3.4, { rot: Math.sin(S.t * 3) * 0.25, frame: (S.t * 3 | 0) % 2 });
      c.fillStyle = '#c8a040'; c.beginPath(); c.arc(342, 176, 8, 0, 7); c.arc(342, 164, 5, 0, 7); c.fill();
      A.txt(c, A.L({ zh: '嗝～', en: 'Hic~' }), 360, 130 + Math.sin(S.t * 2) * 4, { size: 14, color: '#fff' });
      S.p.forEach((p, i) => { if (i === S.solo) return; if (p.out) { A.spr(c, i, p.x, p.y + 12, 2.4, { rot: Math.PI / 2, alpha: 0.6 }); return; } shadow(c, p.x, p.y + 12, 12 - p.z * 0.1); A.spr(c, i, p.x, p.y + 12 - p.z, 2.4, { flip: p.f < 0, blink: p.inv > 0, walk: S.t > 0 }); hearts(c, p.x, p.y - 62 - p.z, p.hp, 2); A.tag(c, i, p.x, p.y + 26); });
    },
  },

  // =================================================================== 15. roof-tile prank (1 vs 3)
  roofthrow: {
    name: { zh: '屋頂惡作劇', en: 'Rooftop Prank' }, mode: '1v3', dur: 30, icon: '頑',
    desc: { zh: '一人爬上屋頂往下丟瓦片！屋頂上的人砸中 5 次就贏；下面三人撐過 30 秒就贏。', en: 'One player climbs the roof and drops tiles! The roof prankster wins with 5 hits; the three below win by lasting 30 seconds.' },
    ctrl: { zh: '屋頂：← → 移動　A 丟／三人：← → 閃', en: 'Roof: ← → move, A drop. Others: ← → dodge' },
    init(S) { S.hits = 0; S.tl = []; S.cd = 0; S.p = [0, 1, 2, 3].map(i => ({ x: 120 + i * 130, st: 0, hp: 2, out: false, f: 1 })); S.p[S.solo].x = 320; },
    step(S, I, dt) {
      const so = S.p[S.solo]; so.x = clamp(so.x + I[S.solo].x * 270 * dt, 30, 610); S.cd -= dt;
      if (I[S.solo].p > 0 && S.cd <= 0) { S.cd = 0.5; S.tl.push({ x: so.x, y: 96, vy: 120, r: 0 }); }
      S.p.forEach((p, i) => { if (i === S.solo || p.out) return; if (p.st > 0) { p.st -= dt; } p.x = clamp(p.x + I[i].x * 215 * dt, 24, 616); if (I[i].x) p.f = Math.sign(I[i].x); });
      for (const o of S.tl) { o.vy += 650 * dt; o.y += o.vy * dt; o.r += dt * 9; }
      S.tl = S.tl.filter(o => { if (o.y < GROUND - 30) return true; S.p.forEach((p, i) => { if (i !== S.solo && !p.out && p.st <= 0 && Math.abs(p.x - o.x) < 22) { p.hp--; p.st = 1.1; S.hits++; if (p.hp <= 0) p.out = true; } }); return false; });
    },
    done: (S) => S.hits >= 5 || S.p.every((p, i) => i === S.solo || p.out),
    score: (S) => { const win = S.hits >= 5 || S.p.every((p, i) => i === S.solo || p.out); return S.p.map((p, i) => (i === S.solo) === win ? 1 : 0); },
    bot(S, i, sk, M) {
      if (i === S.solo) {
        const so = S.p[i]; M.re = (M.re || 0) - 1 / 30;
        if (M.re <= 0 || M.tg == null || S.p[M.tg].out) { M.re = 1 + R(); const c = S.p.map((p, j) => j).filter(j => j !== i && !S.p[j].out); M.tg = c[R() * c.length | 0]; }
        if (M.tg == null) return { x: 0, y: 0, a: false, p: 0 };
        const t = S.p[M.tg]; const lead = t.x + (t.f || 0) * 40 * sk + gauss() * (1 - sk) * 30; const d = lead - so.x;
        const drop = Math.abs(d) < 14 && S.cd <= 0 && R() < 0.4 + 0.5 * sk;
        return { x: Math.abs(d) < 6 ? 0 : Math.sign(d), y: 0, a: drop, p: drop ? 1 : 0 };
      }
      return dodgeBot(S, S.p[i], S.tl, GROUND - 30, sk, M);
    },
    draw(c, S, A) {
      sky(c, '#ffd0a0', '#ffeed8'); c.fillStyle = '#2a3a52'; c.fillRect(0, 70, 640, 34); c.fillStyle = '#3a5078'; for (let x = 0; x < 640; x += 14) c.fillRect(x, 70, 9, 8); c.fillStyle = '#c0302a'; c.fillRect(0, 100, 640, 6);
      c.fillStyle = '#f0e0c0'; c.fillRect(0, 106, 640, 194); c.fillStyle = '#c0302a'; for (let x = 30; x < 640; x += 120) c.fillRect(x, 106, 10, 194);
      ground(c, GROUND, '#c8b48e', '#a8946a');
      const so = S.p[S.solo]; A.spr(c, S.solo, so.x, 76, 2.8, { walk: S.t > 0, frame: S.cd > 0.3 ? 1 : 0 }); A.tag(c, S.solo, so.x, 22);
      for (const o of S.tl) { const k = clamp((o.y - 96) / (GROUND - 96), 0, 1); shadow(c, o.x, GROUND + 4, 6 + 14 * k); c.save(); c.translate(o.x, o.y); c.rotate(o.r); c.fillStyle = '#4a5a6a'; c.fillRect(-13, -5, 26, 10); c.restore(); }
      S.p.forEach((p, i) => { if (i === S.solo) return; if (p.out) { A.spr(c, i, p.x, GROUND + 2, 3, { rot: Math.PI / 2, alpha: 0.6 }); return; } A.spr(c, i, p.x, GROUND + 2, 3, { walk: S.t > 0, flip: p.f < 0, blink: p.st > 0 }); hearts(c, p.x, GROUND - 82, p.hp, 2); if (p.st > 0) stars(c, p.x, GROUND - 70, S.t); A.tag(c, i, p.x, GROUND + 22); });
      A.txt(c, A.L({ zh: '砸中', en: 'Hits' }) + ' ' + S.hits + ' / 5', 560, 140, { size: 18, color: '#c0302a', stroke: '#fff' });
    },
  },
};
export const MG_IDS = Object.keys(MINIGAMES);
