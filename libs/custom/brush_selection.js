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
    gap: 5px;
    max-height: 190px;
    overflow-y: auto;
    overflow-x: hidden;
    align-content: start;
    padding: 2px 4px 2px 0;
    margin-right: -4px;
}

.brush-class-grid::-webkit-scrollbar {
    width: 6px;
}
.brush-class-grid::-webkit-scrollbar-track {
    background: transparent;
}
.brush-class-grid::-webkit-scrollbar-thumb {
    background: rgba(255,255,255,0.15);
    border-radius: 3px;
}
.brush-class-grid::-webkit-scrollbar-thumb:hover {
    background: rgba(255,255,255,0.28);
}

.brush-class-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 7px;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 6px;
    background: rgba(255,255,255,0.04);
    color: #e0e0e5;
    font-size: 12px;
    line-height: 1.2;
    font-family: inherit;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
    justify-content: flex-start;
    min-width: 0;
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
    width: 11px;
    height: 11px;
    border-radius: 3px;
    flex-shrink: 0;
    border: 1px solid rgba(255,255,255,0.15);
}

.brush-class-label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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
    width: 13px;
    height: 13px;
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
    { value: 18, name: "High Point (Noise)",color: "#f09bf3" },
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

/**
 * Called once the scene's clouds have their starting materials. Records each cloud's
 * as pc.userData.startMaterial (in sceneConfig's shape) for the toolbar's "Default",
 * since a config.js scene has no sceneConfig to go back to, and selects "Default".
 * A page whose menu has no "Default" shows the attribute most visible clouds use.
 */
function updateMaterialMenuOnStart(){
	for (const pc of viewer.scene.pointclouds) {
		if (pc.userData.startMaterial) continue;
		const intensity = pc.material.intensityRange;
		pc.userData.startMaterial = { attribute: pc.material.activeAttributeName };
		if (isFinite(intensity[0])) pc.userData.startMaterial.ranges = { intensity: [...intensity] };
	}

	const menu = $("#potree_toolbar").find("#optMaterial")[0];
	if ([...(menu?.options || [])].some(o => o.value === "Default")) {
		updateMaterialMenu("Default");
		return;
	}

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
 * Push window.brushState.classBlend into every currently visible pointcloud.
 * t=0 is the cloud's default attribute from sceneConfig (RGB when it has no
 * entry), t=1 is pure classification, and in between the composite attribute
 * mixes the two so their weights always sum to 1.
 */
function applyClassBlendToVisiblePointclouds() {
    const t = window.brushState.classBlend;
    for (const pc of viewer.scene.pointclouds) {
        if (!pc.visible) continue;
        const m = window.sceneConfig?.pointclouds[pc.name]?.material || {};
        const attribute = m.attribute || "rgba";
        const mat = pc.material;

        // At 0% the cloud goes back to exactly its configured attribute and weights, since
        // composite can't draw every attribute ("color", "intensity gradient", extra attributes).
        if (t === 0) {
            for (const [key, prop] of Object.entries(CLASS_BLEND_WEIGHTS)) {
                mat[prop] = m.weights?.[key] ?? CLASS_BLEND_DEFAULT_WEIGHTS[key] ?? 0;
            }
            mat.activeAttributeName = attribute;
            continue;
        }

        const base = classBlendBaseWeights(attribute, m.weights);
        for (const [key, prop] of Object.entries(CLASS_BLEND_WEIGHTS)) mat[prop] = (1 - t) * (base[key] || 0);
        mat.weightClassification += t;
        mat.activeAttributeName = "composite";
    }
}

// sceneConfig material.weights key -> PointCloudMaterial property. Same as SceneConfig.WEIGHTS, kept
// here because some pages load this file without scene_config.js.
const CLASS_BLEND_WEIGHTS = {
    rgb: "weightRGB", intensity: "weightIntensity", elevation: "weightElevation",
    classification: "weightClassification", returnNumber: "weightReturnNumber", sourceID: "weightSourceID",
};
const CLASS_BLEND_DEFAULT_WEIGHTS = { rgb: 1 };     // Potree's; every other weight starts at 0

// Composite weights, keyed like CLASS_BLEND_WEIGHTS and summing to 1, that draw `attribute` on its
// own. Composite has no channel for "color", "intensity gradient" or extra attributes, so those
// blend from RGB instead.
function classBlendBaseWeights(attribute, weights) {
    switch (attribute) {
        case "intensity":      return { intensity: 1 };
        case "elevation":      return { elevation: 1 };
        case "classification": return { classification: 1 };
        case "return number":  return { returnNumber: 1 };
        case "source id":      return { sourceID: 1 };
        case "composite": {
            // The configured mix, or Potree's default weights when the config left them out.
            const w = Object.fromEntries(Object.keys(CLASS_BLEND_WEIGHTS)
                .map(key => [key, Number(weights?.[key] ?? CLASS_BLEND_DEFAULT_WEIGHTS[key] ?? 0)]));
            const sum = Object.values(w).reduce((a, b) => a + b, 0);
            if (sum <= 0) return { rgb: 1 };
            for (const key in w) w[key] /= sum;
            return w;
        }
        default:               return { rgb: 1 };
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
        label.className = "brush-class-label";
        label.textContent = cls.name;
        label.title = cls.name;
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
    // Leaves only. An "all" entry also sets the class of every descendant that has no
    // entry of its own, so promoting an inner node because its own points agree would
    // extend that class to descendant points no stroke assigned. A leaf has no
    // descendants, so there the promotion is exact.
    if (Object.values(geoNode.children || {}).some(Boolean)) return;
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
            window.__bench?.onEditFlag?.();
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
const BRUSH_MAX_NODES_LOADING = 24;

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

/**
 * True if no class an entry assigns is hidden: an "all" entry's baseline and every
 * per-point override. A missing entry assigns nothing.
 */
function entryClassesVisible(entry, visibleLUT) {
    if (!entry) return true;
    if (isAllEntry(entry) && !visibleLUT[entry.classification]) return false;
    const overrides = getOverrides(entry);
    if (overrides) {
        for (const edit of overrides.values()) {
            if (!visibleLUT[edit.classification]) return false;
        }
    }
    return true;
}

/**
 * True if every point inside worldBox is visible under the clip volumes, so a bulk mark
 * cannot reach a clipped point. Showing inside (SHOW_INSIDE), a point is visible inside
 * any volume, so the box must lie inside one; a box covered only by several volumes
 * together counts as not visible. Showing outside (SHOW_OUTSIDE), a point is visible
 * outside every volume, so the box must miss them all; that test uses the extent of the
 * box's corners in each volume's frame, so a near miss counts as an overlap. Both err
 * toward per-point work, never toward classifying a clipped point.
 */
function isNodeFullyVisibleUnderClip(worldBox, clipInverses, showInside) {
    const v = new THREE.Vector4();
    for (const inv of clipInverses) {
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;
        for (let k = 0; k < 8; k++) {
            v.set(
                k & 1 ? worldBox.max.x : worldBox.min.x,
                k & 2 ? worldBox.max.y : worldBox.min.y,
                k & 4 ? worldBox.max.z : worldBox.min.z,
                1.0
            ).applyMatrix4(inv);
            if (v.x < minX) minX = v.x; if (v.x > maxX) maxX = v.x;
            if (v.y < minY) minY = v.y; if (v.y > maxY) maxY = v.y;
            if (v.z < minZ) minZ = v.z; if (v.z > maxZ) maxZ = v.z;
        }
        if (showInside) {
            // All eight corners inside this volume: the box, and every point in it, is too.
            if (minX >= -0.5 && maxX <= 0.5 &&
                minY >= -0.5 && maxY <= 0.5 &&
                minZ >= -0.5 && maxZ <= 0.5) return true;
        } else if (maxX >= -0.5 && minX <= 0.5 &&
                   maxY >= -0.5 && minY <= 0.5 &&
                   maxZ >= -0.5 && minZ <= 0.5) {
            return false;    // may overlap this volume, whose interior is hidden
        }
    }
    return !showInside;
}

// ── Stroke profiler: counting the subtrees implicit nodes stand for ──
// An "all" entry covers its node's whole subtree, which the stroke never visits and
// whose hierarchy is often not expanded in memory yet. The profiler counts it from
// the file instead: the in-memory part directly, each unexpanded part by fetching
// its hierarchy chunk (2.0) or page (COPC). No point data is fetched and the live
// octree is never expanded, so profiling can't change what the viewer or the edit
// count sees. Hierarchy is immutable, so each chunk's subtree total is memoized.
const _subtreeCountMemo = new WeakMap();   // pcoGeometry → Map(chunk offset → Promise<{nodes, points}>)

// `keep()`, asked once the count is done, says whether to keep it (default: always);
// the count is shared by every caller meanwhile.
function _countOnce(geom, offset, count, keep = null) {
    let memo = _subtreeCountMemo.get(geom);
    if (!memo) { memo = new Map(); _subtreeCountMemo.set(geom, memo); }
    const key = String(offset);
    let p = memo.get(key);
    if (!p) {
        p = count();
        memo.set(key, p);
        p.then(() => { if (keep && !keep()) memo.delete(key); },
               () => memo.delete(key));   // retry a failed fetch on the next stroke
    }
    return p;
}

// Caps per-chunk hierarchy requests in flight (COPC pages, and 2.0 files too big to
// download whole), for the subtree counts and the full octree grid. A large subtree
// can reach thousands of unexpanded proxies at once, and Chrome fails requests beyond
// roughly 1,300 pending ("TypeError: Failed to fetch"). Uses the stroke's load
// budget, which already assumes the host takes that many concurrent range requests.
let _hierarchyInFlight = 0;
const _hierarchyWaiting = [];

async function _hierarchyFetch(request) {
    while (_hierarchyInFlight >= BRUSH_MAX_NODES_LOADING) await new Promise(r => _hierarchyWaiting.push(r));
    _hierarchyInFlight++;
    try { return await request(); }
    finally { _hierarchyInFlight--; _hierarchyWaiting.shift()?.(); }
}

// Retries a request that fails at the network level ("TypeError: Failed to fetch").
// A full read can take thousands of requests, where one transient failure is likely
// and would otherwise abandon the whole read.
async function _withRetries(request, attempts = 4) {
    for (let i = 1; ; i++) {
        try { return await request(); }
        catch (e) {
            if (i >= attempts) throw e;
            await new Promise(r => setTimeout(r, 250 * 2 ** (i - 1)));   // 250 ms, 0.5 s, 1 s
        }
    }
}

// hierarchy.bin's total size per 2.0 geometry, from HEAD or Content-Range. The file
// is its chunks back to back, so this is what "all of the hierarchy read" adds up
// to. Missing when a cross-origin server doesn't expose the size.
const _hierarchyBytes = new WeakMap();

// hierarchy.bin up to this size is downloaded once and sliced in memory, instead of
// one range request per chunk. Chunks can be tiny and numerous (D69P40 packs 106,659
// of them into 5.6 MB), and at a few hundred requests a second reading a whole cloud
// that way takes minutes.
const HIERARCHY_WHOLE_FILE_MAX = 64 * 1024 * 1024;
const _hierarchyFiles = new WeakMap();   // 2.0 geometry → Promise<ArrayBuffer, or null to read by range>

function _hierarchyFile(geom) {
    let file = _hierarchyFiles.get(geom);
    if (!file) {
        const url = `${geom.loader.url}/../hierarchy.bin`;
        file = (async () => {
            // no-store: a HEAD answered from a partial cache entry can misreport the size
            const head = await _withRetries(() => fetch(url, { method: "HEAD", cache: "no-store" }));
            const size = Number(head.headers.get("Content-Length"));
            if (size > 0) _hierarchyBytes.set(geom, size);
            if (!(size > 0 && size <= HIERARCHY_WHOLE_FILE_MAX)) return null;
            const res = await _withRetries(() => fetch(url));
            if (!res.ok) throw new Error(`hierarchy.bin: HTTP ${res.status}`);
            return await res.arrayBuffer();
        })().catch(() => {
            _hierarchyFiles.delete(geom);    // read by range this time; try the whole file again next time
            return null;
        });
        _hierarchyFiles.set(geom, file);
    }
    return file;
}

// ══════════════════════════════════════════════════════════════
//  Hierarchy cache and precache (Potree 2.0 hierarchy.bin)
//
//  Potree reads a cloud's hierarchy one chunk per proxy node it loads, each with its
//  own range request, and chunks can be tiny: 8j7j-6m43 has 1.36 M chunks in 122 MB,
//  1.19 M of them a single 22-byte record. A stroke across many unexpanded proxies,
//  or a profiler count over the subtrees a stroke encloses, then makes hundreds to
//  hundreds of thousands of few-byte requests.
//
//  PotreeConverter 2 writes each chunk's subtree (the chunk and every chunk below its
//  proxies) as one contiguous span starting with the chunk: depth-first, the subtrees
//  of a chunk's proxies in record order. A proxy's span therefore ends where the next
//  proxy of its parent chunk starts, else where the parent's span ends, and the root's
//  span is the whole file (checked on every chunk of six clouds, 1.36 M chunks in the
//  largest). One range request can fetch everything a stroke reads below a proxy.
//  Not in every file: the converter writes each of its batches whole but the chunks
//  inside a batch level by level, which only differs once a batch holds three chunk
//  levels (LA County's depth-4 batches: their depth-8 chunks, then all their depth-12
//  chunks). The layout check below catches that, and such a file is read chunk by
//  chunk, a chunk's proxies together since they sit side by side.
//
//  Every hierarchy read goes through one cache per file: Potree's own (NodeLoader.
//  loadHierarchy is wrapped below), the stroke profiler's and the full octree grid's.
//  A read is served from fetched bytes or from a fetch in flight that covers it, else
//  fetched alone, as before. A stroke anticipates the proxies it will load (its
//  partly covered ones, found as processNode would find them, on the hierarchy in
//  memory and again in each chunk parsed during the stroke) and fetches their whole
//  subtree spans up front when they're small, merged into a few requests. A proxy
//  with a big span is fetched alone and its children are planned once it's parsed.
//  Once strokes have asked for a quarter of a small file, the next stroke fetches the
//  whole file in the background. The cache only serves bytes fetched from that file at
//  those offsets, so a wrong guess costs bytes or a request, never a different read.
//
//  window.BRUSH_HIERARCHY.enabled = false goes back to Potree's per-chunk reads and
//  the readers' old path. .stats counts reads, cache hits and requests.
// ══════════════════════════════════════════════════════════════

const HIERARCHY_PRECACHE = window.BRUSH_HIERARCHY = {
    enabled: true,
    spanMax: 256 * 1024,               // a stroke fetches a proxy's whole subtree when its span is at most this
    mergeGap: 32 * 1024,               // wanted ranges at most this far apart are fetched as one...
    requestMax: 256 * 1024,            // ...up to this size: a chunk read waits for its whole response, and
                                       // 2 MB requests saved only 2 of 109 on 18 simulated 8j7j strokes
    readerSpanMax: 16 * 1024 * 1024,   // span and request limit for the profiler and the grid, which read
                                       // every chunk below what they count
    readerBudget: 32 * 1024 * 1024,    // span bytes they hold at once, fetched and not yet read through
    readerConcurrency: 8,              // subtrees they read at once, per level of chunks
    wholeMax: 16 * 1024 * 1024,        // strokes fetch a file up to this size whole...
    wholeFraction: 0.25,               // ...once earlier strokes have asked for this share of it
    capBytes: 64 * 1024 * 1024,        // bytes kept across files, least recently used dropped first
    stats: { reads: 0, hits: 0, waits: 0, requests: 0, bytes: 0, anticipated: 0 },
};

let _hcTick = 0;                       // LRU clock
let _hcTotal = 0;                      // bytes cached across files
const _hcSegments = new Set();         // every cached segment, for eviction
const _hcCaches = new Map();           // hierarchy.bin URL → HierarchyCache

class HierarchyCache {
    constructor(url) {
        this.url = url;
        this.size = null;              // file size, once a response has told it
        this.segs = [];                // fetched bytes { start, end, buf, used, cache }, sorted, disjoint
        this.inflight = [];            // fetches reads wait for: { start, end, promise }
        this.planned = 0;              // bytes strokes have asked for, for the whole-file rule
        this.whole = null;             // strokes' whole-file fetch (background)
        this.readersWhole = null;      // the profiler's and grid's whole-file fetch
        this.layoutOk = true;          // subtrees are contiguous spans, as far as parsed chunks show
    }

    // A parsed chunk's proxies start right after it and before its span ends, if the file
    // is laid out as PotreeConverter writes it. A file laid out otherwise is read chunk by
    // chunk from then on, since span guesses would fetch unrelated bytes.
    checkLayout(chunkEnd, spanEnd, proxyOffsets /* sorted */) {
        if (!this.layoutOk || spanEnd === null || proxyOffsets.length === 0) return;
        if (proxyOffsets[0] !== chunkEnd || proxyOffsets[proxyOffsets.length - 1] >= spanEnd) {
            this.layoutOk = false;
            console.warn(`[brush] ${this.url} isn't laid out depth-first; reading its hierarchy chunk by chunk`);
        }
    }

    // Index of the first segment that ends after pos.
    _after(pos) {
        const s = this.segs;
        let lo = 0, hi = s.length;
        while (lo < hi) { const m = (lo + hi) >>> 1; if (s[m].end <= pos) lo = m + 1; else hi = m; }
        return lo;
    }

    has(start, end) {
        const s = this.segs;
        for (let i = this._after(start), pos = start; pos < end; pos = s[i++].end) {
            if (i >= s.length || s[i].start > pos) return false;
        }
        return true;
    }

    // Bytes [start, end) as a new ArrayBuffer, or null if not all cached.
    slice(start, end) {
        const s = this.segs;
        let i = this._after(start);
        if (i >= s.length || s[i].start > start) return null;
        const tick = ++_hcTick;
        if (s[i].end >= end) {
            s[i].used = tick;
            return s[i].buf.slice(start - s[i].start, end - s[i].start);
        }
        const out = new Uint8Array(end - start);        // spread over adjacent segments
        for (let pos = start; pos < end; i++) {
            if (i >= s.length || s[i].start > pos) return null;
            const n = Math.min(end, s[i].end) - pos;
            out.set(new Uint8Array(s[i].buf, pos - s[i].start, n), pos - start);
            s[i].used = tick;
            pos += n;
        }
        return out.buffer;
    }

    // True when [start, end) is cached, or one fetch in flight covers it.
    covered(start, end) {
        return this.has(start, end) || this.inflight.some(f => f.start <= start && f.end >= end);
    }

    // Keep bytes fetched at `start`. Segments stay disjoint: parts already held are cut off.
    insert(start, buf) {
        let end = start + buf.byteLength;
        const s = this.segs;
        let i = this._after(start);
        if (i < s.length && s[i].start <= start) {      // an older segment holds the front
            if (s[i].end >= end) { s[i].used = ++_hcTick; return; }
            buf = buf.slice(s[i].end - start);
            start = s[i++].end;
        }
        let j = i;
        while (j < s.length && s[j].end <= end) j++;    // older segments inside the new one
        if (j < s.length && s[j].start < end) {         // an older segment holds the back
            buf = buf.slice(0, s[j].start - start);
            end = s[j].start;
        }
        if (end <= start) return;
        for (let k = i; k < j; k++) { _hcSegments.delete(s[k]); _hcTotal -= s[k].buf.byteLength; }
        const seg = { start, end, buf, used: ++_hcTick, cache: this };
        s.splice(i, j - i, seg);
        _hcSegments.add(seg);
        _hcTotal += buf.byteLength;
        _hcEvict(seg);
    }

    // One range request for [start, end). Keeps what comes back and resolves with it as
    // { start, buf }. Reads wait for it unless it runs in the background.
    fetch(start, end, background = false) {
        const stats = HIERARCHY_PRECACHE.stats;
        const promise = _hierarchyFetch(async () => {
            stats.requests++;
            const res = await _withRetries(() => fetch(this.url, { headers: { Range: `bytes=${start}-${end - 1}` } }));
            if (!res.ok) throw new Error(`hierarchy.bin: HTTP ${res.status}`);
            const buf = await res.arrayBuffer();
            stats.bytes += buf.byteLength;
            let at = 0;
            if (res.status === 206) {
                const m = /bytes\s+(\d+)-(\d+)\/(\d+|\*)/i.exec(res.headers.get("Content-Range") || "");
                if (m) {
                    at = Number(m[1]);
                    if (m[3] !== "*") this.size = Number(m[3]);
                } else if (buf.byteLength === end - start) {
                    at = start;                         // Content-Range hidden (cross-origin): what was asked
                } else {
                    throw new Error("hierarchy.bin: range response without Content-Range");
                }
            } else {
                this.size = buf.byteLength;             // 200: the server ignored Range and sent it all
            }
            this.insert(at, buf);
            return { start: at, buf };
        });
        if (!background) {
            const entry = { start, end, promise };
            this.inflight.push(entry);
            const done = () => { const k = this.inflight.indexOf(entry); if (k >= 0) this.inflight.splice(k, 1); };
            promise.then(done, done);
        }
        return promise;
    }

    // Bytes [start, end) as an ArrayBuffer: cached, from a fetch in flight, or fetched alone.
    async read(start, end) {
        const stats = HIERARCHY_PRECACHE.stats;
        stats.reads++;
        let buf = this.slice(start, end);
        if (buf) { stats.hits++; return buf; }
        const pending = this.inflight.find(f => f.start <= start && f.end >= end);
        if (pending) {
            await pending.promise.catch(() => {});
            buf = this.slice(start, end);
            if (buf) { stats.waits++; return buf; }
        }
        const got = await this.fetch(start, end);
        if (got.start > start || got.start + got.buf.byteLength < end) throw new Error("hierarchy.bin: short range response");
        return got.buf.slice(start - got.start, end - got.start);
    }

    // Fetch the parts of `ranges` ([start, end) pairs) neither cached nor in flight, joining
    // ranges at most `gap` apart into requests of up to `max` bytes. Returns the bytes asked for.
    prefetch(ranges, gap, max) {
        const want = ranges.filter(([s, e]) => e > s && !this.covered(s, e)).sort((a, b) => a[0] - b[0]);
        let asked = 0, run = null;
        const send = () => {
            if (!run) return;
            this.fetch(run[0], run[1]).catch(() => {});  // reads it would have served fetch alone
            asked += run[1] - run[0];
        };
        for (const [s, e] of want) {
            if (run && s - run[1] <= gap && Math.max(e, run[1]) - run[0] <= max) run[1] = Math.max(run[1], e);
            else { send(); run = [s, e]; }
        }
        send();
        return asked;
    }

    // The profiler and the grid read every chunk below what they count, so a file up to
    // HIERARCHY_WHOLE_FILE_MAX is downloaded once, whole, as it was before this cache.
    wholeForReaders() {
        if (!this.readersWhole) {
            this.readersWhole = (async () => {
                if (this.size === null) {
                    // no-store: a HEAD answered from a partial cache entry can misreport the size
                    const head = await _withRetries(() => fetch(this.url, { method: "HEAD", cache: "no-store" }));
                    const n = Number(head.headers.get("Content-Length"));
                    if (n > 0) this.size = n;
                }
                if (this.size !== null && this.size <= HIERARCHY_WHOLE_FILE_MAX && !this.has(0, this.size)) {
                    await this.fetch(0, this.size);
                }
            })().catch(() => { this.readersWhole = null; });   // read by range; try again next time
        }
        return this.readersWhole;
    }
}

// Drop least recently used segments, other than `keep`, until the cache fits its cap.
function _hcEvict(keep) {
    while (_hcTotal > HIERARCHY_PRECACHE.capBytes) {
        let victim = null;
        for (const seg of _hcSegments) if (seg !== keep && (!victim || seg.used < victim.used)) victim = seg;
        if (!victim) return;
        const s = victim.cache.segs;
        s.splice(victim.cache._after(victim.start), 1);
        _hcSegments.delete(victim);
        _hcTotal -= victim.buf.byteLength;
    }
}

function _hierarchyCacheAt(url) {
    const key = new URL(url, document.baseURI).href;
    let cache = _hcCaches.get(key);
    if (!cache) { cache = new HierarchyCache(key); _hcCaches.set(key, cache); }
    return cache;
}

// The cache of a 2.0 NodeLoader's hierarchy.bin, remembered on the loader.
function _hierarchyCacheOf(loader) {
    return loader._brushHierarchyCache ??= _hierarchyCacheAt(`${loader.url}/../hierarchy.bin`);
}

function _hierarchyCacheFor(geom) {
    return _hierarchyCacheOf(geom.loader);
}

// Potree's NodeLoader.loadHierarchy, reading through the cache; parsing stays Potree's.
// Installed once, on the prototype every 2.0 cloud's loader shares.
(function hookPotreeHierarchyReads() {
    const proto = window.Potree?.NodeLoader?.prototype;
    if (!proto || typeof proto.loadHierarchy !== "function" || typeof proto.parseHierarchy !== "function"
        || proto.loadHierarchy._brushHierarchyCache) return;
    const potreeLoadHierarchy = proto.loadHierarchy;
    const loadHierarchy = async function (node) {
        if (!HIERARCHY_PRECACHE.enabled) return potreeLoadHierarchy.call(this, node);
        const start = Number(node.hierarchyByteOffset);
        const buf = await _hierarchyCacheOf(this).read(start, start + Number(node.hierarchyByteSize));
        this.parseHierarchy(node, buf);
        _hierarchyParsed(node);
    };
    loadHierarchy._brushHierarchyCache = true;
    proto.loadHierarchy = loadHierarchy;
})();

// Where a 2.0 chunk root's subtree span ends (exclusive), from the hierarchy in memory:
// at the next proxy of its parent chunk, else where the parent's span ends; the root's
// at the end of the file. null when unknown: the file size not seen yet, or a node
// outside the live octree (the ledger compare's detached copies).
const _hcSpanEnds = new WeakMap();      // geometry → Map(chunk offset → span end)
const _hcChunkProxies = new WeakMap();  // parsed chunk root → its proxies' offsets, sorted

function _hierarchySpanEnd(geom, node) {
    let ends = _hcSpanEnds.get(geom);
    if (!ends) { ends = new Map(); _hcSpanEnds.set(geom, ends); }
    const start = Number(node.hierarchyByteOffset);
    const known = ends.get(start);
    if (known !== undefined) return known;
    let parent = node.parent;
    while (parent && parent.hierarchyByteOffset === undefined) parent = parent.parent;
    let end = null;
    if (parent) {
        const offs = _hierarchyChunkProxies(parent);
        let lo = 0, hi = offs.length;                   // first proxy after this one
        while (lo < hi) { const m = (lo + hi) >>> 1; if (offs[m] <= start) lo = m + 1; else hi = m; }
        end = lo < offs.length ? offs[lo] : _hierarchySpanEnd(geom, parent);
    } else if (node === geom.root) {
        end = _hierarchyCacheFor(geom).size;
    }
    if (end !== null) ends.set(start, end);
    return end;
}

// The proxies of a parsed chunk: the nodes below its root, within the chunk, that start chunks.
function _hierarchyChunkProxies(chunkRoot) {
    let offs = _hcChunkProxies.get(chunkRoot);
    if (!offs) {
        offs = [];
        (function walk(n) {
            for (let i = 0; i < 8; i++) {
                const c = n.children[i];
                if (!c) continue;
                if (c.hierarchyByteOffset !== undefined) offs.push(Number(c.hierarchyByteOffset));
                else walk(c);
            }
        })(chunkRoot);
        offs.sort((a, b) => a - b);
        _hcChunkProxies.set(chunkRoot, offs);
    }
    return offs;
}

// Span ends of one chunk's proxies from their offsets alone: each ends where the next
// starts, the last where the chunk's own span ends (`end`, or null when unknown).
function _siblingSpanEnds(offsets, end) {
    const sorted = [...offsets].sort((a, b) => a - b);
    const next = new Map();
    for (let i = 0; i < sorted.length; i++) next.set(sorted[i], i + 1 < sorted.length ? sorted[i + 1] : end);
    return offsets.map(o => next.get(o));
}

// What to fetch for proxies whose chunks are about to be read, as [start, chunkEnd,
// spanEnd] items: the whole span when it's at most spanMax, else the chunk alone.
function _hierarchyPrefetchItems(geom, items, spanMax, gap, max) {
    const cache = _hierarchyCacheFor(geom);
    if (!cache.layoutOk) spanMax = 0;
    return cache.prefetch(
        items.map(([start, chunkEnd, end]) =>
            [start, end !== null && end >= chunkEnd && end - start <= spanMax ? end : chunkEnd]),
        gap, max);
}

// The layout check for a chunk just read: `proxyOffsets` are its proxies' offsets.
function _hierarchyCheckChunk(geom, start, size, spanEnd, proxyOffsets) {
    if (!HIERARCHY_PRECACHE.enabled) return;
    _hierarchyCacheFor(geom).checkLayout(Number(start) + Number(size), spanEnd,
        [...proxyOffsets].sort((a, b) => a - b));
}

function _proxyItem(geom, proxy) {
    const start = Number(proxy.hierarchyByteOffset);
    return [start, start + Number(proxy.hierarchyByteSize), _hierarchySpanEnd(geom, proxy)];
}

// Span bytes the profiler and the grid have prefetched for subtrees they haven't finished
// reading. They fetch a span whole only while this stays within readerBudget, so a read
// through a huge subtree streams through the cache instead of flooding it.
let _readerHeld = 0;

// The profiler and the grid read every chunk below the proxies they reach, so they
// fetch whole spans, in bigger requests than strokes, as far as the budget goes; the
// rest chunk by chunk, merged with their neighbours. Returns the span bytes held for
// each item, for the caller to give back once it has read that item's subtree.
function _hierarchyPrefetchForReader(geom, items) {
    const held = new Array(items.length).fill(0);
    if (!HIERARCHY_PRECACHE.enabled || items.length === 0) return held;
    const P = HIERARCHY_PRECACHE, cache = _hierarchyCacheFor(geom);
    const spanMax = cache.layoutOk ? P.readerSpanMax : 0;
    const ranges = items.map(([start, chunkEnd, end], i) => {
        if (end !== null && end >= chunkEnd && end - start <= spanMax
            && _readerHeld + (end - start) <= P.readerBudget && !cache.covered(start, end)) {
            held[i] = end - start;
            _readerHeld += held[i];
            return [start, end];
        }
        return [start, chunkEnd];
    });
    cache.prefetch(ranges, P.mergeGap, P.readerSpanMax);
    return held;
}

// Runs fn(0) … fn(n − 1), at most k at a time. After a failure no new call starts; the
// running ones finish, then the first error is thrown.
async function _eachLimited(n, k, fn) {
    let next = 0, failed = false, error;
    const worker = async () => {
        while (!failed && next < n) {
            const i = next++;
            try { await fn(i); }
            catch (e) { if (!failed) { failed = true; error = e; } }
        }
    };
    await Promise.all(Array.from({ length: Math.min(k, n) }, worker));
    if (failed) throw error;
}

// Reads the subtrees below a chunk's proxies (or a walk's), `items` as [start, chunkEnd,
// spanEnd]: one merged prefetch, then each(i) reads item i's subtree, readerConcurrency
// at a time. Depth-first and bounded, so the readers' memory doesn't grow with the size
// of what they read (a whole-cloud count of LA County passes 15.6 M chunks).
async function _readerDescend(geom, items, each) {
    const held = _hierarchyPrefetchForReader(geom, items);
    const release = (i) => { _readerHeld -= held[i]; held[i] = 0; };
    try {
        await _eachLimited(items.length, HIERARCHY_PRECACHE.readerConcurrency, async (i) => {
            try { await each(i); } finally { release(i); }
        });
    } finally {
        for (let i = 0; i < held.length; i++) release(i);   // items a failure left unread
    }
}

// Strokes running per geometry, each told of the chunks parsed while it runs.
const _hcStrokes = new Map();           // geometry → Set(stroke planner)

function _hierarchyParsed(node) {
    const geom = node.octreeGeometry;
    const cache = _hierarchyCacheFor(geom);
    if (cache.layoutOk) {
        cache.checkLayout(Number(node.hierarchyByteOffset) + Number(node.hierarchyByteSize),
            _hierarchySpanEnd(geom, node), _hierarchyChunkProxies(node));
    }
    const planners = _hcStrokes.get(geom);
    if (!planners) return;
    for (const planner of planners) {
        try { planner.afterParse(node); }
        catch (e) { console.warn("[brush] hierarchy precache:", e); }
    }
}

// A stroke's planner: collect(node, inherited, out) lists the proxies at or below `node`
// the stroke will load. Plans the proxies in memory now and those in chunks parsed later.
function _hierarchyStrokeBegin(geom, planner) {
    const cache = _hierarchyCacheFor(geom);
    if (!cache.whole && cache.size !== null && cache.size <= HIERARCHY_PRECACHE.wholeMax
        && cache.planned >= HIERARCHY_PRECACHE.wholeFraction * cache.size && !cache.has(0, cache.size)) {
        cache.whole = cache.fetch(0, cache.size, true).catch(() => { cache.whole = null; });
    }
    let planners = _hcStrokes.get(geom);
    if (!planners) { planners = new Set(); _hcStrokes.set(geom, planners); }
    planners.add(planner);
    const frontier = [];
    planner.collect(geom.root, null, frontier);
    _hierarchyStrokePlan(geom, frontier);
}

function _hierarchyStrokePlan(geom, proxies) {
    if (proxies.length === 0) return;
    HIERARCHY_PRECACHE.stats.anticipated += proxies.length;
    const P = HIERARCHY_PRECACHE;
    _hierarchyCacheFor(geom).planned += _hierarchyPrefetchItems(geom,
        proxies.map(p => _proxyItem(geom, p)), P.spanMax, P.mergeGap, P.requestMax);
}

function _hierarchyStrokeEnd(geom, planner) {
    const planners = _hcStrokes.get(geom);
    if (!planners) return;
    planners.delete(planner);
    if (planners.size === 0) _hcStrokes.delete(geom);
}

// One Potree 2.0 hierarchy chunk: 22-byte records (type u8, childMask u8, numPoints
// u32, byteOffset i64, byteSize i64), breadth-first. Record 0 is the chunk's own
// root; type-2 records are proxies, which reappear as record 0 of the chunk they
// point to.
async function _fetchChunk20(geom, offset, size) {
    if (HIERARCHY_PRECACHE.enabled) {
        const cache = _hierarchyCacheFor(geom);
        await cache.wholeForReaders();
        if (cache.size !== null) _hierarchyBytes.set(geom, cache.size);
        const start = Number(offset);
        return new DataView(await cache.read(start, start + Number(size)));
    }
    const file = await _hierarchyFile(geom);
    if (file) return new DataView(file, Number(offset), Number(size));
    return _hierarchyFetch(async () => {
        const res = await _withRetries(() => fetch(`${geom.loader.url}/../hierarchy.bin`, {
            headers: { Range: `bytes=${offset}-${offset + size - 1n}` },
        }));
        if (!res.ok) throw new Error(`hierarchy.bin: HTTP ${res.status}`);
        const total = Number(res.headers.get("Content-Range")?.split("/")[1]);   // "bytes a-b/total"
        if (total > 0) _hierarchyBytes.set(geom, total);
        return new DataView(await res.arrayBuffer());
    });
}

// One COPC hierarchy page: { nodes, pages }, keyed "d-x-y-z". A page lists its own
// root under `nodes`; child pages are listed under `pages`.
function _fetchPageCopc(geom, page) {
    return _hierarchyFetch(() => _withRetries(() => window.Copc.Copc.loadHierarchyPage(geom.getter, page)));
}

// `spanEnd`: where the chunk's subtree span ends, or null (see the hierarchy cache).
// Only chunks with proxies stay memoized: one without is a single read, and most chunks
// are like that (15.6 M of LA County's, whose memo would outgrow the JS heap).
function _countChunk20(geom, offset, size, spanEnd = null) {
    let hasProxies = false;
    return _countOnce(geom, offset, async () => {
        const view = await _fetchChunk20(geom, offset, size);
        let nodes = 0, points = 0;
        const proxies = [];
        for (let o = 0; o + 22 <= view.byteLength; o += 22) {
            const byteOffset = view.getBigInt64(o + 6, true);
            const byteSize   = view.getBigInt64(o + 14, true);
            if (view.getUint8(o) === 2) { proxies.push([byteOffset, byteSize]); continue; }
            nodes++;
            if (byteSize !== 0n) points += view.getUint32(o + 2, true);   // the loader's #1125 workaround
        }
        hasProxies = proxies.length > 0;
        const offsets = proxies.map(([o]) => Number(o));
        _hierarchyCheckChunk(geom, offset, size, spanEnd, offsets);
        const ends = _siblingSpanEnds(offsets, spanEnd);
        await _readerDescend(geom, proxies.map(([o, s], i) => [Number(o), Number(o + s), ends[i]]), async (i) => {
            const r = await _countChunk20(geom, proxies[i][0], proxies[i][1], ends[i]);
            nodes += r.nodes; points += r.points;
        });
        return { nodes, points };
    }, () => hasProxies);
}

function _countPageCopc(geom, page) {
    return _countOnce(geom, page.pageOffset, async () => {
        const { nodes, pages } = await _fetchPageCopc(geom, page);
        let count = 0, points = 0;
        for (const info of Object.values(nodes)) { count++; points += info.pointCount; }
        const nested = await Promise.all(Object.values(pages).map(pg => _countPageCopc(geom, pg)));
        for (const r of nested) { count += r.nodes; points += r.points; }
        return { nodes: count, points };
    });
}

/**
 * Nodes and points in the subtree under `root`, root included, per the file's full
 * hierarchy rather than the part of it that happens to be in memory.
 */
function countSubtreeFromFile(root) {
    return _countSubtreesFromFile([root]);
}

// The same for several disjoint subtrees, summed: their proxies are read as one set, so
// neighbouring subtrees share requests.
async function _countSubtreesFromFile(roots) {
    let nodes = 0, points = 0;
    const proxies = new Map();                              // 2.0 geometry → proxies below the roots
    const pending = [];
    const add = (r) => { nodes += r.nodes; points += r.points; };
    const walk = (node) => {
        if (node.nodeType === 2) {                          // 2.0 proxy: chunk not parsed yet
            const list = proxies.get(node.octreeGeometry);
            if (list) list.push(node); else proxies.set(node.octreeGeometry, [node]);
            return;
        }
        const page = node.owner && !node.nodeinfo && node.owner.pages[window.Copc.Key.toString(node.key)];
        if (page) {                                         // COPC node whose page isn't loaded
            pending.push(_countPageCopc(node.owner, page).then(add));
            return;
        }
        nodes++;
        points += geoNodeNumPoints(node);
        for (let i = 0; i < 8; i++) if (node.children[i]) walk(node.children[i]);
    };
    roots.forEach(walk);
    for (const [geom, list] of proxies) {
        const items = list.map(p => _proxyItem(geom, p));
        pending.push(_readerDescend(geom, items, async (i) =>
            add(await _countChunk20(geom, list[i].hierarchyByteOffset, list[i].hierarchyByteSize, items[i][2]))));
    }
    await Promise.all(pending);
    return { nodes, points };
}

// ── Stroke profiler: the part of a skipped subtree a stroke covers ──
// A node skipped because it can't change is only partly covered, so its whole subtree
// would overstate the work skipped. The covered part is every node whose box meets the
// brush sphere (a child's box lies inside its parent's, so a node that misses the sphere
// takes its subtree with it), counted from the file like the subtrees above. Boxes of
// nodes not in memory are derived from the nearest in-memory ancestor's box. Depends on
// the sphere, so nothing is memoized.
const _coveredBox = new THREE.Box3();

function _boxMeetsSphere(box, c, radiusSq) {
    return boxDistSqLocal(box, c.x, c.y, c.z) <= radiusSq;
}

// A 2.0 chunk's records are breadth-first, each node's children in child-index order,
// so a record's box follows from its parent's by createChildAABB's split (z=1, y=2, x=4).
// `box` is the chunk root's (record 0's) box.
async function _countCoveredChunk20(geom, offset, size, box, c, radiusSq, spanEnd = null) {
    const view = await _fetchChunk20(geom, offset, size);
    const n = Math.floor(view.byteLength / 22);
    const b = new Float64Array(6 * n);              // min xyz, max xyz per record
    b.set([box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z]);
    let next = 1, nodes = 0, points = 0;
    const proxies = [];                             // [offset, size, box, hit]
    for (let i = 0; i < n; i++) {
        const o = 22 * i, k = 6 * i;
        _coveredBox.min.set(b[k], b[k + 1], b[k + 2]);
        _coveredBox.max.set(b[k + 3], b[k + 4], b[k + 5]);
        const hit = _boxMeetsSphere(_coveredBox, c, radiusSq);
        if (view.getUint8(o) === 2) {               // proxy: its subtree is its own chunk
            proxies.push([view.getBigInt64(o + 6, true), view.getBigInt64(o + 14, true), hit && _coveredBox.clone(), hit]);
            continue;
        }
        if (hit) {
            nodes++;
            if (view.getBigInt64(o + 14, true) !== 0n) points += view.getUint32(o + 2, true);   // #1125
        }
        const mask = view.getUint8(o + 1);
        for (let ci = 0; ci < 8; ci++) {
            if (!(mask & (1 << ci)) || next >= n) continue;
            const q = 6 * next++;
            for (let a = 0; a < 3; a++) {           // a = 0, 1, 2 → x, y, z
                const half = (b[k + 3 + a] - b[k + a]) / 2;
                const upper = ci & (4 >> a);        // x = 4, y = 2, z = 1
                b[q + a]     = upper ? b[k + a] + half : b[k + a];
                b[q + 3 + a] = upper ? b[k + 3 + a]    : b[k + 3 + a] - half;
            }
        }
    }
    const offsets = proxies.map(([o]) => Number(o));
    _hierarchyCheckChunk(geom, offset, size, spanEnd, offsets);
    const ends = _siblingSpanEnds(offsets, spanEnd);                          // from all proxies, hit or not
    const hits = proxies.map((p, i) => [...p, ends[i]]).filter(p => p[3]);
    await _readerDescend(geom, hits.map(([o, s, , , end]) => [Number(o), Number(o + s), end]), async (i) => {
        const [o, s, hitBox, , end] = hits[i];
        const r = await _countCoveredChunk20(geom, o, s, hitBox, c, radiusSq, end);
        nodes += r.nodes; points += r.points;
    });
    return { nodes, points };
}

// COPC keys are absolute ("d-x-y-z"), so any node's box follows from one in-memory
// ancestor's key and box: a depth d node is a cell of the ancestor's box split 2^(d−d0) ways.
function _copcKeyBox(name, anchorKey, anchorBox, out) {
    const [d, x, y, z] = name.split("-").map(Number);
    const [d0, x0, y0, z0] = anchorKey;
    const s = 2 ** (d - d0);
    const mn = anchorBox.min, mx = anchorBox.max;
    const ex = (mx.x - mn.x) / s, ey = (mx.y - mn.y) / s, ez = (mx.z - mn.z) / s;
    out.min.set(mn.x + (x - x0 * s) * ex, mn.y + (y - y0 * s) * ey, mn.z + (z - z0 * s) * ez);
    out.max.set(out.min.x + ex, out.min.y + ey, out.min.z + ez);
    return out;
}

async function _countCoveredPageCopc(geom, page, anchorKey, anchorBox, c, radiusSq) {
    const { nodes, pages } = await _fetchPageCopc(geom, page);
    let count = 0, points = 0;
    for (const [name, info] of Object.entries(nodes)) {
        if (!_boxMeetsSphere(_copcKeyBox(name, anchorKey, anchorBox, _coveredBox), c, radiusSq)) continue;
        count++; points += info.pointCount;
    }
    const nested = await Promise.all(Object.entries(pages)
        .filter(([name]) => _boxMeetsSphere(_copcKeyBox(name, anchorKey, anchorBox, _coveredBox), c, radiusSq))
        .map(([, pg]) => _countCoveredPageCopc(geom, pg, anchorKey, anchorBox, c, radiusSq)));
    for (const r of nested) { count += r.nodes; points += r.points; }
    return { nodes: count, points };
}

/**
 * Nodes and points under `root`, root included, whose boxes meet the sphere at `c`
 * (pointcloud-local) with squared radius `radiusSq`, per the file's full hierarchy.
 */
function countCoveredFromFile(root, c, radiusSq) {
    return _countCoveredFromFile([root], c, radiusSq);
}

// The same for several disjoint subtrees, summed (see _countSubtreesFromFile).
async function _countCoveredFromFile(roots, c, radiusSq) {
    let nodes = 0, points = 0;
    const proxies = new Map();                              // 2.0 geometry → proxies the sphere meets
    const pending = [];
    const add = (r) => { nodes += r.nodes; points += r.points; };
    const walk = (node) => {
        if (!_boxMeetsSphere(node.boundingBox, c, radiusSq)) return;
        if (node.nodeType === 2) {                          // 2.0 proxy: chunk not parsed yet
            const list = proxies.get(node.octreeGeometry);
            if (list) list.push(node); else proxies.set(node.octreeGeometry, [node]);
            return;
        }
        const page = node.owner && !node.nodeinfo && node.owner.pages[window.Copc.Key.toString(node.key)];
        if (page) {                                         // COPC node whose page isn't loaded
            pending.push(_countCoveredPageCopc(node.owner, page, node.key, node.boundingBox, c, radiusSq).then(add));
            return;
        }
        nodes++;
        points += geoNodeNumPoints(node);
        for (let i = 0; i < 8; i++) if (node.children[i]) walk(node.children[i]);
    };
    roots.forEach(walk);
    for (const [geom, list] of proxies) {
        const items = list.map(p => _proxyItem(geom, p));
        pending.push(_readerDescend(geom, items, async (i) => add(await _countCoveredChunk20(geom,
            list[i].hierarchyByteOffset, list[i].hierarchyByteSize, list[i].boundingBox, c, radiusSq, items[i][2]))));
    }
    await Promise.all(pending);
    return { nodes, points };
}

/**
 * Edge length (pointcloud-local) and depth of the deepest node containing the brush
 * center: the octree's finest cell where the stroke landed. Unlike the subtree counts
 * above, this loads any proxy on that path, point data included, since a proxy's
 * children aren't known until it loads.
 */
async function leafExtentAt(pc, centerWorld) {
    const p = centerWorld.clone().applyMatrix4(pc.matrixWorld.clone().invert());
    let node = pc.pcoGeometry.root;
    for (;;) {
        const isProxy = node.nodeType === 2 || (node.owner && !node.nodeinfo);   // 2.0 / COPC
        if (isProxy) {
            await waitForLoad(node);                 // resolves proxy hierarchy
            Potree.lru.touch(node);                  // evictable, as in processNode
        }
        const child = Object.values(node.children).find(c => c && c.boundingBox.containsPoint(p));
        if (!child) break;
        node = child;
    }
    const b = node.boundingBox;                      // cubic, pointcloud-local
    return { w: b.max.x - b.min.x, depth: node.name.length - 1 };
}

/**
 * Log one stroke's profile as a table. Called after the stroke has been timed, so
 * the hierarchy fetches and loads the report needs never show up in its numbers.
 */
async function reportStrokeProfile(p, pointcloud, centerWorld, radius, strokeMs) {
    const sum = (roots) => _countSubtreesFromFile(roots);   // neighbouring subtrees share requests
    const coveredBelowSkipped = () => _countCoveredFromFile(p.skipRoots, p.center, p.radiusSq);
    let bulk = null, same = null, leaf = null, covered = null;
    await Promise.all([
        Promise.all([sum(p.bulkRoots), sum(p.sameRoots)]).then(
            (r) => { [bulk, same] = r; },
            (e) => console.warn("[brush] profiler: hierarchy fetch failed, subtree rows omitted", e)),
        leafExtentAt(pointcloud, centerWorld).then(
            (r) => { leaf = r; },
            (e) => console.warn("[brush] profiler: leaf lookup failed, leaf rows omitted", e)),
        p.skipRoots && coveredBelowSkipped().then(
            (r) => { covered = r; },
            (e) => console.warn("[brush] profiler: hierarchy fetch failed, skipped-subtree rows omitted", e)),
    ]);
    const ok = bulk !== null;
    // Enclosed = descendants only; the implicit roots themselves were visited.
    const enclosed = ok ? bulk.nodes - p.bulkRoots.length + same.nodes - p.sameRoots.length : null;
    // Covered below skipped = likewise descendants only. Without BRUSH_PROFILE_SKIPPED the
    // subtrees skipped as already this class are missing from the total and naive rows.
    const coveredBelow = covered ? covered.nodes - p.skipRoots.length : null;
    const totalsOk = ok && (!p.skipRoots || covered !== null);
    // Naive all-explicit pass: every point of every node the stroke covers gets checked.
    const naive  = totalsOk ? p.points + bulk.points + same.points + (covered?.points ?? 0) : null;
    const noGeom = p.visited - p.bulkRoots.length - p.sameRoots.length - p.partial - p.partialSame;
    // Leaf extent in world units, like the radius (the pointcloud's scale is uniform).
    const leafW  = leaf ? leaf.w * pointcloud.matrixWorld.getMaxScaleOnAxis() : null;

    const rows = [
        ["brush radius",                      +formatRadius(radius)],
        ["leaf extent at center",             leaf ? +leafW.toPrecision(4) : null],
        ["leaf depth at center",              leaf ? leaf.depth : null],
        ["radius / leaf extent",              leaf ? +(radius / leafW).toPrecision(3) : null],
        [covered ? "nodes: total (visited + enclosed + covered)" : "nodes: total (visited + enclosed)",
                                              totalsOk ? p.visited + enclosed + (coveredBelow ?? 0) : null],
        ["nodes: visited",                    p.visited],
        ["↳ bulk-marked implicit",            p.bulkRoots.length],
        ["↳ already implicit, skipped",       p.sameRoots.length],
        ["↳ already this class, not entered", p.partialSame || null],
        ["↳ explicit per-point",              p.partial],
        ["↳ …of which fully inside",          p.partialInside],
        ["↳ no geometry",                     noGeom || null],
        ["nodes: enclosed below implicit",    enclosed],
        ["nodes: covered below skipped",      coveredBelow],
        ["nodes: force-loaded",               p.loaded],
        ["points: classified",                ok ? bulk.points + p.changed : null],
        ["↳ implicit (bulk subtrees)",        ok ? bulk.points : null],
        ["↳ explicit (changed)",              p.changed],
        ["points: skipped, already implicit", ok ? same.points : null],
        ["points: skipped, already this class", covered ? covered.points : null],
        ["points: checked per-point",         p.points],
        ["points: naive all-explicit checks", naive],
        ["points: checks saved",              naive !== null ? naive - p.points : null],
        ["points: checks saved %",            naive > 0 ? +(100 * (naive - p.points) / naive).toFixed(1) : null],
        ["time: stroke ms",                   +strokeMs.toFixed(1)],
        // Summed across concurrent awaits, so it can exceed wall time — read it as
        // "aggregate node-load wait", not wall-clock network time.
        ["time: aggregate load-wait ms",      +p.netMs.toFixed(1)],
    ];
    window.__lastStrokeProfile = Object.fromEntries(rows);
    console.log("[brush] stroke profile");
    console.table(Object.fromEntries(rows.filter(([, v]) => v !== null)));
}

async function classifyInRadius(pointcloud, centerWorld, radius, classification) {
  // Raise load concurrency for the duration of the stroke (restored in finally).
  const _savedMaxNodesLoading = Potree.maxNodesLoading;
  Potree.maxNodesLoading = Math.max(Potree.maxNodesLoading, BRUSH_MAX_NODES_LOADING);

  // ── Optional profiler (set window.BRUSH_PROFILE = true to enable) ──
  // Characterizes a stroke: the radius against the leaf extent where it landed, how
  // visited nodes split between implicit (bulk) and explicit (per-point), how much
  // of the octree the implicit subtrees stand for, per-point checks vs a naive
  // all-explicit pass, and wall time spent awaiting network loads vs total. Zero
  // cost when disabled. Logs one table per stroke (reportStrokeProfile).
  // Also set window.BRUSH_PROFILE_SKIPPED = true to count the part of each subtree
  // skipped as already this class that the stroke covers. Off by default: the count
  // reads hierarchy after the stroke is timed, but the next stroke waits for it.
  const _prof = window.BRUSH_PROFILE ? {
      t0: performance.now(), visited: 0, loaded: 0, partial: 0, partialInside: 0, partialSame: 0,
      netMs: 0, points: 0, changed: 0,
      bulkRoots: [], sameRoots: [],  // implicit subtree roots: newly bulk-marked / already this class
      skipRoots: window.BRUSH_PROFILE_SKIPPED ? [] : null   // partly covered, already this class
  } : null;

  // #5: Coalesce per-node classification-buffer uploads. Instead of setting
  // needsUpdate per node mid-traversal, collect dirtied attributes and flush them
  // at await boundaries (so resident work still paints during network waits) and
  // once at stroke end. Declared before the try so the finally can flush them.
  const _dirtyAttrs = new Set();
  const flushDirty = () => {
      if (_dirtyAttrs.size === 0) return;
      window.__bench?.onEditFlag?.();
      for (const attr of _dirtyAttrs) attr.needsUpdate = true;
      _dirtyAttrs.clear();
  };

  let _hcPlanner = null;   // hierarchy precache for this stroke, set up below

  try {
    const pcName   = pointcloud.name;
    const cls      = viewer.classifications;
    const editedGeoNodes = new Set();

    let pcEdits = brushEdits.get(pcName);

    const visibleLUT = new Uint8Array(256);
    let anyClassHidden = false;
    for (let k = 0; k < 256; k++) {
        // A class without an entry shows as class k % 32 does (LAS 1.0–1.3 kept flags in the top
        // bits), else as DEFAULT, as recomputeClassification() in potree.js renders it.
        const entry = [cls[k], cls[k % 32], cls.DEFAULT].find(e => e?.color);
        const vis = (entry?.visible !== false) ? 1 : 0;
        visibleLUT[k] = vis;
        if (!vis) anyClassHidden = true;
    }

    const ensurePcEdits = () => {
        if (!pcEdits) { pcEdits = new Map(); brushEdits.set(pcName, pcEdits); }
        return pcEdits;
    };

    // Names of the ledger entries below a node, by binary search in a sorted snapshot of
    // the ledger's names instead of a scan of the whole ledger per enclosed node; names
    // sharing a prefix are contiguous when sorted. The snapshot is taken on first use and
    // stays exact for the rest of the stroke: a node's subtree is reached only through
    // the node, whose enclosed-node branch runs before any await, so no entry below it is
    // added before it is visited. Entries are read live; names deleted since are skipped.
    let _sortedNames = null;
    const descendantEntryNames = (prefix) => {
        if (!pcEdits || pcEdits.size === 0) return [];
        if (!_sortedNames) _sortedNames = [...pcEdits.keys()].sort();
        let lo = 0, hi = _sortedNames.length;
        while (lo < hi) {                       // first name that sorts after the prefix itself
            const mid = (lo + hi) >>> 1;
            if (_sortedNames[mid] <= prefix) lo = mid + 1; else hi = mid;
        }
        const out = [];
        for (let i = lo; i < _sortedNames.length && _sortedNames[i].startsWith(prefix); i++) {
            if (pcEdits.has(_sortedNames[i])) out.push(_sortedNames[i]);
        }
        return out;
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
    if (_prof) { _prof.center = _centerPcLocal; _prof.radiusSq = _radiusLocalSq; }

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

    // ── Hierarchy precache: the proxies this stroke will load ──
    // processNode's prunes, read-only, on the hierarchy in memory: a node the traversal
    // would prune, bulk-mark or skip as already this class takes its subtree out; a proxy
    // it would load is listed. Run over the in-memory octree when the stroke starts and
    // over each chunk parsed while it runs, so their hierarchy is fetched in a few span
    // requests ahead of the traversal (see the hierarchy cache). A wrong guess costs bytes
    // or a request, never a different result.
    const _hcGeom = pointcloud.pcoGeometry;
    const _hcBox  = new THREE.Box3();
    _hcPlanner = HIERARCHY_PRECACHE.enabled && _hcGeom?.root?.octreeGeometry === _hcGeom ? {
        collect(node, inherited, out) {
            const box = node.boundingBox;
            if (boxDistSqLocal(box, _centerPcLocal.x, _centerPcLocal.y, _centerPcLocal.z) > _radiusLocalSq) return;
            if (toClip) {
                _hcBox.copy(box).applyMatrix4(pointcloud.matrixWorld);
                if (isNodeFullyClipped(_hcBox, clipInverses, clipShowInside)) return;
            }
            const entry = pcEdits?.get(node.name);
            const eff = isAllEntry(entry) ? entry.classification : inherited;
            if (boxFullyInsideSphere(box, _centerPcLocal, _radiusLocalSq)) {
                const below = descendantEntryNames(node.name);
                if (isAllEntry(entry) && entry.classification === classification
                    && !entry.overrides && below.length === 0) return;                // already all this class
                let canBulk = !anyClassHidden || (eff !== null && visibleLUT[eff] === 1
                    && entryClassesVisible(entry, visibleLUT)
                    && below.every(name => entryClassesVisible(pcEdits.get(name), visibleLUT)));
                if (canBulk && toClip) canBulk = isNodeFullyVisibleUnderClip(_hcBox, clipInverses, clipShowInside);
                if (canBulk) return;                                                  // bulk-marked, not loaded
            }
            if (eff === classification && !getOverrides(entry)
                && descendantEntryNames(node.name).length === 0) return;              // already this class
            if (node.nodeType === 2) { out.push(node); return; }
            for (let i = 0; i < 8; i++) if (node.children[i]) this.collect(node.children[i], eff, out);
        },
        afterParse(node) {
            const out = [];
            this.collect(node, node.parent ? getInheritedBaseline(pcEdits, node.parent.name) : null, out);
            _hierarchyStrokePlan(_hcGeom, out);
        },
    } : null;
    if (_hcPlanner) _hierarchyStrokeBegin(_hcGeom, _hcPlanner);

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
        let effectiveBaseline = isAllEntry(ownEntry) ? ownEntry.classification : inheritedBaseline;

        if (_prof) _prof.visited++;

        let skipDistanceTest = false;

        if (boxFullyInsideSphere(localBox, _centerPcLocal, _radiusLocalSq)) {
            ensurePcEdits();
            // A bulk mark replaces every entry below this node, so both the shortcut and
            // the gate must account for those entries, not only the node's own.
            const descendants = descendantEntryNames(nodeName);

            // Nothing to do: the node is already a pure baseline of the target class and
            // no entry below it says otherwise.
            if (isAllEntry(ownEntry)
                && ownEntry.classification === classification
                && !ownEntry.overrides
                && descendants.length === 0) {
                if (_prof) _prof.sameRoots.push(geoNode);
                return;
            }

            // Visibility gate: bulk only if no point in the subtree has a hidden class.
            let canBulk;
            if (!anyClassHidden) {
                canBulk = true;
            } else if (effectiveBaseline !== null) {
                // Under a baseline the ledger fixes every point's class (the baseline, an
                // override, or an entry below), so check those without loading anything.
                canBulk = visibleLUT[effectiveBaseline] === 1
                    && entryClassesVisible(ownEntry, visibleLUT)
                    && descendants.every(name => entryClassesVisible(pcEdits.get(name), visibleLUT));
            } else {
                // No baseline at or above: the subtree still holds source classes, unknown
                // until loaded, so any hidden class blocks bulk.
                canBulk = false;
            }

            // Clipping gate: bulk only if every point in the subtree is visible.
            if (canBulk && toClip) {
                canBulk = isNodeFullyVisibleUnderClip(_boxWorld, clipInverses, clipShowInside);
            }

            if (canBulk) {
                for (const name of descendants) pcEdits.delete(name);
                pcEdits.set(nodeName, { all: true, classification });
                fillLoadedSubtree(geoNode, classification);
                if (_prof) _prof.bulkRoots.push(geoNode);
                return;
            }

            skipDistanceTest = true;
        }

        // ── Partial intersection ──
        // Nothing can change: the baseline is already the target class, and neither
        // overrides of this node nor entries below it say otherwise. Skip the node and
        // its subtree without loading them, as the enclosed-node shortcut above does.
        if (effectiveBaseline === classification
            && !getOverrides(ownEntry)
            && descendantEntryNames(nodeName).length === 0) {
            if (_prof) { _prof.partialSame++; _prof.skipRoots?.push(geoNode); }
            return;
        }

        let justLoaded = false;
        if (!geoNode.loaded) {
            flushDirty();              // paint resident work done so far during the wait
            if (_prof) { _prof.loaded++; const _tNet = performance.now(); await waitForLoad(geoNode); _prof.netMs += performance.now() - _tNet; }
            else       { await waitForLoad(geoNode); }
            justLoaded = true;         // onNodeLoaded → reconcileFreshNode already filled
                                       // this buffer from the current ledger (#4)
            // Read the entry again: reconcileFreshNode may have promoted it to an "all" entry
            // (explicitToImplicitNode), replacing the overrides Map read above. Writing into
            // that detached Map would lose this stroke's edits to the node. Reloads mid-stroke
            // are routine now that loaded nodes are evicted (see the LRU touch below).
            ownEntry = pcEdits?.get(nodeName);
            effectiveBaseline = isAllEntry(ownEntry) ? ownEntry.classification : inheritedBaseline;
        }
        if (!geoNode.geometry) return;

        // Register the node with Potree's LRU, which otherwise only knows nodes the renderer
        // has drawn: one a stroke loads off-screen or below the visible LOD would stay in
        // memory for good. In the LRU it is evicted oldest-first once loaded points pass
        // Potree.pointLoadLimit (2 × point budget), and until then a later stroke nearby
        // still finds it cached instead of fetching it again.
        Potree.lru.touch(geoNode);

        const classAttr = geoNode.geometry.attributes['classification'];
        const positions = geoNode.geometry.attributes.position;
        if (!classAttr) return;

        if (_prof) {
            _prof.partial++;
            if (skipDistanceTest) _prof.partialInside++;
            _prof.points += positions.count;
        }

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

        let nChanged = 0;

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
                // Node-local coordinates, so compare with the local radius.
                if (dx*dx + dy*dy + dz*dz > _radiusLocalSq) continue;
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
            nChanged++;

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

        if (nChanged) _dirtyAttrs.add(classAttr);   // #5: flushed at await boundaries / stroke end
        if (_prof) _prof.changed += nChanged;

        const childPromises = [];
        for (let i = 0; i < 8; i++) {
            if (geoNode.children[i]) childPromises.push(processNode(geoNode.children[i], effectiveBaseline));
        }
        if (childPromises.length > 0) await Promise.all(childPromises);
    }

    await processNode(pointcloud.pcoGeometry.root, null);

    // Promotion pass — direct geoNode refs, no findGeoNode search. A node evicted since
    // the stroke edited it is promoted too: promotion reads only the ledger, numPoints and
    // children, and dispose() keeps all of those (children are known, since it was loaded).
    if (pcEdits) {
        for (const geoNode of editedGeoNodes) explicitToImplicitNode(geoNode, pcEdits);
    }

    updateEditCount();
  } finally {
    if (_hcPlanner) _hierarchyStrokeEnd(pointcloud.pcoGeometry, _hcPlanner);
    // Flush any remaining classification-buffer changes (#5), restore steady-state
    // concurrency, and let render-driven loads resume.
    flushDirty();
    Potree.maxNodesLoading = _savedMaxNodesLoading;
    pumpLoadQueue();

    if (_prof) await reportStrokeProfile(_prof, pointcloud, centerWorld, radius, performance.now() - _prof.t0);
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

// pointcloud → most recent position waiting for the stroke lock. One slot per
// cloud, so painting every visible cloud doesn't overwrite the others' slots.
const _pendingPaints = new Map();

async function paintAtPoint(pointcloud, hit) {
    if (brushState.strokeInProgress) {
        // Don't drop — remember the most recent target and apply it when free
        _pendingPaints.set(pointcloud, hit.position.clone());
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

        // Drain the longest-waiting cloud next (Map keeps insertion order and
        // re-setting a key doesn't move it, so clouds take turns)
        const next = _pendingPaints.entries().next();
        if (!next.done) {
            const [pc, position] = next.value;
            _pendingPaints.delete(pc);
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

            <div>
                <div class="brush-label" style="margin-bottom:6px;">
                    Tile Overlap &nbsp;
                    <span id="grid-overlap-label" style="color:#c4c0ff; font-weight:700;">none</span>
                </div>
                <div class="brush-slider-row">
                    <input id="grid-overlap-slider" class="brush-slider" type="range" min="1" max="1.5" value="1" step="0.05">
                    <span class="brush-slider-value" id="grid-overlap-value">1.00×</span>
                </div>
            </div>

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
        generateGrid();
    });

    const overlapSlider = document.getElementById("grid-overlap-slider");
    const overlapLabel = document.getElementById("grid-overlap-label");
    const overlapValue = document.getElementById("grid-overlap-value");

    overlapSlider.addEventListener("input", () => {
        const f = parseFloat(overlapSlider.value);
        overlapValue.textContent = `${f.toFixed(2)}×`;
        // each tile grows by (f - 1) / 2 of its base size on every side
        const perSide = Math.round((f - 1) / 2 * 100);
        overlapLabel.textContent = perSide === 0 ? "none" : `+${perSide}% per side`;
        generateGrid();
    });

    document.getElementById("grid-volume-btn").addEventListener("click", () => {
        viewer.setClipTask(1);
        const master = viewer.volumeTool.startInsertion({ clip: true });
        // build the grid as soon as the volume is placed
        master.addEventListener("drop", function onDrop() {
            master.removeEventListener("drop", onDrop);
            generateGrid();
        });
    });

    document.getElementById("grid-clear-btn").addEventListener("click", () => {
        removeGridTiles();

        const master = viewer.scene.volumes.find(
            v => v instanceof Potree.BoxVolume && !v._isGridSub
        );
        if (master) viewer.scene.removeVolume(master);
    });

    // Rebuilds the tiles from the current slider values; called on every slider change
    function generateGrid() {
        const n = parseInt(slider.value);
        // Pick the first user-created BoxVolume that isn't one of our sub-tiles
        const master = viewer.scene.volumes.find(
            v => v instanceof Potree.BoxVolume && !v._isGridSub
        );
        if (!master) return;

        removeGridTiles();

        // Subdivide in X and Y, leave Z full. Tiles keep their grid centers and are
        // enlarged in X/Y by the overlap factor, so neighbours share a redundant strip.
        const overlap = parseFloat(overlapSlider.value);
        const subScale = new THREE.Vector3(
            master.scale.x / n * overlap,
            master.scale.y / n * overlap,
            master.scale.z
        );
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
    }

    document.getElementById("grid-share-btn").addEventListener("click", openShareLinksModal);
}

function removeGridTiles() {
    for (const sub of _gridSubVolumes) viewer.scene.removeVolume(sub);
    _gridSubVolumes = [];

    // labels are rebuilt on every slider tick, so free their canvas textures
    for (const lbl of _gridLabels) {
        viewer.scene.scene.remove(lbl);
        lbl.material.map.dispose();
        lbl.material.dispose();
    }
    _gridLabels = [];

    // also clear the back-reference on any tile volumes still in the scene
    for (const v of viewer.scene.volumes) if (v._tileLabel) v._tileLabel = null;
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
            { keys: ["C"],                  desc: "Cycle RGB / classification blend" },
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
            { keys: ["C"],              desc: "Cycle photo opacity, in photo view" },
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
    "Z": "brush", "Q": "brush", "E": "brush", "C": "brush",
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
    viewer.setPointBudget(5*1000*1000);
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

    // Admin buttons — Work Distribution, and Analysis where brush_ledger_analysis.js is loaded
    function makeAdminBtn(text, title, onClick) {
        const b = document.createElement("button");
        b.title = title;
        b.style.cssText = `
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
            margin-right: 6px;
        `;
        b.textContent = text;
        b.addEventListener("mouseenter", () => {
            b.style.background = "rgba(79,70,229,0.25)";
            b.style.color = "#c4c0ff";
            b.style.borderColor = "rgba(79,70,229,0.4)";
        });
        b.addEventListener("mouseleave", () => {
            b.style.background = "rgba(255,255,255,0.06)";
            b.style.color = "#aaa";
            b.style.borderColor = "rgba(255,255,255,0.15)";
        });
        b.addEventListener("click", onClick);
        header.appendChild(b);
        return b;
    }
    const distBtn = makeAdminBtn("⊞ Work Distribution", "Work Distribution", openGridPanel);
    distBtn.style.marginLeft = "auto";
    if (typeof openLedgerAnalysisPanel === "function") {
        makeAdminBtn("⇄ Analysis", "Compare and merge ledger files", openLedgerAnalysisPanel);
    }

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
            item.dataset.value = pc.name;
            item.style.cssText = optionStyle(false);

            const name = document.createElement("span");
            name.textContent = pc.name;
            name.title = pc.name;
            name.style.cssText = "overflow:hidden; text-overflow:ellipsis; white-space:nowrap;";
            item.appendChild(name);

            // Visibility toggle — setting pc.visible fires visibility_changed,
            // which keeps the sidebar tree in sync.
            const visChk = document.createElement("input");
            visChk.type = "checkbox";
            visChk.className = "brush-vis-checkbox";
            visChk.title = "Toggle visibility";
            visChk.checked = pc.visible;
            visChk.addEventListener("click", (e) => { e.stopPropagation(); });
            visChk.addEventListener("change", () => { pc.visible = visChk.checked; });
            item.appendChild(visChk);

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
            display: flex; align-items: center; gap: 8px;
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
        label.className = "brush-class-label";
        label.textContent = cls.name;
        label.title = cls.name;
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
    blendLabel.innerHTML = 'RGB / Classification Blend <span class="brush-hotkey">C</span>';
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

    // Benchmark samples (seconds), same store as the ledger analysis: window.__laTimes.exportPotree / .exportWorld
    const recordExportTime = (kind, seconds) => ((window.__laTimes ??= {})[kind] ??= []).push(seconds);

    // ── Export buttons (two formats) ──
    const exportRow = document.createElement("div");
    exportRow.style.cssText = "display:grid; grid-template-columns:1fr 1fr; gap:6px;";

    const browserBtn = document.createElement("button");
    browserBtn.className = "brush-action-btn brush-btn-success";
    browserBtn.textContent = "Potree-Only Export";
    browserBtn.title = "Fast ledger dump. Only for re-importing into the viewer.";
    browserBtn.addEventListener("click", async () => {
        const t0 = performance.now();
        try { await exportBrowserBinary(); }
        finally { recordExportTime("exportPotree", (performance.now() - t0) / 1000); }
    });

    const pythonBtn = document.createElement("button");
    pythonBtn.className = "brush-action-btn brush-btn-success";
    pythonBtn.textContent = "World-Space Export";
    pythonBtn.title = "World-space export with AABBs + positions for downstream LAS processing.";
    pythonBtn.addEventListener("click", async () => {
        const indicator = document.getElementById("brushStrokeIndicator");
        const label = indicator?.querySelector("span:not(.brush-stroke-spinner)");
        const orig  = label?.textContent;
        setStrokeIndicator(true);
        const t0 = performance.now();
        try {
            await exportWorldSpace((done, total) => {
                if (label) label.textContent = `Writing overrides: ${done.toLocaleString()} / ${total.toLocaleString()}`;
            });
        } catch (e) {
            console.error("Python export failed:", e);
        } finally {
            recordExportTime("exportWorld", (performance.now() - t0) / 1000);
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
//  Full Octree Grid
//
//  viewer.setShowBoundingBox(true) boxes only the nodes Potree is rendering
//  right now. setShowAllBoundingBoxes(true) boxes every node of every cloud,
//  loaded or not, down to the deepest level. The boxes come from the hierarchy
//  file, read like the stroke profiler's subtree counts: no point data is
//  fetched and the live octree is never expanded. Each cloud's grid is one
//  instanced LineSegments (a unit-cube outline stretched to each node) instead
//  of vanilla's object per node, which would be tens of thousands of draw calls
//  here. Same yellow as vanilla's Box3Helper; follows the cloud's transform and
//  visibility.
// ══════════════════════════════════════════════════════════════

// Nodes per cloud beyond which its grid is skipped with a warning. Memory is light
// (24 B per box); what bites first is drawing 24 vertices per box every frame.
const FULL_GRID_MAX_BOXES = 2000000;

const _fullGrids = new Map();   // pointcloud → grid; null while building, false if the build failed
let _showAllBoxes = false;
let _fullGridsHooked = false;

/**
 * viewer.setShowBoundingBox for every octree node, loaded or not. The first call
 * per cloud reads its whole hierarchy, which takes a while on large clouds; after
 * that, toggling is instant.
 */
function setShowAllBoundingBoxes(value) {
    _showAllBoxes = !!value;
    if (_showAllBoxes) {                           // retry clouds whose last build failed
        for (const [pc, grid] of _fullGrids) if (grid === false) _fullGrids.delete(pc);
    }
    if (!_fullGridsHooked) {
        viewer.addEventListener("update", _updateFullGrids);
        _fullGridsHooked = true;
    }
    _updateFullGrids();
}

// Every frame: start grids for new clouds, track each cloud's transform and
// visibility, and drop grids whose cloud has left the scene.
function _updateFullGrids() {
    for (const [pc, grid] of _fullGrids) {
        if (viewer.scene.pointclouds.includes(pc)) continue;
        _fullGrids.delete(pc);
        if (grid) {
            viewer.scene.scene.remove(grid);
            grid.geometry.dispose();
            grid.material.dispose();
        }
    }
    for (const pc of viewer.scene.pointclouds) {
        if (!_fullGrids.has(pc)) {
            if (_showAllBoxes) _buildFullGrid(pc);
            continue;
        }
        const grid = _fullGrids.get(pc);
        if (!grid) continue;
        grid.visible = _showAllBoxes && pc.visible;
        grid.matrix.multiplyMatrices(pc.matrixWorld, grid.userData.fromOrigin);
        grid.matrixWorldNeedsUpdate = true;
    }
}

async function _buildFullGrid(pc) {
    _fullGrids.set(pc, null);
    const t0 = performance.now();
    console.log(`[octree grid] reading the hierarchy of ${pc.name}…`);
    const onProgress = (p) => {
        const s = ((performance.now() - t0) / 1000).toFixed(0);
        console.log(`[octree grid] ${pc.name}: ` + (p.fraction !== null
            ? `${Math.floor(100 * p.fraction)}% of the hierarchy read, ${p.boxes.toLocaleString()} boxes so far (${s} s)`
            : `${p.boxes.toLocaleString()} boxes so far, ${p.chunks.toLocaleString()} hierarchy chunks read (${s} s)`));
    };
    try {
        const { boxes, count, origin, extent, overflow } =
            await collectNodeBoxes(pc, { limit: FULL_GRID_MAX_BOXES, onProgress });
        if (overflow) {
            throw new Error(`more than ${FULL_GRID_MAX_BOXES.toLocaleString()} nodes; raise FULL_GRID_MAX_BOXES to draw it`);
        }
        if (!_fullGrids.has(pc)) return;          // the cloud left the scene meanwhile
        const grid = _makeGridLines(boxes, count, origin, extent);
        grid.name = `full_octree_grid ${pc.name}`;
        _fullGrids.set(pc, grid);
        viewer.scene.scene.add(grid);
        _updateFullGrids();                       // place it before its first frame
        console.log(`[octree grid] ${pc.name}: ${count.toLocaleString()} boxes ` +
                    `in ${((performance.now() - t0) / 1000).toFixed(1)} s`);
    } catch (e) {
        if (_fullGrids.has(pc)) _fullGrids.set(pc, false);
        console.warn(`[octree grid] ${pc.name}: not drawn —`, e);
    }
}

/**
 * Every node box of `pointcloud`'s octree, root included, from the file's hierarchy:
 * the in-memory part directly, each unexpanded proxy through its hierarchy chunk
 * (2.0) or page (COPC). Boxes are float32 [minX, minY, minZ, maxX, maxY, maxZ] in
 * pointcloud-local space, relative to the root's min corner (`origin`) so they keep
 * their precision when the cloud sits at UTM-sized coordinates. Past `limit` boxes
 * it stops collecting and reports `overflow`.
 *
 * While chunks are being read, `onProgress({ boxes, chunks, fraction })` is called
 * every 2 s. `fraction` is the share of the hierarchy read so far, or null when its
 * size is unknown (COPC, or a cross-origin server hiding Content-Range).
 */
async function collectNodeBoxes(pointcloud, { limit = Infinity, onProgress } = {}) {
    const geom   = pointcloud.pcoGeometry;
    const root   = geom.root;
    const origin = root.boundingBox.min.clone();
    const sink   = _boxSink(origin, limit);
    const pending = [];
    const proxies = new Map();                              // 2.0 geometry → proxies not parsed yet
    (function walk(node) {
        const b = node.boundingBox;
        if (node.nodeType === 2) {                          // 2.0 proxy: chunk not parsed yet
            const list = proxies.get(node.octreeGeometry);
            if (list) list.push(node); else proxies.set(node.octreeGeometry, [node]);
            return;
        }
        const page = node.owner && !node.nodeinfo && node.owner.pages[window.Copc.Key.toString(node.key)];
        if (page) {                                         // COPC node whose page isn't loaded
            pending.push(_boxesPageCopc(node.owner, page, root.boundingBox, sink));
            return;
        }
        sink.add(b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z);
        // A 2.0 node that keeps a hierarchy size is the root of a chunk Potree already parsed.
        if (node.hierarchyByteSize !== undefined) sink.bytes += Number(node.hierarchyByteSize);
        for (let i = 0; i < 8; i++) if (node.children[i]) walk(node.children[i]);
    })(root);
    for (const [g, list] of proxies) {
        const items = list.map(p => _proxyItem(g, p));
        pending.push(_readerDescend(g, items, (i) => {
            const b = list[i].boundingBox;
            return _boxesChunk20(g, list[i].hierarchyByteOffset, list[i].hierarchyByteSize,
                                 [b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z], sink, items[i][2]);
        }));
    }
    const ticker = onProgress && setInterval(() => {
        const total = _hierarchyBytes.get(geom);
        onProgress({ boxes: sink.count, chunks: sink.chunks, fraction: total ? Math.min(1, sink.bytes / total) : null });
    }, 2000);
    try {
        await Promise.all(pending);
    } finally {
        clearInterval(ticker);
    }
    return {
        boxes: sink.data, count: sink.count, origin, overflow: sink.overflow,
        extent: root.boundingBox.getSize(new THREE.Vector3()),
    };
}

// Growable float32 store of boxes relative to `origin`, plus how much of the
// hierarchy has been read. Past `limit` boxes it stops storing and sets `overflow`.
function _boxSink(origin, limit) {
    let data = new Float32Array(6 * 4096), count = 0;
    return {
        overflow: false,
        chunks: 0,      // chunks / pages read from the file
        bytes: 0,       // 2.0 hierarchy bytes covered: parsed by Potree already, or read here
        add(x0, y0, z0, x1, y1, z1) {
            if (count >= limit) { this.overflow = true; return; }
            if (6 * count === data.length) {
                const grown = new Float32Array(2 * data.length);
                grown.set(data);
                data = grown;
            }
            const i = 6 * count++;
            data[i]     = x0 - origin.x; data[i + 1] = y0 - origin.y; data[i + 2] = z0 - origin.z;
            data[i + 3] = x1 - origin.x; data[i + 4] = y1 - origin.y; data[i + 5] = z1 - origin.z;
        },
        get count() { return count; },
        get data()  { return data.slice(0, 6 * count); },
    };
}

// Boxes of a 2.0 chunk and the chunks below it. `box` is the chunk root's [min, max];
// records are breadth-first, so each node's children are the next unclaimed records,
// split from its box as createChildAABB does.
async function _boxesChunk20(geom, offset, size, box, sink, spanEnd = null) {
    if (sink.overflow) return;
    const view  = await _fetchChunk20(geom, offset, size);
    sink.chunks++;
    sink.bytes += view.byteLength;
    const n     = Math.floor(view.byteLength / 22);
    const boxes = new Float64Array(6 * n);
    boxes.set(box);
    let next = 1;
    const proxies = [];                                     // [offset, size, box]
    for (let i = 0; i < n; i++) {
        const o = 22 * i, b = 6 * i;
        if (i > 0 && view.getUint8(o) === 2) {              // proxy: drawn as record 0 of its own chunk
            proxies.push([view.getBigInt64(o + 6, true), view.getBigInt64(o + 14, true), boxes.slice(b, b + 6)]);
            continue;
        }
        sink.add(boxes[b], boxes[b + 1], boxes[b + 2], boxes[b + 3], boxes[b + 4], boxes[b + 5]);
        const mask = view.getUint8(o + 1);
        for (let c = 0; c < 8; c++) if (mask & (1 << c)) _splitBox(boxes, b, c, 6 * next++);
    }
    const offsets = proxies.map(([o]) => Number(o));
    _hierarchyCheckChunk(geom, offset, size, spanEnd, offsets);
    const ends = _siblingSpanEnds(offsets, spanEnd);
    await _readerDescend(geom, proxies.map(([o, s], i) => [Number(o), Number(o + s), ends[i]]),
        (i) => _boxesChunk20(geom, proxies[i][0], proxies[i][1], proxies[i][2], sink, ends[i]));
}

// createChildAABB on flat boxes: child `c` of the box at `from`, written at `to`.
// Child-index bits pick the upper half along x (4), y (2) and z (1).
function _splitBox(boxes, from, c, to) {
    for (let a = 0; a < 3; a++) {
        const min = boxes[from + a], max = boxes[from + 3 + a], half = (max - min) / 2;
        const upper = c & (4 >> a);
        boxes[to + a]     = upper ? min + half : min;
        boxes[to + 3 + a] = upper ? max : max - half;
    }
}

// Boxes of a COPC page and the pages below it, placed by key inside the root cube.
async function _boxesPageCopc(geom, page, cube, sink) {
    if (sink.overflow) return;
    const { nodes, pages } = await _fetchPageCopc(geom, page);
    sink.chunks++;
    const { min, max } = cube;
    for (const key of Object.keys(nodes)) {
        const [d, x, y, z] = key.split("-").map(Number);
        const sx = (max.x - min.x) / 2 ** d, sy = (max.y - min.y) / 2 ** d, sz = (max.z - min.z) / 2 ** d;
        sink.add(min.x + x * sx,       min.y + y * sy,       min.z + z * sz,
                 min.x + (x + 1) * sx, min.y + (y + 1) * sy, min.z + (z + 1) * sz);
    }
    await Promise.all(Object.values(pages).map(pg => _boxesPageCopc(geom, pg, cube, sink)));
}

// One instanced LineSegments: the 12 edges of a unit cube, stretched per instance to
// a node's [min, max]. Corner order and edges follow Potree's Box3Helper.
function _makeGridLines(boxes, count, origin, extent) {
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute([
        0, 0, 0,  1, 0, 0,  1, 0, 1,  0, 0, 1,
        0, 1, 0,  1, 1, 0,  1, 1, 1,  0, 1, 1,
    ], 3));
    geometry.setIndex([0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 5, 6, 6, 7, 7, 4, 0, 4, 1, 5, 2, 6, 3, 7]);
    const perBox = new THREE.InstancedInterleavedBuffer(boxes, 6, 1);
    geometry.setAttribute("boxMin", new THREE.InterleavedBufferAttribute(perBox, 3, 0));
    geometry.setAttribute("boxMax", new THREE.InterleavedBufferAttribute(perBox, 3, 3));
    geometry.instanceCount = count;
    // Bound the whole grid, not the unit cube, so frustum culling sees what's drawn.
    geometry.boundingBox    = new THREE.Box3(new THREE.Vector3(), extent.clone());
    geometry.boundingSphere = geometry.boundingBox.getBoundingSphere(new THREE.Sphere());

    const material = new THREE.ShaderMaterial({
        uniforms: { color: { value: new THREE.Color(0xffff00) } },   // Box3Helper's default
        vertexShader: `
            attribute vec3 boxMin;
            attribute vec3 boxMax;
            void main() {
                gl_Position = projectionMatrix * modelViewMatrix * vec4(mix(boxMin, boxMax, position), 1.0);
            }`,
        fragmentShader: `
            uniform vec3 color;
            void main() { gl_FragColor = vec4(color, 1.0); }`,
    });

    const grid = new THREE.LineSegments(geometry, material);
    grid.matrixAutoUpdate = false;               // set from the cloud's matrixWorld each frame
    grid.userData.fromOrigin = new THREE.Matrix4().makeTranslation(origin.x, origin.y, origin.z);
    grid.raycast = () => {};                     // an overlay, not something to pick
    return grid;
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

function pickAt(ev){
    if (!ev || !brushState.active || !brushState.sphere) return;

    const rect = viewer.renderer.domElement.getBoundingClientRect();
    const ray  = getPickRay(ev, viewer.scene.getActiveCamera(), rect);
    const pickParams = {
        x: ev.clientX - rect.left,
        y: rect.height - (ev.clientY - rect.top),
        pickWindowSize: 65, pickClipped: true
    };

    return pickAnyPointcloud(ray, pickParams);
}

function paintStroke(result){
    if(!result) return;
    const targets = brushState.targetPointcloud ? [result.pc] :
        viewer.scene.pointclouds.filter(pc => pc.visible);
    
    for (const pc of targets) paintAtPoint(pc, result.hit);
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

        // C also drives opacity in oriented-image mode (oriented_image_panel.js)
        // and the 360 viewers — the RGB/classification blend only cycles with
        // the brush active and neither of those up, so the two never fight.
        if (brushState.active && (e.key === 'c' || e.key === 'C') &&
            !e.ctrlKey && !e.metaKey && !e.altKey &&
            !window.in360View &&
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

    let _lastPrecisePickAt = -Infinity;
    let _hasPickAnchor = false;

    const _pickAnchor = new THREE.Vector3();
    const _previewNormal = new THREE.Vector3();
    const _previewPlane = new THREE.Plane();
    const _previewPoint = new THREE.Vector3();

    function showBrushSphere(position) {
        brushState.sphere.position.copy(position);
        const r = brushState.radius;
        brushState.sphere.scale.set(r, r, r);
        brushState.sphere.visible = true;
    }

    // Estimate the cursor's 3D position without a GPU readback.
    function updateApproximateBrushPosition(ev) {
        if (!_hasPickAnchor) return false;

        const camera = viewer.scene.getActiveCamera();
        const rect = viewer.renderer.domElement.getBoundingClientRect();
        const ray = getPickRay(ev, camera, rect);

        camera.getWorldDirection(_previewNormal);

        _previewPlane.setFromNormalAndCoplanarPoint(
            _previewNormal,
            _pickAnchor
        );

        const point = ray.intersectPlane(
            _previewPlane,
            _previewPoint
        );

        if (!point) return false;

        showBrushSphere(point);
        return true;
    }

    viewer.renderer.domElement.addEventListener('mousemove', (event) => {
        if (!brushState.active || !brushState.sphere) return;

        _pendingMouseEvent = event;
        if (_pickScheduled) return;

        _pickScheduled = true;

        requestAnimationFrame(() => {
            _pickScheduled = false;

            const ev = _pendingMouseEvent;
            if (!ev || !brushState.active || !brushState.sphere) return;

            const now = performance.now();

            const pickInterval = brushState.strokeInProgress
                ? 100   // 10 Hz during asynchronous classification
                : 33;   // ~30 Hz otherwise

            const shouldPick =
                now - _lastPrecisePickAt >= pickInterval;

            if (shouldPick) {
                _lastPrecisePickAt = now;

                const result = pickAt(ev);

                if (result) {
                    _pickAnchor.copy(result.hit.position);
                    _hasPickAnchor = true;

                    showBrushSphere(result.hit.position);

                    // Paint only at accurately picked positions.
                    if (brushState.painting && (ev.buttons & 1)) {
                        paintStroke(result);
                    }

                    if (_shiftHeld) {
                        updateOrientedImageHover(ev.clientX, ev.clientY);
                    }
                } else {
                    _hasPickAnchor = false;
                    brushState.sphere.visible = false;

                    if (_shiftHeld) hideOrientedImageTooltip();
                }
            } else {
                // Cheap approximation between accurate picks.
                // Does NOT initiate classification.
                updateApproximateBrushPosition(ev);
            }
        });
    });


    viewer.renderer.domElement.addEventListener('click', (event) => {
        if (event.shiftKey) {
            focusNearestOrientedImage();
            return;
        }
        if (!brushState.active || !brushState.painting) return;

        const result = pickAt(event);

        paintStroke(result);
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