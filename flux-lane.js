(() => {
  "use strict";

  const LS_BEST = "fluxLane.v1.best";
  const LS_BEST_STREAK = "fluxLane.v1.bestStreak";
  const LS_MUTE = "fluxLane.v1.muted";

  const W = 900;
  const H = 600;
  const PLAYER_X = 152;
  const PLAYER_R = 12;
  const COL_W = 50;
  const BASE_GAP = 120;
  const MIN_GAP = 66;
  const MIN_Y = 102;
  const NEAR_MISS_PX = 17;
  const ACCEL = 5600;
  const FRICTION = 11;
  const MAX_VY = 450;
  const MAX_PARTICLES = 260;
  const PASS_LINE = 32;

  const canvas = document.getElementById("game-flux");
  const ctx = canvas && canvas.getContext("2d");
  const scoreEl = document.getElementById("flux-score");
  const streakEl = document.getElementById("flux-streak");
  const bestEl = document.getElementById("flux-best");
  const hintEl = document.getElementById("flux-hint");
  const overlay = document.getElementById("flux-overlay");
  const overlayTitle = document.getElementById("flux-overlay-title");
  const overlayText = document.getElementById("flux-overlay-text");
  const overlayScore = document.getElementById("flux-overlay-score");
  const overlayMeta = document.getElementById("flux-overlay-meta");
  const startBtn = document.getElementById("flux-start");
  const muteBtn = document.getElementById("flux-mute");

  if (!canvas || !ctx) return;

  let reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let best = 0;
  let bestStreakEver = 0;
  let muted = false;
  try {
    const n = parseInt(localStorage.getItem(LS_BEST) || "0", 10);
    best = Number.isFinite(n) ? n : 0;
    const s = parseInt(localStorage.getItem(LS_BEST_STREAK) || "0", 10);
    bestStreakEver = Number.isFinite(s) ? s : 0;
    muted = localStorage.getItem(LS_MUTE) === "1";
  } catch {
    best = 0;
    bestStreakEver = 0;
    muted = false;
  }
  if (bestEl) bestEl.textContent = String(best);
  syncMuteBtn();

  let audioCtx = null;
  let fluxMasterGain = null;
  let fluxMusicGain = null;
  let musicFilter = null;
  let musicGraphReady = false;

  function syncMuteBtn() {
    if (!muteBtn) return;
    muteBtn.textContent = muted ? "Sound off" : "Sound on";
    muteBtn.setAttribute("aria-pressed", muted ? "true" : "false");
  }

  function ensureAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    initFluxMusicGraph();
  }

  /** Layered oscillator drone + low-pass; fades with `syncFluxMusic` (play / pause / menu / mute). */
  function initFluxMusicGraph() {
    if (!audioCtx || musicGraphReady) return;
    musicGraphReady = true;
    fluxMasterGain = audioCtx.createGain();
    fluxMasterGain.gain.value = 0.82;
    fluxMasterGain.connect(audioCtx.destination);

    fluxMusicGain = audioCtx.createGain();
    fluxMusicGain.gain.value = 0;

    musicFilter = audioCtx.createBiquadFilter();
    musicFilter.type = "lowpass";
    musicFilter.frequency.value = 480;
    musicFilter.Q.value = 0.65;

    const mix = audioCtx.createGain();
    mix.gain.value = 0.26;
    const freqs = [65.41, 77.78, 98.0, 116.54];
    const weights = [0.34, 0.28, 0.22, 0.16];
    for (let i = 0; i < freqs.length; i++) {
      const o = audioCtx.createOscillator();
      o.type = "sine";
      o.frequency.value = freqs[i];
      const og = audioCtx.createGain();
      og.gain.value = weights[i];
      o.connect(og);
      og.connect(mix);
      o.start();
    }

    mix.connect(musicFilter);
    musicFilter.connect(fluxMusicGain);
    fluxMusicGain.connect(fluxMasterGain);
  }

  function syncFluxMusic() {
    ensureAudio();
    initFluxMusicGraph();
    if (!audioCtx || !fluxMusicGain) return;
    const t = audioCtx.currentTime;
    const shouldPlay = !muted && state === "play" && fluxShellActive();
    const target = shouldPlay ? (reducedMotion ? 0.0085 : 0.0175) : 0;
    fluxMusicGain.gain.cancelScheduledValues(t);
    fluxMusicGain.gain.setValueAtTime(fluxMusicGain.gain.value, t);
    fluxMusicGain.gain.linearRampToValueAtTime(target, t + (target > 0 ? 0.9 : 0.38));
  }

  function beep(freq, dur, vol = 0.065, type = "sine") {
    ensureAudio();
    if (muted || !audioCtx) return;
    initFluxMusicGraph();
    if (!fluxMasterGain) return;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type;
    o.frequency.value = freq;
    const t0 = audioCtx.currentTime;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(fluxMasterGain);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  function toneDown(freq, dur, vol = 0.09) {
    ensureAudio();
    if (muted || !audioCtx) return;
    initFluxMusicGraph();
    if (!fluxMasterGain) return;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(freq * 1.2, audioCtx.currentTime);
    o.frequency.exponentialRampToValueAtTime(freq * 0.5, audioCtx.currentTime + dur);
    const t0 = audioCtx.currentTime;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(fluxMasterGain);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  if (muteBtn) {
    muteBtn.addEventListener("click", () => {
      muted = !muted;
      try {
        localStorage.setItem(LS_MUTE, muted ? "1" : "0");
      } catch {
        /* ignore */
      }
      syncMuteBtn();
      ensureAudio();
      syncFluxMusic();
    });
  }

  const stars = [];
  for (let i = 0; i < 96; i++) {
    stars.push({
      x: Math.random() * W,
      y: Math.random() * H,
      s: 0.3 + Math.random() * 1.4,
      tw: Math.random() * Math.PI * 2,
    });
  }

  let state = "menu";
  let loopRunning = false;
  let last = performance.now();
  let py = H * 0.5;
  let vy = 0;
  let obstacles = [];
  let particles = [];
  let spawnAcc = 0.45;
  let speed = 208;
  let score = 0;
  let runT = 0;
  let bgPhase = 0;
  let gapTargetY = H * 0.5;
  let streak = 0;
  let maxStreakRun = 0;
  let gatesCleared = 0;
  let nearMisses = 0;
  let shake = 0;
  const keys = {};
  /** -1 = steer up, 0 = none, 1 = down — set by touch/pointer on canvas (mobile). */
  let pointerSteer = 0;
  let fluxPointerActive = false;

  function syncCanvasSize() {
    const rect = canvas.getBoundingClientRect();
    let rw = rect.width;
    let rh = rect.height;
    if (rw < 2 || rh < 2) {
      rw = canvas.offsetWidth || canvas.clientWidth;
      rh = canvas.offsetHeight || canvas.clientHeight;
    }
    if (rw < 2 || rh < 2) {
      rw = W;
      rh = H;
    }
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const bw = Math.max(1, Math.round(rw * dpr));
    const bh = Math.max(1, Math.round(rh * dpr));
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }
    ctx.setTransform(bw / W, 0, 0, bh / H, 0, 0);
  }

  function circleRect(cx, cy, r, rx, ry, rw, rh) {
    const nx = Math.max(rx, Math.min(cx, rx + rw));
    const ny = Math.max(ry, Math.min(cy, ry + rh));
    const dx = cx - nx;
    const dy = cy - ny;
    return dx * dx + dy * dy < r * r;
  }

  function canSpawn() {
    if (obstacles.length === 0) return true;
    let maxR = 0;
    for (const o of obstacles) {
      maxR = Math.max(maxR, o.x + o.w * 0.5);
    }
    return maxR < W - 228;
  }

  function spawnColumn() {
    gapTargetY += (Math.random() - 0.5) * 168;
    gapTargetY = Math.max(MIN_Y, Math.min(H - MIN_Y, gapTargetY));
    const gh = Math.max(MIN_GAP, BASE_GAP - Math.min(38, score * 0.011));
    obstacles.push({
      x: W + COL_W * 0.5 + 24,
      gapY: gapTargetY,
      w: COL_W,
      gh,
      passScored: false,
    });
  }

  function addParticles(x, y, count, color, spread = 190) {
    const cap = reducedMotion ? 48 : MAX_PARTICLES;
    const n = Math.min(count, Math.max(0, cap - particles.length));
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      const sp = spread * (0.35 + Math.random() * 0.65);
      particles.push({
        x,
        y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - 40 * Math.random(),
        life: 0.35 + Math.random() * 0.45,
        color,
        size: 1.2 + Math.random() * 2.2,
      });
    }
  }

  function resetRun() {
    py = H * 0.5;
    vy = 0;
    obstacles = [];
    particles = [];
    spawnAcc = 0.42;
    speed = 208;
    score = 0;
    runT = 0;
    gapTargetY = H * 0.5;
    streak = 0;
    maxStreakRun = 0;
    gatesCleared = 0;
    nearMisses = 0;
    shake = 0;
  }

  function saveBest(s) {
    let nb = false;
    if (s > best) {
      best = s;
      try {
        localStorage.setItem(LS_BEST, String(best));
      } catch {
        /* ignore */
      }
      nb = true;
    }
    if (maxStreakRun > bestStreakEver) {
      bestStreakEver = maxStreakRun;
      try {
        localStorage.setItem(LS_BEST_STREAK, String(bestStreakEver));
      } catch {
        /* ignore */
      }
    }
    if (bestEl) bestEl.textContent = String(best);
    return nb;
  }

  function formatTime(sec) {
    const t = Math.max(0, sec);
    const s = Math.floor(t % 60);
    const m = Math.floor(t / 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function openMenu(title, text, showLastScore, lastScoreVal, meta) {
    state = "menu";
    if (overlayTitle) overlayTitle.textContent = title;
    if (overlayText) overlayText.textContent = text;
    if (overlayScore) {
      if (showLastScore) {
        overlayScore.hidden = false;
        overlayScore.textContent = `Score ${lastScoreVal}`;
      } else {
        overlayScore.hidden = true;
        overlayScore.textContent = "";
      }
    }
    if (overlayMeta) {
      if (meta != null && meta !== "") {
        overlayMeta.hidden = false;
        overlayMeta.textContent = meta;
      } else {
        overlayMeta.hidden = true;
        overlayMeta.textContent = "";
      }
    }
    if (overlay) overlay.classList.remove("hidden");
    if (scoreEl) {
      if (showLastScore) scoreEl.textContent = String(lastScoreVal);
      else scoreEl.textContent = "0";
    }
    if (streakEl) streakEl.textContent = "×1";
    syncFluxMusic();
  }

  function closeMenuForPlay() {
    ensureAudio();
    if (overlay) overlay.classList.add("hidden");
    state = "play";
    syncFluxMusic();
  }

  function fluxShellActive() {
    const sh = document.getElementById("game-shell-flux");
    return sh && !sh.classList.contains("hidden") && !sh.hasAttribute("hidden");
  }

  function die() {
    saveBest(score);
    obstacles = [];
    particles = [];
    vy = 0;
    shake = reducedMotion ? 4 : 14;
    const meta = `Time ${formatTime(runT)} · Gates ${gatesCleared} · Near-misses ${nearMisses} · Best streak ${maxStreakRun} · Record streak ${bestStreakEver}`;
    openMenu(
      "Run over",
      "Thread the gates — tight clears build flux streak for bigger rewards.",
      true,
      score,
      meta,
    );
    toneDown(140, 0.28, 0.1);
  }

  function processGatePass(o) {
    if (o.passScored) return;
    if (o.x + o.w * 0.5 >= PLAYER_X - PASS_LINE) return;
    o.passScored = true;
    gatesCleared++;
    streak++;
    maxStreakRun = Math.max(maxStreakRun, streak);

    const half = o.gh * 0.5;
    const top = o.gapY - half;
    const bot = o.gapY + half;
    const inGap = py >= top && py <= bot;
    const edgeDist = inGap ? Math.min(py - top, bot - py) : -1;
    const near = inGap && edgeDist >= 0 && edgeDist < NEAR_MISS_PX;

    if (near) {
      nearMisses++;
      const bonus = Math.floor(52 + streak * 14 + nearMisses * 2);
      score += bonus;
      addParticles(PLAYER_X, py, reducedMotion ? 10 : 22, "#7fffd4", 260);
      beep(440 + Math.min(180, streak * 12), 0.07, 0.08, "sine");
      if (!reducedMotion) shake = Math.min(10, shake + 4);
      if (!reducedMotion) {
        addParticles(PLAYER_X + 40, (top + bot) * 0.5, 8, "rgba(255,200,120,0.9)", 80);
      }
    } else {
      const bonus = Math.floor(32 + streak * 11);
      score += bonus;
      addParticles(o.x - 20, o.gapY, reducedMotion ? 5 : 10, "#66ccff", 120);
      beep(260 + Math.min(120, streak * 6), 0.055, 0.055);
    }
  }

  function tick(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    bgPhase += dt * 0.88;

    if (shake > 0) {
      shake *= Math.pow(0.15, dt * 60);
      if (shake < 0.35) shake = 0;
    }

    const playing = state === "play";
    const paused = state === "pause";

    if (playing || paused) {
      runT += dt;
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 420 * dt;
      p.vx *= Math.exp(-0.8 * dt);
      if (p.life <= 0) particles.splice(i, 1);
    }

    if (playing) {
      let dir = 0;
      if (pointerSteer !== 0) {
        dir = pointerSteer;
      } else {
        if (keys.ArrowUp || keys.KeyW) dir -= 1;
        if (keys.ArrowDown || keys.KeyS) dir += 1;
      }
      vy += dir * ACCEL * dt;
      vy *= Math.exp(-FRICTION * dt);
      vy = Math.max(-MAX_VY, Math.min(MAX_VY, vy));
      py += vy * dt;
      py = Math.max(PLAYER_R + 10, Math.min(H - PLAYER_R - 10, py));

      speed =
        208 +
        Math.min(400, score * 0.16 + runT * 7.5 + gatesCleared * 1.1);

      spawnAcc -= dt;
      if (spawnAcc <= 0 && canSpawn()) {
        spawnColumn();
        spawnAcc = Math.max(0.52, 0.92 + Math.random() * 0.38 - Math.min(0.22, score * 0.001));
      }

      for (const o of obstacles) {
        o.x -= speed * dt;
      }
      obstacles = obstacles.filter((o) => o.x > -COL_W * 3);

      let hit = false;
      for (const o of obstacles) {
        const half = o.gh * 0.5;
        const top = o.gapY - half;
        const bot = o.gapY + half;
        const x0 = o.x - o.w * 0.5;
        if (
          circleRect(PLAYER_X, py, PLAYER_R, x0, 0, o.w, top) ||
          circleRect(PLAYER_X, py, PLAYER_R, x0, bot, o.w, H - bot)
        ) {
          hit = true;
          break;
        }
      }

      if (hit) {
        die();
      } else {
        for (const o of obstacles) {
          processGatePass(o);
        }
        const fluxMult = 1 + Math.min(1.55, streak * 0.055);
        score += Math.floor(11 * dt * (1 + speed / 420) * fluxMult);
      }

      if (!muted && musicFilter && audioCtx && playing) {
        const sweep = 0.45;
        const f = 360 + 480 * (0.5 + 0.5 * Math.sin(runT * sweep));
        musicFilter.frequency.setTargetAtTime(f, audioCtx.currentTime, 0.22);
      }
    }

    draw(playing, paused);
    if (loopRunning) requestAnimationFrame(tick);
  }

  function draw(playing, paused) {
    syncCanvasSize();

    let sx = 0;
    let sy = 0;
    if (shake > 0) {
      sx = (Math.random() - 0.5) * shake * 2.2;
      sy = (Math.random() - 0.5) * shake * 2.2;
    }

    ctx.save();
    ctx.translate(sx, sy);

    const g = ctx.createRadialGradient(W * 0.35, -40, 0, W * 0.5, H * 0.5, Math.hypot(W, H));
    g.addColorStop(0, "#0a1220");
    g.addColorStop(0.55, "#070a10");
    g.addColorStop(1, "#040608");
    ctx.fillStyle = g;
    ctx.fillRect(-sx, -sy, W + Math.abs(sx) * 2, H + Math.abs(sy) * 2);

    ctx.globalAlpha = 1;
    for (const st of stars) {
      const tw = 0.55 + 0.45 * Math.sin(bgPhase * 1.2 + st.tw);
      ctx.fillStyle = `rgba(200, 230, 255, ${0.12 * tw * st.s})`;
      ctx.beginPath();
      ctx.arc(st.x, st.y, st.s, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = "rgba(61, 255, 206, 0.045)";
    ctx.lineWidth = 1;
    const off = (bgPhase * 42) % 88;
    for (let x = -off; x < W + 100; x += 88) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    const off2 = (bgPhase * 22) % 140;
    ctx.strokeStyle = "rgba(80, 140, 200, 0.035)";
    for (let y = -off2; y < H + 140; y += 140) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    for (const o of obstacles) {
      const half = o.gh * 0.5;
      const top = o.gapY - half;
      const bot = o.gapY + half;
      const x0 = o.x - o.w * 0.5;
      const ahead = o.x - PLAYER_X;
      const tele = ahead > 40 && ahead < 420;
      if (tele) {
        ctx.save();
        ctx.globalAlpha = Math.min(0.45, (ahead - 40) / 200) * 0.5;
        ctx.strokeStyle = "rgba(120, 255, 230, 0.35)";
        ctx.setLineDash([4, 10]);
        ctx.beginPath();
        ctx.moveTo(o.x, top);
        ctx.lineTo(o.x, bot);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      ctx.save();
      ctx.shadowColor = "rgba(61, 255, 206, 0.4)";
      ctx.shadowBlur = 16;
      const gr = ctx.createLinearGradient(x0, 0, x0 + o.w, 0);
      gr.addColorStop(0, "rgba(40, 120, 140, 0.35)");
      gr.addColorStop(0.5, "rgba(61, 255, 206, 0.5)");
      gr.addColorStop(1, "rgba(40, 120, 140, 0.35)");
      ctx.fillStyle = gr;
      ctx.fillRect(x0, 0, o.w, top);
      ctx.fillRect(x0, bot, o.w, H - bot);
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(160, 255, 230, 0.55)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x0 + 0.5, 0.5, o.w - 1, top - 1);
      ctx.strokeRect(x0 + 0.5, bot + 0.5, o.w - 1, H - bot - 1);
      const lip = Math.min(6, top * 0.08);
      ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
      ctx.fillRect(x0 + 2, top - lip, o.w - 4, lip);
      ctx.fillRect(x0 + 2, bot, o.w - 4, lip);
      ctx.restore();
    }

    for (const p of particles) {
      ctx.globalAlpha = Math.min(1, p.life * 3);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    const hotStreak = streak >= 4;
    ctx.save();
    ctx.translate(PLAYER_X, py);
    ctx.rotate(-vy * 0.0019);
    if (hotStreak && !reducedMotion) {
      ctx.shadowColor = "rgba(255, 200, 120, 0.75)";
      ctx.shadowBlur = 22 + Math.sin(runT * 14) * 4;
    } else {
      ctx.shadowColor = "rgba(100, 180, 255, 0.85)";
      ctx.shadowBlur = 15;
    }
    ctx.beginPath();
    ctx.moveTo(PLAYER_R * 1.2, 0);
    ctx.lineTo(-PLAYER_R * 0.82, PLAYER_R * 0.75);
    ctx.lineTo(-PLAYER_R * 0.42, 0);
    ctx.lineTo(-PLAYER_R * 0.82, -PLAYER_R * 0.75);
    ctx.closePath();
    ctx.fillStyle = hotStreak ? "#fff8f0" : "#e8f4ff";
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(61, 255, 206, 0.45)";
    ctx.beginPath();
    ctx.moveTo(-PLAYER_R * 0.55, 2);
    ctx.lineTo(-PLAYER_R * 1.05, 4 + Math.sin(runT * 40) * 2);
    ctx.lineTo(-PLAYER_R * 1.05, -4 - Math.sin(runT * 40) * 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(61, 255, 206, 0.55)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();

    if (paused) {
      ctx.fillStyle = "rgba(6, 9, 13, 0.78)";
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = "center";
      ctx.font = "700 32px Outfit, system-ui, sans-serif";
      ctx.fillStyle = "#e8f0ff";
      ctx.fillText("Paused", W * 0.5, H * 0.5 - 8);
      ctx.font = "400 14px Outfit, system-ui, sans-serif";
      ctx.fillStyle = "rgba(107, 122, 144, 0.95)";
      ctx.fillText("P or Space to resume", W * 0.5, H * 0.5 + 22);
    }

    ctx.restore();

    if (playing || paused) {
      if (scoreEl) scoreEl.textContent = String(score);
      if (streakEl) streakEl.textContent = `×${Math.max(1, streak)}`;
    }
  }

  function startLoop() {
    if (loopRunning) return;
    loopRunning = true;
    last = performance.now();
    requestAnimationFrame(tick);
  }

  function stopLoop() {
    loopRunning = false;
    fluxPointerActive = false;
    pointerSteer = 0;
  }

  function bootFlux() {
    resetRun();
    openMenu(
      "Flux Lane",
      "Steer through every gate. Tight clears score big and raise your flux multiplier. Gates get tighter and faster over time. Keys: W S or ↑ ↓ · P pause · R restart on menu.",
      false,
      0,
    );
    if (hintEl) {
      hintEl.textContent =
        "Ambient music · mute in footer · W S or arrows · touch-and-drag on playfield (upper / lower third steers) · P pause · Enter / Start";
    }
    requestAnimationFrame(() => {
      startLoop();
    });
  }

  window.addEventListener("arcade:play", (e) => {
    const id = e.detail && e.detail.id;
    if (id === "flux-lane") {
      bootFlux();
    } else {
      stopLoop();
      syncFluxMusic();
    }
  });

  window.addEventListener("arcade:leave", () => {
    stopLoop();
    state = "menu";
    if (overlay) overlay.classList.remove("hidden");
    syncFluxMusic();
  });

  window.addEventListener("keydown", (e) => {
    if (!fluxShellActive()) return;

    const menuOpen = overlay && !overlay.classList.contains("hidden");

    if (menuOpen && state === "menu") {
      if (e.code === "Enter" || e.code === "Space") {
        e.preventDefault();
        ensureAudio();
        resetRun();
        closeMenuForPlay();
      }
      if (e.code === "KeyR") {
        e.preventDefault();
        ensureAudio();
        resetRun();
        openMenu(
          "Flux Lane",
          "Steer through every gate. Tight clears score big and raise your flux multiplier.",
          false,
          0,
        );
      }
      return;
    }

    keys[e.code] = true;

    if (state === "play") {
      if (e.code === "KeyP") {
        e.preventDefault();
        state = "pause";
        syncFluxMusic();
      } else if (e.code === "Space") {
        e.preventDefault();
        state = "pause";
        syncFluxMusic();
      }
    } else if (state === "pause") {
      if (e.code === "KeyP" || e.code === "Space") {
        e.preventDefault();
        state = "play";
        syncFluxMusic();
      }
    }
  });

  window.addEventListener("keyup", (e) => {
    if (!fluxShellActive()) return;
    keys[e.code] = false;
  });

  if (startBtn) {
    startBtn.addEventListener("click", () => {
      ensureAudio();
      resetRun();
      closeMenuForPlay();
    });
  }

  function updateFluxPointerSteer(clientY) {
    const rect = canvas.getBoundingClientRect();
    if (rect.height < 8) return;
    const fy = (clientY - rect.top) / rect.height;
    if (fy < 0.36) pointerSteer = -1;
    else if (fy > 0.64) pointerSteer = 1;
    else pointerSteer = 0;
  }

  canvas.addEventListener(
    "pointerdown",
    (e) => {
      if (!fluxShellActive() || state !== "play") return;
      if (e.pointerType === "mouse") return;
      if (e.pointerType === "pen" && e.button !== 0) return;
      fluxPointerActive = true;
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      updateFluxPointerSteer(e.clientY);
    },
    { passive: true },
  );
  canvas.addEventListener(
    "pointermove",
    (e) => {
      if (!fluxPointerActive || !fluxShellActive() || state !== "play") return;
      updateFluxPointerSteer(e.clientY);
    },
    { passive: true },
  );
  function endFluxPointer(e) {
    if (e) {
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
    fluxPointerActive = false;
    pointerSteer = 0;
  }
  canvas.addEventListener("pointerup", endFluxPointer);
  canvas.addEventListener("pointercancel", endFluxPointer);
  canvas.addEventListener("lostpointercapture", () => {
    fluxPointerActive = false;
    pointerSteer = 0;
  });
})();
