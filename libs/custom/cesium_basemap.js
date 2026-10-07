/**
 * cesium_basemap.js — Cesium basemap behind the point clouds
 *
 * Author: (OpenHeritage3D / CHEI, UC San Diego)
 *
 * Description:
 *   Shows a Cesium globe / Google Photorealistic 3D Tiles behind Potree in
 *   zones whose background is "cesium". Potree's canvas is transparent there
 *   and sits over a Cesium canvas whose camera follows Potree's every frame:
 *   the set-up the ALERTCalifornia atlas does inline, as a module.
 *
 *   The point clouds' projection (a proj4 string) and the basemap's options
 *   come from window.sceneConfig.cesium (Scene Setup ▸ Cesium Basemap).
 *   Cesium itself is loaded from its CDN the first time a cesium background
 *   is switched on, and only renders while one is on.
 *
 * Usage:
 *   setZoneBackground() (zone_creation.js) calls CesiumBasemap.setActive();
 *   the page's render loop calls CesiumBasemap.render() every frame, which
 *   does nothing unless a cesium background is on.
 *
 * Notes:
 *   • Heights: Cesium positions are ellipsoidal, so data in orthometric
 *     heights (e.g. NAVD88) needs `heightOffset` to sit on the 3D Tiles.
 *   • window.toMap / window.toScene / window.cesiumViewer are set for scripts
 *     written against the ALERTCalifornia page (load_sensor_nodes.js etc.).
 */

(function () {
    "use strict";

    const CESIUM_BASE = "https://cesium.com/downloads/cesiumjs/releases/1.138/Build/Cesium/";
    // Already public in build/UCSD_cesium.js; a scene can set its own in sceneConfig.cesium.ionToken.
    const DEFAULT_ION_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI0YjA5NWU1YS00MTE0LTQ5YTctOWFhNy0xN2EwNmU2NzgwZjkiLCJpZCI6NTYzOTUsImlhdCI6MTY0MjQzODc4MH0.3yyDeYbXe0TPJHNobfwSL5WFXhnTLwn9yz6LOu79tBc";

    // What a scene gets for anything sceneConfig.cesium leaves out.
    const DEFAULTS = {
        projection: null,           // proj4 string of the point clouds' coordinate system (required)
        heightOffset: 0,            // metres added to point cloud heights to get Cesium's ellipsoidal ones
        photorealisticTiles: true,  // Google Photorealistic 3D Tiles (they carry their own terrain)
        globe: false,               // Cesium's globe, for imagery and terrain
        imagery: "ion",             // globe imagery: "ion" (Cesium World Imagery), "osm", "none"
        terrain: false,             // Cesium World Terrain on the globe
        skyAtmosphere: true,
        ionToken: null,             // null: the built-in token
    };

    let active = false;
    let cesiumViewer = null;
    let building = null;            // promise while the viewer is being made
    let error = null;               // last load/build failure, for Scene Setup
    let transform = null;           // { projection, toMap, toScene }
    let previewBackground = null;   // background to go back to after a preview
    let listening = false;

    const settings = () => ({ ...DEFAULTS, ...(window.sceneConfig?.cesium || {}) });

    // ── Projection ───────────────────────────────────────────────

    // proj4 transforms for a projection string, or an error. The scene's centre, converted, is a quick
    // check that the string is the right one.
    function describeProjection(projection) {
        if (!projection) return { ok: false, error: "No projection set." };
        try {
            const toMap = proj4(projection, "WGS84");
            const toScene = proj4("WGS84", projection);
            const bb = viewer.getBoundingBox();
            if (!isFinite(bb.min.x)) return { ok: true, toMap, toScene };
            const [lon, lat] = toMap.forward([(bb.min.x + bb.max.x) / 2, (bb.min.y + bb.max.y) / 2]);
            if (!isFinite(lon) || !isFinite(lat) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
                return { ok: false, error: "The scene's coordinates don't convert to a place on Earth with this projection." };
            }
            return { ok: true, toMap, toScene, lon, lat };
        } catch (err) {
            return { ok: false, error: `proj4 can't read it: ${err.message || err}` };
        }
    }

    function updateTransform(projection) {
        if (transform?.projection === projection) return true;
        const d = describeProjection(projection);
        if (!d.ok) { transform = null; return false; }
        transform = { projection, toMap: d.toMap, toScene: d.toScene };
        window.toMap = d.toMap;
        window.toScene = d.toScene;
        return true;
    }

    // ── Loading and building ─────────────────────────────────────

    let loadingCesium = null;
    function loadCesium() {
        if (window.Cesium) return Promise.resolve();
        return loadingCesium || (loadingCesium = new Promise((resolve, reject) => {
            const css = document.createElement("link");
            css.rel = "stylesheet";
            css.href = CESIUM_BASE + "Widgets/widgets.css";
            document.head.appendChild(css);

            const script = document.createElement("script");
            script.src = CESIUM_BASE + "Cesium.js";
            script.onload = () => resolve();
            script.onerror = () => { loadingCesium = null; reject(new Error(`couldn't load ${script.src}`)); };
            document.head.appendChild(script);
        }));
    }

    // Under Potree's canvas: first in the render area, which stacks its children in order.
    function container() {
        let el = document.getElementById("cesiumContainer");
        if (!el) {
            el = document.createElement("div");
            el.id = "cesiumContainer";
            Object.assign(el.style, { position: "absolute", inset: "0", display: "none", pointerEvents: "none", background: "black" });
            const area = document.getElementById("potree_render_area");
            area.insertBefore(el, area.firstChild);
        }
        return el;
    }

    async function build() {
        await loadCesium();
        const s = settings();
        container().style.display = "block";     // Cesium sizes its canvas from the container

        Cesium.Ion.defaultAccessToken = s.ionToken || DEFAULT_ION_TOKEN;
        const options = {
            useDefaultRenderLoop: false,          // rendered from the page's loop, only while on
            timeline: false,
            animation: false,
            sceneModePicker: false,
            baseLayerPicker: false,
            fullscreenButton: false,
            navigationHelpButton: false,
            homeButton: false,
            infoBox: false,
            selectionIndicator: false,
            // Google's tiles may only be paired with Google's geocoder; it is hidden below.
            geocoder: s.photorealisticTiles ? Cesium.IonGeocodeProviderType.GOOGLE : false,
        };
        if (!s.globe) {
            options.globe = false;
        } else {
            options.baseLayer = s.imagery === "none" ? false
                : s.imagery === "osm" ? new Cesium.ImageryLayer(new Cesium.OpenStreetMapImageryProvider({ url: "https://tile.openstreetmap.org/" }))
                : Cesium.ImageryLayer.fromWorldImagery();
            if (s.terrain) options.terrain = Cesium.Terrain.fromWorldTerrain();
        }

        const cv = new Cesium.Viewer(container(), options);
        if (cv.geocoder) cv.geocoder.container.style.display = "none";
        if (cv.scene.skyAtmosphere) cv.scene.skyAtmosphere.show = s.skyAtmosphere;

        if (s.photorealisticTiles) {
            Cesium.createGooglePhotorealistic3DTileset({ onlyUsingWithGoogleGeocoder: true })
                .then(tileset => { if (!cv.isDestroyed()) cv.scene.primitives.add(tileset); })
                .catch(err => { error = `Photorealistic 3D Tiles didn't load: ${err.message || err}`; console.warn("[CesiumBasemap]", error); });
        }
        cesiumViewer = window.cesiumViewer = cv;
    }

    function destroy() {
        if (cesiumViewer && !cesiumViewer.isDestroyed()) cesiumViewer.destroy();
        cesiumViewer = window.cesiumViewer = null;
        building = null;
    }

    // ── Switching on and off ─────────────────────────────────────

    // On: false when the scene has no usable projection (the caller shows something else instead).
    // The viewer is built in the background the first time.
    function setActive(on) {
        listen();
        if (!on) {
            active = false;
            const el = document.getElementById("cesiumContainer");
            if (el) el.style.display = "none";
            return true;
        }

        const s = settings();
        if (!updateTransform(s.projection)) {
            console.warn("[CesiumBasemap] no usable projection in sceneConfig.cesium; set one in Scene Setup ▸ Cesium Basemap.");
            return false;
        }

        active = true;
        error = null;
        if (cesiumViewer) {
            container().style.display = "block";
        } else if (!building) {
            building = build().catch(err => {
                error = `Cesium couldn't start: ${err.message || err}`;
                console.error("[CesiumBasemap]", err);
                building = null;
                // Nothing to show through: put a background back.
                if (active) { active = false; window.cesiumActive = false; container().style.display = "none"; viewer.setBackground("gradient"); }
            });
        }
        return true;
    }

    // Something else gave Potree a background (a zone, the sidebar): the basemap would be covered anyway.
    function listen() {
        if (listening || !window.viewer) return;
        listening = true;
        viewer.addEventListener("background_changed", () => {
            if (active && viewer.getBackground() !== "") {
                setActive(false);
                window.cesiumActive = false;
                previewBackground = null;
            }
        });
    }

    // Rebuild with the current settings (Scene Setup calls this after a change).
    function reconfigure() {
        destroy();
        transform = null;
        error = null;
        if (active && !setActive(true)) {
            setActive(false);
            window.cesiumActive = false;
            viewer.setBackground(previewBackground || "gradient");
        }
    }

    // Scene Setup's preview: the basemap without a zone asking for it.
    function preview(on) {
        if (on) {
            if (!setActive(true)) return false;
            if (viewer.getBackground() !== "") previewBackground = viewer.getBackground();
            window.cesiumActive = true;
            viewer.setBackground("");
            return true;
        }
        const back = previewBackground || "gradient";
        previewBackground = null;
        setActive(false);
        window.cesiumActive = false;
        viewer.setBackground(back);
        return true;
    }

    // ── Every frame ──────────────────────────────────────────────

    const _pos = new THREE.Vector3(), _up = new THREE.Vector3();
    let cPos, cUp, cTarget, cDir, cUpDir;

    function toCesium(p, out) {
        const [lon, lat] = transform.toMap.forward([p.x, p.y]);
        return Cesium.Cartesian3.fromDegrees(lon, lat, p.z + (settings().heightOffset || 0), undefined, out);
    }

    // Point Cesium's camera where Potree's is: position, look-at point and "up" go through the projection.
    function render() {
        if (!active || !cesiumViewer || !transform) return;
        if (!cPos) {
            cPos = new Cesium.Cartesian3(); cUp = new Cesium.Cartesian3(); cTarget = new Cesium.Cartesian3();
            cDir = new Cesium.Cartesian3(); cUpDir = new Cesium.Cartesian3();
        }
        const camera = viewer.scene.getActiveCamera();
        _pos.set(0, 0, 0).applyMatrix4(camera.matrixWorld);
        _up.set(0, 600, 0).applyMatrix4(camera.matrixWorld);

        toCesium(_pos, cPos);
        toCesium(_up, cUp);
        toCesium(viewer.scene.view.getPivot(), cTarget);
        Cesium.Cartesian3.normalize(Cesium.Cartesian3.subtract(cTarget, cPos, cDir), cDir);
        Cesium.Cartesian3.normalize(Cesium.Cartesian3.subtract(cUp, cPos, cUpDir), cUpDir);
        cesiumViewer.camera.setView({ destination: cPos, orientation: { direction: cDir, up: cUpDir } });

        // Cesium's fov is the wider of the two; Potree's is vertical.
        const fovy = Math.PI * (camera.fov / 180);
        cesiumViewer.camera.frustum.fov = camera.aspect < 1 ? fovy : Math.atan(Math.tan(0.5 * fovy) * camera.aspect) * 2;

        cesiumViewer.resize();
        cesiumViewer.render();
    }

    window.CesiumBasemap = {
        DEFAULTS,
        setActive,
        render,
        reconfigure,
        preview,
        describeProjection,
        get active() { return active; },
        get previewing() { return active && previewBackground !== null; },
        get error() { return error; },
    };
})();
