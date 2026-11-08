/* =========================================================
   OUR CUTE LOVE STORY  –  script.js
   1) Quản lý chuyển trang        4) Máy gõ chữ cho lá thư
   2) Hạt trái tim bay (nền)      5) Vòng ảnh xoay 3D
   3) Cây trái tim mọc lên        6) Trang cuối
   ========================================================= */
(() => {
  'use strict';

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const getDPR = () => Math.min(window.devicePixelRatio || 1, 2);

  /* Random có seed → cây luôn có hình dáng đẹp như nhau mỗi lần mở */
  function mulberry32(a) {
    return () => {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- Hình trái tim dùng chung ---------- */
  const HEART_D = 'M50 88C50 88 4 56 4 28C4 13 15 3 28 3C38 3 46 8 50 17C54 8 62 3 72 3C85 3 96 13 96 28C96 56 50 88 50 88Z';
  const HEART_PATH = new Path2D(HEART_D);

  function mix(hex, to, t) {
    const n = parseInt(hex.slice(1), 16);
    const m = parseInt(to.slice(1), 16);
    const c = (s) => Math.round(lerp((n >> s) & 255, (m >> s) & 255, t));
    return `rgb(${c(16)},${c(8)},${c(0)})`;
  }

  function makeHeartSprite(color, px = 64) {
    const c = document.createElement('canvas');
    c.width = px; c.height = Math.round(px * 0.9);
    const g = c.getContext('2d');
    g.scale(px / 100, px / 100);
    const grad = g.createLinearGradient(15, 0, 85, 90);
    grad.addColorStop(0, mix(color, '#ffffff', 0.38));
    grad.addColorStop(1, color);
    g.fillStyle = grad;
    g.fill(HEART_PATH);
    g.globalAlpha = 0.38; g.fillStyle = '#fff';
    g.beginPath(); g.ellipse(29, 22, 11, 6, -0.55, 0, Math.PI * 2); g.fill();
    return c;
  }

  const PINKS = ['#ff7fa9', '#ff93b6', '#ffa9c3', '#ffbdd1', '#ffcfdd', '#f48fb1', '#ec6a95', '#ffb0c8'];
  const WARM  = ['#ffcdb5', '#ffc2ab'];
  const SPRITES = [...PINKS, ...WARM].map((c) => makeHeartSprite(c));

  /* =======================================================
     2) FX – hạt trái tim bay nhẹ + nổ tim khi bấm
     ======================================================= */
  const fx = (() => {
    const cv = $('#fx');
    const ctx = cv.getContext('2d');
    let W = 0, H = 0, D = 1;
    let mode = 'welcome';           // welcome | calm | final
    let parts = [];
    let last = performance.now();

    const MODES = {
      welcome: { count: 16, dir: -1, sparkles: 7 },
      calm:    { count: 8,  dir: -1, sparkles: 3 },
      final:   { count: 46, dir:  1, sparkles: 6 },
    };

    function resize() {
      D = getDPR();
      W = window.innerWidth; H = window.innerHeight;
      cv.width = W * D; cv.height = H * D;
    }

    function spawn(initial) {
      const m = MODES[mode];
      const isSparkle = Math.random() < m.sparkles / (m.count + m.sparkles);
      const size = isSparkle ? 4 + Math.random() * 5 : 8 + Math.random() * 14;
      const fall = m.dir > 0;
      const p = {
        sparkle: isSparkle,
        x: Math.random() * W,
        y: initial ? Math.random() * H : (fall ? -30 : H + 30),
        vy: (fall ? 22 + Math.random() * 38 : -(10 + Math.random() * 22)),
        size,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.9,
        ph: Math.random() * 6.28,
        sw: 8 + Math.random() * 22,
        alpha: isSparkle ? 0.5 + Math.random() * 0.4 : 0.28 + Math.random() * 0.4,
        sprite: SPRITES[(Math.random() * SPRITES.length) | 0],
        burst: false,
      };
      p.bx = p.x;
      return p;
    }

    function burst(x, y, n = 16) {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
        const sp = 90 + Math.random() * 190;
        parts.push({
          burst: true, sparkle: false, x, y,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60,
          size: 10 + Math.random() * 16, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 5,
          alpha: 0.95, life: 0, max: 1.1 + Math.random() * 0.6,
          sprite: SPRITES[(Math.random() * SPRITES.length) | 0],
        });
      }
    }

    function setMode(m) {
      mode = m;
      parts = parts.filter((p) => p.burst);     // làm mới hạt nền theo chế độ
      const cfg = MODES[m];
      for (let i = 0; i < cfg.count + cfg.sparkles; i++) parts.push(spawn(true));
    }

    function drawSparkle(p) {
      const s = p.size;
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(p.rot * 0.2);
      ctx.globalAlpha = p.alpha * (0.6 + 0.4 * Math.sin(p.ph));
      ctx.strokeStyle = '#ff8fb4'; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-s / 2, -s / 2); ctx.lineTo(s / 2, s / 2);
      ctx.moveTo(s / 2, -s / 2);  ctx.lineTo(-s / 2, s / 2);
      ctx.stroke();
      ctx.restore();
    }

    function frame(now) {
      requestAnimationFrame(frame);
      if (document.hidden) { last = now; return; }
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ctx.setTransform(D, 0, 0, D, 0, 0);
      ctx.clearRect(0, 0, W, H);

      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.rot += p.vr * dt;
        if (p.burst) {
          p.life += dt;
          p.vy += 360 * dt; p.vx *= 0.985;
          p.x += p.vx * dt; p.y += p.vy * dt;
          const k = p.life / p.max;
          if (k >= 1) { parts.splice(i, 1); continue; }
          ctx.globalAlpha = p.alpha * (1 - k * k);
          ctx.setTransform(Math.cos(p.rot) * D, Math.sin(p.rot) * D, -Math.sin(p.rot) * D, Math.cos(p.rot) * D, p.x * D, p.y * D);
          const sz = p.size * (0.6 + 0.4 * Math.min(1, p.life * 5));
          ctx.drawImage(p.sprite, -sz / 2, -sz * 0.45, sz, sz * 0.9);
          ctx.setTransform(D, 0, 0, D, 0, 0);
          continue;
        }
        p.ph += dt * 1.4;
        p.y += p.vy * dt;
        p.x = p.bx + Math.sin(p.ph) * p.sw;
        if (p.vy < 0 && p.y < -40) { parts[i] = spawn(false); continue; }
        if (p.vy > 0 && p.y > H + 40) { parts[i] = spawn(false); continue; }
        if (p.sparkle) { drawSparkle(p); continue; }
        ctx.globalAlpha = p.alpha;
        ctx.setTransform(Math.cos(p.rot) * D, Math.sin(p.rot) * D, -Math.sin(p.rot) * D, Math.cos(p.rot) * D, p.x * D, p.y * D);
        ctx.drawImage(p.sprite, -p.size / 2, -p.size * 0.45, p.size, p.size * 0.9);
        ctx.setTransform(D, 0, 0, D, 0, 0);
      }
      ctx.globalAlpha = 1;
    }

    resize();
    setMode('welcome');
    requestAnimationFrame(frame);
    window.addEventListener('resize', resize);
    return { setMode, burst };
  })();

  /* =======================================================
     3) CÂY TRÁI TIM – thân mọc → cành toả ra → lá tim nở
     ======================================================= */
  const tree = (() => {
    const scene = $('#scene-tree');
    const cv = $('#treeCanvas');
    const ctx = cv.getContext('2d');
    const bubbles = $$('.bubble', scene);
    const navBtn = $('.nav-heart', scene);

    /* Không gian thiết kế: gốc (0,0) ở mặt đất giữa cây, y âm = đi lên */
    const HEART_W = 1000, HEART_TOP = -1180, HEART_BOT = -290;
    const HEART_H = HEART_BOT - HEART_TOP;      // 890
    const CENTER = { x: 0, y: (HEART_TOP + HEART_BOT) / 2 + 40 };
    const TRUNK = '#92606a';
    const SPEED = 640;            // tốc độ mọc của cành (đơn vị/giây)
    const T_START = 0.75;         // chờ ảnh polaroid hiện ra rồi cây mới mọc

    let W = 0, H = 0, D = 1, s = 1, ox = 0, oy = 0;
    let segs = [], leaves = [], poly = [];
    let growEnd = 0, doneAt = 0;
    let startTime = 0, running = false, raf = 0, last = 0;
    let cache = null, cacheOK = false;
    let petals = [], nextPetal = 0, revealed = false;
    const rng = mulberry32(20241108);

    /* --- đường viền trái tim (công thức chuẩn) → polygon trong không gian thiết kế --- */
    function heartPoint(t) {
      const x = 16 * Math.pow(Math.sin(t), 3);
      const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
      return { x: (x / 32) * HEART_W, y: HEART_BOT - ((y + 17) / 29) * HEART_H };
    }
    function buildPoly() {
      poly = [];
      for (let i = 0; i < 360; i++) poly.push(heartPoint((i / 360) * Math.PI * 2));
    }
    function inside(x, y) {
      let c = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const a = poly[i], b = poly[j];
        if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) c = !c;
      }
      return c;
    }
    function randomInside(shrink = 1) {
      for (let k = 0; k < 200; k++) {
        const x = (rng() - 0.5) * HEART_W * 1.02;
        const y = HEART_TOP + rng() * HEART_H * 1.02;
        if (inside(x, y)) return { x: CENTER.x + (x - CENTER.x) * shrink, y: CENTER.y + (y - CENTER.y) * shrink };
      }
      return { ...CENTER };
    }

    /* --- cành cây --- */
    function bezierAt(sg, f) {
      const a = 1 - f;
      return {
        x: a * a * sg.p0.x + 2 * a * f * sg.c.x + f * f * sg.p1.x,
        y: a * a * sg.p0.y + 2 * a * f * sg.c.y + f * f * sg.p1.y,
      };
    }
    function addSeg(p0, p1, w0, w1, parent, f, depth, bendAmt) {
      const dx = p1.x - p0.x, dy = p1.y - p0.y;
      const len = Math.hypot(dx, dy) || 1;
      const bend = (rng() - 0.5) * 2 * bendAmt;
      const c = { x: (p0.x + p1.x) / 2 - (dy / len) * bend, y: (p0.y + p1.y) / 2 + (dx / len) * bend };
      const sg = { p0, p1, c, w0, w1, len, depth, pts: [] };
      sg.t0 = parent ? parent.t0 + (parent.t1 - parent.t0) * f : 0;
      sg.t1 = sg.t0 + len / SPEED;
      const n = Math.max(4, Math.ceil(len / 28));
      for (let i = 0; i <= n; i++) sg.pts.push(bezierAt(sg, i / n));
      segs.push(sg);
      return sg;
    }

    function grow(parent, p0, group, depth, w) {
      if (group.length === 1) {
        addSeg(p0, group[0], w, Math.max(1.5, w * 0.55), parent, 1, depth, 14);
        return;
      }
      const c = group.reduce((a, p) => ({ x: a.x + p.x / group.length, y: a.y + p.y / group.length }), { x: 0, y: 0 });
      const k = 0.4 + rng() * 0.14;
      const p1 = { x: lerp(p0.x, c.x, k) + (rng() - 0.5) * 24, y: lerp(p0.y, c.y, k) + (rng() - 0.5) * 18 };
      const w1 = Math.max(1.7, w * 0.7);
      const sg = addSeg(p0, p1, w, w1, parent, 1, depth, 16);
      let dx = c.x - p1.x, dy = c.y - p1.y;
      const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
      const sorted = [...group].sort((a, b) => (-dy * a.x + dx * a.y) - (-dy * b.x + dx * b.y));
      const half = Math.floor(sorted.length / 2);
      grow(sg, p1, sorted.slice(0, half), depth + 1, w1);
      grow(sg, p1, sorted.slice(half), depth + 1, w1);
    }

    function pickTargets(n) {
      const out = [];
      for (let i = 0; i < n; i++) {
        let best = null, bd = -1;
        for (let k = 0; k < 14; k++) {
          const p = randomInside(0.86);
          const d = out.length ? Math.min(...out.map((q) => Math.hypot(q.x - p.x, q.y - p.y))) : 1e9;
          if (d > bd) { bd = d; best = p; }
        }
        out.push(best);
      }
      return out;
    }

    function buildBranches() {
      segs = [];
      const trunk = addSeg({ x: 0, y: 0 }, { x: 0, y: HEART_BOT + 10 }, 42, 30, null, 1, 0, 10);
      grow(trunk, trunk.p1, pickTargets(46), 1, 30);

      /* cành con nhỏ cho tự nhiên */
      const base = segs.slice();
      base.forEach((sg) => {
        if (sg.depth < 2 || sg.len < 60 || rng() > 0.6) return;
        const f = 0.35 + rng() * 0.4;
        const p = bezierAt(sg, f), q = bezierAt(sg, Math.min(1, f + 0.05));
        const a0 = Math.atan2(q.y - p.y, q.x - p.x);
        const a = a0 + (rng() > 0.5 ? 1 : -1) * (0.45 + rng() * 0.5);
        const len = sg.len * (0.35 + rng() * 0.3);
        const e = { x: p.x + Math.cos(a) * len, y: p.y + Math.sin(a) * len };
        if (!inside(e.x, e.y)) return;
        const w = Math.max(1.5, lerp(sg.w0, sg.w1, f) * 0.55);
        addSeg(p, e, w, 1.2, sg, f, sg.depth + 1, 8);
      });
      growEnd = segs.reduce((m, g) => Math.max(m, g.t1), 0);
    }

    /* --- lá trái tim --- */
    function buildLeaves() {
      leaves = [];
      const mk = (x, y, big) => {
        const r = rng();
        const spr = r < 0.06 ? 8 + ((rng() * 2) | 0) : (rng() * 8) | 0;
        return {
          x, y, spr,
          size: (big ? 46 : 38) + rng() * 28,
          rot: (rng() - 0.5) * 1.1,
          ph: rng() * 6.28,
          t: 0,
        };
      };
      for (let i = 0; i < 380; i++) { const p = randomInside(0.96); leaves.push(mk(p.x, p.y, false)); }
      for (let i = 0; i < 170; i++) {          // viền để hình trái tim rõ nét
        const t = (i / 170) * Math.PI * 2 + (rng() - 0.5) * 0.03;
        const b = heartPoint(t);
        const k = 0.975 - rng() * 0.05;
        leaves.push(mk(CENTER.x + (b.x - CENTER.x) * k, CENTER.y + (b.y - CENTER.y) * k, true));
      }
      /* lá mọc theo thứ tự cành: lá gần cành nào thì nở sau khi cành đó mọc tới */
      const tips = segs.filter((g) => g.depth >= 2);
      leaves.forEach((lf) => {
        let bd = 1e12, bt = growEnd;
        for (const g of tips) {
          const d = (g.p1.x - lf.x) ** 2 + (g.p1.y - lf.y) ** 2;
          if (d < bd) { bd = d; bt = g.t1; }
        }
        lf.t = bt + 0.05 + rng() * 0.45;
      });
      leaves.sort((a, b) => a.y - b.y);
      doneAt = leaves.reduce((m, l) => Math.max(m, l.t), 0) + 0.7;
    }

    /* --- kích thước & vị trí --- */
    function resize() {
      D = getDPR();
      W = scene.clientWidth || window.innerWidth;
      H = scene.clientHeight || window.innerHeight;
      cv.width = Math.round(W * D); cv.height = Math.round(H * D);
      const portrait = H > W * 1.05;
      const ground = H * (portrait ? 0.72 : 0.845);
      const topM = H * (portrait ? 0.1 : 0.06);
      s = Math.min((W * 0.96) / (HEART_W + 70), (ground - topM) / (-HEART_TOP));
      ox = W / 2; oy = ground;
      scene.style.setProperty('--ground', ground + 'px');
      cacheOK = false;
    }

    function drawSeg(g, sg, p) {
      const n = sg.pts.length - 1, upto = p * n;
      for (let i = 0; i < n && i < upto; i++) {
        const a = sg.pts[i];
        let b = sg.pts[i + 1];
        if (upto < i + 1) { const u = upto - i; b = { x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u) }; }
        g.lineWidth = lerp(sg.w0, sg.w1, (i + 0.5) / n);
        g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
      }
    }
    function drawBranches(g, t) {
      g.save();
      g.beginPath(); g.rect(-3000, -4000, 6000, 4001); g.clip();          // không cho gốc cây lòi xuống dưới mặt đất
      g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = TRUNK;
      for (const sg of segs) {
        if (t <= sg.t0) continue;
        drawSeg(g, sg, clamp((t - sg.t0) / (sg.t1 - sg.t0), 0, 1));
      }
      g.restore();
    }

    const easeOutBack = (x) => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };

    function drawSprite(sprite, x, y, size, rot, alpha) {
      const k = s * D, cs = Math.cos(rot) * k * size / 64, sn = Math.sin(rot) * k * size / 64;
      ctx.globalAlpha = alpha;
      ctx.setTransform(cs, sn, -sn, cs, (ox + x * s) * D, (oy + y * s) * D);
      ctx.drawImage(sprite, -32, -29, 64, 57.6);
    }

    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const t = (now - startTime) / 1000 - T_START;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, cv.width, cv.height);

      /* cành */
      if (t >= growEnd) {
        if (!cacheOK) {
          cache = cache || document.createElement('canvas');
          cache.width = cv.width; cache.height = cv.height;
          const g = cache.getContext('2d');
          g.setTransform(s * D, 0, 0, s * D, ox * D, oy * D);
          drawBranches(g, 1e9);
          cacheOK = true;
        }
        ctx.drawImage(cache, 0, 0);
      } else if (t > 0) {
        ctx.setTransform(s * D, 0, 0, s * D, ox * D, oy * D);
        drawBranches(ctx, t);
      }

      /* lá */
      const wind = t * 1.3;
      for (const lf of leaves) {
        const p = clamp((t - lf.t) / 0.6, 0, 1);
        if (p <= 0) continue;
        const sc = p < 1 ? Math.max(0.01, easeOutBack(p)) : 1;
        const sway = t > doneAt ? Math.sin(wind + lf.ph + lf.x * 0.004) : 0;
        drawSprite(SPRITES[lf.spr], lf.x + sway * 3, lf.y + Math.abs(sway) * 1.2,
          lf.size * sc * (1 + sway * 0.015), lf.rot + sway * 0.07, Math.min(1, p * 2.2) * 0.94);
      }

      /* cánh hoa rơi sau khi cây nở xong */
      if (t > doneAt) {
        if (!revealed) reveal();
        nextPetal -= dt;
        if (nextPetal <= 0 && petals.length < 14 && !reduceMotion) {
          nextPetal = 0.35 + Math.random() * 0.5;
          const lf = leaves[(Math.random() * leaves.length) | 0];
          petals.push({ x: lf.x, y: lf.y, vy: 55 + Math.random() * 60, ph: Math.random() * 6, size: 30 + Math.random() * 20, spr: lf.spr, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 2 });
        }
        for (let i = petals.length - 1; i >= 0; i--) {
          const pt = petals[i];
          pt.y += pt.vy * dt; pt.ph += dt * 2; pt.rot += pt.vr * dt;
          if (pt.y > -4) { petals.splice(i, 1); continue; }
          const a = clamp(-pt.y / 120, 0, 1) * 0.9;
          drawSprite(SPRITES[pt.spr], pt.x + Math.sin(pt.ph) * 32, pt.y, pt.size, pt.rot, a);
        }
      }
      ctx.globalAlpha = 1;
    }

    function reveal() {
      revealed = true;
      bubbles.forEach((b, i) => setTimeout(() => b.classList.add('show'), i * 380));
      setTimeout(() => navBtn.classList.add('show'), 900);
    }

    function start() {
      stop();
      buildPoly(); buildBranches(); buildLeaves();
      resize();
      petals = []; nextPetal = 0; revealed = false;
      bubbles.forEach((b) => b.classList.remove('show'));
      navBtn.classList.remove('show');
      running = true;
      startTime = last = performance.now();
      if (reduceMotion) startTime -= (T_START + doneAt + 0.5) * 1000;
      raf = requestAnimationFrame(frame);
    }
    function stop() {
      running = false; cancelAnimationFrame(raf);
    }
    function resetUI() {
      bubbles.forEach((b) => b.classList.remove('show'));
      navBtn.classList.remove('show');
    }

    window.addEventListener('resize', () => { if (segs.length) resize(); });
    return { start, stop, resetUI };
  })();

  /* =======================================================
     4) MÁY GÕ CHỮ CHO LÁ THƯ
     ======================================================= */
  const typer = (() => {
    const card = $('#letter');
    const paras = $$('#letterBody p');
    const originals = paras.map((p) => p.textContent.trim());
    let timer = 0, token = 0, done = false;

    paras.forEach((p, i) => {          // cấu trúc: [đã gõ][con trỏ][phần còn lại ẩn nhưng giữ chỗ]
      p.setAttribute('aria-label', originals[i]);
      p.innerHTML = '<span class="typed" aria-hidden="true"></span><span class="rest" aria-hidden="true"></span>';
      $('.rest', p).textContent = originals[i];
    });
    const caret = document.createElement('span');
    caret.className = 'caret'; caret.setAttribute('aria-hidden', 'true');

    function setProgress(pi, ci) {
      paras.forEach((p, i) => {
        const typed = $('.typed', p), rest = $('.rest', p);
        if (i < pi) { typed.textContent = originals[i]; rest.textContent = ''; }
        else if (i === pi) { typed.textContent = originals[i].slice(0, ci); rest.textContent = originals[i].slice(ci); typed.after(caret); }
        else { typed.textContent = ''; rest.textContent = originals[i]; }
      });
    }
    function finish() {
      clearTimeout(timer); token++; done = true;
      setProgress(paras.length, 0);
      caret.remove();
    }

    function start() {
      clearTimeout(timer); const my = ++token; done = false;
      setProgress(0, 0);
      if (reduceMotion) { finish(); return; }
      let pi = 0, ci = 0;
      const tick = () => {
        if (my !== token) return;
        if (pi >= paras.length) { timer = setTimeout(() => { if (my === token) caret.remove(); }, 1600); done = true; return; }
        const text = originals[pi];
        ci++;
        setProgress(pi, ci);
        const ch = text[ci - 1];
        let wait = 20 + Math.random() * 14;
        if (ch === ',') wait += 110;
        if (ch === '.' || ch === '!') wait += 260;
        if (ci >= text.length) { pi++; ci = 0; wait += 380; }
        timer = setTimeout(tick, wait);
      };
      timer = setTimeout(tick, 1300);
    }
    function stop() { clearTimeout(timer); token++; }

    card.addEventListener('click', () => { if (!done) finish(); });   // chạm vào thư để hiện hết
    return { start, stop };
  })();

  /* =======================================================
     5) VÒNG ẢNH XOAY 3D
     ======================================================= */
  const gallery = (() => {
    const wrap = $('#gallery');
    const stage = $('.gallery__stage', wrap);
    const ring = $('#ring');
    const cards = $$('.mcard', ring);
    const N = cards.length;
    const STEP = 25;                   // góc giữa 2 ảnh liền kề (độ) → càng lớn càng cong
    const AUTO = 0.5;                  // số ảnh trôi qua mỗi giây

    let pos = 0, spin = AUTO, r = 420, halfW = 300;
    let dragging = false, moved = 0, lastX = 0, lastT = 0, dragVel = 0, resumeAt = 0;
    let target = null;
    let running = false, raf = 0, prev = 0;

    const RAD = Math.PI / 180;
    const wrapN = (v) => ((((v + N / 2) % N) + N) % N) - N / 2;

    function layout() {
      const b = stage.getBoundingClientRect();
      const w = b.width, h = b.height;
      const mobile = window.innerWidth <= 880;
      let ch = mobile ? Math.min(h * 0.74, w * 0.5, 220) : Math.min(h * 0.4, w * 0.34, 260);
      ch = Math.max(ch, 90);
      const cw = ch * 0.75;
      r = (cw / 2) / Math.tan((STEP / 2) * RAD) * 1.12;
      halfW = w / 2;
      cards.forEach((c) => {
        c.style.setProperty('--cw', cw + 'px');
        c.style.setProperty('--ch', ch + 'px');
      });
      stage.style.perspective = Math.max(800, r * 2.6) + 'px';
      ring.style.transform = `translateZ(${-r}px)`;
      render();
    }

    function render() {
      for (let i = 0; i < N; i++) {
        const c = cards[i];
        const th = wrapN(i - pos) * STEP;            // góc của ảnh i so với chính giữa
        if (Math.abs(th) > 92) { c.style.visibility = 'hidden'; continue; }
        const x = Math.abs(r * Math.sin(th * RAD));
        const o = clamp(1 - (x / halfW - 0.5) / 0.55, 0, 1);
        c.style.visibility = o < 0.01 ? 'hidden' : 'visible';
        c.style.opacity = o.toFixed(3);
        c.style.transform = `rotateY(${th.toFixed(2)}deg) translateZ(${r}px)`;
        c.style.pointerEvents = o > 0.4 ? 'auto' : 'none';
      }
    }

    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - prev) / 1000); prev = now;
      if (target !== null) {
        const d = target - pos;
        pos += d * Math.min(1, dt * 5);
        if (Math.abs(d) < 0.004) { pos = target; target = null; resumeAt = now + 1800; }
      } else if (!dragging) {
        const goal = now > resumeAt && !reduceMotion ? AUTO : 0;
        spin += (goal - spin) * Math.min(1, dt * 2.4);
        pos += spin * dt;
      }
      render();
    }

    function down(e) {
      if (e.button > 0) return;
      dragging = true; moved = 0; target = null; dragVel = 0;
      lastX = e.clientX; lastT = performance.now();
      wrap.classList.add('dragging');
      wrap.setPointerCapture?.(e.pointerId);
    }
    function move(e) {
      if (!dragging) return;
      const dx = e.clientX - lastX, now = performance.now();
      moved += Math.abs(dx);
      const dp = -dx / (r * STEP * RAD);
      pos += dp;
      dragVel = lerp(dragVel, dp / Math.max(0.001, (now - lastT) / 1000), 0.4);
      lastX = e.clientX; lastT = now;
    }
    function up(e) {
      if (!dragging) return;
      dragging = false; wrap.classList.remove('dragging');
      if (moved < 6) {                              // chạm vào ảnh → đưa ảnh đó ra giữa
        const i = cards.indexOf(e.target.closest?.('.mcard'));
        if (i >= 0) target = pos + wrapN(i - pos);
        resumeAt = performance.now() + 2500;
      } else {
        spin = clamp(dragVel, -6, 6);
        resumeAt = performance.now() + 1200;
      }
    }
    wrap.addEventListener('pointerdown', down);
    wrap.addEventListener('pointermove', move);
    wrap.addEventListener('pointerup', up);
    wrap.addEventListener('pointercancel', up);

    function start() {
      layout();
      pos = 0; spin = AUTO; target = null; resumeAt = 0;
      running = true; prev = performance.now();
      raf = requestAnimationFrame(frame);
    }
    function stop() { running = false; cancelAnimationFrame(raf); }
    window.addEventListener('resize', () => { if (running) layout(); });
    return { start, stop, layout };
  })();

  /* =======================================================
     1) QUẢN LÝ CHUYỂN TRANG
     ======================================================= */
  const scenes = {
    welcome: $('#scene-welcome'),
    tree:    $('#scene-tree'),
    letter:  $('#scene-letter'),
    final:   $('#scene-final'),
  };
  const bigHeart = $('#startBtn');
  let current = 'welcome';
  let busy = false;

  const hooks = {
    welcome: {
      enter() { fx.setMode('welcome'); bigHeart.classList.remove('is-popped'); },
      leave() {},
    },
    tree: {
      enter() { fx.setMode('calm'); tree.start(); },
      leave() { tree.stop(); tree.resetUI(); },
    },
    letter: {
      enter() {
        fx.setMode('calm'); typer.start(); gallery.start();
        const nav = $('.nav-heart', scenes.letter);
        setTimeout(() => nav.classList.add('show'), reduceMotion ? 0 : 2600);
      },
      leave() { typer.stop(); gallery.stop(); $('.nav-heart', scenes.letter).classList.remove('show'); },
    },
    final: {
      enter() { fx.setMode('final'); },
      leave() {},
    },
  };

  function go(name) {
    if (busy || name === current || !scenes[name]) return;
    busy = true;
    const from = current;
    const A = scenes[from], B = scenes[name];

    A.classList.remove('is-active');
    A.setAttribute('aria-hidden', 'true');
    B.classList.add('is-active');
    B.removeAttribute('aria-hidden');
    current = name;

    setTimeout(() => {                          // đợi hiệu ứng mờ dần của trang cũ rồi mới dọn
      A.classList.remove('play');
      hooks[from].leave();
    }, 900);

    requestAnimationFrame(() => requestAnimationFrame(() => {
      B.classList.add('play');
      hooks[name].enter();
    }));
    setTimeout(() => { busy = false; }, 1000);
  }

  /* --- sự kiện --- */
  bigHeart.addEventListener('click', (e) => {
    if (busy) return;
    const r = bigHeart.getBoundingClientRect();
    fx.burst(r.left + r.width / 2, r.top + r.height / 2, 22);
    bigHeart.classList.add('is-popped');
    setTimeout(() => go('tree'), 650);
  });

  $$('.nav-heart').forEach((btn) => {
    btn.addEventListener('click', () => {
      const r = btn.getBoundingClientRect();
      fx.burst(r.left + r.width / 2, r.top + r.height / 2, 12);
      go(btn.dataset.next);
    });
  });

  $('#replayBtn').addEventListener('click', () => go('welcome'));

  /* khởi động */
  scenes.welcome.classList.add('play');
  window.addEventListener('load', () => document.body.classList.add('ready'));
})();
