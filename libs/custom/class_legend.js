/**
 * class_legend.js — Classification Legend
 *
 * Author: (OpenHeritage3D / CHEI, UC San Diego)
 *
 * Description:
 *   A floating legend of every classification class the viewer knows: code,
 *   name, colour, and whether the class is hidden. It opens by itself while
 *   at least one visible point cloud is drawing classification colours —
 *   the "Classification" material, or a composite with a non-zero
 *   classification weight ("RGBA Classes", "Intensity Classes", the brush's
 *   RGB/class blend) — and closes again when none is. It also stays out of
 *   the way while the Classification Brush panel is open, since that panel
 *   has its own class grid. Framed by panel_window_manager.js like the
 *   other panels.
 *
 *   Also owns class name/colour resolution and the chip styling, which the
 *   Point Inspector (class_hover_picker.js) reuses through window.ClassLegend.
 *
 * Usage:
 *   Nothing to call. The switch on each class shows or hides that class
 *   (viewer.setClassificationVisibility, so the brush and Potree's sidebar
 *   stay in step). Closing the window keeps it closed until classification
 *   colours are switched off and back on.
 *
 * Detection:
 *   Event-driven, no polling. A cloud's material dispatches
 *   material_property_changed both when its active attribute changes and
 *   when a composite weight changes; the cloud dispatches visibility_changed;
 *   the scene dispatches pointcloud_added for clouds loaded later. The brush
 *   panel is noticed by watching document.body's direct children: opening it
 *   adds #brushPanel (then its window frame) there, and closing it removes
 *   the frame. Bursts (the toolbar's material menu sets every cloud in a
 *   loop) are coalesced into one check per tick.
 */

(function () {
    "use strict";

    const PANEL_ID = "classLegend";

    // Standard ASPRS LAS 1.4 classes (8 and 12 use their LAS 1.2 meanings,
    // which is what the viewer's own palette uses). Last-resort fallback for
    // codes the viewer and brush don't name.
    const ASPRS_CLASSES = {
        0: "Never Classified",  1: "Unclassified",       2: "Ground",
        3: "Low Vegetation",    4: "Medium Vegetation",  5: "High Vegetation",
        6: "Building",          7: "Low Point (Noise)",  8: "Key-Point",
        9: "Water",            10: "Rail",              11: "Road Surface",
        12: "Overlap",         13: "Wire – Guard",      14: "Wire – Conductor",
        15: "Transmission Tower", 16: "Wire Connector", 17: "Bridge Deck",
        18: "High Point (Noise)", 19: "Overhead Structure", 20: "Ignored Ground",
        21: "Snow",            22: "Temporal Exclusion",
    };

    // ══════════════════════════════════════════════════════════════
    //  Styles (chips are shared with the Point Inspector)
    // ══════════════════════════════════════════════════════════════
    const css = document.createElement("style");
    css.textContent = `
#classLegend {
    position: fixed;
    top: 80px;
    right: 10px;
    width: 400px;
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
.cl-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    border-bottom: 1px solid rgba(255,255,255,0.08);
}
.cl-title { font-size: 14px; font-weight: 600; color: #f2f2f7; }
.cl-close {
    width: 26px; height: 26px;
    border: none; border-radius: 6px;
    background: transparent; color: #9a9aa6;
    cursor: pointer; font-size: 18px; line-height: 1;
}
.cl-close:hover { background: rgba(220, 38, 38, 0.3); color: #f87171; }

.cl-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 4px;
    padding: 12px;
}

/* ── Class chip ──────────────────────────────────────────── */
.cl-chip {
    --c: 128 128 128;
    display: flex;
    align-items: center;
    gap: 7px;
    min-width: 0;
    height: 28px;
    padding: 0 7px 0 4px;
    border: 1px solid rgba(255,255,255,0.05);
    border-radius: 7px;
    background: rgba(255,255,255,0.035);
    color: #e4e4ea;
    font-size: 12px;
    box-sizing: border-box;
    transition: background 0.15s ease, box-shadow 0.15s ease;
}
.cl-chip-code {
    flex: 0 0 auto;
    min-width: 22px;
    height: 19px;
    padding: 0 4px;
    box-sizing: border-box;
    border-radius: 5px;
    background: rgb(var(--c));
    box-shadow: inset 0 0 0 1px rgba(255,255,255,0.2);
    color: #fff;
    font: 700 10.5px/19px ui-monospace, 'SFMono-Regular', Consolas, monospace;
    text-align: center;
    text-shadow: 0 0 2px rgba(0,0,0,0.45);
}
.cl-chip-code.cl-dark { color: #15151a; text-shadow: none; }
.cl-chip-name { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* Hidden classes: hollow swatch, struck-through name */
.cl-chip.cl-hidden .cl-chip-code {
    background: transparent;
    box-shadow: inset 0 0 0 1.5px rgb(var(--c));
    color: rgb(var(--c));
    text-shadow: none;
}
.cl-chip.cl-hidden .cl-chip-name { text-decoration: line-through; color: #9a9aa4; }
/* Codes found in the data but not defined in the viewer */
.cl-chip.cl-extra { border-style: dashed; border-color: rgba(255,255,255,0.18); }

/* Legend only: per-class visibility switch, tinted with the class colour.
   Chips are a touch tighter here to leave the names their room. */
#classLegend .cl-chip { gap: 6px; padding-right: 6px; }
.cl-vis {
    position: relative;
    flex: 0 0 auto;
    width: 20px;
    height: 12px;
    margin-left: auto;
    padding: 0;
    border: none;
    border-radius: 6px;
    background: rgba(255,255,255,0.16);
    cursor: pointer;
    transition: background 0.15s ease, box-shadow 0.15s ease;
}
.cl-vis::after {
    content: "";
    position: absolute;
    top: 2px; left: 2px;
    width: 8px; height: 8px;
    border-radius: 50%;
    background: #b9b9c4;
    transition: transform 0.15s ease, background 0.15s ease;
}
.cl-vis[aria-checked="true"] {
    background: rgb(var(--c) / 0.55);
    box-shadow: inset 0 0 0 1px rgb(var(--c));
}
.cl-vis[aria-checked="true"]::after { transform: translateX(8px); background: #fff; }
.cl-vis:hover { filter: brightness(1.25); }
.cl-vis:focus-visible { outline: 2px solid #a5b4fc; outline-offset: 2px; }

/* Emphasised chip (the Point Inspector's current class): tinted fill, a ring
   in the class colour, a thin white outline so grey and dark classes still
   read on the dark glass, and a glow. Box-shadows only, so no size change. */
.cl-chip.cl-sel {
    color: #fff;
    background: linear-gradient(100deg, rgb(var(--c) / 0.42), rgb(var(--c) / 0.18));
    border-color: transparent;
    box-shadow:
        inset 0 0 0 1.5px rgb(var(--c)),
        0 0 0 1px rgba(255,255,255,0.6),
        0 0 16px rgb(var(--c) / 0.5);
    text-shadow: 0 1px 2px rgba(0,0,0,0.5);
}
`;
    (document.head || document.documentElement).appendChild(css);

    // ══════════════════════════════════════════════════════════════
    //  Class name / colour resolution
    // ══════════════════════════════════════════════════════════════
    const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");

    // "low point(noise)" → "Low Point(Noise)"
    const titleCase = (s) =>
        String(s).replace(/(^|[\s(\-\/_])([a-z])/g, (_, p, c) => p + c.toUpperCase());

    /**
     * viewer.classifications is what the renderer colours by (the brush
     * syncs its editable list into it, lower-cased). Prefer the brush's
     * original casing when it names the same class, then the viewer's name,
     * then the ASPRS table.
     *
     * Returns { name, rgb: [r, g, b] 0–255, hidden, defined }.
     */
    function resolveClass(code) {
        const vc = viewer.classifications ? viewer.classifications[code] : null;
        const brushList = (typeof CLASSIFICATIONS !== "undefined" && Array.isArray(CLASSIFICATIONS))
            ? CLASSIFICATIONS : null;
        const bc = brushList ? brushList.find((c) => c.value === code) : null;

        let name;
        if (vc && vc.name) {
            name = (bc && norm(bc.name) === norm(vc.name)) ? bc.name : titleCase(vc.name);
        } else if (bc) {
            name = bc.name;
        } else {
            name = ASPRS_CLASSES[code] || (code >= 64 ? "User Defined" : "Reserved");
        }

        const def = viewer.classifications && viewer.classifications.DEFAULT;
        const rgbaF = (vc && vc.color) || (def && def.color) || [0.5, 0.5, 0.5, 1];
        const rgb = rgbaF.slice(0, 3).map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255));

        return { name, rgb, hidden: !!vc && vc.visible === false, defined: !!vc };
    }

    // Perceived brightness, to pick a readable code colour on the swatch
    const isLight = ([r, g, b]) => (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;

    /** A legend chip for one class code: coloured code swatch + name. */
    function createChip(code) {
        const chip = document.createElement("div");
        chip.className = "cl-chip";
        chip.dataset.code = String(code);

        const sw = document.createElement("span");
        sw.className = "cl-chip-code";
        sw.textContent = String(code);
        chip.appendChild(sw);

        const name = document.createElement("span");
        name.className = "cl-chip-name";
        chip.appendChild(name);

        updateChip(chip);
        return chip;
    }

    /** Brings a chip (and its visibility switch, if any) up to date with the
     *  viewer's current name, colour and visibility for its class. */
    function updateChip(chip) {
        const code = Number(chip.dataset.code);
        const c = resolveClass(code);

        chip.classList.toggle("cl-hidden", c.hidden);
        chip.classList.toggle("cl-extra", !c.defined);
        chip.style.setProperty("--c", c.rgb.join(" "));
        chip.title = `${c.name} (${code})` + (c.hidden ? " — hidden" : "") +
                     (!c.defined ? " — not in the viewer's class list" : "");
        chip.querySelector(".cl-chip-code").classList.toggle("cl-dark", isLight(c.rgb) && !c.hidden);
        chip.querySelector(".cl-chip-name").textContent = c.name;

        const vis = chip.querySelector(".cl-vis");
        if (vis) {
            vis.setAttribute("aria-checked", String(!c.hidden));
            vis.title = (c.hidden ? "Show " : "Hide ") + c.name;
        }
    }

    // ══════════════════════════════════════════════════════════════
    //  Legend window
    // ══════════════════════════════════════════════════════════════
    let panel = null;   // #classLegend while open
    let grid = null;

    function fillLegend() {
        if (!grid) return;
        const codes = Object.keys(viewer.classifications || {})
            .filter((k) => k !== "DEFAULT")
            .map(Number)
            .filter(Number.isFinite)
            .sort((a, b) => a - b);
        grid.textContent = "";
        for (const code of codes) {
            const chip = createChip(code);
            chip.appendChild(createVisSwitch(code));
            updateChip(chip);
            grid.appendChild(chip);
        }
    }

    function createVisSwitch(code) {
        const vis = document.createElement("button");
        vis.type = "button";
        vis.className = "cl-vis";
        vis.setAttribute("role", "switch");
        vis.addEventListener("click", () => {
            const vc = viewer.classifications[code];
            viewer.setClassificationVisibility(code, !!vc && vc.visible === false);
        });
        return vis;
    }

    // Visibility only: update the chips in place (keeps the switch animation
    // and keyboard focus) instead of rebuilding the grid.
    function syncVisibility() {
        if (!grid) return;
        for (const chip of grid.children) updateChip(chip);
    }

    function openLegend() {
        if (panel) return;
        // A previous instance may still be fading out
        const lingering = document.getElementById(PANEL_ID);
        if (lingering) lingering.remove();

        panel = document.createElement("div");
        panel.id = PANEL_ID;
        // "open" drives panel_window_manager's fade-in, as with zoneDescWindow
        panel.className = "open";

        const header = document.createElement("div");
        header.className = "cl-header";
        const title = document.createElement("span");
        title.className = "cl-title";
        title.textContent = "Classification";
        header.appendChild(title);
        const close = document.createElement("button");
        close.className = "cl-close";
        close.type = "button";
        close.title = "Close";
        close.innerHTML = "&times;";
        close.addEventListener("click", () => {
            dismissed = true;   // stay closed until classes are switched off and on
            closeLegend();
        });
        header.appendChild(close);
        panel.appendChild(header);

        grid = document.createElement("div");
        grid.className = "cl-grid";
        panel.appendChild(grid);
        fillLegend();   // before insertion, so the window manager sizes the frame with it

        document.body.appendChild(panel);
    }

    function closeLegend() {
        if (!panel) return;
        const p = panel;
        panel = null;
        grid = null;
        // Let the window manager's frame fade out with the panel
        p.classList.remove("open");
        setTimeout(() => p.remove(), 200);
    }

    // ══════════════════════════════════════════════════════════════
    //  Auto show / hide
    // ══════════════════════════════════════════════════════════════
    let classesShown = false;   // some visible cloud is drawing class colours
    let dismissed = false;      // user closed the legend while classes were shown
    let checkQueued = false;

    // Composite weights are plain numbers from Potree/the brush, but index.html
    // sets them as one-element arrays ([0.75]); accept both.
    const weight = (w) => Number(Array.isArray(w) ? w[0] : w) || 0;

    function drawsClasses(pc) {
        const m = pc.material;
        if (!pc.visible || !m) return false;
        if (m.activeAttributeName === "classification") return true;
        return m.activeAttributeName === "composite" && weight(m.weightClassification) > 0;
    }

    // The brush panel shows its own class grid; don't stack a second legend.
    const brushPanelOpen = () => !!document.getElementById("brushPanel");

    function check() {
        checkQueued = false;
        const on = viewer.scene.pointclouds.some(drawsClasses);
        if (on !== classesShown) {
            classesShown = on;
            if (!on) dismissed = false;   // show again next time classes come on
        }
        // open/close are no-ops when already in that state
        if (classesShown && !dismissed && !brushPanelOpen()) openLegend();
        else closeLegend();
    }

    function scheduleCheck() {
        if (checkQueued) return;
        checkQueued = true;
        Promise.resolve().then(check);
    }

    const bound = new WeakSet();
    function bind(pc) {
        if (!pc || bound.has(pc)) return;
        bound.add(pc);
        pc.addEventListener("visibility_changed", scheduleCheck);
        if (pc.material) pc.material.addEventListener("material_property_changed", scheduleCheck);
    }

    function init() {
        viewer.scene.pointclouds.forEach(bind);
        new MutationObserver(scheduleCheck).observe(document.body, { childList: true });
        viewer.scene.addEventListener("pointcloud_added", (e) => {
            bind(e.pointcloud);
            scheduleCheck();
        });
        viewer.addEventListener("classifications_changed", fillLegend);
        viewer.addEventListener("classification_visibility_changed", syncVisibility);
        scheduleCheck();
    }

    // index.html creates the viewer before this script runs; the Florence and
    // ALERTCalifornia atlases create it in a module script, which runs after
    // every classic script but before DOMContentLoaded.
    if (window.viewer && window.viewer.scene) init();
    else document.addEventListener("DOMContentLoaded", init);

    window.ClassLegend = {
        resolveClass,
        createChip,
        open: openLegend,
        close: closeLegend,
        isClassificationShown: () => classesShown,
    };
})();
