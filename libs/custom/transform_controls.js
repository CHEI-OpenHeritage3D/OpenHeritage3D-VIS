import { TransformControls } 
    from 'https://unpkg.com/three@0.118.0/examples/jsm/controls/TransformControls.js';

style.textContent += `
/* ═══════════════════════════════════════════════════════════
   TRANSFORM PANEL — glassmorphic dark theme
   (matches brush / zone / download / search panels)
   Managed by panel_window_manager.js when present; the outer
   frame styling below is a graceful fallback if it is not.
   ═══════════════════════════════════════════════════════════ */

.transform-panel {
    position: fixed;
    top: 80px;
    right: 10px;
    width: clamp(300px, 26vw, 360px);
    box-sizing: border-box;
    padding: 18px 20px;

    background: rgba(20, 20, 26, 0.55);
    backdrop-filter: blur(12px) saturate(140%);
    -webkit-backdrop-filter: blur(12px) saturate(140%);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 14px;
    box-shadow: 0 0 28px rgba(0,0,0,0.55);

    z-index: 10000;
    font-family: 'Segoe UI', system-ui, sans-serif;
    color: #f2f2f7;

    opacity: 0;
    transform: translateY(-6px);
    transition: opacity .18s ease, transform .18s ease;
}
.transform-panel.open { opacity: 1; transform: translateY(0); }

/* Header */
.transform-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
}
.transform-title {
    font-size: 19px;
    font-weight: 600;
    color: #f2f2f7;
    text-shadow: 0 0 6px rgba(0,0,0,0.6);
}
.transform-header-right {
    display: flex;
    align-items: center;
    gap: 8px;
}
.transform-close {
    width: 28px; height: 28px;
    display: inline-flex; align-items: center; justify-content: center;
    cursor: pointer;
    font-size: 20px;
    color: #999;
    border-radius: 6px;
    transition: background .15s ease, color .15s ease;
}
.transform-close:hover { background: rgba(220, 38, 38, 0.3); color: #f87171; }

/* Sections */
.transform-section {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid rgba(255,255,255,0.08);
}
.transform-subtitle {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #888;
    margin-bottom: 8px;
}

.transform-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 0;
}
.transform-label { color: #9ca3af; font-size: 13px; }
.transform-value {
    color: #f3f3f3;
    font-size: 13px;
    font-family: ui-monospace, "SF Mono", Menlo, monospace;
}
.transform-offset {
    font-size: 11px;
    color: #7f7f8a;
    margin: 5px 0 0;
    font-family: ui-monospace, "SF Mono", Menlo, monospace;
}

/* Inputs */
.transform-search {
    width: 100%;
    box-sizing: border-box;
    padding: 9px 12px;
    margin-bottom: 8px;
    border-radius: 8px;
    border: 1px solid rgba(255,255,255,0.2);
    background: rgba(255,255,255,0.08);
    color: #fafafa;
    font-size: 14px;
    transition: border-color .15s, background .15s, box-shadow .15s;
}
.transform-search::placeholder { color: #888; }
.transform-search:focus {
    outline: none;
    border-color: #6e6bff;
    background: rgba(255,255,255,0.12);
    box-shadow: 0 0 0 3px rgba(79,70,229,0.3);
}

.transform-select {
    width: 100%;
    box-sizing: border-box;
    height: 108px;
    padding: 6px;
    background: rgba(0,0,0,0.28);
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 8px;
    color: #e8e8ee;
    font-size: 13px;
    margin-bottom: 4px;
}
.transform-select:focus { outline: none; border-color: #6e6bff; }
.transform-select option { padding: 4px 6px; background: #16171c; color: #e8e8ee; }
.transform-select option:checked { background: #4f46e5; color: #fff; }

/* Action buttons */
.transform-button {
    width: 50%;
    padding: 9px 14px;
    margin-top: 8px;
    background: rgba(255,255,255,0.08);
    color: #f2f2f7;
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: background .15s ease, border-color .15s ease, transform .1s ease;
}
.transform-button:hover {
    background: rgba(79,70,229,0.28);
    border-color: rgba(79,70,229,0.45);
}
.transform-button:active { transform: scale(0.97); }

/* Coupled / decoupled pill */
.coupled-pill {
    font-size: 11px;
    padding: 3px 9px;
    border-radius: 9999px;
    border: 1px solid #4b5563;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-weight: 600;
}
.coupled-pill.coupled {
    background: rgba(34, 197, 94, 0.18);
    color: #bbf7d0;
    border-color: rgba(34,197,94,0.6);
}
.coupled-pill.decoupled {
    background: rgba(148, 163, 184, 0.16);
    color: #e5e7eb;
    border-color: rgba(148,163,184,0.5);
}

/* Shortcuts */
.transform-shortcuts {
    margin-top: 12px;
    padding: 12px 14px;
    border-radius: 10px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
}
.shortcut-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 6px;
}
.shortcut-row:last-child { margin-bottom: 0; }
.shortcut-key {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 24px;
    padding: 3px 7px;
    border-radius: 6px;
    background: rgba(255,255,255,0.08);
    color: #f2f2f7;
    font-size: 12px;
    font-family: ui-monospace, "SF Mono", Menlo, monospace;
    border: 1px solid rgba(255,255,255,0.18);
}
.shortcut-desc { color: #c7c7d1; font-size: 12px; }

/* Export sub-panel */
.export-textarea {
    width: 100%;
    box-sizing: border-box;
    height: 130px;
    background: rgba(0,0,0,0.3);
    color: #e8e8ee;
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 8px;
    padding: 10px;
    font-size: 12px;
    font-family: ui-monospace, "SF Mono", Menlo, monospace;
    resize: none;
}
.export-copy-btn {
    width: 100%;
    background: rgba(79, 70, 229, 0.85);
    color: white;
    border: none;
    padding: 9px 10px;
    border-radius: 8px;
    cursor: pointer;
    margin-bottom: 10px;
    font-size: 13px;
    font-weight: 500;
    transition: background .15s ease, box-shadow .15s ease;
}
.export-copy-btn:hover {
    background: rgba(99, 90, 245, 1);
    box-shadow: 0 0 12px rgba(99, 90, 245, 0.45);
}
.export-copy-btn.copied { background: #22c55e !important; }
`;

style.textContent += `
/* ═══════════════════════════════════════════════════════════
   TRANSFORM PANEL — mode buttons & manual value entry
   ═══════════════════════════════════════════════════════════ */

/* Gizmo mode buttons — one per hotkey, so every operation the keyboard
   exposes is also reachable with the mouse. */
.transform-modes {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
}
.transform-mode-btn,
.transform-toggle-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 6px;
    background: rgba(255,255,255,0.08);
    color: #f2f2f7;
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 8px;
    font-size: 12px;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    transition: background .15s ease, border-color .15s ease, transform .1s ease;
}
.transform-toggle-btn { width: 100%; margin-top: 6px; }
.transform-mode-btn:hover:not(:disabled),
.transform-toggle-btn:hover:not(:disabled) {
    background: rgba(79,70,229,0.28);
    border-color: rgba(79,70,229,0.45);
}
.transform-mode-btn:active:not(:disabled),
.transform-toggle-btn:active:not(:disabled) { transform: scale(0.97); }
.transform-mode-btn.active,
.transform-toggle-btn.active {
    background: rgba(99,90,245,0.72);
    border-color: rgba(147,140,255,0.95);
    color: #fff;
    font-weight: 600;
    box-shadow: 0 0 12px rgba(99,90,245,0.5);
}
.transform-mode-btn.active kbd,
.transform-toggle-btn.active kbd {
    background: rgba(0,0,0,0.3);
    border-color: rgba(255,255,255,0.35);
    color: #fff;
}
.transform-mode-btn:disabled,
.transform-toggle-btn:disabled,
.transform-num:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}
.transform-mode-btn kbd,
.transform-toggle-btn kbd {
    padding: 1px 5px;
    border-radius: 4px;
    background: rgba(0,0,0,0.35);
    border: 1px solid rgba(255,255,255,0.18);
    font-size: 10px;
    font-family: ui-monospace, "SF Mono", Menlo, monospace;
    color: #d7d7e0;
}

/* Action row — Move PC / Reset / Export share one grid so they no longer
   wrap awkwardly at 50% width each. */
.transform-actions {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
}
.transform-actions .transform-button {
    width: 100%;
    margin-top: 0;
    padding: 9px 4px;
    font-size: 12px;      /* keeps "Move PC" on one line at the 300px minimum */
}

/* Manual value entry */
.transform-field { margin-bottom: 10px; }
.transform-field:last-child { margin-bottom: 0; }
.transform-field-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
    margin-bottom: 5px;
}
.transform-axes {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
}
.transform-axis {
    display: flex;
    align-items: center;
    gap: 5px;
    min-width: 0;
}
.transform-axis > span {
    flex: 0 0 auto;
    font-size: 11px;
    color: #7f7f8a;
    font-family: ui-monospace, "SF Mono", Menlo, monospace;
}
.transform-num {
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
    padding: 5px 6px;
    border-radius: 6px;
    border: 1px solid rgba(255,255,255,0.18);
    background: rgba(255,255,255,0.07);
    color: #fafafa;
    font-size: 12px;
    font-family: ui-monospace, "SF Mono", Menlo, monospace;
    transition: border-color .15s, background .15s, box-shadow .15s;
    -moz-appearance: textfield;
}
.transform-num::-webkit-outer-spin-button,
.transform-num::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.transform-num:focus {
    outline: none;
    border-color: #6e6bff;
    background: rgba(255,255,255,0.12);
    box-shadow: 0 0 0 2px rgba(79,70,229,0.3);
}
.transform-hint {
    font-size: 11px;
    color: #7f7f8a;
    margin-bottom: 8px;
}
`;


// ─────────────────────────────────────────────────────────────────────
//  Gizmo state.
//  The proxy, the transform it was last sampled at, the coupling flag and the
//  current gizmo mode live at module scope so the panel's buttons and the
//  keyboard shortcuts drive one and the same state. They used to be locals of
//  toggleTransformControls(), which also meant a fresh window keydown listener
//  was registered for every point cloud the user selected — after two
//  selections "D" toggled coupling twice per press and looked dead.
// ─────────────────────────────────────────────────────────────────────
let control;
let axesHelper;
let proxy;
let proxyInitPos, proxyInitQuat, proxyInitScale;
let coupled = true;
let transformMode = 'translate';

let pcStartingTransforms = [];
let pcStartingTransformsLoad = [];

let pcStartingTransformsLoadcomputed = false;

function initPCStartingTransforms (){
    for(let i = 0; i < viewer.scene.pointclouds.length; i++){
        const pc = viewer.scene.pointclouds[i];
        const position = pc.position.clone();
        const quaternion = pc.quaternion.clone();
        const scale = pc.scale.clone();

        const id = `pc_${i}`;
        pcStartingTransforms[id] = {position, quaternion, scale };

    }

    if (window.earth) {
        pcStartingTransforms["earth"] = {
            position: window.earth.position.clone(),
            quaternion: window.earth.quaternion.clone(),
            scale: window.earth.scale.clone()
        };
    }
}

function initPCStartingTransformsLoad (){
    for(let i = 0; i < viewer.scene.pointclouds.length; i++){
        const pc = viewer.scene.pointclouds[i];
        const position = pc.position.clone();
        const quaternion = pc.quaternion.clone();
        const scale = pc.scale.clone();

        const id = `pc_${i}`;
        pcStartingTransformsLoad[id] = {position, quaternion, scale };

    }
    pcStartingTransformsLoadcomputed = true;
    console.log(pcStartingTransformsLoad);
}

function rotateAroundPointWithQuaternion(obj, point, q) {
    obj.position.sub(point);
    obj.position.applyQuaternion(q);
    obj.position.add(point);

    obj.quaternion.premultiply(q);
}

// Column-major identity, written out so this module does not touch THREE at
// load time (it is an ES module; potree.js defines the global for it later).
const _IDENTITY_ELEMENTS = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
const _warnedFrames = new Set();

function warnIfParentTransformed(obj, label) {
    if (!obj || !obj.parent || _warnedFrames.has(label)) return;
    obj.parent.updateMatrixWorld();
    const e = obj.parent.matrixWorld.elements;
    if (e.some((v, i) => Math.abs(v - _IDENTITY_ELEMENTS[i]) > 1e-9)) {
        _warnedFrames.add(label);
        console.warn(`transform_controls: the ${label}'s parent has a non-identity `
            + `world matrix. Gizmo deltas are applied in world space, so they will `
            + `be skewed until this is converted through the parent frame.`);
    }
}

function scaleAroundPoint(obj, point, deltaScale) {
    obj.position.sub(point); 
    obj.position.multiply(deltaScale);
    obj.position.add(point);

    obj.scale.multiply(deltaScale);
}

function resetPCTransform (id) {
    if(!id) return;
    const startingPC = pcStartingTransforms[id];
    const pc = window.pointcloudMap[id];

    pc.position.x = startingPC.position.x;
    pc.position.y = startingPC.position.y;
    pc.position.z = startingPC.position.z;

    // copy(), not x/y/z — the old version left the previous w in place, so a reset
    // restored a non-unit quaternion and the cloud came back subtly skewed.
    pc.quaternion.copy(startingPC.quaternion);

    pc.scale.x = startingPC.scale.x;
    pc.scale.y = startingPC.scale.y;
    pc.scale.z = startingPC.scale.z;
    
    updateTransformPanel(pc);
}

function movePCtoProxy(pc){
    const camPos = viewer.scene.view.getPivot().clone();
    console.log('proxypos: ', camPos);
    pc.position.set(camPos.x, camPos.y, camPos.z);
}

/**
 * Push the proxy's movement since the last sample onto the selected point
 * cloud. Registered as the gizmo's "change" listener while coupling is on.
 */
function coupleProxyToPC() {
    if (!coupled || !proxy || !proxyInitPos) return;

    const pc = selectedPC;
    if (!pc) return;

    const proxyPos = proxy.position.clone();
    const proxyPosChange = proxyPos.sub(proxyInitPos);

    const currentQuat = proxy.quaternion.clone();
    // TransformControls runs in world space (its `space` property defaults to
    // "world") and writes  quaternion = delta_world * quaternionStart. The
    // world-space delta is therefore current * start⁻¹ — a POST-multiply. The old
    // start⁻¹ * current is the delta expressed in the proxy's own body frame,
    // which was then applied below as though it were a world rotation. The two
    // agree only while the proxy sits at identity, i.e. up to the first rotation.
    const deltaQuat = currentQuat.clone()
        .multiply(proxyInitQuat.clone().invert())
        .normalize();

    const currentScale = proxy.scale.clone();
    const deltaScale = currentScale.divide(proxyInitScale);

    // translateX/Y/Z move along the OBJECT'S OWN axes (they route through
    // translateOnAxis, which applies obj.quaternion to the axis). Feeding them a
    // world-space delta meant that once the cloud was rotated, dragging the X
    // handle walked it along its own rotated X — the axes appeared welded to the
    // object and one direction became unreachable. The gizmo delta is already
    // world-space, so add it to the position directly.
    pc.position.add(proxyPosChange);

    const pivot = proxy.position.clone();    // cube position

    rotateAroundPointWithQuaternion(pc, pivot, deltaQuat);

    scaleAroundPoint(pc, pivot, deltaScale);

    captureProxyStart();

    updateTransformPanel(pc);
}

/** Re-baseline the proxy so the next gizmo change reports a delta from here. */
function captureProxyStart() {
    if (!proxy) return;
    proxyInitPos = proxy.position.clone();
    proxyInitQuat = proxy.quaternion.clone();
    proxyInitScale = proxy.scale.clone();
}

/**
 * Couple / decouple the point cloud from the proxy. Entry point for both the
 * "D" hotkey and the panel's Couple Proxy button.
 */
function setCoupled(isCoupled) {
    coupled = isCoupled;

    if (control) {
        // Always drop first: re-adding the same listener twice would apply every
        // delta twice.
        control.removeEventListener('change', coupleProxyToPC);
        if (isCoupled) {
            captureProxyStart();
            control.addEventListener('change', coupleProxyToPC);
        }
    }

    if (!isCoupled) proxyInitPos = null;

    setCoupledState(isCoupled);
}

/**
 * Switch the gizmo between translate / rotate / scale. Entry point for the
 * T / R / S hotkeys and the panel's mode buttons.
 */
function setTransformMode(mode) {
    transformMode = mode;
    if (control) control.setMode(mode);

    const buttons = document.querySelectorAll("#transformPanel .transform-mode-btn");
    for (const btn of buttons) {
        btn.classList.toggle("active", btn.dataset.mode === mode);
    }
}

/** Enable the mode buttons and value fields only once a cloud is selected. */
function setTransformUIEnabled(enabled) {
    const els = document.querySelectorAll(
        "#transformPanel .transform-mode-btn, #transformPanel .transform-num, #transformPanel .transform-toggle-btn"
    );
    for (const el of els) el.disabled = !enabled;
}

/**
 * Tear down the current gizmo, proxy and axes. Selecting a second point cloud
 * used to only detach() the old control, leaving it and its axes helper parented
 * to the scene for the rest of the session.
 */
function disposeTransformControls() {
    if (control) {
        control.removeEventListener('change', coupleProxyToPC);
        control.detach();
        if (control.parent) control.parent.remove(control);
        if (typeof control.dispose === 'function') control.dispose();
        control = null;
    }
    if (proxy) {
        if (proxy.parent) proxy.parent.remove(proxy);
        if (proxy.geometry) proxy.geometry.dispose();
        if (proxy.material) proxy.material.dispose();
        proxy = null;
    }
    if (axesHelper) {
        if (axesHelper.parent) axesHelper.parent.remove(axesHelper);
        axesHelper = null;
    }
    proxyInitPos = proxyInitQuat = proxyInitScale = null;
}

// Registered once, at module load, instead of once per point-cloud selection.
// It no-ops unless the panel is open with a live gizmo, and ignores keystrokes
// typed into the search box or the value fields — otherwise typing a cloud name
// containing "s" silently flipped the gizmo into scale mode.
window.addEventListener('keydown', e => {
    if (!control || !document.getElementById("transformPanel")) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    const t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA"
        || t.tagName === "SELECT" || t.isContentEditable)) return;

    switch (e.key.toLowerCase()) {
        case 'd':
            setCoupled(!coupled);
            break;
        case 't':
            setTransformMode('translate');
            break;
        case 'r':
            setTransformMode('rotate');
            break;
        case 's':
            setTransformMode('scale');
            break;
    }
});

function toggleTransformControls(pc) {

    if (selectedID !== "earth") {
        viewer.setEDLEnabled(false);
    }

    disposeTransformControls();

    axesHelper = new THREE.AxesHelper(10000);

    const geometry = new THREE.BoxGeometry( 0.01, 0.01, 0.01);
    const material = new THREE.MeshBasicMaterial({visible: false});
    proxy = new THREE.Mesh(geometry, material);

    const camPos = viewer.scene.view.getPivot().clone();
    proxy.position.copy(camPos);
    axesHelper.position.copy(camPos);

    viewer.scene.scene.add(proxy);
    viewer.scene.scene.add(axesHelper);

    control = new TransformControls(
        viewer.scene.getActiveCamera(),
        viewer.renderer.domElement
    );

    // The proxy hangs off viewer.scene.scene and the point clouds off
    // viewer.scene.scenePointCloud. Both are untransformed THREE.Scene roots, so
    // local == world for both and the deltas above need no parent conversion.
    // (The line that used to sit here copied scene.scene.rotation onto the gizmo
    // root, which is a no-op while that rotation is zero and double-applies if it
    // ever is not.) Say so out loud if the assumption ever breaks.
    warnIfParentTransformed(proxy, "proxy");
    warnIfParentTransformed(pc, "point cloud");
    console.log('control: ',control);

    control.attach(proxy);
    viewer.scene.scene.add(control);

    const isEarth = (selectedID === "earth");

    // if (isEarth) {
    //     proxy.position.copy(pc.position);     // pivot at Earth center
    //     axesHelper.position.copy(pc.position);
    // } else {
    //     const camPos = viewer.scene.view.getPivot().clone();
    //     proxy.position.copy(camPos);
    //     axesHelper.position.copy(camPos);
    // }

    // Carry the mode the user last picked over to the new gizmo.
    setTransformMode(transformMode);

    // Samples the proxy and wires up the change listener.
    setCoupled(true);

    setTransformUIEnabled(true);

    control.addEventListener( 'mouseDown', e => {
        viewer.controls.enabled = false;
        viewer.inputHandler.removeInputListener(viewer.controls);


    });

    control.addEventListener( 'mouseUp', () => {
        viewer.controls.enabled = true;
        viewer.inputHandler.addInputListener(viewer.controls);
    })
}

function openTransformPanel() {
    const existing = document.getElementById("transformPanel");

    if (existing) {
        existing.classList.remove("open");
        setTimeout(() => existing.remove(), 150);
        return;
    }

    initPCStartingTransforms();

    if(!pcStartingTransformsLoadcomputed) initPCStartingTransformsLoad();

    const panel = document.createElement("div");
    panel.id = "transformPanel";
    panel.className = "transform-panel";

    panel.innerHTML = `
    <div class="transform-header">
        <span class="transform-title">Transform Point Cloud</span>
        <div class="transform-header-right">
            <span id="transform-coupled-status" class="coupled-pill decoupled">
                Decoupled
            </span>
            <span class="transform-close">&times;</span>
        </div>
    </div>


        <div class="transform-section">
            <div class="transform-subtitle">Select Point Cloud</div>

            <input 
                id="pc-search" 
                class="transform-search" 
                type="text" 
                placeholder="Search point clouds..."
            />

            <select id="pc-select" size="4" class="transform-select"></select>
        </div>

        <div id="transform-function" class="transform-section">
            <div class="transform-subtitle">Values</div>
            <div class="transform-hint">Drag the gizmo, or type a value and press Enter.</div>

            <div class="transform-field">
                <div class="transform-field-head">
                    <span class="transform-label">Position</span>
                </div>
                <div class="transform-axes">
                    <label class="transform-axis"><span>X</span><input id="tf-pos-x" class="transform-num" type="number" step="0.1" disabled></label>
                    <label class="transform-axis"><span>Y</span><input id="tf-pos-y" class="transform-num" type="number" step="0.1" disabled></label>
                    <label class="transform-axis"><span>Z</span><input id="tf-pos-z" class="transform-num" type="number" step="0.1" disabled></label>
                </div>
                <div class="transform-offset" id="transform-pos-offset">Δx: 0, Δy: 0, Δz: 0</div>
            </div>

            <div class="transform-field">
                <div class="transform-field-head">
                    <span class="transform-label">Rotation (°)</span>
                </div>
                <div class="transform-axes">
                    <label class="transform-axis"><span>X</span><input id="tf-rot-x" class="transform-num" type="number" step="1" disabled></label>
                    <label class="transform-axis"><span>Y</span><input id="tf-rot-y" class="transform-num" type="number" step="1" disabled></label>
                    <label class="transform-axis"><span>Z</span><input id="tf-rot-z" class="transform-num" type="number" step="1" disabled></label>
                </div>
                <div class="transform-offset" id="transform-rot-offset">Δx: 0°, Δy: 0°, Δz: 0°</div>
            </div>

            <div class="transform-field">
                <div class="transform-field-head">
                    <span class="transform-label">Scale</span>
                </div>
                <div class="transform-axes">
                    <label class="transform-axis"><span>X</span><input id="tf-scale-x" class="transform-num" type="number" step="0.01" disabled></label>
                    <label class="transform-axis"><span>Y</span><input id="tf-scale-y" class="transform-num" type="number" step="0.01" disabled></label>
                    <label class="transform-axis"><span>Z</span><input id="tf-scale-z" class="transform-num" type="number" step="0.01" disabled></label>
                </div>
                <div class="transform-offset" id="transform-scale-offset">Δsx: 0, Δsy: 0, Δsz: 0</div>
            </div>
        </div>

        <div class="transform-section">
            <div class="transform-subtitle">Gizmo Mode</div>
            <div class="transform-modes">
                <button class="transform-mode-btn" data-mode="translate" disabled>Move <kbd>T</kbd></button>
                <button class="transform-mode-btn" data-mode="rotate"    disabled>Rotate <kbd>R</kbd></button>
                <button class="transform-mode-btn" data-mode="scale"     disabled>Scale <kbd>S</kbd></button>
            </div>
            <button class="transform-toggle-btn" id="toggle-couple-btn" disabled>Couple Proxy <kbd>D</kbd></button>
        </div>

        <div class="transform-section">
            <div class="transform-actions">
                <button class="transform-button" id="move-pc-to-proxy-btn">Move PC</button>
                <button class="transform-button" id="reset-transform-btn">Reset</button>
                <button class="transform-button" id="export-transform-btn">Export</button>
            </div>
        </div>

        <div class="transform-section transform-shortcuts">
            <div class="transform-subtitle">Shortcuts</div>

            <div class="shortcut-row">
                <span class="shortcut-key">D</span>
                <span class="shortcut-desc">Couple / decouple proxy</span>
            </div>
            <div class="shortcut-row">
                <span class="shortcut-key">T</span>
                <span class="shortcut-desc">Translate mode</span>
            </div>
            <div class="shortcut-row">
                <span class="shortcut-key">R</span>
                <span class="shortcut-desc">Rotate mode</span>
            </div>
            <div class="shortcut-row">
                <span class="shortcut-key">S</span>
                <span class="shortcut-desc">Scale mode</span>
            </div>
        </div>

    `;


    document.body.appendChild(panel);

    // Close button
    panel.querySelector(".transform-close").onclick = () => {
        panel.classList.remove("open");
        closeTransformPanel();
        setTimeout(() => panel.remove(), 150);
    };

    panel.classList.add("open");

    initializeTransformPCSelector();
}

function toggleExportPanel() {
    const existing = document.getElementById('exportPanel');
    if (existing) {
        existing.classList.remove("open");
        setTimeout(() => existing.remove(), 150);
        return;
    }

    const panel = document.createElement("div");
    panel.id = "exportPanel";
    panel.className = "transform-panel";

    panel.innerHTML = `
        <div class="transform-header">
            <span class="transform-title">Export Transform Code</span>
            <span class="transform-close">&times;</span>
        </div>

        <div class="transform-section">
            <button id="copy-export-btn" class="export-copy-btn">Copy</button>
            <textarea id="export-code-box" class="export-textarea" readonly></textarea>
        </div>
    `;


    document.body.appendChild(panel);

    // CLOSE FUNCTION
    panel.querySelector(".transform-close").onclick = () => {
        panel.classList.remove("open");
        setTimeout(() => panel.remove(), 150);
    };

    // Position relative to Transform Panel
    const transformPanel = document.getElementById("transformPanel");
    if (transformPanel) {
        const rect = transformPanel.getBoundingClientRect();
        panel.style.position = "absolute";
        panel.style.top = (rect.bottom + 10) + "px";
        panel.style.left = rect.left + "px";
    }


    const copyBtn = panel.querySelector("#copy-export-btn");

    copyBtn.onclick = async () => {
        try {
            await navigator.clipboard.writeText(window.exportCode);

            // Temporary visual feedback
            copyBtn.textContent = "Copied!";
            copyBtn.classList.add("copied");

            setTimeout(() => {
                copyBtn.textContent = "Copy";
                copyBtn.classList.remove("copied");
            }, 1200);

        } catch (err) {
            console.error("Clipboard copy failed:", err);
            copyBtn.textContent = "Error";
        }
    };


//     window.exportCode = `pointcloud.translateX(0.0000);
// pointcloud.translateY(0.0000);
// pointcloud.translateZ(0.0000);

// pointcloud.rotateX(0.0000);
// pointcloud.rotateY(0.0000);
// pointcloud.rotateZ(0.0000);

// pointcloud.scale.set(1.0000, 1.0000, 1.0000);`;

window.exportCode =`pointcloud.position.set(0.0000, 0.0000, 0.0000);

pointcloud.rotation.set(0.0000, 0.0000, 0.0000);

pointcloud.scale.set(1.0000, 1.0000, 1.0000);`;

    if(selectedPC) updateTransformPanel(selectedPC);

    updateExportPanel();
    panel.classList.add("open");
}

function updateExportPanel(){
    const existing = document.getElementById('exportPanel');
    if (!existing) {
        return;
    }
    const innerCode = document.getElementById("export-code-box");
    innerCode.value = window.exportCode;
}

// The nine editable value fields, in the order they are read back.
const MANUAL_FIELD_IDS = [
    "tf-pos-x",   "tf-pos-y",   "tf-pos-z",
    "tf-rot-x",   "tf-rot-y",   "tf-rot-z",
    "tf-scale-x", "tf-scale-y", "tf-scale-z",
];

const DEG = Math.PI / 180;

/**
 * Write a value into one of the editable fields, unless the user is currently
 * typing in it — a gizmo drag refreshes the panel continuously, and rewriting a
 * focused field would eat the value being typed.
 */
function setNumField(id, value, digits) {
    const el = document.getElementById(id);
    if (!el || el === document.activeElement) return;
    el.value = value.toFixed(digits);
}

/**
 * Read the nine fields back onto the selected point cloud. Unlike the gizmo —
 * which applies deltas about the proxy — these are absolute values in the
 * cloud's own frame, so rotation and scale pivot on its origin.
 */
function applyManualTransform() {
    const pc = selectedPC;
    if (!pc) return;

    const read = (id, fallback) => {
        const el = document.getElementById(id);
        if (!el) return fallback;
        const v = parseFloat(el.value);
        return Number.isFinite(v) ? v : fallback;      // blank / garbage: leave as-is
    };

    pc.position.set(
        read("tf-pos-x", pc.position.x),
        read("tf-pos-y", pc.position.y),
        read("tf-pos-z", pc.position.z)
    );

    // Written through pc.rotation, in the cloud's existing Euler order — the same
    // quantity the panel prints, so typing back what is shown is a no-op.
    pc.rotation.set(
        read("tf-rot-x", pc.rotation.x / DEG) * DEG,
        read("tf-rot-y", pc.rotation.y / DEG) * DEG,
        read("tf-rot-z", pc.rotation.z / DEG) * DEG
    );

    // A zero on any scale axis collapses the matrix and cannot be undone by
    // typing a value back in, so keep the current axis instead.
    const sx = read("tf-scale-x", pc.scale.x);
    const sy = read("tf-scale-y", pc.scale.y);
    const sz = read("tf-scale-z", pc.scale.z);
    pc.scale.set(sx || pc.scale.x, sy || pc.scale.y, sz || pc.scale.z);

    updateTransformPanel(pc);
}

function updateTransformPanel(pc) {
    if (!pc) return;

    const p = pc.position;
    const r = pc.rotation;
    const s = pc.scale;

    setNumField("tf-pos-x", p.x, 3);
    setNumField("tf-pos-y", p.y, 3);
    setNumField("tf-pos-z", p.z, 3);

    setNumField("tf-rot-x", r.x / DEG, 2);
    setNumField("tf-rot-y", r.y / DEG, 2);
    setNumField("tf-rot-z", r.z / DEG, 2);

    setNumField("tf-scale-x", s.x, 4);
    setNumField("tf-scale-y", s.y, 4);
    setNumField("tf-scale-z", s.z, 4);

    // -------------------------------
    // ORIGINAL VALUES AT LOAD TIME
    // -------------------------------
    const og = pcStartingTransformsLoad[selectedID];
    if (!og) return;

    // POS OFFSET
    const dp = {
        x: p.x - og.position.x,
        y: p.y - og.position.y,
        z: p.z - og.position.z
    };

    document.getElementById("transform-pos-offset").textContent =
        `Δx: ${dp.x.toFixed(3)}, Δy: ${dp.y.toFixed(3)}, Δz: ${dp.z.toFixed(3)}`;

    // ROTATION OFFSET (rad)
    // The relative rotation since load, as Euler angles for display. Subtracting
    // quaternion components from Euler radians (the old form) is not a rotation
    // difference in any frame — it just happened to read as ~0 at startup.
    const qRel = pc.quaternion.clone().multiply(og.quaternion.clone().invert());
    const eRel = new THREE.Euler().setFromQuaternion(qRel.normalize(), "XYZ");

    // ROTATION OFFSET (degrees)
    const dr = {
        x: eRel.x / DEG,
        y: eRel.y / DEG,
        z: eRel.z / DEG
    };

    document.getElementById("transform-rot-offset").textContent =
        `Δx: ${dr.x.toFixed(1)}°, Δy: ${dr.y.toFixed(1)}°, Δz: ${dr.z.toFixed(1)}°`;

    // SCALE OFFSET (ratio)
    const ds = {
        x: s.x / og.scale.x,
        y: s.y / og.scale.y,
        z: s.z / og.scale.z
    };

    document.getElementById("transform-scale-offset").textContent =
        `Δsx: ${ds.x.toFixed(3)}, Δsy: ${ds.y.toFixed(3)}, Δsz: ${ds.z.toFixed(3)}`;


    //export panel

    window.exportCode =
`pointcloud.position.set(${p.x.toFixed(4)}, ${p.y.toFixed(4)}, ${p.z.toFixed(4)});

pointcloud.rotation.set(${r.x.toFixed(4)}, ${r.y.toFixed(4)}, ${r.z.toFixed(4)});

pointcloud.scale.set(${s.x.toFixed(4)}, ${s.y.toFixed(4)}, ${s.z.toFixed(4)});`;

    updateExportPanel();
}

let selectedPC;
let selectedID;

function initializeTransformPCSelector() {
    const pcSelect = document.getElementById("pc-select");
    const pcSearch = document.getElementById("pc-search");

    window.pointcloudMap = {}; // store ID → pointcloud reference

    // Fill dropdown
    for (let i = 0; i < viewer.scene.pointclouds.length; i++) {
        const pc = viewer.scene.pointclouds[i];
        const id = `pc_${i}`;
        window.pointcloudMap[id] = pc;

        const opt = document.createElement("option");
        opt.value = id;
        opt.textContent = pc.name || `PointCloud ${i + 1}`;
        pcSelect.appendChild(opt);
    }

    if (window.earth) {
        const id = "earth";
        window.pointcloudMap[id] = window.earth;

        const opt = document.createElement("option");
        opt.value = id;
        opt.textContent = "🌍 Earth";
        pcSelect.appendChild(opt);
    }

    // Filter options
    pcSearch.addEventListener("input", () => {
        const filter = pcSearch.value.toLowerCase();
        for (const option of pcSelect.options) {
            const text = option.textContent.toLowerCase();
            option.style.display = text.includes(filter) ? "" : "none";
        }
    });

    const resetBtn = document.getElementById("reset-transform-btn");
    resetBtn.onclick = () =>{
        resetPCTransform(selectedID);
    }

    const exportBtn = document.getElementById("export-transform-btn");
    exportBtn.onclick = () =>{
        toggleExportPanel();
    }

    const movePCtoProxyBtn = document.getElementById("move-pc-to-proxy-btn");
    movePCtoProxyBtn.onclick = () => {
        movePCtoProxy(selectedPC);
    }

    // Gizmo mode + coupling buttons — the same entry points the T/R/S/D
    // hotkeys call, so the two stay in sync whichever one is used.
    for (const btn of document.querySelectorAll("#transformPanel .transform-mode-btn")) {
        btn.onclick = () => setTransformMode(btn.dataset.mode);
    }

    const coupleBtn = document.getElementById("toggle-couple-btn");
    coupleBtn.onclick = () => setCoupled(!coupled);

    // Manual value entry. "change" covers Enter, blur and the arrow-key
    // steppers; the explicit Enter handler makes committing without blurring
    // reliable across browsers.
    for (const id of MANUAL_FIELD_IDS) {
        const field = document.getElementById(id);
        if (!field) continue;

        field.addEventListener("change", applyManualTransform);
        field.addEventListener("keydown", e => {
            if (e.key === "Enter") {
                e.preventDefault();
                applyManualTransform();
            }
        });
    }

    setTransformUIEnabled(false);   // nothing to transform until a cloud is picked

    // When user selects a PC
    pcSelect.addEventListener("change", () => {
        selectedID = pcSelect.value;
        selectedPC = window.pointcloudMap[selectedID];
        window.activeTransformPC = selectedPC;

        toggleTransformControls(selectedPC);
        updateTransformPanel(selectedPC);
    });
}

function setCoupledState(isCoupled) {

    // Update UI pill in the panel if it exists
    const pill = document.getElementById("transform-coupled-status");
    if (pill) {
        pill.textContent = isCoupled ? "Coupled" : "Decoupled";
        pill.classList.toggle("coupled", isCoupled);
        pill.classList.toggle("decoupled", !isCoupled);
    }

    const coupleBtn = document.getElementById("toggle-couple-btn");
    if (coupleBtn) coupleBtn.classList.toggle("active", isCoupled);
}


function closeTransformPanel(){
    disposeTransformControls();
    removeAllAxisHelpers()

    if (selectedID !== "earth") {
        viewer.setEDLEnabled(true);
    }
    console.log(pcStartingTransforms);
    pcStartingTransforms = [];
    console.log(pcStartingTransforms);

    const exportPanel = document.getElementById("exportPanel")
    if(exportPanel){
        exportPanel.classList.remove("open");
        setTimeout(() => exportPanel.remove(), 150);
    }

}

function removeAllAxisHelpers(){
    const scene = viewer.scene.scene;

    for(let i = scene.children.length - 1; i >= 0; i --){
        const obj = scene.children[i];

        if(obj instanceof THREE.AxesHelper) scene.remove(obj);
    }
}

window.openTransformPanel = openTransformPanel;
export { openTransformPanel };
