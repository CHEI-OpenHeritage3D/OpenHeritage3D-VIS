function testRGT(){
    const pointsA = [
        new THREE.Vector3(23.045, -62.109, 25.868),
        new THREE.Vector3(22.978, -61.800, 26.200),
        new THREE.Vector3(22.941, -61.506, 26.529),
    ];

    const pointsB = [
        new THREE.Vector3(22.234, -62.147, 25.944),
        new THREE.Vector3(22.155, -61.819, 26.290),
        new THREE.Vector3(22.150, -61.523, 26.619),
    ];

    const transformMatrix = findRigidTransformation(pointsA, pointsB);

    console.log(transformMatrix);
}

function findRigidTransformation(pointsA, pointsB){
    const {Matrix, SVD, determinant} = mlMatrix;

    let centroidA = new THREE.Vector3();
    let centroidB = new THREE.Vector3();
    const numPairs = pointsA.length;

    for(let i = 0; i < numPairs; i++){
        centroidA.add(pointsA[i]);
        centroidB.add(pointsB[i]);
    }
    centroidA.divideScalar(numPairs);
    centroidB.divideScalar(numPairs);

    let H = [[0,0,0], [0,0,0], [0,0,0]];

    for(let i = 0; i < numPairs; i++){
        const a = new THREE.Vector3().subVectors(pointsA[i], centroidA);
        const b = new THREE.Vector3().subVectors(pointsB[i], centroidB);

        H[0][0] += a.x * b.x; H[0][1] += a.x * b.y; H[0][2] += a.x * b.z;
        H[1][0] += a.y * b.x; H[1][1] += a.y * b.y; H[1][2] += a.y * b.z;
        H[2][0] += a.z * b.x; H[2][1] += a.z * b.y; H[2][2] += a.z * b.z;
    }

    const hMatrix = new Matrix(H);
    const svd = new SVD(hMatrix);
    const U = svd.leftSingularVectors;
    const V = svd.rightSingularVectors;

    let R = V.mmul(U.transpose());

    if(determinant(R) < 0){
        const V_corrected = V.clone();
        for(let i = 0; i < 3; i++){
            V_corrected.set(i, 2, -V.get(i, 2));
        }
        R = V_corrected.mmul(U.transpose());
    }

    const transformMatrix = new THREE.Matrix4();
    transformMatrix.set(
        R.get(0, 0), R.get(0, 1), R.get(0, 2), 0,
        R.get(1, 0), R.get(1, 1), R.get(1, 2), 0,
        R.get(2, 0), R.get(2, 1), R.get(2, 2), 0,
        0,           0,           0,           1
    );

    const rotatedCentroidA = centroidA.clone().applyMatrix4(transformMatrix);
    const translation = new THREE.Vector3().subVectors(centroidB, rotatedCentroidA);

    transformMatrix.elements[12] = translation.x;
    transformMatrix.elements[13] = translation.y;
    transformMatrix.elements[14] = translation.z;

    return transformMatrix;
}

// ═══════════════════════════════════════════════════════════════════════
//  ALIGN BY POINT PAIRS
//  Opened from the transform panel (transform_controls.js). Each pair is a
//  source point picked on the cloud being moved and the matching target
//  point picked on another cloud; Align moves the cloud by the rigid
//  transform that best takes the sources onto the targets
//  (findRigidTransformation above).
//
//  Picking goes through Potree's picker (Utils.getMousePointCloudIntersection,
//  as the measuring tool uses), limited to the moving cloud for sources and
//  to the other visible clouds for targets, so overlapping clouds can't steal
//  a pick. A plain click picks; drags still orbit and pan between picks.
//  Picked points are kept in their cloud's own frame, so markers stay on the
//  cloud through Align, Undo and the transform gizmo, and they can be dragged
//  (Potree's drag/drop events) to adjust a pick.
// ═══════════════════════════════════════════════════════════════════════
(function () {
    "use strict";

    const PANEL_ID = "pairAlignPanel";
    const MIN_PAIRS = 3;

    // Shared by the markers in the view and the pair rows in the panel
    const SOURCE_COLOR = "#fb923c";
    const TARGET_COLOR = "#22d3ee";
    const ARROW_COLOR = "#facc15";
    const OUTLINE_COLOR = "#0b0b10";

    // Marker and arrow sizes in screen pixels; they keep that size at any distance
    const MARKER_PX = 6;
    const MARKER_HOT_PX = 8.5;      // the pair under the cursor, in the view or in the list
    const OUTLINE_PX = 1.5;
    const SHAFT_PX = 1.5;
    const HEAD_LEN_PX = 13;
    const HEAD_RADIUS_PX = 5.5;

    const CLICK_SLOP_PX = 4;        // a press that moves further than this is a drag, not a pick
    // How far the points are from one line, relative to their spread (lineSpread). Points on a line
    // leave the rotation about it undetermined; nearly on a line, it is poorly constrained.
    const COLLINEAR = 1e-4;
    const NEAR_COLLINEAR = 0.03;

    const css = document.createElement("style");
    css.textContent = `
/* ═══════════════════════════════════════════════════════════
   ALIGN BY POINT PAIRS — builds on the transform panel's classes
   (.transform-panel, -section, -subtitle, -button, -search)
   ═══════════════════════════════════════════════════════════ */
#pairAlignPanel {
    width: clamp(320px, 28vw, 380px);
    max-height: calc(100vh - 100px);
    overflow-y: auto;
    background: rgba(20, 20, 26, 0.9);
    font-size: 13px;
    color: #d6d6de;
}
/* Mostly text and figures, so nearly opaque in the window manager's frame too */
.pwm-frame:has(> .pwm-body > #pairAlignPanel) { background: rgba(20, 20, 26, 0.9); }
#pairAlignPanel [hidden] { display: none !important; }
#pairAlignPanel .transform-subtitle { color: #a8a8b4; }

.pp-hint { margin-top: 8px; font-size: 12px; line-height: 1.5; color: #b4b4c0; }
.pp-src-text { color: #fdba74; font-weight: 600; }
.pp-tgt-text { color: #67e8f9; font-weight: 600; }

/* The three sections are numbered steps: the current one is lit, finished ones are ticked */
#pairAlignPanel .pp-step-title { display: flex; align-items: center; gap: 8px; }
.pp-step {
    flex: none;
    width: 20px; height: 20px;
    box-sizing: border-box;
    border-radius: 50%;
    display: inline-flex; align-items: center; justify-content: center;
    border: 1px solid rgba(255,255,255,0.22);
    color: #a4a4b0;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0;
    transition: background .15s, border-color .15s, color .15s;
}
.pp-step.pp-current { background: #4f46e5; border-color: #8f8cff; color: #fff; box-shadow: 0 0 10px rgba(99,90,245,0.5); }
.pp-step.pp-done { background: rgba(34,197,94,0.22); border-color: rgba(34,197,94,0.6); color: #bbf7d0; }
#pairAlignPanel .pp-step-title:has(.pp-current) { color: #e4e2ff; }

/* ...and the control that takes the next step glows */
.pp-combo-btn.pp-next { border-color: rgba(110,107,255,0.75); box-shadow: 0 0 0 3px rgba(79,70,229,0.22); }
#pairAlignPanel .pp-pick-btn.pp-next:not(.active):not(:disabled) {
    background: rgba(79,70,229,0.3);
    border-color: rgba(147,140,255,0.8);
    color: #fff;
    font-weight: 600;
}

/* Searchable cloud picker — the list opens in the panel's flow, so the frame never clips it */
.pp-combo-btn {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    box-sizing: border-box;
    padding: 9px 12px;
    border-radius: 8px;
    border: 1px solid rgba(255,255,255,0.2);
    background: rgba(255,255,255,0.08);
    color: #fafafa;
    font: inherit;
    font-size: 14px;
    text-align: left;
    cursor: pointer;
    transition: border-color .15s, background .15s, box-shadow .15s;
}
.pp-combo-btn:hover { background: rgba(255,255,255,0.12); }
.pp-combo-btn:focus-visible,
.pp-combo.open .pp-combo-btn {
    outline: none;
    border-color: #6e6bff;
    box-shadow: 0 0 0 3px rgba(79,70,229,0.3);
}
.pp-combo-value { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pp-combo-value.pp-placeholder { color: #a4a4b0; }
.pp-caret { flex: none; color: #b4b4c0; font-size: 12px; transition: transform .15s ease; }
.pp-combo.open .pp-caret { transform: rotate(180deg); }
.pp-combo-menu {
    margin-top: 6px;
    padding: 8px;
    border-radius: 10px;
    background: rgba(0,0,0,0.3);
    border: 1px solid rgba(255,255,255,0.12);
}
.pp-combo-menu .transform-search { margin-bottom: 6px; }
.pp-combo-list { max-height: 196px; overflow-y: auto; display: flex; flex-direction: column; gap: 2px; }
.pp-option {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 6px;
    color: #e8e8ee;
    font-size: 13px;
    cursor: pointer;
}
.pp-option.pp-active { background: rgba(79,70,229,0.28); }
.pp-option[aria-selected="true"] { color: #fff; font-weight: 600; }
.pp-option[aria-selected="true"]::before { content: "✓"; color: #b3afff; }
.pp-option-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pp-option-sub {
    margin-left: auto;
    min-width: 0;
    font-size: 12px;
    font-weight: normal;
    color: #a4a4b0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.pp-option-tag {
    flex: none;
    margin-left: auto;
    padding: 0 6px;
    border-radius: 9999px;
    border: 1px solid rgba(148,163,184,0.45);
    font-size: 12px;
    font-weight: normal;
    color: #b4b4c0;
}
.pp-option-sub + .pp-option-tag { margin-left: 0; }
.pp-none { padding: 6px 8px; font-size: 12px; color: #a4a4b0; }

/* Pair list */
.pp-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
.pp-head .transform-subtitle { margin-bottom: 0; }
.pp-count { font-size: 12px; color: #a4a4b0; font-variant-numeric: tabular-nums; }
.pp-count.pp-ok { color: #86efac; }

.pp-cols,
.pp-row {
    display: grid;
    grid-template-columns: 22px 44px minmax(0, 1fr) minmax(0, 1fr) 24px;
    column-gap: 8px;
    align-items: center;
}
.pp-cols { padding: 0 7px 4px 11px; font-size: 12px; color: #a4a4b0; }
.pp-cols > :nth-child(3),
.pp-cols > :nth-child(4) { text-align: right; }
.pp-list { display: flex; flex-direction: column; gap: 4px; max-height: 248px; overflow-y: auto; }
.pp-row {
    padding: 6px 6px 6px 10px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 8px;
    transition: background .15s, border-color .15s;
}
.pp-row.pp-hot { background: rgba(79,70,229,0.14); border-color: rgba(110,107,255,0.55); }
.pp-num {
    width: 22px; height: 22px;
    border-radius: 50%;
    display: inline-flex; align-items: center; justify-content: center;
    background: rgba(79,70,229,0.35);
    color: #d4d1ff;
    font-size: 12px;
    font-weight: 700;
}
.pp-row.pp-hot .pp-num { background: #4f46e5; color: #fff; }
/* The pair's direction, drawn like the markers in the view: source ● ─▶ ● target */
.pp-dir { display: inline-flex; align-items: center; }
.pp-dot { flex: none; width: 10px; height: 10px; border-radius: 50%; box-shadow: 0 0 0 1.5px #0b0b10; }
.pp-dot.pp-src { background: ${SOURCE_COLOR}; }
.pp-dot.pp-tgt { background: ${TARGET_COLOR}; }
.pp-dot.pp-tgt.pp-hollow { background: transparent; box-shadow: inset 0 0 0 1.5px ${TARGET_COLOR}; }
.pp-shaft { position: relative; flex: none; width: 13px; height: 2px; margin: 0 7px 0 1px; background: ${ARROW_COLOR}; }
.pp-shaft::after {
    content: "";
    position: absolute;
    right: -6px; top: -3px;
    border-left: 6px solid ${ARROW_COLOR};
    border-top: 4px solid transparent;
    border-bottom: 4px solid transparent;
}
.pp-val {
    text-align: right;
    font-family: ui-monospace, "SF Mono", Menlo, monospace;
    font-size: 12px;
    color: #f0f0f4;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.pp-val.pp-muted { color: #a4a4b0; }
.pp-pending { grid-column: 3 / 5; font-size: 12px; color: #67e8f9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pp-del {
    width: 24px; height: 24px;
    padding: 0;
    display: inline-flex; align-items: center; justify-content: center;
    border: none; border-radius: 5px;
    background: transparent;
    color: #b4b4c0;
    font-size: 16px;
    font-family: inherit;
    cursor: pointer;
    transition: background .15s, color .15s;
}
.pp-del:hover { background: rgba(220,38,38,0.3); color: #f87171; }
.pp-empty {
    padding: 14px 12px;
    text-align: center;
    font-size: 13px;
    line-height: 1.5;
    color: #a4a4b0;
    border: 1px dashed rgba(255,255,255,0.18);
    border-radius: 10px;
}
#pairAlignPanel .pp-pick-btn { margin-top: 8px; padding: 9px 6px; font-size: 13px; }

.pp-status {
    margin-top: 8px;
    padding: 8px 10px;
    border-radius: 8px;
    background: rgba(79,70,229,0.15);
    border: 1px solid rgba(79,70,229,0.32);
    font-size: 13px;
    line-height: 1.45;
    color: #e4e2ff;
}
.pp-status small { display: block; margin-top: 2px; font-size: 12px; color: #b4b4c0; }
.pp-status.pp-warn { background: rgba(251,191,36,0.12); border-color: rgba(251,191,36,0.38); color: #fcd34d; }

/* Fit */
.pp-fit { display: grid; grid-template-columns: auto 1fr; column-gap: 12px; row-gap: 4px; margin: 0; }
.pp-fit dt { color: #b4b4c0; font-size: 13px; }
.pp-fit dd {
    margin: 0;
    text-align: right;
    color: #f0f0f4;
    font-family: ui-monospace, "SF Mono", Menlo, monospace;
    font-size: 13px;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
}
.pp-fit dd small { font-family: 'Segoe UI', system-ui, sans-serif; font-size: 12px; color: #b4b4c0; }
.pp-fit-empty { font-size: 13px; color: #a4a4b0; }
.pp-note { margin-top: 10px; padding: 8px 10px; border-radius: 8px; font-size: 12px; line-height: 1.5; }
.pp-note.pp-warn { background: rgba(251,191,36,0.12); border: 1px solid rgba(251,191,36,0.38); color: #fcd34d; }
.pp-note.pp-error { background: rgba(220,38,38,0.14); border: 1px solid rgba(248,113,113,0.42); color: #fca5a5; }
.pp-note.pp-done { background: rgba(34,197,94,0.12); border: 1px solid rgba(34,197,94,0.4); color: #bbf7d0; }
#pairAlignPanel .transform-actions { margin-top: 12px; }
#pairAlignPanel .transform-button.pp-primary {
    background: rgba(79,70,229,0.85);
    border-color: rgba(147,140,255,0.6);
    color: #fff;
    font-weight: 600;
}
#pairAlignPanel .transform-button.pp-primary:hover:not(:disabled) {
    background: rgba(99,90,245,1);
    box-shadow: 0 0 12px rgba(99,90,245,0.45);
}
#pairAlignPanel .transform-button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    background: rgba(255,255,255,0.08);
    border-color: rgba(255,255,255,0.12);
    box-shadow: none;
    transform: none;
}
#pairAlignPanel .transform-button.pp-primary:disabled { background: rgba(79,70,229,0.5); }

/* Pair numbers next to the source markers in the view */
.pp-badges { position: absolute; left: 0; top: 0; width: 0; height: 0; pointer-events: none; z-index: 4; }
.pp-badge {
    position: absolute;
    left: 0; top: 0;
    display: none;
    min-width: 20px;
    height: 20px;
    box-sizing: border-box;
    padding: 0 5px;
    border-radius: 10px;
    background: rgba(20,20,26,0.88);
    border: 1px solid rgba(255,255,255,0.4);
    color: #fff;
    font: 700 12px/18px 'Segoe UI', system-ui, sans-serif;
    text-align: center;
    white-space: nowrap;
}
.pp-badge.pp-hot { background: #4f46e5; border-color: #b3afff; }
`;
    (document.head || document.documentElement).appendChild(css);

    const state = {
        panel: null,
        ui: null,
        moving: null,           // the point cloud Align moves
        pairs: [],              // { source, target, src, tgt, arrow, badge, row, error }
        picking: null,          // null | "source" | "target"
        pending: null,          // the pair whose target is being picked
        hoverPair: null,        // highlighted from its row or its markers
        hoverHit: null,         // { pc, world } under the cursor while picking
        mouse: null,            // cursor over the canvas, in canvas pixels
        buttons: 0,             // mouse buttons held, from the last mouse event
        pickScheduled: false,
        cameraKey: "",
        fit: null,
        fitKey: null,
        aligned: null,          // what the last Align or Undo did, shown until the pairs change
        undo: [],               // { pc, position, quaternion, scale } before each Align
        flash: null,
        flashTimer: 0,
        menuMatches: [],
        menuActive: 0,
        prevCursor: "",
        scene: null,            // drawn over everything in the perspective_overlay pass
        ghost: null,            // follows the cursor while picking
        badges: null,
    };

    let downAt = null;          // where a left press that may become a pick began
    let rightDownAt = null;     // likewise for a right click, which stops picking

    // ══════════════════════════════════════════════════════════════
    //  Small helpers
    // ══════════════════════════════════════════════════════════════
    function el(tag, cls, text) {
        const e = document.createElement(tag);
        if (cls) e.className = cls;
        if (text != null) e.textContent = text;
        return e;
    }

    function cloudLabel(pc) {
        if (!pc) return "";
        const i = viewer.scene.pointclouds.indexOf(pc);
        return pc.userData?.label || pc.name || `Point cloud ${i + 1}`;
    }

    function unit() {
        return viewer.lengthUnit?.code || "m";
    }

    function fmtNum(v) {
        return Math.abs(v) >= 1000 ? v.toFixed(1) : v.toFixed(3);
    }

    function fmtLen(v) {
        return `${fmtNum(v)} ${unit()}`;
    }

    function fmtPoint(p) {
        return `${p.x.toFixed(3)}, ${p.y.toFixed(3)}, ${p.z.toFixed(3)}`;
    }

    // The cloud's world matrix from its current position, rotation and scale. matrixWorld only
    // catches up on the next frame (Align and Undo need it at once), and updateMatrixWorld() would
    // walk every loaded octree node. `mats` caches it for the rest of a frame.
    function cloudMatrix(pc, mats) {
        let m = mats && mats.get(pc);
        if (!m) {
            pc.updateMatrix();
            m = new THREE.Matrix4().copy(pc.matrix);
            if (pc.parent) m.premultiply(pc.parent.matrixWorld);
            if (mats) mats.set(pc, m);
        }
        return m;
    }

    // Picked points are { pc, local }: a position in that cloud's own frame
    function worldOf(pt, mats) {
        return pt.local.clone().applyMatrix4(cloudMatrix(pt.pc, mats));
    }

    function toLocal(hit) {
        const inverse = new THREE.Matrix4().copy(cloudMatrix(hit.pc)).invert();
        return { pc: hit.pc, local: hit.world.clone().applyMatrix4(inverse) };
    }

    // How far the points are from lying on one line, relative to their spread:
    // 0 for points on a line (or all in one place)
    function lineSpread(points) {
        let a = null, b = null, far = 0;
        for (let i = 0; i < points.length; i++) {
            for (let j = i + 1; j < points.length; j++) {
                const d = points[i].distanceTo(points[j]);
                if (d > far) { far = d; a = points[i]; b = points[j]; }
            }
        }
        if (far === 0) return 0;
        const axis = new THREE.Vector3().subVectors(b, a).normalize();
        let off = 0;
        for (const p of points) {
            const v = new THREE.Vector3().subVectors(p, a);
            off = Math.max(off, v.addScaledVector(axis, -v.dot(axis)).length());
        }
        return off / far;
    }

    // ══════════════════════════════════════════════════════════════
    //  Picking
    // ══════════════════════════════════════════════════════════════
    // Sources come from the moving cloud, targets from any other visible cloud. Until a cloud is chosen,
    // sources come from any visible cloud, and the first one picked chooses it (see place()).
    function candidates(role) {
        return viewer.scene.pointclouds.filter(pc => pc.visible &&
            (role === "source" ? !state.moving || pc === state.moving : pc !== state.moving));
    }

    // Picking needs a cloud to move and another to align it to
    function canPick() {
        const clouds = viewer.scene.pointclouds;
        return state.moving ? clouds.some(pc => pc !== state.moving) : clouds.length > 1;
    }

    // Nearest point under (x, y) in canvas pixels, or null
    function pickAt(x, y, role) {
        const clouds = candidates(role);
        if (!clouds.length) return null;
        const hit = Potree.Utils.getMousePointCloudIntersection(
            { x, y }, viewer.scene.getActiveCamera(), viewer, clouds, { pickClipped: true });
        return hit && { pc: hit.pointcloud, world: new THREE.Vector3().copy(hit.location) };
    }

    function canvasPoint(e) {
        const rect = viewer.renderer.domElement.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    // Clicks that belong to something else are left alone: Potree tool insertions and interactive
    // objects under the cursor (360 / oriented-image markers, and this panel's own markers, which drag)
    function sceneWantsClick() {
        const ih = viewer.inputHandler;
        if (!ih) return false;
        return ih.enabled === false ||
               !!(ih.drag && ih.drag.object) ||
               (Array.isArray(ih.hoveredElements) && ih.hoveredElements.length > 0);
    }

    function draggingMarker() {
        const ih = viewer.inputHandler;
        return !!(ih && ih.drag && ih.drag.object && ih.drag.object.userData.pairAlign);
    }

    // The ghost marker follows the cursor, picked at most once a frame
    function schedulePick() {
        if (state.pickScheduled) return;
        state.pickScheduled = true;
        requestAnimationFrame(() => {
            state.pickScheduled = false;
            const m = state.mouse;
            state.hoverHit = (state.picking && m && !state.buttons && !draggingMarker())
                ? pickAt(m.x, m.y, state.picking) : null;
        });
    }

    function onMouseMove(e) {
        state.mouse = canvasPoint(e);
        state.buttons = e.buttons;
        if (!state.picking) return;
        // Orbit/pan drags: hide the ghost rather than re-picking every frame while the view moves
        if (e.buttons) state.hoverHit = null;
        else schedulePick();
    }

    function onMouseLeave() {
        state.mouse = null;
        state.hoverHit = null;
    }

    function onPointerDown(e) {
        state.buttons = e.buttons;
        if (!state.picking) return;
        if (e.button === 2) {
            rightDownAt = { x: e.clientX, y: e.clientY };
            return;
        }
        const plain = e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey;
        downAt = (plain && !sceneWantsClick()) ? { x: e.clientX, y: e.clientY } : null;
    }

    function onPointerUp(e) {
        state.buttons = e.buttons;
        if (!state.picking) return;
        const d = rightDownAt;
        rightDownAt = null;
        // A right click (not a right-drag pan) stops picking, as it ends a Potree measurement
        if (e.button === 2 && d && Math.hypot(e.clientX - d.x, e.clientY - d.y) <= CLICK_SLOP_PX) {
            stopPicking();
            return;
        }
        schedulePick();
    }

    function onClick(e) {
        const d = downAt;
        downAt = null;
        // detail > 1 is the second click of a double-click (Potree zooms on those)
        if (!state.picking || !d || e.button !== 0 || e.detail > 1) return;
        if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > CLICK_SLOP_PX) return;   // a drag

        // Pick exactly what's under the click, not the last throttled hover pick
        const p = canvasPoint(e);
        const hit = pickAt(p.x, p.y, state.picking);
        if (!hit) {
            flash(state.picking === "target" ? "No point of another cloud there."
                : state.moving ? `No point of ${cloudLabel(state.moving)} there.`
                : "No point cloud there.");
            return;
        }
        place(hit);
    }

    function onKeyDown(e) {
        if (e.key !== "Escape" || !state.picking) return;
        const t = e.target;
        if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
        stopPicking();
    }

    function place(hit) {
        const pt = toLocal(hit);
        if (state.picking === "source") {
            // No cloud chosen yet: the one the first source point is on becomes the one to move
            if (!state.moving) state.moving = hit.pc;
            state.pending = addPair(pt);
            state.picking = "target";
        } else {
            state.pending.target = pt;
            state.pending = null;
            state.picking = "source";
        }
        state.aligned = null;
        state.hoverHit = null;
        schedulePick();
        render();
    }

    function startPicking() {
        if (!canPick() || state.picking) return;
        // End any Potree measurement or volume still being placed
        viewer.dispatchEvent({ type: "cancel_insertions" });
        state.picking = "source";
        const canvas = viewer.renderer.domElement;
        state.prevCursor = canvas.style.cursor;
        canvas.style.cursor = "crosshair";
        schedulePick();
        render();
    }

    function stopPicking() {
        if (!state.picking) return;
        state.picking = null;
        // Half a pair is no use
        if (state.pending) removePair(state.pending);
        state.pending = null;
        state.hoverHit = null;
        downAt = rightDownAt = null;
        viewer.renderer.domElement.style.cursor = state.prevCursor;
        render();
    }

    function flash(text) {
        state.flash = text;
        clearTimeout(state.flashTimer);
        state.flashTimer = setTimeout(() => { state.flash = null; renderStatus(); }, 2200);
        renderStatus();
    }

    // ══════════════════════════════════════════════════════════════
    //  Markers in the view
    // ══════════════════════════════════════════════════════════════
    let geo = null;     // shared by every marker; built on first open

    function geometries() {
        if (geo) return geo;
        const sphere = new THREE.SphereGeometry(1, 20, 14);
        const shaft = new THREE.CylinderGeometry(1, 1, 1, 12);
        shaft.translate(0, 0.5, 0);         // from the origin along +Y
        const head = new THREE.ConeGeometry(1, 1, 18);
        head.translate(0, -0.5, 0);         // tip at the origin, base towards -Y
        return geo = { sphere, shaft, head };
    }

    // Transparent so renderOrder alone decides what draws over what: arrows, then marker outlines,
    // then marker fills. No depth test, like Potree's measurement markers.
    function material(color, opacity = 1) {
        return new THREE.MeshBasicMaterial({
            color, transparent: true, opacity, depthTest: false, depthWrite: false,
        });
    }

    function makeMarker(color, opacity = 1) {
        const { sphere } = geometries();
        const marker = new THREE.Group();
        const outline = new THREE.Mesh(sphere, material(OUTLINE_COLOR, 0.85 * opacity));
        const core = new THREE.Mesh(sphere, material(color, opacity));
        outline.renderOrder = 2;
        core.renderOrder = 3;
        marker.add(outline, core);
        marker.userData = { outline, core };
        return marker;
    }

    function makeArrow() {
        const { shaft, head } = geometries();
        const arrow = new THREE.Group();
        const parts = {
            shaftOutline: new THREE.Mesh(shaft, material(OUTLINE_COLOR, 0.85)),
            headOutline: new THREE.Mesh(head, material(OUTLINE_COLOR, 0.85)),
            shaft: new THREE.Mesh(shaft, material(ARROW_COLOR)),
            head: new THREE.Mesh(head, material(ARROW_COLOR)),
        };
        parts.shaft.renderOrder = parts.head.renderOrder = 1;
        arrow.add(parts.shaftOutline, parts.headOutline, parts.shaft, parts.head);
        arrow.userData = parts;
        arrow.visible = false;
        return arrow;
    }

    function disposeObject(obj) {
        obj.traverse(o => { if (o.material) o.material.dispose(); });
        if (obj.parent) obj.parent.remove(obj);
    }

    // Dragging a placed marker re-picks it, from the same clouds it was first picked on.
    // The hit target is the outline, the larger of the two spheres.
    function makeDraggable(marker, pair, role) {
        const hit = marker.userData.outline;
        hit.userData.pairAlign = true;
        hit.addEventListener("drag", e => {
            const h = pickAt(e.drag.end.x, e.drag.end.y, role);
            if (!h) return;
            pair[role] = toLocal(h);
            state.aligned = null;
        });
        hit.addEventListener("drop", () => render());
        hit.addEventListener("mouseover", () => setHover(pair));
        hit.addEventListener("mouseleave", () => setHover(null));
    }

    // World units per screen pixel at `pos`
    function worldPerPixel(pos, camera, w, h) {
        const distance = camera.position.distanceTo(pos);
        return 1 / Potree.Utils.projectedRadius(1, camera, distance, w, h);
    }

    function sizeMarker(marker, pos, wpp, hot) {
        const r = hot ? MARKER_HOT_PX : MARKER_PX;
        marker.position.copy(pos);
        marker.userData.core.scale.setScalar(r * wpp);
        marker.userData.outline.scale.setScalar((r + OUTLINE_PX) * wpp);
    }

    const _dir = new THREE.Vector3();
    const _mid = new THREE.Vector3();
    const _up = new THREE.Vector3(0, 1, 0);
    const _proj = new THREE.Vector3();

    // From the edge of the source marker to the edge of the target marker
    function placeArrow(arrow, from, to, wpp) {
        arrow.visible = false;
        if (!to) return;
        const dist = _dir.subVectors(to, from).length();
        const wTo = wpp(to);
        const start = (MARKER_PX + OUTLINE_PX) * wpp(from);
        const len = dist - (MARKER_PX + OUTLINE_PX) * wTo - start;
        const headLen = HEAD_LEN_PX * wTo;
        // Too short to read on screen: the markers all but touch
        if (!(len > headLen * 1.5)) return;
        arrow.visible = true;

        _dir.divideScalar(dist);
        arrow.position.copy(from).addScaledVector(_dir, start);
        arrow.quaternion.setFromUnitVectors(_up, _dir);

        const p = arrow.userData;
        const wMid = wpp(_mid.lerpVectors(from, to, 0.5));
        const r = SHAFT_PX * wMid, o = OUTLINE_PX * wMid;
        p.shaft.scale.set(r, len - headLen, r);
        p.shaftOutline.scale.set(r + o, len - headLen, r + o);

        const slope = HEAD_RADIUS_PX / HEAD_LEN_PX;
        p.head.position.y = len;
        p.head.scale.set(headLen * slope, headLen, headLen * slope);
        // The outline is the same cone grown by OUTLINE_PX all round: its tip sits
        // OUTLINE_PX / sin(half angle) beyond the head's
        const ho = OUTLINE_PX * wTo;
        const tip = ho * Math.hypot(HEAD_LEN_PX, HEAD_RADIUS_PX) / HEAD_RADIUS_PX;
        const outLen = headLen + tip + ho;
        p.headOutline.position.y = len + tip;
        p.headOutline.scale.set(outLen * slope, outLen, outLen * slope);
    }

    function placeBadge(badge, world, camera, canvas) {
        _proj.copy(world).project(camera);
        if (_proj.z < -1 || _proj.z > 1 || Math.abs(_proj.x) > 1.05 || Math.abs(_proj.y) > 1.05) {
            badge.style.display = "none";
            return;
        }
        const x = (_proj.x + 1) / 2 * canvas.clientWidth + canvas.offsetLeft;
        const y = (1 - _proj.y) / 2 * canvas.clientHeight + canvas.offsetTop;
        badge.style.transform = `translate(${(x + 8).toFixed(1)}px, ${(y - 28).toFixed(1)}px)`;
        badge.style.display = "block";
    }

    // Runs in Potree's perspective_overlay pass, after the point clouds (and EDL) are drawn
    function onOverlay() {
        if (!state.panel) return;
        const camera = viewer.scene.getActiveCamera();
        const canvas = viewer.renderer.domElement;
        const w = canvas.clientWidth, h = canvas.clientHeight;
        const mats = new Map();
        const wpp = p => worldPerPixel(p, camera, w, h);

        refitIfChanged(mats);

        for (const pair of state.pairs) {
            const hot = pair === state.hoverPair;
            const s = worldOf(pair.source, mats);
            const t = pair.target ? worldOf(pair.target, mats)
                : (pair === state.pending && state.hoverHit) ? state.hoverHit.world : null;
            sizeMarker(pair.src, s, wpp(s), hot);
            pair.tgt.visible = !!pair.target;
            if (pair.target) sizeMarker(pair.tgt, t, wpp(t), hot);
            placeArrow(pair.arrow, s, t, wpp);
            placeBadge(pair.badge, s, camera, canvas);
            pair.badge.classList.toggle("pp-hot", hot);
        }

        const ghost = state.ghost;
        const hit = state.picking && state.hoverHit;
        ghost.visible = !!hit;
        if (hit) {
            ghost.userData.core.material.color.set(state.picking === "source" ? SOURCE_COLOR : TARGET_COLOR);
            sizeMarker(ghost, hit.world, wpp(hit.world), false);
        }

        // Zooming or flying the camera moves the cloud under a still cursor
        if (state.picking) {
            const key = camera.matrixWorld.elements.join();
            if (key !== state.cameraKey) {
                state.cameraKey = key;
                if (!state.buttons) schedulePick();
            }
        }

        viewer.renderer.render(state.scene, camera);
    }

    // ══════════════════════════════════════════════════════════════
    //  Pairs
    // ══════════════════════════════════════════════════════════════
    function addPair(source) {
        const pair = {
            source,
            target: null,
            src: makeMarker(SOURCE_COLOR),
            tgt: makeMarker(TARGET_COLOR),
            arrow: makeArrow(),
            badge: el("div", "pp-badge"),
            row: null,
            error: null,
        };
        pair.tgt.visible = false;
        makeDraggable(pair.src, pair, "source");
        makeDraggable(pair.tgt, pair, "target");
        state.scene.add(pair.arrow, pair.src, pair.tgt);
        state.badges.appendChild(pair.badge);
        state.pairs.push(pair);
        return pair;
    }

    function removePair(pair) {
        const i = state.pairs.indexOf(pair);
        if (i < 0) return;
        state.pairs.splice(i, 1);
        disposeObject(pair.arrow);
        disposeObject(pair.src);
        disposeObject(pair.tgt);
        pair.badge.remove();
        if (pair.row) pair.row.el.remove();
        if (state.hoverPair === pair) state.hoverPair = null;
        if (state.pending === pair) {
            state.pending = null;
            if (state.picking) state.picking = "source";
        }
        state.aligned = null;
    }

    function clearPairs() {
        for (const pair of state.pairs.slice()) removePair(pair);
    }

    function setHover(pair) {
        if (state.hoverPair === pair) return;
        state.hoverPair = pair;
        for (const p of state.pairs) {
            if (p.row) p.row.el.classList.toggle("pp-hot", p === pair);
        }
    }

    // ══════════════════════════════════════════════════════════════
    //  Fit and Align
    // ══════════════════════════════════════════════════════════════
    // The fit follows the picked points in world space, so it is redone when a pick changes and when
    // a cloud moves (Align, Undo, the transform gizmo)
    function refitIfChanged(mats) {
        const done = state.pairs.filter(p => p.target);
        const A = done.map(p => worldOf(p.source, mats));
        const B = done.map(p => worldOf(p.target, mats));
        const key = A.concat(B).map(v => v.toArray().join()).join(";");
        if (key === state.fitKey) return;
        state.fitKey = key;
        state.fit = computeFit(done, A, B);
        renderList();
        renderFit();
    }

    function computeFit(done, A, B) {
        const gaps = A.map((a, i) => a.distanceTo(B[i]));
        done.forEach((p, i) => { p.gap = gaps[i]; p.error = null; });
        const fit = { pairs: done, count: done.length };
        if (done.length < MIN_PAIRS) return fit;

        const spread = Math.min(lineSpread(A), lineSpread(B));
        if (spread < COLLINEAR) {
            fit.blocked = "The picked points lie on a line, so the rotation about that line can't be " +
                "worked out. Add a pair well away from the line.";
            return fit;
        }
        if (spread < NEAR_COLLINEAR) {
            fit.warning = "The picked points lie almost on a line, so the rotation about it is poorly " +
                "fixed. A pair well away from the line will make the fit more reliable.";
        }

        const M = findRigidTransformation(A, B);
        const errors = A.map((a, i) => a.clone().applyMatrix4(M).distanceTo(B[i]));
        done.forEach((p, i) => { p.error = errors[i]; });

        let max = 0, maxIndex = 0, sum = 0;
        errors.forEach((e, i) => {
            sum += e * e;
            if (e > max) { max = e; maxIndex = i; }
        });

        // How far Align would move the picked points, and the angle it would turn the cloud through
        const centroid = A.reduce((c, a) => c.add(a), new THREE.Vector3()).divideScalar(A.length);
        const q = new THREE.Quaternion().setFromRotationMatrix(M);

        fit.M = M;
        fit.rms = Math.sqrt(sum / errors.length);
        fit.max = max;
        fit.maxPair = done[maxIndex];
        fit.shift = centroid.clone().applyMatrix4(M).distanceTo(centroid);
        fit.angle = 2 * Math.acos(Math.min(1, Math.abs(q.w))) * 180 / Math.PI;
        return fit;
    }

    function align() {
        const pc = state.moving;
        refitIfChanged(new Map());
        const fit = state.fit;
        if (!pc || !fit || !fit.M || fit.blocked || state.picking === "target") return;

        state.undo.push({
            pc,
            position: pc.position.clone(),
            quaternion: pc.quaternion.clone(),
            scale: pc.scale.clone(),
        });

        // New world matrix M·W, written back as position / rotation / scale in the parent's frame.
        // M is rigid, so the cloud's scale comes through unchanged.
        const world = new THREE.Matrix4().multiplyMatrices(fit.M, cloudMatrix(pc));
        const local = pc.parent
            ? new THREE.Matrix4().copy(pc.parent.matrixWorld).invert().multiply(world)
            : world;
        local.decompose(pc.position, pc.quaternion, pc.scale);

        state.aligned = { kind: "done", label: cloudLabel(pc), shift: fit.shift, angle: fit.angle, rms: fit.rms };
        render();
    }

    function undoAlign() {
        const last = state.undo.pop();
        if (!last) return;
        const pc = last.pc;
        pc.position.copy(last.position);
        pc.quaternion.copy(last.quaternion);
        pc.scale.copy(last.scale);
        state.aligned = { kind: "undone", label: cloudLabel(pc) };
        render();
    }

    // ══════════════════════════════════════════════════════════════
    //  Cloud picker
    // ══════════════════════════════════════════════════════════════
    function setMoving(pc) {
        if (pc === state.moving) return true;
        const n = state.pairs.filter(p => p.target).length;
        if (n && !confirm(`Choosing another cloud to move removes the ${n} pair${n === 1 ? "" : "s"} picked so far.`)) {
            return false;
        }
        stopPicking();
        clearPairs();
        state.moving = pc;
        state.aligned = null;
        render();
        return true;
    }

    function openMenu() {
        const ui = state.ui;
        ui.combo.classList.add("open");
        ui.comboBtn.setAttribute("aria-expanded", "true");
        ui.menu.hidden = false;
        ui.search.value = "";
        state.menuActive = Math.max(0, viewer.scene.pointclouds.indexOf(state.moving));
        renderMenu();
        ui.search.focus();
        document.addEventListener("pointerdown", onOutsideMenu, true);
    }

    function closeMenu(focusButton) {
        const ui = state.ui;
        if (!ui || ui.menu.hidden) return;
        ui.combo.classList.remove("open");
        ui.comboBtn.setAttribute("aria-expanded", "false");
        ui.menu.hidden = true;
        document.removeEventListener("pointerdown", onOutsideMenu, true);
        if (focusButton) ui.comboBtn.focus();
    }

    function onOutsideMenu(e) {
        if (state.ui && !state.ui.combo.contains(e.target)) closeMenu(false);
    }

    function renderMenu() {
        const ui = state.ui;
        const q = ui.search.value.trim().toLowerCase();
        const matches = viewer.scene.pointclouds.filter(pc =>
            `${cloudLabel(pc)} ${pc.name || ""}`.toLowerCase().includes(q));
        state.menuMatches = matches;
        state.menuActive = Math.min(Math.max(state.menuActive, 0), Math.max(matches.length - 1, 0));

        ui.cloudList.replaceChildren(...matches.map((pc, i) => {
            const label = cloudLabel(pc);
            const opt = el("div", "pp-option");
            opt.setAttribute("role", "option");
            opt.setAttribute("aria-selected", String(pc === state.moving));
            opt.classList.toggle("pp-active", i === state.menuActive);
            opt.title = pc.name || label;
            opt.append(el("span", "pp-option-label", label));
            if (pc.name && pc.name !== label) opt.append(el("span", "pp-option-sub", pc.name));
            if (!pc.visible) opt.append(el("span", "pp-option-tag", "hidden"));
            opt.addEventListener("mousedown", e => e.preventDefault());    // keep focus in the search box
            opt.addEventListener("mouseenter", () => setMenuActive(i));
            opt.addEventListener("click", () => chooseFromMenu(pc));
            return opt;
        }));
        if (!matches.length) {
            ui.cloudList.append(el("div", "pp-none",
                viewer.scene.pointclouds.length ? "No point cloud matches." : "No point clouds are loaded."));
        }
    }

    function setMenuActive(i) {
        state.menuActive = i;
        [...state.ui.cloudList.children].forEach((c, j) => c.classList.toggle("pp-active", j === i));
    }

    function chooseFromMenu(pc) {
        closeMenu(true);
        setMoving(pc);
    }

    function onSearchKey(e) {
        const n = state.menuMatches.length;
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            if (!n) return;
            setMenuActive((state.menuActive + (e.key === "ArrowDown" ? 1 : n - 1)) % n);
            state.ui.cloudList.children[state.menuActive]?.scrollIntoView({ block: "nearest" });
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (n) chooseFromMenu(state.menuMatches[state.menuActive]);
        } else if (e.key === "Escape") {
            e.preventDefault();
            closeMenu(true);
        } else if (e.key === "Tab") {
            closeMenu(false);
        }
    }

    // ══════════════════════════════════════════════════════════════
    //  Panel
    // ══════════════════════════════════════════════════════════════
    function render() {
        const ui = state.ui;
        if (!ui) return;
        const pc = state.moving;

        ui.comboValue.textContent = pc ? cloudLabel(pc) : "Choose the point cloud to move…";
        ui.comboValue.classList.toggle("pp-placeholder", !pc);
        ui.comboBtn.title = pc ? (pc.name || cloudLabel(pc)) : "";
        ui.chooseHint.hidden = !!pc;

        ui.pickBtn.disabled = !canPick();
        ui.pickBtn.classList.toggle("active", !!state.picking);
        ui.pickBtn.innerHTML = state.picking ? "Stop Picking <kbd>Esc</kbd>" : "Pick Pairs";

        renderStatus();
        refitIfChanged(new Map());      // so the list and buttons don't wait a frame for a new fit
        renderList();
        renderFit();
    }

    // 1 choose the cloud, 2 pick pairs, 3 align
    function renderSteps() {
        const ui = state.ui;
        const done = state.pairs.filter(p => p.target).length;
        const aligned = state.aligned?.kind === "done";
        const step = !state.moving ? 1 : done < MIN_PAIRS ? 2 : 3;
        ui.steps.forEach((s, i) => {
            const n = i + 1;
            const finished = n < step || (n === 3 && aligned);
            s.textContent = finished ? "✓" : String(n);
            s.classList.toggle("pp-done", finished);
            s.classList.toggle("pp-current", n === step && !finished);
        });
        ui.comboBtn.classList.toggle("pp-next", step === 1);
        // Picking also takes step 1: the first source point chooses the cloud
        ui.pickBtn.classList.toggle("pp-next", step <= 2);
        ui.alignBtn.classList.toggle("pp-primary", step === 3 && !aligned && !ui.alignBtn.disabled);
    }

    function renderStatus() {
        const ui = state.ui;
        if (!ui) return;
        const pc = state.moving;
        const box = ui.status;
        box.className = "pp-status";
        box.replaceChildren();
        box.hidden = false;
        ui.dragHint.hidden = true;

        if (!state.picking) {
            if (!canPick() && viewer.scene.pointclouds.length) {
                box.classList.add("pp-warn");
                box.textContent = pc ? "There is no other point cloud to align it to."
                    : "Aligning needs a second point cloud to align to.";
            } else {
                box.hidden = true;
                ui.dragHint.hidden = !state.pairs.length;
            }
            return;
        }

        const n = (state.pending ? state.pairs.indexOf(state.pending) : state.pairs.length) + 1;
        const problem =
            state.picking === "source" && pc && !pc.visible ? `${cloudLabel(pc)} is hidden. Show it to pick on it.` :
            !candidates(state.picking).length ? "No point cloud is visible to pick on." :
            state.flash;

        if (problem) box.classList.add("pp-warn");
        if (state.picking === "target") {
            box.append(`Pair ${n}: click the matching `, el("span", "pp-tgt-text", "target point"), " on another cloud.");
        } else if (pc) {
            box.append(`Pair ${n}: click the `, el("span", "pp-src-text", "source point"), " on ",
                el("b", null, cloudLabel(pc)), ".");
        } else {
            box.append(`Pair ${n}: click the `, el("span", "pp-src-text", "source point"), " on the cloud to move.");
        }
        box.append(el("small", null, problem || (pc
            ? "Drag to look around. Right-click or Esc to stop."
            : "The cloud you click becomes the one to move. Right-click or Esc to stop.")));
    }

    function renderList() {
        const ui = state.ui;
        if (!ui) return;
        const done = state.pairs.filter(p => p.target).length;

        ui.count.textContent = done >= MIN_PAIRS ? `${done} pairs` : `${done} of ${MIN_PAIRS} needed`;
        ui.count.classList.toggle("pp-ok", done >= MIN_PAIRS);
        ui.empty.hidden = state.pairs.length > 0;
        ui.cols.hidden = state.pairs.length === 0;

        state.pairs.forEach((pair, i) => {
            if (!pair.row) pair.row = makeRow(pair);
            const r = pair.row;
            if (ui.pairList.children[i] !== r.el) ui.pairList.insertBefore(r.el, ui.pairList.children[i] || null);

            r.num.textContent = pair.badge.textContent = String(i + 1);
            r.tgtDot.classList.toggle("pp-hollow", !pair.target);
            r.pending.hidden = !!pair.target;
            r.gap.hidden = r.err.hidden = !pair.target;

            const lines = [`Source: ${fmtPoint(worldOf(pair.source))} (${cloudLabel(pair.source.pc)})`];
            if (pair.target) {
                lines.push(`Target: ${fmtPoint(worldOf(pair.target))} (${cloudLabel(pair.target.pc)})`);
                r.gap.textContent = pair.gap != null ? fmtNum(pair.gap) : "";
                r.err.textContent = pair.error != null ? fmtNum(pair.error) : "—";
                r.err.classList.toggle("pp-muted", pair.error == null);
            }
            r.el.title = lines.join("\n");
            r.el.classList.toggle("pp-hot", pair === state.hoverPair);
        });
    }

    function makeRow(pair) {
        const row = el("div", "pp-row");
        const num = el("span", "pp-num");
        const dir = el("span", "pp-dir");
        const tgtDot = el("i", "pp-dot pp-tgt");
        dir.append(el("i", "pp-dot pp-src"), el("i", "pp-shaft"), tgtDot);
        const gap = el("span", "pp-val");
        const err = el("span", "pp-val");
        const pending = el("span", "pp-pending", "picking the target…");
        const del = el("button", "pp-del", "×");
        del.type = "button";
        del.title = "Remove this pair";
        del.addEventListener("click", () => {
            removePair(pair);
            render();
        });
        row.append(num, dir, gap, err, pending, del);
        row.addEventListener("mouseenter", () => setHover(pair));
        row.addEventListener("mouseleave", () => setHover(null));
        return { el: row, num, tgtDot, gap, err, pending };
    }

    function renderFit() {
        const ui = state.ui;
        if (!ui) return;
        const fit = state.fit;
        const done = fit ? fit.count : 0;

        ui.fit.replaceChildren();
        if (!fit || !fit.M) {
            ui.fit.append(el("div", "pp-fit-empty", done < MIN_PAIRS
                ? `Pick at least ${MIN_PAIRS} pairs to see how well they fit.`
                : "No fit for these pairs."));
        } else {
            const add =(term, value, note) => {
                const dd = el("dd", null, value);
                if (note) dd.append(" ", el("small", null, note));
                ui.fit.append(el("dt", null, term), dd);
            };
            add("RMS error", fmtLen(fit.rms));
            add("Largest error", fmtLen(fit.max), `pair ${state.pairs.indexOf(fit.maxPair) + 1}`);
            add("Moves points by", fmtLen(fit.shift));
            add("Rotates by", `${fit.angle.toFixed(2)}°`);
        }

        const note = fit && fit.blocked ? ["pp-error", fit.blocked]
            : state.aligned && state.aligned.kind === "done" ? ["pp-done",
                `Aligned ${state.aligned.label}: moved ${fmtLen(state.aligned.shift)} and turned ` +
                `${state.aligned.angle.toFixed(2)}°, with an RMS error of ${fmtLen(state.aligned.rms)}.`]
            : state.aligned && state.aligned.kind === "undone" ? ["pp-done", `Undid the last alignment of ${state.aligned.label}.`]
            : fit && fit.warning ? ["pp-warn", fit.warning]
            : null;
        ui.note.hidden = !note;
        if (note) {
            ui.note.className = `pp-note ${note[0]}`;
            ui.note.textContent = note[1];
        }

        ui.alignBtn.disabled = !state.moving || !fit || !fit.M || !!fit.blocked || state.picking === "target";
        ui.undoBtn.disabled = !state.undo.length;
        ui.clearBtn.disabled = !state.pairs.length;
        renderSteps();
    }

    function openPointPairAlignPanel(cloud) {
        if (state.panel) {
            if (cloud && !state.moving) setMoving(cloud);
            return;
        }

        // Never open beside the transform panel (transform_controls.js): this replaces it, and
        // panel_window_manager.js puts this window where it was
        if (typeof window.closeTransformWindow === "function") window.closeTransformWindow();

        const panel = document.createElement("div");
        panel.id = PANEL_ID;
        panel.className = "transform-panel";
        panel.innerHTML = `
        <div class="transform-header">
            <span class="transform-title">Align by Point Pairs</span>
            ${typeof window.openTransformPanel === "function" ? `
            <button type="button" class="transform-align-btn pp-transform-btn"
                title="Switch to Transform Point Cloud: move, rotate and scale a point cloud by hand">
                <span class="transform-align-icon">⇄</span>Transform Point Cloud
            </button>` : ""}
            <span class="transform-close">&times;</span>
        </div>

        <div class="transform-section">
            <div class="transform-subtitle pp-step-title"><span class="pp-step">1</span>Point cloud to move</div>
            <div class="pp-combo">
                <button type="button" class="pp-combo-btn" aria-haspopup="listbox" aria-expanded="false">
                    <span class="pp-combo-value"></span>
                    <span class="pp-caret">▾</span>
                </button>
                <div class="pp-combo-menu" hidden>
                    <input class="transform-search pp-combo-search" type="text"
                        placeholder="Search point clouds..." autocomplete="off" spellcheck="false">
                    <div class="pp-combo-list" role="listbox"></div>
                </div>
            </div>
            <div class="pp-hint pp-choose-hint" hidden>
                Or press <b>Pick Pairs</b> and click a point: the cloud it is on becomes the one to move.
            </div>
            <div class="pp-hint">
                Each pair is a <span class="pp-src-text">source</span> point on this cloud and the matching
                <span class="pp-tgt-text">target</span> point on another cloud. Align moves this cloud so the
                sources land on their targets.
            </div>
        </div>

        <div class="transform-section">
            <div class="pp-head">
                <div class="transform-subtitle pp-step-title"><span class="pp-step">2</span>Point pairs</div>
                <span class="pp-count"></span>
            </div>
            <div class="pp-cols"><span>#</span><span></span><span>Distance</span><span>Error</span><span></span></div>
            <div class="pp-list"></div>
            <div class="pp-empty">No pairs yet. Align needs at least ${MIN_PAIRS}.</div>
            <button type="button" class="transform-toggle-btn pp-pick-btn"></button>
            <div class="pp-status" hidden></div>
            <div class="pp-hint pp-drag-hint" hidden>Drag a marker in the view to adjust its point.</div>
        </div>

        <div class="transform-section">
            <div class="transform-subtitle pp-step-title"><span class="pp-step">3</span>Fit and align</div>
            <dl class="pp-fit"></dl>
            <div class="pp-note" hidden></div>
            <div class="transform-actions">
                <button type="button" class="transform-button pp-align-btn">Align</button>
                <button type="button" class="transform-button pp-undo-btn">Undo</button>
                <button type="button" class="transform-button pp-clear-btn">Clear</button>
            </div>
        </div>
        `;

        const q = sel => panel.querySelector(sel);
        const ui = state.ui = {
            combo: q(".pp-combo"),
            comboBtn: q(".pp-combo-btn"),
            comboValue: q(".pp-combo-value"),
            chooseHint: q(".pp-choose-hint"),
            menu: q(".pp-combo-menu"),
            search: q(".pp-combo-search"),
            cloudList: q(".pp-combo-list"),
            count: q(".pp-count"),
            cols: q(".pp-cols"),
            pairList: q(".pp-list"),
            empty: q(".pp-empty"),
            pickBtn: q(".pp-pick-btn"),
            status: q(".pp-status"),
            dragHint: q(".pp-drag-hint"),
            fit: q(".pp-fit"),
            note: q(".pp-note"),
            alignBtn: q(".pp-align-btn"),
            undoBtn: q(".pp-undo-btn"),
            clearBtn: q(".pp-clear-btn"),
            steps: [...panel.querySelectorAll(".pp-step")],
        };

        ui.comboBtn.addEventListener("click", () => (ui.menu.hidden ? openMenu() : closeMenu(true)));
        ui.search.addEventListener("input", () => { state.menuActive = 0; renderMenu(); });
        ui.search.addEventListener("keydown", onSearchKey);
        ui.pickBtn.addEventListener("click", () => (state.picking ? stopPicking() : startPicking()));
        ui.alignBtn.addEventListener("click", align);
        ui.undoBtn.addEventListener("click", undoAlign);
        ui.clearBtn.addEventListener("click", () => {
            const n = state.pairs.length;
            if (!confirm(`Remove all ${n} pair${n === 1 ? "" : "s"}?`)) return;
            const picking = state.picking;
            stopPicking();
            clearPairs();
            if (picking) startPicking();
            render();
        });
        q(".transform-close").addEventListener("click", requestClose);
        q(".pp-transform-btn")?.addEventListener("click", switchToTransformPanel);

        // Markers are drawn in their own scene over the point clouds, and registered with Potree's
        // input handler so they can be hovered and dragged
        state.scene = new THREE.Scene();
        state.ghost = makeMarker(SOURCE_COLOR, 0.75);
        state.ghost.visible = false;
        state.scene.add(state.ghost);
        viewer.inputHandler.registerInteractiveScene(state.scene);
        viewer.addEventListener("render.pass.perspective_overlay", onOverlay);
        viewer.addEventListener("cancel_insertions", stopPicking);

        const canvas = viewer.renderer.domElement;
        state.badges = el("div", "pp-badges");
        (canvas.parentElement || document.body).appendChild(state.badges);
        canvas.addEventListener("mousemove", onMouseMove);
        canvas.addEventListener("mouseleave", onMouseLeave);
        canvas.addEventListener("pointerdown", onPointerDown);
        canvas.addEventListener("pointerup", onPointerUp);
        canvas.addEventListener("click", onClick);
        document.addEventListener("keydown", onKeyDown);

        state.panel = panel;
        state.moving = viewer.scene.pointclouds.includes(cloud) ? cloud : null;
        state.fitKey = null;
        document.body.appendChild(panel);
        render();
        panel.classList.add("open");
    }

    // Closing loses the pairs, so ask while some are picked that no Align has used yet
    function requestClose() {
        const n = state.pairs.filter(p => p.target).length;
        if (n && state.aligned?.kind !== "done" &&
            !confirm(`Close Align by Point Pairs? The ${n} pair${n === 1 ? "" : "s"} picked so far will be lost.`)) {
            return false;
        }
        closePointPairAlignPanel();
        return true;
    }

    // Back to the transform panel, which takes this window's place and the cloud it was moving
    function switchToTransformPanel() {
        const pc = state.moving;
        if (requestClose()) window.openTransformPanel(pc);
    }

    function closePointPairAlignPanel() {
        const panel = state.panel;
        if (!panel) return;

        stopPicking();
        closeMenu(false);
        clearPairs();
        clearTimeout(state.flashTimer);

        const canvas = viewer.renderer.domElement;
        canvas.removeEventListener("mousemove", onMouseMove);
        canvas.removeEventListener("mouseleave", onMouseLeave);
        canvas.removeEventListener("pointerdown", onPointerDown);
        canvas.removeEventListener("pointerup", onPointerUp);
        canvas.removeEventListener("click", onClick);
        document.removeEventListener("keydown", onKeyDown);
        viewer.removeEventListener("render.pass.perspective_overlay", onOverlay);
        viewer.removeEventListener("cancel_insertions", stopPicking);
        viewer.inputHandler.unregisterInteractiveScene(state.scene);

        disposeObject(state.ghost);
        if (geo) {
            Object.values(geo).forEach(g => g.dispose());
            geo = null;
        }
        state.badges.remove();
        Object.assign(state, {
            panel: null, ui: null, moving: null, scene: null, ghost: null, badges: null,
            fit: null, fitKey: null, aligned: null, undo: [], flash: null,
            hoverPair: null, hoverHit: null, mouse: null,
        });

        // Let the window manager's frame fade out with the panel
        panel.classList.remove("open");
        setTimeout(() => panel.remove(), 150);
    }

    window.openPointPairAlignPanel = openPointPairAlignPanel;
    window.closePointPairAlignPanel = closePointPairAlignPanel;
    window.requestClosePointPairAlignPanel = requestClose;
})();
