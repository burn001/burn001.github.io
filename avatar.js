// Voxel avatar — same rig as the Agent4D voxel office character (github.com/burn001/agent4d).
window.mountAvatar = function (stage) {

  // Agent4D character.js 와 같은 골격 치수(단위 m)
  const HIP = 0.62, TORSO = 0.66, SHOULDER = 1.2, NECK = 1.3, DESK_TOP = 0.92;
  const C = {
    skin: 0xe8c3a3, hair: 0x1c1815, brow: 0x241a15, eye: 0x1d1714, stubble: 0xc6a189,
    tee: 0x34506b, teeHem: 0x2b4459, pants: 0x2b2f38, shoe: 0x17191e,
    watch: 0xb9bec7, watchFace: 0x1f2a3a, badge: 0x5cc8e8, lanyard: 0x17191e,
    deskTop: 0xc9a77c, deskEdge: 0x9c7a55, deskLeg: 0x3a3f4a, mug: 0xf2efe9, coffee: 0x4a2f22,
    pot: 0xb86b4b, plant: 0x4f8a5b, floor: 0x9aa3b2, holo: 0x5cc8e8,
  };

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  stage.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(30, 1, 0.05, 100);
  const controls = new THREE.OrbitControls(cam, renderer.domElement);
  controls.target.set(0.2, 1.12, 0.25); controls.enableDamping = true; controls.enableZoom = false; controls.enablePan = false;
  controls.maxPolarAngle = Math.PI * 0.49; controls.autoRotateSpeed = 0.8;

  scene.add(new THREE.HemisphereLight(0xffffff, 0x707684, 0.8));
  const key = new THREE.DirectionalLight(0xfff3e6, 0.8);
  key.position.set(3, 6, 4); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -2, near: 0.5, far: 20 });
  key.shadow.bias = -0.0006; scene.add(key);
  const fill = new THREE.DirectionalLight(0xbfd6ff, 0.3); fill.position.set(-4, 3, -3); scene.add(fill);

  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mats = new Map();
  const mat = (c) => mats.get(c) || mats.set(c, new THREE.MeshLambertMaterial({ color: c })).get(c);
  const box = (parent, x, y, z, sx, sy, sz, c, shadow = true) => {
    const m = new THREE.Mesh(geo, mat(c)); m.position.set(x, y, z); m.scale.set(sx, sy, sz);
    m.castShadow = shadow; m.receiveShadow = true; parent.add(m); return m;
  };
  // 관절: 회전하는 Group, 그 아래 오프셋 상자
  const joint = (parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.order = 'YXZ'; parent.add(g); return g; };

  // ── 바닥(사무실 타일 한 칸)
  for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) {
    const c = (i + j) & 1 ? 0xb4bcc8 : 0xa7b0bd;
    const t = box(scene, i * 0.5, -0.01, j * 0.5 + 0.2, 0.49, 0.02, 0.49, c, false);
    t.material = t.material.clone(); t.material.transparent = true;
    t.material.opacity = Math.max(0, 1 - Math.hypot(i, j) / 4.2);
  }

  // ── 스탠딩 데스크(캐릭터 앞, +z)
  const DZ = 0.55, W = 1.3, D = 0.7;
  box(scene, 0, DESK_TOP - 0.03, DZ, W, 0.06, D, C.deskTop);
  box(scene, 0, DESK_TOP - 0.045, DZ - D / 2 + 0.02, W, 0.03, 0.04, C.deskEdge);
  for (const lx of [-W / 2 + 0.1, W / 2 - 0.1]) {
    box(scene, lx, (DESK_TOP - 0.06) / 2, DZ, 0.08, DESK_TOP - 0.06, 0.08, C.deskLeg);
    box(scene, lx, 0.02, DZ, 0.1, 0.04, D - 0.08, C.deskLeg);
  }
  // 발광대(홀로그램 받침)
  const emitter = box(scene, 0, DESK_TOP + 0.008, DZ + D / 2 - 0.14, W * 0.55, 0.016, 0.05, C.holo, false);
  emitter.material = new THREE.MeshBasicMaterial({ color: C.holo });
  // 키보드 판(빛)
  const kb = box(scene, 0, DESK_TOP + 0.006, DZ - 0.12, 0.5, 0.008, 0.16, C.holo, false);
  kb.material = new THREE.MeshBasicMaterial({ color: C.holo, transparent: true, opacity: 0.35 });
  // 커피 잔·화분
  box(scene, -0.47, DESK_TOP + 0.065, DZ - 0.05, 0.1, 0.13, 0.1, C.mug);
  box(scene, -0.47, DESK_TOP + 0.126, DZ - 0.05, 0.075, 0.01, 0.075, C.coffee, false);
  box(scene, -0.535, DESK_TOP + 0.075, DZ - 0.05, 0.03, 0.06, 0.03, C.mug);
  box(scene, 0.52, DESK_TOP + 0.07, DZ + 0.2, 0.13, 0.14, 0.13, C.pot);
  box(scene, 0.52, DESK_TOP + 0.22, DZ + 0.2, 0.19, 0.17, 0.19, C.plant);
  box(scene, 0.49, DESK_TOP + 0.34, DZ + 0.18, 0.1, 0.1, 0.1, C.plant);

  // ── 캐릭터(원점, +z 를 봄 = 데스크 쪽)
  const body = new THREE.Group(); scene.add(body);
  // 다리·신발
  const legs = [];
  for (const sx of [-0.13, 0.13]) {
    const j = joint(body, sx, HIP, 0);
    box(j, 0, -0.3, 0, 0.2, 0.6, 0.22, C.pants);
    box(j, 0, -0.6, 0.05, 0.22, 0.08, 0.32, C.shoe);
    legs.push(j);
  }
  // 몸통: 반팔 티셔츠(둥근 목 + 밑단)
  const torso = joint(body, 0, HIP, 0);
  box(torso, 0, TORSO / 2, 0, 0.54, TORSO, 0.3, C.tee);
  box(torso, 0, 0.03, 0, 0.55, 0.06, 0.31, C.teeHem);
  box(torso, 0, TORSO - 0.015, 0.1, 0.16, 0.03, 0.12, C.skin, false);
  // 사원증
  box(torso, 0, TORSO - 0.06, 0.165, 0.035, 0.2, 0.01, C.lanyard, false);
  const badge = box(torso, 0.09, TORSO - 0.3, 0.18, 0.11, 0.14, 0.015, C.badge, false);
  badge.material = new THREE.MeshBasicMaterial({ color: C.badge });

  // 팔·손 (어깨 관절)
  const arms = [];
  for (const [sx, side] of [[-0.36, 'L'], [0.36, 'R']]) {
    const j = joint(body, sx, SHOULDER, 0);
    box(j, 0, -0.12, 0, 0.18, 0.26, 0.18, C.tee);   // 반팔 소매
    box(j, 0, -0.38, 0, 0.14, 0.3, 0.14, C.skin);   // 팔뚝
    box(j, 0, -0.58, 0, 0.13, 0.12, 0.13, C.skin);
    if (side === 'L') { box(j, 0, -0.47, 0, 0.17, 0.04, 0.17, C.watch); box(j, 0, -0.47, 0.086, 0.06, 0.035, 0.008, C.watchFace, false); }
    arms.push(j);
  }

  // 머리
  const head = joint(body, 0, NECK, 0);
  box(head, 0, 0.22, 0, 0.44, 0.44, 0.44, C.skin);
  // 머리카락: 정수리 + 뒷머리 + 옆머리 + 위로 솟은 앞머리(보는 쪽 오른편으로 넘김)
  box(head, 0, 0.46, -0.03, 0.48, 0.1, 0.48, C.hair);
  box(head, 0, 0.3, -0.2, 0.48, 0.24, 0.08, C.hair);
  for (const s of [-1, 1]) box(head, s * 0.23, 0.33, -0.06, 0.04, 0.2, 0.32, C.hair);
  box(head, 0.04, 0.52, 0.06, 0.4, 0.07, 0.3, C.hair);            // 볼륨
  box(head, 0.0, 0.42, 0.205, 0.48, 0.1, 0.06, C.hair);           // 앞머리
  box(head, -0.17, 0.39, 0.215, 0.1, 0.06, 0.04, C.hair);          // 가르마 쪽 짧은 머리
  box(head, -0.09, 0.53, 0.05, 0.02, 0.012, 0.36, 0x3a322c, false); // 가르마 선
  // 얼굴: 눈·입만 — 큰 눈(빛 점) + 웃는 입 + 볼터치
  // 졸린 눈: 반쯤 감긴 눈(아래로 처진 가는 선) + 작은 입(하품 때 동그렇게)
  const eyes = [];
  for (const s of [-1, 1]) {
    eyes.push(box(head, s * 0.1, 0.205, 0.222, 0.08, 0.03, 0.01, C.eye, false));
    box(head, s * 0.155, 0.135, 0.222, 0.07, 0.035, 0.006, 0xf0a3a0, false);
  }
  const mouth = box(head, 0, 0.11, 0.222, 0.05, 0.018, 0.01, 0x8a5a50, false);
  // Zzz
  const zTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d');
    x.font = '700 52px "IBM Plex Mono", Consolas, monospace'; x.fillStyle = '#9fdcf2'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('z', 32, 34);
    const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; return t; })();
  const zs = [0, 1, 2].map(() => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: zTex, transparent: true, depthWrite: false })); scene.add(s); return s; });
  // 이등신: 머리를 크게
  head.scale.setScalar(1.45);

  // ── 홀로그램 모니터(데스크 발광대 위, 카메라를 향하는 판) + 옆 작은 창
  const LINES = [
    ['$ ', 'node agent4d.mjs start'],
    ['', '  ✓ server :7420 · viewer ready'],
    ['$ ', 'git commit -m "voxel avatar"'],
    ['', '  [main 3ae36b3] 1 file changed'],
    ['$ ', 'git push origin main'],
    ['', '  → burn001/agent4d'],
    ['$ ', 'npm test'],
    ['', '  ✓ 908 passed · 0 failed'],
    ['$ ', 'node agent4d.mjs job add --log run.log'],
    ['', '  job 3f2a · 12/40 · ETA 8m'],
  ];
  const mkPanel = (w, h, pxW, pxH) => {
    const cv = document.createElement('canvas'); cv.width = pxW; cv.height = pxH;
    const tex = new THREE.CanvasTexture(cv); tex.encoding = THREE.sRGBEncoding;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    scene.add(m); return { m, cv, ctx: cv.getContext('2d'), tex };
  };
  const mon = mkPanel(0.95, 0.55, 760, 440);
  mon.m.position.set(0.42, DESK_TOP + 0.5, DZ + D / 2 - 0.14);
  const side = mkPanel(0.34, 0.24, 272, 192);
  side.m.position.set(1.02, DESK_TOP + 0.78, DZ + D / 2 - 0.2);
  const frame = (P, title) => {
    const { ctx, cv } = P, w = cv.width, h = cv.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(40,150,190,0.22)'; ctx.strokeStyle = 'rgba(120,220,250,0.9)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(4, 4, w - 8, h - 8, 18) : ctx.rect(4, 4, w - 8, h - 8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(150,230,255,0.95)'; ctx.font = '500 22px "IBM Plex Mono", Consolas, monospace';
    ctx.fillText(title, 22, 36);
    ctx.fillStyle = 'rgba(120,220,250,0.35)'; ctx.fillRect(18, 48, w - 36, 2);
  };
  const drawMon = (t) => {
    frame(mon, 'Bash · agent4d');
    const ctx = mon.ctx, rows = 9, shown = Math.floor(t * 1.4);
    ctx.font = '400 26px "IBM Plex Mono", Consolas, monospace';
    for (let r = 0; r < rows; r++) {
      const idx = shown - rows + 1 + r; if (idx < 0) continue;
      const [p, s] = LINES[idx % LINES.length];
      const last = r === rows - 1, n = last ? Math.floor(((t * 1.4) % 1) * s.length * 1.6) : s.length;
      ctx.fillStyle = p ? 'rgba(255,214,140,0.95)' : 'rgba(170,235,255,0.85)';
      ctx.fillText(p + s.slice(0, n) + (last && Math.floor(t * 3) % 2 ? '▌' : ''), 22, 88 + r * 39);
    }
    mon.tex.needsUpdate = true;
  };
  const drawSide = (t) => {
    frame(side, 'Read');
    const ctx = side.ctx;
    ctx.font = '400 20px "IBM Plex Mono", Consolas, monospace'; ctx.fillStyle = 'rgba(170,235,255,0.85)';
    ['CONTRACT.md', '§109 job add', '§110 Planet jobs'].forEach((s, i) => ctx.fillText(s, 22, 84 + i * 32));
    const k = (t * 0.25) % 1;
    ctx.fillStyle = 'rgba(120,220,250,0.3)'; ctx.fillRect(22, 168, 228, 8);
    ctx.fillStyle = 'rgba(150,230,255,0.95)'; ctx.fillRect(22, 168, 228 * k, 8);
    side.tex.needsUpdate = true;
  };
  // 손끝 → 모니터 아래 끝 빛줄기
  const beamGeo = new THREE.BufferGeometry(); beamGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(12), 3));
  const beams = new THREE.LineSegments(beamGeo, new THREE.LineBasicMaterial({ color: C.holo, transparent: true, opacity: 0.55 }));
  scene.add(beams);

  // ── 시점
  const views = { '34': [-2.9, 2.1, 4.3], front: [0, 1.7, 5.4], side: [5.4, 1.6, 0.3], back: [-1.8, 2.2, -4.8] };
  const setView = (k) => { cam.position.set(...views[k]); controls.update(); };
  setView('34');
  window.__avatarView = setView;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fit = () => { const w = stage.clientWidth, h = stage.clientHeight; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); };
  new ResizeObserver(fit).observe(stage); fit();

  const hand = new THREE.Vector3(), clock = new THREE.Clock();
  let lastDraw = -1;
  renderer.setAnimationLoop(() => {
    const t = reduce ? 4 : clock.getElapsedTime();
    // 자세: Agent4D pose('shell') — 두 손을 번갈아 두드림, 가끔 오른손으로 옆 창 넘기기
    // 졸음 주기 8초: 느린 타자(0–4.8) → 꼬박(4.8–7.4, 고개가 천천히 떨어짐) → 화들짝(7.4–8)
    const p = t % 8, cyc = Math.floor(t / 8);
    const doze = p < 4.8 ? 0 : p < 7.4 ? (p - 4.8) / 2.6 : 0;
    const jolt = p >= 7.4 ? 1 - (p - 7.4) / 0.6 : 0;
    const yawn = cyc % 3 === 1 && p > 1 && p < 3 ? Math.sin(((p - 1) / 2) * Math.PI) : 0;
    const ease = doze * doze * (3 - 2 * doze);
    const [aL, aR] = arms;
    const tap = 0.07 * (1 - ease);
    aL.rotation.set(-1.25 + 0.3 * ease + tap * Math.sin(t * 7), 0, 0.22);
    if (yawn > 0.2) aR.rotation.set(-1.25 - 1.0 * yawn, 0, -0.45 * yawn); // 하품: 입 가리기
    else aR.rotation.set(-1.25 + 0.3 * ease + tap * Math.sin(t * 7 + Math.PI), 0, -0.2);
    // 책상 충돌: 손 상자 아래 모서리가 상판보다 낮으면 팔을 앞으로 더 들어 상판 위에 얹는다
    for (const a of arms) {
      for (let i = 0; i < 24; i++) {
        a.updateMatrixWorld(true);
        let low = Infinity;
        for (const cx of [-0.065, 0.065]) for (const cz of [-0.065, 0.065]) low = Math.min(low, hand.set(cx, -0.645, cz).applyMatrix4(a.matrixWorld).y);
        const deskZ = hand.set(0, -0.6, 0).applyMatrix4(a.matrixWorld).z;
        if (low >= DESK_TOP + 0.003 || deskZ < DZ - D / 2) break;
        a.rotation.x -= 0.02;
      }
    }
    head.rotation.set(0.12 + 0.42 * ease - 0.25 * jolt - 0.2 * yawn, 0.03 * Math.sin(t * 0.3), 0.08 * Math.sin(t * 0.7) + 0.1 * ease);
    head.position.y = NECK + 0.015 * jolt;
    const lid = jolt > 0 ? 0.07 : yawn > 0.3 ? 0.008 : 0.03 * (1 - 0.75 * ease);
    eyes.forEach((e) => (e.scale.y = lid));
    mouth.scale.set(0.05 - 0.01 * yawn, 0.018 + 0.06 * yawn, 0.01);
    zs.forEach((s, i) => {
      const u = ((p - 4.6) / 3 - i * 0.22);
      const on = u > 0 && u < 1 && p < 7.4;
      s.visible = on; if (!on) return;
      s.position.set(0.25 + 0.12 * u + 0.04 * Math.sin(u * 9), NECK + 0.85 + 0.45 * u, 0.1);
      s.scale.setScalar(0.09 + 0.08 * u + i * 0.02); s.material.opacity = Math.sin(u * Math.PI);
    });
    torso.scale.y = 1 + 0.015 * Math.sin(t * 1.6);
    // 빛줄기
    const pos = beamGeo.attributes.position.array, mz = mon.m.position.z, my = mon.m.position.y - 0.275;
    arms.forEach((a, i) => {
      a.updateMatrixWorld(); hand.set(0, -0.6, 0).applyMatrix4(a.matrixWorld);
      pos.set([hand.x, hand.y, hand.z, hand.x * 0.6, my, mz], i * 6);
    });
    beamGeo.attributes.position.needsUpdate = true;
    beams.material.opacity = 0.35 + 0.25 * Math.sin(t * 9);
    // 홀로그램은 카메라를 향한다(Agent4D 와 같은 빌보드)
    mon.m.quaternion.copy(cam.quaternion); side.m.quaternion.copy(cam.quaternion);
    if (t - lastDraw > 0.06) { drawMon(t); drawSide(t); lastDraw = t; }
    controls.update(); renderer.render(scene, cam);
  });
};
