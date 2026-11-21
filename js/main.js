// 龍門鬧江湖 Longmen Ruckus - menus, lobby, rooms and the glue between the host, the network and the view.
import { L, LANG, CHARS, CHAR, UI } from './data.js?v=2';
import { BOARD_IDS, boardName, boardBlurb, buildBoard, paintBoard } from './boards.js?v=2';
import { SPACES } from './data.js?v=2';
import { MINIGAMES, MG_IDS } from './minigames.js?v=2';
import { HostNet, ClientNet, makeCode } from './net.js?v=2';
import { Host } from './host.js?v=2';
import { View, PCOL, portraitHTML, spriteHTML } from './view.js?v=2';
import { Input } from './input.js?v=2';
import { Sound } from './audio.js?v=2';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const Q = new URLSearchParams(location.search);
const FAST = Math.max(1, +(Q.get('fast') || 1));
const AUTO = Q.has('auto');
const PROFILE = 'lr-profile';
const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

class App {
  constructor() {
    this.snd = new Sound(); this.input = new Input($('#view'));
    document.body.classList.toggle('touchy', this.input.touchy);
    this.me = this.loadProfile();
    this.role = null; this.net = null; this.host = null; this.view = null; this.mySeat = 0;
    this.set = { turns: 10, board: 'town', lv: 1 };
    this.bindUI(); this.applyLang(); this.title();
    const code = location.hash.replace('#', '').toUpperCase(); if (/^[A-Z2-9]{5}$/.test(code)) $('#joincode').value = code;
    window.LR = this;
    addEventListener('pagehide', () => this.saveProfile());
  }
  loadProfile() { try { const p = JSON.parse(localStorage.getItem(PROFILE)); if (p && p.name) return p; } catch (e) { /* none */ } return { name: '', char: 'yirui' }; }
  saveProfile() { try { localStorage.setItem(PROFILE, JSON.stringify(this.me)); } catch (e) { /* private mode */ } }
  myName() { return this.me.name || L(CHAR[this.me.char].name); }

  // ------------------------------------------------------------------ screens
  show(k) { for (const s of ['title', 'lobby', 'game']) $('#' + s).classList.toggle('on', s === k); document.body.dataset.mode = k; }
  applyLang() {
    document.documentElement.lang = LANG.cur === 'zh' ? 'zh-Hant' : 'en';
    document.querySelectorAll('[data-t]').forEach(el => { el.textContent = L(UI[el.dataset.t]); });
    document.querySelectorAll('[data-ph]').forEach(el => { el.placeholder = L(UI[el.dataset.ph]); });
    $('#howto-text').textContent = L(UI.howtoText);
    document.title = L(UI.title) + ' ' + (LANG.cur === 'zh' ? 'Longmen Ruckus' : '龍門鬧江湖');
    if (this.role) this.lobbyUI();
    this.titleCast();
  }
  titleCast() {
    const ids = ['yirui', 'yishuo', 'xiaotian', 'liuhanyan', 'kuchan', 'niubaobao', 'wudadan', 'huotianxia', 'aman', 'chutiankuo', 'wenduizhang', 'tuqianqiu'];
    $('#cast').innerHTML = ids.map((id, k) => `<span style="animation-delay:${k * 0.13}s">${spriteHTML(id, 72)}</span>`).join('');
  }
  title() {
    this.show('title'); this.snd.music('title');
    $('#pname').value = this.me.name;
  }
  bindUI() {
    const on = (sel, f) => $(sel).addEventListener('click', (e) => { this.snd.init(); this.snd.sfx('click'); f(e); });
    on('#btn-solo', () => this.startSolo());
    on('#btn-host', () => this.startHost());
    on('#btn-join', () => { const c = $('#joincode').value.trim().toUpperCase(); if (!/^[A-Z2-9]{5}$/.test(c)) { this.toast(L(UI.joinPh)); return; } this.startJoin(c); });
    on('#btn-lang', () => { LANG.cur = LANG.cur === 'zh' ? 'en' : 'zh'; try { localStorage.setItem('lr-lang', LANG.cur); } catch (e) { /* private */ } this.applyLang(); if (this.view && this.view.S) this.view.hud(); });
    on('#btn-howto', () => $('#howto').classList.toggle('on'));
    on('#howto', () => $('#howto').classList.remove('on'));
    on('#btn-music', () => { const m = this.snd.toggleMusic(); document.querySelectorAll('.btn-music').forEach(b => b.textContent = m ? '♪' : '×'); });
    on('#btn-music2', () => { const m = this.snd.toggleMusic(); document.querySelectorAll('.btn-music').forEach(b => b.textContent = m ? '♪' : '×'); });
    on('#btn-back', () => this.leave());
    on('#btn-start', () => this.hostStart());
    on('#btn-copy', () => { const url = location.origin + location.pathname + '#' + this.code; (navigator.clipboard?.writeText(url) || Promise.reject()).then(() => this.toast(L(UI.copied)), () => this.toast(url, 5000)); });
    on('#btn-map', () => { if (this.view) this.view.mapMode = !this.view.mapMode; });
    on('#btn-quit', () => { if (confirm(L(UI.quit))) this.leave(); });
    $('#pname').addEventListener('input', (e) => { this.me.name = e.target.value.trim().slice(0, 8); this.saveProfile(); });
    document.querySelectorAll('.btn-music').forEach(b => b.textContent = this.snd.musicOn ? '♪' : '×');
  }
  toast(t, ms = 2200) { const d = document.createElement('div'); d.className = 'toast'; d.textContent = t; $('#toasts').appendChild(d); setTimeout(() => d.classList.add('out'), ms); setTimeout(() => d.remove(), ms + 500); }

  // ------------------------------------------------------------------ lobby (the host owns the seat list)
  freshSeats() {
    const seats = [{ kind: 'human', cid: null, name: this.me.name, char: this.me.char }];
    const free = shuffle(CHARS.map(c => c.id).filter(id => id !== this.me.char));
    for (let i = 1; i < 4; i++) seats.push({ kind: 'bot', cid: null, name: '', char: free[i] });
    return seats;
  }
  startSolo() { this.role = 'solo'; this.code = null; this.mySeat = 0; this.seats = this.freshSeats(); this.openLobby(); }
  startHost() {
    this.role = 'host'; this.code = makeCode(); this.mySeat = 0; this.seats = this.freshSeats(); this.openLobby();
    $('#lobby-status').textContent = L(UI.creating);
    this.net = new HostNet(this.code, {
      onOpen: () => { $('#lobby-status').textContent = L(UI.roomOpen); history.replaceState(null, '', location.pathname + location.search + '#' + this.code); },
      onJoin: () => { },
      onMsg: (cid, m) => this.hostMsg(cid, m),
      onLeave: (cid) => this.dropClient(cid),
      onError: (k) => { if (k === 'taken') { this.net.close(); this.startHost(); return; } $('#lobby-status').textContent = k === 'nopeer' ? L(UI.nopeer) : L(UI.netErr, { k }); },
    });
    this.net.start();
  }
  startJoin(code) {
    this.role = 'client'; this.code = code; this.mySeat = -1; this.seats = null; this.openLobby();
    $('#lobby-status').textContent = L(UI.joining, { c: code });
    this.net = new ClientNet(code, {
      onOpen: () => this.net.send({ t: 'hello', name: this.myName(), char: this.me.char }),
      onMsg: (m) => this.clientMsg(m),
      onClose: () => { this.toast(L(UI.lost)); this.leave(); },
      onError: (k) => { $('#lobby-status').textContent = k === 'noroom' ? L(UI.noroom) : k === 'nopeer' ? L(UI.nopeer) : L(UI.netErr, { k }); },
    });
    this.net.start();
  }
  openLobby() { this.show('lobby'); this.lobbyUI(); }
  leave() {
    this.host?.stop(); this.host = null; this.view?.destroy(); this.view = null; this.net?.close(); this.net = null; this.role = null;
    for (const id of ['#final', '#mgintro', '#mgend', '#ask', '#talk', '#award', '#waiting']) $(id).classList.remove('on');
    document.body.classList.remove('inmg');
    history.replaceState(null, '', location.pathname + location.search);
    this.title();
  }
  lobbyUI() {
    const isHost = this.role !== 'client'; const seats = this.seats;
    $('#lobby-code').textContent = this.code || L(UI.solo1);
    $('#lobby-share').style.display = this.code && isHost ? '' : 'none';
    $('#btn-start').style.display = isHost ? '' : 'none';
    $('#lobby-wait').style.display = isHost ? 'none' : '';
    // character grid
    const taken = new Map((seats || []).map((s, i) => [s.char, i]));
    const mine = seats && this.mySeat >= 0 ? seats[this.mySeat].char : this.me.char;
    $('#chars').innerHTML = CHARS.map(c => { const t = taken.get(c.id); const by = t != null && t !== this.mySeat; return `<button class="ch ${c.id === mine ? 'sel' : ''} ${by && seats[t].kind === 'human' ? 'taken' : ''}" data-id="${c.id}" style="--c:${c.color}">${portraitHTML(c.id, 56)}<b>${esc(L(c.name))}</b>${t != null ? `<em class="bdg" style="background:${PCOL[t]}">P${t + 1}</em>` : ''}</button>`; }).join('');
    document.querySelectorAll('#chars .ch').forEach(b => b.addEventListener('click', () => { this.snd.init(); this.snd.sfx('click'); this.pickChar(b.dataset.id); }));
    const c = CHAR[mine];
    $('#char-info').innerHTML = `${spriteHTML(c.id, 96)}<div><h3 style="color:${c.color}">${esc(L(c.name))} <small>${esc(L(c.title))}</small></h3><p>「${esc(L(c.intro))}」</p><em>${esc(L(c.quirkName))}</em></div>`;
    // seats
    $('#seats').innerHTML = (seats || []).map((s, i) => `<li style="border-color:${PCOL[i]}">${portraitHTML(s.char, 30)}<b>${esc(s.kind === 'human' ? (s.name || L(CHAR[s.char].name)) : L(CHAR[s.char].name))}</b><span>${s.kind === 'bot' ? esc(L(UI.bot)) : i === this.mySeat ? esc(L(UI.you)) : ''}</span></li>`).join('');
    // settings
    const set = this.set;
    const opt = (key, vals, label) => vals.map(v => `<button class="${set[key] === v ? 'sel' : ''}" data-k="${key}" data-v="${v}" ${isHost ? '' : 'disabled'}>${esc(label(v))}</button>`).join('');
    $('#set-turns').innerHTML = opt('turns', [10, 15, 20], v => String(v));
    $('#set-board').innerHTML = opt('board', BOARD_IDS, v => L(boardName(v)));
    $('#set-lv').innerHTML = opt('lv', [0, 1, 2], v => L(UI.lv[v]));
    $('#board-blurb').textContent = L(boardBlurb(set.board));
    this.boardPreview(set.board);
    document.querySelectorAll('#lobby .opts button').forEach(b => b.addEventListener('click', () => {
      if (!isHost) return; this.snd.sfx('click'); const k = b.dataset.k; set[k] = k === 'board' ? b.dataset.v : +b.dataset.v; this.lobbyUI(); this.broadcastLobby();
    }));
  }
  boardPreview(id) {
    if (this.prevId === id) return; this.prevId = id;
    const B = buildBoard(id); const bg = paintBoard(B); const c = $('#board-prev').getContext('2d');
    c.drawImage(bg, 0, 0, 800, 500);
    for (const n of B.nodes) { c.fillStyle = '#fff'; c.beginPath(); c.arc(n.x / 2, n.y / 2, 11, 0, 7); c.fill(); c.fillStyle = (SPACES[n.type] || SPACES.b).color; c.beginPath(); c.arc(n.x / 2, n.y / 2, 8, 0, 7); c.fill(); }
  }
  pickChar(id) {
    if (this.role === 'client') { this.me.char = id; this.saveProfile(); this.net.send({ t: 'pick', char: id }); return; }
    const s = this.seats; const owner = s.findIndex(x => x.char === id);
    if (owner >= 0 && owner !== this.mySeat) { if (s[owner].kind === 'human') { this.toast(L(UI.taken)); return; } s[owner].char = s[this.mySeat].char; }
    s[this.mySeat].char = id; this.me.char = id; this.saveProfile(); this.lobbyUI(); this.broadcastLobby();
  }
  broadcastLobby() { if (this.role !== 'host' || !this.net) return; for (const [i, s] of this.seats.entries()) if (s.cid) this.net.send(s.cid, { t: 'lobby', seats: this.seats.map(x => ({ kind: x.kind, name: x.name, char: x.char })), set: this.set, you: i }); }
  hostMsg(cid, m) {
    const seat = this.seats ? this.seats.findIndex(s => s.cid === cid) : -1;
    if (m.t === 'hello') {
      if (this.host) { this.net.send(cid, { t: 'full' }); return; }
      const free = this.seats.findIndex(s => s.kind === 'bot');
      if (free < 0) { this.net.send(cid, { t: 'full' }); return; }
      const name = String(m.name || '').slice(0, 8);
      const s = this.seats[free]; s.kind = 'human'; s.cid = cid; s.name = name;
      if (m.char && CHAR[m.char] && !this.seats.some(x => x.char === m.char)) s.char = m.char;
      this.toast(L(UI.joined, { n: name || L(CHAR[s.char].name) }));
      this.lobbyUI(); this.broadcastLobby(); return;
    }
    if (seat < 0) return;
    if (m.t === 'pick' && !this.host) {
      if (!CHAR[m.char]) return; const owner = this.seats.findIndex(x => x.char === m.char);
      if (owner >= 0 && owner !== seat) { if (this.seats[owner].kind === 'human') { this.net.send(cid, { t: 'taken' }); return; } this.seats[owner].char = this.seats[seat].char; }
      this.seats[seat].char = m.char; this.lobbyUI(); this.broadcastLobby(); return;
    }
    if (!this.host) return;
    if (m.t === 'ans') this.host.answer(seat, m.id, m.v);
    else if (m.t === 'in') this.host.input(seat, m);
  }
  dropClient(cid) {
    const seat = this.seats ? this.seats.findIndex(s => s.cid === cid) : -1; if (seat < 0) return;
    const s = this.seats[seat]; const nm = s.name || L(CHAR[s.char].name);
    s.kind = 'bot'; s.cid = null; s.name = '';
    this.toast(L(UI.left, { n: nm }));
    if (this.host) this.host.toBot(seat); else { this.lobbyUI(); this.broadcastLobby(); }
  }
  clientMsg(m) {
    if (m.t === 'lobby') { this.seats = m.seats; this.set = m.set; this.mySeat = m.you; if (!this.view) { $('#lobby-status').textContent = ''; this.show('lobby'); this.lobbyUI(); } return; }
    if (m.t === 'full') { $('#lobby-status').textContent = L(UI.full); return; }
    if (m.t === 'taken') { this.toast(L(UI.taken)); return; }
    if (m.t === 'start') { this.mySeat = m.you; this.startView(m.you, (id, v) => this.net.send({ t: 'ans', id, v })); return; }
    if (m.t === 'toLobby') { this.view?.destroy(); this.view = null; $('#final').classList.remove('on'); this.show('lobby'); this.lobbyUI(); return; }
    if (this.view) this.view.recv(m);
  }

  // ------------------------------------------------------------------ playing
  startView(seat, answer) {
    this.show('game');
    for (const id of ['#final', '#mgintro', '#mgend', '#ask', '#talk', '#award']) $(id).classList.remove('on');
    $('#hud-cards').innerHTML = '';
    const v = new View({ canvas: $('#view'), sound: this.snd, input: this.input, me: seat, answer, speed: FAST, onFinal: () => this.onFinal() });
    this.view = v;
    let lastSend = 0, lastKey = '';
    const autoMem = {}; let autoN = 0;
    v.sendInput = () => {
      let inp = this.input.state();
      if (AUTO) { // test autopilot: play like a bot from what this screen sees
        const S = this.host ? this.host.mg?.S : v.mgCur; if (S) { const g = MINIGAMES[S.id]; const b = g.bot(S, seat, 0.6, autoMem); autoN += b.p || 0; inp = { x: b.x, y: b.y, a: b.a, n: autoN }; }
      }
      if (this.host) { this.host.input(seat, inp); return; }
      const t = performance.now(); const key = inp.x.toFixed(2) + inp.y.toFixed(2) + inp.a + inp.n;
      if (key !== lastKey || t - lastSend > 120) { if (t - lastSend > 30 || inp.n !== this.lastN) { this.net?.send({ t: 'in', ...inp }); lastSend = t; lastKey = key; this.lastN = inp.n; } }
    };
    if (AUTO) v.auto = (m) => {
      const d = m.data || {};
      if (m.kind === 'roll') return d.items && d.items.length && Math.random() < 0.5 && d.items[0] !== 'tiebu' ? { item: 0 } : { roll: true };
      if (m.kind === 'buy') return true; if (m.kind === 'shop') return d.items.find(id => true) || null;
      if (d.opts) return d.opts[Math.floor(Math.random() * d.opts.length)];
      return true;
    };
    if (this.host) v.mgLive = () => this.host.mg ? this.host.mg.S : null;
    return v;
  }
  hostStart() {
    const seats = this.seats.map(s => ({ ...s }));
    const emit = (m) => { this.view?.recv(m); if (this.net) this.net.all(m); };
    for (const [i, s] of seats.entries()) if (s.cid) this.net.send(s.cid, { t: 'start', you: i });
    this.startView(this.mySeat, (id, v) => this.host?.answer(this.mySeat, id, v));
    this.host = new Host({ seats, settings: { ...this.set }, emit, speed: FAST });
    this.seats.forEach((s, i) => { if (s.kind === 'bot') this.host.seats[i].kind = 'bot'; });
    const mgList = Q.get('mg');
    if (mgList) this.host.runMinigames(mgList === 'all' ? MG_IDS : mgList.split(',')).catch(e => console.error(e));
    else this.host.run().catch(e => console.error(e));
  }
  onFinal() {
    const again = $('#fin-again'), back = $('#fin-title');
    if (this.role === 'client') again.style.display = 'none';
    again.addEventListener('click', () => {
      this.snd.sfx('click'); this.host?.stop(); this.host = null; this.view?.destroy(); this.view = null; $('#final').classList.remove('on');
      if (this.net) for (const s of this.seats) if (s.cid) this.net.send(s.cid, { t: 'toLobby' });
      this.openLobby(); this.broadcastLobby(); this.snd.music('title');
    });
    back.addEventListener('click', () => { this.snd.sfx('click'); this.leave(); });
  }
}
new App();
