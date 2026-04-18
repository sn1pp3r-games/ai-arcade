(() => {
  "use strict";

  const canvas = document.getElementById("game-jump");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const overlay = document.getElementById("jump-overlay");
  const overlayTitle = document.getElementById("jump-overlay-title");
  const overlayMsg = document.getElementById("jump-overlay-msg");
  const restartBtn = document.getElementById("jump-restart-btn");
  const loadingEl = document.getElementById("jump-loading");
  const loadingCancelBtn = document.getElementById("jump-loading-cancel-btn");
  const levelHudEl = document.getElementById("jump-level-hud");
  const communityHudEl = document.getElementById("jump-community-hud");
  const uiRoot = document.getElementById("jump-ui");
  const mainMenu = document.getElementById("jump-main-menu");
  const modeMenu = document.getElementById("jump-mode-menu");
  const menuPlayBtn = document.getElementById("jump-menu-play-btn");
  const menuCampaignBtn = document.getElementById("jump-menu-campaign-btn");
  const menuRandomBtn = document.getElementById("jump-menu-random-btn");
  const menuBackBtn = document.getElementById("jump-menu-back-btn");
  const menuEditorBtn = document.getElementById("jump-menu-editor-btn");
  const levelEditorEl = document.getElementById("jump-level-editor");
  const editorPaletteEl = document.getElementById("jump-editor-palette");
  const editorToolboxToggleBtn = document.getElementById("jump-editor-toolbox-toggle");
  const editorInfoBtn = document.getElementById("jump-editor-info-btn");
  const editorInfoPanel = document.getElementById("jump-editor-info-panel");
  const editorPlaytestBtn = document.getElementById("jump-editor-playtest-btn");
  const editorDoneBtn = document.getElementById("jump-editor-done-btn");
  const editorExportBtn = document.getElementById("jump-editor-export-btn");
  const editorImportBtn = document.getElementById("jump-editor-import-btn");
  const editorPublishBtn = document.getElementById("jump-editor-publish-btn");
  const editorNewBtn = document.getElementById("jump-editor-new-btn");
  const editorSaveBtn = document.getElementById("jump-editor-save-btn");
  const editorSavedSelect = document.getElementById("jump-editor-saved-select");
  const pauseMenuEl = document.getElementById("jump-pause-menu");
  const pauseContinueBtn = document.getElementById("jump-pause-continue-btn");
  const pauseToMenuBtn = document.getElementById("jump-pause-menu-btn");
  const pauseEditorBtn = document.getElementById("jump-pause-editor-btn");

  function jumpShellActive() {
    const sh = document.getElementById("game-shell-jump");
    return sh && !sh.classList.contains("hidden") && !sh.hasAttribute("hidden");
  }

  let jumpLoopRunning = false;

  const W = canvas.width;
  const H = canvas.height;

  const GRAVITY = 2400;
  /** Unit gravity direction in world space (+y = down). Changed by gravity-switch platforms. */
  let worldGravityX = 0;
  let worldGravityY = 1;

  function resetWorldGravity() {
    worldGravityX = 0;
    worldGravityY = 1;
  }

  function setWorldGravityFromSwitchDir(dir) {
    switch (dir) {
      case "d":
        worldGravityX = 0;
        worldGravityY = 1;
        break;
      case "u":
        worldGravityX = 0;
        worldGravityY = -1;
        break;
      case "l":
        worldGravityX = -1;
        worldGravityY = 0;
        break;
      case "r":
        worldGravityX = 1;
        worldGravityY = 0;
        break;
      default:
        worldGravityX = 0;
        worldGravityY = 1;
    }
  }

  function applyGravSwitchContact() {
    const pb = playerBounds();
    for (let i = 0; i < platforms.length; i++) {
      const plat = platforms[i];
      if (!plat.gravSwitch || !platSolid(plat) || entityHasRot(plat)) continue;
      // `rectsOverlap` is strict; standing on a platform shares an edge (feet on plat.y) with no interior overlap.
      if (!rectsOverlapOrTouch(pb, plat)) continue;
      setWorldGravityFromSwitchDir(plat.gravSwitch.dir || "d");
      return;
    }
  }

  /** Feet / support contact sensor in +gravity direction (same for grounded probe, launchers, ice, lifts). */
  function playerGroundSensorRect() {
    const gx = worldGravityX;
    const gy = worldGravityY;
    const cx = player.x + player.w * 0.5;
    const cy = player.y + player.h * 0.5;
    const ext = Math.abs(gx) > Math.abs(gy) ? player.w * 0.5 : player.h * 0.5;
    const pad = 6;
    const hw = 14;
    const hh = 12;
    return {
      x: cx + gx * (ext + pad) - hw * 0.5,
      y: cy + gy * (ext + pad) - hh * 0.5,
      w: hw,
      h: hh,
    };
  }

  function playerGroundedProbe() {
    const sensor = playerGroundSensorRect();
    for (const plat of platforms) {
      if (!platSolid(plat)) continue;
      if (entityHasRot(plat)) {
        if (aabbOverlapsRotatedEntity(sensor, plat)) return true;
        continue;
      }
      if (rectsOverlap(sensor, plat)) return true;
    }
    for (const w of walls) {
      if (!wallHazardActive(w)) continue;
      if (entityHasRot(w)) {
        if (aabbOverlapsRotatedEntity(sensor, w)) return true;
        continue;
      }
      if (rectsOverlap(sensor, w)) return true;
    }
    return false;
  }
  const MOVE_ACCEL = 3200;
  const AIR_ACCEL = 2200;
  const MAX_RUN = 320;
  /** While > 0, higher horizontal cap and weak ground friction (launcher boost). */
  const LAUNCH_BOOST_MS = 520;
  const LAUNCH_FORWARD_VX = 448;
  const LAUNCH_VX_CAP = 560;
  /** Up-launcher impulse (stronger than normal jump). */
  const LAUNCH_UP_VY = -960;
  /** After up-launcher, gravity is reduced briefly. */
  const LAUNCH_UP_COAST_MS = 440;
  const FRICTION = 3400;
  const AIR_FRICTION = 400;
  /** Low friction when standing on `ice` platforms (slippery). */
  const ICE_FRICTION = 420;
  const ICE_MOVE_ACCEL = 2100;
  const JUMP_V = -880;
  /** Non-lethal overlap zones: reduced accel, run cap, and jump impulse. */
  const DEBUFF_ZONE_MOVE_GROUND_MUL = 0.42;
  const DEBUFF_ZONE_MOVE_AIR_MUL = 0.48;
  const DEBUFF_ZONE_MAX_RUN_MUL = 0.52;
  const DEBUFF_ZONE_JUMP_MUL = 0.62;
  const COYOTE_MS = 100;
  const JUMP_BUFFER_MS = 120;
  const SWITCH_FLIP_SEC = 3;
  /** Max player displacement per axis sub-step (px) — avoids tunneling through thin platforms/walls. */
  const PLAYER_MOVE_SUBSTEP = 8;
  /** Procedural goal is last platform; must sit at this index or higher (50 from start). */
  const MIN_PLATFORMS_BEFORE_GOAL = 50;
  /** Total platforms including start and goal tile. */
  const MAX_PLATFORMS_PER_LEVEL = 100;
  /** Combined cap for walls + wrecking balls + spike strips. */
  const MAX_HAZARDS_PER_LEVEL = 20;
  /** Spike strip width sum on a platform above this fraction of `plat.w` is treated as impossible / invalid. */
  const MAX_SPIKE_COVERAGE_FRACTION = 0.8;

  const keys = new Set();

  /**
   * @type {{
   *   x: number;
   *   y: number;
   *   w: number;
   *   h: number;
   *   switch?: boolean;
   *   yBase?: number;
   *   elev?: { amp: number; omega: number; phase: number };
   *   ice?: boolean;
   *   launcher?: { kind?: 'forward' | 'backward' | 'up'; vx?: number; vy?: number };
   *   gravSwitch?: { dir?: 'd' | 'u' | 'l' | 'r' };
   *   rot?: number;
   * }[]}
   */
  let platforms;
  /** Vertical hazard slabs (solid, hurt on touch) — replace tight climb stacks. */
  let walls = [];
  /**
   * Swinging hazards anchored above a platform (pivot follows moving platforms).
   * @type {{
   *   platIdx: number;
   *   relOffX: number;
   *   relOffY: number;
   *   ropeLen: number;
   *   swingRad: number;
   *   omega: number;
   *   phase: number;
   *   r: number;
   * }[]}
   */
  let wreckingBalls = [];
  /**
   * Hazard strips on platform tops (platIdx + relX/w/h); follow moving platforms.
   * @type {{ platIdx: number; relX: number; w: number; h: number }[]}
   */
  let spikes = [];
  /** Axis-aligned zones: slow movement and weaken jump while overlapping (no damage). */
  let debuffZones = [];
  /** True during procedural `generateProceduralLevelSpec` — cheaper graph physics checks. */
  let levelBuildFast = false;
  /** 0-based index: premade stages first, then endless procedural. */
  let campaignLevel = 0;
  /** After choosing a mode from the menu; false on title screens. */
  let gameSessionActive = false;
  let pauseMenuOpen = false;
  /** @type {null | "campaign" | "random" | "custom"} */
  let playMode = null;
  /** Set when playing a user-built level from the editor. */
  let customLevelSpec = null;
  let editorActive = false;
  /** @type {null | object} */
  let editorDraftSpec = null;
  /** Set when the draft was loaded from a named save; Save updates that entry. */
  let editorActiveSavedId = null;
  let editorSavedLevelTitle = "";
  /** Selected palette item for click-to-place (see `data-place-kind` in HTML). */
  let editorPlaceKind = "plat-solid";
  let editorMiddlePanning = false;
  let editorMiddlePanLastX = 0;
  let editorMiddlePanLastY = 0;
  /** @type {null | { pick: object; startWx: number; startWy: number; [k: string]: unknown }} */
  let editorDrag = null;
  /** @type {null | { pick: object; edge: string; orig: { x: number; y: number; w: number; h: number } }} */
  let editorScaleDrag = null;
  /** @type {null | { type: string; idx: number }} */
  let gluePending = null;
  const CUSTOM_LEVEL_STORAGE_KEY = "jump-custom-level-v1";
  /** Named levels saved from the editor (localStorage JSON array). */
  const SAVED_LEVELS_STORAGE_KEY = "jump-editor-saved-levels-v1";
  const MAX_SAVED_LEVELS = 48;
  /** Published editor levels eligible for Random mode (localStorage JSON array). */
  const PUBLISHED_LEVELS_STORAGE_KEY = "jump-published-levels-v1";
  const MAX_PUBLISHED_LEVELS = 48;
  /** Fraction of Random stages that try to load a published community level (if any exist). */
  const RANDOM_COMMUNITY_LEVEL_CHANCE = 0.34;
  /** True when current Random stage is a published community level (not procedural). */
  let randomCommunityActive = false;
  /** Short label (title) for the community HUD badge. */
  let randomCommunityLabel = "";
  /** Random mode: last stage was a published community level (used to avoid repeating it back-to-back). */
  let lastRandomWasCommunity = false;
  /** Stable key for `loadPublishedLevels()` entry; compared so the same level is not played twice in a row. */
  let lastRandomCommunityKey = "";
  let goal;
  let spawn;

  /** Right edge of level content (for camera clamp); set in buildLevel. */
  let levelMaxX = 2600;

  /** Level clock (seconds) for switch platforms; reset on restart. */
  let levelTimeSec = 0;

  function switchPlatformsSolid() {
    if (editorActive) return true;
    return (Math.floor(levelTimeSec / SWITCH_FLIP_SEC) % 2) === 0;
  }

  function platSolid(plat, glueDepth = 0) {
    if (!plat || glueDepth > 24) return true;
    if (plat.gluePlatIdx != null) {
      const parent = platforms[plat.gluePlatIdx];
      if (parent && !platSolid(parent, glueDepth + 1)) return false;
    }
    if (!plat.switch) return true;
    return switchPlatformsSolid();
  }

  function wallHazardActive(w) {
    if (w.gluePlatIdx == null) return true;
    const p = platforms[w.gluePlatIdx];
    return Boolean(p && platSolid(p));
  }

  /**
   * Glued platforms follow moving parents in syncGluedFollowers, but the player is only
   * carried for the elevator block itself in syncElevatorsCarryPlayer. Move the player with
   * follower platforms when grounded on top (editor preview + gameplay).
   */
  function carryPlayerWithGluedFollowerDelta(plat, oldX, oldY) {
    if (state !== "playing") return;
    if (entityHasRot(plat)) return;
    const dx = plat.x - oldX;
    const dy = plat.y - oldY;
    if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) return;
    const gx = worldGravityX;
    const gy = worldGravityY;
    const vN = player.vx * gx + player.vy * gy;
    if (!player.onGround || vN < -55) return;
    const sensor = playerGroundSensorRect();
    const oldPlat = { x: oldX, y: oldY, w: plat.w, h: plat.h };
    if (!rectsOverlap(sensor, oldPlat)) return;
    let remX = dx;
    while (Math.abs(remX) > 1e-6) {
      const s = Math.sign(remX) * Math.min(Math.abs(remX), PLAYER_MOVE_SUBSTEP);
      player.x += s;
      depenetratePlayerVsAxisAlignedSolids();
      remX -= s;
    }
    let remY = dy;
    while (Math.abs(remY) > 1e-6) {
      const s = Math.sign(remY) * Math.min(Math.abs(remY), PLAYER_MOVE_SUBSTEP);
      player.y += s;
      depenetratePlayerVsAxisAlignedSolids();
      remY -= s;
    }
  }

  function syncGluedFollowers() {
    const passes = Math.min(24, platforms.length + walls.length + debuffZones.length + 2);
    for (let pass = 0; pass < passes; pass++) {
      for (let wi = 0; wi < walls.length; wi++) {
        const w = walls[wi];
        if (w.gluePlatIdx == null) continue;
        if (editorDrag && editorDrag.pick.type === "wall" && editorDrag.pick.idx === wi) continue;
        const p = platforms[w.gluePlatIdx];
        if (!p) continue;
        w.x = p.x + (w.glueRelX ?? 0);
        w.y = p.y + (w.glueRelY ?? 0);
      }
      for (let pi = 0; pi < platforms.length; pi++) {
        const plat = platforms[pi];
        if (plat.gluePlatIdx == null) continue;
        if (plat.elev) continue;
        if (editorDrag && editorDrag.pick.type === "platform" && editorDrag.pick.idx === pi) continue;
        const p = platforms[plat.gluePlatIdx];
        if (!p) continue;
        const oldX = plat.x;
        const oldY = plat.y;
        plat.x = p.x + (plat.glueRelX ?? 0);
        plat.y = p.y + (plat.glueRelY ?? 0);
        carryPlayerWithGluedFollowerDelta(plat, oldX, oldY);
      }
      for (let zi = 0; zi < debuffZones.length; zi++) {
        const z = debuffZones[zi];
        if (z.gluePlatIdx == null) continue;
        if (editorDrag && editorDrag.pick.type === "debuff" && editorDrag.pick.idx === zi) continue;
        const p = platforms[z.gluePlatIdx];
        if (!p) continue;
        z.x = p.x + (z.glueRelX ?? 0);
        z.y = p.y + (z.glueRelY ?? 0);
      }
    }
  }

  function syncElevatorsCarryPlayer() {
    if (editorActive) return;
    const gx = worldGravityX;
    const gy = worldGravityY;
    const sensor = playerGroundSensorRect();
    for (const plat of platforms) {
      if (!plat.elev || !platSolid(plat)) continue;
      const oldY = plat.y;
      const newY =
        plat.yBase +
        Math.sin(levelTimeSec * plat.elev.omega + plat.elev.phase) * plat.elev.amp;
      const dy = newY - oldY;
      const vN = player.vx * gx + player.vy * gy;
      const onLift =
        state === "playing" &&
        player.onGround &&
        vN >= -55 &&
        (entityHasRot(plat)
          ? aabbOverlapsRotatedEntity(sensor, plat)
          : rectsOverlap(sensor, plat));
      plat.y = newY;
      if (onLift && dy !== 0) {
        let rem = dy;
        while (Math.abs(rem) > 1e-6) {
          const s = Math.sign(rem) * Math.min(Math.abs(rem), PLAYER_MOVE_SUBSTEP);
          player.y += s;
          if (entityHasRot(plat)) resolvePlayerVsRotatedSolids(8);
          else depenetratePlayerVsAxisAlignedSolids();
          rem -= s;
        }
      }
    }
  }

  function groundIsSlippery() {
    if (!player.onGround) return false;
    const sensor = playerGroundSensorRect();
    for (const plat of platforms) {
      if (!platSolid(plat) || !plat.ice) continue;
      if (entityHasRot(plat)) {
        if (aabbOverlapsRotatedEntity(sensor, plat)) return true;
        continue;
      }
      if (rectsOverlap(sensor, plat)) return true;
    }
    return false;
  }

  function snapPlayerToLiftTops() {
    if (state !== "playing") return;
    const gx = worldGravityX;
    const gy = worldGravityY;
    const vN = player.vx * gx + player.vy * gy;
    if (!player.onGround && vN < -35) return;
    const sensor = playerGroundSensorRect();
    for (const plat of platforms) {
      if (!plat.elev || !platSolid(plat) || entityHasRot(plat)) continue;
      if (!rectsOverlap(sensor, plat)) continue;
      if (Math.abs(gx) < 1e-6 && gy > 0) {
        player.y = plat.y - player.h;
        if (player.vy > 0) player.vy = 0;
      } else if (Math.abs(gx) < 1e-6 && gy < 0) {
        player.y = plat.y + plat.h;
        if (player.vy < 0) player.vy = 0;
      } else if (gx < 0 && Math.abs(gy) < 1e-6) {
        player.x = plat.x + plat.w;
        if (player.vx < 0) player.vx = 0;
      } else if (gx > 0 && Math.abs(gy) < 1e-6) {
        player.x = plat.x - player.w;
        if (player.vx > 0) player.vx = 0;
      }
      player.onGround = true;
    }
  }

  function tryInstallElevators(pl, wl) {
    const goalIdx = pl.length - 1;
    if (goalIdx < 6) return;
    const elevAttempts = proceduralGenOpts.randomFast ? 4 : 8;
    for (let attempt = 0; attempt < elevAttempts; attempt++) {
      const idx = 4 + ((Math.random() * (goalIdx - 5)) | 0);
      if (idx >= goalIdx) continue;
      const cand = pl[idx];
      if (cand.switch || cand.elev || cand.ice || cand.launcher || cand.gravSwitch) continue;
      const yBase = cand.y;
      const amp = 32 + Math.random() * 44;
      const omega = (Math.PI * 2) / (2.4 + Math.random() * 2);
      const phase = Math.random() * Math.PI * 2;
      cand.yBase = yBase;
      cand.elev = { amp, omega, phase };
      const tests = proceduralGenOpts.randomFast
        ? [0, 1, 2].map((k) => k * (Math.PI / 2))
        : [0, 0.5, 1, 1.5].map((k) => k * Math.PI);
      let ok = true;
      for (let ti = 0; ti < tests.length; ti++) {
        cand.y = yBase + Math.sin(tests[ti]) * amp;
        if (!graphReachable(pl, 0, goalIdx, wl)) {
          ok = false;
          break;
        }
      }
      cand.y = yBase;
      if (ok) return;
      delete cand.yBase;
      delete cand.elev;
      cand.y = yBase;
    }
  }

  function wallBlocksLevel(pl, goalPl, wall, startClearW) {
    for (const e of pl) {
      if (rectsOverlap(wall, e)) return true;
    }
    if (goalPl && rectsOverlap(wall, goalPl)) return true;
    if (wall.x + wall.w > 0 && wall.x < startClearW && wall.y + wall.h > pl[0].y - 120) return true;
    return false;
  }

  function getWreckingBallPivot(rb) {
    const plat = platforms[rb.platIdx];
    if (!plat) return { x: 0, y: 0 };
    return {
      x: plat.x + plat.w * 0.5 + rb.relOffX,
      y: plat.y + rb.relOffY,
    };
  }

  function getWreckingBallPos(rb) {
    const p = getWreckingBallPivot(rb);
    const ang = rb.swingRad * Math.sin(levelTimeSec * rb.omega + rb.phase);
    const sr = entityRotRad(rb);
    const sa = Math.sin(ang);
    const ca = Math.cos(ang);
    const vx = sa * Math.cos(sr) - ca * Math.sin(sr);
    const vy = sa * Math.sin(sr) + ca * Math.cos(sr);
    return {
      x: p.x + vx * rb.ropeLen,
      y: p.y + vy * rb.ropeLen,
    };
  }

  /** Top surface Y of a platform (matches elevator motion for moving lifts). */
  function elevPlatSurfaceYAt(plat, tSec) {
    if (plat && plat.elev && plat.yBase !== undefined) {
      return plat.yBase + Math.sin(tSec * plat.elev.omega + plat.elev.phase) * plat.elev.amp;
    }
    return plat ? plat.y : 0;
  }

  function elevPlatSurfaceY(plat) {
    return elevPlatSurfaceYAt(plat, levelTimeSec);
  }

  /** Spikes on switch platforms only exist while the platform is solid (visible). */
  function spikeHazardActive(s) {
    const plat = platforms[s.platIdx];
    return Boolean(plat && platSolid(plat));
  }

  function spikeWorldRect(s) {
    const poly = spikeWorldCorners(s);
    if (!poly) return { x: 0, y: 0, w: 0, h: 0 };
    let mnX = Infinity;
    let mnY = Infinity;
    let mxX = -Infinity;
    let mxY = -Infinity;
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i];
      mnX = Math.min(mnX, p.x);
      mnY = Math.min(mnY, p.y);
      mxX = Math.max(mxX, p.x);
      mxY = Math.max(mxY, p.y);
    }
    return { x: mnX, y: mnY, w: mxX - mnX, h: mxY - mnY };
  }

  function spikeRectOnPlat(plat, s, tSec) {
    const p = plat.elev && plat.yBase !== undefined ? { ...plat, y: elevPlatSurfaceYAt(plat, tSec) } : plat;
    return spikeCornersForPlat(p, s);
  }

  function aabbOverlapsSpikeStrip(pb, s) {
    const poly = spikeWorldCorners(s);
    if (!poly) return false;
    const mtv = satMtvAabbConvexPoly(pb.x, pb.y, pb.w, pb.h, poly);
    return Boolean(mtv && mtv.depth > 0);
  }

  /**
   * True if, for any platform, the summed width of spike strips on that platform exceeds
   * `MAX_SPIKE_COVERAGE_FRACTION` of the platform width (counts as impossible for validation/publish).
   */
  function levelHasImpossibleSpikeCoverage(platforms, spikeList) {
    if (!Array.isArray(spikeList) || !Array.isArray(platforms) || spikeList.length === 0) return false;
    const sumW = new Map();
    for (const s of spikeList) {
      if (!s || typeof s.platIdx !== "number") continue;
      const w = Number(s.w);
      if (!Number.isFinite(w) || w <= 0) continue;
      const plat = platforms[s.platIdx];
      if (!plat || !(plat.w > 0)) continue;
      sumW.set(s.platIdx, (sumW.get(s.platIdx) ?? 0) + w);
    }
    for (const [pi, total] of sumW) {
      const plat = platforms[pi];
      if (plat && total / plat.w > MAX_SPIKE_COVERAGE_FRACTION) return true;
    }
    return false;
  }

  /** Right edge of goal platform — no hazards past this X. */
  function exitDoorRightX(goalPlRect) {
    return goalPlRect ? goalPlRect.x + goalPlRect.w : Infinity;
  }

  /** Spike strips on platform surfaces (touch = respawn). */
  function tryPlaceSpikes(pl, spList, goalPl, startW, hz) {
    const lo = 1;
    const hi = pl.length - 2;
    if (hi < lo) return;
    const usedPlat = new Set();
    const exitRx = exitDoorRightX(goalPl);
    const spikeTries = proceduralGenOpts.randomFast ? 11 : 38;
    for (let t = 0; t < spikeTries; t++) {
      if (hz && hz.used >= hz.max) break;
      const i = lo + ((Math.random() * (hi - lo + 1)) | 0);
      if (usedPlat.has(i)) continue;
      const plat = pl[i];
      if (plat.w < 50) continue;
      if (plat.launcher) continue;
      if (plat.x + plat.w < startW + 90) continue;
      if (goalPl) {
        const gx0 = goalPl.x - 36;
        const gx1 = goalPl.x + goalPl.w + 36;
        if (plat.x < gx1 && plat.x + plat.w > gx0 && plat.y > goalPl.y - 100) continue;
      }
      const roomEnd = exitRx - plat.x;
      if (roomEnd < 40) continue;
      const maxStrip = Math.min(128, plat.w - 18, Math.floor(roomEnd - 6));
      if (maxStrip < 34) continue;
      const sw = Math.round(randRange(34, maxStrip));
      const relXMax = Math.min(plat.w - sw - 6, roomEnd - sw);
      if (relXMax < 6) continue;
      const relX = Math.round(randRange(6, relXMax));
      const sh = Math.round(randRange(13, 24));
      if (sw / plat.w > MAX_SPIKE_COVERAGE_FRACTION) continue;
      const cand = { platIdx: i, relX, w: sw, h: sh };
      usedPlat.add(i);
      spList.push(cand);
      if (hz) hz.used++;
    }
  }

  /** Pendulum balls above random platforms (touch = respawn). */
  function tryPlaceWreckingBalls(pl, rbList, goalPl, startW, hz) {
    const lo = 4;
    const hi = pl.length - 2;
    if (hi <= lo) return;
    const used = new Set();
    const exitRx = exitDoorRightX(goalPl);
    const rbTries = proceduralGenOpts.randomFast ? 16 : 28;
    for (let t = 0; t < rbTries; t++) {
      if (hz && hz.used >= hz.max) break;
      const i = lo + ((Math.random() * (hi - lo + 1)) | 0);
      if (used.has(i)) continue;
      const plat = pl[i];
      if (plat.launcher) continue;
      if (plat.x + plat.w < startW + 170) continue;
      if (goalPl) {
        const gx0 = goalPl.x - 50;
        const gx1 = goalPl.x + goalPl.w + 50;
        if (plat.x < gx1 && plat.x + plat.w > gx0 && plat.y > goalPl.y - 200) continue;
      }
      const ropeLen = Math.round(randRange(96, 176));
      const maxOff = Math.min(100, plat.w * 0.42);
      const pivotApprox = plat.x + plat.w * 0.5 + maxOff;
      if (pivotApprox + ropeLen > exitRx) continue;
      used.add(i);
      rbList.push({
        platIdx: i,
        relOffX: Math.round((Math.random() - 0.5) * Math.min(100, plat.w * 0.42)),
        relOffY: -Math.round(randRange(38, 96)),
        ropeLen,
        swingRad: randRange(0.48, 0.98),
        omega: randRange(1.15, 2.25),
        phase: Math.random() * Math.PI * 2,
        r: Math.round(randRange(14, 20)),
      });
      if (hz) hz.used++;
    }
  }

  function tryPlaceWalls(pl, wl, goalPl, goalIdx, g, yMin, startW, hz) {
    const exitRx = exitDoorRightX(goalPl);
    const wallTries = proceduralGenOpts.randomFast ? 7 : 12;
    for (let t = 0; t < wallTries; t++) {
      if (goalIdx < 4) break;
      if (hz && hz.used >= hz.max) break;
      const i = 2 + ((Math.random() * Math.max(1, goalIdx - 3)) | 0);
      const a = pl[i];
      const b = pl[Math.min(i + 1, goalIdx)];
      const wallW = Math.round(randRange(14, 22));
      const spanTop = Math.min(a.y, b.y) - randRange(35, 105);
      const spanBot = Math.max(a.y + a.h, b.y + b.h) + randRange(15, 70);
      const mid = (a.x + a.w + b.x) * 0.5 + randRange(-40, 40);
      const wx = Math.round(mid - wallW * 0.5);
      let wy = Math.round(spanTop);
      let wh = Math.round(spanBot - wy);
      wy = Math.max(yMin - 8, wy);
      wh = Math.max(52, Math.min(wh, g + 55 - wy));
      const wall = { x: wx, y: wy, w: wallW, h: wh };
      if (wall.x + wall.w > exitRx) continue;
      if (wallBlocksLevel(pl, goalPl, wall, startW + 55)) continue;
      wl.push(wall);
      if (!graphReachable(pl, 0, goalIdx, wl)) {
        wl.pop();
      } else if (hz) {
        hz.used++;
      }
    }
  }

  /**
   * Conservative one-way jump from prev (approach from left) to next.
   * rise > 0 means next platform is higher (smaller y).
   */
  function jumpReachable(prev, next) {
    const gapX = next.x - (prev.x + prev.w);
    const rise = prev.y - next.y;
    if (rise > 122) return false;
    if (rise < -300) return false;
    if (gapX < -52) return false;
    const g = Math.max(0, gapX);
    if (rise <= 0) return g <= 248;
    if (rise > 95) return g <= 108;
    if (rise > 70) return g <= 138;
    if (rise > 45) return g <= 162;
    return g <= 178;
  }

  /** `upper` is above `lower` (smaller y). Straight-up style jumps. */
  function jumpVerticalStack(lower, upper) {
    if (upper.y >= lower.y - 2) return false;
    const rise = lower.y - upper.y;
    if (rise < 34 || rise > 118) return false;
    const overlap =
      Math.min(lower.x + lower.w, upper.x + upper.w) - Math.max(lower.x, upper.x);
    return overlap >= 22;
  }

  function walkTouching(a, b) {
    if (Math.abs(a.y - b.y) > 10) return false;
    if (a.x + a.w <= b.x) return b.x - (a.x + a.w) <= 6;
    if (b.x + b.w <= a.x) return a.x - (b.x + b.w) <= 6;
    return true;
  }

  function canTraverse(a, b) {
    if (walkTouching(a, b)) return true;
    if (jumpReachable(a, b)) return true;
    if (jumpReachable(b, a)) return true;
    if (jumpVerticalStack(a, b)) return true;
    if (jumpVerticalStack(b, a)) return true;
    return false;
  }

  function randRange(a, b) {
    return a + Math.random() * (b - a);
  }

  function pickPlatformWidth() {
    const r = Math.random();
    if (r < 0.38) return Math.round(randRange(110, 198));
    if (r < 0.62) return Math.round(randRange(72, 118));
    return Math.round(randRange(46, 78));
  }

  /** Extend a platform list with conservative jumps until long enough for fallback levels. */
  function padPlatformsToMinCount(pl, g, yMin) {
    let guard = 0;
    while (
      pl.length < MIN_PLATFORMS_BEFORE_GOAL &&
      pl.length < MAX_PLATFORMS_PER_LEVEL &&
      guard++ < 200
    ) {
      const last = pl[pl.length - 1];
      const nw = pickPlatformWidth();
      const nh = Math.random() < 0.2 ? Math.round(randRange(24, 32)) : 22;
      const gap = Math.round(randRange(24, 92));
      const nx = last.x + last.w + gap;
      let ny = Math.round(
        Math.min(g - 10, Math.max(yMin + 8, last.y + randRange(-88, 78))),
      );
      const cand = { x: nx, y: ny, w: nw, h: nh };
      let ok =
        jumpReachable(last, cand) ||
        jumpVerticalStack(last, cand) ||
        jumpReachable(cand, last);
      if (!ok) {
        cand.y = Math.round(last.y);
        ok =
          jumpReachable(last, cand) ||
          jumpVerticalStack(last, cand) ||
          jumpReachable(cand, last);
      }
      if (!ok) continue;
      pl.push(cand);
    }
  }

  /**
   * Drop interior platforms (never index 0 or the last / goal tile) if the
   * physics graph from start to goal still holds — removes redundant branches.
   */
  function pruneRedundantPlatforms(pl, wl, maxPasses) {
    const wList = wl || [];
    const cap = maxPasses ?? PRUNE_MAX_PASSES;
    let guard = 0;
    while (guard++ < cap) {
      let removed = false;
      for (let i = pl.length - 2; i >= 1; i--) {
        const test = pl.slice(0, i).concat(pl.slice(i + 1));
        if (!graphReachable(test, 0, test.length - 1, wList)) continue;
        pl.splice(i, 1);
        removed = true;
        break;
      }
      if (!removed) break;
    }
  }

  function premadeStageCount() {
    return window.PREMADE_LEVELS && window.PREMADE_LEVELS.length ? window.PREMADE_LEVELS.length : 0;
  }

  function applyRawLevelSpec(raw) {
    platforms = JSON.parse(JSON.stringify(raw.platforms));
    walls = JSON.parse(JSON.stringify(raw.walls || []));
    wreckingBalls = JSON.parse(JSON.stringify(raw.wreckingBalls || []));
    spikes = JSON.parse(JSON.stringify(raw.spikes || []));
    debuffZones = JSON.parse(JSON.stringify(raw.debuffZones || []));
    goal = { ...raw.goal };
    spawn = { ...raw.spawn };
    for (const plat of platforms) {
      normalizeEntityRot(plat);
      if (plat.elev && plat.yBase !== undefined) {
        plat.y = plat.yBase + Math.sin(plat.elev.phase) * plat.elev.amp;
      }
    }
    for (const w of walls) normalizeEntityRot(w);
    for (const s of spikes) normalizeEntityRot(s);
    for (const z of debuffZones) normalizeEntityRot(z);
    for (const rb of wreckingBalls) normalizeEntityRot(rb);
    normalizeEntityRot(goal);
    let mx = goal.x + goal.w;
    const aaGoal = entityWorldAabb(goal);
    mx = Math.max(mx, aaGoal.x + aaGoal.w);
    for (const p of platforms) {
      const aa = entityWorldAabb(p);
      mx = Math.max(mx, aa.x + aa.w);
    }
    for (const w of walls) {
      const aa = entityWorldAabb(w);
      mx = Math.max(mx, aa.x + aa.w);
    }
    for (const z of debuffZones) {
      const aa = entityWorldAabb(z);
      mx = Math.max(mx, aa.x + aa.w);
    }
    for (const s of spikes) {
      const r = spikeWorldRect(s);
      if (r.w > 0) mx = Math.max(mx, r.x + r.w);
    }
    levelMaxX = mx + 140;
  }

  function applyPremadeLevel(factory) {
    const g = H - 40;
    applyRawLevelSpec(factory(g));
  }

  function updateLevelHud() {
    if (!levelHudEl) return;
    if (!gameSessionActive || playMode == null) {
      levelHudEl.textContent = "";
      if (communityHudEl) {
        communityHudEl.textContent = "";
        communityHudEl.classList.add("hidden");
      }
      return;
    }
    if (playMode === "custom") {
      levelHudEl.textContent = "My level";
      if (communityHudEl) {
        communityHudEl.textContent = "";
        communityHudEl.classList.add("hidden");
      }
      return;
    }
    const nPre = premadeStageCount();
    if (playMode === "random") {
      const n = Math.max(1, campaignLevel - nPre + 1);
      levelHudEl.textContent = `Random — ${n}`;
      if (communityHudEl) {
        if (randomCommunityActive && randomCommunityLabel) {
          communityHudEl.textContent = randomCommunityLabel;
          communityHudEl.classList.remove("hidden");
        } else {
          communityHudEl.textContent = "";
          communityHudEl.classList.add("hidden");
        }
      }
      return;
    }
    if (communityHudEl) {
      communityHudEl.textContent = "";
      communityHudEl.classList.add("hidden");
    }
    if (nPre > 0 && campaignLevel < nPre) {
      levelHudEl.textContent = `Campaign ${campaignLevel + 1} / ${nPre}`;
    } else {
      levelHudEl.textContent = `Endless — stage ${campaignLevel + 1}`;
    }
  }

  function loadPublishedLevels() {
    try {
      const raw = localStorage.getItem(PUBLISHED_LEVELS_STORAGE_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (_) {
      return [];
    }
  }

  function publishedLevelKey(entry) {
    if (!entry) return "";
    if (entry.id != null && String(entry.id).length > 0) return String(entry.id);
    try {
      return JSON.stringify(entry.spec);
    } catch (_) {
      return "";
    }
  }

  function savePublishedLevels(arr) {
    try {
      const trimmed = arr.slice(-MAX_PUBLISHED_LEVELS);
      localStorage.setItem(PUBLISHED_LEVELS_STORAGE_KEY, JSON.stringify(trimmed));
    } catch (_) {}
  }

  function loadSavedLevelsList() {
    try {
      const raw = localStorage.getItem(SAVED_LEVELS_STORAGE_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (_) {
      return [];
    }
  }

  function persistSavedLevelsList(arr) {
    try {
      const trimmed = arr.slice(-MAX_SAVED_LEVELS);
      localStorage.setItem(SAVED_LEVELS_STORAGE_KEY, JSON.stringify(trimmed));
    } catch (_) {}
  }

  function refreshEditorSavedSelect() {
    if (!editorSavedSelect) return;
    const list = loadSavedLevelsList()
      .slice()
      .sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
    editorSavedSelect.innerHTML = "";
    const ph = document.createElement("option");
    ph.value = "";
    ph.textContent = "Load saved…";
    editorSavedSelect.appendChild(ph);
    for (const e of list) {
      if (!e || !e.id || !e.spec) continue;
      const opt = document.createElement("option");
      opt.value = e.id;
      const t = e.title && String(e.title).trim() ? String(e.title).trim().slice(0, 48) : "Untitled";
      const d = e.savedAt ? new Date(e.savedAt) : null;
      const suffix =
        d && !Number.isNaN(d.getTime())
          ? ` — ${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
          : "";
      opt.textContent = t + suffix;
      editorSavedSelect.appendChild(opt);
    }
  }

  function buildLevel() {
    randomCommunityActive = false;
    randomCommunityLabel = "";

    if (playMode === "custom" && customLevelSpec) {
      applyRawLevelSpec(customLevelSpec);
      return;
    }
    const nPre = premadeStageCount();
    if (
      playMode === "campaign" &&
      nPre > 0 &&
      campaignLevel < nPre &&
      window.PREMADE_LEVELS[campaignLevel]
    ) {
      applyPremadeLevel(window.PREMADE_LEVELS[campaignLevel]);
      return;
    }
    if (playMode === "random") {
      const pub = loadPublishedLevels();
      const communityPool =
        lastRandomWasCommunity && lastRandomCommunityKey
          ? pub.filter((p) => publishedLevelKey(p) !== lastRandomCommunityKey)
          : pub;
      if (communityPool.length > 0 && Math.random() < RANDOM_COMMUNITY_LEVEL_CHANCE) {
        const tries = Math.min(10, communityPool.length * 2);
        for (let t = 0; t < tries; t++) {
          const pick = communityPool[(Math.random() * communityPool.length) | 0];
          if (!pick || !pick.spec) continue;
          const n = normalizeImportedSpec(JSON.parse(JSON.stringify(pick.spec)));
          if (!n) continue;
          if (levelHasImpossibleSpikeCoverage(n.platforms, n.spikes)) continue;
          try {
            applyRawLevelSpec(n);
            randomCommunityActive = true;
            lastRandomWasCommunity = true;
            lastRandomCommunityKey = publishedLevelKey(pick);
            randomCommunityLabel =
              pick.title && String(pick.title).trim()
                ? String(pick.title).trim().slice(0, 48)
                : "Community level";
            return;
          } catch (_) {}
        }
      }
    }
    levelBuildFast = true;
    try {
      applyProceduralSpec(generateProceduralLevelSpec());
    } finally {
      levelBuildFast = false;
    }
    if (playMode === "random") {
      lastRandomWasCommunity = false;
      lastRandomCommunityKey = "";
    }
  }

  function applyProceduralSpec(spec) {
    platforms = spec.platforms;
    walls = spec.walls;
    wreckingBalls = spec.wreckingBalls;
    spikes = spec.spikes;
    debuffZones = Array.isArray(spec.debuffZones) ? spec.debuffZones : [];
    goal = spec.goal;
    spawn = spec.spawn;
    levelMaxX = spec.levelMaxX;
  }

  function generateProceduralLevelSpec() {
    proceduralGenOpts.randomFast = playMode === "random";
    try {
      return generateProceduralLevelSpecInner();
    } finally {
      proceduralGenOpts.randomFast = false;
    }
  }

  function makeProceduralRngContext() {
    const rndFast = proceduralGenOpts.randomFast;
    const g = H - 40;
    const yMin = g - 430;
    return {
      g,
      yMin,
      rndFast,
      goalStopX: rndFast ? randRange(1680, 2060) : randRange(2180, 2460),
      chainCap: rndFast ? 300 : 420,
      innerMax: rndFast ? 38 : 58,
      branchB: rndFast ? 5 : 9,
      goalTries: rndFast ? 22 : 38,
    };
  }

  /**
   * One random procedural attempt (outer-loop body). Shared by synchronous generation.
   * @param {ReturnType<typeof makeProceduralRngContext>} ctx
   */
  function runProceduralOuterAttempt(ctx) {
    const g = ctx.g;
    const yMin = ctx.yMin;
    const rndFast = ctx.rndFast;
    const goalStopX = ctx.goalStopX;
    const chainCap = ctx.chainCap;
    const innerMax = ctx.innerMax;
    const branchB = ctx.branchB;
    const goalTries = ctx.goalTries;

    /** @type {{ x: number; y: number; w: number; h: number }[]} */
    const pl = [];
    const wl = [];
    const startW = Math.round(randRange(118, 188));
    pl.push({ x: 0, y: g, w: startW, h: 40 });

    let px = 0;
    let py = g;
    let pw = startW;

    let chainIters = 0;
    while (
      chainIters < chainCap &&
      (pl.length < MIN_PLATFORMS_BEFORE_GOAL || px + pw < goalStopX) &&
      pl.length < MAX_PLATFORMS_PER_LEVEL - 1
    ) {
      chainIters++;
      let placed = false;
      for (let inner = 0; inner < innerMax; inner++) {
        const vertMode = Math.random() < 0.17 && py > yMin + 100;
        let nx;
        let ny;
        const nw = pickPlatformWidth();
        const nh = Math.random() < 0.22 ? Math.round(randRange(24, 34)) : 22;

        if (vertMode) {
          nx = Math.round(px + pw / 2 - nw / 2 + randRange(-26, 26));
          nx = Math.max(10, nx);
          ny = Math.round(py - randRange(48, 118));
          if (ny < yMin) ny = Math.round(yMin + Math.random() * 22);
        } else {
          const gap = Math.round(randRange(22, 96));
          const roll = Math.random();
          let dy;
          if (roll < 0.34) dy = -randRange(38, 108);
          else if (roll < 0.68) dy = randRange(18, 128);
          else dy = randRange(-36, 44);

          ny = py + dy;
          if (ny < yMin) ny = yMin + Math.random() * 28;
          if (ny > g - 8) ny = g - randRange(8, 55);
          nx = px + pw + gap;
        }

        const next = { x: nx, y: ny, w: nw, h: nh };
        const prev = { x: px, y: py, w: pw, h: py === g ? 40 : pl[pl.length - 1].h };

        const ok =
          jumpReachable(prev, next) ||
          jumpVerticalStack(prev, next) ||
          jumpReachable(next, prev);
        if (!ok) continue;

        pl.push(next);
        px = nx;
        py = ny;
        pw = nw;
        placed = true;
        break;
      }
      if (!placed) return null;
    }
    if (pl.length < MIN_PLATFORMS_BEFORE_GOAL) return null;

    for (let b = 0; b < branchB; b++) {
      if (pl.length < 5) break;
      if (pl.length >= MAX_PLATFORMS_PER_LEVEL - 1) break;
      const bi = 1 + ((Math.random() * (pl.length - 1)) | 0);
      const base = pl[bi];
      const nw = pickPlatformWidth();
      const cand = {
        x: Math.round(base.x + randRange(-155, 175)),
        y: Math.round(base.y + randRange(-175, 110)),
        w: nw,
        h: Math.random() < 0.28 ? Math.round(randRange(24, 32)) : 22,
      };
      if (cand.y < yMin) cand.y = Math.round(yMin + 8);
      if (cand.y > g - 18) cand.y = Math.round(g - randRange(30, 125));
      if (cand.x < 6) cand.x = 6;

      let overlaps = false;
      for (const e of pl) {
        if (rectsOverlap(cand, e)) {
          overlaps = true;
          break;
        }
      }
      if (!overlaps) {
        for (const w of wl) {
          if (rectsOverlap(cand, w)) {
            overlaps = true;
            break;
          }
        }
      }
      if (overlaps) continue;

      pl.push(cand);
      const ci = pl.length - 1;
      let linked = false;
      for (let j = 0; j < ci; j++) {
        if (graphAdjacentPhysics(pl, j, ci, wl)) {
          linked = true;
          break;
        }
      }
      if (!linked) pl.pop();
    }

    if (pl.length < MIN_PLATFORMS_BEFORE_GOAL) return null;

    const last = pl[pl.length - 1];
    let goalPl = null;
    for (let gTry = 0; gTry < goalTries; gTry++) {
      const gg = Math.round(randRange(38, 92));
      const band = randRange(-90, 118);
      let gy = last.y + band;
      if (gy < yMin) gy = yMin + Math.random() * 40;
      if (gy > g - 70) gy = g - randRange(70, 160);
      const gw = Math.round(randRange(118, 200));
      const gx = last.x + last.w + gg;
      const candGoal = { x: gx, y: gy, w: gw, h: 28 };
      const okGoal =
        jumpReachable(last, candGoal) ||
        jumpVerticalStack(last, candGoal) ||
        jumpReachable(candGoal, last);
      if (!okGoal) continue;

      pl.push(candGoal);
      if (!graphReachable(pl, 0, pl.length - 1, wl)) {
        pl.pop();
        continue;
      }
      goalPl = candGoal;
      break;
    }
    if (!goalPl) return null;

    if (pl.length > MAX_PLATFORMS_PER_LEVEL) return null;

    const hazardBudget = { used: 0, max: MAX_HAZARDS_PER_LEVEL };
    tryPlaceWalls(pl, wl, goalPl, pl.length - 1, g, yMin, startW, hazardBudget);
    pruneRedundantPlatforms(pl, wl, rndFast ? RANDOM_PRUNE_MAX_PASSES : undefined);
    if (pl.length < MIN_PLATFORMS_BEFORE_GOAL) return null;
    if (pl.length > MAX_PLATFORMS_PER_LEVEL) return null;

    for (let si = 1; si < pl.length - 1; si++) {
      if (si < 4) continue;
      if (pl[si - 1].switch) continue;
      if (pl[si].launcher || pl[si].gravSwitch) continue;
      if (Math.random() < 0.2) pl[si].switch = true;
    }

    for (let ii = 3; ii < pl.length - 1; ii++) {
      if (pl[ii].switch || pl[ii].elev || pl[ii].launcher || pl[ii].gravSwitch) continue;
      if (pl[ii - 1].ice) continue;
      if (Math.random() < 0.17) pl[ii].ice = true;
    }

    for (let li = 5; li < pl.length - 2; li++) {
      if (pl[li].switch || pl[li].elev || pl[li].ice || pl[li].launcher || pl[li].gravSwitch) continue;
      if (Math.random() > 0.14) continue;
      const roll = Math.random();
      const vxJ = LAUNCH_FORWARD_VX + Math.round(randRange(-28, 38));
      if (roll < 0.36) {
        pl[li].launcher = { kind: "forward", vx: vxJ };
      } else if (roll < 0.72) {
        pl[li].launcher = { kind: "backward", vx: vxJ };
      } else {
        pl[li].launcher = {
          kind: "up",
          vy: LAUNCH_UP_VY + Math.round(randRange(-40, 40)),
        };
      }
    }

    tryInstallElevators(pl, wl);

    const rbl = [];
    tryPlaceWreckingBalls(pl, rbl, goalPl, startW, hazardBudget);

    const spl = [];
    tryPlaceSpikes(pl, spl, goalPl, startW, hazardBudget);

    const goalOut = {
      x: Math.round(goalPl.x + goalPl.w * 0.5 - 16),
      y: goalPl.y - 48,
      w: 32,
      h: 48,
    };
    const spawnOut = {
      x: Math.round(randRange(14, Math.max(22, startW - 28 - 8))),
      y: g - 48,
    };
    let mx = goalOut.x + goalOut.w;
    for (const p of pl) mx = Math.max(mx, p.x + p.w);
    return {
      platforms: pl,
      walls: wl.slice(),
      wreckingBalls: rbl,
      spikes: spl,
      debuffZones: [],
      goal: goalOut,
      spawn: spawnOut,
      levelMaxX: mx + 140,
    };
  }

  function generateProceduralLevelSpecInner() {
    const ctx = makeProceduralRngContext();
    const outerMax = ctx.rndFast ? 68 : 110;
    for (let attempt = 0; attempt < outerMax; attempt++) {
      const spec = runProceduralOuterAttempt(ctx);
      if (spec) return spec;
    }
    return buildLevelFallbackSpec(ctx.g, ctx.yMin);
  }

  function buildLevelFallbackSpec(g, yMin) {
    const pl = [
      { x: 0, y: g, w: 145, h: 40 },
      { x: 115, y: g - 92, w: 130, h: 22 },
      { x: 122, y: g - 205, w: 125, h: 22 },
      { x: 128, y: g - 318, w: 132, h: 22 },
      { x: 305, y: g - 86, w: 142, h: 22 },
      { x: 312, y: g - 198, w: 128, h: 22 },
      {
        x: 228,
        y: g - 138,
        w: 195,
        h: 24,
        yBase: g - 138,
        elev: { amp: 46, omega: (Math.PI * 2) / 3.1, phase: 0.7 },
      },
      { x: 495, y: g - 218, w: 165, h: 24, ice: true },
      { x: 665, y: g - 338, w: 172, h: 24, switch: true },
      { x: 818, y: g - 242, w: 155, h: 22 },
      { x: 978, y: g - 362, w: 178, h: 24 },
      { x: 1158, y: g - 262, w: 162, h: 22 },
      { x: 1338, y: g - 388, w: 188, h: 26 },
      { x: 1518, y: g - 288, w: 152, h: 22, launcher: { kind: "forward", vx: 448 } },
      { x: 1695, y: g - 208, w: 168, h: 24 },
      { x: 1875, y: g - 332, w: 176, h: 24, launcher: { kind: "up", vy: -960 } },
      { x: 2055, y: g - 232, w: 158, h: 22, launcher: { kind: "backward", vx: 440 } },
      { x: 2235, y: g - 162, w: 268, h: 28 },
    ];
    padPlatformsToMinCount(pl, g, yMin);
    const exitIdx = pl.length - 1;
    const exitPlat = pl[exitIdx];
    const wlFb = [];
    const hazardBudgetFb = { used: 0, max: MAX_HAZARDS_PER_LEVEL };
    tryPlaceWalls(pl, wlFb, exitPlat, exitIdx, g, yMin, 145, hazardBudgetFb);
    const wallsOut = wlFb.slice();
    for (
      let fix = 0;
      fix < 12 &&
      pl.length < MAX_PLATFORMS_PER_LEVEL &&
      !graphReachable(pl, 0, exitIdx, wallsOut);
      fix++
    ) {
      pl.push({
        x: 360 + fix * 40,
        y: g - 240 - (fix % 4) * 55,
        w: 200,
        h: 22,
      });
    }
    const rbFb = [];
    tryPlaceWreckingBalls(pl, rbFb, exitPlat, 145, hazardBudgetFb);
    for (const plat of pl) {
      if (plat.elev && plat.yBase !== undefined) {
        plat.y = plat.yBase + Math.sin(plat.elev.phase) * plat.elev.amp;
      }
    }
    const spFb = [];
    tryPlaceSpikes(pl, spFb, exitPlat, 145, hazardBudgetFb);
    const goalOut = {
      x: Math.round(exitPlat.x + exitPlat.w * 0.5 - 16),
      y: exitPlat.y - 48,
      w: 32,
      h: 48,
    };
    const spawnOut = { x: 40, y: g - 48 };
    let mx = goalOut.x + goalOut.w;
    for (const p of pl) mx = Math.max(mx, p.x + p.w);
    return {
      platforms: pl,
      walls: wallsOut,
      wreckingBalls: rbFb,
      spikes: spFb,
      debuffZones: [],
      goal: goalOut,
      spawn: spawnOut,
      levelMaxX: mx + 140,
    };
  }

  const player = {
    x: 0,
    y: 0,
    w: 28,
    h: 48,
    vx: 0,
    vy: 0,
    onGround: false,
    coyoteMs: 0,
    jumpBufferedMs: 0,
    facing: 1,
    launchBoostMs: 0,
    launchUpCoastMs: 0,
  };

  function applyLauncherFromContact() {
    if (state !== "playing") return;
    const gx = worldGravityX;
    const gy = worldGravityY;
    const wTx = gy;
    const wTy = -gx;
    const p = playerBounds();
    const sensor = playerGroundSensorRect();
    for (const plat of platforms) {
      if (!plat.launcher || !platSolid(plat)) continue;
      let onLauncher = false;
      if (entityHasRot(plat)) {
        if (aabbOverlapsRotatedEntity(sensor, plat)) {
          const feet = player.y + player.h;
          const cx = plat.x + plat.w * 0.5;
          const cy = plat.y + plat.h * 0.5;
          const rdx = p.x + p.w * 0.5 - cx;
          const rdy = feet - cy;
          const inv = -entityRotRad(plat);
          const c0 = Math.cos(inv);
          const s0 = Math.sin(inv);
          const lx = rdx * c0 - rdy * s0;
          const ly = rdx * s0 + rdy * c0;
          const halfH = plat.h * 0.5;
          const halfW = plat.w * 0.5;
          onLauncher =
            ly >= -halfH - 10 &&
            ly <= -halfH + 12 &&
            Math.abs(lx) <= halfW - 4;
        }
      } else {
        // Do not use player.onGround — it is updated only after this runs, so the first frame
        // you land on a launcher would miss. Ground sensor vs plat is enough.
        onLauncher = rectsOverlapOrTouch(sensor, plat);
      }
      if (onLauncher) {
        if (plat._launcherPrimed !== false) {
          const L = plat.launcher;
          const kind = L.kind ?? "forward";
          /** Same idea as default gravity: forward = +X run, backward = −X run, up = away from pull — but using current gravity's run (−g⊥) and anti-gravity (−g). */
          const tx = wTx;
          const ty = wTy;
          if (kind === "up") {
            const vyImp = L.vy ?? LAUNCH_UP_VY;
            const mag = -vyImp;
            player.vx += -gx * mag;
            player.vy += -gy * mag;
            player.onGround = false;
            player.coyoteMs = 0;
            player.launchUpCoastMs = LAUNCH_UP_COAST_MS;
          } else if (kind === "backward") {
            const mag = Math.abs(L.vx ?? LAUNCH_FORWARD_VX);
            const bx = -tx;
            const by = -ty;
            const dotB = player.vx * bx + player.vy * by;
            if (dotB < mag) {
              player.vx += bx * (mag - dotB);
              player.vy += by * (mag - dotB);
            }
            player.facing = -1;
            player.launchBoostMs = LAUNCH_BOOST_MS;
          } else {
            const v = L.vx ?? LAUNCH_FORWARD_VX;
            const dot = player.vx * tx + player.vy * ty;
            if (dot < v) {
              player.vx += tx * (v - dot);
              player.vy += ty * (v - dot);
            }
            player.facing = 1;
            player.launchBoostMs = LAUNCH_BOOST_MS;
          }
          plat._launcherPrimed = false;
        }
      } else {
        plat._launcherPrimed = true;
      }
    }
  }

  let camX = 0;
  /** Vertical camera (world Y at top of view). Gameplay keeps this at 0; editor can pan. */
  let camY = 0;
  let state = "playing";
  /** False until the first (or current) `buildLevel()` run finishes. */
  let levelReady = false;
  /** Bumped to ignore stale `requestAnimationFrame` callbacks after canceling an async load. */
  let loadGenerationId = 0;

  function setLoading(visible) {
    if (!loadingEl) return;
    loadingEl.classList.toggle("visible", visible);
    loadingEl.setAttribute("aria-busy", visible ? "true" : "false");
    if (visible) {
      loadingCubeHue = 0;
      const cube = loadingEl.querySelector(".loading-cube");
      if (cube) cube.style.setProperty("--lc-hue", "0deg");
    }
  }

  let loadingCubeHue = 0;
  function bindLoadingCubeColorCycle() {
    const cube = loadingEl?.querySelector(".loading-cube");
    if (!cube || cube.dataset.colorCycle === "1") return;
    cube.dataset.colorCycle = "1";
    cube.addEventListener("animationiteration", () => {
      loadingCubeHue = (loadingCubeHue + 60) % 360;
      cube.style.setProperty("--lc-hue", `${loadingCubeHue}deg`);
    });
  }
  bindLoadingCubeColorCycle();

  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  /** Intersecting or sharing an edge (inclusive bounds). Used where flush contact must count as touching. */
  function rectsOverlapOrTouch(a, b) {
    return a.x <= b.x + b.w && a.x + a.w >= b.x && a.y <= b.y + b.h && a.y + a.h >= b.y;
  }

  function playerInDebuffZone() {
    const pb = playerBounds();
    for (let i = 0; i < debuffZones.length; i++) {
      const z = debuffZones[i];
      if (entityHasRot(z)) {
        if (aabbOverlapsRotatedEntity(pb, z)) return true;
      } else if (rectsOverlap(pb, z)) return true;
    }
    return false;
  }

  /** Rotation in radians (CCW); 0 = axis-aligned. Pivot is rect center (x+w/2, y+h/2). */
  function entityRotRad(e) {
    if (!e || e.rot == null) return 0;
    const r = Number(e.rot);
    return Number.isFinite(r) ? r : 0;
  }

  function entityHasRot(e) {
    return Math.abs(entityRotRad(e)) > 1e-6;
  }

  function normalizeEntityRot(e) {
    if (e.rot == null) return;
    const r = Number(e.rot);
    if (!Number.isFinite(r)) {
      delete e.rot;
      return;
    }
    let t = r % (Math.PI * 2);
    if (t < 0) t += Math.PI * 2;
    if (t < 1e-5 || t > Math.PI * 2 - 1e-5) delete e.rot;
    else e.rot = t;
  }

  /** Platform local coords: (0,0) = top-left of unrotated rect; y increases downward. */
  function platLocalPointToWorld(plat, lx, ly) {
    const cx = plat.x + plat.w * 0.5;
    const cy = plat.y + plat.h * 0.5;
    const r = entityRotRad(plat);
    const c = Math.cos(r);
    const si = Math.sin(r);
    const dx = lx - plat.w * 0.5;
    const dy = ly - plat.h * 0.5;
    return { x: cx + dx * c - dy * si, y: cy + dx * si + dy * c };
  }

  /** Inverse of platLocalPointToWorld (editor spike placement on rotated platforms). */
  function platWorldPointToLocal(plat, wx, wy) {
    const cx = plat.x + plat.w * 0.5;
    const cy = plat.y + plat.h * 0.5;
    const r = entityRotRad(plat);
    const c = Math.cos(r);
    const si = Math.sin(r);
    const W = wx - cx;
    const Z = wy - cy;
    const dx = W * c + Z * si;
    const dy = -W * si + Z * c;
    return { lx: dx + plat.w * 0.5, ly: dy + plat.h * 0.5 };
  }

  /** Four corners of spike collision quad in world space (platform + optional strip `rot`). */
  function spikeCornersForPlat(plat, s) {
    if (!plat || !s) return null;
    const relX = s.relX;
    const w = s.w;
    const hTop = s.h;
    const corners = [
      platLocalPointToWorld(plat, relX, -hTop),
      platLocalPointToWorld(plat, relX + w, -hTop),
      platLocalPointToWorld(plat, relX + w, 0),
      platLocalPointToWorld(plat, relX, 0),
    ];
    if (!entityHasRot(s)) return corners;
    const scx = (corners[0].x + corners[2].x) * 0.5;
    const scy = (corners[0].y + corners[2].y) * 0.5;
    const sr = entityRotRad(s);
    const c = Math.cos(sr);
    const si = Math.sin(sr);
    return corners.map((p) => {
      const dx = p.x - scx;
      const dy = p.y - scy;
      return { x: scx + dx * c - dy * si, y: scy + dx * si + dy * c };
    });
  }

  function spikeWorldCorners(s) {
    return spikeCornersForPlat(platforms[s.platIdx], s);
  }

  function pointInConvexPolyQuad(wx, wy, poly) {
    const m = satMtvAabbConvexPoly(wx, wy, 1, 1, poly);
    return Boolean(m && m.depth > 0);
  }

  function rotObbCorners(e) {
    const cx = e.x + e.w * 0.5;
    const cy = e.y + e.h * 0.5;
    const hx = e.w * 0.5;
    const hy = e.h * 0.5;
    const r = entityRotRad(e);
    const c = Math.cos(r);
    const s = Math.sin(r);
    return [
      { x: cx + -hx * c - -hy * s, y: cy + -hx * s + -hy * c },
      { x: cx + hx * c - -hy * s, y: cy + hx * s + -hy * c },
      { x: cx + hx * c - hy * s, y: cy + hx * s + hy * c },
      { x: cx + -hx * c - hy * s, y: cy + -hx * s + hy * c },
    ];
  }

  function projectPolyRange(pts, ux, uy) {
    let mn = Infinity;
    let mx = -Infinity;
    for (let i = 0; i < pts.length; i++) {
      const t = pts[i].x * ux + pts[i].y * uy;
      mn = Math.min(mn, t);
      mx = Math.max(mx, t);
    }
    return { min: mn, max: mx };
  }

  /** Minimum translation to separate AABB (px,py,pw,ph) from convex polygon; null if separated. */
  function satMtvAabbConvexPoly(px, py, pw, ph, poly) {
    const aCorners = [
      { x: px, y: py },
      { x: px + pw, y: py },
      { x: px + pw, y: py + ph },
      { x: px, y: py + ph },
    ];
    const axes = [];
    function pushAxis(ax, ay) {
      const len = Math.hypot(ax, ay);
      if (len < 1e-9) return;
      axes.push({ x: ax / len, y: ay / len });
    }
    pushAxis(1, 0);
    pushAxis(0, 1);
    for (let i = 0; i < poly.length; i++) {
      const j = (i + 1) % poly.length;
      const ex = poly[j].x - poly[i].x;
      const ey = poly[j].y - poly[i].y;
      pushAxis(-ey, ex);
    }
    let minOverlap = Infinity;
    let bestUx = 1;
    let bestUy = 0;
    for (let ai = 0; ai < axes.length; ai++) {
      const ux = axes[ai].x;
      const uy = axes[ai].y;
      const A = projectPolyRange(aCorners, ux, uy);
      const B = projectPolyRange(poly, ux, uy);
      const overlap = Math.min(A.max, B.max) - Math.max(A.min, B.min);
      if (overlap < 0) return null;
      if (overlap < minOverlap) {
        minOverlap = overlap;
        bestUx = ux;
        bestUy = uy;
      }
    }
    const acx = px + pw * 0.5;
    const acy = py + ph * 0.5;
    let bcx = 0;
    let bcy = 0;
    for (let i = 0; i < poly.length; i++) {
      bcx += poly[i].x;
      bcy += poly[i].y;
    }
    bcx /= poly.length;
    bcy /= poly.length;
    const dot = (acx - bcx) * bestUx + (acy - bcy) * bestUy;
    const sign = dot >= 0 ? 1 : -1;
    return { depth: minOverlap, nx: bestUx * sign, ny: bestUy * sign };
  }

  function entityWorldAabb(e) {
    if (!entityHasRot(e)) return { x: e.x, y: e.y, w: e.w, h: e.h };
    const poly = rotObbCorners(e);
    let mnX = Infinity;
    let mnY = Infinity;
    let mxX = -Infinity;
    let mxY = -Infinity;
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i];
      mnX = Math.min(mnX, p.x);
      mnY = Math.min(mnY, p.y);
      mxX = Math.max(mxX, p.x);
      mxY = Math.max(mxY, p.y);
    }
    return { x: mnX, y: mnY, w: mxX - mnX, h: mxY - mnY };
  }

  function pointInRotRect(wx, wy, e) {
    const cx = e.x + e.w * 0.5;
    const cy = e.y + e.h * 0.5;
    const dx = wx - cx;
    const dy = wy - cy;
    const r = -entityRotRad(e);
    const c = Math.cos(r);
    const s = Math.sin(r);
    const lx = dx * c - dy * s;
    const ly = dx * s + dy * c;
    return Math.abs(lx) <= e.w * 0.5 + 0.5 && Math.abs(ly) <= e.h * 0.5 + 0.5;
  }

  function aabbOverlapsRotatedEntity(pb, e) {
    if (!entityHasRot(e)) return rectsOverlap(pb, e);
    const mtv = satMtvAabbConvexPoly(pb.x, pb.y, pb.w, pb.h, rotObbCorners(e));
    return Boolean(mtv && mtv.depth > 0);
  }

  function resolvePlayerVsRotatedSolids(maxIter) {
    if (state !== "playing") return;
    for (let it = 0; it < maxIter; it++) {
      let moved = false;
      for (let pi = 0; pi < platforms.length; pi++) {
        const plat = platforms[pi];
        if (!platSolid(plat) || !entityHasRot(plat)) continue;
        const p = playerBounds();
        const mtv = satMtvAabbConvexPoly(p.x, p.y, p.w, p.h, rotObbCorners(plat));
        if (!mtv || mtv.depth <= 0.001) continue;
        const push = mtv.depth + 0.02;
        player.x += mtv.nx * push;
        player.y += mtv.ny * push;
        if (mtv.ny < -0.22) {
          player.onGround = true;
          if (player.vy > 0) player.vy = 0;
        }
        if (mtv.ny > 0.45 && player.vy < 0) player.vy = 0;
        if (Math.abs(mtv.nx) > 0.55) player.vx = 0;
        moved = true;
      }
      for (let wi = 0; wi < walls.length; wi++) {
        const w = walls[wi];
        if (!wallHazardActive(w) || !entityHasRot(w)) continue;
        const p = playerBounds();
        const mtv = satMtvAabbConvexPoly(p.x, p.y, p.w, p.h, rotObbCorners(w));
        if (!mtv || mtv.depth <= 0.001) continue;
        const push = mtv.depth + 0.02;
        player.x += mtv.nx * push;
        player.y += mtv.ny * push;
        if (mtv.ny < -0.22) {
          player.onGround = true;
          if (player.vy > 0) player.vy = 0;
        }
        if (mtv.ny > 0.45 && player.vy < 0) player.vy = 0;
        if (Math.abs(mtv.nx) > 0.55) player.vx = 0;
        moved = true;
      }
      if (!moved) break;
    }
  }

  const SIM_PW = 28;
  const SIM_PH = 48;
  const SIM_DT = 1 / 100;
  const SIM_MAX_STEPS = 140;
  /** Shorter sim during level build only (graph edges); gameplay is unchanged. */
  const BUILD_SIM_MAX_STEPS = 118;
  /** Even shorter sim for Random mode procedural gen only. */
  const RANDOM_BUILD_SIM_MAX_STEPS = 78;
  /** Max prune removal waves per level (each wave runs one full graph check). */
  const PRUNE_MAX_PASSES = 14;
  /** Random mode: fewer prune passes (faster build, still verified each wave). */
  const RANDOM_PRUNE_MAX_PASSES = 6;
  /** Set only while `generateProceduralLevelSpec` runs (Random mode tweaks reads). */
  const proceduralGenOpts = { randomFast: false };

  function simResolveX(px, py, pw, ph, vx, pl, dt, wl) {
    const extras = wl || [];
    const dx = vx * dt;
    let x = px + dx;
    let outVx = vx;
    const box = (xx) => ({ x: xx, y: py, w: pw, h: ph });
    for (const plat of pl) {
      if (!rectsOverlap(box(x), plat)) continue;
      if (dx > 0) x = plat.x - pw;
      else if (dx < 0) x = plat.x + plat.w;
      outVx = 0;
    }
    for (const w of extras) {
      if (!rectsOverlap(box(x), w)) continue;
      if (dx > 0) x = w.x - pw;
      else if (dx < 0) x = w.x + w.w;
      outVx = 0;
    }
    return { x, vx: outVx };
  }

  function simResolveY(px, py, pw, ph, vy, pl, dt, wl) {
    const extras = wl || [];
    const dy = vy * dt;
    let y = py + dy;
    let outVy = vy;
    let onGround = false;
    const box = (yy) => ({ x: px, y: yy, w: pw, h: ph });
    for (const plat of pl) {
      if (!rectsOverlap(box(y), plat)) continue;
      if (dy > 0) {
        y = plat.y - ph;
        onGround = true;
        outVy = 0;
      } else if (dy < 0) {
        y = plat.y + plat.h;
        outVy = 0;
      }
    }
    for (const w of extras) {
      if (!rectsOverlap(box(y), w)) continue;
      if (dy > 0) {
        y = w.y - ph;
        onGround = true;
        outVy = 0;
      } else if (dy < 0) {
        y = w.y + w.h;
        outVy = 0;
      }
    }
    return { y, vy: outVy, onGround };
  }

  function simStepFrame(px, py, vx, vy, onGround, coyoteMs, jumpBufMs, hold, pl, dt, wl) {
    jumpBufMs = Math.max(0, jumpBufMs - dt * 1000);
    const accel = onGround ? MOVE_ACCEL : AIR_ACCEL;
    if (hold < 0) vx -= accel * dt;
    else if (hold > 0) vx += accel * dt;
    else {
      const f = onGround ? FRICTION : AIR_FRICTION;
      const sign = Math.sign(vx);
      const mag = Math.abs(vx);
      const dec = f * dt;
      const next = mag - dec;
      vx = next <= 0 ? 0 : sign * next;
    }
    vx = Math.max(-MAX_RUN, Math.min(MAX_RUN, vx));

    if (onGround) coyoteMs = COYOTE_MS;
    else coyoteMs = Math.max(0, coyoteMs - dt * 1000);

    if (jumpBufMs > 0 && coyoteMs > 0) {
      vy = JUMP_V;
      onGround = false;
      coyoteMs = 0;
      jumpBufMs = 0;
    }
    vy += GRAVITY * dt;
    if (vy > 1200) vy = 1200;

    const rx = simResolveX(px, py, SIM_PW, SIM_PH, vx, pl, dt, wl);
    px = rx.x;
    vx = rx.vx;
    const ry = simResolveY(px, py, SIM_PW, SIM_PH, vy, pl, dt, wl);
    py = ry.y;
    vy = ry.vy;
    onGround = ry.onGround;

    return { px, py, vx, vy, onGround, coyoteMs, jumpBufMs };
  }

  /**
   * True if the player can move from standing on fromP to standing on toP's top
   * with full level geometry (same movement rules as gameplay).
   */
  function physicsSimReach(pl, fromP, toP, wl) {
    const wList = wl || [];
    if (walkTouching(fromP, toP)) return true;

    const fast = levelBuildFast;
    const rndFast = proceduralGenOpts.randomFast;
    const maxSteps = rndFast ? RANDOM_BUILD_SIM_MAX_STEPS : fast ? BUILD_SIM_MAX_STEPS : SIM_MAX_STEPS;
    const pad = 3;
    const xmin = fromP.x + pad;
    const xmax = fromP.x + fromP.w - SIM_PW - pad;
    const starts =
      xmax < xmin
        ? [fromP.x + (fromP.w - SIM_PW) * 0.5]
        : rndFast
          ? [0, 1].map((t) => xmin + t * (xmax - xmin))
          : fast
            ? [0, 0.5, 1].map((t) => xmin + t * (xmax - xmin))
            : [0, 0.22, 0.5, 0.78, 1].map((t) => xmin + t * (xmax - xmin));

    const vxSamples = rndFast
      ? [-MAX_RUN, 0, MAX_RUN]
      : fast
        ? [-MAX_RUN, 0, MAX_RUN]
        : [-MAX_RUN, -MAX_RUN * 0.52, 0, MAX_RUN * 0.52, MAX_RUN];
    const holds = [-1, 0, 1];

    for (let si = 0; si < starts.length; si++) {
      const sx0 = starts[si];
      for (const vx0 of vxSamples) {
        for (const hold of holds) {
          let px = sx0;
          let py = fromP.y - SIM_PH;
          let vx = vx0;
          let vy = 0;
          let onGround = true;
          let coyoteMs = COYOTE_MS;
          let jumpBufMs = JUMP_BUFFER_MS;
          let airTime = 0;

          for (let step = 0; step < maxSteps; step++) {
            const st = simStepFrame(px, py, vx, vy, onGround, coyoteMs, jumpBufMs, hold, pl, SIM_DT, wList);
            px = st.px;
            py = st.py;
            vx = st.vx;
            vy = st.vy;
            onGround = st.onGround;
            coyoteMs = st.coyoteMs;
            jumpBufMs = st.jumpBufMs;

            if (!onGround) airTime += SIM_DT;

            if (onGround && airTime > 0.06) {
              let landed = null;
              const feet = py + SIM_PH;
              for (let pi = 0; pi < pl.length; pi++) {
                const plat = pl[pi];
                if (feet < plat.y - 1.5 || feet > plat.y + 12) continue;
                if (px + SIM_PW <= plat.x + 0.35 || px >= plat.x + plat.w - 0.35) continue;
                landed = plat;
                break;
              }
              if (landed === toP) return true;
              break;
            }

            if (py > H + 140) break;
          }
        }
      }
    }
    return false;
  }

  function graphAdjacentPhysics(pl, i, j, wl) {
    const wList = wl || [];
    if (i === j) return false;
    const A = pl[i];
    const B = pl[j];
    if (walkTouching(A, B)) return true;

    const generous =
      canTraverse(A, B) ||
      canTraverse(B, A) ||
      jumpVerticalStack(A, B) ||
      jumpVerticalStack(B, A);
    const dxc = Math.abs(A.x + A.w * 0.5 - (B.x + B.w * 0.5));
    const dyc = Math.abs(A.y - B.y);
    if (!generous && (dxc > 360 || dyc > 230)) return false;

    return physicsSimReach(pl, A, B, wList) || physicsSimReach(pl, B, A, wList);
  }

  function graphReachable(pl, startIdx, goalIdx, wl) {
    const wList = wl || [];
    const n = pl.length;
    const vis = new Array(n).fill(false);
    const q = [startIdx];
    vis[startIdx] = true;
    for (let qi = 0; qi < q.length; qi++) {
      const i = q[qi];
      if (i === goalIdx) return true;
      for (let j = 0; j < n; j++) {
        if (vis[j]) continue;
        if (graphAdjacentPhysics(pl, i, j, wList)) {
          vis[j] = true;
          q.push(j);
        }
      }
    }
    return false;
  }

  /** Feet-on-surface platform under spawn (same geometry as gameplay spawn). */
  function premadeFindSpawnPlatformIndex(pl, spawn) {
    const pw = 28;
    const ph = 48;
    const feet = spawn.y + ph;
    let best = -1;
    let bestOverlap = -1;
    for (let i = 0; i < pl.length; i++) {
      const p = pl[i];
      if (feet < p.y - 4 || feet > p.y + 14) continue;
      if (spawn.x + pw <= p.x + 0.5 || spawn.x >= p.x + p.w - 0.5) continue;
      const overlap = Math.min(spawn.x + pw, p.x + p.w) - Math.max(spawn.x, p.x);
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        best = i;
      }
    }
    return best;
  }

  /** Platform whose top the goal flag sits on (goal bottom ≈ platform top). */
  function premadeFindGoalPlatformIndex(pl, goal) {
    const cx = goal.x + goal.w * 0.5;
    const goalBottom = goal.y + goal.h;
    for (let i = pl.length - 1; i >= 0; i--) {
      const p = pl[i];
      if (Math.abs(goalBottom - p.y) > 4) continue;
      if (cx >= p.x - 4 && cx <= p.x + p.w + 4) return i;
    }
    return -1;
  }

  /**
   * Validates hand-made campaign stages with the same platform graph + physics sim as procedural gen.
   * Spawn/goal indices are inferred (not always 0 / last). Hazards (spikes, balls) are not simulated.
   */
  function validatePremadeCampaignReachability() {
    const g = H - 40;
    const nPre = premadeStageCount();
    const out = [];
    const savedFast = levelBuildFast;
    const savedRnd = proceduralGenOpts.randomFast;
    levelBuildFast = false;
    proceduralGenOpts.randomFast = false;
    try {
      for (let li = 0; li < nPre; li++) {
        const factory = window.PREMADE_LEVELS[li];
        if (!factory) {
          out.push({ stage: li + 1, ok: false, reason: "missing factory" });
          continue;
        }
        const raw = factory(g);
        const pl = JSON.parse(JSON.stringify(raw.platforms));
        const wl = JSON.parse(JSON.stringify(raw.walls || []));
        for (const plat of pl) {
          if (plat.elev && plat.yBase !== undefined) {
            plat.y = plat.yBase + Math.sin(plat.elev.phase) * plat.elev.amp;
          }
        }
        const si = premadeFindSpawnPlatformIndex(pl, raw.spawn);
        const gi = premadeFindGoalPlatformIndex(pl, raw.goal);
        if (si < 0) {
          out.push({ stage: li + 1, ok: false, reason: "spawn not on a platform" });
          continue;
        }
        if (gi < 0) {
          out.push({ stage: li + 1, ok: false, reason: "goal not aligned to a platform top" });
          continue;
        }
        const graphOk = graphReachable(pl, si, gi, wl);
        const spikeCoverageImpossible = levelHasImpossibleSpikeCoverage(pl, raw.spikes || []);
        const ok = graphOk && !spikeCoverageImpossible;
        out.push({
          stage: li + 1,
          ok,
          graphOk,
          spikeCoverageImpossible,
          spawnPlat: si,
          goalPlat: gi,
        });
      }
    } finally {
      levelBuildFast = savedFast;
      proceduralGenOpts.randomFast = savedRnd;
    }
    return out;
  }

  function playerBounds() {
    return { x: player.x, y: player.y, w: player.w, h: player.h };
  }

  function moveAxisX(dx) {
    if (Math.abs(dx) < 1e-9) return;
    let remaining = dx;
    const sm = PLAYER_MOVE_SUBSTEP;
    while (Math.abs(remaining) > 1e-6) {
      const step = Math.sign(remaining) * Math.min(Math.abs(remaining), sm);
      player.x += step;
      let p = playerBounds();
      for (const plat of platforms) {
        if (!platSolid(plat) || entityHasRot(plat)) continue;
        if (!rectsOverlap(p, plat)) continue;
        if (step > 0) {
          player.x = plat.x - player.w;
        } else if (step < 0) {
          player.x = plat.x + plat.w;
        }
        player.vx = 0;
        p = playerBounds();
      }
      for (const w of walls) {
        if (!wallHazardActive(w) || entityHasRot(w)) continue;
        if (!rectsOverlap(p, w)) continue;
        if (step > 0) {
          player.x = w.x - player.w;
        } else if (step < 0) {
          player.x = w.x + w.w;
        }
        player.vx = 0;
        p = playerBounds();
      }
      remaining -= step;
    }
  }

  function moveAxisY(dy) {
    if (Math.abs(dy) < 1e-9) return;
    let remaining = dy;
    const sm = PLAYER_MOVE_SUBSTEP;
    while (Math.abs(remaining) > 1e-6) {
      const step = Math.sign(remaining) * Math.min(Math.abs(remaining), sm);
      player.y += step;
      let p = playerBounds();
      for (const plat of platforms) {
        if (!platSolid(plat) || entityHasRot(plat)) continue;
        if (!rectsOverlap(p, plat)) continue;
        if (step > 0) {
          player.y = plat.y - player.h;
          player.vy = 0;
        } else if (step < 0) {
          player.y = plat.y + plat.h;
          player.vy = 0;
        }
        p = playerBounds();
      }
      for (const w of walls) {
        if (!wallHazardActive(w) || entityHasRot(w)) continue;
        if (!rectsOverlap(p, w)) continue;
        if (step > 0) {
          player.y = w.y - player.h;
          player.vy = 0;
        } else if (step < 0) {
          player.y = w.y + w.h;
          player.vy = 0;
        }
        p = playerBounds();
      }
      remaining -= step;
    }
  }

  /**
   * Separates the player from axis-aligned platforms/walls when still overlapping after a move.
   * Needed when `moveAxis*` gets dx/dy ≈ 0 (e.g. standing still) but `syncElevatorsCarryPlayer`
   * just pushed the player into a wall — otherwise overlap is never resolved and you tunnel or die.
   */
  function depenetratePlayerVsAxisAlignedSolids() {
    if (state !== "playing") return;
    for (let iter = 0; iter < 10; iter++) {
      let moved = false;
      const solids = [];
      for (const plat of platforms) {
        if (!platSolid(plat) || entityHasRot(plat)) continue;
        solids.push(plat);
      }
      for (const w of walls) {
        if (!wallHazardActive(w) || entityHasRot(w)) continue;
        solids.push(w);
      }
      for (const s of solids) {
        const pb = playerBounds();
        if (!rectsOverlap(pb, s)) continue;
        const ox = Math.min(pb.x + pb.w, s.x + s.w) - Math.max(pb.x, s.x);
        const oy = Math.min(pb.y + pb.h, s.y + s.h) - Math.max(pb.y, s.y);
        if (ox <= 0 || oy <= 0) continue;
        if (ox < oy) {
          const midp = pb.x + pb.w * 0.5;
          const mids = s.x + s.w * 0.5;
          if (midp < mids) player.x = s.x - pb.w;
          else player.x = s.x + s.w;
          player.vx = 0;
        } else {
          const midp = pb.y + pb.h * 0.5;
          const mids = s.y + s.h * 0.5;
          if (midp < mids) {
            player.y = s.y - pb.h;
            if (player.vy > 0) player.vy = 0;
          } else {
            player.y = s.y + s.h;
            if (player.vy < 0) player.vy = 0;
          }
        }
        moved = true;
        break;
      }
      if (!moved) break;
    }
  }

  function circleRectHit(cx, cy, r, rect) {
    const nx = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
    const ny = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
    const dx = cx - nx;
    const dy = cy - ny;
    return dx * dx + dy * dy < r * r;
  }

  function update(dt) {
    if (state !== "playing") return;

    levelTimeSec += dt;
    player.launchBoostMs = Math.max(0, player.launchBoostMs - dt * 1000);
    player.launchUpCoastMs = Math.max(0, player.launchUpCoastMs - dt * 1000);
    syncElevatorsCarryPlayer();
    syncGluedFollowers();
    applyGravSwitchContact();

    const gx = worldGravityX;
    const gy = worldGravityY;
    const tx = gy;
    const ty = -gx;

    const left = keys.has("ArrowLeft") || keys.has("KeyA");
    const right = keys.has("ArrowRight") || keys.has("KeyD");
    player.jumpBufferedMs = Math.max(0, player.jumpBufferedMs - dt * 1000);
    const jumpHeld =
      keys.has("Space") || keys.has("ArrowUp") || keys.has("KeyW");
    if (jumpHeld) {
      player.jumpBufferedMs = JUMP_BUFFER_MS;
    }

    const sluggish = playerInDebuffZone();
    const slippery = groundIsSlippery();
    let moveA = player.onGround ? (slippery ? ICE_MOVE_ACCEL : MOVE_ACCEL) : AIR_ACCEL;
    if (sluggish) {
      moveA *= player.onGround ? DEBUFF_ZONE_MOVE_GROUND_MUL : DEBUFF_ZONE_MOVE_AIR_MUL;
    }

    let vN = player.vx * gx + player.vy * gy;
    let vT = player.vx * tx + player.vy * ty;

    if (left && !right) {
      vT -= moveA * dt;
    } else if (right && !left) {
      vT += moveA * dt;
    } else {
      let f = player.onGround ? (slippery ? ICE_FRICTION : FRICTION) : AIR_FRICTION;
      if (player.launchBoostMs > 0) f *= 0.14;
      const sign = Math.sign(vT);
      const mag = Math.abs(vT);
      const dec = f * dt;
      const next = mag - dec;
      vT = next <= 0 ? 0 : sign * next;
    }

    let vxCap = player.launchBoostMs > 0 ? LAUNCH_VX_CAP : MAX_RUN;
    if (sluggish && player.launchBoostMs <= 0) vxCap *= DEBUFF_ZONE_MAX_RUN_MUL;
    vT = Math.max(-vxCap, Math.min(vxCap, vT));

    if (player.onGround) {
      player.coyoteMs = COYOTE_MS;
    } else {
      player.coyoteMs = Math.max(0, player.coyoteMs - dt * 1000);
    }

    if (player.jumpBufferedMs > 0 && player.coyoteMs > 0) {
      const jmp = sluggish ? Math.abs(JUMP_V) * DEBUFF_ZONE_JUMP_MUL : Math.abs(JUMP_V);
      vN -= jmp;
      player.coyoteMs = 0;
      player.jumpBufferedMs = 0;
    }

    const gravMul = player.launchUpCoastMs > 0 ? 0.36 : 1;
    vN += GRAVITY * dt * gravMul;

    player.vx = gx * vN + tx * vT;
    player.vy = gy * vN + ty * vT;

    const stepX = player.vx * dt;
    const stepY = player.vy * dt;
    moveAxisX(stepX);
    moveAxisY(stepY);
    depenetratePlayerVsAxisAlignedSolids();
    resolvePlayerVsRotatedSolids(10);
    snapPlayerToLiftTops();
    applyLauncherFromContact();

    const spd = Math.hypot(player.vx, player.vy);
    if (spd > 1200) {
      const s = 1200 / spd;
      player.vx *= s;
      player.vy *= s;
    }

    player.onGround = playerGroundedProbe();
    {
      const tun = player.vx * tx + player.vy * ty;
      if (Math.abs(tun) > 30) player.facing = tun > 0 ? 1 : -1;
    }

    const pb = playerBounds();
    for (const w of walls) {
      if (!wallHazardActive(w)) continue;
      if (aabbOverlapsRotatedEntity(pb, w)) {
        player.x = spawn.x;
        player.y = spawn.y;
        player.vx = 0;
        player.vy = 0;
        player.onGround = false;
        player.launchBoostMs = 0;
        player.launchUpCoastMs = 0;
        resetWorldGravity();
        break;
      }
    }

    for (const rb of wreckingBalls) {
      const b = getWreckingBallPos(rb);
      if (circleRectHit(b.x, b.y, rb.r, pb)) {
        player.x = spawn.x;
        player.y = spawn.y;
        player.vx = 0;
        player.vy = 0;
        player.onGround = false;
        player.launchBoostMs = 0;
        player.launchUpCoastMs = 0;
        resetWorldGravity();
        break;
      }
    }

    for (const s of spikes) {
      if (!spikeHazardActive(s)) continue;
      if (aabbOverlapsSpikeStrip(pb, s)) {
        player.x = spawn.x;
        player.y = spawn.y;
        player.vx = 0;
        player.vy = 0;
        player.onGround = false;
        player.launchBoostMs = 0;
        player.launchUpCoastMs = 0;
        resetWorldGravity();
        break;
      }
    }

    if (player.y > H + 72) {
      player.x = spawn.x;
      player.y = spawn.y;
      player.vx = 0;
      player.vy = 0;
      player.launchBoostMs = 0;
      player.launchUpCoastMs = 0;
      resetWorldGravity();
    }

    const pcx = player.x + player.w / 2;

    if (
      entityHasRot(goal)
        ? aabbOverlapsRotatedEntity(playerBounds(), goal)
        : rectsOverlap(playerBounds(), goal)
    ) {
      state = "win";
      overlay.classList.remove("hidden");
      overlayTitle.textContent = "You made it!";
      if (playMode === "custom") {
        overlayMsg.textContent = "Custom level cleared. Press R or Play again to retry.";
        restartBtn.textContent = "Play again";
      } else {
        const nPre = premadeStageCount();
        const cur = campaignLevel + 1;
        if (nPre > 0 && campaignLevel < nPre - 1) {
          overlayMsg.textContent = `Stage ${cur} of ${nPre} cleared. Press R or Next for stage ${cur + 1}.`;
        } else if (nPre > 0 && campaignLevel === nPre - 1) {
          overlayMsg.textContent = `Final campaign stage (${nPre}) cleared. Next: endless procedural levels. Press R or Next.`;
        } else {
          overlayMsg.textContent = `Stage ${cur} cleared. Press R or Next for another run.`;
        }
        restartBtn.textContent = "Next level";
      }
    }

    const targetCam = pcx - W * 0.42;
    camX += (targetCam - camX) * Math.min(1, dt * 6);
    const maxCam = levelMaxX - W + 80;
    camX = Math.max(0, Math.min(maxCam, camX));

    const focusY = player.y + player.h * 0.5;
    let targetCamY = focusY - H * 0.42;
    if (targetCamY > 0) targetCamY = 0;
    camY += (targetCamY - camY) * Math.min(1, dt * 5);
    gameplayClampCamY();
  }

  function drawParallax(offset) {
    const layers = [
      { color: "#161b22", speed: 0.08, h: H },
      { color: "#21262d", speed: 0.15, h: H * 0.75 },
      { color: "#30363d", speed: 0.28, h: H * 0.45 },
    ];
    let yBase = H;
    for (const layer of layers) {
      yBase -= layer.h * 0.15;
      ctx.fillStyle = layer.color;
      const shift = offset * layer.speed;
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let x = -200; x <= W + 200; x += 80) {
        const wx = x + (shift % 160);
        const hill = Math.sin((x + shift) * 0.004) * 24 + Math.sin((x + shift) * 0.011) * 10;
        ctx.lineTo(x, H - layer.h + hill);
      }
      ctx.lineTo(W + 200, H);
      ctx.closePath();
      ctx.fill();
    }
  }

  function draw() {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#0d1117";
    ctx.fillRect(0, 0, W, H);

    drawParallax(camX);

    ctx.translate(-Math.floor(camX), -Math.floor(camY));

    const swSolid = switchPlatformsSolid();
    for (const plat of platforms) {
      ctx.save();
      let bx = plat.x;
      let by = plat.y;
      if (entityHasRot(plat)) {
        ctx.translate(plat.x + plat.w * 0.5, plat.y + plat.h * 0.5);
        ctx.rotate(entityRotRad(plat));
        ctx.translate(-plat.w * 0.5, -plat.h * 0.5);
        bx = 0;
        by = 0;
      }
      if (!platSolid(plat)) {
        if (plat.switch) {
          ctx.globalAlpha = 0.38;
          const g0 = ctx.createLinearGradient(bx, by, bx, by + plat.h);
          g0.addColorStop(0, "#484f58");
          g0.addColorStop(1, "#2d333b");
          ctx.fillStyle = g0;
          ctx.fillRect(bx, by, plat.w, plat.h);
          ctx.strokeStyle = "#8b949e";
          ctx.lineWidth = 2;
          ctx.setLineDash([7, 6]);
          ctx.strokeRect(bx + 1, by + 1, plat.w - 2, plat.h - 2);
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;
        } else {
          ctx.globalAlpha = 0.34;
          ctx.fillStyle = "#3d444d";
          ctx.fillRect(bx, by, plat.w, plat.h);
          ctx.strokeStyle = "#6e7681";
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 5]);
          ctx.strokeRect(bx + 1, by + 1, plat.w - 2, plat.h - 2);
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;
        }
        ctx.restore();
        continue;
      }
      if (plat.switch) {
        const on = swSolid;
        ctx.globalAlpha = on ? 1 : 0.38;
        const g0 = ctx.createLinearGradient(bx, by, bx, by + plat.h);
        if (on) {
          g0.addColorStop(0, "#f0883e");
          g0.addColorStop(0.45, "#db6d28");
          g0.addColorStop(1, "#a04000");
        } else {
          g0.addColorStop(0, "#484f58");
          g0.addColorStop(1, "#2d333b");
        }
        ctx.fillStyle = g0;
        ctx.fillRect(bx, by, plat.w, plat.h);
        ctx.strokeStyle = on ? "#ffdfb5" : "#8b949e";
        ctx.lineWidth = 2;
        ctx.setLineDash(on ? [] : [7, 6]);
        ctx.strokeRect(bx + 1, by + 1, plat.w - 2, plat.h - 2);
        ctx.setLineDash([]);
        if (on) {
          ctx.fillStyle = "rgba(255,255,255,0.22)";
          const stripe = 10;
          for (let sx = bx; sx < bx + plat.w; sx += stripe * 2) {
            ctx.fillRect(sx, by, stripe, plat.h);
          }
        }
        ctx.globalAlpha = 1;
      } else if (plat.elev) {
        const g1 = ctx.createLinearGradient(bx, by, bx, by + plat.h);
        g1.addColorStop(0, "#8957e5");
        g1.addColorStop(0.5, "#6e40c9");
        g1.addColorStop(1, "#4c2889");
        ctx.fillStyle = g1;
        ctx.fillRect(bx, by, plat.w, plat.h);
        ctx.strokeStyle = "#d2a8ff";
        ctx.lineWidth = 2;
        ctx.strokeRect(bx + 1, by + 1, plat.w - 2, plat.h - 2);
        ctx.fillStyle = "rgba(255,255,255,0.18)";
        const chev = 14;
        for (let sx = bx + 4; sx < bx + plat.w - 4; sx += chev) {
          ctx.fillRect(sx + chev * 0.35, by + 4, 3, plat.h - 8);
        }
      } else if (plat.launcher) {
        const kind = plat.launcher.kind ?? "forward";
        let c0 = "#56d364";
        let c1 = "#2ea043";
        let c2 = "#116329";
        let stroke = "#aff5b4";
        if (kind === "backward") {
          c0 = "#f0883e";
          c1 = "#db6d28";
          c2 = "#9a4f12";
          stroke = "#ffdfb5";
        } else if (kind === "up") {
          c0 = "#79c0ff";
          c1 = "#388bfd";
          c2 = "#1158c7";
          stroke = "#c8e1ff";
        }
        const gl = ctx.createLinearGradient(bx, by, bx + plat.w, by + plat.h);
        gl.addColorStop(0, c0);
        gl.addColorStop(0.45, c1);
        gl.addColorStop(1, c2);
        ctx.fillStyle = gl;
        ctx.fillRect(bx, by, plat.w, plat.h);
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 2;
        ctx.strokeRect(bx + 1, by + 1, plat.w - 2, plat.h - 2);
        ctx.fillStyle = "rgba(255,255,255,0.32)";
        const aw = 16;
        const mid = by + plat.h * 0.5;
        if (kind === "up") {
          for (let sx = bx + 10; sx < bx + plat.w - 10; sx += aw) {
            ctx.beginPath();
            ctx.moveTo(sx, mid + 6);
            ctx.lineTo(sx + aw * 0.5, mid - 8);
            ctx.lineTo(sx + aw, mid + 6);
            ctx.closePath();
            ctx.fill();
          }
        } else if (kind === "backward") {
          for (let sx = bx + plat.w - 12; sx > bx + 8; sx -= aw) {
            ctx.beginPath();
            ctx.moveTo(sx, by + plat.h * 0.55);
            ctx.lineTo(sx - aw * 0.55, mid);
            ctx.lineTo(sx, by + plat.h * 0.45);
            ctx.closePath();
            ctx.fill();
          }
        } else {
          for (let sx = bx + 8; sx < bx + plat.w - 10; sx += aw) {
            ctx.beginPath();
            ctx.moveTo(sx, by + plat.h * 0.55);
            ctx.lineTo(sx + aw * 0.55, mid);
            ctx.lineTo(sx, by + plat.h * 0.45);
            ctx.closePath();
            ctx.fill();
          }
        }
      } else if (plat.gravSwitch) {
        const dg = ctx.createLinearGradient(bx, by, bx + plat.w, by + plat.h);
        dg.addColorStop(0, "#1a2a22");
        dg.addColorStop(0.45, "#238636");
        dg.addColorStop(1, "#1f6feb");
        ctx.fillStyle = dg;
        ctx.fillRect(bx, by, plat.w, plat.h);
        ctx.strokeStyle = "#aff5b4";
        ctx.lineWidth = 2;
        ctx.strokeRect(bx + 1, by + 1, plat.w - 2, plat.h - 2);
        const dir = plat.gravSwitch.dir || "d";
        let gdx = 0;
        let gdy = 1;
        if (dir === "u") gdy = -1;
        else if (dir === "l") {
          gdx = -1;
          gdy = 0;
        } else if (dir === "r") {
          gdx = 1;
          gdy = 0;
        }
        const mx = bx + plat.w * 0.5;
        const my = by + plat.h * 0.5;
        const L = Math.min(plat.w, plat.h) * 0.34;
        const bx0 = mx - gdx * L * 0.4;
        const by0 = my - gdy * L * 0.4;
        const tx = mx + gdx * L * 0.55;
        const ty = my + gdy * L * 0.55;
        ctx.strokeStyle = "#f0fff4";
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(bx0, by0);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        const px = -gdy;
        const py = gdx;
        const ah = 7;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(tx - gdx * ah - px * ah * 0.55, ty - gdy * ah - py * ah * 0.55);
        ctx.lineTo(tx - gdx * ah + px * ah * 0.55, ty - gdy * ah + py * ah * 0.55);
        ctx.closePath();
        ctx.fillStyle = "#f0fff4";
        ctx.fill();
      } else if (plat.ice) {
        const gi = ctx.createLinearGradient(bx, by, bx + plat.w, by + plat.h);
        gi.addColorStop(0, "#a5d6ff");
        gi.addColorStop(0.45, "#79c0ff");
        gi.addColorStop(1, "#4a9eff");
        ctx.fillStyle = gi;
        ctx.fillRect(bx, by, plat.w, plat.h);
        ctx.strokeStyle = "rgba(240, 246, 252, 0.75)";
        ctx.lineWidth = 2;
        ctx.strokeRect(bx + 1, by + 1, plat.w - 2, plat.h - 2);
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        for (let sx = bx + 6; sx < bx + plat.w - 4; sx += 11) {
          ctx.fillRect(sx, by + 3, 2, plat.h - 6);
        }
      } else {
        const grad = ctx.createLinearGradient(bx, by, bx, by + plat.h);
        grad.addColorStop(0, "#388bfd");
        grad.addColorStop(1, "#1f6feb");
        ctx.fillStyle = grad;
        ctx.fillRect(bx, by, plat.w, plat.h);
        ctx.strokeStyle = "#79b8ff";
        ctx.lineWidth = 2;
        ctx.strokeRect(bx + 1, by + 1, plat.w - 2, plat.h - 2);
      }
      ctx.restore();
    }

    for (const s of spikes) {
      if (!spikeHazardActive(s)) continue;
      const poly = spikeWorldCorners(s);
      if (!poly || poly.length < 4) continue;
      const triW = 12;
      const outerA = poly[0];
      const outerB = poly[1];
      const innerB = poly[2];
      const innerA = poly[3];
      const baseLen = Math.hypot(innerB.x - innerA.x, innerB.y - innerA.y);
      ctx.fillStyle = "#6e7681";
      ctx.strokeStyle = "#21262d";
      ctx.lineWidth = 1;
      for (let u = 0; u < baseLen - 2; u += triW * 0.88) {
        const t0 = u / baseLen;
        const t1 = Math.min(u + triW, baseLen) / baseLen;
        const ax = innerA.x + (innerB.x - innerA.x) * t0;
        const ay = innerA.y + (innerB.y - innerA.y) * t0;
        const bx = innerA.x + (innerB.x - innerA.x) * t1;
        const by = innerA.y + (innerB.y - innerA.y) * t1;
        const oax = outerA.x + (outerB.x - outerA.x) * t0;
        const oay = outerA.y + (outerB.y - outerA.y) * t0;
        const obx = outerA.x + (outerB.x - outerA.x) * t1;
        const oby = outerA.y + (outerB.y - outerA.y) * t1;
        const outerMx = (oax + obx) * 0.5;
        const outerMy = (oay + oby) * 0.5;
        const tipx = outerMx;
        const tipy = outerMy;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.lineTo(tipx, tipy);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }

    for (const z of debuffZones) {
      ctx.save();
      let zx = z.x;
      let zy = z.y;
      if (entityHasRot(z)) {
        ctx.translate(z.x + z.w * 0.5, z.y + z.h * 0.5);
        ctx.rotate(entityRotRad(z));
        ctx.translate(-z.w * 0.5, -z.h * 0.5);
        zx = 0;
        zy = 0;
      }
      const g0 = ctx.createLinearGradient(zx, zy, zx + z.w, zy + z.h);
      g0.addColorStop(0, "rgba(130, 80, 200, 0.22)");
      g0.addColorStop(0.5, "rgba(90, 50, 160, 0.3)");
      g0.addColorStop(1, "rgba(70, 35, 130, 0.24)");
      ctx.fillStyle = g0;
      ctx.fillRect(zx, zy, z.w, z.h);
      ctx.strokeStyle = "rgba(190, 150, 255, 0.45)";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 5]);
      ctx.strokeRect(zx + 1, zy + 1, z.w - 2, z.h - 2);
      ctx.setLineDash([]);
      ctx.restore();
    }

    for (const w of walls) {
      if (!wallHazardActive(w)) continue;
      ctx.save();
      let wx0 = w.x;
      let wy0 = w.y;
      if (entityHasRot(w)) {
        ctx.translate(w.x + w.w * 0.5, w.y + w.h * 0.5);
        ctx.rotate(entityRotRad(w));
        ctx.translate(-w.w * 0.5, -w.h * 0.5);
        wx0 = 0;
        wy0 = 0;
      }
      const wg = ctx.createLinearGradient(wx0, wy0, wx0 + w.w, wy0 + w.h);
      wg.addColorStop(0, "#8b1538");
      wg.addColorStop(0.5, "#5c0d26");
      wg.addColorStop(1, "#3d0918");
      ctx.fillStyle = wg;
      ctx.fillRect(wx0, wy0, w.w, w.h);
      ctx.strokeStyle = "#ff7b72";
      ctx.lineWidth = 2;
      ctx.strokeRect(wx0 + 1, wy0 + 1, w.w - 2, w.h - 2);
      ctx.fillStyle = "rgba(255, 123, 114, 0.22)";
      const stripe = 7;
      for (let sy = wy0 + 4; sy < wy0 + w.h - 4; sy += stripe * 2) {
        ctx.fillRect(wx0 + 3, sy, w.w - 6, stripe);
      }
      ctx.restore();
    }

    for (const rb of wreckingBalls) {
      const pv = getWreckingBallPivot(rb);
      const b = getWreckingBallPos(rb);
      ctx.strokeStyle = "#484f58";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(pv.x, pv.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      const rg = ctx.createRadialGradient(
        b.x - rb.r * 0.35,
        b.y - rb.r * 0.35,
        rb.r * 0.15,
        b.x,
        b.y,
        rb.r,
      );
      rg.addColorStop(0, "#8b949e");
      rg.addColorStop(0.55, "#484f58");
      rg.addColorStop(1, "#21262d");
      ctx.beginPath();
      ctx.arc(b.x, b.y, rb.r, 0, Math.PI * 2);
      ctx.fillStyle = rg;
      ctx.fill();
      ctx.strokeStyle = "#f0f6fc";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.save();
    let gx0 = goal.x;
    let gy0 = goal.y;
    if (entityHasRot(goal)) {
      ctx.translate(goal.x + goal.w * 0.5, goal.y + goal.h * 0.5);
      ctx.rotate(entityRotRad(goal));
      ctx.translate(-goal.w * 0.5, -goal.h * 0.5);
      gx0 = 0;
      gy0 = 0;
    }
    ctx.fillStyle = "#3fb950";
    ctx.fillRect(gx0, gy0, goal.w, goal.h);
    ctx.fillStyle = "#56d364";
    ctx.fillRect(gx0 + 6, gy0 + 8, goal.w - 12, 10);
    ctx.strokeStyle = "#aff5b4";
    ctx.lineWidth = 2;
    ctx.strokeRect(gx0, gy0, goal.w, goal.h);
    ctx.restore();

    const px = player.x;
    const py = player.y;
    const bodyGrad = ctx.createLinearGradient(px, py, px + player.w, py + player.h);
    bodyGrad.addColorStop(0, "#a371f7");
    bodyGrad.addColorStop(1, "#8957e5");
    ctx.fillStyle = bodyGrad;
    ctx.fillRect(px, py, player.w, player.h);
    ctx.strokeStyle = "#d2a8ff";
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 1, py + 1, player.w - 2, player.h - 2);

    const eyeX = px + (player.facing > 0 ? 16 : 6);
    ctx.fillStyle = "#f0f6fc";
    ctx.fillRect(eyeX, py + 14, 8, 8);
    ctx.fillStyle = "#0d1117";
    ctx.fillRect(eyeX + (player.facing > 0 ? 3 : 2), py + 16, 4, 4);

    ctx.restore();
  }

  let last = performance.now();

  function cloneLevelSpec(s) {
    return JSON.parse(JSON.stringify(s));
  }

  function defaultEditorLevelSpec() {
    const g = H - 40;
    return {
      platforms: [
        { x: 0, y: g, w: 260, h: 40 },
        { x: 300, y: g - 90, w: 140, h: 22 },
        { x: 500, y: g - 150, w: 160, h: 22 },
      ],
      walls: [],
      wreckingBalls: [],
      spikes: [],
      debuffZones: [],
      goal: { x: 640, y: g - 150 - 48, w: 32, h: 48 },
      spawn: { x: 40, y: g - 48 },
    };
  }

  function persistEditorDraft() {
    if (!editorDraftSpec) return;
    try {
      localStorage.setItem(CUSTOM_LEVEL_STORAGE_KEY, JSON.stringify(editorDraftSpec));
    } catch (_) {}
  }

  function normalizeImportedSpec(obj) {
    const g = H - 40;
    if (!obj || typeof obj !== "object") return null;
    if (!Array.isArray(obj.platforms) || obj.platforms.length === 0) return null;
    return {
      platforms: obj.platforms,
      walls: Array.isArray(obj.walls) ? obj.walls : [],
      wreckingBalls: Array.isArray(obj.wreckingBalls) ? obj.wreckingBalls : [],
      spikes: Array.isArray(obj.spikes) ? obj.spikes : [],
      debuffZones: Array.isArray(obj.debuffZones) ? obj.debuffZones : [],
      goal:
        obj.goal && typeof obj.goal.x === "number"
          ? { ...obj.goal, w: obj.goal.w ?? 32, h: obj.goal.h ?? 48 }
          : { x: 400, y: g - 100, w: 32, h: 48 },
      spawn:
        obj.spawn && typeof obj.spawn.x === "number"
          ? { x: obj.spawn.x, y: obj.spawn.y }
          : { x: 40, y: g - 48 },
    };
  }

  function loadEditorDraft() {
    try {
      const raw = localStorage.getItem(CUSTOM_LEVEL_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const n = normalizeImportedSpec(parsed);
        if (n) {
          editorDraftSpec = cloneLevelSpec(n);
          return;
        }
      }
    } catch (_) {}
    editorDraftSpec = defaultEditorLevelSpec();
  }

  const EDITOR_GRID = 8;
  const EDITOR_SCALE_EDGE = 14;
  const EDITOR_MIN_SCALED_W = 24;
  const EDITOR_MIN_SCALED_H = 16;
  const EDITOR_MAX_SCALED_DIM = 3600;
  /** Right edge used only for editor camera pan — lets you build past current content without placing filler. */
  const EDITOR_PAN_MIN_MAX_X = 4200;

  function snapEditor(v) {
    return Math.round(v / EDITOR_GRID) * EDITOR_GRID;
  }

  function canvasWorldPoint(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    const scaleX = W / r.width;
    const scaleY = H / r.height;
    return {
      wx: (clientX - r.left) * scaleX + camX,
      wy: (clientY - r.top) * scaleY + camY,
    };
  }

  function editorApplyDraftToWorld() {
    if (!editorDraftSpec) return;
    applyRawLevelSpec(editorDraftSpec);
    player.x = spawn.x;
    player.y = spawn.y;
    player.vx = 0;
    player.vy = 0;
  }

  function hideLevelEditorUi() {
    editorActive = false;
    editorMiddlePanning = false;
    gluePending = null;
    if (editorDrag) editorFinishMoveDrag();
    if (editorScaleDrag) editorFinishScaleDrag();
    resetEditorToolboxLayout();
    if (levelEditorEl) levelEditorEl.classList.add("hidden");
  }

  function editorClampCamX() {
    const panMaxX = Math.max(levelMaxX, EDITOR_PAN_MIN_MAX_X);
    const maxCam = Math.max(0, panMaxX - W + 80);
    camX = Math.max(0, Math.min(maxCam, camX));
  }

  function levelWorldVerticalBounds() {
    let top = H;
    let bot = 0;
    for (const p of platforms) {
      top = Math.min(top, p.y);
      bot = Math.max(bot, p.y + p.h);
    }
    for (const w of walls) {
      top = Math.min(top, w.y);
      bot = Math.max(bot, w.y + w.h);
    }
    for (const s of spikes) {
      const rr = spikeWorldRect(s);
      if (rr.w > 0) {
        top = Math.min(top, rr.y);
        bot = Math.max(bot, rr.y + rr.h);
      }
    }
    for (const rb of wreckingBalls) {
      const piv = getWreckingBallPivot(rb);
      const swing = rb.ropeLen + rb.r;
      top = Math.min(top, piv.y - swing);
      bot = Math.max(bot, piv.y + swing);
    }
    for (const z of debuffZones) {
      const aa = entityWorldAabb(z);
      top = Math.min(top, aa.y);
      bot = Math.max(bot, aa.y + aa.h);
    }
    if (goal && goal.w) {
      const aa = entityWorldAabb(goal);
      top = Math.min(top, aa.y);
      bot = Math.max(bot, aa.y + aa.h);
    }
    if (spawn) {
      top = Math.min(top, spawn.y);
      bot = Math.max(bot, spawn.y + player.h);
    }
    if (top > bot) return { top: 0, bot: H };
    return { top, bot };
  }

  function editorClampCamY() {
    const { top, bot } = levelWorldVerticalBounds();
    const margin = 100;
    const minCamY = Math.min(0, top - margin);
    const maxCamY = Math.max(minCamY, bot + margin - H);
    camY = Math.max(minCamY, Math.min(maxCamY, camY));
  }

  /** Clamp vertical camera during play (same bounds as editor pan). */
  function gameplayClampCamY() {
    const { top, bot } = levelWorldVerticalBounds();
    const margin = 100;
    const minCamY = Math.min(0, top - margin);
    const maxCamY = Math.max(minCamY, bot + margin - H);
    camY = Math.max(minCamY, Math.min(maxCamY, camY));
  }

  function exitEditorToModeMenu() {
    persistEditorDraft();
    hideLevelEditorUi();
    showModeMenu();
  }

  function setEditorPlaceKind(kind) {
    if (editorScaleDrag) editorFinishScaleDrag();
    editorPlaceKind = kind;
    if (!levelEditorEl) return;
    levelEditorEl.querySelectorAll("[data-place-kind]").forEach((b) => {
      b.classList.toggle("active", b.getAttribute("data-place-kind") === kind);
    });
  }

  function editorDraftPlatSurfaceY(plats, plat) {
    if (!plat) return 0;
    if (plat.elev && plat.yBase !== undefined) {
      return elevPlatSurfaceYAt(plat, levelTimeSec);
    }
    return plat.y;
  }

  /** Parent position for glue offsets — use live `platforms` so elevators match `syncElevatorsCarryPlayer`. */
  function editorGlueParentAnchorPx(parentIdx) {
    const live = platforms[parentIdx];
    if (live) return { x: live.x, y: live.y };
    const d = editorDraftSpec?.platforms[parentIdx];
    if (d) return { x: d.x, y: d.y };
    return null;
  }

  function editorDraftSpikeWorldRect(plats, s) {
    const plat = plats[s.platIdx];
    if (!plat) return null;
    const poly = spikeCornersForPlat(plat, s);
    if (!poly) return null;
    let mnX = Infinity;
    let mnY = Infinity;
    let mxX = -Infinity;
    let mxY = -Infinity;
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i];
      mnX = Math.min(mnX, p.x);
      mnY = Math.min(mnY, p.y);
      mxX = Math.max(mxX, p.x);
      mxY = Math.max(mxY, p.y);
    }
    return { x: mnX, y: mnY, w: mxX - mnX, h: mxY - mnY };
  }

  function editorDraftRbPivot(plats, rb) {
    const plat = plats[rb.platIdx];
    if (!plat) return { x: 0, y: 0 };
    const topY = editorDraftPlatSurfaceY(plats, plat);
    return {
      x: plat.x + plat.w * 0.5 + rb.relOffX,
      y: topY + rb.relOffY,
    };
  }

  function editorDraftRbBallPos(plats, rb, tSec) {
    const p = editorDraftRbPivot(plats, rb);
    const ang = rb.swingRad * Math.sin(tSec * rb.omega + rb.phase);
    const sr = entityRotRad(rb);
    const sa = Math.sin(ang);
    const ca = Math.cos(ang);
    const vx = sa * Math.cos(sr) - ca * Math.sin(sr);
    const vy = sa * Math.sin(sr) + ca * Math.cos(sr);
    return {
      x: p.x + vx * rb.ropeLen,
      y: p.y + vy * rb.ropeLen,
    };
  }

  function editorFindPlatformIndex(wx, wy) {
    const plats = editorDraftSpec.platforms;
    for (let i = plats.length - 1; i >= 0; i--) {
      const p = plats[i];
      if (entityHasRot(p)) {
        if (pointInRotRect(wx, wy, p)) return i;
        continue;
      }
      const top = editorDraftPlatSurfaceY(plats, p);
      if (wx >= p.x && wx <= p.x + p.w && wy >= top && wy <= top + p.h) return i;
    }
    return -1;
  }

  function distPointToSegmentSq(px, py, ax, ay, bx, by) {
    const abx = bx - ax;
    const aby = by - ay;
    const apx = px - ax;
    const apy = py - ay;
    const abLenSq = abx * abx + aby * aby;
    if (abLenSq < 1e-12) return apx * apx + apy * apy;
    let t = (apx * abx + apy * aby) / abLenSq;
    t = Math.max(0, Math.min(1, t));
    const qx = ax + abx * t;
    const qy = ay + aby * t;
    const dx = px - qx;
    const dy = py - qy;
    return dx * dx + dy * dy;
  }

  /** Platform top under the cursor for placing spikes (world space). */
  function editorFindPlatformForSpike(wx, wy) {
    const plats = editorDraftSpec.platforms;
    const tol = 22;
    const tolSq = tol * tol;
    for (let i = plats.length - 1; i >= 0; i--) {
      const p = plats[i];
      if (entityHasRot(p)) {
        const a = platLocalPointToWorld(p, 0, 0);
        const b = platLocalPointToWorld(p, p.w, 0);
        if (distPointToSegmentSq(wx, wy, a.x, a.y, b.x, b.y) <= tolSq) return i;
        continue;
      }
      if (wx < p.x || wx > p.x + p.w) continue;
      const top = editorDraftPlatSurfaceY(plats, p);
      if (wy >= top - 14 && wy <= top + p.h + 8) return i;
    }
    return -1;
  }

  /** Attach wrecking ball pivot near click (wx, wy). */
  function editorFindPlatformForBall(wx, wy) {
    const plats = editorDraftSpec.platforms;
    let best = -1;
    let bestScore = 1e9;
    for (let i = 0; i < plats.length; i++) {
      const p = plats[i];
      if (wx < p.x - 30 || wx > p.x + p.w + 30) continue;
      const top = editorDraftPlatSurfaceY(plats, p);
      if (wy > top + 50) continue;
      if (wy < top - 240) continue;
      const score = Math.abs(wy - top) + Math.abs(wx - (p.x + p.w * 0.5)) * 0.15;
      if (score < bestScore) {
        bestScore = score;
        best = i;
      }
    }
    return best;
  }

  /**
   * @param {"hazardsFirst"|"platformsFirst"} [pickOrder]
   *   hazardsFirst — balls/spikes win when overlapping (Erase, precise hazard clicks).
   *   platformsFirst — platforms win over balls/spikes (Move / Scale / Rotate on tiles under hazards).
   */
  function editorMovePickupAt(wx, wy, pickOrder = "hazardsFirst") {
    const plats = editorDraftSpec.platforms;
    const tHit = levelTimeSec;

    function pickBall() {
      for (let i = editorDraftSpec.wreckingBalls.length - 1; i >= 0; i--) {
        const rb = editorDraftSpec.wreckingBalls[i];
        const b = editorDraftRbBallPos(plats, rb, tHit);
        const dx = wx - b.x;
        const dy = wy - b.y;
        if (dx * dx + dy * dy <= (rb.r + 10) * (rb.r + 10)) return { type: "ball", idx: i };
      }
      return null;
    }
    function pickSpike() {
      for (let i = editorDraftSpec.spikes.length - 1; i >= 0; i--) {
        const s = editorDraftSpec.spikes[i];
        const plat = plats[s.platIdx];
        const poly = spikeCornersForPlat(plat, s);
        if (poly && pointInConvexPolyQuad(wx, wy, poly)) return { type: "spike", idx: i };
      }
      return null;
    }
    function pickDebuff() {
      const dz = editorDraftSpec.debuffZones;
      if (dz && dz.length) {
        for (let i = dz.length - 1; i >= 0; i--) {
          const z = dz[i];
          if (entityHasRot(z)) {
            if (pointInRotRect(wx, wy, z)) return { type: "debuff", idx: i };
          } else if (wx >= z.x && wx <= z.x + z.w && wy >= z.y && wy <= z.y + z.h) {
            return { type: "debuff", idx: i };
          }
        }
      }
      return null;
    }
    function pickWall() {
      for (let i = editorDraftSpec.walls.length - 1; i >= 0; i--) {
        const w = editorDraftSpec.walls[i];
        if (pointInRotRect(wx, wy, w)) return { type: "wall", idx: i };
      }
      return null;
    }
    function pickGoal() {
      if (editorDraftSpec.goal && editorDraftSpec.goal.w) {
        const g = editorDraftSpec.goal;
        if (entityHasRot(g)) {
          if (pointInRotRect(wx, wy, g)) return { type: "goal" };
        } else if (wx >= g.x && wx <= g.x + g.w && wy >= g.y && wy <= g.y + g.h) return { type: "goal" };
      }
      return null;
    }
    function pickSpawn() {
      if (editorDraftSpec.spawn) {
        const sp = editorDraftSpec.spawn;
        if (wx >= sp.x && wx <= sp.x + player.w && wy >= sp.y && wy <= sp.y + player.h) return { type: "spawn" };
      }
      return null;
    }
    function pickPlatform() {
      const pIdx = editorFindPlatformIndex(wx, wy);
      return pIdx >= 0 ? { type: "platform", idx: pIdx } : null;
    }

    if (pickOrder === "platformsFirst") {
      return (
        pickSpawn() ||
        pickGoal() ||
        pickWall() ||
        pickDebuff() ||
        pickPlatform() ||
        pickSpike() ||
        pickBall()
      );
    }

    const b = pickBall();
    if (b) return b;
    const sp = pickSpike();
    if (sp) return sp;
    const db = pickDebuff();
    if (db) return db;
    const w = pickWall();
    if (w) return w;
    const g = pickGoal();
    if (g) return g;
    const s = pickSpawn();
    if (s) return s;
    return pickPlatform();
  }

  function editorScaleEdgeNear(wx, wy, rect) {
    const { x, y, w, h } = rect;
    const M = EDITOR_SCALE_EDGE;
    const right = x + w;
    const bottom = y + h;
    const onL = wx >= x - M && wx <= x + M;
    const onR = wx >= right - M && wx <= right + M;
    const onT = wy >= y - M && wy <= y + M;
    const onB = wy >= bottom - M && wy <= bottom + M;
    const inH = wx >= x && wx <= right;
    const inV = wy >= y && wy <= bottom;
    if (onT && onL && inH && inV) return "nw";
    if (onT && onR && inH && inV) return "ne";
    if (onB && onL && inH && inV) return "sw";
    if (onB && onR && inH && inV) return "se";
    if (onT && inH) return "n";
    if (onB && inH) return "s";
    if (onL && inV) return "w";
    if (onR && inV) return "e";
    return null;
  }

  function editorGetScalableRect(pick) {
    if (!editorDraftSpec || !pick) return null;
    const plats = editorDraftSpec.platforms;
    if (pick.type === "platform") {
      const p = plats[pick.idx];
      if (!p || entityHasRot(p)) return null;
      const top = editorDraftPlatSurfaceY(plats, p);
      return { x: p.x, y: top, w: p.w, h: p.h };
    }
    if (pick.type === "wall") {
      const w = editorDraftSpec.walls[pick.idx];
      if (!w || entityHasRot(w)) return null;
      return { x: w.x, y: w.y, w: w.w, h: w.h };
    }
    if (pick.type === "debuff") {
      const z = editorDraftSpec.debuffZones[pick.idx];
      if (!z) return null;
      return { x: z.x, y: z.y, w: z.w, h: z.h };
    }
    if (pick.type === "goal") {
      const g = editorDraftSpec.goal;
      if (!g || !g.w) return null;
      return { x: g.x, y: g.y, w: g.w, h: g.h };
    }
    if (pick.type === "spike") {
      const s = editorDraftSpec.spikes[pick.idx];
      if (!s) return null;
      const r = editorDraftSpikeWorldRect(plats, s);
      if (!r || r.w <= 0) return null;
      return { x: r.x, y: r.y, w: r.w, h: r.h };
    }
    if (pick.type === "ball") {
      const rb = editorDraftSpec.wreckingBalls[pick.idx];
      if (!rb) return null;
      const b = editorDraftRbBallPos(plats, rb, levelTimeSec);
      const d = rb.r * 2;
      return { x: b.x - rb.r, y: b.y - rb.r, w: d, h: d };
    }
    return null;
  }

  function editorComputeScaledRect(orig, edge, wx, wy) {
    const ox = orig.x;
    const oy = orig.y;
    const ow = orig.w;
    const oh = orig.h;
    const right = ox + ow;
    const bottom = oy + oh;
    const MIN_W = EDITOR_MIN_SCALED_W;
    const MIN_H = EDITOR_MIN_SCALED_H;
    const MAX_D = EDITOR_MAX_SCALED_DIM;
    const clampW = (v) => Math.max(MIN_W, Math.min(MAX_D, v));
    const clampH = (v) => Math.max(MIN_H, Math.min(MAX_D, v));
    let x = ox;
    let y = oy;
    let w = ow;
    let h = oh;

    switch (edge) {
      case "e":
        w = clampW(snapEditor(wx - ox));
        break;
      case "w": {
        const nx = snapEditor(wx);
        w = clampW(right - nx);
        x = right - w;
        break;
      }
      case "s":
        h = clampH(snapEditor(wy - oy));
        break;
      case "n": {
        const ny = snapEditor(wy);
        h = clampH(bottom - ny);
        y = bottom - h;
        break;
      }
      case "se":
        w = clampW(snapEditor(wx - ox));
        h = clampH(snapEditor(wy - oy));
        break;
      case "nw": {
        const nx = snapEditor(wx);
        const ny = snapEditor(wy);
        w = clampW(right - nx);
        h = clampH(bottom - ny);
        x = right - w;
        y = bottom - h;
        break;
      }
      case "ne": {
        w = clampW(snapEditor(wx - ox));
        h = clampH(bottom - snapEditor(wy));
        y = bottom - h;
        break;
      }
      case "sw": {
        const nx = snapEditor(wx);
        w = clampW(right - nx);
        h = clampH(snapEditor(wy - oy));
        x = right - w;
        break;
      }
      default:
        return null;
    }
    return { x, y, w, h };
  }

  function editorClampSpikesOnPlatform(pi) {
    const plats = editorDraftSpec.platforms;
    const plat = plats[pi];
    if (!plat) return;
    for (const s of editorDraftSpec.spikes) {
      if (s.platIdx !== pi) continue;
      s.relX = Math.max(6, Math.min(s.relX, plat.w - s.w - 6));
    }
  }

  function editorApplyRectToScaledPick(pick, r) {
    if (!editorDraftSpec || !pick || !r) return;
    const plats = editorDraftSpec.platforms;
    if (pick.type === "platform") {
      const p = plats[pick.idx];
      if (!p) return;
      p.x = r.x;
      p.w = r.w;
      p.h = r.h;
      if (p.elev && p.yBase !== undefined) {
        p.yBase = r.y - Math.sin(levelTimeSec * p.elev.omega + p.elev.phase) * p.elev.amp;
        p.y = p.yBase + Math.sin(levelTimeSec * p.elev.omega + p.elev.phase) * p.elev.amp;
      } else {
        p.y = r.y;
      }
      editorClampSpikesOnPlatform(pick.idx);
    } else if (pick.type === "wall") {
      const wall = editorDraftSpec.walls[pick.idx];
      if (!wall) return;
      wall.x = r.x;
      wall.y = r.y;
      wall.w = r.w;
      wall.h = r.h;
    } else if (pick.type === "debuff") {
      const z = editorDraftSpec.debuffZones[pick.idx];
      if (!z) return;
      z.x = r.x;
      z.y = r.y;
      z.w = r.w;
      z.h = r.h;
    } else if (pick.type === "goal") {
      const g = editorDraftSpec.goal;
      if (!g) return;
      g.x = r.x;
      g.y = r.y;
      g.w = r.w;
      g.h = r.h;
    } else if (pick.type === "spike") {
      const s = editorDraftSpec.spikes[pick.idx];
      const plat = plats[s.platIdx];
      if (!s || !plat) return;
      let relX = snapEditor(r.x - plat.x);
      let nw = snapEditor(r.w);
      let spikeH = snapEditor(r.h);
      nw = Math.max(EDITOR_MIN_SCALED_W, Math.min(EDITOR_MAX_SCALED_DIM, nw));
      spikeH = Math.max(8, Math.min(160, spikeH));
      relX = Math.max(6, Math.min(relX, plat.w - nw - 6));
      s.relX = relX;
      s.w = nw;
      s.h = spikeH;
    } else if (pick.type === "ball") {
      const rb = editorDraftSpec.wreckingBalls[pick.idx];
      if (!rb) return;
      const nr = Math.max(6, Math.min(120, snapEditor(Math.min(r.w, r.h) * 0.5)));
      rb.r = nr;
    }
  }

  function editorApplyScaleDrag(clientX, clientY) {
    if (!editorScaleDrag || !editorDraftSpec) return;
    if (!editorPointerIsAboveToolbox(clientX, clientY)) return;
    const { wx, wy } = canvasWorldPoint(clientX, clientY);
    const { pick, edge, orig } = editorScaleDrag;
    const next = editorComputeScaledRect(orig, edge, wx, wy);
    if (!next) return;
    editorApplyRectToScaledPick(pick, next);
    editorApplyDraftToWorld();
    syncGluedFollowers();
  }

  function editorFinishScaleDrag() {
    if (!editorScaleDrag) return;
    const pick = editorScaleDrag.pick;
    editorScaleDrag = null;
    editorRefreshGlueRelAfterMove(pick);
    editorClampCamX();
    editorClampCamY();
    persistEditorDraft();
  }

  function editorBeginScale(pick, edge, origRect) {
    editorScaleDrag = { pick, edge, orig: { ...origRect } };
  }

  function editorBeginMove(wx, wy, pick) {
    const plats = editorDraftSpec.platforms;
    const base = { pick, startWx: wx, startWy: wy };
    if (pick.type === "platform") {
      const p = plats[pick.idx];
      Object.assign(base, { origX: p.x, origY: p.y });
    } else if (pick.type === "wall") {
      const w = editorDraftSpec.walls[pick.idx];
      Object.assign(base, { origX: w.x, origY: w.y });
    } else if (pick.type === "debuff") {
      const z = editorDraftSpec.debuffZones[pick.idx];
      Object.assign(base, { origX: z.x, origY: z.y });
    } else if (pick.type === "spawn") {
      const s = editorDraftSpec.spawn;
      Object.assign(base, { origX: s.x, origY: s.y });
    } else if (pick.type === "goal") {
      const g = editorDraftSpec.goal;
      Object.assign(base, { origX: g.x, origY: g.y });
    } else if (pick.type === "ball") {
      const rb = editorDraftSpec.wreckingBalls[pick.idx];
      Object.assign(base, { origRelOffX: rb.relOffX, origRelOffY: rb.relOffY });
    } else if (pick.type === "spike") {
      const s = editorDraftSpec.spikes[pick.idx];
      Object.assign(base, { origRelX: s.relX });
    }
    editorDrag = base;
  }

  function editorApplyMoveDrag(clientX, clientY) {
    if (!editorDrag || !editorDraftSpec) return;
    if (!editorPointerIsAboveToolbox(clientX, clientY)) return;
    const { wx, wy } = canvasWorldPoint(clientX, clientY);
    const dwx = wx - editorDrag.startWx;
    const dwy = wy - editorDrag.startWy;
    const plats = editorDraftSpec.platforms;
    const pick = editorDrag.pick;
    if (pick.type === "platform") {
      const p = plats[pick.idx];
      p.x = snapEditor(editorDrag.origX + dwx);
      p.y = snapEditor(editorDrag.origY + dwy);
      if (p.yBase !== undefined) p.yBase = p.y;
    } else if (pick.type === "wall") {
      const w = editorDraftSpec.walls[pick.idx];
      w.x = snapEditor(editorDrag.origX + dwx);
      w.y = snapEditor(editorDrag.origY + dwy);
    } else if (pick.type === "debuff") {
      const z = editorDraftSpec.debuffZones[pick.idx];
      z.x = snapEditor(editorDrag.origX + dwx);
      z.y = snapEditor(editorDrag.origY + dwy);
    } else if (pick.type === "spawn") {
      editorDraftSpec.spawn.x = snapEditor(editorDrag.origX + dwx);
      editorDraftSpec.spawn.y = snapEditor(editorDrag.origY + dwy);
    } else if (pick.type === "goal") {
      editorDraftSpec.goal.x = snapEditor(editorDrag.origX + dwx);
      editorDraftSpec.goal.y = snapEditor(editorDrag.origY + dwy);
    } else if (pick.type === "ball") {
      const rb = editorDraftSpec.wreckingBalls[pick.idx];
      rb.relOffX = Math.round(snapEditor(editorDrag.origRelOffX + dwx));
      rb.relOffY = Math.round(snapEditor(editorDrag.origRelOffY + dwy));
    } else if (pick.type === "spike") {
      const s = editorDraftSpec.spikes[pick.idx];
      const plat = plats[s.platIdx];
      if (!plat) return;
      const newRel = snapEditor(editorDrag.origRelX + dwx);
      s.relX = Math.max(6, Math.min(newRel, plat.w - s.w - 6));
    }
    editorApplyDraftToWorld();
  }

  function editorFinishMoveDrag() {
    if (!editorDrag) return;
    const pick = editorDrag.pick;
    editorDrag = null;
    editorRefreshGlueRelAfterMove(pick);
    editorClampCamX();
    editorClampCamY();
    persistEditorDraft();
  }

  function editorEraseAt(wx, wy) {
    const plats = editorDraftSpec.platforms;
    const tHit = levelTimeSec;
    for (let i = editorDraftSpec.wreckingBalls.length - 1; i >= 0; i--) {
      const rb = editorDraftSpec.wreckingBalls[i];
      const b = editorDraftRbBallPos(plats, rb, tHit);
      const dx = wx - b.x;
      const dy = wy - b.y;
      if (dx * dx + dy * dy <= (rb.r + 10) * (rb.r + 10)) {
        editorDraftSpec.wreckingBalls.splice(i, 1);
        return;
      }
    }
    for (let i = editorDraftSpec.spikes.length - 1; i >= 0; i--) {
      const s = editorDraftSpec.spikes[i];
      const plat = plats[s.platIdx];
      const poly = spikeCornersForPlat(plat, s);
      if (poly && pointInConvexPolyQuad(wx, wy, poly)) {
        editorDraftSpec.spikes.splice(i, 1);
        return;
      }
    }
    if (editorDraftSpec.debuffZones && editorDraftSpec.debuffZones.length) {
      for (let i = editorDraftSpec.debuffZones.length - 1; i >= 0; i--) {
        const z = editorDraftSpec.debuffZones[i];
        const hit = entityHasRot(z)
          ? pointInRotRect(wx, wy, z)
          : wx >= z.x && wx <= z.x + z.w && wy >= z.y && wy <= z.y + z.h;
        if (hit) {
          editorDraftSpec.debuffZones.splice(i, 1);
          return;
        }
      }
    }
    for (let i = editorDraftSpec.walls.length - 1; i >= 0; i--) {
      const w = editorDraftSpec.walls[i];
      if (pointInRotRect(wx, wy, w)) {
        editorDraftSpec.walls.splice(i, 1);
        return;
      }
    }
    const pIdx = editorFindPlatformIndex(wx, wy);
    if (pIdx >= 0) {
      editorDraftSpec.platforms.splice(pIdx, 1);
      if (editorDraftSpec.platforms.length === 0) {
        const g = H - 40;
        editorDraftSpec.platforms.push({ x: 0, y: g, w: 120, h: 40 });
      }
      editorReindexHazardsAfterPlatformDelete(pIdx);
    }
  }

  function editorReindexHazardsAfterPlatformDelete(removedIdx) {
    editorDraftSpec.wreckingBalls = editorDraftSpec.wreckingBalls
      .filter((rb) => rb.platIdx !== removedIdx)
      .map((rb) => ({
        ...rb,
        platIdx: rb.platIdx > removedIdx ? rb.platIdx - 1 : rb.platIdx,
      }));
    editorDraftSpec.spikes = editorDraftSpec.spikes
      .filter((s) => s.platIdx !== removedIdx)
      .map((s) => ({
        ...s,
        platIdx: s.platIdx > removedIdx ? s.platIdx - 1 : s.platIdx,
      }));
    editorFixGlueAfterPlatformDelete(removedIdx);
  }

  function editorFixGlueAfterPlatformDelete(removedIdx) {
    for (const w of editorDraftSpec.walls) {
      if (w.gluePlatIdx === removedIdx) {
        delete w.gluePlatIdx;
        delete w.glueRelX;
        delete w.glueRelY;
      } else if (w.gluePlatIdx > removedIdx) {
        w.gluePlatIdx--;
      }
    }
    for (const p of editorDraftSpec.platforms) {
      if (p.gluePlatIdx === removedIdx) {
        delete p.gluePlatIdx;
        delete p.glueRelX;
        delete p.glueRelY;
      } else if (p.gluePlatIdx > removedIdx) {
        p.gluePlatIdx--;
      }
    }
    if (editorDraftSpec.debuffZones && editorDraftSpec.debuffZones.length) {
      for (const z of editorDraftSpec.debuffZones) {
        if (z.gluePlatIdx === removedIdx) {
          delete z.gluePlatIdx;
          delete z.glueRelX;
          delete z.glueRelY;
        } else if (z.gluePlatIdx != null && z.gluePlatIdx > removedIdx) {
          z.gluePlatIdx--;
        }
      }
    }
  }

  function editorWallPickIndex(wx, wy) {
    for (let i = editorDraftSpec.walls.length - 1; i >= 0; i--) {
      const w = editorDraftSpec.walls[i];
      if (pointInRotRect(wx, wy, w)) return i;
    }
    return -1;
  }

  function editorDebuffPickIndex(wx, wy) {
    const dz = editorDraftSpec.debuffZones;
    if (!dz || !dz.length) return -1;
    for (let i = dz.length - 1; i >= 0; i--) {
      const z = dz[i];
      if (entityHasRot(z)) {
        if (pointInRotRect(wx, wy, z)) return i;
      } else if (wx >= z.x && wx <= z.x + z.w && wy >= z.y && wy <= z.y + z.h) return i;
    }
    return -1;
  }

  /** First glue click: prefer wall, then slow zone, then platform when overlapping. */
  function editorGluePickFirst(wx, wy) {
    const wi = editorWallPickIndex(wx, wy);
    if (wi >= 0) return { type: "wall", idx: wi };
    const zi = editorDebuffPickIndex(wx, wy);
    if (zi >= 0) return { type: "debuff", idx: zi };
    const pi = editorFindPlatformIndex(wx, wy);
    if (pi >= 0) return { type: "platform", idx: pi };
    return null;
  }

  /** Second glue click: prefer platform (parent) over wall when overlapping. */
  function editorGluePickSecond(wx, wy) {
    const pi = editorFindPlatformIndex(wx, wy);
    if (pi >= 0) return { type: "platform", idx: pi };
    const wi = editorWallPickIndex(wx, wy);
    if (wi >= 0) return { type: "wall", idx: wi };
    return null;
  }

  function editorHandleGlueClick(wx, wy) {
    const plats = editorDraftSpec.platforms;
    const dWalls = editorDraftSpec.walls;

    const wi = editorWallPickIndex(wx, wy);
    if (wi >= 0 && dWalls[wi] && dWalls[wi].gluePlatIdx != null) {
      const w = dWalls[wi];
      delete w.gluePlatIdx;
      delete w.glueRelX;
      delete w.glueRelY;
      gluePending = null;
      return true;
    }
    const piHit = editorFindPlatformIndex(wx, wy);
    if (piHit >= 0 && plats[piHit] && plats[piHit].gluePlatIdx != null) {
      const p = plats[piHit];
      delete p.gluePlatIdx;
      delete p.glueRelX;
      delete p.glueRelY;
      gluePending = null;
      return true;
    }
    const ziHit = editorDebuffPickIndex(wx, wy);
    if (ziHit >= 0 && editorDraftSpec.debuffZones[ziHit] && editorDraftSpec.debuffZones[ziHit].gluePlatIdx != null) {
      const z = editorDraftSpec.debuffZones[ziHit];
      delete z.gluePlatIdx;
      delete z.glueRelX;
      delete z.glueRelY;
      gluePending = null;
      return true;
    }

    if (!gluePending) {
      const pick = editorGluePickFirst(wx, wy);
      if (!pick) return false;
      gluePending = pick;
      return true;
    }

    const second = editorGluePickSecond(wx, wy);
    if (!second) {
      gluePending = null;
      return true;
    }
    if (second.type === gluePending.type && second.idx === gluePending.idx) {
      gluePending = null;
      return true;
    }

    const f = gluePending;
    const s = second;
    let childWallIdx = -1;
    let childPlatIdx = -1;
    let childDebuffIdx = -1;
    let parentPlatIdx = -1;

    if (f.type === "wall" && s.type === "platform") {
      childWallIdx = f.idx;
      parentPlatIdx = s.idx;
    } else if (f.type === "platform" && s.type === "wall") {
      childWallIdx = s.idx;
      parentPlatIdx = f.idx;
    } else if (f.type === "wall" && s.type === "wall") {
      gluePending = null;
      return true;
    } else if (f.type === "platform" && s.type === "platform") {
      const pf = plats[f.idx];
      const ps = plats[s.idx];
      if (!pf || !ps || f.idx === s.idx) {
        gluePending = null;
        return true;
      }
      const fElev = Boolean(pf.elev);
      const sElev = Boolean(ps.elev);
      if (fElev && !sElev) {
        parentPlatIdx = f.idx;
        childPlatIdx = s.idx;
      } else if (!fElev && sElev) {
        parentPlatIdx = s.idx;
        childPlatIdx = f.idx;
      } else if (fElev && sElev) {
        gluePending = null;
        return true;
      } else {
        childPlatIdx = f.idx;
        parentPlatIdx = s.idx;
      }
    } else if (f.type === "debuff" && s.type === "platform") {
      childDebuffIdx = f.idx;
      parentPlatIdx = s.idx;
    } else if (f.type === "platform" && s.type === "debuff") {
      childDebuffIdx = s.idx;
      parentPlatIdx = f.idx;
    } else if (
      (f.type === "debuff" && (s.type === "wall" || s.type === "debuff")) ||
      (s.type === "debuff" && (f.type === "wall" || f.type === "debuff"))
    ) {
      gluePending = null;
      return true;
    }

    const parent = plats[parentPlatIdx];
    if (!parent) {
      gluePending = null;
      return true;
    }

    const anchor = editorGlueParentAnchorPx(parentPlatIdx);
    if (!anchor) {
      gluePending = null;
      return true;
    }

    if (childWallIdx >= 0) {
      const w = dWalls[childWallIdx];
      if (w) {
        w.gluePlatIdx = parentPlatIdx;
        w.glueRelX = w.x - anchor.x;
        w.glueRelY = w.y - anchor.y;
      }
    } else if (childPlatIdx >= 0) {
      const child = plats[childPlatIdx];
      if (!child || child.elev || childPlatIdx === parentPlatIdx) {
        gluePending = null;
        return true;
      }
      child.gluePlatIdx = parentPlatIdx;
      child.glueRelX = child.x - anchor.x;
      child.glueRelY = child.y - anchor.y;
    } else if (childDebuffIdx >= 0) {
      const dz = editorDraftSpec.debuffZones;
      const z = dz && dz[childDebuffIdx];
      if (z) {
        z.gluePlatIdx = parentPlatIdx;
        z.glueRelX = z.x - anchor.x;
        z.glueRelY = z.y - anchor.y;
      }
    }

    gluePending = null;
    return true;
  }

  function editorRefreshGlueRelAfterMove(pick) {
    if (!editorDraftSpec || !pick) return;
    if (pick.type === "wall") {
      const w = editorDraftSpec.walls[pick.idx];
      if (w && w.gluePlatIdx != null) {
        const p = editorGlueParentAnchorPx(w.gluePlatIdx);
        if (p) {
          w.glueRelX = w.x - p.x;
          w.glueRelY = w.y - p.y;
        }
      }
    } else if (pick.type === "platform") {
      const plat = editorDraftSpec.platforms[pick.idx];
      if (plat && plat.gluePlatIdx != null && !plat.elev) {
        const p = editorGlueParentAnchorPx(plat.gluePlatIdx);
        if (p) {
          plat.glueRelX = plat.x - p.x;
          plat.glueRelY = plat.y - p.y;
        }
      }
    } else if (pick.type === "debuff") {
      const z = editorDraftSpec.debuffZones[pick.idx];
      if (z && z.gluePlatIdx != null) {
        const p = editorGlueParentAnchorPx(z.gluePlatIdx);
        if (p) {
          z.glueRelX = z.x - p.x;
          z.glueRelY = z.y - p.y;
        }
      }
    }
  }

  /** True when the pointer is on the canvas area, not on the right-side editor dock. */
  function editorPointerIsAboveToolbox(clientX, clientY) {
    if (!levelEditorEl || levelEditorEl.classList.contains("hidden")) return true;
    const r = levelEditorEl.getBoundingClientRect();
    return (
      clientX < r.left - 2 ||
      clientX > r.right + 2 ||
      clientY < r.top - 2 ||
      clientY > r.bottom + 2
    );
  }

  function resetEditorToolboxLayout() {
    if (!levelEditorEl) return;
    levelEditorEl.classList.remove("toolbox-collapsed");
    if (editorToolboxToggleBtn) {
      editorToolboxToggleBtn.setAttribute("aria-expanded", "true");
      editorToolboxToggleBtn.textContent = "Hide toolbox";
    }
  }

  function editorCanvasMouseDown(e) {
    if (editorActive && levelReady && e.button === 1) {
      e.preventDefault();
      editorMiddlePanning = true;
      editorMiddlePanLastX = e.clientX;
      editorMiddlePanLastY = e.clientY;
      return;
    }
    if (e.button !== 0) return;
    if (!editorActive || !editorDraftSpec) return;
    if (!editorPointerIsAboveToolbox(e.clientX, e.clientY)) return;
    const { wx, wy } = canvasWorldPoint(e.clientX, e.clientY);
    const plats = editorDraftSpec.platforms;

    if (editorPlaceKind === "glue") {
      if (editorHandleGlueClick(wx, wy)) {
        editorApplyDraftToWorld();
        syncGluedFollowers();
        editorClampCamX();
        editorClampCamY();
        persistEditorDraft();
      }
      return;
    }

    if (editorPlaceKind === "rotate") {
      const hit = editorMovePickupAt(wx, wy, "platformsFirst");
      if (!hit) return;
      const step = Math.PI / 12;
      const delta = e.shiftKey ? -step : step;
      function applyRot(ent) {
        if (!ent) return false;
        let nr = entityRotRad(ent) + delta;
        while (nr >= Math.PI * 2) nr -= Math.PI * 2;
        while (nr < 0) nr += Math.PI * 2;
        if (nr < 1e-5 || nr > Math.PI * 2 - 1e-5) delete ent.rot;
        else ent.rot = nr;
        return true;
      }
      let ok = false;
      if (hit.type === "platform") ok = applyRot(editorDraftSpec.platforms[hit.idx]);
      else if (hit.type === "wall") ok = applyRot(editorDraftSpec.walls[hit.idx]);
      else if (hit.type === "spike") ok = applyRot(editorDraftSpec.spikes[hit.idx]);
      else if (hit.type === "debuff") ok = applyRot(editorDraftSpec.debuffZones[hit.idx]);
      else if (hit.type === "goal") ok = applyRot(editorDraftSpec.goal);
      else if (hit.type === "ball") ok = applyRot(editorDraftSpec.wreckingBalls[hit.idx]);
      if (ok) {
        editorApplyDraftToWorld();
        syncGluedFollowers();
        editorClampCamX();
        editorClampCamY();
        persistEditorDraft();
      }
      return;
    }

    if (editorPlaceKind === "move") {
      const order = e.shiftKey ? "hazardsFirst" : "platformsFirst";
      const hit = editorMovePickupAt(wx, wy, order);
      if (hit) {
        e.preventDefault();
        editorBeginMove(wx, wy, hit);
      }
      return;
    }

    if (editorPlaceKind === "scale") {
      const order = e.shiftKey ? "hazardsFirst" : "platformsFirst";
      const hit = editorMovePickupAt(wx, wy, order);
      if (!hit || hit.type === "spawn") {
        return;
      }
      const rect = editorGetScalableRect(hit);
      if (!rect) return;
      const edge = editorScaleEdgeNear(wx, wy, rect);
      if (!edge) return;
      e.preventDefault();
      editorBeginScale(hit, edge, rect);
      return;
    }

    if (editorPlaceKind === "erase") {
      editorEraseAt(wx, wy);
    } else if (editorPlaceKind === "spawn") {
      editorDraftSpec.spawn = {
        x: snapEditor(wx - player.w / 2),
        y: snapEditor(wy - player.h),
      };
    } else if (editorPlaceKind === "goal") {
      editorDraftSpec.goal = {
        x: snapEditor(wx - 16),
        y: snapEditor(wy - 48),
        w: 32,
        h: 48,
      };
    } else if (editorPlaceKind === "plat-solid") {
      plats.push({
        x: snapEditor(wx),
        y: snapEditor(wy),
        w: 120,
        h: 22,
      });
    } else if (editorPlaceKind === "plat-ice") {
      plats.push({
        x: snapEditor(wx),
        y: snapEditor(wy),
        w: 120,
        h: 22,
        ice: true,
      });
    } else if (editorPlaceKind === "plat-switch") {
      plats.push({
        x: snapEditor(wx),
        y: snapEditor(wy),
        w: 120,
        h: 22,
        switch: true,
      });
    } else if (editorPlaceKind === "plat-elevator") {
      const y0 = snapEditor(wy);
      plats.push({
        x: snapEditor(wx),
        y: y0,
        w: 140,
        h: 24,
        yBase: y0,
        elev: { amp: 44, omega: (Math.PI * 2) / 3, phase: 0.5 },
      });
    } else if (editorPlaceKind === "plat-launcher-forward") {
      plats.push({
        x: snapEditor(wx),
        y: snapEditor(wy),
        w: 120,
        h: 22,
        launcher: { kind: "forward", vx: LAUNCH_FORWARD_VX },
      });
    } else if (editorPlaceKind === "plat-launcher-backward") {
      plats.push({
        x: snapEditor(wx),
        y: snapEditor(wy),
        w: 120,
        h: 22,
        launcher: { kind: "backward", vx: LAUNCH_FORWARD_VX },
      });
    } else if (editorPlaceKind === "plat-launcher-up") {
      plats.push({
        x: snapEditor(wx),
        y: snapEditor(wy),
        w: 120,
        h: 22,
        launcher: { kind: "up", vy: LAUNCH_UP_VY },
      });
    } else if (editorPlaceKind === "plat-grav-d") {
      plats.push({
        x: snapEditor(wx),
        y: snapEditor(wy),
        w: 120,
        h: 22,
        gravSwitch: { dir: "d" },
      });
    } else if (editorPlaceKind === "plat-grav-u") {
      plats.push({
        x: snapEditor(wx),
        y: snapEditor(wy),
        w: 120,
        h: 22,
        gravSwitch: { dir: "u" },
      });
    } else if (editorPlaceKind === "plat-grav-l") {
      plats.push({
        x: snapEditor(wx),
        y: snapEditor(wy),
        w: 120,
        h: 22,
        gravSwitch: { dir: "l" },
      });
    } else if (editorPlaceKind === "plat-grav-r") {
      plats.push({
        x: snapEditor(wx),
        y: snapEditor(wy),
        w: 120,
        h: 22,
        gravSwitch: { dir: "r" },
      });
    } else if (editorPlaceKind === "wall") {
      editorDraftSpec.walls.push({
        x: snapEditor(wx),
        y: snapEditor(wy),
        w: 18,
        h: 120,
      });
    } else if (editorPlaceKind === "debuff-zone") {
      if (!editorDraftSpec.debuffZones) editorDraftSpec.debuffZones = [];
      editorDraftSpec.debuffZones.push({
        x: snapEditor(wx),
        y: snapEditor(wy),
        w: 144,
        h: 88,
      });
    } else if (editorPlaceKind === "wrecking-ball") {
      const pi = editorFindPlatformForBall(wx, wy);
      if (pi < 0) return;
      const plat = plats[pi];
      const top = editorDraftPlatSurfaceY(plats, plat);
      editorDraftSpec.wreckingBalls.push({
        platIdx: pi,
        relOffX: Math.round(snapEditor(wx - (plat.x + plat.w * 0.5))),
        relOffY: Math.round(snapEditor(wy - top)),
        ropeLen: 118,
        swingRad: 0.88,
        omega: 1.7,
        phase: 0.6,
        r: 16,
      });
    } else if (editorPlaceKind === "spikes") {
      const pi = editorFindPlatformForSpike(wx, wy);
      if (pi < 0) return;
      const plat = plats[pi];
      const stripW = 64;
      if (plat.w < stripW + 12) return;
      const relX = snapEditor(
        entityHasRot(plat)
          ? platWorldPointToLocal(plat, wx, wy).lx - stripW / 2
          : wx - plat.x - stripW / 2,
      );
      const relClamp = Math.max(6, Math.min(relX, plat.w - stripW - 6));
      editorDraftSpec.spikes.push({
        platIdx: pi,
        relX: relClamp,
        w: stripW,
        h: 16,
      });
    }
    editorApplyDraftToWorld();
    editorClampCamX();
    editorClampCamY();
    persistEditorDraft();
  }

  function editorUpdate(dt) {
    syncGluedFollowers();
    const pan = 440 * dt;
    if (keys.has("ArrowLeft") || keys.has("KeyA")) {
      camX -= pan;
      editorClampCamX();
    }
    if (keys.has("ArrowRight") || keys.has("KeyD")) {
      camX += pan;
      editorClampCamX();
    }
    if (keys.has("ArrowUp") || keys.has("KeyW")) {
      camY -= pan;
      editorClampCamY();
    }
    if (keys.has("ArrowDown") || keys.has("KeyS")) {
      camY += pan;
      editorClampCamY();
    }
  }

  function newEditorLevel() {
    if (editorDrag) editorFinishMoveDrag();
    if (
      !window.confirm(
        "Start a new blank level? The current draft will be replaced (use Save first if you need to keep it).",
      )
    ) {
      return;
    }
    gluePending = null;
    editorScaleDrag = null;
    editorDraftSpec = defaultEditorLevelSpec();
    editorActiveSavedId = null;
    editorSavedLevelTitle = "";
    editorApplyDraftToWorld();
    camX = 0;
    camY = 0;
    editorClampCamX();
    editorClampCamY();
    persistEditorDraft();
    if (editorPublishBtn) editorPublishBtn.classList.remove("editor-publish-published");
  }

  function saveEditorNamedLevel() {
    if (editorDrag) editorFinishMoveDrag();
    if (!editorDraftSpec) return;
    persistEditorDraft();
    const n = normalizeImportedSpec(JSON.parse(JSON.stringify(editorDraftSpec)));
    if (!n) {
      window.alert("Nothing valid to save — add at least one platform.");
      return;
    }
    const defaultTitle = editorSavedLevelTitle || "Untitled";
    const titleRaw = window.prompt("Name this saved level", defaultTitle);
    if (titleRaw === null) return;
    const title = String(titleRaw).trim().slice(0, 48) || "Untitled";
    const now = Date.now();
    let list = loadSavedLevelsList();

    if (editorActiveSavedId) {
      const idx = list.findIndex((e) => e.id === editorActiveSavedId);
      if (idx >= 0) {
        list[idx] = { ...list[idx], title, savedAt: now, spec: cloneLevelSpec(n) };
        persistSavedLevelsList(list);
        editorSavedLevelTitle = title;
        refreshEditorSavedSelect();
        window.alert("Saved.");
        return;
      }
      editorActiveSavedId = null;
    }

    const titleLower = title.toLowerCase();
    const dupIdx = list.findIndex(
      (e) => e.title && String(e.title).trim().toLowerCase() === titleLower,
    );
    if (dupIdx >= 0) {
      const prevName = String(list[dupIdx].title || "Untitled").trim() || "Untitled";
      if (!window.confirm(`Replace saved level "${prevName}"?`)) return;
      list[dupIdx] = {
        ...list[dupIdx],
        title,
        savedAt: now,
        spec: cloneLevelSpec(n),
      };
      editorActiveSavedId = list[dupIdx].id;
    } else {
      const entry = {
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`,
        title,
        savedAt: now,
        spec: cloneLevelSpec(n),
      };
      list.push(entry);
      editorActiveSavedId = entry.id;
    }
    persistSavedLevelsList(list);
    editorSavedLevelTitle = title;
    refreshEditorSavedSelect();
    window.alert("Saved.");
  }

  function startLevelEditor() {
    closePauseMenu();
    customLevelSpec = null;
    playMode = null;
    gameSessionActive = false;
    levelTimeSec = 0;
    resetWorldGravity();
    editorActive = true;
    editorActiveSavedId = null;
    editorSavedLevelTitle = "";
    hideMenus();
    loadEditorDraft();
    editorApplyDraftToWorld();
    keys.clear();
    editorDrag = null;
    gluePending = null;
    camX = 0;
    camY = 0;
    state = "playing";
    overlay.classList.add("hidden");
    levelReady = true;
    if (levelEditorEl) levelEditorEl.classList.remove("hidden");
    setEditorPlaceKind("plat-solid");
    if (editorPublishBtn) editorPublishBtn.classList.remove("editor-publish-published");
    refreshEditorSavedSelect();
    updateLevelHud();
  }

  function startPlaytestFromEditor() {
    if (editorDrag) editorFinishMoveDrag();
    if (editorScaleDrag) editorFinishScaleDrag();
    persistEditorDraft();
    if (!editorDraftSpec) return;
    levelTimeSec = 0;
    customLevelSpec = cloneLevelSpec(editorDraftSpec);
    playMode = "custom";
    editorActive = false;
    editorMiddlePanning = false;
    editorDrag = null;
    gluePending = null;
    if (levelEditorEl) levelEditorEl.classList.add("hidden");
    hideMenus();
    levelReady = false;
    setLoading(false);
    try {
      buildLevel();
      if (spawn != null) applyResetAfterBuild();
      else {
        levelReady = true;
        gameSessionActive = true;
        updateLevelHud();
      }
    } catch (err) {
      console.error(err);
      editorActive = true;
      levelTimeSec = 0;
      if (levelEditorEl) levelEditorEl.classList.remove("hidden");
      playMode = null;
      customLevelSpec = null;
    }
  }

  function returnToEditorFromPlay() {
    closePauseMenu();
    overlay.classList.add("hidden");
    state = "playing";
    gameSessionActive = false;
    playMode = null;
    customLevelSpec = null;
    levelTimeSec = 0;
    resetWorldGravity();
    editorActive = true;
    editorDrag = null;
    gluePending = null;
    keys.clear();
    if (!editorDraftSpec) loadEditorDraft();
    editorApplyDraftToWorld();
    camX = 0;
    camY = 0;
    levelReady = true;
    if (levelEditorEl) levelEditorEl.classList.remove("hidden");
    updateLevelHud();
  }

  function setMenuUiOpen(open) {
    if (uiRoot) uiRoot.classList.toggle("in-menu", open);
  }

  function closePauseMenu() {
    pauseMenuOpen = false;
    if (pauseMenuEl) pauseMenuEl.classList.add("hidden");
    if (pauseEditorBtn) pauseEditorBtn.classList.add("hidden");
  }

  function openPauseMenu() {
    if (state !== "playing" || !gameSessionActive || !levelReady) return;
    keys.clear();
    pauseMenuOpen = true;
    if (pauseMenuEl) pauseMenuEl.classList.remove("hidden");
    if (pauseEditorBtn) pauseEditorBtn.classList.toggle("hidden", playMode !== "custom");
  }

  function cancelLoadingToMainMenu() {
    if (!loadingEl) return;
    loadGenerationId++;
    keys.clear();
    setLoading(false);
    showMainMenu();
  }

  function showMainMenu() {
    closePauseMenu();
    if (editorDraftSpec) persistEditorDraft();
    hideLevelEditorUi();
    customLevelSpec = null;
    gameSessionActive = false;
    playMode = null;
    levelReady = false;
    if (mainMenu) mainMenu.classList.remove("hidden");
    if (modeMenu) modeMenu.classList.add("hidden");
    setMenuUiOpen(true);
    updateLevelHud();
  }

  function showModeMenu() {
    if (mainMenu) mainMenu.classList.add("hidden");
    if (modeMenu) modeMenu.classList.remove("hidden");
    setMenuUiOpen(true);
  }

  function hideMenus() {
    if (mainMenu) mainMenu.classList.add("hidden");
    if (modeMenu) modeMenu.classList.add("hidden");
    setMenuUiOpen(false);
  }

  function loadGameFromCurrentMode() {
    closePauseMenu();
    hideLevelEditorUi();
    hideMenus();
    const myLoad = ++loadGenerationId;
    levelReady = false;
    setLoading(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (myLoad !== loadGenerationId) return;
        levelTimeSec = 0;
        resetWorldGravity();
        try {
          buildLevel();
        } catch (err) {
          console.error(err);
        }
        if (myLoad !== loadGenerationId) return;
        if (spawn != null) {
          applyResetAfterBuild();
        } else {
          levelReady = true;
          setLoading(false);
          showMainMenu();
        }
      });
    });
  }

  function startCampaignGame() {
    playMode = "campaign";
    campaignLevel = 0;
    loadGameFromCurrentMode();
  }

  function startRandomGame() {
    playMode = "random";
    campaignLevel = premadeStageCount();
    lastRandomWasCommunity = false;
    lastRandomCommunityKey = "";
    loadGameFromCurrentMode();
  }

  function frame(now) {
    if (!jumpLoopRunning) return;
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    if (editorActive && levelReady) {
      editorUpdate(dt);
      draw();
      if (jumpLoopRunning) requestAnimationFrame(frame);
      return;
    }
    if (!gameSessionActive) {
      if (jumpLoopRunning) requestAnimationFrame(frame);
      return;
    }
    if (!levelReady) {
      if (jumpLoopRunning) requestAnimationFrame(frame);
      return;
    }
    if (!pauseMenuOpen) update(dt);
    draw();
    if (jumpLoopRunning) requestAnimationFrame(frame);
  }

  function applyResetAfterBuild() {
    resetWorldGravity();
    keys.clear();
    player.x = spawn.x;
    player.y = spawn.y;
    player.vx = 0;
    player.vy = 0;
    player.onGround = false;
    player.coyoteMs = 0;
    player.jumpBufferedMs = 0;
    player.facing = 1;
    player.launchBoostMs = 0;
    player.launchUpCoastMs = 0;
    camX = Math.max(0, player.x - W * 0.35);
    camY = 0;
    state = "playing";
    overlay.classList.add("hidden");
    closePauseMenu();
    restartBtn.textContent = "Play again";
    gameSessionActive = true;
    levelReady = true;
    setLoading(false);
    updateLevelHud();
  }

  function restartCurrentStage() {
    resetWorldGravity();
    levelTimeSec = 0;
    player.x = spawn.x;
    player.y = spawn.y;
    player.vx = 0;
    player.vy = 0;
    player.onGround = false;
    player.coyoteMs = 0;
    player.jumpBufferedMs = 0;
    player.facing = 1;
    player.launchBoostMs = 0;
    player.launchUpCoastMs = 0;
    camX = Math.max(0, player.x - W * 0.35);
    camY = 0;
    state = "playing";
    overlay.classList.add("hidden");
    restartBtn.textContent = "Play again";
  }

  function advanceCampaignAndLoad() {
    const myLoad = ++loadGenerationId;
    levelReady = false;
    campaignLevel++;
    const nPre = premadeStageCount();
    const procedural = nPre === 0 || campaignLevel >= nPre;
    setLoading(procedural);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (myLoad !== loadGenerationId) return;
        levelTimeSec = 0;
        resetWorldGravity();
        try {
          buildLevel();
        } catch (err) {
          console.error(err);
        }
        if (myLoad !== loadGenerationId) return;
        if (spawn != null) {
          applyResetAfterBuild();
        } else {
          levelReady = true;
          setLoading(false);
        }
      });
    });
  }

  window.addEventListener("keydown", (e) => {
    if (!jumpShellActive()) return;
    keys.add(e.code);
    if (e.code === "Escape") {
      e.preventDefault();
      if (editorActive) {
        exitEditorToModeMenu();
        return;
      }
      if (loadingEl && loadingEl.classList.contains("visible") && !levelReady) {
        cancelLoadingToMainMenu();
        return;
      }
      if (gameSessionActive && levelReady && state === "playing") {
        if (pauseMenuOpen) closePauseMenu();
        else openPauseMenu();
      }
      return;
    }
    if (editorActive) return;
    if (!gameSessionActive) return;
    if (pauseMenuOpen) return;
    if (e.code === "KeyR") {
      e.preventDefault();
      if (state === "win") {
        if (playMode === "custom") restartCurrentStage();
        else advanceCampaignAndLoad();
      } else restartCurrentStage();
      return;
    }
    const jumpKey = e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW";
    if (jumpKey && state === "playing") {
      player.jumpBufferedMs = JUMP_BUFFER_MS;
    }
    const gameKey =
      jumpKey ||
      e.code === "ArrowLeft" ||
      e.code === "ArrowRight" ||
      e.code === "ArrowDown" ||
      e.code === "KeyA" ||
      e.code === "KeyD" ||
      e.code === "KeyS";
    if (gameKey) e.preventDefault();
  });
  window.addEventListener("keyup", (e) => {
    if (!jumpShellActive()) return;
    keys.delete(e.code);
  });

  restartBtn.addEventListener("click", () => {
    if (state === "win") {
      if (playMode === "custom") restartCurrentStage();
      else advanceCampaignAndLoad();
    } else restartCurrentStage();
  });

  if (loadingCancelBtn) {
    loadingCancelBtn.addEventListener("click", () => {
      cancelLoadingToMainMenu();
    });
  }

  if (menuPlayBtn) menuPlayBtn.addEventListener("click", showModeMenu);
  if (menuBackBtn) menuBackBtn.addEventListener("click", showMainMenu);
  if (menuCampaignBtn) menuCampaignBtn.addEventListener("click", startCampaignGame);
  if (menuRandomBtn) menuRandomBtn.addEventListener("click", startRandomGame);
  if (menuEditorBtn) menuEditorBtn.addEventListener("click", startLevelEditor);
  if (editorPlaytestBtn)
    editorPlaytestBtn.addEventListener("click", () => {
      if (editorDrag) editorFinishMoveDrag();
      startPlaytestFromEditor();
    });
  if (editorDoneBtn) editorDoneBtn.addEventListener("click", exitEditorToModeMenu);
  if (editorNewBtn) editorNewBtn.addEventListener("click", () => newEditorLevel());
  if (editorSaveBtn) editorSaveBtn.addEventListener("click", () => saveEditorNamedLevel());
  if (editorSavedSelect) {
    editorSavedSelect.addEventListener("change", () => {
      const id = editorSavedSelect.value;
      editorSavedSelect.value = "";
      if (!id) return;
      const entry = loadSavedLevelsList().find((e) => e.id === id);
      if (!entry || !entry.spec) return;
      const n = normalizeImportedSpec(JSON.parse(JSON.stringify(entry.spec)));
      if (!n) {
        window.alert("Could not load that save.");
        return;
      }
      editorDraftSpec = cloneLevelSpec(n);
      editorActiveSavedId = entry.id;
      editorSavedLevelTitle =
        entry.title && String(entry.title).trim()
          ? String(entry.title).trim().slice(0, 48)
          : "Untitled";
      editorApplyDraftToWorld();
      editorClampCamX();
      editorClampCamY();
      persistEditorDraft();
    });
  }
  if (editorExportBtn)
    editorExportBtn.addEventListener("click", async () => {
      if (!editorDraftSpec) return;
      const text = JSON.stringify(editorDraftSpec, null, 2);
      try {
        await navigator.clipboard.writeText(text);
        window.alert("Level JSON copied to clipboard.");
      } catch (_) {
        window.prompt("Copy this JSON:", text);
      }
    });
  if (editorImportBtn)
    editorImportBtn.addEventListener("click", () => {
      const t = window.prompt("Paste level JSON (platforms, goal, spawn, walls, …)");
      if (!t) return;
      try {
        const parsed = JSON.parse(t);
        const n = normalizeImportedSpec(parsed);
        if (!n) {
          window.alert("Invalid level: need a non-empty platforms array.");
          return;
        }
        editorDraftSpec = cloneLevelSpec(n);
        editorActiveSavedId = null;
        editorSavedLevelTitle = "";
        editorApplyDraftToWorld();
        persistEditorDraft();
      } catch (_) {
        window.alert("Could not parse JSON.");
      }
    });
  if (editorPublishBtn) {
    editorPublishBtn.addEventListener("click", () => {
      if (editorDrag) editorFinishMoveDrag();
      if (!editorDraftSpec) return;
      persistEditorDraft();
      const n = normalizeImportedSpec(JSON.parse(JSON.stringify(editorDraftSpec)));
      if (!n) {
        window.alert("Cannot publish: level needs at least one platform.");
        return;
      }
      if (levelHasImpossibleSpikeCoverage(n.platforms, n.spikes)) {
        window.alert(
          "Cannot publish: on at least one platform, spike strips cover more than 80% of its width (impossible layout).",
        );
        return;
      }
      let title = window.prompt("Name your level (shown in Random mode)", "Community level");
      if (title === null) return;
      title = String(title).trim().slice(0, 48) || "Community level";
      const entry = {
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`,
        title,
        spec: n,
        savedAt: Date.now(),
      };
      const list = loadPublishedLevels();
      list.push(entry);
      savePublishedLevels(list);
      editorPublishBtn.classList.add("editor-publish-published");
      window.alert("Published. It can appear when you play Random mode.");
    });
  }
  if (editorToolboxToggleBtn) {
    editorToolboxToggleBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      if (editorDrag) editorFinishMoveDrag();
      gluePending = null;
      if (!levelEditorEl) return;
      const collapsed = levelEditorEl.classList.toggle("toolbox-collapsed");
      editorToolboxToggleBtn.setAttribute("aria-expanded", collapsed ? "false" : "true");
      editorToolboxToggleBtn.textContent = collapsed ? "Show toolbox" : "Hide toolbox";
      if (collapsed && editorInfoPanel && editorInfoBtn) {
        editorInfoPanel.setAttribute("hidden", "");
        editorInfoBtn.setAttribute("aria-expanded", "false");
      }
    });
  }
  if (editorInfoBtn && editorInfoPanel) {
    editorInfoBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const opening = editorInfoPanel.hasAttribute("hidden");
      if (opening) {
        editorInfoPanel.removeAttribute("hidden");
        editorInfoBtn.setAttribute("aria-expanded", "true");
      } else {
        editorInfoPanel.setAttribute("hidden", "");
        editorInfoBtn.setAttribute("aria-expanded", "false");
      }
    });
  }
  if (levelEditorEl) {
    levelEditorEl.addEventListener("click", (ev) => {
      const chip = ev.target.closest("[data-place-kind]");
      if (!chip || !levelEditorEl.contains(chip)) return;
      if (editorDrag) editorFinishMoveDrag();
      gluePending = null;
      const k = chip.getAttribute("data-place-kind");
      if (k) setEditorPlaceKind(k);
    });
  }
  canvas.addEventListener("mousedown", editorCanvasMouseDown);
  canvas.addEventListener(
    "wheel",
    (e) => {
      if (!editorActive || !levelReady) return;
      e.preventDefault();
      const r = canvas.getBoundingClientRect();
      const scaleX = W / r.width;
      const scaleY = H / r.height;
      let mult = 0.5;
      if (e.deltaMode === 1) mult *= 16;
      else if (e.deltaMode === 2) mult *= Math.max(120, r.height * 0.35);
      camX += e.deltaX * scaleX * mult;
      camY += e.deltaY * scaleY * mult;
      editorClampCamX();
      editorClampCamY();
    },
    { passive: false }
  );
  canvas.addEventListener("auxclick", (e) => {
    if (editorActive && e.button === 1) e.preventDefault();
  });
  window.addEventListener("mousemove", (e) => {
    if (editorDrag) {
      editorApplyMoveDrag(e.clientX, e.clientY);
      return;
    }
    if (editorScaleDrag) {
      editorApplyScaleDrag(e.clientX, e.clientY);
      return;
    }
    if (!editorMiddlePanning) return;
    const r = canvas.getBoundingClientRect();
    const scaleX = W / r.width;
    const scaleY = H / r.height;
    const dx = (e.clientX - editorMiddlePanLastX) * scaleX;
    const dy = (e.clientY - editorMiddlePanLastY) * scaleY;
    editorMiddlePanLastX = e.clientX;
    editorMiddlePanLastY = e.clientY;
    camX -= dx;
    camY -= dy;
    editorClampCamX();
    editorClampCamY();
  });
  window.addEventListener("mouseup", (e) => {
    if (editorDrag && e.button === 0) {
      editorFinishMoveDrag();
      return;
    }
    if (editorScaleDrag && e.button === 0) {
      editorFinishScaleDrag();
      return;
    }
    if (e.button === 1) editorMiddlePanning = false;
  });
  window.addEventListener("blur", () => {
    if (editorDrag) editorFinishMoveDrag();
    if (editorScaleDrag) editorFinishScaleDrag();
    editorMiddlePanning = false;
  });
  if (pauseContinueBtn) pauseContinueBtn.addEventListener("click", closePauseMenu);
  if (pauseToMenuBtn)
    pauseToMenuBtn.addEventListener("click", () => {
      closePauseMenu();
      showMainMenu();
    });
  if (pauseEditorBtn) pauseEditorBtn.addEventListener("click", returnToEditorFromPlay);

  window.validatePremadeCampaignReachability = validatePremadeCampaignReachability;
  if (new URLSearchParams(location.search).get("validateLevels") === "1") {
    const r = validatePremadeCampaignReachability();
    const bad = r.filter((x) => !x.ok);
    if (bad.length) {
      console.error("[validateLevels] Failed:", bad);
    } else {
      console.log(
        `[validateLevels] All ${r.length} campaign stages pass (graph + physics sim, spike coverage ≤${MAX_SPIKE_COVERAGE_FRACTION * 100}%).`,
      );
    }
  }

  (function initJumpMobileControls() {
    const bar = document.getElementById("jump-mobile-controls");
    if (!bar) return;

    function syncMobileKey(code, down) {
      if (!jumpShellActive()) return;
      if (editorActive) {
        if (!down) keys.delete(code);
        return;
      }
      if (loadingEl && loadingEl.classList.contains("visible") && !levelReady) {
        if (!down) keys.delete(code);
        return;
      }
      if (!down) {
        keys.delete(code);
        return;
      }
      keys.add(code);
      if (
        code === "Space" &&
        gameSessionActive &&
        levelReady &&
        state === "playing" &&
        !pauseMenuOpen
      ) {
        player.jumpBufferedMs = JUMP_BUFFER_MS;
      }
    }

    for (const btn of bar.querySelectorAll("[data-key]")) {
      const code = btn.getAttribute("data-key");
      if (!code) continue;
      btn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        syncMobileKey(code, true);
      });
      btn.addEventListener("pointerup", (e) => {
        e.preventDefault();
        syncMobileKey(code, false);
      });
      btn.addEventListener("pointercancel", () => {
        syncMobileKey(code, false);
      });
    }
  })();

  function bootJump() {
    jumpLoopRunning = true;
    last = performance.now();
    showMainMenu();
    requestAnimationFrame(frame);
  }

  window.addEventListener("arcade:play", (e) => {
    const id = e.detail && e.detail.id;
    if (id === "jump-game") {
      bootJump();
    } else {
      jumpLoopRunning = false;
      keys.clear();
    }
  });

  window.addEventListener("arcade:leave", () => {
    jumpLoopRunning = false;
    keys.clear();
    showMainMenu();
  });
})();
