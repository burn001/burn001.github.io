// Voxel avatar — same rig as the Agent4D voxel office character (github.com/burn001/agent4d).
// A random scene × outfit on every visit. Pin one with ?scene=golf&outfit=hoodie&hat=cap&glasses=1
// (scene: desk golf couch nap lean board walk treadmill papers · outfit: see OUTFITS · hat: cap beanie nightcap none).
window.mountAvatar = function (stage, pin = {}) {

  // Agent4D character.js 와 같은 골격 치수(단위 m). 팔·머리는 몸통에, 몸통·다리는 골반(root)에 붙는다.
  const HIP = 0.62, SHO = 0.58, NECK = 0.68, L1 = 0.3, L2 = 0.28;
  const C = {
    skin: 0xe8c3a3, hair: 0x1c1815, eye: 0x1d1714, dark: 0x9a7466, mouth: 0x8a5a50,
    watch: 0xb9bec7, watchFace: 0x1f2a3a, badge: 0x5cc8e8, lanyard: 0x17191e,
    deskTop: 0xc9a77c, deskEdge: 0x9c7a55, deskLeg: 0x3a3f4a, mug: 0xf2efe9, coffee: 0x4a2f22,
    pot: 0xb86b4b, plant: 0x4f8a5b, holo: 0x5cc8e8, chair: 0x2f3542, paper: 0xf4f2ec, metal: 0x8c939e,
    laptop: 0xb7bcc4, bezel: 0x22262e, screen: 0x0f1724,
  };
  const qs = new URLSearchParams(location.search);
  const arg = (k) => (pin[k] != null ? String(pin[k]) : qs.get(k));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  stage.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(30, 1, 0.05, 100);
  const controls = new THREE.OrbitControls(cam, renderer.domElement);
  controls.enableDamping = true; controls.enableZoom = false; controls.enablePan = false;
  controls.maxPolarAngle = Math.PI * 0.49;

  scene.add(new THREE.HemisphereLight(0xffffff, 0x707684, 0.8));
  const key = new THREE.DirectionalLight(0xfff3e6, 0.8);
  key.position.set(3, 6, 4); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -2, near: 0.5, far: 20 });
  key.shadow.bias = -0.0006; scene.add(key);
  const fill = new THREE.DirectionalLight(0xbfd6ff, 0.3); fill.position.set(-4, 3, -3); scene.add(fill);

  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mats = new Map();
  const mat = (c) => (typeof c === 'object' ? c : mats.get(c) || mats.set(c, new THREE.MeshLambertMaterial({ color: c })).get(c));
  const glow = (c, o = 1) => { const k = c + '/' + o; return mats.get(k) || mats.set(k, new THREE.MeshBasicMaterial({ color: c, transparent: o < 1, opacity: o })).get(k); };
  // 줄무늬·체크 같은 무늬 재질(16px 캔버스, 픽셀 그대로)
  const patt = (k, draw) => {
    if (mats.has(k)) return mats.get(k);
    const cv = document.createElement('canvas'); cv.width = cv.height = 16; draw(cv.getContext('2d'));
    const t = new THREE.CanvasTexture(cv); t.magFilter = t.minFilter = THREE.NearestFilter; t.encoding = THREE.sRGBEncoding;
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2);
    return mats.set(k, new THREE.MeshLambertMaterial({ map: t })).get(k);
  };
  const box = (parent, x, y, z, sx, sy, sz, c, shadow = true) => {
    const m = new THREE.Mesh(geo, mat(c)); m.position.set(x, y, z); m.scale.set(sx, sy, sz);
    m.castShadow = shadow; m.receiveShadow = true; parent.add(m); return m;
  };
  const joint = (parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.order = 'YXZ'; parent.add(g); return g; };
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const smooth = (u) => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
  const lerp = (a, b, u) => a + (b - a) * u;
  const rnd = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

  // ── 바닥(사무실 타일). 걷는 장면은 타일을 뒤로 흘려 보낸다.
  const tiles = [];
  for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) {
    const t = box(scene, i * 0.5, -0.01, 0, 0.49, 0.02, 0.49, (i + j) & 1 ? 0xb4bcc8 : 0xa7b0bd, false);
    t.material = t.material.clone(); t.material.transparent = true; tiles.push([t, i, j]);
  }
  const floorScroll = (off) => {
    for (const [t, i, j] of tiles) {
      const z = (((j * 0.5 + off + 1.75) % 3.5) + 3.5) % 3.5 - 1.75;
      t.position.z = z + 0.2; t.material.opacity = Math.max(0, 1 - Math.hypot(i, z / 0.5) / 4.2);
    }
  };

  // ── 캔버스 화면(홀로그램 창·모니터·노트북)
  const disposables = [];
  const mkPanel = (parent, w, h, pxW, pxH, opts = {}) => {
    const cv = document.createElement('canvas'); cv.width = pxW; cv.height = pxH;
    const tex = new THREE.CanvasTexture(cv); tex.encoding = THREE.sRGBEncoding;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: !!opts.holo, depthWrite: !opts.holo, side: THREE.DoubleSide }));
    parent.add(m); disposables.push(tex, m.geometry, m.material);
    return { m, cv, ctx: cv.getContext('2d'), tex };
  };
  const MONO = '"IBM Plex Mono", Consolas, monospace';
  const typeLines = (P, lines, t, { x = 22, y0 = 88, lh = 39, font = 26, rows = 9, speed = 1.4, prompt = 'rgba(255,214,140,0.95)', out = 'rgba(170,235,255,0.85)' } = {}) => {
    const ctx = P.ctx, shown = Math.floor(t * speed);
    ctx.font = `400 ${font}px ${MONO}`;
    for (let r = 0; r < rows; r++) {
      const idx = shown - rows + 1 + r; if (idx < 0) continue;
      const [p, s] = lines[idx % lines.length];
      const last = r === rows - 1, n = last ? Math.floor(((t * speed) % 1) * s.length * 1.6) : s.length;
      ctx.fillStyle = p ? prompt : out;
      ctx.fillText(p + s.slice(0, n) + (last && Math.floor(t * 3) % 2 ? '▌' : ''), x, y0 + r * lh);
    }
    P.tex.needsUpdate = true;
  };
  const holoFrame = (P, title) => {
    const { ctx, cv } = P, w = cv.width, h = cv.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(40,150,190,0.22)'; ctx.strokeStyle = 'rgba(120,220,250,0.9)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(4, 4, w - 8, h - 8, 18) : ctx.rect(4, 4, w - 8, h - 8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(150,230,255,0.95)'; ctx.font = `500 22px ${MONO}`; ctx.fillText(title, 22, 36);
    ctx.fillStyle = 'rgba(120,220,250,0.35)'; ctx.fillRect(18, 48, w - 36, 2);
  };
  const darkFrame = (P, title) => {
    const { ctx, cv } = P, w = cv.width, h = cv.height;
    ctx.fillStyle = '#0f1724'; ctx.fillRect(0, 0, w, h);
    if (!title) return;
    ctx.fillStyle = '#1b2738'; ctx.fillRect(0, 0, w, 30);
    ctx.fillStyle = 'rgba(150,230,255,0.9)'; ctx.font = `500 17px ${MONO}`; ctx.fillText(title, 12, 21);
  };

  // ── 소품
  const desk = (g, x, z, w, d, h) => {
    box(g, x, h - 0.03, z, w, 0.06, d, C.deskTop);
    box(g, x, h - 0.045, z - d / 2 + 0.02, w, 0.03, 0.04, C.deskEdge);
    for (const lx of [x - w / 2 + 0.1, x + w / 2 - 0.1]) {
      box(g, lx, (h - 0.06) / 2, z, 0.08, h - 0.06, 0.08, C.deskLeg);
      box(g, lx, 0.02, z, 0.1, 0.04, d - 0.08, C.deskLeg);
    }
  };
  const mug = (g, x, y, z, c = C.mug) => {
    const m = new THREE.Group(); m.position.set(x, y, z); g.add(m);
    box(m, 0, 0.065, 0, 0.1, 0.13, 0.1, c); box(m, 0, 0.126, 0, 0.075, 0.01, 0.075, C.coffee, false);
    box(m, -0.065, 0.075, 0, 0.03, 0.06, 0.03, c); return m;
  };
  const plant = (g, x, y, z, s = 1) => {
    box(g, x, y + 0.07 * s, z, 0.13 * s, 0.14 * s, 0.13 * s, C.pot);
    box(g, x, y + 0.22 * s, z, 0.19 * s, 0.17 * s, 0.19 * s, C.plant);
    box(g, x - 0.03 * s, y + 0.34 * s, z - 0.02 * s, 0.1 * s, 0.1 * s, 0.1 * s, C.plant);
  };
  const chair = (g, x, z, seat, back = 0, rotY = 0) => {
    const c = new THREE.Group(); c.position.set(x, 0, z); c.rotation.y = rotY; g.add(c);
    box(c, 0, 0.03, 0, 0.5, 0.04, 0.07, C.deskLeg); box(c, 0, 0.03, 0, 0.07, 0.04, 0.5, C.deskLeg);
    box(c, 0, seat / 2, 0, 0.06, seat, 0.06, C.deskLeg);
    box(c, 0, seat - 0.03, 0, 0.5, 0.07, 0.48, C.chair);
    const b = joint(c, 0, seat, -0.25); b.rotation.x = -back;
    box(b, 0, 0.12, 0, 0.06, 0.24, 0.05, C.deskLeg); box(b, 0, 0.42, -0.01, 0.48, 0.42, 0.07, C.chair);
    return c;
  };
  // 모니터: 화면이 +z 를 본다(그룹을 돌려서 배치)
  const monitor = (g, x, y, z, rotY, w = 0.62, h = 0.38) => {
    const m = new THREE.Group(); m.position.set(x, y, z); m.rotation.y = rotY; g.add(m);
    box(m, 0, 0.01, -0.02, 0.22, 0.02, 0.16, C.deskLeg); box(m, 0, 0.14, -0.04, 0.05, 0.26, 0.04, C.deskLeg);
    box(m, 0, 0.1 + h / 2, -0.03, w + 0.04, h + 0.04, 0.03, C.bezel);
    const P = mkPanel(m, w, h, 384, Math.round(384 * h / w)); P.m.position.set(0, 0.1 + h / 2, -0.012);
    return P;
  };
  // 노트북: 화면 경첩 그룹(lid). 화면은 -z 쪽(사용자 쪽)을 본다 → 사용자가 +z 를 볼 때 그대로
  const laptop = (g) => {
    const l = new THREE.Group(); g.add(l);
    box(l, 0, 0.0125, 0, 0.38, 0.025, 0.26, C.laptop);
    box(l, 0, 0.026, -0.01, 0.32, 0.004, 0.13, 0x3a3f48, false);
    const lid = joint(l, 0, 0.025, 0.13); lid.rotation.x = 0.25;
    box(lid, 0, 0.13, 0.006, 0.38, 0.26, 0.012, C.laptop);
    const P = mkPanel(lid, 0.34, 0.22, 272, 176); P.m.position.set(0, 0.13, -0.002); P.m.rotation.y = Math.PI;
    l.lid = lid; l.P = P; return l;
  };
  const CODE = [
    ['>>> ', 'gdf = gpd.read_file("buildings.shp")'],
    ['', '  612,408 rows'],
    ['>>> ', 'gdf.groupby("sigungu").far.mean()'],
    ['', '  강남구  2.84  · 서초구  2.31'],
    ['>>> ', 'model.fit(X_train, y_train)'],
    ['', '  r2 = 0.81'],
    ['$ ', 'git push origin main'],
    ['', '  → burn001/alris'],
  ];

  // ── 캐릭터(옷차림별로 새로 짓는다)
  const OUTFITS = {
    tee:      { style: 'tee', top: [0x34506b, 0x3c4a3e, 0x5a3440, 0x3a3d45], sleeve: 'short', pants: [0x2b2f38], shoe: [0x17191e], badge: 0.8 },
    shirt:    { style: 'shirt', top: [0xdfe8f2, 0xf2f2ee, 0xc9d9ec], sleeve: 'long', tie: [0x8a2d3b, 0x2c4a7a, 0x3d5a45, null], pants: [0x3a3f4a, 0x4b4f57], shoe: [0x3b2a22, 0x17191e], badge: 0.7 },
    suit:     { style: 'suit', top: [0x2a3140, 0x3a3e46, 0x2b3a4f], inner: 0xf4f4f2, tie: [0x6b2333, 0x2c4a7a, 0x7a5a2b], sleeve: 'long', cuff: 0xf4f4f2, pants: 'top', shoe: [0x121316, 0x3b2a22] },
    hoodie:   { style: 'hoodie', top: [0x8b929c, 0x34506b, 0x2f3238, 0x6d4f6e], sleeve: 'long', pants: [0x2f3a4f, 0x2b2f38], shoe: [0xe9e9e6], sole: 0xffffff },
    cardigan: { style: 'cardigan', top: [0x9b7b5b, 0x5d6b80, 0x7a4a45], inner: [0xeeeae2, 0x2b2f38], sleeve: 'long', pants: [0x4a4f58, 0x6b6253], shoe: [0x3b2a22], badge: 0.6 },
    polo:     { style: 'polo', top: [0xf5f5f2, 0x2c5f8a, 0xe6d7a8, 0xd65f5f], sleeve: 'short', pants: [0xd8cfb8, 0x2b2f38, 0xf1efe8], shoe: [0xf3f3f0], sole: 0x2b2f38 },
    pajamas:  { style: 'pajama', sleeve: 'long', shoe: [0x6b7fa6, 0x9c7a8a] },
    knit:     { style: 'knit', top: [0x5f7a5a, 0xc8b89a, 0x7b8fa8, 0x8a3b3b], inner: 0xf4f4f2, sleeve: 'long', pants: [0x3a3f4a, 0x6b6253], shoe: [0x3b2a22, 0x17191e], badge: 0.4 },
    flannel:  { style: 'flannel', sleeve: 'rolled', pants: [0x2f3a4f, 0x3c4250], shoe: [0xe9e9e6, 0x17191e], sole: 0xffffff, badge: 0.5 },
  };
  const shade = (c, k) => { const o = new THREE.Color(c); o.multiplyScalar(k); return o.getHex(); };
  const PJ = patt('pj', (x) => { x.fillStyle = '#c9d8ee'; x.fillRect(0, 0, 16, 16); x.fillStyle = '#6f8fbf'; x.fillRect(0, 0, 3, 16); x.fillRect(8, 0, 3, 16); });
  const FLANNEL = [['#8a2f2f', '#3a2222'], ['#2f5a8a', '#1e2a3a'], ['#4f6b3a', '#2a3322']].map(([a, b], i) => patt('fl' + i, (x) => {
    x.fillStyle = a; x.fillRect(0, 0, 16, 16); x.fillStyle = b; x.fillRect(0, 5, 16, 4); x.fillRect(5, 0, 4, 16);
    x.fillStyle = 'rgba(255,255,255,0.25)'; x.fillRect(0, 12, 16, 1); x.fillRect(12, 0, 1, 16);
  }));

  function buildChar(o) {
    const R = { root: new THREE.Group(), legs: [], knees: [], arms: [], elbows: [], hands: [] };
    const top = o.top, pants = o.pants;
    for (const sx of [-0.13, 0.13]) {
      const h = joint(R.root, sx, HIP, 0);
      box(h, 0, -0.15, 0, 0.2, 0.32, 0.22, pants);
      const k = joint(h, 0, -0.3, 0);
      box(k, 0, 0, 0, 0.2, 0.18, 0.22, pants);
      box(k, 0, -0.14, 0, 0.2, 0.3, 0.22, pants);
      if (o.style === 'pajama') { box(k, 0, -0.33, 0.05, 0.22, 0.06, 0.32, o.shoe); }
      else {
        box(k, 0, -0.3, 0.05, 0.22, 0.08, 0.32, o.shoe);
        if (o.sole) box(k, 0, -0.335, 0.05, 0.225, 0.015, 0.325, o.sole, false);
      }
      R.legs.push(h); R.knees.push(k);
    }
    const T = R.torso = joint(R.root, 0, HIP, 0);
    box(T, 0, 0.33, 0, 0.54, 0.66, 0.3, top);
    const F = 0.152; // 앞면
    const collarTips = (c) => { for (const s of [-1, 1]) box(T, s * 0.055, 0.635, F + 0.004, 0.09, 0.05, 0.012, c, false).rotation.z = s * 0.55; };
    const tie = (c) => { if (c == null) return; box(T, 0, 0.6, F + 0.01, 0.06, 0.05, 0.02, shade(c, 0.85), false); box(T, 0, 0.42, F + 0.008, 0.07, 0.32, 0.014, c, false); box(T, 0, 0.255, F + 0.008, 0.045, 0.03, 0.014, c, false); };
    switch (o.style) {
      case 'tee':
        box(T, 0, 0.03, 0, 0.55, 0.06, 0.31, shade(top, 0.82));
        box(T, 0, 0.645, 0.1, 0.16, 0.03, 0.12, C.skin, false); break;
      case 'shirt':
        box(T, 0, 0.03, 0, 0.55, 0.05, 0.31, 0x2a2420);
        box(T, 0, 0.33, F + 0.002, 0.02, 0.6, 0.006, shade(top, 0.88), false);
        collarTips(shade(top, 1.05)); tie(o.tie); break;
      case 'suit':
        box(T, 0, 0.47, F + 0.002, 0.15, 0.38, 0.006, o.inner, false);
        collarTips(o.inner); tie(o.tie);
        for (const s of [-1, 1]) box(T, s * 0.1, 0.5, F + 0.008, 0.06, 0.3, 0.012, shade(top, 0.75), false).rotation.z = s * 0.28;
        for (const y of [0.24, 0.14]) box(T, 0.03, y, F + 0.006, 0.03, 0.03, 0.01, 0x15171c, false);
        box(T, 0, 0.0, 0, 0.56, 0.08, 0.31, top); break;
      case 'hoodie':
        box(T, 0, 0.62, -0.1, 0.46, 0.2, 0.16, shade(top, 0.9));
        box(T, 0, 0.67, 0.0, 0.42, 0.05, 0.26, shade(top, 0.8), false);
        box(T, 0, 0.17, F + 0.004, 0.32, 0.15, 0.012, shade(top, 0.88), false);
        for (const s of [-1, 1]) box(T, s * 0.05, 0.52, F + 0.008, 0.02, 0.15, 0.01, 0xf2f2ee, false);
        box(T, 0, 0.03, 0, 0.55, 0.06, 0.31, shade(top, 0.8)); break;
      case 'cardigan':
        box(T, 0, 0.42, F + 0.002, 0.14, 0.48, 0.006, o.inner, false);
        box(T, 0, 0.645, 0.1, 0.13, 0.03, 0.1, C.skin, false);
        for (let i = 0; i < 4; i++) box(T, 0.085, 0.1 + i * 0.1, F + 0.006, 0.025, 0.025, 0.01, shade(top, 0.6), false);
        box(T, 0, 0.03, 0, 0.55, 0.06, 0.31, shade(top, 0.85)); break;
      case 'polo':
        for (const s of [-1, 1]) box(T, s * 0.08, 0.655, 0.06, 0.13, 0.03, 0.17, shade(top, 0.92), false);
        box(T, 0, 0.55, F + 0.002, 0.05, 0.18, 0.006, shade(top, 0.9), false);
        for (const y of [0.6, 0.53]) box(T, 0, y, F + 0.006, 0.02, 0.02, 0.008, 0xd8d8d8, false);
        box(T, 0, 0.03, 0, 0.55, 0.05, 0.31, 0x2a2420); break;
      case 'pajama':
        for (const s of [-1, 1]) box(T, s * 0.06, 0.6, F + 0.004, 0.1, 0.12, 0.01, 0xe8eef8, false).rotation.z = s * 0.5;
        for (let i = 0; i < 4; i++) box(T, 0, 0.12 + i * 0.12, F + 0.006, 0.025, 0.025, 0.01, 0xffffff, false);
        break;
      case 'knit':
        box(T, 0, 0.645, 0.0, 0.3, 0.04, 0.26, shade(top, 0.8), false);
        collarTips(o.inner);
        box(T, 0, 0.42, F + 0.002, 0.54, 0.05, 0.006, shade(top, 1.25), false);
        box(T, 0, 0.035, 0, 0.55, 0.07, 0.31, shade(top, 0.8)); break;
      case 'flannel':
        box(T, 0, 0.645, 0.1, 0.16, 0.03, 0.12, 0x2b2f38, false);
        collarTips(shade(0x777777, 1)); box(T, 0, 0.33, F + 0.002, 0.02, 0.6, 0.006, 0x2a2420, false); break;
    }
    if (o.badge) {
      box(T, 0, 0.6, F + 0.013, 0.035, 0.2, 0.01, C.lanyard, false);
      box(T, 0.09, 0.36, F + 0.028, 0.11, 0.14, 0.015, glow(C.badge), false);
    }
    // 팔: 어깨 → 팔꿈치 → 손(손 중심 = 팔꿈치 아래 L2)
    for (const [sx, i] of [[-0.36, 0], [0.36, 1]]) {
      const a = joint(T, sx, SHO, 0), e = joint(a, 0, -L1, 0);
      const sleeve = o.sleeve, cuff = o.cuff || shade(top === PJ ? 0x6f8fbf : typeof top === 'number' ? top : 0x555555, 0.85);
      if (sleeve === 'short') {
        box(a, 0, -0.12, 0, 0.18, 0.26, 0.18, top); box(a, 0, -0.275, 0, 0.14, 0.06, 0.14, C.skin);
        box(e, 0, 0, 0, 0.14, 0.14, 0.14, C.skin); box(e, 0, -0.11, 0, 0.14, 0.22, 0.14, C.skin);
      } else if (sleeve === 'rolled') {
        box(a, 0, -0.15, 0, 0.18, 0.3, 0.18, top); box(a, 0, -0.28, 0, 0.19, 0.06, 0.19, shade(0xb04040, 0.6));
        box(e, 0, 0, 0, 0.14, 0.14, 0.14, C.skin); box(e, 0, -0.11, 0, 0.14, 0.22, 0.14, C.skin);
      } else {
        box(a, 0, -0.15, 0, 0.18, 0.31, 0.18, top);
        box(e, 0, 0, 0, 0.17, 0.17, 0.17, top); box(e, 0, -0.1, 0, 0.17, 0.2, 0.17, top);
        box(e, 0, -0.2, 0, 0.175, 0.035, 0.175, o.style === 'suit' ? o.cuff : cuff);
      }
      box(e, 0, -0.28, 0, 0.13, 0.12, 0.13, i === 1 && o.glove ? 0xf4f4f2 : C.skin);
      if (i === 0 && sleeve !== 'long') { box(e, 0, -0.17, 0, 0.17, 0.04, 0.17, C.watch); box(e, 0, -0.17, 0.086, 0.06, 0.035, 0.008, C.watchFace, false); }
      const hand = new THREE.Group(); hand.position.set(0, -L2, 0); e.add(hand);
      R.arms.push(a); R.elbows.push(e); R.hands.push(hand);
    }
    // 머리 — 얼굴(졸린 눈·다크서클·머리 모양)은 어느 장면에서나 같다
    const H = R.head = joint(T, 0, NECK, 0);
    box(H, 0, 0.22, 0, 0.44, 0.44, 0.44, C.skin);
    box(H, 0, 0.46, -0.03, 0.48, 0.1, 0.48, C.hair);
    box(H, 0, 0.3, -0.2, 0.48, 0.24, 0.08, C.hair);
    for (const s of [-1, 1]) box(H, s * 0.23, 0.33, -0.06, 0.04, 0.2, 0.32, C.hair);
    box(H, 0.04, 0.52, 0.06, 0.4, 0.07, 0.3, C.hair);
    box(H, 0.0, 0.42, 0.205, 0.48, 0.1, 0.06, C.hair);
    box(H, -0.17, 0.39, 0.215, 0.1, 0.06, 0.04, C.hair);
    box(H, -0.09, 0.53, 0.05, 0.02, 0.012, 0.36, 0x3a322c, false);
    R.eyes = [];
    for (const s of [-1, 1]) {
      R.eyes.push(box(H, s * 0.1, 0.205, 0.222, 0.08, 0.03, 0.01, C.eye, false));
      box(H, s * 0.1, 0.174, 0.221, 0.09, 0.026, 0.006, C.dark, false); // 다크서클
    }
    R.mouth = box(H, 0, 0.11, 0.222, 0.05, 0.018, 0.01, C.mouth, false);
    if (o.glasses) {
      const g = 0x23262c;
      for (const s of [-1, 1]) {
        box(H, s * 0.1, 0.25, 0.236, 0.15, 0.016, 0.012, g, false); box(H, s * 0.1, 0.152, 0.236, 0.15, 0.012, 0.012, g, false);
        box(H, s * 0.172, 0.2, 0.236, 0.014, 0.1, 0.012, g, false); box(H, s * 0.028, 0.2, 0.236, 0.012, 0.1, 0.012, g, false);
        box(H, s * 0.226, 0.235, 0.1, 0.012, 0.016, 0.27, g, false);
      }
    }
    const hc = o.hatColor;
    if (o.hat === 'cap') {
      box(H, 0, 0.535, -0.02, 0.5, 0.13, 0.5, hc); box(H, 0, 0.475, 0.31, 0.44, 0.025, 0.2, shade(hc, 0.85));
      box(H, 0, 0.605, -0.02, 0.06, 0.02, 0.06, shade(hc, 0.8), false);
    } else if (o.hat === 'beanie') {
      box(H, 0, 0.55, -0.02, 0.5, 0.18, 0.5, hc); box(H, 0, 0.465, -0.02, 0.52, 0.06, 0.52, shade(hc, 0.82));
    } else if (o.hat === 'nightcap') {
      box(H, 0, 0.52, -0.03, 0.5, 0.12, 0.5, hc); box(H, 0.05, 0.62, -0.06, 0.36, 0.1, 0.36, hc);
      box(H, 0.15, 0.68, -0.09, 0.22, 0.08, 0.22, hc); box(H, 0.27, 0.68, -0.1, 0.12, 0.07, 0.12, hc);
      box(H, 0.35, 0.63, -0.1, 0.09, 0.09, 0.09, 0xffffff);
    }
    H.scale.setScalar(1.45); // 이등신
    return R;
  }
  const resetRig = (R) => {
    R.root.position.set(0, 0, 0); R.root.quaternion.identity();
    R.torso.rotation.set(0, 0, 0); R.torso.rotation.order = 'YXZ';
    for (const j of [...R.legs, ...R.knees, ...R.arms, ...R.elbows]) j.rotation.set(0, 0, 0);
    R.head.rotation.set(0, 0, 0); R.head.position.set(0, NECK, 0);
  };

  // 두 마디 팔 IK: 손 중심을 target(월드)에, 팔꿈치는 pole(월드 방향) 쪽으로
  const _a = V(), _b = V(), _c = V(), _d = V(), _e = V(), _f = V(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
  const reach = (R, i, target, pole) => {
    const a = R.arms[i]; a.parent.updateMatrixWorld(true);
    const S = a.getWorldPosition(_a), n = _b.subVectors(target, S);
    const d = clamp(n.length(), 0.1, L1 + L2 - 0.002); n.normalize();
    const ca = clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1), sa = Math.sqrt(1 - ca * ca);
    const p = _c.copy(pole).addScaledVector(n, -pole.dot(n));
    if (p.lengthSq() < 1e-6) p.set(0, -1, 0).addScaledVector(n, n.y); p.normalize();
    const u1 = _d.copy(n).multiplyScalar(ca).addScaledVector(p, sa);
    const u2 = _e.copy(n).multiplyScalar(d).addScaledVector(u1, -L1).normalize();
    const beta = Math.acos(clamp(u1.dot(u2), -1, 1));
    const z = _f.copy(u2).addScaledVector(u1, -u2.dot(u1));
    if (z.lengthSq() < 1e-6) z.copy(p).negate(); z.normalize();
    const y = u1.negate(), x = _c.crossVectors(y, z);
    _m.makeBasis(x, y, z); _q.setFromRotationMatrix(_m);
    a.parent.getWorldQuaternion(_q2); a.quaternion.copy(_q2.invert().multiply(_q));
    R.elbows[i].rotation.set(-beta, 0, 0);
  };
  const walkLegs = (R, ph, amp = 0.5) => {
    R.legs.forEach((l, i) => {
      const s = Math.sin(ph + i * Math.PI);
      l.rotation.x = -amp * s; R.knees[i].rotation.x = Math.max(0, Math.sin(ph + i * Math.PI + 1.3)) * amp * 1.3;
    });
    R.root.position.y = -0.02 + 0.025 * Math.abs(Math.cos(ph));
  };
  const seat = (R, hipY, z = 0) => {
    R.root.position.set(0, hipY - HIP, z);
    R.legs.forEach((l) => (l.rotation.x = -Math.PI / 2)); R.knees.forEach((k) => (k.rotation.x = Math.PI / 2));
  };
  const toWorld = (obj, x, y, z) => obj.localToWorld(V(x, y, z));

  // Zzz
  const zTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d');
    x.font = `700 52px ${MONO}`; x.fillStyle = '#9fdcf2'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('z', 32, 34);
    const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; return t; })();
  const zs = [0, 1, 2].map(() => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: zTex, transparent: true, depthWrite: false })); scene.add(s); return s; });
  const zzz = (k, base, period = 3) => zs.forEach((s, i) => {
    const u = k == null ? -1 : (((k / period) - i * 0.33) % 1 + 1) % 1;
    s.visible = u >= 0 && k != null; if (!s.visible) return;
    s.position.set(base.x + 0.12 * u + 0.04 * Math.sin(u * 9), base.y + 0.45 * u, base.z);
    s.scale.setScalar(0.09 + 0.08 * u + i * 0.02); s.material.opacity = Math.sin(u * Math.PI);
  });

  // ── 장면. build(g, R) → 상태 s, pose(t, s, R) 는 매 프레임 자세를 처음부터 잡는다.
  const SCENES = {
    // 서서 코딩: 스탠딩 데스크 + 홀로그램 모니터, 커밋 사이사이 존다
    desk: {
      cam: [[-2.9, 2.1, 4.3], [0.2, 1.12, 0.25]], still: 4,
      build(g) {
        const DT = 0.92, DZ = 0.55, W = 1.3, D = 0.7, s = { DT, DZ, D };
        desk(g, 0, DZ, W, D, DT);
        box(g, 0, DT + 0.008, DZ + D / 2 - 0.14, W * 0.55, 0.016, 0.05, glow(C.holo), false);
        box(g, 0, DT + 0.006, DZ - 0.12, 0.5, 0.008, 0.16, glow(C.holo, 0.35), false);
        mug(g, -0.47, DT, DZ - 0.05); plant(g, 0.52, DT, DZ + 0.2);
        s.mon = mkPanel(g, 0.95, 0.55, 760, 440, { holo: 1 }); s.mon.m.position.set(0.42, DT + 0.5, DZ + D / 2 - 0.14);
        s.side = mkPanel(g, 0.34, 0.24, 272, 192, { holo: 1 }); s.side.m.position.set(1.02, DT + 0.78, DZ + D / 2 - 0.2);
        const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(12), 3));
        s.beams = new THREE.LineSegments(bg, new THREE.LineBasicMaterial({ color: C.holo, transparent: true, opacity: 0.55 }));
        g.add(s.beams); disposables.push(bg, s.beams.material);
        return s;
      },
      pose(t, s, R) {
        // 졸음 주기 8초: 느린 타자(0–4.8) → 꼬박(4.8–7.4) → 화들짝(7.4–8), 세 번에 한 번 하품
        const p = t % 8, cyc = Math.floor(t / 8);
        const doze = p < 4.8 ? 0 : p < 7.4 ? (p - 4.8) / 2.6 : 0;
        const jolt = p >= 7.4 ? 1 - (p - 7.4) / 0.6 : 0;
        const yawn = cyc % 3 === 1 && p > 1 && p < 3 ? Math.sin(((p - 1) / 2) * Math.PI) : 0;
        const ease = smooth(doze), [aL, aR] = R.arms, tap = 0.07 * (1 - ease);
        aL.rotation.set(-1.25 + 0.3 * ease + tap * Math.sin(t * 7), 0, 0.22);
        if (yawn > 0.2) aR.rotation.set(-1.25 - 1.0 * yawn, 0, -0.45 * yawn);
        else aR.rotation.set(-1.25 + 0.3 * ease + tap * Math.sin(t * 7 + Math.PI), 0, -0.2);
        // 책상 충돌: 손 아래 모서리가 상판보다 낮으면 팔을 더 들어 상판 위에 얹는다
        R.elbows.forEach((e, i) => {
          const a = R.arms[i];
          for (let k = 0; k < 24; k++) {
            e.updateMatrixWorld(true);
            let low = Infinity;
            for (const cx of [-0.065, 0.065]) for (const cz of [-0.065, 0.065]) low = Math.min(low, _a.set(cx, -0.345, cz).applyMatrix4(e.matrixWorld).y);
            const z = _a.set(0, -0.3, 0).applyMatrix4(e.matrixWorld).z;
            if (low >= s.DT + 0.003 || z < s.DZ - s.D / 2) break;
            a.rotation.x -= 0.02;
          }
        });
        R.head.rotation.set(0.12 + 0.42 * ease - 0.25 * jolt - 0.2 * yawn, 0.03 * Math.sin(t * 0.3), 0.08 * Math.sin(t * 0.7) + 0.1 * ease);
        R.head.position.y = NECK + 0.015 * jolt;
        R.torso.rotation.x = 0.01 * Math.sin(t * 1.6);
        s.face = { lid: jolt > 0 ? 0.07 : yawn > 0.3 ? 0.008 : 0.03 * (1 - 0.75 * ease), yawn };
        s.z = p > 4.6 && p < 7.4 ? p - 4.6 : null; s.zBase = V(0.25, 2.15, 0.1);
        const pos = s.beams.geometry.attributes.position.array, mz = s.mon.m.position.z, my = s.mon.m.position.y - 0.275;
        R.hands.forEach((h, i) => { h.getWorldPosition(_b); pos.set([_b.x, _b.y, _b.z, _b.x * 0.6, my, mz], i * 6); });
        s.beams.geometry.attributes.position.needsUpdate = true;
        s.beams.material.opacity = 0.35 + 0.25 * Math.sin(t * 9);
        s.mon.m.quaternion.copy(cam.quaternion); s.side.m.quaternion.copy(cam.quaternion);
        if (!(t - (s.last ?? -1) < 0.06)) {
          s.last = t;
          holoFrame(s.mon, 'Bash · agent4d');
          typeLines(s.mon, [
            ['$ ', 'node agent4d.mjs start'], ['', '  ✓ server :7420 · viewer ready'], ['$ ', 'git commit -m "voxel avatar"'],
            ['', '  [main 3ae36b3] 1 file changed'], ['$ ', 'git push origin main'], ['', '  → burn001/agent4d'],
            ['$ ', 'npm test'], ['', '  ✓ 908 passed · 0 failed'], ['$ ', 'node agent4d.mjs job add --log run.log'], ['', '  job 3f2a · 12/40 · ETA 8m'],
          ], t);
          holoFrame(s.side, 'Read'); const x = s.side.ctx;
          x.font = `400 20px ${MONO}`; x.fillStyle = 'rgba(170,235,255,0.85)';
          ['CONTRACT.md', '§109 job add', '§110 Planet jobs'].forEach((v, i) => x.fillText(v, 22, 84 + i * 32));
          x.fillStyle = 'rgba(120,220,250,0.3)'; x.fillRect(22, 168, 228, 8);
          x.fillStyle = 'rgba(150,230,255,0.95)'; x.fillRect(22, 168, 228 * ((t * 0.25) % 1), 8); s.side.tex.needsUpdate = true;
        }
      },
    },

    // 골프 스윙: 사무실 한쪽 연습 매트. 어드레스 → 백스윙 → 다운스윙·임팩트 → 피니시
    golf: {
      cam: [[-1.9, 1.6, 5.8], [0.05, 0.9, 0.3]], still: 2.1,
      build(g, R) {
        const s = {};
        box(g, 0.1, 0.012, 0.45, 2.2, 0.024, 1.5, 0x4f9a5b, false);
        for (let i = 0; i < 6; i++) box(g, -0.95 + i * 0.4, 0.026, 0.45, 0.18, 0.004, 1.5, 0x5aa866, false);
        box(g, 0.1, 0.03, 0.05, 0.1, 0.012, 0.1, 0xf2f2ee, false);
        // 골프백·공 바구니
        const bag = new THREE.Group(); bag.position.set(-1.05, 0, -0.35); bag.rotation.z = 0.12; g.add(bag);
        box(bag, 0, 0.42, 0, 0.26, 0.84, 0.26, 0x1f3f66); box(bag, 0, 0.8, 0, 0.28, 0.06, 0.28, 0x16304f);
        box(bag, 0, 0.3, 0.14, 0.18, 0.3, 0.04, 0x16304f); box(bag, 0.14, 0.55, 0, 0.03, 0.5, 0.04, 0x22262e);
        [[-0.06, 0.95, 0.05, 0x8c939e], [0.05, 0.98, -0.04, 0x8c939e], [0.04, 0.93, 0.07, 0x2b2f38]].forEach(([x, y, z, c]) => {
          box(bag, x, y, z, 0.02, 0.22, 0.02, C.metal); box(bag, x + 0.02, y + 0.11, z, 0.08, 0.05, 0.05, c);
        });
        box(g, -0.75, 0.07, 0.6, 0.22, 0.14, 0.22, 0x3a3f4a);
        for (let i = 0; i < 6; i++) box(g, -0.81 + (i % 3) * 0.06, 0.155, 0.56 + Math.floor(i / 3) * 0.07, 0.045, 0.045, 0.045, 0xffffff);
        // 클럽: 그립 끝(손 위치)에서 -y 로 샤프트
        s.club = new THREE.Group(); g.add(s.club);
        box(s.club, 0, -0.02, 0, 0.034, 0.22, 0.034, 0x1b1d22);
        box(s.club, 0, -0.5, 0, 0.018, 0.8, 0.018, C.metal);
        box(s.club, 0, -0.9, 0.035, 0.05, 0.045, 0.11, 0x3a3f4a);
        s.ball = box(g, 0, 0, 0, 0.05, 0.05, 0.05, 0xffffff);
        s.tee = box(g, 0, 0, 0, 0.015, 0.04, 0.015, 0xe8d36a, false);
        s.u = V(0, -0.86, 0.5).normalize();
        return s;
      },
      init(s, R) { this.pose(0.2, s, R); s.ball0 = s.headPos.clone().add(V(0, 0.005, 0.035)); s.ball0.y = 0.07; s.tee.position.set(s.ball0.x, 0.04, s.ball0.z); },
      pose(t, s, R) {
        const P = 5, p = t % P;
        const TOP = 1.95, FIN = -2.1, K = [[0, 0], [0.9, 0], [2.1, TOP], [2.35, TOP], [2.62, 0], [2.95, FIN], [4.2, FIN], [5, 0]];
        let k = 0; while (k < K.length - 2 && p >= K[k + 1][0]) k++;
        const u = (p - K[k][0]) / (K[k + 1][0] - K[k][0]);
        const phi = lerp(K[k][1], K[k + 1][1], k === 3 ? u * u : k === 4 ? 1 - (1 - u) * (1 - u) : smooth(u));
        const impact = p >= 2.62 && p < 4.2;
        const back = Math.max(0, phi) / TOP, thru = Math.max(0, -phi) / -FIN;
        const hinge = phi >= 0 ? (k === 3 ? 1.0 * Math.min(1, phi / 0.9) : 1.0 * smooth(phi / 1.7)) : 0.15 * phi / -FIN;
        // 하체·몸통
        R.root.rotation.y = -0.3 * back + 0.6 * thru;
        R.root.position.y = -0.035 + 0.03 * thru;
        R.legs.forEach((l, i) => { l.rotation.x = -0.2 + 0.15 * thru; R.knees[i].rotation.x = 0.3 - 0.25 * thru; });
        R.legs[0].rotation.y = 0.2; R.legs[1].rotation.y = -0.2;
        R.knees[0].rotation.x += 0.55 * thru; R.legs[0].rotation.x -= 0.1 * thru; // 피니시: 오른발 뒤꿈치 들기
        R.torso.rotation.order = 'XYZ';
        R.torso.rotation.set(0.42 * (1 - 0.8 * thru), -0.75 * back + 0.55 * thru, 0.1 * back - 0.08 * thru);
        R.root.updateMatrixWorld(true);
        const S0 = R.arms[0].getWorldPosition(V()), S1 = R.arms[1].getWorldPosition(V());
        const c = S0.clone().add(S1).multiplyScalar(0.5);
        const r = (a) => V(-Math.sin(a), 0, 0).addScaledVector(s.u, Math.cos(a));
        const Hd = c.clone().addScaledVector(r(phi), 0.46);
        const dir = r(phi + hinge);
        // 두 손이 그립에 닿도록 어깨에서 닿는 거리 안으로 당긴다
        for (let n = 0; n < 3; n++) for (const [S, off] of [[S1, 0], [S0, 0.1]]) {
          const h = Hd.clone().addScaledVector(dir, off), dv = h.sub(S), L = dv.length(), max = L1 + L2 - 0.01;
          if (L > max) Hd.addScaledVector(dv.normalize(), max - L);
        }
        reach(R, 1, Hd, V(0.4, -1, -0.5));
        reach(R, 0, Hd.clone().addScaledVector(dir, 0.1), V(-0.4, -1, -0.5));
        s.club.position.copy(Hd); s.club.quaternion.setFromUnitVectors(V(0, -1, 0), dir);
        s.headPos = Hd.clone().addScaledVector(dir, 0.9);
        // 머리: 임팩트까지 공을 보고, 피니시에서 타깃(+x) 쪽을 본다
        const turn = R.root.rotation.y + R.torso.rotation.y;
        R.head.rotation.set(0.25 * (1 - thru), lerp(-turn * 0.9, 0.45 - turn, smooth(thru * 1.6 - 0.4)), 0);
        // 공
        if (s.ball0) {
          const fly = p - 2.62;
          if (impact && fly < 0.7) { s.ball.visible = true; s.ball.position.copy(s.ball0).add(V(7 * fly, 3 * fly - 2.5 * fly * fly, -1.2 * fly)); }
          else if (impact || p >= 4.2 && p < 4.6) s.ball.visible = false;
          else { s.ball.visible = true; s.ball.position.copy(s.ball0); const pop = p >= 4.6 ? smooth((p - 4.6) / 0.25) : 1; s.ball.scale.setScalar(0.05 * pop); }
        }
        s.face = { lid: 0.03 };
      },
    },

    // 소파에 누워 코딩: 노트북을 배 위에, 무릎 세우고
    couch: {
      cam: [[-0.6, 3.4, 4.6], [0.1, 0.6, 0.05]], still: 3,
      build(g) {
        const s = {}, so = 0x6b7f99, sd = 0x5a6c85;
        box(g, 0, 0.13, 0, 2.0, 0.22, 0.8, sd); box(g, 0, 0.3, 0.03, 1.84, 0.14, 0.74, so);
        box(g, 0, 0.55, -0.34, 2.0, 0.6, 0.18, sd);
        for (const sx of [-1, 1]) box(g, sx * 0.98, 0.4, 0.03, 0.16, 0.42, 0.74, sd);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, sx * 0.9, 0.01, sz * 0.32, 0.06, 0.02, 0.06, 0x2a2420);
        box(g, 0.78, 0.47, 0.0, 0.2, 0.2, 0.42, 0xe8d9b8).rotation.z = -0.35; // 쿠션
        box(g, -0.55, 0.42, -0.2, 0.32, 0.1, 0.28, 0xd9b45a).rotation.y = 0.3;
        // 사이드 테이블 + 머그 + 화분
        box(g, 1.35, 0.25, 0.1, 0.4, 0.5, 0.4, C.deskTop); mug(g, 1.3, 0.5, 0.2); plant(g, 1.4, 0.5, -0.02, 0.8);
        s.lap = laptop(g);
        return s;
      },
      pose(t, s, R) {
        // 등을 대고 눕는다: 몸 +y → 월드 +x(머리 쪽), 얼굴 +z → 월드 +y
        _m.makeBasis(V(0, 0, 1), V(1, 0, 0), V(0, 1, 0)); R.root.quaternion.setFromRotationMatrix(_m);
        R.root.position.set(-0.65 - HIP, 0.52, 0.02);
        R.torso.rotation.x = 0.55;
        R.legs.forEach((l, i) => { l.rotation.x = -1.15; l.rotation.z = (i ? -1 : 1) * 0.06; R.knees[i].rotation.x = 1.75 + 0.1 * Math.sin(t * 0.6 + i); });
        R.head.rotation.set(0.42, 0.06 * Math.sin(t * 0.4), 0);
        R.root.updateMatrixWorld(true);
        // 노트북: 배 위에 비스듬히, 화면이 얼굴 쪽
        const L = s.lap; L.position.copy(toWorld(R.torso, 0, 0.28, 0.17)); L.quaternion.copy(R.torso.getWorldQuaternion(_q));
        L.rotateX(Math.PI / 2 - 0.25); L.lid.rotation.x = 0.35;
        L.updateMatrixWorld(true);
        const tap = (i) => 0.012 * Math.max(0, Math.sin(t * 9 + i * Math.PI));
        reach(R, 0, toWorld(L, -0.08, 0.08 + tap(0), -0.03), V(0, 0, -1));
        reach(R, 1, toWorld(L, 0.08, 0.08 + tap(1), -0.03), V(0, 0, 1));
        if (!(t - (s.last ?? -1) < 0.08)) { s.last = t; darkFrame(L.P, 'analysis.ipynb'); typeLines(L.P, CODE, t, { x: 10, y0: 52, lh: 20, font: 13, rows: 6, speed: 1.1 }); }
        s.face = { lid: 0.03 };
      },
    },

    // 책상에 엎드려 쪽잠: 팔베개, 모니터는 화면보호기
    nap: {
      cam: [[-3.7, 1.9, 2.5], [0.1, 0.8, 0.35]], still: 1,
      build(g) {
        const s = { DT: 0.66 };
        desk(g, 0, 0.5, 1.4, 0.62, s.DT);
        chair(g, 0, -0.25, 0.3);
        s.mon = monitor(g, 0.42, s.DT, 0.66, -0.75);
        mug(g, -0.55, s.DT, 0.62); plant(g, -0.58, s.DT, 0.32, 0.7);
        for (let i = 0; i < 4; i++) box(g, 0.28, s.DT + 0.01 + i * 0.014, 0.32, 0.26, 0.012, 0.2, i % 2 ? C.paper : 0xe9e4d6).rotation.y = 0.15 * i;
        return s;
      },
      pose(t, s, R) {
        seat(R, 0.38, -0.22);
        const br = Math.sin(t * 1.3);
        R.torso.rotation.set(0.95 + 0.015 * br, 0, 0);
        R.root.updateMatrixWorld(true);
        const y = s.DT + 0.075;
        reach(R, 0, V(0.14, y, 0.5), V(-1, 0.1, -0.2));
        reach(R, 1, V(-0.16, y + 0.02, 0.47), V(1, 0.1, -0.2));
        R.head.rotation.set(-0.15, -1.25, 0);
        R.head.position.set(-0.02, NECK + 0.02, 0.06);
        s.face = { lid: 0.007, yawn: 0.25 + 0.1 * br };
        s.z = t; s.zBase = V(-0.55, 1.05, 0.55);
        if (!(t - (s.last ?? -1) < 0.05)) {
          s.last = t; const x = s.mon.ctx, w = s.mon.cv.width, h = s.mon.cv.height;
          darkFrame(s.mon);
          const bx = Math.abs(((t * 70) % (2 * (w - 150))) - (w - 150)), by = Math.abs(((t * 45) % (2 * (h - 50))) - (h - 50));
          x.fillStyle = `hsl(${(t * 40) % 360},70%,65%)`; x.font = `600 34px ${MONO}`; x.fillText('zzz…', bx + 12, by + 38);
          s.mon.tex.needsUpdate = true;
        }
      },
    },

    // 의자 뒤로 젖혀 커피: 다리는 책상 위, 모니터에 학습 곡선
    lean: {
      cam: [[-3.3, 2.0, 3.6], [0.1, 0.72, 0.2]], still: 2,
      build(g) {
        const s = { DT: 0.5 };
        desk(g, 0.1, 0.5, 1.3, 0.6, s.DT);
        s.chair = chair(g, 0, -0.3, 0.3, 0.45);
        s.mon = monitor(g, 0.4, s.DT, 0.68, -0.5);
        plant(g, 0.62, s.DT, 0.45, 0.8);
        for (let i = 0; i < 3; i++) box(g, -0.35, s.DT + 0.01 + i * 0.03, 0.65, 0.24, 0.028, 0.18, [0x2c5f8a, 0x8a2d3b, 0xd9b45a][i]).rotation.y = 0.1 * i;
        s.cup = mug(g, 0, 0, 0);
        return s;
      },
      pose(t, s, R) {
        seat(R, 0.38, -0.3);
        R.torso.rotation.x = -0.42;
        R.legs.forEach((l, i) => { l.rotation.x = -2.15; l.rotation.z = i ? -0.04 : 0.12; R.knees[i].rotation.x = 0.6; });
        R.legs[0].rotation.y = 0.1;
        R.root.updateMatrixWorld(true);
        // 커피: 6초마다 한 모금
        const p = t % 6, sip = p > 3 && p < 5 ? Math.sin(((p - 3) / 2) * Math.PI) : 0, ss = smooth(sip * 1.6);
        const rest = toWorld(R.torso, -0.16, 0.24, 0.32), lip = toWorld(R.head, -0.04, 0.03, 0.42);
        reach(R, 0, rest.lerp(lip, ss), V(-1, -0.6, 0));
        reach(R, 1, toWorld(R.torso, 0.4, 0.4, -0.05), V(1, 0.3, -0.3)); // 왼팔은 의자 뒤로 걸치기
        R.hands[0].getWorldPosition(_a); s.cup.position.copy(_a).add(V(0.0, -0.07, 0.02)); s.cup.rotation.set(0, Math.PI, ss * 0.5);
        R.head.rotation.set(0.32 - 0.2 * ss, 0.12, 0.05 * Math.sin(t * 0.5));
        s.face = { lid: sip > 0.3 ? 0.01 : 0.03 };
        if (!(t - (s.last ?? -1) < 0.08)) {
          s.last = t; const x = s.mon.ctx, w = s.mon.cv.width, h = s.mon.cv.height;
          darkFrame(s.mon, 'train.ipynb · loss');
          x.strokeStyle = 'rgba(120,220,250,0.35)'; x.lineWidth = 1; x.beginPath(); x.moveTo(30, 40); x.lineTo(30, h - 25); x.lineTo(w - 15, h - 25); x.stroke();
          const n = Math.floor((t * 22) % 140) + 10; x.strokeStyle = '#5cc8e8'; x.lineWidth = 3; x.beginPath();
          for (let i = 0; i < n; i++) x.lineTo(30 + (i / 150) * (w - 50), 50 + (h - 85) * (1 - Math.exp(-i / 28)) + 4 * Math.sin(i * 1.7));
          x.stroke();
          x.fillStyle = 'rgba(255,214,140,0.95)'; x.font = `500 18px ${MONO}`; x.fillText(`epoch ${Math.floor(n / 15)}  r2=${(0.5 + n / 450).toFixed(2)}`, 40, 60);
          s.mon.tex.needsUpdate = true;
        }
      },
    },

    // 화이트보드에 평면도와 산점도를 그리는 중
    board: {
      cam: [[-1.9, 1.8, 5.3], [0.4, 1.05, 0.2]], still: 5,
      build(g) {
        const s = {}, b = new THREE.Group(); b.position.set(0.85, 0, 0.25); b.rotation.y = -Math.PI / 2 + 0.25; g.add(b);
        for (const sx of [-0.62, 0.62]) { box(b, sx, 0.62, 0, 0.05, 1.24, 0.05, C.metal); box(b, sx, 0.02, 0, 0.08, 0.04, 0.4, C.deskLeg); }
        box(b, 0, 1.22, -0.02, 1.3, 0.78, 0.03, 0xd0d4da);
        box(b, 0, 0.85, 0.04, 1.2, 0.03, 0.08, 0xd0d4da);
        box(b, -0.3, 0.88, 0.05, 0.1, 0.025, 0.025, 0xc0392b); box(b, -0.15, 0.88, 0.05, 0.12, 0.04, 0.04, 0x3a3f4a);
        s.P = mkPanel(b, 1.22, 0.7, 610, 350); s.P.m.position.set(0, 1.22, 0.0); s.b = b;
        // 선 그리기 경로(보드 좌표 0–1)
        const S = [], rect = (x0, y0, x1, y1) => S.push([[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]);
        rect(0.06, 0.12, 0.5, 0.88); S.push([[0.06, 0.5], [0.3, 0.5]]); S.push([[0.3, 0.12], [0.3, 0.62]]); S.push([[0.38, 0.5], [0.5, 0.5]]);
        S.push([[0.3, 0.72], [0.36, 0.66], [0.38, 0.62]]);
        S.push([[0.58, 0.12], [0.58, 0.88], [0.95, 0.88]]);
        const r = rnd(7); for (let i = 0; i < 9; i++) { const x = 0.62 + i * 0.035, y = 0.8 - i * 0.06 + (r() - 0.5) * 0.12; S.push([[x, y], [x + 0.008, y + 0.008]]); }
        S.push([[0.6, 0.84], [0.95, 0.3]]);
        s.strokes = S.map((pts) => { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return { pts, L: Math.max(L, 0.02) }; });
        s.total = s.strokes.reduce((a, b) => a + b.L + 0.08, 0);
        s.marker = new THREE.Group(); box(s.marker, 0, 0, 0.0, 0.03, 0.03, 0.14, 0x1f4f8a); box(s.marker, 0, 0, 0.08, 0.02, 0.02, 0.03, 0xf2f2ee);
        return s;
      },
      init(s, R) { R.hands[0].add(s.marker); s.marker.position.set(0, -0.04, 0.06); },
      pose(t, s, R) {
        R.root.rotation.y = 0.95;
        R.root.position.set(0.1, 0, 0.1);
        R.legs[0].rotation.x = 0.08; R.legs[1].rotation.x = -0.08;
        R.torso.rotation.set(0.05, 0.12, 0);
        R.root.updateMatrixWorld(true);
        // 그리기 진행도: 9초 동안 그리고 1초 쉬고 지운다
        const P = 10, p = t % P, draw = Math.min(1, p / 9) * s.total;
        let acc = 0, pen = [0.3, 0.5], lifted = true;
        const x = s.P.ctx, w = s.P.cv.width, h = s.P.cv.height;
        x.fillStyle = '#f7f8fa'; x.fillRect(0, 0, w, h);
        x.strokeStyle = '#1f4f8a'; x.lineWidth = 4; x.lineCap = x.lineJoin = 'round';
        for (const st of s.strokes) {
          if (acc > draw) break;
          let left = draw - acc; x.beginPath(); x.moveTo(st.pts[0][0] * w, st.pts[0][1] * h); pen = st.pts[0]; lifted = false;
          for (let i = 1; i < st.pts.length && left > 0; i++) {
            const [ax, ay] = st.pts[i - 1], [bx, by] = st.pts[i], seg = Math.hypot(bx - ax, by - ay), u = Math.min(1, left / seg);
            pen = [ax + (bx - ax) * u, ay + (by - ay) * u]; x.lineTo(pen[0] * w, pen[1] * h); left -= seg;
          }
          x.stroke(); acc += st.L + 0.08; if (left > 0) lifted = true;
        }
        x.fillStyle = '#c0392b'; x.font = `600 22px ${MONO}`; if (draw > s.total * 0.55) x.fillText('FAR vs. daylight', 0.62 * w, 0.08 * h + 12);
        s.P.tex.needsUpdate = true;
        if (p > 9) pen = [0.5, 0.6];
        const tgt = toWorld(s.b, (pen[0] - 0.5) * 1.22, 1.22 + (0.5 - pen[1]) * 0.7, (lifted ? 0.1 : 0.03) + 0.12);
        reach(R, 0, tgt, V(-0.3, -1, -0.6));
        reach(R, 1, toWorld(R.torso, 0.2, 0.12, 0.12), V(1, -0.2, 0)); // 왼손은 허리
        R.head.rotation.set(0.05, -0.25, 0);
        s.face = { lid: 0.03 };
      },
    },

    // 노트북 끼고 회의 가는 중: 제자리 걸음, 바닥이 흘러간다
    walk: {
      cam: [[-3.2, 1.9, 4.3], [0.0, 0.95, 0.1]], still: 0.4, floor: true,
      build(g) { const s = { lap: laptop(g), cup: mug(g, 0, 0, 0, 0xe9e2d0) }; s.lap.lid.rotation.x = -Math.PI / 2; return s; },
      pose(t, s, R) {
        const ph = t * 5.2; walkLegs(R, ph, 0.45); floorScroll(-(t * 0.75) % 3.5);
        R.torso.rotation.set(0.04, 0.05 * Math.sin(ph), 0);
        R.root.updateMatrixWorld(true);
        // 노트북: 왼쪽 옆구리에 끼운다
        const L = s.lap; L.position.copy(toWorld(R.torso, -0.49, 0.2, -0.13)); L.quaternion.copy(R.torso.getWorldQuaternion(_q)); L.rotateZ(Math.PI / 2 - 0.06);
        reach(R, 0, toWorld(R.torso, -0.47, 0.02, 0.12), V(-0.3, 0, -1));
        // 오른손 커피: 팔을 살짝 흔들며
        R.arms[1].rotation.set(-0.6 + 0.25 * Math.sin(ph), 0, 0.08); R.elbows[1].rotation.x = -1.0;
        R.root.updateMatrixWorld(true); R.hands[1].getWorldPosition(_a); s.cup.position.copy(_a).add(V(0, -0.08, 0.02)); s.cup.rotation.set(0, Math.PI, 0);
        R.head.rotation.set(-0.03, -0.2 + 0.1 * Math.sin(t * 0.5), 0.03 * Math.sin(ph));
        s.face = { lid: 0.03 };
      },
    },

    // 러닝머신 데스크에서 코딩
    treadmill: {
      cam: [[-3.2, 2.1, 4.5], [0.0, 1.05, 0.3]], still: 0.4,
      build(g) {
        const s = {};
        box(g, 0, 0.08, 0.05, 0.62, 0.12, 1.5, 0x2a2e36);
        s.belt = [];
        for (let i = 0; i < 10; i++) s.belt.push(box(g, 0, 0.142, 0, 0.5, 0.006, 0.07, 0x3a3f48, false));
        box(g, 0, 0.143, 0.05, 0.5, 0.004, 1.45, 0x1b1e24, false);
        for (const sx of [-0.3, 0.3]) { box(g, sx, 0.6, 0.72, 0.05, 1.0, 0.05, C.metal); box(g, sx, 0.98, 0.45, 0.04, 0.04, 0.55, C.metal); }
        box(g, 0, 1.0, 0.75, 0.75, 0.04, 0.42, C.deskTop); box(g, 0, 0.985, 0.55, 0.75, 0.03, 0.03, C.deskEdge);
        box(g, 0, 1.03, 0.92, 0.18, 0.04, 0.03, glow(0x7ee08a), false);
        s.lap = laptop(g); s.lap.position.set(0, 1.02, 0.72); s.lap.lid.rotation.x = -0.35;
        mug(g, -0.28, 1.02, 0.8);
        return s;
      },
      pose(t, s, R) {
        const ph = t * 3.6; walkLegs(R, ph, 0.32); R.root.position.y += 0.145; R.root.position.z = -0.05;
        s.belt.forEach((b, i) => (b.position.z = 0.75 - (((i * 0.15) + t * 0.5) % 1.5)));
        R.torso.rotation.set(0.06, 0.03 * Math.sin(ph), 0);
        R.root.updateMatrixWorld(true);
        const L = s.lap, tap = (i) => 0.012 * Math.max(0, Math.sin(t * 8 + i * Math.PI));
        reach(R, 0, toWorld(L, -0.08, 0.09 + tap(0), -0.04), V(-0.6, -1, -0.2));
        reach(R, 1, toWorld(L, 0.08, 0.09 + tap(1), -0.04), V(0.6, -1, -0.2));
        R.head.rotation.set(0.28, 0, 0.02 * Math.sin(ph));
        s.face = { lid: 0.03 };
        if (!(t - (s.last ?? -1) < 0.08)) { s.last = t; darkFrame(L.P, 'steps 8,412 · alris'); typeLines(L.P, CODE, t + 3, { x: 10, y0: 52, lh: 20, font: 13, rows: 6, speed: 1.2 }); }
      },
    },

    // 검토 보고서 더미 속에서 한 장씩 넘기는 중
    papers: {
      cam: [[-2.9, 2.4, 4.0], [0.05, 0.9, 0.3]], still: 1,
      build(g) {
        const s = { DT: 0.66 }, r = rnd(11);
        desk(g, 0, 0.55, 1.5, 0.66, s.DT);
        chair(g, 0, -0.25, 0.3);
        const stack = (x, y, z, n, rot = 0) => { for (let i = 0; i < n; i++) box(g, x + (r() - 0.5) * 0.03, y + 0.008 + i * 0.016, z + (r() - 0.5) * 0.03, 0.3, 0.014, 0.22, r() < 0.15 ? 0xe2dccb : r() < 0.1 ? 0xbcd3e8 : C.paper).rotation.y = rot + (r() - 0.5) * 0.12; };
        stack(-0.6, s.DT, 0.5, 22); stack(-0.55, s.DT, 0.8, 12, 0.3); stack(0.6, s.DT, 0.45, 26); stack(0.55, s.DT, 0.78, 16, -0.2);
        stack(-0.95, 0, 0.2, 20, 0.4); stack(-0.9, 0, 0.62, 11, 0.1); stack(0.95, 0, 0.0, 15, -0.3); stack(1.0, 0, 0.5, 24);
        for (let i = 0; i < 4; i++) box(g, -0.4 + r() * 0.9, 0.006, -0.55 + r() * 0.3, 0.3, 0.004, 0.22, C.paper, false).rotation.y = r() * 3;
        // 손에 든 보고서(펼친 두 쪽 + 넘어가는 한 장)
        s.rep = new THREE.Group(); g.add(s.rep);
        box(s.rep, -0.1, 0, 0, 0.2, 0.28, 0.01, C.paper); box(s.rep, 0.1, 0, 0, 0.2, 0.28, 0.01, C.paper);
        box(s.rep, 0, 0, -0.008, 0.42, 0.29, 0.008, 0x1f4f8a);
        for (let i = 0; i < 6; i++) for (const sx of [-1, 1]) box(s.rep, sx * 0.1, 0.09 - i * 0.035, 0.007, 0.15 - (i % 3) * 0.03, 0.008, 0.004, 0xa9b0bb, false);
        s.page = joint(s.rep, 0, 0, 0.01); box(s.page, 0.1, 0, 0, 0.2, 0.28, 0.006, 0xfbfaf6);
        mug(g, 0.22, s.DT, 0.85);
        return s;
      },
      pose(t, s, R) {
        seat(R, 0.38, -0.2);
        R.torso.rotation.x = 0.12 + 0.02 * Math.sin(t * 1.2);
        R.root.updateMatrixWorld(true);
        const p = t % 3.5, flip = smooth((p - 2.6) / 0.6);
        s.rep.position.copy(toWorld(R.torso, 0, 0.5, 0.45)); s.rep.quaternion.copy(R.torso.getWorldQuaternion(_q)); s.rep.rotateX(-0.75);
        s.page.rotation.y = -Math.PI * flip;
        s.rep.updateMatrixWorld(true);
        reach(R, 0, toWorld(s.rep, -0.21, -0.04, 0.02), V(-1, -0.6, 0));
        reach(R, 1, toWorld(s.rep, 0.21 - 0.2 * Math.sin(flip * Math.PI), -0.04 + 0.05 * Math.sin(flip * Math.PI), 0.03), V(1, -0.6, 0));
        R.head.rotation.set(0.38, 0.1 * Math.sin(t * 0.9) - 0.12 * (1 - flip) + 0.06, 0.05 * Math.sin(t * 0.45));
        s.face = { lid: p > 2.4 && p < 2.6 ? 0.008 : 0.025 };
      },
    },
  };

  // ── 장면 × 옷 고르기. 장면마다 어울리는 옷의 가중치를 높이되(1 이 기본) 다른 옷도 나올 수 있다.
  const FIT = {
    desk: { tee: 3, hoodie: 2, flannel: 1.5, shirt: 1.5 },
    golf: { polo: 8, knit: 1.5, suit: 0.6, pajamas: 0.3 },
    couch: { pajamas: 5, hoodie: 3, tee: 2, suit: 0.4 },
    nap: { pajamas: 2, cardigan: 2, shirt: 2, hoodie: 2, suit: 1.5 },
    lean: { cardigan: 2.5, knit: 2.5, shirt: 1.5 },
    board: { shirt: 3, suit: 2, flannel: 2 },
    walk: { suit: 3, shirt: 3, cardigan: 1.5 },
    treadmill: { hoodie: 3, polo: 2, tee: 2 },
    papers: { shirt: 2.5, suit: 2.5, cardigan: 2, knit: 1.5 },
  };
  const pickW = (w) => { let sum = 0; for (const k in w) sum += w[k]; let x = Math.random() * sum; for (const k in w) if ((x -= w[k]) < 0) return k; return Object.keys(w)[0]; };
  const one = (a) => (Array.isArray(a) ? a[Math.floor(Math.random() * a.length)] : a);
  const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
  function choose(pin = {}, avoid) {
    const sc = SCENES[pin.scene] ? pin.scene : pickW(Object.fromEntries(Object.keys(SCENES).filter((k) => k !== avoid).map((k) => [k, 1])));
    const lastO = store.get('avatar.outfit');
    const w = {}; for (const k in OUTFITS) w[k] = (FIT[sc][k] ?? (k === 'pajamas' ? 0.5 : 1)) * (k === lastO ? 0.4 : 1);
    const id = OUTFITS[pin.outfit] ? pin.outfit : pickW(w), d = OUTFITS[id];
    const o = { id, style: d.style, sleeve: d.sleeve, sole: d.sole, inner: one(d.inner), cuff: d.cuff, tie: one(d.tie) };
    if (d.style === 'pajama') { o.top = PJ; o.pants = PJ; o.cuff = 0x6f8fbf; }
    else if (d.style === 'flannel') { o.top = one(FLANNEL); o.pants = one(d.pants); }
    else { o.top = one(d.top); o.pants = d.pants === 'top' ? o.top : one(d.pants); }
    o.shoe = one(d.shoe); o.badge = sc !== 'couch' && sc !== 'golf' && Math.random() < (d.badge || 0);
    o.glove = sc === 'golf' && id === 'polo';
    // 모자: 골프는 대개 캡, 잠옷으로 눕거나 자면 가끔 수면 모자, 후디는 가끔 비니
    const hr = Math.random();
    o.hat = sc === 'golf' ? (hr < 0.75 ? 'cap' : 'none')
      : id === 'pajamas' && (sc === 'nap' || sc === 'couch') ? (hr < 0.4 ? 'nightcap' : 'none')
      : id === 'hoodie' ? (hr < 0.2 ? 'beanie' : 'none') : hr < 0.04 ? 'cap' : 'none';
    if (['cap', 'beanie', 'nightcap', 'none'].includes(pin.hat)) o.hat = pin.hat;
    o.hatColor = o.hat === 'nightcap' ? 0x6f8fbf : one(o.hat === 'beanie' ? [0x2f3238, 0x8a3b3b, 0xc8b89a] : [0xf5f5f2, 0x1f3f66, 0x2b2f38]);
    o.glasses = pin.glasses === '1' ? true : pin.glasses === '0' ? false : Math.random() < 0.3;
    return { scene: sc, outfit: o };
  }

  // ── 장면 싣기 + 복셀 전환: 블록이 위에서부터 줄어들어 사라지고(0.3초), 새 장면이 바닥부터 톡톡 솟는다(0.55초).
  // 옷만 바뀌면 사람 블록만, 장면이 바뀌면 소품까지. 카메라는 새 장면 프레이밍으로 보간. 연타하면 지금 크기에서 이어받는다.
  let world = null, R = null, cur = null, S = null, t0 = 0, parts = [], first = true;
  const clock = new THREE.Clock();
  const camFrom = [V(), V()], camTo = [V(), V()];
  const TR = { phase: 'idle', t: 0, pending: null, keep: false };
  const OUT = 0.3, IN = 0.55;
  const backOut = (u) => { const c = 1.7; u -= 1; return 1 + (c + 1) * u * u * u + c * u * u; };
  function load({ scene: sc, outfit }) {
    if (world) { scene.remove(world); }
    disposables.splice(0).forEach((d) => d.dispose());
    world = new THREE.Group(); scene.add(world);
    R = buildChar(outfit); world.add(R.root);
    cur = SCENES[sc]; S = cur.build(world, R) || {};
    if (!cur.floor) floorScroll(0);
    resetRig(R); if (cur.init) cur.init(S, R);
    camTo[0].set(...cur.cam[0]); camTo[1].set(...cur.cam[1]);
    if (first) { cam.position.copy(camTo[0]); controls.target.copy(camTo[1]); controls.update(); }
    camFrom[0].copy(cam.position); camFrom[1].copy(controls.target);
    // 전환용 블록 목록: 높이 순서(0 바닥 → 1 꼭대기)와 사람 여부
    world.updateMatrixWorld(true);
    const mine = new Set(); R.root.traverse((o) => mine.add(o));
    parts = []; let lo = Infinity, hi = -Infinity;
    world.traverse((o) => { if (!o.isMesh) return; const y = o.getWorldPosition(_a).y; lo = Math.min(lo, y); hi = Math.max(hi, y); parts.push({ m: o, s: o.scale.clone(), y, ch: mine.has(o), f: 1, j: Math.random() }); });
    for (const p of parts) p.k = (p.y - lo) / Math.max(0.01, hi - lo);
    first = false;
    t0 = clock.getElapsedTime();
    api.scene = sc; api.outfit = outfit.id;
    store.set('avatar.scene', sc); store.set('avatar.outfit', outfit.id);
    stage.dispatchEvent(new CustomEvent('avatarchange', { detail: { scene: sc, outfit: outfit.id } }));
  }
  const canvas = renderer.domElement;
  let fadeTimer = 0;
  function change(choice) {
    stage.dispatchEvent(new CustomEvent('avatarchanging'));
    if (reduce) { // 움직임 줄이기: 짧은 페이드만
      canvas.style.transition = 'opacity .18s'; canvas.style.opacity = '0'; TR.pending = choice;
      clearTimeout(fadeTimer); fadeTimer = setTimeout(() => { load(TR.pending); camFrom[0].copy(camTo[0]); camFrom[1].copy(camTo[1]); cam.position.copy(camTo[0]); controls.target.copy(camTo[1]); canvas.style.opacity = '1'; }, 180);
      return;
    }
    TR.pending = choice;
    if (TR.phase === 'out') return; // 이미 사라지는 중: 다음에 올 장면만 바꾼다
    for (const p of parts) p.from = p.f;
    TR.keep = choice.scene === api.scene; TR.phase = 'out'; TR.t = clock.getElapsedTime();
  }
  const api = {
    scenes: Object.keys(SCENES), outfits: Object.keys(OUTFITS),
    reroll() { change(choose({}, TR.pending && TR.phase === 'out' ? TR.pending.scene : api.scene)); },
    set(sc, of) { change(choose({ scene: sc || api.scene, outfit: of })); },
  };
  const fit = () => { const w = stage.clientWidth, h = stage.clientHeight; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); };
  new ResizeObserver(fit).observe(stage); fit();
  window.__avatarView = (pos) => { cam.position.set(...(Array.isArray(pos) ? pos : cur.cam[0])); controls.update(); };

  const fixedT = arg('t') != null ? parseFloat(arg('t')) : null;
  load(choose({ scene: arg('scene'), outfit: arg('outfit'), hat: arg('hat'), glasses: arg('glasses') }, store.get('avatar.scene')));
  if (reduce) { canvas.style.opacity = '0'; requestAnimationFrame(() => { canvas.style.transition = 'opacity .25s'; canvas.style.opacity = '1'; }); }
  else { TR.phase = 'in'; TR.keep = false; TR.t = clock.getElapsedTime(); }

  renderer.setAnimationLoop(() => {
    const now = clock.getElapsedTime();
    const t = fixedT ?? (reduce ? cur.still : now - t0);
    for (const p of parts) p.m.scale.copy(p.s);
    resetRig(R);
    S.face = null; S.z = null;
    cur.pose(t, S, R);
    const f = S.face || { lid: 0.03 };
    R.eyes.forEach((e) => (e.scale.y = f.lid));
    const yawn = f.yawn || 0; R.mouth.scale.set(0.05 - 0.01 * yawn, 0.018 + 0.06 * yawn, 0.01);
    zzz(TR.phase === 'idle' ? S.z : null, S.zBase || V());
    if (TR.phase !== 'idle') {
      let e = now - TR.t;
      if (TR.phase === 'out') {
        for (const p of parts) p.f = TR.keep && !p.ch ? 1 : p.from * (1 - smooth((e - (1 - p.k) * 0.12 - p.j * 0.03) / 0.16));
        if (e >= OUT) { load(TR.pending); TR.phase = 'in'; TR.t = now; e = 0; }
      }
      if (TR.phase === 'in') {
        for (const p of parts) { const u = clamp((e - p.k * 0.25 - p.j * 0.06) / 0.22, 0, 1); p.f = TR.keep && !p.ch ? 1 : u <= 0 ? 0 : backOut(u); }
        const u = smooth(e / IN);
        cam.position.lerpVectors(camFrom[0], camTo[0], u); controls.target.lerpVectors(camFrom[1], camTo[1], u);
        if (e >= IN) { TR.phase = 'idle'; for (const p of parts) p.f = 1; }
      }
      for (const p of parts) { p.m.visible = p.f > 0.002; p.m.scale.multiplyScalar(Math.max(p.f, 0.002)); }
    }
    controls.update(); renderer.render(scene, cam);
  });
  return api;
};
