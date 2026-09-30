// 祝日アラーム 公式サイト：スクロールで夜 → 朝、祝日の太陽が月に変わる。音の試聴に合わせて月のまわりに光の輪。
(() => {
  "use strict";
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const $ = (s) => document.querySelector(s);

  // ---------- 色の補間 ----------
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const css = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  const smooth = (t) => t * t * (3 - 2 * t);
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const KEYS = [
    { p: 0.0, c: ["#0b1030", "#18214a", "#2e3470"], hill: ["#0a0f2a", "#111a3e"] },
    { p: 0.42, c: ["#18214a", "#4a4f9a", "#f2a07b"], hill: ["#26285a", "#35367a"] },
    { p: 1.0, c: ["#34509f", "#7d93dc", "#fbd2a8"], hill: ["#5a6cb4", "#8494d4"] },
  ].map((k) => ({ p: k.p, c: k.c.map(hex), hill: k.hill.map(hex) }));
  function palette(p) {
    let i = 0;
    while (i < KEYS.length - 2 && p > KEYS[i + 1].p) i++;
    const a = KEYS[i], b = KEYS[i + 1];
    const t = smooth(clamp((p - a.p) / (b.p - a.p)));
    return { c: a.c.map((v, j) => mix(v, b.c[j], t)), hill: a.hill.map((v, j) => mix(v, b.hill[j], t)) };
  }

  function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

  // ---------- 天体と雲（一度だけ描いて使い回す） ----------
  function offscreen(w, h) {
    const c = document.createElement("canvas");
    c.width = Math.ceil(w * DPR); c.height = Math.ceil(h * DPR);
    const x = c.getContext("2d"); x.scale(DPR, DPR);
    return [c, x];
  }
  function blob(x, cx, cy, r, color, core = 0) {
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, color);
    if (core) g.addColorStop(core, color);
    g.addColorStop(1, color.replace(/[\d.]+\)$/, "0)"));
    x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
  }

  // 月：海（暗い模様）とクレーター、縁の減光、ぼかした明暗境界、地球照で暗い側もうっすら見える
  const moonCache = new Map();
  function moonImage(r) {
    const key = Math.round(r);
    if (moonCache.has(key)) return moonCache.get(key);
    const size = r * 2 + 4, m = size / 2;
    const [tex, t] = offscreen(size, size);
    t.save(); t.beginPath(); t.arc(m, m, r, 0, Math.PI * 2); t.clip();
    const base = t.createRadialGradient(m - r * 0.3, m - r * 0.35, r * 0.1, m, m, r);
    base.addColorStop(0, "#fffaf0"); base.addColorStop(0.65, "#f1e4c3"); base.addColorStop(1, "#c9b487");
    t.fillStyle = base; t.fillRect(0, 0, size, size);
    const rr = rng(1969);
    for (let i = 0; i < 8; i++) {
      blob(t, m + (rr() - 0.45) * r * 1.2, m + (rr() - 0.5) * r * 1.2, r * (0.18 + rr() * 0.3), "rgba(132,118,96,0.32)");
    }
    for (let i = 0; i < 34; i++) {
      const a = rr() * Math.PI * 2, d = Math.sqrt(rr()) * r * 0.9, cx = m + Math.cos(a) * d, cy = m + Math.sin(a) * d, cr = r * (0.02 + rr() * 0.07);
      t.fillStyle = "rgba(120,104,82,0.28)"; t.beginPath(); t.arc(cx, cy, cr, 0, Math.PI * 2); t.fill();
      t.strokeStyle = "rgba(255,250,235,0.35)"; t.lineWidth = Math.max(0.6, cr * 0.25);
      t.beginPath(); t.arc(cx - cr * 0.15, cy - cr * 0.15, cr, Math.PI * 0.9, Math.PI * 1.7); t.stroke();
    }
    t.restore();

    const [out, o] = offscreen(size, size);
    // 地球照：暗い側は藍色に沈めて、ほんのり模様が見える程度に
    o.globalAlpha = 0.2;
    o.drawImage(tex, 0, 0, size, size);
    o.globalCompositeOperation = "source-atop";
    o.fillStyle = "rgba(40,52,110,0.7)"; o.fillRect(0, 0, size, size);
    o.globalCompositeOperation = "source-over";
    o.globalAlpha = 1;
    // 照らされた側：影の円をぼかして抜き、境界をやわらかく
    const [lit, l] = offscreen(size, size);
    l.drawImage(tex, 0, 0, size, size);
    l.globalCompositeOperation = "destination-out";
    const sx = m + r * 0.52, sy = m - r * 0.3, sr = r * 0.98;
    const sg = l.createRadialGradient(sx, sy, 0, sx, sy, sr);
    sg.addColorStop(0, "rgba(0,0,0,1)"); sg.addColorStop(0.86, "rgba(0,0,0,1)"); sg.addColorStop(1, "rgba(0,0,0,0)");
    l.fillStyle = sg; l.beginPath(); l.arc(sx, sy, sr, 0, Math.PI * 2); l.fill();
    o.drawImage(lit, 0, 0, size, size);
    const res = { img: out, size };
    moonCache.set(key, res);
    return res;
  }
  function drawMoon(ctx, x, y, r, glow = 1) {
    const g = ctx.createRadialGradient(x, y, r * 0.8, x, y, r * 4.5);
    g.addColorStop(0, `rgba(255,232,180,${0.28 * glow})`); g.addColorStop(0.4, `rgba(255,232,180,${0.08 * glow})`); g.addColorStop(1, "rgba(255,232,180,0)");
    ctx.fillStyle = g; ctx.fillRect(x - r * 4.5, y - r * 4.5, r * 9, r * 9);
    const { img, size } = moonImage(r);
    ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
  }

  // 太陽：芯・にじみ・ゆっくり回る光の筋
  function drawSun(ctx, x, y, r, strength, time) {
    const halo = ctx.createRadialGradient(x, y, r * 0.6, x, y, r * 9);
    halo.addColorStop(0, `rgba(255,236,205,${0.5 * strength})`);
    halo.addColorStop(0.25, `rgba(255,214,170,${0.18 * strength})`);
    halo.addColorStop(1, "rgba(255,214,170,0)");
    ctx.fillStyle = halo; ctx.fillRect(x - r * 9, y - r * 9, r * 18, r * 18);
    if (!reduce) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(time / 24000);
      for (let i = 0; i < 12; i++) {
        ctx.rotate(Math.PI / 6);
        const g = ctx.createLinearGradient(0, 0, r * 5, 0);
        g.addColorStop(0, `rgba(255,240,215,${0.16 * strength})`); g.addColorStop(1, "rgba(255,240,215,0)");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(r * 0.9, -r * 0.1); ctx.lineTo(r * 5, -r * (0.35 + (i % 3) * 0.12)); ctx.lineTo(r * 5, r * 0.35); ctx.lineTo(r * 0.9, r * 0.1); ctx.fill();
      }
      ctx.restore();
    }
    const core = ctx.createRadialGradient(x - r * 0.2, y - r * 0.2, 0, x, y, r);
    core.addColorStop(0, "#ffffff"); core.addColorStop(0.7, "#fff3de"); core.addColorStop(1, "#ffdcae");
    ctx.fillStyle = core; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }

  // 雲：やわらかい玉を重ねた、下側が少し影になる積雲。夜明けは暖色に染まる版も用意
  function cloudImages(w, seed) {
    const h = w * 0.62, r = rng(seed);
    const [c, x] = offscreen(w, h);
    const base = h * 0.7;
    // 大きな玉で形、小さな玉で縁のもこもこ
    const big = 6 + Math.floor(r() * 3);
    for (let i = 0; i < big; i++) {
      const t = i / (big - 1), bump = Math.sin(t * Math.PI);
      const rad = w * (0.09 + bump * 0.1 + r() * 0.03);
      blob(x, w * (0.2 + t * 0.6), base - bump * h * 0.22 - rad * 0.2, rad, "rgba(255,255,255,0.96)", 0.62);
    }
    for (let i = 0; i < 22; i++) {
      const t = r(), bump = Math.sin(t * Math.PI);
      const rad = w * (0.03 + r() * 0.045);
      blob(x, w * (0.16 + t * 0.68), base - bump * h * (0.3 + r() * 0.18), rad, "rgba(255,255,255,0.9)", 0.5);
    }
    // 底は平らにそろえる（ふわっと消える）
    x.globalCompositeOperation = "destination-out";
    const cut = x.createLinearGradient(0, base + h * 0.02, 0, base + h * 0.16);
    cut.addColorStop(0, "rgba(0,0,0,0)"); cut.addColorStop(1, "rgba(0,0,0,1)");
    x.fillStyle = cut; x.fillRect(0, base, w, h - base);
    x.globalCompositeOperation = "source-over";
    x.globalCompositeOperation = "source-atop";
    const shade = x.createLinearGradient(0, 0, 0, h);
    shade.addColorStop(0, "rgba(255,255,255,0)"); shade.addColorStop(0.5, "rgba(190,196,230,0.12)"); shade.addColorStop(0.8, "rgba(130,140,200,0.4)"); shade.addColorStop(1, "rgba(120,130,190,0.5)");
    x.fillStyle = shade; x.fillRect(0, 0, w, h);
    const [warm, wx] = offscreen(w, h);
    wx.drawImage(c, 0, 0, w, h);
    wx.globalCompositeOperation = "source-atop";
    const glow = wx.createLinearGradient(w, 0, 0, h);
    glow.addColorStop(0, "rgba(255,196,160,0.55)"); glow.addColorStop(1, "rgba(255,160,150,0.2)");
    wx.fillStyle = glow; wx.fillRect(0, 0, w, h);
    return { cool: c, warm, w, h };
  }

  function fit(canvas) {
    const r = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(r.width * DPR));
    canvas.height = Math.max(1, Math.round(r.height * DPR));
    const ctx = canvas.getContext("2d");
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    return { ctx, w: r.width, h: r.height };
  }

  // ---------- ヒーローの空 ----------
  const sky = $("#sky"), stage = $("#stage"), hero = $(".hero");
  const holiday = $("#holiday"), holidayCap = $("#holidayCap"), hint = $("#hint"), header = $("#header");
  let S = null, stars = [], clouds = [], progress = reduce ? 1 : 0, heroVisible = true;

  let shooting = null, nextShoot = 2500;
  function buildSky() {
    S = fit(sky);
    const r = rng(20261012), narrow = S.w < 700;
    const tints = ["255,250,235", "255,236,210", "215,228,255"];
    stars = Array.from({ length: Math.round((S.w * S.h) / (narrow ? 4200 : 5200)) }, () => ({
      x: r() * S.w, y: r() * S.h * 0.66, s: 0.4 + Math.pow(r(), 3) * 1.9, tw: r() * Math.PI * 2, sp: 0.5 + r() * 1.8,
      c: tints[Math.floor(r() * 3)],
    }));
    clouds = Array.from({ length: narrow ? 3 : 4 }, (_, i) => {
      const w = narrow ? 150 + r() * 90 : 220 + r() * 200;
      return {
        img: cloudImages(w, 50 + i * 7),
        x0: narrow ? -w * 0.3 : S.w * 0.5, span: narrow ? S.w + w * 0.6 : S.w * 0.5 + w * 0.5,
        x: r(), y: S.h * (narrow ? 0.6 + r() * 0.1 : 0.1 + r() * 0.3), sp: 3 + r() * 5, depth: 0.6 + r() * 0.4,
      };
    });
  }

  function hills(ctx, w, h, color, base, amp, freq, phase) {
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 8) {
      const y = h * base - Math.sin(x / w * Math.PI * freq + phase) * amp - Math.sin(x / w * Math.PI * freq * 2.3 + phase * 1.7) * amp * 0.35;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  function drawSky(time) {
    if (!S) return;
    const { ctx, w, h } = S, p = progress, pal = palette(p);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, css(pal.c[0])); g.addColorStop(0.78, css(pal.c[1])); g.addColorStop(1, css(pal.c[2]));
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

    // 星（明けるほど消える。明るい星は十字にきらり）
    const starA = clamp(1 - p / 0.55);
    if (starA > 0) {
      for (const st of stars) {
        const tw = reduce ? 0.8 : 0.5 + 0.5 * Math.sin(time / 1000 * st.sp + st.tw);
        const a = starA * (0.35 + tw * 0.65);
        ctx.fillStyle = `rgba(${st.c},${a})`;
        ctx.beginPath(); ctx.arc(st.x, st.y, st.s, 0, Math.PI * 2); ctx.fill();
        if (st.s > 1.6) {
          ctx.strokeStyle = `rgba(${st.c},${a * 0.5})`; ctx.lineWidth = 0.7;
          ctx.beginPath(); ctx.moveTo(st.x - st.s * 3.2, st.y); ctx.lineTo(st.x + st.s * 3.2, st.y);
          ctx.moveTo(st.x, st.y - st.s * 3.2); ctx.lineTo(st.x, st.y + st.s * 3.2); ctx.stroke();
        }
      }
      // 流れ星（夜のあいだだけ、ときどき）
      if (!reduce && p < 0.3) {
        if (!shooting && time > nextShoot) {
          const r = Math.random;
          shooting = { t0: time, x: w * (0.45 + r() * 0.5), y: h * (0.05 + r() * 0.2), dx: -(w * 0.25 + r() * w * 0.2), dy: h * (0.12 + r() * 0.1) };
          nextShoot = time + 5000 + r() * 6000;
        }
        if (shooting) {
          const k = (time - shooting.t0) / 900;
          if (k >= 1) shooting = null;
          else {
            const hx = shooting.x + shooting.dx * k, hy = shooting.y + shooting.dy * k;
            const tx = hx - shooting.dx * 0.22, ty = hy - shooting.dy * 0.22;
            const g = ctx.createLinearGradient(hx, hy, tx, ty);
            g.addColorStop(0, `rgba(255,250,235,${(1 - k) * starA})`); g.addColorStop(1, "rgba(255,250,235,0)");
            ctx.strokeStyle = g; ctx.lineWidth = 1.6; ctx.lineCap = "round";
            ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(tx, ty); ctx.stroke();
          }
        }
      }
    }

    // 月（夜は右上に、明けると沈んで薄れる）
    const moonA = clamp(1 - p / 0.5);
    if (moonA > 0) {
      const mr = Math.max(24, Math.min(w, h) * 0.05);
      ctx.save(); ctx.globalAlpha = moonA;
      drawMoon(ctx, w * (w < 700 ? 0.8 : 0.8), h * (0.17 + p * 0.5), mr, moonA);
      ctx.restore();
    }

    // 太陽（地平線から昇る。スマホは地平線のすぐ上まで）
    const sunT = clamp((p - 0.28) / 0.72);
    if (sunT > 0) {
      const narrow = w < 700;
      const sx = w * (narrow ? 0.8 : 0.84 + sunT * 0.02);
      const sy = h * (0.92 - smooth(sunT) * (narrow ? 0.24 : 0.64));
      drawSun(ctx, sx, sy, Math.max(narrow ? 20 : 28, Math.min(w, h) * 0.045), 0.4 + sunT * 0.6, time);
    }

    // 地平線のもや（夜明けにほんのり）
    const mist = Math.sin(clamp((p - 0.25) / 0.6) * Math.PI) * 0.35;
    if (mist > 0.01) {
      const mg = ctx.createLinearGradient(0, h * 0.62, 0, h * 0.9);
      mg.addColorStop(0, "rgba(255,200,180,0)"); mg.addColorStop(1, `rgba(255,200,180,${mist})`);
      ctx.fillStyle = mg; ctx.fillRect(0, h * 0.62, w, h * 0.3);
    }

    // 雲（朝に向けて見えてくる。夜明けは暖色）
    const cloudA = clamp((p - 0.22) / 0.45);
    if (cloudA > 0) {
      const warmth = Math.sin(clamp((p - 0.25) / 0.65) * Math.PI);
      for (const c of clouds) {
        const x = c.x0 + ((c.x * c.span + (reduce ? 0 : (time / 1000) * c.sp)) % c.span) - c.img.w / 2;
        const y = c.y - c.img.h / 2;
        ctx.globalAlpha = cloudA * 0.85 * c.depth;
        ctx.drawImage(c.img.cool, x, y, c.img.w, c.img.h);
        if (warmth > 0.02) { ctx.globalAlpha = cloudA * 0.85 * c.depth * warmth; ctx.drawImage(c.img.warm, x, y, c.img.w, c.img.h); }
        ctx.globalAlpha = 1;
      }
    }

    hills(ctx, w, h, css(pal.hill[1]), 0.86, h * 0.035, 3, 0.8);
    hills(ctx, w, h, css(pal.hill[0]), 0.93, h * 0.03, 2, 2.1);
  }

  function updateHero() {
    const lit = progress > 0.5, rest = progress > 0.62;
    stage.classList.toggle("lit", lit);
    holiday.classList.toggle("rest", rest);
    holidayCap.textContent = rest ? (innerWidth < 560 ? "おやすみ" : "スポーツの日") : "7:00";
    hint.style.opacity = String(clamp(1 - progress * 6) * 0.85);
  }

  function readScroll() {
    if (reduce) return;
    const top = hero.offsetTop, span = hero.offsetHeight - innerHeight;
    progress = clamp((scrollY - top) / Math.max(1, span * 0.85));
  }

  let last = -1;
  function frame(t) {
    readScroll();
    header.classList.toggle("solid", scrollY > hero.offsetTop + hero.offsetHeight - 80);
    if (heroVisible && (progress !== last || !reduce)) {
      drawSky(t); updateHero(); last = progress;
    }
    if (!reduce) requestAnimationFrame(frame);
  }

  new IntersectionObserver(([e]) => { heroVisible = e.isIntersecting; }).observe(hero);
  addEventListener("resize", () => { buildSky(); drawSky(performance.now()); }, { passive: true });
  if (reduce) {
    addEventListener("scroll", () => header.classList.toggle("solid", scrollY > hero.offsetHeight - 80), { passive: true });
  }
  buildSky();
  if (reduce) { drawSky(0); updateHero(); } else requestAnimationFrame(frame);

  // ---------- 実画面の登場（1 回だけ） ----------
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
  }), { threshold: 0.25 });
  document.querySelectorAll(".phone").forEach((el) => io.observe(el));

  // ---------- 音の試聴と、月の光の輪 ----------
  const halo = $("#halo");
  let H = null, audio = null, analyser = null, actx = null, data = null, playingBtn = null, haloVisible = false;
  function buildHalo() { H = fit(halo); }
  function level() {
    if (!analyser) return 0;
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sum += v * v; }
    return Math.min(1, Math.sqrt(sum / data.length) * 4);
  }
  const rings = [];
  let lastRing = 0;
  function drawHalo(t) {
    if (!H) return;
    const { ctx, w, h } = H, cx = w / 2, cy = h / 2, r = w * 0.16;
    ctx.clearRect(0, 0, w, h);
    const lv = level();
    if (!reduce && t - lastRing > (playingBtn ? 380 - lv * 220 : 1400)) {
      rings.push({ r: r * 1.05, a: playingBtn ? 0.35 + lv * 0.5 : 0.18 }); lastRing = t;
    }
    for (let i = rings.length - 1; i >= 0; i--) {
      const g = rings[i];
      g.r += reduce ? 0 : 0.9 + lv * 1.6; g.a *= 0.985;
      if (g.r > w * 0.5 || g.a < 0.01) { rings.splice(i, 1); continue; }
      ctx.strokeStyle = `rgba(255,227,166,${g.a})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, g.r, 0, Math.PI * 2); ctx.stroke();
    }
    const glow = ctx.createRadialGradient(cx, cy, r * 0.4, cx, cy, r * (2.2 + lv));
    glow.addColorStop(0, `rgba(255,227,166,${0.35 + lv * 0.3})`); glow.addColorStop(1, "rgba(255,227,166,0)");
    ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
    drawMoon(ctx, cx, cy, r, 0.6 + lv);
  }
  function haloLoop(t) { if (haloVisible) drawHalo(t); requestAnimationFrame(haloLoop); }
  new IntersectionObserver(([e]) => { haloVisible = e.isIntersecting; }).observe(halo);
  addEventListener("resize", buildHalo, { passive: true });
  buildHalo();
  if (reduce) drawHalo(0); else requestAnimationFrame(haloLoop);

  function setIcon(btn, playing) {
    btn.setAttribute("aria-pressed", String(playing));
    btn.querySelector(".ic use").setAttribute("href", playing ? "#i-stop" : "#i-play");
  }
  function stop() {
    if (audio) { audio.pause(); audio = null; }
    if (playingBtn) setIcon(playingBtn, false);
    playingBtn = null;
  }
  document.querySelectorAll(".sound").forEach((btn) => btn.addEventListener("click", () => {
    const same = playingBtn === btn;
    stop();
    if (same) return;
    audio = new Audio(btn.dataset.src);
    audio.volume = 0.8;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const src = actx.createMediaElementSource(audio);
      analyser = actx.createAnalyser(); analyser.fftSize = 1024;
      data = new Uint8Array(analyser.fftSize);
      src.connect(analyser); analyser.connect(actx.destination);
      actx.resume();
    } catch { analyser = null; }
    audio.addEventListener("ended", stop);
    audio.play().catch(stop);
    playingBtn = btn; setIcon(btn, true);
  }));

  // ---------- フッターの星 ----------
  const fsky = $("#footerSky");
  let F = null, fstars = [], footVisible = false;
  function buildFoot() {
    F = fit(fsky);
    const r = rng(7);
    fstars = Array.from({ length: Math.round((F.w * F.h) / 4200) }, () => ({ x: r() * F.w, y: r() * F.h, s: 0.4 + r() * 1.3, tw: r() * 6.28, sp: 0.5 + r() }));
  }
  function drawFoot(t) {
    const { ctx, w, h } = F;
    ctx.clearRect(0, 0, w, h);
    for (const s of fstars) {
      ctx.fillStyle = `rgba(255,248,225,${reduce ? 0.7 : 0.35 + 0.45 * Math.sin(t / 1000 * s.sp + s.tw)})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.s, 0, Math.PI * 2); ctx.fill();
    }
  }
  function footLoop(t) { if (footVisible) drawFoot(t); requestAnimationFrame(footLoop); }
  new IntersectionObserver(([e]) => { footVisible = e.isIntersecting; }).observe(fsky);
  addEventListener("resize", () => { buildFoot(); drawFoot(0); }, { passive: true });
  buildFoot();
  if (reduce) drawFoot(0); else requestAnimationFrame(footLoop);
})();
