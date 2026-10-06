/**
 * scene_config_panel.js — Scene Setup
 *
 * Author: (OpenHeritage3D / CHEI, UC San Diego)
 *
 * Description:
 *   A floating window for editing window.sceneConfig (scene_config.js): the
 *   dataset (vtype, DOI), viewer settings, starting camera, start zones,
 *   classification edits and point clouds that a schema-2 zones.json describes. Most values are read
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

    // How a cloud added here looks until its material is captured — the same
    // defaults default_config.js gives auto-detected clouds.
    const NEW_CLOUD_MATERIAL = { attribute: "rgba", shape: "circle", sizeType: "adaptive", minSize: 2 };

    const BACKGROUNDS = [["gradient", "Gradient"], ["black", "Black"], ["white", "White"], ["skybox", "Skybox"]];
    const CLIP_TASKS = [[0, "None"], [1, "Highlight"], [2, "Show inside"], [3, "Show outside"]];

    // UI state that outlives a re-render
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
            content.replaceChildren(
                datasetSection(sc),
                viewerSection(sc),
                cameraSection(sc),
                startZonesSection(sc),
                editsSection(sc),
                cloudsSection(sc));
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
        const setEDL = value => {
            if (value === "") {
                if (v.edl) delete v.edl.enabled;
                if (v.edl && !Object.keys(v.edl).length) delete v.edl;
            } else {
                v.edl = { ...v.edl, enabled: value === "true" };
            }
            sc.applyViewerSettings(viewer);
        };

        return section("viewer", "Viewer", null,
            el("div", { class: "sc-actions" },
                el("button", { class: "sc-btn", onclick: () => { sc.captureViewerSettings(viewer); render(); } }, "Use current")),
            row("Point budget", number("pointBudget", { min: 0, step: 100000 })),
            row("FOV", number("fov", { min: 20, max: 100, step: 1 })),
            row("Background", select(BACKGROUNDS, v.background, e => set("background", e.target.value || undefined))),
            row("EDL", select([["true", "On"], ["false", "Off"]], v.edl?.enabled, e => setEDL(e.target.value))),
            row("Clip task", select(CLIP_TASKS, v.clipTask,
                e => set("clipTask", e.target.value === "" ? undefined : Number(e.target.value)))),
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
            row("URL", el("input", {
                class: "sc-input sc-mono", value: entry.url || "", placeholder: `${id}/metadata.json`,
                title: "Relative URLs load from the dataset folder. Takes effect the next time the scene loads.",
                onchange: e => { entry.url = e.target.value.trim() ? sc.relativeURL(e.target.value.trim()) : ""; render(); },
            })),
            !entry.url && el("div", { class: "sc-error" }, "No URL: this cloud won't load from zones.json."),
            capture("Material", matVal, pc, () => { sc.captureMaterial(id); flash(matVal, materialSummary(entry.material)); }),
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

    function select(options, value, onchange) {
        return el("select", { class: "sc-select", onchange },
            el("option", { value: "" }, "default"),
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
        const parts = [
            m.attribute,
            m.shape,
            m.sizeType,
            m.size !== undefined && `size ${m.size}`,
            m.minSize !== undefined && `min ${m.minSize}`,
            m.opacity !== undefined && `opacity ${fmt(m.opacity)}`,
            m.matcap && m.matcap.replace(/\.\w+$/, ""),
            m.ranges?.intensity && `intensity ${m.ranges.intensity.map(fmt).join("–")}`,
            m.ranges?.elevation && `elevation ${m.ranges.elevation.map(fmt).join("–")}`,
            m.gradient && `${typeof m.gradient === "string" ? m.gradient.toLowerCase() : "custom"} gradient`,
            m.color && "colour",
            m.rgb && m.rgb.gamma !== 1 && `gamma ${fmt(m.rgb.gamma)}`,
            m.rgb && m.rgb.brightness !== 0 && `brightness ${fmt(m.rgb.brightness)}`,
            m.rgb && m.rgb.contrast !== 0 && `contrast ${fmt(m.rgb.contrast)}`,
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
