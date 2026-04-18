(() => {
  "use strict";

  const TILE = {
    GRASS: 0,
    PATH: 1,
    ENTRANCE: 2,
    FERRIS: 3,
    COASTER: 4,
    FOOD: 5,
    TREE: 6,
    FOUNTAIN: 7,
    CAROUSEL: 8,
    GIFT: 9,
    BATHROOM: 10,
    BENCH: 11,
    LAMP: 12,
    HAUNTED: 13,
    BUMPERS: 14,
    FLUME: 15,
    PIZZA: 16,
    ICECREAM: 17,
    ATM: 18,
    FIRSTAID: 19,
    STATUE: 20,
    HEDGE: 21,
    STAGE: 22,
  };

  const KIND_LABEL = {
    infra: "Infrastructure",
    ride: "Ride",
    stall: "Shop",
    service: "Services",
    decor: "Scenery",
  };

  const BUILD = [
    {
      id: "path",
      tile: TILE.PATH,
      name: "Path",
      icon: "▦",
      cost: 35,
      upkeep: 0,
      appeal: 0,
      income: 0,
      kind: "infra",
      blurb:
        "Guests walk on paths from the gate. Lay paths so attractions touch a path that connects back to the entrance—otherwise they do not count as “connected” for guests and income.",
    },
    {
      id: "ferris",
      tile: TILE.FERRIS,
      name: "Ferris wheel",
      icon: "◎",
      cost: 1100,
      upkeep: 7,
      appeal: 12,
      income: 24,
      kind: "ride",
      blurb:
        "A classic skyline ride with steady income. Connect it to the path network to draw guests and count toward ride variety.",
    },
    {
      id: "carousel",
      tile: TILE.CAROUSEL,
      name: "Carousel",
      icon: "♫",
      cost: 1800,
      upkeep: 9,
      appeal: 16,
      income: 28,
      kind: "ride",
      blurb:
        "Family-friendly with solid appeal. Mix different ride types to increase the variety bonus on guest caps and income.",
    },
    {
      id: "coaster",
      tile: TILE.COASTER,
      name: "Hyper coaster",
      icon: "◇",
      cost: 6200,
      upkeep: 32,
      appeal: 42,
      income: 105,
      kind: "ride",
      blurb:
        "High cost and upkeep but the best draw and ticket income. Needs paths—orphaned coasters hurt satisfaction.",
    },
    {
      id: "food",
      tile: TILE.FOOD,
      name: "Food stall",
      icon: "▣",
      cost: 480,
      upkeep: 3,
      appeal: 6,
      income: 20,
      kind: "stall",
      blurb:
        "Cheap recurring revenue. Counts toward variety when connected. Pairs well near rides with long queues.",
    },
    {
      id: "gift",
      tile: TILE.GIFT,
      name: "Gift shop",
      icon: "◆",
      cost: 1400,
      upkeep: 6,
      appeal: 8,
      income: 26,
      kind: "stall",
      blurb:
        "Stronger shop income than food with more upkeep. Place along busy paths so it stays connected.",
    },
    {
      id: "bathroom",
      tile: TILE.BATHROOM,
      name: "Restroom",
      icon: "⌂",
      cost: 900,
      upkeep: 5,
      appeal: 4,
      income: 0,
      kind: "service",
      comfort: 18,
      blurb:
        "No direct income but adds comfort, which nudges guest capacity and helps offset crowding stress.",
    },
    {
      id: "tree",
      tile: TILE.TREE,
      name: "Trees",
      icon: "♣",
      cost: 95,
      upkeep: 0.4,
      appeal: 4,
      income: 0,
      kind: "decor",
      blurb:
        "Low-cost greenery and appeal. Does not need to be on the path network, but only connected appeal drives most guest math.",
    },
    {
      id: "fountain",
      tile: TILE.FOUNTAIN,
      name: "Fountain",
      icon: "◉",
      cost: 720,
      upkeep: 2,
      appeal: 11,
      income: 0,
      kind: "decor",
      blurb:
        "High scenery appeal for a centerpiece. Connect it if you want it to boost connected appeal and guests.",
    },
    {
      id: "bench",
      tile: TILE.BENCH,
      name: "Bench",
      icon: "╴",
      cost: 65,
      upkeep: 0.2,
      appeal: 2,
      income: 0,
      kind: "decor",
      comfort: 6,
      blurb:
        "Tiny comfort bonus for cheap—helps a little with how many guests the park can support comfortably.",
    },
    {
      id: "lamp",
      tile: TILE.LAMP,
      name: "Lamp post",
      icon: "✶",
      cost: 85,
      upkeep: 0.35,
      appeal: 3,
      income: 0,
      kind: "decor",
      blurb:
        "Small appeal bump along paths. Useful for filling gaps in scenery without big upkeep.",
    },
    {
      id: "haunted",
      tile: TILE.HAUNTED,
      name: "Haunted house",
      icon: "☾",
      cost: 2650,
      upkeep: 11,
      appeal: 14,
      income: 48,
      kind: "ride",
      blurb:
        "A moody dark ride with strong mid-tier income. Counts toward variety when connected to the path network.",
    },
    {
      id: "bumpers",
      tile: TILE.BUMPERS,
      name: "Bumper cars",
      icon: "⊕",
      cost: 2250,
      upkeep: 10,
      appeal: 13,
      income: 42,
      kind: "ride",
      blurb:
        "Compact arena ride with steady traffic. Great for filling space between bigger coasters.",
    },
    {
      id: "flume",
      tile: TILE.FLUME,
      name: "Log flume",
      icon: "≋",
      cost: 4950,
      upkeep: 27,
      appeal: 36,
      income: 92,
      kind: "ride",
      blurb:
        "A classic water ride with high appeal and income—expensive to build and maintain, but a crowd pleaser.",
    },
    {
      id: "pizza",
      tile: TILE.PIZZA,
      name: "Pizzeria",
      icon: "▶",
      cost: 980,
      upkeep: 4,
      appeal: 7,
      income: 24,
      kind: "stall",
      blurb:
        "Hot food counter with solid per-minute income. Another variety type for shops when connected.",
    },
    {
      id: "icecream",
      tile: TILE.ICECREAM,
      name: "Ice cream",
      icon: "▵",
      cost: 640,
      upkeep: 3,
      appeal: 5,
      income: 19,
      kind: "stall",
      blurb:
        "Cheap stall with reliable snack income—place near paths and warm-weather rides.",
    },
    {
      id: "atm",
      tile: TILE.ATM,
      name: "ATM",
      icon: "₿",
      cost: 420,
      upkeep: 1,
      appeal: 2,
      income: 14,
      kind: "stall",
      blurb:
        "Small passive income from fees. Low appeal but easy to tuck along busy walkways.",
    },
    {
      id: "firstaid",
      tile: TILE.FIRSTAID,
      name: "First aid",
      icon: "+",
      cost: 780,
      upkeep: 4,
      appeal: 3,
      income: 0,
      kind: "service",
      comfort: 22,
      blurb:
        "Improves comfort and helps satisfaction when crowds get heavy. No direct ride income.",
    },
    {
      id: "statue",
      tile: TILE.STATUE,
      name: "Hero statue",
      icon: "♛",
      cost: 290,
      upkeep: 0.6,
      appeal: 14,
      income: 0,
      kind: "decor",
      blurb:
        "High scenery appeal for a single tile—great for plazas and photo spots near paths.",
    },
    {
      id: "hedge",
      tile: TILE.HEDGE,
      name: "Hedge maze",
      icon: "⌗",
      cost: 450,
      upkeep: 1.2,
      appeal: 9,
      income: 0,
      kind: "decor",
      blurb:
        "Decorative greenery that adds visual interest. Connect nearby paths if you want it to boost guest math.",
    },
    {
      id: "stage",
      tile: TILE.STAGE,
      name: "Show stage",
      icon: "♪",
      cost: 1150,
      upkeep: 5,
      appeal: 19,
      income: 8,
      kind: "decor",
      blurb:
        "Outdoor stage with light show income and strong appeal—best as a centerpiece with paths around it.",
    },
  ];

  const BULLDOZE_INFO = {
    name: "Bulldoze",
    kindLabel: "Tool",
    blurb:
      "Removes whatever is on a tile and returns it to grass. You get a partial refund of the original build cost. Cannot remove the park entrance.",
  };

  const BUILD_BY_TILE = {};
  for (const b of BUILD) BUILD_BY_TILE[b.tile] = b;

  const VARIETY_TILES = new Set([
    TILE.FERRIS,
    TILE.CAROUSEL,
    TILE.COASTER,
    TILE.FOOD,
    TILE.GIFT,
    TILE.HAUNTED,
    TILE.BUMPERS,
    TILE.FLUME,
    TILE.PIZZA,
    TILE.ICECREAM,
    TILE.ATM,
    TILE.STAGE,
  ]);

  const ATTRACTION_TILES = new Set([
    TILE.FERRIS,
    TILE.CAROUSEL,
    TILE.COASTER,
    TILE.FOOD,
    TILE.GIFT,
    TILE.HAUNTED,
    TILE.BUMPERS,
    TILE.FLUME,
    TILE.PIZZA,
    TILE.ICECREAM,
    TILE.ATM,
    TILE.STAGE,
  ]);

  const EXPAND_BASE = 2200;
  const EXPAND_BY = 6;
  const REFUND_RATE = 0.48;
  const TILE_PX = 30;
  const MAX_AGENTS = 140;
  const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const state = {
    w: 38,
    h: 30,
    grid: null,
    entrance: { x: 0, y: 0 },
    money: 8200,
    tool: null,
    paused: false,
    speed: 2,
    cam: { x: 0, y: 0, scale: 1 },
    dragging: false,
    dragStart: null,
    camStart: null,
    painting: false,
    paintButton: 0,
    guests: 0,
    guestTarget: 0,
    agents: [],
    lastFrame: 0,
    accSim: 0,
    hover: null,
    staticCanvas: null,
    staticCtx: null,
    staticDirty: true,
    expansions: 0,
    ticketMul: 1,
    timeSec: 0,
    lastPaintCell: null,
    initializedView: false,
    lastBuildSound: 0,
    lastBulldozeSound: 0,
    keysPan: new Set(),
    edgePan: { x: 0, y: 0 },
    mapRevision: 0,
  };

  const canvas = document.getElementById("game-tycoon");
  if (!canvas) return;
  const ctx = canvas.getContext("2d", { alpha: false });
  const minimap = document.getElementById("tycoon-minimap");
  if (!minimap) return;
  const mctx = minimap.getContext("2d", { alpha: false });

  let loopOn = false;

  function tycoonShellActive() {
    const sh = document.getElementById("game-shell-tycoon");
    return sh && !sh.classList.contains("hidden") && !sh.hasAttribute("hidden");
  }

  function startTycoonLoop() {
    if (loopOn) return;
    loopOn = true;
    state.lastFrame = 0;
    requestAnimationFrame(loop);
  }

  function stopTycoonLoop() {
    loopOn = false;
  }

  function maybeShowTutorial() {
    const dlg = document.getElementById("tycoon-tutorial-dialog");
    if (!dlg || typeof dlg.showModal !== "function") return;
    try {
      if (!localStorage.getItem("tycoon_tutorial_v1")) dlg.showModal();
    } catch (_) {}
  }

  function bootTycoon() {
    resizeCanvas();
    centerCamera();
    state.initializedView = true;
    maybeShowTutorial();
    startTycoonLoop();
  }

  const audio = (() => {
    let ctxA = null;
    let master = 0.12;
    function ensure() {
      if (!ctxA) {
        ctxA = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (ctxA.state === "suspended") ctxA.resume();
    }
    function beep(freq, dur, type = "sine", gain = 1) {
      if (!soundEnabled()) return;
      ensure();
      const o = ctxA.createOscillator();
      const g = ctxA.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.value = 0.0001;
      o.connect(g);
      g.connect(ctxA.destination);
      const t = ctxA.currentTime;
      g.gain.exponentialRampToValueAtTime(master * gain, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
    function click() {
      beep(520, 0.04, "triangle", 0.7);
    }
    function build() {
      beep(330, 0.06, "sine", 1);
      setTimeout(() => beep(440, 0.05, "sine", 0.8), 40);
    }
    function bulldoze() {
      beep(180, 0.07, "square", 0.5);
    }
    function deny() {
      beep(120, 0.12, "sawtooth", 0.4);
    }
    return { click, build, bulldoze, deny };
  })();

  function soundEnabled() {
    const el = document.getElementById("tycoon-sound-on");
    return el && el.checked;
  }

  function initGrid() {
    const grid = new Array(state.h);
    for (let y = 0; y < state.h; y++) {
      grid[y] = new Uint8Array(state.w);
    }
    state.grid = grid;
    state.entrance.x = Math.floor(state.w / 2);
    state.entrance.y = state.h - 2;
    state.grid[state.entrance.y][state.entrance.x] = TILE.ENTRANCE;
    const n0 = state.w * state.h;
    state.tileGross = new Float64Array(n0);
    state.tileUpkeep = new Float64Array(n0);
  }

  function inBounds(x, y) {
    return x >= 0 && x < state.w && y >= 0 && y < state.h;
  }

  function countTiles(pred) {
    let n = 0;
    for (let y = 0; y < state.h; y++) {
      for (let x = 0; x < state.w; x++) {
        if (pred(state.grid[y][x])) n++;
      }
    }
    return n;
  }

  function forEachPlaced(fn) {
    for (let y = 0; y < state.h; y++) {
      for (let x = 0; x < state.w; x++) {
        const t = state.grid[y][x];
        if (t === TILE.GRASS || t === TILE.ENTRANCE) continue;
        const b = BUILD_BY_TILE[t];
        if (b) fn(x, y, t, b);
      }
    }
  }

  function pathNeighbors(x, y) {
    const out = [];
    const dirs = [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ];
    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(nx, ny)) continue;
      const t = state.grid[ny][nx];
      if (t === TILE.PATH || t === TILE.ENTRANCE) out.push({ x: nx, y: ny });
    }
    return out;
  }

  function walkThroughTile(t) {
    return t === TILE.PATH || t === TILE.ENTRANCE;
  }

  function agentNeighbors(x, y) {
    const out = [];
    const here = state.grid[y][x];
    const dirs = [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ];
    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(nx, ny)) continue;
      const nt = state.grid[ny][nx];
      if (walkThroughTile(nt)) {
        if (walkThroughTile(here) || ATTRACTION_TILES.has(here)) {
          out.push({ x: nx, y: ny });
        }
      } else if (ATTRACTION_TILES.has(nt)) {
        if (walkThroughTile(here)) {
          out.push({ x: nx, y: ny });
        }
      }
    }
    return out;
  }

  function bfsPath(sx, sy, gx, gy) {
    const w = state.w;
    const h = state.h;
    if (!inBounds(sx, sy) || !inBounds(gx, gy)) return null;
    if (sx === gx && sy === gy) return [];
    const sIdx = sy * w + sx;
    const gIdx = gy * w + gx;
    const prev = new Int32Array(w * h).fill(-1);
    const q = new Int32Array(w * h);
    let qh = 0;
    let qt = 0;
    q[qt++] = sIdx;
    prev[sIdx] = sIdx;
    while (qh < qt) {
      const i = q[qh++];
      if (i === gIdx) {
        const out = [];
        let j = gIdx;
        while (j !== sIdx) {
          const px = j % w;
          const py = (j / w) | 0;
          out.push({ x: px, y: py });
          j = prev[j];
        }
        out.reverse();
        return out;
      }
      const cx = i % w;
      const cy = (i / w) | 0;
      const ns = agentNeighbors(cx, cy);
      for (let k = 0; k < ns.length; k++) {
        const n = ns[k];
        const ni = n.y * w + n.x;
        if (prev[ni] !== -1) continue;
        prev[ni] = i;
        q[qt++] = ni;
      }
    }
    return null;
  }

  function listConnectedAttractions() {
    const dist = bfsDistFromEntrance();
    const out = [];
    for (let y = 0; y < state.h; y++) {
      for (let x = 0; x < state.w; x++) {
        const t = state.grid[y][x];
        if (!ATTRACTION_TILES.has(t)) continue;
        if (isConnectedToPaths(x, y, dist)) out.push({ x, y });
      }
    }
    return out;
  }

  function listReachablePathTiles() {
    const dist = bfsDistFromEntrance();
    const out = [];
    for (let y = 0; y < state.h; y++) {
      for (let x = 0; x < state.w; x++) {
        if (state.grid[y][x] !== TILE.PATH) continue;
        const i = y * state.w + x;
        if (dist[i] !== -1) out.push({ x, y });
      }
    }
    return out;
  }

  function pickNewGoalForAgent(a) {
    const attractions = listConnectedAttractions();
    const paths = listReachablePathTiles();
    const ex = state.entrance.x;
    const ey = state.entrance.y;
    a.waypoints = [];
    if (attractions.length && Math.random() < 0.78) {
      let pick = attractions[(Math.random() * attractions.length) | 0];
      if (attractions.length > 1) {
        let guard = 0;
        while (guard < 4 && pick.x === a.goalGx && pick.y === a.goalGy) {
          pick = attractions[(Math.random() * attractions.length) | 0];
          guard++;
        }
      }
      a.goalGx = pick.x;
      a.goalGy = pick.y;
    } else if (paths.length) {
      const pick = paths[(Math.random() * paths.length) | 0];
      a.goalGx = pick.x;
      a.goalGy = pick.y;
    } else {
      a.goalGx = ex;
      a.goalGy = ey;
    }
  }

  function bfsDistFromEntrance() {
    const dist = new Int16Array(state.w * state.h).fill(-1);
    const q = [];
    let qi = 0;
    const ex = state.entrance.x;
    const ey = state.entrance.y;
    const start = ey * state.w + ex;
    dist[start] = 0;
    q.push(start);
    while (qi < q.length) {
      const i = q[qi++];
      const x = i % state.w;
      const y = (i / state.w) | 0;
      const d = dist[i];
      for (const n of pathNeighbors(x, y)) {
        const ni = n.y * state.w + n.x;
        if (dist[ni] !== -1) continue;
        dist[ni] = d + 1;
        q.push(ni);
      }
    }
    return dist;
  }

  function isConnectedToPaths(x, y, dist) {
    const dirs = [
      [0, 0],
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ];
    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(nx, ny)) continue;
      const t = state.grid[ny][nx];
      if (t === TILE.PATH || t === TILE.ENTRANCE) {
        const i = ny * state.w + nx;
        if (dist[i] !== -1) return true;
      }
    }
    return false;
  }

  function computeEconomy() {
    const pathTiles = countTiles((t) => t === TILE.PATH);
    let appealSum = 0;
    let connectedAppeal = 0;
    let rideIncome = 0;
    let upkeepPerMin = pathTiles * 0.45;
    const varietySet = new Set();
    let comfort = 0;
    let disconnectedAppeal = 0;

    const dist = bfsDistFromEntrance();

    forEachPlaced((x, y, tile, b) => {
      if (tile === TILE.PATH) return;
      appealSum += b.appeal;
      rideIncome += b.income || 0;
      upkeepPerMin += b.upkeep;
      if (b.comfort) comfort += b.comfort;
      const conn = isConnectedToPaths(x, y, dist);
      if (conn) {
        connectedAppeal += b.appeal;
        if (VARIETY_TILES.has(tile)) varietySet.add(tile);
      } else {
        disconnectedAppeal += b.appeal;
      }
    });

    const variety = 1 + Math.min(0.42, varietySet.size * 0.085);
    const pathBonus = 1 + Math.min(0.45, Math.sqrt(pathTiles) * 0.055);
    const rawCap =
      10 +
      connectedAppeal * 1.05 * variety * pathBonus +
      comfort * 0.08;
    const cap = Math.min(520, Math.floor(rawCap));

    const grossBase =
      rideIncome * 1.12 * variety * pathBonus +
      connectedAppeal * 0.38 +
      comfort * 0.12;

    const ticket = state.ticketMul;
    let grossPerMin = grossBase * ticket;

    const crowd = cap > 0 ? state.guests / cap : 0;
    const overcrowd = crowd > 0.92 ? (crowd - 0.92) * 220 : 0;
    const orphan =
      appealSum > 0 ? (disconnectedAppeal / appealSum) * 28 : 0;
    const ticketStress = Math.abs(ticket - 1) * 22;
    const satRaw =
      100 -
      overcrowd -
      orphan -
      ticketStress +
      Math.min(12, varietySet.size * 2) +
      Math.min(8, comfort * 0.04);
    const satisfaction = Math.max(8, Math.min(100, satRaw));

    upkeepPerMin *= 0.92 + 0.08 * (satisfaction / 100);

    const satFactor = 0.55 + 0.45 * (satisfaction / 100);
    grossPerMin *= satFactor;

    const netPerMin = grossPerMin - upkeepPerMin;

    return {
      pathTiles,
      appealSum,
      connectedAppeal,
      disconnectedAppeal,
      cap,
      grossPerMin,
      upkeepPerMin,
      netPerMin,
      satisfaction,
      varietyCount: varietySet.size,
    };
  }

  function resizeCanvas() {
    const wrap = canvas.parentElement;
    const r = wrap.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(r.width * dpr);
    canvas.height = Math.floor(r.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    canvas.style.width = `${r.width}px`;
    canvas.style.height = `${r.height}px`;
  }

  function screenToWorld(sx, sy) {
    const r = canvas.getBoundingClientRect();
    const x = (sx - r.left - state.cam.x) / state.cam.scale;
    const y = (sy - r.top - state.cam.y) / state.cam.scale;
    return { x, y };
  }

  function isAnyDialogOpen() {
    const sd = document.getElementById("tycoon-structure-dialog");
    const tut = document.getElementById("tycoon-tutorial-dialog");
    const ins = document.getElementById("tycoon-tile-inspect-dialog");
    return (
      (sd && (sd.open || sd.hasAttribute("open"))) ||
      (tut && (tut.open || tut.hasAttribute("open"))) ||
      (ins && (ins.open || ins.hasAttribute("open")))
    );
  }

  function zoomAtScreenCenter(deltaScale) {
    const wrap = canvas.parentElement;
    const r = wrap.getBoundingClientRect();
    const sx = r.left + r.width / 2;
    const sy = r.top + r.height / 2;
    const before = screenToWorld(sx, sy);
    const next = Math.min(2.4, Math.max(0.4, state.cam.scale + deltaScale));
    state.cam.scale = next;
    const after = screenToWorld(sx, sy);
    state.cam.x += (before.x - after.x) * state.cam.scale;
    state.cam.y += (before.y - after.y) * state.cam.scale;
  }

  function applyCameraInput(dt) {
    if (isAnyDialogOpen()) return;
    const k = state.keysPan;
    let dx = 0;
    let dy = 0;
    if (k.has("KeyW") || k.has("ArrowUp")) dy += 1;
    if (k.has("KeyS") || k.has("ArrowDown")) dy -= 1;
    if (k.has("KeyA") || k.has("ArrowLeft")) dx += 1;
    if (k.has("KeyD") || k.has("ArrowRight")) dx -= 1;
    const len = Math.hypot(dx, dy);
    const keySpeed = 0.62 * (dt / 16) * 12;
    if (len > 0) {
      state.cam.x += (dx / len) * keySpeed;
      state.cam.y += (dy / len) * keySpeed;
    }
    const ep = state.edgePan;
    const edgeSpeed = 0.52 * (dt / 16) * 12;
    state.cam.x += ep.x * edgeSpeed;
    state.cam.y += ep.y * edgeSpeed;
  }

  const EDGE_PAN_PX = 54;
  function updateEdgePanFromEvent(e) {
    const wrap = document.getElementById("tycoon-canvas-wrap");
    if (!wrap) return;
    const r = wrap.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    if (mx < 0 || my < 0 || mx > r.width || my > r.height) {
      state.edgePan = { x: 0, y: 0 };
      return;
    }
    let vx = 0;
    let vy = 0;
    if (mx < EDGE_PAN_PX) vx = (EDGE_PAN_PX - mx) / EDGE_PAN_PX;
    else if (mx > r.width - EDGE_PAN_PX) vx = -(mx - (r.width - EDGE_PAN_PX)) / EDGE_PAN_PX;
    if (my < EDGE_PAN_PX) vy = (EDGE_PAN_PX - my) / EDGE_PAN_PX;
    else if (my > r.height - EDGE_PAN_PX) vy = -(my - (r.height - EDGE_PAN_PX)) / EDGE_PAN_PX;
    state.edgePan = { x: vx, y: vy };
  }

  function initTutorial() {
    const dlg = document.getElementById("tycoon-tutorial-dialog");
    const closeBtn = document.getElementById("tycoon-tutorial-dialog-close");
    const dismiss = document.getElementById("tycoon-tutorial-dismiss");
    const helpBtn = document.getElementById("tycoon-btn-tutorial");
    if (!dlg) return;

    function closeAndPersist() {
      const cb = document.getElementById("tycoon-tutorial-hide-next");
      if (cb && cb.checked) {
        try {
          localStorage.setItem("tycoon_tutorial_v1", "1");
        } catch (_) {}
      }
      if (typeof dlg.close === "function") dlg.close();
      else dlg.removeAttribute("open");
    }

    closeBtn?.addEventListener("click", closeAndPersist);
    dismiss?.addEventListener("click", closeAndPersist);
    dlg.addEventListener("click", (e) => {
      if (e.target === dlg) closeAndPersist();
    });

    helpBtn?.addEventListener("click", () => {
      if (typeof dlg.showModal === "function") dlg.showModal();
      else dlg.setAttribute("open", "");
      audio.click();
    });

  }

  function worldToGrid(wx, wy) {
    return {
      x: Math.floor(wx / TILE_PX),
      y: Math.floor(wy / TILE_PX),
    };
  }

  function toast(msg) {
    const el = document.getElementById("tycoon-toast");
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => {
      el.hidden = true;
    }, 2400);
  }

  let lastMoneyToast = 0;
  function trySpend(amount) {
    if (state.money < amount) {
      const now = Date.now();
      if (now - lastMoneyToast > 850) {
        toast(`Need $${amount.toLocaleString()}`);
        lastMoneyToast = now;
      }
      audio.deny();
      return false;
    }
    state.money -= amount;
    return true;
  }

  function invalidateMap() {
    state.staticDirty = true;
    state.mapRevision += 1;
  }

  function placeTile(gx, gy, tile, opts = {}) {
    const { silent } = opts;
    if (!inBounds(gx, gy)) return false;
    const cur = state.grid[gy][gx];
    if (cur === TILE.ENTRANCE) return false;
    if (tile === TILE.GRASS) {
      if (cur === TILE.GRASS) return false;
      const b = BUILD_BY_TILE[cur];
      const refund = b ? Math.floor(b.cost * REFUND_RATE) : 0;
      state.money += refund;
      state.grid[gy][gx] = TILE.GRASS;
      const ti = gy * state.w + gx;
      if (state.tileGross) {
        state.tileGross[ti] = 0;
        state.tileUpkeep[ti] = 0;
      }
      invalidateMap();
      if (!silent) {
        const n = Date.now();
        if (n - state.lastBulldozeSound > 90) {
          audio.bulldoze();
          state.lastBulldozeSound = n;
        }
      }
      return true;
    }
    if (cur !== TILE.GRASS) {
      if (!silent) toast("Bulldoze first.");
      if (!silent) audio.deny();
      return false;
    }
    const def = BUILD_BY_TILE[tile];
    if (!def || !trySpend(def.cost)) return false;
    state.grid[gy][gx] = tile;
    const ti = gy * state.w + gx;
    if (state.tileGross) {
      state.tileGross[ti] = 0;
      state.tileUpkeep[ti] = 0;
    }
    invalidateMap();
    if (!silent) {
      const n = Date.now();
      if (n - state.lastBuildSound > 95) {
        audio.build();
        state.lastBuildSound = n;
      }
    }
    return true;
  }

  function expandCost() {
    return Math.floor(EXPAND_BASE * Math.pow(1.12, state.expansions));
  }

  function expandMap() {
    const cost = expandCost();
    if (!trySpend(cost)) return;
    state.expansions += 1;
    const ow = state.w;
    const oh = state.h;
    const nw = state.w + EXPAND_BY;
    const nh = state.h + EXPAND_BY;
    const next = [];
    for (let y = 0; y < nh; y++) {
      next[y] = new Uint8Array(nw);
    }
    const ox = Math.floor((nw - ow) / 2);
    const oy = Math.floor((nh - oh) / 2);
    for (let y = 0; y < oh; y++) {
      for (let x = 0; x < ow; x++) {
        next[y + oy][x + ox] = state.grid[y][x];
      }
    }
    state.entrance.x += ox;
    state.entrance.y += oy;
    state.w = nw;
    state.h = nh;
    state.grid = next;
    const ng = nw * nh;
    const nextGross = new Float64Array(ng);
    const nextUpkeep = new Float64Array(ng);
    if (state.tileGross && state.tileGross.length === ow * oh) {
      for (let y = 0; y < oh; y++) {
        for (let x = 0; x < ow; x++) {
          const oi = y * ow + x;
          const ni = (y + oy) * nw + (x + ox);
          nextGross[ni] = state.tileGross[oi];
          nextUpkeep[ni] = state.tileUpkeep[oi];
        }
      }
    }
    state.tileGross = nextGross;
    state.tileUpkeep = nextUpkeep;
    for (const a of state.agents) {
      a.x += ox;
      a.y += oy;
      if (a.goalGx >= 0) {
        a.goalGx += ox;
        a.goalGy += oy;
      }
      if (a.waypoints && a.waypoints.length) {
        for (let i = 0; i < a.waypoints.length; i++) {
          a.waypoints[i].x += ox;
          a.waypoints[i].y += oy;
        }
      }
    }
    toast(`Expanded to ${nw}×${nh} · next ${formatMoney(expandCost())}`);
    invalidateMap();
    updateMapLabel();
    audio.build();
  }

  function formatMoney(n) {
    return `$${Math.round(n).toLocaleString()}`;
  }

  function updateMapLabel() {
    const el = document.getElementById("tycoon-map-size");
    const ex = document.getElementById("tycoon-btn-expand");
    if (el) el.textContent = `${state.w} × ${state.h} tiles`;
    if (ex) ex.textContent = `Expand land (${formatMoney(expandCost())})`;
  }

  function computeEconomyWeights() {
    let sumIncome = 0;
    let sumAppeal = 0;
    for (let y = 0; y < state.h; y++) {
      for (let x = 0; x < state.w; x++) {
        const t = state.grid[y][x];
        if (t === TILE.GRASS || t === TILE.ENTRANCE || t === TILE.PATH) continue;
        const b = BUILD_BY_TILE[t];
        if (!b) continue;
        if (b.income) sumIncome += b.income;
        if (b.appeal) sumAppeal += b.appeal;
      }
    }
    return { sumIncome, sumAppeal };
  }

  function totalUpkeepWeight() {
    let w = countTiles((t) => t === TILE.PATH) * 0.45;
    for (let y = 0; y < state.h; y++) {
      for (let x = 0; x < state.w; x++) {
        const t = state.grid[y][x];
        if (t === TILE.GRASS || t === TILE.ENTRANCE || t === TILE.PATH) continue;
        const b = BUILD_BY_TILE[t];
        if (b) w += b.upkeep;
      }
    }
    return w;
  }

  function estimatedTileGrossPerMin(gx, gy, econ) {
    const t = state.grid[gy][gx];
    const b = BUILD_BY_TILE[t];
    if (!b || t === TILE.PATH) return 0;
    const { sumIncome, sumAppeal } = computeEconomyWeights();
    if (sumIncome > 0 && b.income) return econ.grossPerMin * (b.income / sumIncome);
    if (sumIncome === 0 && sumAppeal > 0 && b.appeal) return econ.grossPerMin * (b.appeal / sumAppeal);
    return 0;
  }

  function estimatedTileUpkeepPerMin(gx, gy, econ) {
    const uw = totalUpkeepWeight();
    if (uw <= 0) return 0;
    const t = state.grid[gy][gx];
    if (t === TILE.PATH) return econ.upkeepPerMin * (0.45 / uw);
    const b = BUILD_BY_TILE[t];
    if (!b || t === TILE.GRASS || t === TILE.ENTRANCE) return 0;
    return econ.upkeepPerMin * (b.upkeep / uw);
  }

  function accumulateTileStats(econ, dtSec) {
    if (!state.tileGross || state.tileGross.length !== state.w * state.h) return;
    const gross = (econ.grossPerMin / 60) * dtSec;
    const upkeepTotal = (econ.upkeepPerMin / 60) * dtSec;
    const { sumIncome, sumAppeal } = computeEconomyWeights();
    const upkeepW = totalUpkeepWeight();
    const uw = upkeepW > 0 ? upkeepW : 1;

    for (let y = 0; y < state.h; y++) {
      for (let x = 0; x < state.w; x++) {
        const i = y * state.w + x;
        const t = state.grid[y][x];
        if (t === TILE.GRASS || t === TILE.ENTRANCE) continue;
        if (t === TILE.PATH) {
          state.tileUpkeep[i] += upkeepTotal * (0.45 / uw);
          continue;
        }
        const b = BUILD_BY_TILE[t];
        if (!b) continue;
        if (sumIncome > 0 && b.income) {
          state.tileGross[i] += gross * (b.income / sumIncome);
        } else if (sumIncome === 0 && sumAppeal > 0 && b.appeal) {
          state.tileGross[i] += gross * (b.appeal / sumAppeal);
        }
        state.tileUpkeep[i] += upkeepTotal * (b.upkeep / uw);
      }
    }
  }

  function syncGuests(dt) {
    const e = computeEconomy();
    state.guestTarget = e.cap;
    const t = 1 - Math.exp(-dt * 0.0011);
    state.guests += (state.guestTarget - state.guests) * t;
  }

  function syncAgents() {
    const target = Math.min(MAX_AGENTS, Math.floor(state.guests));
    const ex = state.entrance.x;
    const ey = state.entrance.y;
    while (state.agents.length < target) {
      state.agents.push({
        x: ex + 0.5,
        y: ey + 0.5,
        waypoints: [],
        goalGx: -1,
        goalGy: -1,
        dwell: 0,
        hue: 185 + Math.random() * 75,
        pathRevision: -1,
      });
    }
    while (state.agents.length > target) state.agents.pop();
  }

  function tickAgents(dt) {
    const dtClamped = Math.min(dt, 80);
    const movePerSec = 2.45;
    const step = movePerSec * (dtClamped / 1000);

    for (const a of state.agents) {
      if (a.pathRevision !== state.mapRevision) {
        a.waypoints = [];
        a.pathRevision = state.mapRevision;
        pickNewGoalForAgent(a);
      }

      if (a.dwell > 0) {
        a.dwell -= dtClamped;
        continue;
      }

      let tx = Math.floor(a.x);
      let ty = Math.floor(a.y);
      if (!inBounds(tx, ty)) {
        a.x = state.entrance.x + 0.5;
        a.y = state.entrance.y + 0.5;
        pickNewGoalForAgent(a);
        continue;
      }

      let here = state.grid[ty][tx];
      if (here === TILE.GRASS) {
        a.x = state.entrance.x + 0.5;
        a.y = state.entrance.y + 0.5;
        tx = state.entrance.x;
        ty = state.entrance.y;
        here = state.grid[ty][tx];
        pickNewGoalForAgent(a);
      }

      if (a.goalGx < 0) pickNewGoalForAgent(a);

      if (!a.waypoints.length) {
        if (tx === a.goalGx && ty === a.goalGy) {
          if (ATTRACTION_TILES.has(here)) {
            a.dwell = 1600 + Math.random() * 3200;
          }
          pickNewGoalForAgent(a);
          continue;
        }
        const path = bfsPath(tx, ty, a.goalGx, a.goalGy);
        if (!path) {
          pickNewGoalForAgent(a);
          continue;
        }
        a.waypoints = path;
      }

      const wp = a.waypoints[0];
      const tcx = wp.x + 0.5;
      const tcy = wp.y + 0.5;
      const dx = tcx - a.x;
      const dy = tcy - a.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 0.085) {
        a.x = tcx;
        a.y = tcy;
        a.waypoints.shift();
        const landed = state.grid[wp.y][wp.x];
        if (ATTRACTION_TILES.has(landed) && a.waypoints.length === 0) {
          a.dwell = 1800 + Math.random() * 3000;
          pickNewGoalForAgent(a);
        }
        continue;
      }
      const travel = Math.min(dist, step);
      a.x += (dx / dist) * travel;
      a.y += (dy / dist) * travel;
    }
  }

  function simStep(realMs) {
    if (state.paused) return;
    const gameMs = realMs * state.speed;
    state.timeSec += gameMs * 0.001;
    state.accSim += gameMs;
    const econ = computeEconomy();
    const tickMs = 1000;
    while (state.accSim >= tickMs) {
      state.accSim -= tickMs;
      state.money += econ.netPerMin / 60;
      accumulateTileStats(econ, tickMs / 1000);
    }
    syncGuests(gameMs);
    syncAgents();
    tickAgents(realMs * state.speed);
  }

  function grassShade(x, y) {
    const g = 26 + ((x * 17 + y * 11) % 24);
    return `rgb(20, ${56 + g}, 44)`;
  }

  function drawTileTo(c, x, y, t) {
    const px = x * TILE_PX;
    const py = y * TILE_PX;
    const pad = 1;
    const s = TILE_PX - pad * 2;
    const cx = px + TILE_PX / 2;
    const cy = py + TILE_PX / 2;

    if (t === TILE.GRASS) {
      c.fillStyle = grassShade(x, y);
      c.fillRect(px + pad, py + pad, s, s);
      c.fillStyle = "rgba(40, 120, 70, 0.12)";
      c.fillRect(px + pad + ((x * y) % 5), py + pad + ((x + y) % 7), 3, 3);
      return;
    }

    if (t === TILE.PATH) {
      c.fillStyle = "#4a3f35";
      c.fillRect(px + pad, py + pad, s, s);
      c.strokeStyle = "#6e5f4e";
      c.lineWidth = 1;
      c.strokeRect(px + pad + 0.5, py + pad + 0.5, s - 1, s - 1);
      c.fillStyle = "#85735f";
      c.fillRect(px + pad + 5, py + pad + 5, s - 10, s - 10);
      c.fillStyle = "rgba(0,0,0,0.12)";
      c.fillRect(px + pad + 6, py + pad + s - 8, s - 12, 3);
      return;
    }

    if (t === TILE.ENTRANCE) {
      const grd = c.createLinearGradient(px, py, px + TILE_PX, py + TILE_PX);
      grd.addColorStop(0, "#1e3a5c");
      grd.addColorStop(1, "#0f2744");
      c.fillStyle = grd;
      c.fillRect(px + pad, py + pad, s, s);
      c.strokeStyle = "#5ad0ff";
      c.lineWidth = 2;
      c.strokeRect(px + pad + 1.5, py + pad + 1.5, s - 3, s - 3);
      c.fillStyle = "#d4f0ff";
      c.font = `600 ${Math.floor(s * 0.34)}px Segoe UI, sans-serif`;
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText("IN", cx, cy - 3);
      c.font = `400 ${Math.floor(s * 0.22)}px Segoe UI, sans-serif`;
      c.fillStyle = "rgba(180, 220, 255, 0.85)";
      c.fillText("GATE", cx, cy + 8);
      return;
    }

    c.fillStyle = "#1c252d";
    c.fillRect(px + pad, py + pad, s, s);

    if (t === TILE.FERRIS) {
      c.strokeStyle = "#7a8a9a";
      c.lineWidth = 2;
      c.beginPath();
      c.arc(cx, cy - 1, s * 0.28, 0, Math.PI * 2);
      c.stroke();
      c.strokeStyle = "#aabbcc";
      c.lineWidth = 1.2;
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2;
        c.beginPath();
        c.moveTo(cx, cy - 1);
        c.lineTo(cx + Math.cos(ang) * s * 0.28, cy - 1 + Math.sin(ang) * s * 0.28);
        c.stroke();
      }
      c.fillStyle = "#3ddc97";
      c.beginPath();
      c.arc(cx, cy - 1, 3, 0, Math.PI * 2);
      c.fill();
      return;
    }

    if (t === TILE.COASTER) {
      c.strokeStyle = "#e8a045";
      c.lineWidth = 3;
      c.lineCap = "round";
      c.beginPath();
      c.moveTo(px + pad + 4, py + s - 6);
      c.bezierCurveTo(px + s * 0.3, py + pad + 6, px + s * 0.75, py + pad + 4, px + s - 4, py + s * 0.55);
      c.stroke();
      c.strokeStyle = "#5a6570";
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(px + pad + 6, py + s - 4);
      c.lineTo(px + s - 6, py + pad + 8);
      c.stroke();
      c.fillStyle = "#ff6b6b";
      c.beginPath();
      c.arc(px + s * 0.55, py + s * 0.42, 3.5, 0, Math.PI * 2);
      c.fill();
      return;
    }

    if (t === TILE.CAROUSEL) {
      c.fillStyle = "#2a3540";
      c.beginPath();
      c.arc(cx, cy + 2, s * 0.32, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = "#c9a227";
      c.lineWidth = 2;
      c.stroke();
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2;
        c.fillStyle = i % 2 ? "#d4a84b" : "#8b5a6b";
        c.fillRect(
          cx + Math.cos(ang) * s * 0.15 - 2,
          cy + Math.sin(ang) * s * 0.15 - 2,
          5,
          5
        );
      }
      c.fillStyle = "#eee";
      c.beginPath();
      c.arc(cx, cy + 2, 4, 0, Math.PI * 2);
      c.fill();
      return;
    }

    if (t === TILE.FOOD || t === TILE.GIFT) {
      c.fillStyle = t === TILE.FOOD ? "#8b4513" : "#6b4c7a";
      c.fillRect(px + pad + 4, py + pad + 8, s - 8, s - 14);
      c.fillStyle = "#d4c4a8";
      c.fillRect(px + pad + 3, py + pad + 5, s - 6, 6);
      c.fillStyle = "rgba(255,255,255,0.15)";
      c.fillRect(px + pad + 6, py + pad + 10, s - 12, 4);
      c.fillStyle = "#fff";
      c.font = `${Math.floor(s * 0.22)}px sans-serif`;
      c.textAlign = "center";
      c.fillText(t === TILE.FOOD ? "FOOD" : "SHOP", cx, cy + 4);
      return;
    }

    if (t === TILE.BATHROOM) {
      c.fillStyle = "#3a4a58";
      c.fillRect(px + pad + 5, py + pad + 4, s - 10, s - 8);
      c.fillStyle = "#8ecae6";
      c.fillRect(px + pad + 8, py + pad + 7, s - 16, s - 16);
      c.fillStyle = "#bcd";
      c.font = `${Math.floor(s * 0.36)}px sans-serif`;
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText("WC", cx, cy + 1);
      return;
    }

    if (t === TILE.FOUNTAIN) {
      c.fillStyle = "#2a3844";
      c.beginPath();
      c.ellipse(cx, cy + 4, s * 0.35, s * 0.12, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "rgba(100, 180, 255, 0.5)";
      c.beginPath();
      c.arc(cx, cy - 2, 5.5, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "rgba(180, 220, 255, 0.4)";
      c.beginPath();
      c.arc(cx, cy - 6, 3.2, 0, Math.PI * 2);
      c.fill();
      return;
    }

    if (t === TILE.TREE) {
      c.fillStyle = "#3d2914";
      c.fillRect(cx - 2, cy + 4, 4, s * 0.35);
      c.fillStyle = "#1e6b45";
      c.beginPath();
      c.arc(cx, cy - 2, s * 0.28, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#2a8f5c";
      c.beginPath();
      c.arc(cx - 3, cy - 4, s * 0.16, 0, Math.PI * 2);
      c.fill();
      return;
    }

    if (t === TILE.BENCH) {
      c.fillStyle = "#5c4033";
      c.fillRect(px + pad + 3, cy - 2, s - 6, 5);
      c.fillStyle = "#3d2a22";
      c.fillRect(px + pad + 4, cy + 3, 3, 8);
      c.fillRect(px + s - pad - 7, cy + 3, 3, 8);
      return;
    }

    if (t === TILE.LAMP) {
      c.fillStyle = "#4a4a4a";
      c.fillRect(cx - 1, cy - 4, 2, s * 0.45);
      c.fillStyle = "#ffe9a8";
      c.beginPath();
      c.arc(cx, cy - 8, 5, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "rgba(255, 230, 160, 0.25)";
      c.beginPath();
      c.arc(cx, cy - 8, 10, 0, Math.PI * 2);
      c.fill();
      return;
    }

    if (t === TILE.HAUNTED) {
      c.fillStyle = "#1a1528";
      c.fillRect(px + pad + 2, py + pad + 4, s - 4, s - 6);
      c.fillStyle = "#3d2f55";
      c.fillRect(px + pad + 4, py + pad + 6, s - 8, s - 14);
      for (let i = 0; i < 3; i++) {
        c.fillStyle = "#ffd54a";
        c.fillRect(px + pad + 6 + i * 6, py + pad + 10, 4, 5);
      }
      c.fillStyle = "#8b7355";
      c.fillRect(px + pad + 3, py + s - 4, s - 6, 4);
      return;
    }

    if (t === TILE.BUMPERS) {
      c.fillStyle = "#4a4a52";
      c.fillRect(px + pad + 2, py + pad + 8, s - 4, s - 12);
      c.strokeStyle = "#6a6a78";
      c.lineWidth = 1.5;
      c.strokeRect(px + pad + 4, py + pad + 10, s - 8, s - 16);
      const cols = ["#e63946", "#457b9d", "#f4a261", "#2a9d8f"];
      for (let i = 0; i < 4; i++) {
        c.fillStyle = cols[i];
        c.beginPath();
        c.arc(px + pad + 8 + (i % 2) * 8, py + pad + 14 + (i > 1 ? 6 : 0), 3.2, 0, Math.PI * 2);
        c.fill();
      }
      return;
    }

    if (t === TILE.FLUME) {
      c.fillStyle = "#3d5a80";
      c.beginPath();
      c.moveTo(px + pad + 3, py + s - 6);
      c.bezierCurveTo(px + s * 0.35, py + pad + 8, px + s * 0.72, py + pad + 6, px + s - 4, py + s * 0.55);
      c.lineTo(px + s - 4, py + s * 0.55 + 4);
      c.bezierCurveTo(px + s * 0.72, py + pad + 10, px + s * 0.35, py + s - 4, px + pad + 3, py + s - 2);
      c.closePath();
      c.fill();
      c.fillStyle = "#8b5a3c";
      c.fillRect(px + pad + s * 0.42, py + s * 0.48, 6, 5);
      c.fillStyle = "rgba(180, 220, 255, 0.4)";
      c.beginPath();
      c.arc(px + s * 0.35, py + s * 0.55, 4, 0, Math.PI * 2);
      c.fill();
      return;
    }

    if (t === TILE.PIZZA) {
      c.fillStyle = "#c41e3a";
      c.fillRect(px + pad + 2, py + pad + 6, s - 4, 8);
      c.fillStyle = "#f5f0e6";
      c.fillRect(px + pad + 1, py + pad + 4, s - 2, 5);
      c.fillStyle = "#3d2914";
      c.fillRect(px + pad + 3, py + pad + 16, s - 6, s - 20);
      c.fillStyle = "#fff";
      c.font = `${Math.floor(s * 0.2)}px sans-serif`;
      c.textAlign = "center";
      c.fillText("PIZZA", cx, cy + 8);
      return;
    }

    if (t === TILE.ICECREAM) {
      c.fillStyle = "#8b6914";
      c.fillRect(cx - 2, py + pad + 16, 4, 10);
      c.fillStyle = "#f4e4c1";
      c.beginPath();
      c.arc(cx, py + pad + 13, 6, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#ffb7c5";
      c.beginPath();
      c.arc(cx, py + pad + 10, 5, 0, Math.PI * 2);
      c.fill();
      return;
    }

    if (t === TILE.ATM) {
      c.fillStyle = "#2d3e50";
      c.fillRect(px + pad + 5, py + pad + 3, s - 10, s - 6);
      c.fillStyle = "#3ddc97";
      c.fillRect(px + pad + 8, py + pad + 7, s - 16, 3);
      c.fillStyle = "#ecf0f1";
      c.font = `600 ${Math.floor(s * 0.34)}px sans-serif`;
      c.textAlign = "center";
      c.fillText("ATM", cx, cy + 2);
      return;
    }

    if (t === TILE.FIRSTAID) {
      c.fillStyle = "#ffffff";
      c.fillRect(px + pad + 3, py + pad + 4, s - 6, s - 8);
      c.fillStyle = "#e63946";
      c.fillRect(cx - 2, py + pad + 14, 4, 8);
      c.fillRect(px + pad + 10, cy - 2, 8, 4);
      c.fillStyle = "#333";
      c.font = `${Math.floor(s * 0.22)}px sans-serif`;
      c.textAlign = "center";
      c.fillText("AID", cx, cy + 8);
      return;
    }

    if (t === TILE.STATUE) {
      c.fillStyle = "#6b6b6b";
      c.fillRect(px + pad + 5, py + s - pad - 8, s - 10, 8);
      c.fillStyle = "#c9a227";
      c.beginPath();
      c.moveTo(cx, py + pad + 4);
      c.lineTo(px + s - pad - 6, py + s - pad - 10);
      c.lineTo(px + pad + 6, py + s - pad - 10);
      c.closePath();
      c.fill();
      c.fillStyle = "#8b7355";
      c.fillRect(cx - 2, py + pad + 14, 4, 8);
      return;
    }

    if (t === TILE.HEDGE) {
      c.fillStyle = "#1e3d2f";
      c.fillRect(px + pad, py + s - pad - 5, s - pad * 2, 5);
      c.fillStyle = "#2d5a3d";
      for (let i = 0; i < 5; i++) {
        c.fillRect(px + pad + 2 + i * 5, py + pad + 6 + (i % 2) * 2, 4, s - 14);
      }
      return;
    }

    if (t === TILE.STAGE) {
      c.fillStyle = "#5c4033";
      c.fillRect(px + pad + 2, py + s - pad - 6, s - 4, 6);
      c.fillStyle = "#8b2942";
      c.fillRect(px + pad + 1, py + pad + 4, s - 2, 8);
      c.fillStyle = "#f4e4c1";
      c.fillRect(px + pad + 4, py + pad + 8, s - 8, s - 18);
      c.fillStyle = "#333";
      c.font = `${Math.floor(s * 0.36)}px sans-serif`;
      c.textAlign = "center";
      c.fillText("♪", cx, cy - 1);
      return;
    }

    const b = BUILD_BY_TILE[t];
    c.fillStyle = "#dce6ef";
    c.font = `${Math.floor(s * 0.4)}px sans-serif`;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(b ? b.icon : "?", cx, cy);
  }

  function rebuildStatic() {
    if (!state.staticCanvas) {
      state.staticCanvas = document.createElement("canvas");
      state.staticCtx = state.staticCanvas.getContext("2d");
    }
    const w = state.w * TILE_PX;
    const h = state.h * TILE_PX;
    state.staticCanvas.width = w;
    state.staticCanvas.height = h;
    const c = state.staticCtx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    for (let y = 0; y < state.h; y++) {
      for (let x = 0; x < state.w; x++) {
        drawTileTo(c, x, y, state.grid[y][x]);
      }
    }
    state.staticDirty = false;
  }

  function drawDayNightOverlay(rw, rh) {
    const t = (Math.sin(state.timeSec * 0.012) + 1) * 0.5;
    const night = 0.22 + t * 0.18;
    ctx.fillStyle = `rgba(8, 14, 32, ${night})`;
    ctx.fillRect(0, 0, rw, rh);
    if (!REDUCED_MOTION && night > 0.28) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
      const seed = state.w * 17 + state.h;
      for (let i = 0; i < 28; i++) {
        const sx = ((seed + i * 97) % 1000) / 1000;
        const sy = ((seed + i * 53) % 1000) / 1000;
        ctx.fillRect(rw * sx, rh * sy, 1.2, 1.2);
      }
    }
  }

  function drawHoverGhost() {
    if (!state.hover || !state.tool || state.tool === "bulldoze") return;
    const build = BUILD.find((b) => b.id === state.tool);
    if (!build) return;
    const gx = state.hover.x;
    const gy = state.hover.y;
    if (!inBounds(gx, gy)) return;
    const px = gx * TILE_PX;
    const py = gy * TILE_PX;
    const cur = state.grid[gy][gx];
    const ok = cur === TILE.GRASS && build.tile !== TILE.GRASS;
    ctx.save();
    ctx.translate(state.cam.x, state.cam.y);
    ctx.scale(state.cam.scale, state.cam.scale);
    ctx.globalAlpha = 0.45;
    drawTileTo(ctx, gx, gy, build.tile);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = ok ? "rgba(61, 220, 151, 0.95)" : "rgba(255, 100, 100, 0.9)";
    ctx.lineWidth = 2 / state.cam.scale;
    ctx.strokeRect(px + 1, py + 1, TILE_PX - 2, TILE_PX - 2);
    ctx.restore();
  }

  function render() {
    const wrap = canvas.parentElement;
    const rw = wrap.clientWidth;
    const rh = wrap.clientHeight;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#070a0e";
    ctx.fillRect(0, 0, rw, rh);
    ctx.restore();

    if (state.staticDirty) rebuildStatic();

    ctx.save();
    ctx.translate(state.cam.x, state.cam.y);
    ctx.scale(state.cam.scale, state.cam.scale);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(state.staticCanvas, 0, 0);

    if (!REDUCED_MOTION) {
      ctx.strokeStyle = "rgba(120, 200, 255, 0.35)";
      ctx.lineWidth = 1;
      for (let y = 0; y < state.h; y++) {
        for (let x = 0; x < state.w; x++) {
          if (state.grid[y][x] !== TILE.FOUNTAIN) continue;
          const cx = x * TILE_PX + TILE_PX / 2;
          const cy = y * TILE_PX + TILE_PX / 2;
          const rr = 5 + Math.sin(state.timeSec * 2.4 + x * 0.6 + y * 0.4) * 1.8;
          ctx.beginPath();
          ctx.arc(cx, cy - 2, rr, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }

    const pulse = 0.5 + 0.5 * Math.sin(state.timeSec * 2.2);
    for (let y = 0; y < state.h; y++) {
      for (let x = 0; x < state.w; x++) {
        const t = state.grid[y][x];
        const b = BUILD_BY_TILE[t];
        if (b && (b.income || 0) > 0) {
          const px = x * TILE_PX;
          const py = y * TILE_PX;
          ctx.fillStyle = `rgba(61, 220, 151, ${0.06 + pulse * 0.06})`;
          ctx.fillRect(px, py, TILE_PX, TILE_PX);
        }
      }
    }

    for (const a of state.agents) {
      const gx = a.x * TILE_PX;
      const gy = a.y * TILE_PX;
      const ax = gx + TILE_PX / 2;
      const ay = gy + TILE_PX / 2;
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath();
      ctx.ellipse(ax + 1, ay + 5, 3.8, 1.6, 0, 0, Math.PI * 2);
      ctx.fill();
      const hue = a.hue != null ? a.hue : 200;
      const sat = a.dwell > 0 ? 72 : 85;
      ctx.fillStyle = `hsl(${hue}, ${sat}%, 78%)`;
      ctx.beginPath();
      ctx.arc(ax, ay, 3.35, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    ctx.save();
    drawDayNightOverlay(rw, rh);
    ctx.restore();

    drawHoverGhost();

    drawMinimap();
  }

  const MINI_COL = {
    grass: "#15251c",
    path: "#5c4d3f",
    entrance: "#2a5580",
    build: "#3d8f65",
    ride: "#e8a045",
    stall: "#9b6bd4",
    service: "#4a8fb8",
  };

  function minimapColor(t) {
    if (t === TILE.GRASS) return MINI_COL.grass;
    if (t === TILE.PATH) return MINI_COL.path;
    if (t === TILE.ENTRANCE) return MINI_COL.entrance;
    const b = BUILD_BY_TILE[t];
    if (!b) return MINI_COL.build;
    if (b.kind === "ride") return MINI_COL.ride;
    if (b.kind === "stall") return MINI_COL.stall;
    if (b.kind === "service") return MINI_COL.service;
    return MINI_COL.build;
  }

  function drawMinimap() {
    const mw = minimap.width;
    const mh = minimap.height;
    const scale = Math.min(mw / state.w, mh / state.h);
    const gw = state.w * scale;
    const gh = state.h * scale;
    const ox = (mw - gw) / 2;
    const oy = (mh - gh) / 2;

    mctx.fillStyle = "#0a0e14";
    mctx.fillRect(0, 0, mw, mh);

    for (let y = 0; y < state.h; y++) {
      for (let x = 0; x < state.w; x++) {
        mctx.fillStyle = minimapColor(state.grid[y][x]);
        mctx.fillRect(ox + x * scale, oy + y * scale, Math.ceil(scale), Math.ceil(scale));
      }
    }

    const wrap = canvas.parentElement;
    const rw = wrap.clientWidth;
    const rh = wrap.clientHeight;
    const mapPxW = state.w * TILE_PX * state.cam.scale;
    const mapPxH = state.h * TILE_PX * state.cam.scale;
    const vx = (-state.cam.x / state.cam.scale / (state.w * TILE_PX)) * gw + ox;
    const vy = (-state.cam.y / state.cam.scale / (state.h * TILE_PX)) * gh + oy;
    const vw = (rw / mapPxW) * gw;
    const vh = (rh / mapPxH) * gh;

    mctx.strokeStyle = "rgba(90, 200, 255, 0.85)";
    mctx.lineWidth = 1;
    mctx.strokeRect(vx, vy, vw, vh);
  }

  function updateHud() {
    const econ = computeEconomy();
    document.getElementById("tycoon-money").textContent = formatMoney(state.money);
    document.getElementById("tycoon-guests").textContent = `${Math.round(state.guests)} / ${econ.cap}`;
    const satEl = document.getElementById("tycoon-satisfaction");
    const sat = Math.round(econ.satisfaction);
    satEl.textContent = `${sat}%`;
    satEl.className = `stat-value mono ${
      sat >= 70 ? "positive" : sat >= 45 ? "" : "negative"
    }`;

    const inc = document.getElementById("tycoon-income");
    const npm = econ.netPerMin;
    const sign = npm >= 0 ? "+" : "";
    inc.textContent = `${sign}${formatMoney(npm)}`;
    inc.className = `stat-value mono ${npm >= 0 ? "positive" : "negative"}`;

    document.getElementById("tycoon-m-appeal").textContent = Math.round(econ.appealSum);
    document.getElementById("tycoon-m-connected").textContent = Math.round(econ.connectedAppeal);
    document.getElementById("tycoon-m-gross").textContent = formatMoney(econ.grossPerMin);
    document.getElementById("tycoon-m-upkeep").textContent = formatMoney(econ.upkeepPerMin);
  }

  function selectTool(id) {
    state.tool = id;
    const root = document.getElementById("tycoon-tools");
    root.querySelectorAll(".tool").forEach((b) => {
      b.classList.toggle("selected", b.dataset.tool === id);
    });
    audio.click();
  }

  function fillDialogStats(dl, tool) {
    dl.innerHTML = "";
    const add = (term, def) => {
      const dt = document.createElement("dt");
      dt.textContent = term;
      const dd = document.createElement("dd");
      dd.textContent = def;
      dl.appendChild(dt);
      dl.appendChild(dd);
    };
    add("Build cost", formatMoney(tool.cost));
    if (tool.upkeep) add("Upkeep", `${formatMoney(tool.upkeep)}/min`);
    else add("Upkeep", "—");
    if (tool.income) add("Base income", `${formatMoney(tool.income)}/min`);
    else add("Base income", "—");
    if (tool.appeal || tool.appeal === 0) add("Appeal", String(tool.appeal));
    if (tool.comfort) add("Comfort", `+${tool.comfort}`);
  }

  function openStructureInfo(toolOrId) {
    const dlg = document.getElementById("tycoon-structure-dialog");
    const titleEl = document.getElementById("tycoon-structure-dialog-title");
    const kindEl = document.getElementById("tycoon-structure-dialog-kind");
    const statsEl = document.getElementById("tycoon-structure-dialog-stats");
    const blurbEl = document.getElementById("tycoon-structure-dialog-blurb");

    if (toolOrId === "bulldoze") {
      titleEl.textContent = BULLDOZE_INFO.name;
      kindEl.textContent = BULLDOZE_INFO.kindLabel;
      statsEl.innerHTML = "";
      const add = (term, def) => {
        const dt = document.createElement("dt");
        dt.textContent = term;
        const dd = document.createElement("dd");
        dd.textContent = def;
        statsEl.appendChild(dt);
        statsEl.appendChild(dd);
      };
      add("Refund rate", `${Math.round(REFUND_RATE * 100)}% of build cost`);
      add("Removes", "Any tile except the entrance");
      blurbEl.textContent = BULLDOZE_INFO.blurb;
    } else {
      const tool = typeof toolOrId === "string" ? BUILD.find((b) => b.id === toolOrId) : toolOrId;
      if (!tool) return;
      titleEl.textContent = tool.name;
      kindEl.textContent = KIND_LABEL[tool.kind] || tool.kind;
      fillDialogStats(statsEl, tool);
      blurbEl.textContent = tool.blurb || "";
    }

    if (typeof dlg.showModal === "function") {
      dlg.showModal();
    } else {
      dlg.setAttribute("open", "");
    }
    audio.click();
  }

  function initStructureDialog() {
    const dlg = document.getElementById("tycoon-structure-dialog");
    const closeBtn = document.getElementById("tycoon-structure-dialog-close");
    const close = () => {
      if (typeof dlg.close === "function") dlg.close();
      else dlg.removeAttribute("open");
    };
    closeBtn.addEventListener("click", close);
    dlg.addEventListener("click", (e) => {
      if (e.target === dlg) close();
    });
  }

  function openTileInspect(gx, gy) {
    const econ = computeEconomy();
    const t = state.grid[gy][gx];
    const dlg = document.getElementById("tycoon-tile-inspect-dialog");
    const titleEl = document.getElementById("tycoon-tile-inspect-title");
    const subEl = document.getElementById("tycoon-tile-inspect-sub");
    const statsEl = document.getElementById("tycoon-tile-inspect-stats");
    const noteEl = document.getElementById("tycoon-tile-inspect-note");
    if (!dlg || !titleEl || !statsEl || !noteEl) return;

    const idx = gy * state.w + gx;
    const gross = state.tileGross ? state.tileGross[idx] : 0;
    const upk = state.tileUpkeep ? state.tileUpkeep[idx] : 0;
    const net = gross - upk;

    const add = (term, val) => {
      const dt = document.createElement("dt");
      dt.textContent = term;
      const dd = document.createElement("dd");
      dd.textContent = val;
      statsEl.appendChild(dt);
      statsEl.appendChild(dd);
    };

    statsEl.innerHTML = "";
    subEl.textContent = "";

    if (t === TILE.GRASS) {
      titleEl.textContent = "Empty grass";
      noteEl.textContent = "Choose a build tool on the left, then place on grass.";
      if (typeof dlg.showModal === "function") dlg.showModal();
      else dlg.setAttribute("open", "");
      audio.click();
      return;
    }

    if (t === TILE.ENTRANCE) {
      titleEl.textContent = "Park gate";
      subEl.textContent = "Entrance";
      add("Lifetime revenue", formatMoney(0));
      add("Lifetime upkeep", formatMoney(0));
      noteEl.textContent = "Guests enter here. Track earnings on rides, shops, and paths.";
      if (typeof dlg.showModal === "function") dlg.showModal();
      else dlg.setAttribute("open", "");
      audio.click();
      return;
    }

    if (t === TILE.PATH) {
      titleEl.textContent = "Path";
      subEl.textContent = "Infrastructure";
      add("Lifetime revenue", formatMoney(gross));
      add("Lifetime upkeep (attributed)", formatMoney(upk));
      add("Lifetime net", formatMoney(net));
      add("Est. upkeep / min (now)", formatMoney(estimatedTileUpkeepPerMin(gx, gy, econ)));
      noteEl.textContent =
        "Paths share global upkeep. Revenue stays $0; upkeep is your share of path maintenance.";
      if (typeof dlg.showModal === "function") dlg.showModal();
      else dlg.setAttribute("open", "");
      audio.click();
      return;
    }

    const b = BUILD_BY_TILE[t];
    if (!b) {
      titleEl.textContent = "Tile";
      noteEl.textContent = "";
      if (typeof dlg.showModal === "function") dlg.showModal();
      else dlg.setAttribute("open", "");
      audio.click();
      return;
    }

    titleEl.textContent = b.name;
    subEl.textContent = KIND_LABEL[b.kind] || b.kind;
    const eg = estimatedTileGrossPerMin(gx, gy, econ);
    const eu = estimatedTileUpkeepPerMin(gx, gy, econ);
    add("Lifetime revenue (attributed)", formatMoney(gross));
    add("Lifetime upkeep (attributed)", formatMoney(upk));
    add("Lifetime net", formatMoney(net));
    add("Est. gross / min (now)", formatMoney(eg));
    add("Est. upkeep / min (now)", formatMoney(eu));
    add("Est. net / min (now)", formatMoney(eg - eu));
    noteEl.textContent =
      "Lifetime totals use the same rules as the park: gross is split by income (or appeal if no income); upkeep is split by each tile’s upkeep weight including paths.";

    if (typeof dlg.showModal === "function") dlg.showModal();
    else dlg.setAttribute("open", "");
    audio.click();
  }

  function initTileInspectDialog() {
    const dlg = document.getElementById("tycoon-tile-inspect-dialog");
    const closeBtn = document.getElementById("tycoon-tile-inspect-close");
    const close = () => {
      if (typeof dlg.close === "function") dlg.close();
      else dlg.removeAttribute("open");
    };
    closeBtn?.addEventListener("click", close);
    dlg?.addEventListener("click", (e) => {
      if (e.target === dlg) close();
    });
  }

  function buildToolButtons() {
    const root = document.getElementById("tycoon-tools");
    root.innerHTML = "";

    BUILD.forEach((tool) => {
      const row = document.createElement("div");
      row.className = "tool-row";

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tool";
      btn.dataset.tool = tool.id;
      const upkeepStr = tool.upkeep ? ` · $${tool.upkeep}/m upkeep` : "";
      btn.innerHTML = `
        <span class="tool-icon" aria-hidden="true">${tool.icon}</span>
        <span class="tool-body">
          <div class="tool-name">${tool.name}</div>
          <div class="tool-meta">
            <span class="tool-cost">${formatMoney(tool.cost)}</span>
            ${tool.income ? ` · +${formatMoney(tool.income)}/m` : ""}
            ${tool.appeal ? ` · ${tool.appeal} appeal` : ""}${upkeepStr}
          </div>
        </span>
      `;
      btn.addEventListener("click", () => selectTool(tool.id));

      const info = document.createElement("button");
      info.type = "button";
      info.className = "btn-info";
      info.setAttribute("aria-label", `About ${tool.name}`);
      info.setAttribute("title", "Info");
      info.textContent = "i";
      info.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
        openStructureInfo(tool.id);
      });

      row.appendChild(btn);
      row.appendChild(info);
      root.appendChild(row);
    });

    const row = document.createElement("div");
    row.className = "tool-row";

    const bull = document.createElement("button");
    bull.type = "button";
    bull.className = "tool";
    bull.dataset.tool = "bulldoze";
    bull.innerHTML = `
      <span class="tool-icon" aria-hidden="true">✕</span>
      <span class="tool-body">
        <div class="tool-name">Bulldoze</div>
        <div class="tool-meta">Clears a tile · refunds ${Math.round(REFUND_RATE * 100)}%</div>
      </span>
    `;
    bull.addEventListener("click", () => selectTool("bulldoze"));

    const info = document.createElement("button");
    info.type = "button";
    info.className = "btn-info";
    info.setAttribute("aria-label", "About bulldoze");
    info.setAttribute("title", "Info");
    info.textContent = "i";
    info.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      openStructureInfo("bulldoze");
    });

    row.appendChild(bull);
    row.appendChild(info);
    root.appendChild(row);
  }

  function applyAtGrid(gx, gy, allowRepeat) {
    if (!state.tool) return;
    const key = `${gx},${gy}`;
    if (!allowRepeat && state.lastPaintCell === key) return;
    state.lastPaintCell = key;

    if (state.tool === "bulldoze") {
      placeTile(gx, gy, TILE.GRASS);
      return;
    }
    const build = BUILD.find((b) => b.id === state.tool);
    if (build) placeTile(gx, gy, build.tile);
  }

  function pointerGrid(e) {
    const sw = screenToWorld(e.clientX, e.clientY);
    return worldToGrid(sw.x, sw.y);
  }

  function handlePointerDown(e) {
    if (e.button === 1 || e.button === 2 || e.shiftKey || e.altKey) {
      state.dragging = true;
      state.dragStart = { x: e.clientX, y: e.clientY };
      state.camStart = { ...state.cam };
      state.painting = false;
      e.preventDefault();
      return;
    }
    if (e.button !== 0) return;
    const g = pointerGrid(e);
    state.hover = inBounds(g.x, g.y) ? g : null;
    if (!inBounds(g.x, g.y)) return;

    if (!state.tool) {
      openTileInspect(g.x, g.y);
      return;
    }

    state.painting = true;
    state.paintButton = e.button;
    state.lastPaintCell = null;
    applyAtGrid(g.x, g.y, true);
    canvas.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e) {
    const g = pointerGrid(e);
    state.hover = inBounds(g.x, g.y) ? g : null;

    if (state.dragging && state.dragStart) {
      const dx = e.clientX - state.dragStart.x;
      const dy = e.clientY - state.dragStart.y;
      state.cam.x = state.camStart.x + dx;
      state.cam.y = state.camStart.y + dy;
      return;
    }

    if (state.painting && state.tool) {
      if (inBounds(g.x, g.y)) applyAtGrid(g.x, g.y, false);
    }
  }

  function handlePointerUp(e) {
    if (state.dragging) {
      state.dragging = false;
      state.dragStart = null;
    }
    if (state.painting) {
      state.painting = false;
      state.lastPaintCell = null;
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch (_) {}
    }
  }

  function handleWheel(e) {
    e.preventDefault();
    const before = screenToWorld(e.clientX, e.clientY);
    const delta = e.deltaY > 0 ? -0.09 : 0.09;
    const next = Math.min(2.4, Math.max(0.4, state.cam.scale + delta));
    state.cam.scale = next;
    const after = screenToWorld(e.clientX, e.clientY);
    state.cam.x += (before.x - after.x) * state.cam.scale;
    state.cam.y += (before.y - after.y) * state.cam.scale;
  }

  function centerCamera() {
    const wrap = canvas.parentElement;
    const rw = wrap.clientWidth;
    const rh = wrap.clientHeight;
    const mapW = state.w * TILE_PX * state.cam.scale;
    const mapH = state.h * TILE_PX * state.cam.scale;
    state.cam.x = (rw - mapW) / 2;
    state.cam.y = (rh - mapH) / 2;
  }

  function loop(now) {
    if (!loopOn) return;
    const dt = state.lastFrame ? now - state.lastFrame : 16;
    state.lastFrame = now;
    applyCameraInput(dt);
    simStep(dt);
    render();
    updateHud();
    if (loopOn) requestAnimationFrame(loop);
  }

  function isTypingTarget(el) {
    if (!el) return false;
    const tag = el.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
    return Boolean(el.closest?.("input, textarea, select, [contenteditable='true']"));
  }

  function onKey(e) {
    if (!tycoonShellActive()) return;
    if (isTypingTarget(e.target)) return;
    if (isAnyDialogOpen()) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    if (
      e.code === "ArrowUp" ||
      e.code === "ArrowDown" ||
      e.code === "ArrowLeft" ||
      e.code === "ArrowRight"
    ) {
      e.preventDefault();
    }

    if (e.code === "Space") {
      e.preventDefault();
      document.getElementById("tycoon-btn-pause").click();
    }
    if (e.key === "Escape") {
      state.tool = null;
      document.querySelectorAll("#tycoon-app .tool.selected").forEach((b) => b.classList.remove("selected"));
    }
    if (e.key === "b" || e.key === "B") selectTool("bulldoze");

    if (e.key === "?" || (e.shiftKey && e.key === "/")) {
      e.preventDefault();
      const dlg = document.getElementById("tycoon-tutorial-dialog");
      if (dlg?.showModal) dlg.showModal();
      audio.click();
      return;
    }

    if (e.key === "=" || e.key === "+") {
      e.preventDefault();
      zoomAtScreenCenter(0.1);
      return;
    }
    if (e.key === "-" || e.key === "_") {
      e.preventDefault();
      zoomAtScreenCenter(-0.1);
      return;
    }

    const n = Number(e.key);
    if (n >= 1 && n <= 9) {
      const tools = [...BUILD.map((b) => b.id), "bulldoze"];
      if (tools[n - 1]) selectTool(tools[n - 1]);
    }
  }

  function onKeyDownPan(e) {
    if (!tycoonShellActive()) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const codes = ["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
    if (!codes.includes(e.code)) return;
    if (isAnyDialogOpen()) return;
    if (isTypingTarget(e.target)) return;
    state.keysPan.add(e.code);
    e.preventDefault();
  }

  function onKeyUpPan(e) {
    if (!tycoonShellActive()) return;
    state.keysPan.delete(e.code);
  }

  initGrid();
  buildToolButtons();
  initStructureDialog();
  initTileInspectDialog();
  initTutorial();
  updateMapLabel();

  window.addEventListener("resize", () => {
    if (tycoonShellActive()) resizeCanvas();
  });

  canvas.addEventListener("pointerdown", handlePointerDown);
  canvas.addEventListener("pointermove", handlePointerMove);
  canvas.addEventListener("pointerup", handlePointerUp);
  canvas.addEventListener("pointerleave", () => {
    state.hover = null;
    if (state.painting) {
      state.painting = false;
      state.lastPaintCell = null;
    }
  });

  const canvasWrap = document.getElementById("tycoon-canvas-wrap");
  if (canvasWrap) {
    canvasWrap.addEventListener("pointermove", updateEdgePanFromEvent);
    canvasWrap.addEventListener("pointerleave", () => {
      state.edgePan = { x: 0, y: 0 };
    });
  }

  window.addEventListener("keydown", onKeyDownPan);
  window.addEventListener("keyup", onKeyUpPan);
  window.addEventListener("blur", () => state.keysPan.clear());
  canvas.addEventListener("wheel", handleWheel, { passive: false });
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  window.addEventListener("keydown", onKey, { capture: true });

  document.getElementById("tycoon-btn-pause").addEventListener("click", () => {
    state.paused = !state.paused;
    document.getElementById("tycoon-btn-pause").textContent = state.paused ? "▶" : "⏸";
    document.getElementById("tycoon-btn-pause").title = state.paused ? "Resume (Space)" : "Pause (Space)";
  });

  document.querySelectorAll("#tycoon-app .speed-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.speed = Number(btn.dataset.speed);
      document.querySelectorAll("#tycoon-app .speed-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });

  document.getElementById("tycoon-btn-expand").addEventListener("click", expandMap);
  document.getElementById("tycoon-btn-center").addEventListener("click", () => {
    centerCamera();
    audio.click();
  });

  const ticket = document.getElementById("tycoon-ticket-slider");
  const ticketVal = document.getElementById("tycoon-ticket-value");
  ticket.addEventListener("input", () => {
    const v = Number(ticket.value);
    state.ticketMul = v / 100;
    ticketVal.textContent = `${v}%`;
  });

  window.addEventListener("arcade:play", (e) => {
    const id = e.detail && e.detail.id;
    if (id === "sandbox-tycoon") {
      bootTycoon();
    } else {
      stopTycoonLoop();
    }
  });

  window.addEventListener("arcade:leave", () => {
    stopTycoonLoop();
    state.keysPan.clear();
  });
})();
