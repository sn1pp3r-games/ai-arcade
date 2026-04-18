(() => {
  "use strict";

  /** Bump this integer whenever you ship an update to the arcade (any game, CSS, or launcher change). */
  const ARCADE_UPDATE = 1;

  /**
   * Registry for the arcade launcher. Add entries here as you ship more games.
   * id must match what the game script listens for in `arcade:play` (detail.id).
   * shellId is the DOM id of the container shown while that game runs.
   */
  const GAMES = [
    {
      id: "orbital-drift",
      title: "Orbital Drift",
      tagline: "Orbit · graze · rush · survive",
      accent: "var(--accent)",
      available: true,
      shellId: "game-shell-orbital",
      canvasId: "game",
    },
    {
      id: "flux-lane",
      title: "Flux Lane",
      tagline: "Gates · streaks · near-miss bonus",
      accent: "#88c8ff",
      available: true,
      shellId: "game-shell-flux",
      canvasId: "game-flux",
    },
    {
      id: "neon-catch",
      title: "Neon Catch",
      tagline: "Catch falling orbs · three lives",
      accent: "#3dffce",
      available: true,
      shellId: "game-shell-neon",
      canvasId: "game-neon",
    },
    {
      id: "maze-game",
      title: "Maze",
      tagline: "Escape · exit · par stars",
      accent: "#58a6ff",
      available: true,
      shellId: "game-shell-maze",
      canvasId: "game-maze",
    },
    {
      id: "jump-game",
      title: "Jump",
      tagline: "Platforms · campaign · level editor",
      accent: "#58a6ff",
      available: true,
      shellId: "game-shell-jump",
      canvasId: "game-jump",
    },
    {
      id: "sandbox-tycoon",
      title: "Sandbox Tycoon",
      tagline: "Build paths · crowds · balance the books",
      accent: "#3ddc97",
      available: true,
      shellId: "game-shell-tycoon",
      canvasId: "game-tycoon",
    },
  ];

  const arcadeView = document.getElementById("arcade-view");
  const gameListEl = document.getElementById("game-list");
  const updateBadge = document.getElementById("arcade-update");
  if (updateBadge) {
    updateBadge.textContent = String(ARCADE_UPDATE);
  }

  function hideAllShells() {
    for (const g of GAMES) {
      if (!g.shellId) continue;
      const el = document.getElementById(g.shellId);
      if (el) {
        el.classList.add("hidden");
        el.setAttribute("hidden", "");
      }
    }
  }

  function showArcade() {
    hideAllShells();
    if (arcadeView) {
      arcadeView.classList.remove("hidden");
      arcadeView.removeAttribute("hidden");
    }
  }

  function showGameShell(gameId) {
    const meta = GAMES.find((g) => g.id === gameId);
    if (!meta || !meta.shellId) return;
    if (arcadeView) {
      arcadeView.classList.add("hidden");
      arcadeView.setAttribute("hidden", "");
    }
    hideAllShells();
    const shell = document.getElementById(meta.shellId);
    if (shell) {
      shell.classList.remove("hidden");
      shell.removeAttribute("hidden");
    }
  }

  function launchGame(id) {
    const game = GAMES.find((g) => g.id === id);
    if (!game || !game.available) return;
    showGameShell(id);
    requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent("arcade:play", { detail: { id } }));
      const canvasId = game.canvasId || "game";
      const c = document.getElementById(canvasId);
      if (c && typeof c.focus === "function") c.focus();
    });
  }

  function renderList() {
    if (!gameListEl) return;
    gameListEl.innerHTML = "";
    for (const g of GAMES) {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "game-card" + (g.available ? "" : " game-card--soon");
      btn.setAttribute("aria-disabled", g.available ? "false" : "true");
      btn.disabled = !g.available;
      btn.innerHTML = `
        <span class="game-card__title" style="color:${g.accent}">${g.title}</span>
        <span class="game-card__tagline">${g.tagline}</span>
        ${g.available ? '<span class="game-card__cta">Play →</span>' : '<span class="game-card__cta game-card__cta--muted">Soon</span>'}
      `;
      if (g.available) {
        btn.addEventListener("click", () => launchGame(g.id));
      }
      li.appendChild(btn);
      gameListEl.appendChild(li);
    }
  }

  document.body.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-arcade-back]");
    if (!btn) return;
    window.dispatchEvent(new CustomEvent("arcade:leave"));
    showArcade();
  });

  renderList();
})();
