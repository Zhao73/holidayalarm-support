// 祝日アラーム 公式サイト：スクロールで夜 → 朝、祝日の太陽が月に変わる。音の試聴に合わせて月のまわりに光の輪。
(() => {
  "use strict";
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const $ = (s) => document.querySelector(s);

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

  function fit(canvas) {
    const r = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(r.width * DPR));
    canvas.height = Math.max(1, Math.round(r.height * DPR));
    const ctx = canvas.getContext("2d");
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    return { ctx, w: r.width, h: r.height };
  }

  // 細い三日月（音の試聴のまわりの光の輪で使う）。空の月は sky.js が描く。
  function drawMoon(ctx, x, y, r, glow = 1) {
    const g = ctx.createRadialGradient(x, y, r * 0.7, x, y, r * 4);
    g.addColorStop(0, `rgba(255,232,190,${0.22 * glow})`); g.addColorStop(0.45, `rgba(255,232,190,${0.06 * glow})`); g.addColorStop(1, "rgba(255,232,190,0)");
    ctx.fillStyle = g; ctx.fillRect(x - r * 4, y - r * 4, r * 8, r * 8);
    // 暗い側（地球照）
    ctx.fillStyle = "rgba(196,202,238,0.16)";
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    // 照らされた側：円から、ずらした円を引く
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
    ctx.beginPath(); ctx.rect(x - r * 2, y - r * 2, r * 4, r * 4);
    ctx.arc(x + r * 0.42, y - r * 0.22, r * 0.94, 0, Math.PI * 2, true);
    const lit = ctx.createLinearGradient(x - r, y + r, x + r * 0.2, y - r);
    lit.addColorStop(0, "#fff6e2"); lit.addColorStop(1, "#f3ddb0");
    ctx.fillStyle = lit; ctx.fill("evenodd");
    ctx.restore();
  }

  // ---------- ヒーローの空（sky.js・WebGL） ----------
  const sky = $("#sky"), stage = $("#stage"), hero = $(".hero");
  const holiday = $("#holiday"), holidayCap = $("#holidayCap"), hint = $("#hint"), header = $("#header");
  let progress = reduce ? 1 : 0, heroVisible = true;
  const narrow = () => innerWidth < 700;
  const heroSky = window.HolidaySky && window.HolidaySky.createSky(sky, { horizon: narrow() ? 0.2 : 0.24, moon: 1 });
  // WebGL が使えないときは、同じ色の CSS グラデーションだけを見せる
  if (!heroSky) stage.classList.add("no-gl");
  function drawSky(time) { if (heroSky) heroSky.draw(progress, time / 1000); }

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

  let last = -1, lastDraw = 0;
  function frame(t) {
    readScroll();
    header.classList.toggle("solid", scrollY > hero.offsetTop + hero.offsetHeight - 80);
    if (heroVisible && (progress !== last || t - lastDraw > 33)) {
      drawSky(t); lastDraw = t;
      if (progress !== last) { updateHero(); last = progress; }
    }
    if (!reduce) requestAnimationFrame(frame);
  }

  new IntersectionObserver(([e]) => { heroVisible = e.isIntersecting; }).observe(hero);
  addEventListener("resize", () => { if (heroSky) heroSky.resize(); drawSky(performance.now()); }, { passive: true });
  if (reduce) {
    addEventListener("scroll", () => header.classList.toggle("solid", scrollY > hero.offsetHeight - 80), { passive: true });
  }
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

  // ---------- フッターの夜空（sky.js） ----------
  const fsky = $("#footerSky");
  const footSky = window.HolidaySky && window.HolidaySky.createSky(fsky, { horizon: -1, moon: 0 });
  let footVisible = false, lastFoot = 0;
  function footLoop(t) {
    if (footVisible && footSky && t - lastFoot > 50) { footSky.draw(0, t / 1000); lastFoot = t; }
    requestAnimationFrame(footLoop);
  }
  new IntersectionObserver(([e]) => { footVisible = e.isIntersecting; }).observe(fsky);
  addEventListener("resize", () => { if (footSky) { footSky.resize(); footSky.draw(0, 0); } }, { passive: true });
  if (footSky) { if (reduce) footSky.draw(0, 0); else requestAnimationFrame(footLoop); }
})();
