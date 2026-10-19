/**
 * default_zone.js — scenes for datasets that don't describe their own
 *
 * index.html loads a dataset one of three ways:
 *   • schema-2 zones.json: the file describes the whole scene (scene_config.js).
 *   • config.js: it adds the clouds; zones come from an old-style zones.json, or
 *     one default zone per cloud (initZones).
 *   • neither, or a config.js that sets window.loadDefaultConfigFirst: every
 *     cloud in the dataset's potree/ folder goes into a sceneConfig, set up as a
 *     schema-2 file would be, with the zones of an old-style zones.json or one
 *     default zone per cloud (initDefaultScene).
 */

// Lists the clouds in a dataset folder; directory listings are off on the server. Next to index.html.
const POTREE_CLOUDS_API = "api/potree_clouds.php";

function waitForPointCloudsLoaded() {
    return new Promise(resolve => {
        function check() {
            const pcs = viewer.scene.pointclouds;

            // Must exist first
            if (pcs.length === 0) {
                return requestAnimationFrame(check);
            }

            // Potree point clouds are considered "loaded" when metadata + root node exist
            const ready = pcs.every(pc =>
                pc.boundingBox &&
                pc.root !== null && pc.root !== undefined
            );

            if (!ready) {
                return requestAnimationFrame(check);
            }

            resolve();
        }

        check();
    });
}


// One zone per cloud in the scene, named after it.
function createZones(){
    for(let pc of viewer.scene.pointclouds){
        const zone = new Zone(pc.name, null, 1, [pc], [], []);
        window.zones.push(zone);
    }
    updateZoneList();
    updateZoneCount();
    enableFirstZone();
    // One-time startup restore: zone visibility from the URL, or inferred
    // from the default pointcloud visibility (viewer_state_retainer.js).
    if (typeof applyZoneVisibilityFromURL === "function") applyZoneVisibilityFromURL();
}

// Zones for a scene config.js has loaded the clouds of.
async function initZones() {
    await waitForPointCloudsLoaded();

    // A config.js that adds no clouds leaves the wait above to end when an import brings some in, and
    // that import has added its zones by then. zones.json would replace them, and the default zones
    // (one per cloud, priority 1, named after it) would be top-level copies of the imported ones.
    const loaded = window.zones.length > 0 || await autoLoadZonesJSON(window.zoneURL);
    importEditsAny(window.classificationURL);
    updateMaterialMenuOnStart();
    console.log("zones loaded?", loaded);

    if (!loaded) {
        createZones();
    }
}

// The clouds in a dataset folder as URLs relative to it ("<folder>/metadata.json"), or null when the
// server couldn't list it.
async function listDatasetClouds(dataDir) {
    const dir = decodeURIComponent(new URL(dataDir, window.location.href).pathname);
    try {
        const res = await fetch(`${POTREE_CLOUDS_API}?dir=${encodeURIComponent(dir)}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()).clouds;
    } catch (err) {
        console.error(`Couldn't list the point clouds in ${dataDir}:`, err);
        return null;
    }
}

// The scene of a dataset without config.js: every cloud in its potree/ folder, with the zones of an
// old-style zones.json (`zonesData`) or else one default zone per cloud. `keepCamera`: a config.js
// that asked for this (loadDefaultConfigFirst) has already placed the camera.
async function initDefaultScene(zonesData = null, keepCamera = false) {
    const dataDir = new URL(".", new URL(window.zoneURL, window.location.href)).href;
    const [urls, hasEdits] = await Promise.all([
        listDatasetClouds(dataDir),
        fetch(window.classificationURL, { method: "HEAD", cache: "no-store" }).then(r => r.ok, () => false),
    ]);

    // A cloud's id is its folder, as default_config.js named them, so old zones.json files still find
    // them. Nested ones keep the whole path: several end in .../potree/metadata.json.
    const pointclouds = {};
    for (const url of urls || []) {
        pointclouds[url.replace(/\/metadata\.json$/, "")] = { url, material: { shape: "circle", sizeType: "adaptive" } };
    }

    let zones = [];
    try {
        if (zonesData) zones = zonesArrayOf(zonesData);
    } catch (err) {
        console.warn("zones.json has no zones; making default ones:", err);
    }

    // classification_edits.gz sits beside zones.json (window.classificationURL), so it is relative to dataDir
    const sceneConfig = { pointclouds, classificationEdits: hasEdits ? ["classification_edits.gz"] : [] };
    await initSceneFromConfig({ schema: 2, sceneConfig, zones }, window.zoneURL, keepCamera);
}
