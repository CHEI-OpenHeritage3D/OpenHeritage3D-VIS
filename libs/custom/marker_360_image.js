import { Viewer as PhotoSphereViewer, EquirectangularAdapter } from '@photo-sphere-viewer/core';
import { EquirectangularTilesAdapter } from '@photo-sphere-viewer/equirectangular-tiles-adapter';

// import { Vector3 } from 'three';
import { GyroscopePlugin } from '@photo-sphere-viewer/gyroscope-plugin';

// --- STATE ---
let viewer360 = null;
let pre360View = null;                          // { pos: Vector3, target: Vector3 }
let reopenBlockUntil = 0;
window.viewer360 = viewer360;

let sphereMarker1 = null;

// ══════════════════════════════════════════════════════════════
//  Panel styling
//
//  The Photo Sphere Viewer navbar is restyled into the same floating
//  glass pill the oriented-image viewer uses (see oriented_image_panel.js):
//  same geometry, palette, slider and icon-button treatment. Nothing but
//  looks changes here — every PSV button keeps its own behaviour, and the
//  navbar keeps its own show/hide logic.
//
//  Every selector is scoped under #viewer-360 so ID specificity wins over
//  the PSV stylesheet regardless of which <link> the browser applies last.
// ══════════════════════════════════════════════════════════════

const psv360Style = document.createElement("style");
psv360Style.textContent = `

/* ── The navbar, as a floating glass pill ────────────────── */

#viewer-360 .psv-navbar {
    /* Centred with auto margins rather than left:50% + translateX: for an
       absolutely positioned box, left:50% caps the width available to
       shrink-to-fit at half the viewer, so the pill was squeezing its slider
       and title long before it needed to. */
    position: absolute;
    left: 0;
    right: 0;
    bottom: 24px;
    margin: 0 auto;
    width: fit-content;
    height: auto;
    max-width: min(1060px, 94vw);
    transform: translateY(24px);

    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;

    background: rgba(20, 20, 26, 0.55);
    backdrop-filter: blur(12px) saturate(140%);
    -webkit-backdrop-filter: blur(12px) saturate(140%);

    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 14px;
    box-shadow: 0 0 28px rgba(0,0,0,0.55);

    font: 13px 'Segoe UI', system-ui, sans-serif;
    color: #f2f2f7;

    opacity: 0;
    pointer-events: none;
    transition: opacity 0.25s ease, transform 0.28s ease;
}

#viewer-360 .psv-navbar.psv-navbar--open {
    bottom: 24px;
    opacity: 1;
    transform: translateY(0);
    pointer-events: auto;
}

/* PSV forces content-box inside the navbar; every size below is border-box. */
#viewer-360 .psv-navbar,
#viewer-360 .psv-navbar * { box-sizing: border-box; }

/* ── Icon buttons (move / zoom in-out / gyroscope / fullscreen / menu) ── */

#viewer-360 .psv-navbar .psv-button {
    width: 34px;
    height: 34px;
    flex: 0 0 auto;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 8px;
    background: rgba(255,255,255,0.05);
    color: #e0e0e5;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
}
#viewer-360 .psv-navbar .psv-button:hover {
    background: rgba(79,70,229,0.3);
    border-color: rgba(79,70,229,0.45);
    color: #fff;
}
#viewer-360 .psv-navbar .psv-button--active {
    background: rgba(79,70,229,0.45);
    border-color: rgba(79,70,229,0.6);
    color: #fff;
}
#viewer-360 .psv-navbar .psv-button--disabled { opacity: 0.4; }
#viewer-360 .psv-navbar .psv-button-svg {
    width: 18px;
    height: 18px;
    display: block;
}
/* the stock sheet overlaps the move buttons' padding — we have real gaps now */
#viewer-360 .psv-navbar .psv-move-button + .psv-move-button { margin-left: 0; }

/* ── Divider ─────────────────────────────────────────────── */

#viewer-360 .psv-navbar .psv-oi-sep {
    width: 1px;
    align-self: stretch;
    margin: 2px 0;
    background: rgba(255,255,255,0.12);
    flex-shrink: 0;
}

/* ── Title block (PSV caption) ───────────────────────────── */

#viewer-360 .psv-navbar .psv-button.psv-caption {
    /* A fixed slot, not a shrinkable one: in an intrinsically sized flex
       container (the pill is width:fit-content) a flex-shrink item is sized by
       the flex-fraction algorithm and comes out narrower than its basis, which
       was quietly squeezing the title and the slider even on a wide screen.
       Everything here is rigid; the @container rules below do the shedding.
       .psv-caption-content is width:100%, so NavbarCaption's "does my content
       still fit" check always agrees and the name simply ellipsises. */
    flex: 0 0 184px;
    width: 184px;
    height: auto;
    min-width: 0;
    padding: 0;
    margin: 0 2px;
    background: none;
    border: none;
    border-radius: 0;
    cursor: default;
    text-align: left;
    color: #f2f2f7;
    overflow: visible;
}
#viewer-360 .psv-navbar .psv-button.psv-caption:hover {
    background: none;
    border: none;
    color: #f2f2f7;
}
#viewer-360 .psv-navbar .psv-caption-content {
    display: block;
    width: 100%;
    padding: 0;
    white-space: nowrap;
}
#viewer-360 .psv-oi-title {
    display: flex;
    flex-direction: column;
    gap: 1px;
    width: 100%;
    min-width: 0;
}
#viewer-360 .psv-oi-title-name {
    font-size: 13px;
    font-weight: 600;
    color: #f2f2f7;
    font-family: monospace;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
#viewer-360 .psv-oi-title-index {
    font-size: 11px;
    color: #888;
    font-variant-numeric: tabular-nums;
}

/* ── Zoom slider ─────────────────────────────────────────── */

#viewer-360 .psv-navbar .psv-button.psv-zoom-range {
    width: 96px;
    height: 34px;
    margin: 0;
    padding: 0 6px;
    background: none;
    border: none;
    border-radius: 0;
    display: flex;
    align-items: center;
}
#viewer-360 .psv-navbar .psv-button.psv-zoom-range:hover {
    background: none;
    border: none;
}
#viewer-360 .psv-navbar .psv-zoom-range-line {
    width: 84px;
    height: 6px;
    border-radius: 3px;
    background: rgba(255,255,255,0.12);
}
#viewer-360 .psv-navbar .psv-zoom-range:not(.psv-button--disabled):hover .psv-zoom-range-line {
    box-shadow: none;
    background: rgba(255,255,255,0.18);
}
#viewer-360 .psv-navbar .psv-zoom-range-handle {
    width: 16px;
    height: 16px;
    top: -5px;                 /* (6px track - 16px handle) / 2 */
    background: #6e6bff;
    border: 2px solid rgba(255,255,255,0.2);
    box-shadow: 0 0 8px rgba(79, 70, 229, 0.4);
}
#viewer-360 .psv-navbar .psv-zoom-range:not(.psv-button--disabled):hover .psv-zoom-range-handle {
    transform: scale(1.15);
    box-shadow: 0 0 14px rgba(79, 70, 229, 0.6);
}

/* ── Opacity control ─────────────────────────────────────── */

#viewer-360 .psv-navbar .psv-button.psv-oi-opacity-btn {
    flex: 0 0 auto;
    width: auto;
    height: 34px;
    padding: 0;
    background: none;
    border: none;
    border-radius: 0;
    cursor: default;
}
#viewer-360 .psv-navbar .psv-button.psv-oi-opacity-btn:hover {
    background: none;
    border: none;
}
#viewer-360 .psv-oi-opacity {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    height: 100%;
    overflow: hidden;
}
#viewer-360 .psv-oi-opacity-label {
    font-size: 11px;
    white-space: nowrap;
    overflow: hidden;
    min-width: 0;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #888;
    flex-shrink: 0;
}
#viewer-360 .psv-oi-slider {
    width: 110px;
    flex: 0 0 110px;
    -webkit-appearance: none;
    appearance: none;
    height: 6px;
    margin: 0;
    padding: 0;
    border: none;
    border-radius: 3px;
    background: rgba(255,255,255,0.12);
    outline: none;
    cursor: pointer;
    transition: background 0.15s;
}
#viewer-360 .psv-oi-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #6e6bff;
    border: 2px solid rgba(255,255,255,0.2);
    cursor: pointer;
    box-shadow: 0 0 8px rgba(79, 70, 229, 0.4);
    transition: transform 0.12s, box-shadow 0.12s;
}
#viewer-360 .psv-oi-slider::-webkit-slider-thumb:hover {
    transform: scale(1.15);
    box-shadow: 0 0 14px rgba(79, 70, 229, 0.6);
}
#viewer-360 .psv-oi-slider::-moz-range-thumb {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #6e6bff;
    border: 2px solid rgba(255,255,255,0.2);
    cursor: pointer;
}
#viewer-360 .psv-oi-opacity-value {
    min-width: 38px;
    text-align: right;
    font-size: 13px;
    color: #ccc;
    font-variant-numeric: tabular-nums;
    flex-shrink: 0;
    user-select: none;
}

/* ── Image navigation (prev / next) ──────────────────────── */

#viewer-360 .psv-navbar .psv-button.psv-oi-nav {
    width: 34px;
    font: 20px/1 'Segoe UI', system-ui, sans-serif;
}

/* Key cap on the opacity label, as in .oi-key */
#viewer-360 .psv-oi-key {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 20px;
    height: 20px;
    padding: 0 5px;
    border-radius: 4px;
    background: rgba(255,255,255,0.1);
    border: 1px solid rgba(255,255,255,0.15);
    color: #aaa;
    font-size: 11px;
    font-weight: 600;
    font-family: monospace;
    letter-spacing: normal;   /* shield from the label's uppercase/tracking */
    text-transform: none;
    flex-shrink: 0;
}

/* ── Narrow viewers ──────────────────────────────────────────
   PSV's own collapse-into-a-menu logic measures the navbar's width, which
   for a shrink-to-fit pill is just its content — so it never fires. Shed
   the optional pieces here instead; the close button always survives.
   (.psv-container declares container-type: size, so these query it.)      */

@container psv-container (max-width: 1100px) {
    #viewer-360 .psv-oi-opacity-label { display: none; }
}
@container psv-container (max-width: 1000px) {
    /* prev/next and drag-to-pan both survive, so these go first */
    #viewer-360 .psv-navbar .psv-move-button { display: none; }
}
@container psv-container (max-width: 820px) {
    #viewer-360 .psv-navbar .psv-button.psv-caption { display: none; }
    #viewer-360 .psv-oi-opacity-value { display: none; }
    #viewer-360 .psv-oi-slider { flex: 0 0 80px; width: 80px; }
}
@container psv-container (max-width: 410px) {
    #viewer-360 .psv-navbar .psv-button.psv-oi-opacity-btn { display: none; }
}

/* ── Close button ────────────────────────────────────────── */

#viewer-360 .psv-navbar .psv-button.psv-oi-close { width: 34px; }
#viewer-360 .psv-navbar .psv-button.psv-oi-close:hover {
    background: rgba(220, 38, 38, 0.4);
    border-color: rgba(239, 68, 68, 0.5);
    color: #fecaca;
}
#viewer-360 .psv-navbar .psv-oi-close svg {
    width: 18px;
    height: 18px;
    display: block;
}

/* ── Overflow menu / tooltips / loader, kept on-palette ──── */

#viewer-360 .psv--has-navbar .psv-panel { height: 100%; }
#viewer-360 .psv-panel {
    background: rgba(20, 20, 26, 0.72);
    backdrop-filter: blur(12px) saturate(140%);
    -webkit-backdrop-filter: blur(12px) saturate(140%);
}
#viewer-360 .psv-panel-content { color: #e0e0e5; }

#viewer-360 .psv-tooltip {
    background: rgba(20, 20, 26, 0.85);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border-radius: 8px;
    box-shadow: 0 0 18px rgba(0,0,0,0.5);
}
#viewer-360 .psv-tooltip-content {
    color: #f2f2f7;
    font: 12px 'Segoe UI', system-ui, sans-serif;
    text-shadow: none;
    padding: 6px 10px;
}
#viewer-360 .psv-tooltip-arrow { display: none; }

/* Loader colours are read from CSS once, when the viewer is built. */
#viewer-360 .psv-loader { color: #a5a0ff; }
#viewer-360 .psv-loader-canvas { color: rgba(20, 20, 26, 0.65); }
#viewer-360 .psv-loader-text {
    font: 600 14px 'Segoe UI', system-ui, sans-serif;
    color: #f2f2f7;
}

/* Error overlay: dark, instead of the stock white radial gradient. */
#viewer-360 .psv-overlay {
    background: rgba(20, 20, 26, 0.75);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    opacity: 1;
}
#viewer-360 .psv-overlay-image { color: #6e6bff; }
#viewer-360 .psv-overlay-title {
    color: #f2f2f7;
    font: 24px 'Segoe UI', system-ui, sans-serif;
}
#viewer-360 .psv-overlay-text {
    color: #aaa;
    font: 15px 'Segoe UI', system-ui, sans-serif;
}
`;
document.head.appendChild(psv360Style);

const SVG_CLOSE_360 =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/>' +
    '<line x1="6" y1="6" x2="18" y2="18"/></svg>';

// ══════════════════════════════════════════════════════════════
//  Opacity control
//
//  One slider for the lifetime of the page — it is handed to the navbar
//  when the PSV viewer is first built, so it has to outlive _open360().
// ══════════════════════════════════════════════════════════════

const opacityEl = document.createElement('input');
opacityEl.type  = 'range';
opacityEl.min   = '0';
opacityEl.max   = '99.5';
opacityEl.step  = '0.5';   // so max is actually reachable (default step is 1)
opacityEl.value = '100';
opacityEl.className = 'psv-oi-slider';
opacityEl.title = 'Cross-fade the panorama against the point cloud ([ / ])';

const opacityValueEl = document.createElement('span');
opacityValueEl.className = 'psv-oi-opacity-value';

function syncOpacityReadout() {
    opacityValueEl.textContent = Math.round(Number(opacityEl.value)) + '%';
}
syncOpacityReadout();
opacityEl.addEventListener('input', syncOpacityReadout);

function get360Opacity() {
    return Number(opacityEl.value) / 100;
}

// Drives the slider, the readout and the panorama from one place, so the
// hotkeys and the slider can never disagree.
function set360Opacity(fraction) {
    const max = (Number(opacityEl.max) || 100) / 100;
    const v = Math.min(max, Math.max(0, fraction));
    opacityEl.value = String(v * 100);      // the input snaps this to its step
    syncOpacityReadout();
    applyOpacity(viewer360, viewer360 && viewer360._opacity);
}

// The wrapper handed to PSV as the custom button's content.
function buildOpacityControl() {
    const wrap = document.createElement('div');
    wrap.className = 'psv-oi-opacity';

    const label = document.createElement('span');
    label.className = 'psv-oi-opacity-label';
    label.innerHTML = 'Opacity <span class="psv-oi-key">W</span>';
    label.title = 'Cycle panorama opacity: 100% / 50% / 0% (W)';

    wrap.appendChild(label);
    wrap.appendChild(opacityEl);
    wrap.appendChild(opacityValueEl);
    return wrap;
}

// 1) One function to apply opacity to the current pano mesh
function applyOpacity(viewer, valToApply) {
    // console.log(viewer);
    if(!opacityEl) return;
    if(!viewer) return;

    // `|| valToApply` used to swallow 0 as falsy, so the panorama could never
    // actually be cleared — which the peek/cycle hotkeys below depend on.
    const raw = Number(opacityEl.value);
    const val = Number.isFinite(raw) ? raw / 100 : valToApply;
    const meshes = viewer.renderer?.mesh.children;
    if (!meshes) return; // mesh not ready yet

    let baseMesh, tilesMesh;

    meshes.forEach(mesh => {
        if(Array.isArray(mesh.material)) tilesMesh = mesh;
        else baseMesh = mesh;
    });

    if(!viewer360._hasTiles){   // no tiles

        const mat = baseMesh.material;
        mat.transparent = val < 1;
        mat.opacity = val;
        mat.depthWrite = val === 1;
        mat.needsUpdate = true;


        const mats = tilesMesh.material;
        for (const mat of mats) {
            // console.log(mat);
            if (!mat) continue;
            mat.transparent = val < 1;
            mat.opacity = 0;
            mat.depthWrite = val === 1;
            mat.needsUpdate = true;
        }

    }
    else {
        // console.log('editing tiles');
        const baseMat = baseMesh.material;
        baseMat.opacity = 0;

        const mats = tilesMesh.material;
        // console.log(mats)
        for (const mat of mats) {
            if (!mat) continue;
            if(!mat.map){
                mat.opacity = 0;
                continue;
            }
            mat.transparent = val < 1;
            mat.opacity = val;
            mat.depthWrite = val === 1;
            mat.needsUpdate = true;
            baseMat.opacity = 0;
        }
    }
    viewer._opacity = val;

    viewer.needsUpdate();
}

// ══════════════════════════════════════════════════════════════
//  Panorama descriptor
//
//  One place to describe a marker to Photo Sphere Viewer, used both when the
//  viewer is first built and by every setPanorama() after it. Markers with
//  `tiles` are served tile by tile; the rest hand over a single equirect
//  image as the adapter's base texture.
// ══════════════════════════════════════════════════════════════

function build360Panorama(marker360) {
    const tiles = marker360.tiles;

    return {
        width: 2000000,
        cols: 16,
        rows: 8,
        baseUrl: tiles ? null : marker360.image,
        tileUrl: (col, row) => {
            if (!tiles) return;
            return `${tiles}-${col}-${row}.png`;
        }
    };
}

// ══════════════════════════════════════════════════════════════
//  Moving between adjacent images
//
//  The markers of a zone, in the order zone.marker360s lists them — the same
//  order the "3 / 7" line in the title reports. Wraps at both ends, like
//  OrientedImages.focusByOffset() in potree.js.
// ══════════════════════════════════════════════════════════════

function get360Siblings(marker360) {
    const list = marker360 && marker360._sphereMarker
        && marker360._sphereMarker.userData
        && marker360._sphereMarker.userData.zone
        && marker360._sphereMarker.userData.zone.marker360s;
    if (!Array.isArray(list)) return null;
    const index = list.indexOf(marker360);
    return (index >= 0) ? { list, index } : null;
}

function navigate360(offset) {
    const sib = get360Siblings(window.viewing360Marker);
    if (!sib) return;

    const n = sib.list.length;
    if (n < 2) return;

    // step past any neighbour that has no panorama to show
    for (let step = 1; step <= n; step++) {
        const cand = sib.list[((sib.index + offset * step) % n + n) % n];
        if (cand && cand !== window.viewing360Marker && cand.image && cand._sphereMarker) {
            _open360(cand._sphereMarker);
            return;
        }
    }
}

// Nothing to move between in a zone holding a single marker.
function update360NavButtons(psv) {
    const nav = psv && psv.navbar;
    if (!nav) return;

    const sib = get360Siblings(window.viewing360Marker);
    const many = !!(sib && sib.list.length > 1);

    for (const id of ['prev-360', 'next-360']) {
        const button = nav.getButton(id, false);
        if (button) many ? button.show(false) : button.hide(false);
    }
    if (nav.container) tidySeparators(nav.container);
}

// ══════════════════════════════════════════════════════════════
//  Keyboard
//
//  The same bindings the oriented-image panel uses (oriented_image_panel.js):
//    Esc            close the 360 viewer
//    ← / →          previous / next image in the zone
//    Space (hold)   "peek" — momentarily clear the panorama
//    [ / ]          nudge opacity down / up
//    W              cycle opacity: 100% -> 50% -> 0% -> 50% -> 100% ...
//
//  Bound in the CAPTURE phase and stopped there, so while the 360 viewer is
//  up these keys never reach the handlers underneath: Potree's InputHandler
//  (#photo360 lives inside #potree_render_area, so keys bubble into it),
//  the brush's own W binding, and PSV's arrow-key rotation in fullscreen.
// ══════════════════════════════════════════════════════════════

const kb360 = {
    opacityToggleDir: -1,   // -1 = W is heading toward 0%, 1 = heading toward 100%
    peeking: false,
    peekPrevOpacity: 1.0,
};

// Cycles opacity 100% -> 50% -> 0% -> 50% -> 100% -> ... on each call.
function toggle360OpacityCycle() {
    const a = get360Opacity();
    let next;
    if (a > 0.5) {
        next = 0.5;
        kb360.opacityToggleDir = -1;        // next stop is 0%
    } else if (a < 0.5) {
        next = 0.5;
        kb360.opacityToggleDir = 1;         // next stop is 100%
    } else {
        next = kb360.opacityToggleDir < 0 ? 0 : 1.0;
    }
    set360Opacity(next);
}

function startPeek360() {
    if (kb360.peeking) return;
    kb360.peeking = true;
    kb360.peekPrevOpacity = get360Opacity();
    set360Opacity(0);
    opacityValueEl.textContent = 'peek';
}

function endPeek360() {
    if (!kb360.peeking) return;
    kb360.peeking = false;
    set360Opacity(kb360.peekPrevOpacity);
}

function is360Fullscreen() {
    try {
        if (document.fullscreenElement) return true;
        return !!(viewer360 && viewer360.isFullscreenEnabled && viewer360.isFullscreenEnabled());
    } catch { return false; }
}

function isTyping360(t) {
    return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA'
        || t.tagName === 'SELECT' || t.isContentEditable);
}

document.addEventListener('keydown', (e) => {
    if (!window.in360View || !viewer360) return;
    if (isTyping360(e.target)) return;          // incl. the opacity slider itself
    if (e.ctrlKey || e.metaKey || e.altKey) return;   // Ctrl is the decouple key

    let handled = true;

    switch (e.key) {
        case 'Escape':
            // in fullscreen, Escape is the browser's own way out — take it,
            // and leave the viewer open behind it
            if (is360Fullscreen()) { handled = false; break; }
            close360();
            break;
        case 'ArrowLeft':  navigate360(-1);                       break;
        case 'ArrowRight': navigate360(1);                        break;
        case '[':        set360Opacity(get360Opacity() - 0.1);    break;
        case ']':        set360Opacity(get360Opacity() + 0.1);    break;
        case 'w':
        case 'W':        toggle360OpacityCycle();                 break;
        case ' ':        startPeek360();                          break;
        default:         handled = false;
    }

    if (handled) {
        e.preventDefault();
        e.stopPropagation();
    }
}, true);

document.addEventListener('keyup', (e) => {
    if (e.key === ' ' && kb360.peeking) {
        endPeek360();
        e.preventDefault();
        e.stopPropagation();
    }
}, true);

// Alt-tabbing away mid-peek swallows the keyup, which would otherwise leave
// the panorama stuck invisible.
window.addEventListener('blur', endPeek360);

// ══════════════════════════════════════════════════════════════
//  Potree <-> PSV camera coupling
//
//  Module scope on purpose. These used to live at the foot of _open360(),
//  where `let viewerPosOffset` sat *below* the `if(viewerPosOffset)` reset in
//  the reopen branch — so every reopen threw a TDZ ReferenceError and bailed
//  out of the rest of _open360(). Out here the reset works, and the document
//  listeners are registered once instead of once per open.
// ══════════════════════════════════════════════════════════════

let viewerPosOffset = { yaw: 0, pitch: 0 };
let psvStartPos = null;
let psvEndPos = null;

function movePSVPotreeCam(position) {
    if (window.psvDecoupled) return;

    const baseYaw = -position.yaw;
    const basePitch = position.pitch;

    viewer.scene.view.yaw = baseYaw + (viewerPosOffset?.yaw || 0);
    viewer.scene.view.pitch = basePitch - (viewerPosOffset?.pitch || 0);
    viewer.scene.view.roll = position.roll;
}

// When Control is pressed: start decoupling mode
document.addEventListener('keydown', (e) => {
    if (e.key === 'Control' && !window.psvDecoupled && viewer360) {
        window.psvDecoupled = true;
        // Save the starting PSV position
        psvStartPos = viewer360.getPosition(); // {yaw, pitch}
        console.log('Decouple start', psvStartPos);
    }
});

// When Control is released: compute new offset and re-couple
document.addEventListener('keyup', (e) => {
    if (e.key === 'Control' && window.psvDecoupled && viewer360) {
        psvEndPos = viewer360.getPosition(); // {yaw, pitch}
        console.log('Decouple end', psvEndPos);

        // Compute the delta between the two cameras
        viewerPosOffset = {
            yaw: (viewerPosOffset?.yaw || 0) + (psvEndPos.yaw - psvStartPos.yaw),
            pitch: (viewerPosOffset?.pitch || 0) + (psvEndPos.pitch - psvStartPos.pitch),
        };

        console.log('Updated offset', viewerPosOffset);
        window.psvDecoupled = false;
    }
});

// ══════════════════════════════════════════════════════════════
//  Navbar dividers
//
//  Plain <div>s dropped straight into the navbar rather than PSV custom
//  buttons, so they stay invisible to Navbar.autoSize() and never turn up
//  as blank rows in the overflow menu.
// ══════════════════════════════════════════════════════════════

function insertSepBefore(navEl, target) {
    if (!navEl || !target || target.parentNode !== navEl) return;
    const sep = document.createElement('div');
    sep.className = 'psv-oi-sep';
    navEl.insertBefore(sep, target);
}

// A divider only earns its place when there is something visible on either
// side of it — buttons come and go as PSV collapses them into the menu.
function tidySeparators(navEl) {
    let seenContent = false;
    let pendingSep = null;

    for (const el of navEl.children) {
        if (el.classList.contains('psv-oi-sep')) {
            el.style.display = 'none';
            pendingSep = el;
            continue;
        }
        if (el.offsetWidth === 0) continue;          // hidden, or shrunk away
        if (seenContent && pendingSep) pendingSep.style.display = '';
        pendingSep = null;
        seenContent = true;
    }
}

// PSV hides buttons behind an overflow menu when the navbar's width falls
// short of the sum of its buttons'. That comparison is meaningless for a
// shrink-to-fit pill — the navbar IS its content — so it fires at arbitrary
// widths, e.g. whenever a shorter title makes the pill narrower. The
// @container rules above do the responsive work instead.
function disableNavbarCollapse(psv) {
    const nav = psv && psv.navbar;
    if (!nav) return;

    for (const child of nav.children) {
        if (!child || !child.config) continue;
        child.config.collapsable = false;
        if (child.state && child.state.collapsed) child.uncollapse();
    }
    nav.collapsed = [];

    const menu = nav.getButton('menu', false);
    if (menu) menu.hide(false);
}

function decorateNavbar(psv) {
    const nav = psv && psv.container && psv.container.querySelector('.psv-navbar');
    if (!nav) return;
    if (nav.dataset.oiDecorated) { tidySeparators(nav); return; }
    nav.dataset.oiDecorated = '1';
    disableNavbarCollapse(psv);

    // [prev][next] | [move][title] | [zoom] | [opacity] | [gyro][fullscreen][close]
    insertSepBefore(nav, nav.querySelector('.psv-move-button, .psv-caption'));
    insertSepBefore(nav, nav.querySelector('.psv-zoom-button, .psv-zoom-range'));
    insertSepBefore(nav, nav.querySelector('.psv-oi-opacity-btn'));
    insertSepBefore(nav, nav.querySelector('.psv-gyroscope-button, .psv-fullscreen-button, .psv-oi-close'));

    // Which buttons are on show depends on the viewer's width (the @container
    // rules above), so re-run the tidy pass whenever the viewer is resized.
    // Observe the viewer, not the navbar — the navbar's own width changes as a
    // result of this pass, which would feed straight back in.
    requestAnimationFrame(() => tidySeparators(nav));
    psv.addEventListener('size-updated', () => tidySeparators(nav));
    if (window.ResizeObserver) {
        new ResizeObserver(() => tidySeparators(nav)).observe(psv.container);
    }
}

function getViewTarget(view) {
    try {
        if (typeof view.getPivot === 'function') return view.getPivot().clone();
        if (typeof view.getFocus === 'function') return view.getFocus().clone();
    } catch {}
    return new Vector3();
}


// deprecated
// function applyPanoOpacity(viewer) {
//     if (!viewer) return;

//     const val = Number(opacityEl.value) / 100;
//     const root = viewer.renderer?.mesh;
//     if (!mesh) return;


//     const materials = Array.isArray(mesh.material)
//         ? mesh.material
//         : [mesh.material];

//     for (const mat of materials) {
//         if (!mat) continue;
//         mat.transparent = val < 1;
//         mat.opacity = val;
//         mat.needsUpdate = true;
//     }

//     viewer.needsUpdate();
// }

function _open360(sphereMarker) {
    const marker360 = sphereMarker.userData.marker360;
    if (!marker360 || !marker360.image) return;

    // Track which marker is being viewed so UIs (zone search) can highlight it.
    window.viewing360Marker = marker360;
    document.dispatchEvent(new CustomEvent("viewing-360-changed"));

    if(sphereMarker1 && !sphereMarker1.visible && !window.imageMarkersGloballyHidden) sphereMarker1.visible = true;

    sphereMarker1 = sphereMarker;

    sphereMarker.visible = false;

    // Save current Potree view (optional, for restore later)
    const pView = viewer.scene.view;
    pre360View = {
        pos: pView.position.clone(),
        target: pView.getPivot().clone()
    };

    const ensureTransparent = () => {
    const r = viewer360?.renderer;
    if (!r) return;
    r.setClearColor?.(0x000000, 0);     // fully transparent
    r.setClearAlpha?.(0);
    // belt & suspenders for CSS
    r.domElement && (r.domElement.style.background = 'transparent');
  };

    // --- MOVE CAMERA TO MARKER ---
    const { camPos, lookAt } = cameraAtMarker(marker360.position);

    // Keep Z-up orientation
    viewer.scene.getActiveCamera().up.set(0, 0, 1);

    // Smooth move
    moveCameraTo(camPos, lookAt);

    // --- OPEN 360 VIEW ---
    window.in360View = true;
    document.getElementById("photo360").style.display = "block";
    
    if (!viewer360) {

        viewer360 = new PhotoSphereViewer({
            container: document.getElementById("viewer-360"),
            adapter: [
                EquirectangularTilesAdapter,
                {
                    baseBlur: false,
                    showErrorTile: false,
                    antialias: false,
                }
            ],
            panorama: build360Panorama(marker360),
            caption: getCaption(marker360),
            sphereCorrection: {
                pan: `${marker360.sphereCorrection.pan}deg`,
                tilt: `${marker360.sphereCorrection.tilt}deg`,
                roll: `${marker360.sphereCorrection.roll}deg`
            },
            // Laid out like the oriented-image panel:
            //   [prev][next] | [move][title] | [zoom] | [opacity] | [gyro][fullscreen][close]
            // The dividers are inserted by decorateNavbar() further down.
            navbar: [
                {
                    id: 'prev-360',
                    className: 'psv-oi-nav',
                    title: 'Previous image (←)',
                    content: '‹',
                    collapsable: false,
                    onClick: () => navigate360(-1)
                },
                {
                    id: 'next-360',
                    className: 'psv-oi-nav',
                    title: 'Next image (→)',
                    content: '›',
                    collapsable: false,
                    onClick: () => navigate360(1)
                },
                'move',
                'caption',
                'zoom',
                {
                    id: 'psv-opacity',
                    className: 'psv-oi-opacity-btn',
                    content: buildOpacityControl(),
                    title: 'Transparency',
                    tabbable: false
                },
                'gyroscope',
                'fullscreen',
                {
                    id: 'close-360',
                    className: 'psv-oi-close',
                    title: 'Close',
                    content: SVG_CLOSE_360,
                    collapsable: false,
                    onClick: close360
                }
            ],

            plugins: [
                GyroscopePlugin
            ],
            rendererParameters: {
                alpha: true,
                antialias: true,
                premultipliedAlpha: false   // <— important
            },
            canvasBackground: 'transparent',
        });

        viewer360._hasTiles = Boolean(marker360.tiles && marker360.tiles !== "");


        // 2) Hook once at init
        opacityEl.addEventListener('input', () => applyOpacity(viewer360, viewer360._opacity));
        decorateNavbar(viewer360);

        viewer360.addEventListener('position-updated', ({ position }) => {
            if (viewer360._hasTiles) applyOpacity(viewer360, viewer360._opacity);
            if (window.in360View) movePSVPotreeCam(position);
        });

        // also re-apply whenever a pano finishes loading (hook ONCE)
        viewer360.addEventListener('ready', () => {
            viewer360.renderer.renderer.setClearColor(0x000000, 0);
        requestAnimationFrame(() => applyOpacity(viewer360, viewer360._opacity));
        requestAnimationFrame(() => decorateNavbar(viewer360));
        });

        console.log(viewer360);

    //     opacityEl.addEventListener('input', () => applyOpacity(viewer360));


    //     viewer360.addEventListener('ready', () => {
    // requestAnimationFrame(() => applyPanoOpacity(viewer360));


    //     // also re-apply whenever a pano finishes loading (hook ONCE)
    // viewer360.addEventListener('ready', () => {
    //     requestAnimationFrame(() => applyOpacity(viewer360));
    // });

    // // initial application (first pano)
    // applyOpacity(viewer360);
    //     });

    } else {
        // viewer360.setPanorama(marker360.image).then(() => {
        viewer360.setPanorama(build360Panorama(marker360)).then(() => {
            

            viewer360.setOptions(
                {
                    'sphereCorrection': {
                    pan: `${marker360.sphereCorrection.pan}deg`,
                    tilt: `${marker360.sphereCorrection.tilt}deg`,
                    roll: `${marker360.sphereCorrection.roll}deg`
                },
                'caption': getCaption(marker360)   
        });
        
        viewer360._hasTiles = Boolean(marker360.tiles && marker360.tiles !== "");
        applyOpacity(viewer360, viewer360._opacity);
        });

        // console.log('correction to apply: ', marker360.sphereCorrection.pan + 'deg');
        
        // console.log(viewer360);



        // applyOpacity(viewer360, viewer360._opacity);

        requestAnimationFrame(() => {
            applyOpacity(viewer360, viewer360._opacity);
        });


        if(viewerPosOffset) viewerPosOffset = {yaw : 0.0, pitch: 0.0};
    }

    window.viewer360 = viewer360;



    update360NavButtons(viewer360);
}
window.open360 = _open360;

function close360() {
    document.getElementById("photo360").style.display = "none";
    window.in360View = false;

    window.viewing360Marker = null;
    document.dispatchEvent(new CustomEvent("viewing-360-changed"));

    // Re-show the sphere hidden on open — unless the global image-marker
    // toggle went off in the meantime (a 360 can be opened from the zone
    // search list even while markers are masked).
    const mk360 = sphereMarker1 && sphereMarker1.userData && sphereMarker1.userData.marker360;
    sphereMarker1.visible = !window.imageMarkersGloballyHidden;
    if (window.imageMarkersGloballyHidden && mk360 && mk360._hitMesh) {
        mk360._hitMesh.raycast = () => {};
    }

    // Restore Potree camera
    if (pre360View) {
        moveCameraTo(pre360View.pos, pre360View.target);
        pre360View = null;
    }

}
window.close360 = close360;


function cameraAtMarker(markerPos, height = 2, lookDistance = 10) {
    const nodePos = new THREE.Vector3(...markerPos);

    // Camera slightly above marker
    const camPos = nodePos.clone().add(new THREE.Vector3(0, 0, height));

    // Look forward along +Y by default (north-ish)
    const lookDir = new THREE.Vector3(0, 1, 0);
    const lookAt = camPos.clone().addScaledVector(lookDir, lookDistance);

    return { camPos, lookAt };
}


  function escapeHtml(str) {
      return String(str).replace(/[&<>"']/g, c => ({
          '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      })[c]);
  }

  // "3 / 12" within the marker's own zone, when it can be worked out.
  function get360Index(marker360) {
      const list = marker360 && marker360._sphereMarker
          && marker360._sphereMarker.userData
          && marker360._sphereMarker.userData.zone
          && marker360._sphereMarker.userData.zone.marker360s;
      if (!Array.isArray(list)) return null;
      const i = list.indexOf(marker360);
      return (i >= 0) ? `${i + 1} / ${list.length}` : null;
  }

  // The caption is the panel's title block — filename above, position below,
  // matching .oi-title in oriented_image_panel.js. The surrounding chrome now
  // comes from the navbar pill itself, so no box is drawn here.
  function getCaption(node) {
      const name = escapeHtml(node && node.name != null ? node.name : '\u2014');
      const index = get360Index(node);

      let html = `<div class="psv-oi-title">`;
      html += `<div class="psv-oi-title-name" title="${name}">${name}</div>`;
      if (index) html += `<div class="psv-oi-title-index">${index}</div>`;
      html += `</div>`;
      return html;
  }
