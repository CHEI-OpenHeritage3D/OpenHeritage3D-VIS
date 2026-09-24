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
 *   - Potree (viewer.scene) — Potree 2.0 format (OctreeGeometryNode) or
 *     COPC (PointCloudCopcGeometryNode); both must call Potree.onNodeLoaded
 *     when a node's buffer is ready
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

/* ── Nearest Oriented Image Tooltip (hold Shift) ────────── */

.brush-oi-tooltip {
    position: fixed;
    z-index: 10002;
    pointer-events: none;
    padding: 6px 10px;
    background: rgba(20, 20, 26, 0.88);
    backdrop-filter: blur(8px) saturate(140%);
    -webkit-backdrop-filter: blur(8px) saturate(140%);
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 8px;
    box-shadow: 0 0 16px rgba(0,0,0,0.45);
    font-family: 'Segoe UI', system-ui, sans-serif;
    color: #fafafa;
    font-size: 13px;
    white-space: nowrap;
    display: none;
}

.brush-oi-tooltip-name {
    font-weight: 600;
    color: #c4c0ff;
}

.brush-oi-tooltip-hint {
    display: block;
    margin-top: 2px;
    font-size: 11px;
    color: #888;
}
`;

style.textContent += `

/* ── Shortcut Guide (help overlay) ──────────────────────── */

.brush-help-btn {
    padding: 4px 9px;
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 6px;
    background: rgba(255,255,255,0.06);
    color: #aaa;
    font-size: 12px;
    font-weight: 700;
    font-family: monospace;
    cursor: pointer;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
    margin-right: 6px;
}
.brush-help-btn:hover {
    background: rgba(79,70,229,0.25);
    color: #c4c0ff;
    border-color: rgba(79,70,229,0.4);
}

.brush-help-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    z-index: 10003;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.2s;
    font-family: 'Segoe UI', system-ui, sans-serif;
}
.brush-help-overlay.open { opacity: 1; }

.brush-help {
    width: clamp(320px, 82vw, 900px);
    max-height: 86vh;
    background: rgba(22, 22, 30, 0.92);
    backdrop-filter: blur(16px) saturate(140%);
    -webkit-backdrop-filter: blur(16px) saturate(140%);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 14px;
    box-shadow: 0 0 40px rgba(0,0,0,0.6);
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    overflow: hidden;
}

.brush-help-body {
    display: flex;
    flex-direction: column;
    gap: 16px;
    overflow-y: auto;
    padding-right: 4px;
}
.brush-help-body::-webkit-scrollbar { width: 5px; }
.brush-help-body::-webkit-scrollbar-track { background: transparent; }
.brush-help-body::-webkit-scrollbar-thumb {
    background: rgba(255,255,255,0.15);
    border-radius: 3px;
}

/* Keyboard diagram */

.brush-help-kb {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 14px 10px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 10px;
    flex-shrink: 0;
}

.brush-help-kbrow {
    display: flex;
    gap: 5px;
    justify-content: center;
}

.brush-key {
    min-width: 30px;
    height: 30px;
    padding: 0 7px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    color: #55555e;
    font-family: monospace;
    font-size: 12px;
    font-weight: 600;
    flex-shrink: 0;
    transition: transform 0.12s, filter 0.12s;
}

.brush-key-brush {
    background: rgba(79,70,229,0.28);
    border-color: rgba(79,70,229,0.5);
    color: #c4c0ff;
}
.brush-key-paint {
    background: rgba(45,160,80,0.26);
    border-color: rgba(55,180,95,0.5);
    color: #9ce8b6;
}
.brush-key-image {
    background: rgba(220,120,30,0.26);
    border-color: rgba(240,140,40,0.5);
    color: #ffcf9b;
}

.brush-key.hot,
.brush-help-mouse .hot {
    transform: translateY(-2px);
    filter: brightness(1.5);
}

.brush-help-kbgap { width: 22px; }

/* Mouse diagram + legend */

.brush-help-cols {
    display: flex;
    align-items: flex-start;
    gap: 18px;
    flex-wrap: wrap;
}

.brush-help-mouse {
    width: 132px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 14px 10px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 10px;
}
.brush-help-mouse svg { width: 82px; height: auto; }
.brush-help-mouse .part { transition: filter 0.12s, transform 0.12s; }
.brush-help-mouse .outline {
    fill: none;
    stroke: rgba(255,255,255,0.22);
    stroke-width: 2;
}
.brush-help-mouse .divider {
    stroke: rgba(255,255,255,0.18);
    stroke-width: 2;
}

.brush-help-legend {
    flex: 1;
    min-width: 250px;
    columns: 2 270px;
    column-gap: 20px;
}

.brush-help-legend > div {
    break-inside: avoid;
    margin-bottom: 16px;
}

.brush-help-group-title {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: #888;
    margin-bottom: 6px;
}

.brush-help-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
}

.brush-help-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 4px 8px;
    border-radius: 7px;
    transition: background 0.15s;
}
.brush-help-row:hover { background: rgba(255,255,255,0.06); }

.brush-help-combo {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
    width: 140px;
}

.brush-help-plus {
    color: #555;
    font-size: 11px;
}

.brush-help-desc {
    font-size: 13px;
    color: #b4b4be;
}

.brush-help-foot {
    font-size: 11px;
    color: #666;
    text-align: center;
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
    { value: 17, name: "Bridge Deck",       color: "#629fce" },
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

function setPCMaterial(material) {

    if(material.toLowerCase() === "classification"){
        for(const pointcloud of viewer.scene.pointclouds){
            pointcloud.material.activeAttributeName = "classification";
        }
        updateMaterialMenu("Classification");
    }
    else if(material.toLowerCase() === "rgba classes"){
        for (const pointcloud of viewer.scene.pointclouds){
            pointcloud.material.activeAttributeName = "composite";
            pointcloud.material.weightRGB = [1];
            pointcloud.material.weightIntensity = [0];
            pointcloud.material.intensityRange = [16, 65000];
            pointcloud.material.weightClassification = [0.75];
		}
        updateMaterialMenu("RGBA Classes");
    }
    else if(material.toLowerCase() === 'intensity classes'){
        for (const pointcloud of viewer.scene.pointclouds){
            pointcloud.material.activeAttributeName = "composite";
            pointcloud.material.weightRGB = [0];
            pointcloud.material.weightIntensity = [90];
            pointcloud.material.intensityRange = [16, 65000];
            pointcloud.material.weightClassification = [10];
        }
        updateMaterialMenu("Intensity Classes");
    }
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

    if(window.orientedImageState.currentImage){
        setPCMaterial("classification");
    }
    else if(currentMaterial === 'rgba'){
        setPCMaterial("rgba classes");
    }
    else if(currentMaterial === 'intensity'){
        setPCMaterial("intensity classes");
    }
}

// ══════════════════════════════════════════════════════════════
//  RGB ↔ Classification Composite Blend
// ══════════════════════════════════════════════════════════════

/**
 * Push window.brushState.classBlend into the composite weights of every
 * currently visible pointcloud. t=0 is pure RGB, t=1 is pure classification;
 * the other composite channels are zeroed so the two stay complementary.
 */
function applyClassBlendToVisiblePointclouds() {
    const t = window.brushState.classBlend;
    for (const pc of viewer.scene.pointclouds) {
        if (!pc.visible) continue;
        pc.material.activeAttributeName = "composite";
        pc.material.weightRGB = 1 - t;
        pc.material.weightClassification = t;
        pc.material.weightIntensity = 0;
        pc.material.weightElevation = 0;
        pc.material.weightReturnNumber = 0;
        pc.material.weightSourceID = 0;
    }
}

function updateClassBlendUI() {
    const t = window.brushState.classBlend;
    const slider = document.getElementById("brushClassBlendSlider");
    const value  = document.getElementById("brushClassBlendValue");
    if (slider) slider.value = String(t);
    if (value)  value.textContent = Math.round(t * 100) + "% Class";
}

function setClassBlend(t) {
    t = Math.min(1, Math.max(0, t));
    window.brushState.classBlend = t;
    applyClassBlendToVisiblePointclouds();
    updateClassBlendUI();
}

// Cycles the blend 100% RGB -> 50/50 -> 100% Classification -> 50/50 -> ... (hotkey W)
function toggleClassBlendCycle() {
    const t = window.brushState.classBlend;
    let next;
    if (t > 0.5) {
        next = 0.5;
        window.brushState.classBlendToggleDir = -1; // next stop is 100% RGB
    } else if (t < 0.5) {
        next = 0.5;
        window.brushState.classBlendToggleDir = 1;  // next stop is 100% classification
    } else {
        next = window.brushState.classBlendToggleDir < 0 ? 0 : 1;
    }
    setClassBlend(next);
}

// Called by oriented_image_panel.js when a photo is focused — that flow pins
// pointclouds to pure classification color, so pin the bar at 100% too and
// remember where it was so it can be restored on release.
function enterClassBlendForOrientedImage() {
    if (!window.brushState._blendForcedByOI) {
        window.brushState._classBlendBeforeOI = window.brushState.classBlend;
        window.brushState._blendForcedByOI = true;
    }
    window.brushState.classBlend = 1;
    updateClassBlendUI();
}

// Called when a focused photo is released — restores whatever blend was
// active before oriented-image mode forced it to 100% classification.
function exitClassBlendForOrientedImage() {
    if (!window.brushState._blendForcedByOI) return;
    window.brushState._blendForcedByOI = false;
    setClassBlend(window.brushState._classBlendBeforeOI || 0);
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

        btn.addEventListener("click", () => selectBrushClassification(cls.value));

        grid.appendChild(btn);
    }

    // Reset selection if it was removed
    if (!CLASSIFICATIONS.find(c => c.value === window.brushState.classification)) {
        window.brushState.classification = CLASSIFICATIONS[0]?.value ?? 0;
        const first = grid.querySelector(".brush-class-btn");
        if (first) first.classList.add("active");
    }

    updateBrushSphereColor();
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

function isAllEntry(e)   { return e && !(e instanceof Map) && e.all === true; }
function getOverrides(e) {
    if (e instanceof Map) return e;
    if (isAllEntry(e) && e.overrides instanceof Map) return e.overrides;
    return null;
}

/**
 * Walk up the octree by name ("r" / "r0" / "r03"…) and return the
 * nearest "all" baseline classification, including this node itself.
 */
function getInheritedBaseline(pcEdits, nodeName) {
    if (!pcEdits) return null;
    let name = nodeName;
    while (name.length >= 1) {
        const entry = pcEdits.get(name);
        if (isAllEntry(entry)) return entry.classification;
        if (name.length === 1) break;
        name = name.slice(0, -1);
    }
    return null;
}

/**
 * Reconcile a single loaded node's GPU buffer with the ledger state:
 *   1. fill with inherited baseline (if any),
 *   2. overlay per-point overrides (own Map, or own hybrid.overrides).
 */
function applyLedgerToNode(geoNode, pcEdits, baselineOverride, entryOverride) {
    const classAttr = geoNode.geometry?.attributes?.classification;
    if (!classAttr) return;

    const baseline = baselineOverride !== undefined ? baselineOverride : getInheritedBaseline(pcEdits, geoNode.name);
    const entry     = entryOverride !== undefined ? entryOverride : pcEdits?.get(geoNode.name);
    // if(!entry) return;
    const overrides = getOverrides(entry);

    
    let changed = false;

    if (baseline !== null) {
        classAttr.array.fill(baseline);
        changed = true;
    }
    if (overrides) {
        for (const [pIndex, edit] of overrides) {
            classAttr.array[pIndex] = edit.classification;
        }
        changed = true;
    }
    if (changed) classAttr.needsUpdate = true;
    // explicitToImplicitNode(geoNode, pcEdits);
}

function explicitToImplicitNode(geoNode, pcEdits) {
    if (!geoNode || !pcEdits) return;
    const entry = pcEdits.get(geoNode.name);
    if (!entry) return;

    const overrides = getOverrides(entry);
    if (!overrides) return;                              // already pure "all"
    if (overrides.size !== geoNode.numPoints) return;    // doesn't cover everything

    // Unanimity check — short-circuit on first mismatch
    let target = null;
    for (const edit of overrides.values()) {
        if (target === null)                    target = edit.classification;
        else if (edit.classification !== target) return;
    }

    // Promote
    
    pcEdits.set(geoNode.name, { all: true, classification: target });
}


// Deprecated
/*
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
    */

/**
 * Point count known from the hierarchy, whether or not the node is loaded.
 * Potree 2.0 fills numPoints from the hierarchy; COPC leaves it at -1 until
 * the node loads and reports the count through getNumPoints() instead.
 */
function geoNodeNumPoints(geoNode) {
    return Math.max(0, geoNode.getNumPoints() || 0);
}

function getNodePointCount(geoNode) {
    if (!geoNode) return 0;
    let count = geoNodeNumPoints(geoNode);
    for (let i = 0; i < 8; i++) {
        const child = geoNode.children[i];
        if (child) count += getNodePointCount(child);
    }
    return count;
}

function getTotalEditCount() {
    let count = 0;
    for (const [pcName, pcEdits] of brushEdits) {
        const pc = viewer.scene.pointclouds.find(p => p.name === pcName);
        if (!pc) continue;

        // Build set of implicit ancestors so we don't double-count
        const implicitNames = [];
        for (const [nodeName, entry] of pcEdits) {
            if (isAllEntry(entry)) implicitNames.push(nodeName);
        }

        for (const [nodeName, entry] of pcEdits) {
            if (!isAllEntry(entry)) {
                count += entry.size;  // pure Map
            } else {
                const coveredByAncestor = implicitNames.some(
                    n => n !== nodeName && nodeName.startsWith(n)
                );
                if (coveredByAncestor) continue;

                const geoNode = findGeoNode(pc.pcoGeometry.root, nodeName);
                if (!geoNode) continue;
                count += getNodePointCount(geoNode);

                // Add hybrid overrides whose pIndex falls within the node's own
                // numPoints — overrides at descendant levels are counted via
                // the subtree walk above
                if (entry.overrides) {
                    // baseline already counts every point in the subtree, so
                    // overrides don't add to the count — they just change which
                    // class those already-counted points belong to
                }
            }
        }
    }
    return count;
}


function updateEditCount() {
    const el = document.getElementById("brushEditCount");
    if (!el) return;
    const count = getTotalEditCount();
    // el.innerHTML = count > 0
    //     ? `<strong>${count.toLocaleString()}</strong> region${count !== 1 ? "s" : ""} modified`
    //     : "No edits yet";
}


// deprecated since this functionality was removed 
// function clearAllEdits() {
//     for (const pointcloud of viewer.scene.pointclouds) {
//         const pcEdits = brushEdits.get(pointcloud.name);
//         if (!pcEdits) continue;

//         for (const node of pointcloud.visibleNodes) {
//             const geoNode = node.geometryNode;
//             const entry   = pcEdits.get(geoNode.name);
//             if (!entry) continue;

//             const classAttr = geoNode.geometry?.attributes?.classification;
//             if (!classAttr) continue;

//             const baseline = getInheritedBaseline(pcEdits, geoNode.name);
//             const overrides = getOverrides(entry);

//             // Revert overrides via stored originals (Map / hybrid.overrides both work)
//             if (overrides) {
//                 for (const [pIndex, edit] of overrides) {
//                     classAttr.array[pIndex] = edit.original;
//                 }
//                 classAttr.needsUpdate = true;
//             }

//             // Pure "all" entries — no per-point originals. We don't know LAS originals
//             // here; the cleanest signal is to flag the buffer dirty so Potree refetches
//             // the node on next visibility change. Since we can't easily force that,
//             // we leave the GPU state as-is and rely on cache eviction. (Document this.)
//         }
//     }

//     brushEdits.clear();
//     updateEditCount();
// }

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

/**
 * Add tile labels for any tile volumes currently in the scene
 * (e.g. one loaded from a contributor's deep link). Safe to call
 * multiple times — volumes already labeled are skipped.
 */
function ensureTileLabels() {
    for (const vol of viewer.scene.volumes) {
        if (!vol.name?.includes("tile")) continue;
        if (vol._tileLabel) continue;

        const [, letter, number] = vol.name.split("_"); // "tile_A_1" → ["tile","A","1"]
        const text = (letter && number) ? `${letter}${number}` : vol.name;

        const label = createTileLabel(text, vol);
        viewer.scene.scene.add(label);
        vol._tileLabel = label;
        _gridLabels.push(label);
    }
}

function getContributorName() {
    const el = document.getElementById("brushContributor");
    return el ? el.value.trim() : "";
}

function setContributorName(name) {
    const el = document.getElementById("brushContributor");
    if(el) el.value = name || "";
}


// ══════════════════════════════════════════════════════════════
//  CSV Export / Import
// ══════════════════════════════════════════════════════════════

function findGeoNode(root, name) {
    if (!root) return null;
    if (root.name === name) return root;
    for (let i = 0; i < 8; i++) {
        const found = findGeoNode(root.children[i], name);
        if (found) return found;
    }
    return null;
}

// ══════════════════════════════════════════════════════════════
//  CSV Export — Two formats
//
//  Browser CSV  → bare ledger dump. No positions, no AABBs, no node
//                 loads. For re-importing into the viewer.
//  Python CSV   → AABBs for implicit regions, (pc,class,x,y,z) for
//                 explicit overrides. Loads only nodes that have
//                 explicit overrides (never entire subtrees).
// ══════════════════════════════════════════════════════════════

function buildMetadataBlock(format) {
    const lines = [];
    const visiblePCs = viewer.scene.pointclouds.filter(p => p.visible);
    const source = visiblePCs.map(p => p.name).join("; ") || "unknown";

    lines.push(`#FORMAT,${format}`);
    lines.push("#METADATA");
    lines.push(`contributor,${getContributorName()}`);
    lines.push(`doi,${window.doi || ""}`);
    lines.push(`source,${source}`);
    lines.push(`citation,${(window.projectCitation || "").replace(/[\r\n,]+/g, " ")}`);
    lines.push(`generated,${new Date().toISOString()}`);
    lines.push(`tile,${getTileIndexes()}`);
    // lines.push(`total_edits,${getTotalEditCount()}`);
    lines.push("#END_METADATA");

    if (classificationsAreCustom()) {
        lines.push("#CLASSIFICATIONS");
        for (const c of CLASSIFICATIONS) lines.push(`${c.value},${c.name},${c.color}`);
        lines.push("#END_CLASSIFICATIONS");
    }
    return lines;
}

function downloadCSVLines(lines, kind) {
    const csv = lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const who  = getContributorName().replace(/[^\w\-]/g, "_");
    const tile = (getTileIndexes() || "").replace(/[^\w\-]/g, "_");
    const pcs  = [...brushEdits.keys()].join("_");
    const parts = [pcs, tile, who, kind].filter(Boolean);

    const a = document.createElement("a");
    a.href = url;
    a.download = parts.join("_") + ".csv";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function exportBrowserCSV() {
    const lines = buildMetadataBlock("browser");

    for (const [pcName, pcEdits] of brushEdits) {
        lines.push(`[${pcName}]`);

        for (const [nodeName, entry] of pcEdits) {
            lines.push(`{${nodeName}}`);

            const isAll     = isAllEntry(entry);
            const overrides = getOverrides(entry);

            if (isAll) lines.push(`#all,${entry.classification}`);

            // Per-point overrides for both pure Map and hybrid.
            // For a pure-all entry (no overrides Map), nothing more is emitted.
            if (overrides && overrides.size > 0) {
                lines.push("pIndex,classification");
                for (const [pIndex, edit] of overrides) {
                    lines.push(`${pIndex},${edit.classification}`);
                }
            }
        }
    }

    downloadCSVLines(lines, "browser");
}

function getNode(pointcloud, nodeName){
    let node = pointcloud.pcoGeometry.root;

    for (const c of nodeName.slice(1)){
        node = node?.children?.[Number(c)];
        if(!node) return null;
    }
    return node;
}

function getNodeNumPoints(pointcloud, nodeName){
    const node = getNode(pointcloud, nodeName);
    if(node) return geoNodeNumPoints(node);
    else return null;
}

async function exportPythonCSV(onProgress) {
    const lines = buildMetadataBlock("python");

    // ── AABBs ── one line per implicit/hybrid region. No node load.
    lines.push("#AABBS");
    lines.push("classification,min_x,min_y,min_z,max_x,max_y,max_z");
    for (const [pcName, pcEdits] of brushEdits) {
        const pc = viewer.scene.pointclouds.find(p => p.name === pcName);
        if (!pc) continue;

        for (const [nodeName, entry] of pcEdits) {
            if (!isAllEntry(entry)) continue;
            const geoNode = findGeoNode(pc.pcoGeometry.root, nodeName);
            if (!geoNode) continue;

            const box = geoNode.boundingBox.clone().applyMatrix4(pc.matrixWorld);
            lines.push(
                `${entry.classification},` +
                `${box.min.x.toFixed(6)},${box.min.y.toFixed(6)},${box.min.z.toFixed(6)},` +
                `${box.max.x.toFixed(6)},${box.max.y.toFixed(6)},${box.max.z.toFixed(6)}`
            );
        }
    }
    lines.push("#END_AABBS");

    // ── Overrides ── one line per explicit edit. Loads only the
    //                 specific nodes that have overrides; never their subtrees.
    let overrideTotal = 0;
    for (const [, pcEdits] of brushEdits) {
        for (const [, entry] of pcEdits) {
            const overrides = getOverrides(entry);
            if (overrides) overrideTotal += overrides.size;
        }
    }

    lines.push("#OVERRIDES");
    lines.push("pc,classification,x,y,z");

    let emitted = 0;
    const tmpPos = new THREE.Vector3();

    for (const [pcName, pcEdits] of brushEdits) {
        const pc = viewer.scene.pointclouds.find(p => p.name === pcName);
        if (!pc) continue;

        for (const [nodeName, entry] of pcEdits) {
            const overrides = getOverrides(entry);
            if (!overrides || overrides.size === 0) continue;

            const geoNode = findGeoNode(pc.pcoGeometry.root, nodeName);
            if (!geoNode) continue;
            if (!geoNode.loaded) await waitForLoad(geoNode);

            const positions = geoNode.geometry?.attributes?.position;
            if (!positions) continue;

            const arr         = positions.array;
            const nodeMatrix  = new THREE.Matrix4().makeTranslation(...geoNode.boundingBox.min.toArray());
            const matrixWorld = new THREE.Matrix4().multiplyMatrices(pc.matrixWorld, nodeMatrix);

            for (const [pIndex, edit] of overrides) {
                const ix = 3 * pIndex;
                tmpPos.set(arr[ix], arr[ix+1], arr[ix+2]).applyMatrix4(matrixWorld);
                lines.push(`${edit.classification},${tmpPos.x.toFixed(6)},${tmpPos.y.toFixed(6)},${tmpPos.z.toFixed(6)}`);
                emitted++;

                // Yield every 5k lines so the UI stays responsive
                if (emitted % 5000 === 0) {
                    onProgress?.(emitted, overrideTotal);
                    await new Promise(r => setTimeout(r, 0));
                }
            }
        }
    }
    lines.push("#END_OVERRIDES");

    onProgress?.(overrideTotal, overrideTotal);
    downloadCSVLines(lines, "python");
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

    // File picker fallback — supports selecting multiple CSVs at once,
    // read and parsed one at a time in selection order.
    let input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv";
    input.multiple = true;
    input.addEventListener("change", async (e) => {
        const files = Array.from(e.target.files);
        for (const file of files) {
            const text = await readFileAsText(file);
            parseEditsCSV(text);
        }
    });
    input.click();
}

function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (evt) => resolve(evt.target.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
    });
}

/**
 * Merge a single node edit into the existing ledger.
 * - implicit + implicit: import wins as baseline, existing overrides preserved
 * - implicit + explicit: becomes hybrid (import baseline + existing overrides merged)
 * - explicit + implicit: becomes hybrid (import baseline, existing map becomes overrides)
 * - explicit + explicit: per-point union, import wins on conflict
 */
function mergeNodeEdit(pcEdits, nodeName, incoming) {
    const existing = pcEdits.get(nodeName);

    if (!existing) {
        // Nothing there — just set it
        pcEdits.set(nodeName, incoming);
        return;
    }

    const existingIsAll = isAllEntry(existing);
    const incomingIsAll = isAllEntry(incoming);

    if (incomingIsAll && existingIsAll) {
        // Both implicit — incoming baseline wins, merge overrides
        const merged = { all: true, classification: incoming.classification };
        const existOv = existing.overrides;
        const incomOv = incoming.overrides;
        if (existOv || incomOv) {
            merged.overrides = new Map(existOv || []);
            if (incomOv) {
                for (const [k, v] of incomOv) merged.overrides.set(k, v);
            }
        }
        pcEdits.set(nodeName, merged);

    } else if (incomingIsAll && !existingIsAll) {
        // Existing is pure Map, incoming is implicit — become hybrid
        // Existing per-point edits become overrides on top of new baseline
        const merged = { all: true, classification: incoming.classification };
        merged.overrides = new Map(existing); // existing Map
        // Incoming overrides win on conflict
        if (incoming.overrides) {
            for (const [k, v] of incoming.overrides) merged.overrides.set(k, v);
        }
        pcEdits.set(nodeName, merged);

    } else if (!incomingIsAll && existingIsAll) {
        // Existing is implicit, incoming is pure Map — merge as overrides
        if (!existing.overrides) existing.overrides = new Map();
        for (const [k, v] of incoming) existing.overrides.set(k, v);

    } else {
        // Both pure Maps — union, incoming wins on conflict
        for (const [k, v] of incoming) existing.set(k, v);
    }
}

function parseEditsCSV(text) {
    const lines = text.split("\n");

    let format = "browser";
    for (let i = 0; i < Math.min(lines.length, 20); i++) {
        const t = lines[i].trim();
        if (!t) continue;
        if (t.startsWith("#FORMAT,")) { format = t.substring(8); break; }
        if (t === "#METADATA" || t.startsWith("[") || t.startsWith("{")) break;
    }

    if (format === "python") {
        alert("This is a Python-export CSV (AABBs + world positions). It can't be re-imported into the viewer — use the Browser CSV format.");
        return;
    }

    let currentPC = null, currentNode = null;
    let parsingMetadata = false, parsingClassifications = false;
    let currentBaseline = null;
    let importedClassifications = [];

    // Staging: accumulate the incoming entry for one node at a time
    let stagedEntry = null;

    function flushStaged() {
        if (!currentPC || !currentNode || !stagedEntry) return;
        if (!brushEdits.has(currentPC)) brushEdits.set(currentPC, new Map());
        mergeNodeEdit(brushEdits.get(currentPC), currentNode, stagedEntry);
        stagedEntry = null;
    }

    for (let line of lines) {
        line = line.trim();
        if (!line || line.startsWith("#FORMAT,")) continue;

        if (line === "#METADATA")     { parsingMetadata = true;  continue; }
        if (line === "#END_METADATA") { parsingMetadata = false; continue; }
        if (parsingMetadata) {
            const commaIdx = line.indexOf(",");
            if (commaIdx !== -1) {
                const key   = line.substring(0, commaIdx).trim();
                const value = line.substring(commaIdx + 1).trim();
                if (key === "contributor") window.contributorName = value; setContributorName(window.contributorName);
            }
            continue;
        }

        if (line === "#CLASSIFICATIONS")     { parsingClassifications = true; importedClassifications = []; continue; }
        if (line === "#END_CLASSIFICATIONS") { parsingClassifications = false; continue; }
        if (parsingClassifications) {
            const firstComma = line.indexOf(","), lastComma = line.lastIndexOf(",");
            if (firstComma === -1 || firstComma === lastComma) continue;
            const value = parseInt(line.substring(0, firstComma));
            const color = line.substring(lastComma + 1);
            const name  = line.substring(firstComma + 1, lastComma);
            if (!isNaN(value) && name && color) importedClassifications.push({ value, name, color });
            continue;
        }

        if (line.startsWith("[") && line.endsWith("]")) {
            flushStaged();
            currentPC = line.slice(1, -1);
            currentNode = null;
            currentBaseline = null;
            stagedEntry = null;
            continue;
        }
        if (line.startsWith("{") && line.endsWith("}")) {
            flushStaged();
            currentNode = line.slice(1, -1);
            currentBaseline = null;
            stagedEntry = null;
            continue;
        }

        if (line.startsWith("#all,") && currentPC && currentNode) {
            const allClass = parseInt(line.substring(5));
            if (!isNaN(allClass)) {
                currentBaseline = allClass;
                stagedEntry = { all: true, classification: allClass };
            }
            continue;
        }

        if (line.startsWith("pIndex,")) continue;
        if (!currentPC || !currentNode) continue;

        const parts = line.split(",");
        const pi = parseInt(parts[0]);
        const cl = parseInt(parts[1]);
        if (isNaN(pi) || isNaN(cl)) continue;

        if (currentBaseline !== null) {
            // Hybrid: per-point overrides on top of the #all baseline
            if (!stagedEntry) stagedEntry = { all: true, classification: currentBaseline };
            if (!stagedEntry.overrides) stagedEntry.overrides = new Map();
            stagedEntry.overrides.set(pi, { classification: cl });
        } else {
            // Pure Map
            if (!stagedEntry || !(stagedEntry instanceof Map)) stagedEntry = new Map();
            stagedEntry.set(pi, { classification: cl });
        }
    }

    // Flush the last node
    flushStaged();

    if (importedClassifications.length > 0) {
        CLASSIFICATIONS = importedClassifications;
        syncClassificationsToViewer();
        rebuildClassificationGridUI();
    }

    applyEditsToLoadedNodes();
}

function fillLoadedSubtree(geoNode, classification) {
    if (geoNode.loaded) {
        const classAttr = geoNode.geometry?.attributes?.classification;
        if (classAttr) {
            classAttr.array.fill(classification);
            classAttr.needsUpdate = true;
        }
    }
    for (let i = 0; i < 8; i++) {
        const child = geoNode.children[i];
        if (child?.loaded) fillLoadedSubtree(child, classification);
    }
}

function applyEditsToLoadedNodes() {
    for (const pointcloud of viewer.scene.pointclouds) {
        const pcEdits = brushEdits.get(pointcloud.name);
        if (!pcEdits) continue;

        for (const node of pointcloud.visibleNodes) {
            applyLedgerToNode(node.geometryNode, pcEdits);
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
    strokeInProgress: false,
    classBlend: 0,             // composite blend: 0 = 100% RGB, 1 = 100% classification
    classBlendToggleDir: 1,    // -1 = W cycle heading toward 0 (RGB), 1 = heading toward 1 (classification)
    _blendForcedByOI: false,   // true while oriented-image mode has pinned the blend to 100%
    _classBlendBeforeOI: 0,    // blend value to restore once oriented-image mode releases
    _globalOIForcedByShiftClick: false  // true if Shift+click switched the global OI toggle on itself
};


// ══════════════════════════════════════════════════════════════
//  Node Loading
// ══════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════
//  Event-driven node loading (replaces the 50 ms retry poll)
//
//  The old waitForLoad polled node.loaded every 50 ms, so each load-slot
//  transition could waste up to ~50 ms of dead time. Instead we keep our own
//  queue that drains the instant a slot frees, driven by Potree's existing
//  onNodeLoaded completion hook (chained further down, near reconcileFreshNode).
// ══════════════════════════════════════════════════════════════

// Nodes to load concurrently *during a stroke*. Potree's steady-state default is
// 4; strokes are latency-bound, so more in-flight range requests hide round-trip
// time. HTTP/2 multiplexing makes 16–32 safe on most static hosts.
const BRUSH_MAX_NODES_LOADING = 16;

const _loadAwaiters = new Map();  // node -> [resolve, ...]
const _loadQueue    = [];         // nodes ready to start (slot-permitting)
const _queuedSet    = new Set();  // membership of _loadQueue (dedupe)
let   _loadWatchdog = null;

function _resolveNode(node) {
    const arr = _loadAwaiters.get(node);
    if (!arr) return;
    _loadAwaiters.delete(node);
    for (const resolve of arr) resolve(node);
}

// Start as many queued loads as there are free slots. Called on every load
// completion (a slot just freed) and whenever a node is newly awaited.
function pumpLoadQueue() {
    while (_loadQueue.length > 0 && Potree.numNodesLoading < Potree.maxNodesLoading) {
        const node = _loadQueue.shift();
        _queuedSet.delete(node);
        if (node.loaded)  { _resolveNode(node); continue; }
        if (node.loading) continue;             // already in flight; resolves via hook
        node.load();                             // sync-sets node.loading + numNodesLoading++
        if (!node.loading && !node.loaded) {     // didn't start (rare slot race) — requeue
            if (!_queuedSet.has(node)) { _queuedSet.add(node); _loadQueue.push(node); }
            break;
        }
    }
}

// Safety net: the loader's catch path frees the slot but never fires onNodeLoaded,
// so a silently-failed load would otherwise hang its awaiter forever. One low-
// frequency timer (alive only while something is awaited) re-queues stalled nodes.
function _startLoadWatchdog() {
    if (_loadWatchdog !== null) return;
    _loadWatchdog = setInterval(() => {
        if (_loadAwaiters.size === 0) {
            clearInterval(_loadWatchdog);
            _loadWatchdog = null;
            return;
        }
        for (const node of _loadAwaiters.keys()) {
            if (node.loaded) { _resolveNode(node); continue; }
            if (!node.loading && !_queuedSet.has(node)) {
                _queuedSet.add(node);
                _loadQueue.push(node);
            }
        }
        pumpLoadQueue();
    }, 250);
}

function waitForLoad(node) {
    if (node.loaded) return Promise.resolve(node);
    return new Promise((resolve) => {
        let arr = _loadAwaiters.get(node);
        if (!arr) { arr = []; _loadAwaiters.set(node, arr); }
        arr.push(resolve);

        if (!node.loading && !_queuedSet.has(node)) {
            _queuedSet.add(node);
            _loadQueue.push(node);
        }
        pumpLoadQueue();
        _startLoadWatchdog();
    });
}
// ══════════════════════════════════════════════════════════════
//  Core Brush Logic — Node-Intersection Based
// ══════════════════════════════════════════════════════════════

/**
 * Squared distance from sphere center to the farthest corner of the box.
 * If that distance ≤ radius, every point in the box is inside the sphere
 * and we can skip per-point distance tests.
 */
function boxFullyInsideSphere(box, c, radiusSq) {
    const dx = Math.max(Math.abs(c.x - box.min.x), Math.abs(c.x - box.max.x));
    const dy = Math.max(Math.abs(c.y - box.min.y), Math.abs(c.y - box.max.y));
    const dz = Math.max(Math.abs(c.z - box.min.z), Math.abs(c.z - box.max.z));
    return (dx * dx + dy * dy + dz * dz) <= radiusSq;
}

/**
 * Squared distance from a point (px,py,pz) to an axis-aligned box, no allocation.
 * Used for the per-node AABB prune in pointcloud-local space so we never have to
 * transform each node's box into world space.
 */
function boxDistSqLocal(box, px, py, pz) {
    const mnx = box.min.x, mny = box.min.y, mnz = box.min.z;
    const mxx = box.max.x, mxy = box.max.y, mxz = box.max.z;
    const dx = px < mnx ? mnx - px : (px > mxx ? px - mxx : 0);
    const dy = py < mny ? mny - py : (py > mxy ? py - mxy : 0);
    const dz = pz < mnz ? mnz - pz : (pz > mxz ? pz - mxz : 0);
    return dx * dx + dy * dy + dz * dz;
}

function isNodeFullyClipped(worldBox, clipInverses, showInside) {
    const corners = [];
    for (let i = 0; i < 8; i++) {
        corners.push(new THREE.Vector3(
            i & 1 ? worldBox.max.x : worldBox.min.x,
            i & 2 ? worldBox.max.y : worldBox.min.y,
            i & 4 ? worldBox.max.z : worldBox.min.z
        ));
    }
    const _v = new THREE.Vector4();

    if (showInside) {
        // SHOW_INSIDE: visible if inside ANY volume.
        // Fully clipped → doesn't intersect ANY volume.
        for (const inv of clipInverses) {
            // Transform corners into clip-box local space, find min/max per axis
            let minX = Infinity, maxX = -Infinity;
            let minY = Infinity, maxY = -Infinity;
            let minZ = Infinity, maxZ = -Infinity;
            for (const c of corners) {
                _v.set(c.x, c.y, c.z, 1.0).applyMatrix4(inv);
                if (_v.x < minX) minX = _v.x; if (_v.x > maxX) maxX = _v.x;
                if (_v.y < minY) minY = _v.y; if (_v.y > maxY) maxY = _v.y;
                if (_v.z < minZ) minZ = _v.z; if (_v.z > maxZ) maxZ = _v.z;
            }
            // If ranges overlap on all 3 axes → node intersects this volume → not fully clipped
            if (maxX >= -0.5 && minX <= 0.5 &&
                maxY >= -0.5 && minY <= 0.5 &&
                maxZ >= -0.5 && minZ <= 0.5) {
                return false;
            }
        }
        return true; // no volume intersected
    } else {
        // SHOW_OUTSIDE: visible if outside. Fully clipped → fully inside ANY volume.
        for (const inv of clipInverses) {
            let allInside = true;
            for (const c of corners) {
                _v.set(c.x, c.y, c.z, 1.0).applyMatrix4(inv);
                if (_v.x < -0.5 || _v.x > 0.5 ||
                    _v.y < -0.5 || _v.y > 0.5 ||
                    _v.z < -0.5 || _v.z > 0.5) {
                    allInside = false;
                    break;
                }
            }
            if (allInside) return true;
        }
        return false;
    }
}

async function classifyInRadius(pointcloud, centerWorld, radius, classification) {
  // Raise load concurrency for the duration of the stroke (restored in finally).
  const _savedMaxNodesLoading = Potree.maxNodesLoading;
  Potree.maxNodesLoading = Math.max(Potree.maxNodesLoading, BRUSH_MAX_NODES_LOADING);

  // ── Optional profiler (set window.BRUSH_PROFILE = true to enable) ──
  // Characterizes where a stroke's time goes: nodes visited vs force-loaded vs
  // bulk-marked, and wall time spent awaiting network loads vs total. Zero cost
  // when disabled. Logs one line per stroke to the console.
  const _prof = window.BRUSH_PROFILE ? {
      t0: performance.now(), visited: 0, loaded: 0, bulk: 0, partial: 0,
      netMs: 0, points: 0
  } : null;

  // #5: Coalesce per-node classification-buffer uploads. Instead of setting
  // needsUpdate per node mid-traversal, collect dirtied attributes and flush them
  // at await boundaries (so resident work still paints during network waits) and
  // once at stroke end. Declared before the try so the finally can flush them.
  const _dirtyAttrs = new Set();
  const flushDirty = () => {
      if (_dirtyAttrs.size === 0) return;
      for (const attr of _dirtyAttrs) attr.needsUpdate = true;
      _dirtyAttrs.clear();
  };

  try {
    const radiusSq = radius * radius;
    const pcName   = pointcloud.name;
    const cls      = viewer.classifications;
    const editedGeoNodes = new Set();

    let pcEdits = brushEdits.get(pcName);

    const visibleLUT = new Uint8Array(256);
    let anyClassHidden = false;
    for (let k = 0; k < 256; k++) {
        const vis = (cls[k]?.visible !== false) ? 1 : 0;
        visibleLUT[k] = vis;
        if (!vis) anyClassHidden = true;
    }

    const ensurePcEdits = () => {
        if (!pcEdits) { pcEdits = new Map(); brushEdits.set(pcName, pcEdits); }
        return pcEdits;
    };

    // Scratch objects — reused across all processNode calls
    const _boxWorld      = new THREE.Box3();
    const _nodeMatrix    = new THREE.Matrix4();
    const _matrixWorld   = new THREE.Matrix4();
    const _inverseMatrix = new THREE.Matrix4();
    const _localCenter   = new THREE.Vector3();

    // ── Local-space brush center + radius (computed once per stroke) ──
    // Transform the brush center into pointcloud-local space a single time so the
    // per-node AABB prune and full-containment test need no matrix work at all.
    // This reproduces the old world-space test exactly: a node is rejected iff its
    // world-space box distance to centerWorld exceeds radius, since a similarity
    // transform (rotation + uniform scale + translation) maps spheres to spheres
    // and scales all distances by _pcScale.
    const _pcInverse     = new THREE.Matrix4().copy(pointcloud.matrixWorld).invert();
    const _centerPcLocal = new THREE.Vector3().copy(centerWorld).applyMatrix4(_pcInverse);
    const _e = pointcloud.matrixWorld.elements;
    const _pcScale       = Math.sqrt(_e[0]*_e[0] + _e[1]*_e[1] + _e[2]*_e[2]) || 1; // uniform scale
    const _radiusLocal   = radius / _pcScale;
    const _radiusLocalSq = _radiusLocal * _radiusLocal;

    let toClip = false;
    const clipVolumes = [];
    const clipInverses = [];
    const clipShowInside = viewer.clipTask === 2;
    if(viewer.scene.volumes.length != 0 && viewer.clipTask > 1){
        viewer.scene.volumes.forEach(volume => {
            if(volume._clip){           // if there is at least one clipping box
                toClip = true;
                clipVolumes.push(volume);
                volume.updateMatrixWorld();
                clipInverses.push(volume.matrixWorld.clone().invert());
            }
        });
    }

    async function processNode(geoNode, inheritedBaseline) {
        if (!geoNode) return;

        const localBox = geoNode.boundingBox;   // pointcloud-local, no per-node transform

        // ── Tier 1: AABB prune — entirely in pointcloud-local space.
        // Equivalent to the old world-space test, but with zero matrix work per node.
        if (boxDistSqLocal(localBox, _centerPcLocal.x, _centerPcLocal.y, _centerPcLocal.z) > _radiusLocalSq) return;

        // The world-space box is only needed for clip tests; build it lazily.
        if (toClip) {
            _boxWorld.copy(localBox).applyMatrix4(pointcloud.matrixWorld);
            if (isNodeFullyClipped(_boxWorld, clipInverses, clipShowInside)) return;
        }

        const nodeName = geoNode.name;
        let ownEntry = pcEdits?.get(nodeName);
        const effectiveBaseline = isAllEntry(ownEntry) ? ownEntry.classification : inheritedBaseline;

        if (_prof) _prof.visited++;

        let skipDistanceTest = false;

        if (boxFullyInsideSphere(localBox, _centerPcLocal, _radiusLocalSq)) {
            ensurePcEdits();
            // console.log("node fully inside", geoNode);
            if (isAllEntry(ownEntry)
                && ownEntry.classification === classification
                && !ownEntry.overrides) return;

            let canBulk = false;

            if (isAllEntry(ownEntry) && !ownEntry.overrides) {
                // Pure all — composition is a single class
                canBulk = visibleLUT[ownEntry.classification] === 1;
            } else if (isAllEntry(ownEntry) && ownEntry.overrides) {
                // Hybrid — baseline and every override class must be visible
                canBulk = visibleLUT[ownEntry.classification] === 1;
                if (canBulk) {
                    for (const edit of ownEntry.overrides.values()) {
                        if (!visibleLUT[edit.classification]) { canBulk = false; break; }
                    }
                }
            } else if (!ownEntry && effectiveBaseline !== null) {
                // Inherited baseline — composition is the baseline class
                canBulk = visibleLUT[effectiveBaseline] === 1;
            } else {
                // Fresh (no entry, no inheritance) or pure-Map: composition includes
                // unknown LAS originals. Safe to bulk only when nothing is hidden —
                // then there's nothing to preserve and we skip the whole subtree walk.
                canBulk = !anyClassHidden;
            }

            if (canBulk && toClip) {
                // If any clip volume intersects this node, some points may be
                // clipped (invisible) — can't bulk-fill without classifying hidden points.
                for (let ci = 0; ci < clipInverses.length; ci++) {
                    const inv = clipInverses[ci];
                    let minX = Infinity, maxX = -Infinity;
                    let minY = Infinity, maxY = -Infinity;
                    let minZ = Infinity, maxZ = -Infinity;
                    const _v = new THREE.Vector4();
                    for (let k = 0; k < 8; k++) {
                        _v.set(
                            k & 1 ? _boxWorld.max.x : _boxWorld.min.x,
                            k & 2 ? _boxWorld.max.y : _boxWorld.min.y,
                            k & 4 ? _boxWorld.max.z : _boxWorld.min.z,
                            1.0
                        ).applyMatrix4(inv);
                        if (_v.x < minX) minX = _v.x; if (_v.x > maxX) maxX = _v.x;
                        if (_v.y < minY) minY = _v.y; if (_v.y > maxY) maxY = _v.y;
                        if (_v.z < minZ) minZ = _v.z; if (_v.z > maxZ) maxZ = _v.z;
                    }
                    if (maxX >= -0.5 && minX <= 0.5 &&
                        maxY >= -0.5 && minY <= 0.5 &&
                        maxZ >= -0.5 && minZ <= 0.5) {
                        canBulk = false;
                        break;
                    }
                }
            }
            
            if (canBulk) {
                const prefix = nodeName;
                for (const name of pcEdits.keys()) {
                    if (name.length > prefix.length && name.startsWith(prefix)) {
                        pcEdits.delete(name);
                    }
                }
                pcEdits.set(prefix, { all: true, classification });
                fillLoadedSubtree(geoNode, classification);
                if (_prof) _prof.bulk++;
                return;
            }

            skipDistanceTest = true;
        }

        // ── Partial intersection ──
        let justLoaded = false;
        if (!geoNode.loaded) {
            flushDirty();              // paint resident work done so far during the wait
            if (_prof) { _prof.loaded++; const _tNet = performance.now(); await waitForLoad(geoNode); _prof.netMs += performance.now() - _tNet; }
            else       { await waitForLoad(geoNode); }
            justLoaded = true;         // onNodeLoaded → reconcileFreshNode already filled
                                       // this buffer from the current ledger (#4)
        }
        if (!geoNode.geometry) return;

        const classAttr = geoNode.geometry.attributes['classification'];
        const positions = geoNode.geometry.attributes.position;
        if (!classAttr) return;

        if (_prof) { _prof.partial++; _prof.points += positions.count; }

        let ownOverrides = getOverrides(ownEntry);

        // #4: a freshly-loaded node was just reconciled from the same ledger state we
        // would apply here, so the buffer already matches — re-filling is redundant.
        if (!justLoaded && (effectiveBaseline !== null || ownOverrides)) {
            applyLedgerToNode(geoNode, pcEdits, effectiveBaseline, ownEntry);
        }

        let cx, cy, cz;
        if (!skipDistanceTest) {
            const bbMin = geoNode.boundingBox.min;
            _nodeMatrix.makeTranslation(bbMin.x, bbMin.y, bbMin.z);
            _matrixWorld.multiplyMatrices(pointcloud.matrixWorld, _nodeMatrix);
            _inverseMatrix.copy(_matrixWorld).invert();
            _localCenter.copy(centerWorld).applyMatrix4(_inverseMatrix);
            cx = _localCenter.x; cy = _localCenter.y; cz = _localCenter.z;
        }

        const arr      = positions.array;
        const classArr = classAttr.array;
        const count    = positions.count;

        let anyChanged = false;

        // ── Per-node clip matrices: localPos → clipBox local space ──
        let clipNodeMatrices = null;
        if (toClip) {
            // Build nodeMatrix if we haven't already (skipDistanceTest skips it)
            if (skipDistanceTest) {
                const bbMin = geoNode.boundingBox.min;
                _nodeMatrix.makeTranslation(bbMin.x, bbMin.y, bbMin.z);
                _matrixWorld.multiplyMatrices(pointcloud.matrixWorld, _nodeMatrix);
            }
            // Compose: clipInverse * pointcloud.matrixWorld * nodeTranslation
            // so we can go straight from local position → clip-box space
            clipNodeMatrices = clipInverses.map(inv => 
                new THREE.Matrix4().multiplyMatrices(inv, _matrixWorld)
            );
        }

        for (let i = 0; i < count; i++) {
            const currentClass = classArr[i];
            if (currentClass === classification) continue;
            if (!visibleLUT[currentClass])       continue;

            if (!skipDistanceTest) {
                const ix = 3 * i;
                const dx = arr[ix]     - cx;
                const dy = arr[ix + 1] - cy;
                const dz = arr[ix + 2] - cz;
                if (dx*dx + dy*dy + dz*dz > radiusSq) continue;
            }

            // ── Per-point clip test ──
            if (clipNodeMatrices) {
                const ix = 3 * i;
                const px = arr[ix], py = arr[ix+1], pz = arr[ix+2];
                let insideAny = false;
                for (let ci = 0; ci < clipNodeMatrices.length; ci++) {
                    const e = clipNodeMatrices[ci].elements;
                    const cx_ = e[0]*px + e[4]*py + e[8]*pz  + e[12];
                    const cy_ = e[1]*px + e[5]*py + e[9]*pz  + e[13];
                    const cz_ = e[2]*px + e[6]*py + e[10]*pz + e[14];
                    const EPS = 0.001;
                    if (cx_ >= -0.5 - EPS && cx_ <= 0.5 + EPS &&
                        cy_ >= -0.5 - EPS && cy_ <= 0.5 + EPS &&
                        cz_ >= -0.5 - EPS && cz_ <= 0.5 + EPS) {
                        insideAny = true;
                        break;
                    }
                }
                // SHOW_INSIDE: visible only if inside a volume
                // SHOW_OUTSIDE: visible only if outside all volumes
                const pointVisible = clipShowInside ? insideAny : !insideAny;
                if (!pointVisible) continue;
            }

            const existing = ownOverrides?.get(i);
            if (existing?.classification === classification) continue;

            classArr[i] = classification;
            anyChanged = true;

            if(!ownOverrides){
                if (isAllEntry(ownEntry)) {
                    ownEntry.overrides = new Map();
                    ownOverrides = ownEntry.overrides;
                } else {
                    ownOverrides = new Map();
                    ensurePcEdits();
                    pcEdits.set(nodeName, ownOverrides);
                    ownEntry = ownOverrides;
                }
            }
            ownOverrides.set(i, { classification });
            editedGeoNodes.add(geoNode);
        }

        if (anyChanged) _dirtyAttrs.add(classAttr);   // #5: flushed at await boundaries / stroke end

        const childPromises = [];
        for (let i = 0; i < 8; i++) {
            if (geoNode.children[i]) childPromises.push(processNode(geoNode.children[i], effectiveBaseline));
        }
        if (childPromises.length > 0) await Promise.all(childPromises);
    }

    await processNode(pointcloud.pcoGeometry.root, null);

    // Promotion pass — direct geoNode refs, no findGeoNode search
    if (pcEdits) {
        for (const geoNode of editedGeoNodes) {
            if (geoNode.loaded) explicitToImplicitNode(geoNode, pcEdits);
        }
    }

    updateEditCount();
  } finally {
    // Flush any remaining classification-buffer changes (#5), restore steady-state
    // concurrency, and let render-driven loads resume.
    flushDirty();
    Potree.maxNodesLoading = _savedMaxNodesLoading;
    pumpLoadQueue();

    if (_prof) {
        const total = (performance.now() - _prof.t0).toFixed(1);
        // netMs is summed across concurrent awaits, so it can exceed wall time —
        // read it as "aggregate node-load wait", not wall-clock network time.
        console.log(
            `[brush] stroke ${total}ms | visited ${_prof.visited}, ` +
            `bulk ${_prof.bulk}, partial ${_prof.partial}, force-loaded ${_prof.loaded} | ` +
            `points tested ${_prof.points}, aggregate load-wait ${_prof.netMs.toFixed(1)}ms`
        );
    }
  }
}

// Resolve which pointcloud (by your ledger key) owns this geometry node.
// Potree 2.0 nodes point at their geometry via octreeGeometry, COPC nodes via owner.
function pointcloudNameForGeoNode(geoNode) {
    const geom = geoNode.octreeGeometry ?? geoNode.owner;
    for (const pc of viewer.scene.pointclouds) {
        if (pc.pcoGeometry === geom) return pc.name;
    }
    return null;
}

// Single-node version of applyEditsToLoadedNodes — runs the instant a buffer is born.
function reconcileFreshNode(geoNode) {
    if (brushEdits.size === 0) return;
    const pcName = pointcloudNameForGeoNode(geoNode);
    if (!pcName) return;
    const pcEdits = brushEdits.get(pcName);
    if (!pcEdits) return;
    applyLedgerToNode(geoNode, pcEdits);   // handles baseline + overrides
    explicitToImplicitNode(geoNode, pcEdits);   // only here, not mid-stroke

}

// Register the hook once at startup. Chain onto any existing handler and, crucially,
// pump our load queue the instant a node finishes — this is what makes loading
// event-driven instead of polled.
const _prevOnNodeLoaded = Potree.onNodeLoaded;
Potree.onNodeLoaded = function (node) {
    if (_prevOnNodeLoaded) {
        try { _prevOnNodeLoaded(node); } catch (e) { console.error(e); }
    }
    reconcileFreshNode(node);   // fill the freshly-born buffer from the ledger
    _resolveNode(node);         // wake anyone awaiting this node
    pumpLoadQueue();            // a load slot just freed — start the next queued node
};

function setStrokeIndicator(active) {
    const el = document.getElementById("brushStrokeIndicator");
    if (el) {
        if (active) el.classList.add("active");
        else el.classList.remove("active");
    }
}

/**
 * Drop-in replacement for printImplicitExplicitNodes() in brush_selection.js.
 *
 * Counts with the ledger's actual semantics: a point's class is its own override
 * if one exists, else the nearest "all" baseline at or above its node, else the
 * untouched LAS value. One DFS over the loaded hierarchy carries the effective
 * baseline down, so every point is counted exactly once and "assigned" can never
 * exceed the hierarchy. O(nodes + overrides); no findGeoNode() full-tree searches.
 *
 * Old → new field meanings:
 *   redundant      → split into nestedSame (truly prunable: same class as the
 *                    nearest baseline above) and nestedDiff (a real class change)
 *   editedPoints   → assigned (points whose class comes from the ledger)
 *   classes        → effective class of every assigned point; sums to `assigned`
 */
function printImplicitExplicitNodes() {
    const totals = {
        pointclouds: 0, entries: 0, pureImplicit: 0, hybrid: 0, explicit: 0,
        nestedSame: 0, nestedDiff: 0, unresolved: 0,
        pointEntries: 0, noopOverrides: 0,
        assigned: 0, untouched: 0,
        hierarchyNodes: 0, hierarchyPoints: 0, cloudPoints: 0,
    };
    const rows = [];

    for (const pointcloud of viewer.scene.pointclouds) {
        const pcEdits = brushEdits.get(pointcloud.name);
        if (!pcEdits) continue;
        totals.pointclouds++;

        const s = {
            name: pointcloud.name, entries: pcEdits.size,
            pureImplicit: 0, hybrid: 0, explicit: 0,
            nestedSame: 0,      // "all" entry whose class equals the baseline it sits under
            nestedDiff: 0,      // "all" entry that changes the inherited class
            reached: 0,         // entries whose node exists in the loaded hierarchy
            pointEntries: 0,    // stored per-point overrides (hybrid + explicit)
            noopOverrides: 0,   // overrides equal to the baseline they sit on
            assigned: 0,        // points whose class comes from the ledger
            untouched: 0,       // points still at their LAS original
            hierarchyNodes: 0, hierarchyPoints: 0,
            classes: new Map(),
        };
        const bump = (c, k) => { if (k > 0) s.classes.set(c, (s.classes.get(c) || 0) + k); };

        for (const entry of pcEdits.values()) {
            if (!isAllEntry(entry))         s.explicit++;
            else if (entry.overrides?.size) s.hybrid++;
            else                            s.pureImplicit++;
        }

        (function walk(node, baseline) {
            if (!node) return;
            const n = geoNodeNumPoints(node);   // 0 for unloaded COPC nodes
            s.hierarchyNodes++;
            s.hierarchyPoints += n;

            const entry = pcEdits.get(node.name);
            if (entry) s.reached++;
            if (isAllEntry(entry)) {
                if (baseline !== null) {
                    if (entry.classification === baseline) s.nestedSame++;
                    else                                   s.nestedDiff++;
                }
                baseline = entry.classification;
            }

            const overrides = getOverrides(entry);
            const ov = overrides ? overrides.size : 0;
            if (overrides) {
                s.pointEntries += ov;
                for (const edit of overrides.values()) {
                    bump(edit.classification, 1);
                    if (edit.classification === baseline) s.noopOverrides++;
                }
            }

            if (baseline !== null) {
                bump(baseline, n - ov);         // overrides repaint points the baseline covers
                s.assigned += Math.max(n, ov);
            } else {
                s.assigned  += ov;
                s.untouched += Math.max(0, n - ov);
            }

            for (let i = 0; i < 8; i++) walk(node.children?.[i], baseline);
        })(pointcloud.pcoGeometry.root, null);

        s.unresolved  = s.entries - s.reached;
        s.cloudPoints = pointcloud.pcoGeometry?.loader?.metadata?.points
                     ?? pointcloud.pcoGeometry?.copc?.header?.pointCount
                     ?? pointcloud.pcoGeometry?.numPoints
                     ?? s.hierarchyPoints;
        s.loadedNodes = pointcloud.visibleNodes?.length || 0;
        rows.push(s);

        for (const k of ["entries", "pureImplicit", "hybrid", "explicit", "nestedSame", "nestedDiff",
                         "unresolved", "pointEntries", "noopOverrides", "assigned", "untouched",
                         "hierarchyNodes", "hierarchyPoints", "cloudPoints"]) {
            totals[k] += s[k];
        }
    }

    const n   = v => (v ?? 0).toLocaleString();
    const pct = (a, b) => b > 0 ? `${(100 * a / b).toFixed(3)}%` : "n/a";

    console.group("brush ledger stats");
    for (const s of rows) {
        console.group(s.name);
        console.log(`entries:   ${n(s.entries)} — ${n(s.pureImplicit)} pure implicit, ${n(s.hybrid)} hybrid, ${n(s.explicit)} explicit` +
                    (s.unresolved ? `, ${n(s.unresolved)} not in loaded hierarchy` : ""));
        console.log(`nested:    ${n(s.nestedDiff)} baselines change the inherited class, ` +
                    `${n(s.nestedSame)} repeat it (prunable)`);
        console.log(`overrides: ${n(s.pointEntries)} stored` +
                    (s.noopOverrides ? `, ${n(s.noopOverrides)} equal to their baseline (prunable)` : ""));
        console.log(`assigned:  ${n(s.assigned)} points take their class from the ledger ` +
                    `(${pct(s.assigned, s.cloudPoints)} of cloud); ${n(s.untouched)} still at LAS original`);
        console.log(`cloud:     ${n(s.cloudPoints)} points, ${n(s.hierarchyPoints)} in loaded hierarchy ` +
                    `across ${n(s.hierarchyNodes)} nodes, ${n(s.loadedNodes)} visible`);
        if (s.classes.size) {
            console.log("classes:   " + [...s.classes.entries()].sort((a, b) => b[1] - a[1])
                .map(([c, k]) => `${c}: ${n(k)} (${pct(k, s.assigned)})`).join(", "));
        }
        console.groupEnd();
    }
    if (rows.length === 0) console.log("no ledger entries");
    console.log(`TOTAL across ${n(totals.pointclouds)} pointcloud(s): ${n(totals.entries)} entries, ` +
                `${n(totals.pointEntries)} stored overrides, ${n(totals.assigned)} assigned points of ` +
                `${n(totals.cloudPoints)} (${pct(totals.assigned, totals.cloudPoints)})`);
    console.groupEnd();

    return totals;
}

function removeExplicitNodes(){
    for(const pointcloud of viewer.scene.pointclouds) {
        const pcEdits = brushEdits.get(pointcloud.name);
        if(!pcEdits) continue;

        for(const [node, obj] of pcEdits){
            if(obj instanceof Map) pcEdits.delete(node);
        }
    }
}

function removeImplicitNodes(){
    for(const pointcloud of viewer.scene.pointclouds) {
        const pcEdits = brushEdits.get(pointcloud.name);
        if(!pcEdits) continue;

        for(const [node, obj] of pcEdits){
            if(!(obj instanceof Map)) pcEdits.delete(node);
        }
    }
}

let _pendingPaint = null;

async function paintAtPoint(pointcloud, hit) {
    if (brushState.strokeInProgress) {
        // Don't drop — remember the most recent target and apply it when free
        _pendingPaint = { pointcloud, position: hit.position.clone() };
        return;
    }

    brushState.strokeInProgress = true;
    setStrokeIndicator(true);
    viewer.renderer.domElement.style.cursor = 'progress';

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
        viewer.renderer.domElement.style.cursor = '';

        // Drain the most recent pending paint, if any
        if (_pendingPaint) {
            const { pointcloud: pc, position } = _pendingPaint;
            _pendingPaint = null;
            paintAtPoint(pc, { position });
        }
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

        // also clear the back-reference on any tile volumes still in the scene
        for (const v of viewer.scene.volumes) if (v._tileLabel) v._tileLabel = null;

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
                const [, letter, number] = sub.name.split("_");
                const label = createTileLabel(`${letter}${number}`, sub);
                viewer.scene.scene.add(label);
                sub._tileLabel = label;
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
    sub.clipTask = 2;
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


function showAllClassifications() {
    for (const key of Object.keys(viewer.classifications)) {
        viewer.setClassificationVisibility(key, true);
    }
    // Sync the checkbox UI if the panel is open
    const grid = document.getElementById("brushClassGrid");
    if (grid) grid.querySelectorAll(".brush-vis-checkbox").forEach(chk => { chk.checked = true; });
    const toggleAll = document.querySelector("#brushPanel .brush-toggle-row + div .brush-vis-checkbox");
    if (toggleAll) toggleAll.checked = true;
}

const RADIUS_MIN = 0.001;          // 1 mm — lower to 0.0001 for sub-mm
const RADIUS_MAX = 100;             // 50 m
const RADIUS_STEP_FACTOR = 1.2;    // Q/E change ~20% per press (tune to taste)

const _radiusLogSpan = Math.log(RADIUS_MAX / RADIUS_MIN);

// slider position (0..1) ↔ radius, log-scaled
function sliderToRadius(s) { return RADIUS_MIN * Math.exp(_radiusLogSpan * s); }
function radiusToSlider(r) {
    r = Math.min(RADIUS_MAX, Math.max(RADIUS_MIN, r));
    return Math.log(r / RADIUS_MIN) / _radiusLogSpan;
}

// adaptive decimals so small values stay readable
function formatRadius(r) {
    if (r < 0.001) return r.toFixed(5);
    if (r < 0.01)  return r.toFixed(4);
    if (r < 0.1)   return r.toFixed(3);
    if (r < 1)     return r.toFixed(2);
    return r.toFixed(1);
}

// ══════════════════════════════════════════════════════════════
//  Shortcut Guide
//
//  A read-only map of the bindings registered further down this file
//  and in oriented_image_panel.js. It listens for nothing itself, so
//  when a binding changes these tables must be edited to match.
// ══════════════════════════════════════════════════════════════

const HELP_GROUPS = [
    {
        title: "Brush",
        color: "#6e6bff",
        rows: [
            { keys: ["Z"],                  desc: "Toggle the brush on / off" },
            { keys: ["Q"],                  desc: "Shrink the brush radius" },
            { keys: ["E"],                  desc: "Grow the brush radius" },
            { keys: ["Ctrl/Cmd", "Scroll"], desc: "Resize the brush mid-stroke" },
            { keys: ["W"],                  desc: "Cycle RGB / classification blend" },
            { keys: ["1", "9"], sep: "–",   desc: "Switch the paint classification (first 9 classes)" },
        ],
    },
    {
        title: "Painting",
        color: "#37b45f",
        rows: [
            { keys: ["Ctrl/Cmd", "Drag"],  desc: "Paint the selected class" },
            { keys: ["Ctrl/Cmd", "Click"], desc: "Paint a single spot" },
        ],
    },
    {
        title: "Photos",
        color: "#f08c28",
        rows: [
            { keys: ["Shift"],          desc: "Name the nearest photo to the cursor" },
            { keys: ["Shift", "Click"], desc: "Jump into that photo's view" },
            { keys: ["Esc"],            desc: "Leave photo view" },
            { keys: ["←", "→"], sep: "/", desc: "Previous / next photo" },
            { keys: ["Space"],          desc: "Hold to peek at the cloud behind" },
            { keys: ["[", "]"], sep: "/", desc: "Nudge photo opacity down / up" },
            { keys: ["W"],              desc: "Cycle photo opacity, in photo view" },
        ],
    },
    {
        title: "Camera",
        color: "#8b8b96",
        rows: [
            { keys: ["Drag"],       desc: "Orbit" },
            { keys: ["Right-drag"], desc: "Pan" },
            { keys: ["Scroll"],     desc: "Zoom" },
        ],
    },
];

// Which tint each key wears on the diagram; anything absent stays dim.
const HELP_KEY_GROUP = {
    "Z": "brush", "Q": "brush", "E": "brush", "W": "brush",
    "Ctrl": "paint", "Shift": "paint",
    "Esc": "image", "[": "image", "]": "image",
    "Space": "image", "←": "image", "→": "image",
};

const HELP_KB_ROWS = [
    ["Esc"],
    ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P", "[", "]"],
    ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
    ["Z", "X", "C", "V", "B", "N", "M"],
    [{ label: "Ctrl", width: 58 }, { label: "Space", width: 180 }, { label: "Shift", width: 58 },
     { gap: true }, "←", "↑", "↓", "→"],
];

// Legend key label → the diagram element it lights up.
const HELP_HK_TARGET = {
    "Ctrl/Cmd":   "Ctrl",
    "Drag":       "Mouse:left",
    "Click":      "Mouse:left",
    "Right-drag": "Mouse:right",
    "Scroll":     "Mouse:wheel",
};

const HELP_MOUSE_SVG = `
<svg viewBox="0 0 120 180">
    <defs>
        <clipPath id="brushHelpMouseClip">
            <rect x="12" y="8" width="96" height="164" rx="46"/>
        </clipPath>
    </defs>
    <g clip-path="url(#brushHelpMouseClip)">
        <rect class="part" data-hk="Mouse:left"  x="12" y="8"  width="47" height="64"  fill="rgba(45,160,80,0.32)"/>
        <rect class="part" data-hk="Mouse:right" x="61" y="8"  width="47" height="64"  fill="rgba(255,255,255,0.07)"/>
        <rect                                    x="12" y="72" width="96" height="100" fill="rgba(255,255,255,0.04)"/>
    </g>
    <line class="divider" x1="60" y1="8"  x2="60"  y2="72"/>
    <line class="divider" x1="12" y1="72" x2="108" y2="72"/>
    <rect class="part" data-hk="Mouse:wheel" x="52" y="22" width="16" height="34" rx="8"
          fill="rgba(79,70,229,0.6)" stroke="rgba(255,255,255,0.25)" stroke-width="1.5"/>
    <rect class="outline" x="12" y="8" width="96" height="164" rx="46"/>
</svg>`;

function openShortcutsHelp() {
    const existing = document.getElementById("brushHelpOverlay");
    if (existing) {
        existing.classList.remove("open");
        setTimeout(() => existing.remove(), 200);
        return;
    }

    const overlay = document.createElement("div");
    overlay.id = "brushHelpOverlay";
    overlay.className = "brush-help-overlay";

    const card = document.createElement("div");
    card.className = "brush-help";

    // ── Header ──
    const header = document.createElement("div");
    header.className = "brush-editor-header";

    const title = document.createElement("span");
    title.className = "brush-editor-title";
    title.textContent = "Keyboard & Mouse Shortcuts";
    header.appendChild(title);

    const closeBtn = document.createElement("button");
    closeBtn.className = "brush-close";
    closeBtn.textContent = "×";
    closeBtn.addEventListener("click", close);
    header.appendChild(closeBtn);
    card.appendChild(header);

    const body = document.createElement("div");
    body.className = "brush-help-body";

    // ── Keyboard diagram ──
    const kb = document.createElement("div");
    kb.className = "brush-help-kb";

    for (const row of HELP_KB_ROWS) {
        const rowEl = document.createElement("div");
        rowEl.className = "brush-help-kbrow";
        if (row.length === 1) {
            rowEl.style.alignSelf = "stretch";
            rowEl.style.justifyContent = "flex-start";
        }

        for (const entry of row) {
            if (entry.gap) {
                const gap = document.createElement("span");
                gap.className = "brush-help-kbgap";
                rowEl.appendChild(gap);
                continue;
            }

            const label = entry.label || entry;
            const cap = document.createElement("span");
            cap.className = "brush-key";
            cap.dataset.hk = label;
            cap.textContent = label;

            const group = HELP_KEY_GROUP[label];
            if (group) cap.classList.add(`brush-key-${group}`);
            if (entry.width) cap.style.minWidth = `${entry.width}px`;

            rowEl.appendChild(cap);
        }
        kb.appendChild(rowEl);
    }
    body.appendChild(kb);

    // ── Mouse diagram + legend ──
    const cols = document.createElement("div");
    cols.className = "brush-help-cols";

    const mouse = document.createElement("div");
    mouse.className = "brush-help-mouse";
    const mouseLabel = document.createElement("div");
    mouseLabel.className = "brush-label";
    mouseLabel.textContent = "Mouse";
    mouse.appendChild(mouseLabel);
    mouse.insertAdjacentHTML("beforeend", HELP_MOUSE_SVG);
    cols.appendChild(mouse);

    const legend = document.createElement("div");
    legend.className = "brush-help-legend";

    for (const group of HELP_GROUPS) {
        const section = document.createElement("div");

        const groupTitle = document.createElement("div");
        groupTitle.className = "brush-help-group-title";
        const dot = document.createElement("span");
        dot.className = "brush-help-dot";
        dot.style.background = group.color;
        groupTitle.appendChild(dot);
        groupTitle.appendChild(document.createTextNode(group.title));
        section.appendChild(groupTitle);

        for (const row of group.rows) {
            const rowEl = document.createElement("div");
            rowEl.className = "brush-help-row";

            const combo = document.createElement("div");
            combo.className = "brush-help-combo";
            row.keys.forEach((key, i) => {
                if (i > 0) {
                    const sep = document.createElement("span");
                    sep.className = "brush-help-plus";
                    sep.textContent = row.sep || "+";
                    combo.appendChild(sep);
                }
                const badge = document.createElement("span");
                badge.className = "brush-hotkey";
                badge.textContent = key;
                combo.appendChild(badge);
            });
            rowEl.appendChild(combo);

            const desc = document.createElement("span");
            desc.className = "brush-help-desc";
            desc.textContent = row.desc;
            rowEl.appendChild(desc);

            // Light up whatever this row names on the two diagrams.
            const targets = row.keys.map(k => HELP_HK_TARGET[k] || k);
            rowEl.addEventListener("mouseenter", () => setHelpHighlight(card, targets, true));
            rowEl.addEventListener("mouseleave", () => setHelpHighlight(card, targets, false));

            section.appendChild(rowEl);
        }
        legend.appendChild(section);
    }
    cols.appendChild(legend);
    body.appendChild(cols);

    const foot = document.createElement("div");
    foot.className = "brush-help-foot";
    foot.textContent = "Shortcuts pause while you are typing in a text field.";
    body.appendChild(foot);

    card.appendChild(body);
    overlay.appendChild(card);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("open"));

    function close() {
        overlay.classList.remove("open");
        setTimeout(() => overlay.remove(), 200);
    }
}

function setHelpHighlight(root, targets, on) {
    for (const target of targets) {
        const el = root.querySelector(`[data-hk="${CSS.escape(target)}"]`);
        if (el) el.classList.toggle("hot", on);
    }
}

// ══════════════════════════════════════════════════════════════
//  Panel Construction
// ══════════════════════════════════════════════════════════════
let firstLoad = true;

function openBrushPanel() {
    let existing = document.getElementById("brushPanel");
    if (existing) {
        existing.classList.remove("open");
        setTimeout(() => existing.remove(), 300);
        window.brushState.active = false;
        if (brushState.sphere) brushState.sphere.visible = false;
        return;
    }
    viewer.setPointBudget(10*1000*1000);
    scaleBrushByZoom();
    showAllClassifications();
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

    const helpBtn = document.createElement("button");
    helpBtn.className = "brush-help-btn";
    helpBtn.title = "Keyboard & mouse shortcuts";
    helpBtn.textContent = "?";
    helpBtn.addEventListener("click", openShortcutsHelp);
    header.appendChild(helpBtn);

    const closeBtn = document.createElement("button");
    // ... rest of closeBtn unchanged    const closeBtn = document.createElement("button");
    closeBtn.className = "brush-close";
    closeBtn.textContent = "×";
    closeBtn.addEventListener("click", () => {
        panel.classList.remove("open");
        setTimeout(() => panel.remove(), 300);
        window.brushState.active = false;
        if (brushState.sphere) brushState.sphere.visible = false;
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
    paintHint.innerHTML = 'Hold <span class="brush-hotkey">Ctrl/Cmd</span> + drag to paint';
    panel.appendChild(paintHint);

    toggleRow.appendChild(toggle);
    panel.appendChild(toggleRow);

    // ── Pointcloud Select (searchable) ──
    const pcSection = document.createElement("div");

    const pcLabel = document.createElement("div");
    pcLabel.className = "brush-label";
    pcLabel.textContent = "Target Pointcloud";
    pcSection.appendChild(pcLabel);

    const pcWrapper = document.createElement("div");
    pcWrapper.style.cssText = "position:relative;";

    const pcInput = document.createElement("input");
    pcInput.type = "text";
    pcInput.className = "brush-select";
    pcInput.id = "brushPCSelect";
    pcInput.placeholder = "All Visible Pointclouds";
    pcInput.style.cursor = "text";
    pcInput.style.boxSizing = "border-box";   // ← add this
    pcInput.autocomplete = "off";

    const pcDropdown = document.createElement("div");
    pcDropdown.style.cssText = `
        display:none; position:fixed; z-index:10900;
        max-height: 180px; overflow-y:auto;
        border-radius: 8px;
        background: rgba(22,22,30,0.95);
        backdrop-filter: blur(12px);
        border: 1px solid rgba(255,255,255,0.12);
        box-shadow: 0 8px 24px rgba(0,0,0,0.5);
        scrollbar-width: thin;
        scrollbar-color: rgba(255,255,255,0.15) transparent;
    `;

    function positionDropdown() {
        const rect = pcInput.getBoundingClientRect();
        pcDropdown.style.left   = rect.left + "px";
        pcDropdown.style.top    = (rect.bottom + 4) + "px";
        pcDropdown.style.width  = rect.width + "px";
    }

    function buildOptions(filter) {
        pcDropdown.innerHTML = "";
        const term = (filter || "").toLowerCase();

        const allItem = document.createElement("div");
        allItem.textContent = "All Visible Pointclouds";
        allItem.dataset.value = "__all__";
        allItem.style.cssText = optionStyle(false);
        if (!term || "all visible pointclouds".includes(term)) pcDropdown.appendChild(allItem);

        for (const pc of viewer.scene.pointclouds) {
            if (term && !pc.name.toLowerCase().includes(term)) continue;
            const item = document.createElement("div");
            item.textContent = pc.name;
            item.dataset.value = pc.name;
            item.style.cssText = optionStyle(false);
            pcDropdown.appendChild(item);
        }

        if (pcDropdown.children.length === 0) {
            const empty = document.createElement("div");
            empty.textContent = "No matches";
            empty.style.cssText = "padding:8px 12px; color:#666; font-size:13px; font-style:italic;";
            pcDropdown.appendChild(empty);
        }
    }

    function optionStyle(hover) {
        return `
            padding: 8px 12px; font-size: 13px; cursor: pointer;
            color: ${hover ? "#fff" : "#ccc"};
            background: ${hover ? "rgba(79,70,229,0.35)" : "transparent"};
            transition: background 0.1s, color 0.1s;
        `;
    }

    pcDropdown.addEventListener("mouseover", (e) => {
        const item = e.target.closest("[data-value]");
        if (item) item.style.cssText = optionStyle(true);
    });
    pcDropdown.addEventListener("mouseout", (e) => {
        const item = e.target.closest("[data-value]");
        if (item) item.style.cssText = optionStyle(false);
    });

    pcDropdown.addEventListener("click", (e) => {
        const item = e.target.closest("[data-value]");
        if (!item) return;
        const val = item.dataset.value;
        window.brushState.targetPointcloud = val === "__all__" ? null : val;
        pcInput.value = val === "__all__" ? "" : val;
        pcInput.placeholder = val === "__all__" ? "All Visible Pointclouds" : val;
        pcDropdown.style.display = "none";
    });

    pcInput.addEventListener("focus", () => {
        buildOptions(pcInput.value);
        positionDropdown();
        pcDropdown.style.display = "block";
    });

    pcInput.addEventListener("input", () => {
        buildOptions(pcInput.value);
        positionDropdown();
        pcDropdown.style.display = "block";
    });

    document.addEventListener("mousedown", (e) => {
        if (!pcWrapper.contains(e.target) && !pcDropdown.contains(e.target)) {
            pcDropdown.style.display = "none";
        }
    });

    pcWrapper.appendChild(pcInput);
    document.body.appendChild(pcDropdown);   // mount on body, not inside the panel
    pcSection.appendChild(pcWrapper);
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

        btn.addEventListener("click", () => selectBrushClassification(cls.value));

        grid.appendChild(btn);
    }
    classSection.appendChild(grid);
    panel.appendChild(classSection);

    // ── Radius Slider ──
    const radiusSection = document.createElement("div");

    const radiusLabel = document.createElement("div");
    radiusLabel.className = "brush-label";
    radiusLabel.innerHTML = 'Brush Radius <span class="brush-hotkey">Q</span> <span class="brush-hotkey">E</span> <span class="brush-hotkey">Ctrl+Scroll</span>';
    radiusSection.appendChild(radiusLabel);

    const sliderRow = document.createElement("div");
    sliderRow.className = "brush-slider-row";

    const slider = document.createElement("input");
    slider.type = "range";
    slider.className = "brush-slider";
    slider.min = "0";
    slider.max = "1";
    slider.step = "any";              // continuous — no stepping constraint
    slider.value = radiusToSlider(window.brushState.radius);

    slider.addEventListener("input", () => {
        const v = sliderToRadius(parseFloat(slider.value));
        window.brushState.radius = v;
        sliderValue.value = formatRadius(v);
        if (brushState.sphere?.visible) brushState.sphere.scale.set(v, v, v);
    });

    const sliderValue = document.createElement("input");
    sliderValue.type = "number";
    sliderValue.className = "brush-slider-value";
    sliderValue.min = 0;
    sliderValue.max = 9999999;
    sliderValue.step = "any";
    sliderValue.value = formatRadius(window.brushState.radius);
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
        let v = parseFloat(sliderValue.value);
        if (isNaN(v) || v <= 0) v = window.brushState.radius;
        window.brushState.radius = v;
        slider.value = radiusToSlider(v);    // slider display clamps to [RADIUS_MIN, RADIUS_MAX]
        sliderValue.value = formatRadius(v); // preserves precision, no forced rounding
    });

    sliderValue.addEventListener("input", () => {
        const v = parseFloat(sliderValue.value);
        if (isNaN(v) || v <= 0) return;      // no clamping — let the user finish typing
        window.brushState.radius = v;
        // slider.value = radiusToSlider(v);
        if (brushState.sphere?.visible) brushState.sphere.scale.set(v, v, v);
    });

    sliderRow.appendChild(slider);
    sliderRow.appendChild(sliderValue);
        const sliderUnit = document.createElement("span");
    sliderUnit.textContent = "m";
    sliderUnit.style.cssText = "font-size:13px; color:#666; flex-shrink:0;";
    sliderRow.appendChild(sliderUnit);
    radiusSection.appendChild(sliderRow);
    panel.appendChild(radiusSection);

    // ── RGB / Classification Blend ──
    const blendSection = document.createElement("div");

    const blendLabel = document.createElement("div");
    blendLabel.className = "brush-label";
    blendLabel.innerHTML = 'RGB / Classification Blend <span class="brush-hotkey">W</span>';
    blendSection.appendChild(blendLabel);

    const blendSliderRow = document.createElement("div");
    blendSliderRow.className = "brush-slider-row";

    const blendSlider = document.createElement("input");
    blendSlider.type = "range";
    blendSlider.id = "brushClassBlendSlider";
    blendSlider.className = "brush-slider";
    blendSlider.min = "0";
    blendSlider.max = "1";
    blendSlider.step = "0.01";
    blendSlider.value = String(window.brushState.classBlend);
    blendSlider.title = "Blend RGB color with classification color, across all currently visible point clouds";
    blendSlider.addEventListener("input", () => setClassBlend(parseFloat(blendSlider.value)));
    blendSliderRow.appendChild(blendSlider);

    const blendValue = document.createElement("span");
    blendValue.className = "brush-slider-value";
    blendValue.id = "brushClassBlendValue";
    blendValue.textContent = Math.round(window.brushState.classBlend * 100) + "% Class";
    blendValue.title = "Cycle blend: 100% RGB / 50-50 / 100% Classification (W)";
    blendValue.style.cursor = "pointer";
    blendValue.addEventListener("click", () => toggleClassBlendCycle());
    blendSliderRow.appendChild(blendValue);

    blendSection.appendChild(blendSliderRow);
    panel.appendChild(blendSection);

    // ── Divider ──
    const divider = document.createElement("div");
    divider.className = "brush-divider";
    panel.appendChild(divider);

    // // ── Edit Count ──
    // const editCount = document.createElement("div");
    // editCount.className = "brush-edit-count";
    // editCount.id = "brushEditCount";
    // editCount.textContent = "No edits yet";
    // panel.appendChild(editCount);
    // updateEditCount();

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

    if(firstLoad){
        setContributorName(window.contributorName);
        firstLoad = false;
    }

    // ── Export buttons (two formats) ──
    const exportRow = document.createElement("div");
    exportRow.style.cssText = "display:grid; grid-template-columns:1fr 1fr; gap:6px;";

    const browserBtn = document.createElement("button");
    browserBtn.className = "brush-action-btn brush-btn-success";
    browserBtn.textContent = "Potree-Only Export";
    browserBtn.title = "Fast ledger dump. Only for re-importing into the viewer.";
    browserBtn.addEventListener("click", exportBrowserBinary);

    const pythonBtn = document.createElement("button");
    pythonBtn.className = "brush-action-btn brush-btn-success";
    pythonBtn.textContent = "World-Space Export";
    pythonBtn.title = "World-space export with AABBs + positions for downstream LAS processing.";
    pythonBtn.addEventListener("click", async () => {
        const indicator = document.getElementById("brushStrokeIndicator");
        const label = indicator?.querySelector("span:not(.brush-stroke-spinner)");
        const orig  = label?.textContent;
        setStrokeIndicator(true);
        try {
            await exportWorldSpace((done, total) => {
                if (label) label.textContent = `Writing overrides: ${done.toLocaleString()} / ${total.toLocaleString()}`;
            });
        } catch (e) {
            console.error("Python export failed:", e);
        } finally {
            if (label && orig) label.textContent = orig;
            setStrokeIndicator(false);
        }
    });

    exportRow.appendChild(browserBtn);
    exportRow.appendChild(pythonBtn);
    actions.appendChild(exportRow);

    // ── Secondary: Import / Refresh / Clear ──
    const secondaryRow = document.createElement("div");
    secondaryRow.style.cssText = "display:grid; grid-template-columns:1fr 1fr; gap:6px;";

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
        () => importEditsAny()
    ));
    secondaryRow.appendChild(makeSecondaryBtn(
        "Refresh", "rgba(220,120,30,0.25)", "#fbbf77",
        applyEditsToLoadedNodes
    ));
    // secondaryRow.appendChild(makeSecondaryBtn(
    //     "Clear", "rgba(220,38,38,0.25)", "#f87171",
    //     () => {
    //         if (getTotalEditCount() === 0) return;
    //         if (confirm("Clear edit ledger? Visual state won't revert until page reload.")) {
    //             brushEdits.clear();
    //             updateEditCount();
    //         }
    //     }
    // ));
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
    window.brushState.sphereWireframe = wireframe;
    updateBrushSphereColor();
}

/**
 * Sync the brush sphere's color with the currently selected classification.
 * Called whenever window.brushState.classification changes, or a
 * classification's color is edited.
 */
function updateBrushSphereColor() {
    const sphere = window.brushState.sphere;
    if (!sphere) return;

    const cls = CLASSIFICATIONS.find(c => c.value === window.brushState.classification);
    const color = cls ? cls.color : '#ffff00';

    sphere.material.color.set(color);
    if (window.brushState.sphereWireframe) {
        window.brushState.sphereWireframe.material.color.set(color);
    }
}

/**
 * Select a classification as the brush's active paint color — shared by the
 * class-grid click handlers and the 1-9 hotkeys so both stay in sync.
 */
function selectBrushClassification(value) {
    const grid = document.getElementById("brushClassGrid");
    if (grid) {
        grid.querySelectorAll(".brush-class-btn").forEach(b => {
            b.classList.toggle("active", String(b.dataset.value) === String(value));
        });
    }
    window.brushState.classification = value;
    updateBrushSphereColor();
}

function updateRadiusUI() {
    const slider = document.querySelector('#brushPanel .brush-slider');
    const value  = document.querySelector('#brushPanel .brush-slider-value');
    if (slider) slider.value = radiusToSlider(window.brushState.radius);
    if (value)  value.value  = formatRadius(window.brushState.radius);
}

function scaleBrushByZoom () {
    const speed = viewer.getMoveSpeed();

    const SPEED_LOW  = 5.0;
    const SPEED_HIGH = 717.5;

    const R_MIN = 0.1;   // when speed is LOW
    const R_MAX = 50;   // when speed is HIGH

    // Normalize speed → 0 to 1
    let t = (speed - SPEED_LOW) / (SPEED_HIGH - SPEED_LOW);
    t = Math.min(Math.max(t, 0), 1);

    const radius = R_MIN + t * (R_MAX - R_MIN);
    
    const r = radius * 1;
    brushState.radius = r;
    brushState.sphere.scale.set(r, r, r);
}


// ══════════════════════════════════════════════════════════════
//  Shift → Nearest Oriented Image
//
//  Holding Shift shows a tooltip naming whichever oriented image is
//  closest to the brush's current position; Shift+click jumps into that
//  image's view. Works even when the image (or its whole zone) is
//  currently hidden — OrientedImageLoader builds every image's mesh and
//  real-world .position up front regardless of visibility, only the mesh's
//  own visible flag is toggled by hide/show — so position data is there
//  to search even for sets nobody has switched on.
// ══════════════════════════════════════════════════════════════

let _oiTooltipEl   = null;
let _oiLookupList  = null;  // [{image, collection}], rebuilt each time Shift is pressed
let _oiNearestHit  = null;  // {image, collection, distance} for the current hover, or null

function initOrientedImageTooltip() {
    _oiTooltipEl = document.createElement("div");
    _oiTooltipEl.className = "brush-oi-tooltip";

    const nameEl = document.createElement("span");
    nameEl.className = "brush-oi-tooltip-name";
    _oiTooltipEl.appendChild(nameEl);

    const hintEl = document.createElement("span");
    hintEl.className = "brush-oi-tooltip-hint";
    hintEl.textContent = "Shift+click to view";
    _oiTooltipEl.appendChild(hintEl);

    document.body.appendChild(_oiTooltipEl);
}

// Flat snapshot of every oriented image whose set has finished loading, across
// every zone (visible or not). Scenes only ever carry a few hundred oriented
// images at most (one mesh+line per image, no batching/LOD in OrientedImages),
// so a plain array + linear scan on each hover tick is cheap — comfortably
// sub-millisecond — and needs no invalidation bookkeeping. A spatial index
// would only pay for itself at image counts this codebase never reaches.
function collectOrientedImageEntries() {
    const entries = [];
    for (const zone of window.zones || []) {
        for (const handler of _zoneOrientedImageHandlers(zone)) {
            const collection = handler.images;
            if (!collection || !Array.isArray(collection.images)) continue;
            for (const image of collection.images) {
                entries.push({ image, collection });
            }
        }
    }
    return entries;
}

function findNearestOrientedImage(position) {
    if (!_oiLookupList || _oiLookupList.length === 0) return null;

    let best = null;
    let bestDistSq = Infinity;
    for (const entry of _oiLookupList) {
        const d = position.distanceToSquared(entry.image.position);
        if (d < bestDistSq) {
            bestDistSq = d;
            best = entry;
        }
    }
    return best ? { image: best.image, collection: best.collection, distance: Math.sqrt(bestDistSq) } : null;
}

function showOrientedImageTooltip(clientX, clientY, hit) {
    if (!_oiTooltipEl) return;
    _oiTooltipEl.querySelector(".brush-oi-tooltip-name").textContent =
        `${hit.image.id} — ${hit.distance.toFixed(1)}m`;
    _oiTooltipEl.style.left = (clientX + 16) + "px";
    _oiTooltipEl.style.top  = (clientY + 16) + "px";
    _oiTooltipEl.style.display = "block";
}

function hideOrientedImageTooltip() {
    _oiNearestHit = null;
    if (_oiTooltipEl) _oiTooltipEl.style.display = "none";
}

// Called from the brush's mousemove pick loop whenever Shift is held and the
// brush sphere has a valid position to compare against.
function updateOrientedImageHover(clientX, clientY) {
    if (!brushState.sphere || !brushState.sphere.visible) {
        hideOrientedImageTooltip();
        return;
    }
    const hit = findNearestOrientedImage(brushState.sphere.position);
    if (!hit) {
        hideOrientedImageTooltip();
        return;
    }
    _oiNearestHit = hit;
    showOrientedImageTooltip(clientX, clientY, hit);
}

// Shift+click — jump into whatever image the tooltip is currently naming.
// focusImage() alone isn't enough when images are globally hidden: hiding
// also zeroes each mesh's render layer (zone_creation.js's
// setZoneOrientedImagesVisibility), and focusImage() never touches that, so
// the focused photo would stay invisible even though it's "selected". Flip
// the same global toggle the toolbar button uses, but only remember to undo
// it on release if WE were the one who flipped it — if the user had already
// turned images on manually, leave that alone.
function focusNearestOrientedImage() {
    if (!_oiNearestHit) return;

    if (window.imageMarkersGloballyHidden) {
        setAllOrientedImagesVisibility(true);
        window.brushState._globalOIForcedByShiftClick = true;
    }

    _oiNearestHit.collection.focusImage(_oiNearestHit.image);
    hideOrientedImageTooltip();
}


// ══════════════════════════════════════════════════════════════
//  Ctrl+Scroll Brush Radius (paint mode only)
//
//  Earlier version of this feature unregistered viewer.controls from
//  viewer.inputHandler for the duration of the Ctrl-hold, to keep it from
//  reacting to the same scroll. That's a *stateful* trick — it depends on
//  every detach eventually being paired with a reattach — and in practice
//  it left the camera's zoom/pan/rotate permanently dead. Never again:
//  this version never removes anything from the input pipeline.
//
//  Instead it listens on the exact same event Potree's own controls do
//  ('mousewheel' — the legacy event InputHandler still uses, not the
//  standard 'wheel'), registered on the same element. DOM listeners on one
//  element+event fire in registration order, and Potree's own listener was
//  registered at viewer construction time, long before this script runs —
//  so by the time this handler runs, Potree's controls have *already*
//  synchronously applied this tick's zoom delta. We simply zero that delta
//  back out before their next render-loop update() consumes it, then apply
//  our own radius change. If this handler is ever skipped or throws, the
//  worst case is a normal Potree zoom happens alongside/instead of a brush
//  resize — never a stuck, unrecoverable camera.
// ══════════════════════════════════════════════════════════════

// brushState.painting is only ever true between a Control keydown and its
// matching keyup (see the keydown/keyup handlers below) — i.e. exactly
// "Ctrl is currently held". That's the one condition this feature gates on.


// ══════════════════════════════════════════════════════════════
//  Input Handling
// ══════════════════════════════════════════════════════════════

const _pickRaycaster = new THREE.Raycaster();
const _pickMouse     = new THREE.Vector2();

function getPickRay(event, camera, rect) {
    rect = rect || viewer.renderer.domElement.getBoundingClientRect();
    _pickMouse.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    _pickRaycaster.setFromCamera(_pickMouse, camera);
    return _pickRaycaster.ray;
}

// Resolve which pointcloud the cursor is over (and the hit on it).
// Returns {pc, hit} or null.
function pickAnyPointcloud(ray, pickParams) {
    const camera = viewer.scene.getActiveCamera();

    // 1. User-selected target — only pick on that one
    if (brushState.targetPointcloud) {
        const pc = viewer.scene.pointclouds.find(p => p.name === brushState.targetPointcloud);
        if (!pc) return null;
        const hit = pc.pick(viewer, camera, ray, pickParams);
        return hit ? { pc, hit } : null;
    }

    const clouds = viewer.scene.pointclouds;

    // 2. Single-pointcloud fast path (most common scenario)
    if (clouds.length === 1) {
        const pc = clouds[0];
        if (!pc.visible) return null;
        const hit = pc.pick(viewer, camera, ray, pickParams);
        return hit ? { pc, hit } : null;
    }

    // 3. Multi-pointcloud: try each visible one, return first hit
    for (const pc of clouds) {
        if (!pc.visible) continue;
        const hit = pc.pick(viewer, camera, ray, pickParams);
        if (hit) return { pc, hit };
    }
    return null;
}

let editApplyTimer = null;
function applyEditsOnMove(){
    if(getTotalEditCount() === 0) return;
    clearTimeout(editApplyTimer);
    editApplyTimer = setTimeout(applyEditsToLoadedNodes, 10);
}


document.addEventListener("DOMContentLoaded", () => {
    initBrushSphere();
    initOrientedImageTooltip();
    setTimeout(ensureTileLabels, 500);
    // viewer.addEventListener('camera_changed', applyEditsOnMove);

    let _shiftHeld = false;

    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

        if ((e.key === 'Control' || e.key === 'Meta') && brushState.active) {
            brushState.painting = true;
            viewer.controls.rotationSpeed = 0;
        }

        if (e.key === 'Shift' && !_shiftHeld) {
            _shiftHeld = true;
            _oiLookupList = collectOrientedImageEntries();
            if (_pendingMouseEvent) updateOrientedImageHover(_pendingMouseEvent.clientX, _pendingMouseEvent.clientY);
        }

        if (e.key === 'z' || e.key === 'Z') {
            window.brushState.active = !window.brushState.active;
            if (!window.brushState.active && brushState.sphere) brushState.sphere.visible = false;
            const toggle = document.querySelector('#brushPanel .brush-toggle input');
            if (toggle) toggle.checked = window.brushState.active;
        }

        if (e.key === 'q' || e.key === 'Q') {
            window.brushState.radius = Math.max(RADIUS_MIN, window.brushState.radius / RADIUS_STEP_FACTOR);
            updateRadiusUI();
            if (brushState.sphere?.visible) {
                const r = brushState.radius;
                brushState.sphere.scale.set(r, r, r);
            }
        }

        if (e.key === 'e' || e.key === 'E') {
            window.brushState.radius = Math.min(RADIUS_MAX, window.brushState.radius * RADIUS_STEP_FACTOR);
            updateRadiusUI();
            if (brushState.sphere?.visible) {
                const r = brushState.radius;
                brushState.sphere.scale.set(r, r, r);
            }
        }

        // W also drives oriented-image opacity while a photo is focused
        // (oriented_image_panel.js) — only cycle the RGB/classification
        // blend when that mode isn't active, so the two never fight.
        if ((e.key === 'w' || e.key === 'W') &&
            !(window.orientedImageState && window.orientedImageState.controls)) {
            toggleClassBlendCycle();
        }

        // 1-9 switch the brush's paint classification, only while the brush
        // is active — otherwise these are just ordinary number keys.
        if (e.key >= '1' && e.key <= '9' && window.brushState.active &&
            !e.ctrlKey && !e.metaKey && !e.altKey) {
            const cls = CLASSIFICATIONS[Number(e.key) - 1];
            if (cls) selectBrushClassification(cls.value);
        }
    });

    document.addEventListener('keyup', (e) => {
        if (e.key === 'Control' || e.key === 'Meta') {
            brushState.painting = false;
            viewer.controls.rotationSpeed = 5;
        }
        if (e.key === 'Shift') {
            _shiftHeld = false;
            hideOrientedImageTooltip();
        }
    });

    // Safety net: if focus leaves the window mid Ctrl-hold (alt-tab, etc.)
    // no keyup ever arrives, which would otherwise leave rotationSpeed at 0.
    window.addEventListener('blur', () => {
        brushState.painting = false;
        viewer.controls.rotationSpeed = 5;
        _shiftHeld = false;
        hideOrientedImageTooltip();
    });

    const btn = document.getElementById("brush-start-icon");
    if (btn) btn.addEventListener("click", () => { brushState.active = !brushState.active; });

    let _pendingMouseEvent = null;
    let _pickScheduled = false;

    viewer.renderer.domElement.addEventListener('mousemove', (event) => {
        if (!brushState.active || !brushState.sphere) return;
        _pendingMouseEvent = event;          // mousemove events aren't pooled — safe to hold
        if (_pickScheduled) return;
        _pickScheduled = true;

        requestAnimationFrame(() => {
            _pickScheduled = false;
            const ev = _pendingMouseEvent;
            if (!ev || !brushState.active || !brushState.sphere) return;

            const rect = viewer.renderer.domElement.getBoundingClientRect();
            const ray  = getPickRay(ev, viewer.scene.getActiveCamera(), rect);
            const pickParams = {
                x: ev.clientX - rect.left,
                y: rect.height - (ev.clientY - rect.top),
                pickWindowSize: 65, pickClipped: true
            };

            const result = pickAnyPointcloud(ray, pickParams);
            if (result) {
                brushState.sphere.position.copy(result.hit.position);
                const r = brushState.radius;
                brushState.sphere.scale.set(r, r, r);
                brushState.sphere.visible = true;
                if (brushState.painting && ev.buttons === 1) {
                    paintAtPoint(result.pc, result.hit);
                }
                if (_shiftHeld) updateOrientedImageHover(ev.clientX, ev.clientY);
            } else {
                brushState.sphere.visible = false;
                if (_shiftHeld) hideOrientedImageTooltip();
            }
        });
    });

    viewer.renderer.domElement.addEventListener('click', (event) => {
        if (event.shiftKey) {
            focusNearestOrientedImage();
            return;
        }
        if (!brushState.active || !brushState.painting) return;

        const ray = getPickRay(event, viewer.scene.getActiveCamera());
        const rect = viewer.renderer.domElement.getBoundingClientRect();
        const pickParams = {
            x: event.clientX - rect.left,
            y: rect.height - (event.clientY - rect.top),
            pickWindowSize: 65, pickClipped: true
        };

        const result = pickAnyPointcloud(ray, pickParams);
        if (result) paintAtPoint(result.pc, result.hit);
    });

    // Ctrl is already the paint-hold key, so while it's down let the scroll
    // wheel resize the brush instead of zooming — no need to let go and
    // reach for the panel slider mid-stroke. Registered on 'mousewheel'
    // (the same legacy event Potree's own controls listen to, on the same
    // element) so it fires right after their handler for this same tick —
    // DOM listeners on one element+event run in registration order, and
    // Potree's was registered at viewer construction, long before this
    // script loads. That lets us just zero out whatever zoom delta their
    // handler already queued, instead of touching the input pipeline itself.
    viewer.renderer.domElement.addEventListener('mousewheel', (event) => {
        if (!brushState.painting) return;

        // Cancel this tick's zoom before the next render-loop update() applies it.
        if (viewer.controls) {
            viewer.controls.radiusDelta = 0;
            viewer.controls.wheelDelta = 0;
        }

        let delta = 0;
        if (event.wheelDelta !== undefined) delta = event.wheelDelta;       // Chrome/Edge/Safari
        else if (event.detail !== undefined) delta = -event.detail;         // legacy Firefox

        const factor = delta > 0 ? RADIUS_STEP_FACTOR : 1 / RADIUS_STEP_FACTOR;
        window.brushState.radius = Math.min(RADIUS_MAX, Math.max(RADIUS_MIN, window.brushState.radius * factor));
        updateRadiusUI();
        if (brushState.sphere?.visible) {
            const r = brushState.radius;
            brushState.sphere.scale.set(r, r, r);
        }
    }, false);

});