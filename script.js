/* =========================================================
   OUR CUTE LOVE STORY  –  script.js
   1) Quản lý chuyển trang        4) Máy gõ chữ cho lá thư
   2) Hạt trái tim bay (nền)      5) Vòng ảnh xoay 3D
   3) Trang đếm thời gian + tặng hoa
   3) Cây trái tim mọc lên        6) Trang cuối (cây hoa phát sáng + bóng đôi + cánh hoa rơi)
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
    let mode = 'welcome';           // welcome | calm | final | off
    let parts = [];
    let last = performance.now();

    const MODES = {
      welcome: { count: 16, dir: -1, sparkles: 7 },
      calm:    { count: 8,  dir: -1, sparkles: 3 },
      final:   { count: 46, dir:  1, sparkles: 6 },
      off:     { count: 0,  dir: -1, sparkles: 0 },      // trang cuối: tắt hạt nền (trang cuối có cánh hoa riêng)
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
     3b) TRANG "OUR TIME TOGETHER"
         chạm màn hình → bạn nam (đứng đối mặt) bước tới tặng hoa → bạn nữ thẹn
         → trái tim bay vào lõi nạp năng lượng → hiện chữ + đồng hồ cùng lúc
     ======================================================= */
  const timeScene = (() => {
    /* ✏️ ĐỔI NGÀY BẮT ĐẦU YÊU Ở ĐÂY: new Date(năm, tháng - 1, ngày)  →  19/11/2025 */
    const START_DATE = new Date(2025, 10, 19, 0, 0, 0);

    const scene = $('#scene-time');
    const svg = $('#timeSvg');
    const nav = $('.nav-heart', scene);
    const hint = $('#timeHint');
    const core = $('#core');
    const grid = $('#timeGrid');
    const boyG = $('#boyG'), girlG = $('#girlG');
    const armSleeve = $('#boyArmSleeve'), armSkin = $('#boyArmSkin'), hand = $('#boyHand'), handTop = $('#boyHandTop');
    const bqWorld = $('#bqWorld'), bouquet = $('#bouquet'), girlSlot = $('#girlSlot');
    const girlHead = $('#girlHead'), girlHair = $('#girlHairBack'), girlBraids = $('#girlBraids');
    const girlEyesDot = $('#girlEyesDot'), girlEyesOpen = $('#girlEyesOpen'), girlEyesShy = $('#girlEyesShy');
    const girlMouth = $('#girlMouth'), girlLines = $('#girlBlushLines');
    const girlBlush = [$('#girlBlushL'), $('#girlBlushR')];
    const boyBlush = [$('#boyBlushL'), $('#boyBlushR')];
    const boyEyes = $('#boyEyes'), boyMouth = $('#boyMouth');

    /* vị trí trong khung SVG (viewBox 480 × 350, bắt đầu từ x = 60) */
    /* Cả hai cùng bước vào giữa nhau → luôn cân đối quanh tâm trang (x = 300) ở mọi thời điểm */
    const BOY_X0 = 144, BOY_X1 = 227, GIRL_X0 = 448, GIRL_X1 = 365, GROUND = 392;
    const SHOULDER = { x: 38, y: 276 };
    const HAND_HANG = { x: 63, y: 322 }, HAND_OFFER = { x: 94, y: 284 }, HAND_SCRATCH = { x: 44, y: 150 };

    const T = reduceMotion ? 0.02 : 1;                 // hệ số thời gian
    const ease = {
      io: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
      out: (t) => 1 - Math.pow(1 - t, 3),
    };

    let S = null, token = 0, active = false, started = false;
    let raf = 0, enteredAt = 0, clockT = 0, trickleT = 0, hintT = 0;
    const temp = new Set();

    function freshState() {
      return {
        boyX: BOY_X0, boyRot: 0, hop: 0, lift: 0, sx: 1,
        girlX: GIRL_X0, girlRot: 0, girlHop: 0,
        hx: HAND_HANG.x, hy: HAND_HANG.y, scratch: 0,
        bqMode: 'boy', bqX: 0, bqY: 0, bqRot: 14, bqScale: 0.95,
        shy: 0, girlBlush: 0, boyBlush: 0,
      };
    }

    /* tọa độ cục bộ của bạn nam → tọa độ SVG (tính cả lật, nghiêng, nhún) */
    function boyToWorld(px, py) {
      const r = (S.boyRot * Math.PI) / 180, lx = px * S.sx, dy = py - GROUND;
      return { x: S.boyX + lx * Math.cos(r) - dy * Math.sin(r), y: lx * Math.sin(r) + dy * Math.cos(r) + GROUND - S.lift };
    }
    function svgPt(x, y) {
      const p = svg.createSVGPoint(); p.x = x; p.y = y;
      const q = p.matrixTransform(svg.getScreenCTM());
      return { x: q.x, y: q.y };
    }

    /* ---------------- vẽ mỗi khung hình ---------------- */
    const f2 = (n) => n.toFixed(2);
    function render(t) {
      /* bạn nam */
      const bob = !started ? Math.sin(t * 2.2) * 1.3 : 0;
      S.lift = S.hop - bob;
      boyG.setAttribute('transform', `translate(${f2(S.boyX)} ${f2(-S.lift)}) rotate(${f2(S.boyRot)} 0 ${GROUND}) scale(${Math.max(S.sx, 0.001).toFixed(3)} 1)`);
      const wig = S.scratch;
      const H = {
        x: S.hx + Math.sin(t * 10) * 5 * wig + (started ? 0 : Math.sin(t * 2.2 + 1) * 1.3),
        y: S.hy + Math.cos(t * 10) * 3 * wig,
      };
      const mx = SHOULDER.x + (H.x - SHOULDER.x) * 0.3, my = SHOULDER.y + (H.y - SHOULDER.y) * 0.3;
      armSleeve.setAttribute('d', `M${SHOULDER.x} ${SHOULDER.y} L${f2(mx)} ${f2(my)}`);
      armSkin.setAttribute('d', `M${f2(mx)} ${f2(my)} L${f2(H.x)} ${f2(H.y)}`);
      hand.setAttribute('cx', f2(H.x)); hand.setAttribute('cy', f2(H.y));

      const bl = S.boyBlush;
      boyBlush.forEach((e) => e.setAttribute('opacity', (0.3 + 0.62 * bl).toFixed(2)));
      boyEyes.setAttribute('transform', 'translate(4 0)');
      boyMouth.setAttribute('d', bl > 0.7 ? 'M-10 227 Q0 243 10 227' : 'M-9 228 Q0 238 9 228');

      /* bó hoa */
      if (S.bqMode === 'boy') {
        const w = boyToWorld(H.x, H.y);
        bouquet.setAttribute('transform', `translate(${f2(w.x)} ${f2(w.y)}) rotate(${f2(S.bqRot * S.sx + (started ? 0 : Math.sin(t * 2.2) * 2))}) scale(${S.bqScale})`);
        handTop.setAttribute('cx', f2(w.x)); handTop.setAttribute('cy', f2(w.y)); handTop.style.display = '';
      } else if (S.bqMode === 'fly') {
        bouquet.setAttribute('transform', `translate(${f2(S.bqX)} ${f2(S.bqY)}) rotate(${f2(S.bqRot)}) scale(${S.bqScale.toFixed(3)})`);
        handTop.style.display = 'none';
      } else {
        bouquet.setAttribute('transform', `translate(0 334) rotate(${f2(Math.sin(t * 1.9) * 1.6)}) scale(0.92)`);
        handTop.style.display = 'none';
      }

      /* bạn nữ */
      const sh = S.shy, bl2 = Math.max(S.girlBlush, sh);
      const sway = Math.sin(t * 1.5) * (1 + sh * 0.7);
      girlG.setAttribute('transform', `translate(${f2(S.girlX)} ${f2(-S.girlHop)}) rotate(${f2(sway + S.girlRot)} 0 ${GROUND})`);
      const headT = `translate(0 ${f2(3 * sh)}) rotate(${f2(-9 * sh + Math.sin(t * 1.7) * 1.2)} 0 252)`;
      girlHead.setAttribute('transform', headT);
      girlHair.setAttribute('transform', headT);
      girlBraids.setAttribute('transform', `translate(0 ${f2(3 * sh)})`);      // bím tóc buông thẳng theo trọng lực, chỉ nhún theo đầu
      girlEyesDot.setAttribute('transform', `translate(${f2(-3 * (1 - sh))} 0)`);
      const closed = clamp((sh - 0.45) * 6, 0, 1);
      girlEyesOpen.setAttribute('opacity', (1 - closed).toFixed(2));
      girlEyesShy.setAttribute('opacity', closed.toFixed(2));
      girlMouth.setAttribute('d', sh > 0.5 ? 'M-9 229 q4.5 -5 9 0 q4.5 5 9 0' : 'M-6 229 Q0 234 6 229');
      girlBlush.forEach((e) => e.setAttribute('opacity', (0.45 + 0.5 * bl2).toFixed(2)));
      girlLines.setAttribute('opacity', clamp((sh - 0.3) * 2, 0, 1).toFixed(2));
    }

    function loop(now) {
      if (!active) return;
      raf = requestAnimationFrame(loop);
      render(now / 1000);
    }

    /* ---------------- tiện ích thời gian ---------------- */
    function tw(ms, fn, e = ease.io) {
      const my = token;
      return new Promise((res) => {
        const t0 = performance.now(), dur = Math.max(1, ms * T);
        const step = (now) => {
          if (my !== token) return res();
          const p = clamp((now - t0) / dur, 0, 1);
          fn(e(p), p);
          if (p < 1) requestAnimationFrame(step); else res();
        };
        requestAnimationFrame(step);
      });
    }
    const wait = (ms) => new Promise((r) => setTimeout(r, ms * T));

    /* ---------------- hoạt cảnh tặng hoa ---------------- */
    async function play() {
      const my = token, ok = () => my === token;
      started = true;
      scene.classList.add('started');
      hint.classList.remove('show');

      /* 1) nhún một cái đầy hào hứng rồi mới bước đi */
      await tw(420, (p) => { S.hop = Math.sin(p * Math.PI) * 12; S.boyBlush = p * 0.5; });
      if (!ok()) return;
      await wait(150); if (!ok()) return;

      /* 2) nhún nhảy bước tới chỗ bạn nữ */
      await tw(1500, (p) => {
        S.boyX = lerp(BOY_X0, BOY_X1, p);
        S.girlX = lerp(GIRL_X0, GIRL_X1, p);          // bạn nữ cũng e thẹn bước lại gần
        const w = Math.sin(p * Math.PI * 5);
        S.hop = Math.abs(w) * 13; S.boyRot = w * 3.4;
        S.girlHop = Math.abs(w) * 7; S.girlRot = -w * 2.2;
        S.girlBlush = p * 0.5;
      });
      if (!ok()) return;
      S.hop = 0; S.boyRot = 0; S.girlHop = 0; S.girlRot = 0;
      await wait(200); if (!ok()) return;

      /* 3) đưa bó hoa ra phía trước */
      await tw(800, (p) => {
        S.hx = lerp(HAND_HANG.x, HAND_OFFER.x, p); S.hy = lerp(HAND_HANG.y, HAND_OFFER.y, p);
        S.bqRot = lerp(14, 36, p); S.boyRot = -3 * Math.sin(p * Math.PI);
        S.boyBlush = lerp(0.5, 0.8, p);
      }, ease.out);
      if (!ok()) return;
      await wait(450); if (!ok()) return;

      /* 4) trao hoa: bó hoa bay sang tay bạn nữ, bạn nam gãi đầu, bạn nữ thẹn */
      const p0 = boyToWorld(S.hx, S.hy), p1 = { x: S.girlX, y: 334 };
      S.bqMode = 'fly'; S.bqX = p0.x; S.bqY = p0.y;
      await tw(700, (p) => {
        S.bqX = lerp(p0.x, p1.x, p);
        S.bqY = lerp(p0.y, p1.y, p) - Math.sin(p * Math.PI) * 34;
        S.bqRot = lerp(36, 0, p); S.bqScale = lerp(0.95, 0.92, p);
        S.hx = lerp(HAND_OFFER.x, HAND_SCRATCH.x, p); S.hy = lerp(HAND_OFFER.y, HAND_SCRATCH.y, p);
        S.shy = p; S.boyBlush = lerp(0.8, 1, p);
      });
      if (!ok()) return;
      S.bqMode = 'girl'; S.scratch = 1;
      girlSlot.appendChild(bouquet);
      await wait(700); if (!ok()) return;

      /* 5) những trái tim nạp năng lượng cho bộ đếm */
      await charge(my);
    }

    /* ---------------- trái tim bay vào lõi ---------------- */
    function heartEl(size) {
      const d = document.createElement('div');
      d.className = 'flyheart';
      d.style.width = size + 'px'; d.style.height = size * 0.9 + 'px';
      d.innerHTML = '<svg viewBox="0 0 100 90" aria-hidden="true"><use href="#heart" fill="url(#gHeart)"/></svg>';
      scene.appendChild(d); temp.add(d);
      return d;
    }

    function fly(i, target) {
      const fromGirl = i % 2 === 1;
      const o = fromGirl ? svgPt(S.girlX + (Math.random() - 0.5) * 70, 96) : svgPt(S.boyX + (Math.random() - 0.5) * 70, 104);
      const size = 18 + Math.random() * 14;
      const d = heartEl(size);
      const side = fromGirl ? 1 : -1;
      const c = { x: (o.x + target.x) / 2 + side * (60 + Math.random() * 110), y: Math.min(o.y, target.y) - 20 - Math.random() * 60 };
      const spin = (Math.random() - 0.5) * 80;
      return tw(1150 + Math.random() * 450, (p) => {
        const a = 1 - p;
        const x = a * a * o.x + 2 * a * p * c.x + p * p * target.x;
        const y = a * a * o.y + 2 * a * p * c.y + p * p * target.y;
        const sc = p < 0.2 ? 0.4 + p * 3 : lerp(1, 0.45, (p - 0.2) / 0.8);
        d.style.opacity = p > 0.9 ? ((1 - p) * 10).toFixed(2) : 1;
        d.style.transform = `translate(${f2(x - size / 2)}px, ${f2(y - size * 0.45)}px) rotate(${f2(spin * p)}deg) scale(${f2(sc)})`;
      }, ease.io).then(() => { d.remove(); temp.delete(d); });
    }

    async function charge(my) {
      const ok = () => my === token;
      core.classList.add('on');
      await wait(450); if (!ok()) return;
      const r = core.getBoundingClientRect();
      const target = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      const N = reduceMotion ? 4 : 13;
      let arrived = 0;
      const flights = [];
      for (let i = 0; i < N; i++) {
        if (!ok()) return;
        flights.push(fly(i, target).then(() => {
          if (!ok()) return;
          arrived++;
          core.style.setProperty('--c', (arrived / N).toFixed(3));
          core.classList.remove('hit'); void core.offsetWidth; core.classList.add('hit');
        }));
        await wait(210);
      }
      await Promise.all(flights);
      if (!ok()) return;
      await wait(350); if (!ok()) return;
      reveal(target);
    }

    function reveal(target) {
      core.classList.remove('on', 'hit');
      core.classList.add('burst');
      fx.burst(target.x, target.y, 26);
      scene.classList.add('revealed');           // chữ + đồng hồ hiện CÙNG LÚC
      updateClock(); tickClock();
      trickleT = setInterval(trickle, 1100);
      setTimeout(() => { if (active) nav.classList.add('show'); }, 1500 * T);
    }

    /* tim nhỏ bay lên nhẹ nhàng phía trên hai bạn sau khi hoàn tất */
    function trickle() {
      if (!active || document.hidden || reduceMotion) return;
      const p = svgPt(lerp(S.boyX, S.girlX, Math.random()) + (Math.random() - 0.5) * 30, 100);
      const d = document.createElement('div');
      d.className = 'float-heart';
      d.innerHTML = '<svg viewBox="0 0 100 90" aria-hidden="true"><use href="#heart" fill="url(#gHeart)"/></svg>';
      d.style.left = p.x - 8 + 'px'; d.style.top = p.y + 'px';
      scene.appendChild(d); temp.add(d);
      const dx = (Math.random() - 0.5) * 50;
      const a = d.animate([
        { transform: 'translate(0,0) scale(.4)', opacity: 0 },
        { transform: `translate(${dx * 0.4}px,-30px) scale(1)`, opacity: 0.9, offset: 0.25 },
        { transform: `translate(${dx}px,-110px) scale(.8)`, opacity: 0 },
      ], { duration: 2600, easing: 'ease-out' });
      a.onfinish = () => { d.remove(); temp.delete(d); };
    }

    /* ---------------- đồng hồ: tính theo lịch (năm / tháng / ngày / giờ / phút / giây) ---------------- */
    function diff(a, b) {
      let y = b.getFullYear() - a.getFullYear(), mo = b.getMonth() - a.getMonth(), d = b.getDate() - a.getDate();
      let h = b.getHours() - a.getHours(), mi = b.getMinutes() - a.getMinutes(), s = b.getSeconds() - a.getSeconds();
      if (s < 0) { s += 60; mi--; }
      if (mi < 0) { mi += 60; h--; }
      if (h < 0) { h += 24; d--; }
      if (d < 0) { d += new Date(b.getFullYear(), b.getMonth(), 0).getDate(); mo--; }   // số ngày của tháng trước
      if (mo < 0) { mo += 12; y--; }
      return { years: y, months: mo, days: d, hours: h, minutes: mi, seconds: s };
    }
    const pad = (n) => String(n).padStart(2, '0');

    function updateClock() {
      const now = new Date();
      const v = now < START_DATE ? { years: 0, months: 0, days: 0, hours: 0, minutes: 0, seconds: 0 } : diff(START_DATE, now);
      const fmt = { years: v.years, months: v.months, days: v.days, hours: pad(v.hours), minutes: pad(v.minutes), seconds: pad(v.seconds) };
      $$('[data-u]', grid).forEach((b) => {
        const val = String(fmt[b.dataset.u]);
        if (b.textContent !== val) {
          b.textContent = val;
          if (b.dataset.u === 'seconds') { b.classList.add('tick'); setTimeout(() => b.classList.remove('tick'), 180); }
        }
      });
      $('#cellYears').hidden = v.years < 1;            // ô "năm" tự hiện khi tròn 1 năm
      grid.style.setProperty('--cols', v.years < 1 ? 5 : 6);
      const days = Math.max(0, Math.round((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(START_DATE.getFullYear(), START_DATE.getMonth(), START_DATE.getDate())) / 864e5));
      $('#totalDays').textContent = days.toLocaleString('vi-VN');
    }
    function tickClock() {
      clearTimeout(clockT);
      clockT = setTimeout(() => { updateClock(); tickClock(); }, 1000 - (Date.now() % 1000) + 5);   // nhảy đúng nhịp giây
    }

    /* ---------------- vào / ra trang ---------------- */
    function tryStart() {
      if (!active || started || performance.now() - enteredAt < 900) return;
      play();
    }
    scene.addEventListener('click', (e) => { if (!e.target.closest('.nav-heart')) tryStart(); });
    document.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && active && !started && !document.activeElement?.closest('button')) { e.preventDefault(); tryStart(); }
    });

    function cleanup() {
      token++;
      cancelAnimationFrame(raf);
      clearTimeout(clockT); clearInterval(trickleT); clearTimeout(hintT);
      temp.forEach((n) => n.remove()); temp.clear();
    }

    function enter() {
      cleanup();
      S = freshState(); started = false; active = true;
      enteredAt = performance.now();
      scene.classList.remove('started', 'revealed');
      core.classList.remove('on', 'hit', 'burst'); core.style.setProperty('--c', 0);
      nav.classList.remove('show'); hint.classList.remove('show');
      bqWorld.insertBefore(bouquet, handTop);
      girlG.setAttribute('transform', `translate(${GIRL_X0} 0)`);
      updateClock();
      raf = requestAnimationFrame(loop);
      hintT = setTimeout(() => { if (active && !started) hint.classList.add('show'); }, 1400);
    }
    function stop() { active = false; cleanup(); }

    return { enter, stop };
  })();

  /* =======================================================
     6) TRANG CUỐI – nền đen, cây hoa phát sáng mọc lên,
        bóng đôi ôm nhau dưới gốc cây, cánh hoa rơi liên tục
     ======================================================= */
  const finale = (() => {
    const scene = $('#scene-final');
    const cv = $('#finalCanvas');
    const ctx = cv.getContext('2d');
    const title = $('#finalText');

    /* ✏️ CHỈNH DÁNG CÂY Ở ĐÂY
       Không gian thiết kế: gốc cây (0,0) nằm trên mặt đất, y âm = đi lên */
    const MAX_DEPTH = 7;                              // số tầng chia cành
    const SPREAD = [28, 28, 25, 21, 18, 15, 12];      // góc xoè (độ) ở từng tầng → cành ngoài cùng rủ xuống
    const TRUNK_LEN = 390, TRUNK_W0 = 74, TRUNK_W1 = 48;   // thân cây (tăng TRUNK_W0/W1 để thân to hơn)
    const SPEED = 560;                                // tốc độ cành mọc (đơn vị/giây)
    const T_START = 0.35;                             // chờ một chút rồi cây mới mọc
    const TRUNK_DARK = '#b07650', TRUNK_LIGHT = '#d29c74';
    const PETAL_COUNT = 64;                           // số cánh hoa rơi cùng lúc (máy tính)

    let W = 0, H = 0, D = 1, s = 1, ox = 0, oy = 0;
    let groundPx = 0, treeHpx = 0, treeWpx = 0, coupleH = 0;
    let rng = mulberry32(1119);
    let segs = [], tips = [], blossoms = [], glows = [];
    let bounds = { w: 1, h: 1 };
    let growEnd = 0, bloomEnd = 0;
    let startTime = 0, last = 0, running = false, raf = 0, revealed = false;
    let branchCache = null, branchOK = false, allCache = null, allOK = false;
    let petals = [], petalAcc = 0;

    /* --- các "sprite" nhỏ vẽ sẵn để canvas chạy nhẹ --- */
    const mkSprite = (stops, px = 48) => {
      const c = document.createElement('canvas');
      c.width = c.height = px;
      const g = c.getContext('2d'), r = px / 2;
      const gr = g.createRadialGradient(r, r, 0, r, r, r);
      stops.forEach(([o, col]) => gr.addColorStop(o, col));
      g.fillStyle = gr; g.fillRect(0, 0, px, px);
      return c;
    };
    const BLOSSOM = [
      mkSprite([[0, 'rgba(255,255,255,1)'],   [.4, 'rgba(255,238,246,.95)'], [.72, 'rgba(255,190,218,.5)'],  [1, 'rgba(255,160,205,0)']]),
      mkSprite([[0, 'rgba(255,244,249,1)'],   [.4, 'rgba(255,208,230,.95)'], [.72, 'rgba(255,160,205,.5)'],  [1, 'rgba(255,130,185,0)']]),
      mkSprite([[0, 'rgba(255,226,240,1)'],   [.4, 'rgba(255,176,214,.92)'], [.72, 'rgba(255,128,184,.45)'], [1, 'rgba(255,100,165,0)']]),
    ];
    const GLOW = mkSprite([[0, 'rgba(255,150,200,.55)'], [.5, 'rgba(255,120,185,.2)'], [1, 'rgba(255,100,170,0)']], 64);
    const mkPetal = (a, b) => {
      const c = document.createElement('canvas');
      c.width = 40; c.height = 24;
      const g = c.getContext('2d');
      const gr = g.createRadialGradient(20, 12, 0, 20, 12, 18);
      gr.addColorStop(0, a); gr.addColorStop(.6, b); gr.addColorStop(1, 'rgba(255,200,230,0)');
      g.fillStyle = gr;
      g.beginPath(); g.ellipse(20, 12, 17, 9.5, 0, 0, Math.PI * 2); g.fill();
      return c;
    };
    const PETALS = [
      mkPetal('rgba(255,255,255,1)', 'rgba(255,236,246,.95)'),
      mkPetal('rgba(255,236,246,1)', 'rgba(255,196,224,.9)'),
    ];

    const easeOutBack = (x) => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };

    /* --- dựng cành cây: thân → chia đôi liên tục, cành ngoài cùng rủ xuống --- */
    function bez(sg, f) {
      const a = 1 - f;
      return {
        x: a * a * sg.p0.x + 2 * a * f * sg.c.x + f * f * sg.p1.x,
        y: a * a * sg.p0.y + 2 * a * f * sg.c.y + f * f * sg.p1.y,
      };
    }
    function addSeg(p0, ang, len, w0, w1, parent, depth, bendAmt) {
      const a = (ang * Math.PI) / 180;
      const p1 = { x: p0.x + Math.sin(a) * len, y: p0.y - Math.cos(a) * len };
      const bend = (rng() - 0.5) * 2 * bendAmt * len;
      const c = { x: (p0.x + p1.x) / 2 + Math.cos(a) * bend, y: (p0.y + p1.y) / 2 + Math.sin(a) * bend };
      const sg = { p0, p1, c, ang, len, w0, w1, depth, pts: [] };
      sg.t0 = parent ? parent.t1 : 0;
      sg.t1 = sg.t0 + len / SPEED;
      const n = Math.max(4, Math.ceil(len / 24));
      for (let i = 0; i <= n; i++) sg.pts.push(bez(sg, i / n));
      segs.push(sg);
      return sg;
    }
    function fork(parent, depth) {
      if (depth >= MAX_DEPTH) { tips.push(parent); return; }
      const sp = SPREAD[depth];
      [-1, 1].forEach((side) => {
        const ang = parent.ang + side * sp * (0.85 + rng() * 0.3) + (rng() - 0.5) * 5;
        const len = parent.len * (0.76 + rng() * 0.06);
        const w0 = parent.w1, w1 = Math.max(1.8, w0 * 0.7);
        fork(addSeg(parent.p1, ang, len, w0, w1, parent, depth + 1, 0.07), depth + 1);
      });
    }

    /* --- hoa nở dày ở các cành ngoài cùng + quầng sáng hồng --- */
    function buildBlossoms() {
      blossoms = []; glows = [];
      const add = (x, y, t, big) => {
        const r = rng();
        blossoms.push({
          x, y,
          r: (big ? 7 : 6) + rng() * (big ? 9 : 7),
          k: r < 0.6 ? 0 : r < 0.88 ? 1 : 2,
          a: 0.78 + rng() * 0.22,
          t: t + rng() * 0.55,
        });
      };
      for (const sg of segs) {
        if (sg.depth >= MAX_DEPTH - 2) {
          const tip = sg.depth === MAX_DEPTH;
          const n = tip ? 30 : 11, rad = tip ? 26 : 15;
          for (let i = 0; i < n; i++) {
            const p = bez(sg, tip ? 0.35 + rng() * 0.65 : rng());
            const ang = rng() * Math.PI * 2, d = Math.sqrt(rng()) * rad;
            add(p.x + Math.cos(ang) * d, p.y + Math.sin(ang) * d * 0.85, sg.t1, tip);
          }
        }
        if (sg.depth === MAX_DEPTH) glows.push({ x: sg.p1.x, y: sg.p1.y, r: 46 + rng() * 20, t: sg.t1 });
      }
      bloomEnd = blossoms.reduce((m, b) => Math.max(m, b.t), 0) + 0.6;
    }

    function buildTree() {
      rng = mulberry32(1119);                          // seed cố định → cây luôn đẹp như nhau (1119 = 19/11 ♡)
      segs = []; tips = [];
      const trunk = addSeg({ x: 0, y: 0 }, 0, TRUNK_LEN, TRUNK_W0, TRUNK_W1, null, 0, 0.015);
      fork(trunk, 0);
      growEnd = segs.reduce((m, g) => Math.max(m, g.t1), 0);
      buildBlossoms();
      let minX = 0, maxX = 0, minY = 0;
      for (const b of blossoms) {
        minX = Math.min(minX, b.x - b.r); maxX = Math.max(maxX, b.x + b.r); minY = Math.min(minY, b.y - b.r);
      }
      bounds = { w: 2 * Math.max(-minX, maxX), h: -minY };
    }

    /* --- kích thước & vị trí theo màn hình --- */
    function layout() {
      D = getDPR();
      W = scene.clientWidth || window.innerWidth;
      H = scene.clientHeight || window.innerHeight;
      cv.width = Math.round(W * D); cv.height = Math.round(H * D);
      const portrait = H > W * 1.05;
      groundPx = H * (portrait ? 0.83 : 0.86);
      const tH = title.offsetHeight || H * 0.16;
      const topLimit = H * 0.03 + tH + H * 0.025;
      s = Math.min((groundPx - topLimit) / bounds.h, (W * 0.96) / bounds.w);
      ox = W / 2; oy = groundPx;
      treeHpx = bounds.h * s; treeWpx = bounds.w * s;
      coupleH = clamp(treeHpx * 0.27, 90, 220);
      scene.style.setProperty('--ground', groundPx + 'px');
      scene.style.setProperty('--coupleH', coupleH + 'px');
      title.style.top = clamp(groundPx - treeHpx - tH - H * 0.02, H * 0.03, H) + 'px';
      branchOK = allOK = false;
    }

    /* --- vẽ cành (hai lớp: nâu đậm + lớp sáng mảnh giữa cành cho có khối) --- */
    function strokeSeg(g, sg, p, k) {
      const n = sg.pts.length - 1, upto = p * n;
      for (let i = 0; i < n && i < upto; i++) {
        const a = sg.pts[i];
        let b = sg.pts[i + 1];
        if (upto < i + 1) { const u = upto - i; b = { x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u) }; }
        g.lineWidth = lerp(sg.w0, sg.w1, (i + 0.5) / n) * k;
        g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
      }
    }
    function drawBranches(g, t) {
      g.save();
      g.beginPath(); g.rect(-4000, -6000, 8000, 6001); g.clip();      // không cho gốc cây lòi xuống dưới mặt đất
      g.lineCap = 'round'; g.lineJoin = 'round'; g.globalAlpha = 1;
      for (let pass = 0; pass < 2; pass++) {
        g.strokeStyle = pass ? TRUNK_LIGHT : TRUNK_DARK;
        for (const sg of segs) {
          if (t <= sg.t0) continue;
          strokeSeg(g, sg, clamp((t - sg.t0) / (sg.t1 - sg.t0), 0, 1), pass ? 0.42 : 1);
        }
      }
      g.restore();
    }
    function drawFoliage(g, t) {
      g.globalCompositeOperation = 'lighter';
      for (const o of glows) {
        const p = clamp((t - o.t) / 1.0, 0, 1);
        if (p <= 0) continue;
        const r = o.r * (0.4 + 0.6 * p);
        g.globalAlpha = 0.13 * p;
        g.drawImage(GLOW, o.x - r, o.y - r, r * 2, r * 2);
      }
      g.globalCompositeOperation = 'source-over';
      for (const b of blossoms) {
        const p = clamp((t - b.t) / 0.5, 0, 1);
        if (p <= 0) continue;
        const r = b.r * (p < 1 ? Math.max(0.01, easeOutBack(p)) : 1);
        g.globalAlpha = Math.min(1, p * 2.4) * b.a;
        g.drawImage(BLOSSOM[b.k], b.x - r, b.y - r, r * 2, r * 2);
      }
      g.globalAlpha = 1;
    }

    const designT = (g) => g.setTransform(s * D, 0, 0, s * D, ox * D, oy * D);

    function buildBranchCache() {
      branchCache = branchCache || document.createElement('canvas');
      branchCache.width = cv.width; branchCache.height = cv.height;
      const g = branchCache.getContext('2d');
      designT(g); drawBranches(g, 1e9);
      branchOK = true;
    }
    function buildAllCache() {
      allCache = allCache || document.createElement('canvas');
      allCache.width = cv.width; allCache.height = cv.height;
      const g = allCache.getContext('2d');
      designT(g); drawBranches(g, 1e9); drawFoliage(g, 1e9);
      allOK = true;
    }

    /* --- nền: quầng sáng sau tán hoa, ánh sáng quanh đôi bóng, "sân khấu" dưới gốc --- */
    function drawBackdrop(t) {
      const g = ctx;
      g.setTransform(D, 0, 0, D, 0, 0);
      const bl = clamp((t - 0.6) / 2.6, 0, 1);
      if (bl > 0) {
        const cx = ox, cy = oy - treeHpx * 0.66, r = Math.max(treeWpx, treeHpx) * 0.62;
        const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r);
        gr.addColorStop(0, `rgba(255,140,195,${(0.22 * bl).toFixed(3)})`);
        gr.addColorStop(0.55, `rgba(190,110,200,${(0.09 * bl).toFixed(3)})`);
        gr.addColorStop(1, 'rgba(120,90,200,0)');
        g.fillStyle = gr; g.fillRect(0, 0, W, H);
      }
      const cg = clamp((t - 0.3) / 1.4, 0, 1);            // ánh sáng phía sau đôi bóng để thấy rõ hình bóng đen
      if (cg > 0) {
        const cx = ox, cy = groundPx - coupleH * 0.55, r = coupleH * 1.3;
        const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r);
        gr.addColorStop(0, `rgba(255,172,216,${(0.42 * cg).toFixed(3)})`);
        gr.addColorStop(0.6, `rgba(220,140,215,${(0.16 * cg).toFixed(3)})`);
        gr.addColorStop(1, 'rgba(200,120,210,0)');
        g.fillStyle = gr; g.fillRect(cx - r, cy - r, r * 2, r * 2);
      }
      const ga = clamp(t / 0.9, 0, 1);                    // mặt đất phát sáng nhẹ như trong ảnh mẫu
      if (ga > 0) {
        const rx = Math.max(coupleH * 0.95, treeHpx * 0.3), ry = Math.max(8, rx * 0.085);
        g.save();
        g.translate(ox, groundPx); g.scale(1, ry / rx);
        const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
        gr.addColorStop(0, `rgba(120,138,235,${(0.38 * ga).toFixed(3)})`);
        gr.addColorStop(0.75, `rgba(110,125,225,${(0.3 * ga).toFixed(3)})`);
        gr.addColorStop(1, 'rgba(140,155,255,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rx, 0, Math.PI * 2); g.fill();
        g.restore();
        g.strokeStyle = `rgba(170,185,255,${(0.22 * ga).toFixed(3)})`; g.lineWidth = 1.2;
        g.beginPath(); g.ellipse(ox, groundPx, rx * 0.96, ry * 0.96, 0, 0, Math.PI * 2); g.stroke();
      }
    }

    /* --- cánh hoa rơi --- */
    function newPetal(filling) {
      const sz = H * (0.008 + Math.random() * 0.011);
      const p = {
        spr: PETALS[(Math.random() * PETALS.length) | 0],
        w: sz, h: sz * 0.6,
        ph: Math.random() * 6.28, fr: 0.8 + Math.random() * 1.1, sw: 8 + Math.random() * 26,
        rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 2.2,
        vy: H * (0.035 + Math.random() * 0.05),
        a: 0.5 + Math.random() * 0.45, age: 0,
      };
      if (!filling && blossoms.length && Math.random() < 0.6) {       // rụng ra từ tán hoa
        const b = blossoms[(Math.random() * blossoms.length) | 0];
        p.bx = ox + b.x * s; p.y = oy + b.y * s;
      } else {                                                       // hoặc bay vào từ phía trên màn hình
        p.bx = Math.random() * W;
        p.y = filling ? oy - treeHpx * 0.9 + Math.random() * (treeHpx * 0.9) : -20;
      }
      p.x = p.bx;
      if (reduceMotion) { p.vy = 0; p.vr = 0; p.sw = 0; p.age = 9; }
      return p;
    }
    function updatePetals(t, dt) {
      const sinceBloom = t - (growEnd * 0.55);
      const ramp = clamp(sinceBloom / 3, 0, 1);
      const target = (W < 700 ? PETAL_COUNT * 0.6 : PETAL_COUNT) * ramp;
      if (reduceMotion) {
        if (sinceBloom > 0 && !petals.length) for (let i = 0; i < 24; i++) petals.push(newPetal(true));
      } else if (sinceBloom > 0) {
        petalAcc += dt * (petals.length < target ? 16 : 5);
        while (petalAcc >= 1) { petalAcc--; if (petals.length < target + 8) petals.push(newPetal(sinceBloom < 3.2)); }
      }
      const fadeZone = H * 0.1;
      for (let i = petals.length - 1; i >= 0; i--) {
        const p = petals[i];
        p.age += dt;
        p.y += p.vy * dt; p.ph += dt * p.fr; p.rot += p.vr * dt;
        p.x = p.bx + Math.sin(p.ph) * p.sw;
        if (p.y >= groundPx) { petals.splice(i, 1); continue; }
        const a = p.a * clamp(p.age / 0.7, 0, 1) * clamp((groundPx - p.y) / fadeZone, 0, 1);
        if (a < 0.01) continue;
        const c = Math.cos(p.rot) * D, sn = Math.sin(p.rot) * D;
        const fl = 0.55 + 0.45 * Math.abs(Math.cos(p.ph * 1.7));        // lật nhẹ khi rơi cho giống cánh hoa thật
        ctx.globalAlpha = a;
        ctx.setTransform(c, sn, -sn * fl, c * fl, p.x * D, p.y * D);
        ctx.drawImage(p.spr, -p.w / 2, -p.h / 2, p.w, p.h);
      }
      ctx.globalAlpha = 1;
    }

    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const t = (now - startTime) / 1000 - T_START;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, cv.width, cv.height);
      drawBackdrop(t);

      if (t >= bloomEnd) {
        if (!allOK) buildAllCache();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(allCache, 0, 0);
      } else {
        if (t >= growEnd) {
          if (!branchOK) buildBranchCache();
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.drawImage(branchCache, 0, 0);
        } else if (t > 0) {
          designT(ctx); drawBranches(ctx, t);
        }
        if (t > growEnd * 0.45) { designT(ctx); drawFoliage(ctx, t); }
      }

      updatePetals(t, dt);

      if (!revealed && t >= bloomEnd - 0.4) {              // chữ "Continue forever love" hiện khi hoa nở gần xong
        revealed = true;
        scene.classList.add('revealed');
      }
    }

    function start() {
      stop();
      buildTree(); layout();
      petals = []; petalAcc = 0; revealed = false;
      scene.classList.remove('revealed');
      running = true;
      startTime = last = performance.now();
      if (reduceMotion) startTime -= (T_START + bloomEnd + 1) * 1000;
      raf = requestAnimationFrame(frame);
    }
    function stop() {
      running = false; cancelAnimationFrame(raf);
      scene.classList.remove('revealed');
    }

    window.addEventListener('resize', () => { if (running) layout(); });
    return { start, stop };
  })();

  /* =======================================================
     1) QUẢN LÝ CHUYỂN TRANG
     ======================================================= */
  const scenes = {
    welcome: $('#scene-welcome'),
    time:    $('#scene-time'),
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
    time: {
      enter() { fx.setMode('calm'); timeScene.enter(); },
      leave() { timeScene.stop(); $('.nav-heart', scenes.time).classList.remove('show'); },
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
      enter() { fx.setMode('off'); finale.start(); },
      leave() { finale.stop(); },
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
    setTimeout(() => go('time'), 650);
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
