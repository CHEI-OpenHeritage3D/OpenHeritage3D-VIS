/**
 * brush_panel.js
 * 
 * Author: Aviral Agarwal (CHEI / OpenHeritage3D)
 * Lead Developer, Cultural Heritage Engineering Initiative (UC San Diego)
 * 
 * Description:
 *   Adds a Classification Brush panel for modifying individual point
 *   classifications within a Potree viewer. Supports variable brush radius,
 *   classification type selection, pointcloud targeting, and edit
 *   export/import via CSV.
 * 
 *   Uses node-intersection based classification: walks the full octree,
 *   force-loads any unloaded nodes whose bounding boxes intersect the
 *   brush sphere, and classifies all points within the radius regardless
 *   of what's currently rendered.
 * 
 * Usage:
 *   1. Include this file after Potree and viewer initialization.
 *   2. Call openBrushPanel() to toggle the panel.
 * 
 * Dependencies:
 *   - Potree (viewer.scene) — Potree 2.0 format (OctreeGeometryNode)
 *   - Three.js
 *   - Modified potree.js with pick() returning _geometry and _pIndex
 */

// ══════════════════════════════════════════════════════════════
//  Styles
// ══════════════════════════════════════════════════════════════

style.textContent += `

/* ── BRUSH PANEL ─────────────────────────────────────────── */

#brushPanel {
    position: fixed;
    top: 80px;
    right: -420px;
    width: clamp(280px, 28vw, 400px);

    padding: 18px 20px;
    box-sizing: border-box;

    background: rgba(20, 20, 26, 0.55);
    backdrop-filter: blur(12px) saturate(140%);
    -webkit-backdrop-filter: blur(12px) saturate(140%);

    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 14px;
    box-shadow: 0 0 28px rgba(0,0,0,0.55);

    z-index: 10000;
    font-family: 'Segoe UI', system-ui, sans-serif;

    display: flex;
    flex-direction: column;
    gap: 14px;

    transition: right 0.28s ease, opacity 0.25s ease;
    opacity: 0;
}

#brushPanel.open {
    right: 10px;
    opacity: 1;
}

/* ── Header ─────────────────────────────────────────────── */

.brush-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.brush-title {
    font-size: 19px;
    font-weight: 600;
    color: #f2f2f7;
    text-shadow: 0 0 6px rgba(0,0,0,0.6);
}

.brush-close {
    width: 28px;
    height: 28px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: #999;
    cursor: pointer;
    font-size: 20px;
    transition: background 0.15s, color 0.15s;
}
.brush-close:hover {
    background: rgba(220, 38, 38, 0.3);
    color: #f87171;
}

/* ── Section Labels ─────────────────────────────────────── */

.brush-label {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #888;
    margin-bottom: 6px;
}

/* ── Pointcloud Select ──────────────────────────────────── */

.brush-select {
    width: 100%;
    padding: 9px 12px;
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 8px;
    color: #fafafa;
    font-size: 14px;
    font-family: inherit;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
    appearance: none;
    -webkit-appearance: none;

    background-image: url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%23888' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 12px center;
    padding-right: 32px;
}
.brush-select:focus {
    border-color: #6e6bff;
    background-color: rgba(255,255,255,0.12);
    box-shadow: 0 0 0 3px rgba(79,70,229,0.3);
    outline: none;
}
.brush-select option {
    background: #1a1a22;
    color: #fafafa;
}

/* ── Classification Grid ────────────────────────────────── */

.brush-class-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
}

.brush-class-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 8px;
    background: rgba(255,255,255,0.04);
    color: #e0e0e5;
    font-size: 13px;
    font-family: inherit;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
    justify-content: flex-start;
}
.brush-class-btn:hover {
    background: rgba(255,255,255,0.08);
    border-color: rgba(255,255,255,0.2);
}
.brush-class-btn.active {
    background: rgba(79, 70, 229, 0.45);
    border-color: rgba(79, 70, 229, 0.6);
    box-shadow: 0 0 10px rgba(79, 70, 229, 0.3);
    color: #fff;
}

.brush-class-swatch {
    width: 14px;
    height: 14px;
    border-radius: 4px;
    flex-shrink: 0;
    border: 1px solid rgba(255,255,255,0.15);
}

/* ── Radius Slider ──────────────────────────────────────── */

.brush-slider-row {
    display: flex;
    align-items: center;
    gap: 10px;
}

.brush-slider {
    flex: 1;
    -webkit-appearance: none;
    appearance: none;
    height: 6px;
    border-radius: 3px;
    background: rgba(255,255,255,0.12);
    outline: none;
    transition: background 0.15s;
}
.brush-slider::-webkit-slider-thumb {
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
.brush-slider::-webkit-slider-thumb:hover {
    transform: scale(1.15);
    box-shadow: 0 0 14px rgba(79, 70, 229, 0.6);
}
.brush-slider::-moz-range-thumb {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #6e6bff;
    border: 2px solid rgba(255,255,255,0.2);
    cursor: pointer;
}

.brush-slider-value {
    min-width: 48px;
    text-align: right;
    font-size: 14px;
    color: #ccc;
    font-variant-numeric: tabular-nums;
}

/* ── Action Buttons ─────────────────────────────────────── */

.brush-actions {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.brush-action-btn {
    width: 100%;
    padding: 10px 14px;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    color: white;
    transition: background 0.2s, box-shadow 0.2s;
}

.brush-btn-primary {
    background: rgba(79, 70, 229, 0.85);
}
.brush-btn-primary:hover {
    background: rgba(99, 90, 245, 1);
    box-shadow: 0 0 12px rgba(99, 90, 245, 0.45);
}

.brush-btn-success {
    background: rgba(45, 160, 80, 0.85);
}
.brush-btn-success:hover {
    background: rgba(55, 180, 95, 1);
    box-shadow: 0 0 12px rgba(55, 180, 95, 0.45);
}

.brush-btn-warning {
    background: rgba(220, 120, 30, 0.85);
}
.brush-btn-warning:hover {
    background: rgba(240, 140, 40, 1);
    box-shadow: 0 0 12px rgba(240, 140, 40, 0.45);
}

.brush-btn-danger {
    background: rgba(220, 38, 38, 0.6);
}
.brush-btn-danger:hover {
    background: rgba(239, 68, 68, 0.85);
    box-shadow: 0 0 12px rgba(239, 68, 68, 0.4);
}

.brush-action-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}

/* ── Edit Counter ───────────────────────────────────────── */

.brush-edit-count {
    font-size: 13px;
    color: #888;
    text-align: center;
    padding: 4px 0;
}

.brush-edit-count strong {
    color: #c4c0ff;
}

/* ── Stroke Indicator ───────────────────────────────────── */

.brush-stroke-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border-radius: 8px;
    background: rgba(79, 70, 229, 0.15);
    border: 1px solid rgba(79, 70, 229, 0.25);
    font-size: 12px;
    color: #a5a0ff;
    opacity: 0;
    max-height: 0;
    padding: 0 12px;
    overflow: hidden;
    transition: opacity 0.2s, max-height 0.25s, padding 0.25s;
}

.brush-stroke-indicator.active {
    opacity: 1;
    max-height: 40px;
    padding: 6px 12px;
}

.brush-stroke-spinner {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(79, 70, 229, 0.3);
    border-top-color: #a5a0ff;
    border-radius: 50%;
    animation: brush-spin 0.7s linear infinite;
    flex-shrink: 0;
}

@keyframes brush-spin {
    to { transform: rotate(360deg); }
}

/* ── Divider ────────────────────────────────────────────── */

.brush-divider {
    height: 1px;
    background: rgba(255,255,255,0.08);
    margin: 2px 0;
}

/* ── Toggle Switch ──────────────────────────────────────── */

.brush-toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.brush-toggle-label {
    font-size: 14px;
    color: #ccc;
}

.brush-toggle {
    position: relative;
    width: 40px;
    height: 22px;
    cursor: pointer;
}

.brush-toggle input {
    opacity: 0;
    width: 0;
    height: 0;
}

.brush-toggle-track {
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(255,255,255,0.12);
    border-radius: 11px;
    transition: background 0.2s;
}

.brush-toggle input:checked + .brush-toggle-track {
    background: rgba(79, 70, 229, 0.7);
}

.brush-toggle-thumb {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 16px;
    height: 16px;
    background: #fff;
    border-radius: 50%;
    transition: transform 0.2s;
    pointer-events: none;
}

.brush-toggle input:checked ~ .brush-toggle-thumb {
    transform: translateX(18px);
}

.brush-vis-checkbox {
    width: 16px;
    height: 16px;
    cursor: pointer;
    accent-color: #6f6bff;
    flex-shrink: 0;
    margin: 0;
    margin-left: auto;
}

.brush-hotkey {
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
    flex-shrink: 0;
}

/* ── Classification Editor Modal ────────────────────────── */

.brush-editor-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    z-index: 10001;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.2s;
}

.brush-editor-overlay.open {
    opacity: 1;
}

.brush-editor {
    width: clamp(340px, 50vw, 520px);
    max-height: 80vh;
    background: rgba(22, 22, 30, 0.92);
    backdrop-filter: blur(16px) saturate(140%);
    -webkit-backdrop-filter: blur(16px) saturate(140%);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 14px;
    box-shadow: 0 0 40px rgba(0,0,0,0.6);
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    overflow: hidden;
}

.brush-editor-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.brush-editor-title {
    font-size: 17px;
    font-weight: 600;
    color: #f2f2f7;
}

.brush-editor-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    overflow-y: auto;
    max-height: 50vh;
    padding-right: 4px;
}

.brush-editor-list::-webkit-scrollbar {
    width: 5px;
}
.brush-editor-list::-webkit-scrollbar-track {
    background: transparent;
}
.brush-editor-list::-webkit-scrollbar-thumb {
    background: rgba(255,255,255,0.15);
    border-radius: 3px;
}

.brush-editor-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 8px;
    transition: background 0.15s;
}
.brush-editor-row:hover {
    background: rgba(255,255,255,0.07);
}

.brush-editor-value {
    min-width: 32px;
    padding: 4px 6px;
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 5px;
    color: #aaa;
    font-size: 13px;
    font-family: monospace;
    text-align: center;
    flex-shrink: 0;
}

.brush-editor-color {
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    padding: 0;
    background: none;
    flex-shrink: 0;
}
.brush-editor-color::-webkit-color-swatch-wrapper {
    padding: 0;
}
.brush-editor-color::-webkit-color-swatch {
    border: 1px solid rgba(255,255,255,0.2);
    border-radius: 6px;
}
.brush-editor-color::-moz-color-swatch {
    border: 1px solid rgba(255,255,255,0.2);
    border-radius: 6px;
}

.brush-editor-name {
    flex: 1;
    padding: 5px 8px;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 6px;
    color: #eee;
    font-size: 13px;
    font-family: inherit;
    transition: border-color 0.15s;
}
.brush-editor-name:focus {
    border-color: #6e6bff;
    outline: none;
}

.brush-editor-delete {
    width: 24px;
    height: 24px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 5px;
    background: transparent;
    color: #666;
    cursor: pointer;
    font-size: 16px;
    flex-shrink: 0;
    transition: background 0.15s, color 0.15s;
}
.brush-editor-delete:hover {
    background: rgba(220, 38, 38, 0.3);
    color: #f87171;
}

.brush-editor-add-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    background: rgba(79, 70, 229, 0.08);
    border: 1px dashed rgba(79, 70, 229, 0.3);
    border-radius: 8px;
}

.brush-editor-add-value {
    width: 48px;
    padding: 5px 6px;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 6px;
    color: #eee;
    font-size: 13px;
    font-family: monospace;
    text-align: center;
    flex-shrink: 0;
}
.brush-editor-add-value:focus {
    border-color: #6e6bff;
    outline: none;
}

.brush-editor-add-btn {
    width: 28px;
    height: 28px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 6px;
    background: rgba(79, 70, 229, 0.6);
    color: #fff;
    cursor: pointer;
    font-size: 18px;
    flex-shrink: 0;
    transition: background 0.15s, box-shadow 0.15s;
}
.brush-editor-add-btn:hover {
    background: rgba(99, 90, 245, 0.85);
    box-shadow: 0 0 10px rgba(99, 90, 245, 0.4);
}

.brush-editor-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding-top: 4px;
}

`;
// Replace the existing #gridPanel CSS block
style.textContent += `

/* ── GRID PANEL ─────────────────────────────────────────── */

#gridPanel {
    position: fixed;
    top: 80px;
    right: -340px;
    width: clamp(260px, 24vw, 320px);
    padding: 18px 20px;
    box-sizing: border-box;
    background: rgba(20, 20, 26, 0.55);
    backdrop-filter: blur(12px) saturate(140%);
    -webkit-backdrop-filter: blur(12px) saturate(140%);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 14px;
    box-shadow: 0 0 28px rgba(0,0,0,0.55);
    z-index: 10000;
    font-family: 'Segoe UI', system-ui, sans-serif;
    display: flex;
    flex-direction: column;
    gap: 14px;
    transition: right 0.28s ease, opacity 0.25s ease;
    opacity: 0;
}
#gridPanel.open { right: 420px; opacity: 1; }


.brush-slider-value::-webkit-outer-spin-button,
.brush-slider-value::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
}
`;

// ══════════════════════════════════════════════════════════════
//  LAS Classification Types
// ══════════════════════════════════════════════════════════════

const DEFAULT_CLASSIFICATIONS = [
    { value: 0,  name: "Never Classified", color: "#888888" },
    { value: 1,  name: "Unclassified",     color: "#AAAAAA" },
    { value: 2,  name: "Ground",            color: "#9b5129" },
    { value: 3,  name: "Low Vegetation",    color: "#51ff00" },
    { value: 4,  name: "Medium Vegetation", color: "#3fcc00" },
    { value: 5,  name: "High Vegetation",   color: "#2d9900" },
    { value: 6,  name: "Building",          color: "#f8a700" },
    { value: 7,  name: "Low Point (Noise)", color: "#f500ff" },
    { value: 8,  name: "Key-Point",         color: "#f40000" },
    { value: 9,  name: "Water",             color: "#1d0fff" },
    { value: 12, name: "Overlap",           color: "#fefe00" },
];

let CLASSIFICATIONS = DEFAULT_CLASSIFICATIONS.map(c => ({ ...c }));

/**
 * Check whether current CLASSIFICATIONS differ from the defaults.
 */
function classificationsAreCustom() {
    if (CLASSIFICATIONS.length !== DEFAULT_CLASSIFICATIONS.length) return true;
    for (let i = 0; i < CLASSIFICATIONS.length; i++) {
        let a = CLASSIFICATIONS[i], b = DEFAULT_CLASSIFICATIONS[i];
        if (a.value !== b.value || a.name !== b.name || a.color.toLowerCase() !== b.color.toLowerCase()) return true;
    }
    return false;
}

function updateMaterialMenu(value) {
	const materialMenu = $("#potree_toolbar").find("#optMaterial");

	const materialNameMap = {
		rgba: "RGBA",
		classification: "Classification",
		elevation: "Elevation",
		intensity: "Intensity",
		color: "Color",

		// your composite UI options
		rgbaClasses: "RGBA Classes",
		composite: "Intensity Classes"
	};

	const uiValue = materialNameMap[value] || value;

	materialMenu.val(uiValue);

	if (materialMenu.data("ui-selectmenu")) {
		materialMenu.selectmenu("refresh");
	}
}

function updateMaterialMenuOnStart(){
	const visiblePCs = viewer.scene.pointclouds.filter(p => p.visible);

	if (visiblePCs.length === 0) return null;

	const counts = {};

	for (const pc of visiblePCs) {
		const mat = pc.material.activeAttributeName;
		counts[mat] = (counts[mat] || 0) + 1;
	}

	const currentMaterial = Object.keys(counts).reduce((a, b) =>
		counts[a] > counts[b] ? a : b
	);

    updateMaterialMenu(currentMaterial);
}

function switchPCMaterial() {
	const visiblePCs = viewer.scene.pointclouds.filter(p => p.visible);

	if (visiblePCs.length === 0) return null;

	const counts = {};

	for (const pc of visiblePCs) {
		const mat = pc.material.activeAttributeName;
		counts[mat] = (counts[mat] || 0) + 1;
	}

	const currentMaterial = Object.keys(counts).reduce((a, b) =>
		counts[a] > counts[b] ? a : b
	);

    if(currentMaterial === 'rgba'){
        for (const pointcloud of viewer.scene.pointclouds){
            pointcloud.material.activeAttributeName = "composite";
            pointcloud.material.weightRGBA = [1];
            pointcloud.material.weightIntensity = [0];
            pointcloud.material.intensityRange = [16, 65000];
            pointcloud.material.weightClassification = [1];
		}
        updateMaterialMenu("RGBA Classes");
    }
    else if(currentMaterial === 'intensity'){
        for (const pointcloud of viewer.scene.pointclouds){
            pointcloud.material.activeAttributeName = "composite";
            pointcloud.material.weightRGBA = [0];
            pointcloud.material.weightIntensity = [90];
            pointcloud.material.intensityRange = [16, 65000];
            pointcloud.material.weightClassification = [10];
        }
        updateMaterialMenu("Intensity Classes");
    }
}

// ══════════════════════════════════════════════════════════════
//  Color Conversion Helpers
// ══════════════════════════════════════════════════════════════

function hexToRGBA(hex) {
    hex = hex.replace('#', '');
    return [
        parseInt(hex.substring(0, 2), 16) / 255,
        parseInt(hex.substring(2, 4), 16) / 255,
        parseInt(hex.substring(4, 6), 16) / 255,
        1.0
    ];
}

function rgbaToHex(rgba) {
    let r = Math.round(rgba[0] * 255).toString(16).padStart(2, '0');
    let g = Math.round(rgba[1] * 255).toString(16).padStart(2, '0');
    let b = Math.round(rgba[2] * 255).toString(16).padStart(2, '0');
    return '#' + r + g + b;
}


// ══════════════════════════════════════════════════════════════
//  Classification ↔ Viewer Sync
// ══════════════════════════════════════════════════════════════

/**
 * Push CLASSIFICATIONS into viewer.setClassifications().
 * Preserves current visibility state for existing classes.
 */
function syncClassificationsToViewer() {
    let classObj = {};
    for (let cls of CLASSIFICATIONS) {
        classObj[cls.value] = {
            visible: viewer.classifications[cls.value]?.visible !== false,
            name: cls.name.toLowerCase(),
            color: hexToRGBA(cls.color)
        };
    }
    classObj['DEFAULT'] = { visible: true, name: 'default', color: [0.3, 0.6, 0.6, 0.5] };
    viewer.setClassifications(classObj);
}

/**
 * Rebuild the classification button grid in the brush panel.
 */
function rebuildClassificationGridUI() {
    const grid = document.getElementById("brushClassGrid");
    if (!grid) return;

    grid.innerHTML = '';

    for (let cls of CLASSIFICATIONS) {
        const btn = document.createElement("button");
        btn.className = "brush-class-btn" + (cls.value === window.brushState.classification ? " active" : "");
        btn.dataset.value = cls.value;

        const visChk = document.createElement("input");
        visChk.type = "checkbox";
        visChk.className = "brush-vis-checkbox";
        visChk.checked = viewer.classifications[cls.value]?.visible !== false;
        visChk.addEventListener("click", (e) => { e.stopPropagation(); });
        visChk.addEventListener("change", () => {
            viewer.setClassificationVisibility(cls.value, visChk.checked);
        });

        const swatch = document.createElement("span");
        swatch.className = "brush-class-swatch";
        swatch.style.background = cls.color;
        btn.appendChild(swatch);

        const label = document.createElement("span");
        label.textContent = cls.name;
        btn.appendChild(label);

        btn.appendChild(visChk);

        btn.addEventListener("click", () => {
            grid.querySelectorAll(".brush-class-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            window.brushState.classification = cls.value;
        });

        grid.appendChild(btn);
    }

    // Reset selection if it was removed
    if (!CLASSIFICATIONS.find(c => c.value === window.brushState.classification)) {
        window.brushState.classification = CLASSIFICATIONS[0]?.value ?? 0;
        const first = grid.querySelector(".brush-class-btn");
        if (first) first.classList.add("active");
    }
}


// ══════════════════════════════════════════════════════════════
//  Classification Editor Modal
// ══════════════════════════════════════════════════════════════

function openClassificationEditor() {
    if (document.getElementById("brushEditorOverlay")) return;

    const overlay = document.createElement("div");
    overlay.className = "brush-editor-overlay";
    overlay.id = "brushEditorOverlay";

    const editor = document.createElement("div");
    editor.className = "brush-editor";

    // ── Header ──
    const header = document.createElement("div");
    header.className = "brush-editor-header";

    const title = document.createElement("span");
    title.className = "brush-editor-title";
    title.textContent = "Edit Classifications";
    header.appendChild(title);

    const closeBtn = document.createElement("button");
    closeBtn.className = "brush-close";
    closeBtn.textContent = "×";
    closeBtn.addEventListener("click", () => closeEditor());
    header.appendChild(closeBtn);
    editor.appendChild(header);

    // ── Scrollable List ──
    const list = document.createElement("div");
    list.className = "brush-editor-list";

    // Working copy so Cancel discards changes
    let working = CLASSIFICATIONS.map(c => ({ ...c }));

    function renderRows() {
        list.innerHTML = '';
        for (let idx = 0; idx < working.length; idx++) {
            const cls = working[idx];
            const row = document.createElement("div");
            row.className = "brush-editor-row";

            const valueBadge = document.createElement("span");
            valueBadge.className = "brush-editor-value";
            valueBadge.textContent = cls.value;
            row.appendChild(valueBadge);

            const colorInput = document.createElement("input");
            colorInput.type = "color";
            colorInput.className = "brush-editor-color";
            colorInput.value = cls.color;
            colorInput.addEventListener("input", () => { working[idx].color = colorInput.value; });
            row.appendChild(colorInput);

            const nameInput = document.createElement("input");
            nameInput.type = "text";
            nameInput.className = "brush-editor-name";
            nameInput.value = cls.name;
            nameInput.placeholder = "Classification name";
            nameInput.addEventListener("input", () => { working[idx].name = nameInput.value; });
            row.appendChild(nameInput);

            const deleteBtn = document.createElement("button");
            deleteBtn.className = "brush-editor-delete";
            deleteBtn.textContent = "×";
            deleteBtn.title = "Remove classification";
            deleteBtn.addEventListener("click", () => {
                working.splice(idx, 1);
                renderRows();
            });
            if(idx != 0 && idx != 1) row.appendChild(deleteBtn);

            list.appendChild(row);
        }
    }

    renderRows();
    editor.appendChild(list);

    // ── Add New Row ──
    const addRow = document.createElement("div");
    addRow.className = "brush-editor-add-row";

    const addValueInput = document.createElement("input");
    addValueInput.type = "number";
    addValueInput.className = "brush-editor-add-value";
    addValueInput.placeholder = "#";
    addValueInput.min = "0";
    addValueInput.max = "255";
    addRow.appendChild(addValueInput);

    const addColorInput = document.createElement("input");
    addColorInput.type = "color";
    addColorInput.className = "brush-editor-color";
    addColorInput.value = "#66aaff";
    addRow.appendChild(addColorInput);

    const addNameInput = document.createElement("input");
    addNameInput.type = "text";
    addNameInput.className = "brush-editor-name";
    addNameInput.placeholder = "New classification name";
    addRow.appendChild(addNameInput);

    const addBtn = document.createElement("button");
    addBtn.className = "brush-editor-add-btn";
    addBtn.textContent = "+";
    addBtn.title = "Add classification";
    addBtn.addEventListener("click", () => {
        let val = parseInt(addValueInput.value);
        if (isNaN(val) || val < 0 || val > 255) return;
        if (working.find(c => c.value === val)) {
            addValueInput.style.borderColor = '#f87171';
            setTimeout(() => { addValueInput.style.borderColor = ''; }, 1000);
            return;
        }
        working.push({
            value: val,
            name: addNameInput.value.trim() || `Class ${val}`,
            color: addColorInput.value
        });
        working.sort((a, b) => a.value - b.value);
        addValueInput.value = '';
        addNameInput.value = '';
        renderRows();
    });
    addRow.appendChild(addBtn);
    editor.appendChild(addRow);

    // ── Footer ──
    const footer = document.createElement("div");
    footer.className = "brush-editor-footer";

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "brush-action-btn brush-btn-danger";
    cancelBtn.style.cssText = "width:auto; padding:8px 20px;";
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", () => closeEditor());
    footer.appendChild(cancelBtn);

    const saveBtn = document.createElement("button");
    saveBtn.className = "brush-action-btn brush-btn-success";
    saveBtn.style.cssText = "width:auto; padding:8px 20px;";
    saveBtn.textContent = "Save";
    saveBtn.addEventListener("click", () => {
        // Ensure no empty names
        for (let cls of working) {
            if (!cls.name.trim()) cls.name = `Class ${cls.value}`;
        }
        CLASSIFICATIONS = working;
        syncClassificationsToViewer();
        rebuildClassificationGridUI();
        closeEditor();
    });
    footer.appendChild(saveBtn);
    editor.appendChild(footer);

    // ── Mount ──
    overlay.appendChild(editor);
    overlay.addEventListener("click", (e) => {
        if (e.target === overlay) closeEditor();
    });
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("open"));

    function closeEditor() {
        overlay.classList.remove("open");
        setTimeout(() => overlay.remove(), 200);
    }
}


// ══════════════════════════════════════════════════════════════
//  Edit Ledger
// ══════════════════════════════════════════════════════════════

const brushEdits = new Map();

function recordEdit(pcName, nodeName, pIndex, classification, position, original) {
    if (!brushEdits.has(pcName)) brushEdits.set(pcName, new Map());
    let pcEdits = brushEdits.get(pcName);
    if (!pcEdits.has(nodeName)) pcEdits.set(nodeName, new Map());

    const nodeEdits = pcEdits.get(nodeName);
    // Preserve original from the first time this point was edited
    const existing = nodeEdits.get(pIndex);
    const origClass = existing ? existing.original : original;

    nodeEdits.set(pIndex, {
        classification,
        original: origClass,
        x: position.x,
        y: position.y,
        z: position.z
    });
    updateEditCount();
}

function getTotalEditCount() {
    let count = 0;
    for (let [, pcEdits] of brushEdits) {
        for (let [, nodeEdits] of pcEdits) {
            count += nodeEdits.size;
        }
    }
    return count;
}

function updateEditCount() {
    const el = document.getElementById("brushEditCount");
    if (el) {
        const count = getTotalEditCount();
        el.innerHTML = count > 0
            ? `<strong>${count.toLocaleString()}</strong> point${count !== 1 ? "s" : ""} modified`
            : "No edits yet";
    }
}

function clearAllEdits() {
    for (let pointcloud of viewer.scene.pointclouds) {
        let pcEdits = brushEdits.get(pointcloud.name);
        if (!pcEdits) continue;

        for (let node of pointcloud.visibleNodes) {
            let nodeEdits = pcEdits.get(node.geometryNode.name);
            if (!nodeEdits) continue;

            let classAttr = node.geometryNode.geometry.attributes["classification"];
            if (!classAttr) continue;

            for (let [pIndex, edit] of nodeEdits) {
                classAttr.array[pIndex] = edit.original;
            }
            classAttr.needsUpdate = true;
        }
    }
    
    brushEdits.clear();
    updateEditCount();

}

// ══════════════════════════════════════════════════════════════
//  Export Metadata
// ══════════════════════════════════════════════════════════════

/**
 * Returns the tile index for the currently loaded selection.
 * Default: name of the first BoxVolume in the scene (what a
 * contributor's deep link loads). Override as needed.
 */
function getTileIndexes() {
    const tileList = [];

    for (const vol of viewer.scene.volumes) {
        if (vol.name.includes("tile")) {
            const [, letter, number] = vol.name.split("_"); // "tile_A_1" → ["tile", "A", "1"]
            tileList.push(`${letter}${number}`);            // → "A1"
        }
    }

    return tileList.join("_"); // → "A1_B2_C3"
}

function getContributorName() {
    const el = document.getElementById("brushContributor");
    return el ? el.value.trim() : "";
}

function setContributorName(name) {
    const el = document.getElementById("brushContributor");
    el.value = name || "";
}


// ══════════════════════════════════════════════════════════════
//  CSV Export / Import
// ══════════════════════════════════════════════════════════════

function exportEditsToCSV() {
    // if (getTotalEditCount() === 0) return;   

    let lines = [];
    let filename = "";

    // ── Metadata block ──
    const visiblePCs = viewer.scene.pointclouds.filter(p => p.visible);
    const source     = visiblePCs.map(p => p.name).join("; ") || "unknown";

    lines.push("#METADATA");
    lines.push(`contributor,${getContributorName()}`);
    lines.push(`doi,${window.doi || ""}`);
    lines.push(`source,${source}`);
    lines.push(`citation,${(window.projectCitation || "").replace(/[\r\n,]+/g, " ")}`);
    lines.push(`generated,${new Date().toISOString()}`);
    lines.push(`tile,${getTileIndexes()}`);
    lines.push(`total_points,${getTotalEditCount()}`);
    lines.push("#END_METADATA");

    // Classification definitions if customized
    if (classificationsAreCustom()) {
        lines.push("#CLASSIFICATIONS");
        for (let cls of CLASSIFICATIONS) {
            lines.push(`${cls.value},${cls.name},${cls.color}`);
        }
        lines.push("#END_CLASSIFICATIONS");
    }

    for (let [pcName, pcEdits] of brushEdits) {
        lines.push(`[${pcName}]`);
        filename += pcName + "_";
        for (let [nodeName, nodeEdits] of pcEdits) {
            lines.push(`{${nodeName}}`);
            lines.push("pIndex,classification,x,y,z");
            for (let [pIndex, edit] of nodeEdits) {
                lines.push(`${pIndex},${edit.classification},${edit.x},${edit.y},${edit.z}`);
            }
        }
    }

    // Include contributor in filename if present
    const who = getContributorName().replace(/[^\w\-]/g, "_");
    const tile = (getTileIndexes() || "").replace(/[^\w\-]/g, "_");
    filename = [filename + getTotalEditCount() + "_edits", tile, who].filter(Boolean).join("_") + ".csv";

    const csv  = lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function importEditsFromCSV(filePath) {
    if (filePath) {
        // Fetch from URL
        fetch(filePath)
            .then(r => r.text())
            .then(text => parseEditsCSV(text))
            .catch(e => console.error("Failed to load edits CSV:", e));
        return;
    }

    // File picker fallback
    let input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv";
    input.addEventListener("change", (e) => {
        let file = e.target.files[0];
        if (!file) return;

        let reader = new FileReader();
        reader.onload = function (evt) {
            parseEditsCSV(evt.target.result);
        };
        reader.readAsText(file);
    });
    input.click();
}

function parseEditsCSV(text) {
    let lines = text.split("\n");
    let currentPC = null;
    let currentNode = null;
    let parsingClassifications = false;
    let importedClassifications = [];

    let parsingMetadata = false;

    for (let line of lines) {
        line = line.trim();
        if (!line) continue;

        // ── Metadata block (informational, skip) ──
        if (line === "#METADATA")     { parsingMetadata = true;  continue; }
        if (line === "#END_METADATA") { parsingMetadata = false; continue; }

        if (parsingMetadata) {
            const commaIdx = line.indexOf(",");
            if (commaIdx !== -1) {
                const key = line.substring(0, commaIdx).trim();
                const value = line.substring(commaIdx + 1).trim();
                if (key === "contributor") setContributorName(value);
            }
            continue;
        }
        if (parsingMetadata) continue;

        // ── Classification definition block ──
        if (line === "#CLASSIFICATIONS") {
            parsingClassifications = true;
            importedClassifications = [];
            continue;
        }
        if (line === "#END_CLASSIFICATIONS") {
            parsingClassifications = false;
            continue;
        }
        if (parsingClassifications) {
            // Format: value,name,color
            let commaIdx = line.indexOf(",");
            let lastCommaIdx = line.lastIndexOf(",");
            if (commaIdx === -1 || commaIdx === lastCommaIdx) continue;

            let value = parseInt(line.substring(0, commaIdx));
            let color = line.substring(lastCommaIdx + 1);
            let name = line.substring(commaIdx + 1, lastCommaIdx);

            if (!isNaN(value) && name && color) {
                importedClassifications.push({ value, name, color });
            }
            continue;
        }

        // ── Edit data ──
        if (line.startsWith("[") && line.endsWith("]")) {
            currentPC = line.slice(1, -1);
        } else if (line.startsWith("{") && line.endsWith("}")) {
            currentNode = line.slice(1, -1);
        } else if (line.startsWith("pIndex,")) {
            continue;
        } else {
            if (!currentPC || !currentNode) continue;
            let [pIndex, classification, x, y, z] = line.split(",");
            let pi = parseInt(pIndex), cl = parseInt(classification);
            let px = parseFloat(x), py = parseFloat(y), pz = parseFloat(z);
            if (isNaN(pi) || isNaN(cl)) continue;
            recordEdit(
                currentPC, currentNode,
                pi, cl,
                { x: px, y: py, z: pz }
            );
        }
    }

    // Apply imported classifications if present
    if (importedClassifications.length > 0) {
        CLASSIFICATIONS = importedClassifications;
        syncClassificationsToViewer();
        rebuildClassificationGridUI();
    }

    applyEditsToLoadedNodes();
}

function applyEditsToLoadedNodes() {
    for (let pointcloud of viewer.scene.pointclouds) {
        let pcEdits = brushEdits.get(pointcloud.name);
        if (!pcEdits) continue;

        for (let node of pointcloud.visibleNodes) {
            let nodeEdits = pcEdits.get(node.geometryNode.name);
            if (!nodeEdits) continue;

            let classAttr = node.geometryNode.geometry.attributes["classification"];
            if (!classAttr) continue;

            for (let [pIndex, edit] of nodeEdits) {
                classAttr.array[pIndex] = edit.classification;
            }
            classAttr.needsUpdate = true;
        }
    }
}


// ══════════════════════════════════════════════════════════════
//  Brush State
// ══════════════════════════════════════════════════════════════

window.brushState = {
    active: false,
    classification: 2,
    radius: 5.0,
    targetPointcloud: null,
    sphere: null,
    painting: false,
    strokeInProgress: false
};


// ══════════════════════════════════════════════════════════════
//  Node Loading
// ══════════════════════════════════════════════════════════════

function waitForLoad(node) {
    return new Promise((resolve) => {
        if (node.loaded) {
            resolve(node);
            return;
        }

        let _loaded = node.loaded;
        let _loading = node.loading;

        Object.defineProperty(node, 'loaded', {
            get() { return _loaded; },
            set(val) {
                _loaded = val;
                if (val === true) resolve(node);
            },
            configurable: true,
            enumerable: true
        });

        Object.defineProperty(node, 'loading', {
            get() { return _loading; },
            set(val) { _loading = val; },
            configurable: true,
            enumerable: true
        });

        if (!node.loading) {
            node.load();
        }

        if (!node.loading && !node.loaded) {
            let retryInterval = setInterval(() => {
                if (node.loaded) { clearInterval(retryInterval); return; }
                if (!node.loading) node.load();
                if (node.loading || node.loaded) clearInterval(retryInterval);
            }, 50);
        }
    });
}


// ══════════════════════════════════════════════════════════════
//  Core Brush Logic — Node-Intersection Based
// ══════════════════════════════════════════════════════════════

async function classifyInRadius(pointcloud, centerWorld, radius, classification) {
    let radiusSq = radius * radius;

    async function processNode(geoNode) {
        if (!geoNode) return;

        let boxWorld = geoNode.boundingBox.clone().applyMatrix4(pointcloud.matrixWorld);
        if (boxWorld.distanceToPoint(centerWorld) > radius) return;

        if (!geoNode.loaded) {
            await waitForLoad(geoNode);
        }

        if (geoNode.geometry) {
            let nodeMatrix = new THREE.Matrix4().makeTranslation(...geoNode.boundingBox.min.toArray());
            let matrixWorld = new THREE.Matrix4().multiplyMatrices(pointcloud.matrixWorld, nodeMatrix);
            let inverseMatrix = new THREE.Matrix4().copy(matrixWorld).invert();
            let localCenter = centerWorld.clone().applyMatrix4(inverseMatrix);

            let positions = geoNode.geometry.attributes.position;
            let classAttr = geoNode.geometry.attributes['classification'];
            if (!classAttr) return;

            let arr = positions.array;
            let cx = localCenter.x, cy = localCenter.y, cz = localCenter.z;

            for (let i = 0; i < positions.count; i++) {
                let dx = arr[3 * i]     - cx;
                let dy = arr[3 * i + 1] - cy;
                let dz = arr[3 * i + 2] - cz;
                if (dx * dx + dy * dy + dz * dz <= radiusSq) {
                    if (classAttr.array[i] !== classification && viewer.classifications[classAttr.array[i]]?.visible) { // if same or not visible
                        const existingEdit = brushEdits.get(pointcloud.name)?.get(geoNode.name)?.get(i);
                        if (existingEdit?.classification === classification) continue;  // if already in ledger with same class

                        const currentClass = classAttr.array[i];
                        const originalClass = existingEdit ? existingEdit.original : currentClass;

                        classAttr.array[i] = classification;

                        if (classification === originalClass) {
                            // Reverted to original — drop from ledger
                            brushEdits.get(pointcloud.name).get(geoNode.name).delete(i);
                            const nodeMap = brushEdits.get(pointcloud.name).get(geoNode.name);
                            nodeMap.delete(i);
                            if (nodeMap.size === 0) brushEdits.get(pointcloud.name).delete(geoNode.name);
                            if (brushEdits.get(pointcloud.name).size === 0) brushEdits.delete(pointcloud.name);
                            updateEditCount();
                        } else {
                            let pos = new THREE.Vector3(arr[3 * i], arr[3 * i + 1], arr[3 * i + 2]);
                            pos.applyMatrix4(matrixWorld);
                            recordEdit(pointcloud.name, geoNode.name, i, classification, pos, originalClass);
                        }
                    }
                }
            }
            classAttr.needsUpdate = true;
        }

        let childPromises = [];
        for (let i = 0; i < 8; i++) {
            if (geoNode.children[i]) {
                childPromises.push(processNode(geoNode.children[i]));
            }
        }
        if (childPromises.length > 0) {
            await Promise.all(childPromises);
        }
    }

    await processNode(pointcloud.pcoGeometry.root);
}

function setStrokeIndicator(active) {
    const el = document.getElementById("brushStrokeIndicator");
    if (el) {
        if (active) el.classList.add("active");
        else el.classList.remove("active");
    }
}

async function paintAtPoint(pointcloud, hit) {
    if (brushState.strokeInProgress) return;
    brushState.strokeInProgress = true;
    setStrokeIndicator(true);

    try {
        await classifyInRadius(
            pointcloud, hit.position,
            window.brushState.radius,
            window.brushState.classification
        );
    } catch (e) {
        console.error("Brush stroke error:", e);
    } finally {
        brushState.strokeInProgress = false;
        setStrokeIndicator(false);
    }
}

function buildClassificationGrid(volume){

    const visiblePCs = viewer.scene.pointclouds.filter(p => p.visible);
    if (visiblePCs.length === 0) {
        setStatus("No visible point clouds.", "error");
        return;
    }

    const maxDepth = getMaxDepthFromScene();
    // Estimate total points and pick a grid (caller can override).
    const totalNodesAll = visiblePCs.reduce((acc, pc) => acc + countIntersectingNodes(pc, volume.boundingBox, maxDepth), 0);


    const targetPointsPerTile  = 5_000_000;
    const estimatedPoints = totalNodesAll * 5_000;


    const { tilesX, tilesY, tilesZ } = pickTileGrid(volume, estimatedPoints, targetPointsPerTile );

    console.log({ tilesX, tilesY, tilesZ } );
}

// ══════════════════════════════════════════════════════════════
//  Grid Panel
// ══════════════════════════════════════════════════════════════

let _gridSubVolumes = [];

function openGridPanel() {
    let existing = document.getElementById("gridPanel");

    if (existing) {
        window.brushState.active = true;
        brushState.sphere.visible = true;
        const toggle = document.querySelector('#brushPanel .brush-toggle input');
        if (toggle) toggle.checked = window.brushState.active;
        existing.classList.remove("open");
        setTimeout(() => existing.remove(), 300);
        return;
    }
    
    window.brushState.active = false;
    brushState.sphere.visible = false;
    const toggle = document.querySelector('#brushPanel .brush-toggle input');
    if (toggle) toggle.checked = window.brushState.active;

    const panel = document.createElement("div");
    panel.id = "gridPanel";
    document.body.appendChild(panel);
    requestAnimationFrame(() => panel.classList.add("open"));

    panel.innerHTML = `
            <div class="brush-header">
                <span class="brush-title">Work Distribution</span>
                <button class="brush-close" id="grid-close-btn">×</button>
            </div>

            <button id="grid-volume-btn" class="brush-action-btn brush-btn-primary">
                Create Volume
            </button>

            <div>
                <div class="brush-label" style="margin-bottom:6px;">
                    Grid Size &nbsp;
                    <span id="grid-size-label" style="color:#c4c0ff; font-weight:700;">2 × 2 = 4 tiles</span>
                </div>
                <div class="brush-slider-row">
                    <input id="grid-slider" class="brush-slider" type="range" min="1" max="8" value="2" step="1">
                    <span class="brush-slider-value" id="grid-n-label">2</span>
                </div>
            </div>

            <button id="grid-generate-btn" class="brush-action-btn brush-btn-success">
                Generate Grid
            </button>

            <button id="grid-clear-btn" class="brush-action-btn brush-btn-danger">
                Clear Volumes
            </button>

            <button id="grid-share-btn" class="brush-action-btn brush-btn-primary">
                Share Tile Links…
            </button>
        `;

    document.getElementById("grid-close-btn").addEventListener("click", () => {
        panel.classList.remove("open");
        window.brushState.active = true;
        brushState.sphere.visible = true;
        const toggle = document.querySelector('#brushPanel .brush-toggle input');
        if (toggle) toggle.checked = window.brushState.active;

        setTimeout(() => panel.remove(), 300);
    });

    const slider = document.getElementById("grid-slider");
    const sizeLabel = document.getElementById("grid-size-label");
    const nLabel = document.getElementById("grid-n-label");

    slider.addEventListener("input", () => {
        const n = parseInt(slider.value);
        nLabel.textContent = n;
        sizeLabel.textContent = `${n} × ${n} = ${n * n} tiles`;
    });

    document.getElementById("grid-volume-btn").addEventListener("click", () => {
        viewer.setClipTask(1);
        viewer.volumeTool.startInsertion({ clip: true });
    });

    document.getElementById("grid-clear-btn").addEventListener("click", () => {
        for (const sub of _gridSubVolumes) viewer.scene.removeVolume(sub);
        _gridSubVolumes = [];

        for (const lbl of _gridLabels) viewer.scene.scene.remove(lbl);
        _gridLabels = [];

        const master = viewer.scene.volumes.find(
            v => v instanceof Potree.BoxVolume && !v._isGridSub
        );
        if (master) viewer.scene.removeVolume(master);
    });

    document.getElementById("grid-generate-btn").addEventListener("click", () => {
        const n = parseInt(slider.value);
        for (const lbl of _gridLabels) viewer.scene.scene.remove(lbl);
        _gridLabels = [];
        // Pick the first user-created BoxVolume that isn't one of our sub-tiles
        const master = viewer.scene.volumes.find(
            v => v instanceof Potree.BoxVolume && !v._isGridSub
        );
        if (!master) {
            alert("Create a volume first using the button above.");
            return;
        }

        // Clear previous sub-volumes
        for (const sub of _gridSubVolumes) viewer.scene.removeVolume(sub);
        _gridSubVolumes = [];

        // Subdivide in X and Y, leave Z full
        const subScale = new THREE.Vector3(master.scale.x / n, master.scale.y / n, master.scale.z);
        const R = new THREE.Matrix4().makeRotationFromEuler(master.rotation);

        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                const offset = new THREE.Vector3(
                    ((i + 0.5) / n - 0.5) * master.scale.x,
                    ((j + 0.5) / n - 0.5) * master.scale.y,
                    0
                ).applyMatrix4(R).add(master.position);

                const sub = new Potree.BoxVolume();
                sub.name = `tile_${toExcelCol(i)}_${j + 1}`;
                sub.position.copy(offset);
                sub.rotation.copy(master.rotation);
                sub.scale.copy(subScale);
                sub.visible = true;
                sub.clip = false;
                sub._isGridSub = true;
                sub.label.fontsize = 0;     //hides the volume label

                viewer.scene.addVolume(sub);
                _gridSubVolumes.push(sub);
                // ── Label ──
                const label = createTileLabel(sub.name[5] + sub.name[7], sub);
                viewer.scene.scene.add(label);
                _gridLabels.push(label);

            }
        }
    });

    document.getElementById("grid-share-btn").addEventListener("click", openShareLinksModal);
}

function toExcelCol(n) {
    let col = "";
    n++; // 1-based
    while (n > 0) {
        n--;
        col = String.fromCharCode(65 + (n % 26)) + col;
        n = Math.floor(n / 26);
    }
    return col;
}

let _gridLabels = [];

function createTileLabel(text, sub) {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 80;
    const ctx = canvas.getContext("2d");

    // Background pill
    ctx.fillStyle = "rgba(20, 20, 26, 0.82)";
    ctx.strokeStyle = "rgba(196, 192, 255, 0.4)";
    ctx.lineWidth = 3;
    const r = 12;
    ctx.beginPath();
    ctx.moveTo(r, 4); ctx.lineTo(252 - r, 4);
    ctx.arcTo(252, 4, 252, 4 + r, r);
    ctx.lineTo(252, 76 - r);
    ctx.arcTo(252, 76, 252 - r, 76, r);
    ctx.lineTo(r, 76);
    ctx.arcTo(4, 76, 4, 76 - r, r);
    ctx.lineTo(4, 4 + r);
    ctx.arcTo(4, 4, r, 4, r);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Text
    ctx.fillStyle = "#c4c0ff";
    ctx.font = "bold 44px 'Segoe UI', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 128, 42);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: true,
        depthWrite: true,    // back on
        alphaTest: 0.1,      // discard near-transparent fragments before depth write
    });

    const sprite = new THREE.Sprite(material);

    // Scale relative to tile size so it's always readable
    const labelWidth = Math.max(sub.scale.x, sub.scale.y) * 0.45;
    sprite.scale.set(labelWidth, labelWidth * (80 / 256), 1);

    // Position at tile center, slightly above midpoint in Z
    sprite.position.copy(sub.position);
    sprite.position.z += sub.scale.z * 0.52;

    return sprite;
}

function getSubVolumeLink(sub) {
    sub.clip = true;
    sub.visible = false;
    const vol = serializeVolumeToCompressedString(sub);

    const url = new URL(window.location);
    url.searchParams.set('volumes', vol);

    // Camera target = center of the sub-volume
    const target = sub.position.clone();

    // Step back by the largest dimension, elevated by half Z scale
    const maxDim = Math.max(sub.scale.x, sub.scale.y, sub.scale.z);
    const offset = new THREE.Vector3(maxDim * 0.8, maxDim * 0.8, maxDim * 0.6);
    offset.applyEuler(sub.rotation);
    const position = target.clone().add(offset);

    const fmt = v => v.toFixed(3);
    url.searchParams.set('position', `${fmt(position.x)};${fmt(position.y)};${fmt(position.z)}`);
    url.searchParams.set('target',   `${fmt(target.x)};${fmt(target.y)};${fmt(target.z)}`);
    // url.searchParams.set('tile', `${sub.name}`); //switched to just getting tile name from volume object

    sub.clip = false;
    sub.visible = true;
    return url;
}


function openShareLinksModal() {
    if (_gridSubVolumes.length === 0) {
        alert("Generate a grid first.");
        return;
    }

    if (document.getElementById("shareLinksOverlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "shareLinksOverlay";
    overlay.style.cssText = `
        position: fixed; inset: 0;
        background: rgba(0,0,0,0.5);
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
        z-index: 10002;
        display: flex; align-items: center; justify-content: center;
        opacity: 0; transition: opacity 0.2s;
    `;

    const modal = document.createElement("div");
    modal.style.cssText = `
        width: clamp(340px, 50vw, 560px);
        max-height: 75vh;
        background: rgba(22, 22, 30, 0.95);
        backdrop-filter: blur(16px);
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 14px;
        box-shadow: 0 0 40px rgba(0,0,0,0.6);
        padding: 20px;
        display: flex; flex-direction: column; gap: 12px;
        font-family: 'Segoe UI', system-ui, sans-serif;
        overflow: hidden;
    `;

    // Header
    const header = document.createElement("div");
    header.className = "brush-header";

    const title = document.createElement("span");
    title.className = "brush-title";
    title.textContent = "Tile Links";
    header.appendChild(title);

    const closeBtn = document.createElement("button");
    closeBtn.className = "brush-close";
    closeBtn.textContent = "×";
    closeBtn.addEventListener("click", close);
    header.appendChild(closeBtn);
    modal.appendChild(header);

    // Scrollable list
    const list = document.createElement("div");
    list.style.cssText = `
        display: flex; flex-direction: column; gap: 6px;
        overflow-y: auto; max-height: 52vh; padding-right: 4px;
    `;
    list.style.cssText += `
        scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.15) transparent;
    `;

    for (const sub of _gridSubVolumes) {
        const url = getSubVolumeLink(sub).toString();

        const row = document.createElement("div");
        row.style.cssText = `
            display: grid; grid-template-columns: auto 1fr auto;
            align-items: center; gap: 8px;
            padding: 8px 10px;
            background: rgba(255,255,255,0.04);
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 8px;
        `;

        const name = document.createElement("span");
        name.style.cssText = "font-size:12px; color:#aaa; font-family:monospace; flex-shrink:0;";
        name.textContent = sub.name;
        row.appendChild(name);

        const urlEl = document.createElement("input");
        urlEl.readOnly = true;
        urlEl.value = url;
        urlEl.style.cssText = `
            flex:1; min-width:0;
            padding: 5px 8px;
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 6px;
            color: #888; font-size: 11px; font-family: monospace;
            cursor: text; outline: none;
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        `;
        urlEl.addEventListener("focus", () => urlEl.select());
        row.appendChild(urlEl);

        const copyBtn = document.createElement("button");
        copyBtn.textContent = "Copy";
        copyBtn.style.cssText = `
            padding: 5px 12px; border: none; border-radius: 6px;
            background: rgba(79,70,229,0.6); color: #fff;
            font-size: 12px; font-family: inherit; cursor: pointer;
            transition: background 0.15s; flex-shrink: 0;
        `;
        copyBtn.addEventListener("mouseenter", () => { copyBtn.style.background = "rgba(99,90,245,0.85)"; });
        copyBtn.addEventListener("mouseleave", () => {
            if (!copyBtn._copied) copyBtn.style.background = "rgba(79,70,229,0.6)";
        });
        copyBtn.addEventListener("click", async () => {
            await navigator.clipboard.writeText(url);
            copyBtn._copied = true;
            copyBtn.textContent = "Copied!";
            copyBtn.style.background = "rgba(45,160,80,0.85)";
            setTimeout(() => {
                copyBtn._copied = false;
                copyBtn.textContent = "Copy";
                copyBtn.style.background = "rgba(79,70,229,0.6)";
            }, 1200);
        });
        row.appendChild(copyBtn);
        list.appendChild(row);
    }
    modal.appendChild(list);

    // Copy All footer button
    const copyAllBtn = document.createElement("button");
    copyAllBtn.className = "brush-action-btn brush-btn-primary";
    copyAllBtn.textContent = "Copy All Links";
    copyAllBtn.addEventListener("click", async () => {
        const text = _gridSubVolumes
            .map(s => `${s.name}\t${getSubVolumeLink(s)}`)
            .join("\n");
        await navigator.clipboard.writeText(text);
        copyAllBtn.textContent = "Copied!";
        setTimeout(() => { copyAllBtn.textContent = "Copy All Links"; }, 1200);
    });
    modal.appendChild(copyAllBtn);

    overlay.appendChild(modal);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
    document.body.appendChild(overlay);
    requestAnimationFrame(() => { overlay.style.opacity = "1"; });

    function close() {
        overlay.style.opacity = "0";
        setTimeout(() => overlay.remove(), 200);
    }
}

// ══════════════════════════════════════════════════════════════
//  Panel Construction
// ══════════════════════════════════════════════════════════════

function openBrushPanel() {
    let existing = document.getElementById("brushPanel");
    if (existing) {
        existing.classList.remove("open");
        setTimeout(() => existing.remove(), 300);
        window.brushState.active = false;
        if (brushState.sphere) brushState.sphere.visible = false;
        return;
    }
    switchPCMaterial();
    window.brushState.active = true;
    const panel = document.createElement("div");
    panel.id = "brushPanel";

// ── Header ──
    const header = document.createElement("div");
    header.className = "brush-header";

    const title = document.createElement("span");
    title.className = "brush-title";
    title.textContent = "Classification Brush";
    header.appendChild(title);

    // Admin button — Work Distribution
    const distBtn = document.createElement("button");
    distBtn.title = "Work Distribution";
    distBtn.style.cssText = `
        padding: 4px 9px;
        border: 1px solid rgba(255,255,255,0.15);
        border-radius: 6px;
        background: rgba(255,255,255,0.06);
        color: #aaa;
        font-size: 11px;
        font-weight: 600;
        font-family: monospace;
        cursor: pointer;
        letter-spacing: 0.04em;
        transition: background 0.15s, color 0.15s, border-color 0.15s;
        margin-left: auto;
        margin-right: 6px;
    `;
    distBtn.textContent = "⊞ Work Distribution";
    distBtn.addEventListener("mouseenter", () => {
        distBtn.style.background = "rgba(79,70,229,0.25)";
        distBtn.style.color = "#c4c0ff";
        distBtn.style.borderColor = "rgba(79,70,229,0.4)";
    });
    distBtn.addEventListener("mouseleave", () => {
        distBtn.style.background = "rgba(255,255,255,0.06)";
        distBtn.style.color = "#aaa";
        distBtn.style.borderColor = "rgba(255,255,255,0.15)";
    });
    distBtn.addEventListener("click", openGridPanel);
    header.appendChild(distBtn);

    const closeBtn = document.createElement("button");
    // ... rest of closeBtn unchanged    const closeBtn = document.createElement("button");
    closeBtn.className = "brush-close";
    closeBtn.textContent = "×";
    closeBtn.addEventListener("click", () => {
        panel.classList.remove("open");
        setTimeout(() => panel.remove(), 300);
        window.brushState.active = false;
    });
    header.appendChild(closeBtn);
    panel.appendChild(header);

    // ── Brush Active Toggle ──
    const toggleRow = document.createElement("div");
    toggleRow.className = "brush-toggle-row";

    const toggleLabel = document.createElement("span");
    toggleLabel.className = "brush-toggle-label";
    toggleLabel.textContent = "Brush Active";
    toggleRow.appendChild(toggleLabel);

    const toggleHotkey = document.createElement("span");
    toggleHotkey.className = "brush-hotkey";
    toggleHotkey.textContent = "Z";
    toggleLabel.appendChild(toggleHotkey);

    const toggle = document.createElement("label");
    toggle.className = "brush-toggle";

    const toggleInput = document.createElement("input");
    toggleInput.type = "checkbox";
    toggleInput.checked = window.brushState.active;
    toggleInput.addEventListener("change", () => {
        window.brushState.active = toggleInput.checked;
        if (!toggleInput.checked && brushState.sphere) {
            brushState.sphere.visible = false;
        }
    });
    toggle.appendChild(toggleInput);

    const toggleTrack = document.createElement("span");
    toggleTrack.className = "brush-toggle-track";
    toggle.appendChild(toggleTrack);

    const toggleThumb = document.createElement("span");
    toggleThumb.className = "brush-toggle-thumb";
    toggle.appendChild(toggleThumb);

    const paintHint = document.createElement("div");
    paintHint.style.cssText = "font-size:12px; color:#777; text-align:center; margin-top:2px;";
    paintHint.innerHTML = 'Hold <span class="brush-hotkey">Ctrl</span> + drag to paint';
    panel.appendChild(paintHint);

    toggleRow.appendChild(toggle);
    panel.appendChild(toggleRow);

    // ── Pointcloud Select ──
    const pcSection = document.createElement("div");

    const pcLabel = document.createElement("div");
    pcLabel.className = "brush-label";
    pcLabel.textContent = "Target Pointcloud";
    pcSection.appendChild(pcLabel);

    const pcSelect = document.createElement("select");
    pcSelect.className = "brush-select";
    pcSelect.id = "brushPCSelect";

    const allOption = document.createElement("option");
    allOption.value = "__all__";
    allOption.textContent = "All Visible Pointclouds";
    pcSelect.appendChild(allOption);

    for (let pc of viewer.scene.pointclouds) {
        const opt = document.createElement("option");
        opt.value = pc.name;
        opt.textContent = pc.name;
        pcSelect.appendChild(opt);
    }

    pcSelect.addEventListener("change", () => {
        window.brushState.targetPointcloud = pcSelect.value === "__all__" ? null : pcSelect.value;
    });
    pcSection.appendChild(pcSelect);
    panel.appendChild(pcSection);

    // ── Classification Section ──
    const classSection = document.createElement("div");

    // Label + Edit button
    const classLabelRow = document.createElement("div");
    classLabelRow.style.cssText = "display:flex; align-items:center; justify-content:space-between;";

    const classLabel = document.createElement("div");
    classLabel.className = "brush-label";
    classLabel.style.marginBottom = "0";
    classLabel.textContent = "Classification";
    classLabelRow.appendChild(classLabel);

    const editClassBtn = document.createElement("button");
    editClassBtn.style.cssText = `
        background: none; border: none; color: #6e6bff; font-size: 12px;
        cursor: pointer; font-family: inherit; padding: 2px 6px;
        border-radius: 4px; transition: background 0.15s;
    `;
    editClassBtn.textContent = "Edit\u2026";
    editClassBtn.addEventListener("click", openClassificationEditor);
    editClassBtn.addEventListener("mouseenter", () => { editClassBtn.style.background = "rgba(79,70,229,0.15)"; });
    editClassBtn.addEventListener("mouseleave", () => { editClassBtn.style.background = "none"; });
    classLabelRow.appendChild(editClassBtn);
    classSection.appendChild(classLabelRow);

    // Toggle All
    const toggleAllRow = document.createElement("div");
    toggleAllRow.style.cssText = "display:flex; align-items:center; justify-content:space-between; margin:6px 0; padding-right:10px;";

    const toggleAllLabel = document.createElement("span");
    toggleAllLabel.style.cssText = "font-size:13px; color:#ccc;";
    toggleAllLabel.textContent = "Toggle All";
    toggleAllRow.appendChild(toggleAllLabel);

    const toggleAllChk = document.createElement("input");
    toggleAllChk.type = "checkbox";
    toggleAllChk.className = "brush-vis-checkbox";
    toggleAllChk.checked = true;
    toggleAllChk.addEventListener("change", () => {
        const visible = toggleAllChk.checked;
        const g = document.getElementById("brushClassGrid");
        if (g) g.querySelectorAll(".brush-vis-checkbox").forEach(chk => { chk.checked = visible; });
        for (let cls of CLASSIFICATIONS) {
            viewer.setClassificationVisibility(cls.value, visible);
        }
    });
    toggleAllRow.appendChild(toggleAllChk);
    classSection.appendChild(toggleAllRow);

    // Grid
    const grid = document.createElement("div");
    grid.className = "brush-class-grid";
    grid.id = "brushClassGrid";

    for (let cls of CLASSIFICATIONS) {
        const btn = document.createElement("button");
        btn.className = "brush-class-btn" + (cls.value === window.brushState.classification ? " active" : "");
        btn.dataset.value = cls.value;

        const visChk = document.createElement("input");
        visChk.type = "checkbox";
        visChk.className = "brush-vis-checkbox";
        visChk.checked = viewer.classifications[cls.value]?.visible !== false;
        visChk.addEventListener("click", (e) => { e.stopPropagation(); });
        visChk.addEventListener("change", () => {
            viewer.setClassificationVisibility(cls.value, visChk.checked);
        });

        const swatch = document.createElement("span");
        swatch.className = "brush-class-swatch";
        swatch.style.background = cls.color;
        btn.appendChild(swatch);

        const label = document.createElement("span");
        label.textContent = cls.name;
        btn.appendChild(label);
        btn.appendChild(visChk);

        btn.addEventListener("click", () => {
            grid.querySelectorAll(".brush-class-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            window.brushState.classification = cls.value;
        });

        grid.appendChild(btn);
    }
    classSection.appendChild(grid);
    panel.appendChild(classSection);

    // ── Radius Slider ──
    const radiusSection = document.createElement("div");

    const radiusLabel = document.createElement("div");
    radiusLabel.className = "brush-label";
    radiusLabel.innerHTML = 'Brush Radius <span class="brush-hotkey">Q</span> <span class="brush-hotkey">E</span>';
    radiusSection.appendChild(radiusLabel);

    const sliderRow = document.createElement("div");
    sliderRow.className = "brush-slider-row";

    const slider = document.createElement("input");
    slider.type = "range";
    slider.className = "brush-slider";
    slider.min = "0.01";
    slider.max = "50";
    slider.step = "0.1";
    slider.value = window.brushState.radius;

    const sliderValue = document.createElement("input");
    sliderValue.type = "number";
    sliderValue.className = "brush-slider-value";
    sliderValue.min = "0.01";
    sliderValue.max = "50";
    sliderValue.step = "0.1";
    sliderValue.value = window.brushState.radius.toFixed(1);
    sliderValue.style.cssText = `
        width: 56px; background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.12); border-radius: 6px;
        color: #ccc; text-align: right; padding: 3px 6px;
        font-size: 14px; font-family: inherit;
        -moz-appearance: textfield;
    `;
    sliderValue.style.cssText += `outline: none;`;

    // Remove spinner arrows
    sliderValue.addEventListener("focus", () => {
        sliderValue.style.borderColor = "#6e6bff";
    });
    sliderValue.addEventListener("blur", () => {
        sliderValue.style.borderColor = "rgba(255,255,255,0.12)";
    });

    slider.addEventListener("input", () => {
        window.brushState.radius = parseFloat(slider.value);
        sliderValue.value = parseFloat(slider.value).toFixed(1);
    });

    sliderValue.addEventListener("input", () => {
        let v = parseFloat(sliderValue.value);
        if (isNaN(v)) return;
        v = Math.min(50, Math.max(0.01, v));
        window.brushState.radius = v;
        slider.value = v;
    });

    // Clamp and clean up on blur
    sliderValue.addEventListener("blur", () => {
        let v = parseFloat(sliderValue.value);
        if (isNaN(v)) v = window.brushState.radius;
        v = Math.min(50, Math.max(0.01, v));
        window.brushState.radius = v;
        slider.value = v;
        sliderValue.value = v.toFixed(1);
    });

    sliderRow.appendChild(slider);
    sliderRow.appendChild(sliderValue);
        const sliderUnit = document.createElement("span");
    sliderUnit.textContent = "m";
    sliderUnit.style.cssText = "font-size:13px; color:#666; flex-shrink:0;";
    sliderRow.appendChild(sliderUnit);
    radiusSection.appendChild(sliderRow);
    panel.appendChild(radiusSection);

    // ── Divider ──
    const divider = document.createElement("div");
    divider.className = "brush-divider";
    panel.appendChild(divider);

    // ── Edit Count ──
    const editCount = document.createElement("div");
    editCount.className = "brush-edit-count";
    editCount.id = "brushEditCount";
    editCount.textContent = "No edits yet";
    panel.appendChild(editCount);
    updateEditCount();

    // ── Stroke Indicator ──
    const strokeIndicator = document.createElement("div");
    strokeIndicator.className = "brush-stroke-indicator";
    strokeIndicator.id = "brushStrokeIndicator";

    const spinner = document.createElement("div");
    spinner.className = "brush-stroke-spinner";
    strokeIndicator.appendChild(spinner);

    const strokeLabel = document.createElement("span");
    strokeLabel.textContent = "Loading & classifying nodes\u2026";
    strokeIndicator.appendChild(strokeLabel);
    panel.appendChild(strokeIndicator);

// ── Action Buttons ──
    const actions = document.createElement("div");
    actions.className = "brush-actions";

    // ── Contributor (compact, inline) ──
    const contribRow = document.createElement("div");
    contribRow.style.cssText = "display:flex; align-items:center; gap:8px; margin-bottom:2px;";

    const contribLabel = document.createElement("label");
    contribLabel.htmlFor = "brushContributor";
    contribLabel.style.cssText = `
        font-size: 11px; font-weight: 600; letter-spacing: 0.06em;
        text-transform: uppercase; color: #888; flex-shrink: 0;
    `;
    contribLabel.textContent = "By";
    contribRow.appendChild(contribLabel);

    const contribInput = document.createElement("input");
    contribInput.type = "text";
    contribInput.id = "brushContributor";
    contribInput.placeholder = "Your name (optional)";
    contribInput.style.cssText = `
        flex: 1; min-width: 0; box-sizing: border-box;
        padding: 6px 10px;
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 6px;
        color: #fafafa; font-size: 13px; font-family: inherit;
        outline: none; transition: border-color 0.15s;
    `;
    contribInput.value = localStorage.getItem("oh3d_contributor") || "";
    contribInput.addEventListener("focus", () => { contribInput.style.borderColor = "#6e6bff"; });
    contribInput.addEventListener("blur",  () => { contribInput.style.borderColor = "rgba(255,255,255,0.12)"; });
    contribInput.addEventListener("input", () => {
        localStorage.setItem("oh3d_contributor", contribInput.value.trim());
    });
    contribRow.appendChild(contribInput);
    actions.appendChild(contribRow);

    // ── Primary: Export ──
    const exportBtn = document.createElement("button");
    exportBtn.className = "brush-action-btn brush-btn-success";
    exportBtn.textContent = "Export Edits (CSV)";
    exportBtn.addEventListener("click", exportEditsToCSV);
    actions.appendChild(exportBtn);

    // ── Secondary: Import / Refresh / Clear ──
    const secondaryRow = document.createElement("div");
    secondaryRow.style.cssText = "display:grid; grid-template-columns:1fr 1fr 1fr; gap:6px;";

    const secondaryBase = `
        padding: 7px 8px;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 6px;
        background: rgba(255,255,255,0.04);
        color: #bbb;
        font-size: 12px;
        font-family: inherit;
        cursor: pointer;
        transition: background 0.15s, color 0.15s, border-color 0.15s;
    `;

    function makeSecondaryBtn(text, hoverBg, hoverColor, onClick) {
        const b = document.createElement("button");
        b.textContent = text;
        b.style.cssText = secondaryBase;
        b.addEventListener("mouseenter", () => {
            b.style.background = hoverBg;
            b.style.color = hoverColor;
            b.style.borderColor = "transparent";
        });
        b.addEventListener("mouseleave", () => {
            b.style.background = "rgba(255,255,255,0.04)";
            b.style.color = "#bbb";
            b.style.borderColor = "rgba(255,255,255,0.1)";
        });
        b.addEventListener("click", onClick);
        return b;
    }

    secondaryRow.appendChild(makeSecondaryBtn(
        "Import", "rgba(79,70,229,0.25)", "#c4c0ff",
        () => importEditsFromCSV()
    ));
    secondaryRow.appendChild(makeSecondaryBtn(
        "Refresh", "rgba(220,120,30,0.25)", "#fbbf77",
        applyEditsToLoadedNodes
    ));
    secondaryRow.appendChild(makeSecondaryBtn(
        "Clear", "rgba(220,38,38,0.25)", "#f87171",
        () => {
            if (getTotalEditCount() === 0) return;
            if (confirm("Clear all classification edits? This cannot be undone.")) {
                clearAllEdits();
            }
        }
    ));
    actions.appendChild(secondaryRow);

    panel.appendChild(actions);
    // ── Mount & Animate In ──
    document.body.appendChild(panel);
    requestAnimationFrame(() => panel.classList.add("open"));
    updateEditCount();
}


// ══════════════════════════════════════════════════════════════
//  Brush Sphere Visualization
// ══════════════════════════════════════════════════════════════

function initBrushSphere() {
    const sphereGeom = new THREE.SphereGeometry(1, 32, 16);

    const material = new THREE.MeshBasicMaterial({
        color: 0xffff00, transparent: true, opacity: 0.08,
        side: THREE.FrontSide, depthWrite: false, depthTest: false,
    });

    const wireMaterial = new THREE.MeshBasicMaterial({
        color: 0xffff00, wireframe: true, transparent: true, opacity: 0.3,
        depthWrite: true, depthTest: true,
    });

    const sphere = new THREE.Mesh(sphereGeom, material);
    const wireframe = new THREE.Mesh(sphereGeom, wireMaterial);
    sphere.add(wireframe);
    sphere.rotateX(-Math.PI / 2);
    sphere.visible = false;
    viewer.scene.scene.add(sphere);
    window.brushState.sphere = sphere;
}

function updateRadiusUI() {
    const slider = document.querySelector('#brushPanel .brush-slider');
    const value = document.querySelector('#brushPanel .brush-slider-value');
    if (slider) slider.value = window.brushState.radius;
    if (value) value.value = window.brushState.radius.toFixed(1);
}


// ══════════════════════════════════════════════════════════════
//  Input Handling
// ══════════════════════════════════════════════════════════════

function getPickRay(event, camera) {
    let rect = viewer.renderer.domElement.getBoundingClientRect();
    let mouse = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    let raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    return raycaster.ray;
}

function getTargetPointcloud() {
    if (brushState.targetPointcloud) {
        return viewer.scene.pointclouds.find(pc => pc.name === brushState.targetPointcloud);
    }
    return viewer.scene.pointclouds.find(pc => pc.visible);
}


let editApplyTimer = null;
function applyEditsOnMove(){
    if(getTotalEditCount() === 0) return;
    clearTimeout(editApplyTimer);
    editApplyTimer = setTimeout(applyEditsToLoadedNodes, 10);
}


document.addEventListener("DOMContentLoaded", () => {
    initBrushSphere();

    viewer.addEventListener('camera_changed', applyEditsOnMove);
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

        if (e.key === 'Control' && brushState.active) {
            brushState.painting = true;
            viewer.controls.rotationSpeed = 0;
        }

        if (e.key === 'z' || e.key === 'Z') {
            window.brushState.active = !window.brushState.active;
            if (!window.brushState.active && brushState.sphere) brushState.sphere.visible = false;
            const toggle = document.querySelector('#brushPanel .brush-toggle input');
            if (toggle) toggle.checked = window.brushState.active;
        }

        if (e.key === 'q' || e.key === 'Q') {
            window.brushState.radius = Math.max(0.01, window.brushState.radius - 0.5);
            updateRadiusUI();
            if (brushState.sphere?.visible) {
                let r = brushState.radius;
                brushState.sphere.scale.set(r, r, r);
            }
        }

        if (e.key === 'e' || e.key === 'E') {
            window.brushState.radius = Math.min(50, window.brushState.radius + 0.5);
            updateRadiusUI();
            if (brushState.sphere?.visible) {
                let r = brushState.radius;
                brushState.sphere.scale.set(r, r, r);
            }
        }
    });

    document.addEventListener('keyup', (e) => {
        if (e.key === 'Control') {
            brushState.painting = false;
            viewer.controls.rotationSpeed = 5;
        }
    });

    const btn = document.getElementById("brush-start-icon");
    if (btn) btn.addEventListener("click", () => { brushState.active = !brushState.active; });

    viewer.renderer.domElement.addEventListener('mousemove', (event) => {
        if (!brushState.active || !brushState.sphere) return;

        const ray = getPickRay(event, viewer.scene.getActiveCamera());
        let rect = viewer.renderer.domElement.getBoundingClientRect();

        let pickParams = {
            x: event.clientX - rect.left,
            y: rect.height - (event.clientY - rect.top),
            pickWindowSize: 65, pickClipped: true
        };

        let pointcloud = getTargetPointcloud();
        if (!pointcloud) return;

        let hit = pointcloud.pick(viewer, viewer.scene.getActiveCamera(), ray, pickParams);

        if (hit) {
            brushState.sphere.position.copy(hit.position);
            let r = brushState.radius;
            brushState.sphere.scale.set(r, r, r);
            brushState.sphere.visible = true;
            if (brushState.painting && event.buttons === 1) {
                paintAtPoint(pointcloud, hit);
            }
        } else {
            brushState.sphere.visible = false;
        }
    });

    viewer.renderer.domElement.addEventListener('click', (event) => {
        if (!brushState.active || !brushState.painting) return;

        const ray = getPickRay(event, viewer.scene.getActiveCamera());
        let rect = viewer.renderer.domElement.getBoundingClientRect();

        let pickParams = {
            x: event.clientX - rect.left,
            y: rect.height - (event.clientY - rect.top),
            pickWindowSize: 65, pickClipped: true
        };

        let pointcloud = getTargetPointcloud();
        if (!pointcloud) return;

        let hit = pointcloud.pick(viewer, viewer.scene.getActiveCamera(), ray, pickParams);
        if (hit) paintAtPoint(pointcloud, hit);
    });
});