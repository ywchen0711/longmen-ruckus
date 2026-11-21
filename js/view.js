// What every player sees: the board (2D canvas), HUD cards, prompts, minigames and the finale.
// It only reacts to messages from the host ({t:'state'|'cue'|'ask'|'mg'|'mgs'|'final'}), so all screens stay in step.
import { L, LANG, CHAR, CHARS, NPC, ITEMS, SPACES, UI, MANUAL_PRICE, pick } from './data.js?v=2';
import { buildBoard, paintBoard, WORLD } from './boards.js?v=2';
import { MINIGAMES } from './minigames.js?v=2';
import { ATLAS } from './atlas.js?v=2';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
export const PCOL = ['#e8443a', '#3a7ae8', '#2aa860', '#e8a020'];
const now = () => performance.now() / 1000;
const ease = (k) => k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;

export const IMG = new Image(); IMG.src = 'assets/chars.png?v=1';
// a portrait as a CSS-styled div (crisp pixel scaling)
export function portraitHTML(id, h = 56, cls = '') {
  const k = h / 56, row = ATLAS[id] ?? 0;
  return `<i class="port ${cls}" style="width:${48 * k}px;height:${56 * k}px;background-size:${84 * k}px auto;background-position:0 ${-row * 76 * k}px"></i>`;
}
export function spriteHTML(id, h = 48) {
  const k = h / 24, row = ATLAS[id] ?? 0;
  return `<i class="port" style="width:${16 * k}px;height:${24 * k}px;background-size:${84 * k}px auto;background-position:${-52 * k}px ${-row * 76 * k}px"></i>`;
}

// ------------------------------------------------------------------ drawing helpers shared with the minigames
export function makeArt(view) {
  const A = {
    L, col: (i) => PCOL[i],
    cid: (i) => typeof i === 'number' ? (view.S ? view.S.players[i].char : 'yirui') : i,
    sprId(c, id, x, y, s, o = {}) {
      const row = ATLAS[id]; if (row == null || !IMG.complete) return;
      let anim = o.side ? 2 : o.walk ? 1 : 0; let fr = o.frame ?? ((o.walk || o.side) ? Math.floor(now() * 6) % 2 : Math.floor(now() * 2) % 2);
      if (o.side && !o.walk && o.frame == null) fr = 1;
      c.save(); if (o.alpha != null) c.globalAlpha *= o.alpha; if (o.blink && Math.floor(now() * 12) % 2) c.globalAlpha *= 0.35;
      c.imageSmoothingEnabled = false;
      const T = c.getTransform();
      if (!o.rot && !T.b && !T.c) {
        // whole screen pixels per sprite pixel, feet on a whole screen pixel (no half-pixel smear)
        const P = Math.max(1, Math.round(T.a * s)), X = Math.round(T.a * x + T.e), Y = Math.round(T.d * y + T.f);
        c.setTransform(o.flip ? -1 : 1, 0, 0, 1, X, Y);
        c.drawImage(IMG, 52 + fr * 16, row * 76 + anim * 24, 16, 24, -8 * P, -24 * P, 16 * P, 24 * P);
      } else {
        c.translate(x, y); if (o.rot) { c.translate(0, -12 * s); c.rotate(o.rot); c.translate(0, 12 * s); }
        if (o.flip) c.scale(-1, 1);
        c.drawImage(IMG, 52 + fr * 16, row * 76 + anim * 24, 16, 24, -8 * s, -24 * s, 16 * s, 24 * s);
      }
      c.restore();
    },
    spr(c, i, x, y, s, o) { A.sprId(c, A.cid(i), x, y, s, o); },
    npc(c, id, x, y, s, o) { A.sprId(c, id, x, y, s, o); },
    port(c, i, x, y, h) {
      const id = A.cid(i); const row = ATLAS[id]; if (row == null || !IMG.complete) return; c.imageSmoothingEnabled = false;
      const T = c.getTransform();
      if (!T.b && !T.c) { const P = Math.max(1, Math.round(T.a * h / 56)); c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(IMG, 0, row * 76, 48, 56, Math.round(T.a * x + T.e + (T.a * 48 * h / 56 - 48 * P) / 2), Math.round(T.d * y + T.f + T.d * h - 56 * P), 48 * P, 56 * P); c.restore(); }
      else c.drawImage(IMG, 0, row * 76, 48, 56, x, y, 48 * h / 56, h);
    },
    txt(c, s, x, y, o = {}) {
      c.save(); c.font = `${o.size || 16}px "Cubic 11", "PingFang TC", "Microsoft JhengHei", sans-serif`; c.textAlign = o.align || 'center'; c.textBaseline = 'middle';
      if (o.bubble) { const w = c.measureText(s).width + 16, h = (o.size || 16) + 12; c.fillStyle = '#fff'; c.strokeStyle = '#3a2a1a'; c.lineWidth = 2; rr(c, x - w / 2, y - h / 2, w, h, 8); c.fill(); c.stroke(); c.beginPath(); c.moveTo(x - 5, y + h / 2 - 1); c.lineTo(x, y + h / 2 + 7); c.lineTo(x + 5, y + h / 2 - 1); c.fill(); }
      if (o.stroke) { c.lineWidth = Math.max(3, (o.size || 16) / 5); c.strokeStyle = o.stroke; c.lineJoin = 'round'; c.strokeText(s, x, y); }
      c.fillStyle = o.color || '#222'; c.fillText(s, x, y); c.restore();
    },
    tag(c, i, x, y) { const me = view.me === i; A.txt(c, me ? L(UI.you) : 'P' + (i + 1), x, y, { size: 11, color: '#fff', stroke: PCOL[i] }); },
  };
  return A;
}
function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function lerpObj(a, b, k, key) {
  if (typeof b === 'number' && typeof a === 'number') { if (key === 'sa' && Math.abs(b - a) > 3) return b; return a + (b - a) * k; }
  if (Array.isArray(b)) { if (!Array.isArray(a) || a.length !== b.length) return b; return b.map((v, i) => lerpObj(a[i], v, k, key)); }
  if (b && typeof b === 'object') { if (!a || typeof a !== 'object') return b; const o = {}; for (const kk in b) o[kk] = lerpObj(a[kk], b[kk], k, kk); return o; }
  return b;
}
const FEEDBACK = ['rhythm', 'lanterns', 'swordcatch', 'darts', 'findbai', 'teacups', 'tiles', 'roofthrow', 'drunk'];
const DIRS = [['→', 0], ['↘', 1], ['↓', 2], ['↙', 3], ['←', 4], ['↖', 5], ['↑', 6], ['↗', 7]];

export class View {
  constructor({ canvas, sound, input, me, answer, speed = 1, onFinal }) {
    this.cv = canvas; this.c = canvas.getContext('2d'); this.snd = sound; this.input = input; this.me = me; this.answerFn = answer; this.onFinal = onFinal;
    this.S = null; this.B = null; this.bg = null; this.vp = []; this.fx = []; this.bubbles = []; this.dice = []; this.stepsLeft = [0, 0, 0, 0];
    this.cam = { x: 800, y: 500, z: 1 }; this.mapMode = false; this.shake = 0; this.mode = 'board'; this.mg = null; this.ask = null;
    this.A = makeArt(this); this.sp = speed; this.rides = []; this.bandits = null; this.focus = 0; this.btns = [];
    this.resize(); this._rs = () => this.resize(); addEventListener('resize', this._rs);
    input.onNav = (dx, dy) => this.nav(dx, dy); input.onOk = () => this.ok();
    this.alive = true; this.lastT = now(); requestAnimationFrame(() => this.loop());
    this.lastMyScore = null;
  }
  destroy() { this.alive = false; removeEventListener('resize', this._rs); this.input.onNav = null; this.input.onOk = null; this.input.active = false; }
  resize() { const d = Math.min(devicePixelRatio || 1, 2); this.dpr = d; this.W = innerWidth; this.H = innerHeight; this.cv.width = Math.round(this.W * d); this.cv.height = Math.round(this.H * d); }
  wait(ms) { return ms / this.sp; }

  // ------------------------------------------------------------------ messages from the host
  recv(m) {
    if (m.t === 'state') this.setState(m.s);
    else if (m.t === 'cue') this.onCue(m.c);
    else if (m.t === 'ask') { if (m.i === this.me) this.showAsk(m); else this.showWaiting(m); }
    else if (m.t === 'asked') { if (this.ask && this.ask.id === m.id) this.hideAsk(); if (this.waitingId === m.id) this.hideWaiting(); }
    else if (m.t === 'mg') this.onMg(m);
    else if (m.t === 'mgs') { this.mgPrev = this.mgCur; this.mgPrevT = this.mgCurT; this.mgCur = m.s; this.mgCurT = now(); }
    else if (m.t === 'final') this.showFinal(m);
  }
  setState(s) {
    const first = !this.S || this.S.board !== s.board;
    this.S = s; if (s.sp) this.sp = s.sp;
    if (first) {
      this.B = buildBoard(s.board); this.bg = null;
      const paint = () => { this.bg = paintBoard(this.B); };
      if (document.fonts && document.fonts.load) document.fonts.load('22px "Cubic 11"').then(paint, paint); else paint();
      this.vp = s.players.map((p) => ({ x: this.B.nodes[p.node].x, y: this.B.nodes[p.node].y, anim: null }));
      this.cam.x = this.B.nodes[s.players[0].node].x; this.cam.y = this.B.nodes[s.players[0].node].y;
      this.snd.music(s.board);
    }
    // snap anyone not animating to their node
    s.players.forEach((p, i) => { const v = this.vp[i]; if (!v.anim) { const n = this.B.nodes[p.node]; v.x = n.x; v.y = n.y; } });
    this.hud();
  }

  // ------------------------------------------------------------------ cues (animations)
  onCue(c) {
    const S = this.S, snd = this.snd;
    switch (c.k) {
      case 'banner': this.banner(L(c.o, c.v), c.sub ? L(c.sub) : ''); snd.sfx('gong'); break;
      case 'talk': this.talk(c.who, L(c.o, c.v), c.hold); break;
      case 'talkEnd': this.hideTalk(); break;
      case 'intro': { const p = S.players[c.i], ch = CHAR[p.char]; this.focusOn(c.i); this.talk(p.char, L(ch.intro), false, `${esc(L(ch.name))}<small>${esc(L(ch.title))}${p.nm ? '・' + esc(p.nm) : ''}</small>`, L(ch.quirkName)); snd.sfx('drum'); break; }
      case 'say': this.bubble(c.i, L(c.o, c.v)); break;
      case 'orderDice': S.players.forEach((p, i) => this.rollDie(i, [c.vals[i]])); break;
      case 'order': this.banner(c.order.map(i => (S.players[i].nm || L(CHAR[S.players[i].char].name))).join(' → '), L({ zh: '出場順序', en: 'Turn order' })); break;
      case 'turnBanner': this.banner(L(UI.turnOf, { t: c.t, n: c.n }), S.last3 ? L(UI.lastTurns) : ''); snd.sfx('drum'); break;
      case 'turn': this.focusOn(c.i); this.mapMode = false; this.toast(L(c.i === this.me ? UI.yourTurn : UI.turnName, { n: this.pname(c.i) })); break;
      case 'dice': this.rollDie(c.i, c.vals); break;
      case 'steps': this.stepsLeft[c.i] = c.v; break;
      case 'hop': this.hop(c.i, c.from, c.to, c.back ? 0.22 : 0.26); this.stepsLeft[c.i] = c.left; snd.sfx('hop'); break;
      case 'land': this.land(c.i, c.type); break;
      case 'coins': this.floatText(c.i, (c.v > 0 ? '+' : '') + c.v, c.v > 0 ? '#ffe040' : '#ff5a5a'); snd.sfx(c.v > 0 ? 'coin' : 'lose'); this.bumpCard(c.i); break;
      case 'gift': this.floatText(c.i, ITEMS[c.item].icon, ITEMS[c.item].color, 30); snd.sfx('item'); break;
      case 'item': this.banner(L({ zh: '{n} 使用 {i}！', en: '{n} uses the {i}!' }, { n: this.pname(c.i), i: ITEMS[c.item].name }), L(ITEMS[c.item].desc)); snd.sfx('item'); break;
      case 'swap': this.swapAnim(c.a, c.b); snd.sfx('whoosh'); break;
      case 'manual': this.manualFx(c.i); snd.sfx('manual'); break;
      case 'baiMove': this.baiFx(c.node); snd.sfx('whoosh'); this.talk('baixian', L(c.o)); break;
      case 'ride': this.rideAnim(c.i, c.from, c.to, c.kind); snd.sfx('whoosh'); break;
      case 'gust': this.fx.push({ k: 'gust', i: c.i, t: now() }); snd.sfx('whoosh'); break;
      case 'event': this.fx.push({ k: 'q', i: c.i, t: now() }); snd.sfx('item'); break;
      case 'bandits': this.bandits = { i: c.i, t: now() }; snd.sfx('bad'); break;
      case 'shake': this.shake = 0.6; snd.sfx(c.sfx || 'laugh'); break;
      case 'sfx': snd.sfx(c.s); break;
      case 'duelDice': if (c.a >= 0) this.rollDie(c.a, [c.va]); else this.rollDie(-1, [c.va], c.b, c.npc); this.rollDie(c.b, [c.vb]); break;
      case 'bridge': this.banner(L(c.o)); snd.sfx('whoosh'); break;
      case 'award': this.award(c); break;
    }
  }
  pname(i) { const p = this.S.players[i]; return p.nm || L(CHAR[p.char].name); }
  focusOn(i) { this.focus = i; }
  nodeXY(id) { const n = this.B.nodes[id]; return [n.x, n.y]; }
  hop(i, from, to, dur) {
    const v = this.vp[i]; const [x0, y0] = this.nodeXY(from), [x1, y1] = this.nodeXY(to);
    v.anim = { x0, y0, x1, y1, t0: now(), dur: dur / this.sp, h: 34 }; this.focus = i;
  }
  rideAnim(i, from, to, kind) { const v = this.vp[i]; const [x0, y0] = this.nodeXY(from), [x1, y1] = this.nodeXY(to); v.anim = { x0, y0, x1, y1, t0: now(), dur: 1.5 / this.sp, h: kind === 'jar' ? 160 : 60, ride: kind }; this.focus = i; }
  swapAnim(a, b) { for (const [i, j] of [[a, b], [b, a]]) { const v = this.vp[i]; const o = this.vp[j]; v.anim = { x0: v.x, y0: v.y, x1: o.x, y1: o.y, t0: now(), dur: 1.1 / this.sp, h: 80, spin: true }; } }
  land(i, type) {
    const sfx = { b: 'coin', r: 'bad', e: 'item', i: 'item', d: 'drum', s: 'click', g: 'whoosh', w: 'whoosh' }[type]; if (sfx && type !== 'b') this.snd.sfx(sfx);
    this.fx.push({ k: 'ring', i, t: now(), col: (SPACES[type] || SPACES.b).color });
  }
  rollDie(i, vals, besideOf, npc) { this.dice = this.dice.filter(d => d.i !== i || i < 0); this.dice.push({ i, vals, t0: now(), dur: 0.9 / this.sp, beside: besideOf, npc }); this.snd.sfx('dice'); setTimeout(() => this.snd.sfx('diceStop'), 900 / this.sp); }
  floatText(i, s, col, size = 26) { this.fx.push({ k: 'float', i, s, col, t: now(), size }); }
  bubble(i, s) { this.bubbles = this.bubbles.filter(b => b.i !== i); this.bubbles.push({ i, s, t: now(), dur: Math.max(1.4, 1.8 / this.sp) }); }
  manualFx(i) { this.fx.push({ k: 'manual', i, t: now() }); this.banner(L({ zh: '{n} 得到《武林秘笈》！', en: '{n} gets a Secret Manual!' }, { n: this.pname(i) })); }
  baiFx(node) { this.fx.push({ k: 'smoke', node, t: now() }); this.camHold = { node, until: now() + 1.4 / this.sp }; }

  // ------------------------------------------------------------------ DOM overlays
  banner(t, sub = '') { const b = $('#banner'); b.innerHTML = `<b>${esc(t)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}`; b.classList.remove('on'); void b.offsetWidth; b.classList.add('on'); b.style.animationDuration = Math.max(0.9, 1.9 / this.sp) + 's'; }
  talk(who, text, hold, nameHTML, extra) {
    const t = $('#talk'); const nm = nameHTML || esc(L((CHAR[who] || NPC[who] || { name: who }).name));
    t.innerHTML = `${portraitHTML(who, 84)}<div><h4>${nm}</h4><p>${esc(text)}</p>${extra ? `<em>${esc(extra)}</em>` : ''}</div>`;
    t.classList.add('on'); clearTimeout(this.talkT);
    if (!hold) this.talkT = setTimeout(() => this.hideTalk(), Math.max(1200, 3000 / this.sp));
  }
  hideTalk() { $('#talk').classList.remove('on'); clearTimeout(this.talkT); }
  toast(t, ms = 1800) { const d = document.createElement('div'); d.className = 'toast'; d.textContent = t; $('#toasts').appendChild(d); setTimeout(() => d.classList.add('out'), ms); setTimeout(() => d.remove(), ms + 500); }
  bumpCard(i) { const el = document.querySelector('#hud .pc[data-i="' + i + '"]'); if (el) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); } }
  hud() {
    const S = this.S; if (!S) return;
    $('#turninfo').textContent = S.turn ? L(UI.turnOf, { t: S.turn, n: S.turns }) : L(this.B.name);
    const box = $('#hud-cards');
    if (box.children.length !== 4) box.innerHTML = [0, 1, 2, 3].map(i => `<div class="pc c${i}" data-i="${i}"></div>`).join('');
    S.players.forEach((p, i) => {
      const el = box.children[i]; const ch = CHAR[p.char];
      const html = `${portraitHTML(p.char, 46)}<div class="pi"><b style="color:${PCOL[i]}">${esc(p.nm || L(ch.name))}${i === this.me ? `<u>${esc(L(UI.you))}</u>` : ''}${p.bot ? `<s>${esc(L(UI.bot))}</s>` : ''}</b>
        <span class="man">📜×${p.man}</span><span class="sil">${p.silver}${esc(L(UI.silver))}</span>
        <span class="its">${p.items.map(id => `<i style="background:${ITEMS[id].color}" title="${esc(L(ITEMS[id].name))}">${ITEMS[id].icon}</i>`).join('')}${p.skip ? `<i class="skip">${esc(L({ zh: '穴', en: 'Zz' }))}</i>` : ''}</span></div>`;
      if (el._h !== html) { el.innerHTML = html; el._h = html; }
      el.classList.toggle('cur', S.cur === i);
    });
  }

  // ------------------------------------------------------------------ prompts
  showAsk(m) {
    this.ask = m; const S = this.S, P = S.players[m.i]; const d = m.data || {};
    const box = $('#ask'); let title = '', btns = [];
    const pbtn = (j) => ({ html: `${portraitHTML(S.players[j].char, 34)}<span>${esc(this.pname(j))}<small>📜${S.players[j].man} ・ ${S.players[j].silver}${esc(L(UI.silver))}</small></span>`, v: j, cls: 'pl', style: `border-color:${PCOL[j]}` });
    if (m.kind === 'roll') {
      title = L(UI.yourTurn);
      btns.push({ html: `<span class="big">🎲 ${esc(L(UI.roll))}</span>`, v: { roll: true }, cls: 'go' });
      (d.items || []).forEach((id, k) => { if (id === 'tiebu') return; btns.push({ html: `<i class="ic" style="background:${ITEMS[id].color}">${ITEMS[id].icon}</i><span>${esc(L(UI.use))} ${esc(L(ITEMS[id].name))}<small>${esc(L(ITEMS[id].desc))}</small></span>`, v: { item: k } }); });
    } else if (m.kind === 'target') { title = L(UI.pickTarget, { i: ITEMS[d.item].name }); btns = d.opts.map(pbtn); }
    else if (m.kind === 'duel') { title = L(UI.duelPick); btns = d.opts.map(pbtn); }
    else if (m.kind === 'way') {
      title = L(UI.whichWay); const a = this.B.nodes[d.from];
      btns = d.opts.map(o => { const n = this.B.nodes[o]; const angle = Math.atan2(n.y - a.y, n.x - a.x); const k = ((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8; const toBai = o === S.bai; return { html: `<span class="big">${DIRS[k][0]}</span><span>${n.branch ? esc(L({ zh: '小路', en: 'Side path' })) : esc(L({ zh: '大路', en: 'Main road' }))}</span>`, v: o }; });
      this.wayOpts = d.opts;
    }
    else if (m.kind === 'buy') { title = L(UI.buyManual, { p: d.price }); btns = [{ html: `<span class="big">📜 ${esc(L(UI.buy))}</span>`, v: true, cls: 'go' }, { html: esc(L(UI.no)), v: false }]; }
    else if (m.kind === 'shop') {
      title = L(UI.shopTitle) + ` (${P.silver}${L(UI.silver)})`;
      btns = d.items.map(id => ({ html: `<i class="ic" style="background:${ITEMS[id].color}">${ITEMS[id].icon}</i><span>${esc(L(ITEMS[id].name))} <b>${ITEMS[id].price}${esc(L(UI.silver))}</b><small>${esc(L(ITEMS[id].desc))}</small></span>`, v: id, dis: P.silver < ITEMS[id].price }));
      btns.push({ html: esc(L(UI.leave)), v: null });
    } else if (m.kind === 'ready') { this.readyAsk = m; this.mgReadyBtn(true); return; }
    box.innerHTML = `<h3>${esc(title)}</h3><div class="btns">${btns.map((b, k) => `<button class="${b.cls || ''}" data-k="${k}" ${b.dis ? 'disabled' : ''} style="${b.style || ''}">${b.html}</button>`).join('')}</div>`;
    box.classList.add('on'); this.btns = [...box.querySelectorAll('button')]; this.focusIdx = 0; this.markFocus();
    this.btns.forEach((el, k) => el.addEventListener('click', () => { this.snd.sfx('click'); this.reply(btns[k].v); }));
    this.input.active = false;
    if (this.auto) setTimeout(() => this.ask && this.ask.id === m.id && this.reply(this.auto(m)), 300);
  }
  markFocus() { this.btns.forEach((b, k) => b.classList.toggle('focus', k === this.focusIdx)); }
  nav(dx, dy) { if (!this.btns.length) return; const n = this.btns.length; let k = this.focusIdx ?? 0; for (let t = 0; t < n; t++) { k = (k + (dx || dy) + n) % n; if (!this.btns[k].disabled) break; } this.focusIdx = k; this.markFocus(); this.snd.sfx('click'); }
  ok() { if (this.btns.length) { const b = this.btns[this.focusIdx ?? 0]; if (b && !b.disabled) b.click(); } else if (this.readyAsk) $('#mg-ready').click(); }
  reply(v) { if (!this.ask) return; const id = this.ask.id; this.hideAsk(); this.answerFn(id, v); }
  hideAsk() { this.ask = null; this.wayOpts = null; $('#ask').classList.remove('on'); this.btns = []; this.focusIdx = 0; }
  showWaiting(m) { if (m.kind === 'ready') return; this.waitingId = m.id; const w = $('#waiting'); w.innerHTML = portraitHTML(this.S.players[m.i].char, 28) + esc(L(UI.choosing, { n: this.pname(m.i) })); w.classList.add('on'); }
  hideWaiting() { this.waitingId = null; $('#waiting').classList.remove('on'); }

  // ------------------------------------------------------------------ minigames
  onMg(m) {
    const box = $('#mgintro');
    if (m.ph === 'intro') {
      $('#toasts').innerHTML = '';
      const g = MINIGAMES[m.id]; this.mode = 'mgintro'; this.mgInfo = m; this.mgCur = null; this.mgPrev = null;
      this.hideTalk(); this.hideWaiting();
      const modeName = L(g.mode === 'ffa' ? UI.ffa : g.mode === '2v2' ? UI.v22 : UI.v13);
      const S = this.S;
      const teamHTML = (filter) => [0, 1, 2, 3].filter(filter).map(i => `<span class="tm" style="border-color:${PCOL[i]}">${portraitHTML(S.players[i].char, 40)}<b>${esc(this.pname(i))}</b></span>`).join('');
      let teams;
      if (g.mode === 'ffa') teams = `<div class="teams">${teamHTML(() => true)}</div>`;
      else if (g.mode === '2v2') teams = `<div class="teams"><div class="side red">${teamHTML(i => m.team[i] === 0)}</div><em>VS</em><div class="side blue">${teamHTML(i => m.team[i] === 1)}</div></div>`;
      else teams = `<div class="teams"><div class="side red">${teamHTML(i => i === m.solo)}</div><em>VS</em><div class="side blue">${teamHTML(i => i !== m.solo)}</div></div>`;
      box.innerHTML = `<div class="mgcard"><div class="mgno">${esc(L(UI.minigame))} ・ ${esc(modeName)}</div><div class="mgic">${g.icon}</div><h2>${esc(L(g.name))}</h2>${teams}<p>${esc(L(g.desc))}</p><div class="ctrl"><b>${esc(L(UI.controls))}</b> ${esc(L(g.ctrl))}</div><button id="mg-ready" class="btn" style="display:none">${esc(L(UI.ready))}</button></div>`;
      box.classList.add('on'); this.snd.sfx('gong'); this.snd.music(Math.random() < 0.5 ? 'mg' : 'mg2');
      $('#mg-ready').addEventListener('click', () => { if (this.readyAsk) { const id = this.readyAsk.id; this.readyAsk = null; this.mgReadyBtn(false); this.answerFn(id, true); this.snd.sfx('click'); } });
      if (this.readyAsk) this.mgReadyBtn(true);
    } else if (m.ph === 'play') {
      box.classList.remove('on'); this.mode = 'mg'; this.mgInfo = m; this.readyAsk = null; this.input.active = true; this.lastMyScore = null; this.cdLast = null;
      document.body.classList.add('inmg');
    } else if (m.ph === 'end') {
      this.input.active = false; document.body.classList.remove('inmg');
      const S = this.S; const g = MINIGAMES[m.id];
      const order = [0, 1, 2, 3].sort((a, b) => m.place[a] - m.place[b] || m.sc[b] - m.sc[a]);
      const head = g.mode === 'ffa' ? '' : `<h3 class="win">${esc(g.mode === '2v2' ? (m.pay.every(v => v === 3) ? L(UI.draw) : L({ zh: '{t}隊勝利！', en: '{t} team wins!' }, { t: L(m.pay[m.team.indexOf(0)] > 0 ? { zh: '紅', en: 'Red' } : { zh: '藍', en: 'Blue' }) })) : (m.pay[m.solo] > 0 ? L({ zh: '{n} 一人勝利！', en: '{n} wins alone!' }, { n: this.pname(m.solo) }) : L({ zh: '三人勝利！', en: 'The three win!' })))}</h3>`;
      $('#mgend').innerHTML = `<div class="rs-box"><h2>${esc(L(g.name))} ・ ${esc(L(UI.results))}</h2>${head}<ol>${order.map(i => `<li style="border-color:${PCOL[i]}" class="${i === this.me ? 'me' : ''}"><em>${g.mode === 'ffa' ? esc(LANG.cur === 'zh' ? UI.rankZh[m.place[i]] : UI.rank[m.place[i]]) : (m.pay[i] > 0 ? '★' : '')}</em>${portraitHTML(S.players[i].char, 40)}<b>${esc(this.pname(i))}</b><span>${m.pay[i] ? '+' + m.pay[i] + esc(L(UI.silver)) : ''}</span></li>`).join('')}</ol></div>`;
      $('#mgend').classList.add('on'); this.snd.sfx('cheer'); this.snd.music('results');
      const w = order[0]; this.mgWinner = w;
    } else if (m.ph === 'done') {
      $('#mgend').classList.remove('on'); this.mode = 'board'; this.mgCur = null; this.mgPrev = null; this.snd.music(this.S.board);
    }
  }
  mgReadyBtn(on) { const b = $('#mg-ready'); if (b) b.style.display = on ? '' : 'none'; if (on && this.auto) setTimeout(() => this.readyAsk && $('#mg-ready') && $('#mg-ready').click(), 400); }

  // ------------------------------------------------------------------ awards and the finale
  award(c) {
    const S = this.S; const box = $('#award');
    box.innerHTML = `<div class="aw">${portraitHTML(S.players[c.i].char, 96)}<div><small>${esc(L(UI.awards))}</small><h2>「${esc(L(c.name))}」</h2><p>${esc(this.pname(c.i))} ・ ${esc(L(c.why))}</p><b>📜 +1</b></div></div>`;
    box.classList.add('on'); this.snd.sfx('cheer'); setTimeout(() => box.classList.remove('on'), Math.max(1500, 2900 / this.sp));
    this.focus = c.i;
  }
  showFinal(m) {
    const S = this.S; this.mode = 'final'; this.snd.music('final'); this.hideTalk();
    const w = m.rank[0]; const ch = CHAR[S.players[w].char];
    const box = $('#final');
    box.innerHTML = `<div class="fin"><h1>${esc(L(UI.finalTitle))}</h1>
      <div class="champ">${portraitHTML(S.players[w].char, 120, 'glow')}<div><small>${esc(L(UI.champion))}</small><h2 style="color:${PCOL[w]}">${esc(this.pname(w))}</h2><p>「${esc(L(ch.win))}」</p></div></div>
      <ol>${m.rank.map((i, k) => `<li class="${i === this.me ? 'me' : ''}" style="border-color:${PCOL[i]}"><em>${k + 1}</em>${portraitHTML(S.players[i].char, 40)}<b>${esc(this.pname(i))}</b><span>📜×${S.players[i].man}　${S.players[i].silver}${esc(L(UI.silver))}</span></li>`).join('')}</ol>
      <div class="fbtns"><button class="btn" id="fin-again">${esc(L(UI.again))}</button><button class="btn blue" id="fin-title">${esc(L(UI.toTitle))}</button></div></div>`;
    box.classList.add('on'); this.snd.sfx('cheer');
    this.finalRank = m.rank;
    if (this.onFinal) this.onFinal(m);
  }

  // ------------------------------------------------------------------ the frame loop
  loop() {
    if (!this.alive) return;
    requestAnimationFrame(() => this.loop());
    const t = now(); const dt = Math.min(0.05, t - this.lastT); this.lastT = t;
    const c = this.c; c.setTransform(1, 0, 0, 1, 0, 0);
    if (this.mode === 'mg' || (this.mode === 'mgintro' && this.mgCur)) this.drawMg(c, t);
    else if (this.B) this.drawBoard(c, t, dt);
    else { c.fillStyle = '#f6e6c4'; c.fillRect(0, 0, this.cv.width, this.cv.height); }
    if (this.mode === 'mg' && this.sendInput) this.sendInput();
  }
  vpos(i, t) {
    const v = this.vp[i]; if (!v) return [0, 0, 0];
    if (v.anim) {
      const a = v.anim; const k = Math.min(1, (t - a.t0) / a.dur);
      v.x = a.x0 + (a.x1 - a.x0) * ease(k); v.y = a.y0 + (a.y1 - a.y0) * ease(k); const z = Math.sin(k * Math.PI) * a.h;
      if (k >= 1) { v.anim = null; const n = this.B.nodes[this.S.players[i].node]; v.x = n.x; v.y = n.y; return [v.x, v.y, 0]; }
      return [v.x, v.y, z, a];
    }
    return [v.x, v.y, 0];
  }
  drawBoard(c, t, dt) {
    const S = this.S, B = this.B, W = this.W, H = this.H, d = this.dpr;
    // camera
    let tx, ty, z;
    if (this.mapMode) { tx = WORLD.w / 2; ty = WORLD.h / 2; z = Math.min(W / (WORLD.w + 40), H / (WORLD.h + 40)); }
    else {
      z = W < H ? Math.max(W / 760, H / 1100) : Math.min(W / 980, H / 600);
      if (this.camHold && t < this.camHold.until) [tx, ty] = this.nodeXY(this.camHold.node);
      else { const f = S.cur >= 0 ? S.cur : this.focus; [tx, ty] = this.vpos(f, t); }
    }
    const cam = this.cam; const k = 1 - Math.pow(0.002, dt);
    cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k; cam.z += (z - cam.z) * k;
    { const hw = W / 2 / cam.z, hh = H / 2 / cam.z; cam.x = hw * 2 >= WORLD.w ? WORLD.w / 2 : Math.max(hw, Math.min(WORLD.w - hw, cam.x)); cam.y = hh * 2 >= WORLD.h ? WORLD.h / 2 : Math.max(hh - 40, Math.min(WORLD.h - hh + 40, cam.y)); }
    let sx = 0, sy = 0; if (this.shake > 0) { this.shake -= dt; sx = (Math.random() - 0.5) * 14; sy = (Math.random() - 0.5) * 14; }
    c.fillStyle = B.def.sky; c.fillRect(0, 0, this.cv.width, this.cv.height);
    c.setTransform(d * cam.z, 0, 0, d * cam.z, d * (W / 2 + sx) - d * cam.z * cam.x, d * (H / 2 + sy) - d * cam.z * cam.y);
    if (this.bg) c.drawImage(this.bg, 0, 0);
    // the mountain bridge
    for (const br of B.branches) if (br.bridge) this.drawBridge(c, br, S.bridge, t);
    // spaces
    for (const n of B.nodes) {
      const sp = SPACES[n.type] || SPACES.b; const r = 23;
      c.fillStyle = 'rgba(0,0,0,0.22)'; c.beginPath(); c.ellipse(n.x, n.y + 6, r + 2, r * 0.75, 0, 0, 7); c.fill();
      c.fillStyle = sp.ring; c.beginPath(); c.arc(n.x, n.y, r, 0, 7); c.fill();
      c.fillStyle = sp.color; c.beginPath(); c.arc(n.x, n.y, r - 5, 0, 7); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.25)'; c.beginPath(); c.ellipse(n.x - 5, n.y - 7, 9, 5, -0.4, 0, 7); c.fill();
      if (n.type === 'b' || n.type === 'r') { c.fillStyle = 'rgba(255,255,255,0.9)'; c.font = 'bold 18px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(n.type === 'b' ? '+' : '−', n.x, n.y + 1); }
      else { const lab = n.type === 'g' ? { town: '車', mountain: '風', river: '渡' }[B.id] : sp.label; this.A.txt(c, lab, n.x, n.y + 1, { size: 17, color: '#fff' }); }
    }
    if (this.wayOpts) for (const o of this.wayOpts) { const n = B.nodes[o]; const p = 0.5 + 0.5 * Math.sin(t * 8); c.strokeStyle = `rgba(255,255,255,${0.5 + p * 0.5})`; c.lineWidth = 5; c.beginPath(); c.arc(n.x, n.y, 30 + p * 4, 0, 7); c.stroke(); }
    // shop keepers and Mr Bai's stall
    for (const n of B.nodes) if (n.type === 's') { this.A.npc(c, 'jiabafang', n.x + 34, n.y - 4, 2.2, {}); }
    const bn = B.nodes[S.bai];
    if (bn) {
      const bob = Math.sin(t * 3) * 3;
      c.fillStyle = 'rgba(255,230,90,0.35)'; c.beginPath(); c.arc(bn.x, bn.y, 38 + bob, 0, 7); c.fill();
      c.fillStyle = '#8a4a2a'; c.fillRect(bn.x + 22, bn.y - 20, 46, 18); c.fillStyle = '#c03a2a'; c.fillRect(bn.x + 50, bn.y - 78, 4, 60);
      c.fillStyle = '#fff4d8'; c.fillRect(bn.x + 54, bn.y - 78, 26, 44); this.A.txt(c, '秘', bn.x + 67, bn.y - 66, { size: 14, color: '#c03a2a' }); this.A.txt(c, '笈', bn.x + 67, bn.y - 48, { size: 14, color: '#c03a2a' });
      this.A.npc(c, 'baixian', bn.x + 40, bn.y - 18, 2.6, {});
      this.A.txt(c, '📜' + MANUAL_PRICE, bn.x, bn.y - 44 + bob, { size: 14, color: '#6a3a00', bubble: true });
    }
    // players (sorted by y), sharing nodes spread out
    const pos = [0, 1, 2, 3].map(i => this.vpos(i, t));
    const off = [[0, 0], [0, 0], [0, 0], [0, 0]];
    for (let i = 0; i < 4; i++) { const same = [0, 1, 2, 3].filter(j => !this.vp[j].anim && Math.abs(pos[j][0] - pos[i][0]) < 4 && Math.abs(pos[j][1] - pos[i][1]) < 4); if (same.length > 1 && !this.vp[i].anim) { const k2 = same.indexOf(i); off[i] = [(k2 - (same.length - 1) / 2) * 30, (k2 % 2) * 10 - 5]; } }
    const order = [0, 1, 2, 3].sort((a, b) => pos[a][1] - pos[b][1]);
    for (const i of order) {
      const [x0, y0, zz, a] = pos[i]; const x = x0 + off[i][0], y = y0 + off[i][1];
      c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(x, y + 4, 16, 6, 0, 0, 7); c.fill();
      if (a && a.ride) this.drawRide(c, a.ride, x, y - zz, t);
      this.A.spr(c, i, x, y + 2 - zz, 2.8, { walk: !!a, rot: a && a.spin ? (t * 12) : 0, alpha: S.players[i].skip ? 0.7 : 1 });
      if (S.players[i].skip) this.A.txt(c, 'Zz', x + 18, y - 70, { size: 14, color: '#6a6aff' });
      if (S.cur === i) { const bb = Math.sin(t * 6) * 4; c.fillStyle = PCOL[i]; c.beginPath(); c.moveTo(x - 9, y - 86 + bb); c.lineTo(x + 9, y - 86 + bb); c.lineTo(x, y - 74 + bb); c.fill(); }
      if (this.stepsLeft[i] > 0) { c.fillStyle = '#fff'; c.beginPath(); c.arc(x, y - 96, 15, 0, 7); c.fill(); c.strokeStyle = PCOL[i]; c.lineWidth = 3; c.stroke(); this.A.txt(c, String(this.stepsLeft[i]), x, y - 95, { size: 18, color: '#222' }); }
    }
    if (this.bandits) { const k3 = (t - this.bandits.t) * this.sp; if (k3 > 3) this.bandits = null; else { const [x, y] = pos[this.bandits.i]; ['heixiong', 'daoba', 'shouhou'].forEach((id, j) => { const ax = x + [-60, 60, 0][j], ay = y + [10, 10, -40][j]; const e = Math.min(1, k3 * 2); this.A.npc(c, id, x + (ax - x) * e * (k3 > 2.5 ? (3 - k3) * 2 : 1) + (j === 2 ? 0 : 0), ay, 2.8, { walk: true, flip: j === 1 }); }); } }
    // effects
    this.fx = this.fx.filter(f => {
      const age = (t - f.t) * this.sp; const p = f.i != null ? pos[f.i] : null;
      if (f.k === 'float') { if (age > 1.4) return false; this.A.txt(c, f.s, p[0], p[1] - 80 - age * 40, { size: f.size, color: f.col, stroke: '#3a2a1a' }); return true; }
      if (f.k === 'ring') { if (age > 0.6) return false; c.strokeStyle = f.col; c.globalAlpha = 1 - age / 0.6; c.lineWidth = 6; c.beginPath(); c.arc(p[0], p[1], 24 + age * 80, 0, 7); c.stroke(); c.globalAlpha = 1; return true; }
      if (f.k === 'q') { if (age > 1) return false; this.A.txt(c, '?', p[0], p[1] - 110 - age * 20, { size: 40 + age * 10, color: '#2ab86a', stroke: '#fff' }); return true; }
      if (f.k === 'gust') { if (age > 1) return false; c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 4; for (let j = 0; j < 3; j++) { c.beginPath(); c.arc(p[0], p[1] - 30, 20 + j * 12 + age * 20, age * 10 + j, age * 10 + j + 2); c.stroke(); } return true; }
      if (f.k === 'manual') { if (age > 2.2) return false; const yy = p[1] - 100 - Math.min(1, age) * 40; c.fillStyle = 'rgba(255,230,90,0.5)'; c.beginPath(); c.arc(p[0], yy, 40 + Math.sin(age * 10) * 6, 0, 7); c.fill(); for (let j = 0; j < 8; j++) { const aa = j * 0.785 + age * 2; c.fillStyle = '#ffe040'; c.fillRect(p[0] + Math.cos(aa) * (40 + age * 30), yy + Math.sin(aa) * (40 + age * 30), 5, 5); } this.A.txt(c, '📜', p[0], yy, { size: 40 }); return true; }
      if (f.k === 'smoke') { if (age > 1) return false; const n = B.nodes[f.node]; c.fillStyle = `rgba(255,255,255,${1 - age})`; for (let j = 0; j < 6; j++) { c.beginPath(); c.arc(n.x + Math.cos(j) * age * 50, n.y - 20 + Math.sin(j) * age * 30, 16, 0, 7); c.fill(); } return true; }
      return true;
    });
    // dice
    this.dice = this.dice.filter(dd => {
      const age = t - dd.t0; if (age > dd.dur + 1.6 / this.sp) return false;
      let x, y;
      if (dd.i >= 0) { const p = pos[dd.i]; x = p[0]; y = p[1] - 120; }
      else { const p = pos[dd.beside]; x = p[0] - 70; y = p[1] - 120; this.A.npc(c, dd.npc, x, p[1] - 10, 2.8, {}); }
      const rolling = age < dd.dur;
      dd.vals.forEach((v, k2) => { const xx = x + (k2 - (dd.vals.length - 1) / 2) * 62; const show = rolling ? 1 + Math.floor(age * 18 + k2 * 3) % 6 : v; const bounce = rolling ? Math.abs(Math.sin(age * 14)) * 10 : Math.max(0, 1 - (age - dd.dur) * 4) * -14; this.drawDie(c, xx, y - bounce, show, rolling ? age * 9 : 0, !rolling); });
      if (!rolling && dd.vals.length > 1) this.A.txt(c, '= ' + dd.vals.reduce((a2, b2) => a2 + b2, 0), x, y + 48, { size: 22, color: '#fff', stroke: '#3a2a1a' });
      return true;
    });
    // speech bubbles in screen space
    c.setTransform(d, 0, 0, d, 0, 0);
    this.bubbles = this.bubbles.filter(b => {
      const age = t - b.t; if (age > b.dur) return false; const p = pos[b.i];
      const X = W / 2 + (p[0] - cam.x) * cam.z, Y = H / 2 + (p[1] - cam.y) * cam.z - 80 * cam.z - 26;
      this.drawBubble(c, b.s, X, Y, PCOL[b.i]); return true;
    });
  }
  drawBubble(c, s, X, Y, col) {
    c.font = '15px "Cubic 11", "PingFang TC", "Microsoft JhengHei", sans-serif';
    const maxW = Math.min(300, this.W * 0.6); const words = [...s]; const lines = []; let line = '';
    for (const ch of words) { if (c.measureText(line + ch).width > maxW) { lines.push(line); line = ch; } else line += ch; }
    lines.push(line);
    const w = Math.max(...lines.map(l => c.measureText(l).width)) + 20, h = lines.length * 19 + 14;
    const x = Math.max(6, Math.min(this.W - w - 6, X - w / 2)), y = Math.max(50, Y - h);
    c.fillStyle = '#fff'; c.strokeStyle = col; c.lineWidth = 3; rr(c, x, y, w, h, 10); c.fill(); c.stroke();
    c.fillStyle = '#fff'; c.beginPath(); c.moveTo(X - 7, y + h - 2); c.lineTo(X, y + h + 10); c.lineTo(X + 7, y + h - 2); c.fill();
    c.fillStyle = '#2a1a10'; c.textAlign = 'left'; c.textBaseline = 'top'; lines.forEach((l, k) => c.fillText(l, x + 10, y + 8 + k * 19));
  }
  drawDie(c, x, y, v, rot, done) {
    c.save(); c.translate(x, y); c.rotate(Math.sin(rot) * 0.3);
    c.fillStyle = 'rgba(0,0,0,0.25)'; rr(c, -24, -20, 52, 52, 10); c.fill();
    c.fillStyle = done ? '#fff8e8' : '#fff'; c.strokeStyle = '#c0302a'; c.lineWidth = 4; rr(c, -26, -26, 52, 52, 10); c.fill(); c.stroke();
    const pips = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]], 7: [[-1, -1], [1, -1], [-1, 0], [0, 0], [1, 0], [-1, 1], [1, 1]] }[Math.min(7, v)] || [];
    c.fillStyle = v === 1 ? '#e83a2a' : '#2a1a10';
    for (const [px, py] of pips) { c.beginPath(); c.arc(px * 13, py * 13, v === 1 ? 8 : 5.5, 0, 7); c.fill(); }
    c.restore();
  }
  drawRide(c, kind, x, y, t) {
    if (kind === 'town') { c.fillStyle = '#c0302a'; c.fillRect(x - 26, y - 30, 40, 26); c.fillStyle = '#2a1a10'; c.beginPath(); c.arc(x - 6, y - 2, 12, 0, 7); c.fill(); c.strokeStyle = '#8a5a2a'; c.lineWidth = 3; c.beginPath(); c.moveTo(x + 14, y - 14); c.lineTo(x + 46, y - 8); c.stroke(); }
    else if (kind === 'river') { c.fillStyle = '#8a5a2a'; c.beginPath(); c.moveTo(x - 46, y - 10); c.quadraticCurveTo(x, y + 14, x + 46, y - 10); c.lineTo(x + 36, y + 2); c.lineTo(x - 36, y + 2); c.fill(); }
    else if (kind === 'jar') { c.save(); c.translate(x, y - 24); c.rotate(t * 10); c.fillStyle = '#8a5a3a'; c.beginPath(); c.ellipse(0, 0, 26, 30, 0, 0, 7); c.fill(); c.fillStyle = '#c03a2a'; c.fillRect(-12, -6, 24, 12); c.restore(); }
  }
  drawBridge(c, br, open, t) {
    const pts = br.pts;
    if (open) {
      c.strokeStyle = '#6a4a2a'; c.lineWidth = 46; c.lineCap = 'butt'; c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.stroke();
      c.strokeStyle = '#b08050'; c.lineWidth = 38; c.stroke();
      c.strokeStyle = '#7a5a3a'; c.lineWidth = 2; for (let k = 1; k < pts.length; k++) { const [a, b] = [pts[k - 1], pts[k]]; for (let s = 0; s < 1; s += 0.25) { const x = a[0] + (b[0] - a[0]) * s, y = a[1] + (b[1] - a[1]) * s; c.beginPath(); c.moveTo(x, y - 19); c.lineTo(x, y + 19); c.stroke(); } }
      c.strokeStyle = '#d8c090'; c.lineWidth = 3; for (const dy of [-24, 24]) { c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1] + dy) : c.moveTo(p[0], p[1] + dy)); c.stroke(); }
    } else {
      c.strokeStyle = 'rgba(120,80,40,0.8)'; c.lineWidth = 6; const a = pts[0], b = pts[pts.length - 1];
      c.beginPath(); c.moveTo(a[0], a[1]); c.quadraticCurveTo(a[0] - 40, a[1] + 120, a[0] - 30, a[1] + 170); c.stroke();
      c.beginPath(); c.moveTo(b[0], b[1]); c.quadraticCurveTo(b[0] + 40, b[1] + 120, b[0] + 30, b[1] + 170); c.stroke();
    }
  }
  drawMg(c, t) {
    const W = this.W, H = this.H, d = this.dpr;
    let S;
    if (this.mgLive) S = this.mgLive();
    else if (this.mgCur) { if (this.mgPrev) { const k = Math.min(1, (now() - this.mgCurT) / Math.max(0.03, this.mgCurT - this.mgPrevT)); S = lerpObj(this.mgPrev, this.mgCur, k); } else S = this.mgCur; }
    c.fillStyle = '#1a1420'; c.fillRect(0, 0, this.cv.width, this.cv.height);
    if (!S) return;
    const g = MINIGAMES[S.id];
    // arena fit (touch landscape: leave room at the sides for thumbs)
    const touchL = document.body.classList.contains('touchy') && W > H;
    const availW = touchL ? W - 40 : W, availH = H - (W < H ? 200 : 0);
    const z = Math.min(availW / 640, availH / 360); const ox = (W - 640 * z) / 2, oy = W < H ? Math.max(70, (availH - 360 * z) / 2) : (H - 360 * z) / 2;
    c.setTransform(d * z, 0, 0, d * z, d * ox, d * oy);
    c.save(); c.beginPath(); c.rect(0, 0, 640, 360); c.clip();
    try { g.draw(c, S, this.A); } catch (e) { console.error(e); }
    c.restore();
    // countdown / go / finish
    if (S.t < 0) { const n = Math.ceil(-S.t); this.A.txt(c, String(n), 320, 180, { size: 90, color: '#fff', stroke: '#3a2a1a' }); if (this.cdLast !== n) { this.cdLast = n; this.snd.sfx('tick'); } }
    else if (S.t < 0.8) { this.A.txt(c, L(UI.go), 320, 180, { size: 80 + S.t * 20, color: '#ffe040', stroke: '#c0302a' }); if (this.cdLast !== 0) { this.cdLast = 0; this.snd.sfx('go'); } }
    if (S.over) { this.A.txt(c, L(UI.finish), 320, 180, { size: 72, color: '#fff', stroke: '#c0302a' }); if (this.cdLast !== -1) { this.cdLast = -1; this.snd.sfx('gong'); } }
    else if (S.t >= 0) { this.A.txt(c, String(Math.max(0, Math.ceil(S.dur - S.t))), 320, 14, { size: 16, color: '#fff', stroke: '#000' }); }
    // my score feedback sounds
    if (this.me >= 0 && this.me < 4 && S.t > 0 && !S.over && FEEDBACK.includes(S.id)) { const sc = g.score(S)[this.me]; if (this.lastMyScore != null && sc !== this.lastMyScore) this.snd.sfx(sc > this.lastMyScore ? 'hit' : 'bonk'); this.lastMyScore = sc; }
    c.setTransform(d, 0, 0, d, 0, 0);
    if (W < H) this.A.txt(c, L({ zh: '↻ 橫放手機，畫面更大', en: '↻ Turn your phone sideways for a bigger view' }), W / 2, oy + 360 * z + 26, { size: 14, color: '#b8a8c8' });
    this.A.txt(c, L(g.name), 10 + (document.body.classList.contains('touchy') ? 0 : 0), Math.max(14, oy - 12) + (oy < 30 ? 14 : 0), { size: 14, color: '#fff', stroke: '#2a1a10', align: 'left' });
  }
}
