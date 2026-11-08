/**
 * class_hover_picker.js — Point Inspector
 *
 * Author: (OpenHeritage3D / CHEI, UC San Diego)
 *
 * Description:
 *   A floating window that shows everything about the point under the
 *   cursor: its classification (as a chip from the Classification Legend,
 *   class_legend.js), position, RGB, intensity, returns, and any other
 *   per-point attribute the cloud carries. The window is framed, placed and
 *   made draggable/resizable by panel_window_manager.js, the same way as the
 *   annotation description window.
 *
 *   A reticle marks the point being inspected, since the pick snaps to the
 *   nearest point within a few pixels of the cursor rather than the exact
 *   pixel under it.
 *
 * Usage:
 *   Toolbar ▸ Point Inspector, Tools ▸ Point Inspector, or press I. While a
 *   gamepad is in use it reads the point under its crosshair instead
 *   (gamepad_controls.js calls inspectPointAt()).
 *   While the window is open:
 *     left click       lock the point under the cursor, so the mouse can
 *                      travel to the window (or the camera can orbit)
 *                      without the readout changing; click again to release.
 *                      L does the same from the keyboard.
 *     click Position   copy X, Y, Z
 *     copy button      copy every property as text
 *
 *   Load class_legend.js first for class names and colours; without it the
 *   class shows as its bare code.
 *
 * Notes:
 *   • GPS time is deliberately not shown. Potree's pick() returns it through
 *     a Float32Array, which truncates adjusted-standard GPS times (~3e8 s) to
 *     tens of seconds, and COPC/EPT nodes store it relative to a per-node
 *     offset that pick() doesn't apply. Showing it would mean showing a wrong
 *     number.
 */

(function () {
    "use strict";

    // ══════════════════════════════════════════════════════════════
    //  Config
    // ══════════════════════════════════════════════════════════════
    const PANEL_ID = "pointInspector";

    // Pixel window the pick searches for the nearest point. Small enough to
    // feel precise, large enough not to flicker across gaps in sparse clouds.
    const PICK_WINDOW = 25;

    // Attributes rendered by a dedicated row (or deliberately hidden — see
    // the GPS-time note above). Everything else gets a generic row.
    const HANDLED = new Set([
        "position", "rgba", "classification", "intensity",
        "return number", "number of returns", "indices", "spacing", "gps-time",
    ]);

    const LABELS = {
        "point source id": "Source ID",
        "source id":       "Source ID",
        "user data":       "User Data",
        "scan angle rank": "Scan Angle",
        "scan angle":      "Scan Angle",
        "classification flags": "Class Flags",
    };

    // ══════════════════════════════════════════════════════════════
    //  Styles
    // ══════════════════════════════════════════════════════════════
    const css = document.createElement("style");
    css.textContent = `
#pointInspector {
    position: fixed;
    top: 80px;
    right: 10px;
    width: 300px;
    display: flex;
    flex-direction: column;
    background: rgba(20, 20, 26, 0.62);
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

/* Own header, only seen if the window manager isn't loaded */
.pi-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    border-bottom: 1px solid rgba(255,255,255,0.08);
}
.pi-title { font-size: 14px; font-weight: 600; color: #f2f2f7; }
.pi-close {
    width: 26px; height: 26px;
    border: none; border-radius: 6px;
    background: transparent; color: #9a9aa6;
    cursor: pointer; font-size: 18px; line-height: 1;
}
.pi-close:hover { background: rgba(220, 38, 38, 0.3); color: #f87171; }

.pi-content {
    padding: 12px;
    display: flex;
    flex-direction: column;
}
/* Cursor is off the cloud: the readout belongs to the last point, not the
   one under the cursor. */
#pointInspector.pi-stale .pi-readout { opacity: 0.6; }

/* ── Empty hint ──────────────────────────────────────────── */
.pi-empty {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 0 2px;
    color: #9a9aa6;
    font-size: 12px;
    line-height: 1.45;
}
.pi-empty svg { flex: 0 0 auto; opacity: 0.6; }
.pi-empty b { color: #d6d6de; }
#pointInspector.pi-has-point .pi-empty { display: none; }
#pointInspector:not(.pi-has-point) .pi-readout { display: none; }

.pi-readout { display: flex; flex-direction: column; gap: 10px; transition: opacity 0.15s ease; }

/* ── Classification ──────────────────────────────────────── */
.pi-class { display: flex; flex-direction: column; gap: 6px; }
.pi-class .cl-chip { height: 32px; padding-left: 5px; font-size: 13px; }
.pi-class .cl-chip-code { min-width: 24px; height: 21px; line-height: 21px; font-size: 11px; }

/* ── Section label ───────────────────────────────────────── */
.pi-label {
    font-size: 10.5px;
    font-weight: 600;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: #85858f;
}

/* ── Position ────────────────────────────────────────────── */
.pi-pos {
    display: flex;
    flex-direction: column;
    gap: 5px;
    padding: 8px 10px 9px;
    border-radius: 10px;
    background: rgba(255,255,255,0.035);
    border: 1px solid rgba(255,255,255,0.07);
    cursor: copy;
    transition: background 0.12s, border-color 0.12s;
}
.pi-pos:hover { background: rgba(255,255,255,0.065); border-color: rgba(255,255,255,0.14); }
.pi-pos-head { display: flex; justify-content: space-between; align-items: center; }
.pi-pos-hint { font-size: 10.5px; color: #6f6f7a; transition: color 0.12s; }
.pi-pos:hover .pi-pos-hint { color: #a5a5b0; }
.pi-pos.pi-copied .pi-pos-hint { color: #4ade80; }
/* One axis per line, right-aligned so the decimal points line up — robust
   to projected coordinates (7-digit northings) at any window width. */
.pi-pos-grid { display: flex; flex-direction: column; }
.pi-axis {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
    min-width: 0;
    line-height: 18px;
}
.pi-axis b { font-size: 10.5px; font-weight: 700; }
.pi-axis-x b { color: #f87171; }
.pi-axis-y b { color: #4ade80; }
.pi-axis-z b { color: #60a5fa; }
.pi-axis span {
    font-size: 12.5px;
    color: #f2f2f7;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

/* ── Attribute rows ──────────────────────────────────────── */
.pi-rows { display: flex; flex-direction: column; }
.pi-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 24px;
    border-top: 1px solid rgba(255,255,255,0.055);
}
.pi-row:first-child { border-top: none; }
.pi-row-key { color: #9a9aa6; font-size: 12px; white-space: nowrap; }
.pi-row-val {
    display: flex;
    align-items: center;
    gap: 7px;
    min-width: 0;
    color: #f2f2f7;
    font-size: 12.5px;
    font-variant-numeric: tabular-nums;
    text-align: right;
}
.pi-row-val > span:last-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pi-muted { color: #85858f; }

.pi-rgb-swatch {
    width: 14px; height: 14px;
    border-radius: 50%;
    box-shadow: inset 0 0 0 1px rgba(255,255,255,0.25);
    flex: 0 0 auto;
}
.pi-bar {
    width: 54px; height: 4px;
    border-radius: 2px;
    background: rgba(255,255,255,0.1);
    overflow: hidden;
    flex: 0 0 auto;
}
.pi-bar i {
    display: block; height: 100%;
    width: var(--pi-fill, 0%);
    background: linear-gradient(90deg, #6e6bff, #a5b4fc);
    border-radius: 2px;
}
.pi-pips { display: inline-flex; gap: 3px; flex: 0 0 auto; }
.pi-pips i {
    width: 6px; height: 6px;
    border-radius: 50%;
    background: rgba(255,255,255,0.16);
}
.pi-pips i.on { background: #a5b4fc; box-shadow: 0 0 6px rgba(165,180,252,0.6); }

/* ── Footer ──────────────────────────────────────────────── */
.pi-footer {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 10px 8px 12px;
    border-top: 1px solid rgba(255,255,255,0.08);
    background: rgba(255,255,255,0.025);
}
.pi-status {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 11.5px;
    color: #9a9aa6;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.pi-dot {
    flex: 0 0 auto;
    width: 7px; height: 7px;
    border-radius: 50%;
    background: #6f6f7a;
}
#pointInspector.pi-live .pi-dot { background: #4ade80; animation: pi-pulse 1.8s ease-in-out infinite; }
#pointInspector.pi-locked .pi-dot { background: #fbbf24; animation: none; }
@keyframes pi-pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(74,222,128,0.55); }
    50%      { box-shadow: 0 0 0 4px rgba(74,222,128,0); }
}

.pi-btn {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 26px;
    padding: 0 8px;
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 7px;
    background: rgba(255,255,255,0.05);
    color: #d6d6de;
    font: 600 11.5px 'Segoe UI', system-ui, sans-serif;
    cursor: pointer;
    transition: background 0.12s, border-color 0.12s, color 0.12s;
}
.pi-btn:hover:not(:disabled) { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.22); color: #fff; }
.pi-btn:disabled { opacity: 0.4; cursor: default; }
.pi-btn kbd {
    padding: 0 4px;
    border-radius: 3px;
    background: rgba(0,0,0,0.35);
    border: 1px solid rgba(255,255,255,0.12);
    color: #a5a5b0;
    font: 600 10px ui-monospace, Consolas, monospace;
}
.pi-btn.pi-on {
    background: rgba(251, 191, 36, 0.16);
    border-color: rgba(251, 191, 36, 0.5);
    color: #fde68a;
}
.pi-btn.pi-copied { color: #4ade80; border-color: rgba(74,222,128,0.45); }

/* ── On-canvas reticle ───────────────────────────────────── */
.pi-reticle {
    position: absolute;
    left: 0; top: 0;
    width: 16px; height: 16px;
    margin: -10px 0 0 -10px;
    border: 2px solid rgba(255,255,255,0.95);
    border-radius: 50%;
    box-shadow: 0 0 0 1px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(0,0,0,0.35);
    pointer-events: none;
    z-index: 4;
    display: none;
}
.pi-reticle::after {
    content: "";
    position: absolute;
    left: 50%; top: 50%;
    width: 4px; height: 4px;
    margin: -2px 0 0 -2px;
    border-radius: 50%;
    background: var(--pi-dot, #fff);
    box-shadow: 0 0 0 1px rgba(0,0,0,0.6);
}
.pi-reticle.pi-locked {
    border-color: #fbbf24;
    box-shadow: 0 0 0 1px rgba(0,0,0,0.55), 0 0 10px rgba(251,191,36,0.55);
}
`;
    (document.head || document.documentElement).appendChild(css);

    const ICON_TARGET = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>`;
    const ICON_LOCK   = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>`;
    const ICON_UNLOCK = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/></svg>`;
    const ICON_COPY   = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>`;
    const ICON_CHECK  = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7"/></svg>`;

    // ══════════════════════════════════════════════════════════════
    //  State
    // ══════════════════════════════════════════════════════════════
    const state = {
        panel: null,        // #pointInspector while open
        ui: null,           // cached element refs inside the panel
        reticle: null,
        locked: false,
        current: null,      // { pc, point } — last successful pick
        stale: false,       // last pick missed / cursor left the canvas
        pendingEvent: null,
        pickScheduled: false,
        rowSchema: "",      // attribute set the generic rows were built for
    };

    const _raycaster = new THREE.Raycaster();
    const _ndc = new THREE.Vector2();
    const _proj = new THREE.Vector3();

    // ══════════════════════════════════════════════════════════════
    //  Picking
    // ══════════════════════════════════════════════════════════════

    // Nearest-to-camera hit across every visible cloud, or null.
    function pickAt(clientX, clientY) {
        const canvas = viewer.renderer.domElement;
        const rect = canvas.getBoundingClientRect();
        const camera = viewer.scene.getActiveCamera();

        _ndc.set(
            ((clientX - rect.left) / rect.width) * 2 - 1,
            -((clientY - rect.top) / rect.height) * 2 + 1
        );
        _raycaster.setFromCamera(_ndc, camera);

        const params = {
            x: clientX - rect.left,
            y: rect.height - (clientY - rect.top),
            pickWindowSize: PICK_WINDOW,
            pickClipped: true,
        };

        let best = null;
        for (const pc of viewer.scene.pointclouds) {
            if (!pc.visible) continue;
            const point = pc.pick(viewer, camera, _raycaster.ray, params);
            if (!point || !point.position) continue;
            const d = camera.position.distanceTo(point.position);
            if (!best || d < best.d) best = { pc, point, d };
        }
        return best;
    }

    function onCanvasMove(ev) {
        // Always remember the cursor, so unlocking resumes from where it is.
        state.pendingEvent = ev;
        // Orbit/pan drags: leave the readout on the point under the press
        // instead of re-picking every frame while the camera moves.
        if (state.locked || ev.buttons !== 0) return;
        schedulePick();
    }

    function schedulePick() {
        if (state.pickScheduled || !state.pendingEvent) return;
        state.pickScheduled = true;

        requestAnimationFrame(() => {
            state.pickScheduled = false;
            const e = state.pendingEvent;
            if (!e || !state.panel || state.locked) return;

            const hit = pickAt(e.clientX, e.clientY);
            if (hit) {
                state.current = hit;
                setStale(false);
                render();
            } else {
                setStale(true);
            }
        });
    }

    function onCanvasLeave() {
        if (!state.locked) setStale(true);
    }

    // Inspects a screen spot without the mouse: the gamepad's crosshair
    // (gamepad_controls.js). Returns whether the inspector is open.
    function inspectPointAt(clientX, clientY) {
        if (!state.panel) return false;
        if (!state.locked) {
            state.pendingEvent = { clientX, clientY };
            schedulePick();
        }
        return true;
    }

    // ══════════════════════════════════════════════════════════════
    //  Name / value resolution
    // ══════════════════════════════════════════════════════════════
    // "scan angle rank" → "Scan Angle Rank"
    const titleCase = (s) =>
        String(s).replace(/(^|[\s(\-\/_])([a-z])/g, (_, p, c) => p + c.toUpperCase());

    // Class name and colour come from class_legend.js, which owns them.
    function resolveClass(code) {
        if (window.ClassLegend) return window.ClassLegend.resolveClass(code);
        return { name: "Class " + code, rgb: [128, 128, 128] };
    }

    function labelFor(attr) {
        if (LABELS[attr]) return LABELS[attr];
        const spaced = attr
            .replace(/_+/g, " ")
            .replace(/([a-z])([A-Z])/g, "$1 $2")
            .trim();
        return titleCase(spaced);
    }

    function fmtNum(v) {
        if (!Number.isFinite(v)) return String(v);
        if (Number.isInteger(v)) return v.toLocaleString("en-US");
        const r = Number(v.toFixed(4));
        return (Object.is(r, -0) ? 0 : r).toString();
    }

    function fmtValues(values) {
        const arr = Array.from(values, Number);
        return arr.length === 1 ? fmtNum(arr[0]) : arr.map(fmtNum).join(", ");
    }

    // Attribute value as a single number (scaled float32 storage can leave
    // integer attributes a hair off, e.g. 1.9999999).
    function scalar(point, name) {
        const v = point[name];
        if (v == null || v.length === 0) return null;
        const n = Number(v[0]);
        return Math.abs(n - Math.round(n)) < 1e-3 ? Math.round(n) : n;
    }

    const hex2 = (n) => n.toString(16).padStart(2, "0");
    const fmtCoord = (v) => v.toFixed(3);

    // ══════════════════════════════════════════════════════════════
    //  Panel
    // ══════════════════════════════════════════════════════════════
    function el(tag, cls, html) {
        const e = document.createElement(tag);
        if (cls) e.className = cls;
        if (html != null) e.innerHTML = html;
        return e;
    }

    function buildPanel() {
        const panel = el("div");
        panel.id = PANEL_ID;
        // "open" drives panel_window_manager's fade-in, as with zoneDescWindow
        panel.className = "open";

        const header = el("div", "pi-header");
        header.appendChild(el("span", "pi-title", "Point Inspector"));
        const close = el("button", "pi-close", "&times;");
        close.type = "button";
        close.title = "Close (I)";
        close.addEventListener("click", closePointInspector);
        header.appendChild(close);
        panel.appendChild(header);

        const content = el("div", "pi-content");

        content.appendChild(el("div", "pi-empty",
            `${ICON_TARGET}<span>Hover over the point cloud to inspect a point. <b>Click</b> to lock it.</span>`));

        const readout = el("div", "pi-readout");

        // Classification (filled by renderClass)
        const cls = el("div", "pi-class");
        cls.appendChild(el("span", "pi-label", "Classification"));
        const clsSlot = el("div");
        cls.appendChild(clsSlot);
        readout.appendChild(cls);

        // Position (click to copy)
        const pos = el("div", "pi-pos");
        pos.title = "Copy X, Y, Z";
        const posHead = el("div", "pi-pos-head");
        posHead.appendChild(el("span", "pi-label", "Position"));
        const posHint = el("span", "pi-pos-hint", "Click to copy");
        posHead.appendChild(posHint);
        pos.appendChild(posHead);
        const grid = el("div", "pi-pos-grid");
        const axes = {};
        for (const a of ["x", "y", "z"]) {
            const cell = el("div", "pi-axis pi-axis-" + a);
            cell.appendChild(el("b", null, a.toUpperCase()));
            axes[a] = el("span");
            cell.appendChild(axes[a]);
            grid.appendChild(cell);
        }
        pos.appendChild(grid);
        pos.addEventListener("click", () => {
            const p = state.current && state.current.point.position;
            if (!p) return;
            copyText(`${fmtCoord(p.x)}, ${fmtCoord(p.y)}, ${fmtCoord(p.z)}`, () => {
                pos.classList.add("pi-copied");
                posHint.textContent = "Copied";
                setTimeout(() => {
                    pos.classList.remove("pi-copied");
                    posHint.textContent = "Click to copy";
                }, 1200);
            });
        });
        readout.appendChild(pos);

        const rows = el("div", "pi-rows");
        readout.appendChild(rows);

        content.appendChild(readout);
        panel.appendChild(content);

        // Footer: status · copy all · lock
        const footer = el("div", "pi-footer");
        const status = el("div", "pi-status");
        status.appendChild(el("i", "pi-dot"));
        const statusText = el("span");
        status.appendChild(statusText);
        footer.appendChild(status);

        const copyBtn = el("button", "pi-btn", ICON_COPY);
        copyBtn.type = "button";
        copyBtn.title = "Copy all properties";
        copyBtn.addEventListener("click", () => {
            const text = summaryText();
            if (!text) return;
            copyText(text, () => {
                copyBtn.classList.add("pi-copied");
                copyBtn.innerHTML = ICON_CHECK;
                setTimeout(() => {
                    copyBtn.classList.remove("pi-copied");
                    copyBtn.innerHTML = ICON_COPY;
                }, 1200);
            });
        });
        footer.appendChild(copyBtn);

        const lockBtn = el("button", "pi-btn");
        lockBtn.type = "button";
        lockBtn.addEventListener("click", toggleLock);
        footer.appendChild(lockBtn);

        panel.appendChild(footer);

        state.ui = {
            cls, clsSlot, axes, rows, statusText, copyBtn, lockBtn,
            classCode: undefined,   // code the class chip was built for
            rowEls: {},
            lockShown: null,
        };
        return panel;
    }

    /**
     * Builds the rows below Position for this cloud's attribute set. Only
     * rebuilt when the set changes (e.g. hovering onto another cloud), so the
     * per-frame update just writes text.
     */
    function ensureRows(point) {
        const attrs = Object.keys(point).filter((k) => !HANDLED.has(k));
        const has = (k) => point[k] != null;
        const multiCloud = viewer.scene.pointclouds.length > 1;
        const schema = [
            has("rgba"), has("intensity"), has("return number"), has("number of returns"),
            multiCloud, ...attrs,
        ].join("|");
        if (schema === state.rowSchema) return;
        state.rowSchema = schema;

        const { rows } = state.ui;
        rows.innerHTML = "";
        const rowEls = (state.ui.rowEls = {});

        const addRow = (key, label) => {
            const row = el("div", "pi-row");
            row.appendChild(el("span", "pi-row-key", label));
            const val = el("span", "pi-row-val");
            row.appendChild(val);
            rows.appendChild(row);
            rowEls[key] = val;
            return val;
        };

        if (has("rgba")) {
            const v = addRow("rgba", "Color");
            v.appendChild(el("i", "pi-rgb-swatch"));
            v.appendChild(el("span", "pi-muted"));
            v.appendChild(el("span"));
        }
        if (has("intensity")) {
            const v = addRow("intensity", "Intensity");
            const bar = el("span", "pi-bar");
            bar.appendChild(el("i"));
            v.appendChild(bar);
            v.appendChild(el("span"));
        }
        if (has("return number")) {
            const v = addRow("return", "Return");
            v.appendChild(el("span", "pi-pips"));
            v.appendChild(el("span"));
        }
        for (const a of attrs) {
            addRow("attr:" + a, labelFor(a)).appendChild(el("span"));
        }
        if (multiCloud) {
            addRow("cloud", "Cloud").appendChild(el("span"));
        }
    }

    /** Class chip for the current point; rebuilt only when the code changes
     *  (or the viewer's classes do — see refreshClass). */
    function renderClass(code) {
        const ui = state.ui;
        if (ui.classCode === code) return;
        ui.classCode = code;
        ui.cls.style.display = code == null ? "none" : "";
        ui.clsSlot.textContent = "";
        if (code == null) return;

        let chip;
        if (window.ClassLegend) {
            chip = window.ClassLegend.createChip(code);
        } else {
            chip = el("div", "cl-chip");
            chip.textContent = "Class " + code;
        }
        chip.classList.add("cl-sel");
        ui.clsSlot.appendChild(chip);
    }

    // Class names, colours or visibility changed: rebuild the chip
    function refreshClass() {
        if (!state.ui || !state.current) return;
        state.ui.classCode = undefined;
        render();
    }

    // Rewrites a lone text node's data in place: a characterData change,
    // which panel_window_manager's observer doesn't listen for, so per-frame
    // readout updates don't make it re-run its neutralise/header pass.
    function setText(node, text) {
        if (!node) return;
        const t = node.firstChild;
        if (t && t.nodeType === Node.TEXT_NODE && !t.nextSibling) {
            if (t.data !== text) t.data = text;
        } else if (node.textContent !== text) {
            node.textContent = text;
        }
    }

    function render() {
        const ui = state.ui;
        const cur = state.current;
        if (!ui || !cur) return;
        const { pc, point } = cur;

        state.panel.classList.toggle("pi-has-point", true);
        ensureRows(point);

        // Classification
        const code = scalar(point, "classification");
        renderClass(code);
        if (state.reticle) {
            if (code != null) state.reticle.style.setProperty("--pi-dot", `rgb(${resolveClass(code).rgb.join(",")})`);
            else state.reticle.style.removeProperty("--pi-dot");
        }

        // Position
        const p = point.position;
        setText(ui.axes.x, fmtCoord(p.x));
        setText(ui.axes.y, fmtCoord(p.y));
        setText(ui.axes.z, fmtCoord(p.z));

        const R = ui.rowEls;

        if (R.rgba) {
            const [r, g, b] = Array.from(point.rgba, (v) => Math.round(Number(v)));
            R.rgba.children[0].style.background = `rgb(${r},${g},${b})`;
            setText(R.rgba.children[1], `${r} ${g} ${b}`);
            setText(R.rgba.children[2], ("#" + hex2(r) + hex2(g) + hex2(b)).toUpperCase());
        }

        if (R.intensity) {
            const v = scalar(point, "intensity");
            const range = pc.material && pc.material.intensityRange;
            let pct = 0;
            if (range && range[1] > range[0]) {
                pct = Math.max(0, Math.min(1, (v - range[0]) / (range[1] - range[0]))) * 100;
            }
            R.intensity.children[0].firstChild.style.setProperty("--pi-fill", pct.toFixed(1) + "%");
            setText(R.intensity.children[1], fmtNum(v));
        }

        if (R.return) {
            const n = scalar(point, "return number");
            const of = scalar(point, "number of returns");
            const pips = R.return.children[0];
            const pipCount = (of && of <= 7) ? of : 0;
            if (pips.childElementCount !== pipCount) {
                pips.innerHTML = "<i></i>".repeat(pipCount);
            }
            for (let i = 0; i < pipCount; i++) pips.children[i].classList.toggle("on", i + 1 === n);
            setText(R.return.children[1], of ? `${n} of ${of}` : String(n));
        }

        for (const key in R) {
            if (!key.startsWith("attr:")) continue;
            setText(R[key].lastChild, fmtValues(point[key.slice(5)]));
        }

        if (R.cloud) {
            setText(R.cloud.lastChild, pc.name || "—");
            R.cloud.lastChild.title = pc.name || "";
        }

        updateStatus();
    }

    function updateStatus() {
        const ui = state.ui;
        if (!ui) return;
        const panel = state.panel;
        const hasPoint = !!state.current;

        panel.classList.toggle("pi-locked", state.locked);
        panel.classList.toggle("pi-live", !state.locked && hasPoint && !state.stale);
        panel.classList.toggle("pi-stale", !state.locked && hasPoint && state.stale);

        let text;
        if (state.locked) text = "Locked · click to release";
        else if (!hasPoint) text = "Hover the cloud · click to lock";
        else if (state.stale) text = "No point under cursor";
        else text = "Live · click to lock";
        setText(ui.statusText, text);

        if (ui.lockBtn.disabled !== !hasPoint) ui.lockBtn.disabled = !hasPoint;
        if (ui.copyBtn.disabled !== !hasPoint) ui.copyBtn.disabled = !hasPoint;
        if (ui.lockShown !== state.locked) {
            ui.lockShown = state.locked;
            ui.lockBtn.classList.toggle("pi-on", state.locked);
            ui.lockBtn.innerHTML = (state.locked ? ICON_LOCK + "Locked" : ICON_UNLOCK + "Lock") + "<kbd>L</kbd>";
            ui.lockBtn.title = state.locked
                ? "Release and follow the cursor (click the cloud, or L)"
                : "Lock this point (click the cloud, or L)";
        }

        if (state.reticle) state.reticle.classList.toggle("pi-locked", state.locked);
    }

    function setStale(stale) {
        if (state.stale === stale) return;
        state.stale = stale;
        updateStatus();
    }

    function toggleLock() {
        if (!state.panel || !state.current) return;
        state.locked = !state.locked;
        updateStatus();
        if (!state.locked) schedulePick();   // resume from wherever the cursor is now
    }

    // ══════════════════════════════════════════════════════════════
    //  Click to lock / release
    // ══════════════════════════════════════════════════════════════
    // A plain left click on the cloud toggles the lock. Clicks that belong to
    // something else are left alone: drags (orbit/pan), modifier clicks (Ctrl
    // paints with the brush, Shift focuses oriented images), Potree tool
    // insertions (measure, volume, zone positions — they attach a marker to
    // the cursor or disable the input handler), and clicks on interactive
    // scene objects such as 360 or oriented-image markers. That is decided at
    // pointerdown, which fires before Potree's own mousedown handling.
    let downAt = null;   // where a left press that may become a lock click began

    function sceneWantsClick() {
        const ih = viewer.inputHandler;
        if (!ih) return false;
        return ih.enabled === false ||
               !!(ih.drag && ih.drag.object) ||
               (Array.isArray(ih.hoveredElements) && ih.hoveredElements.length > 0);
    }

    function onCanvasPointerDown(e) {
        const plain = e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey;
        downAt = (plain && !sceneWantsClick()) ? { x: e.clientX, y: e.clientY } : null;
    }

    function onCanvasClick(e) {
        const d = downAt;
        downAt = null;
        // detail > 1 is the second click of a double-click (Potree zooms on those)
        if (!d || e.button !== 0 || e.detail > 1) return;
        if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) return;   // a drag

        if (state.locked) {
            state.locked = false;
            state.pendingEvent = e;
            updateStatus();
            schedulePick();      // resume from the click position
            return;
        }

        // Lock exactly what's under the click, not the last throttled hover pick
        const hit = pickAt(e.clientX, e.clientY);
        if (!hit) return;
        state.current = hit;
        state.stale = false;
        state.locked = true;
        render();
    }

    // ══════════════════════════════════════════════════════════════
    //  Reticle — tracks the inspected point on screen every frame
    // ══════════════════════════════════════════════════════════════
    function updateReticle() {
        const r = state.reticle;
        if (!r) return;
        const cur = state.current;
        const show = cur && (state.locked || !state.stale);
        if (!show) { r.style.display = "none"; return; }

        const camera = viewer.scene.getActiveCamera();
        _proj.copy(cur.point.position).project(camera);
        if (_proj.z < -1 || _proj.z > 1 || Math.abs(_proj.x) > 1 || Math.abs(_proj.y) > 1) {
            r.style.display = "none";
            return;
        }
        const canvas = viewer.renderer.domElement;
        const x = (_proj.x + 1) / 2 * canvas.clientWidth + canvas.offsetLeft;
        const y = (1 - _proj.y) / 2 * canvas.clientHeight + canvas.offsetTop;
        r.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
        r.style.display = "block";
    }

    // ══════════════════════════════════════════════════════════════
    //  Clipboard
    // ══════════════════════════════════════════════════════════════
    function summaryText() {
        const cur = state.current;
        if (!cur) return "";
        const { pc, point } = cur;
        const lines = [];
        const code = scalar(point, "classification");
        if (code != null) lines.push(`Classification: ${resolveClass(code).name} (${code})`);
        const p = point.position;
        lines.push(`X: ${fmtCoord(p.x)}`, `Y: ${fmtCoord(p.y)}`, `Z: ${fmtCoord(p.z)}`);
        if (point.rgba) {
            const [r, g, b] = Array.from(point.rgba, (v) => Math.round(Number(v)));
            lines.push(`Color: ${r}, ${g}, ${b}`);
        }
        if (point.intensity) lines.push(`Intensity: ${scalar(point, "intensity")}`);
        if (point["return number"]) {
            const of = scalar(point, "number of returns");
            lines.push(`Return: ${scalar(point, "return number")}${of ? " of " + of : ""}`);
        }
        for (const a of Object.keys(point)) {
            if (!HANDLED.has(a)) lines.push(`${labelFor(a)}: ${fmtValues(point[a])}`);
        }
        if (viewer.scene.pointclouds.length > 1) lines.push(`Cloud: ${pc.name}`);
        return lines.join("\n");
    }

    function copyText(text, onDone) {
        const fallback = () => {
            const ta = document.createElement("textarea");
            ta.value = text;
            ta.style.cssText = "position:fixed;opacity:0;pointer-events:none";
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand("copy"); onDone(); } catch (_) {}
            ta.remove();
        };
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).then(onDone, fallback);
        } else {
            fallback();
        }
    }

    // ══════════════════════════════════════════════════════════════
    //  Open / close
    // ══════════════════════════════════════════════════════════════
    function openPointInspector() {
        if (state.panel) return;

        // A previous instance may still be fading out
        const lingering = document.getElementById(PANEL_ID);
        if (lingering) lingering.remove();

        state.locked = false;
        state.current = null;
        state.stale = false;
        state.rowSchema = "";

        state.panel = buildPanel();
        document.body.appendChild(state.panel);
        updateStatus();

        const canvas = viewer.renderer.domElement;
        state.reticle = el("div", "pi-reticle");
        (canvas.parentElement || document.body).appendChild(state.reticle);

        canvas.addEventListener("mousemove", onCanvasMove);
        canvas.addEventListener("mouseleave", onCanvasLeave);
        canvas.addEventListener("pointerdown", onCanvasPointerDown);
        canvas.addEventListener("click", onCanvasClick);
        viewer.addEventListener("render.pass.end", updateReticle);
        viewer.addEventListener("classifications_changed", refreshClass);
        viewer.addEventListener("classification_visibility_changed", refreshClass);
        announce(true);
    }

    function closePointInspector() {
        const panel = state.panel;
        if (!panel) return;

        const canvas = viewer.renderer.domElement;
        canvas.removeEventListener("mousemove", onCanvasMove);
        canvas.removeEventListener("mouseleave", onCanvasLeave);
        canvas.removeEventListener("pointerdown", onCanvasPointerDown);
        canvas.removeEventListener("click", onCanvasClick);
        viewer.removeEventListener("render.pass.end", updateReticle);
        viewer.removeEventListener("classifications_changed", refreshClass);
        viewer.removeEventListener("classification_visibility_changed", refreshClass);

        if (state.reticle) state.reticle.remove();
        state.reticle = null;
        state.panel = null;
        state.ui = null;
        state.current = null;
        state.pendingEvent = null;
        downAt = null;

        // Let the window manager's frame fade out with the panel
        panel.classList.remove("open");
        setTimeout(() => panel.remove(), 200);
        announce(false);
    }

    // Lets toolbar buttons etc. reflect the open state
    function announce(open) {
        document.dispatchEvent(new CustomEvent("point-inspector-changed", { detail: { open } }));
    }

    function togglePointInspector() {
        if (state.panel) closePointInspector();
        else openPointInspector();
    }

    // ══════════════════════════════════════════════════════════════
    //  Hotkeys:  I = open/close,  L = lock (while open)
    // ══════════════════════════════════════════════════════════════
    document.addEventListener("keydown", (e) => {
        if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
        const t = e.target;
        if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" ||
                  t.tagName === "SELECT" || t.isContentEditable)) return;

        const k = e.key.toLowerCase();
        if (k === "i") togglePointInspector();
        else if (k === "l" && state.panel) toggleLock();
    });

    window.togglePointInspector = togglePointInspector;
    window.openPointInspector = openPointInspector;
    window.closePointInspector = closePointInspector;
    window.inspectPointAt = inspectPointAt;
})();
