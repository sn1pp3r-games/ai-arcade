(function () {
  "use strict";

  const WALL = 1;
  const PATH = 0;
  /** Shortest path (in cells) from start to exit goal must be at least this many steps. */
  const MIN_EXIT_STEPS = 5;

  const mazeRoot = document.getElementById("game-shell-maze");
  const canvas = document.getElementById("game-maze");
  const ctx = canvas.getContext("2d");
  const btnNew = document.getElementById("maze-btn-new");
  const btnAgain = document.getElementById("maze-btn-again");
  const btnSound = document.getElementById("maze-btn-sound");
  const statMoves = document.getElementById("maze-stat-moves");
  const statPar = document.getElementById("maze-stat-par");
  const statTime = document.getElementById("maze-stat-time");
  const winOverlay = document.getElementById("maze-win-overlay");
  const winStats = document.getElementById("maze-win-stats");
  const winStars = document.getElementById("maze-win-stars");

  const staticCanvas = document.createElement("canvas");
  const sctx = staticCanvas.getContext("2d");
  const fogScratch = document.createElement("canvas");
  const fogCtx = fogScratch.getContext("2d");

  function ensureFogLayerSize() {
    if (fogScratch.width !== logicalSize || fogScratch.height !== logicalSize) {
      fogScratch.width = logicalSize;
      fogScratch.height = logicalSize;
    }
  }

  const sizeButtons = mazeRoot ? mazeRoot.querySelectorAll(".maze-size-btn") : [];
  const dpadButtons = mazeRoot ? mazeRoot.querySelectorAll(".maze-dpad-btn") : [];

  let mazeLoopOn = false;
  let mazeRafId = 0;

  function mazeShellActive() {
    return (
      mazeRoot && !mazeRoot.classList.contains("hidden") && !mazeRoot.hasAttribute("hidden")
    );
  }

  let cols = 31;
  let rows = 31;
  let logicalSize = 800;

  let grid;
  let visited;
  let player = { x: 1, y: 1 };
  let goal = { x: 1, y: 1 };
  /** Single outer cell opened as PATH; null if fallback placement has no border exit */
  let exitHole = null;
  let optimalMoves = 0;
  let moves = 0;
  let startedAt = null;
  let timerId = null;
  let finished = false;
  let moveAnim = null;
  let particles = [];
  let audioCtx = null;
  let soundOn = true;

  const mqReduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  let reduceMotion = mqReduce.matches;
  mqReduce.addEventListener("change", () => {
    reduceMotion = mqReduce.matches;
    if (reduceMotion) moveAnim = null;
  });

  function generateMaze(w, h) {
    const g = Array.from({ length: h }, () => Array(w).fill(WALL));
    const stack = [];
    const startX = 1;
    const startY = 1;
    g[startY][startX] = PATH;
    stack.push([startX, startY]);
    const dirs = [
      [0, -2],
      [2, 0],
      [0, 2],
      [-2, 0],
    ];
    while (stack.length) {
      const [cx, cy] = stack[stack.length - 1];
      const neighbors = [];
      for (const [dx, dy] of dirs) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 1 || nx >= w - 1 || ny < 1 || ny >= h - 1) continue;
        if (g[ny][nx] === WALL) neighbors.push([nx, ny, cx + dx / 2, cy + dy / 2]);
      }
      if (neighbors.length === 0) {
        stack.pop();
        continue;
      }
      const pick = neighbors[Math.floor(Math.random() * neighbors.length)];
      const [nx, ny, wx, wy] = pick;
      g[wy][wx] = PATH;
      g[ny][nx] = PATH;
      stack.push([nx, ny]);
    }
    return g;
  }

  function bfsDistancesFrom(sx, sy) {
    const dist = Array.from({ length: rows }, () => Array(cols).fill(-1));
    const q = [];
    let qi = 0;
    q.push([sx, sy]);
    dist[sy][sx] = 0;
    while (qi < q.length) {
      const [x, y] = q[qi++];
      const d = dist[y][x];
      for (const [dx, dy] of [
        [0, -1],
        [1, 0],
        [0, 1],
        [-1, 0],
      ]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
        if (grid[ny][nx] !== PATH || dist[ny][nx] !== -1) continue;
        dist[ny][nx] = d + 1;
        q.push([nx, ny]);
      }
    }
    return dist;
  }

  function findFarthestFrom(sx, sy) {
    const dist = bfsDistancesFrom(sx, sy);
    let best = { x: sx, y: sy, d: 0 };
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const d = dist[y][x];
        if (d > best.d) best = { x, y, d };
      }
    }
    return best;
  }

  /** Interior PATH cells beside the outer wall, with matching hole coordinates (excludes start). */
  function collectBorderExitCandidates() {
    const out = [];
    for (let y = 1; y < rows - 1; y++) {
      for (let x = 1; x < cols - 1; x++) {
        if (grid[y][x] !== PATH) continue;
        if (x === 1 && y === 1) continue;
        if (x === 1 && grid[y][0] === WALL) {
          out.push({ goal: { x: 1, y }, hole: { x: 0, y } });
          continue;
        }
        if (x === cols - 2 && grid[y][cols - 1] === WALL) {
          out.push({ goal: { x: cols - 2, y }, hole: { x: cols - 1, y } });
          continue;
        }
        if (y === 1 && grid[0][x] === WALL) {
          out.push({ goal: { x, y: 1 }, hole: { x, y: 0 } });
          continue;
        }
        if (y === rows - 2 && grid[rows - 1][x] === WALL) {
          out.push({ goal: { x, y: rows - 2 }, hole: { x, y: rows - 1 } });
        }
      }
    }
    return out;
  }

  /** Random border exit with BFS distance from start ≥ MIN_EXIT_STEPS; else random among farthest. */
  function pickRandomExitCandidate(candidates) {
    if (!candidates.length) return null;
    const dist = bfsDistancesFrom(player.x, player.y);
    const reachable = candidates.filter((c) => dist[c.goal.y][c.goal.x] >= 0);
    if (!reachable.length) return null;
    let pool = reachable.filter((c) => dist[c.goal.y][c.goal.x] >= MIN_EXIT_STEPS);
    if (pool.length === 0) {
      let maxD = -1;
      for (const c of reachable) {
        const d = dist[c.goal.y][c.goal.x];
        if (d > maxD) maxD = d;
      }
      pool = reachable.filter((c) => dist[c.goal.y][c.goal.x] === maxD);
    }
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function shortestPathLength(sx, sy, gx, gy) {
    const dist = bfsDistancesFrom(sx, sy);
    const d = dist[gy][gx];
    return d < 0 ? -1 : d;
  }

  function placeGoal() {
    exitHole = null;
    const candidates = collectBorderExitCandidates();
    if (candidates.length === 0) {
      const a = findFarthestFrom(player.x, player.y);
      const b = findFarthestFrom(a.x, a.y);
      goal = { x: b.x, y: b.y };
      return;
    }
    const picked = pickRandomExitCandidate(candidates);
    if (!picked) {
      const a = findFarthestFrom(player.x, player.y);
      goal = { x: a.x, y: a.y };
      return;
    }
    goal = { x: picked.goal.x, y: picked.goal.y };
    exitHole = { x: picked.hole.x, y: picked.hole.y };
    grid[exitHole.y][exitHole.x] = PATH;
  }

  function cellSize() {
    return logicalSize / cols;
  }

  function rebuildStaticLayer() {
    const cs = cellSize();
    staticCanvas.width = logicalSize;
    staticCanvas.height = logicalSize;
    sctx.fillStyle = "#0c1018";
    sctx.fillRect(0, 0, logicalSize, logicalSize);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (grid[y][x] !== WALL) continue;
        const px = x * cs;
        const py = y * cs;
        sctx.fillStyle = "#1a222d";
        sctx.fillRect(px, py, cs + 0.5, cs + 0.5);
        sctx.strokeStyle = "rgba(255,255,255,0.06)";
        sctx.lineWidth = Math.max(0.5, cs * 0.02);
        sctx.beginPath();
        sctx.moveTo(px, py + cs);
        sctx.lineTo(px, py);
        sctx.lineTo(px + cs, py);
        sctx.stroke();
        sctx.strokeStyle = "rgba(0,0,0,0.35)";
        sctx.beginPath();
        sctx.moveTo(px + cs, py);
        sctx.lineTo(px + cs, py + cs);
        sctx.lineTo(px, py + cs);
        sctx.stroke();
      }
    }
  }

  function getPlayerCenter() {
    if (reduceMotion || !moveAnim) {
      return { x: player.x + 0.5, y: player.y + 0.5 };
    }
    const elapsed = performance.now() - moveAnim.t0;
    const t = Math.min(1, elapsed / moveAnim.dur);
    const e = 1 - Math.pow(1 - t, 3);
    const px = moveAnim.from.x + 0.5 + (moveAnim.to.x - moveAnim.from.x) * e;
    const py = moveAnim.from.y + 0.5 + (moveAnim.to.y - moveAnim.from.y) * e;
    if (t >= 1) moveAnim = null;
    return { x: px, y: py };
  }

  /** Full maze overview; placed in the corner diagonally opposite the player on screen. */
  function drawMiniMap(px, py, pc) {
    if (!grid) return;
    const pad = 10;
    const mw = Math.min(176, Math.max(100, logicalSize * 0.2));
    const mh = (mw * rows) / cols;
    const leftHalf = px < logicalSize * 0.5;
    const topHalf = py < logicalSize * 0.5;
    let mx;
    let my;
    if (leftHalf && topHalf) {
      mx = logicalSize - pad - mw;
      my = logicalSize - pad - mh;
    } else if (!leftHalf && topHalf) {
      mx = pad;
      my = logicalSize - pad - mh;
    } else if (leftHalf && !topHalf) {
      mx = logicalSize - pad - mw;
      my = pad;
    } else {
      mx = pad;
      my = pad;
    }

    const mcs = mw / cols;
    ctx.save();
    ctx.fillStyle = "rgba(6, 10, 18, 0.94)";
    ctx.strokeStyle = "rgba(88, 166, 255, 0.5)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.rect(mx - 3, my - 3, mw + 6, mh + 6);
    ctx.fill();
    ctx.stroke();

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const cx = mx + x * mcs;
        const cy = my + y * mcs;
        if (grid[y][x] === WALL) {
          ctx.fillStyle = "#1a222d";
        } else if (visited[y][x]) {
          ctx.fillStyle = "rgba(88, 166, 255, 0.35)";
        } else {
          ctx.fillStyle = "#222a38";
        }
        ctx.fillRect(cx, cy, mcs + 0.4, mcs + 0.4);
      }
    }

    if (exitHole) {
      ctx.fillStyle = "rgba(130, 190, 255, 0.95)";
      ctx.fillRect(mx + exitHole.x * mcs, my + exitHole.y * mcs, mcs, mcs);
    }

    ctx.fillStyle = "#3fb950";
    ctx.beginPath();
    ctx.arc(mx + goal.x * mcs + mcs * 0.5, my + goal.y * mcs + mcs * 0.5, Math.max(1.4, mcs * 0.38), 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#f0883e";
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(mx + pc.x * mcs, my + pc.y * mcs, Math.max(1.6, mcs * 0.42), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    const fs = Math.max(8, mw * 0.065);
    ctx.font = `600 ${fs}px Outfit, system-ui, sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const label = "Map";
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillRect(mx + 3, my + 3, tw + 8, fs + 4);
    ctx.fillStyle = "rgba(200, 220, 255, 0.92)";
    ctx.fillText(label, mx + 6, my + 4);
    ctx.restore();
  }

  function draw() {
    const cs = cellSize();
    const t = performance.now() * 0.004;

    ctx.fillStyle = "#0c1018";
    ctx.fillRect(0, 0, logicalSize, logicalSize);
    ctx.drawImage(staticCanvas, 0, 0);

    if (exitHole) {
      const hx = exitHole.x * cs;
      const hy = exitHole.y * cs;
      let g;
      if (exitHole.x === 0) {
        g = ctx.createLinearGradient(hx + cs, hy + cs / 2, hx, hy + cs / 2);
        g.addColorStop(0, "rgba(130, 190, 255, 0.35)");
        g.addColorStop(0.55, "rgba(40, 70, 110, 0.5)");
        g.addColorStop(1, "rgba(12, 18, 28, 0.98)");
      } else if (exitHole.x === cols - 1) {
        g = ctx.createLinearGradient(hx, hy + cs / 2, hx + cs, hy + cs / 2);
        g.addColorStop(0, "rgba(130, 190, 255, 0.35)");
        g.addColorStop(0.55, "rgba(40, 70, 110, 0.5)");
        g.addColorStop(1, "rgba(12, 18, 28, 0.98)");
      } else if (exitHole.y === 0) {
        g = ctx.createLinearGradient(hx + cs / 2, hy + cs, hx + cs / 2, hy);
        g.addColorStop(0, "rgba(130, 190, 255, 0.35)");
        g.addColorStop(0.55, "rgba(40, 70, 110, 0.5)");
        g.addColorStop(1, "rgba(12, 18, 28, 0.98)");
      } else {
        g = ctx.createLinearGradient(hx + cs / 2, hy, hx + cs / 2, hy + cs);
        g.addColorStop(0, "rgba(130, 190, 255, 0.35)");
        g.addColorStop(0.55, "rgba(40, 70, 110, 0.5)");
        g.addColorStop(1, "rgba(12, 18, 28, 0.98)");
      }
      ctx.fillStyle = g;
      ctx.fillRect(hx, hy, cs + 0.5, cs + 0.5);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
      ctx.lineWidth = Math.max(1, cs * 0.06);
      ctx.strokeRect(hx + cs * 0.08, hy + cs * 0.08, cs - cs * 0.16, cs - cs * 0.16);
      ctx.save();
      ctx.fillStyle = "rgba(200, 230, 255, 0.85)";
      ctx.font = `600 ${Math.max(8, cs * 0.22)}px Outfit, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("EXIT", hx + cs / 2, hy + cs / 2);
      ctx.restore();
    }

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (!visited[y][x] || grid[y][x] !== PATH) continue;
        ctx.fillStyle = "rgba(88, 166, 255, 0.1)";
        ctx.fillRect(x * cs, y * cs, cs + 0.5, cs + 0.5);
      }
    }

    const pulse = reduceMotion ? 1 : 0.85 + Math.sin(t * 1.2) * 0.15;
    const gx = goal.x * cs + cs / 2;
    const gy = goal.y * cs + cs / 2;
    const gr = cs * (0.2 + 0.04 * pulse);

    ctx.save();
    ctx.fillStyle = "rgba(63, 185, 80, 0.18)";
    ctx.beginPath();
    ctx.arc(gx, gy, gr + cs * 0.12, 0, Math.PI * 2);
    ctx.fill();
    const grad = ctx.createRadialGradient(gx - gr * 0.3, gy - gr * 0.3, 0, gx, gy, gr * 1.4);
    grad.addColorStop(0, "#5cff7a");
    grad.addColorStop(1, "#2a9a42");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(gx, gy, gr, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = Math.max(1, cs * 0.04);
    ctx.stroke();
    ctx.restore();

    if (finished && particles.length) {
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.12;
        p.life -= 0.014;
        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    const pc = getPlayerCenter();
    const pr = cs * 0.28;
    const px = pc.x * cs;
    const py = pc.y * cs;

    if (!finished) {
      ensureFogLayerSize();
      const fc = fogCtx;
      fc.setTransform(1, 0, 0, 1, 0, 0);
      fc.clearRect(0, 0, logicalSize, logicalSize);
      fc.globalCompositeOperation = "source-over";
      fc.fillStyle = "rgba(3, 5, 12, 0.94)";
      fc.fillRect(0, 0, logicalSize, logicalSize);
      fc.globalCompositeOperation = "destination-out";
      const lightOuter = cs * (reduceMotion ? 5.45 : 6.2);
      const lg = fc.createRadialGradient(px, py, 0, px, py, lightOuter);
      lg.addColorStop(0, "rgba(255, 250, 235, 1)");
      lg.addColorStop(0.18, "rgba(255, 255, 255, 0.78)");
      lg.addColorStop(0.45, "rgba(255, 255, 255, 0.26)");
      lg.addColorStop(0.7, "rgba(255, 255, 255, 0.05)");
      lg.addColorStop(1, "rgba(255, 255, 255, 0)");
      fc.fillStyle = lg;
      fc.fillRect(0, 0, logicalSize, logicalSize);
      fc.globalCompositeOperation = "source-over";
      ctx.drawImage(fogScratch, 0, 0);
    }

    ctx.save();
    ctx.shadowColor = "rgba(255, 200, 120, 0.95)";
    ctx.shadowBlur = cs * (reduceMotion ? 0.45 : 0.65);
    const pGrad = ctx.createRadialGradient(px - pr * 0.35, py - pr * 0.35, 0, px, py, pr * 1.3);
    pGrad.addColorStop(0, "#fff4e6");
    pGrad.addColorStop(0.45, "#ffc48a");
    pGrad.addColorStop(0.85, "#f0883e");
    pGrad.addColorStop(1, "#c55f18");
    ctx.fillStyle = pGrad;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = Math.max(1, cs * 0.055);
    ctx.stroke();
    ctx.restore();

    drawMiniMap(px, py, pc);
  }

  function formatTime(ms) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return m + ":" + (r < 10 ? "0" : "") + r;
  }

  function tickTimer() {
    if (finished || !startedAt) return;
    statTime.textContent = formatTime(Date.now() - startedAt);
  }

  function startTimer() {
    stopTimer();
    startedAt = Date.now();
    statTime.textContent = "0:00";
    timerId = setInterval(tickTimer, 250);
  }

  function stopTimer() {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  function updateStats() {
    statMoves.textContent = moves + (moves === 1 ? " move" : " moves");
    if (startedAt && !finished) tickTimer();
  }

  function getAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtx;
  }

  function playStepSound() {
    if (!soundOn) return;
    const ac = getAudio();
    if (ac.state === "suspended") ac.resume();
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.connect(g);
    g.connect(ac.destination);
    osc.type = "sine";
    osc.frequency.value = 340 + Math.random() * 30;
    const now = ac.currentTime;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.055, now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  function playWinSound() {
    if (!soundOn) return;
    const ac = getAudio();
    if (ac.state === "suspended") ac.resume();
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, i) => {
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.connect(g);
      g.connect(ac.destination);
      osc.type = "triangle";
      osc.frequency.value = freq;
      const now = ac.currentTime + i * 0.07;
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.05, now + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
      osc.start(now);
      osc.stop(now + 0.5);
    });
  }

  function starCount(movesCount, optimal) {
    if (optimal <= 0) return 3;
    const r = movesCount / optimal;
    if (r <= 1.02) return 3;
    if (r <= 1.22) return 2;
    return 1;
  }

  function spawnWinParticles() {
    const cs = cellSize();
    let cx = goal.x * cs + cs / 2;
    let cy = goal.y * cs + cs / 2;
    if (exitHole) {
      cx = ((goal.x + exitHole.x) / 2 + 0.5) * cs;
      cy = ((goal.y + exitHole.y) / 2 + 0.5) * cs;
    }
    const palette = ["#3fb950", "#58a6ff", "#f0c14d", "#f0883e", "#a371f7"];
    for (let i = 0; i < 64; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 1.8 + Math.random() * 5;
      particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 1.2,
        life: 0.85 + Math.random() * 0.35,
        r: cs * (0.04 + Math.random() * 0.05),
        color: palette[i % palette.length],
      });
    }
  }

  function tryMove(dx, dy) {
    if (finished) return false;
    const nx = player.x + dx;
    const ny = player.y + dy;
    if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) return false;
    if (grid[ny][nx] !== PATH) return false;
    const from = { x: player.x, y: player.y };
    player = { x: nx, y: ny };
    visited[ny][nx] = true;
    if (!reduceMotion) {
      moveAnim = { from: from, to: { x: nx, y: ny }, t0: performance.now(), dur: 130 };
    }
    moves++;
    playStepSound();
    if (!startedAt) startTimer();
    updateStats();
    const atGoal = player.x === goal.x && player.y === goal.y;
    const atHole = exitHole && player.x === exitHole.x && player.y === exitHole.y;
    if (atGoal || atHole) {
      win();
    }
    return true;
  }

  function win() {
    finished = true;
    stopTimer();
    const elapsed = startedAt ? Date.now() - startedAt : 0;
    const stars = starCount(moves, optimalMoves);
    const starLabel = stars + " of 3 stars";
    winStars.innerHTML = "";
    for (let i = 0; i < 3; i++) {
      const span = document.createElement("span");
      span.textContent = "★";
      if (i >= stars) span.className = "dim";
      winStars.appendChild(span);
    }
    winStars.setAttribute("aria-label", starLabel);

    winStats.textContent =
      moves +
      (moves === 1 ? " move" : " moves") +
      " · optimal " +
      optimalMoves +
      " · " +
      formatTime(elapsed) +
      " · New maze (R) or Play again.";
    winOverlay.classList.remove("hidden");
    playWinSound();
    if (!reduceMotion) spawnWinParticles();
    btnAgain.focus();
  }

  function resetGameState() {
    moves = 0;
    startedAt = null;
    finished = false;
    moveAnim = null;
    particles = [];
    stopTimer();
    statMoves.textContent = "0 moves";
    statTime.textContent = "0:00";
    winOverlay.classList.add("hidden");
  }

  function resizeCanvas() {
    const wrap = document.getElementById("maze-canvas-wrap");
    logicalSize = Math.min(800, Math.floor((wrap?.clientWidth || 800) - 2));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.style.width = logicalSize + "px";
    canvas.style.height = logicalSize + "px";
    canvas.width = Math.floor(logicalSize * dpr);
    canvas.height = Math.floor(logicalSize * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (grid) rebuildStaticLayer();
  }

  function syncParDisplay() {
    statPar.classList.remove("hidden");
    statPar.textContent = "Par " + optimalMoves;
  }

  function newMaze() {
    resetGameState();
    grid = generateMaze(cols, rows);
    visited = Array.from({ length: rows }, () => Array(cols).fill(false));
    player = { x: 1, y: 1 };
    visited[1][1] = true;
    placeGoal();
    optimalMoves = shortestPathLength(1, 1, goal.x, goal.y);
    if (optimalMoves < 0) optimalMoves = 0;
    syncParDisplay();
    resizeCanvas();
  }

  function loop() {
    if (!mazeLoopOn) return;
    draw();
    mazeRafId = requestAnimationFrame(loop);
  }

  function startMazeLoop() {
    if (mazeLoopOn) return;
    mazeLoopOn = true;
    mazeRafId = requestAnimationFrame(loop);
  }

  function stopMazeLoop() {
    mazeLoopOn = false;
    if (mazeRafId) cancelAnimationFrame(mazeRafId);
    mazeRafId = 0;
  }

  function onKeydown(e) {
    if (!mazeShellActive()) return;
    if (e.key === "Escape") {
      if (!winOverlay.classList.contains("hidden")) {
        e.preventDefault();
        newMaze();
      }
      return;
    }
    if (e.key === "m" || e.key === "M") {
      e.preventDefault();
      soundOn = !soundOn;
      btnSound.setAttribute("aria-pressed", soundOn ? "true" : "false");
      btnSound.textContent = soundOn ? "Sound on" : "Sound off";
      return;
    }
    if (e.key === "r" || e.key === "R") {
      e.preventDefault();
      newMaze();
      return;
    }
    const key = e.key.toLowerCase();
    let dx = 0;
    let dy = 0;
    if (e.key === "ArrowUp" || key === "w") dy = -1;
    else if (e.key === "ArrowDown" || key === "s") dy = 1;
    else if (e.key === "ArrowLeft" || key === "a") dx = -1;
    else if (e.key === "ArrowRight" || key === "d") dx = 1;
    else return;
    e.preventDefault();
    tryMove(dx, dy);
  }

  window.addEventListener("keydown", onKeydown);

  canvas.addEventListener("click", () => {
    if (mazeShellActive()) canvas.focus();
  });

  let touchOrigin = null;
  canvas.addEventListener(
    "touchstart",
    (e) => {
      if (!mazeShellActive()) return;
      if (e.touches.length !== 1) return;
      const r = canvas.getBoundingClientRect();
      touchOrigin = { x: e.touches[0].clientX - r.left, y: e.touches[0].clientY - r.top };
    },
    { passive: true }
  );
  canvas.addEventListener(
    "touchend",
    (e) => {
      if (!mazeShellActive()) return;
      if (!touchOrigin || !e.changedTouches.length) return;
      const r = canvas.getBoundingClientRect();
      const x = e.changedTouches[0].clientX - r.left;
      const y = e.changedTouches[0].clientY - r.top;
      const dx = x - touchOrigin.x;
      const dy = y - touchOrigin.y;
      touchOrigin = null;
      const dist = Math.hypot(dx, dy);
      if (dist < 18) return;
      if (Math.abs(dx) > Math.abs(dy)) tryMove(dx > 0 ? 1 : -1, 0);
      else tryMove(0, dy > 0 ? 1 : -1);
      e.preventDefault();
    },
    { passive: false }
  );

  btnNew.addEventListener("click", newMaze);
  btnAgain.addEventListener("click", newMaze);

  btnSound.addEventListener("click", () => {
    soundOn = !soundOn;
    btnSound.setAttribute("aria-pressed", soundOn ? "true" : "false");
    btnSound.textContent = soundOn ? "Sound on" : "Sound off";
    getAudio().resume().catch(() => {});
  });

  sizeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      cols = parseInt(btn.dataset.cols, 10);
      rows = parseInt(btn.dataset.rows, 10);
      sizeButtons.forEach((b) => b.setAttribute("aria-pressed", b === btn ? "true" : "false"));
      newMaze();
    });
  });

  dpadButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      tryMove(parseInt(btn.dataset.dx, 10), parseInt(btn.dataset.dy, 10));
      canvas.focus();
    });
  });

  window.addEventListener("resize", () => {
    if (mazeShellActive()) resizeCanvas();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && audioCtx && audioCtx.state === "running") {
      audioCtx.suspend().catch(() => {});
    }
  });

  window.addEventListener("arcade:play", (e) => {
    const id = e.detail && e.detail.id;
    if (id === "maze-game") {
      resizeCanvas();
      if (!grid) newMaze();
      else resizeCanvas();
      startMazeLoop();
      canvas.focus();
    } else {
      stopMazeLoop();
    }
  });

  window.addEventListener("arcade:leave", () => {
    stopMazeLoop();
  });
})();
