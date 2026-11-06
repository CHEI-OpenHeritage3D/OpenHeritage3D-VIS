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
 *   • Heights: Cesium positions are ellipsoidal, so clouds in orthometric
 *     heights (above sea level) sit under the 3D Tiles by the local geoid
 *     height (about +45 m in Florence, +47 m in northern Sardinia) and slide
 *     against them as the view moves. `heightOffset` lifts them by that much;
 *     measureHeightOffset() (Scene Setup ▸ Match basemap) finds the value.
 *     The Florence atlas does the same by hand in each cloud's position.
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
        imagery: "Bing Maps Aerial",// globe imagery: a name from Cesium's base layer picker (imageryChoices()), or "none"
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
    let layerPicker = null;         // Cesium's BaseLayerPickerViewModel for the globe (no widget)
    let builtWith = null;           // the settings the viewer was built with
    let imageryError = null;        // why the selected imagery didn't load, for Scene Setup

    const settings = () => ({ ...DEFAULTS, ...(window.sceneConfig?.cesium || {}) });

    // ── Imagery and terrain ──────────────────────────────────────
    // The globe's layers come from the lists Cesium's base layer picker offers. sceneConfig keeps the
    // imagery's name without the soft hyphens and no-break spaces Cesium puts in some for the widget
    // ("Open\u00adStreet\u00adMap"); "ion" and "osm" are what files written before the picker hold.
    const IMAGERY_ALIASES = { ion: "Bing Maps Aerial", osm: "OpenStreetMap" };
    const plainName = name => name.replace(/\u00ad/g, "").replace(/\u00a0/g, " ");
    const imageryName = value => IMAGERY_ALIASES[value] ?? value;

    // [{ name, category, tooltip }] in Cesium's order, or null until Cesium is loaded (load()).
    let imageryList = null;
    function imageryChoices() {
        if (!window.Cesium) return null;
        return imageryList || (imageryList = Cesium.createDefaultImageryProviderViewModels()
            .map(vm => ({ name: plainName(vm.name), category: vm.category, tooltip: vm.tooltip })));
    }

    // Selecting on the view model swaps the globe's base layer in place, as the widget does.
    function applyLayers(s) {
        const name = imageryName(s.imagery);
        let imagery;
        if (name === "wmts") {
            if (!wmtsProblem(s.wmts)) imagery = wmtsViewModel(s.wmts);
        } else if (name !== "none") {
            const all = layerPicker.imageryProviderViewModels;
            imagery = all.find(vm => plainName(vm.name) === name);
            if (!imagery) {
                console.warn(`[CesiumBasemap] Cesium ${Cesium.VERSION} has no imagery called "${s.imagery}"; showing ${all[0].name}.`);
                imagery = all[0];
            }
        }
        if (imagery !== layerPicker.selectedImagery) imageryError = null;
        layerPicker.selectedImagery = imagery;
        const terrain = s.terrain ? "Cesium World Terrain" : "WGS84 Ellipsoid";
        layerPicker.selectedTerrain = layerPicker.terrainProviderViewModels.find(vm => vm.name === terrain);
    }

    // Not every choice loads everywhere: ion assets need to be in the Ion token's account (Blue Marble,
    // Earth at night and Azure Maps aren't in the built-in one's), and Stadia's tile server refuses
    // sites other than localhost that aren't registered with it. The first failure of the selected
    // imagery is kept for Scene Setup, which redraws on "cesium-basemap-changed".
    function watchImagery(cv) {
        cv.imageryLayers.layerAdded.addEventListener(layer => {
            const shallowFailures = new Set();     // WMTS levels near the top that failed
            const fail = text => {
                if (imageryError || !cv.imageryLayers.contains(layer)) return;
                imageryError = `${plainName(layer.name)} didn't load: ${text}`;
                document.dispatchEvent(new CustomEvent("cesium-basemap-changed"));
            };
            layer.errorEvent.addEventListener(err => fail(err?.statusCode === 404
                ? "the Ion token's account doesn't have it (HTTP 404). Add it from Cesium ion's Asset Depot, or set an Ion token that has it."
                : `${err?.message || err}`));
            // Tiles past a server's deepest level fail too; only a refusal means the imagery can't show.
            // A WMTS set up wrong fails from its first levels on; one missing level can just be a gap
            // in the service (basemap.at has no level 0), two can't.
            layer.readyEvent.addEventListener(provider => provider.errorEvent.addEventListener(e => {
                const status = e.error?.statusCode;
                if (status === 401 || status === 403) fail(`its tile server refused this site (HTTP ${status}).`);
                else if (layer.name === WMTS_NAME && e.level <= provider.minimumLevel + 2 && shallowFailures.add(e.level).size >= 2) {
                    // a date outside a layer's range fails the same way (NASA's GIBS answers 404)
                    const dims = Object.entries(settings().wmts?.dimensions || {}).map(([k, v]) => `${k}=${v}`);
                    fail(status ? `its first tiles fail (HTTP ${status}). Check the layer, style, format and tile matrix set against the service's capabilities` +
                        (dims.length ? `, and that it has imagery for ${dims.join(", ")}.` : ".")
                        : "its tiles can't be fetched: the server is unreachable, or doesn't let other sites load them (CORS).");
                }
            }));
        });
    }

    // ── Web Map Tile Service ─────────────────────────────────────
    // imagery "wmts" shows any WMTS layer, set up by sceneConfig.cesium.wmts in the terms of Cesium's
    // WebMapTileServiceImageryProvider: url, layer, style, tileMatrixSetID (required), format,
    // tileMatrixLabels, dimensions, tilingScheme ("webmercator" | "geographic"), rectangle ([w, s, e, n]
    // degrees), tileWidth, tileHeight, minimumLevel, maximumLevel, subdomains and credit; `capabilities`
    // is where Scene Setup read it from. The provider's clock/times (imagery that changes as Cesium's
    // clock runs) go unused, as the basemap's clock stands still: a date goes in `dimensions` instead.
    const WMTS_NAME = "Web Map Tile Service (WMTS)";
    const WMTS_REQUIRED = { url: "a tile URL", layer: "a layer", style: "a style", tileMatrixSetID: "a tile matrix set" };

    // What the WMTS settings lack for Cesium to request tiles, or null.
    function wmtsProblem(w) {
        const missing = Object.keys(WMTS_REQUIRED).filter(k => !w?.[k]).map(k => WMTS_REQUIRED[k]);
        return missing.length ? `The WMTS needs ${missing.join(", ").replace(/, ([^,]*)$/, " and $1")}.` : null;
    }

    function wmtsOptions(w) {
        const o = { ...w };
        delete o.capabilities;
        o.tilingScheme = w.tilingScheme === "geographic" ? new Cesium.GeographicTilingScheme() : new Cesium.WebMercatorTilingScheme();
        // Cesium can't place tiles outside its tiling (Web Mercator stops at ±85.05°)
        if (w.rectangle) o.rectangle = Cesium.Rectangle.intersection(Cesium.Rectangle.fromDegrees(...w.rectangle), o.tilingScheme.rectangle);
        return o;
    }

    // A view model like the picker's own, made again whenever the settings change so that selecting
    // it makes a new layer.
    let wmtsVM = null;
    function wmtsViewModel(w) {
        const key = JSON.stringify(w);
        if (wmtsVM?.key !== key) {
            wmtsVM = new Cesium.ProviderViewModel({
                name: WMTS_NAME, tooltip: w.layer, iconUrl: "", category: "Custom",
                creationFunction: () => new Cesium.WebMapTileServiceImageryProvider(wmtsOptions(w)),
            });
            wmtsVM.key = key;
        }
        return wmtsVM;
    }

    // ── WMTS capabilities ────────────────────────────────────────
    // Cesium doesn't read a WMTS's GetCapabilities document, so this does: its layers, and how each
    // tile matrix set lines up with Cesium's tiling, which is where hand-written WMTS settings go wrong.

    const kids = (el, name) => el ? [...el.children].filter(c => c.localName === name) : [];
    const kid = (el, name) => kids(el, name)[0];
    const text = (el, name) => kid(el, name)?.textContent.trim();
    const escapeHtml = t => t.replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);

    async function fetchXml(url) {
        let res;
        try { res = await fetch(url); }
        catch (_) { throw new Error("Couldn't fetch it: the server is unreachable, or doesn't let other sites read it (CORS)."); }
        if (!res.ok) throw new Error(`The server answered HTTP ${res.status}.`);
        const doc = new DOMParser().parseFromString(await res.text(), "application/xml");
        if (doc.documentElement.localName !== "Capabilities") throw new Error("That isn't a WMTS capabilities document.");
        return doc;
    }

    // { url, title, provider, kvpUrl, layers: [{ id, title, styles, formats, sets, templates, dimensions,
    // bbox }], matrixSets: { id: matrixSetFit() } }. `url` may also be the service's KVP endpoint.
    async function readWmtsCapabilities(url) {
        let doc;
        try {
            doc = await fetchXml(url);
        } catch (err) {
            if (/[?&]request=/i.test(url)) throw err;
            url += (url.includes("?") ? "&" : "?") + "SERVICE=WMTS&REQUEST=GetCapabilities";
            doc = await fetchXml(url).catch(() => { throw err; });
        }
        const root = doc.documentElement;
        const contents = kid(root, "Contents");

        // GetTile's KVP endpoint, for layers without a tile URL template
        const getTile = kids(kid(root, "OperationsMetadata"), "Operation").find(op => op.getAttribute("name") === "GetTile");
        const gets = getTile ? [...getTile.getElementsByTagNameNS("*", "Get")] : [];
        const kvp = gets.find(g => /KVP/i.test(g.textContent)) || gets.find(g => !/RESTful/i.test(g.textContent));
        const kvpUrl = kvp && (kvp.getAttributeNS("http://www.w3.org/1999/xlink", "href") || kvp.getAttribute("xlink:href"));

        const matrixSets = {};
        for (const tms of kids(contents, "TileMatrixSet")) matrixSets[text(tms, "Identifier")] = matrixSetFit(tms);

        const layers = kids(contents, "Layer").map(l => {
            const box = kid(l, "WGS84BoundingBox");
            const lower = text(box, "LowerCorner")?.split(/\s+/).map(Number);
            const upper = text(box, "UpperCorner")?.split(/\s+/).map(Number);
            return {
                id: text(l, "Identifier"),
                title: text(l, "Title") || text(l, "Identifier"),
                styles: kids(l, "Style").map(s => ({ id: text(s, "Identifier"), isDefault: s.getAttribute("isDefault") === "true" })),
                formats: kids(l, "Format").map(f => f.textContent.trim()),
                sets: kids(l, "TileMatrixSetLink").map(k => text(k, "TileMatrixSet")),
                // tile URL templates that name a tile by matrix, row and column
                templates: kids(l, "ResourceURL")
                    .filter(r => (r.getAttribute("resourceType") || "tile") === "tile" && /\{TileMatrix\}.*\{TileRow\}.*\{TileCol\}|\{TileMatrix\}.*\{TileCol\}.*\{TileRow\}/.test(r.getAttribute("template")))
                    .map(r => ({ format: r.getAttribute("format"), template: r.getAttribute("template") })),
                dimensions: kids(l, "Dimension").map(d => ({ id: text(d, "Identifier"), default: text(d, "Default"), values: kids(d, "Value").map(v => v.textContent.trim()) })),
                bbox: lower?.length === 2 && upper?.length === 2 ? [lower[0], lower[1], upper[0], upper[1]] : null,
            };
        });
        const service = kid(root, "ServiceIdentification");
        return { url, title: text(service, "Title"), provider: text(kid(root, "ServiceProvider"), "ProviderName"), kvpUrl, layers, matrixSets };
    }

    // Cesium's level n is 2^n × 2^n tiles over the Web Mercator square, or 2^(n+1) × 2^n tiles of
    // 180 / 2^n degrees over longitude/latitude. A set fits if each of its matrices is one of those
    // levels: tile size from the scale (0.28 mm pixels), starting at the scheme's top-left corner.
    // Gives { ok, why, tilingScheme, labels, minimumLevel, maximumLevel, tileWidth, tileHeight }.
    const MERCATOR_HALF = Math.PI * 6378137;                // 20037508.34 m
    const MERCATOR_MAX_LAT = 85.0511287798;
    const METRES_PER_DEGREE = 2 * Math.PI * 6378137 / 360;  // WMTS's for EPSG:4326
    function matrixSetFit(tms) {
        const crs = text(tms, "SupportedCRS") || "";
        const geographic = /4326|CRS84/i.test(crs);
        if (!geographic && !/3857|900913|3785|102100|102113/.test(crs)) {
            return { ok: false, why: `its CRS (${crs}) is neither Web Mercator nor longitude/latitude, the two Cesium tiles in` };
        }
        const matrices = kids(tms, "TileMatrix").map(m => ({
            id: text(m, "Identifier"), scale: Number(text(m, "ScaleDenominator")),
            corner: (text(m, "TopLeftCorner") || "").split(/\s+/).map(Number),
            width: Number(text(m, "TileWidth")), height: Number(text(m, "TileHeight")),
        }));
        const fit = { ok: true, why: null, tilingScheme: geographic ? "geographic" : "webmercator", labels: [],
            tileWidth: matrices[0]?.width || 256, tileHeight: matrices[0]?.height || 256 };
        const near = (a, b) => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(b));
        for (const m of matrices) {
            const span = m.scale * 0.00028 * m.width / (geographic ? METRES_PER_DEGREE : 1);
            const level = Math.log2((geographic ? 180 : 2 * MERCATOR_HALF) / span);
            if (level < -0.01) continue;    // coarser than Cesium's level 0, which it never asks for
            const [x, y] = m.corner;
            const corner = geographic ? (near(x, -180) && near(y, 90)) || (near(x, 90) && near(y, -180))
                : near(x, -MERCATOR_HALF) && near(y, MERCATOR_HALF);
            if (Math.abs(level - Math.round(level)) > 0.01 || !corner || m.width !== fit.tileWidth || m.height !== fit.tileHeight) {
                return { ok: false, why: `its matrix "${m.id}" doesn't match a level of Cesium's ${geographic ? "geographic" : "Web Mercator"} tiling` };
            }
            fit.labels[Math.round(level)] = m.id;
        }
        const levels = Object.keys(fit.labels).map(Number);
        if (!levels.length) return { ok: false, why: "it has no tile matrices" };
        fit.minimumLevel = levels[0];
        fit.maximumLevel = levels[levels.length - 1];
        if (levels.length !== fit.maximumLevel - fit.minimumLevel + 1) return { ok: false, why: "it skips levels" };
        return fit;
    }

    // sceneConfig.cesium.wmts for one layer of read capabilities, and warnings. `picks` chooses the
    // style, format and tile matrix set, else the layer's default style, its first format with a tile
    // URL template, and its first set that fits Cesium's tiling.
    function wmtsFromCapabilities(caps, layerId, picks = {}) {
        const layer = caps.layers.find(l => l.id === layerId);
        const warnings = [];
        const style = picks.style ?? (layer.styles.find(s => s.isDefault) || layer.styles[0])?.id ?? "default";
        const format = picks.format ?? layer.templates[0]?.format ?? layer.formats[0] ?? "image/jpeg";
        const url = layer.templates.find(t => t.format === format)?.template ?? caps.kvpUrl;
        if (!url) warnings.push(`The capabilities give no tile URL for ${format}.`);
        const set = picks.set ?? layer.sets.find(id => caps.matrixSets[id]?.ok) ?? layer.sets[0];
        const fit = caps.matrixSets[set];
        if (!fit) warnings.push(`The capabilities don't describe tile matrix set "${set}".`);
        else if (!fit.ok) warnings.push(`Tile matrix set "${set}" won't line up in Cesium: ${fit.why}.`);

        const w = { capabilities: caps.url, url, layer: layer.id, style, format, tileMatrixSetID: set };
        if (fit?.ok) {
            // labels only when they aren't just the level numbers
            if (fit.labels.some((label, level) => label !== String(level))) w.tileMatrixLabels = fit.labels;
            if (fit.minimumLevel > 0) w.minimumLevel = fit.minimumLevel;
            w.maximumLevel = fit.maximumLevel;
            if (fit.tilingScheme === "geographic") w.tilingScheme = "geographic";
            if (fit.tileWidth !== 256) w.tileWidth = fit.tileWidth;
            if (fit.tileHeight !== 256) w.tileHeight = fit.tileHeight;
        }
        if (layer.bbox) {
            const maxLat = fit?.tilingScheme === "geographic" ? 90 : MERCATOR_MAX_LAT;
            const [west, south, east, north] = layer.bbox;
            const r = [Math.max(west, -180), Math.max(south, -maxLat), Math.min(east, 180), Math.min(north, maxLat)];
            if (!(r[0] <= -179.9 && r[2] >= 179.9 && r[1] <= 0.1 - maxLat && r[3] >= maxLat - 0.1)) w.rectangle = r;
        }
        const dimensions = {};
        for (const d of layer.dimensions) {
            const value = d.default ?? (d.values.length === 1 && !d.values[0].includes("/") ? d.values[0] : undefined);
            if (value !== undefined) dimensions[d.id] = value;
        }
        if (Object.keys(dimensions).length) w.dimensions = dimensions;
        const credit = caps.provider || caps.title;
        if (credit) w.credit = escapeHtml(credit);
        return { wmts: w, warnings };
    }

    // The backgrounds Potree paints; anything else ("none", "cesium", "") leaves its canvas see-through.
    const PAINTED = ["skybox", "gradient", "black", "white"];

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
        if (!s.globe) options.globe = false;
        else options.baseLayer = false;           // applyLayers() adds it

        const cv = new Cesium.Viewer(container(), options);
        if (cv.geocoder) cv.geocoder.container.style.display = "none";
        if (cv.scene.skyAtmosphere) cv.scene.skyAtmosphere.show = s.skyAtmosphere;
        if (s.globe) {
            // Made without imagery so it selects none of its own; applyLayers() picks the scene's.
            layerPicker = new Cesium.BaseLayerPickerViewModel({
                globe: cv.scene.globe,
                terrainProviderViewModels: Cesium.createDefaultTerrainProviderViewModels(),
            });
            layerPicker.imageryProviderViewModels = Cesium.createDefaultImageryProviderViewModels();
            watchImagery(cv);
            applyLayers(s);
        }
        builtWith = s;

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
        layerPicker = builtWith = imageryError = null;
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
            if (active && PAINTED.includes(viewer.getBackground())) {
                setActive(false);
                window.cesiumActive = false;
                previewBackground = null;
            }
        });
    }

    // Settings a built viewer takes without a rebuild (the height offset is read every frame).
    const LIVE = ["imagery", "terrain", "heightOffset", "wmts"];

    // Rebuild with the current settings (Scene Setup calls this after a change). A zone on screen that
    // asks for the basemap gets it back once the settings work again, e.g. after a projection is fixed.
    // Imagery and terrain changes are swapped on the globe instead.
    function reconfigure() {
        const s = settings();
        if (layerPicker && Object.keys(s).every(k => LIVE.includes(k) || s[k] === builtWith[k])) {
            applyLayers(s);
            builtWith = s;
            return;
        }
        const wanted = active || [...(window.newVisibleZones || [])].some(z => z.background === "cesium");
        destroy();
        transform = null;
        error = null;
        if (!wanted) return;
        if (setActive(true)) {
            window.cesiumActive = true;
            viewer.setBackground("none");
        } else {
            setActive(false);
            window.cesiumActive = false;
            viewer.setBackground(previewBackground || "gradient");
        }
    }

    // Scene Setup's preview: the basemap without a zone asking for it.
    function preview(on) {
        if (on) {
            if (!setActive(true)) return false;
            if (PAINTED.includes(viewer.getBackground())) previewBackground = viewer.getBackground();
            window.cesiumActive = true;
            viewer.setBackground("none");
            return true;
        }
        const back = previewBackground || "gradient";
        previewBackground = null;
        setActive(false);
        window.cesiumActive = false;
        viewer.setBackground(back);
        return true;
    }

    // ── Height offset ────────────────────────────────────────────

    // World positions of up to `max` cloud points Potree is drawing in the middle of the view, where
    // the basemap is loaded in most detail.
    function visibleCloudPoints(max) {
        const camera = viewer.scene.getActiveCamera();
        const nodes = viewer.scene.pointclouds.filter(pc => pc.visible).flatMap(pc => pc.visibleNodes || []);
        const perNode = Math.max(1, Math.ceil(max / Math.max(1, nodes.length)));
        const out = [];
        for (const node of nodes) {
            const pos = node.geometryNode?.geometry?.attributes?.position?.array;
            if (!pos) continue;
            const step = Math.max(1, Math.floor(pos.length / 3 / perNode)) * 3;
            for (let i = 0; i < pos.length && out.length < max; i += step) {
                const p = new THREE.Vector3(pos[i], pos[i + 1], pos[i + 2]).applyMatrix4(node.sceneNode.matrixWorld);
                const ndc = p.clone().project(camera);
                if (Math.abs(ndc.x) <= 0.8 && Math.abs(ndc.y) <= 0.8 && ndc.z <= 1) out.push(p);
            }
        }
        return out;
    }

    // The heightOffset that puts the clouds on the basemap, from the gaps between the basemap's surface
    // (3D Tiles, or the globe's terrain) and the cloud points in view. Where both show bare ground or
    // water the gaps agree; trees and buildings on one side only (often, with historic clouds) scatter
    // them. So the result is the middle of the 4 m band holding the most gaps, and `agreeing` is the
    // share of points in that band.
    async function measureHeightOffset() {
        if (!active || !cesiumViewer) throw new Error("Show the basemap first (Preview, or a zone with a Cesium background).");
        const s = settings();
        const points = visibleCloudPoints(600);
        if (points.length < 10) throw new Error("Not enough of the point clouds is in view.");
        const places = points.map(p => {
            const [lon, lat] = transform.toMap.forward([p.x, p.y]);
            return Cesium.Cartographic.fromDegrees(lon, lat);
        });

        let surface;
        if (s.photorealisticTiles && cesiumViewer.scene.primitives.length) {
            surface = await cesiumViewer.scene.sampleHeightMostDetailed(places);
        } else if (s.globe && s.terrain) {
            surface = await Cesium.sampleTerrainMostDetailed(cesiumViewer.terrainProvider, places);
        } else {
            throw new Error("Nothing to measure against: needs the 3D Tiles, or the globe with terrain.");
        }

        const gaps = surface.map((c, i) => c?.height === undefined ? NaN : c.height - points[i].z).filter(isFinite).sort((a, b) => a - b);
        if (gaps.length < 10) throw new Error("The basemap hasn't loaded under the clouds yet. Try again in a moment.");
        const BAND = 4;
        let count = 0, start = 0;
        for (let i = 0, j = 0; i < gaps.length; i++) {
            while (gaps[i] - gaps[j] > BAND) j++;
            if (i - j + 1 > count) { count = i - j + 1; start = j; }
        }
        const offset = gaps[start + (count >> 1)];
        return { offset: Math.round(offset * 10) / 10, samples: gaps.length, agreeing: Math.round(100 * count / gaps.length) };
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
        measureHeightOffset,
        imageryChoices,
        imageryName,
        WMTS_NAME,
        wmtsProblem,
        readWmtsCapabilities,
        wmtsFromCapabilities,
        load: loadCesium,
        get active() { return active; },
        get previewing() { return active && previewBackground !== null; },
        get error() { return error; },
        get imageryError() { return imageryError; },
    };
})();
