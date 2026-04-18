(() => {
  "use strict";

  const LS_KEY = "orbitalDrift.v1.best";
  const STATS_KEY = "orbitalDrift.v1.stats";
  const TOP_RUNS_KEY = "orbitalDrift.v1.topRuns";
  const MUTE_KEY = "orbitalDrift.v1.muted";

  const RANKS = [
    { at: 0, name: "Trainee" },
    { at: 400, name: "Pilot" },
    { at: 1200, name: "Veteran" },
    { at: 3000, name: "Commander" },
    { at: 6000, name: "Captain" },
    { at: 10000, name: "Void Ace" },
  ];

  const CHALLENGE_KINDS = [
    {
      kind: "wave",
      bonus: 95,
      t: () => 3 + Math.floor(Math.random() * 2),
      label: (n) => `Reach wave ${n}`,
    },
    {
      kind: "shards",
      bonus: 110,
      t: () => 14 + Math.floor(Math.random() * 12),
      label: (n) => `Collect ${n} shards`,
    },
    {
      kind: "graze",
      bonus: 100,
      t: () => 7 + Math.floor(Math.random() * 7),
      label: (n) => `Graze ${n} rocks`,
    },
    {
      kind: "survive",
      bonus: 90,
      t: () => 40 + Math.floor(Math.random() * 20),
      label: (n) => `Survive ${n}s`,
    },
    {
      kind: "score",
      bonus: 125,
      t: () => Math.min(2200, 280 + Math.floor(best * 0.35) + Math.floor(Math.random() * 360)),
      label: (n) => `Reach ${n} score this run`,
    },
    {
      kind: "elite",
      bonus: 135,
      t: () => 2 + Math.floor(Math.random() * 2),
      label: (n) => `Graze ${n} elite rocks`,
    },
  ];

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const comboEl = document.getElementById("combo");
  const bestEl = document.getElementById("best");
  const hintEl = document.getElementById("hint");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlay-title");
  const overlayText = document.getElementById("overlay-text");
  const overlayScore = document.getElementById("overlay-score");
  const startBtn = document.getElementById("start");
  const muteBtn = document.getElementById("mute");
  const rankLineEl = document.getElementById("rank-line");
  const overlayMetaEl = document.getElementById("overlay-meta");
  const topRunsEl = document.getElementById("top-runs");
  const runTimeEl = document.getElementById("run-time");
  const copyScoreBtn = document.getElementById("copy-score");

  const W = 900;
  const H = 600;
  const CX = W / 2;
  const CY = H / 2;
  const PLANET_R = 42;
  const ORBIT_R = 118;
  const PLAYER_R = 9;
  const SHARD_R = 11;
  const AST_MIN_R = 10;
  const AST_MAX_R = 22;
  /** Distance past hit radius that still counts as a graze (wider = more forgiving). */
  const GRAZE_DEPTH = 50;
  /** Extra distance outside the graze band where we show the amber “incoming” ring. */
  const GRAZE_APPROACH = 56;
  /** Rush activates when adrenaline is at or above this; above this we stop passive decay until you use it. */
  const RUSH_THRESHOLD = 0.88;
  /** Grazes within this many seconds chain a streak bonus. */
  const GRAZE_STREAK_WINDOW = 3.2;
  /** Soft cap on spawn rate (spawn accumulator units per ~1s). */
  const SPAWN_RATE_CAP = 2.55;
  const MAX_PARTICLES = 420;

  let reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (typeof window !== "undefined" && window.matchMedia) {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMq = () => {
      reducedMotion = mq.matches;
      syncAmbient();
    };
    if (mq.addEventListener) mq.addEventListener("change", onMq);
    else if (mq.addListener) mq.addListener(onMq);
  }

  function formatTime(sec) {
    const t = Math.max(0, sec);
    const s = Math.floor(t % 60);
    const m = Math.floor(t / 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function syncCanvasSize() {
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const bw = Math.max(1, Math.round(rect.width * dpr));
    const bh = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }
    ctx.setTransform(bw / W, 0, 0, bh / H, 0, 0);
  }

  let state = "menu";
  let score = 0;
  let combo = 1;
  let maxCombo = 1;
  let comboTimer = 0;
  const COMBO_WINDOW = 2.2;
  const COMBO_MAX = 8;

  let playerAngle = -Math.PI / 2;
  /** Previous frame angle (play) — used so the ship nose aligns with tangential orbit motion. */
  let prevPlayerAngle = playerAngle;
  /** +1 / −1: direction of travel along the ring (sign of dθ/dt). */
  let lastOrbitSign = 1;
  let mouseX = CX;
  let mouseY = CY;
  let asteroids = [];
  let shards = [];
  let particles = [];
  let floatTexts = [];
  let spawnAcc = 0;
  let timeAlive = 0;
  let muted = false;
  let audioCtx = null;
  let masterGainNode = null;
  let ambientGainNode = null;
  let keySteerHeld = 0;
  let waveRingT = 0;
  let lastRunSummary = "";

  function loadMuted() {
    try {
      muted = localStorage.getItem(MUTE_KEY) === "1";
    } catch {
      muted = false;
    }
    if (muteBtn) {
      muteBtn.textContent = muted ? "Sound off" : "Sound on";
      muteBtn.setAttribute("aria-pressed", muted ? "true" : "false");
    }
  }

  loadMuted();

  let wave = 1;
  let nextWaveAt = 22;
  let waveBannerT = 0;

  let trail = [];
  const TRAIL_LEN = 14;

  let shields = 0;
  let shieldPickup = null;
  let shieldSpawnAcc = 0;
  let invulnT = 0;

  let shake = 0;
  let bgClock = 0;
  const keys = {};

  let challenges = [];
  let sweepAwarded = false;
  let shardsCollectedRun = 0;
  let grazesRun = 0;
  let eliteGrazesRun = 0;
  let adrenaline = 0;
  /** 0–1: UI hint when an ungrazed rock is near graze range (see drawPlayer). */
  let grazeWarnLevel = 0;
  let grazeStreak = 0;
  let lastGrazeAt = -100;

  function getBest() {
    const n = parseInt(localStorage.getItem(LS_KEY) || "0", 10);
    return Number.isFinite(n) ? n : 0;
  }

  let best = getBest();
  bestEl.textContent = String(best);
  updateRankLine();

  function saveBest(s) {
    if (s > best) {
      best = s;
      localStorage.setItem(LS_KEY, String(best));
      bestEl.textContent = String(best);
      updateRankLine();
      return true;
    }
    return false;
  }

  function loadStats() {
    try {
      const o = JSON.parse(localStorage.getItem(STATS_KEY) || "{}");
      return {
        runs: Number(o.runs) || 0,
        totalShards: Number(o.totalShards) || 0,
        totalGrazes: Number(o.totalGrazes) || 0,
        bestWave: Number(o.bestWave) || 0,
      };
    } catch {
      return { runs: 0, totalShards: 0, totalGrazes: 0, bestWave: 0 };
    }
  }

  function saveStats(st) {
    localStorage.setItem(STATS_KEY, JSON.stringify(st));
  }

  function loadTopRuns() {
    try {
      const raw = localStorage.getItem(TOP_RUNS_KEY);
      const a = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(a)) return [];
      return a
        .filter((x) => x && typeof x.score === "number" && x.score > 0)
        .sort((x, y) => y.score - x.score)
        .slice(0, 5);
    } catch {
      return [];
    }
  }

  function pushTopRun(finalScore, finalWave) {
    if (finalScore <= 0) return -1;
    const stamp = Date.now();
    const runs = loadTopRuns();
    runs.push({ score: finalScore, wave: finalWave, at: stamp });
    runs.sort((a, b) => b.score - a.score || (b.at || 0) - (a.at || 0));
    const top = runs.slice(0, 5);
    localStorage.setItem(TOP_RUNS_KEY, JSON.stringify(top));
    return top.findIndex((r) => r.at === stamp);
  }

  function renderTopRuns() {
    if (!topRunsEl) return;
    const runs = loadTopRuns();
    if (!runs.length) {
      topRunsEl.innerHTML = "";
      return;
    }
    const lines = runs.map((r, i) => `${i + 1}. ${r.score} pts · wave ${r.wave}`).join("<br/>");
    topRunsEl.innerHTML = `<strong>Top runs (this device)</strong><br/>${lines}`;
  }

  function rankName(score) {
    let n = RANKS[0].name;
    for (const r of RANKS) {
      if (score >= r.at) n = r.name;
    }
    return n;
  }

  function updateRankLine() {
    if (!rankLineEl) return;
    const title = rankName(best);
    let hint = "";
    let idx = 0;
    for (let i = RANKS.length - 1; i >= 0; i--) {
      if (best >= RANKS[i].at) {
        idx = i;
        break;
      }
    }
    if (idx < RANKS.length - 1) {
      const nx = RANKS[idx + 1];
      hint = ` · Next: ${nx.name} (${nx.at - best} pts)`;
    } else {
      hint = " · Max rank";
    }
    rankLineEl.textContent = `${title}${hint}`;
  }

  function rollChallenges() {
    const shuffled = CHALLENGE_KINDS.slice().sort(() => Math.random() - 0.5);
    challenges = shuffled.slice(0, 3).map((tpl) => {
      const target = tpl.t();
      return {
        kind: tpl.kind,
        target,
        bonus: tpl.bonus,
        done: false,
        label: tpl.label(target),
      };
    });
  }

  function challengeMet(c) {
    switch (c.kind) {
      case "wave":
        return wave >= c.target;
      case "shards":
        return shardsCollectedRun >= c.target;
      case "graze":
        return grazesRun >= c.target;
      case "survive":
        return timeAlive >= c.target;
      case "score":
        return score >= c.target;
      case "elite":
        return eliteGrazesRun >= c.target;
      default:
        return false;
    }
  }

  function completeChallenge(c, idx) {
    c.done = true;
    score += c.bonus;
    beep(740, 0.07, "triangle", 0.075);
    buzz(12);
    addFloatText(W - 100, 46 + idx * 15, `Goal ✓ +${c.bonus}`, "#ffe8a0");
    addShake(3);
  }

  function checkSweepBonus() {
    if (sweepAwarded || challenges.length < 3) return;
    if (!challenges.every((c) => c.done)) return;
    sweepAwarded = true;
    score += 400;
    addFloatText(CX, CY - ORBIT_R - 58, "All objectives · +400", "#ffd080");
    beep(900, 0.1, "sine", 0.085);
    buzz([12, 25, 12]);
    addShake(6);
  }

  function syncChallenges() {
    let guard = 0;
    while (guard++ < 16) {
      let hit = false;
      challenges.forEach((c, idx) => {
        if (c.done) return;
        if (challengeMet(c)) {
          completeChallenge(c, idx);
          hit = true;
        }
      });
      const beforeScore = score;
      checkSweepBonus();
      if (score !== beforeScore) hit = true;
      if (!hit) break;
    }
    updateHud();
  }

  function buzz(ms) {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(ms);
    }
  }

  function addShake(mag) {
    const m = mag * (reducedMotion ? 0.42 : 1);
    shake = Math.min(22, shake + m);
  }

  function initAudioGraph() {
    if (!audioCtx || masterGainNode) return;
    masterGainNode = audioCtx.createGain();
    masterGainNode.gain.value = 0.88;
    masterGainNode.connect(audioCtx.destination);

    ambientGainNode = audioCtx.createGain();
    ambientGainNode.gain.value = 0;
    const mix = audioCtx.createGain();
    mix.gain.value = 0.45;
    const o1 = audioCtx.createOscillator();
    const o2 = audioCtx.createOscillator();
    o1.type = "sine";
    o2.type = "sine";
    o1.frequency.value = 55;
    o2.frequency.value = 82;
    o1.connect(mix);
    o2.connect(mix);
    mix.connect(ambientGainNode);
    ambientGainNode.connect(masterGainNode);
    o1.start();
    o2.start();
  }

  function syncAmbient() {
    ensureAudio();
    initAudioGraph();
    if (!audioCtx || !ambientGainNode) return;
    if (muted || state !== "play") {
      const t = audioCtx.currentTime;
      ambientGainNode.gain.cancelScheduledValues(t);
      ambientGainNode.gain.setValueAtTime(ambientGainNode.gain.value, t);
      ambientGainNode.gain.linearRampToValueAtTime(0, t + 0.35);
      return;
    }
    const target = reducedMotion ? 0.005 : 0.017;
    const t = audioCtx.currentTime;
    ambientGainNode.gain.cancelScheduledValues(t);
    ambientGainNode.gain.setValueAtTime(ambientGainNode.gain.value, t);
    ambientGainNode.gain.linearRampToValueAtTime(target, t + 1.05);
  }

  function ensureAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    initAudioGraph();
  }

  function beep(freq, dur, type = "sine", vol = 0.08) {
    if (muted || !audioCtx) return;
    initAudioGraph();
    if (!masterGainNode) return;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type;
    o.frequency.value = freq;
    const t0 = audioCtx.currentTime;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.min(0.14, vol), t0 + 0.018);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(masterGainNode);
    o.start(t0);
    o.stop(t0 + dur + 0.04);
  }

  function noiseBurst() {
    if (muted || !audioCtx) return;
    initAudioGraph();
    if (!masterGainNode) return;
    const bufferSize = audioCtx.sampleRate * 0.08;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const src = audioCtx.createBufferSource();
    src.buffer = buffer;
    const g = audioCtx.createGain();
    g.gain.value = 0.11;
    src.connect(g);
    g.connect(masterGainNode);
    src.start();
  }

  function shardPos(angle) {
    return {
      x: CX + Math.cos(angle) * ORBIT_R,
      y: CY + Math.sin(angle) * ORBIT_R,
    };
  }

  function playerPos() {
    return shardPos(playerAngle);
  }

  function randomShardAngle(exclude = []) {
    for (let k = 0; k < 30; k++) {
      const a = Math.random() * Math.PI * 2;
      const ok = exclude.every((e) => {
        let d = Math.abs(a - e);
        if (d > Math.PI) d = Math.PI * 2 - d;
        return d > 0.55;
      });
      if (ok) return a;
    }
    return Math.random() * Math.PI * 2;
  }

  function resetShards() {
    shards = [];
    const n = 4;
    const angles = [];
    for (let i = 0; i < n; i++) {
      const a = randomShardAngle(angles);
      angles.push(a);
      shards.push({ angle: a, pulse: Math.random() * Math.PI * 2 });
    }
  }

  function spawnAsteroid() {
    const side = Math.floor(Math.random() * 4);
    let x;
    let y;
    const pad = 30;
    if (side === 0) {
      x = Math.random() * W;
      y = -pad;
    } else if (side === 1) {
      x = W + pad;
      y = Math.random() * H;
    } else if (side === 2) {
      x = Math.random() * W;
      y = H + pad;
    } else {
      x = -pad;
      y = Math.random() * H;
    }
    const dx = CX - x;
    const dy = CY - y;
    const len = Math.hypot(dx, dy) || 1;
    const waveBoost = 1 + (wave - 1) * 0.14;
    const elite = wave >= 3 && Math.random() < 0.13;
    const sizeMul = elite ? 1.28 : 1;
    const speedMul = elite ? 1.16 : 1;
    const speed = (55 + Math.random() * 55 + timeAlive * 0.1) * waveBoost * speedMul;
    const jitter = (Math.random() - 0.5) * (36 + wave * 4);
    const perp = { x: -dy / len, y: dx / len };
    const vx = (dx / len) * speed + perp.x * jitter;
    const vy = (dy / len) * speed + perp.y * jitter;
    const r = (AST_MIN_R + Math.random() * (AST_MAX_R - AST_MIN_R)) * sizeMul;
    asteroids.push({
      x,
      y,
      vx,
      vy,
      r,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * (elite ? 2.4 : 2),
      grazed: false,
      elite,
    });
  }

  function addParticles(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      const sp = 80 + Math.random() * 120;
      particles.push({
        x,
        y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp,
        life: 0.35 + Math.random() * 0.25,
        color,
      });
    }
    while (particles.length > MAX_PARTICLES) {
      particles.shift();
    }
  }

  function addFloatText(x, y, text, color) {
    floatTexts.push({
      x,
      y,
      text,
      color,
      life: 0.9,
      vy: -32,
    });
  }

  function togglePause() {
    if (state === "play") {
      state = "pause";
      beep(220, 0.05, "sine", 0.05);
    } else if (state === "pause") {
      state = "play";
      ensureAudio();
      beep(330, 0.05, "sine", 0.05);
    }
    syncAmbient();
  }

  function startGame() {
    ensureAudio();
    state = "play";
    score = 0;
    combo = 1;
    maxCombo = 1;
    comboTimer = 0;
    playerAngle = -Math.PI / 2;
    prevPlayerAngle = playerAngle;
    lastOrbitSign = 1;
    asteroids = [];
    particles = [];
    floatTexts = [];
    spawnAcc = 0;
    timeAlive = 0;
    wave = 1;
    nextWaveAt = 22;
    waveBannerT = 0;
    trail = [];
    shields = 0;
    shieldPickup = null;
    shieldSpawnAcc = 0;
    invulnT = 0;
    shake = 0;
    challenges = [];
    rollChallenges();
    sweepAwarded = false;
    shardsCollectedRun = 0;
    grazesRun = 0;
    eliteGrazesRun = 0;
    adrenaline = 0;
    grazeStreak = 0;
    lastGrazeAt = -100;
    keySteerHeld = 0;
    waveRingT = 0;
    resetShards();
    overlay.classList.add("hidden");
    if (copyScoreBtn) copyScoreBtn.hidden = true;
    if (overlayMetaEl) overlayMetaEl.textContent = "";
    hintEl.textContent = "Amber ring = rock near you · Let it skim past (not through) for graze + Rush";
    updateHud();
    try {
      canvas.focus({ preventScroll: true });
    } catch {
      canvas.focus();
    }
    syncAmbient();
  }

  function gameOver() {
    state = "over";
    addShake(20);
    buzz([30, 40, 60]);
    noiseBurst();
    const isNew = saveBest(score);
    const st = loadStats();
    st.runs += 1;
    st.totalShards += shardsCollectedRun;
    st.totalGrazes += grazesRun;
    st.bestWave = Math.max(st.bestWave, wave);
    saveStats(st);
    const boardRank = pushTopRun(score, wave);
    renderTopRuns();
    const doneN = challenges.filter((c) => c.done).length;
    overlayTitle.textContent = "Hull breach";
    let sub = isNew ? "New personal best — saved locally." : "The belt won this round.";
    if (score > 0 && boardRank >= 0 && boardRank <= 2) {
      sub += ` · ${["1st", "2nd", "3rd"][boardRank]} on local board`;
    }
    overlayText.textContent = sub;
    const parts = [];
    if (score > 0) parts.push(`Score ${score}`);
    parts.push(`Time ${formatTime(timeAlive)}`);
    parts.push(`Best ${best}`);
    if (maxCombo > 1) parts.push(`Max ×${maxCombo}`);
    parts.push(`Goals ${doneN}/3`);
    overlayScore.textContent = parts.join(" · ");
    if (overlayMetaEl) {
      overlayMetaEl.textContent = `${rankName(best)} · Runs ${st.runs} · Shards lifetime ${st.totalShards} · Grazes ${st.totalGrazes} · Best wave ${st.bestWave}`;
    }
    startBtn.textContent = "Play again";
    lastRunSummary = [
      "Orbital Drift — run summary",
      `Score: ${score}`,
      `Time: ${formatTime(timeAlive)}`,
      `Wave reached: ${wave}`,
      `Max combo: ×${maxCombo}`,
      `Objectives: ${doneN}/3`,
      `Best (local): ${best} · ${rankName(best)}`,
    ].join("\n");
    if (copyScoreBtn) {
      copyScoreBtn.hidden = score <= 0;
      copyScoreBtn.dataset.summary = lastRunSummary;
      copyScoreBtn.textContent = "Copy run summary";
    }
    overlay.classList.remove("hidden");
    updateRankLine();
    syncAmbient();
  }

  function updateHud() {
    scoreEl.textContent = String(score);
    comboEl.textContent = `×${combo}`;
    if (runTimeEl) {
      runTimeEl.textContent = state === "play" || state === "pause" ? formatTime(timeAlive) : "0:00";
    }
  }

  function syncPointer(clientX, clientY, rect) {
    mouseX = ((clientX - rect.left) / rect.width) * W;
    mouseY = ((clientY - rect.top) / rect.height) * H;
  }

  canvas.addEventListener("mousemove", (e) => {
    syncPointer(e.clientX, e.clientY, canvas.getBoundingClientRect());
  });

  canvas.addEventListener("pointermove", (e) => {
    syncPointer(e.clientX, e.clientY, canvas.getBoundingClientRect());
  });

  canvas.addEventListener("touchstart", (e) => {
    const t = e.touches[0];
    syncPointer(t.clientX, t.clientY, canvas.getBoundingClientRect());
  });

  canvas.addEventListener(
    "touchmove",
    (e) => {
      e.preventDefault();
      const t = e.touches[0];
      syncPointer(t.clientX, t.clientY, canvas.getBoundingClientRect());
    },
    { passive: false }
  );

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && state === "play") {
      togglePause();
    }
  });

  window.addEventListener("resize", () => syncCanvasSize());

  window.addEventListener("keydown", (e) => {
    keys[e.code] = true;
    if (
      e.repeat &&
      (e.code === "Space" || e.code === "KeyP" || e.code === "Escape")
    ) {
      return;
    }
    if (e.code === "KeyR") {
      if (state === "play" || state === "pause" || state === "over" || state === "menu") {
        e.preventDefault();
        startGame();
      }
      return;
    }
    if (e.code === "KeyP" || e.code === "Escape") {
      if (state === "play" || state === "pause") {
        e.preventDefault();
        togglePause();
      }
    }
    if (e.code === "Space") {
      if (state === "play" || state === "pause") {
        e.preventDefault();
        togglePause();
      }
    }
    if (e.code === "Enter" && !e.repeat) {
      if (overlay && !overlay.classList.contains("hidden")) {
        e.preventDefault();
        ensureAudio();
        startGame();
      }
    }
  });

  window.addEventListener("keyup", (e) => {
    keys[e.code] = false;
  });

  startBtn.addEventListener("click", () => {
    ensureAudio();
    startGame();
  });

  muteBtn.addEventListener("click", () => {
    muted = !muted;
    muteBtn.textContent = muted ? "Sound off" : "Sound on";
    muteBtn.setAttribute("aria-pressed", muted ? "true" : "false");
    try {
      localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
    } catch {
      /* ignore */
    }
    syncAmbient();
  });

  if (copyScoreBtn) {
    copyScoreBtn.addEventListener("click", async () => {
      const text = copyScoreBtn.dataset.summary || lastRunSummary || "";
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        copyScoreBtn.textContent = "Copied!";
        setTimeout(() => {
          copyScoreBtn.textContent = "Copy run summary";
        }, 1800);
      } catch {
        copyScoreBtn.textContent = "Clipboard unavailable";
        setTimeout(() => {
          copyScoreBtn.textContent = "Copy run summary";
        }, 2000);
      }
    });
  }

  let last = performance.now();
  /** When false, the main loop stops (arcade hub visible). Saves work when not playing Orbital Drift. */
  let orbitalLoopRunning = false;

  function tick(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    bgClock += dt * (reducedMotion ? 0.42 : 1);

    const playing = state === "play";

    if (shake > 0) {
      shake *= Math.pow(0.12, dt * 60);
      if (shake < 0.35) shake = 0;
    }

    if (playing) {
      timeAlive += dt;
      invulnT = Math.max(0, invulnT - dt);
      if (adrenaline < RUSH_THRESHOLD) {
        adrenaline = Math.max(0, adrenaline - dt * 0.105);
      }

      const target = Math.atan2(mouseY - CY, mouseX - CX);
      let diff = target - playerAngle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      playerAngle += diff * (1 - Math.pow(0.001, dt * 60));

      let kt = 0;
      if (keys.ArrowLeft || keys.KeyA) kt -= 1;
      if (keys.ArrowRight || keys.KeyD) kt += 1;
      if (kt !== 0) {
        keySteerHeld = Math.min(1.85, keySteerHeld + dt * 1.05);
      } else {
        keySteerHeld = Math.max(0, keySteerHeld - dt * 3.6);
      }
      const steerMul = 1 + keySteerHeld * 0.26;
      playerAngle += kt * 3.4 * dt * steerMul;

      let dAng = playerAngle - prevPlayerAngle;
      while (dAng > Math.PI) dAng -= Math.PI * 2;
      while (dAng < -Math.PI) dAng += Math.PI * 2;
      if (Math.abs(dAng) > 1e-7) lastOrbitSign = Math.sign(dAng);
      prevPlayerAngle = playerAngle;

      while (timeAlive >= nextWaveAt) {
        wave += 1;
        nextWaveAt += 22 + wave * 3;
        waveBannerT = 2.8;
        waveRingT = 1;
        beep(180 + wave * 25, 0.08, "square", 0.06);
      }

      if (waveBannerT > 0) {
        waveBannerT -= dt;
      }
      if (waveRingT > 0) {
        waveRingT = Math.max(0, waveRingT - dt * 1.08);
      }

      trail.push(playerAngle);
      if (trail.length > TRAIL_LEN) trail.shift();

      comboTimer -= dt;
      if (comboTimer <= 0 && combo > 1) {
        combo = 1;
        updateHud();
      }

      const pp = playerPos();

      if (shieldPickup) {
        shieldPickup.pulse += dt * 2.5;
        const sp = shardPos(shieldPickup.angle);
        if (Math.hypot(sp.x - pp.x, sp.y - pp.y) < PLAYER_R + 14) {
          shields = 1;
          shieldPickup = null;
          shieldSpawnAcc = 0;
          beep(280, 0.1, "sine", 0.09);
          buzz(12);
          addParticles(sp.x, sp.y, "#ffd080", 18);
          addFloatText(sp.x, sp.y - 18, "Shield", "#ffd080");
        }
      } else if (shields === 0 && timeAlive > 10) {
        shieldSpawnAcc += dt;
        if (shieldSpawnAcc > 26 + wave * 4) {
          const ex = shards.map((s) => s.angle);
          shieldPickup = { angle: randomShardAngle(ex), pulse: 0 };
          shieldSpawnAcc = 0;
        }
      }

      for (let i = shards.length - 1; i >= 0; i--) {
        const s = shards[i];
        s.pulse += dt * 3;
        const sp = shardPos(s.angle);
        const d = Math.hypot(sp.x - pp.x, sp.y - pp.y);
        if (d < PLAYER_R + SHARD_R) {
          shardsCollectedRun += 1;
          comboTimer = COMBO_WINDOW;
          combo = Math.min(COMBO_MAX, combo + 1);
          if (combo > maxCombo) maxCombo = combo;
          let pts = 10 * combo;
          let rush = false;
          if (adrenaline >= RUSH_THRESHOLD) {
            pts *= 2;
            rush = true;
            adrenaline = 0;
            addFloatText(sp.x, sp.y - 38, "Rush ×2", "#ff9eec");
            beep(360, 0.07, "square", 0.08);
            buzz(18);
          }
          score += pts;
          beep(440 + combo * 40, 0.06, "triangle", 0.07);
          if (!rush) buzz(8);
          addShake(2);
          addParticles(sp.x, sp.y, "#3dffce", 14);
          addFloatText(sp.x, sp.y - 20, `+${pts}`, rush ? "#ffb8e8" : "#7effe0");
          shards.splice(i, 1);
          const others = shards.map((sh) => sh.angle);
          shards.push({ angle: randomShardAngle(others), pulse: 0 });
        }
      }

      let baseRate = (0.52 + timeAlive * 0.016) * (1 + (wave - 1) * 0.11);
      baseRate = Math.min(SPAWN_RATE_CAP, baseRate);
      spawnAcc += baseRate * dt;
      while (spawnAcc >= 1) {
        spawnAsteroid();
        spawnAcc -= 1;
      }

      for (const a of asteroids) {
        a.x += a.vx * dt;
        a.y += a.vy * dt;
        a.rot += a.vr * dt;
      }
      asteroids = asteroids.filter((a) => a.x > -80 && a.x < W + 80 && a.y > -80 && a.y < H + 80);

      const hitR = (a) => a.r + PLAYER_R - 2;

      grazeWarnLevel = 0;
      for (const a of asteroids) {
        if (a.grazed) continue;
        const d = Math.hypot(a.x - pp.x, a.y - pp.y);
        const hr = hitR(a);
        if (d <= hr) continue;
        if (d <= hr + GRAZE_DEPTH) {
          grazeWarnLevel = 1;
          break;
        }
        if (d <= hr + GRAZE_DEPTH + GRAZE_APPROACH) {
          const u = 1 - (d - hr - GRAZE_DEPTH) / GRAZE_APPROACH;
          if (u > grazeWarnLevel) grazeWarnLevel = u;
        }
      }

      for (const a of asteroids) {
        const d = Math.hypot(a.x - pp.x, a.y - pp.y);
        if (!a.grazed && d > hitR(a) && d < hitR(a) + GRAZE_DEPTH) {
          a.grazed = true;
          grazesRun += 1;
          if (a.elite) eliteGrazesRun += 1;
          if (timeAlive - lastGrazeAt <= GRAZE_STREAK_WINDOW) {
            grazeStreak += 1;
          } else {
            grazeStreak = 1;
          }
          lastGrazeAt = timeAlive;
          const streakBonus = grazeStreak >= 2 ? Math.min(18, (grazeStreak - 1) * 3) : 0;
          adrenaline = Math.min(1, adrenaline + (a.elite ? 0.15 : 0.095));
          const mult = a.elite ? 2 : 1;
          const bonus = (4 + wave) * mult;
          score += bonus + streakBonus;
          beep(a.elite ? 520 : 660, 0.04, "triangle", 0.04);
          addShake(a.elite ? 4 : 1);
          if (a.elite) buzz(15);
          addFloatText(a.x, a.y - a.r - 8, `+${bonus}`, a.elite ? "#ff8ec8" : "#9ec5ff");
          if (streakBonus > 0) {
            addFloatText(a.x, a.y - a.r - 24, `Streak +${streakBonus}`, "#ffc48a");
            beep(580 + streakBonus * 8, 0.04, "triangle", 0.05);
          }
        }
      }

      if (invulnT <= 0) {
        for (let i = asteroids.length - 1; i >= 0; i--) {
          const a = asteroids[i];
          const d = Math.hypot(a.x - pp.x, a.y - pp.y);
          if (d < hitR(a)) {
            if (shields > 0) {
              shields = 0;
              invulnT = 1.35;
              asteroids.splice(i, 1);
              addParticles(pp.x, pp.y, "#ffd080", 28);
              addShake(12);
              buzz(22);
              beep(140, 0.12, "sawtooth", 0.07);
              addFloatText(pp.x, pp.y - 24, "Saved", "#ffd080");
              break;
            }
            addParticles(pp.x, pp.y, "#ff4d6d", 24);
            gameOver();
            break;
          }
        }
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.98;
        p.vy *= 0.98;
        if (p.life <= 0) particles.splice(i, 1);
      }

      for (let i = floatTexts.length - 1; i >= 0; i--) {
        const f = floatTexts[i];
        f.life -= dt;
        f.y += f.vy * dt;
        f.vy *= 0.92;
        if (f.life <= 0) floatTexts.splice(i, 1);
      }

      syncChallenges();
    } else if (state === "pause") {
      if (waveBannerT > 0) waveBannerT -= dt;
    }

    if (state !== "play" && state !== "pause") {
      grazeWarnLevel = 0;
    }

    if (runTimeEl && (state === "play" || state === "pause")) {
      runTimeEl.textContent = formatTime(timeAlive);
    }

    draw();
    if (orbitalLoopRunning) requestAnimationFrame(tick);
  }

  function startOrbitalLoop() {
    if (orbitalLoopRunning) return;
    orbitalLoopRunning = true;
    last = performance.now();
    requestAnimationFrame(tick);
  }

  function stopOrbitalLoop() {
    orbitalLoopRunning = false;
  }

  function drawPlanet() {
    const px = CX - 14;
    const py = CY - 16;
    const t = reducedMotion ? 0 : bgClock * 0.08;

    ctx.save();
    const halo = ctx.createRadialGradient(px, py, PLANET_R * 0.2, CX, CY, PLANET_R + 48);
    halo.addColorStop(0, "rgba(120, 200, 255, 0.22)");
    halo.addColorStop(0.45, "rgba(61, 140, 200, 0.12)");
    halo.addColorStop(1, "rgba(10, 20, 40, 0)");
    ctx.beginPath();
    ctx.arc(CX, CY, PLANET_R + 46, 0, Math.PI * 2);
    ctx.fillStyle = halo;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(CX, CY, PLANET_R + 5, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(120, 220, 255, 0.35)";
    ctx.lineWidth = 3;
    ctx.shadowColor = "rgba(61, 255, 206, 0.45)";
    ctx.shadowBlur = 18;
    ctx.stroke();
    ctx.shadowBlur = 0;

    const body = ctx.createRadialGradient(px, py, 4, CX + 6, CY + 10, PLANET_R + 6);
    body.addColorStop(0, "#7ab4e8");
    body.addColorStop(0.22, "#4a78b8");
    body.addColorStop(0.55, "#2a5088");
    body.addColorStop(0.88, "#152a48");
    body.addColorStop(1, "#0a1424");
    ctx.beginPath();
    ctx.arc(CX, CY, PLANET_R, 0, Math.PI * 2);
    ctx.fillStyle = body;
    ctx.fill();

    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 3; i++) {
      const bandA = t + i * 1.7;
      const gr = ctx.createLinearGradient(
        CX - PLANET_R,
        CY + Math.sin(bandA) * 8,
        CX + PLANET_R,
        CY - Math.sin(bandA * 0.9) * 6,
      );
      gr.addColorStop(0, "rgba(255, 255, 255, 0)");
      gr.addColorStop(0.5, `rgba(160, 210, 255, ${0.04 + i * 0.015})`);
      gr.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.beginPath();
      ctx.arc(CX, CY, PLANET_R - 1, 0, Math.PI * 2);
      ctx.fillStyle = gr;
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";

    ctx.beginPath();
    ctx.ellipse(px + 4, py + 2, PLANET_R * 0.38, PLANET_R * 0.22, -0.35, 0, Math.PI * 2);
    const spec = ctx.createRadialGradient(px, py, 0, px + 2, py + 2, PLANET_R * 0.5);
    spec.addColorStop(0, "rgba(255, 255, 255, 0.55)");
    spec.addColorStop(0.35, "rgba(200, 230, 255, 0.12)");
    spec.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = spec;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(CX, CY, PLANET_R, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(61, 255, 206, 0.22)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  function drawOrbit() {
    const hue = (wave * 14 + timeAlive * 3) % 360;
    ctx.beginPath();
    ctx.arc(CX, CY, ORBIT_R, 0, Math.PI * 2);
    ctx.strokeStyle = `hsla(${hue}, 55%, 58%, 0.28)`;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 10]);
    ctx.stroke();
    ctx.setLineDash([]);
    if (waveRingT > 0.02) {
      ctx.save();
      ctx.globalAlpha = waveRingT * 0.65;
      ctx.beginPath();
      ctx.arc(CX, CY, ORBIT_R + 4, 0, Math.PI * 2);
      ctx.strokeStyle = `hsla(${(hue + 50) % 360}, 75%, 62%, ${0.45 + waveRingT * 0.35})`;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawShards() {
    for (const s of shards) {
      const p = shardPos(s.angle);
      const wobble = Math.sin(s.pulse) * 2;
      ctx.save();
      ctx.translate(p.x, p.y + wobble);
      ctx.rotate(s.pulse * 0.4);
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2 - Math.PI / 2;
        const r = i % 2 === 0 ? SHARD_R : SHARD_R * 0.45;
        const x = Math.cos(ang) * r;
        const y = Math.sin(ang) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      const g = ctx.createRadialGradient(0, 0, 2, 0, 0, SHARD_R);
      g.addColorStop(0, "#9fffea");
      g.addColorStop(1, "#1a9f82");
      ctx.fillStyle = g;
      ctx.shadowColor = "rgba(61, 255, 206, 0.8)";
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();
    }
  }

  function drawShieldPickup() {
    if (!shieldPickup) return;
    const p = shardPos(shieldPickup.angle);
    const w = Math.sin(shieldPickup.pulse) * 3;
    ctx.save();
    ctx.translate(p.x, p.y + w);
    ctx.rotate(shieldPickup.pulse * 0.25);
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    const g = ctx.createRadialGradient(-3, -3, 2, 0, 0, 14);
    g.addColorStop(0, "#fff2cc");
    g.addColorStop(0.5, "#e8a020");
    g.addColorStop(1, "#8a5a12");
    ctx.fillStyle = g;
    ctx.shadowColor = "rgba(255, 200, 80, 0.9)";
    ctx.shadowBlur = 16;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255, 240, 200, 0.7)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  function drawTrail() {
    if (trail.length < 2) return;
    for (let i = 0; i < trail.length - 1; i++) {
      const t = i / (trail.length - 1);
      const a = trail[i];
      const p = shardPos(a);
      const alpha = t * 0.35;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, PLAYER_R * 0.75, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(120, 200, 255, 0.5)";
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawPlayer() {
    const p = playerPos();
    if (grazeWarnLevel > 0.04) {
      ctx.save();
      ctx.translate(p.x, p.y);
      const pulse = 0.75 + 0.25 * Math.sin(timeAlive * 14);
      ctx.globalAlpha = (0.18 + grazeWarnLevel * 0.55) * pulse;
      ctx.strokeStyle =
        grazeWarnLevel >= 0.98 ? "rgba(255, 245, 180, 0.95)" : "rgba(255, 190, 90, 0.85)";
      ctx.lineWidth = grazeWarnLevel >= 0.98 ? 2.2 : 1.5;
      ctx.setLineDash([5, 7]);
      ctx.beginPath();
      ctx.arc(0, 0, PLAYER_R + 14 + (1 - grazeWarnLevel) * 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      ctx.restore();
    }
    if (shields > 0) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.beginPath();
      ctx.arc(0, 0, PLAYER_R + 10 + Math.sin(timeAlive * 6) * 1.5, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255, 200, 100, 0.55)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
    if (invulnT > 0) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.globalAlpha = 0.35 + 0.35 * Math.sin(timeAlive * 28);
      ctx.beginPath();
      ctx.arc(0, 0, PLAYER_R + 6, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255, 220, 160, 0.9)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.restore();
    }
    ctx.save();
    ctx.translate(p.x, p.y);
    const s = lastOrbitSign;
    const tx = -Math.sin(playerAngle) * s;
    const ty = Math.cos(playerAngle) * s;
    const heading = Math.atan2(ty, tx);
    ctx.rotate(heading + Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(0, -PLAYER_R * 1.2);
    ctx.lineTo(PLAYER_R * 0.95, PLAYER_R * 0.85);
    ctx.lineTo(0, PLAYER_R * 0.35);
    ctx.lineTo(-PLAYER_R * 0.95, PLAYER_R * 0.85);
    ctx.closePath();
    ctx.fillStyle = "#e8f4ff";
    ctx.shadowColor = "rgba(100, 180, 255, 0.9)";
    ctx.shadowBlur = 14;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(61, 255, 206, 0.5)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  function drawAsteroids() {
    for (const a of asteroids) {
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.rotate(a.rot);
      ctx.beginPath();
      const sides = 7;
      for (let i = 0; i < sides; i++) {
        const ang = (i / sides) * Math.PI * 2;
        const rr = a.r * (0.75 + (i % 3) * 0.1);
        const x = Math.cos(ang) * rr;
        const y = Math.sin(ang) * rr;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      if (a.elite) {
        ctx.fillStyle = "#4a3048";
        ctx.strokeStyle = "rgba(255, 120, 180, 0.75)";
        ctx.lineWidth = 2.5;
      } else {
        ctx.fillStyle = "#3a3545";
        ctx.strokeStyle = "rgba(255, 77, 109, 0.35)";
        ctx.lineWidth = 2;
      }
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawEliteLabels() {
    if (state !== "play" && state !== "pause") return;
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.font = "700 8px Outfit, system-ui, sans-serif";
    for (const a of asteroids) {
      if (!a.elite) continue;
      ctx.fillStyle = "rgba(255, 210, 230, 0.92)";
      ctx.fillText("ELITE", a.x, a.y - a.r - 6);
    }
    ctx.restore();
  }

  function drawParticles() {
    for (const p of particles) {
      const alpha = Math.max(0, p.life / 0.5);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function drawFloatTexts() {
    ctx.save();
    ctx.textAlign = "center";
    ctx.font = "700 15px Outfit, system-ui, sans-serif";
    ctx.lineJoin = "round";
    for (const f of floatTexts) {
      ctx.globalAlpha = Math.min(1, f.life * 2);
      ctx.strokeStyle = "rgba(0, 0, 0, 0.72)";
      ctx.lineWidth = 3;
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawObjectivePanel() {
    if (state !== "play" && state !== "pause") return;
    if (!challenges.length) return;
    ctx.save();
    ctx.textAlign = "right";
    let y = 22;
    ctx.font = "600 12px Outfit, system-ui, sans-serif";
    ctx.fillStyle = "rgba(160, 180, 210, 0.95)";
    ctx.fillText("Objectives", W - 18, y);
    y += 15;
    challenges.forEach((c) => {
      const mark = c.done ? "✓" : "·";
      ctx.font = c.done ? "600 11px Outfit, system-ui, sans-serif" : "500 11px Outfit, system-ui, sans-serif";
      ctx.fillStyle = c.done ? "rgba(255, 224, 160, 0.95)" : "rgba(140, 160, 190, 0.92)";
      const line = `${mark} ${c.label} +${c.bonus}`;
      ctx.fillText(line, W - 18, y);
      y += 14;
    });
    ctx.restore();
  }

  function drawAdrenalineMeter() {
    if (state !== "play" && state !== "pause") return;
    const bw = 112;
    const bh = 7;
    const bx = W - 18 - bw;
    const by = H - 22;
    ctx.save();
    ctx.font = "600 11px Outfit, system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(107, 122, 144, 0.95)";
    ctx.fillText("Rush (charged = no drain)", W - 18, by - 6);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = "rgba(255, 140, 200, 0.3)";
    ctx.lineWidth = 1;
    ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
    ctx.fillStyle = `rgba(255, 130, 200, ${0.28 + adrenaline * 0.55})`;
    const innerW = Math.max(0, (bw - 4) * adrenaline);
    ctx.fillRect(bx + 2, by + 2, innerW, bh - 4);
    const rx = bx + 2 + (bw - 4) * RUSH_THRESHOLD;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rx, by + 1);
    ctx.lineTo(rx, by + bh - 1);
    ctx.stroke();
    ctx.restore();
  }

  function drawComboMeter() {
    if (state !== "play" && state !== "pause") return;
    if (combo <= 1 && comboTimer <= 0) return;
    const bw = 112;
    const bh = 7;
    const bx = 18;
    const by = H - 22;
    const fill = Math.max(0, comboTimer / COMBO_WINDOW);
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.strokeStyle = "rgba(61, 255, 206, 0.25)";
    ctx.lineWidth = 1;
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
    ctx.fillStyle = `rgba(61, 255, 206, ${0.35 + fill * 0.45})`;
    const innerW = Math.max(0, (bw - 4) * fill);
    ctx.fillRect(bx + 2, by + 2, innerW, bh - 4);
    ctx.font = "600 11px Outfit, system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(107, 122, 144, 0.95)";
    ctx.fillText("Combo", bx, by - 6);
    ctx.restore();
  }

  function wrap(v, m) {
    return ((v % m) + m) % m;
  }

  function drawSkyBase() {
    const g = ctx.createLinearGradient(0, 0, W * 0.6, H);
    g.addColorStop(0, "#0c1430");
    g.addColorStop(0.35, "#080e1c");
    g.addColorStop(0.7, "#060a12");
    g.addColorStop(1, "#030508");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const g2 = ctx.createLinearGradient(W, 0, 0, H);
    g2.addColorStop(0, "rgba(45, 25, 70, 0.12)");
    g2.addColorStop(0.5, "transparent");
    g2.addColorStop(1, "rgba(10, 40, 55, 0.1)");
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, W, H);
  }

  function drawNebulae(t) {
    const blobs = [
      { px: 0.18, py: 0.2, r: 0.52, hue: 200, sat: 62, a: 0.11 },
      { px: 0.82, py: 0.68, r: 0.48, hue: 275, sat: 45, a: 0.085 },
      { px: 0.52, py: 0.38, r: 0.42, hue: 175, sat: 55, a: 0.075 },
    ];
    for (const b of blobs) {
      const ox = Math.sin(t * 0.11 + b.px * 12) * 55;
      const oy = Math.cos(t * 0.085 + b.py * 9) * 42;
      const x = b.px * W + ox;
      const y = b.py * H + oy;
      const rad = Math.min(W, H) * b.r;
      const grd = ctx.createRadialGradient(x, y, rad * 0.08, x, y, rad);
      grd.addColorStop(0, `hsla(${b.hue}, ${b.sat}%, 52%, ${b.a * 1.3})`);
      grd.addColorStop(0.4, `hsla(${b.hue + 25}, ${b.sat - 10}%, 38%, ${b.a * 0.45})`);
      grd.addColorStop(1, "transparent");
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, W, H);
    }
    const lx = CX + Math.cos(t * 0.13) * 140;
    const ly = CY + Math.sin(t * 0.1) * 95;
    const ambient = ctx.createRadialGradient(lx, ly, 0, lx, ly, 220);
    ambient.addColorStop(0, "rgba(55, 100, 140, 0.06)");
    ambient.addColorStop(0.55, "rgba(30, 50, 80, 0.02)");
    ambient.addColorStop(1, "transparent");
    ctx.fillStyle = ambient;
    ctx.fillRect(0, 0, W, H);
  }

  function drawStarfield(t, twinkleT, lowFx) {
    const far = lowFx ? 72 : 130;
    const mid = lowFx ? 42 : 75;
    const near = lowFx ? 14 : 28;
    for (let i = 0; i < far; i++) {
      const baseX = (i * 9973) % W;
      const baseY = (i * 7919) % H;
      const vx = 3.2 + (i % 7) * 0.35;
      const vy = 2.1 + (i % 5) * 0.25;
      const sx = wrap(baseX + t * vx, W);
      const sy = wrap(baseY + t * vy + (i % 17) * 0.4, H);
      const tw = (Math.sin(twinkleT * 2.2 + i * 0.7) * 0.5 + 0.5) * 0.45 + 0.08;
      ctx.globalAlpha = tw * 0.55;
      ctx.fillStyle = "rgba(200, 220, 255, 0.9)";
      ctx.fillRect(sx, sy, 1, 1);
    }

    for (let i = 0; i < mid; i++) {
      const baseX = (i * 6151) % W;
      const baseY = (i * 4327) % H;
      const vx = 9 + (i % 6);
      const vy = 6.5 + (i % 4);
      const sx = wrap(baseX + t * vx, W);
      const sy = wrap(baseY + t * vy + (i % 11), H);
      const tw = (Math.sin(twinkleT * 2.8 + i) * 0.5 + 0.5) * 0.65 + 0.15;
      const sz = 1 + (i % 3);
      ctx.globalAlpha = tw * 0.75;
      ctx.fillStyle = "rgba(230, 240, 255, 0.95)";
      ctx.fillRect(sx, sy, sz, sz);
    }

    for (let i = 0; i < near; i++) {
      const baseX = (i * 3847) % W;
      const baseY = (i * 5923) % H;
      const vx = 18 + (i % 5) * 2;
      const vy = 14 + (i % 4) * 1.5;
      const sx = wrap(baseX + t * vx, W);
      const sy = wrap(baseY + t * vy + i * 2, H);
      const tw = (Math.sin(twinkleT * 1.6 + i * 1.3) * 0.5 + 0.5) * 0.5 + 0.35;
      ctx.globalAlpha = tw;
      ctx.fillStyle = "rgba(200, 235, 255, 1)";
      ctx.fillRect(sx - 0.5, sy - 0.5, 2.5, 2.5);
      ctx.globalAlpha = tw * 0.35;
      ctx.fillRect(sx - 1.5, sy - 1.5, 4, 4);
    }
    ctx.globalAlpha = 1;
  }

  function drawCosmicDust(t, lowFx) {
    const n = lowFx ? 24 : 50;
    for (let i = 0; i < n; i++) {
      const sx = wrap(i * 241 + t * 26 + Math.sin(t * 0.5 + i) * 20, W);
      const sy = wrap(i * 179 + t * 18 + Math.cos(t * 0.4 + i * 0.2) * 15, H);
      const a = 0.04 + (i % 5) * 0.018;
      ctx.globalAlpha = a;
      ctx.fillStyle = "rgba(160, 210, 255, 0.8)";
      ctx.fillRect(sx, sy, 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  function drawVignette() {
    const r = Math.max(W, H) * 0.72;
    const vg = ctx.createRadialGradient(CX, CY, ORBIT_R * 1.2, CX, CY, r);
    vg.addColorStop(0, "transparent");
    vg.addColorStop(0.65, "rgba(0, 0, 0, 0.12)");
    vg.addColorStop(1, "rgba(0, 0, 0, 0.5)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }

  function drawBackground() {
    const twinkleT = state === "play" ? timeAlive : bgClock;
    const lowFx = reducedMotion;
    drawSkyBase();
    drawNebulae(bgClock * (lowFx ? 0.55 : 1));
    drawStarfield(bgClock, twinkleT, lowFx);
    drawCosmicDust(bgClock, lowFx);
    drawVignette();
  }

  function drawHudText() {
    ctx.save();
    ctx.textAlign = "left";
    ctx.font = "600 14px Outfit, system-ui, sans-serif";
    ctx.fillStyle = "rgba(107, 122, 144, 0.95)";
    ctx.fillText(`Wave ${wave}`, 18, 28);
    if ((state === "play" || state === "pause") && grazeStreak >= 2) {
      ctx.font = "600 12px Outfit, system-ui, sans-serif";
      ctx.fillStyle = "rgba(255, 200, 150, 0.95)";
      ctx.fillText(`Graze streak ×${grazeStreak}`, 18, 44);
    }
    ctx.restore();
  }

  function drawWaveBanner() {
    if (waveBannerT <= 0 || wave <= 1) return;
    ctx.save();
    const a = Math.min(1, waveBannerT * 2);
    ctx.globalAlpha = Math.min(1, a) * Math.min(1, waveBannerT);
    ctx.textAlign = "center";
    ctx.font = "700 28px Outfit, system-ui, sans-serif";
    ctx.fillStyle = "rgba(61, 255, 206, 0.95)";
    ctx.shadowColor = "rgba(61, 255, 206, 0.5)";
    ctx.shadowBlur = 20;
    ctx.fillText(`Wave ${wave}`, CX, CY - ORBIT_R - 36);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawPaused() {
    if (state !== "pause") return;
    ctx.fillStyle = "rgba(6, 9, 13, 0.65)";
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.textAlign = "center";
    ctx.font = "700 36px Outfit, system-ui, sans-serif";
    ctx.fillStyle = "#e8f0ff";
    ctx.fillText("Paused", CX, CY - 8);
    ctx.font = "400 15px Outfit, system-ui, sans-serif";
    ctx.fillStyle = "rgba(107, 122, 144, 0.95)";
    ctx.fillText("Space · P or Esc to resume · R restarts run", CX, CY + 22);
    ctx.restore();
  }

  function drawScene() {
    drawBackground();
    drawPlanet();
    drawOrbit();
    drawShards();
    drawShieldPickup();
    drawTrail();
    drawAsteroids();
    drawEliteLabels();
    drawPlayer();
    drawParticles();
    drawFloatTexts();
    drawHudText();
    drawObjectivePanel();
    drawAdrenalineMeter();
    drawComboMeter();
    drawWaveBanner();
    drawPaused();
  }

  function draw() {
    syncCanvasSize();
    let ox = 0;
    let oy = 0;
    if (shake > 0) {
      ox = (Math.random() - 0.5) * shake * 2.2;
      oy = (Math.random() - 0.5) * shake * 2.2;
    }
    ctx.save();
    ctx.translate(ox, oy);
    drawScene();
    ctx.restore();

    if (state === "menu") {
      ctx.fillStyle = "rgba(6, 9, 13, 0.45)";
      ctx.fillRect(0, 0, W, H);
    }
  }

  function bootOrbitalFromArcade() {
    overlay.classList.remove("hidden");
    renderTopRuns();
    updateHud();
    startOrbitalLoop();
  }

  window.addEventListener("arcade:play", (e) => {
    const id = e.detail && e.detail.id;
    if (id === "orbital-drift") {
      bootOrbitalFromArcade();
    } else {
      stopOrbitalLoop();
    }
  });

  window.addEventListener("arcade:leave", () => {
    stopOrbitalLoop();
    state = "menu";
    overlay.classList.remove("hidden");
    syncAmbient();
  });
})();
