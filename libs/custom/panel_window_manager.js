/**
 * panel_window_manager.js
 *
 * Author: (OpenHeritage3D / CHEI, UC San Diego)
 *
 * Description:
 *   A lightweight, self-contained "window manager" for the Potree viewer's
 *   side panels. It turns the existing static, right-anchored panels into
 *   proper floating windows that are:
 *
 *     • DRAGGABLE  — grab the titlebar to move.
 *     • RESIZABLE  — 8 edge/corner handles.
 *     • AUTO-PLACED — new windows stack down the right edge and wrap into a
 *                     new column to the LEFT when they run out of vertical
 *                     room, so opening a panel never buries another one.
 *     • CONSISTENT — every managed panel gets the same glassmorphic frame
 *                    and titlebar chrome, matching the zone-description
 *                    window aesthetic already in the codebase.
 *
 *   It works by watching document.body for newly-created panels (each panel
 *   is created on demand by its own open/toggle function) and wrapping them
 *   the instant they appear. No changes are required to the panel modules
 *   themselves — every id, class, event handler and close path keeps working
 *   because the original panel element is preserved untouched inside the
 *   frame.
 *
 * Usage:
 *   Include this file with a <script> tag AFTER the other panel scripts
 *   (order isn't critical — it only needs to be loaded before the user opens
 *   a panel):
 *
 *       <script src="panel_window_manager.js"></script>
 *
 *   Nothing else to call. To manage additional panels later, push to
 *   window.PanelWM.registry (see REGISTRY below for the shape).
 *
 * Notes:
 *   • The oriented-image HUD (#oiPanel), the misc-tools dropdown, and the
 *     full-screen modals (class editor, license gate, share links) are left
 *     untouched by design.
 *   • Position/size are intentionally NOT persisted — every panel opens at a
 *     fresh default slot.
 */

(function () {
    "use strict";

    // ══════════════════════════════════════════════════════════════
    //  Which panels to manage.  Keyed by element id.
    //    title     – fallback label for the titlebar
    //    titleSel  – selector (within the panel) whose text mirrors into the
    //                titlebar; this element is hidden in-body to avoid a
    //                duplicate header.  Use :scope > h3 for direct-child <h3>.
    //    closeSel  – the panel's own close control(s); hidden in-body, the
    //                titlebar's × triggers the first match so all existing
    //                teardown logic still runs.
    //    w         – default frame width (px)
    //    minW/minH – minimum resize dimensions (px)
    // ══════════════════════════════════════════════════════════════
    const REGISTRY = {
        brushPanel:       { title: "Classification Brush",       titleSel: ".brush-title",     closeSel: ".brush-close",     w: 360, minW: 300, minH: 180 },
        gridPanel:        { title: "Work Distribution",          titleSel: ".brush-title",     closeSel: ".brush-close",     w: 300, minW: 260, minH: 160 },
        downloadPanel:    { title: "Download Points",            titleSel: ".download-title",  closeSel: ".download-close",  w: 380, minW: 300, minH: 160 },
        transformPanel:   { title: "Transform Point Cloud",      titleSel: ".transform-title", closeSel: ".transform-close", w: 340, minW: 300, minH: 200 },
        exportPanel:      { title: "Export Transform Code",      titleSel: ".transform-title", closeSel: ".transform-close", w: 360, minW: 300, minH: 180 },
        zoneCreationMenu: { title: "Zone Creation & Management", titleSel: ":scope > h3",      closeSel: ".zone-form-close", w: 400, minW: 320, minH: 200, fixup: fixupZonePanel },
        zoneSearchMenu:   { title: "Zones",                      titleSel: ":scope > h3",      closeSel: ".zone-form-close", w: 400, minW: 320, minH: 200, fixup: fixupZonePanel },
        searchCameraMenu: { title: "Camera Search",              titleSel: ":scope > h3",      closeSel: ".zone-form-close", w: 400, minW: 320, minH: 200 },
        zoneDescWindow:   { title: "Description",                titleSel: ".zs-desc-titlebar h4", closeSel: ".zs-desc-close", w: 380, minW: 280, minH: 140, fixup: fixupDescWindow },
        pointInspector:   { title: "Point Inspector",            titleSel: ".pi-title",        closeSel: ".pi-close",        w: 300, minW: 260, minH: 150, fixup: fixupPointInspector },
        classLegend:      { title: "Classification",             titleSel: ".cl-title",        closeSel: ".cl-close",        w: 400, minW: 200, minH: 100, fixup: fixupClassLegend },
        sceneConfigPanel: { title: "Scene Setup",                titleSel: ".sc-title",        closeSel: ".sc-close",        w: 380, minW: 320, minH: 200, fixup: fixupSceneSetup },
    };

    // ══════════════════════════════════════════════════════════════
    //  Per-panel fixups — called once after wrap(), before placement
    // ══════════════════════════════════════════════════════════════

    /**
     * Zone panels (zoneSearchMenu, zoneCreationMenu) have two action buttons
     * that were designed to sit inside their old absolute-positioned header:
     *   • #autoSwitchButtonSearch / #autoSwitchButtonCreation  (.close-btn)
     *   • #editModeButtonSearch                                (.zs-edit-toggle)
     *
     * After wrapping, those buttons end up as the first two children of the
     * panel body, sitting below the hidden <h3> gap.  The .zs-edit-toggle is
     * also `position: absolute` which can make it pop out of the flow.
     *
     * We hoist them into a .pwm-subheader strip that lives between the
     * titlebar and the .pwm-body, so they appear as compact pills in a
     * dedicated row — clean, no overlap, and they stay fully functional.
     */
    function fixupZonePanel(panel, frame) {
        // Selectors for the buttons we want to hoist.
        // IDs differ per panel (Creation vs Search), so we check both.
        const autoSwitchSel = "#autoSwitchButtonCreation, #autoSwitchButtonSearch";
        const editToggleSel = "#editModeButtonSearch, .zs-edit-toggle";

        function buildSubHeader() {
            // Only build once per frame
            if (frame.querySelector(".pwm-subheader")) return;

            const autoBtn = panel.querySelector(autoSwitchSel);
            const editBtn = panel.querySelector(editToggleSel);

            // Nothing to hoist yet (e.g. during a zone-form innerHTML swap)
            if (!autoBtn && !editBtn) return;

            const sub = document.createElement("div");
            sub.className = "pwm-subheader";

            if (autoBtn) {
                autoBtn.style.removeProperty("position");
                autoBtn.style.removeProperty("top");
                autoBtn.style.removeProperty("right");
                autoBtn.style.setProperty("display", "", "");
                sub.appendChild(autoBtn); // moves the node out of panel
            }
            if (editBtn) {
                editBtn.style.removeProperty("position");
                editBtn.style.removeProperty("top");
                editBtn.style.removeProperty("right");
                editBtn.style.setProperty("display", "", "");
                sub.appendChild(editBtn);
            }

            // Insert the sub-header between titlebar and body
            const body = frame.querySelector(".pwm-body");
            if (body) frame.insertBefore(sub, body);
        }

        // Run immediately (buttons may already be in the panel)
        buildSubHeader();

        // Also re-run on every mutation (innerHTML swaps rebuild children)
        const obs = new MutationObserver(() => {
            // Remove old sub-header so we can rebuild cleanly after a swap
            const old = frame.querySelector(".pwm-subheader");
            if (old && !old.querySelector(autoSwitchSel.split(",")[0].trim()) &&
                       !old.querySelector(editToggleSel.split(",")[0].trim())) {
                old.remove();
            }
            buildSubHeader();
        });
        obs.observe(panel, { childList: true, subtree: false });

        // Clean up observer when the frame is removed
        const sentinel = new MutationObserver(() => {
            if (!document.body.contains(frame)) { obs.disconnect(); sentinel.disconnect(); }
        });
        sentinel.observe(document.body, { childList: true, subtree: true });
    }

    /**
     * The zone/annotation description window carries its own titlebar with
     * drag logic. The frame's titlebar replaces it entirely, so hide the
     * whole in-body bar (syncHeader only hides the h4 and × inside it, which
     * would leave an empty grabbable strip behind).
     */
    function fixupDescWindow(panel) {
        const bar = panel.querySelector(".zs-desc-titlebar");
        if (bar) bar.style.setProperty("display", "none", "important");
    }

    /** Same as the description window: the frame's titlebar replaces the
     *  Point Inspector's own header row. */
    function fixupPointInspector(panel) {
        const bar = panel.querySelector(".pi-header");
        if (bar) bar.style.setProperty("display", "none", "important");
    }

    /** Classification Legend (class_legend.js): same kind of header row. */
    function fixupClassLegend(panel) {
        const bar = panel.querySelector(".cl-header");
        if (bar) bar.style.setProperty("display", "none", "important");
    }

    /** Scene Setup (scene_config_panel.js) has the same kind of header row. */
    function fixupSceneSetup(panel) {
        const bar = panel.querySelector(".sc-header");
        if (bar) bar.style.setProperty("display", "none", "important");
    }

    // Placement geometry
    const TOP    = 76;   // clearance below the top toolbar
    const RIGHT  = 12;   // gap from the right edge
    const BOTTOM = 16;   // gap from the bottom edge
    const LEFT   = 8;    // minimum left edge before we give up and cascade
    const GAP    = 12;   // gap between windows

    // z-index band for managed windows (kept below full-screen modals @99999+)
    const Z_MIN = 10000;
    const Z_MAX = 10800;
    let   zTop  = Z_MIN;

    // ══════════════════════════════════════════════════════════════
    //  Styles (own <style> element — independent of the shared one)
    // ══════════════════════════════════════════════════════════════
    const css = document.createElement("style");
    css.textContent = `
.pwm-frame {
    position: fixed;
    top: 0; left: 0;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;

    background: rgba(20, 20, 26, 0.62);
    backdrop-filter: blur(14px) saturate(140%);
    -webkit-backdrop-filter: blur(14px) saturate(140%);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 14px;
    box-shadow: 0 10px 44px rgba(0,0,0,0.6);
    overflow: hidden;

    max-height: calc(100vh - ${TOP + BOTTOM}px);

    opacity: 0;
    transform: scale(0.985);
    transition: opacity 0.18s ease, transform 0.18s ease;
    font-family: 'Segoe UI', system-ui, sans-serif;
}
.pwm-frame.pwm-open { opacity: 1; transform: scale(1); }

/* Titlebar / drag handle */
.pwm-titlebar {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 9px 10px 9px 12px;
    background: rgba(255,255,255,0.045);
    border-bottom: 1px solid rgba(255,255,255,0.08);
    cursor: grab;
    user-select: none;
    touch-action: none;
}
.pwm-titlebar:active { cursor: grabbing; }

.pwm-grip {
    flex: 0 0 auto;
    width: 12px; height: 14px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 1fr 1fr 1fr;
    gap: 2px;
    opacity: 0.45;
}
.pwm-grip i { background: #cfcfe0; border-radius: 50%; }

.pwm-title {
    flex: 1 1 auto;
    min-width: 0;
    font-size: 14px;
    font-weight: 600;
    color: #f2f2f7;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-shadow: 0 0 6px rgba(0,0,0,0.5);
}

.pwm-close {
    flex: 0 0 auto;
    width: 26px; height: 26px;
    display: inline-flex; align-items: center; justify-content: center;
    border: none; border-radius: 6px;
    background: transparent; color: #9a9aa6;
    cursor: pointer; font-size: 18px; line-height: 1;
    transition: background 0.12s, color 0.12s;
}
.pwm-close:hover { background: rgba(220, 38, 38, 0.3); color: #f87171; }

/* The original panel, now living inside the frame body */
.pwm-body {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

/* Resize handles */
.pwm-rz { position: absolute; z-index: 5; touch-action: none; }
.pwm-rz-n  { top: -3px;  left: 8px; right: 8px; height: 8px;  cursor: ns-resize; }
.pwm-rz-s  { bottom: -3px;left: 8px; right: 8px; height: 8px;  cursor: ns-resize; }
.pwm-rz-e  { right: -3px; top: 8px;  bottom: 8px;width: 8px;   cursor: ew-resize; }
.pwm-rz-w  { left: -3px;  top: 8px;  bottom: 8px;width: 8px;   cursor: ew-resize; }
.pwm-rz-ne { top: -4px;  right: -4px; width: 14px; height: 14px; cursor: nesw-resize; }
.pwm-rz-nw { top: -4px;  left: -4px;  width: 14px; height: 14px; cursor: nwse-resize; }
.pwm-rz-se { bottom: -4px;right: -4px; width: 14px; height: 14px; cursor: nwse-resize; }
.pwm-rz-sw { bottom: -4px;left: -4px;  width: 14px; height: 14px; cursor: nesw-resize; }

/* Keep full-screen modals above managed windows */
.brush-editor-overlay,
.license-overlay { z-index: 100000 !important; }

/* Sub-header strip — for panels that have action pills (auto-switch, edit mode) */
.pwm-subheader {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    padding: 6px 12px 8px;
    border-bottom: 1px solid rgba(255,255,255,0.07);
    background: rgba(255,255,255,0.02);
}

/* Normalise any button we hoist into the sub-header */
.pwm-subheader > button {
    flex: 0 0 auto !important;
    margin: 0 !important;
    padding: 4px 12px !important;
    font-size: 12px !important;
    font-weight: 600 !important;
    border-radius: 6px !important;
    cursor: pointer !important;
    border: 1px solid rgba(255,255,255,0.12) !important;
    transition: filter 0.15s ease !important;
    position: static !important;
    top: auto !important; right: auto !important;
}
.pwm-subheader > button:hover { filter: brightness(1.18); }
`;
    (document.head || document.documentElement).appendChild(css);

    // Inline !important properties that neutralise a panel's own positioning
    // and chrome so the frame can take over.  Inline-important beats author
    // stylesheet rules regardless of specificity, so this is bulletproof
    // against the assorted `!important` rules scattered across the panels.
    const NEUTRALIZE = {
        position: "relative",   // relative (not static) so the panel's own
        left: "auto",           // absolutely-positioned header buttons stay
        right: "auto",          // anchored to the panel body, not the frame
        top: "auto",
        bottom: "auto",
        margin: "0",
        width: "100%",
        "max-width": "none",
        "box-sizing": "border-box", // prevents padding from overflowing frame width
        height: "auto",
        "min-height": "0",
        "max-height": "none",
        flex: "1 1 auto",
        background: "transparent",
        border: "none",
        "border-radius": "0",
        "box-shadow": "none",
        "backdrop-filter": "none",
        "-webkit-backdrop-filter": "none",
        opacity: "1",
        transform: "none",
        transition: "none",
        overflow: "auto",
        "z-index": "auto",
        "pointer-events": "auto",
    };

    // ══════════════════════════════════════════════════════════════
    //  Placement — stack down the right edge, wrap to a new column left
    // ══════════════════════════════════════════════════════════════
    function computeSlot(w, h) {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const rects = [...document.querySelectorAll(".pwm-frame.pwm-placed")]
            // Skip frames whose panel was just removed but whose teardown
            // observer hasn't fired yet (e.g. replacing one description
            // window with another in the same tick). Counting such ghost
            // frames as obstacles would place the new window in a different
            // slot than a close-then-open would.
            .filter((f) => {
                const body = f.querySelector(".pwm-body");
                return body && body.firstElementChild;
            })
            .map((f) => f.getBoundingClientRect());

        const colStep = w + GAP;
        let x = vw - RIGHT - w;
        let y = TOP;
        let guard = 0;

        while (guard++ < 400) {
            // Ran past the bottom of this column → start a new column to the left
            if (y + h > vh - BOTTOM) {
                x -= colStep;
                y = TOP;
                if (x < LEFT) {
                    // Out of columns → gentle cascade fallback
                    const n = rects.length;
                    return {
                        x: Math.max(LEFT, vw - RIGHT - w - (n * 28)),
                        y: TOP + (n * 28),
                    };
                }
                continue;
            }

            const cand = { left: x, top: y, right: x + w, bottom: y + h };
            const blocker = rects.find(
                (r) =>
                    !(cand.right <= r.left ||
                      cand.left >= r.right ||
                      cand.bottom <= r.top ||
                      cand.top >= r.bottom)
            );

            if (blocker) {
                y = blocker.bottom + GAP; // drop below the thing in the way
                continue;
            }
            break;
        }
        return { x: Math.max(LEFT, x), y: Math.max(0, y) };
    }

    // ══════════════════════════════════════════════════════════════
    //  Interaction: drag + resize + focus
    // ══════════════════════════════════════════════════════════════
    function bringToFront(frame) {
        if (zTop >= Z_MAX) {
            // renormalise so we never run away
            const frames = [...document.querySelectorAll(".pwm-frame")]
                .sort((a, b) => (+a.style.zIndex || 0) - (+b.style.zIndex || 0));
            zTop = Z_MIN;
            frames.forEach((f) => (f.style.zIndex = ++zTop));
        }
        frame.style.zIndex = ++zTop;
    }

    function clampIntoView(frame) {
        const r = frame.getBoundingClientRect();
        let left = r.left, top = r.top;
        const maxLeft = window.innerWidth - Math.min(r.width, 120);
        const maxTop = window.innerHeight - 34; // keep titlebar reachable
        left = Math.min(Math.max(left, -(r.width - 120)), maxLeft);
        top = Math.min(Math.max(top, 0), maxTop);
        frame.style.left = left + "px";
        frame.style.top = top + "px";
    }

    function makeDraggable(frame, handle) {
        let sx = 0, sy = 0, sl = 0, st = 0, active = false;

        handle.addEventListener("pointerdown", (e) => {
            if (e.button !== 0) return;
            if (e.target.closest(".pwm-close")) return; // let close through
            active = true;
            const r = frame.getBoundingClientRect();
            sl = r.left; st = r.top;
            sx = e.clientX; sy = e.clientY;
            frame.style.left = sl + "px";
            frame.style.top = st + "px";
            handle.setPointerCapture(e.pointerId);
            bringToFront(frame);
            e.preventDefault();
        });

        handle.addEventListener("pointermove", (e) => {
            if (!active) return;
            let nl = sl + (e.clientX - sx);
            let nt = st + (e.clientY - sy);
            const w = frame.offsetWidth;
            nl = Math.min(Math.max(nl, -(w - 120)), window.innerWidth - 120);
            nt = Math.min(Math.max(nt, 0), window.innerHeight - 34);
            frame.style.left = nl + "px";
            frame.style.top = nt + "px";
        });

        const end = (e) => {
            if (!active) return;
            active = false;
            try { handle.releasePointerCapture(e.pointerId); } catch (_) {}
        };
        handle.addEventListener("pointerup", end);
        handle.addEventListener("pointercancel", end);
    }

    function addResizeHandles(frame, opts) {
        const dirs = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];
        dirs.forEach((dir) => {
            const h = document.createElement("div");
            h.className = "pwm-rz pwm-rz-" + dir;
            frame.appendChild(h);

            let sx = 0, sy = 0, sw = 0, sh = 0, sl = 0, st = 0, active = false;

            h.addEventListener("pointerdown", (e) => {
                if (e.button !== 0) return;
                active = true;
                const r = frame.getBoundingClientRect();
                sx = e.clientX; sy = e.clientY;
                sw = r.width; sh = r.height; sl = r.left; st = r.top;
                // switch to explicit sizing
                frame.style.width = sw + "px";
                frame.style.height = sh + "px";
                frame.style.maxHeight = "none";
                frame.style.left = sl + "px";
                frame.style.top = st + "px";
                h.setPointerCapture(e.pointerId);
                bringToFront(frame);
                e.preventDefault();
                e.stopPropagation();
            });

            h.addEventListener("pointermove", (e) => {
                if (!active) return;
                const dx = e.clientX - sx;
                const dy = e.clientY - sy;
                const minW = opts.minW || 240;
                const minH = opts.minH || 140;

                let w = sw, hh = sh, l = sl, t = st;

                if (dir.includes("e")) w = Math.max(minW, sw + dx);
                if (dir.includes("s")) hh = Math.max(minH, sh + dy);
                if (dir.includes("w")) {
                    w = Math.max(minW, sw - dx);
                    l = sl + (sw - w);
                }
                if (dir.includes("n")) {
                    hh = Math.max(minH, sh - dy);
                    t = st + (sh - hh);
                }
                // keep within viewport bounds
                w = Math.min(w, window.innerWidth - 8);
                hh = Math.min(hh, window.innerHeight - 8);

                frame.style.width = w + "px";
                frame.style.height = hh + "px";
                frame.style.left = l + "px";
                frame.style.top = t + "px";
            });

            const end = (e) => {
                if (!active) return;
                active = false;
                try { h.releasePointerCapture(e.pointerId); } catch (_) {}
            };
            h.addEventListener("pointerup", end);
            h.addEventListener("pointercancel", end);
        });
    }

    // ══════════════════════════════════════════════════════════════
    //  Wrapping
    // ══════════════════════════════════════════════════════════════
    function neutralize(panel) {
        for (const k in NEUTRALIZE) {
            panel.style.setProperty(k, NEUTRALIZE[k], "important");
        }
    }

    function syncHeader(panel, opts, titleEl) {
        // Mirror the in-body title into the titlebar, then hide the in-body
        // title + close to give a single, clean window header.
        let label = opts.title;
        try {
            const t = panel.querySelector(opts.titleSel);
            if (t) {
                if (t.textContent && t.textContent.trim()) label = t.textContent.trim();
                t.style.setProperty("display", "none", "important");
            }
        } catch (_) {}
        titleEl.textContent = label;

        try {
            panel.querySelectorAll(opts.closeSel).forEach((c) =>
                c.style.setProperty("display", "none", "important")
            );
        } catch (_) {}
    }

    function wrap(panel, opts) {
        if (panel.dataset.pwm) return;
        panel.dataset.pwm = "1";

        // Build the frame in the panel's current place
        const frame = document.createElement("div");
        frame.className = "pwm-frame";
        frame.style.width = (opts.w || 360) + "px";

        const titlebar = document.createElement("div");
        titlebar.className = "pwm-titlebar";

        const grip = document.createElement("span");
        grip.className = "pwm-grip";
        grip.innerHTML = "<i></i><i></i><i></i><i></i><i></i><i></i>";
        titlebar.appendChild(grip);

        const titleEl = document.createElement("span");
        titleEl.className = "pwm-title";
        titleEl.textContent = opts.title || "";
        titlebar.appendChild(titleEl);

        const closeEl = document.createElement("button");
        closeEl.className = "pwm-close";
        closeEl.type = "button";
        closeEl.title = "Close";
        closeEl.innerHTML = "&times;";
        titlebar.appendChild(closeEl);

        const body = document.createElement("div");
        body.className = "pwm-body";

        // Insert frame where the panel was, then move the panel inside it.
        const parent = panel.parentNode || document.body;
        parent.insertBefore(frame, panel);
        frame.appendChild(titlebar);
        frame.appendChild(body);
        body.appendChild(panel);

        neutralize(panel);
        addResizeHandles(frame, opts);
        makeDraggable(frame, titlebar);
        syncHeader(panel, opts, titleEl);

        // Per-panel fixups (e.g. hoisting absolute-positioned header buttons)
        if (typeof opts.fixup === "function") opts.fixup(panel, frame);

        // Titlebar close → run the panel's own close path so all teardown fires
        closeEl.addEventListener("click", () => {
            let clicked = false;
            try {
                const c = panel.querySelector(opts.closeSel);
                if (c) { c.click(); clicked = true; }
            } catch (_) {}
            if (!clicked) cleanup(); // fallback
        });

        frame.addEventListener("pointerdown", () => bringToFront(frame), true);

        // ── Measure + place ──
        frame.style.visibility = "hidden";
        const maxH = window.innerHeight - TOP - BOTTOM;
        const h = Math.min(frame.offsetHeight || 240, maxH);
        const slot = computeSlot(opts.w || 360, h);
        frame.style.left = slot.x + "px";
        frame.style.top = slot.y + "px";
        frame.style.zIndex = ++zTop;
        frame.style.visibility = "";
        frame.classList.add("pwm-placed");

        // ── Fade in (mirror the panel's own .open state) ──
        const openNow = panel.classList.contains("open");
        requestAnimationFrame(() => {
            if (openNow || !hasOpenSemantics(panel)) frame.classList.add("pwm-open");
        });

        // ── Observers ──
        // (a) mirror open-class + keep the header in sync as content swaps
        const panelObs = new MutationObserver(() => {
            frame.classList.toggle("pwm-open", panel.classList.contains("open"));
            // Re-apply neutralisation for props the panel may have re-set,
            // and re-sync the header after any innerHTML swap.
            neutralize(panel);
            syncHeader(panel, opts, titleEl);
        });
        panelObs.observe(panel, {
            attributes: true,
            attributeFilter: ["class", "style"],
            childList: true,
            subtree: true,
        });

        // (b) when the panel is removed (any close path), tear down the frame
        const frameObs = new MutationObserver(() => {
            if (!frame.contains(panel)) cleanup();
        });
        frameObs.observe(body, { childList: true });

        function cleanup() {
            panelObs.disconnect();
            frameObs.disconnect();
            if (frame.parentNode) frame.parentNode.removeChild(frame);
        }
    }

    // Some panels toggle `.open`; if a panel never uses it we still show it.
    function hasOpenSemantics(panel) {
        // All managed panels here use `.open`; kept as a small safety net.
        return true;
    }

    // ══════════════════════════════════════════════════════════════
    //  Detection — watch body for newly created panels
    // ══════════════════════════════════════════════════════════════
    function maybeWrap(node) {
        if (!(node instanceof HTMLElement)) return;
        const opts = REGISTRY[node.id];
        if (opts && !node.dataset.pwm) wrap(node, opts);
    }

    const bodyObs = new MutationObserver((muts) => {
        for (const m of muts) {
            m.addedNodes.forEach(maybeWrap);
        }
    });

    function start() {
        bodyObs.observe(document.body, { childList: true });
        // Wrap any that somehow already exist
        Object.keys(REGISTRY).forEach((id) => {
            const el = document.getElementById(id);
            if (el) maybeWrap(el);
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start);
    } else {
        start();
    }

    // Keep windows on-screen when the viewport shrinks
    let rzTimer = null;
    window.addEventListener("resize", () => {
        clearTimeout(rzTimer);
        rzTimer = setTimeout(() => {
            document.querySelectorAll(".pwm-frame.pwm-placed").forEach(clampIntoView);
        }, 120);
    });

    // Public hook (optional): window.PanelWM.registry.myPanel = {...}
    window.PanelWM = { registry: REGISTRY, wrap, computeSlot };
})();