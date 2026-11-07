// SceneConfig — the `sceneConfig` block of a schema-2 zones.json.
//
// A schema-2 zones.json is a complete description of a scene:
//   { "schema": 2, "sceneConfig": { vtype, doi, viewer, camera, cesium, startZones, classificationEdits, pointclouds, script }, "zones": [...] }
// sceneConfig says what gets loaded and how it looks by default; zones group those clouds and refer to
// them by id. The id is the key in `pointclouds`, normally the cloud's folder name, and becomes
// pointcloud.name at runtime. It never changes once the cloud is added; `label` is free text.
// vtype and doi name the dataset the scene belongs to (index.html's ?vtype= and ?doi=); relative URLs
// resolve against that dataset's potree/ folder. `script` is JavaScript run once the scene has loaded.
//
// An old-style zones.json (a bare array) still loads through config.js — see index.html.
class SceneConfig {

    constructor(json = {}, baseURL = window.location.href) {
        this.raw = json;
        this.baseURL = new URL(baseURL, window.location.href).href;   // zones.json, the fallback for relative URLs
        this.vtype = json.vtype || null;                 // key into index.html's VTYPE_CONFIG; null = DEFAULT_CONFIG
        this.doi = json.doi || null;
        this.viewerSettings = json.viewer || {};
        this.camera = json.camera || null;               // { position: [x,y,z], target: [x,y,z] }
        this.cesium = json.cesium || {};                 // basemap for zones with a "cesium" background (cesium_basemap.js)
        this.startZones = json.startZones || [];
        this.classificationEdits = json.classificationEdits || [];
        this.pointclouds = json.pointclouds || {};       // id -> { label, url, visible, opacity, transform, material }
        // A hand-written file may give the script as an array of lines
        this.script = Array.isArray(json.script) ? json.script.join("\n") : json.script || "";
        this.scriptError = null;                         // what the last run of the script threw
        this.loaded = new Map();                         // id -> Potree point cloud

        // Opacity was briefly stored inside `material`; it sits beside `visible` now.
        for (const entry of Object.values(this.pointclouds)) {
            if (entry.material?.opacity === undefined) continue;
            if (entry.opacity === undefined) entry.opacity = entry.material.opacity;
            delete entry.material.opacity;
        }
    }

    // Snapshot of the live scene, for scenes that were loaded from config.js.
    static fromViewer(viewer, baseURL) {
        const sc = new SceneConfig({}, baseURL);
        sc.useCurrentDataset();                         // before adopt(): it stores URLs relative to the dataset
        sc.captureViewerSettings(viewer);
        sc.captureCamera(viewer);
        sc.startZones = [...(window.newVisibleZones || [])].map(z => z.name);
        for (const pc of viewer.scene.pointclouds) sc.adopt(pc);
        return sc;
    }

    // fromViewer() plus the dataset's classification edits file, when it has one.
    static async capture(viewer, baseURL) {
        const sc = SceneConfig.fromViewer(viewer, baseURL);
        const edits = window.classificationURL;
        const exists = edits && await fetch(edits, { method: "HEAD", cache: "no-store" }).then(r => r.ok, () => false);
        if (exists) sc.classificationEdits.push(sc.relativeURL(edits));
        return sc;
    }

    // The id is the folder the cloud lives in (…/<id>/metadata.json); a bare
    // COPC/LAS file is named after the file instead.
    static idFromURL(url) {
        const parts = new URL(url, window.location.href).pathname.split("/").filter(Boolean);
        const file = parts.pop() || "";
        if (/^(metadata\.json|ept\.json|cloud\.js)$/i.test(file)) return decodeURIComponent(parts.pop() || "");
        return decodeURIComponent(file.replace(/(\.copc)?\.la[sz]$/i, ""));
    }

    static isPointCloudURL(url) {
        return /(metadata\.json|ept\.json|cloud\.js|\.copc\.laz)([?#].*)?$/i.test(url);
    }

    // The dataset this page shows (index.html's ?vtype= and ?doi=).
    useCurrentDataset() {
        this.vtype = window.vtype || null;
        this.doi = window.doi || null;
    }

    // datasetPrefix for a vtype, as index.html picks it. Null on pages without VTYPE_CONFIG (standalone.html).
    static datasetPrefix(vtype) {
        if (typeof VTYPE_CONFIG === "undefined") return null;
        return (VTYPE_CONFIG[vtype] || DEFAULT_CONFIG).datasetPrefix;
    }

    // The folder relative URLs resolve against: datasetPrefix + doi + "/potree/" when the config names a
    // DOI, so a zones.json imported from disk or opened on another host still finds its clouds.
    // Otherwise the folder zones.json was loaded from.
    get dataDir() {
        const prefix = this.doi && SceneConfig.datasetPrefix(this.vtype);
        if (prefix) return new URL(prefix + this.doi + "/potree/", window.location.href).href;
        return new URL(".", this.baseURL).href;
    }

    resolveURL(url) {
        return new URL(url, this.dataDir).href;
    }

    // Inverse of resolveURL: anything under dataDir is stored relative to it.
    relativeURL(url) {
        const dir = new URL(this.dataDir);
        const abs = new URL(url, dir);
        if (abs.origin === dir.origin && abs.pathname.startsWith(dir.pathname)) {
            return abs.pathname.slice(dir.pathname.length) + abs.search;
        }
        return abs.href;
    }

    // ── Applying to the viewer ───────────────────────────────

    applyViewerSettings(viewer) {
        const v = this.viewerSettings;
        if (v.pointBudget !== undefined) viewer.setPointBudget(v.pointBudget);
        if (v.fov !== undefined) viewer.setFOV(v.fov);
        if (v.background !== undefined) viewer.setBackground(v.background);
        if (v.edl?.enabled !== undefined) viewer.setEDLEnabled(v.edl.enabled);
        if (v.edl?.radius !== undefined) viewer.setEDLRadius(v.edl.radius);
        if (v.edl?.strength !== undefined) viewer.setEDLStrength(v.edl.strength);
        if (v.edl?.opacity !== undefined) {
            viewer.setEDLOpacity(v.edl.opacity);
            // Potree's sidebar slider reads this once when it is built and never listens for changes
            if (window.$) $("#sldEDLOpacity.ui-slider").slider("value", v.edl.opacity);
        }
        if (v.hqSplats !== undefined) {
            viewer.useHQ = v.hqSplats;
            // A plain flag, so the sidebar's Splat Quality buttons are synced by clicking the right one
            if (window.$) $(`#splat_quality_options input[value=${v.hqSplats ? "hq" : "standard"}]`).trigger("click");
        }
        if (v.clipTask !== undefined) viewer.setClipTask(v.clipTask);
        // Shown in a cloud's material panel (Elevation and Extra Attribute), but Potree keeps one for the viewer
        const repeat = Potree.ElevationGradientRepeat[v.gradientRepeat?.toUpperCase()];
        if (repeat !== undefined) {
            viewer.setElevationGradientRepeat(repeat);
            // the material panel reads it once when it is built; sync it if one is open
            const name = v.gradientRepeat.toUpperCase();
            if (window.$) $(`#gradient_repeat_option input[value=${name}], #extra_gradient_repeat_option input[value=${name}]`).trigger("click");
        }
    }

    applyCamera(viewer) {
        if (!this.camera) return;
        viewer.scene.view.position.set(...this.camera.position);
        viewer.scene.view.lookAt(new THREE.Vector3(...this.camera.target));
    }

    async loadPointClouds(viewer, ids = Object.keys(this.pointclouds)) {
        const results = await Promise.allSettled(ids.map(id => this._fetch(viewer, id)));

        // add in declaration order, not completion order
        results.forEach((r, i) => {
            const id = ids[i];
            if (r.status !== "fulfilled") {
                console.warn(`[SceneConfig] failed to load "${id}":`, r.reason);
                return;
            }
            this._install(viewer, id, r.value);
        });
    }

    // Add an entry and load its cloud. The entry is dropped again if the load fails.
    async addPointCloud(viewer, id, entry) {
        this.pointclouds[id] = entry;
        try {
            const pc = await this._fetch(viewer, id);
            this._install(viewer, id, pc);
            return pc;
        } catch (err) {
            delete this.pointclouds[id];
            throw err;
        }
    }

    // Add the clouds of another config that this one doesn't have yet, with their URLs rewritten to
    // resolve the same way from here (the other config may belong to another dataset). Returns their ids.
    mergePointClouds(other) {
        const added = [];
        for (const [id, entry] of Object.entries(other.pointclouds)) {
            if (Object.prototype.hasOwnProperty.call(this.pointclouds, id)) continue;
            const copy = JSON.parse(JSON.stringify(entry));
            if (copy.url) copy.url = this.relativeURL(other.resolveURL(copy.url));
            this.pointclouds[id] = copy;
            added.push(id);
        }
        return added;
    }

    // Add an entry for a cloud that is already in the scene (e.g. loaded by config.js).
    adopt(pc) {
        const id = pc.name;
        const url = pc.userData.sourceURL || pc.pcoGeometry?.url;   // COPC geometries don't keep their URL
        this.pointclouds[id] = { label: pc.userData.label || id, url: url ? this.relativeURL(url) : "", visible: pc.visible, opacity: 1 };
        SceneConfig.baseOffset(pc);
        this.captureTransform(id, pc);
        this.captureMaterial(id, pc);
        this.loaded.set(id, pc);
    }

    // Drop the entry and take its cloud out of the scene. Returns the removed cloud, if one was loaded.
    removePointCloud(viewer, id) {
        const pc = this.loaded.get(id) || viewer.scene.pointclouds.find(p => p.name === id);
        delete this.pointclouds[id];
        this.loaded.delete(id);
        if (!pc) return null;

        // Potree's Scene has no removePointCloud
        const i = viewer.scene.pointclouds.indexOf(pc);
        if (i >= 0) viewer.scene.pointclouds.splice(i, 1);
        viewer.scene.scenePointCloud.remove(pc);

        const tree = window.$ && $("#jstree_scene").jstree(true);
        const node = tree && tree.get_json("pointclouds")?.children?.find(c => c.data?.uuid === pc.uuid);
        if (node) tree.delete_node(node.id);
        return pc;
    }

    // A cloud already in the scene under this id is adopted rather than loaded twice.
    // Potree.loadPointCloud's promise never settles on failure: a missing file is caught by a HEAD
    // sent alongside it (so the success path waits on nothing extra), anything else by the timeout.
    _fetch(viewer, id) {
        const existing = viewer.scene.pointclouds.find(pc => pc.name === id);
        if (existing) return Promise.resolve(existing);
        if (!this.pointclouds[id].url) return Promise.reject(new Error("no URL"));

        const url = this.resolveURL(this.pointclouds[id].url);
        const never = new Promise(() => {});
        const missing = fetch(url, { method: "HEAD", cache: "no-store" }).then(res => {
            if (res.status === 404 || res.status === 410) throw new Error(`${url} returned HTTP ${res.status}`);
            return never;
        }, () => never);
        const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 60000));
        return Promise.race([Potree.loadPointCloud(url, id), missing, timeout]).then(e => {
            e.pointcloud.userData.sourceURL = url;
            return e.pointcloud;
        });
    }

    _install(viewer, id, pc) {
        const entry = this.pointclouds[id];

        pc.name = id;
        pc.userData.label = entry.label || id;
        SceneConfig.baseOffset(pc);
        this.applyTransform(pc, entry.transform);
        this.applyMaterial(pc, entry.material);
        if (entry.opacity !== undefined) pc.material.opacity = entry.opacity;
        pc.visible = entry.visible !== false;

        if (!viewer.scene.pointclouds.includes(pc)) viewer.scene.addPointCloud(pc);
        this.loaded.set(id, pc);
    }

    // Where the cloud sits before any transform: the octree offset it loads at.
    // "Capture transform" stores translation relative to this.
    static baseOffset(pc) {
        if (!pc.userData.baseOffset) {
            const offset = pc.pcoGeometry?.offset;
            pc.userData.baseOffset = offset?.isVector3 ? offset.clone() : pc.position.clone();
        }
        return pc.userData.baseOffset;
    }

    // translation is an offset from baseOffset; rotation in degrees. Missing parts reset to identity,
    // so applying the same entry twice gives the same pose.
    applyTransform(pc, t = {}) {
        pc.position.copy(SceneConfig.baseOffset(pc));
        if (t.translation) pc.position.add(new THREE.Vector3(...t.translation));
        pc.rotation.set(...(t.rotation || [0, 0, 0]).map(d => d * Math.PI / 180));
        pc.scale.set(...(t.scale || [1, 1, 1]));
        pc.updateMatrixWorld(true);
    }

    applyMaterial(pc, m) {
        if (!m) return;
        const mat = pc.material;
        for (const [name, range] of Object.entries(m.ranges || {})) {
            if (name === "intensity") mat.intensityRange = range;
            else if (name === "elevation") mat.elevationRange = range;
            else mat.setRange(name, range);         // an extra attribute's, by attribute name
        }
        if (typeof m.gradient === "string") mat.gradient = Potree.Gradients[m.gradient.toUpperCase()] || mat.gradient;
        else if (m.gradient) mat.gradient = m.gradient.map(([t, c]) => [t, new THREE.Color(...c)]);
        if (m.color) mat.color = new THREE.Color(...m.color);
        if (m.matcap) mat.matcap = m.matcap;
        if (m.shape) mat.shape = Potree.PointShape[m.shape.toUpperCase()];
        if (m.sizeType) mat.pointSizeType = Potree.PointSizeType[m.sizeType.toUpperCase()];
        if (m.size !== undefined) mat.size = m.size;
        if (m.minSize !== undefined) mat.minSize = m.minSize;
        if (m.backfaceCulling !== undefined) mat.backfaceCulling = m.backfaceCulling;
        for (const group of SceneConfig.GBC_GROUPS) {
            for (const part of ["gamma", "brightness", "contrast"]) {
                if (m[group]?.[part] !== undefined) mat[gbcProperty(group, part)] = m[group][part];
            }
        }
        for (const [key, prop] of Object.entries(SceneConfig.WEIGHTS)) {
            if (m.weights?.[key] !== undefined) mat[prop] = m.weights[key];
        }
        if (m.attribute) mat.activeAttributeName = m.attribute;
    }

    // ── Capturing from the viewer ────────────────────────────

    captureViewerSettings(viewer) {
        const v = this.viewerSettings;
        v.pointBudget = viewer.getPointBudget();
        v.fov = viewer.getFOV();
        v.background = viewer.getBackground();
        v.edl = {
            ...v.edl,
            enabled: viewer.getEDLEnabled(),
            radius: roundTo(viewer.getEDLRadius(), 2),
            strength: roundTo(viewer.getEDLStrength(), 2),
            opacity: roundTo(viewer.getEDLOpacity(), 2),
        };
        v.hqSplats = !!viewer.useHQ;
        v.clipTask = viewer.getClipTask();
        const repeat = Object.keys(Potree.ElevationGradientRepeat)
            .find(k => Potree.ElevationGradientRepeat[k] === viewer.elevationGradientRepeat);
        if (repeat) v.gradientRepeat = repeat.toLowerCase();
    }

    captureCamera(viewer) {
        const view = viewer.scene.view;
        this.camera = {
            position: roundTo(view.position.toArray(), 3),
            target: roundTo(view.getPivot().toArray(), 3),
        };
    }

    // pc.position - baseOffset, rotation in degrees. An identity transform is left out.
    captureTransform(id, pc = this.loaded.get(id)) {
        const entry = this.pointclouds[id];
        const translation = roundTo(pc.position.clone().sub(SceneConfig.baseOffset(pc)).toArray(), 4);
        const rotation = roundTo([pc.rotation.x, pc.rotation.y, pc.rotation.z].map(r => r * 180 / Math.PI), 4);
        const scale = roundTo(pc.scale.toArray(), 6);

        const t = {};
        if (translation.some(v => v !== 0)) t.translation = translation;
        if (rotation.some(v => v !== 0)) t.rotation = rotation;
        if (scale.some(v => v !== 1)) t.scale = scale;

        if (Object.keys(t).length) entry.transform = t;
        else delete entry.transform;
    }

    // The reverse of applyMaterial. Values still at Potree's default are left out. Opacity is recorded
    // too, always, but on the entry beside `visible` rather than in `material`.
    captureMaterial(id, pc = this.loaded.get(id)) {
        const mat = pc.material;
        const def = SceneConfig.defaultMaterial();
        const enumName = (e, v) => Object.keys(e).find(k => e[k] === v)?.toLowerCase();

        const m = {
            attribute: mat.activeAttributeName,
            shape: enumName(Potree.PointShape, mat.shape),
            sizeType: enumName(Potree.PointSizeType, mat.pointSizeType),
            minSize: mat.minSize,
        };
        if (mat.size !== def.size) m.size = roundTo(mat.size, 3);

        // Composite mixes attributes by these weights, all six kept when any is changed.
        // brush_selection.js sets them as one-element arrays, hence Number().
        const weight = key => Number(mat[SceneConfig.WEIGHTS[key]]);
        const weightKeys = Object.keys(SceneConfig.WEIGHTS);
        if (weightKeys.some(k => weight(k) !== def[SceneConfig.WEIGHTS[k]])) {
            m.weights = Object.fromEntries(weightKeys.map(k => [k, roundTo(weight(k), 3)]));
        }

        // Potree fits an unset intensity range to the data (updateMaterialDefaults), so only a range that
        // differs from the data's is kept. The elevation range is always set at load, so it's only kept
        // when it's what is shown (on its own or mixed into composite).
        const ranges = {};
        const intensity = mat.intensityRange;
        const dataIntensity = pc.getAttribute?.("intensity")?.range;
        const autoIntensity = !isFinite(intensity[0]) ||
            (dataIntensity && intensity[0] === dataIntensity[0] && intensity[1] === dataIntensity[1]);
        if (!autoIntensity) ranges.intensity = roundTo([...intensity], 3);
        const showsElevation = mat.activeAttributeName === "elevation" ||
            (mat.activeAttributeName === "composite" && weight("elevation") > 0);
        if (showsElevation) ranges.elevation = roundTo([...mat.elevationRange], 3);

        // Other attributes' ranges (the Extra Attribute slider) are only set from the UI; the shader
        // falls back to the data's range, so one that matches it is left out.
        for (const [name, range] of mat.ranges) {
            if (name === "intensity" || name === "elevation" || typeof range?.[0] !== "number") continue;
            const data = pc.getAttribute?.(name)?.range;
            if (data && range[0] === data[0] && range[1] === data[1]) continue;
            ranges[name] = roundTo([...range], 3);
        }
        if (Object.keys(ranges).length) m.ranges = ranges;

        if (mat.gradient !== def.gradient) {
            const named = Object.keys(Potree.Gradients).find(k => Potree.Gradients[k] === mat.gradient);
            m.gradient = named || mat.gradient.map(([t, c]) => [t, roundTo(c.toArray(), 4)]);
        }
        if (!mat.color.equals(def.color)) m.color = roundTo(mat.color.toArray(), 4);
        if (mat.matcap !== def.matcap) m.matcap = mat.matcap;
        if (mat.backfaceCulling !== def.backfaceCulling) m.backfaceCulling = mat.backfaceCulling;

        // Gamma, brightness and contrast of rgb, intensity and extra attributes; all three when any is changed.
        for (const group of SceneConfig.GBC_GROUPS) {
            const parts = ["gamma", "brightness", "contrast"];
            if (parts.every(p => mat[gbcProperty(group, p)] === def[gbcProperty(group, p)])) continue;
            m[group] = Object.fromEntries(parts.map(p => [p, roundTo(mat[gbcProperty(group, p)], 3)]));
        }

        this.pointclouds[id].material = m;
        this.pointclouds[id].opacity = roundTo(mat.opacity, 3);
    }

    static defaultMaterial() {
        return SceneConfig._defaultMaterial || (SceneConfig._defaultMaterial = new Potree.PointCloudMaterial());
    }

    // ── Custom script ────────────────────────────────────────

    // Runs the script (or `code`) as the body of an async function, so it can `await`, and it sees the
    // page's globals (viewer, Potree, THREE, zones, sceneConfig). What it throws is logged and kept in
    // scriptError rather than passed on, so a broken script doesn't stop the scene loading.
    async runScript(code = this.script) {
        this.scriptError = null;
        if (!code.trim()) return;
        try {
            const AsyncFunction = (async () => {}).constructor;
            // sourceURL names it in the console and the debugger's sources
            await new AsyncFunction(`${code}\n//# sourceURL=sceneConfig.script.js`)();
        } catch (err) {
            this.scriptError = err;
            console.error("[SceneConfig] the scene's script failed:", err);
        }
    }

    // ── Serialising ──────────────────────────────────────────

    // Built from the current values rather than `raw`: the UI edits viewerSettings, camera and so on,
    // which aren't connected to `raw` when the file left them out. Keys this class doesn't know are kept.
    toJSON() {
        const out = {};
        if (this.vtype) out.vtype = this.vtype;
        if (this.doi) out.doi = this.doi;
        if (Object.keys(this.viewerSettings).length) out.viewer = this.viewerSettings;
        if (this.camera) out.camera = this.camera;
        if (Object.keys(this.cesium).length) out.cesium = this.cesium;
        out.startZones = this.startZones;
        out.classificationEdits = this.classificationEdits.filter(Boolean);
        out.pointclouds = this.pointclouds;
        if (this.script.trim()) out.script = this.script;
        for (const [key, value] of Object.entries(this.raw)) {
            if (!SceneConfig.KEYS.includes(key)) out[key] = value;
        }
        return JSON.parse(JSON.stringify(out));
    }
}

SceneConfig.KEYS = ["vtype", "doi", "viewer", "camera", "cesium", "startZones", "classificationEdits", "pointclouds", "script"];

// material.weights key -> PointCloudMaterial property (the composite attribute's weights)
SceneConfig.WEIGHTS = {
    rgb: "weightRGB", intensity: "weightIntensity", elevation: "weightElevation",
    classification: "weightClassification", returnNumber: "weightReturnNumber", sourceID: "weightSourceID",
};
// material keys holding { gamma, brightness, contrast }
SceneConfig.GBC_GROUPS = ["rgb", "intensity", "extra"];

// ("rgb", "gamma") -> "rgbGamma"
function gbcProperty(group, part) {
    return group + part[0].toUpperCase() + part.slice(1);
}

function roundTo(v, digits) {
    const f = 10 ** digits;
    const r = x => Math.round(x * f) / f + 0;   // + 0 turns -0 into 0
    return Array.isArray(v) ? v.map(r) : r(v);
}

function isSceneConfigFile(data) {
    return !!data && !Array.isArray(data) && data.schema === 2 && !!data.sceneConfig;
}

// Startup for a schema-2 zones.json: everything config.js used to do comes from the file.
// `keepCamera`: the camera has been placed already, so it isn't fitted to the clouds.
async function initSceneFromConfig(data, zonesURL, keepCamera = false) {
    const sc = new SceneConfig(data.sceneConfig, zonesURL);
    if (!sc.doi) sc.useCurrentDataset();             // a file that doesn't say belongs to the dataset it came from
    window.sceneConfig = sc;

    // A shared link's camera (?position=&target=) wins over the file's; viewer_state_retainer.js moves to it.
    const params = new URLSearchParams(window.location.search);
    const urlCamera = params.has("position") || params.has("target");

    sc.applyViewerSettings(viewer);
    if (!urlCamera) sc.applyCamera(viewer);

    await sc.loadPointClouds(viewer);
    if (!urlCamera && !keepCamera && !sc.camera && viewer.scene.pointclouds.length) viewer.fitToScreen();

    // Zones match clouds on pc.name, which is the id. Start zones are applied by
    // applyZoneVisibilityFromURL(), after any zone state in the URL.
    const zones = Array.isArray(data.zones) ? data.zones : [];
    if (zones.length) {
        window.zones = zonesFromJSON(zones);
        initZonesOps();
        document.addEventListener("pointermove", onPointerMove, { passive: true });
    } else {
        createZones();
    }
    // The dataset's own zones belong to it; inheritSceneDataset() only fills in zones that don't say.
    if (typeof inheritSceneDataset === "function") inheritSceneDataset();

    // Switching a zone on applies its own background, and every zone has one ("gradient" unless set),
    // so the file's background is re-applied to open the scene as it was captured. A Cesium zone keeps its own.
    const cesium = [...(window.newVisibleZones || [])].some(z => z.background === "cesium");
    if (sc.viewerSettings.background !== undefined && !cesium) viewer.setBackground(sc.viewerSettings.background);

    // a blank entry would resolve to zones.json itself
    for (const url of sc.classificationEdits.filter(Boolean)) importEditsAny(sc.resolveURL(url));
    updateMaterialMenuOnStart();

    // Last, so it finds the clouds and zones in place (edit files may still be loading)
    await sc.runScript();
}

// The sceneConfig of an imported zones.json, merged into the scene's: clouds the scene's config doesn't
// have are added and loaded, and its Cesium basemap settings fill in the ones the scene's leave out;
// everything else in it (and every cloud and setting the scene already has) stays as it is; its script
// isn't run.
// A scene still loaded from config.js is captured first, so its own clouds stay in the config.
// `dataset` ({ vtype, doi }) is where the file came from, for a file that doesn't say; otherwise it is
// taken to be this scene's. Returns the ids added.
async function mergeImportedSceneConfig(json, dataset = null) {
    const baseURL = window.zoneURL || window.location.href;
    const imported = new SceneConfig(json, baseURL);
    if (!imported.doi && dataset) Object.assign(imported, { vtype: dataset.vtype, doi: dataset.doi });
    else if (!imported.doi) imported.useCurrentDataset();

    if (!window.sceneConfig) window.sceneConfig = await SceneConfig.capture(viewer, baseURL);
    const sc = window.sceneConfig;
    const cesiumKeys = Object.keys(imported.cesium).filter(key => sc.cesium[key] === undefined);
    for (const key of cesiumKeys) sc.cesium[key] = imported.cesium[key];
    // a basemap already built keeps its old settings until it's rebuilt
    if (cesiumKeys.length && window.CesiumBasemap) CesiumBasemap.reconfigure();

    const ids = sc.mergePointClouds(imported);
    await sc.loadPointClouds(viewer, ids);
    return ids;
}
