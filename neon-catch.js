(() => {
  "use strict";

  const LS_BEST = "neonCatch.v1.best";
  const LS_MUTE = "neonCatch.v1.muted";
  const W = 900;
  const H = 600;
  const PADDLE_W = 118;
  const PADDLE_H = 16;
  const PADDLE_TOP = H - 48;

  const canvas = document.getElementById("game-neon");
  const ctx = canvas && canvas.getContext("2d");
  const scoreEl = document.getElementById("neon-score");
  const bestEl = document.getElementById("neon-best");
  const livesEl = document.getElementById("neon-lives");
  const hintEl = document.getElementById("neon-hint");
  const overlay = document.getElementById("neon-overlay");
  const overlayTitle = document.getElementById("neon-overlay-title");
  const overlayText = document.getElementById("neon-overlay-text");
  const overlayScore = document.getElementById("neon-overlay-score");
  const startBtn = document.getElementById("neon-start");
  const muteBtn = document.getElementById("neon-mute");

  if (!canvas || !ctx) return;

  let muted = false;
  try {
    muted = localStorage.getItem(LS_MUTE) === "1";
  } catch {
    muted = false;
  }
  let best = 0;
  try {
    const n = parseInt(localStorage.getItem(LS_BEST) || "0", 10);
    best = Number.isFinite(n) ? n : 0;
  } catch {
    best = 0;
  }
  if (bestEl) bestEl.textContent = String(best);
  syncMuteBtn();

  let audioCtx = null;
  let loopOn = false;
  let state = "menu";
  let last = performance.now();
  let paddleX = W * 0.5;
  let orbs = [];
  let spawnAcc = 0.4;
  let score = 0;
  let lives = 3;
  let bgT = 0;
  const keys = {};

  function syncMuteBtn() {
    if (!muteBtn) return;
    muteBtn.textContent = muted ? "Sound off" : "Sound on";
    muteBtn.setAttribute("aria-pressed", muted ? "true" : "false");
  }

  function ensureAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
  }

  function beep(freq, dur, vol = 0.07) {
    if (muted || !audioCtx) return;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = "sine";
    o.frequency.value = freq;
    const t0 = audioCtx.currentTime;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  function toneLow(freq, dur) {
    if (muted || !audioCtx) return;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = "triangle";
    o.frequency.value = freq;
    const t0 = audioCtx.currentTime;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.09, t0 + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

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

  function neonShellActive() {
    const sh = document.getElementById("game-shell-neon");
    return sh && !sh.classList.contains("hidden") && !sh.hasAttribute("hidden");
  }

  function saveBest(s) {
    if (s > best) {
      best = s;
      try {
        localStorage.setItem(LS_BEST, String(best));
      } catch {
        /* ignore */
      }
      if (bestEl) bestEl.textContent = String(best);
    }
  }

  function openMenu(title, text, showScore, lastScore) {
    state = "menu";
    if (overlayTitle) overlayTitle.textContent = title;
    if (overlayText) overlayText.textContent = text;
    if (overlayScore) {
      if (showScore) {
        overlayScore.hidden = false;
        overlayScore.textContent = `Score ${lastScore}`;
      } else {
        overlayScore.hidden = true;
      }
    }
    if (overlay) overlay.classList.remove("hidden");
    if (scoreEl) scoreEl.textContent = showScore ? String(lastScore) : "0";
    if (livesEl) livesEl.textContent = "♥♥♥";
  }

  function closeMenuPlay() {
    ensureAudio();
    if (overlay) overlay.classList.add("hidden");
    state = "play";
  }

  function resetRun() {
    paddleX = W * 0.5;
    orbs = [];
    spawnAcc = 0.45;
    score = 0;
    lives = 3;
    bgT = 0;
  }

  function gameOver() {
    saveBest(score);
    toneLow(120, 0.35);
    openMenu("Game over", "Catch the drops. Miss three and the run ends. Mouse or A D / arrows.", true, score);
  }

  function tick(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    bgT += dt;

    if (state === "play") {
      let sp = 0;
      if (keys.ArrowLeft || keys.KeyA) sp -= 1;
      if (keys.ArrowRight || keys.KeyD) sp += 1;
      paddleX += sp * 460 * dt;
      paddleX = Math.max(PADDLE_W * 0.5 + 6, Math.min(W - PADDLE_W * 0.5 - 6, paddleX));

      spawnAcc -= dt;
      if (spawnAcc <= 0) {
        orbs.push({
          x: 28 + Math.random() * (W - 56),
          y: -18,
          vy: 175 + Math.min(240, score * 0.4),
          r: 9 + Math.random() * 5,
          rot: Math.random() * Math.PI * 2,
        });
        spawnAcc = Math.max(0.38, 1.05 - score * 0.0018);
      }

      for (const o of orbs) {
        o.y += o.vy * dt;
        o.rot += dt * 2.2;
      }

      const paddleLeft = paddleX - PADDLE_W * 0.5;
      const paddleRight = paddleX + PADDLE_W * 0.5;

      for (let i = orbs.length - 1; i >= 0; i--) {
        const o = orbs[i];
        let caught = false;
        if (
          o.y + o.r >= PADDLE_TOP &&
          o.y - o.r <= PADDLE_TOP + PADDLE_H &&
          o.x >= paddleLeft - o.r * 0.2 &&
          o.x <= paddleRight + o.r * 0.2
        ) {
          caught = true;
        }
        if (caught) {
          score += 10 + Math.min(30, Math.floor(score / 50));
          beep(320 + (score % 5) * 25, 0.06, 0.075);
          orbs.splice(i, 1);
          continue;
        }
        if (o.y - o.r > H + 30) {
          lives--;
          toneLow(90, 0.12);
          orbs.splice(i, 1);
          if (lives <= 0) {
            gameOver();
            break;
          }
        }
      }

      if (state === "play") {
        if (scoreEl) scoreEl.textContent = String(score);
        if (livesEl) livesEl.textContent = "♥".repeat(Math.max(0, lives)) + "♡".repeat(3 - Math.max(0, lives));
      }
    }

    draw();
    if (loopOn) requestAnimationFrame(tick);
  }

  function draw() {
    syncCanvasSize();
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "#060a12");
    g.addColorStop(1, "#0c1522");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = "rgba(61, 255, 206, 0.04)";
    for (let x = (bgT * 40) % 60; x < W + 60; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }

    for (const o of orbs) {
      ctx.save();
      ctx.translate(o.x, o.y);
      ctx.rotate(o.rot);
      const grd = ctx.createRadialGradient(0, 0, 1, 0, 0, o.r);
      grd.addColorStop(0, "rgba(200, 255, 250, 0.95)");
      grd.addColorStop(0.45, "rgba(61, 255, 206, 0.75)");
      grd.addColorStop(1, "rgba(20, 80, 90, 0.3)");
      ctx.fillStyle = grd;
      ctx.shadowColor = "rgba(61, 255, 206, 0.6)";
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(0, 0, o.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    ctx.save();
    ctx.fillStyle = "rgba(20, 35, 45, 0.95)";
    ctx.strokeStyle = "rgba(61, 255, 206, 0.45)";
    ctx.lineWidth = 2;
    const px = paddleX - PADDLE_W * 0.5;
    const py = PADDLE_TOP;
    const r = 7;
    ctx.beginPath();
    ctx.moveTo(px + r, py);
    ctx.lineTo(px + PADDLE_W - r, py);
    ctx.quadraticCurveTo(px + PADDLE_W, py, px + PADDLE_W, py + r);
    ctx.lineTo(px + PADDLE_W, py + PADDLE_H - r);
    ctx.quadraticCurveTo(px + PADDLE_W, py + PADDLE_H, px + PADDLE_W - r, py + PADDLE_H);
    ctx.lineTo(px + r, py + PADDLE_H);
    ctx.quadraticCurveTo(px, py + PADDLE_H, px, py + PADDLE_H - r);
    ctx.lineTo(px, py + r);
    ctx.quadraticCurveTo(px, py, px + r, py);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(61, 255, 206, 0.35)";
    ctx.fillRect(px + 8, py + 4, PADDLE_W - 16, 3);
    ctx.restore();

    if (state === "pause") {
      ctx.fillStyle = "rgba(5, 8, 12, 0.75)";
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = "center";
      ctx.font = "700 32px Outfit, system-ui, sans-serif";
      ctx.fillStyle = "#e8f0ff";
      ctx.fillText("Paused", W * 0.5, H * 0.5 - 6);
      ctx.font = "400 14px Outfit, system-ui, sans-serif";
      ctx.fillStyle = "rgba(107, 122, 144, 0.95)";
      ctx.fillText("P or Space to resume", W * 0.5, H * 0.5 + 22);
    }
  }

  function startLoop() {
    if (loopOn) return;
    loopOn = true;
    last = performance.now();
    requestAnimationFrame(tick);
  }

  function stopLoop() {
    loopOn = false;
  }

  function bootNeon() {
    resetRun();
    openMenu(
      "Neon Catch",
      "Move the paddle to catch falling orbs. Speed ramps with your score. Mouse or A D / arrows · P pause · three misses ends the run.",
      false,
      0,
    );
    if (hintEl) {
      hintEl.textContent = "Drag on the playfield, mouse, or A D / arrows · catch orbs · P pause · Enter / Start";
    }
    requestAnimationFrame(() => startLoop());
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
    });
  }

  if (startBtn) {
    startBtn.addEventListener("click", () => {
      ensureAudio();
      resetRun();
      closeMenuPlay();
    });
  }

  function syncNeonPaddle(clientX, rect) {
    if (rect.width < 2) return;
    const scale = W / rect.width;
    paddleX = (clientX - rect.left) * scale;
    paddleX = Math.max(PADDLE_W * 0.5 + 6, Math.min(W - PADDLE_W * 0.5 - 6, paddleX));
  }

  canvas.addEventListener("mousemove", (e) => {
    if (state !== "play" || !neonShellActive()) return;
    syncNeonPaddle(e.clientX, canvas.getBoundingClientRect());
  });

  canvas.addEventListener(
    "touchstart",
    (e) => {
      if (state !== "play" || !neonShellActive()) return;
      e.preventDefault();
      const t = e.touches[0];
      syncNeonPaddle(t.clientX, canvas.getBoundingClientRect());
    },
    { passive: false },
  );
  canvas.addEventListener(
    "touchmove",
    (e) => {
      if (state !== "play" || !neonShellActive()) return;
      e.preventDefault();
      const t = e.touches[0];
      syncNeonPaddle(t.clientX, canvas.getBoundingClientRect());
    },
    { passive: false },
  );

  window.addEventListener("keydown", (e) => {
    if (!neonShellActive()) return;
    const menuOpen = overlay && !overlay.classList.contains("hidden");
    if (menuOpen && state === "menu") {
      if (e.code === "Enter" || e.code === "Space") {
        e.preventDefault();
        ensureAudio();
        resetRun();
        closeMenuPlay();
      }
      return;
    }
    keys[e.code] = true;
    if (state === "play") {
      if (e.code === "KeyP" || e.code === "Space") {
        e.preventDefault();
        state = "pause";
      }
    } else if (state === "pause") {
      if (e.code === "KeyP" || e.code === "Space") {
        e.preventDefault();
        state = "play";
      }
    }
  });

  window.addEventListener("keyup", (e) => {
    if (!neonShellActive()) return;
    keys[e.code] = false;
  });

  window.addEventListener("arcade:play", (e) => {
    const id = e.detail && e.detail.id;
    if (id === "neon-catch") {
      bootNeon();
    } else {
      stopLoop();
    }
  });

  window.addEventListener("arcade:leave", () => {
    stopLoop();
    state = "menu";
    if (overlay) overlay.classList.remove("hidden");
  });
})();
