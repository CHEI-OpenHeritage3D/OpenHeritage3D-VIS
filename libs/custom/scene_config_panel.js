/**
 * scene_config_panel.js — Scene Setup
 *
 * Author: (OpenHeritage3D / CHEI, UC San Diego)
 *
 * Description:
 *   A floating window for editing window.sceneConfig (scene_config.js): the
 *   dataset (vtype, DOI), viewer settings, starting camera, start zones,
 *   classification edits, point clouds and custom script that a schema-2 zones.json describes. Most values are read
 *   from the live viewer rather than typed: set the scene up in the viewer,
 *   then "Use current" / "Capture" here. Framed, placed and made draggable by
 *   panel_window_manager.js like the other tool windows.
 *
 * Usage:
 *   Tools ▸ Scene Setup. On a scene loaded from config.js the window offers
 *   "Capture current scene", which builds a sceneConfig from what is loaded.
 *   From then on "Export zones.json" (here or in Zone Management) writes a
 *   schema-2 file. Export is a download: putting the file in the dataset's
 *   potree/ folder is a manual step.
 *
 * Notes:
 *   • Removing a cloud also takes it out of every zone that lists it, and
 *     unloads it from the viewer.
 *   • A cloud's id is fixed once added; it is pointcloud.name at runtime,
 *     which zones and brush edits use to find the cloud.
 */

(function () {
    "use strict";

    const PANEL_ID = "sceneConfigPanel";
    // Beside this script, wherever the page is (Imagery ▸ Web Map Tile Service ▸ Preset)
    const WMTS_PRESETS_URL = document.currentScript?.src
        ? new URL("wmts_presets.json", document.currentScript.src).href
        : new URL("libs/custom/wmts_presets.json", location.href).href;

    // How a cloud added here looks until its material is captured — the same
    // defaults default_config.js gives auto-detected clouds.
    const NEW_CLOUD_MATERIAL = { attribute: "rgba", shape: "circle", sizeType: "adaptive", minSize: 2 };

    const BACKGROUNDS = [["gradient", "Gradient"], ["black", "Black"], ["white", "White"], ["skybox", "Skybox"]];
    const CLIP_TASKS = [[0, "None"], [1, "Highlight"], [2, "Show inside"], [3, "Show outside"]];
    const GRADIENT_REPEATS = [["clamp", "Clamp"], ["repeat", "Repeat"], ["mirrored_repeat", "Mirrored repeat"]];

    // Projections Scene Setup offers without typing proj4; anything else is a custom string.
    const CALIFORNIA_ALBERS = "+proj=aea +lat_0=0 +lon_0=-120 +lat_1=34 +lat_2=40.5 +x_0=0 +y_0=-4000000 +datum=NAD83 +units=m +no_defs +type=crs";
    const utmProjection = (zone, south) =>
        `+proj=utm +zone=${zone}${south ? " +south" : ""} +ellps=WGS84 +datum=WGS84 +units=m +no_defs`;

    // Which of those a stored projection is: { kind: "utm", zone, south }, { kind: "albers" },
    // { kind: "custom" }, or { kind: null } when there is none.
    function projectionKindOf(projection) {
        const p = (projection || "").trim().replace(/\s+/g, " ");
        const utm = p.match(/^\+proj=utm \+zone=(\d{1,2})( \+south)? \+ellps=WGS84 \+datum=WGS84 \+units=m \+no_defs$/);
        if (utm) return { kind: "utm", zone: Number(utm[1]), south: !!utm[2] };
        if (p === CALIFORNIA_ALBERS) return { kind: "albers" };
        return { kind: p ? "custom" : null };
    }

    // UI state that outlives a re-render
    let heightMatch = null;     // last "Match basemap" result or error, shown under Height offset
    // The Projection select's state that the stored string can't tell: "custom" picked for a preset,
    // or "utm" picked before a zone is typed; a custom string kept while another kind is picked.
    let projectionUI = { sc: null, kind: null, custom: "", error: null };
    const openSections = new Set(["dataset", "viewer", "camera", "startZones", "edits", "pointclouds"]);
    const addForm = { url: "", id: "", idEdited: false, busy: false, error: "" };

    // ══════════════════════════════════════════════════════════════
    //  Styles
    // ══════════════════════════════════════════════════════════════
    const css = document.createElement("style");
    css.textContent = `
#sceneConfigPanel {
    position: fixed;
    top: 80px;
    right: 10px;
    width: 380px;
    max-height: 80vh;
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
    opacity: 0;
    transition: opacity 0.18s ease;
}
#sceneConfigPanel.open { opacity: 1; }

/* Own header, only seen if the window manager isn't loaded */
.sc-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    border-bottom: 1px solid rgba(255,255,255,0.08);
}
.sc-title { font-size: 14px; font-weight: 600; color: #f2f2f7; }
.sc-close {
    width: 26px; height: 26px;
    border: none; border-radius: 6px;
    background: transparent; color: #9a9aa6;
    cursor: pointer; font-size: 18px; line-height: 1;
}
.sc-close:hover { background: rgba(220, 38, 38, 0.3); color: #f87171; }

.sc-content {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
}
.sc-content::-webkit-scrollbar { width: 5px; }
.sc-content::-webkit-scrollbar-thumb { background: #444; border-radius: 3px; }

/* ── Sections ─────────────────────────────────────────────── */
.sc-sec {
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 10px;
    background: rgba(255,255,255,0.03);
}
.sc-sec > summary {
    list-style: none;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    cursor: pointer;
    user-select: none;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #c9c9d6;
}
.sc-sec > summary::-webkit-details-marker { display: none; }
.sc-sec > summary::before {
    content: "";
    width: 5px; height: 5px;
    border-right: 1.5px solid currentColor;
    border-bottom: 1.5px solid currentColor;
    transform: rotate(-45deg);
    transition: transform 0.15s ease;
    opacity: 0.7;
}
.sc-sec[open] > summary::before { transform: rotate(45deg); }
.sc-count {
    margin-left: auto;
    font-weight: 500;
    letter-spacing: 0;
    text-transform: none;
    color: #8b8b98;
}
.sc-body {
    padding: 2px 10px 10px;
    display: flex;
    flex-direction: column;
    gap: 7px;
}

/* ── Fields ───────────────────────────────────────────────── */
.sc-row {
    display: grid;
    grid-template-columns: 84px minmax(0, 1fr);
    align-items: center;
    gap: 8px;
}
.sc-key { color: #a0a0ad; font-size: 12px; }
.sc-input, .sc-select {
    width: 100%;
    box-sizing: border-box;
    padding: 5px 8px;
    background: rgba(0,0,0,0.3);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 6px;
    color: #f0f0f5;
    font: inherit;
    outline: none;
}
.sc-input:focus, .sc-select:focus { border-color: #6366f1; }
.sc-input::placeholder { color: #6b6b78; }
.sc-input:disabled { opacity: 0.5; }
.sc-select option { background: #1b1c20; color: #fff; }
.sc-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; }
.sc-vec { overflow-wrap: anywhere; }

.sc-actions { display: flex; flex-wrap: wrap; gap: 6px; }
.sc-btn {
    padding: 4px 10px;
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(255,255,255,0.14);
    border-radius: 6px;
    color: #e6e6ec;
    font: inherit;
    font-size: 12px;
    white-space: nowrap;
    cursor: pointer;
}
.sc-btn:hover { background: rgba(255,255,255,0.15); }
.sc-btn:disabled { opacity: 0.45; cursor: default; background: rgba(255,255,255,0.08); }
.sc-btn.sc-primary { background: #4f46e5; border-color: #6366f1; color: #fff; }
.sc-btn.sc-primary:hover { background: #5b54f0; }
.sc-btn.sc-primary:disabled { background: #4f46e5; }
.sc-icon-btn {
    flex: 0 0 auto;
    width: 24px; height: 24px;
    display: inline-flex; align-items: center; justify-content: center;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: #9a9aa6;
    font-size: 15px;
    line-height: 1;
    cursor: pointer;
}
.sc-icon-btn:hover { background: rgba(255,255,255,0.1); color: #fff; }
.sc-icon-btn:disabled { opacity: 0.35; cursor: default; background: transparent; }
.sc-icon-btn.sc-danger:hover { background: rgba(220,38,38,0.3); color: #f87171; }

.sc-hint { margin: 0; color: #8b8b98; font-size: 11.5px; line-height: 1.4; }
.sc-error { color: #f87171; font-size: 12px; line-height: 1.35; }
.sc-error:empty { display: none; }
.sc-ok { color: #86efac; }
.sc-textarea { resize: vertical; min-height: 52px; line-height: 1.35; }
.sc-code { min-height: 140px; white-space: pre; overflow: auto; tab-size: 4; }
.sc-proj { font-size: 11px; overflow-wrap: anywhere; }

/* ── Start zones ──────────────────────────────────────────── */
.sc-checks { max-height: 180px; overflow-y: auto; display: flex; flex-direction: column; }
.sc-check { display: flex; align-items: center; gap: 8px; padding: 3px 2px; cursor: pointer; }
.sc-check input, .sc-vis { accent-color: #6366f1; margin: 0; cursor: pointer; }
.sc-missing { color: #fbbf24; }
.sc-list-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 6px;
}

/* ── Point clouds ─────────────────────────────────────────── */
.sc-pc {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px;
    background: rgba(0,0,0,0.15);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 8px;
}
.sc-pc-head { display: flex; align-items: center; gap: 6px; }
.sc-pc-id {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 600;
    color: #f2f2f7;
}
.sc-badge {
    flex: 0 0 auto;
    padding: 1px 7px;
    border-radius: 999px;
    background: rgba(251,191,36,0.15);
    color: #fbbf24;
    font-size: 10.5px;
    white-space: nowrap;
}
.sc-cap {
    display: grid;
    grid-template-columns: 84px minmax(0, 1fr) auto;
    align-items: center;
    gap: 8px;
}
.sc-cap-val { color: #c9c9d6; font-size: 12px; overflow-wrap: anywhere; }
.sc-range-row { display: flex; align-items: center; gap: 8px; }
.sc-range { flex: 1 1 auto; min-width: 0; margin: 0; accent-color: #6366f1; cursor: pointer; }
.sc-range-val { flex: 0 0 auto; width: 34px; text-align: right; color: #c9c9d6; }
.sc-flash { animation: scFlash 0.9s ease; }
@keyframes scFlash { from { color: #a5b4fc; } to { color: #c9c9d6; } }
.sc-sub {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding-top: 8px;
    border-top: 1px solid rgba(255,255,255,0.07);
}
.sc-sub-title { font-size: 12px; font-weight: 600; color: #c9c9d6; }
.sc-wmts { padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.07); }
.sc-more > summary { cursor: pointer; list-style: none; color: #a0a0ad; font-size: 12px; user-select: none; }
.sc-more > summary::-webkit-details-marker { display: none; }
.sc-more > summary::before { content: "▸ "; }
.sc-more[open] > summary::before { content: "▾ "; }
.sc-more-body { display: flex; flex-direction: column; gap: 6px; padding-top: 6px; }
.sc-fields { display: flex; gap: 6px; }
.sc-fields > .sc-input { flex: 1 1 0; min-width: 0; }

/* ── Empty state / footer ─────────────────────────────────── */
.sc-empty { display: flex; flex-direction: column; gap: 10px; padding: 4px 2px; line-height: 1.45; }
.sc-empty p { margin: 0; }
.sc-footer {
    flex: 0 0 auto;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px 12px 12px;
    border-top: 1px solid rgba(255,255,255,0.08);
}
.sc-footer:empty { display: none; }
.sc-footer .sc-btn { padding: 7px 10px; font-size: 13px; }
`;
    (document.head || document.documentElement).appendChild(css);

    // ══════════════════════════════════════════════════════════════
    //  Open / close
    // ══════════════════════════════════════════════════════════════
    function toggleSceneSetup() {
        if (document.getElementById(PANEL_ID)) closePanel();
        else openPanel();
    }

    function openPanel() {
        const panel = el("div", { id: PANEL_ID },
            el("div", { class: "sc-header" },
                el("span", { class: "sc-title" }, "Scene Setup"),
                el("button", { class: "sc-close", title: "Close", onclick: closePanel }, "×")),
            el("div", { class: "sc-content" }),
            el("div", { class: "sc-footer" }));

        // Filled before it goes into the page, so the window manager measures it full.
        render(panel);
        document.body.appendChild(panel);
        requestAnimationFrame(() => panel.classList.add("open"));
    }

    function closePanel() {
        const panel = document.getElementById(PANEL_ID);
        if (!panel) return;
        panel.classList.remove("open");
        setTimeout(() => panel.remove(), 200);
    }

    // Zone saves, deletes and imports change the start-zone choices.
    document.addEventListener("zones-changed", () => render());
    document.addEventListener("cesium-basemap-changed", () => render());   // e.g. the imagery didn't load

    // ══════════════════════════════════════════════════════════════
    //  Rendering
    // ══════════════════════════════════════════════════════════════
    function render(panel = document.getElementById(PANEL_ID)) {
        if (!panel) return;
        const content = panel.querySelector(".sc-content");
        const footer = panel.querySelector(".sc-footer");
        const scroll = content.scrollTop;

        const sc = window.sceneConfig;
        if (!sc) {
            content.replaceChildren(emptyState());
            footer.replaceChildren();
        } else {
            content.replaceChildren(...[
                datasetSection(sc),
                viewerSection(sc),
                cameraSection(sc),
                cesiumSection(sc),
                startZonesSection(sc),
                editsSection(sc),
                cloudsSection(sc),
                scriptSection(sc),
            ].filter(Boolean));
            footer.replaceChildren(
                el("button", { class: "sc-btn sc-primary", onclick: () => exportZonesToJSON() }, "Export zones.json"),
                el("p", { class: "sc-hint" },
                    "Downloads zones.json with this scene config and all zones. Upload it to the dataset's potree/ folder to publish it."));
        }
        content.scrollTop = scroll;
    }

    function emptyState() {
        const btn = el("button", { class: "sc-btn sc-primary", onclick: captureScene }, "Capture current scene");

        const error = el("div", { class: "sc-error" });

        async function captureScene() {
            btn.disabled = true;
            btn.textContent = "Capturing…";
            try {
                window.sceneConfig = await SceneConfig.capture(viewer, window.zoneURL || window.location.href);
                render();
            } catch (err) {
                console.error("[Scene Setup] capture failed:", err);
                error.textContent = `Capture failed: ${err.message}`;
                btn.disabled = false;
                btn.textContent = "Capture current scene";
            }
        }

        return el("div", { class: "sc-empty" },
            el("p", {}, "This scene was loaded from config.js."),
            el("p", { class: "sc-hint" },
                "Capturing reads the loaded point clouds (with their transforms and materials), the viewer " +
                "settings, the current view and the visible zones into a scene config. Export then writes it " +
                "into zones.json, and the viewer loads the scene from that file instead of config.js."),
            el("div", { class: "sc-actions" }, btn),
            error);
    }

    // ── Dataset ──────────────────────────────────────────────────
    // Which dataset the scene belongs to; relative URLs load from its potree/ folder.
    function datasetSection(sc) {
        const vtypes = typeof VTYPE_CONFIG === "undefined" ? {} : VTYPE_CONFIG;   // defined by index.html
        const keys = Object.keys(vtypes);
        if (sc.vtype && !keys.includes(sc.vtype)) keys.push(sc.vtype);           // keep an unknown one rather than drop it

        const dir = el("span", { class: "sc-mono sc-vec" }, sc.dataDir);
        const showDir = () => { dir.textContent = sc.dataDir; };

        return section("dataset", "Dataset", sc.doi,
            el("div", { class: "sc-actions" },
                el("button", { class: "sc-btn", onclick: () => { sc.useCurrentDataset(); render(); } }, "Use current")),
            row("vtype", el("select", { class: "sc-select", onchange: e => { sc.vtype = e.target.value || null; showDir(); } },
                el("option", { value: "" }, "none"),
                keys.map(k => el("option", { value: k, selected: k === sc.vtype },
                    vtypes[k]?.websiteName ? `${k} · ${vtypes[k].websiteName}` : k)))),
            row("DOI", el("input", {
                class: "sc-input sc-mono", value: sc.doi ?? "", placeholder: "none",
                oninput: e => { sc.doi = e.target.value.trim() || null; showDir(); },
                onchange: () => render(),
            })),
            row("Loads from", dir),
            sc.doi && !SceneConfig.datasetPrefix(sc.vtype) && el("div", { class: "sc-error" },
                "This page has no dataset list (VTYPE_CONFIG), so relative URLs load from next to zones.json."),
            el("p", { class: "sc-hint" },
                "Relative point cloud and edit URLs load from this dataset's potree/ folder, wherever the file is opened. " +
                "Changes take effect the next time the scene loads."));
    }

    // ── Viewer ───────────────────────────────────────────────────
    function viewerSection(sc) {
        const v = sc.viewerSettings;

        // Blank means "use the default"; anything set is applied straight away.
        const set = (key, value) => {
            if (value === undefined) delete v[key];
            else v[key] = value;
            sc.applyViewerSettings(viewer);
        };
        const number = (key, attrs) => el("input", {
            class: "sc-input", type: "number", placeholder: "default", value: v[key] ?? "", ...attrs,
            onchange: e => set(key, e.target.value === "" ? undefined : Number(e.target.value)),
        });
        const setEDL = (key, value) => {
            if (value === undefined) {
                if (v.edl) delete v.edl[key];
                if (v.edl && !Object.keys(v.edl).length) delete v.edl;
            } else {
                v.edl = { ...v.edl, [key]: value };
            }
            sc.applyViewerSettings(viewer);
        };
        // Until moved, an EDL slider shows what the viewer is using. Dragging previews through that one
        // setter; letting go applies everything, which also syncs Potree's own sidebar.
        const edlSlider = (key, min, max, getter, setter) => {
            const out = el("span", { class: "sc-range-val sc-mono" });
            const input = el("input", {
                type: "range", class: "sc-range", min, max, step: 0.01,
                oninput: e => {
                    const value = Number(e.target.value);
                    v.edl = { ...v.edl, [key]: value };
                    viewer[setter](value);
                    out.textContent = value.toFixed(2);
                },
                onchange: () => sc.applyViewerSettings(viewer),
            });
            input.value = v.edl?.[key] ?? viewer[getter]();
            out.textContent = Number(input.value).toFixed(2);
            return el("div", { class: "sc-range-row" }, input, out);
        };

        return section("viewer", "Viewer", null,
            el("div", { class: "sc-actions" },
                el("button", { class: "sc-btn", onclick: () => { sc.captureViewerSettings(viewer); render(); } }, "Use current")),
            row("Point budget", number("pointBudget", { min: 0, step: 100000 })),
            row("FOV", number("fov", { min: 20, max: 100, step: 1 })),
            row("Background", select(BACKGROUNDS, v.background, e => set("background", e.target.value || undefined))),
            row("EDL", select([["true", "On"], ["false", "Off"]], v.edl?.enabled, e => {
                setEDL("enabled", e.target.value === "" ? undefined : e.target.value === "true");
                render();       // the EDL sliders only show while EDL is on
            })),
            v.edl?.enabled === true && [
                row("EDL radius", edlSlider("radius", 1, 4, "getEDLRadius", "setEDLRadius")),
                row("EDL strength", edlSlider("strength", 0, 5, "getEDLStrength", "setEDLStrength")),
                row("EDL opacity", edlSlider("opacity", 0, 1, "getEDLOpacity", "setEDLOpacity")),
            ],
            row("Splat Quality", select([["false", "Standard (Default)"], ["true", "High Quality"]], String(!!v.hqSplats),
                e => set("hqSplats", e.target.value === "true"), false)),
            row("Clip task", select(CLIP_TASKS, v.clipTask,
                e => set("clipTask", e.target.value === "" ? undefined : Number(e.target.value)))),
            row("Gradient repeat", select(GRADIENT_REPEATS, v.gradientRepeat, e => set("gradientRepeat", e.target.value || undefined))),
            el("p", { class: "sc-hint" }, "Blank fields use the viewer's defaults."));
    }

    // ── Camera ───────────────────────────────────────────────────
    function cameraSection(sc) {
        const cam = sc.camera;
        return section("camera", "Camera", null,
            cam
                ? [row("Position", vec(cam.position)), row("Target", vec(cam.target))]
                : el("p", { class: "sc-hint" }, "Not set: the view fits all clouds when the scene opens."),
            el("div", { class: "sc-actions" },
                el("button", { class: "sc-btn sc-primary", onclick: () => { sc.captureCamera(viewer); render(); } }, "Use current view"),
                el("button", { class: "sc-btn", disabled: !cam, onclick: () => moveCameraTo(cam.position, cam.target) }, "Go to"),
                el("button", { class: "sc-btn", disabled: !cam, onclick: () => { sc.camera = null; render(); } }, "Clear")));
    }

    // ── Cesium basemap ───────────────────────────────────────────
    // sceneConfig.cesium, for zones whose background is "cesium". Pages without cesium_basemap.js skip it.
    let previousBackgrounds = new Map();   // zone → background before "Cesium as default for all zones"
    function cesiumSection(sc) {
        if (!window.CesiumBasemap) return null;
        const c = sc.cesium;
        const value = key => c[key] ?? CesiumBasemap.DEFAULTS[key];

        // Changes rebuild the Cesium viewer if it is showing; the height offset is read every frame instead.
        const set = (key, v, redraw = false) => {
            const before = c[key];
            if (v === undefined || v === "") delete c[key];
            else c[key] = v;
            if (key !== "heightOffset" && c[key] !== before) CesiumBasemap.reconfigure();
            if (redraw) render();
        };
        const choice = (key, options, redraw = false) =>
            select(options, String(value(key)), e => {
                const v = e.target.value;
                set(key, v === "true" ? true : v === "false" ? false : v, redraw);
            }, false);
        const onOff = (key, redraw) => choice(key, [["true", "On"], ["false", "Off"]], redraw);

        // ── Projection: a UTM zone, California Albers, or any proj4 string ──
        if (projectionUI.sc !== sc) projectionUI = { sc, kind: null, custom: "", error: null };
        const parsed = projectionKindOf(c.projection);
        const kind = projectionUI.kind === "custom" ? "custom" : (parsed.kind ?? projectionUI.kind ?? "utm");

        const pickKind = k => {
            if (parsed.kind === "custom") projectionUI.custom = c.projection;
            projectionUI.kind = k;
            projectionUI.error = null;
            if (k === "albers") set("projection", CALIFORNIA_ALBERS, true);
            else if (k === "utm") set("projection", parsed.kind === "utm" ? c.projection : undefined, true);
            // custom starts from what is there, so a preset can be tweaked
            else set("projection", (parsed.kind === null && projectionUI.custom) || c.projection, true);
        };

        const zoneInput = el("input", {
            class: "sc-input", type: "number", min: 1, max: 60, step: 1, placeholder: "1–60",
            value: parsed.kind === "utm" ? parsed.zone : "",
            onchange: () => setUtm(),
        });
        const hemisphere = select([["N", "North"], ["S", "South"]], parsed.south ? "S" : "N", () => setUtm(), false);
        hemisphere.style.cssText = "width: auto; flex: 0 0 auto;";
        const setUtm = () => {
            const zone = Number(zoneInput.value);
            if (zoneInput.value === "") { projectionUI.error = null; set("projection", undefined, true); return; }
            if (!Number.isInteger(zone) || zone < 1 || zone > 60) {
                projectionUI.error = "UTM zones run from 1 to 60.";
                render();
                return;
            }
            projectionUI.error = null;
            set("projection", utmProjection(zone, hemisphere.value === "S"), true);
        };

        const projectionInput = kind === "utm"
            ? row("UTM zone", el("div", { class: "sc-range-row" }, zoneInput, hemisphere))
            : kind === "custom"
                ? row("proj4", el("textarea", {
                    class: "sc-input sc-mono sc-textarea", rows: 3, spellcheck: false, value: c.projection ?? "",
                    placeholder: "+proj=utm +zone=32 +ellps=WGS84 +datum=WGS84 +units=m +no_defs",
                    onchange: e => { projectionUI.custom = e.target.value.trim(); set("projection", e.target.value.trim(), true); },
                }))
                : null;

        const check = CesiumBasemap.describeProjection(c.projection);
        const deg = (v, pos, neg) => `${Math.abs(v).toFixed(4)}° ${v >= 0 ? pos : neg}`;
        const projectionStatus = projectionUI.error
            ? el("div", { class: "sc-error" }, projectionUI.error)
            : !c.projection
            ? el("p", { class: "sc-hint" }, kind === "utm"
                ? "The UTM zone the point clouds' coordinates are in (32 for most of Italy, 10 or 11 for California)."
                : "The point clouds' coordinate system as a proj4 string (epsg.io lists one for every EPSG code).")
            : check.ok
                ? el("p", { class: "sc-hint sc-ok" }, check.lat === undefined ? "Reads fine."
                    : `Scene centre: ${deg(check.lat, "N", "S")}, ${deg(check.lon, "E", "W")}`)
                : el("div", { class: "sc-error" }, check.error);

        const previewing = CesiumBasemap.previewing;
        const previewBtn = el("button", {
            class: "sc-btn" + (previewing ? " sc-primary" : ""), disabled: !check.ok,
            onclick: () => { CesiumBasemap.preview(!previewing); render(); },
        }, previewing ? "Stop preview" : "Preview");

        const allZones = window.zones || [];
        const users = allZones.filter(z => z.background === "cesium").map(z => z.name);

        // Sets every zone's background to Cesium; unticking puts back what each zone had.
        const allCesium = allZones.length > 0 && users.length === allZones.length;
        const defaultAll = el("label", { class: "sc-check", title: "Sets every zone's background to Cesium" },
            el("input", {
                type: "checkbox", checked: allCesium, disabled: !allZones.length,
                onchange: e => {
                    if (e.target.checked) {
                        previousBackgrounds = new Map(allZones.map(z => [z, z.background]));
                        allZones.forEach(z => { z.background = "cesium"; });
                    } else {
                        allZones.forEach(z => { z.background = previousBackgrounds.get(z) ?? undefined; });
                        previousBackgrounds = new Map();
                    }
                    CesiumBasemap.reconfigure();
                    render();
                },
            }),
            "Cesium as default for all zones");

        const sec = section("cesium", "Cesium Basemap", c.projection ? (check.ok ? "set" : "check") : null,
            row("Projection", select([["utm", "UTM zone (WGS84)"], ["albers", "California Albers (NAD83)"], ["custom", "Custom proj4 string"]],
                kind, e => pickKind(e.target.value), false)),
            projectionInput,
            kind !== "custom" && c.projection && el("p", { class: "sc-hint sc-mono sc-proj" }, c.projection),
            projectionStatus,
            row("Height offset", el("div", { class: "sc-range-row" },
                el("input", {
                    class: "sc-input", type: "number", step: 0.1, value: c.heightOffset ?? "", placeholder: "0 m",
                    title: "Metres added to the point clouds' heights to match Cesium's, which are ellipsoidal.",
                    onchange: e => { heightMatch = null; set("heightOffset", e.target.value === "" ? undefined : Number(e.target.value)); },
                }),
                el("button", {
                    class: "sc-btn", disabled: !CesiumBasemap.active,
                    title: "Measure the gap between the basemap's surface and the point clouds in view, and use it",
                    onclick: async e => {
                        e.target.disabled = true;
                        e.target.textContent = "Measuring…";
                        try {
                            const m = await CesiumBasemap.measureHeightOffset();
                            heightMatch = { ok: true, text: `Measured ${m.offset >= 0 ? "+" : ""}${m.offset} m from ${m.samples} points; ${m.agreeing}% of them agree within 4 m.` };
                            set("heightOffset", m.offset);
                        } catch (err) {
                            heightMatch = { ok: false, text: err.message };
                        }
                        render();
                    },
                }, "Match basemap"))),
            heightMatch
                ? el(heightMatch.ok ? "p" : "div", { class: heightMatch.ok ? "sc-hint sc-ok" : "sc-error" }, heightMatch.text)
                : el("p", { class: "sc-hint" }, "Clouds in heights above sea level sit under the basemap by the local geoid height " +
                    "(about +45 m in Florence) and slide against it as the view moves. With the basemap showing, Match basemap " +
                    "measures it from the clouds in view; it is most accurate from a few hundred metres up."),
            row("3D Tiles", choice("photorealisticTiles", [["true", "Google Photorealistic"], ["false", "Off"]], true)),
            row("Globe", onOff("globe", true)),
            value("globe") && [
                imageryRows(value("imagery"), v => set("imagery", v, true)),
                value("photorealisticTiles") && el("p", { class: "sc-hint" },
                    "Google's 3D Tiles cover the globe, so its imagery only shows with 3D Tiles off."),
                value("imagery") === "wmts" && wmtsBlock(c, set),
                row("Terrain", choice("terrain", [["false", "WGS84 Ellipsoid"], ["true", "Cesium World Terrain"]])),
            ],
            row("Sky", onOff("skyAtmosphere")),
            row("Ion token", el("input", {
                class: "sc-input sc-mono", type: "text", spellcheck: false, value: c.ionToken ?? "", placeholder: "built-in",
                onchange: e => set("ionToken", e.target.value.trim() || undefined),
            })),
            defaultAll,
            el("div", { class: "sc-actions" }, previewBtn),
            CesiumBasemap.error && el("div", { class: "sc-error" }, CesiumBasemap.error),
            el("p", { class: "sc-hint" }, users.length
                ? `Shown behind the point clouds in: ${users.join(", ")}.`
                : "Shown behind the point clouds in zones whose background is Cesium (Zone Management ▸ Edit ▸ Hierarchy & Behavior). No zone uses it yet."));
        // Opening the section doesn't redraw it; drawing it open is what starts loading the imagery list.
        if (value("globe")) sec.addEventListener("toggle", () => { if (sec.open && !imageryLoad && !CesiumBasemap.imageryChoices()) render(); });
        return sec;
    }

    // The globe's imagery: the list Cesium's base layer picker offers, grouped as it groups them. Cesium
    // is loaded for the list the first time the row is drawn in an open section.
    let imageryLoad = null;     // { error } once loading Cesium for the list has failed
    function imageryRows(current, onPick) {
        const choices = CesiumBasemap.imageryChoices();
        const name = CesiumBasemap.imageryName(current);
        if (!choices && !imageryLoad && openSections.has("cesium")) {
            imageryLoad = {};
            CesiumBasemap.load().then(render, err => { imageryLoad.error = err.message || String(err); render(); });
        }

        const picked = choices?.find(c => c.name === name);
        const categories = [...new Set((choices || []).map(c => c.category))];
        const options = choices
            ? categories.map(cat => el("optgroup", { label: cat },
                choices.filter(c => c.category === cat).map(c => el("option", { value: c.name, selected: c === picked }, c.name))))
            : name !== "none" && name !== "wmts" && el("option", { value: name, selected: true }, name);
        const unknown = choices && name !== "none" && name !== "wmts" && !picked;
        const imagery = el("select", { class: "sc-select", title: picked?.tooltip ?? "", onchange: e => onPick(e.target.value) },
            el("option", { value: "none", selected: name === "none" }, "None"),
            unknown && el("option", { value: name, selected: true }, `${name} (unknown)`),
            options,
            el("optgroup", { label: "Your own" },
                el("option", { value: "wmts", selected: name === "wmts" }, CesiumBasemap.WMTS_NAME)));

        // The first sentence of Cesium's description (its tooltip in the widget)
        const about = picked && picked.tooltip.split("\n")[0].match(/^.*?[.!?](?=\s|$)|^.*/)[0];
        return [
            row("Imagery", imagery),
            imageryLoad?.error ? el("div", { class: "sc-error" }, `Couldn't load Cesium for its imagery list: ${imageryLoad.error}`)
                : !choices ? el("p", { class: "sc-hint" }, "Loading Cesium's imagery list…")
                : unknown ? el("div", { class: "sc-error" }, `Cesium ${Cesium.VERSION} has no imagery called "${name}", so it shows ${choices[0].name}.`)
                : CesiumBasemap.imageryError ? el("div", { class: "sc-error" }, CesiumBasemap.imageryError)
                : about && el("p", { class: "sc-hint" }, about),
        ];
    }

    // Any WMTS layer, as sceneConfig.cesium.wmts. Reading the service's capabilities lists its layers;
    // picking one fills in everything, including how its tile matrix set maps onto Cesium's levels.
    // Every field can also be typed, for a service without capabilities.
    let wmtsUI = { url: null, caps: null, busy: false, error: null, warnings: [], filter: "", more: false };
    let wmtsPresets = null;     // { loading } → { list } or { error }, fetched the first time the block shows
    const WMTS_TEMPLATE_KEYS = ["style", "Style", "TileMatrixSet", "TileMatrix", "TileRow", "TileCol", "s"];
    function wmtsBlock(c, set) {
        const w = c.wmts || {};
        // Changes to the settings; undefined, "" or an empty list/object leaves a setting out.
        const put = changes => {
            const next = { ...w };
            for (const [k, v] of Object.entries(changes)) {
                const empty = v === undefined || v === "" || (Array.isArray(v) ? !v.length : typeof v === "object" && !Object.keys(v).length);
                if (empty) delete next[k];
                else next[k] = v;
            }
            set("wmts", next, true);
        };
        const fill = (layerId, picks) => {
            const r = CesiumBasemap.wmtsFromCapabilities(wmtsUI.caps, layerId, picks);
            wmtsUI.warnings = r.warnings;
            // a new layer starts from its own dimensions; another style, format or set keeps the ones typed
            set("wmts", picks && w.dimensions ? { ...r.wmts, dimensions: w.dimensions } : r.wmts, true);
        };
        const input = (key, placeholder, props = {}) => el("input", {
            class: "sc-input" + (props.mono ? " sc-mono" : ""), type: props.type || "text", spellcheck: false,
            value: w[key] ?? "", placeholder, step: props.step,
            onchange: e => {
                const v = e.target.value.trim();
                put({ [key]: props.type === "number" ? (v === "" ? undefined : Number(v)) : v });
            },
        });

        // ── Presets: whole settings for well-known layers (wmts_presets.json) ──
        if (!wmtsPresets) {
            wmtsPresets = { loading: true };
            fetch(WMTS_PRESETS_URL)
                .then(res => res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`)))
                .then(data => { wmtsPresets = { list: data.presets }; }, err => { wmtsPresets = { error: err.message }; })
                .then(() => render());
        }
        const presets = wmtsPresets.list || [];
        // the preset these settings come from, whatever dimensions (dates) have been typed since
        const preset = presets.find(p => p.wmts.url === w.url && p.wmts.layer === w.layer && p.wmts.tileMatrixSetID === w.tileMatrixSetID);
        const presetSelect = el("select", {
            class: "sc-select",
            onchange: e => {
                const p = presets[e.target.value];
                if (!p) return;
                if (wmtsUI.caps?.url !== p.wmts.capabilities) wmtsUI.caps = null;
                Object.assign(wmtsUI, { url: null, error: null, warnings: [] });
                set("wmts", structuredClone(p.wmts), true);
            },
        },
            el("option", { value: "", selected: !preset }, wmtsPresets.loading ? "Loading presets…" : "None: the settings below"),
            [...new Set(presets.map(p => p.group))].map(group => el("optgroup", { label: group },
                presets.map((p, i) => p.group === group && el("option", { value: i, selected: p === preset }, p.name)))));

        // ── Capabilities ──
        const capsInput = el("input", {
            class: "sc-input sc-mono", type: "url", spellcheck: false, placeholder: "…/WMTSCapabilities.xml",
            value: wmtsUI.url ?? w.capabilities ?? "",
            onkeydown: e => { if (e.key === "Enter") read(); },
        });
        const read = async () => {
            const url = capsInput.value.trim();
            if (!url) return;
            Object.assign(wmtsUI, { url, busy: true, error: null, caps: null, warnings: [] });
            render();
            try { wmtsUI.caps = await CesiumBasemap.readWmtsCapabilities(url); }
            catch (err) { wmtsUI.error = err.message; }
            wmtsUI.busy = false;
            render();
        };
        const caps = wmtsUI.caps;
        const layer = caps?.layers.find(l => l.id === w.layer);

        let capsRows = null;
        if (caps) {
            const layerSelect = el("select", { class: "sc-select", onchange: e => fill(e.target.value) },
                !layer && el("option", { value: "", selected: true, disabled: true }, `Pick one of ${caps.layers.length} layers`),
                caps.layers.map(l => el("option", { value: l.id, selected: l === layer, title: l.id }, l.title)));
            const applyFilter = () => {
                const q = wmtsUI.filter.toLowerCase();
                for (const o of layerSelect.options) if (o.value) o.hidden = !!q && !`${o.textContent} ${o.value}`.toLowerCase().includes(q);
            };
            applyFilter();
            const sets = layer && layer.sets.map(id => [id, id + (caps.matrixSets[id]?.ok ? "" : " (doesn't fit Cesium)")]);
            capsRows = [
                el("p", { class: "sc-hint" }, [caps.title, caps.provider].filter(Boolean).join(" · ") || "Read."),
                caps.layers.length > 8 && el("input", {
                    class: "sc-input", type: "search", placeholder: "Filter layers", value: wmtsUI.filter,
                    oninput: e => { wmtsUI.filter = e.target.value; applyFilter(); },
                }),
                row("Layer", layerSelect),
                layer && [
                    row("Style", select(layer.styles.map(s => [s.id, s.id]), w.style, e => fill(w.layer, { style: e.target.value }), false)),
                    row("Format", select([...new Set([...layer.templates.map(t => t.format), ...layer.formats])].map(f => [f, f]), w.format,
                        e => fill(w.layer, { format: e.target.value }), false)),
                    row("Matrix set", select(sets, w.tileMatrixSetID, e => fill(w.layer, { set: e.target.value }), false)),
                ],
            ];
        }

        // ── The settings themselves ──
        const dimensionText = Object.entries(w.dimensions || {}).map(([k, v]) => `${k}=${v}`).join("\n");
        const dimensionHints = (layer?.dimensions || []).map(d => {
            const first = d.values[0]?.split("/")[0], last = d.values[d.values.length - 1]?.split("/");
            const range = d.values.length && (d.values.length > 1 || d.values[0].includes("/")) ? `${first} to ${last[1] ?? last[0]}` : d.values.join(", ");
            // services like NASA's GIBS default to their newest day, which is usually still being filled in
            const recent = /^time$/i.test(d.id) && Date.parse(d.default) > Date.now() - 2 * 86400e3;
            return `${d.id}: ${range || "any"}${d.default ? ` (default ${d.default})` : ""}` +
                (recent ? ". The newest days often have little or no imagery yet; an earlier date shows more." : "");
        });
        // {Time} and the like in the URL need a dimension to fill them
        const unfilled = [...(w.url || "").matchAll(/\{([^}]+)\}/g)].map(m => m[1])
            .filter(k => !WMTS_TEMPLATE_KEYS.includes(k) && !(w.dimensions && k in w.dimensions));
        const problem = CesiumBasemap.wmtsProblem(w);

        const pair = (a, b) => el("div", { class: "sc-fields" }, a, b);
        const rect = w.rectangle || [];
        const rectInputs = ["W", "S", "E", "N"].map((p, i) => el("input", {
            class: "sc-input", type: "number", step: "any", placeholder: p, value: rect[i] ?? "",
            onchange: () => {
                const v = rectInputs.map(r => r.value.trim());
                if (v.every(x => x === "")) put({ rectangle: undefined });
                else if (v.every(x => x !== "" && isFinite(x))) put({ rectangle: v.map(Number) });
            },
        }));
        const more = el("details", { class: "sc-more", open: wmtsUI.more, ontoggle: e => { wmtsUI.more = e.target.open; } },
            el("summary", {}, "More WMTS options"),
            el("div", { class: "sc-more-body" },
                row("Matrix labels", el("textarea", {
                    class: "sc-input sc-mono sc-textarea", rows: 2, spellcheck: false, placeholder: "the level numbers",
                    title: "The TileMatrix identifier of each level, from level 0, separated by commas",
                    value: (w.tileMatrixLabels || []).map(l => l ?? "").join(", "),
                    onchange: e => {
                        const v = e.target.value.trim();
                        put({ tileMatrixLabels: v ? v.split(",").map(l => l.trim() || null) : undefined });
                    },
                })),
                row("Tiling", select([["webmercator", "Web Mercator (EPSG:3857)"], ["geographic", "Geographic (EPSG:4326)"]],
                    w.tilingScheme ?? "webmercator", e => put({ tilingScheme: e.target.value === "geographic" ? "geographic" : undefined }), false)),
                row("Levels", pair(input("minimumLevel", "min 0", { type: "number", step: 1 }), input("maximumLevel", "max: none", { type: "number", step: 1 }))),
                row("Tile size", pair(input("tileWidth", "256 px", { type: "number", step: 1 }), input("tileHeight", "256 px", { type: "number", step: 1 }))),
                row("Rectangle", el("div", { class: "sc-fields" }, rectInputs)),
                el("p", { class: "sc-hint" }, "Rectangle: the area the layer covers, in degrees (west, south, east, north). Blank: the whole tiling."),
                row("Subdomains", el("input", {
                    class: "sc-input sc-mono", type: "text", spellcheck: false, placeholder: "abc", title: "For {s} in the URL: each letter, or a comma-separated list",
                    value: Array.isArray(w.subdomains) ? w.subdomains.join(", ") : w.subdomains ?? "",
                    onchange: e => {
                        const v = e.target.value.trim();
                        put({ subdomains: v.includes(",") ? v.split(",").map(s => s.trim()).filter(Boolean) : v });
                    },
                })),
                row("Credit", input("credit", "shown in the basemap's credits"))));

        return el("div", { class: "sc-sub sc-wmts" },
            el("div", { class: "sc-sub-title" }, CesiumBasemap.WMTS_NAME),
            row("Preset", presetSelect),
            wmtsPresets.error ? el("div", { class: "sc-error" }, `Couldn't load the presets: ${wmtsPresets.error}`)
                : preset && el("p", { class: "sc-hint" }, preset.note),
            row("Capabilities", el("div", { class: "sc-range-row" }, capsInput,
                el("button", { class: "sc-btn", disabled: wmtsUI.busy, onclick: read }, wmtsUI.busy ? "Reading…" : "Read"))),
            wmtsUI.error && el("div", { class: "sc-error" }, wmtsUI.error),
            capsRows ?? el("p", { class: "sc-hint" }, "Read a service's capabilities to pick one of its layers, or fill in the fields below."),
            wmtsUI.warnings.map(text => el("div", { class: "sc-error" }, text)),
            row("Tile URL", el("textarea", {
                class: "sc-input sc-mono sc-textarea", rows: 3, spellcheck: false, value: w.url ?? "",
                placeholder: "https://…/{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}.png, or the GetTile endpoint",
                onchange: e => put({ url: e.target.value.trim() }),
            })),
            !layer && [
                row("Layer", input("layer", "layer identifier", { mono: true })),
                row("Style", input("style", "default", { mono: true })),
                row("Format", input("format", "image/jpeg", { mono: true })),
                row("Matrix set", input("tileMatrixSetID", "TileMatrixSet identifier", { mono: true })),
            ],
            row("Dimensions", el("textarea", {
                class: "sc-input sc-mono sc-textarea", rows: 2, spellcheck: false, value: dimensionText, placeholder: "Time=2024-06-01",
                title: "Values for the layer's dimensions, one name=value per line",
                onchange: e => put({ dimensions: Object.fromEntries(e.target.value.split("\n")
                    .map(line => line.split("=")).filter(([k, ...v]) => k.trim() && v.length)
                    .map(([k, ...v]) => [k.trim(), v.join("=").trim()])) }),
            })),
            dimensionHints.length > 0 && el("p", { class: "sc-hint" }, dimensionHints.join(" · ")),
            unfilled.length > 0 && el("div", { class: "sc-error" },
                `The tile URL has ${unfilled.map(k => `{${k}}`).join(", ")}, so Dimensions needs a value for ${unfilled.length > 1 ? "each" : "it"}.`),
            problem && el("p", { class: "sc-hint" }, problem),
            more);
    }

    // ── Start zones ──────────────────────────────────────────────
    function startZonesSection(sc) {
        const zones = window.zones || [];
        const names = new Set(zones.map(z => z.name));
        const missing = sc.startZones.filter(n => !names.has(n));
        const setOn = (name, on) => {
            sc.startZones = on ? [...sc.startZones, name] : sc.startZones.filter(n => n !== name);
        };

        const checks = el("div", { class: "sc-checks" },
            zones.map(z => el("label", { class: "sc-check" },
                el("input", { type: "checkbox", checked: sc.startZones.includes(z.name), onchange: e => setOn(z.name, e.target.checked) }),
                z.name)));

        const filter = zones.length > 8 && el("input", {
            class: "sc-input", type: "search", placeholder: "Filter zones",
            oninput: e => {
                const q = e.target.value.toLowerCase();
                for (const c of checks.children) c.style.display = c.textContent.toLowerCase().includes(q) ? "" : "none";
            },
        });

        return section("startZones", "Start zones", sc.startZones.length ? `${sc.startZones.length} on` : null,
            el("div", { class: "sc-actions" },
                el("button", {
                    class: "sc-btn", disabled: !zones.length,
                    onclick: () => { sc.startZones = [...(window.newVisibleZones || [])].map(z => z.name); render(); },
                }, "Use visible zones")),
            zones.length ? [filter, checks] : el("p", { class: "sc-hint" }, "No zones yet. Create them in Zone Management."),
            missing.map(n => el("div", { class: "sc-list-row" },
                el("span", { class: "sc-missing" }, `${n} (no such zone)`),
                el("button", {
                    class: "sc-icon-btn sc-danger", title: "Remove",
                    onclick: () => { sc.startZones = sc.startZones.filter(x => x !== n); render(); },
                }, "×"))),
            el("p", { class: "sc-hint" },
                "Zones switched on when the scene opens. With none ticked, each cloud's Visible box decides."));
    }

    // ── Classification edits ─────────────────────────────────────
    function editsSection(sc) {
        const list = sc.classificationEdits;
        const addRow = () => {
            list.push("");
            render();
            const inputs = document.querySelectorAll(`#${PANEL_ID} .sc-edit-url`);
            inputs[inputs.length - 1]?.focus();
        };

        return section("edits", "Classification edits", list.length || null,
            list.map((url, i) => el("div", { class: "sc-list-row" },
                el("input", {
                    class: "sc-input sc-mono sc-edit-url", value: url, placeholder: "classification_edits.gz",
                    onchange: e => { list[i] = e.target.value.trim(); },
                }),
                el("button", { class: "sc-icon-btn sc-danger", title: "Remove", onclick: () => { list.splice(i, 1); render(); } }, "×"))),
            el("div", { class: "sc-actions" }, el("button", { class: "sc-btn", onclick: addRow }, "+ Add URL")),
            el("p", { class: "sc-hint" }, "Brush edit files loaded when the scene opens. Relative URLs load from the dataset folder."));
    }

    // ── Custom script ────────────────────────────────────────────
    // sceneConfig.script, run when the scene loads from zones.json. Run now tries it on the scene as it is.
    let scriptRun = null;       // the sceneConfig whose script "Run now" last ran
    function scriptSection(sc) {
        const lines = sc.script.trim() ? sc.script.split("\n").length : 0;
        const err = sc.scriptError;
        // The function wrapper adds two lines above the script, so the stack's line is two too far down
        const line = err?.stack?.match(/sceneConfig\.script\.js:(\d+)/)?.[1] - 2;
        const errText = (err instanceof Error ? `${err.name}: ${err.message}` : String(err)) + (line > 0 ? ` (line ${line})` : "");

        const runBtn = el("button", {
            class: "sc-btn", disabled: !lines,
            onclick: async () => {
                runBtn.disabled = true;
                runBtn.textContent = "Running…";
                await sc.runScript();
                scriptRun = sc;
                render();
            },
        }, "Run now");

        return section("script", "Custom script", err ? "error" : lines ? `${lines} line${lines === 1 ? "" : "s"}` : null,
            el("textarea", {
                class: "sc-input sc-mono sc-textarea sc-code", rows: 10, spellcheck: false, wrap: "off",
                value: sc.script, placeholder: "// e.g.\nviewer.setMoveSpeed(5);",
                oninput: e => { sc.script = e.target.value; runBtn.disabled = !sc.script.trim(); },
            }),
            el("div", { class: "sc-actions" }, runBtn),
            err ? el("div", { class: "sc-error" }, `${scriptRun === sc ? "Failed" : "Failed when the scene loaded"}: ${errText}`)
                : scriptRun === sc && el("p", { class: "sc-hint sc-ok" }, "Ran without errors."),
            el("p", { class: "sc-hint" },
                "JavaScript run each time the scene loads from zones.json, after its point clouds and zones are set up. " +
                "It can use await and the page's globals (viewer, Potree, THREE, zones, sceneConfig). " +
                "Run now runs it on the scene as it is, so anything it adds is added again."));
    }

    // ── Point clouds ─────────────────────────────────────────────
    function cloudsSection(sc) {
        const ids = Object.keys(sc.pointclouds);
        const unlisted = viewer.scene.pointclouds.filter(pc => !hasEntry(sc, pc.name));

        const captureAll = () => {
            for (const id of sc.loaded.keys()) {
                sc.captureMaterial(id);
                sc.captureTransform(id);
            }
            render();
        };

        return section("pointclouds", "Point clouds", ids.length,
            ids.length > 1 && el("div", { class: "sc-actions" },
                el("button", { class: "sc-btn", disabled: !sc.loaded.size, onclick: captureAll, title: "Capture the material and transform of every loaded cloud" }, "Capture all")),
            ids.map(id => cloudCard(sc, id)),
            unlisted.length > 0 && el("div", { class: "sc-sub" },
                el("div", { class: "sc-hint" }, "In the viewer but not in this config:"),
                unlisted.map(pc => el("div", { class: "sc-list-row" },
                    el("span", { class: "sc-mono" }, pc.name || "(unnamed)"),
                    el("button", { class: "sc-btn", disabled: !pc.name, onclick: () => { sc.adopt(pc); render(); } }, "Add")))),
            addCloudForm(sc));
    }

    function cloudCard(sc, id) {
        const entry = sc.pointclouds[id];
        const pc = sc.loaded.get(id);
        const matVal = el("span", { class: "sc-cap-val" }, materialSummary(entry.material));
        const tfVal = el("span", { class: "sc-cap-val" }, transformSummary(entry.transform));

        // Opacity is applied to the cloud as the slider moves. Unset, it shows the cloud's current value.
        const opacityOut = el("span", { class: "sc-range-val sc-mono" });
        const opacity = el("input", {
            type: "range", class: "sc-range", min: 0, max: 1, step: 0.01,
            oninput: e => {
                entry.opacity = Number(e.target.value);
                if (pc) pc.material.opacity = entry.opacity;
                showOpacity();
            },
        });
        const showOpacity = () => {
            opacity.value = entry.opacity ?? pc?.material.opacity ?? 1;
            opacityOut.textContent = Number(opacity.value).toFixed(2);
        };
        showOpacity();

        return el("div", { class: "sc-pc" },
            el("div", { class: "sc-pc-head" },
                el("input", {
                    type: "checkbox", class: "sc-vis", checked: entry.visible !== false,
                    title: "Visible when the scene opens", onchange: e => { entry.visible = e.target.checked; },
                }),
                el("span", { class: "sc-pc-id sc-mono", title: `${id}\nThe id can't be changed: zones and brush edits refer to the cloud by it.` }, id),
                !pc && el("span", { class: "sc-badge" }, "not loaded"),
                el("button", { class: "sc-icon-btn", title: "Go to", disabled: !pc, onclick: () => moveCameraToPC(pc) }, "⌖"),
                el("button", { class: "sc-icon-btn sc-danger", title: "Remove from the scene", onclick: () => removeCloud(sc, id) }, "×")),
            row("Label", el("input", {
                class: "sc-input", value: entry.label ?? "", placeholder: id,
                oninput: e => {
                    const label = e.target.value.trim();
                    if (label) entry.label = label;
                    else delete entry.label;
                    if (pc) pc.userData.label = label || id;
                },
            })),
            row("Opacity", el("div", { class: "sc-range-row" }, opacity, opacityOut)),
            row("URL", el("input", {
                class: "sc-input sc-mono", value: entry.url || "", placeholder: `${id}/metadata.json`,
                title: "Relative URLs load from the dataset folder. Takes effect the next time the scene loads.",
                onchange: e => { entry.url = e.target.value.trim() ? sc.relativeURL(e.target.value.trim()) : ""; render(); },
            })),
            !entry.url && el("div", { class: "sc-error" }, "No URL: this cloud won't load from zones.json."),
            capture("Material", matVal, pc, () => { sc.captureMaterial(id); flash(matVal, materialSummary(entry.material)); showOpacity(); }),
            capture("Transform", tfVal, pc, () => { sc.captureTransform(id); flash(tfVal, transformSummary(entry.transform)); }));
    }

    function capture(label, valueEl, pc, onclick) {
        return el("div", { class: "sc-cap" },
            el("span", { class: "sc-key" }, label),
            valueEl,
            el("button", { class: "sc-btn", disabled: !pc, onclick }, "Capture"));
    }

    function addCloudForm(sc) {
        const urlInput = el("input", {
            class: "sc-input sc-mono", value: addForm.url, placeholder: "https://…/<id>/metadata.json", disabled: addForm.busy,
            oninput: e => {
                addForm.url = e.target.value;
                if (!addForm.idEdited) idInput.value = addForm.id = idFromURL(addForm.url);
            },
        });
        const idInput = el("input", {
            class: "sc-input sc-mono", value: addForm.id, placeholder: "folder name", disabled: addForm.busy,
            oninput: e => { addForm.id = e.target.value; addForm.idEdited = e.target.value !== ""; },
        });

        return el("div", { class: "sc-sub" },
            el("div", { class: "sc-sub-title" }, "Add point cloud"),
            row("URL", urlInput),
            row("ID", idInput),
            el("div", { class: "sc-actions" },
                el("button", { class: "sc-btn sc-primary", disabled: addForm.busy, onclick: () => addCloud(sc) },
                    addForm.busy ? "Loading…" : "Add & load")),
            addForm.error && el("div", { class: "sc-error" }, addForm.error),
            el("p", { class: "sc-hint" },
                "The ID defaults to the cloud's folder name and can't be changed after adding, because zones and brush edits refer to clouds by it."));
    }

    // ══════════════════════════════════════════════════════════════
    //  Actions
    // ══════════════════════════════════════════════════════════════
    async function addCloud(sc) {
        const url = addForm.url.trim();
        const id = addForm.id.trim();
        const fail = msg => { addForm.error = msg; render(); };

        if (!SceneConfig.isPointCloudURL(url)) return fail("Paste the URL of the cloud's metadata.json, ept.json, cloud.js or .copc.laz file.");
        if (!id) return fail("Give the cloud an ID.");
        if (hasEntry(sc, id)) return fail(`"${id}" is already in this config.`);
        if (viewer.scene.pointclouds.some(pc => pc.name === id)) {
            return fail(`A cloud named "${id}" is already in the viewer. Add it from the list above instead.`);
        }

        const abs = sc.resolveURL(url);
        addForm.busy = true;
        addForm.error = "";
        render();

        let pc = null;
        try {
            pc = await sc.addPointCloud(viewer, id, {
                label: id,
                url: sc.relativeURL(abs),
                visible: true,
                material: { ...NEW_CLOUD_MATERIAL },
            });
        } catch (err) {
            addForm.error = `Couldn't load the cloud: ${err.message}`;
        }

        addForm.busy = false;
        if (pc) {
            Object.assign(addForm, { url: "", id: "", idEdited: false });
            moveCameraToPC(pc);
        }
        render();
    }

    function removeCloud(sc, id) {
        const pc = sc.loaded.get(id);
        const zones = pc ? (window.zones || []).filter(z => z.pointclouds.includes(pc)) : [];
        const msg = `Remove "${id}" from the scene?` +
            (zones.length ? `\n\nIt is also removed from ${zones.length === 1 ? "zone" : "zones"}: ${zones.map(z => z.name).join(", ")}.` : "");
        if (!confirm(msg)) return;

        sc.removePointCloud(viewer, id);
        if (pc) {
            for (const z of window.zones || []) {
                const i = z.pointclouds.indexOf(pc);
                if (i >= 0) z.pointclouds.splice(i, 1);
                for (const lm of z.layerMaps || []) {
                    lm.layersList = (lm.layersList || []).filter(l => l.pointcloud !== pc);
                }
            }
        }

        if (typeof updateZoneList === "function") updateZoneList();
        if (typeof _refreshZoneSearchPanel === "function") _refreshZoneSearchPanel();
        render();
    }

    // ══════════════════════════════════════════════════════════════
    //  Helpers
    // ══════════════════════════════════════════════════════════════

    // Children first, so a <select> has its options before `value` is set.
    function el(tag, props = {}, ...children) {
        const e = document.createElement(tag);
        for (const c of children.flat(Infinity)) {
            if (c !== null && c !== undefined && c !== false) e.append(c);
        }
        for (const [k, v] of Object.entries(props)) {
            if (v === undefined || v === null || v === false) continue;
            if (k === "class") e.className = v;
            else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
            else if (k in e) e[k] = v;
            else e.setAttribute(k, v);
        }
        return e;
    }

    function section(key, title, count, ...body) {
        const details = el("details", { class: "sc-sec", open: openSections.has(key) },
            el("summary", {}, title, count !== null && count !== undefined && el("span", { class: "sc-count" }, String(count))),
            el("div", { class: "sc-body" }, ...body));
        details.addEventListener("toggle", () => {
            if (details.open) openSections.add(key);
            else openSections.delete(key);
        });
        return details;
    }

    function row(label, control) {
        return el("div", { class: "sc-row" }, el("span", { class: "sc-key" }, label), control);
    }

    // With `blank`, a first "default" option stands for leaving the setting out.
    function select(options, value, onchange, blank = true) {
        return el("select", { class: "sc-select", onchange },
            blank && el("option", { value: "" }, "default"),
            options.map(([v, text]) => el("option", { value: String(v), selected: value !== undefined && String(v) === String(value) }, text)));
    }

    function vec(arr) {
        return el("span", { class: "sc-mono sc-vec" }, arr.map(fmt).join(", "));
    }

    function flash(valueEl, text) {
        valueEl.textContent = text;
        valueEl.classList.remove("sc-flash");
        void valueEl.offsetWidth;   // restart the animation
        valueEl.classList.add("sc-flash");
    }

    function fmt(n) {
        return String(Math.round(n * 1000) / 1000);
    }

    function materialSummary(m) {
        if (!m) return "Potree default";
        // "rgb gamma 1.2, contrast 0.1" — only the parts away from 1/0/0
        const gbc = group => {
            const g = m[group];
            const parts = g && [
                g.gamma !== 1 && `gamma ${fmt(g.gamma)}`,
                g.brightness !== 0 && `brightness ${fmt(g.brightness)}`,
                g.contrast !== 0 && `contrast ${fmt(g.contrast)}`,
            ].filter(Boolean);
            return parts?.length && `${group} ${parts.join(", ")}`;
        };
        const weights = m.weights && Object.entries(m.weights).filter(([, w]) => w).map(([k, w]) => `${k} ${fmt(w)}`);
        const ranges = Object.entries(m.ranges || {}).map(([name, r]) => `${name} ${r.map(fmt).join("–")}`);
        const parts = [
            m.attribute,
            m.shape,
            m.sizeType,
            m.size !== undefined && `size ${m.size}`,
            m.minSize !== undefined && `min ${m.minSize}`,
            m.backfaceCulling && "backface culling",
            m.matcap && m.matcap.replace(/\.\w+$/, ""),
            weights && `weights ${weights.join(", ") || "all 0"}`,
            ...ranges,
            m.gradient && `${typeof m.gradient === "string" ? m.gradient.toLowerCase() : "custom"} gradient`,
            m.color && "colour",
            ...SceneConfig.GBC_GROUPS.map(gbc),
        ];
        return parts.filter(Boolean).join(" · ") || "Potree default";
    }

    function transformSummary(t) {
        if (!t) return "As loaded";
        const parts = [
            t.translation && `Δ ${t.translation.map(fmt).join(", ")}`,
            t.rotation && `rot ${t.rotation.map(fmt).join("°, ")}°`,
            t.scale && `scale ${t.scale.map(fmt).join(", ")}`,
        ];
        return parts.filter(Boolean).join(" · ");
    }

    function idFromURL(url) {
        try { return SceneConfig.idFromURL(url.trim()); }
        catch (_) { return ""; }
    }

    // `pointclouds` is a plain object, so `in` would also match "constructor" etc.
    function hasEntry(sc, id) {
        return Object.prototype.hasOwnProperty.call(sc.pointclouds, id);
    }

    window.toggleSceneSetup = toggleSceneSetup;
})();
