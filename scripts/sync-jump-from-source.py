#!/usr/bin/env python3
"""Regenerate jump-levels.js, jump.css, jump-game.js, and Jump shell in index.html from ~/jump."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
JUMP_SRC = Path.home() / "jump"


def patch_game_js(src: str) -> str:
    pairs = [
        ('getElementById("editor-info-panel")', 'getElementById("jump-editor-info-panel")'),
        ('getElementById("editor-toolbox-toggle")', 'getElementById("jump-editor-toolbox-toggle")'),
        ('getElementById("editor-saved-select")', 'getElementById("jump-editor-saved-select")'),
        ('getElementById("editor-playtest-btn")', 'getElementById("jump-editor-playtest-btn")'),
        ('getElementById("menu-campaign-btn")', 'getElementById("jump-menu-campaign-btn")'),
        ('getElementById("menu-random-btn")', 'getElementById("jump-menu-random-btn")'),
        ('getElementById("menu-editor-btn")', 'getElementById("jump-menu-editor-btn")'),
        ('getElementById("community-hud")', 'getElementById("jump-community-hud")'),
        ('getElementById("loading-cancel-btn")', 'getElementById("jump-loading-cancel-btn")'),
        ('getElementById("pause-continue-btn")', 'getElementById("jump-pause-continue-btn")'),
        ('getElementById("editor-publish-btn")', 'getElementById("jump-editor-publish-btn")'),
        ('getElementById("editor-import-btn")', 'getElementById("jump-editor-import-btn")'),
        ('getElementById("editor-export-btn")', 'getElementById("jump-editor-export-btn")'),
        ('getElementById("menu-play-btn")', 'getElementById("jump-menu-play-btn")'),
        ('getElementById("editor-new-btn")', 'getElementById("jump-editor-new-btn")'),
        ('getElementById("editor-save-btn")', 'getElementById("jump-editor-save-btn")'),
        ('getElementById("pause-editor-btn")', 'getElementById("jump-pause-editor-btn")'),
        ('getElementById("level-editor")', 'getElementById("jump-level-editor")'),
        ('getElementById("editor-palette")', 'getElementById("jump-editor-palette")'),
        ('getElementById("editor-info-btn")', 'getElementById("jump-editor-info-btn")'),
        ('getElementById("editor-done-btn")', 'getElementById("jump-editor-done-btn")'),
        ('getElementById("pause-menu-btn")', 'getElementById("jump-pause-menu-btn")'),
        ('getElementById("main-menu")', 'getElementById("jump-main-menu")'),
        ('getElementById("mode-menu")', 'getElementById("jump-mode-menu")'),
        ('getElementById("menu-back-btn")', 'getElementById("jump-menu-back-btn")'),
        ('getElementById("level-hud")', 'getElementById("jump-level-hud")'),
        ('getElementById("overlay-title")', 'getElementById("jump-overlay-title")'),
        ('getElementById("overlay-msg")', 'getElementById("jump-overlay-msg")'),
        ('getElementById("restart-btn")', 'getElementById("jump-restart-btn")'),
        ('getElementById("pause-menu")', 'getElementById("jump-pause-menu")'),
        ('getElementById("overlay")', 'getElementById("jump-overlay")'),
        ('getElementById("loading")', 'getElementById("jump-loading")'),
        ('getElementById("ui")', 'getElementById("jump-ui")'),
        ('getElementById("game")', 'getElementById("game-jump")'),
    ]
    for a, b in pairs:
        src = src.replace(a, b)

    src = src.replace(
        '  const canvas = document.getElementById("game-jump");\n  const ctx = canvas.getContext("2d");',
        '  const canvas = document.getElementById("game-jump");\n'
        "  if (!canvas) return;\n"
        '  const ctx = canvas.getContext("2d");',
        1,
    )

    insert = """

  function jumpShellActive() {
    const sh = document.getElementById("game-shell-jump");
    return sh && !sh.classList.contains("hidden") && !sh.hasAttribute("hidden");
  }

  let jumpLoopRunning = false;
"""
    src = src.replace(
        '  const pauseEditorBtn = document.getElementById("jump-pause-editor-btn");\n\n  const W = canvas.width;',
        '  const pauseEditorBtn = document.getElementById("jump-pause-editor-btn");' + insert + "\n  const W = canvas.width;",
        1,
    )

    old_frame = """  function frame(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    if (editorActive && levelReady) {
      editorUpdate(dt);
      draw();
      requestAnimationFrame(frame);
      return;
    }
    if (!gameSessionActive) {
      requestAnimationFrame(frame);
      return;
    }
    if (!levelReady) {
      requestAnimationFrame(frame);
      return;
    }
    if (!pauseMenuOpen) update(dt);
    draw();
    requestAnimationFrame(frame);
  }"""

    new_frame = """  function frame(now) {
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
  }"""

    if old_frame not in src:
        raise SystemExit("frame() pattern mismatch — upstream game.js changed; edit sync script.")
    src = src.replace(old_frame, new_frame, 1)

    src = src.replace(
        '  window.addEventListener("keydown", (e) => {\n    keys.add(e.code);',
        '  window.addEventListener("keydown", (e) => {\n    if (!jumpShellActive()) return;\n    keys.add(e.code);',
        1,
    )
    src = src.replace(
        '  window.addEventListener("keyup", (e) => keys.delete(e.code));',
        '  window.addEventListener("keyup", (e) => {\n    if (!jumpShellActive()) return;\n    keys.delete(e.code);\n  });',
        1,
    )

    tail_old = """  showMainMenu();
  requestAnimationFrame(frame);
})();"""

    tail_new = """  function bootJump() {
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
})();"""

    if tail_old not in src:
        raise SystemExit("tail pattern mismatch — upstream game.js changed; edit sync script.")
    src = src.replace(tail_old, tail_new, 1)

    return src


def patch_jump_css(css: str) -> str:
    old_html = """html,
body {
  height: 100%;
  background: #0d1117;
  color: #e6edf3;
  font-family: "JetBrains Mono", "SF Mono", Consolas, monospace;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}"""

    new_html = """#game-shell-jump .jump-game-mount {
  height: 100%;
  min-height: 360px;
  background: #0d1117;
  color: #e6edf3;
  font-family: "JetBrains Mono", "SF Mono", Consolas, monospace;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  width: 100%;
  flex: 1;
}"""

    if old_html not in css:
        raise SystemExit("styles.css html/body block not found — edit sync script.")
    css = css.replace(old_html, new_html, 1)

    repls = [
        ("#ui.in-menu #hud", "#jump-ui.in-menu #jump-hud"),
        ("#overlay.hidden", "#jump-overlay.hidden"),
        ("#overlay-title", "#jump-overlay-title"),
        ("#overlay-msg", "#jump-overlay-msg"),
        ("#editor-info-panel", "#jump-editor-info-panel"),
        ("#editor-publish-btn", "#jump-editor-publish-btn"),
        ("#restart-btn:hover", "#jump-restart-btn:hover"),
        ("#restart-btn:active", "#jump-restart-btn:active"),
        ("#restart-btn", "#jump-restart-btn"),
        ("#loading.visible", "#jump-loading.visible"),
        ("#level-hud", "#jump-level-hud"),
        ("#pause-menu", "#jump-pause-menu"),
        ("#overlay", "#jump-overlay"),
        ("#loading", "#jump-loading"),
        ("#hint", "#jump-hint"),
        ("#hud", "#jump-hud"),
        ("#ui", "#jump-ui"),
        ("#game", "#game-jump"),
    ]
    for a, b in repls:
        css = css.replace(a, b)

    if "#game-jump-shell-jump" in css:
        css = css.replace("#game-jump-shell-jump", "#game-shell-jump", 1)

    extra = """
/* Wired into AI Arcade — back control sits above Jump UI */
.jump-arcade-back {
  position: fixed;
  top: 10px;
  left: 10px;
  z-index: 65;
  pointer-events: auto;
}
#game-shell-jump.game-shell {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  min-height: 100vh;
  min-height: 100dvh;
  width: 100%;
  max-width: 100%;
  background: #0d1117;
}
.jump-mobile-controls {
  display: none;
  position: fixed;
  left: 0;
  right: 0;
  bottom: max(10px, env(safe-area-inset-bottom, 0px));
  justify-content: center;
  align-items: stretch;
  gap: max(10px, 2vw);
  padding: 0 max(12px, env(safe-area-inset-left, 0px)) 0 max(12px, env(safe-area-inset-right, 0px));
  z-index: 62;
  pointer-events: none;
}
.jump-mobile-controls .jump-mctrl {
  pointer-events: auto;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  min-width: 4.5rem;
  min-height: 3rem;
  padding: 0.5rem 0.75rem;
  border-radius: 10px;
  border: 1px solid #30363d;
  background: rgba(22, 27, 34, 0.92);
  color: #e6edf3;
  font: 600 0.95rem inherit;
  cursor: pointer;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
}
.jump-mctrl-jump {
  min-width: 5.5rem;
  background: rgba(56, 139, 253, 0.35);
  border-color: #388bfd;
  color: #fff;
}
@media (max-width: 940px), (pointer: coarse) {
  .jump-mobile-controls {
    display: flex;
  }
}
"""
    return css + extra


def prefix_jump_markup(html_chunk: str) -> str:
    pairs = [
        ("editor-info-panel", "jump-editor-info-panel"),
        ("editor-toolbox-toggle", "jump-editor-toolbox-toggle"),
        ("editor-saved-select", "jump-editor-saved-select"),
        ("editor-playtest-btn", "jump-editor-playtest-btn"),
        ("menu-campaign-btn", "jump-menu-campaign-btn"),
        ("menu-random-btn", "jump-menu-random-btn"),
        ("menu-editor-btn", "jump-menu-editor-btn"),
        ("community-hud", "jump-community-hud"),
        ("loading-cancel-btn", "jump-loading-cancel-btn"),
        ("pause-continue-btn", "jump-pause-continue-btn"),
        ("editor-publish-btn", "jump-editor-publish-btn"),
        ("editor-import-btn", "jump-editor-import-btn"),
        ("editor-export-btn", "jump-editor-export-btn"),
        ("menu-play-btn", "jump-menu-play-btn"),
        ("editor-new-btn", "jump-editor-new-btn"),
        ("editor-save-btn", "jump-editor-save-btn"),
        ("pause-editor-btn", "jump-pause-editor-btn"),
        ("pause-menu-title", "jump-pause-menu-title"),
        ("level-editor", "jump-level-editor"),
        ("editor-palette", "jump-editor-palette"),
        ("editor-info-btn", "jump-editor-info-btn"),
        ("editor-done-btn", "jump-editor-done-btn"),
        ("pause-menu-btn", "jump-pause-menu-btn"),
        ("main-menu", "jump-main-menu"),
        ("mode-menu", "jump-mode-menu"),
        ("menu-back-btn", "jump-menu-back-btn"),
        ("level-hud", "jump-level-hud"),
        ("overlay-title", "jump-overlay-title"),
        ("overlay-msg", "jump-overlay-msg"),
        ("restart-btn", "jump-restart-btn"),
        ("pause-menu", "jump-pause-menu"),
        ("overlay", "jump-overlay"),
        ("loading", "jump-loading"),
    ]
    for old, new in pairs:
        html_chunk = html_chunk.replace(f'id="{old}"', f'id="{new}"')
        html_chunk = html_chunk.replace(f'aria-controls="{old}"', f'aria-controls="{new}"')
        html_chunk = html_chunk.replace(f'aria-labelledby="{old}"', f'aria-labelledby="{new}"')
    html_chunk = html_chunk.replace('id="hint"', 'id="jump-hint"')
    html_chunk = html_chunk.replace('id="hud"', 'id="jump-hud"')
    html_chunk = html_chunk.replace('id="ui"', 'id="jump-ui"')
    html_chunk = html_chunk.replace('id="game"', 'id="game-jump"')
    return html_chunk


def build_jump_shell_fragment(index_src: str) -> str:
    m = re.search(
        r'<body[^>]*>(.*)<script\s+src=["\']levels\.js["\']',
        index_src,
        re.S | re.I,
    )
    if not m:
        raise SystemExit("Could not extract body markup before levels.js")
    inner = m.group(1).strip()
    inner = prefix_jump_markup(inner)
    # Canvas: add tabindex/aria for arcade
    inner = inner.replace(
        '<canvas id="game-jump" width="960" height="540"></canvas>',
        '<canvas id="game-jump" width="960" height="540" tabindex="0" role="application" '
        'aria-label="Jump platformer. WASD or arrows, Space to jump."></canvas>',
        1,
    )
    mobile_bar = """    <div id="jump-mobile-controls" class="jump-mobile-controls" aria-label="Touch controls">
      <button type="button" class="jump-mctrl" data-key="ArrowLeft" aria-label="Move left">◀</button>
      <button type="button" class="jump-mctrl jump-mctrl-jump" data-key="Space" aria-label="Jump">Jump</button>
      <button type="button" class="jump-mctrl" data-key="ArrowRight" aria-label="Move right">▶</button>
    </div>
"""
    return f"""  <div id="game-shell-jump" class="game-shell hidden" hidden>
    <div class="jump-game-mount">
      <button type="button" class="btn-back jump-arcade-back" data-arcade-back>← Arcade</button>
{inner}
{mobile_bar}
    </div>
  </div>
"""


def replace_jump_shell(index_arcade: str, fragment: str) -> str:
    pattern = r'  <div id="game-shell-jump" class="game-shell hidden" hidden>.*?(?=\n\n  <script src="arcade.js">)'
    if not re.search(pattern, index_arcade, re.S):
        raise SystemExit("Could not find game-shell-jump block in index.html")
    return re.sub(pattern, fragment.rstrip(), index_arcade, count=1, flags=re.S)


def main() -> None:
    if not JUMP_SRC.is_dir():
        raise SystemExit(f"Missing source: {JUMP_SRC}")

    levels = (JUMP_SRC / "levels.js").read_text()
    (ROOT / "jump-levels.js").write_text(levels)

    game_src = (JUMP_SRC / "game.js").read_text()
    (ROOT / "jump-game.js").write_text(patch_game_js(game_src))

    css_src = (JUMP_SRC / "styles.css").read_text()
    (ROOT / "jump.css").write_text(patch_jump_css(css_src))

    index_src = (JUMP_SRC / "index.html").read_text()
    fragment = build_jump_shell_fragment(index_src)

    index_arcade = (ROOT / "index.html").read_text()
    index_arcade = replace_jump_shell(index_arcade, fragment)
    (ROOT / "index.html").write_text(index_arcade)

    print("Synced: jump-levels.js, jump-game.js, jump.css, index.html (Jump shell)")


if __name__ == "__main__":
    main()
