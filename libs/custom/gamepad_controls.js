/**
 * gamepad_controls.js — Gamepad navigation
 *
 * Author: (OpenHeritage3D / CHEI, UC San Diego)
 *
 * Description:
 *   Drives the Potree camera from a game controller through the Gamepad API
 *   (the "standard" layout: Xbox, PlayStation, Switch Pro and most modern
 *   pads). The controller follows the viewer's navigation mode instead of
 *   adding one of its own:
 *
 *     Orbit / Earth   left stick pans the orbit center over the ground,
 *                     right stick orbits around it, triggers zoom out / in,
 *                     bumpers lower / raise.
 *     Fly / Heli      left stick flies forward and sideways, right stick
 *                     looks around, triggers go down / up, bumpers change
 *                     the move speed (Potree's own, as in the sidebar).
 *
 *   In both, the left stick moves and the right stick turns the view, so
 *   switching modes (X) changes little. A crosshair marks the screen center,
 *   which is also the orbit center. A acts on what is under it: it opens
 *   the photo, 360° view or zone beacon there, and otherwise flies to the
 *   point (like Potree's double-click). B steps back: out of a photo, then
 *   to the view before the last jump. Y frames everything visible. The
 *   D-pad turns 90° and tilts in 45° steps. Inside a photo or 360° view its
 *   left / right step through the set and its up / down set the photo's
 *   opacity (Y cycles 100 / 50 / 0%), as the arrow, [ ] and C keys do; in a
 *   360° view the sticks look around and the triggers zoom.
 *
 *   Menu / Options goes to the toolbar and the open panels (Zones, Tools and
 *   the rest): the D-pad moves a highlight between their buttons, A presses
 *   the one highlighted, B closes its panel and then leaves. On a list or
 *   slider, A starts a change made with the D-pad. The sticks still move the
 *   camera meanwhile.
 *
 *   The toolbar's measuring tools and Point Inspector aim with the
 *   crosshair: while a measurement is being drawn, A adds a point under the
 *   crosshair and B finishes it, and the inspector reads the point under it.
 *
 *   Holding View / Share opens a quick wheel of the toolbar's most used
 *   tools (Zones, Point Inspector, distance and height, clear, material,
 *   images, crosshair): point at one with a stick and let go. A tap opens a
 *   guide instead (also Tools ▸ Gamepad Controls) with a live controller
 *   diagram, the mapping for both modes, and settings: invert look, look
 *   speed, swap sticks, vibration (kept in localStorage). The crosshair and
 *   status pill fade out while the mouse is in use.
 *
 * How it hooks in:
 *   Runs on the viewer's "update_start" event, inside viewer.update() and
 *   before the active controls update, and moves scene.view directly. The
 *   orbit and fly controls carry on from the moved view, so mouse, keyboard
 *   and controller work side by side. Camera moves started here (A, B, Y,
 *   D-pad) are animated by this file rather than TWEEN, so stick input can
 *   cancel them.
 *
 * Notes:
 *   Browsers only reveal a controller once one of its buttons is pressed
 *   with the page open. A cross-origin iframe also needs the "gamepad"
 *   permission: Chrome allows it by default, Firefox only for same-origin
 *   frames unless the embedding <iframe> has allow="gamepad".
 */

(function () {
    "use strict";

    const PANEL_ID = "gamepadPanel";
    const HUD_ID = "gamepadHud";
    const STORAGE_KEY = "oh3d.gamepadControls";
    const DEG = Math.PI / 180;

    // ══════════════════════════════════════════════════════════════
    //  Tuning
    // ══════════════════════════════════════════════════════════════
    const STICK_DEADZONE   = 0.15;   // radial, as a share of full deflection
    const STICK_FULL       = 0.95;   // deflection that counts as full (worn sticks fall short of 1)
    const STICK_CURVE      = 1.6;    // response exponent: fine control near the center
    const TRIGGER_DEADZONE = 0.06;
    const TRIGGER_CURVE    = 1.3;
    const EASE_LOOK        = 0.05;   // s, time constant easing turning in and out…
    const EASE_MOVE        = 0.12;   // …and moving

    const LOOK_YAW   = 2.4;          // rad/s at full deflection, times the Look speed setting
    const LOOK_PITCH = 1.6;
    const ORBIT_PAN  = 1.25;         // orbit radii per second
    const ORBIT_LIFT = 0.8;          // orbit radii per second (bumpers)
    const ORBIT_ZOOM = 1.6;          // a full trigger scales the radius by e^-1.6 per second
    const SPEED_STEP = 1.5;          // Fly speed factor per bumper press
    const PANO_ZOOM  = 70;           // 360° zoom levels (of 100) per second

    const MIN_RADIUS = 0.05;         // closest the orbit zoom gets to its center
    const MAX_RADIUS = 1e7;
    const MIN_JUMP   = 0.2;          // closest A lands to a point, as with Potree's double-click
    const AIM_ASSIST = 28;           // px: A also takes a marker centered this close to the crosshair
    const TILT_STEPS = [-90, -45, 0, 45, 90].map((d) => d * DEG);
    const OVERVIEW_PITCH = -30 * DEG; // Y looks down at least this steeply
    const HISTORY_MAX  = 30;
    const REPEAT_DELAY = 400;        // ms before a held button repeats (Fly speed, photo opacity)…
    const REPEAT_EVERY = 160;        // …and between repeats
    const NAV_DELAY    = 350;        // the same for the D-pad in the menus
    const NAV_EVERY    = 110;
    const SIDE_WEIGHT  = 3;          // in the menus, a step sideways counts this much more than one along the move
    const WHEEL_HOLD   = 250;        // ms holding View before the quick wheel opens (a tap opens the guide)
    const WHEEL_SIZE   = 380;        // px across
    const WHEEL_RING   = 135;        // px from its center to the options
    const SCAN_EVERY   = 200;        // ms between crosshair checks for markers (the HUD prompt)
    const LOOK_FOR_PAD = 500;        // ms between checks for a pad whose connect event went missing

    // ══════════════════════════════════════════════════════════════
    //  Buttons (standard mapping, https://w3c.github.io/gamepad/#remapping)
    // ══════════════════════════════════════════════════════════════
    const BTN = {
        A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7,
        VIEW: 8, MENU: 9, LS: 10, RS: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15,
    };

    // What each family prints on its buttons. Face buttons go by position
    // (A is always the bottom one), so on a Switch pad the bottom one reads "B".
    const LABELS = {
        xbox:        { A: "A", B: "B", X: "X", Y: "Y", LB: "LB", RB: "RB", LT: "LT", RT: "RT", VIEW: "View",  MENU: "Menu" },
        playstation: { A: "✕", B: "○", X: "□", Y: "△", LB: "L1", RB: "R1", LT: "L2", RT: "R2", VIEW: "Share", MENU: "Options" },
        nintendo:    { A: "B", B: "A", X: "Y", Y: "X", LB: "L",  RB: "R",  LT: "ZL", RT: "ZR", VIEW: "−",     MENU: "+" },
    };
    const SHARED_LABELS = { LS: "LS", RS: "RS", UP: "▲", DOWN: "▼", LEFT: "◀", RIGHT: "▶" };
    const FACE_KEYS = ["A", "B", "X", "Y"];

    // The guide's mapping table. MOVE and LOOK stand for whichever stick does
    // that job (Swap sticks flips them). "both" spans the Orbit and Fly columns.
    // "when" says where a row applies, so the guide lights only those rows:
    // nav on the point cloud (in the menus too), act on the point cloud outside
    // the menus, photo in a photo or 360° view, menu in the menus, any anywhere.
    const LEGEND = [
        { title: "Move and look" },
        { keys: ["MOVE"],          orbit: "Pan over the ground", fly: "Fly forward / sideways", when: "nav" },
        { keys: ["LOOK"],          orbit: "Orbit the center",    fly: "Look around",            when: "nav" },
        { keys: ["LT", "RT"],      orbit: "Zoom out / in",       fly: "Down / up",              when: "nav" },
        { keys: ["LB", "RB"],      orbit: "Down / up",           fly: "Slower / faster",        when: "nav" },
        { title: "Actions" },
        { keys: ["A"],             both: "Go to the spot under the crosshair, or open the photo, 360° view or zone there", when: "act" },
        { keys: ["B"],             both: "Back to the view before the last jump", when: "act" },
        { keys: ["Y"],             both: "Overview of everything visible",        when: "act" },
        { keys: ["X"],             orbit: "Switch to Fly",       fly: "Switch to Orbit",        when: "act" },
        { keys: ["LEFT", "RIGHT"], both: "Turn 90°",                              when: "act" },
        { keys: ["UP", "DOWN"],    both: "Tilt up / down 45°",                    when: "act" },
        { title: "In a photo or 360° view" },
        { keys: ["LEFT", "RIGHT"], both: "Previous / next photo",                 when: "photo" },
        { keys: ["UP", "DOWN"],    both: "More / less opaque",                    when: "photo" },
        { keys: ["Y"],             both: "Opacity 100 / 50 / 0%",                 when: "photo" },
        { keys: ["B"],             both: "Leave the photo",                       when: "photo" },
        { keys: ["MOVE", "LOOK"],  both: "Look around (360°)",                    when: "photo" },
        { keys: ["LT", "RT"],      both: "Zoom out / in (360°)",                  when: "photo" },
        { title: "Measuring" },
        { keys: ["A"],             both: "Add a point at the crosshair",          when: "measure" },
        { keys: ["B"],             both: "Finish (before the first point: cancel)", when: "measure" },
        { title: "Toolbar and panels" },
        { keys: ["MENU"],          both: "Go to the toolbar and panels, or back to the view", when: "any" },
        { keys: ["UP", "DOWN"],    both: "Move the highlight up / down",          when: "menu" },
        { keys: ["LEFT", "RIGHT"], both: "Move the highlight left / right",       when: "menu" },
        { keys: ["A"],             both: "Press it; on a list or slider, change it with the D-pad, then A", when: "menu" },
        { keys: ["B"],             both: "Close the panel, then leave the toolbar", when: "menu" },
        { title: "Quick wheel" },
        { keys: ["VIEW"],          both: "Tap: this guide. Hold: the quick wheel", when: "any" },
        { keys: ["MOVE", "LOOK"],  both: "Point at a tool, then let go of View to use it", when: "wheel" },
        { keys: ["B"],             both: "Close the wheel without choosing",       when: "wheel" },
    ];

    // ══════════════════════════════════════════════════════════════
    //  Settings (localStorage; private windows may refuse it)
    // ══════════════════════════════════════════════════════════════
    const settings = { invertY: false, lookSpeed: 1, swapSticks: false, vibration: true };
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
        settings.invertY = !!saved.invertY;
        settings.swapSticks = !!saved.swapSticks;
        if (saved.vibration !== undefined) settings.vibration = !!saved.vibration;
        const ls = Number(saved.lookSpeed);
        if (Number.isFinite(ls)) settings.lookSpeed = Math.min(2, Math.max(0.4, ls));
    } catch (_) {}

    function saveSettings() {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch (_) {}
    }

    // ══════════════════════════════════════════════════════════════
    //  Styles
    // ══════════════════════════════════════════════════════════════
    const css = document.createElement("style");
    css.textContent = `
/* ── HUD: inside #potree_render_area, over the canvas ──────── */
#gamepadHud {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 10001;              /* over the 360° overlay (10000), under the toolbar */
    color: #f2f2f7;
    font-family: 'Segoe UI', system-ui, sans-serif;
    font-size: 13px;
}
.gp-hud-main { opacity: 0; transition: opacity 0.25s ease; }
#gamepadHud.gp-on .gp-hud-main { opacity: 1; }

/* A white ring between dark ones, so it shows over bright and dark points alike */
.gp-crosshair {
    position: absolute;
    left: 50%; top: 50%;
    width: 20px; height: 20px;
    margin: -10px 0 0 -10px;
    box-sizing: border-box;
    border: 2px solid #fff;
    border-radius: 50%;
    box-shadow: 0 0 0 1.5px rgba(0,0,0,0.8), inset 0 0 0 1.5px rgba(0,0,0,0.8), 0 0 8px rgba(0,0,0,0.35);
    transition: transform 0.15s ease, border-color 0.15s ease;
}
.gp-crosshair::after {
    content: "";
    position: absolute;
    left: 50%; top: 50%;
    width: 4px; height: 4px;
    margin: -2px 0 0 -2px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 0 0 1.5px rgba(0,0,0,0.8);
}
#gamepadHud.gp-no-aim .gp-crosshair { display: none; }
#gamepadHud.gp-target .gp-crosshair { transform: scale(1.3); border-color: #a5b4fc; }

.gp-prompt {
    position: absolute;
    left: 50%; top: calc(50% + 24px);
    transform: translateX(-50%);
    display: none;
    align-items: center;
    gap: 7px;
    max-width: 70%;
    padding: 4px 12px 4px 5px;
    border-radius: 999px;
    background: rgba(20,20,26,0.88);
    border: 1px solid rgba(255,255,255,0.12);
    white-space: nowrap;
}
#gamepadHud.gp-target .gp-prompt { display: flex; }
.gp-prompt-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; color: #b4b4c0; }

.gp-status {
    position: absolute;
    left: 14px; bottom: 14px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 12px 5px 9px;
    border-radius: 999px;
    background: rgba(20,20,26,0.85);
    border: 1px solid rgba(255,255,255,0.12);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    white-space: nowrap;
}
.gp-status svg { width: 20px; height: 20px; flex: none; }
.gp-status-mode { font-weight: 600; }
.gp-status-extra { display: inline-flex; align-items: center; gap: 5px; color: #b4b4c0; }
.gp-status-extra:empty { display: none; }
.gp-status-sep { width: 1px; align-self: stretch; margin: 2px 2px; background: rgba(255,255,255,0.18); }
.gp-status-keys { display: inline-flex; align-items: center; gap: 5px; }
@media (max-width: 760px) { .gp-status-sep, .gp-status-keys { display: none; } }

.gp-toast {
    position: absolute;
    left: 50%; bottom: 72px;
    transform: translate(-50%, 6px);
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 7px 14px;
    border-radius: 10px;
    background: rgba(20,20,26,0.9);
    border: 1px solid rgba(255,255,255,0.12);
    white-space: nowrap;
    opacity: 0;
    transition: opacity 0.2s ease, transform 0.2s ease;
}
.gp-toast.gp-show { opacity: 1; transform: translate(-50%, 0); }

/* Clear the photo and 360° viewers' own bottom bars, and the title an
   embedded viewer shows at the bottom */
#gamepadHud.gp-photo .gp-status { bottom: 92px; }
#gamepadHud.gp-photo .gp-toast { bottom: 132px; }
.embedded #gamepadHud .gp-status { bottom: 66px; }
.embedded #gamepadHud .gp-toast { bottom: 112px; }

/* ── Menu highlight: at body level, so it shows over every panel ── */
#gamepadRing {
    position: fixed;
    left: 0; top: 0;
    z-index: 2147483647;
    pointer-events: none;
    box-sizing: border-box;
    border: 2px solid #a5b4fc;
    border-radius: 8px;
    box-shadow: 0 0 0 2px rgba(0,0,0,0.85), 0 0 14px rgba(129,140,248,0.75);
    opacity: 0;
    transition: opacity 0.15s ease, transform 0.1s ease, width 0.1s ease, height 0.1s ease;
}
#gamepadRing.gp-show { opacity: 1; }
/* Changing a list or slider with the D-pad */
#gamepadRing.gp-editing { border-color: #fbbf24; box-shadow: 0 0 0 2px rgba(0,0,0,0.85), 0 0 14px rgba(251,191,36,0.7); }

/* ── Quick wheel (hold View): at body level, over the canvas center ── */
#gamepadWheel {
    position: fixed;
    left: 50%; top: 50%;
    width: ${WHEEL_SIZE}px; height: ${WHEEL_SIZE}px;
    margin: -${WHEEL_SIZE / 2}px 0 0 -${WHEEL_SIZE / 2}px;
    z-index: 2147483646;
    pointer-events: none;
    color: #f2f2f7;
    font-family: 'Segoe UI', system-ui, sans-serif;
    opacity: 0;
    transform: scale(0.92);
    transition: opacity 0.12s ease, transform 0.12s ease;
}
#gamepadWheel.gp-show { opacity: 1; transform: scale(1); }
.gp-wheel-disc {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: rgba(20,20,26,0.9);
    box-shadow: 0 10px 44px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.14);
}
/* The chosen tool's slice of the ring */
.gp-wheel-wedge {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    -webkit-mask: radial-gradient(circle, transparent 0 30%, #000 30.5%);
    mask: radial-gradient(circle, transparent 0 30%, #000 30.5%);
    opacity: 0;
}
#gamepadWheel.gp-picked .gp-wheel-wedge { opacity: 1; }
.gp-wheel-hub {
    position: absolute;
    left: 50%; top: 50%;
    width: 112px; height: 112px;
    margin: -56px 0 0 -56px;
    box-sizing: border-box;
    padding: 10px;
    border-radius: 50%;
    background: rgba(32,32,40,0.96);
    box-shadow: inset 0 0 0 1px rgba(255,255,255,0.14);
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    font-size: 13px;
    font-weight: 600;
    line-height: 1.25;
}
.gp-wheel-slot {
    position: absolute;
    width: 84px;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    text-align: center;
    font-size: 12px;
    line-height: 1.2;
    color: #c4c4ce;
}
.gp-wheel-icon { width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; transition: transform 0.1s ease; }
.gp-wheel-icon img { width: 26px; height: 26px; object-fit: contain; filter: brightness(2) drop-shadow(0 0 2px rgba(0,0,0,0.5)); }
.gp-wheel-icon svg { width: 24px; height: 24px; }
.gp-wheel-slot.gp-pick { color: #fff; font-weight: 600; }
.gp-wheel-slot.gp-pick .gp-wheel-icon { transform: scale(1.15); }
.gp-wheel-slot.gp-off { opacity: 0.35; }
.gp-wheel-hint {
    position: absolute;
    left: 50%; top: 100%;
    transform: translate(-50%, 10px);
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 5px 12px;
    border-radius: 999px;
    background: rgba(20,20,26,0.9);
    border: 1px solid rgba(255,255,255,0.12);
    color: #b4b4c0;
    font-size: 13px;
    white-space: nowrap;
}

/* ── Button chips (HUD, toasts, guide) ──────────────────────── */
.gp-chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
    min-width: 22px;
    height: 22px;
    padding: 0 6px;
    box-sizing: border-box;
    border-radius: 6px;
    background: rgba(255,255,255,0.14);
    box-shadow: inset 0 0 0 1px rgba(255,255,255,0.22);
    color: #fff;
    font: 600 12px/1 'Segoe UI', system-ui, sans-serif;
    vertical-align: middle;
}
.gp-chip.gp-face { width: 22px; padding: 0; border-radius: 50%; }
.gp-fam-xbox .gp-chip[data-key="A"] { background: #2e8b3a; }
.gp-fam-xbox .gp-chip[data-key="B"] { background: #c0392b; }
.gp-fam-xbox .gp-chip[data-key="X"] { background: #2f6fc2; }
.gp-fam-xbox .gp-chip[data-key="Y"] { background: #e2b31c; color: #1a1a1a; }
.gp-fam-playstation .gp-chip.gp-face { font-size: 14px; }
.gp-fam-playstation .gp-chip[data-key="A"] { color: #9cc0ff; }
.gp-fam-playstation .gp-chip[data-key="B"] { color: #ff8a8a; }
.gp-fam-playstation .gp-chip[data-key="X"] { color: #f7aed6; }
.gp-fam-playstation .gp-chip[data-key="Y"] { color: #6fe0bd; }

/* ── Guide panel (framed by panel_window_manager.js) ────────── */
#gamepadPanel {
    position: fixed;
    top: 80px;
    right: 10px;
    width: 420px;
    display: flex;
    flex-direction: column;
    background: rgba(20, 20, 26, 0.9);
    backdrop-filter: blur(14px) saturate(140%);
    -webkit-backdrop-filter: blur(14px) saturate(140%);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 14px;
    box-shadow: 0 10px 44px rgba(0,0,0,0.6);
    z-index: 10001;
    color: #e6e6ec;
    font-family: 'Segoe UI', system-ui, sans-serif;
    font-size: 13px;
}
/* Mostly text, so near-opaque over the point cloud */
.pwm-frame:has(> .pwm-body > #gamepadPanel) { background: rgba(20, 20, 26, 0.9); }

/* Own header, only seen if the window manager isn't loaded */
.gp-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    border-bottom: 1px solid rgba(255,255,255,0.08);
}
.gp-title { font-size: 14px; font-weight: 600; color: #f2f2f7; }
.gp-close {
    width: 26px; height: 26px;
    border: none; border-radius: 6px;
    background: transparent; color: #b4b4c0;
    cursor: pointer; font-size: 18px; line-height: 1;
}
.gp-close:hover { background: rgba(220, 38, 38, 0.3); color: #f87171; }

.gp-content { display: flex; flex-direction: column; gap: 10px; padding: 12px 14px 14px; }

.gp-conn { display: flex; align-items: center; gap: 8px; color: #b4b4c0; }
.gp-conn-dot { flex: none; width: 8px; height: 8px; border-radius: 50%; background: #6b6b78; }
.gp-conn.gp-live { color: #f2f2f7; }
.gp-conn.gp-live .gp-conn-dot { background: #4ade80; box-shadow: 0 0 6px rgba(74,222,128,0.8); }
.gp-conn-warn { color: #fbbf24; }

.gp-diagram { display: block; width: 100%; max-width: 360px; height: auto; margin: 0 auto; }
.gp-diagram .gp-shell { fill: rgba(255,255,255,0.05); stroke: rgba(255,255,255,0.34); stroke-width: 1.5; }
.gp-diagram .gp-part { fill: rgba(255,255,255,0.08); stroke: rgba(255,255,255,0.38); stroke-width: 1.2; transition: fill 0.08s ease; }
.gp-diagram .gp-part.on { fill: #818cf8; stroke: #c7d2fe; }
.gp-diagram .gp-deco { fill: rgba(255,255,255,0.06); stroke: rgba(255,255,255,0.22); stroke-width: 1; }
.gp-diagram .gp-fill { fill: #818cf8; }
.gp-diagram text {
    fill: #e6e6ec;
    font: 600 11px 'Segoe UI', system-ui, sans-serif;
    text-anchor: middle;
    dominant-baseline: central;
    pointer-events: none;
}

.gp-table { width: 100%; border-collapse: collapse; }
.gp-table th { padding: 2px 6px 4px; text-align: left; font-size: 12px; font-weight: 600; color: #b4b4c0; }
.gp-table th.gp-cur { color: #c7d2fe; }
.gp-table th.gp-cur::after { content: " ●"; font-size: 9px; vertical-align: 2px; }
.gp-table td { padding: 4px 6px; line-height: 1.35; color: #c4c4ce; vertical-align: middle; }
.gp-table td.gp-cur { color: #f2f2f7; }
.gp-table td.gp-keys { width: 1%; white-space: nowrap; }
.gp-table td.gp-keys .gp-chip + .gp-chip { margin-left: 3px; }
.gp-table tr.gp-group td {
    padding: 10px 6px 3px;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    color: #b4b4c0;
}
.gp-table tr.gp-live td { background: rgba(129,140,248,0.2); color: #fff; }
.gp-table tr.gp-live td:first-child { border-radius: 6px 0 0 6px; }
.gp-table tr.gp-live td:last-child { border-radius: 0 6px 6px 0; }

.gp-settings {
    display: grid;
    gap: 8px;
    padding-top: 10px;
    border-top: 1px solid rgba(255,255,255,0.08);
}
.gp-settings label { display: flex; align-items: center; gap: 8px; cursor: pointer; color: #e6e6ec; }
.gp-settings input[type="checkbox"] { width: 15px; height: 15px; margin: 0; accent-color: #818cf8; }
.gp-settings input[type="range"] { flex: 1; min-width: 0; accent-color: #818cf8; }
.gp-settings output { min-width: 36px; text-align: right; color: #b4b4c0; font-variant-numeric: tabular-nums; }
`;
    (document.head || document.documentElement).appendChild(css);

    // ══════════════════════════════════════════════════════════════
    //  State
    // ══════════════════════════════════════════════════════════════
    let polling = false;            // a controller has shown up at some point
    let activeIndex = -1;           // navigator.getGamepads() index of the pad in charge
    let pad = null;                 // its latest snapshot
    let family = "xbox";
    let prev = [];                  // button states last frame
    let lastInput = null;           // last frame's raw input, for the guide's diagram
    const repeatAt = {};            // held-bumper repeat times, by button index

    // Eased inputs, -1…1 (trig and lift are RT − LT and RB − LB)
    const eased = { moveX: 0, moveY: 0, lookX: 0, lookY: 0, trig: 0, lift: 0 };

    let anim = null;                // camera move animated by this file
    const history = [];             // poses to go back to (B)

    let padUsedAt = -Infinity;      // the HUD shows while the pad was used more recently…
    let pointerUsedAt = -Infinity;  // …than the mouse
    let hudHidden = false;          // holding the View button
    let hudMarker = null;           // marker under the crosshair, for the prompt
    let lastScan = 0;
    let lastLook = 0;               // last look for a pad without a connect event
    let viewDownAt = 0;             // when View went down (0 once it has acted)
    let padWasActive = false;       // the pad in use, rather than the mouse, last frame
    let aimedKey = "";              // marker and camera the measuring marker was last aimed from
    let inspectedFrom = "";         // camera the Point Inspector last read the crosshair from

    let wheel = null;               // quick wheel element refs, once built
    let wheelOpen = false;
    let wheelCtx = null;
    let wheelPick = -1;             // option the stick last pointed at

    // The menus (Menu button): the D-pad and A / B work the toolbar and panels
    let menuOn = false;
    let menuCtx = null;             // context they were entered in; a change ends them
    let menuFocus = null;           // element highlighted
    let menuRect = null;            // where it was, to find a stand-in if it goes
    let menuLast = null;            // highlighted when last left, to start there next time
    let menuReturn = null;          // had focus before (the canvas, usually)
    let menuSeen = null;            // document.activeElement as last seen, to notice others moving focus
    let menuOpeners = [];           // buttons whose panel the highlight followed into, for B
    let menuPending = null;         // after A: watching for a panel it opens
    let editing = null;             // <select> or range being changed with the D-pad
    let ring = null;                // the highlight
    let ringSig = "";

    let hud = null;                 // HUD element refs
    let panel = null;               // #gamepadPanel while open
    let guide = null;               // its live element refs

    // ══════════════════════════════════════════════════════════════
    //  Reading the controller
    // ══════════════════════════════════════════════════════════════
    function padFamily(p) {
        const id = String((p && p.id) || "").toLowerCase();
        if (/054c|playstation|dualshock|dualsense/.test(id)) return "playstation";
        if (/057e|nintendo|pro controller|joy-con/.test(id)) return "nintendo";
        return "xbox";
    }

    /** "Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e …)" → "Xbox Wireless Controller" */
    function padName(p) {
        const name = String(p.id || "")
            .replace(/\s*\([^)]*(?:STANDARD GAMEPAD|Vendor:)[^)]*\)\s*$/i, "")   // Chrome
            .replace(/^[0-9a-f]{1,4}-[0-9a-f]{1,4}-/i, "")                         // Firefox
            .trim();
        return name || "Controller";
    }

    const isDown = (b) => !!b && (b.pressed || b.value > 0.5);

    /**
     * Something on this pad is being pressed or pushed. Axes only count on
     * standard pads: some other HID devices report as gamepads with axes
     * stuck at ±1, and those must not grab control.
     */
    function hasInput(p) {
        if (p.buttons.some(isDown)) return true;
        return p.mapping === "standard" && p.axes.slice(0, 4).some((a) => Math.abs(a) > 0.5);
    }

    /** The pad to listen to this frame: the one in use, else the last one used. */
    function choosePad() {
        let pads;
        try {
            pads = navigator.getGamepads ? Array.from(navigator.getGamepads()) : [];
        } catch (_) {
            return null;   // blocked by Permissions-Policy (a cross-origin iframe)
        }
        pads = pads.filter((p) => p && p.connected);
        if (pads.length === 0) return null;

        const current = pads.find((p) => p.index === activeIndex);
        const busy = pads.filter(hasInput);
        // A standard pad in use outranks other devices: some that report as
        // gamepads hold a button down for good, and must not keep control
        const std = busy.find((p) => p.mapping === "standard");
        if (current && busy.includes(current) && (!std || current.mapping === "standard")) return current;
        return std || current || busy[0]
            || pads.find((p) => p.mapping === "standard") || pads[0];
    }

    /** Radial deadzone, rescaled so motion starts at zero, then the response curve. Up is +y. */
    function readStick(axes, ix, iy) {
        const x = axes[ix] || 0, y = -(axes[iy] || 0);
        const m = Math.hypot(x, y);
        if (m <= STICK_DEADZONE) return { x: 0, y: 0, m: 0 };
        const n = Math.min(1, (m - STICK_DEADZONE) / (STICK_FULL - STICK_DEADZONE));
        const c = Math.pow(n, STICK_CURVE);
        return { x: x / m * c, y: y / m * c, m: c };
    }

    function readTrigger(b) {
        const v = !b ? 0 : (typeof b.value === "number" ? b.value : (b.pressed ? 1 : 0));
        if (v <= TRIGGER_DEADZONE) return 0;
        return Math.pow(Math.min(1, (v - TRIGGER_DEADZONE) / (1 - TRIGGER_DEADZONE)), TRIGGER_CURVE);
    }

    function readInput(p) {
        const left = readStick(p.axes, 0, 1);
        const right = readStick(p.axes, 2, 3);
        return {
            move: settings.swapSticks ? right : left,
            look: settings.swapSticks ? left : right,
            lt: readTrigger(p.buttons[BTN.LT]),
            rt: readTrigger(p.buttons[BTN.RT]),
            down: p.buttons.map(isDown),
            axes: p.axes,
        };
    }

    function rumble(ms = 70, strong = 0.15, weak = 0.35) {
        const act = settings.vibration && pad && pad.vibrationActuator;
        if (!act || typeof act.playEffect !== "function") return;
        try {
            const done = act.playEffect("dual-rumble", {
                duration: ms, startDelay: 0, strongMagnitude: strong, weakMagnitude: weak,
            });
            if (done && done.catch) done.catch(() => {});
        } catch (_) {}
    }

    // ══════════════════════════════════════════════════════════════
    //  Per frame
    // ══════════════════════════════════════════════════════════════
    /**
     * What the controller is steering:
     *   orbit — Orbit or Earth controls     fly   — Fly or Helicopter
     *   photo — locked to an oriented image pano  — inside a 360° view
     *   off   — VR, device orientation, anything else
     */
    function context() {
        if (viewer.renderer.xr && viewer.renderer.xr.isPresenting) return "off";
        if (window.in360View) return "pano";
        const c = viewer.getControls();
        if (c && typeof c.hasSomethingCaptured === "function" && c.hasSomethingCaptured()) return "photo";
        if (c === viewer.fpControls) return "fly";
        if (c === viewer.orbitControls || c === viewer.earthControls) return "orbit";
        return "off";
    }

    function onUpdateStart(e) {
        const dt = Math.min(Math.max(Number(e.delta) || 0, 0), 0.1);
        const now = performance.now();

        // The connect event can go missing; look for a pad now and then as well
        if (!polling && now - lastLook >= LOOK_FOR_PAD) {
            lastLook = now;
            const p = choosePad();
            if (p) onConnected({ gamepad: p });
        }

        if (polling) {
            const p = choosePad();
            if (p) frame(p, dt);
            else if (pad) lostPad();
        }

        // Panels slide, scroll and re-render under the highlight, pad in use or not
        if (menuOn) menuFrame(now);
        stepAnimation();
    }

    function frame(p, dt) {
        if (p.index !== activeIndex) {
            activeIndex = p.index;
            // Buttons already held on the new pad must not fire
            prev = p.buttons.map(isDown);
            setFamily(padFamily(p));
        }
        pad = p;

        const now = performance.now();
        const input = readInput(p);
        const down = input.down;
        const pressed = (i) => down[i] && !prev[i];
        const ctx = context();

        const steering = input.move.m > 0 || input.look.m > 0 || input.lt > 0 || input.rt > 0
            || (ctx === "orbit" && (down[BTN.LB] || down[BTN.RB]));
        // Presses, not holds: some devices hold a button down for good
        if (steering || down.some((d, i) => d && !prev[i])) padUsedAt = now;
        // Taking the sticks cancels a move in progress
        if (steering && anim) anim = null;

        if (pressed(BTN.MENU) && !wheelOpen) toggleMenu(ctx);
        viewButton(down, now, ctx);
        // Opening or leaving a photo or 360° view ends the menus: its D-pad is needed there
        if (menuOn && ctx !== menuCtx) leaveMenu(false);

        const onCloud = ctx === "orbit" || ctx === "fly";
        const measuring = onCloud && !menuOn && !wheelOpen ? placing() : null;
        const padActive = padUsedAt >= pointerUsedAt;
        if (padActive && !padWasActive) aimedKey = inspectedFrom = "";   // back from the mouse: re-aim
        padWasActive = padActive;
        if (padActive && measuring) aimMarker(false);
        if (padActive && onCloud) feedInspector();

        if (wheelOpen) {
            wheelInput(input, pressed);
        } else if (menuOn) {
            menuInput(pressed, down, now);
        } else {
            if (pressed(BTN.B)) {
                if (measuring) finishMeasure(measuring);
                else back(ctx);
            }
            if (onCloud) {
                if (pressed(BTN.A)) {
                    if (measuring) placePoint();
                    else actAtCrosshair(ctx);
                }
                if (pressed(BTN.Y)) overview(ctx);
                if (pressed(BTN.X)) switchMode(ctx);
                if (pressed(BTN.LEFT)) turnStep(ctx, -1);
                if (pressed(BTN.RIGHT)) turnStep(ctx, 1);
                if (pressed(BTN.UP)) tiltStep(ctx, 1);
                if (pressed(BTN.DOWN)) tiltStep(ctx, -1);
            } else if (ctx === "photo" || ctx === "pano") {
                if (pressed(BTN.LEFT)) stepPhoto(ctx, -1);
                if (pressed(BTN.RIGHT)) stepPhoto(ctx, 1);
                if (repeating(BTN.UP, down, now)) opacityKey(ctx, "]");
                if (repeating(BTN.DOWN, down, now)) opacityKey(ctx, "[");
                if (pressed(BTN.Y)) opacityKey(ctx, "c");
            }
        }
        // Not the D-pad or face buttons, so these work in the menus too
        if (ctx === "fly" && !wheelOpen) {
            if (repeating(BTN.LB, down, now)) changeSpeed(1 / SPEED_STEP);
            if (repeating(BTN.RB, down, now)) changeSpeed(SPEED_STEP);
        }

        // Ease the analog inputs in and out
        const lift = ctx === "orbit" ? (down[BTN.RB] ? 1 : 0) - (down[BTN.LB] ? 1 : 0) : 0;
        easeTo("moveX", input.move.x, EASE_MOVE, dt);
        easeTo("moveY", input.move.y, EASE_MOVE, dt);
        easeTo("lookX", input.look.x, EASE_LOOK, dt);
        easeTo("lookY", input.look.y, EASE_LOOK, dt);
        easeTo("trig", input.rt - input.lt, EASE_MOVE, dt);
        easeTo("lift", lift, EASE_MOVE, dt);

        if (anim || wheelOpen) {
            // A move is playing, or the sticks point at the wheel; drop the easing tails so nothing lurches
            for (const k in eased) eased[k] = 0;
        } else if (ctx === "orbit") {
            orbit(dt);
        } else if (ctx === "fly") {
            fly(dt);
        } else if (ctx === "pano") {
            pano(dt);
        }

        prev = down;
        lastInput = input;
        updateHud(ctx, now);
        if (guide) updateGuide(input, ctx);
    }

    function easeTo(key, target, tau, dt) {
        let v = eased[key] + (target - eased[key]) * (1 - Math.exp(-dt / tau));
        // Once released, stop at 1% instead of creeping on (and firing camera_changed) for a second
        if (target === 0 && Math.abs(v) < 0.01) v = 0;
        eased[key] = v;
    }

    /** True on the press, then again every `every` ms after `delay` while held. */
    function repeating(i, down, now, delay = REPEAT_DELAY, every = REPEAT_EVERY) {
        if (!down[i]) return false;
        if (!prev[i]) {
            repeatAt[i] = now + delay;
            return true;
        }
        if (now >= repeatAt[i]) {
            repeatAt[i] = now + every;
            return true;
        }
        return false;
    }

    /** View: a tap opens the guide; held, it opens the quick wheel, and letting go uses its choice. */
    function viewButton(down, now, ctx) {
        if (down[BTN.VIEW] && !prev[BTN.VIEW]) viewDownAt = now;
        if (!viewDownAt) return;
        if (!down[BTN.VIEW]) {
            viewDownAt = 0;
            if (wheelOpen) closeWheel(true);
            else toggleHelp();
        } else if (!wheelOpen && now - viewDownAt >= WHEEL_HOLD) {
            openWheel(ctx);
        }
    }

    function lostPad() {
        leaveMenu(false);
        if (wheelOpen) closeWheel(false);
        viewDownAt = 0;
        pad = null;
        activeIndex = -1;
        prev = [];
        lastInput = null;
        for (const k in eased) eased[k] = 0;
        hudMarker = null;
        if (hud) hud.root.classList.remove("gp-on", "gp-target");
        if (guide) refreshConnection();
    }

    // ══════════════════════════════════════════════════════════════
    //  Steering
    // ══════════════════════════════════════════════════════════════
    const lookRate = () => settings.lookSpeed;
    const invert = () => (settings.invertY ? -1 : 1);

    /** View.direction for a given yaw and pitch, without touching the view. */
    function direction(yaw, pitch) {
        const c = Math.cos(pitch);
        return new THREE.Vector3(-Math.sin(yaw) * c, Math.cos(yaw) * c, Math.sin(pitch));
    }

    // Orbit / Earth: the left stick pans the orbit center over the ground (its
    // heading, not the tilted view, so it stays map-like from above), the
    // right stick turns the view around the center, triggers change the
    // distance to it, bumpers lift the whole rig.
    function orbit(dt) {
        const view = viewer.scene.view;
        const r = view.radius;
        const pivot = view.getPivot();

        view.yaw -= eased.lookX * LOOK_YAW * lookRate() * dt;
        view.pitch += eased.lookY * invert() * LOOK_PITCH * lookRate() * dt;

        const step = r * ORBIT_PAN * dt;
        const cy = Math.cos(view.yaw), sy = Math.sin(view.yaw);
        pivot.x += (cy * eased.moveX - sy * eased.moveY) * step;
        pivot.y += (sy * eased.moveX + cy * eased.moveY) * step;
        pivot.z += eased.lift * r * ORBIT_LIFT * dt;

        // Never pushes a radius that is already under MIN_RADIUS back out
        const zoomed = r * Math.exp(-eased.trig * ORBIT_ZOOM * dt);
        view.radius = Math.min(MAX_RADIUS, Math.max(Math.min(MIN_RADIUS, r), zoomed));
        view.position.copy(pivot).sub(view.direction.multiplyScalar(view.radius));
    }

    // Fly / Helicopter: Potree's move speed (the sidebar slider) at full
    // deflection. Helicopter keeps forward level, as its keyboard does.
    function fly(dt) {
        const view = viewer.scene.view;

        view.yaw -= eased.lookX * LOOK_YAW * lookRate() * dt;
        view.pitch += eased.lookY * invert() * LOOK_PITCH * lookRate() * dt;

        const speed = viewer.getMoveSpeed();
        const forward = viewer.fpControls.lockElevation
            ? direction(view.yaw, 0)
            : view.direction;
        view.position
            .addScaledVector(forward, eased.moveY * speed * dt)
            .addScaledVector(view.getSide(), eased.moveX * speed * dt);
        view.position.z += eased.trig * speed * dt;
    }

    // 360° view: either stick looks around, triggers zoom. Turning slows as
    // the view zooms in, so it feels the same at any zoom.
    function pano(dt) {
        const psv = window.viewer360;
        if (!psv || typeof psv.getPosition !== "function") return;

        const zoom = psv.getZoomLevel();
        const x = Math.max(-1, Math.min(1, eased.moveX + eased.lookX));
        const y = Math.max(-1, Math.min(1, eased.moveY + eased.lookY));
        if (x || y) {
            const rate = lookRate() * (1 - zoom / 150);
            const pos = psv.getPosition();
            psv.rotate({
                yaw: pos.yaw + x * LOOK_YAW * rate * dt,
                pitch: pos.pitch + y * invert() * LOOK_PITCH * rate * dt,
            });
        }
        if (eased.trig) {
            psv.zoom(Math.max(0, Math.min(100, zoom + eased.trig * PANO_ZOOM * dt)));
        }
    }

    function changeSpeed(factor) {
        const speed = Math.min(1e6, Math.max(0.01, viewer.getMoveSpeed() * factor));
        viewer.setMoveSpeed(speed);
        toast(["Speed " + formatSpeed(speed)], 1000);
    }

    function formatSpeed(v) {
        // Move speed is in data units; show it in Potree's display unit
        const unit = viewer.lengthUnit, shown = viewer.lengthUnitDisplay || unit;
        const value = v / ((unit && unit.unitspermeter) || 1) * ((shown && shown.unitspermeter) || 1);
        const digits = value < 1 ? 2 : value < 10 ? 1 : 0;
        return value.toFixed(digits) + " " + ((shown && shown.code) || "m") + "/s";
    }

    // ══════════════════════════════════════════════════════════════
    //  Camera moves (A, B, Y, D-pad)
    // ══════════════════════════════════════════════════════════════
    // A pose is { position, pivot, yaw, pitch, radius, speed }. "orbit" moves
    // swing around the pivot (turns and tilts while orbiting); "eye" moves
    // the camera itself (jumps, and turns in place while flying). Radius
    // eases on a log scale so long zooms don't rush the last stretch.

    function currentPose() {
        const v = viewer.scene.view;
        return {
            position: v.position.clone(),
            pivot: v.getPivot(),
            yaw: v.yaw,
            pitch: v.pitch,
            radius: v.radius,
            speed: viewer.getMoveSpeed(),
        };
    }

    function clonePose(p) {
        return Object.assign({}, p, { position: p.position.clone(), pivot: p.pivot.clone() });
    }

    const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
    const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);
    const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

    /**
     * opts: kind ("eye" | "orbit"), duration (ms), ease, step (a D-pad step,
     * which the next press continues from), pushed (this move put its start
     * in the history), wrapYaw (take the short way round; default true),
     * done (called on arrival).
     */
    function animateTo(to, opts = {}) {
        const from = currentPose();
        const kind = opts.kind || "eye";
        const target = clonePose(to);
        if (opts.wrapYaw !== false) target.yaw = from.yaw + wrapAngle(to.yaw - from.yaw);

        // Make the target self-consistent for the kind of move
        const dir = direction(target.yaw, target.pitch);
        if (kind === "orbit") target.position.copy(target.pivot).addScaledVector(dir, -target.radius);
        else target.pivot.copy(target.position).addScaledVector(dir, target.radius);

        anim = {
            kind, from, to: target,
            start: performance.now(),
            duration: opts.duration || 600,
            ease: opts.ease || easeOutQuart,
            step: !!opts.step,
            pushed: !!opts.pushed,
            done: opts.done || null,
        };
    }

    function stepAnimation() {
        if (!anim) return;
        const a = anim;
        const t = Math.min(1, (performance.now() - a.start) / a.duration);
        const k = a.ease(t);
        const view = viewer.scene.view;

        const r0 = Math.log(Math.max(1e-6, a.from.radius));
        const r1 = Math.log(Math.max(1e-6, a.to.radius));
        view.yaw = a.from.yaw + (a.to.yaw - a.from.yaw) * k;
        view.pitch = a.from.pitch + (a.to.pitch - a.from.pitch) * k;
        view.radius = Math.exp(r0 + (r1 - r0) * k);

        if (a.kind === "orbit") {
            const pivot = a.from.pivot.clone().lerp(a.to.pivot, k);
            view.position.copy(pivot).sub(view.direction.multiplyScalar(view.radius));
        } else {
            view.position.copy(a.from.position).lerp(a.to.position, k);
        }

        if (t >= 1) {
            anim = null;
            if (a.done) a.done();
        }
    }

    /** Where a D-pad step starts: the end of the step still playing, so quick presses add up. */
    function stepBase() {
        return anim && anim.step ? clonePose(anim.to) : currentPose();
    }

    /** Remember where we are before a jump, unless a jump already in flight did. */
    function pushHistory() {
        if (anim && anim.pushed) return;
        const p = currentPose();
        const last = history[history.length - 1];
        if (last
            && last.position.distanceTo(p.position) <= 1e-3 * Math.max(1, p.radius)
            && Math.abs(wrapAngle(last.yaw - p.yaw)) < 1e-3
            && Math.abs(last.pitch - p.pitch) < 1e-3) return;
        history.push(p);
        if (history.length > HISTORY_MAX) history.shift();
    }

    function turnStep(ctx, dir) {
        const base = stepBase();
        base.yaw -= dir * Math.PI / 2;   // yaw grows to the left
        animateTo(base, {
            kind: ctx === "orbit" ? "orbit" : "eye",
            duration: 450, ease: easeInOutCubic, step: true, wrapYaw: false,
        });
    }

    function tiltStep(ctx, dir) {
        const base = stepBase();
        const eps = 2 * DEG;
        const pitch = dir > 0
            ? TILT_STEPS.find((a) => a > base.pitch + eps)
            : TILT_STEPS.slice().reverse().find((a) => a < base.pitch - eps);
        if (pitch === undefined) {
            rumble(40, 0.1, 0.25);   // already straight up / down
            return;
        }
        base.pitch = pitch;
        animateTo(base, {
            kind: ctx === "orbit" ? "orbit" : "eye",
            duration: 450, ease: easeInOutCubic, step: true, wrapYaw: false,
        });
    }

    /** Frame every visible cloud, keeping the heading and looking down at least OVERVIEW_PITCH. */
    function overview(ctx) {
        const clouds = viewer.scene.pointclouds.filter((pc) => pc.visible);
        if (clouds.length === 0) {
            toast(["Nothing to frame yet"]);
            return;
        }
        const box = viewer.getBoundingBox(clouds);
        if (box.isEmpty()) return;
        const sphere = box.getBoundingSphere(new THREE.Sphere());

        // The distance PerspectiveCamera.zoomTo() (Potree's "fit to screen") would use
        const camera = viewer.scene.getActiveCamera();
        let fov = (camera.fov || viewer.getFOV()) * DEG;
        if (camera.aspect < 1) fov *= camera.aspect;
        const radius = Math.max(MIN_JUMP, sphere.radius / Math.sin(fov / 2));

        const view = viewer.scene.view;
        const yaw = view.yaw, pitch = Math.min(view.pitch, OVERVIEW_PITCH);
        const position = new THREE.Vector3().copy(sphere.center).addScaledVector(direction(yaw, pitch), -radius);

        pushHistory();
        animateTo(
            { position, pivot: new THREE.Vector3().copy(sphere.center), yaw, pitch, radius },
            { duration: 900, pushed: true, done: ctx === "fly" ? () => viewer.setMoveSpeed(radius / 2.5) : null }
        );
    }

    function back(ctx) {
        if (panel) {
            closeHelp();
            return;
        }
        if (ctx === "pano") {
            if (typeof window.close360 === "function") window.close360();
            return;
        }
        if (ctx === "photo") {
            viewer.getControls().release();
            return;
        }
        if (ctx !== "orbit" && ctx !== "fly") return;

        const pose = history.pop();
        if (!pose) {
            toast(["No earlier view to go back to"]);
            rumble();
            return;
        }
        animateTo(pose, {
            duration: 800,
            done: ctx === "fly" ? () => viewer.setMoveSpeed(pose.speed) : null,
        });
    }

    function switchMode(ctx) {
        anim = null;
        if (ctx === "orbit") {
            viewer.setControls(viewer.fpControls);
            toast(["Fly", "· press", { key: "X" }, "for Orbit"]);
        } else {
            // Orbit around what the crosshair is on, not the point Fly happened
            // to leave three move-speeds ahead
            const hit = pickAtCrosshair();
            viewer.setControls(viewer.orbitControls);
            if (hit && hit.depth > MIN_JUMP) viewer.scene.view.radius = hit.depth;
            toast(["Orbit", "· press", { key: "X" }, "for Fly"]);
        }
        rumble(40, 0.05, 0.2);
    }

    function stepPhoto(ctx, offset) {
        if (ctx === "photo") {
            const images = viewer.getControls().orientedImagesInstance;
            if (images && typeof images.focusByOffset === "function") images.focusByOffset(offset);
        } else {
            // marker_360_image.js keeps navigate360() to itself
            pressKey(offset < 0 ? "ArrowLeft" : "ArrowRight");
        }
    }

    // The photo bar (oriented_image_panel.js) and the 360° viewer keep these
    // actions to themselves; their keys are the way in
    function pressKey(key) {
        document.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
    }

    /** "[" and "]" step the photo's or panorama's opacity by 10%, "c" cycles it 100 / 50 / 0%. */
    function opacityKey(ctx, key) {
        pressKey(key);
        const slider = document.querySelector("#viewer-360 .psv-oi-slider");
        const v = ctx === "photo" ? (window.orientedImageState || {}).opacity
            : slider && Number(slider.value) / 100;
        if (Number.isFinite(v)) toast(["Opacity " + Math.round(v * 100) + "%"], 900);
    }

    // ══════════════════════════════════════════════════════════════
    //  Menus: the toolbar and open panels from the D-pad
    //
    //  The highlight is real keyboard focus, so a panel that moves focus
    //  itself (Tools, Zones) carries it along, and Tab and Enter still work.
    //  The next one is found on screen, as the nearest focusable thing that
    //  way, whatever panel it is in.
    // ══════════════════════════════════════════════════════════════
    const FOCUSABLE = "button, a[href], input:not([type=hidden]), select, textarea, [tabindex]";
    // What a highlight can be in; when A makes a new one of these appear, it goes there
    const REGIONS = ".pwm-frame, #miscToolsMenu, #toolbar-wrapper, #oiPanel, .psv-navbar, #potree_sidebar_container";
    const DIRS = [[BTN.UP, "up"], [BTN.DOWN, "down"], [BTN.LEFT, "left"], [BTN.RIGHT, "right"]];

    const regionOf = (el) => el.closest(REGIONS) || document.body;
    const isEditable = (el) => el.tagName === "SELECT" || (el.tagName === "INPUT" && el.type === "range");
    const isTextField = (el) => el.tagName === "TEXTAREA"
        || (el.tagName === "INPUT" && !/^(checkbox|radio|range|button|submit|reset|color|file|image)$/.test(el.type));

    /**
     * Can the highlight go here? Shown, enabled, in the tab order and on
     * screen, apart from rows scrolled out of a list: moving onto one scrolls
     * it in. Rows of a collapsed group are clipped away, so they don't count.
     */
    function navigable(el) {
        if (!el || !el.isConnected || el.disabled || el.tabIndex < 0) return false;
        if (el.closest("canvas, .annotation, #" + HUD_ID)) return false;
        if (el.checkVisibility && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
        const r = el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) return false;
        let list = null;
        for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
            const s = getComputedStyle(p);
            if (s.overflowX === "visible" && s.overflowY === "visible") continue;
            if (/auto|scroll/.test(s.overflowY) && p.scrollHeight > p.clientHeight) {
                list = list || p;
                continue;
            }
            const c = p.getBoundingClientRect();
            if (r.bottom <= c.top || r.top >= c.bottom || r.right <= c.left || r.left >= c.right) return false;
        }
        const probe = list || el;
        const v = probe.getBoundingClientRect();
        if (v.right <= 0 || v.bottom <= 0 || v.left >= innerWidth || v.top >= innerHeight) return false;
        // On top there, not under something: Potree's sidebar stays behind the canvas while closed
        const x = Math.min(Math.max((v.left + v.right) / 2, 0), innerWidth - 1);
        const y = Math.min(Math.max((v.top + v.bottom) / 2, 0), innerHeight - 1);
        const hit = document.elementFromPoint(x, y);
        return !!hit && probe.contains(hit);
    }

    function focusables() {
        return [...document.querySelectorAll(FOCUSABLE)].filter(navigable);
    }

    /** The nearest thing to highlight from rect `from` towards dir ("up", "down", "left", "right"). */
    function nearestTowards(from, dir, candidates) {
        const vertical = dir === "up" || dir === "down";
        const ahead = dir === "down" || dir === "right";
        // A rect's span along the move, and across it
        const along = (r) => (vertical ? [r.top, r.bottom] : [r.left, r.right]);
        const across = (r) => (vertical ? [r.left, r.right] : [r.top, r.bottom]);
        const [f0, f1] = along(from), [g0, g1] = across(from);
        let best = null, bestScore = Infinity;
        for (const el of candidates) {
            const r = el.getBoundingClientRect();
            const [a0, a1] = along(r), [b0, b1] = across(r);
            // Its middle past ours and its near edge beyond ours, so row-mates don't count
            if (ahead ? a0 + a1 <= f0 + f1 || a0 < f0 + 2 : a0 + a1 >= f0 + f1 || a1 > f1 - 2) continue;
            const gap = Math.max(0, ahead ? a0 - f1 : f0 - a1);
            const side = Math.max(0, b0 - g1, g0 - b1);
            // Ties (a row of buttons just as close) go to the best lined up
            const score = gap + SIDE_WEIGHT * side + 0.05 * Math.abs(b0 + b1 - g0 - g1);
            if (score < bestScore) {
                bestScore = score;
                best = el;
            }
        }
        return best;
    }

    /** What is now nearest the spot the highlight was on, for when its element goes. */
    function nearestTo(rect) {
        if (!rect) return null;
        const x = (rect.left + rect.right) / 2, y = (rect.top + rect.bottom) / 2;
        let best = null, bestD = Infinity;
        for (const el of focusables()) {
            const r = el.getBoundingClientRect();
            const d = Math.hypot((r.left + r.right) / 2 - x, (r.top + r.bottom) / 2 - y);
            if (d < bestD) {
                bestD = d;
                best = el;
            }
        }
        return best;
    }

    /** Shown without scrolling any list it is in. */
    function inView(el) {
        const r = el.getBoundingClientRect();
        let top = 0, bottom = innerHeight;
        for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
            if (p.scrollHeight <= p.clientHeight || !/auto|scroll/.test(getComputedStyle(p).overflowY)) continue;
            const c = p.getBoundingClientRect();
            top = Math.max(top, c.top);
            bottom = Math.min(bottom, c.bottom);
        }
        return r.top >= top - 1 && r.bottom <= bottom + 1;
    }

    /** Scrolls the lists el is in just far enough to show it. */
    function revealInList(el) {
        for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
            if (p.scrollHeight <= p.clientHeight || !/auto|scroll/.test(getComputedStyle(p).overflowY)) continue;
            const r = el.getBoundingClientRect(), c = p.getBoundingClientRect();
            const margin = Math.min(24, c.height / 4);
            if (r.top < c.top + margin) p.scrollTop -= c.top + margin - r.top;
            else if (r.bottom > c.bottom - margin) p.scrollTop += r.bottom - c.bottom + margin;
        }
    }

    function highlight(el) {
        menuFocus = el;
        if (editing && editing !== el) editing = null;
        // Not the browser's own scrolling: on a panel still sliding in, it shifts the page sideways
        el.focus({ preventScroll: true, focusVisible: false });
        menuSeen = document.activeElement;
        revealInList(el);
        menuRect = el.getBoundingClientRect();
        placeRing();
    }

    function placeRing() {
        if (!ring) return;
        const r = menuOn && menuFocus && menuFocus.isConnected ? menuFocus.getBoundingClientRect() : null;
        const sig = r ? [r.left, r.top, r.width, r.height].map(Math.round).join() + (editing ? " editing" : "") : "";
        if (sig === ringSig) return;
        // Appear where it's needed rather than sliding in from wherever it was
        const appearing = !ringSig;
        ringSig = sig;
        ring.classList.toggle("gp-show", !!r);
        ring.classList.toggle("gp-editing", !!editing);
        if (!r) return;
        if (appearing) ring.style.transition = "none";
        ring.style.transform = `translate(${Math.round(r.left - 4)}px, ${Math.round(r.top - 4)}px)`;
        ring.style.width = Math.round(r.width + 8) + "px";
        ring.style.height = Math.round(r.height + 8) + "px";
        if (appearing) {
            void ring.offsetWidth;
            ring.style.transition = "";
        }
    }

    /** Where the highlight starts: Zones, else the first toolbar button (the toggle, if folded away). */
    function toolbarStart() {
        const zones = document.getElementById("searchZonesButton");
        if (navigable(zones)) return zones;
        const bar = document.getElementById("toolbar-wrapper");
        return (bar && [...bar.querySelectorAll(FOCUSABLE)].find(navigable)) || null;
    }

    function toggleMenu(ctx) {
        if (menuOn) leaveMenu(true);
        else enterMenu(ctx);
    }

    function enterMenu(ctx) {
        const start = navigable(menuLast) ? menuLast : toolbarStart();
        if (!start) {
            toast(["Nothing to select on this page"]);
            rumble();
            return;
        }
        menuOn = true;
        menuCtx = ctx;
        menuReturn = document.activeElement;
        menuOpeners = [];
        highlight(start);
        rumble(40, 0.05, 0.2);
    }

    /** restoreFocus: hand focus back to where it was, unless the mouse has just taken it. */
    function leaveMenu(restoreFocus) {
        if (!menuOn) return;
        menuOn = false;
        menuLast = menuFocus;
        if (restoreFocus && menuFocus && document.activeElement === menuFocus) {
            menuFocus.blur();
            const back = menuReturn;
            if (back && back !== document.body && back.isConnected && typeof back.focus === "function") {
                back.focus({ preventScroll: true });
            }
        }
        menuFocus = menuPending = editing = null;
        placeRing();
    }

    function menuInput(pressed, down, now) {
        if (pressed(BTN.B)) menuBack();
        else if (pressed(BTN.A)) menuPress();
        for (const [b, dir] of DIRS) {
            if (!repeating(b, down, now, NAV_DELAY, NAV_EVERY) || !menuOn) continue;
            if (editing) editValue(dir);
            else menuMove(dir);
        }
    }

    function menuMove(dir) {
        const from = menuFocus && menuFocus.isConnected ? menuFocus.getBoundingClientRect() : menuRect;
        const next = from && nearestTowards(from, dir, focusables().filter((el) => el !== menuFocus));
        if (next) highlight(next);
        else rumble(40, 0.05, 0.15);
    }

    function menuPress() {
        const el = menuFocus;
        if (!el || !el.isConnected) return;
        if (isEditable(el)) {
            editing = editing ? null : el;
            placeRing();
            return;
        }
        if (isTextField(el)) {
            toast(["Type here with the keyboard"]);
            return;
        }
        // Then follow the highlight into whatever this opens: a menu, a panel
        menuPending = { from: el, region: regionOf(el), before: new Set(focusables()), until: performance.now() + 1200, next: 0 };
        el.click();
        rumble(30, 0.05, 0.15);
    }

    /**
     * After A: once what it opened shows up, highlight the first zone (Zones),
     * else its first button in view: a long panel stays at its top, even if
     * that leaves only its window's ×.
     */
    function followOpened(now) {
        const p = menuPending;
        if (now > p.until) {
            menuPending = null;
            return;
        }
        if (now < p.next) return;
        p.next = now + 100;
        const fresh = focusables().filter((el) => !p.before.has(el) && regionOf(el) !== p.region);
        if (!fresh.length) return;
        menuPending = null;
        menuOpeners.push(p.from);
        const shown = fresh.filter(inView);
        highlight(fresh.find((el) => el.matches(".zs-name-btn"))
            || shown.find((el) => !el.matches(".pwm-close") && !isTextField(el))
            || shown[0] || fresh[0]);
    }

    /** The latest opener still on screen and outside `closing`, for B to return to. */
    function popOpener(closing) {
        while (menuOpeners.length) {
            const el = menuOpeners.pop();
            if (navigable(el) && !closing.contains(el)) return el;
        }
        return null;
    }

    /** B in the menus: stop changing a value, else close the panel or menu the highlight is in, else leave. */
    function menuBack() {
        if (editing) {
            editing = null;
            placeRing();
            return;
        }
        const el = menuFocus;
        const closing = el && el.closest(".pwm-frame, #miscToolsMenu");
        if (closing) {
            const close = closing.querySelector(".pwm-close");
            if (close) close.click();
            else if (typeof window.toggleMiscToolsMenu === "function") window.toggleMiscToolsMenu();
            const to = popOpener(closing) || toolbarStart();
            if (to) highlight(to);
            else leaveMenu(true);
        } else if (!el || el.closest("#toolbar-wrapper")) {
            leaveMenu(true);
        } else {
            // In a bar of its own (the photo's, the 360° view's): over to the toolbar
            const to = toolbarStart();
            if (to) highlight(to);
            else leaveMenu(true);
        }
    }

    /** The D-pad on a list or slider being changed: down / right for the next option, up / right for more. */
    function editValue(dir) {
        const el = editing;
        if (!navigable(el)) {
            editing = null;
            return;
        }
        const before = el.value;
        if (el.tagName === "SELECT") {
            const step = dir === "down" || dir === "right" ? 1 : -1;
            el.selectedIndex = Math.min(el.options.length - 1, Math.max(0, el.selectedIndex + step));
        } else {
            const min = el.min === "" ? 0 : Number(el.min);
            const max = el.max === "" ? 100 : Number(el.max);
            // Twenty steps end to end, or the slider's own step if coarser
            const step = Math.max(Number(el.step) > 0 ? Number(el.step) : 0, (max - min) / 20);
            el.value = String(Number(el.value) + (dir === "up" || dir === "right" ? step : -step));
        }
        if (el.value === before) {
            rumble(40, 0.05, 0.15);
            return;
        }
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
    }

    /** Every frame in the menus: follow focus and what A opened, replace a highlight whose element went, move the ring. */
    function menuFrame(now) {
        // Focus moved by a panel itself (Tools, Zones) or by Tab: the highlight goes along.
        // Watched here rather than with focusin, which an unfocused window doesn't fire.
        const active = document.activeElement;
        if (active !== menuSeen) {
            menuSeen = active;
            if (active && active !== menuFocus && active !== document.body && navigable(active)) {
                menuFocus = active;
                editing = null;
            }
        }
        if (menuPending) followOpened(now);
        if (!menuPending && !navigable(menuFocus)) {
            // Its panel closed or was rebuilt: take what is now nearest where it was
            const near = nearestTo(menuRect);
            if (!near) {
                leaveMenu(false);
                return;
            }
            highlight(near);
        }
        if (menuFocus && menuFocus.isConnected) menuRect = menuFocus.getBoundingClientRect();
        placeRing();
    }

    // ══════════════════════════════════════════════════════════════
    //  Measuring and the Point Inspector, aimed with the crosshair
    //
    //  Potree's measuring tool drags its newest marker after the mouse and
    //  takes a left button released on the canvas as "add a point", a right
    //  one as "done". With the pad in use, the marker is dragged to the
    //  crosshair instead, and A and B release those buttons.
    // ══════════════════════════════════════════════════════════════

    /** The measurement whose newest marker is being placed, if any. */
    function placing() {
        const drag = viewer.inputHandler && viewer.inputHandler.drag;
        const sphere = drag && drag.object;
        if (!sphere) return null;
        return viewer.scene.measurements.find((m) => m.spheres && m.spheres.includes(sphere)) || null;
    }

    // Camera as last rendered, so a crosshair pick only repeats once the view has moved
    const cameraKey = () => viewer.scene.getActiveCamera().matrixWorld.elements.map((e) => e.toFixed(5)).join();

    /** Drags the marker being placed to the crosshair, as a mouse move would drag it to the cursor. */
    function aimMarker(force) {
        const drag = viewer.inputHandler.drag;
        const key = drag.object.uuid + cameraKey();
        if (!force && key === aimedKey) return;
        aimedKey = key;
        const { w, h } = canvasSize();
        drag.end.set(w / 2, h / 2);
        drag.object.dispatchEvent({ type: "drag", drag, viewer });
    }

    function canvasMouseUp(button) {
        const { canvas, w, h } = canvasSize();
        const r = canvas.getBoundingClientRect();
        canvas.dispatchEvent(new MouseEvent("mouseup", {
            button, cancelable: true, clientX: r.left + w / 2, clientY: r.top + h / 2,
        }));
    }

    function placePoint() {
        aimMarker(true);   // exactly under the crosshair, even if the view hasn't moved since
        canvasMouseUp(0);
        rumble(40, 0.1, 0.25);
    }

    /** B while measuring: done, or, with no point placed yet, no measurement after all. */
    function finishMeasure(measure) {
        if (measure.points.length > 1) {
            canvasMouseUp(2);
        } else {
            viewer.dispatchEvent({ type: "cancel_insertions" });
            viewer.inputHandler.drag = null;
            viewer.scene.removeMeasurement(measure);
            toast(["Measurement cancelled"]);
        }
        rumble(40, 0.05, 0.2);
    }

    /** With the Point Inspector open, it reads the point under the crosshair. */
    function feedInspector() {
        if (typeof window.inspectPointAt !== "function") return;
        const key = cameraKey();
        if (key === inspectedFrom) return;
        const { canvas, w, h } = canvasSize();
        const r = canvas.getBoundingClientRect();
        if (window.inspectPointAt(r.left + w / 2, r.top + h / 2)) inspectedFrom = key;
    }

    // ══════════════════════════════════════════════════════════════
    //  Quick wheel (hold View): the toolbar's most used tools
    //
    //  Clockwise from the top. Each runs the toolbar's own button where
    //  there is one, so the wheel and the toolbar can't drift apart.
    // ══════════════════════════════════════════════════════════════
    const ICON_PALETTE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true">
        <path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.8 1.6-1.6 0-.5-.2-.8-.4-1.1-.3-.3-.5-.7-.5-1.2 0-.9.7-1.6 1.6-1.6H16a5 5 0 0 0 5-5c0-4.1-4-7.5-9-7.5z"/>
        <circle cx="7.5" cy="11" r="1.3" fill="currentColor" stroke="none"/><circle cx="10.5" cy="7.3" r="1.3" fill="currentColor" stroke="none"/>
        <circle cx="15.2" cy="7.8" r="1.3" fill="currentColor" stroke="none"/></svg>`;
    const ICON_CROSSHAIR = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/></svg>`;

    const onTheCloud = (ctx) => ctx === "orbit" || ctx === "fly";
    const toolbarButton = (name) => document.querySelector(`#potree_toolbar [name="${name}"]`);
    const pressToolbar = (name) => () => toolbarButton(name).click();

    const WHEEL = [
        { short: "Zones", img: () => "images/icons8-magnifying-glass-50.png",
          name: () => "Zones",
          ok: () => !!document.getElementById("searchZonesButton"),
          run: (ctx) => openZones(ctx) },
        { short: "Inspector", img: () => "images/icons/point-inspector.svg",
          name: () => (document.getElementById("pointInspector") ? "Close the Point Inspector" : "Point Inspector"),
          ok: (ctx) => onTheCloud(ctx) && typeof window.togglePointInspector === "function",
          run: () => window.togglePointInspector() },
        { short: "Distance", img: () => Potree.resourcePath + "/icons/distance.svg",
          name: () => "Measure a distance",
          ok: (ctx) => onTheCloud(ctx) && !!toolbarButton("action_measure_distance"),
          run: pressToolbar("action_measure_distance") },
        { short: "Height", img: () => Potree.resourcePath + "/icons/height.svg",
          name: () => "Measure a height",
          ok: (ctx) => onTheCloud(ctx) && !!toolbarButton("action_measure_height"),
          run: pressToolbar("action_measure_height") },
        { short: "Clear", img: () => Potree.resourcePath + "/icons/reset_tools.svg",
          name: () => "Remove all measurements",
          ok: () => !!toolbarButton("action_reset_tools") && viewer.scene.measurements.length > 0,
          run: () => { pressToolbar("action_reset_tools")(); toast(["Measurements removed"]); } },
        { short: "Material", svg: ICON_PALETTE,
          name: () => "Next material",
          ok: () => !!document.getElementById("optMaterial"),
          run: () => nextMaterial() },
        { short: "Images", img: () => "images/orientedImage.png",
          name: () => (window.imageMarkersGloballyHidden ? "Show photos and 360° markers" : "Hide photos and 360° markers"),
          ok: () => { const s = document.getElementById("oiToggleSection"); return !!s && s.style.display !== "none"; },
          run: () => document.getElementById("globalOIToggle").click() },
        { short: "Crosshair", svg: ICON_CROSSHAIR,
          name: () => (hudHidden ? "Show the crosshair" : "Hide the crosshair, for recordings"),
          ok: () => true,
          run: () => toggleHud() },
    ];

    /** Wheel ▸ Zones: the panel open, with the highlight on the zone in view (or the first). */
    function openZones(ctx) {
        enterMenu(ctx);
        if (!menuOn) return;
        if (!document.querySelector("#zoneSearchMenu.open")) {
            highlight(document.getElementById("searchZonesButton"));
            menuPress();
            return;
        }
        const rows = [...document.querySelectorAll("#zoneSearchMenu .zs-name-btn")].filter(navigable);
        const row = rows.find((r) => r.classList.contains("isolated")) || rows[0];
        if (row) highlight(row);
    }

    function nextMaterial() {
        const select = document.getElementById("optMaterial");
        select.selectedIndex = (select.selectedIndex + 1) % select.options.length;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        toast(["Material: " + select.options[select.selectedIndex].text]);
    }

    function buildWheel() {
        const root = document.createElement("div");
        root.id = "gamepadWheel";
        root.innerHTML = `<div class="gp-wheel-disc"></div><div class="gp-wheel-wedge"></div>
            <div class="gp-wheel-hub"></div><div class="gp-wheel-hint"></div>`;
        const slots = WHEEL.map((item, i) => {
            const a = (i / WHEEL.length) * 2 * Math.PI;
            const slot = document.createElement("div");
            slot.className = "gp-wheel-slot";
            slot.style.left = (WHEEL_SIZE / 2 + WHEEL_RING * Math.sin(a)).toFixed(1) + "px";
            slot.style.top = (WHEEL_SIZE / 2 - WHEEL_RING * Math.cos(a)).toFixed(1) + "px";
            const icon = document.createElement("span");
            icon.className = "gp-wheel-icon";
            if (item.svg) {
                icon.innerHTML = item.svg;
            } else {
                const img = document.createElement("img");
                img.alt = "";
                img.src = item.img();
                icon.appendChild(img);
            }
            const text = document.createElement("span");
            text.textContent = item.short;
            slot.append(icon, text);
            root.appendChild(slot);
            return slot;
        });
        document.body.appendChild(root);
        wheel = {
            root, slots,
            wedge: root.querySelector(".gp-wheel-wedge"),
            hub: root.querySelector(".gp-wheel-hub"),
            hint: root.querySelector(".gp-wheel-hint"),
        };
    }

    function openWheel(ctx) {
        leaveMenu(true);
        if (!wheel) buildWheel();
        wheelOpen = true;
        wheelCtx = ctx;
        wheelPick = -1;
        // Over the canvas center, where the crosshair is
        const r = viewer.renderer.domElement.getBoundingClientRect();
        wheel.root.style.left = r.left + r.width / 2 + "px";
        wheel.root.style.top = r.top + r.height / 2 + "px";
        wheel.root.className = "gp-show gp-fam-" + family;
        WHEEL.forEach((item, i) => wheel.slots[i].classList.toggle("gp-off", !item.ok(ctx)));
        renderParts(wheel.hint, ["Point with a stick, let go of", { key: "VIEW" }, "to choose ·", { key: "B" }, "cancel"]);
        drawWheel();
        rumble(30, 0.05, 0.2);
    }

    function drawWheel() {
        const item = WHEEL[wheelPick];
        const slice = 360 / WHEEL.length;
        wheel.root.classList.toggle("gp-picked", !!item);
        wheel.slots.forEach((s, i) => s.classList.toggle("gp-pick", i === wheelPick));
        if (item) {
            wheel.wedge.style.background = `conic-gradient(from ${wheelPick * slice - slice / 2}deg, `
                + `rgba(129,140,248,0.42) 0deg ${slice}deg, transparent ${slice}deg)`;
        }
        wheel.hub.textContent = !item ? "Quick wheel" : item.ok(wheelCtx) ? item.name() : item.name() + " (not here)";
    }

    /** choose: use the option pointed at (letting go of View, or A); otherwise just close (B). */
    function closeWheel(choose) {
        wheelOpen = false;
        viewDownAt = 0;
        wheel.root.classList.remove("gp-show");
        const item = choose ? WHEEL[wheelPick] : null;
        if (!item) return;
        if (item.ok(wheelCtx)) {
            item.run(wheelCtx);
        } else {
            toast([item.name() + " isn't available here"]);
            rumble();
        }
    }

    function wheelInput(input, pressed) {
        if (pressed(BTN.B)) return closeWheel(false);
        if (pressed(BTN.A)) return closeWheel(true);
        // Point with either stick; the choice stays when the stick springs back
        const ax = input.axes;
        const left = [ax[0] || 0, -(ax[1] || 0)], right = [ax[2] || 0, -(ax[3] || 0)];
        const [x, y] = Math.hypot(...left) > Math.hypot(...right) ? left : right;
        if (Math.hypot(x, y) < 0.5) return;
        const n = WHEEL.length;
        const i = (Math.round(Math.atan2(x, y) / (2 * Math.PI / n)) % n + n) % n;
        if (i === wheelPick) return;
        wheelPick = i;
        drawWheel();
        rumble(20, 0, 0.12);
    }

    // ══════════════════════════════════════════════════════════════
    //  The crosshair: what A acts on
    // ══════════════════════════════════════════════════════════════
    function canvasSize() {
        const canvas = viewer.renderer.domElement;
        return { canvas, w: canvas.clientWidth, h: canvas.clientHeight };
    }

    /**
     * The point under the crosshair, and how close to land, the way Potree's
     * double-click picks both (OrbitControls.zoomToLocation): no closer than
     * the deepest loaded node there is wide, never further than now.
     */
    function pickAtCrosshair() {
        const clouds = viewer.scene.pointclouds.filter((pc) => pc.visible);
        if (clouds.length === 0) return null;
        const { w, h } = canvasSize();
        const mouse = { x: w / 2, y: h / 2 };
        const camera = viewer.scene.getActiveCamera();
        const view = viewer.scene.view;

        const hit = Potree.Utils.getMousePointCloudIntersection(mouse, camera, viewer, clouds, { pickClipped: true });
        if (!hit) return null;

        let radius = view.radius;
        const ray = Potree.Utils.mouseToRay(mouse, camera, w, h);
        const nodes = hit.pointcloud.nodesOnRay(hit.pointcloud.visibleNodes, ray);
        const deepest = nodes[nodes.length - 1];
        if (deepest) radius = Math.min(radius, deepest.getBoundingSphere(new THREE.Sphere()).radius);

        return {
            location: new THREE.Vector3().copy(hit.location),
            radius: Math.max(MIN_JUMP, radius),
            depth: new THREE.Vector3().copy(hit.location).sub(view.position).dot(view.direction),
        };
    }

    /** Every marker A could open: 360° views, oriented images, zone beacons. */
    function markerCandidates() {
        const out = [];
        for (const zone of window.zones || []) {
            for (const m of zone.marker360s || []) {
                const group = m._sphereMarker;
                if (!group || !group.visible || !m.image || !m._hitMesh) continue;
                out.push({ kind: "pano", hitObject: m._hitMesh, center: group.getWorldPosition(new THREE.Vector3()),
                           target: group, name: m.name || "360° view" });
            }
        }
        for (const collection of viewer.scene.orientedImages || []) {
            if (typeof collection.focusImage !== "function") continue;
            for (const image of collection.images || []) {
                const mesh = image.mesh;
                if (!mesh || !mesh.visible || mesh.layers.mask === 0) continue;   // hidden sets
                out.push({ kind: "photo", hitObject: mesh, center: mesh.getWorldPosition(new THREE.Vector3()),
                           target: image, collection, name: image.id });
            }
        }
        for (const group of window.beaconObjects || []) {
            const beacon = group.userData && group.userData.beacon;
            if (!group.visible || !beacon || !beacon.cameraPosition || !beacon.cameraTarget) continue;
            out.push({ kind: "beacon", hitObject: beacon._hitMesh, center: group.getWorldPosition(new THREE.Vector3()),
                       target: group, name: (group.userData.zone && group.userData.zone.name) || "zone" });
        }
        return out;
    }

    /**
     * The marker under the crosshair: the nearest one the center ray hits,
     * else the one whose center is closest on screen within AIM_ASSIST px
     * (distant photos shrink to a degree across). Skipped if a surface or a
     * nearer photo stands in front of it, by the same test the mouse hover
     * uses (isHitOccluded in layer_map.js).
     */
    function markerAtCrosshair() {
        const candidates = markerCandidates();
        if (candidates.length === 0) return null;

        const camera = viewer.scene.getActiveCamera();
        const { canvas, w, h } = canvasSize();
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);

        let best = null;
        for (const c of candidates) {
            if (!c.hitObject) continue;
            const hits = raycaster.intersectObject(c.hitObject, false);
            if (hits.length && (!best || hits[0].distance < best.hit.distance)) {
                best = Object.assign(c, { hit: hits[0], sx: w / 2, sy: h / 2 });
            }
        }

        if (!best) {
            const ndc = new THREE.Vector3();
            let bestPx = AIM_ASSIST;
            for (const c of candidates) {
                ndc.copy(c.center).project(camera);
                if (ndc.z < -1 || ndc.z > 1) continue;   // behind the camera or past the far plane
                const px = Math.hypot(ndc.x * w / 2, ndc.y * h / 2);
                if (px > bestPx) continue;
                bestPx = px;
                best = Object.assign(c, { sx: (ndc.x + 1) / 2 * w, sy: (1 - ndc.y) / 2 * h });
            }
            if (!best) return null;
            // Aim the occlusion test at the marker itself
            raycaster.ray.origin.copy(camera.position);
            raycaster.ray.direction.copy(best.center).sub(camera.position).normalize();
            best.hit = { distance: camera.position.distanceTo(best.center) };
        }

        if (typeof window.isHitOccluded === "function") {
            const rect = canvas.getBoundingClientRect();
            const at = { clientX: rect.left + best.sx, clientY: rect.top + best.sy };
            if (window.isHitOccluded(best.hit, raycaster, at)) return null;
        }
        return best;
    }

    function actAtCrosshair(ctx) {
        const marker = markerAtCrosshair();
        if (marker) {
            openMarker(marker);
            return;
        }

        const hit = pickAtCrosshair();
        if (!hit) {
            toast(["Nothing under the crosshair"]);
            rumble();
            return;
        }

        // Keep the heading; land hit.radius short of the point, which becomes the orbit center
        const view = viewer.scene.view;
        const position = hit.location.clone().addScaledVector(view.direction, -hit.radius);
        pushHistory();
        animateTo(
            { position, pivot: hit.location, yaw: view.yaw, pitch: view.pitch, radius: hit.radius },
            // Fly speed follows the landing distance, as on a Fly-mode double-click
            { duration: 700, pushed: true, done: ctx === "fly" ? () => viewer.setMoveSpeed(hit.radius / 2.5) : null }
        );
    }

    function openMarker(m) {
        // close360() flies back to where we were by itself; the others are jumps B can undo
        if (m.kind !== "pano") pushHistory();
        anim = null;
        // A Potree tween still running would fight the move into the marker
        const controls = viewer.getControls();
        if (controls && typeof controls.stopTweens === "function") controls.stopTweens();

        if (m.kind === "pano") {
            if (typeof window.open360 === "function") window.open360(m.target);
        } else if (m.kind === "photo") {
            m.collection.focusImage(m.target);
        } else if (typeof window.goToBeaconZone === "function") {
            window.goToBeaconZone(m.target);   // zone_beacon_og.js: what clicking the beacon does
        } else if (typeof window.moveCameraTo === "function") {
            // a zone_beacon_og.js cached from before goToBeaconZone(): at least fly there
            const beacon = m.target.userData.beacon;
            window.moveCameraTo(beacon.cameraPosition, beacon.cameraTarget);
        }
    }

    // ══════════════════════════════════════════════════════════════
    //  HUD: crosshair, prompt, status pill, toasts
    // ══════════════════════════════════════════════════════════════
    const PAD_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true">
        <path d="M7.5 7h9c2.3 0 3.7 1.5 4.2 3.6l1 4.5c.5 2.4-1.5 3.7-3 2.4L16.4 15H7.6l-2.3 2.5c-1.5 1.3-3.5 0-3-2.4l1-4.5C3.8 8.5 5.2 7 7.5 7z"/>
        <path d="M7.5 10v3M6 11.5h3" stroke-linecap="round"/>
        <circle cx="16" cy="10.5" r=".9" fill="currentColor" stroke="none"/>
        <circle cx="17.8" cy="12.6" r=".9" fill="currentColor" stroke="none"/></svg>`;

    function label(key) {
        return LABELS[family][key] || SHARED_LABELS[key] || key;
    }

    function chip(key) {
        const el = document.createElement("span");
        el.className = "gp-chip" + (FACE_KEYS.includes(key) ? " gp-face" : "");
        el.dataset.key = key;
        el.textContent = label(key);
        return el;
    }

    /** Re-labels every chip and diagram glyph for the pad family in use. */
    function setFamily(f) {
        if (f === family) return;
        const old = family;
        family = f;
        for (const root of [hud && hud.root, panel, wheel && wheel.root]) {
            if (!root) continue;
            root.classList.replace("gp-fam-" + old, "gp-fam-" + f);
            root.querySelectorAll("[data-key]").forEach((el) => {
                if (el.classList.contains("gp-chip") || el.tagName === "text") el.textContent = label(el.dataset.key);
            });
        }
    }

    function buildHud() {
        const canvas = viewer.renderer.domElement;
        const host = canvas.parentElement || document.body;

        const root = document.createElement("div");
        root.id = HUD_ID;
        root.className = "gp-fam-" + family;
        root.innerHTML = `
            <div class="gp-hud-main">
                <div class="gp-crosshair"></div>
                <div class="gp-prompt"><span class="gp-prompt-text"></span><span class="gp-prompt-name"></span></div>
                <div class="gp-status">${PAD_ICON}<span class="gp-status-mode"></span>
                    <span class="gp-status-extra"></span><span class="gp-status-sep"></span>
                    <span class="gp-status-keys"></span></div>
            </div>
            <div class="gp-toast"></div>`;
        host.appendChild(root);

        const prompt = root.querySelector(".gp-prompt");
        prompt.insertBefore(chip("A"), prompt.firstChild);

        hud = {
            root,
            promptText: root.querySelector(".gp-prompt-text"),
            promptName: root.querySelector(".gp-prompt-name"),
            mode: root.querySelector(".gp-status-mode"),
            extra: root.querySelector(".gp-status-extra"),
            keys: root.querySelector(".gp-status-keys"),
            toast: root.querySelector(".gp-toast"),
            toastTimer: 0,
            last: {},
        };

        ring = document.createElement("div");
        ring.id = "gamepadRing";
        document.body.appendChild(ring);
    }

    /** parts: strings and { key } chips. Text goes in as text, never parsed as HTML. */
    function renderParts(el, parts) {
        el.replaceChildren(...parts.map((p) => (typeof p === "string" ? document.createTextNode(p) : chip(p.key))));
    }

    // The HUD is refreshed every frame; only touch the DOM when something changed
    function setParts(key, el, parts) {
        const sig = family + JSON.stringify(parts);
        if (hud.last[key] === sig) return;
        hud.last[key] = sig;
        renderParts(el, parts);
    }

    const PROMPTS = {
        pano: (name) => ["Open 360° view", "· " + name],
        photo: (name) => ["Open photo", "· " + name],
        beacon: (name) => ["Go to", name],
    };

    function updateHud(ctx, now) {
        if (!hud) return;
        const on = !hudHidden && padUsedAt >= pointerUsedAt;
        // In the menus and the wheel A presses buttons, so there is nothing to aim
        const aims = (ctx === "orbit" || ctx === "fly") && !menuOn && !wheelOpen;
        const measuring = aims ? placing() : null;
        hud.root.classList.toggle("gp-on", on);
        hud.root.classList.toggle("gp-no-aim", !aims);
        hud.root.classList.toggle("gp-photo", ctx === "photo" || ctx === "pano");

        // Look for a marker under the crosshair a few times a second (not mid-move,
        // nor while A adds measuring points)
        if (on && aims && !anim && !measuring) {
            if (now - lastScan >= SCAN_EVERY) {
                lastScan = now;
                hudMarker = markerAtCrosshair();
            }
        } else {
            hudMarker = null;
        }
        hud.root.classList.toggle("gp-target", !!hudMarker);
        if (hudMarker) {
            const [text, name] = PROMPTS[hudMarker.kind](hudMarker.name);
            setParts("promptText", hud.promptText, [text]);
            setParts("promptName", hud.promptName, [name]);
        }

        let mode, extra = [];
        if (wheelOpen) {
            mode = "Quick wheel";
        } else if (measuring) {
            mode = measuring.name || "Measuring";
            extra = [{ key: "A" }, "add point", { key: "B" }, "finish"];
        } else if (menuOn) {
            mode = editing ? "Changing" : "Toolbar";
            extra = editing ? [{ key: "LEFT" }, { key: "RIGHT" }, "change", { key: "A" }, "done"]
                : [{ key: "A" }, "press", { key: "B" }, "back"];
        } else if (ctx === "orbit") mode = "Orbit";
        else if (ctx === "fly") {
            mode = viewer.fpControls.lockElevation ? "Helicopter" : "Fly";
            extra = [formatSpeed(viewer.getMoveSpeed())];
        } else if (ctx === "photo" || ctx === "pano") {
            mode = ctx === "photo" ? "Photo" : "360° view";
            extra = [{ key: "LEFT" }, { key: "RIGHT" }, "browse", { key: "UP" }, { key: "DOWN" }, "opacity",
                { key: "B" }, "leave"];
        } else mode = "Paused";
        setParts("mode", hud.mode, [mode]);
        setParts("extra", hud.extra, extra);
        setParts("keys", hud.keys, [{ key: "MENU" }, menuOn ? "Done" : "Toolbar", { key: "VIEW" }, "Guide"]);
    }

    function toast(parts, ms = 1800, force = false) {
        if (!hud || (hudHidden && !force)) return;
        const el = hud.toast;
        renderParts(el, parts);
        el.classList.add("gp-show");
        clearTimeout(hud.toastTimer);
        hud.toastTimer = setTimeout(() => el.classList.remove("gp-show"), ms);
    }

    function toggleHud() {
        hudHidden = !hudHidden;
        if (hudHidden) toast(["Crosshair hidden · it's back in the quick wheel (hold", { key: "VIEW" }, ")"], 2600, true);
        else toast(["Crosshair shown"], 1000);
    }

    // ══════════════════════════════════════════════════════════════
    //  Guide panel: live diagram, mapping, settings
    // ══════════════════════════════════════════════════════════════
    // Xbox-style layout. Parts carry data-key (a BTN name); text labels with
    // data-key follow the pad family.
    const DIAGRAM = `
<svg class="gp-diagram" viewBox="0 0 320 200" role="img" aria-label="Controller diagram">
  <rect class="gp-part" data-key="LT" x="62" y="6" width="36" height="22" rx="7"/>
  <rect class="gp-fill" data-fill="LT" x="62" y="28" width="36" height="0" rx="7"/>
  <text data-key="LT" x="80" y="17">LT</text>
  <rect class="gp-part" data-key="RT" x="222" y="6" width="36" height="22" rx="7"/>
  <rect class="gp-fill" data-fill="RT" x="222" y="28" width="36" height="0" rx="7"/>
  <text data-key="RT" x="240" y="17">RT</text>
  <rect class="gp-part" data-key="LB" x="50" y="33" width="64" height="11" rx="5.5" transform="rotate(-7 82 38)"/>
  <rect class="gp-part" data-key="RB" x="206" y="33" width="64" height="11" rx="5.5" transform="rotate(7 238 38)"/>
  <path class="gp-shell" d="M100 46 C82 46 64 48 52 60 C40 72 26 118 22 152 C19 176 34 192 52 188
      C66 185 78 168 92 152 C102 142 114 138 128 138 L192 138 C206 138 218 142 228 152
      C242 168 254 185 268 188 C286 192 301 176 298 152 C294 118 280 72 268 60 C256 48 238 46 220 46 Z"/>
  <circle class="gp-deco" cx="160" cy="62" r="8"/>
  <rect class="gp-part" data-key="VIEW" x="134" y="76" width="16" height="10" rx="5"/>
  <rect class="gp-part" data-key="MENU" x="170" y="76" width="16" height="10" rx="5"/>
  <circle class="gp-deco" cx="96" cy="84" r="20"/>
  <circle class="gp-part" data-key="LS" data-stick="0" cx="96" cy="84" r="12"/>
  <circle class="gp-deco" cx="196" cy="120" r="20"/>
  <circle class="gp-part" data-key="RS" data-stick="2" cx="196" cy="120" r="12"/>
  <rect class="gp-part" data-key="UP" x="118" y="102" width="12" height="11" rx="2"/>
  <rect class="gp-part" data-key="DOWN" x="118" y="125" width="12" height="11" rx="2"/>
  <rect class="gp-part" data-key="LEFT" x="107" y="113" width="11" height="12" rx="2"/>
  <rect class="gp-part" data-key="RIGHT" x="130" y="113" width="11" height="12" rx="2"/>
  <rect class="gp-deco" x="118" y="113" width="12" height="12"/>
  <circle class="gp-part" data-key="Y" cx="228" cy="66" r="9.5"/>
  <circle class="gp-part" data-key="X" cx="210" cy="84" r="9.5"/>
  <circle class="gp-part" data-key="B" cx="246" cy="84" r="9.5"/>
  <circle class="gp-part" data-key="A" cx="228" cy="102" r="9.5"/>
  <text data-key="Y" x="228" y="66">Y</text>
  <text data-key="X" x="210" y="84">X</text>
  <text data-key="B" x="246" y="84">B</text>
  <text data-key="A" x="228" y="102">A</text>
  <text data-key="LB" x="82" y="38.5">LB</text>
  <text data-key="RB" x="238" y="38.5">RB</text>
</svg>`;

    function buildPanel() {
        const el = document.createElement("div");
        el.id = PANEL_ID;
        // "open" drives panel_window_manager's fade-in, as with the class legend
        el.className = "open gp-fam-" + family;
        el.innerHTML = `
            <div class="gp-header">
                <span class="gp-title">Gamepad Controls</span>
                <button class="gp-close" type="button" title="Close">&times;</button>
            </div>
            <div class="gp-content">
                <div class="gp-conn"><span class="gp-conn-dot"></span><span class="gp-conn-text"></span></div>
                ${DIAGRAM}
                <table class="gp-table">
                    <thead><tr><th></th><th data-col="orbit">Orbit</th><th data-col="fly">Fly</th></tr></thead>
                    <tbody></tbody>
                </table>
                <div class="gp-settings">
                    <label><input type="checkbox" data-setting="invertY"> Invert look up / down</label>
                    <label><input type="checkbox" data-setting="swapSticks"> Swap sticks (move with the right one)</label>
                    <label><input type="checkbox" data-setting="vibration"> Vibration</label>
                    <label>Look speed <input type="range" min="0.4" max="2" step="0.1" data-setting="lookSpeed"><output></output></label>
                </div>
            </div>`;

        el.querySelector(".gp-close").addEventListener("click", closeHelp);
        el.querySelectorAll("text[data-key]").forEach((t) => { t.textContent = label(t.dataset.key); });

        fillLegend(el.querySelector(".gp-table tbody"));

        // Settings
        const speedOut = el.querySelector(".gp-settings output");
        const showSpeed = () => { speedOut.textContent = settings.lookSpeed.toFixed(1) + "×"; };
        el.querySelectorAll("[data-setting]").forEach((input) => {
            const key = input.dataset.setting;
            const box = input.type === "checkbox";
            if (box) input.checked = settings[key];
            else input.value = settings[key];
            input.addEventListener(box ? "change" : "input", () => {
                settings[key] = box ? input.checked : Number(input.value);
                if (key === "lookSpeed") showSpeed();
                if (key === "swapSticks") fillLegend(el.querySelector(".gp-table tbody"));
                saveSettings();
            });
        });
        showSpeed();

        const parts = new Map();   // BTN name → diagram shapes
        el.querySelectorAll(".gp-part[data-key]").forEach((p) => {
            if (!parts.has(p.dataset.key)) parts.set(p.dataset.key, []);
            parts.get(p.dataset.key).push(p);
        });
        guide = {
            parts,
            fills: { LT: el.querySelector('[data-fill="LT"]'), RT: el.querySelector('[data-fill="RT"]') },
            sticks: [...el.querySelectorAll("[data-stick]")],
            conn: el.querySelector(".gp-conn"),
            connText: el.querySelector(".gp-conn-text"),
            heads: [...el.querySelectorAll("th[data-col]")],
            rows: [],
            state: new Map(),   // element → last value written
        };
        guide.rows = [...el.querySelectorAll("tr[data-keys]")];
        return el;
    }

    /** MOVE / LOOK name whichever stick does that job; the rest are BTN names. */
    function physicalKey(key) {
        if (key === "MOVE") return settings.swapSticks ? "RS" : "LS";
        if (key === "LOOK") return settings.swapSticks ? "LS" : "RS";
        return key;
    }

    function fillLegend(tbody) {
        tbody.textContent = "";
        for (const row of LEGEND) {
            const tr = document.createElement("tr");
            if (row.title) {
                tr.className = "gp-group";
                const td = document.createElement("td");
                td.colSpan = 3;
                td.textContent = row.title;
                tr.appendChild(td);
                tbody.appendChild(tr);
                continue;
            }
            tr.dataset.keys = row.keys.join(" ");
            tr.dataset.when = row.when;

            const keys = document.createElement("td");
            keys.className = "gp-keys";
            for (const k of row.keys) keys.appendChild(chip(physicalKey(k)));
            tr.appendChild(keys);

            if (row.both) {
                const td = document.createElement("td");
                td.colSpan = 2;
                td.className = "gp-cur";
                td.textContent = row.both;
                tr.appendChild(td);
            } else {
                for (const col of ["orbit", "fly"]) {
                    const td = document.createElement("td");
                    td.dataset.col = col;
                    td.textContent = row[col];
                    tr.appendChild(td);
                }
            }
            tbody.appendChild(tr);
        }
        if (guide) guide.rows = [...tbody.querySelectorAll("tr[data-keys]")];
    }

    // This runs every frame while the guide is open: write only on change.
    // key is the element, or [element, aspect] when one element has two.
    function setState(key, value, apply) {
        const k = Array.isArray(key) ? key[0] : key;
        const aspect = Array.isArray(key) ? key[1] : "";
        let seen = guide.state.get(k);
        if (!seen) guide.state.set(k, (seen = {}));
        if (seen[aspect] === value) return;
        seen[aspect] = value;
        apply(value);
    }

    const toggleClass = (el, cls) => (on) => el.classList.toggle(cls, on);

    function refreshConnection() {
        if (!guide) return;
        const live = !!pad;
        const odd = live && pad.mapping !== "standard";
        let text = "No controller yet: connect one and press any of its buttons.";
        if (live) text = padName(pad) + (odd ? " (unrecognised layout: buttons may not match)" : "");
        setState(guide.conn, live, toggleClass(guide.conn, "gp-live"));
        setState(guide.connText, text, (v) => {
            guide.connText.textContent = v;
            guide.connText.classList.toggle("gp-conn-warn", odd);
        });
    }

    function updateGuide(input, ctx) {
        refreshConnection();

        const keyActive = (key) => {
            if (!input) return false;
            if (key === "MOVE") return input.move.m > 0;
            if (key === "LOOK") return input.look.m > 0;
            if (key === "LT") return input.lt > 0;
            if (key === "RT") return input.rt > 0;
            return !!input.down[BTN[key]];
        };

        // Diagram: buttons, sticks and triggers as the browser reports them
        for (const [key, shapes] of guide.parts) {
            if (key === "LT" || key === "RT" || key === "LS" || key === "RS") continue;   // drawn below
            const on = !!(input && input.down[BTN[key]]);
            for (const s of shapes) setState(s, on, toggleClass(s, "on"));
        }
        const axes = input ? input.axes : [];
        for (const s of guide.sticks) {
            const ix = Number(s.dataset.stick);
            const ax = axes[ix] || 0, ay = axes[ix + 1] || 0;
            const offset = Math.round(ax * 8) + "," + Math.round(ay * 8);
            const on = Math.hypot(ax, ay) > STICK_DEADZONE || !!(input && input.down[BTN[s.dataset.key]]);
            setState([s, "offset"], offset, (v) => s.setAttribute("transform", "translate(" + v + ")"));
            setState([s, "on"], on, toggleClass(s, "on"));
        }
        for (const key of ["LT", "RT"]) {
            const b = pad && pad.buttons[BTN[key]];
            const h = Math.round((b ? b.value || 0 : 0) * 22);
            const fill = guide.fills[key];
            setState(fill, h, (v) => {
                fill.setAttribute("y", String(28 - v));
                fill.setAttribute("height", String(v));
            });
        }

        // Table: the current mode's column, and the rows being pressed
        const mode = ctx === "fly" ? "fly" : ctx === "orbit" ? "orbit" : null;
        for (const th of guide.heads) setState(th, th.dataset.col === mode, toggleClass(th, "gp-cur"));
        const inPhoto = ctx === "photo" || ctx === "pano";
        const measuring = !inPhoto && !menuOn && !wheelOpen && !!placing();
        const applies = {
            nav: !inPhoto && !wheelOpen,
            act: !inPhoto && !menuOn && !wheelOpen && !measuring,
            photo: inPhoto && !menuOn && !wheelOpen,
            measure: measuring,
            menu: menuOn && !wheelOpen,
            wheel: wheelOpen,
            any: true,
        };
        for (const tr of guide.rows) {
            const keys = tr.dataset.keys;
            setState(tr, applies[tr.dataset.when] && keys.split(" ").some(keyActive), toggleClass(tr, "gp-live"));
            for (const td of tr.children) {
                if (td.dataset.col) setState(td, td.dataset.col === mode, toggleClass(td, "gp-cur"));
            }
        }
    }

    function openHelp() {
        if (panel) return;
        // A previous instance may still be fading out
        const lingering = document.getElementById(PANEL_ID);
        if (lingering) lingering.remove();

        panel = buildPanel();
        document.body.appendChild(panel);
        updateGuide(lastInput, context());
    }

    function closeHelp() {
        if (!panel) return;
        const p = panel;
        panel = null;
        guide = null;
        // Let the window manager's frame fade out with the panel
        p.classList.remove("open");
        setTimeout(() => p.remove(), 200);
    }

    // View / Share, and Tools ▸ Gamepad Controls
    function toggleHelp() {
        if (panel) closeHelp();
        else openHelp();
    }

    // ══════════════════════════════════════════════════════════════
    //  Init
    // ══════════════════════════════════════════════════════════════
    function onConnected(e) {
        polling = true;
        padUsedAt = performance.now();
        const p = e.gamepad;
        if (p) setFamily(padFamily(p));
        toast(["Controller connected ·", { key: "MENU" }, "toolbar ·", { key: "VIEW" }, "controls, hold for the quick wheel"], 5000);
        if (guide) refreshConnection();
    }

    function onDisconnected() {
        // Keep listening while any pad is left
        let left = [];
        try { left = Array.from(navigator.getGamepads ? navigator.getGamepads() : []).filter((p) => p && p.connected); } catch (_) {}
        if (left.length === 0) {
            polling = false;
            lostPad();
            toast(["Controller disconnected"], 2500, true);
        }
    }

    function init() {
        buildHud();

        if (window.PanelWM && window.PanelWM.registry) {
            window.PanelWM.registry[PANEL_ID] = {
                title: "Gamepad Controls", titleSel: ".gp-title", closeSel: ".gp-close",
                w: 420, minW: 340, minH: 200,
                // The frame's titlebar replaces the panel's own header row
                fixup: (p) => {
                    const bar = p.querySelector(".gp-header");
                    if (bar) bar.style.setProperty("display", "none", "important");
                },
            };
        }

        viewer.addEventListener("update_start", onUpdateStart);
        window.addEventListener("gamepadconnected", onConnected);
        window.addEventListener("gamepaddisconnected", onDisconnected);

        // Mouse use fades the crosshair and pill out until the pad is used again.
        // Only real movement counts: Chrome can repeat a pointermove in place.
        let lastX = null, lastY = null;
        window.addEventListener("pointermove", (e) => {
            if (e.clientX === lastX && e.clientY === lastY) return;
            lastX = e.clientX;
            lastY = e.clientY;
            pointerUsedAt = performance.now();
        }, { passive: true });
        // Starting a measurement or the Point Inspector leaves the menus, so the crosshair can aim it
        viewer.measuringTool.addEventListener("start_inserting_measurement", () => {
            leaveMenu(true);
            aimedKey = "";
            if (padUsedAt >= pointerUsedAt) {
                toast(["Measuring ·", { key: "A" }, "adds a point at the crosshair ·", { key: "B" }, "finishes"], 4000);
            }
        });
        document.addEventListener("point-inspector-changed", (e) => {
            inspectedFrom = "";
            if (!e.detail || !e.detail.open) return;
            leaveMenu(true);
            if (padUsedAt >= pointerUsedAt) toast(["Point Inspector · reading the point under the crosshair"], 3000);
        });

        // A click means the mouse has taken over the menus too
        window.addEventListener("pointerdown", () => {
            pointerUsedAt = performance.now();
            leaveMenu(false);
        }, { passive: true });


        // A pad the browser exposed before this script ran (no connect event then)
        try {
            if (navigator.getGamepads && Array.from(navigator.getGamepads()).some((p) => p && p.connected)) polling = true;
        } catch (_) {}
    }

    // index.html creates the viewer before this script runs; the atlas pages
    // create it in a module script, which runs after every classic script but
    // before DOMContentLoaded.
    if (window.viewer && window.viewer.scene) init();
    else document.addEventListener("DOMContentLoaded", init);

    window.GamepadControls = {
        settings,
        open: openHelp,
        close: closeHelp,
        toggleHelp,
    };
})();
