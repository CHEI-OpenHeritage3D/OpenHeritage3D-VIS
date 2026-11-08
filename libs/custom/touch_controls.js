/**
 * touch_controls.js — Touch controls for phones and tablets
 *
 * Author: (OpenHeritage3D / CHEI, UC San Diego)
 *
 * Description:
 *   Makes the viewer work with fingers. It only runs where the main pointer
 *   is a finger (the CSS media query "(hover: none) and (pointer: coarse)":
 *   phones and tablets). On a desktop, touchscreen or not, it does nothing.
 *
 *   On the 3D view:
 *     drag with one finger    turn around the orbit center (Orbit, Earth),
 *                             or look around (Fly, Helicopter)
 *     pinch / spread          zoom toward the fingers
 *     drag with two fingers   move the view; twisting them turns it
 *     double tap              zoom to that spot, as a double-click does
 *     tap                     open the 360° view, photo or zone beacon
 *                             there; place a point while measuring; read
 *                             the point while the Point Inspector is open
 *     press and hold          open the Point Inspector on that point
 *     in a photo              swipe left / right for the next / previous one
 *
 *   A tap none of these claims goes on to the canvas as a click, so tools
 *   that pick with the mouse (Align by Point Pairs, selecting a box) take
 *   taps as well. A finger that lands on a measuring point (or another
 *   handle Potree lets the mouse drag) drags it. While a toolbar
 *   measurement is drawn, a bar offers Done and Cancel, since there is no
 *   right-click to end it.
 *
 *   On small screens (under 640px wide, or under 500px tall) the toolbar
 *   becomes one row of icons (press and hold one for its name), panels open
 *   as sheets from the bottom (from the right in landscape), and the photo
 *   bar wraps onto two rows. A card explains the gestures on the first
 *   visit; Tools ▸ Touch Gestures brings it back.
 *
 * How it hooks in:
 *   Touch events on the canvas stop here, so Potree's own touch handling
 *   (InputHandler: one finger orbits, two pinch, three pan) never sees them,
 *   and the browser neither scrolls nor zooms the page. Gestures move
 *   scene.view directly, as gamepad_controls.js does; the active controls
 *   carry on from the moved view. Touch pointer events still reach the
 *   page, except moves during a camera gesture: those would run the hover
 *   raycasts in layer_map.js, and a marker left "hovered" at the end of a
 *   drag would take the next tap anywhere to it.
 */

(function () {
    "use strict";

    // Phones and tablets only. A desktop's main pointer is a mouse or
    // touchpad even when it has a touchscreen too.
    if (!window.matchMedia || !matchMedia("(hover: none) and (pointer: coarse)").matches) return;

    document.documentElement.classList.add("touch-ui");

    // ══════════════════════════════════════════════════════════════
    //  Tuning
    // ══════════════════════════════════════════════════════════════
    const TAP_SLOP = 10;            // px a finger may wander and still tap
    const TAP_TIME = 400;           // ms, the longest tap
    const DOUBLE_TAP_TIME = 300;    // ms from lifting the first tap to landing the second
    const DOUBLE_TAP_SLOP = 40;     // px between them
    const HOLD_SHOW = 180;          // ms before the press-and-hold ring appears
    const HOLD_TIME = 550;          // ms, press and hold
    const TURN = 1.6 * Math.PI;     // orbit: radians per screen length dragged (its longer side)
    const TWIST_START = 0.2;        // rad (~11°) two fingers twist before the view turns, so pinches don't wobble it
    const FLING_MIN = 0.25;         // px/ms a drag must end at to coast on
    const FLING_MAX = 1.5;          // px/ms, the fastest it coasts (a hard flick turns ~150°, not several times round)
    const FLING_TAU = 280;          // ms, how quickly a coasting turn slows down
    const SWIPE_MIN = 50;           // px, a swipe to the next photo
    const MARKER_REACH = 28;        // px around a tap that still hits a marker (fingers are blunt)
    const MIN_DIST = 0.05;          // closest a pinch brings the camera to the point under the fingers
    const MAX_DIST = 1e7;
    const TIP_HOLD = 450;           // ms on a toolbar icon to show its name
    const HINT_KEY = "touchControls.hintSeen";

    const Z_UP = new THREE.Vector3(0, 0, 1);

    // ══════════════════════════════════════════════════════════════
    //  Styles
    // ══════════════════════════════════════════════════════════════
    const PALETTE = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' " +
        "stroke-width='1.6' stroke-linejoin='round'><path d='M12 3a9 9 0 0 0 0 18c1.1 0 1.8-.8 1.8-1.7 0-.5-.2-.9-.5-1.2" +
        "-.3-.3-.5-.7-.5-1.2 0-.9.8-1.7 1.7-1.7H16a5 5 0 0 0 5-5c0-4-4-7.2-9-7.2z'/><g fill='white' stroke='none'>" +
        "<circle cx='7.5' cy='11' r='1.3'/><circle cx='10' cy='7' r='1.3'/><circle cx='14.5' cy='7' r='1.3'/>" +
        "<circle cx='17' cy='11' r='1.3'/></g></svg>";

    // Phones: narrow in portrait, short in landscape
    const SMALL = "(max-width: 640px), (max-height: 500px)";
    const PORTRAIT = "(max-width: 640px)";
    const LANDSCAPE = "(max-height: 500px) and (min-width: 641px)";

    const css = document.createElement("style");
    css.textContent = `
/* The page itself never scrolls, rubber-bands, pulls to refresh or zooms; the 3D view takes every gesture */
html.touch-ui, html.touch-ui body { overscroll-behavior: none; overflow: hidden; touch-action: pan-x pan-y; }
.touch-ui #potree_render_area > canvas { touch-action: none; }
.touch-ui #potree_render_area, .touch-ui #toolbar-wrapper, .touch-ui #toolbar-wrapper * {
    -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent;
}
.touch-ui #toolbar-wrapper img { -webkit-user-drag: none; }

/* Bigger targets wherever there is room for them */
.touch-ui .misc-panel { width: auto; min-width: 200px; }
.touch-ui .misc-item { padding: 12px 18px; font-size: 15px; }
.touch-ui .pwm-close { width: 40px; height: 40px; font-size: 24px; }
.touch-ui #oiPanel .oi-nav-btn, .touch-ui #oiPanel .oi-icon-btn { width: 40px; height: 40px; }
.touch-ui #oiPanel .oi-key { display: none; }
.touch-ui #oiPanel .oi-title-index, .touch-ui #oiPanel .oi-opacity-label { font-size: 12px; color: #b4b4c0; }

@media ${SMALL} {
    /* iOS zooms the page into any text field under 16px that gets focus */
    .touch-ui input:not([type=range]):not([type=checkbox]):not([type=radio]):not([type=color]),
    .touch-ui select, .touch-ui textarea { font-size: max(16px, 1em); }

    /* Toolbar: one row of icons, no labels; hold an icon for its name */
    .touch-ui #toolbar-wrapper { top: 8px; right: 8px; gap: 6px; }
    .touch-ui #potree_toolbar { padding: 2px 4px; align-items: center; }
    .touch-ui #potree_toolbar .potree_toolbar_label,
    .touch-ui #potree_toolbar .potree_toolbar_separator { display: none !important; }
    .touch-ui #potree_toolbar > span, .touch-ui #potree_toolbar > div,
    .touch-ui #potree_toolbar > span > div, .touch-ui #potree_toolbar > div > div,
    .touch-ui #potree_toolbar center { display: contents; }
    .touch-ui #potree_toolbar img[role=button] {
        width: 24px !important; height: 24px !important; padding: 8px; box-sizing: content-box; object-fit: contain;
    }
    .touch-ui #zoneCountBadge { left: calc(8px + 0.425 * 24px); top: calc(8px + 0.395 * 24px); }
    .touch-ui #optMaterial {
        width: 40px; height: 40px; padding: 0; color: transparent; border-color: transparent;
        background-color: transparent; background-size: 24px; background-position: center;
        -webkit-backdrop-filter: none; backdrop-filter: none;
        background-image: url("data:image/svg+xml,${encodeURIComponent(PALETTE)}");
    }
    .touch-ui #toolbar-toggle {
        width: 40px; height: 40px; padding: 0; box-sizing: border-box;
        display: flex; align-items: center; justify-content: center;
    }
    .touch-ui #viewer-title { font-size: 14px; padding: 5px 12px; overflow: hidden; text-overflow: ellipsis; }
    .touch-ui #viewer-title img { height: 18px !important; }

    /* Panels: the window manager's frames become sheets */
    .touch-ui .pwm-rz, .touch-ui .pwm-grip { display: none; }
    .touch-ui .pwm-titlebar { cursor: default; padding: 4px 4px 4px 16px; }
    .touch-ui .pwm-title { font-size: 15px; }
}

@media ${PORTRAIT} {
    /* The toolbar spans the top; the title sits under it */
    .touch-ui #toolbar-wrapper { left: 8px; }
    .touch-ui #toolbar-wrapper:has(#potree_toolbar.collapsed) { left: auto; }
    .touch-ui #potree_toolbar { flex: 1 1 auto; min-width: 0; justify-content: space-between; }
    .touch-ui body:not(.embedded) #viewer-title {
        top: 60px !important; left: 50% !important; transform: translateX(-50%); max-width: calc(100vw - 32px);
    }
    .touch-ui body:not(.embedded):has(#potree_toolbar.collapsed) #viewer-title { top: 8px !important; max-width: calc(100vw - 120px); }

    .touch-ui .pwm-frame {
        left: 0 !important; right: 0 !important; top: auto !important; bottom: 0 !important;
        width: auto !important; height: auto !important; max-height: 62vh !important; max-height: 62dvh !important;
        border-radius: 16px 16px 0 0; border-bottom: none; transform: translateY(24px);
    }
    .touch-ui .pwm-frame.pwm-open { transform: none; }

    /* The photo bar: buttons and name on one row, opacity on the next */
    .touch-ui #oiPanel { flex-wrap: wrap; width: calc(100vw - 16px); max-width: none; bottom: 8px; gap: 8px 10px; padding: 10px 12px; }
    .touch-ui #oiPanel .oi-title { flex: 1 1 0; min-width: 0; max-width: none; }
    .touch-ui #oiPanel .oi-sep { display: none; }
    .touch-ui #oiPanel .oi-opacity { order: 1; flex: 1 0 100%; min-width: 0; }
}

@media ${LANDSCAPE} {
    .touch-ui body:not(.embedded) #viewer-title {
        top: 8px !important; left: 8px !important; transform: none; max-width: calc(100vw - 420px);
    }
    .touch-ui .pwm-frame {
        left: auto !important; right: 0 !important; top: 56px !important; bottom: 0 !important;
        width: min(400px, 50vw) !important; height: auto !important; max-height: none !important;
        border-radius: 16px 0 0 0; border-right: none; border-bottom: none; transform: translateX(24px);
    }
    .touch-ui .pwm-frame.pwm-open { transform: none; }
}

/* Press and hold: a ring fills in under the finger */
#tcHold {
    position: fixed; z-index: 2147483000; width: 64px; height: 64px; margin: -32px 0 0 -32px;
    box-sizing: border-box; border-radius: 50%; border: 3px solid rgba(165, 180, 252, 0.95);
    box-shadow: 0 0 14px rgba(79, 70, 229, 0.6); pointer-events: none;
    opacity: 0; transform: scale(0.4); transition: opacity 0.12s, transform ${(HOLD_TIME - HOLD_SHOW) / 1000}s ease-out;
}
#tcHold.tc-on { opacity: 1; transform: scale(1); }
#tcHold.tc-done { opacity: 0; transform: scale(1.3); transition: opacity 0.25s, transform 0.25s; }

#tcToast, #tcTip {
    position: fixed; z-index: 2147483000; pointer-events: none; box-sizing: border-box;
    background: rgba(20, 20, 26, 0.94); color: #f2f2f7; font: 600 14px 'Segoe UI', system-ui, sans-serif;
    border: 1px solid rgba(255, 255, 255, 0.12); box-shadow: 0 4px 18px rgba(0, 0, 0, 0.5);
    opacity: 0; transition: opacity 0.18s, transform 0.18s;
}
#tcToast {
    left: 50%; bottom: 96px; transform: translate(-50%, 8px); width: max-content; max-width: calc(100vw - 32px);
    padding: 9px 16px; border-radius: 20px; text-align: center;
}
#tcToast.tc-on { opacity: 1; transform: translate(-50%, 0); }
#tcTip { padding: 6px 10px; border-radius: 8px; font-size: 13px; white-space: nowrap; }
#tcTip.tc-on { opacity: 1; }

/* Done / Cancel while a toolbar measurement is drawn (above the window manager's 10000–10800) */
#tcMeasureBar {
    position: fixed; left: 50%; bottom: 12px; transform: translateX(-50%); z-index: 10900;
    display: flex; align-items: center; gap: 8px; box-sizing: border-box;
    width: max-content; max-width: calc(100vw - 16px); padding: 8px 8px 8px 16px;
    background: rgba(20, 20, 26, 0.92); -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 14px; box-shadow: 0 0 28px rgba(0, 0, 0, 0.55);
    color: #f2f2f7; font: 14px 'Segoe UI', system-ui, sans-serif;
}
#tcMeasureBar[hidden] { display: none; }
.tc-mb-text { flex: 1 1 auto; min-width: 0; margin-right: 6px; }
.tc-mb-text b { display: block; font-size: 14px; }
.tc-mb-text span { display: block; font-size: 13px; color: #b4b4c0; }
.tc-btn {
    flex: 0 0 auto; min-width: 44px; height: 40px; padding: 0 14px; border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.14); background: rgba(255, 255, 255, 0.06);
    color: #f2f2f7; font: 600 14px 'Segoe UI', system-ui, sans-serif; cursor: pointer;
}
.tc-btn.tc-primary { background: #4f46e5; border-color: #6366f1; }
.tc-btn:disabled { opacity: 0.45; }

/* First-visit card */
#tcHint {
    position: fixed; left: 50%; bottom: 16px; transform: translate(-50%, 12px); z-index: 10950;
    width: min(380px, calc(100vw - 24px)); box-sizing: border-box; padding: 14px 16px 12px;
    background: rgba(20, 20, 26, 0.95); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 16px;
    box-shadow: 0 10px 44px rgba(0, 0, 0, 0.6); color: #f2f2f7; font: 14px 'Segoe UI', system-ui, sans-serif;
    opacity: 0; transition: opacity 0.25s, transform 0.25s;
}
#tcHint.tc-on { opacity: 1; transform: translate(-50%, 0); }
.tc-hint-title { font-size: 15px; font-weight: 600; margin: 0 0 10px; }
.tc-hint-list { display: grid; grid-template-columns: auto 1fr; gap: 7px 14px; margin: 0 0 12px; }
.tc-hint-list dt { font-weight: 600; color: #c7d2fe; white-space: nowrap; }
.tc-hint-list dd { margin: 0; color: #d4d4dc; }
.tc-hint-ok { display: block; margin-left: auto; }
`;
    (document.head || document.documentElement).appendChild(css);

    // ══════════════════════════════════════════════════════════════
    //  State
    // ══════════════════════════════════════════════════════════════
    let canvas = null;
    const fingers = new Map();      // touch identifier → { x, y } on the page, in landing order
    let gesture = null;             // what the fingers on the canvas are doing (see begin())
    let lastTap = null;             // { x, y, t, acted }: the first half of a double tap
    let fling = null;               // { vx, vy, t }: a one-finger turn coasting after release
    let holdTimer = 0, holdShowTimer = 0;
    let carriedBefore = null;       // what rode the cursor last frame (a measuring point, a box)
    let gesturesDone = 0;           // for retiring the first-visit card

    const firstTwo = () => {
        const it = fingers.values();
        return [it.next().value, it.next().value];
    };
    const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

    // ══════════════════════════════════════════════════════════════
    //  Touches on the canvas
    // ══════════════════════════════════════════════════════════════
    function onTouchStart(e) {
        if (e.target !== canvas) return;   // annotations, the 360° viewer and the panels handle their own
        e.preventDefault();                // no scrolling, page zoom, or mouse events made up from the touch
        e.stopPropagation();               // and not Potree's InputHandler either

        // Forget fingers whose end never arrived (a dialog, a lost touchend)
        const live = new Set(Array.from(e.touches, (t) => t.identifier));
        for (const id of fingers.keys()) if (!live.has(id)) fingers.delete(id);
        for (const t of e.changedTouches) fingers.set(t.identifier, { x: t.clientX, y: t.clientY });
        fling = null;

        if (!gesture || fingers.size === 1) {
            closeToolsMenu();
            begin(e.timeStamp);
        }
        if (fingers.size < 2) return;
        const kind = gesture.kind;
        if (kind === "press" || kind === "turn" || kind === "drag" || (kind === "rest" && !gesture.photo)) {
            cancelHold();
            if (kind === "drag") endObjectDrag();
            beginPinch();
        } else if (kind === "swipe") {
            gesture = { kind: "rest", photo: true };   // a photo's view is pinned; two fingers do nothing there
        }
    }

    function onTouchMove(e) {
        if (e.target !== canvas || !gesture) return;
        e.preventDefault();
        e.stopPropagation();
        for (const t of e.changedTouches) {
            const f = fingers.get(t.identifier);
            if (f) { f.x = t.clientX; f.y = t.clientY; }
        }

        const g = gesture;
        const [f] = firstTwo();
        if (!f) return;
        switch (g.kind) {
            case "press": {
                if (Math.hypot(f.x - g.x0, f.y - g.y0) <= TAP_SLOP) return;
                cancelHold();
                if (g.held) {
                    gesture = { kind: "rest" };          // the hold has done its job
                } else if (g.target) {
                    startObjectDrag(g.x0, g.y0);
                    moveObjectDrag(f.x, f.y);
                } else {
                    stopTweens();
                    gesture = { kind: "turn", x: g.x0, y: g.y0, samples: [] };
                    turnTo(f.x, f.y, e.timeStamp);
                }
                return;
            }
            case "turn": turnTo(f.x, f.y, e.timeStamp); return;
            case "drag": moveObjectDrag(f.x, f.y); return;
            case "pinch": movePinch(); return;
            case "swipe": g.x = f.x; g.y = f.y; return;
        }
    }

    function onTouchEnd(e) {
        if (e.target !== canvas) return;
        e.preventDefault();
        e.stopPropagation();
        const lifted = Array.from(e.changedTouches);
        for (const t of lifted) fingers.delete(t.identifier);
        const g = gesture;
        if (!g) return;

        if (fingers.size > 0) {
            // A finger left a pinch. With two still down it carries on; with one, that finger rests
            // until it lifts too (fingers rarely leave the glass together, and the last one would
            // otherwise give the view a jolt).
            if (g.kind === "pinch") {
                if (fingers.size >= 2) beginPinch();
                else gesture = { kind: "rest" };
            }
            return;
        }

        gesture = null;
        cancelHold();
        const cancelled = e.type === "touchcancel";
        const last = lifted.length ? { x: lifted[0].clientX, y: lifted[0].clientY } : null;
        switch (g.kind) {
            case "press":
                if (!cancelled && !g.held && e.timeStamp - g.t0 <= TAP_TIME) tap(g.x0, g.y0, g.t0, e.timeStamp);
                break;
            case "turn":
                if (!cancelled) startFling(g, e.timeStamp);
                break;
            case "drag":
                endObjectDrag(last);
                break;
            case "swipe":
                if (!cancelled && last) swipePhoto(g, last);
                break;
        }
        if (g.kind !== "press" || g.held) gestureDone();
        clearHover();
    }

    // Touch pointer moves during a camera gesture stop here (see the header); a tool that took
    // the finger itself (the transform gizmo) still gets them.
    function onPointerMove(e) {
        if (e.pointerType === "touch" && e.target === canvas && gesture && gesture.kind !== "tool") {
            e.stopImmediatePropagation();
        }
    }

    // ══════════════════════════════════════════════════════════════
    //  Gestures
    //    press   one finger down that hasn't moved yet: a tap, a hold, or the start of a drag
    //    turn    one finger turning the view
    //    drag    one finger dragging a measuring point or another of Potree's handles
    //    pinch   two fingers zooming, moving and twisting the view
    //    swipe   one finger on a photo
    //    rest    fingers left over from a pinch or a hold, ignored until they lift
    //    tool    a finger the transform gizmo took (transform_controls.js turns the controls off)
    // ══════════════════════════════════════════════════════════════
    // Times are the touch events' own (e.timeStamp), not when a busy page got round to them
    function begin(t) {
        const [f] = firstTwo();
        cancelHold();

        const controls = viewer.getControls();
        if (controls && controls.enabled === false) {
            gesture = { kind: "tool" };
            return;
        }
        if (inPhoto()) {
            gesture = { kind: "swipe", x0: f.x, y0: f.y, x: f.x, y: f.y };
            return;
        }

        gesture = { kind: "press", x0: f.x, y0: f.y, t0: t, held: false, target: null };
        if (carried()) return;   // taps place what rides the cursor; no holds or handle drags meanwhile
        gesture.target = draggableAt(f.x, f.y);
        if (!gesture.target) {
            const press = gesture;
            holdShowTimer = setTimeout(() => showHoldRing(f.x, f.y), HOLD_SHOW);
            // Decided on the next frame: moves still queued behind a slow one get there first
            holdTimer = setTimeout(() => requestAnimationFrame(() => onHold(press)), HOLD_TIME);
        }
    }

    // ── One finger: turn ─────────────────────────────────────────
    function turnTo(x, y, t) {
        const g = gesture;
        const dx = x - g.x, dy = y - g.y;
        g.x = x;
        g.y = y;
        g.samples.push({ t, dx, dy });
        while (g.samples.length > 1 && t - g.samples[0].t > 100) g.samples.shift();
        turnBy(dx, dy);
    }

    // Orbit and Earth swing around the orbit center, as a mouse drag does. Fly looks around
    // from where it stands, dragging the world along the way a photo sphere does.
    function turnBy(dx, dy) {
        const view = viewer.scene.view;
        if (viewer.getControls() === viewer.fpControls) {
            const k = viewer.getFOV() * Math.PI / 180 / Math.max(1, canvas.clientHeight);
            view.yaw += dx * k;
            view.pitch += dy * k;
        } else {
            const k = TURN / Math.max(1, canvas.clientWidth, canvas.clientHeight);
            const pivot = view.getPivot();
            view.yaw -= dx * k;
            view.pitch -= dy * k;
            view.position.copy(pivot).addScaledVector(view.direction, -view.radius);
        }
    }

    function startFling(g, t) {
        const s = g.samples;
        // Only a finger still moving as it lifts flings
        if (s.length < 2 || t - s[s.length - 1].t > 60) return;
        const span = Math.max(16, t - s[0].t);
        let dx = 0, dy = 0;
        for (const r of s) { dx += r.dx; dy += r.dy; }
        const speed = Math.hypot(dx, dy) / span;
        if (speed < FLING_MIN) return;
        const k = Math.min(1, FLING_MAX / speed);
        fling = { vx: dx / span * k, vy: dy / span * k, t: performance.now() };
    }

    function stepFling() {
        if (!fling) return;
        if (inPhoto()) { fling = null; return; }
        const now = performance.now();
        const dt = now - fling.t;
        fling.t = now;
        // Coasts as far as the elapsed time says, but a stalled frame doesn't make it lurch
        const step = Math.min(dt, 50);
        turnBy(fling.vx * step, fling.vy * step);
        const k = Math.exp(-dt / FLING_TAU);
        fling.vx *= k;
        fling.vy *= k;
        if (Math.hypot(fling.vx, fling.vy) < 0.02) fling = null;
    }

    // ── Two fingers: zoom, move and twist ────────────────────────
    // The point under the fingers (the anchor) stays under them: spreading the fingers brings
    // the camera toward it, twisting swings the camera around the vertical through it, and
    // moving them slides it along. Worked out from where the gesture began, so it can't drift.
    function beginPinch() {
        const [a, b] = firstTwo();
        const view = viewer.scene.view;
        stopTweens();
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        gesture = {
            kind: "pinch",
            d0: Math.max(10, Math.hypot(b.x - a.x, b.y - a.y)),
            a0: Math.atan2(b.y - a.y, b.x - a.x),
            m0: mid,
            pos0: new THREE.Vector3().copy(view.position),
            yaw0: view.yaw,
            pitch0: view.pitch,
            anchor: anchorAt(mid.x, mid.y),
            twist: 0,                    // where the twist engaged, once it has
        };
    }

    function movePinch() {
        const g = gesture;
        const [a, b] = firstTwo();
        if (!a || !b) return;
        const view = viewer.scene.view;
        const scale = Math.max(10, Math.hypot(b.x - a.x, b.y - a.y)) / g.d0;
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };

        let twist = wrapAngle(Math.atan2(b.y - a.y, b.x - a.x) - g.a0);
        if (!g.twist && Math.abs(twist) > TWIST_START) g.twist = Math.sign(twist) * TWIST_START;
        twist = g.twist ? twist - g.twist : 0;

        // Turn and zoom about the anchor, which leaves it where it was on screen ...
        const offset = g.pos0.clone().sub(g.anchor).applyAxisAngle(Z_UP, twist);
        offset.setLength(Math.min(MAX_DIST, Math.max(MIN_DIST, offset.length() / scale)));
        view.yaw = g.yaw0 + twist;
        view.pitch = g.pitch0;
        view.position.copy(g.anchor).add(offset);

        // ... then slide the camera across the screen until the anchor is under the fingers
        const dir = new THREE.Vector3().copy(view.direction);
        const depth = Math.max(MIN_DIST, g.anchor.clone().sub(view.position).dot(dir));
        const perPx = 2 * depth * Math.tan(viewer.getFOV() * Math.PI / 360) / Math.max(1, canvas.clientHeight);
        const side = new THREE.Vector3().copy(view.getSide());
        const up = side.clone().cross(dir);
        view.position
            .addScaledVector(side, -(mid.x - g.m0.x) * perPx)
            .addScaledVector(up, (mid.y - g.m0.y) * perPx);

        // The orbit center moves to the anchor's depth, so a one-finger turn afterwards
        // swings around what was just zoomed to
        view.radius = depth;
    }

    /**
     * The point exactly under a spot on the page, as deep as the cloud there (else as deep as
     * the orbit center). Potree's pick finds the nearest point within a window around the spot,
     * which can sit a few dozen pixels off it, so only its depth is used.
     */
    function anchorAt(x, y) {
        const view = viewer.scene.view;
        const { cx, cy } = toCanvas(x, y);
        const ray = Potree.Utils.mouseToRay({ x: cx, y: cy }, viewer.scene.getActiveCamera(),
            canvas.clientWidth, canvas.clientHeight);
        const origin = new THREE.Vector3().copy(ray.origin);
        const along = new THREE.Vector3().copy(ray.direction);
        const hit = pickAt(x, y);
        const depth = hit
            ? hit.sub(origin).dot(along)
            : Math.max(view.radius, MIN_DIST) / Math.max(0.1, along.dot(view.direction));
        return origin.addScaledVector(along, Math.max(MIN_DIST, depth));
    }

    // ── Dragging Potree's handles (measuring points and the like) ─
    // Through Potree's own mouse handling, so the handle does what it would under the mouse.
    function draggableAt(x, y) {
        const ih = viewer.inputHandler;
        if (!ih || typeof ih.getHoveredElements !== "function") return null;
        const { cx, cy } = toCanvas(x, y);
        ih.mouse.set(cx, cy);
        const hit = ih.getHoveredElements().find((h) => {
            const l = h.object._listeners;
            return l && l.drag && l.drag.length > 0;
        });
        return hit ? hit.object : null;
    }

    function startObjectDrag(x, y) {
        const ih = viewer.inputHandler;
        const { cx, cy } = toCanvas(x, y);
        ih.mouse.set(cx, cy);
        ih.hoveredElements = ih.getHoveredElements();   // what Potree's mousedown picks up
        mouse("mousedown", x, y, 0, 1);
        gesture = { kind: "drag", x, y };
    }

    // What a mousemove with the button held does in Potree, minus the other mousemove
    // listeners (hover cards, the brush, the inspector), which have no business in a drag
    function moveObjectDrag(x, y) {
        gesture.x = x;
        gesture.y = y;
        const ih = viewer.inputHandler;
        const drag = ih.drag;
        if (!drag || !drag.object) return;
        const { cx, cy } = toCanvas(x, y);
        ih.mouse.set(cx, cy);
        drag.mouse = 1;
        drag.lastDrag.set(cx - drag.end.x, cy - drag.end.y);
        drag.end.set(cx, cy);
        drag.object.dispatchEvent({ type: "drag", drag, viewer });
    }

    function endObjectDrag(at) {
        const g = gesture && gesture.kind === "drag" ? gesture : null;
        const x = at ? at.x : g ? g.x : 0, y = at ? at.y : g ? g.y : 0;
        mouse("mouseup", x, y, 0, 0);
        viewer.inputHandler.hoveredElements = [];
    }

    // ── A photo: swipe through the set ───────────────────────────
    function swipePhoto(g, at) {
        const dx = at.x - g.x0, dy = at.y - g.y0;
        if (Math.abs(dx) < SWIPE_MIN || Math.abs(dx) < 1.5 * Math.abs(dy)) return;
        const images = viewer.getControls().orientedImagesInstance;
        if (images && typeof images.focusByOffset === "function") images.focusByOffset(dx < 0 ? 1 : -1);
    }

    // ── Press and hold: the Point Inspector ──────────────────────
    function onHold(g) {
        if (gesture !== g || g.kind !== "press") return;
        hideHoldRing(true);
        if (typeof window.inspectPointAt !== "function" || !pickAt(g.x0, g.y0)) return;   // nothing to read there
        g.held = true;
        if (!window.inspectPointAt(g.x0, g.y0) && typeof window.togglePointInspector === "function") {
            window.togglePointInspector();
            window.inspectPointAt(g.x0, g.y0);
        }
        buzz(12);
    }

    function cancelHold() {
        clearTimeout(holdTimer);
        clearTimeout(holdShowTimer);
        holdTimer = holdShowTimer = 0;
        hideHoldRing(false);
    }

    function showHoldRing(x, y) {
        let ring = document.getElementById("tcHold");
        if (!ring) {
            ring = document.createElement("div");
            ring.id = "tcHold";
            document.body.appendChild(ring);
        }
        ring.className = "";
        ring.style.left = x + "px";
        ring.style.top = y + "px";
        void ring.offsetWidth;   // start the fill from its first frame
        ring.className = "tc-on";
    }

    function hideHoldRing(done) {
        const ring = document.getElementById("tcHold");
        if (ring && ring.className) ring.className = done ? "tc-done" : "";
    }

    // ══════════════════════════════════════════════════════════════
    //  Taps
    // ══════════════════════════════════════════════════════════════
    function tap(x, y, down, up) {
        const prev = lastTap;
        const second = prev && down - prev.t <= DOUBLE_TAP_TIME && Math.hypot(x - prev.x, y - prev.y) <= DOUBLE_TAP_SLOP;
        lastTap = { x, y, t: up, acted: false };

        // A measuring point, a box or a zone's position rides the cursor: put it down here
        if (carried()) {
            placeCarried(x, y);
            lastTap.acted = true;
            return;
        }

        if (second) {
            lastTap = null;
            if (!prev.acted) zoomAt(x, y);   // after a tap that opened something, the second one is spent
            return;
        }

        const marker = markerAt(x, y);
        if (marker) {
            openMarker(marker);
            lastTap.acted = true;
            return;
        }

        if (typeof window.inspectPointAt === "function" && window.inspectPointAt(x, y)) return;

        clickAt(x, y);
    }

    /** Fly to the point, as Potree's double-click does (the active controls' own zoomToLocation). */
    function zoomAt(x, y) {
        const controls = viewer.getControls();
        if (!controls || typeof controls.zoomToLocation !== "function") return;
        const { cx, cy } = toCanvas(x, y);
        stopTweens();
        controls.zoomToLocation({ x: cx, y: cy });
    }

    // A tap nothing above wanted is a click, mouse events and all: Potree selects what was
    // tapped, Align by Point Pairs takes its pick, and the page sees a click outside its menus.
    function clickAt(x, y) {
        const ih = viewer.inputHandler;
        const { cx, cy } = toCanvas(x, y);
        ih.mouse.set(cx, cy);
        ih.hoveredElements = ih.getHoveredElements();   // without a mousemove, and the hover cards it would raise
        mouse("mousedown", x, y, 0, 1);
        mouse("mouseup", x, y, 0, 0);
        mouse("click", x, y, 0, 0);
        ih.hoveredElements = [];
    }

    function mouse(type, x, y, button, buttons) {
        canvas.dispatchEvent(new MouseEvent(type, {
            bubbles: true, cancelable: true, view: window, detail: 1,
            clientX: x, clientY: y, screenX: x, screenY: y, button, buttons,
        }));
    }

    // ── Markers: 360° views, photos, zone beacons ────────────────
    /** Every marker a tap could open, as gamepad_controls.js gathers them for its A button. */
    function markerCandidates() {
        const out = [];
        for (const zone of window.zones || []) {
            for (const m of zone.marker360s || []) {
                const group = m._sphereMarker;
                if (!group || !group.visible || !m.image || !m._hitMesh) continue;
                out.push({ kind: "pano", hitObject: m._hitMesh, center: group.getWorldPosition(new THREE.Vector3()), target: group });
            }
        }
        for (const collection of viewer.scene.orientedImages || []) {
            if (typeof collection.focusImage !== "function") continue;
            for (const image of collection.images || []) {
                const mesh = image.mesh;
                if (!mesh || !mesh.visible || mesh.layers.mask === 0) continue;   // hidden sets
                out.push({ kind: "photo", hitObject: mesh, center: mesh.getWorldPosition(new THREE.Vector3()), target: image, collection });
            }
        }
        for (const group of window.beaconObjects || []) {
            const beacon = group.userData && group.userData.beacon;
            if (!group.visible || !beacon || !beacon.cameraPosition || !beacon.cameraTarget || !beacon._hitMesh) continue;
            out.push({ kind: "beacon", hitObject: beacon._hitMesh, center: group.getWorldPosition(new THREE.Vector3()), target: group });
        }
        return out;
    }

    /**
     * The marker under a tap: the nearest one its ray hits, else the one whose center is
     * closest on screen within MARKER_REACH. Not one with a surface or a nearer photo in
     * front of it, by the test the mouse hover uses (isHitOccluded in layer_map.js).
     */
    function markerAt(x, y) {
        const candidates = markerCandidates();
        if (candidates.length === 0) return null;

        const camera = viewer.scene.getActiveCamera();
        const { cx, cy } = toCanvas(x, y);
        const w = canvas.clientWidth, h = canvas.clientHeight;
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(cx / w * 2 - 1, 1 - cy / h * 2), camera);

        let best = null, at = { x, y };
        for (const c of candidates) {
            const hits = raycaster.intersectObject(c.hitObject, false);
            if (hits.length && (!best || hits[0].distance < best.hit.distance)) best = Object.assign(c, { hit: hits[0] });
        }

        if (!best) {
            const ndc = new THREE.Vector3();
            let bestPx = MARKER_REACH;
            for (const c of candidates) {
                ndc.copy(c.center).project(camera);
                if (ndc.z < -1 || ndc.z > 1) continue;   // behind the camera or past the far plane
                const sx = (ndc.x + 1) / 2 * w, sy = (1 - ndc.y) / 2 * h;
                const px = Math.hypot(sx - cx, sy - cy);
                if (px > bestPx) continue;
                bestPx = px;
                best = c;
                at = { x: x + sx - cx, y: y + sy - cy };
            }
            if (!best) return null;
            // Aim the occlusion test at the marker itself
            raycaster.ray.origin.setFromMatrixPosition(camera.matrixWorld);
            raycaster.ray.direction.copy(best.center).sub(raycaster.ray.origin).normalize();
            best.hit = { distance: raycaster.ray.origin.distanceTo(best.center) };
        }

        if (typeof window.isHitOccluded === "function" &&
            window.isHitOccluded(best.hit, raycaster, { clientX: at.x, clientY: at.y })) return null;
        return best;
    }

    function openMarker(m) {
        stopTweens();   // a Potree tween still running would fight the move into the marker
        if (m.kind === "pano") {
            if (typeof window.open360 === "function") window.open360(m.target);
        } else if (m.kind === "photo") {
            m.collection.focusImage(m.target);
        } else if (typeof window.goToBeaconZone === "function") {
            window.goToBeaconZone(m.target);   // zone_beacon_og.js: what clicking the beacon does
        }
    }

    // ══════════════════════════════════════════════════════════════
    //  Measuring, and anything else Potree carries on the cursor
    // ══════════════════════════════════════════════════════════════
    // Potree inserts a measurement, a box or a zone's position by hanging it on the cursor
    // (inputHandler.drag with an object) until a click puts it down. A finger can't hover,
    // so a tap says where.
    function carried() {
        if (gesture && gesture.kind === "drag") return null;   // that's a finger moving a point that's down already
        const drag = viewer.inputHandler && viewer.inputHandler.drag;
        return drag && drag.object ? drag.object : null;
    }

    function carriedMeasure() {
        const object = carried();
        return object ? viewer.scene.measurements.find((m) => m.spheres && m.spheres.includes(object)) || null : null;
    }

    function placeCarried(x, y) {
        const ih = viewer.inputHandler;
        const drag = ih.drag;
        // It only moves onto the cloud (Potree picks under drag.end)
        if (!pickAt(x, y)) {
            toast("Tap on the point cloud");
            return;
        }
        const { cx, cy } = toCanvas(x, y);
        ih.mouse.set(cx, cy);
        drag.lastDrag.set(cx - drag.end.x, cy - drag.end.y);
        drag.end.set(cx, cy);
        drag.object.dispatchEvent({ type: "drag", drag, viewer });
        mouse("mouseup", x, y, 0, 0);    // Potree's left click: put it down (and start the next point)
        buzz(8);
    }

    // The bar for the toolbar's measurements: how many points so far, Done, Cancel
    let bar = null;

    function buildMeasureBar() {
        bar = document.createElement("div");
        bar.id = "tcMeasureBar";
        bar.hidden = true;
        bar.setAttribute("role", "toolbar");
        bar.setAttribute("aria-label", "Measuring");
        bar.innerHTML = `<div class="tc-mb-text"><b></b><span></span></div>
            <button type="button" class="tc-btn" data-act="cancel">Cancel</button>
            <button type="button" class="tc-btn tc-primary" data-act="done">Done</button>`;
        bar.addEventListener("click", (e) => {
            const btn = e.target.closest("button");
            const m = carriedMeasure();
            if (!btn || !m) return;
            if (btn.dataset.act === "done") mouse("mouseup", -1, -1, 2, 0);   // Potree's right click ends it
            else cancelMeasure(m);
            updateMeasureBar();
        });
        document.body.appendChild(bar);
    }

    function cancelMeasure(m) {
        viewer.dispatchEvent({ type: "cancel_insertions" });
        viewer.inputHandler.drag = null;
        viewer.scene.removeMeasurement(m);
    }

    // Each frame: show the bar while a toolbar measurement is drawn, and say what a tap does
    // when something new starts riding the cursor.
    function updateMeasureBar() {
        const object = carried();
        const m = carriedMeasure();
        if (object !== carriedBefore) {
            carriedBefore = object;
            // Single points (a zone's position) and boxes get a word; measurements get the bar
            if (object && !(m && m.maxMarkers > 1)) toast(m ? "Tap the point cloud to place the point" : "Tap the point cloud to place it", 4000);
        }

        const show = !!(m && m.maxMarkers > 1);
        if (!bar) return;
        if (bar.hidden !== !show) bar.hidden = !show;
        if (!show) return;

        const placed = m.points.length - 1;   // the last point is the one riding the cursor
        const name = m.name || "Measurement";
        let text;
        if (m.maxMarkers === 2) text = placed === 0 ? "Tap one end" : "Tap the other end";
        else text = placed === 0 ? "Tap the point cloud to add points" : placed === 1 ? "1 point · tap to add more" : `${placed} points · tap to add more`;
        const done = bar.querySelector('[data-act="done"]');
        setText(bar.querySelector("b"), name);
        setText(bar.querySelector("span"), text);
        done.hidden = m.maxMarkers === 2;          // a height ends by itself at its second point
        done.disabled = placed < 2;
    }

    // ══════════════════════════════════════════════════════════════
    //  Helpers
    // ══════════════════════════════════════════════════════════════
    function toCanvas(x, y) {
        const r = canvas.getBoundingClientRect();
        return { cx: x - r.left, cy: y - r.top };
    }

    /** The cloud point under a spot on the page, or null. */
    function pickAt(x, y) {
        const clouds = viewer.scene.pointclouds.filter((pc) => pc.visible);
        if (clouds.length === 0) return null;
        const { cx, cy } = toCanvas(x, y);
        const hit = Potree.Utils.getMousePointCloudIntersection({ x: cx, y: cy }, viewer.scene.getActiveCamera(),
            viewer, clouds, { pickClipped: true });
        return hit ? new THREE.Vector3().copy(hit.location) : null;
    }

    function inPhoto() {
        const c = viewer.getControls();
        return !!(c && typeof c.hasSomethingCaptured === "function" && c.hasSomethingCaptured());
    }

    function stopTweens() {
        fling = null;
        const c = viewer.getControls();
        if (c && typeof c.stopTweens === "function") c.stopTweens();
        if (c && typeof c.stop === "function") c.stop();
    }

    // The Tools menu closes on a click outside it (misc_tools_button.js), and the canvas makes none
    function closeToolsMenu() {
        if (document.getElementById("miscToolsMenu") && typeof window.toggleMiscToolsMenu === "function") {
            window.toggleMiscToolsMenu();
        }
    }

    // A marker can be left hovered by touch moves outside a camera gesture; zone_beacon_og.js
    // would send the next tap to it.
    function clearHover() {
        if (window.currentHoveredBeacon && typeof window.onBeaconUnhover === "function") window.onBeaconUnhover();
        if (window.currentHoveredMarker360 && typeof window.onMarker360Unhover === "function") window.onMarker360Unhover();
    }

    function buzz(ms) {
        try { if (navigator.vibrate) navigator.vibrate(ms); } catch (_) {}
    }

    function setText(el, text) {
        if (el && el.textContent !== text) el.textContent = text;
    }

    let toastTimer = 0;
    function toast(text, ms = 1800) {
        let el = document.getElementById("tcToast");
        if (!el) {
            el = document.createElement("div");
            el.id = "tcToast";
            el.setAttribute("role", "status");
            document.body.appendChild(el);
        }
        el.textContent = text;
        el.classList.add("tc-on");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => el.classList.remove("tc-on"), ms);
    }

    // ══════════════════════════════════════════════════════════════
    //  Toolbar: an icon's name on press and hold (there is no hover tooltip)
    // ══════════════════════════════════════════════════════════════
    function initToolbarTips() {
        const wrapper = document.getElementById("toolbar-wrapper");
        if (!wrapper) return;
        let timer = 0, shown = false;

        wrapper.addEventListener("touchstart", (e) => {
            clearTimeout(timer);
            shown = false;
            const el = e.target.closest("[aria-label]");
            if (!el || !wrapper.contains(el)) return;
            timer = setTimeout(() => {
                shown = true;
                showTip(el);
                buzz(8);
            }, TIP_HOLD);
        }, { passive: true });
        wrapper.addEventListener("touchmove", () => clearTimeout(timer), { passive: true });
        wrapper.addEventListener("touchend", (e) => {
            clearTimeout(timer);
            if (!shown) return;
            e.preventDefault();          // that was a look, not a press: no click
            shown = false;
            setTimeout(hideTip, 900);
        }, { passive: false });
        wrapper.addEventListener("touchcancel", () => { clearTimeout(timer); shown = false; hideTip(); });
        // Android offers to save a held image
        wrapper.addEventListener("contextmenu", (e) => e.preventDefault());

        // The material list shows no name on small screens
        document.addEventListener("change", (e) => {
            if (e.target && e.target.id === "optMaterial" && matchMedia(SMALL).matches) toast("Material: " + e.target.value);
        });
    }

    function showTip(el) {
        let tip = document.getElementById("tcTip");
        if (!tip) {
            tip = document.createElement("div");
            tip.id = "tcTip";
            document.body.appendChild(tip);
        }
        let text = el.getAttribute("aria-label");
        if (el.id === "optMaterial") text += ": " + el.value;
        tip.textContent = text;
        const r = el.getBoundingClientRect();
        const w = tip.offsetWidth;
        tip.style.left = Math.min(window.innerWidth - w - 6, Math.max(6, r.left + r.width / 2 - w / 2)) + "px";
        tip.style.top = (r.bottom + 8) + "px";
        tip.classList.add("tc-on");
    }

    function hideTip() {
        const tip = document.getElementById("tcTip");
        if (tip) tip.classList.remove("tc-on");
    }

    // ══════════════════════════════════════════════════════════════
    //  The gestures card: on the first visit, and from Tools ▸ Touch Gestures
    // ══════════════════════════════════════════════════════════════
    const HINTS = [
        ["Drag", "Turn the view"],
        ["Pinch", "Zoom in and out"],
        ["Two fingers", "Move · twist to turn"],
        ["Double tap", "Zoom to that spot"],
        ["Tap a marker", "Open a photo, 360° or zone"],
        ["Press and hold", "Details of a point"],
        ["Hold an icon", "See its name"],
    ];

    function showHint() {
        let card = document.getElementById("tcHint");
        if (!card) {
            card = document.createElement("div");
            card.id = "tcHint";
            card.setAttribute("role", "dialog");
            card.setAttribute("aria-label", "Touch gestures");
            card.innerHTML = `<div class="tc-hint-title">Touch gestures</div>
                <dl class="tc-hint-list">${HINTS.map(([g, d]) => `<dt>${g}</dt><dd>${d}</dd>`).join("")}</dl>
                <button type="button" class="tc-btn tc-primary tc-hint-ok">Got it</button>`;
            card.querySelector(".tc-hint-ok").addEventListener("click", hideHint);
            document.body.appendChild(card);
            void card.offsetWidth;
        }
        card.classList.add("tc-on");
    }

    function hideHint() {
        const card = document.getElementById("tcHint");
        try { localStorage.setItem(HINT_KEY, "1"); } catch (_) {}
        if (!card) return;
        card.classList.remove("tc-on");
        setTimeout(() => { if (!card.classList.contains("tc-on")) card.remove(); }, 300);
    }

    function toggleHint() {
        const card = document.getElementById("tcHint");
        if (card && card.classList.contains("tc-on")) hideHint();
        else showHint();
    }

    // Someone already turning and zooming has got the idea
    function gestureDone() {
        gesturesDone++;
        if (gesturesDone === 3 && document.getElementById("tcHint")) hideHint();
    }

    // ══════════════════════════════════════════════════════════════
    //  Init
    // ══════════════════════════════════════════════════════════════
    function onUpdateStart() {
        stepFling();
        updateMeasureBar();
    }

    function init() {
        canvas = viewer.renderer.domElement;
        const area = canvas.parentElement || document.body;
        const opts = { capture: true, passive: false };
        area.addEventListener("touchstart", onTouchStart, opts);
        area.addEventListener("touchmove", onTouchMove, opts);
        area.addEventListener("touchend", onTouchEnd, opts);
        area.addEventListener("touchcancel", onTouchEnd, opts);
        window.addEventListener("pointermove", onPointerMove, true);
        viewer.addEventListener("update_start", onUpdateStart);
        // iOS Safari ignores the page's user-scalable=no: a pinch on a panel would zoom the whole page
        document.addEventListener("gesturestart", (e) => e.preventDefault(), { passive: false });

        buildMeasureBar();
        initToolbarTips();

        // Not in a project page's embedded viewer, which the card would mostly cover
        let seen = document.body.classList.contains("embedded");
        try { seen = seen || localStorage.getItem(HINT_KEY) === "1"; } catch (_) {}
        if (!seen) setTimeout(showHint, 1200);
    }

    // index.html creates the viewer before this script runs
    if (window.viewer && window.viewer.renderer) init();
    else document.addEventListener("DOMContentLoaded", init);

    window.TouchControls = {
        toggleHelp: toggleHint,
        showHelp: showHint,
        hideHelp: hideHint,
    };
})();
