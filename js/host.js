// The host runs the whole party: board state, dice, events, items, minigames and payouts.
// Everyone (the host's own screen included) only sees what it emits: {t:'state'} snapshots and {t:'cue'} animations.
import { CHAR, ITEMS, ITEM_IDS, MANUAL_PRICE, AWARDS, pick } from './data.js?v=3';
import { buildBoard, distTo, nextOf } from './boards.js?v=3';
import { MINIGAMES, MG_IDS } from './minigames.js?v=3';

const R = Math.random;
const d6 = () => 1 + Math.floor(R() * 6);
const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const SKILL = [0.32, 0.6, 0.88];
const TX = {
  blue: { zh: '{n} 撿到 {v} 兩銀子！', en: '{n} finds {v} silver!' },
  red: { zh: '{n} 掉了 {v} 兩銀子……', en: '{n} drops {v} silver...' },
  block: { zh: '鐵布衫！{n} 毫髮無傷。', en: 'Iron Shirt! {n} shrugs it off.' },
  jar: { zh: '{n} 一頭鑽進罈子裡躲過了！', en: '{n} dives into a jar and dodges it!' },
  gift: { zh: '路邊撿到一個 {i}！', en: 'Found a {i} by the road!' },
  giftFull: { zh: '撿到寶物……可是拿不下了，換成 4 兩。', en: 'Found a treasure... but no room. Sold for 4 silver.' },
  bai0: { zh: '要買《武林秘笈》嗎？只要 {p} 兩。', en: 'Care for a Secret Manual? Only {p} silver.' },
  bai2: { zh: '還有一本！今天買二……也不送一，但一樣是 {p} 兩。', en: 'One more copy! Buy two... get none free, still {p} silver.' },
  baiPoor: { zh: '{p} 兩一本，概不賒帳。下回請早。', en: '{p} silver a copy, no credit. Do come again.' },
  baiSold: { zh: '好眼光！這本秘笈……嗯，跟上一本不一樣。', en: 'A fine choice! This manual is... different from the last one, honest.' },
  baiMove: { zh: '說書人收攤，換個地方說書去也！', en: 'The storyteller packs up and moves to a new corner!' },
  shop0: { zh: '客官看看！全江湖最便宜！', en: 'Take a look, friend! Cheapest in the jianghu!' },
  shopPoor: { zh: '沒錢？那……看看也好，看看不用錢。', en: 'No money? Well... looking is free.' },
  shopFull: { zh: '你身上塞不下了啦！', en: 'You can\'t carry any more!' },
  shopBuy: { zh: '成交！{i} 是你的了！', en: 'Deal! The {i} is yours!' },
  duel0: { zh: '{n} 向 {m} 下戰帖！擲骰比大小！', en: '{n} challenges {m}! Highest roll wins!' },
  duelWin: { zh: '{n} 贏了，拿走 {v} 兩！', en: '{n} wins and takes {v} silver!' },
  duelTie: { zh: '平手！兩人互相抱拳。', en: 'A tie! They bow to each other.' },
  ride: { zh: '{g}！一路顛到別處去……', en: '{g}! Off you bounce...' },
  gust: { zh: '一陣山風把 {n} 吹走了！', en: 'A mountain gust blows {n} away!' },
  whirl: { zh: '漩渦！{n} 被捲回去了！', en: 'Whirlpool! {n} gets dragged back!' },
  needle: { zh: '{n} 對 {m} 射出點穴針！{m} 下回合動不了！', en: '{n} flicks a needle at {m}! {m} can\'t move next turn!' },
  swap: { zh: '迷魂香……{n} 和 {m} 換了位置！', en: 'Dizzy incense... {n} and {m} swap places!' },
  abacus: { zh: '劈哩啪啦——{n} 從 {m} 身上算走 {v} 兩！', en: 'Click-clack - {n} "calculates" {v} silver out of {m}!' },
  gavel: { zh: '啪！醒木一拍——白先生搬攤了！', en: 'CLACK! The gavel strikes - Mr Bai moves his stall!' },
  qing: { zh: '輕功符！這回合擲兩顆骰子！', en: 'Qinggong Talisman! Two dice this turn!' },
  doubles: { zh: '對子！上聯配下聯，再得 5 兩！', en: 'Doubles! A matched couplet: +5 silver!' },
  steal: { zh: '{n} 經過時「順手」拿了 {m} 1 兩。', en: '{n} "accidentally" lifts 1 silver from {m} in passing.' },
  credit: { zh: '那本秘笈？是我介紹的！（霍天下 +1 兩）', en: 'That manual? My recommendation! (Huo Tianxia +1)' },
  lastTurns: { zh: '各位看官！最後三回合，藍格紅格通通加倍！', en: 'Ladies and gentlemen! The last three turns: blue and red spaces count double!' },
  bridgeUp: { zh: '吊橋升起來了！', en: 'The rope bridge goes up!' },
  bridgeDown: { zh: '吊橋放下來了！', en: 'The rope bridge comes down!' },
  orderIs: { zh: '順序決定了！', en: 'Turn order decided!' },
  welcome: { zh: '各位看官，今日說的是——{b}大亂鬥！誰買到最多《武林秘笈》，誰就是江湖第一！', en: 'Friends, today\'s tale: the great ruckus at {b}! Whoever buys the most Secret Manuals is the champion of the jianghu!' },
};
const EV = {
  fortuneGood: { zh: '鐵口直斷：你今天必定大發橫財！……咦，錢呢？（-{v} 兩）', en: 'My iron-mouth verdict: you will strike it rich today! ...Huh, where did your money go? (-{v})' },
  fortuneBad: { zh: '鐵口直斷：你今天必定破財！……咦，地上怎麼有錢？（+{v} 兩）', en: 'My iron-mouth verdict: you will lose money today! ...Huh, coins on the ground? (+{v})' },
  peddler: { zh: '祖傳寶物，只要 5 兩！不買是你的損失！', en: 'A family heirloom, just 5 silver! Your loss if you don\'t!' },
  junk: [{ zh: '……你得到一個缺角的破碗。', en: '...You get a chipped bowl.' }, { zh: '……你得到半隻鞋。是他自己的。', en: '...You get half a shoe. His own.' }, { zh: '……你得到一根「鳳凰羽毛」。是雞毛。', en: '...You get a "phoenix feather". It\'s a chicken feather.' }, { zh: '……你得到一張寫著「秘笈」兩字的白紙。', en: '...You get a blank page that says "manual".' }],
  real: { zh: '……咦？居然是真貨：{i}！', en: '...Wait, it\'s real: a {i}!' },
  peddlerPoor: { zh: '沒錢？那這個破碗送你……算了，不送。', en: 'No money? Then have this bowl... never mind.' },
  bandits: { zh: '此山是我開，此路是我栽！留下 {v} 兩買路錢！', en: 'This hill is ours, this road is ours! Leave {v} silver as toll!' },
  banditsHalf: { zh: '……是冷笑天？那、那拿一半就好。', en: '...Leng Xiaotian? Er, half will do, then.' },
  niu: { zh: '這錢聞起來像肉包！啊嗚——（-{v} 兩）', en: 'This money smells like pork buns! CHOMP! (-{v})' },
  niuCousin: { zh: '表哥！這幾兩給你買包子！（+3 兩）', en: 'Cousin! Here, some silver for buns! (+3)' },
  jar: { zh: '救命啊——！一個大酒罈滾下來，罈子裡還有武大膽！', en: 'HELP! A giant wine jar rolls down - with Wu Dadan inside!' },
  couplet: [{ zh: '上聯：骰子無情人有情。你對：「銀子有價秘笈無價」——好對！（+{v} 兩）', en: 'First line: "Dice are heartless, people are not." You reply: "Silver has a price, manuals have none." Bravo! (+{v})' }, { zh: '上聯：客棧樓高三百尺。你對：「包子……好吃」……勉強。（+{v} 兩）', en: 'First line: "The inn is three hundred feet tall." You reply: "Buns... are tasty." ...Passable. (+{v})' }],
  coldlaugh: { zh: '哼、哼、哼……冷笑三聲，大家嚇得掉了錢，全被 {n} 撿走！', en: 'Heh. Heh. Heh... three cold laughs! Everyone drops coins in fright, and {n} picks them up!' },
  alms: { zh: '阿彌陀佛，施主分 {v} 兩給 {m} 吧。', en: 'Amitabha. Kindly share {v} silver with {m}.' },
  almsSelf: { zh: '阿彌陀佛，施主看起來最需要，這 {v} 兩拿去吧。', en: 'Amitabha. You look like you need it most. Take these {v} silver.' },
  story: { zh: '話說那日……說到這裡，我得換個地方說了！', en: 'Now on that fateful day... and here I must move to a new corner!' },
  challenge: { zh: '站住！跟我比劃比劃！（楚天闊擲 {a}，你擲 {b}）', en: 'Halt! Duel me! (Chu Tiankuo rolls {a}, you roll {b})' },
  challengeWin: { zh: '輸了……記下來。這 6 兩給你。', en: 'I lost... noted. Take these 6 silver.' },
  challengeLose: { zh: '贏了！記下來！你的 3 兩歸我！', en: 'I won! Noted! Your 3 silver is mine!' },
  wolves: { zh: '嗷嗚——狼群載著 {n} 往前狂奔！', en: 'Awoo! A wolf pack carries {n} forward!' },
};

export class Host {
  // seats: [{kind:'human'|'bot', cid, name, char}], settings: {turns, board, lv}, emit(msg), speed
  constructor({ seats, settings, emit, speed = 1 }) {
    this.seats = seats; this.set = settings; this.emitFn = emit; this.sp = speed;
    this.B = buildBoard(settings.board);
    this.asks = new Map(); this.askId = 1; this.inputs = [0, 1, 2, 3].map(() => ({ x: 0, y: 0, a: false, n: 0 })); this.seenN = [0, 0, 0, 0];
    this.botMem = [{}, {}, {}, {}]; this.skill = seats.map(() => SKILL[settings.lv ?? 1] + (R() - 0.5) * 0.14);
    this.decks = {};
    this.over = false;
  }
  emit(m) { this.emitFn(m); }
  sleep(ms) { return new Promise(r => setTimeout(r, ms / this.sp)); }
  nm(i) { const p = this.S.players[i]; return p.nm || CHAR[p.char].name; }
  sync() { this.emit({ t: 'state', s: this.S }); }
  async cue(c, ms = 0) { this.emit({ t: 'cue', c }); if (ms) await this.sleep(ms); }
  async talk(who, o, v, ms = 2200) { await this.cue({ k: 'talk', who, o, v }, ms); }
  async say(i, o, v, ms = 1400) { await this.cue({ k: 'say', i, o, v }, ms); }
  isBot(i) { return this.seats[i].kind === 'bot'; }

  // ------------------------------------------------------------------ asking players
  ask(i, kind, data, ms = 30000) {
    const id = this.askId++;
    return new Promise((resolve) => {
      const entry = { i, kind, data, resolve, id };
      this.asks.set(id, entry);
      if (this.isBot(i)) { setTimeout(() => this.answer(i, id, this.botAnswer(i, kind, data)), (350 + R() * 500) / this.sp); }
      else { this.emit({ t: 'ask', id, i, kind, data }); entry.timer = setTimeout(() => this.answer(i, id, this.botAnswer(i, kind, data)), ms / this.sp); }
    });
  }
  answer(i, id, v) {
    const e = this.asks.get(id); if (!e || e.i !== i) return;
    clearTimeout(e.timer); this.asks.delete(id);
    this.emit({ t: 'asked', id });
    e.resolve(this.sanitize(e, v));
  }
  sanitize(e, v) {
    const { kind, data } = e;
    if (kind === 'roll') return v && (v.item == null || data.items[v.item]) ? v : { roll: true };
    if (kind === 'target' || kind === 'duel') return data.opts.includes(v) ? v : data.opts[0];
    if (kind === 'way') return data.opts.includes(v) ? v : data.opts[0];
    if (kind === 'shop') return v == null || data.items.includes(v) ? v : null;
    if (kind === 'buy') return !!v;
    return v;
  }
  // a seat's human left: a bot takes over (also answers anything pending for them)
  toBot(i) {
    this.seats[i].kind = 'bot';
    if (this.S) { this.S.players[i].bot = true; this.sync(); }
    for (const e of [...this.asks.values()]) if (e.i === i) this.answer(i, e.id, this.botAnswer(i, e.kind, e.data));
  }
  input(i, inp) { if (inp && typeof inp.x === 'number') this.inputs[i] = { x: Math.max(-1, Math.min(1, inp.x)), y: Math.max(-1, Math.min(1, inp.y || 0)), a: !!inp.a, n: inp.n | 0 }; }

  // ------------------------------------------------------------------ the board game
  baiDist(i) { return distTo(this.B, this.S.players[i].node, this.S.bai, this.S.bridge); }
  initState() {
    this.S = {
      board: this.set.board, turn: 0, turns: this.set.turns, bai: 0, bridge: true, cur: -1, phase: 'intro', last3: false, sp: this.sp,
      players: this.seats.map((s, i) => ({ char: s.char, nm: s.kind === 'human' && s.name ? s.name : null, bot: s.kind === 'bot', silver: 10, man: 0, items: [], node: 0, skip: false,
        stats: { mgWins: 0, steps: 0, spent: 0, events: 0, reds: 0, peak: 10 } })),
      order: [0, 1, 2, 3],
    };
    for (const p of this.S.players) if (CHAR[p.char].quirk === 'start_qinggong') p.items.push('qinggong');
    this.placeBai(true);
  }
  // test mode: just the given minigames, back to back
  async runMinigames(list) {
    this.initState(); this.S.turn = 1; this.sync();
    for (const id of list) { if (this.over) return; await this.minigameRound(id); this.emit({ t: 'mgdone', id }); }
    this.done = true;
  }
  async run() {
    const B = this.B;
    this.initState();
    this.sync();
    await this.cue({ k: 'banner', o: B.name, sub: B.blurb }, 2600);
    await this.talk('baixian', TX.welcome, { b: B.name }, 3200);
    for (let i = 0; i < 4; i++) await this.cue({ k: 'intro', i }, 2300);
    // roll for order
    await this.cue({ k: 'banner', o: { zh: '擲骰決定順序！', en: 'Roll for turn order!' } }, 1400);
    let vals; do { vals = [d6(), d6(), d6(), d6()]; } while (new Set(vals).size < 4);
    await this.cue({ k: 'orderDice', vals }, 2200);
    this.S.order = [0, 1, 2, 3].sort((a, b) => vals[b] - vals[a]);
    this.sync();
    await this.cue({ k: 'order', order: this.S.order }, 1800);
    for (let t = 1; t <= this.S.turns && !this.over; t++) {
      this.S.turn = t; this.S.phase = 'board';
      if (t === this.S.turns - 2 && this.S.turns >= 5) { this.S.last3 = true; this.sync(); await this.talk('baixian', TX.lastTurns, null, 2800); }
      this.sync();
      await this.cue({ k: 'turnBanner', t, n: this.S.turns }, 1500);
      for (const i of this.S.order) { if (this.over) return; await this.playerTurn(i); }
      if (this.over) return;
      await this.minigameRound();
      if (B.id === 'mountain' && !this.over) { this.S.bridge = !this.S.bridge; this.sync(); await this.cue({ k: 'bridge', open: this.S.bridge, o: this.S.bridge ? TX.bridgeDown : TX.bridgeUp }, 1600); }
    }
    if (!this.over) await this.finale();
  }

  placeBai(first) {
    const S = this.S, B = this.B;
    const cands = B.nodes.filter(n => n.type === 'b' && !n.junction && n.id !== S.bai && n.id !== 0);
    // somewhere a few turns ahead of everyone: nobody is right next to it, but the pack can reach it soon
    const score = (n) => { const ds = S.players.map(p => distTo(B, p.node, n.id, S.bridge)); const mn = Math.min(...ds), avg = ds.reduce((a, b) => a + b, 0) / ds.length; return mn >= (first ? 6 : 4) && avg <= (first ? 14 : 16); };
    const good = cands.filter(score);
    S.bai = pick(good.length ? good : cands).id;
  }
  async moveBai(o) { this.placeBai(false); this.sync(); await this.cue({ k: 'baiMove', node: this.S.bai, o: o || TX.baiMove }, 2000); }

  give(i, n) {
    const p = this.S.players[i]; if (n < 0) n = -Math.min(p.silver, -n); if (!n) return 0;
    p.silver += n; p.stats.peak = Math.max(p.stats.peak, p.silver);
    this.emit({ t: 'cue', c: { k: 'coins', i, v: n } });
    return n;
  }
  // a loss that the Iron Shirt (and Wu Dadan's jar) can stop
  async hurt(i, n, bad = true) {
    const p = this.S.players[i];
    if (n <= 0 || p.silver <= 0) return 0;
    const ti = p.items.indexOf('tiebu');
    if (ti >= 0) { p.items.splice(ti, 1); this.sync(); await this.say(i, TX.block, { n: this.nm(i) }, 1500); return 0; }
    if (bad && CHAR[p.char].quirk === 'jar_dodge' && R() < 0.34) { await this.say(i, TX.jar, { n: this.nm(i) }, 1500); return 0; }
    const v = this.give(i, -n); this.sync(); return -v;
  }
  bark(i, good) { return pick(CHAR[this.S.players[i].char].barks[good ? 'good' : 'bad']); }
  itemCap(i) { return CHAR[this.S.players[i].char].quirk === 'four_items' ? 4 : 3; }

  async playerTurn(i) {
    const S = this.S, P = S.players[i];
    S.cur = i; this.sync();
    await this.cue({ k: 'turn', i }, 900);
    if (P.skip) { P.skip = false; this.sync(); await this.say(i, { zh: '{n} 被點了穴，動彈不得！', en: '{n} is pinned and can\'t move!' }, { n: this.nm(i) }, 1800); return; }
    let dice = 1, usedItem = false;
    for (;;) {
      const a = await this.ask(i, 'roll', { items: usedItem ? [] : P.items.slice() });
      if (a.item != null && !usedItem) {
        const id = P.items[a.item]; if (!id) continue;
        if (id === 'tiebu') continue;            // passive
        const ok = await this.useItem(i, a.item);
        if (ok) { usedItem = true; if (id === 'qinggong') dice = 2; }
        continue;
      }
      break;
    }
    const vals = Array.from({ length: dice }, d6);
    await this.cue({ k: 'dice', i, vals }, 1500);
    let total = vals.reduce((a, b) => a + b, 0);
    if (dice === 2 && vals[0] === vals[1] && CHAR[P.char].quirk === 'double_bonus') { this.give(i, 5); this.sync(); await this.say(i, TX.doubles, null, 1500); }
    await this.move(i, total);
    if (this.over) return;
    await this.land(i);
    S.cur = -1; this.sync();
  }

  async useItem(i, k) {
    const S = this.S, P = S.players[i]; const id = P.items[k]; const it = ITEMS[id];
    let tgt = null;
    if (it.target) {
      const opts = [0, 1, 2, 3].filter(j => j !== i);
      tgt = await this.ask(i, 'target', { item: id, opts });
    }
    P.items.splice(k, 1); this.sync();
    await this.cue({ k: 'item', i, item: id, tgt }, 1100);
    if (id === 'qinggong') await this.say(i, TX.qing, null, 1200);
    else if (id === 'dianxue') { S.players[tgt].skip = true; this.sync(); await this.say(i, TX.needle, { n: this.nm(i), m: this.nm(tgt) }, 1800); }
    else if (id === 'mihun') { const a = P.node; P.node = S.players[tgt].node; S.players[tgt].node = a; this.sync(); await this.cue({ k: 'swap', a: i, b: tgt }, 1300); await this.say(i, TX.swap, { n: this.nm(i), m: this.nm(tgt) }, 1500); }
    else if (id === 'suanpan') { const want = 3 + Math.floor(R() * 6); const got = await this.hurt(tgt, want, false); if (got) this.give(i, got); this.sync(); await this.say(i, TX.abacus, { n: this.nm(i), m: this.nm(tgt), v: got }, 1800); }
    else if (id === 'xingmu') { await this.say(i, TX.gavel, null, 1200); await this.moveBai(); }
    return true;
  }

  async move(i, steps, opts = {}) {
    const S = this.S, P = S.players[i], B = this.B;
    let left = steps;
    await this.cue({ k: 'steps', i, v: left });
    while (left > 0 && !this.over) {
      const nx = nextOf(B, P.node, S.bridge);
      let to = nx[0];
      if (nx.length > 1) to = await this.ask(i, 'way', { opts: nx, from: P.node });
      const from = P.node; P.node = to; left--; P.stats.steps++;
      this.sync();
      await this.cue({ k: 'hop', i, from, to, left }, 300);
      // Tu Qianqiu's bone fan
      if (CHAR[P.char].quirk === 'pass_steal' && left > 0) {
        for (let j = 0; j < 4; j++) if (j !== i && S.players[j].node === to && S.players[j].silver > 0) { this.give(j, -1); this.give(i, 1); this.sync(); await this.say(i, TX.steal, { n: this.nm(i), m: this.nm(j) }, 1000); }
      }
      if (to === S.bai) await this.atBai(i);
    }
    await this.cue({ k: 'steps', i, v: 0 });
  }

  async atBai(i) {
    const S = this.S, P = S.players[i];
    if (P.silver < MANUAL_PRICE) { await this.talk('baixian', TX.baiPoor, { p: MANUAL_PRICE }, 1800); return; }
    let bought = 0;
    while (P.silver >= MANUAL_PRICE && bought < 2) {
      await this.cue({ k: 'talk', who: 'baixian', o: bought ? TX.bai2 : TX.bai0, v: { p: MANUAL_PRICE }, hold: true });
      const yes = await this.ask(i, 'buy', { price: MANUAL_PRICE, second: bought > 0 });
      if (!yes) break;
      this.give(i, -MANUAL_PRICE); P.man++; bought++; this.sync();
      await this.cue({ k: 'manual', i }, 2400);
      await this.say(i, this.bark(i, true), null, 900);
      for (let j = 0; j < 4; j++) if (j !== i && CHAR[S.players[j].char].quirk === 'take_credit') { this.give(j, 1); this.sync(); await this.say(j, TX.credit, null, 1300); }
    }
    if (!bought) { await this.cue({ k: 'talkEnd' }, 300); return; }
    await this.talk('baixian', TX.baiSold, null, 1800);
    await this.moveBai();
  }

  async land(i) {
    const S = this.S, P = S.players[i], node = this.B.nodes[P.node];
    const q = CHAR[P.char].quirk; const mul = S.last3 ? 2 : 1;
    await this.cue({ k: 'land', i, type: node.type }, 350);
    switch (node.type) {
      case 'b': { const v = (3 + (q === 'blue_plus' ? 1 : 0)) * mul; this.give(i, v); this.sync(); await this.say(i, R() < 0.5 ? TX.blue : this.bark(i, true), { n: this.nm(i), v }, 1100); break; }
      case 'r': { P.stats.reds++; const v = (q === 'red_soft' ? 2 : 3) * mul; const lost = await this.hurt(i, v, false); if (lost) await this.say(i, R() < 0.5 ? TX.red : this.bark(i, false), { n: this.nm(i), v: lost }, 1100); break; }
      case 'e': P.stats.events++; await this.event(i); break;
      case 'i': {
        const id = pick(ITEM_IDS);
        if (P.items.length < this.itemCap(i)) { P.items.push(id); this.sync(); await this.cue({ k: 'gift', i, item: id }, 600); await this.say(i, TX.gift, { i: ITEMS[id].name }, 1500); }
        else { this.give(i, 4); this.sync(); await this.say(i, TX.giftFull, null, 1500); }
        break;
      }
      case 's': await this.shop(i); break;
      case 'd': await this.duel(i); break;
      case 'g': await this.gimmick(i); break;
      case 'w': {
        await this.say(i, TX.whirl, { n: this.nm(i) }, 1000);
        for (let k = 0; k < 3; k++) { const pv = this.B.prev[P.node]; const from = P.node; P.node = pv.find(x => !this.B.nodes[x].branch === !this.B.nodes[from].branch) ?? pv[0]; this.sync(); await this.cue({ k: 'hop', i, from, to: P.node, left: 0, back: true }, 260); }
        break;
      }
    }
    this.sync();
  }

  async shop(i) {
    const P = this.S.players[i];
    if (P.items.length >= this.itemCap(i)) { await this.talk('jiabafang', TX.shopFull, null, 1600); return; }
    const items = shuffle(ITEM_IDS).slice(0, 3).sort((a, b) => ITEMS[a].price - ITEMS[b].price);
    if (P.silver < ITEMS[items[0]].price) { await this.talk('jiabafang', TX.shopPoor, null, 1800); return; }
    await this.cue({ k: 'talk', who: 'jiabafang', o: TX.shop0, hold: true });
    const got = await this.ask(i, 'shop', { items, silver: P.silver });
    await this.cue({ k: 'talkEnd' });
    if (got && P.silver >= ITEMS[got].price) {
      this.give(i, -ITEMS[got].price); P.stats.spent += ITEMS[got].price; P.items.push(got); this.sync();
      await this.cue({ k: 'gift', i, item: got }, 500);
      await this.talk('jiabafang', TX.shopBuy, { i: ITEMS[got].name }, 1500);
    }
  }

  async duel(i) {
    const S = this.S;
    const opts = [0, 1, 2, 3].filter(j => j !== i);
    const j = await this.ask(i, 'duel', { opts });
    await this.cue({ k: 'banner', o: TX.duel0, v: { n: this.nm(i), m: this.nm(j) } }, 1600);
    const plus = (k) => CHAR[S.players[k].char].quirk === 'duel_plus' ? 1 : 0;
    const a = d6() + plus(i), b = d6() + plus(j);
    await this.cue({ k: 'duelDice', a: i, b: j, va: a, vb: b }, 2000);
    if (a === b) { await this.cue({ k: 'banner', o: TX.duelTie }, 1300); return; }
    const w = a > b ? i : j, l = a > b ? j : i;
    const take = Math.min(S.players[l].silver, 5 + Math.abs(a - b));
    const got = await this.hurt(l, take, false);
    if (got) this.give(w, got);
    if (CHAR[S.players[w].char].quirk === 'duel_bonus') this.give(w, 2);
    this.sync();
    await this.cue({ k: 'banner', o: TX.duelWin, v: { n: this.nm(w), v: got } }, 1500);
    await this.say(w, pick(CHAR[S.players[w].char].barks.good), null, 900);
  }

  async gimmick(i) {
    const S = this.S, P = S.players[i], B = this.B;
    if (B.id === 'mountain') { await this.say(i, TX.gust, { n: this.nm(i) }, 1100); await this.cue({ k: 'gust', i }, 500); await this.move(i, 3 + Math.floor(R() * 3)); return; }
    let to;
    const gs = B.nodes.filter(n => n.type === 'g' && n.id !== P.node);
    if (B.id === 'river') { const me = B.nodes[P.node]; const other = gs.filter(n => (n.y > 500) !== (me.y > 500)); to = (other.length ? other : gs).sort((a, b) => Math.abs(a.x - me.x) - Math.abs(b.x - me.x))[0].id; }
    else to = pick(gs).id;
    await this.say(i, TX.ride, { g: B.gimName }, 900);
    const from = P.node; P.node = to; this.sync();
    await this.cue({ k: 'ride', i, from, to, kind: B.id }, 1700);
    if (to === S.bai) await this.atBai(i);
  }

  async event(i) {
    const S = this.S, P = S.players[i], q = CHAR[P.char].quirk;
    const kinds = ['fortune', 'peddler', 'bandits', 'niu', 'jar', 'couplet', 'coldlaugh', 'alms', 'story', 'challenge', 'wolves'];
    const k = pick(kinds);
    await this.cue({ k: 'event', i, kind: k }, 700);
    if (k === 'fortune') {
      if (R() < 0.5) { await this.talk('hubanxian', EV.fortuneGood, { v: 5 }, 600); const l = await this.hurt(i, 5); await this.sleep(l ? 1800 : 400); }
      else { await this.talk('hubanxian', EV.fortuneBad, { v: 6 }, 600); this.give(i, 6); this.sync(); await this.sleep(1800); }
    } else if (k === 'peddler') {
      if (P.silver < 5) { await this.talk('jiabafang', EV.peddlerPoor, null, 2200); return; }
      await this.talk('jiabafang', EV.peddler, null, 1800); this.give(i, -5); P.stats.spent += 5; this.sync();
      if (R() < 0.3 && P.items.length < this.itemCap(i)) { const id = pick(ITEM_IDS); P.items.push(id); this.sync(); await this.talk('jiabafang', EV.real, { i: ITEMS[id].name }, 2000); }
      else await this.talk('jiabafang', pick(EV.junk), null, 2200);
    } else if (k === 'bandits') {
      const v = q === 'bandit_half' ? 4 : 8;
      await this.cue({ k: 'bandits', i }, 400); await this.cue({ k: 'shake', sfx: 'bonk' });
      await this.talk('heixiong', EV.bandits, { v: 8 }, 2000);
      if (q === 'bandit_half') await this.talk('daoba', EV.banditsHalf, null, 1600);
      await this.hurt(i, v); await this.sleep(700);
    } else if (k === 'niu') {
      if (q === 'niu_cousin') { await this.talk('niubaobao', EV.niuCousin, null, 600); this.give(i, 3); this.sync(); await this.sleep(1600); }
      else { await this.talk('niubaobao', EV.niu, { v: 5 }, 600); await this.cue({ k: 'sfx', s: 'chomp' }); await this.hurt(i, 5); await this.say(i, this.bark(i, false), null, 1300); }
    } else if (k === 'jar') {
      await this.talk('wudadan', EV.jar, null, 1600); await this.cue({ k: 'shake', sfx: 'bonk' });
      const nodes = this.B.nodes.filter(n => n.id !== P.node); const to = pick(nodes).id; const from = P.node; P.node = to; this.sync();
      await this.cue({ k: 'ride', i, from, to, kind: 'jar' }, 1700);
      if (to === S.bai) await this.atBai(i);
    } else if (k === 'couplet') {
      const good = R() < 0.6; const v = good ? 6 : 2;
      await this.talk('wenduizhang', EV.couplet[good ? 0 : 1], { v }, 600); this.give(i, v); this.sync(); await this.sleep(2600);
    } else if (k === 'coldlaugh') {
      await this.cue({ k: 'shake', sfx: 'laugh' });
      await this.talk('xiaotian', EV.coldlaugh, { n: this.nm(i) }, 1200);
      let sum = 0; for (let j = 0; j < 4; j++) if (j !== i) { const l = await this.hurt(j, 2); sum += l; }
      if (sum) this.give(i, sum); this.sync(); await this.sleep(1000);
    } else if (k === 'alms') {
      const poor = [0, 1, 2, 3].sort((a, b) => S.players[a].silver - S.players[b].silver)[0];
      if (poor === i) { await this.talk('kuchan', EV.almsSelf, { v: 4 }, 600); this.give(i, 4); this.sync(); await this.sleep(1800); }
      else { const v = Math.min(4, P.silver); await this.talk('kuchan', EV.alms, { v, m: this.nm(poor) }, 600); if (v) { this.give(i, -v); this.give(poor, v); } this.sync(); await this.sleep(1800); }
    } else if (k === 'story') {
      await this.talk('baixian', EV.story, null, 2000); await this.moveBai();
    } else if (k === 'challenge') {
      const a = d6(), b = d6() + (q === 'duel_plus' ? 1 : 0);
      await this.cue({ k: 'duelDice', a: -1, b: i, va: a, vb: b, npc: 'chutiankuo' }, 1800);
      await this.talk('chutiankuo', EV.challenge, { a, b }, 1600);
      if (b > a) { await this.talk('chutiankuo', EV.challengeWin, null, 600); this.give(i, 6); this.sync(); await this.sleep(1200); }
      else { await this.talk('chutiankuo', EV.challengeLose, null, 600); await this.hurt(i, 3, false); await this.sleep(1200); }
    } else if (k === 'wolves') {
      await this.talk('aman', EV.wolves, { n: this.nm(i) }, 1800);
      await this.move(i, 3 + Math.floor(R() * 3));
    }
  }

  // ------------------------------------------------------------------ bots
  botAnswer(i, kind, data) {
    const S = this.S, P = S.players[i], sk = this.skill[i];
    const others = [0, 1, 2, 3].filter(j => j !== i);
    const leader = others.slice().sort((a, b) => (S.players[b].man - S.players[a].man) || (S.players[b].silver - S.players[a].silver))[0];
    if (kind === 'roll') {
      const items = data.items || []; const d = this.baiDist(i);
      const has = (id) => items.indexOf(id);
      if (R() < 0.15 * (1 - sk)) return { roll: true };
      if (has('xingmu') >= 0 && d > 12 && P.silver >= MANUAL_PRICE) return { item: has('xingmu') };
      if (has('mihun') >= 0 && P.silver >= MANUAL_PRICE) { const close = others.find(j => distTo(this.B, S.players[j].node, S.bai, S.bridge) <= 5); if (close != null && d > 10) return { item: has('mihun') }; }
      if (has('qinggong') >= 0 && (P.silver >= MANUAL_PRICE ? d >= 4 && d <= 12 : d > 8)) return { item: has('qinggong') };
      if (has('dianxue') >= 0 && S.turn >= 2 && R() < 0.6) return { item: has('dianxue') };
      if (has('suanpan') >= 0 && others.some(j => S.players[j].silver >= 8)) return { item: has('suanpan') };
      return { roll: true };
    }
    if (kind === 'target') {
      if (data.item === 'suanpan') return others.slice().sort((a, b) => S.players[b].silver - S.players[a].silver)[0];
      if (data.item === 'mihun') return others.slice().sort((a, b) => distTo(this.B, S.players[a].node, S.bai, S.bridge) - distTo(this.B, S.players[b].node, S.bai, S.bridge))[0];
      return leader;
    }
    if (kind === 'duel') return others.slice().sort((a, b) => S.players[b].silver - S.players[a].silver)[0];
    if (kind === 'way') {
      if (R() < 0.3 * (1 - sk)) return pick(data.opts);
      return data.opts.slice().sort((a, b) => distTo(this.B, a, S.bai, S.bridge) - distTo(this.B, b, S.bai, S.bridge))[0];
    }
    if (kind === 'buy') return P.silver >= MANUAL_PRICE;
    if (kind === 'shop') {
      const spare = P.silver - (P.silver >= MANUAL_PRICE ? MANUAL_PRICE : 0);
      const pref = ['qinggong', 'dianxue', 'mihun', 'tiebu', 'suanpan', 'xingmu'];
      const ok = data.items.filter(id => ITEMS[id].price <= P.silver && (ITEMS[id].price <= spare || P.silver < 12)).sort((a, b) => pref.indexOf(a) - pref.indexOf(b));
      return ok.length && R() < 0.4 + 0.5 * sk ? ok[0] : null;
    }
    if (kind === 'ready') return true;
    return null;
  }

  // ------------------------------------------------------------------ minigames
  nextGame(mode) {
    const ids = MG_IDS.filter(id => MINIGAMES[id].mode === mode);
    if (!this.decks[mode] || !this.decks[mode].length) this.decks[mode] = shuffle(ids);
    return this.decks[mode].pop();
  }
  async minigameRound(force) {
    const S = this.S;
    let mode = force ? MINIGAMES[force].mode : (R() < 0.6 ? 'ffa' : R() < 0.62 ? '2v2' : '1v3');
    const id = force || this.nextGame(mode);
    const team = [0, 0, 0, 0]; let solo = -1;
    if (mode === '2v2') { const o = shuffle([0, 1, 2, 3]); team[o[2]] = 1; team[o[3]] = 1; }
    if (mode === '1v3') { solo = Math.floor(R() * 4); team[solo] = 1; }
    S.phase = 'mg'; this.sync();
    this.emit({ t: 'mg', ph: 'intro', id, team, solo });
    // wait for humans to be ready (or 12 s)
    await Promise.race([Promise.all([0, 1, 2, 3].map(i => this.isBot(i) ? true : this.ask(i, 'ready', {}, 12000))), this.sleep(13000)]);
    const mg = MINIGAMES[id];
    const M = { n: 4, t: -3, dur: mg.dur, team, solo, id };
    mg.init(M);
    this.mg = { id, S: M }; this.botMem = [{}, {}, {}, {}]; this.seenN = this.inputs.map(x => x.n);
    this.emit({ t: 'mg', ph: 'play', id, team, solo });
    await new Promise((resolve) => {
      const dt = 1 / 30; let k = 0;
      const tick = () => {
        if (this.over) { clearInterval(this.mgTimer); resolve(); return; }
        for (let s = 0; s < Math.max(1, Math.round(this.sp)); s++) {
          M.t += dt;
          const I = [0, 1, 2, 3].map(i => {
            if (this.isBot(i)) { const b = mg.bot(M, i, this.skill[i], this.botMem[i]); return b; }
            const inp = this.inputs[i]; const p = Math.max(0, Math.min(4, inp.n - this.seenN[i])); this.seenN[i] = inp.n; return { x: inp.x, y: inp.y, a: inp.a, p };
          });
          if (M.t >= 0) mg.step(M, I, dt);
          if (M.t >= M.dur || (M.t > 0.5 && mg.done && mg.done(M))) { M.over = true; break; }
        }
        if (++k % 2 === 0 || M.over) this.emit({ t: 'mgs', s: M });
        if (M.over) { clearInterval(this.mgTimer); resolve(); }
      };
      this.mgTimer = setInterval(tick, 1000 / 30);
    });
    if (this.over) return;
    const sc = mg.score(M);
    // placements (ties share the better place) and payouts
    const order = [0, 1, 2, 3].sort((a, b) => sc[b] - sc[a]);
    const place = [0, 0, 0, 0]; order.forEach((p, k) => { place[p] = k > 0 && sc[p] === sc[order[k - 1]] ? place[order[k - 1]] : k; });
    let pay;
    if (mode === 'ffa') pay = place.map(k => [10, 5, 3, 1][k]);
    else if (mode === '2v2') { const t0 = sc[team.indexOf(0)], t1 = sc[team.indexOf(1)]; pay = team.map(t => t0 === t1 ? 3 : ((t ? t1 > t0 : t0 > t1) ? 10 : 0)); }
    else { const soloWin = sc[solo] > 0; pay = [0, 1, 2, 3].map(i => i === solo ? (soloWin ? 15 : 0) : (soloWin ? 0 : 6)); }
    for (let i = 0; i < 4; i++) if (place[i] === 0 && (mode === 'ffa' || pay[i] > 0)) S.players[i].stats.mgWins++;
    this.emit({ t: 'mg', ph: 'end', id, team, solo, sc, place, pay });
    await this.sleep(4200);
    for (let i = 0; i < 4; i++) if (pay[i]) this.give(i, pay[i]);
    this.mg = null; S.phase = 'board'; this.sync();
    this.emit({ t: 'mg', ph: 'done' });
    await this.sleep(1200);
  }

  // ------------------------------------------------------------------ the end
  async finale() {
    const S = this.S; S.phase = 'final'; S.cur = -1; this.sync();
    await this.talk('baixian', { zh: '各位看官，好戲到此！先來頒發特別獎——', en: 'Friends, the tale is told! First, the bonus awards...' }, null, 2600);
    const awards = [];
    for (const a of shuffle(AWARDS)) {
      const vals = S.players.map(p => p.stats[a.stat]); const mx = Math.max(...vals);
      if (mx <= 0 || vals.filter(v => v === mx).length > 1) continue;
      const w = vals.indexOf(mx); awards.push({ id: a.id, i: w });
      if (awards.length >= 3) break;
    }
    for (const a of awards) {
      const def = AWARDS.find(x => x.id === a.id);
      S.players[a.i].man++; this.sync();
      await this.cue({ k: 'award', i: a.i, name: def.name, why: def.why }, 3200);
    }
    const rank = [0, 1, 2, 3].sort((a, b) => (S.players[b].man - S.players[a].man) || (S.players[b].silver - S.players[a].silver));
    this.sync();
    this.emit({ t: 'final', rank, awards });
    this.done = true;
  }
  stop() { this.over = true; clearInterval(this.mgTimer); for (const e of this.asks.values()) clearTimeout(e.timer); this.asks.clear(); }
}
