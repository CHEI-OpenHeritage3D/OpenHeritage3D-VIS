  import { Viewer as PhotoSphereViewer } from '@photo-sphere-viewer/core';
  import { Vector3 } from 'three';
  import { CompassPlugin } from '@photo-sphere-viewer/compass-plugin';
  import { AutorotatePlugin } from '@photo-sphere-viewer/autorotate-plugin';
  import { OverlaysPlugin } from '@photo-sphere-viewer/overlays-plugin';
  import { GyroscopePlugin } from '@photo-sphere-viewer/gyroscope-plugin';



  // --- CONFIG ---
  const TRIGGER_RADIUS = 100;                     // meters (tune to your data scale)
  const TRIGGER_DIST_SQ = TRIGGER_RADIUS * TRIGGER_RADIUS;
  const REOPEN_COOLDOWN_MS = 1200;                // avoid immediate retrigger after closing
  const BOUNCE_MARGIN = 1000;

  // --- STATE ---
  let viewer360 = null;
  let pre360View = null;                          // { pos: Vector3, target: Vector3 }
  let reopenBlockUntil = 0;
  let last360Node = null;
  window.viewer360 = viewer360;

  // Make a tiny helper that gets the Potree view target/pivot safely
  function getViewTarget(view) {
    try {
      if (typeof view.getPivot === 'function') return view.getPivot().clone();
      if (typeof view.getFocus === 'function') return view.getFocus().clone();
    } catch {}
    return new Vector3();
  }

  function _open360(node) {
    // const now = performance.now();
    // if (now < reopenBlockUntil) return;           // still in cooldown
    window.in360View = true;

    // Save current Potree view (before moving)
    const pView = viewer.scene.view;
    pre360View = {
      pos: pView.position.clone(),
      target: getViewTarget(pView)
    };

    // Show overlay and init/set PSV
    document.getElementById('photo360').style.display = 'block';
    
    // console.log(node.images60);

    showAnnPanorama(node);
    window.in360View = true;

    last360Node = node || null;
  }
  
//#################### For 360 image loading ########################


  function _close360() {
    document.getElementById('photo360').style.display = 'none';
    window.in360View = false;
    playOn = false;
    showTimestampMenu(false);
    endPeek360();
    bounceBackFromAnn();

    // Esc makes a second close easy to reach, and open360 can be called with
    // nothing open, so don't assume there is a node to restore.
    if (last360Node && last360Node.coneMarker) last360Node.coneMarker.visible = true;
    // Start cooldown so proximity check won’t instantly reopen
    reopenBlockUntil = performance.now() + REOPEN_COOLDOWN_MS;

    // Clear state
    pre360View = null;
    last360Node = null;
  }

  
  // Expose to global so inline handlers / other scripts can call these
  window.open360  = _open360;
  window.close360 = _close360;

  // Proximity trigger (call this from your onViewerUpdate hook)
//   Deprecated, switched away from auto trigger
//   window.cameraOpen360 = function () {
//     const now = performance.now();
//     if (window.in360View) return;
//     if (now < reopenBlockUntil) return;
//     console.log('inside cameraOpen360');
//     const cam = viewer.scene.getActiveCamera();
//     if (!cam) return;

//     const camPos = cam.position;

//     // Find first annotation within radius (or find nearest if you prefer)
//     for (const node of (window.cameras_ann_list || [])) {
//       const nodePos = node?.position;
//       if (!nodePos) continue;

//       const d2 = nodePos.distanceToSquared(camPos);
//       if (d2 <= TRIGGER_DIST_SQ) {
//         _open360(node);
//         break; // open once
//       }
//     }
//   };

    window.open360CameraIndex = function (idx){
        const node = window.cameras_ann_list[idx];
        if(window.in360View) close360();
        ann_list_moveto(node.position);
        window.open360(node);
    }

    window.open360CameraObject = function (node){
        if(window.in360View) close360();
        ann_list_moveto(node.position);
        window.open360(node);
    }

    window.open360CameraObjectColocated = function (node){
        if(window.in360View) close360();
        window.open360(node);
    }

  function bounceBackFromAnn() {
    const cam = viewer.scene.getActiveCamera();
    if (!cam) return;

    // Where we were looking / standing when we opened 360
    const camPos = cam.position.clone();

    // If we know the annotation, push away from it
    const nodePos = last360Node?.position?.clone?.();
    if (nodePos && nodePos.isVector3) {
        // direction = from ann to current cam
        let dir = camPos.clone().sub(nodePos);
        if (dir.lengthSq() < 1e-12) dir.set(0, 0, 1); // avoid zero-length
        
        dir.normalize();

        dir = dir.sub(new THREE.Vector3(0, 3, 0));

        const newPos    = nodePos.clone().addScaledVector(dir, TRIGGER_RADIUS + BOUNCE_MARGIN);
        const newTarget = nodePos; // look back at the annotation (or use pre360View.target)

    
        viewer.scene.getActiveCamera().up.set(0, 0, 1);

        moveCameraTo(newPos, newTarget);
        return;
    }

    // Fallback: if no last360Node, nudge backwards along camera look direction
    const fwd = new THREE.Vector3();
    cam.getWorldDirection(fwd); // points forward
    const back = fwd.clone().negate().normalize();

    const nudge = TRIGGER_RADIUS + BOUNCE_MARGIN;
    const newPos = camPos.clone().addScaledVector(back, nudge);
    const newTarget = camPos; // look roughly where we were

    moveCameraTo(newPos, newTarget);

    }


// headingDeg = 0 means "north" (+Y). 90 = east (+X).
function cameraAboveFacing(nodePos, height = 10, headingDeg = 0, lookDistance = 50) {
  const rad = THREE.MathUtils.degToRad(headingDeg);
  
  // compute where "north" lies relative to the point (ground-plane)
  const dir = new THREE.Vector3(Math.sin(rad), Math.cos(rad), 0).normalize();

  // camera position: directly above annotation
  const camPos = nodePos.clone().add(new THREE.Vector3(0, 0, height));

  // target point: some distance away horizontally, same elevation
  const lookAt = camPos.clone().addScaledVector(dir, lookDistance);

  return { camPos, lookAt };
}

window.cameraAboveFacing = cameraAboveFacing;

window.psvDecoupled = false;
window.pitchDecoupleOffset = 0;
window.yawDecoupleOffset = 0;
window.yawStart = 0;
window.yawEnd = 0;
window.pitchStart = 0;
window.pitchEnd = 0;


// helper to build an <img> icon sized for the navbar
function makeIcon(src, alt='') {
  const img = document.createElement('img');
  img.src = src;        // e.g. '/icons/close.svg'
  img.alt = alt;
  img.width = 20;       // PSV buttons are square; 20–24px works well
  img.height = 20;
  img.style.display = 'block';
  return img;
}

// --- singletons at module scope ---
let timestampMenuEl = null;
let timestampInputEl = null;
let timestampKeyHandler = null;
let timestampInputLabelEl = null;
let timestampInputIncrementEl = null;
let timestampInputIncrementLabelEl = null;
let timestampPlayEl = null;
let playOn = false;

// helper: set/replace a query param safely
function setQueryParam(url, key, value) {
  const u = new URL(url, window.location.href);
  u.searchParams.set(key, value);
  return u.toString();
}

// ══════════════════════════════════════════════════════════════
//  Panel styling
//
//  The Photo Sphere Viewer navbar is restyled into the same floating glass
//  pill the oriented-image viewer uses (oriented_image_panel.js), and the
//  timestamp menu becomes a glass popover above it. Nothing but looks
//  changes here — every PSV button keeps its own behaviour.
//
//  Every selector is scoped under #viewer-360 so ID specificity wins over
//  the PSV stylesheet regardless of which <link> the browser applies last.
// ══════════════════════════════════════════════════════════════

const psv360Style = document.createElement("style");
psv360Style.textContent = `

/* the timestamp popover positions against this */
#viewer-360 { position: relative; }

/* ── The navbar, as a floating glass pill ────────────────── */

#viewer-360 .psv-navbar {
    /* Centred with auto margins rather than left:50% + translateX: for an
       absolutely positioned box, left:50% caps the width available to
       shrink-to-fit at half the viewer, so the pill would squeeze its slider
       and title long before it needed to. */
    position: absolute;
    left: 0;
    right: 0;
    bottom: 24px;
    margin: 0 auto;
    width: fit-content;
    height: auto;
    max-width: min(1180px, 94vw);
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

/* ── Icon buttons ────────────────────────────────────────── */

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
#viewer-360 .psv-navbar .psv-button-svg,
#viewer-360 .psv-navbar .psv-custom-button > svg {
    width: 18px;
    height: 18px;
    display: block;
}
#viewer-360 .psv-navbar .psv-move-button + .psv-move-button { margin-left: 0; }

/* the built-in download button is an <a>, and fights us for its colour */
#viewer-360 .psv-navbar .psv-download-button { color: #e0e0e5 !important; }
#viewer-360 .psv-navbar .psv-download-button:hover { color: #fff !important; }

/* ── Divider ─────────────────────────────────────────────── */

#viewer-360 .psv-navbar .psv-oi-sep {
    width: 1px;
    align-self: stretch;
    margin: 2px 0;
    background: rgba(255,255,255,0.12);
    flex-shrink: 0;
}

/* ── Image navigation (earlier / later) ──────────────────── */

#viewer-360 .psv-navbar .psv-button.psv-oi-nav {
    width: 34px;
    font: 20px/1 'Segoe UI', system-ui, sans-serif;
}

/* ── Title block (PSV caption) ───────────────────────────── */

#viewer-360 .psv-navbar .psv-button.psv-caption {
    /* A fixed slot, not a shrinkable one: in an intrinsically sized flex
       container (the pill is width:fit-content) a flex-shrink item is sized by
       the flex-fraction algorithm and comes out narrower than its basis, which
       would quietly squeeze the title and the slider even on a wide screen.
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
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
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
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #888;
    flex-shrink: 0;
    white-space: nowrap;
    overflow: hidden;
    min-width: 0;
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

/* Key cap on a label, as in .oi-key */
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

/* ── Close button ────────────────────────────────────────── */

#viewer-360 .psv-navbar .psv-button.psv-oi-close { width: 34px; }
#viewer-360 .psv-navbar .psv-button.psv-oi-close:hover {
    background: rgba(220, 38, 38, 0.4);
    border-color: rgba(239, 68, 68, 0.5);
    color: #fecaca;
}

/* ── Timestamp popover ───────────────────────────────────── */

#viewer-360 #timestampMenu {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 86px;
    margin: 0 auto;
    z-index: 95;

    width: fit-content;
    min-width: 280px;
    max-width: min(420px, 92vw);
    padding: 14px 16px;

    background: rgba(20, 20, 26, 0.62);
    backdrop-filter: blur(14px) saturate(140%);
    -webkit-backdrop-filter: blur(14px) saturate(140%);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 14px;
    box-shadow: 0 0 28px rgba(0,0,0,0.55);

    font: 13px 'Segoe UI', system-ui, sans-serif;
    color: #f2f2f7;
    box-sizing: border-box;
}
#viewer-360 #timestampMenu * { box-sizing: border-box; }

#viewer-360 .psv-oi-popover-title {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #888;
    margin-bottom: 10px;
}

#viewer-360 .psv-oi-field {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
}
#viewer-360 .psv-oi-field:last-of-type { margin-bottom: 0; }

#viewer-360 .psv-oi-field > label {
    flex: 0 0 52px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #888;
}

#viewer-360 .psv-oi-input {
    flex: 1 1 auto;
    min-width: 0;
    height: 30px;
    padding: 0 9px;
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 8px;
    background: rgba(255,255,255,0.05);
    color: #f2f2f7;
    font: 13px monospace;
    outline: none;
    transition: border-color 0.15s, background 0.15s;
}
#viewer-360 .psv-oi-input::placeholder { color: #6b6b73; font-family: 'Segoe UI', system-ui, sans-serif; }
#viewer-360 .psv-oi-input:focus {
    border-color: rgba(79,70,229,0.6);
    background: rgba(255,255,255,0.08);
}

#viewer-360 .psv-oi-play {
    flex: 0 0 auto;
    width: 30px;
    height: 30px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 8px;
    background: rgba(255,255,255,0.05);
    color: #e0e0e5;
    cursor: pointer;
    font-size: 12px;
    line-height: 1;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
}
#viewer-360 .psv-oi-play:hover {
    background: rgba(79,70,229,0.3);
    border-color: rgba(79,70,229,0.45);
    color: #fff;
}
#viewer-360 .psv-oi-play.playing {
    background: rgba(79,70,229,0.45);
    border-color: rgba(79,70,229,0.6);
    color: #fff;
}

#viewer-360 .psv-oi-hint {
    margin-top: 10px;
    font-size: 11px;
    color: #777;
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
}
#viewer-360 .psv-oi-hint.warn { color: #fca5a5; }


/* ── Compass ─────────────────────────────────────────────────
   The plugin ships its own stylesheet (compass-plugin/index.css). If the
   host page hasn't linked it, PSV only logs to the console and the compass
   renders as an unstyled blob in normal flow — so restate the layout rules
   it needs here, then dress it to match the panel.                        */

#viewer-360 .psv-compass {
    position: absolute;
    margin: 16px;
    z-index: 39;
    aspect-ratio: 1;
    cursor: pointer;                 /* the dial is clickable (navigation) */
    border-radius: 50%;
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    box-shadow: 0 0 24px rgba(0,0,0,0.5);
    transition: opacity 0.2s ease;
}
#viewer-360 .psv-compass canvas,
#viewer-360 .psv-compass svg {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
}
#viewer-360 .psv-compass--top-left,
#viewer-360 .psv-compass--top-center,
#viewer-360 .psv-compass--top-right { top: 0; }
#viewer-360 .psv-compass--bottom-left,
#viewer-360 .psv-compass--bottom-center,
#viewer-360 .psv-compass--bottom-right { bottom: 0; }
#viewer-360 .psv-compass--top-left,
#viewer-360 .psv-compass--center-left,
#viewer-360 .psv-compass--bottom-left { left: 0; }
#viewer-360 .psv-compass--top-right,
#viewer-360 .psv-compass--center-right,
#viewer-360 .psv-compass--bottom-right { right: 0; }

/* the stock rule reserves room for a 40px full-width navbar; ours floats */
#viewer-360 .psv--has-navbar .psv-compass { margin-bottom: 16px; }

/* Potree's quick buttons sit at left:4px/top:4px in the same corner, and the
   sidebar hamburger inside them is 2.5em plus margins — so the corner is
   spoken for out to ~52px. Start the dial clear of it. */
#viewer-360 .psv-compass--top-left { margin-left: 72px; }

#viewer-360 .psv-compass:hover {
    box-shadow: 0 0 28px rgba(79, 70, 229, 0.35), 0 0 24px rgba(0,0,0,0.5);
}

/* On a small viewer the dial costs more room than it earns. */
@container psv-container (max-width: 560px) {
    #viewer-360 .psv-compass { display: none; }
}

/* ── Narrow viewers ──────────────────────────────────────────
   PSV's own collapse-into-a-menu logic measures the navbar's width, which
   for a shrink-to-fit pill is just its content — so it never fires (and is
   switched off in disableNavbarCollapse). Shed the optional pieces here
   instead; earlier/later, the timestamp button and close always survive.
   (.psv-container declares container-type: size, so these query it.)      */

@container psv-container (max-width: 1250px) {
    #viewer-360 .psv-oi-opacity-label { display: none; }
}
@container psv-container (max-width: 1150px) {
    /* earlier/later and drag-to-pan both survive, so these go first */
    #viewer-360 .psv-navbar .psv-move-button { display: none; }
}
@container psv-container (max-width: 970px) {
    #viewer-360 .psv-navbar .psv-button.psv-caption { display: none; }
    #viewer-360 .psv-oi-opacity-value { display: none; }
    #viewer-360 .psv-oi-slider { flex: 0 0 80px; width: 80px; }
}
@container psv-container (max-width: 660px) {
    #viewer-360 .psv-navbar .psv-download-button { display: none; }
}
@container psv-container (max-width: 560px) {
    #viewer-360 .psv-navbar .psv-button.psv-oi-opacity-btn { display: none; }
}
@container psv-container (max-width: 420px) {
    #viewer-360 #timestampMenu { min-width: 0; width: auto; left: 12px; right: 12px; }
    #viewer-360 .psv-oi-field > label { flex-basis: 40px; }
}
`;
document.head.appendChild(psv360Style);

const SVG_CLOSE_360 =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/>' +
    '<line x1="6" y1="6" x2="18" y2="18"/></svg>';

const SVG_CLOCK_360 =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/>' +
    '<polyline points="12 7 12 12 15.5 14"/></svg>';

// A dial in the panel's own palette: glass face, faint ticks, indigo north.
// Drawn under the plugin's viewing-direction cone, so everything stays legible
// through a translucent wedge.
// A dial in the panel's own palette. No needle: the plugin already draws a
// cone for where you are looking, so the dial only has to say which way is
// which. The face is opaque enough to stay legible over a bright panorama.
const SVG_COMPASS_360 = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <circle cx="50" cy="50" r="49" fill="rgba(14, 14, 20, 0.86)"/>
  <circle cx="50" cy="50" r="49" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="1"/>
  <circle cx="50" cy="50" r="37" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
  <g stroke="rgba(255,255,255,0.40)" stroke-width="1.6" stroke-linecap="round">
    <line x1="50" y1="3"  x2="50" y2="10"/>
    <line x1="97" y1="50" x2="90" y2="50"/>
    <line x1="50" y1="97" x2="50" y2="90"/>
    <line x1="3"  y1="50" x2="10" y2="50"/>
  </g>
  <g stroke="rgba(255,255,255,0.16)" stroke-width="1.1" stroke-linecap="round">
    <line x1="83.2" y1="16.8" x2="79.6" y2="20.4"/>
    <line x1="83.2" y1="83.2" x2="79.6" y2="79.6"/>
    <line x1="16.8" y1="83.2" x2="20.4" y2="79.6"/>
    <line x1="16.8" y1="16.8" x2="20.4" y2="20.4"/>
  </g>
  <g font-family="Segoe UI, system-ui, sans-serif" font-size="10" font-weight="600"
     text-anchor="middle" dominant-baseline="central" fill="rgba(255,255,255,0.42)">
    <text x="50" y="19" font-size="11" font-weight="700" fill="#a5a0ff">N</text>
    <text x="81" y="50">E</text>
    <text x="50" y="81">S</text>
    <text x="19" y="50">W</text>
  </g>
  <circle cx="50" cy="50" r="2.2" fill="rgba(255,255,255,0.45)"/>
</svg>`;

const SVG_SWAP_360 =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round"><polyline points="16 3 20 7 16 11"/>' +
    '<line x1="20" y1="7" x2="4" y2="7"/><polyline points="8 13 4 17 8 21"/>' +
    '<line x1="4" y1="17" x2="20" y2="17"/></svg>';

// ══════════════════════════════════════════════════════════════
//  Opacity control
//
//  One slider for the lifetime of the page — it is handed to the navbar when
//  the PSV viewer is first built, so it has to outlive showAnnPanorama().
// ══════════════════════════════════════════════════════════════

const opacityEl = document.createElement('input');
opacityEl.type  = 'range';
opacityEl.min   = '0';
opacityEl.max   = '100';
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

// 1) One function to apply opacity to the current pano mesh
function applyOpacity(viewer, valToApply) {

    const val = valToApply ?? (Number(opacityEl.value) / 100);
    const mesh = viewer?.renderer?.mesh;
    if (!mesh) return; // mesh not ready yet

    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
        if (!mat) continue;
        mat.transparent = val < 1;
        mat.opacity     = val;
        mat.needsUpdate = true;
    }

    viewer._opacity = val;

    viewer.needsUpdate();
}

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
    applyOpacity(viewer360);                // no override: read the slider
}

// The wrapper handed to PSV as the custom button's content.
function buildOpacityControl() {
    const wrap = document.createElement('div');
    wrap.className = 'psv-oi-opacity';

    const label = document.createElement('span');
    label.className = 'psv-oi-opacity-label';
    label.innerHTML = 'Opacity <span class="psv-oi-key">C</span>';
    label.title = 'Cycle panorama opacity: 100% / 50% / 0% (C)';

    wrap.appendChild(label);
    wrap.appendChild(opacityEl);
    wrap.appendChild(opacityValueEl);
    return wrap;
}

// ══════════════════════════════════════════════════════════════
//  Timestamp
//
//  The camera serves whatever image is nearest a `timestamp` query param, so
//  "the previous / next image" here means a step in time rather than a step
//  along a list. The step size is whatever parse_time() makes of the STEP
//  field; stepping backwards mirrors that step rather than trying to negate
//  the user's text, so it works whatever syntax parse_time accepts.
//
//  parse_time() is provided by the host page, not by this file.
// ══════════════════════════════════════════════════════════════

let currentTimestamp = null;
let currentAnnNode = null;
let timestampHintEl = null;

function parseTimeSafe(text, reference) {
    if (typeof parse_time !== 'function') return null;
    try {
        const t = parse_time(text, reference);
        return (typeof t === 'number' && t) ? t : null;
    } catch {
        return null;
    }
}

// "1758734700" is seconds, "1758734700000" is milliseconds — parse_time's
// output unit isn't ours to decide, so tell them apart by magnitude.
function formatTimestamp(ts) {
    if (ts == null) return '';
    const ms = ts < 1e11 ? ts * 1000 : ts;
    const d = new Date(ms);
    if (isNaN(d.getTime())) return String(ts);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} `
         + `${p(d.getHours())}:${p(d.getMinutes())}`;
}

function setTimestampHint(text, isWarning) {
    if (!timestampHintEl) return;
    timestampHintEl.innerHTML = text;
    timestampHintEl.classList.toggle('warn', !!isWarning);
}

function resetTimestampHint() {
    setTimestampHint('<span class="psv-oi-key">←</span>'
        + '<span class="psv-oi-key">→</span> step by this amount', false);
}

// The title's second line: which moment is on screen.
function refreshTimestampReadout() {
    if (!viewer360 || !viewer360.navbar) return;
    viewer360.navbar.setCaption(getCaptionFor(currentAnnNode));
}

function isTimestampMenuOpen() {
    return !!(timestampMenuEl && timestampMenuEl.style.display !== 'none');
}

function showTimestampMenu(open) {
    if (!timestampMenuEl) return;
    timestampMenuEl.style.display = open ? 'block' : 'none';
    const button = viewer360 && viewer360.navbar
        && viewer360.navbar.getButton('psv-timestamp-button', false);
    if (button) button.toggleActive(open);
    if (open) setTimeout(() => timestampInputEl && timestampInputEl.focus(), 0);
}

// Load one moment for the camera on screen. Shared by the STEP arrows, the
// Timestamp field and the play loop.
async function loadTimestamp(ts) {
    if (!viewer360) return;
    const base = viewer360._base360 || (currentAnnNode && currentAnnNode.url);
    if (!base) return;

    const withTs = setQueryParam(base, 'timestamp', ts);
    const finalUrl = setQueryParam(withTs, 'v', Date.now()); // optional cache-bust

    // Pass the caption so PSV restores OURS when the load settles — left to
    // itself it puts back config.caption, which still says the moment we were
    // on when the camera was opened.
    const loading = viewer360.setPanorama(viaProxy(finalUrl), {
        caption: getCaptionFor(currentAnnNode),
        sphereCorrection: { pan: '210deg', tilt: 0, roll: 0 },
        transition: { effect: 'black', speed: 0, rotation: false },
        showLoader: false
    });

    // setPanorama swaps the caption for "Loading…" synchronously; stepping with
    // the arrows would flicker between that and the time, so put ours straight
    // back and let the load happen quietly underneath.
    refreshTimestampReadout();
    await loading;

    applyOpacity(viewer360, viewer360._opacity);
    // keep base as the URL *without* cache-buster; keep timestamp if you want it sticky
    viewer360._base360 = withTs;
    refreshTimestampReadout();       // setPanorama restores PSV's own caption
}

// Step the camera's image one STEP earlier (-1) or later (+1). Holding an
// arrow down just supersedes the load in flight — setPanorama aborts the
// previous one itself, so there is no queue to guard.
async function stepTimestamp(direction) {
    if (!viewer360) return;

    const incdec = timestampInputIncrementEl ? timestampInputIncrementEl.value.trim() : '';
    if (!incdec) {
        showTimestampMenu(true);
        setTimestampHint('Set a step first, then use ← / →', true);
        return;
    }

    if (currentTimestamp == null) currentTimestamp = Date.now();

    // Ask parse_time where one step forward lands, and mirror that distance to
    // go backwards — no need to know how it spells a negative step.
    const forward = parseTimeSafe(incdec, currentTimestamp);
    if (!forward) {
        showTimestampMenu(true);
        setTimestampHint('Could not read that step', true);
        return;
    }

    const delta = forward - currentTimestamp;
    if (!delta) return;

    const next = direction > 0 ? forward : currentTimestamp - delta;

    currentTimestamp = next;
    refreshTimestampReadout();      // show the moment we are heading to
    resetTimestampHint();

    try {
        await loadTimestamp(next);
    } catch (err) {
        // an aborted load just means a newer step overtook this one
        if (!/abort/i.test(String(err && err.message))) throw err;
    }
}

function buildTimestampMenu() {
    if (timestampMenuEl) return;

    timestampMenuEl = document.createElement('div');
    timestampMenuEl.id = 'timestampMenu';
    timestampMenuEl.style.display = 'none';

    const heading = document.createElement('div');
    heading.className = 'psv-oi-popover-title';
    heading.textContent = 'Timestamp';
    timestampMenuEl.appendChild(heading);

    // ── Time ──
    const timeRow = document.createElement('div');
    timeRow.className = 'psv-oi-field';

    timestampInputLabelEl = document.createElement('label');
    timestampInputLabelEl.textContent = 'Time';

    timestampInputEl = document.createElement('input');
    timestampInputEl.className = 'psv-oi-input';
    timestampInputEl.placeholder = 'e.g. today 14:05';
    timestampInputEl.title = 'Jump to a moment, then press Enter';

    timeRow.appendChild(timestampInputLabelEl);
    timeRow.appendChild(timestampInputEl);
    timestampMenuEl.appendChild(timeRow);

    // ── Step + play ──
    const stepRow = document.createElement('div');
    stepRow.className = 'psv-oi-field';

    timestampInputIncrementLabelEl = document.createElement('label');
    timestampInputIncrementLabelEl.textContent = 'Step';

    timestampInputIncrementEl = document.createElement('input');
    timestampInputIncrementEl.className = 'psv-oi-input';
    timestampInputIncrementEl.placeholder = 'e.g. 1 hour';
    timestampInputIncrementEl.title = 'How far ← / → and play move each time';

    timestampPlayEl = document.createElement('button');
    timestampPlayEl.className = 'psv-oi-play';
    timestampPlayEl.innerHTML = '▶︎';
    timestampPlayEl.title = 'Play forward from this moment';

    stepRow.appendChild(timestampInputIncrementLabelEl);
    stepRow.appendChild(timestampInputIncrementEl);
    stepRow.appendChild(timestampPlayEl);
    timestampMenuEl.appendChild(stepRow);

    timestampHintEl = document.createElement('div');
    timestampHintEl.className = 'psv-oi-hint';
    timestampMenuEl.appendChild(timestampHintEl);
    resetTimestampHint();

    // Enter commits the Time field; Escape just puts the popover away.
    timestampInputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            showTimestampMenu(false);
            e.stopPropagation();
        }
    });
    timestampInputIncrementEl.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            showTimestampMenu(false);
            e.stopPropagation();
        }
    });
}

// ══════════════════════════════════════════════════════════════
//  Keyboard
//
//  The same bindings the oriented-image panel uses (oriented_image_panel.js),
//  with the arrows stepping time rather than a list:
//    Esc            close the 360 viewer
//    ← / →          one STEP earlier / later
//    Space (hold)   "peek" — momentarily clear the panorama
//    [ / ]          nudge opacity down / up
//    C              cycle opacity: 100% -> 50% -> 0% -> 50% -> 100% ...
//
//  Bound in the CAPTURE phase and stopped there, so while the 360 viewer is
//  up these keys never reach the handlers underneath: Potree's InputHandler
//  (#photo360 lives inside #potree_render_area, so keys bubble into it) and
//  PSV's own arrow-key rotation in fullscreen.
// ══════════════════════════════════════════════════════════════

const kb360 = {
    opacityToggleDir: -1,   // -1 = C is heading toward 0%, 1 = heading toward 100%
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
    if (isTyping360(e.target)) return;          // incl. the timestamp fields
    if (e.ctrlKey || e.metaKey || e.altKey) return;   // Ctrl is the decouple key

    let handled = true;

    switch (e.key) {
        case 'Escape':
            // in fullscreen, Escape is the browser's own way out — take it,
            // and leave the viewer open behind it
            if (is360Fullscreen()) { handled = false; break; }
            if (isTimestampMenuOpen()) { showTimestampMenu(false); break; }
            close360();
            break;
        case 'ArrowLeft':  stepTimestamp(-1);                     break;
        case 'ArrowRight': stepTimestamp(1);                      break;
        case '[':        set360Opacity(get360Opacity() - 0.1);    break;
        case ']':        set360Opacity(get360Opacity() + 0.1);    break;
        case 'c':
        case 'C':        toggle360OpacityCycle();                 break;
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
//  Module scope on purpose. These used to live at the foot of
//  showAnnPanorama(), where `let viewerPosOffset` sat *below* the
//  `viewerPosOffset = {...}` reset in the change-camera branch — so every
//  change after the first threw a TDZ ReferenceError and bailed out of the
//  rest of the function. Out here the reset works, and the document
//  listeners are registered once instead of once per camera.
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
// side of it — buttons come and go with the viewer's width.
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

    // [earlier][later] | [move][title][swap] | [zoom] | [opacity] | [clock][download][gyro][fullscreen][close]
    insertSepBefore(nav, nav.querySelector('.psv-move-button, .psv-caption'));
    insertSepBefore(nav, nav.querySelector('.psv-zoom-button, .psv-zoom-range'));
    insertSepBefore(nav, nav.querySelector('.psv-oi-opacity-btn'));
    insertSepBefore(nav, nav.querySelector('.psv-timestamp-btn'));

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

// The swap button only means anything where two cameras share a site.
function update360SwapButton(psv) {
    const nav = psv && psv.navbar;
    if (!nav) return;

    const button = nav.getButton('psv-swap-camera', false);
    if (!button) return;

    const colocated = getColocatedCamera(currentAnnNode);
    if (colocated) {
        button.container.title = `Switch to ${colocated.name}`;
        button.show(false);
    } else {
        button.hide(false);
    }
    if (nav.container) tidySeparators(nav.container);
}

function getColocatedCamera(node) {
    const nodes = node && node.coneMarker && node.coneMarker._sensorNodes;
    if (!Array.isArray(nodes)) return null;
    return nodes.find(n => n !== node) || null;
}

function switchToColocatedCamera() {
    const colocated = getColocatedCamera(currentAnnNode);
    if (!colocated) return;
    if (typeof window.onSensorNodeClick !== 'function' || !Array.isArray(window.sensorNodes)) return;
    const target = window.sensorNodes.find(c => c.id === colocated.id);
    if (target) window.onSensorNodeClick(target);
}

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
}

// The caption is the panel's title block — camera above, the moment on
// screen below, matching .oi-title in oriented_image_panel.js. The
// surrounding chrome comes from the navbar pill, so no box is drawn here.
function getCaptionFor(node) {
    const name = escapeHtml(node && node.name != null ? node.name : '—');
    const when = currentTimestamp == null ? 'latest' : formatTimestamp(currentTimestamp);

    return `<div class="psv-oi-title">`
        + `<div class="psv-oi-title-name" title="${name}">${name}</div>`
        + `<div class="psv-oi-title-index">${escapeHtml(when)}</div>`
        + `</div>`;
}

    /**
     * Given an annotation with six images, build (or fetch cached) stitched pano
     * and show in PSV. Optionally align initial yaw.
     */
async function showAnnPanorama(node) {

    currentAnnNode = node;
    currentTimestamp = null;   // each camera starts at its latest image, as before

    //move camera
    const nodePos = node.position;

    // camera a few meters above annotation, facing north
    const { camPos, lookAt } = cameraAboveFacing(nodePos, 10, 0, 50);

    // keep upright orientation
    viewer.scene.getActiveCamera().up.set(0, 0, 1);

    // move camera and look level
    moveCameraTo(camPos, lookAt);

    // const { url, panoData } = await buildEquirectBandFromSix(node.images60);

    const ensureTransparent = () => {
      const r = viewer360?.renderer;
      if (!r) return;
      r.setClearColor?.(0x000000, 0);     // fully transparent
      r.setClearAlpha?.(0);
      // belt & suspenders for CSS
      r.domElement && (r.domElement.style.background = 'transparent');
  };

    buildTimestampMenu();

    const viewerContainer = document.querySelector('#viewer-360');
    if (!timestampMenuEl.isConnected) viewerContainer.appendChild(timestampMenuEl);

  if (!viewer360) {
    viewer360 = new PhotoSphereViewer({
      container: document.querySelector('#viewer-360'),
      panorama: viaProxy(node.url),
      sphereCorrection: {pan: '210deg', tilt: 0, roll: 0},
      caption: getCaptionFor(node),
    // caption: node.name,
      // Laid out like the oriented-image panel:
      //   [earlier][later] | [move][title][swap] | [zoom] | [opacity] | [clock][download][gyro][fullscreen][close]
      // The dividers are inserted by decorateNavbar().
      navbar: [
        {
          id: 'prev-360',
          className: 'psv-oi-nav',
          title: 'Earlier image (\u2190)',
          content: '\u2039',
          collapsable: false,
          onClick: () => stepTimestamp(-1)
        },
        {
          id: 'next-360',
          className: 'psv-oi-nav',
          title: 'Later image (\u2192)',
          content: '\u203a',
          collapsable: false,
          onClick: () => stepTimestamp(1)
        },
        'move',
        'caption',
        {
          id: 'psv-swap-camera',
          className: 'psv-oi-swap',
          title: 'Switch camera',
          content: SVG_SWAP_360,
          collapsable: false,
          onClick: () => switchToColocatedCamera()
        },
        'zoom',
        {
          id: 'psv-opacity',
          className: 'psv-oi-opacity-btn',
          content: buildOpacityControl(),
          title: 'Transparency',
          tabbable: false
        },
        {
          id: 'psv-timestamp-button',
          className: 'psv-timestamp-btn',
          content: SVG_CLOCK_360,
          title: 'Timestamp',
          collapsable: false,
          onClick() { showTimestampMenu(!isTimestampMenuOpen()); }
        },
        'download',
        'gyroscope',
        'fullscreen',
        {
          id: 'psv-close360',
          className: 'psv-oi-close',
          title: 'Close (Esc)',
          content: SVG_CLOSE_360,
          collapsable: false,
          onClick() { close360(); }
        },
      ],
      plugins: [
        CompassPlugin.withConfig({
          size: '104px',
          position: ['top', 'left'],
          backgroundSvg: SVG_COMPASS_360,
          coneColor: 'rgba(110, 107, 255, 0.45)',      // where you are looking
          navigationColor: 'rgba(165, 160, 255, 0.28)', // where a click would take you
          hotspotColor: 'rgba(255, 255, 255, 0.65)'
        }),
        AutorotatePlugin.withConfig({
            autostartOnIdle: false,
            autostartDelay: 1000000,
        }),
        GyroscopePlugin,
    ],
      rendererParameters: {
        alpha: true,
        antialias: true,
        premultipliedAlpha: false   // <— important
      },
      canvasBackground: 'transparent',
    });

    viewer360._base360 = node.url;
    window.viewer360 = viewer360;   // the module-top export captured the null
    update360SwapButton(viewer360);

    // 2) Hook once at init
    opacityEl.addEventListener('input', () => applyOpacity(viewer360));
    decorateNavbar(viewer360);

    // also re-apply whenever a pano finishes loading (hook ONCE)
    viewer360.addEventListener('ready', () => {
      requestAnimationFrame(() => applyOpacity(viewer360, viewer360._opacity));
      requestAnimationFrame(() => decorateNavbar(viewer360));
    });

    viewer360.addEventListener('position-updated', ({ position }) => {
      if (window.in360View) movePSVPotreeCam(position);
    });

    // initial application (first pano)
    // applyOpacity(viewer360);

    viewer360._currentAnn = node;

  } 
else {
// when changing the image
    viewer360._base360 = node.url; // update base
    viewer360.navbar.setCaption(getCaptionFor(node));
    update360SwapButton(viewer360);
    
    const cacheBusted = setQueryParam(viewer360._base360, 'v', Date.now());

    if(timestampInputEl.value){
        await changeImgTimestamp();
        await viewer360.setOptions({
            caption: getCaptionFor(node),
            sphereCorrection: { pan: '210deg', tilt: 0, roll: 0 },
            transition: { effect: 'black', speed: 0, rotation: false },
            showLoader: true
        });
        viewer360._currentAnn = node;
    }
    else{
        await viewer360.setPanorama(viaProxy(cacheBusted), {
            caption: getCaptionFor(node),
            sphereCorrection: { pan: '210deg', tilt: 0, roll: 0 },
            transition: { effect: 'black', speed: 0, rotation: false },
            showLoader: true
        });
        viewer360._currentAnn = node;
    }

    applyOpacity(viewer360, viewer360._opacity);
    console.log(viewer360);

    viewerPosOffset = {yaw : 0.0, pitch: 0.0};


  }

  update360SwapButton(viewer360);

  async function changeImgTimestamp(){
    if(currentTimestamp == null) currentTimestamp = Date.now();

    const raw = timestampInputEl.value.trim();
    const parsed_time = parse_time(raw, currentTimestamp); // seconds!
    currentTimestamp = parsed_time;

    if (!parsed_time || typeof parsed_time !== 'number') {
      setTimestampHint('Could not read that time', true);
      return;
    }

    resetTimestampHint();
    refreshTimestampReadout();
    await loadTimestamp(parsed_time);
  }

    //timestamp control
  if (timestampKeyHandler) {
    timestampInputEl.removeEventListener('keydown', timestampKeyHandler);
  }

  timestampKeyHandler = async (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();

    changeImgTimestamp();
  };

  timestampInputEl.addEventListener('keydown', timestampKeyHandler);

  timestampPlayEl.onclick = async function (){

    // Toggle play/pause
    if (playOn) {
        playOn = false;
        timestampPlayEl.innerHTML = "\u25b6\ufe0e";  // show play symbol
        timestampPlayEl.classList.remove('playing');
        timestampPlayEl.title = 'Play forward from this moment';
        return;
    }

    playOn = true;

    const incdec = timestampInputIncrementEl.value.trim();
    const startTimestamp = timestampInputEl.value.trim();


    if(currentTimestamp == null) currentTimestamp = Date.now();

    currentTimestamp = parse_time(startTimestamp, currentTimestamp);

    const now = parse_time("today", Date.now());

    if (!currentTimestamp || typeof currentTimestamp !== 'number' || !incdec) {
      setTimestampHint('Set a time and a step first', true);
      playOn = false;
      return;
    }

    resetTimestampHint();
    timestampPlayEl.innerHTML = "\u275a\u275a";
    timestampPlayEl.classList.add('playing');
    timestampPlayEl.title = 'Pause';

    while(currentTimestamp <= now && playOn){
        await loadTimestamp(currentTimestamp);

        currentTimestamp = parse_time(incdec, currentTimestamp);
        if(!currentTimestamp){
          setTimestampHint('Could not read that step', true);
          break;
        }
    }

    playOn = false;
    timestampPlayEl.innerHTML = "\u25b6\ufe0e";
    timestampPlayEl.classList.remove('playing');
    timestampPlayEl.title = 'Play forward from this moment';
  };


    //commented out for now


}

function viaProxy(url){
  return 'ac-proxy.php?url=' + encodeURIComponent(url);
}