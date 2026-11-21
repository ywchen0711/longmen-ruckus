// The three original boards: node graphs built from polylines, plus a painter for each board's backdrop.
export const WORLD = { w: 1600, h: 1000 };

const BOARD_DEFS = {
  town: {
    name: { zh: '龍門客棧大街', en: 'Longmen Inn Street' },
    blurb: { zh: '熱鬧的客棧大街。中間的小巷是捷徑；黃包車（青色格）會把你拉到隨便一個車站。', en: 'A busy inn street. The alley is a shortcut; rickshaws (teal spaces) haul you to a random stand.' },
    gimName: { zh: '黃包車', en: 'Rickshaw' },
    sky: '#f6e6c4',
    main: { pts: [[800, 165], [1430, 165], [1430, 855], [170, 855], [170, 165]], r: 230, n: 32,
      types: 'bbebgrbsbebdbibrebgbebrbsbedbirb' },
    branches: [{ id: 'alley', from: [800, 165], to: [800, 855], via: [], n: 6, types: 'brebie' }],
  },
  mountain: {
    name: { zh: '萬妖山', en: 'Myriad Beast Mountain' },
    blurb: { zh: '山頂的吊橋每回合會升起或放下。山風（青色格）把你往前吹。', en: 'The rope bridge on the peaks rises or lowers every round. Mountain gusts (teal) blow you forward.' },
    gimName: { zh: '山風', en: 'Mountain Gust' },
    sky: '#cfe8f0',
    main: { pts: [[800, 880], [1400, 880], [1475, 560], [1300, 255], [1030, 300], [985, 560], [800, 660], [615, 560], [570, 300], [300, 255], [125, 560], [200, 880]], r: 110, n: 34,
      types: 'bbebrbsbgbebdbibrbebgbrbesbdbebigb' },
    branches: [{ id: 'bridge', bridge: true, from: [1030, 300], to: [570, 300], via: [], n: 4, types: 'bebb' }],
  },
  river: {
    name: { zh: '江上畫舫', en: 'Painted Boats on the River' },
    blurb: { zh: '渡口（青色格）坐船到對岸；中間的畫舫是捷徑，但小心漩渦會把人捲回去。', en: 'Ferry docks (teal) cross the river; the painted boats in the middle are a shortcut, but whirlpools drag you back.' },
    gimName: { zh: '渡船', en: 'Ferry' },
    sky: '#d6f0e8',
    main: { pts: [[800, 190], [1470, 190], [1470, 810], [130, 810], [130, 190]], r: 240, n: 32,
      types: 'bbebgsbrbdbebigbrbebgsbrbdbebigb' },
    branches: [{ id: 'boats', from: [800, 190], to: [800, 810], via: [], n: 6, types: 'bwebwi' }],
  },
};
export const BOARD_IDS = Object.keys(BOARD_DEFS);

function polyLen(pts, loop) {
  let L = 0; const segs = [];
  const n = loop ? pts.length : pts.length - 1;
  for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; const d = Math.hypot(b[0] - a[0], b[1] - a[1]); segs.push([a, b, L, d]); L += d; }
  return { L, segs };
}
function along(pl, s) {
  for (const [a, b, s0, d] of pl.segs) if (s <= s0 + d + 1e-6) { const t = d ? (s - s0) / d : 0; return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }
  const g = pl.segs[pl.segs.length - 1]; return [g[1][0], g[1][1]];
}
// a polygon with every corner rounded by a true circular arc of radius r (straight runs between them), sampled finely,
// so the spaces placed by arc length sit evenly on clean lines and arcs
function roundPoly(pts, r, loop) {
  const n = pts.length, out = [];
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    if (!loop && (i === 0 || i === n - 1)) { out.push([p[0], p[1]]); continue; }
    const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
    const ux = a[0] - p[0], uy = a[1] - p[1], vx = b[0] - p[0], vy = b[1] - p[1], lu = Math.hypot(ux, uy), lv = Math.hypot(vx, vy);
    const th = Math.acos(Math.max(-1, Math.min(1, (ux * vx + uy * vy) / (lu * lv))));
    if (th > Math.PI - 1e-3) { out.push([p[0], p[1]]); continue; }
    const d = Math.min(r / Math.tan(th / 2), lu * 0.48, lv * 0.48), rr = d * Math.tan(th / 2);
    const s1 = [p[0] + ux / lu * d, p[1] + uy / lu * d], s2 = [p[0] + vx / lv * d, p[1] + vy / lv * d];
    const bx = ux / lu + vx / lv, by = uy / lu + vy / lv, bl = Math.hypot(bx, by), h = rr / Math.sin(th / 2);
    const cx = p[0] + bx / bl * h, cy = p[1] + by / bl * h;
    let a0 = Math.atan2(s1[1] - cy, s1[0] - cx), a1 = Math.atan2(s2[1] - cy, s2[0] - cx), da = a1 - a0;
    while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
    const steps = Math.max(4, Math.ceil(Math.abs(da) * rr / 6));
    for (let k = 0; k <= steps; k++) { const t = a0 + da * k / steps; out.push([cx + Math.cos(t) * rr, cy + Math.sin(t) * rr]); }
  }
  return out;
}

// build a board: nodes [{id, x, y, type, next:[ids], branch}] and lookup helpers
export function buildBoard(id) {
  const def = BOARD_DEFS[id];
  const nodes = [];
  const mainPts = roundPoly(def.main.pts, def.main.r || 120, true);
  const pl = polyLen(mainPts, true);
  const N = def.main.n;
  for (let i = 0; i < N; i++) { const [x, y] = along(pl, pl.L * i / N); nodes.push({ id: i, x, y, type: def.main.types[i % def.main.types.length] || 'b', next: [(i + 1) % N], branch: null }); }
  const near = (p) => { let best = 0, bd = 1e9; for (let i = 0; i < N; i++) { const d = Math.hypot(nodes[i].x - p[0], nodes[i].y - p[1]); if (d < bd) { bd = d; best = i; } } return best; };
  const branches = [];
  for (const br of def.branches) {
    const a = near(br.from), b = near(br.to);
    const pts = roundPoly([[nodes[a].x, nodes[a].y], ...br.via, [nodes[b].x, nodes[b].y]], 80, false);
    const bp = polyLen(pts, false);
    const ids = [];
    for (let k = 0; k < br.n; k++) {
      const [x, y] = along(bp, bp.L * (k + 1) / (br.n + 1));
      const nid = nodes.length; ids.push(nid);
      nodes.push({ id: nid, x, y, type: br.types[k % br.types.length] || 'b', next: [], branch: br.id });
    }
    for (let k = 0; k < ids.length; k++) nodes[ids[k]].next = [k + 1 < ids.length ? ids[k + 1] : b];
    nodes[a].next.push(ids[0]); nodes[a].junction = br.id;
    nodes[a].type = 'b';   // a junction is always a plain blue space
    branches.push({ id: br.id, from: a, to: b, nodes: ids, bridge: !!br.bridge, pts });
  }
  const prev = nodes.map(() => []);
  for (const n of nodes) for (const m of n.next) prev[m].push(n.id);
  return { id, def, nodes, branches, prev, mainPts, name: def.name, blurb: def.blurb, gimName: def.gimName };
}
export const boardName = (id) => BOARD_DEFS[id].name;
export const boardBlurb = (id) => BOARD_DEFS[id].blurb;

// steps from node a to node b along allowed edges (bridgeOpen decides the mountain bridge)
export function distTo(B, a, b, bridgeOpen) {
  if (a === b) return 0;
  const seen = new Map([[a, 0]]); const q = [a];
  while (q.length) {
    const u = q.shift(); const d = seen.get(u);
    for (const v of nextOf(B, u, bridgeOpen)) { if (!seen.has(v)) { if (v === b) return d + 1; seen.set(v, d + 1); q.push(v); } }
  }
  return 99;
}
export function nextOf(B, u, bridgeOpen) {
  const n = B.nodes[u];
  if (n.junction) { const br = B.branches.find(x => x.id === n.junction); if (br.bridge && !bridgeOpen) return [n.next[0]]; }
  return n.next;
}

// ------------------------------------------------------------------ backdrop painters (drawn once per board)
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

function roofHouse(c, x, y, w, h, o = {}) {
  const wall = o.wall || '#f4e4c8', roof = o.roof || '#3a4a5a', pillar = o.pillar || '#c0302a';
  c.save();
  c.fillStyle = 'rgba(0,0,0,0.16)'; c.beginPath(); c.ellipse(x + w / 2, y + h + 6, w * 0.6, 12, 0, 0, 7); c.fill();
  c.fillStyle = wall; c.fillRect(x, y, w, h);
  c.fillStyle = 'rgba(0,0,0,0.08)'; c.fillRect(x, y + h - 14, w, 14);
  c.fillStyle = pillar; const np = Math.max(2, Math.round(w / 60)); for (let i = 0; i <= np; i++) c.fillRect(x + 4 + (w - 16) * i / np, y + 6, 8, h - 6);
  // windows / door
  c.fillStyle = '#6a3a1a'; c.fillRect(x + w / 2 - 16, y + h - 44, 32, 44);
  c.fillStyle = '#e8c890'; for (let i = 0; i < np; i++) { const wx = x + 20 + (w - 40) * (i + 0.5) / np - 12; if (Math.abs(wx + 12 - (x + w / 2)) > 30) { c.fillRect(wx, y + 20, 24, 22); c.strokeStyle = '#6a3a1a'; c.lineWidth = 2; c.strokeRect(wx, y + 20, 24, 22); c.beginPath(); c.moveTo(wx + 12, y + 20); c.lineTo(wx + 12, y + 42); c.stroke(); } }
  // roof with upturned eaves
  const ov = 22, rh = o.rh || Math.max(34, h * 0.45);
  c.fillStyle = roof; c.beginPath();
  c.moveTo(x - ov - 10, y - 4); c.quadraticCurveTo(x - ov + 6, y + 4, x - ov + 20, y + 2);
  c.lineTo(x + w + ov - 20, y + 2); c.quadraticCurveTo(x + w + ov - 6, y + 4, x + w + ov + 10, y - 4);
  c.quadraticCurveTo(x + w + 4, y - rh * 0.4, x + w - 18, y - rh); c.lineTo(x + 18, y - rh);
  c.quadraticCurveTo(x - 4, y - rh * 0.4, x - ov - 10, y - 4); c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.13)'; c.lineWidth = 2;
  for (let i = 1; i < 5; i++) { const yy = y - rh * i / 5; c.beginPath(); c.moveTo(x - ov * (1 - i / 5) + 4, yy); c.lineTo(x + w + ov * (1 - i / 5) - 4, yy); c.stroke(); }
  c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x + 10, y - rh - 6, w - 20, 8);
  if (o.sign) {
    c.fillStyle = '#2a1a10'; c.fillRect(x + w / 2 - o.sign.length * 13 - 8, y + 4, o.sign.length * 26 + 16, 30);
    c.fillStyle = '#f0c040'; c.font = 'bold 22px "Cubic 11", serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(o.sign, x + w / 2, y + 20);
  }
  c.restore();
}
function tree(c, x, y, s, col = '#3a9a4a', r) {
  c.fillStyle = 'rgba(0,0,0,0.15)'; c.beginPath(); c.ellipse(x, y + 4, 22 * s, 8 * s, 0, 0, 7); c.fill();
  c.fillStyle = '#7a4a2a'; c.fillRect(x - 4 * s, y - 24 * s, 8 * s, 26 * s);
  const blobs = [[0, -44, 26], [-18, -32, 18], [18, -32, 18], [0, -62, 18]];
  for (const [dx, dy, rr] of blobs) { c.fillStyle = col; c.beginPath(); c.arc(x + dx * s, y + dy * s, rr * s, 0, 7); c.fill(); }
  c.fillStyle = 'rgba(255,255,255,0.18)'; c.beginPath(); c.arc(x - 8 * s, y - 52 * s, 9 * s, 0, 7); c.fill();
}
function pine(c, x, y, s) {
  c.fillStyle = 'rgba(0,0,0,0.15)'; c.beginPath(); c.ellipse(x, y + 3, 16 * s, 6 * s, 0, 0, 7); c.fill();
  c.fillStyle = '#6a4024'; c.fillRect(x - 3 * s, y - 14 * s, 6 * s, 16 * s);
  for (let i = 0; i < 3; i++) { c.fillStyle = i % 2 ? '#2a7a4a' : '#1f6a40'; c.beginPath(); c.moveTo(x, y - (70 - i * 16) * s); c.lineTo(x + (16 + i * 7) * s, y - (26 - i * 6) * s - i * 10 * s); c.lineTo(x - (16 + i * 7) * s, y - (26 - i * 6) * s - i * 10 * s); c.fill(); }
}
function lanternString(c, x0, y0, x1, y1, n) {
  c.strokeStyle = '#5a3a2a'; c.lineWidth = 2; c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + 30, x1, y1); c.stroke();
  for (let i = 1; i < n; i++) {
    const t = i / n; const x = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * (x0 + x1) / 2 + t * t * x1; const y = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * ((y0 + y1) / 2 + 30) + t * t * y1;
    c.fillStyle = '#e83a2a'; c.beginPath(); c.ellipse(x, y + 12, 9, 12, 0, 0, 7); c.fill(); c.fillStyle = '#f0c040'; c.fillRect(x - 5, y + 1, 10, 3); c.fillRect(x - 5, y + 21, 10, 3);
  }
}
function road(c, pts, loop, w, col, edge) {
  c.lineJoin = 'round'; c.lineCap = 'round';
  c.strokeStyle = edge; c.lineWidth = w + 10; c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); if (loop) c.closePath(); c.stroke();
  c.strokeStyle = col; c.lineWidth = w; c.stroke();
}

function paintTown(c, B) {
  const r = rng(11);
  const g = c.createLinearGradient(0, 0, 0, 1000); g.addColorStop(0, '#f2dcae'); g.addColorStop(1, '#e8c890'); c.fillStyle = g; c.fillRect(0, 0, 1600, 1000);
  // paving
  // paving: square flagstones in straight courses (every other course shifted half a stone)
  c.fillStyle = 'rgba(160,110,60,0.07)'; for (let y = 60; y < 1000; y += 40) for (let x = ((y / 40) % 2) * 20 - 20; x < 1600; x += 40) c.fillRect(x + 2, y + 2, 36, 36);
  // canal at the top edge
  c.fillStyle = '#7ac8e0'; c.fillRect(0, 0, 1600, 60); c.fillStyle = 'rgba(255,255,255,0.4)'; for (let x = 20; x < 1600; x += 80) { c.fillRect(x, 18, 30, 3); c.fillRect(x + 40, 38, 30, 3); }
  c.fillStyle = '#b8a080'; c.fillRect(0, 56, 1600, 10);
  road(c, B.mainPts, true, 66, '#d8c4a0', '#a88a60');
  for (const br of B.branches) road(c, br.pts, false, 52, '#cfb88e', '#a88a60');
  // buildings inside the loop
  roofHouse(c, 330, 330, 360, 210, { sign: '龍門客棧', roof: '#2a3a52', rh: 90 });
  roofHouse(c, 930, 360, 300, 170, { sign: '聽雨樓', roof: '#3a2a4a', wall: '#f8ecd8', rh: 80 });
  roofHouse(c, 380, 640, 150, 90, { roof: '#5a3a2a', sign: '藥' });
  roofHouse(c, 1000, 650, 180, 90, { roof: '#2a4a3a', sign: '茶' });
  // the inn yard: barrels and a well
  for (let i = 0; i < 4; i++) { const bx = 592 + (i % 2) * 30, by = 636 + (i >> 1) * 32; c.fillStyle = '#8a5a2a'; c.beginPath(); c.ellipse(bx, by, 12, 14, 0, 0, 7); c.fill(); c.strokeStyle = '#4a2a10'; c.lineWidth = 2; c.stroke(); c.beginPath(); c.moveTo(bx - 12, by - 4); c.lineTo(bx + 12, by - 4); c.moveTo(bx - 12, by + 4); c.lineTo(bx + 12, by + 4); c.stroke(); }
  c.fillStyle = '#8a8a8a'; c.beginPath(); c.ellipse(1240, 700, 26, 14, 0, 0, 7); c.fill(); c.fillStyle = '#3a5a7a'; c.beginPath(); c.ellipse(1240, 698, 18, 8, 0, 0, 7); c.fill();
  // outside: shops along the bottom and sides, trees
  for (let i = 0; i < 6; i++) roofHouse(c, 60 + i * 260, 935, 170, 60, { roof: ['#3a4a5a', '#5a2a2a', '#2a4a3a'][i % 3], rh: 30 });
  for (const [x, y] of [[70, 330], [70, 690], [1530, 330], [1530, 690], [300, 110], [560, 110], [1040, 110], [1300, 110]]) tree(c, x, y, 1.1, '#4aa050');
  for (const [x, y] of [[720, 300], [880, 300], [720, 790], [880, 790], [290, 600], [1310, 600]]) tree(c, x, y, 0.8, '#5ab05a');
  lanternString(c, 330, 260, 690, 260, 7); lanternString(c, 930, 300, 1230, 300, 6);
  // a cart
  c.fillStyle = '#9a6a3a'; c.fillRect(1090, 250, 70, 30); c.fillStyle = '#4a3020'; c.beginPath(); c.arc(1100, 284, 12, 0, 7); c.arc(1150, 284, 12, 0, 7); c.fill();
}

function paintMountain(c, B) {
  const r = rng(23);
  const g = c.createLinearGradient(0, 0, 0, 1000); g.addColorStop(0, '#b8dcef'); g.addColorStop(0.35, '#d4ecd8'); g.addColorStop(1, '#8ac878'); c.fillStyle = g; c.fillRect(0, 0, 1600, 1000);
  // far peaks
  c.fillStyle = '#a8c0d0'; c.beginPath(); c.moveTo(0, 260); for (let x = 0; x <= 1600; x += 100) c.lineTo(x, 120 + Math.sin(x * 0.011) * 60 + (x % 300 === 0 ? -60 : 0)); c.lineTo(1600, 260); c.fill();
  c.fillStyle = '#88b090'; c.beginPath(); c.moveTo(0, 360); for (let x = 0; x <= 1600; x += 80) c.lineTo(x, 230 + Math.sin(x * 0.02 + 1) * 40); c.lineTo(1600, 360); c.fill();
  // the two peaks (green plateaus)
  c.fillStyle = '#9ad080'; c.beginPath(); c.ellipse(330, 420, 330, 230, 0, 0, 7); c.fill(); c.beginPath(); c.ellipse(1270, 420, 330, 230, 0, 0, 7); c.fill();
  c.fillStyle = '#86c070'; c.fillRect(0, 560, 1600, 440);
  // the gorge between them
  c.fillStyle = '#4a5a50'; c.beginPath(); c.moveTo(690, 180); c.quadraticCurveTo(800, 150, 910, 180); c.lineTo(960, 520); c.quadraticCurveTo(800, 600, 640, 520); c.closePath(); c.fill();
  c.fillStyle = '#2a3a34'; c.beginPath(); c.moveTo(720, 200); c.quadraticCurveTo(800, 180, 880, 200); c.lineTo(910, 500); c.quadraticCurveTo(800, 560, 690, 500); c.closePath(); c.fill();
  c.fillStyle = '#9adcf0'; c.fillRect(788, 160, 24, 360); c.fillStyle = 'rgba(255,255,255,0.6)'; for (let y = 170; y < 510; y += 24) { c.fillRect(792, y, 3, 14); c.fillRect(805, y + 12, 3, 14); }
  c.fillStyle = 'rgba(255,255,255,0.7)'; c.beginPath(); c.ellipse(800, 525, 60, 18, 0, 0, 7); c.fill();
  road(c, B.mainPts, true, 60, '#d8c49a', '#9a8458');
  // temple at the right peak
  roofHouse(c, 1180, 330, 160, 80, { roof: '#7a2a2a', wall: '#f0e0c0', sign: '萬妖', rh: 50 });
  roofHouse(c, 220, 345, 130, 70, { roof: '#2a3a4a', wall: '#f0e8d8', rh: 44 });
  // pines on a staggered lattice, kept off the path and the gorge; two sizes, back rows smaller
  const offPath = (x, y, d) => { for (let i = 0; i < B.mainPts.length; i++) { const a = B.mainPts[i], b = B.mainPts[(i + 1) % B.mainPts.length], dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy || 1, k = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / L)); if (Math.hypot(x - a[0] - dx * k, y - a[1] - dy * k) < d) return false; } return true; };
  for (let row = 0, y = 330; y < 990; y += 70, row++) for (let x = 60 + (row % 2) * 70; x < 1600; x += 140) { if (Math.abs(x - 800) < 210 && y < 640) continue; if (!offPath(x, y, 70)) continue; if (Math.abs(x - 1260) < 110 && y < 440) continue; if (Math.abs(x - 285) < 95 && y < 440) continue; pine(c, x, y, y < 560 ? 0.8 : 1.0); }
  // rocks
  for (let row = 0, y = 615; y < 990; y += 70, row++) for (let x = 130 + (row % 2) * 70; x < 1600; x += 140) { if (!offPath(x, y, 60) || (row + Math.round(x / 140)) % 3) continue; c.fillStyle = '#8a8a80'; c.beginPath(); c.ellipse(x, y, 18, 11, 0, 0, 7); c.fill(); c.fillStyle = 'rgba(255,255,255,0.25)'; c.beginPath(); c.ellipse(x - 4, y - 3, 7, 3, 0, 0, 7); c.fill(); }
  // mist
  c.fillStyle = 'rgba(255,255,255,0.35)'; for (const [x, y] of [[180, 210], [560, 250], [1040, 250], [1420, 210]]) { c.beginPath(); c.ellipse(x, y, 160, 22, 0, 0, 7); c.fill(); }
}

function paintRiver(c, B) {
  const r = rng(37);
  c.fillStyle = '#9ad48a'; c.fillRect(0, 0, 1600, 1000);
  c.fillStyle = 'rgba(60,140,60,0.15)'; for (let y = 10; y < 1000; y += 40) for (let x = ((y / 40) % 2) * 25; x < 1600; x += 50) c.fillRect(x, y, 3, 7);
  // the river
  const g = c.createLinearGradient(0, 330, 0, 670); g.addColorStop(0, '#5ab0e0'); g.addColorStop(0.5, '#3a90d0'); g.addColorStop(1, '#5ab0e0');
  c.fillStyle = g; c.fillRect(0, 330, 1600, 340);
  // stone embankments: straight edges with even blocks
  for (const y of [322, 670]) { c.fillStyle = '#b8a888'; c.fillRect(0, y, 1600, 8); c.fillStyle = 'rgba(0,0,0,0.15)'; for (let x = 0; x < 1600; x += 40) c.fillRect(x, y, 2, 8); }
  c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 3; for (let row = 0, y = 370; y < 650; y += 56, row++) for (let x = 40 + (row % 2) * 60; x < 1600; x += 120) { c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 12, y - 6, x + 24, y); c.stroke(); }
  // lotus
  for (let row = 0, y = 398; y < 650; y += 112, row++) for (let x = 300 + (row % 2) * 120; x < 1340; x += 240) { if (Math.abs(x - 800) < 150) continue; c.fillStyle = '#4aa860'; c.beginPath(); c.arc(x, y, 10, 0.3, 6.0); c.lineTo(x, y); c.fill(); if ((x / 120 + row) % 2 < 1) { c.fillStyle = '#f8a0c0'; c.beginPath(); c.arc(x + 3, y - 3, 5, 0, 7); c.fill(); } }
  // arched bridges at both ends
  for (const x of [110, 1490]) { c.fillStyle = '#c8b090'; c.fillRect(x - 46, 330, 92, 340); c.fillStyle = '#a89070'; c.fillRect(x - 46, 330, 8, 340); c.fillRect(x + 38, 330, 8, 340); for (let y = 345; y < 670; y += 30) { c.fillStyle = 'rgba(0,0,0,0.08)'; c.fillRect(x - 38, y, 76, 3); } }
  road(c, B.mainPts, true, 60, '#e0d0a8', '#a8946a');
  // painted boats in the middle carry the shortcut
  for (const [x, y] of [[800, 420], [800, 590]]) {
    c.fillStyle = '#7a3a1a'; c.beginPath(); c.moveTo(x - 110, y); c.quadraticCurveTo(x, y + 50, x + 110, y); c.lineTo(x + 90, y + 20); c.quadraticCurveTo(x, y + 52, x - 90, y + 20); c.fill();
    c.fillStyle = '#c0402a'; c.fillRect(x - 60, y - 52, 120, 50); c.fillStyle = '#f0c040'; c.fillRect(x - 60, y - 52, 120, 6);
    c.fillStyle = '#2a3a52'; c.beginPath(); c.moveTo(x - 76, y - 50); c.quadraticCurveTo(x, y - 86, x + 76, y - 50); c.fill();
  }
  for (const br of B.branches) road(c, br.pts, false, 46, 'rgba(200,150,90,0.85)', 'rgba(120,70,30,0.85)');
  // willows and houses on the banks
  for (let i = 0; i < 14; i++) { const x = 75 + i * 115; if (x > 950 && x < 1220) continue; tree(c, x, 120, 0.9, '#6ab858'); }
  for (let i = 0; i < 14; i++) { const x = 75 + i * 115; if ((x > 260 && x < 500) || (x > 1110 && x < 1370)) continue; tree(c, x, 950, 0.9, '#6ab858'); }
  roofHouse(c, 300, 870, 160, 70, { roof: '#2a3a52', sign: '渡', rh: 40 });
  roofHouse(c, 1150, 880, 180, 70, { roof: '#5a2a2a', sign: '酒', rh: 40 });
  roofHouse(c, 1000, 60, 170, 70, { roof: '#2a4a3a', sign: '漁', rh: 40 });
  // small drifting sampans (decor)
  for (let i = 0; i < 4; i++) { const x = 250 + i * 330, y = 470 + (i % 2) * 80; if (Math.abs(x - 800) < 160) continue; c.fillStyle = '#8a5a2a'; c.beginPath(); c.moveTo(x - 40, y); c.quadraticCurveTo(x, y + 18, x + 40, y); c.lineTo(x + 30, y + 8); c.lineTo(x - 30, y + 8); c.fill(); c.fillStyle = '#d8c090'; c.beginPath(); c.arc(x, y - 4, 14, Math.PI, 0); c.fill(); }
}

export function paintBoard(B) {
  const cv = document.createElement('canvas'); cv.width = WORLD.w; cv.height = WORLD.h;
  const c = cv.getContext('2d');
  ({ town: paintTown, mountain: paintMountain, river: paintRiver })[B.id](c, B);
  return cv;
}
