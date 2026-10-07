/**
 * basic data structure:
 * There is a zone which has the following properties:
 * 1. Name of zone, e.g. hall of the 500. This is generally the name of the particular section, room or area
 * 2. Bounding box(es) of the zone which will trigger/hide the zone upon collision with camera.
 * 3. List of pointclouds which will be shown/hidden upon entering/leaving the bounding box.
 * 4. List of annotations which would include points of interest inside each zone, such as particular paintings.
 *      - This is a regular potree annotation which will have its posistion and the camera position with some other data eventually
 * 
 * Basic functions:
 * 1. Zone changing based on camera collision.
 * 2. Searching for annotations inside rooms. 
 *      - For instance if you search for a painting and then click on it, it should take you to that place and the zone will chnage automatically due to camera collision.
 * 
 * Zone creation:
 * There should be a UI for all of this so the user should be able to create a 'zone' and define the name, choose pointclouds, create bounding boxes etc and be able to define annotations.
 * All of this should be stored in a json which could be loaded dynamically or on command.
 */

window.zones = [];
window.annotationsTemp = [];


// Zone class (structure for each zone)
class Zone {
    constructor(name, parent, priority, pointclouds = [], boundingBoxes = [], annotations = [], layerMaps = [], marker360s = [], beacon, description, background, isDefault = false, orientedImagesHandlers = [], doi = null, vtype = null) {
        this.name = name;                    // name of the zone
        this.pointclouds = pointclouds;      // list of pointcloud IDs/names
        this.boundingBoxes = boundingBoxes;  // list of bounding box objects
        this.annotations = annotations;      // list of annotation IDs or data
        this.priority = priority;
        this.layerMaps = layerMaps;
        this.marker360s = marker360s;
        this.parent = parent;
        this.beacon = beacon;
        this.description = description;
        this.background = background;
        this.isDefault = isDefault;
        this.orientedImagesHandlers = orientedImagesHandlers; // list of orientedImagesHandler
        this.doi = doi;                      // dataset the zone was imported from (DOI + archive vtype),
        this.vtype = vtype;                  // null for the scene's own zones
    }
}

class orientedImagesHandler {
    constructor(cameraParamsPath, imageParamsPath, name){
        this.cameraParamsPath = cameraParamsPath;
        this.imageParamsPath = imageParamsPath;
        this.name = name || "";
        // Hidden until the owning zone switches on (resetZoneOrientedImages)
        // or the set's checkbox enables it.
        this._hidden = true;

        Potree.OrientedImageLoader.load(cameraParamsPath, imageParamsPath, viewer).then( images => {
            this.images = images;
            // Loading is async: the set's visibility may have been decided
            // while the images were still in flight, and freshly loaded meshes
            // are pickable by the loader's own raycaster even when they are
            // not in the scene. Apply the current state so a hidden set is
            // neither drawn nor pickable.
            setZoneOrientedImagesVisibility(images, !this._hidden);
            // The zone search panel may already have been (re)built before this
            // load finished — e.g. right after saving the zone form, which
            // rebuilds the panel synchronously — and it only lists sets whose
            // images are already loaded. Refresh it so the new set shows up
            // without the user having to close/reopen the panel manually.
            if (typeof _refreshZoneSearchPanel === "function") _refreshZoneSearchPanel();
	    });
    }
}

// Rebuild a zone's oriented-image handlers from imported JSON. Accepts the
// current array form (orientedImagesHandlers) and the legacy single-object
// form (orientedImagesHandler) so old zones.json files keep working.
function buildOrientedImagesHandlers(z) {
    const defs = Array.isArray(z.orientedImagesHandlers)
        ? z.orientedImagesHandlers
        : (z.orientedImagesHandler ? [z.orientedImagesHandler] : []);

    const handlers = [];
    for (const def of defs) {
        if (!def || !def.cameraParamsPath || !def.imageParamsPath) continue;
        try { handlers.push(new orientedImagesHandler(def.cameraParamsPath, def.imageParamsPath, def.name)); }
        catch (e) { console.warn("orientedImagesHandler failed to load on import:", e); }
    }
    return handlers;
}

// Inject styles
const style = document.createElement("style");

style.textContent += `
/* Global oriented-image toggle — lives inline in the toolbar (between
   Material and Zones); #oiToggleSection/#oiToggleSeparator in index.html
   are shown/hidden by updateGlobalOrientedImageToggle(). This rule just
   dims the icon while everything is masked off. */
#globalOIToggle.oi-off { opacity: 0.3; filter: grayscale(1) brightness(1.3); }

/* =======================
   DARK THEME ZONE PANEL
   ======================= */

.zone-panel {
    position: fixed;
    top: 80px;
    right: -420px;
    width: clamp(300px, 32vw, 420px);

    overflow: hidden;
    height: auto;
    max-height: 85vh;

    padding: 18px 20px;
    box-sizing: border-box;

    background: rgba(20, 20, 26, 0.55);
    backdrop-filter: blur(12px) saturate(140%);
    -webkit-backdrop-filter: blur(12px) saturate(140%);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 14px;
    box-shadow: 0 0 28px rgba(0,0,0,0.55);

    z-index: 10000;
    transition: right 0.28s ease, opacity 0.25s ease;

    font-family: 'Segoe UI', system-ui, sans-serif;
    display: flex;
    flex-direction: column;

    opacity: 0;
}

.zone-panel.open {
    right: 10px;
    opacity: 1;
}

.zone-panel h3 {
    margin-top: 0;
    text-align: center;
    font-size: 17px;
    font-weight: 600;
    color: #f2f2f7;
}

/* --------- FORM --------- */
.zone-form {
    display: flex;
    flex-direction: column;
    flex-grow: 1;
    padding: 12px 10px;
    margin-top: 12px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 10px;
    overflow-y: auto;
}

.zone-form::-webkit-scrollbar { width: 5px; }
.zone-form::-webkit-scrollbar-thumb { background: #444; border-radius: 3px; }
.zone-form::-webkit-scrollbar-thumb:hover { background: #555; }

.zone-form label {
    font-weight: 600;
    font-size: 12px;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: #9ca3af;
    margin-top: 10px;
    margin-bottom: 4px;
}

.zone-form h4 {
    font-weight: 600;
    color: #e5e7eb;
    margin-top: 10px;
    margin-bottom: 4px;
    font-size: 13px;
}

.zone-form input,
.zone-form select,
.zone-form textarea {
    padding: 8px 10px;
    border: 1px solid rgba(255,255,255,0.14);
    border-radius: 7px;
    background: rgba(255,255,255,0.06);
    color: #f0f0f5;
    margin-bottom: 10px;
    font-size: 13.5px;
    transition: border-color .15s, box-shadow .15s;
}
.zone-form input:focus,
.zone-form select:focus,
.zone-form textarea:focus {
    outline: none;
    border-color: #6e6bff;
    box-shadow: 0 0 0 3px rgba(79,70,229,0.25);
}

.zone-form .hint {
    font-size: 12px;
    color: #6b7280;
    margin-bottom: 6px;
}

/* --------- FORM CLOSE (X) --------- */
.zone-form-close {
    position: absolute;
    top: 6px;
    right: 10px;
    width: 26px;
    height: 26px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    color: #6b7280;
    background: none;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: background .12s, color .12s;
}
.zone-form-close:hover {
    background: rgba(220,38,38,0.25);
    color: #f87171;
}

/* --------- AUTO-SWITCH BUTTON --------- */
/* Centered pill that carries its green/red bg from JS */
#autoSwitchButtonCreation,
#autoSwitchButtonSearch {
    display: block;
    margin: 10px auto 4px;
    padding: 6px 20px;
    border: none;
    border-radius: 9999px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: #fff;
    cursor: pointer;
    transition: filter .15s ease, transform .1s ease;
    box-shadow: 0 2px 8px rgba(0,0,0,0.35);
}
#autoSwitchButtonCreation:hover,
#autoSwitchButtonSearch:hover {
    filter: brightness(1.15);
    transform: scale(1.03);
}

/* --------- GENERIC ACTION BUTTONS --------- */
.close-btn {
    width: 100%;
    margin-top: 8px;
    padding: 9px 14px;
    background: rgba(255,255,255,0.07);
    color: #e5e7eb;
    border: 1px solid rgba(255,255,255,0.11);
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: background .15s ease, border-color .15s ease;
    text-align: center;
}
.close-btn:hover {
    background: rgba(255,255,255,0.12);
    border-color: rgba(255,255,255,0.2);
}

/* Primary action (Create new Zone) */
.close-btn.add-zone-btn {
    background: rgba(79, 70, 229, 0.85);
    border-color: rgba(99,90,245,0.5);
    color: #fff;
    font-weight: 600;
    margin-top: 10px;
    margin-bottom: 10px;
}
.close-btn.add-zone-btn:hover {
    background: rgba(99, 90, 245, 1);
    box-shadow: 0 0 12px rgba(99,90,245,0.4);
}

.sub-btn {
    background: rgba(79, 70, 229, 0.85);
    color: white;
    border: 1px solid rgba(99,90,245,0.4);
    border-radius: 7px;
    padding: 8px 12px;
    margin-top: 8px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    transition: background .15s, box-shadow .15s;
}
.sub-btn:hover {
    background: rgba(99, 90, 245, 1);
    box-shadow: 0 0 10px rgba(99,90,245,0.4);
}

.save-btn {
    background: rgba(22, 163, 74, 0.85) !important;
    border-color: rgba(22,163,74,0.5) !important;
}
.save-btn:hover {
    background: rgba(21, 128, 61, 1) !important;
    box-shadow: 0 0 10px rgba(22,163,74,0.35) !important;
}

/* --------- EXPORT / IMPORT CONTAINER --------- */
.zone-io-container {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-top: 8px;
}

.zone-io-container .close-btn {
    width: 100%;
    margin-top: 0;
    padding: 7px 12px;
    font-size: 12px;
}

/* --------- BBOX LIST --------- */
.bbox-container {
    margin: 10px 0;
    background: rgba(255,255,255,0.04);
    padding: 10px;
    border-radius: 8px;
    border: 1px solid rgba(255,255,255,0.09);
}

.bbox-list {
    list-style: none;
    padding-left: 0;
    max-height: 150px;
    overflow-y: auto;
}

.bbox-list li {
    background: rgba(255,255,255,0.06);
    color: #c8c8d8;
    padding: 4px 8px;
    border-radius: 5px;
    font-family: ui-monospace, "SF Mono", Menlo, monospace;
    font-size: 12px;
    margin-bottom: 4px;
}

/* --------- ZONE LIST --------- */
.zone-list-container {
    margin-top: 12px;
    padding: 10px 12px;
    background: rgba(255,255,255,0.03);
    border-radius: 10px;
    border: 1px solid rgba(255,255,255,0.09);
    flex: 1;
    min-height: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

.zone-list-container h4 {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: #6b7280;
    margin: 0 0 8px 0;
}

.zone-list {
    list-style: none;
    padding-left: 0;
    margin: 0;
    overflow-y: auto;
    flex: 1;
}
.zone-list::-webkit-scrollbar { width: 5px; }
.zone-list::-webkit-scrollbar-thumb { background: #444; border-radius: 3px; }

.zone-empty {
    color: #6b7280;
    font-style: italic;
    font-size: 13px;
    text-align: center;
    padding: 16px 0;
}

/* Zone list items */
.zone-item {
    list-style: none;
    position: relative;
    margin: 4px 0;
    padding: 8px 10px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 8px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    color: #e5e7eb;
    font-size: 13px;
    transition: background .12s ease, border-color .12s ease;
}
.zone-item:hover {
    background: rgba(79,70,229,0.15);
    border-color: rgba(79,70,229,0.35);
}
.zone-item.dragging { opacity: 0.5; }

.zone-item::before {
    content: "";
    position: absolute;
    left: 0;
    top: 8px;
    bottom: 8px;
    width: 2px;
    border-radius: 1px;
    background: rgba(255,255,255,0.1);
}

/* Zone action buttons (edit / delete) */
.zone-btn {
    font-size: 11px;
    font-weight: 600;
    padding: 3px 8px;
    border-radius: 5px;
    border: none;
    cursor: pointer;
    color: white;
    transition: filter .15s;
}
.zone-btn:hover { filter: brightness(1.15); }

.edit-btn   { background: rgba(37,99,235,0.8); }
.delete-btn { background: rgba(220,38,38,0.8); }

/* --------- Annotation Description --------- */
.annotation-description {
    background: rgba(0,0,0,0.75) !important;
    color: #eee !important;
    border-radius: 8px;
    max-width: 160px !important;
    max-height: 280px !important;
    font-size: 13px;
    padding: 6px 8px;
    overflow-y: auto;
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255,255,255,0.1);
}

/* Annotation select */
.annotation-type-select {
    width: 100%;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.14);
    color: #e5e7eb;
    padding: 6px 8px;
    border-radius: 7px;
    margin-bottom: 8px;
    font-size: 13px;
}

#zonePointclouds { min-height: 140px; }

textarea {
    width: 99%;
    min-height: 50px;
    resize: vertical;
}
`;

document.head.appendChild(style);

/* =========================================================
   Refreshed Zone Form styling (matches zone_search.js theme)
   + collapsible sections + floating sub-panels
   ========================================================= */
style.textContent += `
.zone-form {
    background: rgba(28,28,36,0.60) !important;
    border: 1px solid rgba(255,255,255,0.10) !important;
    border-radius: 12px !important;
    padding: 10px 10px 14px !important;
    font-family: 'Segoe UI', system-ui, sans-serif;
}
.zone-form h3 {
    margin: 2px 0 10px;
    text-align: center;
    font-size: 16px;
    font-weight: 600;
    color: #f2f2f7;
}

/* ---- Collapsible section ---- */
.zf-section {
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 9px;
    margin: 5px 0;
    background: rgba(255,255,255,0.03);
    overflow: hidden;
    flex-shrink: 0;     /* the form scrolls; squeezed sections clipped their headers */
}
.zf-section-header {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 9px 11px;
    background: transparent;
    border: none;
    cursor: pointer;
    color: #e9e9f0;
    font-size: 13.5px;
    font-weight: 600;
    text-align: left;
    transition: background .12s;
}
.zf-section-header:hover { background: rgba(255,255,255,0.05); }
.zf-chevron {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: #8a8ad0;
    transition: transform .2s;
    flex-shrink: 0;
}
.zf-section-header.collapsed .zf-chevron { transform: rotate(-90deg); }
.zf-section-title { flex: 1; }
.zf-section-badge {
    font-size: 11px;
    font-weight: 600;
    color: #b8b8ff;
    background: rgba(111,107,255,0.18);
    border-radius: 10px;
    padding: 1px 8px;
}
.zf-section-body {
    padding: 4px 11px 12px;
    display: flex;
    flex-direction: column;
}
.zf-section-body.collapsed { display: none; }

/* ---- inputs inside the refreshed form ---- */
.zone-form .zf-section-body input,
.zone-form .zf-section-body select,
.zone-form .zf-section-body textarea {
    margin-bottom: 8px;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.14);
    color: #f0f0f5;
    border-radius: 6px;
}
.zone-form .zf-section-body input:focus,
.zone-form .zf-section-body select:focus,
.zone-form .zf-section-body textarea:focus {
    border-color: #6e6bff;
    box-shadow: 0 0 0 3px rgba(79,70,229,0.25);
    outline: none;
}
.zone-form .zf-section-body label {
    margin-top: 6px;
    font-size: 12.5px;
    font-weight: 600;
    color: #c9c9d4;
}
.zone-form .zf-section-body .hint { margin: 2px 0 6px; }

/* checkbox / inline rows */
.zf-inline {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 4px 0 2px;
}
.zf-inline label { margin: 0 !important; }
.zf-inline input[type="checkbox"] { margin: 0 !important; }

/* ---- bottom action buttons ---- */
.zf-actions {
    display: flex;
    gap: 8px;
    margin-top: 12px;
}
.zf-actions .sub-btn { flex: 1; margin-top: 0; }

/* ---- floating sub-panel (annotation form, etc.) ---- */
.zone-form.floating {
    position: fixed;
    top: 80px;
    right: 440px;
    width: clamp(300px, 32vw, 420px);
    max-height: 85vh;
    overflow-y: auto;
    z-index: 10001;
    background: rgba(20,20,26,0.92) !important;
    backdrop-filter: blur(16px) saturate(140%);
    -webkit-backdrop-filter: blur(16px) saturate(140%);
    border: 1px solid rgba(255,255,255,0.12) !important;
    border-radius: 14px !important;
    box-shadow: 0 0 28px rgba(0,0,0,0.55);
    animation: zs-desc-fadein 0.2s ease;
}
@media (max-width: 900px) {
    .zone-form.floating { right: 10px; top: 60px; }
}
`;

// Chevron SVG used by the collapsible sections (self-contained, no cross-file dependency)
style.textContent += `
.zone-panel {
    overflow-x: hidden;
    overflow-y: auto;
}
.zone-panel::-webkit-scrollbar { width: 5px; }
.zone-panel::-webkit-scrollbar-thumb { background: #444; border-radius: 3px; }
.zone-panel::-webkit-scrollbar-thumb:hover { background: #555; }
.zone-form { min-height: 0; }
`;

function _zfChevron() {
    const NS = "http://www.w3.org/2000/svg";
    const s = document.createElementNS(NS, "svg");
    s.setAttribute("width", "12");
    s.setAttribute("height", "12");
    s.setAttribute("viewBox", "0 0 12 12");
    s.setAttribute("fill", "none");
    const p = document.createElementNS(NS, "path");
    p.setAttribute("d", "M4.5 2.5L8 6L4.5 9.5");
    p.setAttribute("stroke", "currentColor");
    p.setAttribute("stroke-width", "1.5");
    p.setAttribute("stroke-linecap", "round");
    p.setAttribute("stroke-linejoin", "round");
    s.appendChild(p);
    return s;
}

function toggleZoneCreationMenu() {
    let existingMenu = document.getElementById("zoneCreationMenu");

    // If it exists, close it
    if (existingMenu) {
        existingMenu.classList.remove("open");
        setTimeout(() => existingMenu.remove(), 300);
        return;
    }

    // Otherwise create it
    const panel = document.createElement("div");
    panel.id = "zoneCreationMenu";
    panel.className = "zone-panel";

    // --- Title ---
    const title = document.createElement("h3");
    title.textContent = "Zone Creation & Management";
    panel.appendChild(title);

    // --- Close button ---
    const closeBtn = document.createElement("button");
    closeBtn.textContent = "×";
    closeBtn.className = "zone-form-close";
    closeBtn.title = "Close";
    closeBtn.addEventListener("click", () => {
    panel.classList.remove("open");
    setTimeout(() => panel.remove(), 300);
    });
    panel.appendChild(closeBtn);

    // --- Auto-Switch Toggle ---
    const autoSwitchButton = document.createElement("button");
    autoSwitchButton.id = "autoSwitchButtonCreation";
    autoSwitchButton.className = "close-btn";

    if(window.zoneAutoSwitchState){
        autoSwitchButton.style.background = "#16a34a";
        autoSwitchButton.textContent = "Auto-Switch: ON";
    }
    else {
        autoSwitchButton.textContent = "Auto-Switch: OFF";
        autoSwitchButton.style.background = "#dc2626";
    }

    autoSwitchButton.addEventListener("click", () => {
        setAutoSwitchState(!window.zoneAutoSwitchState);
    });


    panel.appendChild(autoSwitchButton);

    // --- Export / Import Buttons (side-by-side container) ---
    const ioContainer = document.createElement("div");
    ioContainer.className = "zone-io-container";

    const exportBtn = document.createElement("button");
    exportBtn.textContent = "Export Zones (JSON)";
    exportBtn.className = "close-btn";
    exportBtn.addEventListener("click", exportZonesToJSON);
    ioContainer.appendChild(exportBtn);

    const importBtn = document.createElement("button");
    importBtn.textContent = "Import Zones (JSON)";
    importBtn.className = "close-btn";
    importBtn.addEventListener("click", importZonesFromJSON);
    ioContainer.appendChild(importBtn);

    const datasetImport = createDatasetImportRow();
    if (datasetImport) ioContainer.appendChild(datasetImport);

    panel.appendChild(ioContainer);


    // Add Zone Button
    const addZoneBtn = document.createElement("button");
    addZoneBtn.textContent = "Create new Zone";
    addZoneBtn.className = "close-btn add-zone-btn";
    addZoneBtn.addEventListener("click", () => {
        openZoneForm();
        if(window.zoneAutoSwitchState) setAutoSwitchState(false);
        const measurement = viewer.scene.removeAllMeasurements();
    });
    panel.appendChild(addZoneBtn);



    // Zone list section
    const zoneListContainer = document.createElement("div");
    zoneListContainer.className = "zone-list-container";

    const zoneListTitle = document.createElement("h4");
    zoneListTitle.textContent = "Existing Zones";
    zoneListContainer.appendChild(zoneListTitle);

    const zoneList = document.createElement("ul");
    zoneList.id = "zoneList";
    zoneList.className = "zone-list";
    zoneListContainer.appendChild(zoneList);

    // Populate list from window.zones
    
    panel.appendChild(zoneListContainer);

    // Placeholder description
    const desc = document.createElement("p");
    if(!window.zones) desc.textContent = "Define zone name, bounding boxes, and annotations here.";
    panel.appendChild(desc);

    // Append to body and animate
    document.body.appendChild(panel);
    requestAnimationFrame(() => panel.classList.add("open"));

    updateZoneList();

}

/**
 * openZoneForm(zone?)
 * 
 * Unified zone creation/editing form.
 * - If `zone` is provided (truthy), we are EDITING that zone.
 * - If `zone` is null/undefined, we are CREATING a new zone.
 *
 * All fields from the Zone constructor are editable in both modes:
 *   name, parent, priority, pointclouds, boundingBoxes, annotations,
 *   layerMaps, marker360s, beacon, description
 */
function openZoneForm(zone = null) {

    if (document.getElementById("zoneSearchMenu")) document.getElementById("zoneSearchMenu").remove();

    const isEdit = !!zone;

    // Disable auto-switch while editing/creating
    if (window.zoneAutoSwitchState) setAutoSwitchState(false);
    viewer.scene.removeAllMeasurements();

    // If creating, set up a fresh temp annotations array
    if (!isEdit) {
        window.annotationsTemp = [];
    }

    // Remove any existing form (and any stray floating sub-panels)
    const oldForm = document.getElementById("zoneForm");
    if (oldForm) oldForm.remove();
    const strayAnn = document.getElementById("annotationForm");
    if (strayAnn) strayAnn.remove();

    // ─── Form container ───
    const form = document.createElement("div");
    form.id = "zoneForm";
    form.className = "zone-form";

    // ─── Title ───
    const title = document.createElement("h3");
    title.textContent = isEdit ? `Edit Zone: ${zone.name}` : "Add New Zone";
    form.appendChild(title);

    // ─── Close (×) ───
    const closeFormBtn = document.createElement("button");
    closeFormBtn.textContent = "×";
    closeFormBtn.className = "zone-form-close";
    closeFormBtn.title = "Close";
    closeFormBtn.addEventListener("click", () => {
        const ann = document.getElementById("annotationForm");
        if (ann) ann.remove();
        setAutoSwitchState(true);
        form.remove();
        toggleZoneCreationMenu(); // rebuild the main panel
    });
    form.appendChild(closeFormBtn);

    // ═══════════════════════════════════════════════════════
    //  Collapsible section helper
    // ═══════════════════════════════════════════════════════
    function makeSection(labelText, opts = {}) {
        const open = !!opts.open;
        const section = document.createElement("div");
        section.className = "zf-section";

        const header = document.createElement("button");
        header.type = "button";
        header.className = "zf-section-header" + (open ? "" : " collapsed");

        const chev = document.createElement("span");
        chev.className = "zf-chevron";
        chev.appendChild(_zfChevron());

        const lbl = document.createElement("span");
        lbl.className = "zf-section-title";
        lbl.textContent = labelText;

        header.appendChild(chev);
        header.appendChild(lbl);

        if (opts.badge != null) {
            const badge = document.createElement("span");
            badge.className = "zf-section-badge";
            badge.textContent = opts.badge;
            header.appendChild(badge);
        }

        const body = document.createElement("div");
        body.className = "zf-section-body" + (open ? "" : " collapsed");

        header.addEventListener("click", () => {
            const collapsed = header.classList.toggle("collapsed");
            body.classList.toggle("collapsed", collapsed);
        });

        section.appendChild(header);
        section.appendChild(body);
        form.appendChild(section);
        return body;
    }

    // ═══════════════════════════════════════════════════════
    //  IMPORT FROM A DATASET (collapsed; same control as the main panel)
    // ═══════════════════════════════════════════════════════
    const datasetImport = createDatasetImportRow(() => {
        // The import replaced the zone being edited: edit the imported one instead, since
        // saving this form would write into a zone that is no longer in the list.
        if (isEdit && !window.zones.includes(zone)) {
            const replacement = window.zones.find(z => z.name === zone.name);
            if (replacement) { openZoneForm(replacement); return; }
        }
        // Otherwise the new zones and clouds just join the choices below.
        fillParentOptions(parentSelect.value);
        fillPointcloudOptions(Array.from(pcSelect.selectedOptions).map(o => window.pointcloudMap[o.value]));
        parentSearch.dispatchEvent(new Event("input"));
        pcSearch.dispatchEvent(new Event("input"));
    });
    if (datasetImport) makeSection("Import Zones from a Dataset").appendChild(datasetImport);

    // ═══════════════════════════════════════════════════════
    //  SECTION 1 · BASICS (name + description)  [open by default]
    // ═══════════════════════════════════════════════════════
    const basicsBody = makeSection("Basics", { open: true });

    const nameLabel = document.createElement("label");
    nameLabel.textContent = "Zone Name:";
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.placeholder = "Enter zone name";
    nameInput.id = "zoneName";
    if (isEdit) nameInput.value = zone.name;
    basicsBody.appendChild(nameLabel);
    basicsBody.appendChild(nameInput);

    const descriptionLabel = document.createElement("label");
    descriptionLabel.textContent = "Zone Description:";
    const descriptionInput = document.createElement("textarea");
    descriptionInput.placeholder = "Enter zone description";
    descriptionInput.id = "zoneDescription";
    descriptionInput.rows = 4;
    descriptionInput.cols = 40;
    if (isEdit) descriptionInput.value = zone.description || "";
    basicsBody.appendChild(descriptionLabel);
    basicsBody.appendChild(descriptionInput);

    // ═══════════════════════════════════════════════════════
    //  SECTION 2 · HIERARCHY & BEHAVIOR (default, parent, background)
    // ═══════════════════════════════════════════════════════
    const hierBody = makeSection("Hierarchy & Behavior");

    // Default zone toggle (inline)
    const defaultRow = document.createElement("div");
    defaultRow.className = "zf-inline";
    const defaultChk = document.createElement("input");
    defaultChk.type = "checkbox";
    defaultChk.id = "zoneIsDefault";
    defaultChk.checked = isEdit ? (zone.isDefault || false) : false;
    defaultChk.style.cssText = "width:18px; height:18px; accent-color:#6f6bff;";
    const defaultLabel = document.createElement("label");
    defaultLabel.textContent = "Default zone";
    defaultRow.appendChild(defaultChk);
    defaultRow.appendChild(defaultLabel);
    hierBody.appendChild(defaultRow);

    const defaultHint = document.createElement("p");
    defaultHint.className = "hint";
    defaultHint.textContent = "Default zone acts as the ambient/lobby state of its parent, showing sibling beacons.";
    hierBody.appendChild(defaultHint);

    // Parent zone
    const parentLabel = document.createElement("label");
    parentLabel.textContent = "Zone Parent:";

    const parentSearch = document.createElement("input");
    parentSearch.type = "text";
    parentSearch.placeholder = "Search zones...";
    parentSearch.style.marginBottom = "6px";

    const parentSelect = document.createElement("select");
    parentSelect.multiple = false;
    parentSelect.id = "zonePointclouds";
    parentSelect.size = 5;

    const noneOpt = document.createElement("option");
    noneOpt.value = "none";
    noneOpt.textContent = "None";

    // Also rebuilt after an import from this form, which can add zones.
    function fillParentOptions(selected) {
        parentSelect.replaceChildren(noneOpt);
        window.zones.forEach(z => {
            if (isEdit && z === zone) return; // don't allow self-parenting
            const opt = document.createElement("option");
            opt.value = z.name;
            opt.textContent = z.name;
            parentSelect.appendChild(opt);
        });
        parentSelect.value = [...parentSelect.options].some(o => o.value === selected) ? selected : "none";
    }
    fillParentOptions(isEdit && zone.parent ? (zone.parent?.name || zone.parent) : "none");

    parentSearch.addEventListener("input", () => {
        const filter = parentSearch.value.toLowerCase();
        for (const option of parentSelect.options) {
            option.style.display = option.textContent.toLowerCase().includes(filter) ? "" : "none";
        }
    });

    hierBody.appendChild(parentLabel);
    hierBody.appendChild(parentSearch);
    hierBody.appendChild(parentSelect);

    // Background
    const typeLabel = document.createElement("label");
    typeLabel.textContent = "Zone Background:";
    hierBody.appendChild(typeLabel);

    const backgroundSelect = document.createElement("select");
    backgroundSelect.id = "annotationType";
    backgroundSelect.className = "annotation-type-select";

    const backgrounds = [
        { label: "Cesium", value: "cesium" },
        { label: "White", value: "white" },
        { label: "Black", value: "black" },
        { label: "Gradient", value: "gradient" },
        { label: "Skybox", value: "skybox" }
    ];
    backgrounds.forEach(bg => {
        const opt = document.createElement("option");
        opt.value = bg.value;
        opt.textContent = bg.label;
        backgroundSelect.appendChild(opt);
    });
    backgroundSelect.value = isEdit ? zone.background : "gradient";
    hierBody.appendChild(backgroundSelect);

    // ═══════════════════════════════════════════════════════
    //  SECTION 3 · POINTCLOUDS
    // ═══════════════════════════════════════════════════════
    const pcCount = isEdit ? (zone.pointclouds?.length || 0) : 0;
    const pcBody = makeSection("Pointclouds", { badge: pcCount || null });

    const pcSearch = document.createElement("input");
    pcSearch.type = "text";
    pcSearch.placeholder = "Search pointclouds...";
    pcSearch.style.marginBottom = "6px";

    const pcSelect = document.createElement("select");
    pcSelect.id = "zonePointclouds";
    pcSelect.multiple = true;
    pcSelect.size = 6;

    // Also rebuilt after an import from this form, which can add clouds.
    function fillPointcloudOptions(selected) {
        window.pointcloudMap = {};
        pcSelect.replaceChildren();
        viewer.scene.pointclouds.forEach((pc, i) => {
            const id = `pc_${i}`;
            window.pointcloudMap[id] = pc;
            const opt = document.createElement("option");
            opt.value = id;
            opt.textContent = pc.name || `PointCloud ${i + 1}`;
            opt.selected = selected.includes(pc);
            pcSelect.appendChild(opt);
        });
    }
    fillPointcloudOptions(isEdit ? zone.pointclouds : []);

    pcSearch.addEventListener("input", () => {
        const filter = pcSearch.value.toLowerCase();
        for (const option of pcSelect.options) {
            option.style.display = option.textContent.toLowerCase().includes(filter) ? "" : "none";
        }
    });

    const selectVisibleBtn = document.createElement("button");
    selectVisibleBtn.textContent = "Select Visible Pointclouds";
    selectVisibleBtn.className = "sub-btn";
    selectVisibleBtn.style.marginTop = "6px";
    selectVisibleBtn.addEventListener("click", (e) => {
        e.preventDefault();
        for (const [id, pc] of Object.entries(window.pointcloudMap)) {
            const option = pcSelect.querySelector(`option[value="${id}"]`);
            if (option) option.selected = !!pc.visible;
        }
    });

    pcBody.appendChild(pcSearch);
    pcBody.appendChild(pcSelect);
    pcBody.appendChild(selectVisibleBtn);

    // ═══════════════════════════════════════════════════════
    //  SECTION 4 · BOUNDING BOXES
    // ═══════════════════════════════════════════════════════
    const bboxBody = makeSection("Bounding Boxes");

    const bboxContainer = document.createElement("div");
    bboxContainer.className = "bbox-container";

    const bboxHint = document.createElement("p");
    bboxHint.className = "hint";
    bboxContainer.appendChild(bboxHint);

    const bboxList = document.createElement("ul");
    bboxList.className = "bbox-list";
    bboxContainer.appendChild(bboxList);

    const existingBoxes = isEdit ? (zone.boundingBoxes || []) : [];
    if (existingBoxes.length === 0) {
        bboxHint.textContent = "Click below to select or draw bounding boxes.";
        bboxList.style.display = "none";
    } else {
        bboxHint.style.display = "none";
        bboxList.style.display = "block";
        for (const b of existingBoxes) {
            const li = document.createElement("li");
            li.textContent = `Pos: [${b.position[0].toFixed(2)}, ${b.position[1].toFixed(2)}, ${b.position[2].toFixed(2)}]`;
            bboxList.appendChild(li);
        }
    }

    bboxBody.appendChild(bboxContainer);

    let redefineBoxes = false;

    const bboxBtn = document.createElement("button");
    bboxBtn.textContent = isEdit ? "Redefine Boxes" : "Choose Bounding Boxes";
    bboxBtn.className = "sub-btn";
    bboxBtn.addEventListener("click", () => {
        viewer.volumeTool.startInsertion({ clip: true });
        setTimeout(updateBoundingBoxList, 500);
        redefineBoxes = true;
    });
    bboxBody.appendChild(bboxBtn);

    const clearBboxBtn = document.createElement("button");
    clearBboxBtn.textContent = "Clear All Boxes";
    clearBboxBtn.className = "sub-btn clear-btn";
    clearBboxBtn.addEventListener("click", () => {
        viewer.scene.removeAllClipVolumes();
        if (isEdit) zone.boundingBoxes = [];
        redefineBoxes = true;
        updateBoundingBoxList();
    });
    bboxBody.appendChild(clearBboxBtn);

    // ═══════════════════════════════════════════════════════
    //  SECTION 5 · LAYER MAPS
    // ═══════════════════════════════════════════════════════
    const currentLayerMaps = isEdit ? (zone.layerMaps || []) : [];
    const layerBody = makeSection("Layer Maps", { badge: currentLayerMaps.length || null });

    if (currentLayerMaps.length === 0) {
        const empty = document.createElement("p");
        empty.textContent = "No layer maps defined.";
        empty.className = "hint";
        layerBody.appendChild(empty);
    } else {
        const layerMapList = document.createElement("ul");
        layerMapList.className = "bbox-list";
        currentLayerMaps.forEach((lm, idx) => {
            const li = document.createElement("li");
            li.textContent = `${lm.name} (${lm.layersList.length} layers)`;

            const del = document.createElement("button");
            del.textContent = "×";
            del.className = "zone-btn delete-btn";
            del.style.marginLeft = "8px";
            del.onclick = () => {
                currentLayerMaps.splice(idx, 1);
                form.remove();
                openZoneForm(zone); // re-open to refresh
            };

            li.appendChild(del);
            layerMapList.appendChild(li);
        });
        layerBody.appendChild(layerMapList);
    }

    const addLayerMapBtn = document.createElement("button");
    addLayerMapBtn.textContent = "Manage Layer Maps";
    addLayerMapBtn.className = "sub-btn";
    addLayerMapBtn.onclick = () => openLayerMapPanel(zone || { layerMaps: currentLayerMaps });
    layerBody.appendChild(addLayerMapBtn);

    // ═══════════════════════════════════════════════════════
    //  SECTION 6 · MARKER 360s
    // ═══════════════════════════════════════════════════════
    const currentMarker360s = isEdit ? (zone.marker360s || []) : [];
    const m360Body = makeSection("360 Markers", { badge: currentMarker360s.length || null });

    if (currentMarker360s.length === 0) {
        const empty = document.createElement("p");
        empty.textContent = "No 360 markers defined.";
        empty.className = "hint";
        m360Body.appendChild(empty);
    } else {
        const m360List = document.createElement("ul");
        m360List.className = "bbox-list";
        currentMarker360s.forEach((m, i) => {
            const li = document.createElement("li");
            li.textContent = `${m.name}`;

            const del = document.createElement("button");
            del.textContent = "×";
            del.className = "zone-btn delete-btn";
            del.onclick = () => {
                currentMarker360s.splice(i, 1);
                form.remove();
                openZoneForm(zone); // re-open to refresh
            };

            li.appendChild(del);
            m360List.appendChild(li);
        });
        m360Body.appendChild(m360List);
    }

    const addM360Btn = document.createElement("button");
    addM360Btn.textContent = "Manage Marker 360s";
    addM360Btn.className = "sub-btn";
    addM360Btn.onclick = () => openMarker360ManagerPanel(zone || { marker360s: currentMarker360s });
    m360Body.appendChild(addM360Btn);

    // ═══════════════════════════════════════════════════════
    //  SECTION 7 · ANNOTATIONS
    // ═══════════════════════════════════════════════════════
    const annotationsList = isEdit ? zone.annotations : window.annotationsTemp;
    const annBody = makeSection("Annotations", { badge: annotationsList.length || null });

    if (annotationsList.length === 0) {
        const hint = document.createElement("p");
        hint.textContent = "No annotations yet.";
        hint.className = "hint";
        annBody.appendChild(hint);
    } else {
        const annList = document.createElement("ul");
        annList.className = "annotation-list";

        for (let i = 0; i < annotationsList.length; i++) {
            const a = annotationsList[i];
            const li = document.createElement("li");
            li.style.color = "#e5e5e5";
            li.innerHTML = `<b>${a.title || a._title || "(untitled)"}</b> —`;

            const editAnnBtn = document.createElement("button");
            editAnnBtn.textContent = "Edit";
            editAnnBtn.className = "mini-delete";
            editAnnBtn.title = "Edit Annotation";
            editAnnBtn.addEventListener("click", () => {
                addAnnotationForm(annotationsList[i]);
            });

            const delAnnBtn = document.createElement("button");
            delAnnBtn.textContent = "x";
            delAnnBtn.className = "mini-delete";
            delAnnBtn.title = "Delete annotation";
            delAnnBtn.addEventListener("click", () => {
                const ann = annotationsList[i];

                if (ann && viewer.scene.annotations.hasChild(ann)) {
                    viewer.scene.annotations.remove(ann);
                }

                annotationsList.splice(i, 1);

                updateZoneList();
                form.remove();
                openZoneForm(zone);
            });

            li.appendChild(editAnnBtn);
            li.appendChild(delAnnBtn);
            annList.appendChild(li);
        }
        annBody.appendChild(annList);
    }

    const addAnnBtn = document.createElement("button");
    addAnnBtn.textContent = "Create Annotation";
    addAnnBtn.className = "sub-btn";
    addAnnBtn.addEventListener("click", (e) => {
        e.preventDefault();
        // Point the temp array at the correct list so addAnnotationForm pushes to it
        window.annotationsTemp = annotationsList;
        addAnnotationForm();
    });
    annBody.appendChild(addAnnBtn);

    // ═══════════════════════════════════════════════════════
    //  SECTION 8 · BEACON (position + camera)
    // ═══════════════════════════════════════════════════════
    const beaconBody = makeSection("Beacon");

    const beaconHint = document.createElement("p");
    beaconHint.textContent = "Create a marker for this zone.";
    beaconHint.className = "hint";
    beaconBody.appendChild(beaconHint);

    const posHint = document.createElement("p");
    posHint.className = "hint";
    beaconBody.appendChild(posHint);

    let measurement = null;
    let annotationPosition = null;
    let check = null;

    if (isEdit && zone.beacon) {
        const p = zone.beacon.position;
        posHint.textContent = `Position: [${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}]`;
    } else {
        posHint.textContent = "Click 'Select Point' to define Beacon position.";
    }

    let toClearBeacon = false;
    const posBtn = document.createElement("button");
    posBtn.textContent = "Select Point";
    posBtn.className = "sub-btn";
    posBtn.addEventListener("click", () => {
        viewer.scene.removeAllMeasurements();
        measurement = viewer.measuringTool.startInsertion({
            showDistances: false,
            showAngles: false,
            showCoordinates: true,
            showArea: false,
            closed: true,
            maxMarkers: 1,
            name: 'AnnotationPoint'
        });
        toClearBeacon = false;
        posHint.textContent = "Selecting point... click in the scene.";

        check = setInterval(() => {
            if (measurement.points.length > 0) {
                const p = measurement.points[0].position;
                annotationPosition = [p.x, p.y, p.z];
                posHint.textContent = `Position: [${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}]`;
            }
        }, 300);
    });
    beaconBody.appendChild(posBtn);

    // Z adjust buttons
    const zRow = document.createElement("div");
    zRow.style.cssText = "display:flex; gap:6px; margin-top:4px;";

    const zDown = document.createElement("button");
    zDown.textContent = "Z −";
    zDown.className = "sub-btn";
    zDown.style.flex = "1";
    zDown.addEventListener("click", (e) => {
        e.preventDefault();
        if (measurement?.points?.length > 0) {
            measurement.points[0].position.z -= 0.5;
            const p = measurement.points[0].position;
            annotationPosition = [p.x, p.y, p.z];
            posHint.textContent = `Position: [${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}]`;
        }
    });

    const zUp = document.createElement("button");
    zUp.textContent = "Z +";
    zUp.className = "sub-btn";
    zUp.style.flex = "1";
    zUp.addEventListener("click", (e) => {
        e.preventDefault();
        if (measurement?.points?.length > 0) {
            measurement.points[0].position.z += 0.5;
            const p = measurement.points[0].position;
            annotationPosition = [p.x, p.y, p.z];
            posHint.textContent = `Position: [${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}]`;
        }
    });

    zRow.appendChild(zDown);
    zRow.appendChild(zUp);
    beaconBody.appendChild(zRow);

    const clearBeaconBtn = document.createElement("button");
    clearBeaconBtn.textContent = "Remove Beacon";
    clearBeaconBtn.className = "sub-btn";
    clearBeaconBtn.addEventListener("click", () => {
        posHint.textContent = "Selecting point... click in the scene.";
        toClearBeacon = true;
    });
    beaconBody.appendChild(clearBeaconBtn);

    // Beacon Camera
    const camHint = document.createElement("p");
    camHint.className = "hint";
    beaconBody.appendChild(camHint);

    let cameraPosition = null;
    let cameraTarget = null;

    if (isEdit && zone.beacon && zone.beacon.cameraPosition && zone.beacon.cameraTarget) {
        const pos = zone.beacon.cameraPosition;
        const tar = zone.beacon.cameraTarget;
        const posStr = `[${pos.x.toFixed(3)}, ${pos.y.toFixed(3)}, ${pos.z.toFixed(3)}]`;
        const tarStr = `[${tar.x.toFixed(3)}, ${tar.y.toFixed(3)}, ${tar.z.toFixed(3)}]`;
        camHint.innerHTML = `<b>Camera Position:</b> ${posStr}<br><b>Camera Target:</b> ${tarStr}`;
        cameraPosition = { x: pos.x, y: pos.y, z: pos.z };
        cameraTarget = { x: tar.x, y: tar.y, z: tar.z };
    } else {
        camHint.textContent = "Capture current camera target and position.";
    }

    const camBtn = document.createElement("button");
    camBtn.textContent = "Capture Camera";
    camBtn.className = "sub-btn";
    camBtn.addEventListener("click", () => {
        const cam = viewer.scene.getActiveCamera();
        const pos = cam.position;
        const tar = viewer.scene.view.getPivot();

        const posStr = `[${pos.x.toFixed(3)}, ${pos.y.toFixed(3)}, ${pos.z.toFixed(3)}]`;
        const tarStr = `[${tar.x.toFixed(3)}, ${tar.y.toFixed(3)}, ${tar.z.toFixed(3)}]`;

        camHint.innerHTML = `<b>Camera Position:</b> ${posStr}<br><b>Camera Target:</b> ${tarStr}`;

        cameraPosition = { x: pos.x, y: pos.y, z: pos.z };
        cameraTarget = { x: tar.x, y: tar.y, z: tar.z };
    });
    beaconBody.appendChild(camBtn);

    // ═══════════════════════════════════════════════════════
    //  SECTION 9 · ORIENTED IMAGES (any number of image sets,
    //  each with a name + camera params + image params)
    // ═══════════════════════════════════════════════════════
    const existingOIHs = isEdit
        ? (zone.orientedImagesHandlers || (zone.orientedImagesHandler ? [zone.orientedImagesHandler] : []))
        : [];

    const oiBody = makeSection("Oriented Images", { badge: existingOIHs.length || null });

    const oiHint = document.createElement("p");
    oiHint.className = "hint";
    oiHint.textContent = "Add one entry per set of oriented images. Both paths must be set for a set to load; incomplete sets are dropped on save.";
    oiBody.appendChild(oiHint);

    const oiList = document.createElement("div");
    oiBody.appendChild(oiList);

    // Live list of image-set rows; read back at save time. Removed rows are
    // spliced out immediately, so the array always mirrors the UI.
    const oiEntries = [];

    function addOIEntry(existingHandler) {
        const entry = document.createElement("div");
        entry.style.cssText = "border:1px solid rgba(255,255,255,0.12); border-radius:8px; padding:8px 10px 10px; margin-bottom:10px;";

        const head = document.createElement("div");
        head.style.cssText = "display:flex; align-items:center; justify-content:space-between; gap:8px;";

        const headLabel = document.createElement("span");
        headLabel.className = "hint";
        headLabel.textContent = `Image Set ${oiEntries.length + 1}`;
        head.appendChild(headLabel);

        const removeBtn = document.createElement("button");
        removeBtn.textContent = "Remove";
        removeBtn.className = "sub-btn clear-btn";
        removeBtn.style.cssText = "margin-top:0; padding:2px 10px; width:auto;";
        head.appendChild(removeBtn);
        entry.appendChild(head);

        const setNameLabel = document.createElement("label");
        setNameLabel.textContent = "Set Name:";
        const setNameInput = document.createElement("input");
        setNameInput.type = "text";
        setNameInput.placeholder = "e.g. Facade photos";
        setNameInput.value = existingHandler ? (existingHandler.name || "") : "";
        entry.appendChild(setNameLabel);
        entry.appendChild(setNameInput);

        const camParamsLabel = document.createElement("label");
        camParamsLabel.textContent = "Camera Params Path:";
        const camParamsInput = document.createElement("input");
        camParamsInput.type = "text";
        camParamsInput.placeholder = "e.g. path/to/cameras.json";
        camParamsInput.value = existingHandler ? (existingHandler.cameraParamsPath || "") : "";
        entry.appendChild(camParamsLabel);
        entry.appendChild(camParamsInput);

        const imgParamsLabel = document.createElement("label");
        imgParamsLabel.textContent = "Image Params Path:";
        const imgParamsInput = document.createElement("input");
        imgParamsInput.type = "text";
        imgParamsInput.placeholder = "e.g. path/to/images.json";
        imgParamsInput.value = existingHandler ? (existingHandler.imageParamsPath || "") : "";
        entry.appendChild(imgParamsLabel);
        entry.appendChild(imgParamsInput);

        const record = { setNameInput, camParamsInput, imgParamsInput, existingHandler: existingHandler || null };
        oiEntries.push(record);

        removeBtn.addEventListener("click", (e) => {
            e.preventDefault();
            const idx = oiEntries.indexOf(record);
            if (idx !== -1) oiEntries.splice(idx, 1);
            entry.remove();
            // Renumber the remaining set labels
            oiList.querySelectorAll(":scope > div > div > span").forEach((lbl, i) => {
                lbl.textContent = `Image Set ${i + 1}`;
            });
        });

        oiList.appendChild(entry);
    }

    for (const h of existingOIHs) addOIEntry(h);

    const addOIBtn = document.createElement("button");
    addOIBtn.textContent = "＋ Add Image Set";
    addOIBtn.className = "sub-btn";
    addOIBtn.addEventListener("click", (e) => {
        e.preventDefault();
        addOIEntry(null);
    });
    oiBody.appendChild(addOIBtn);

    // ═══════════════════════════════════════════════════════
    //  ACTION BUTTONS (Save / Cancel) — always visible
    // ═══════════════════════════════════════════════════════
    const actions = document.createElement("div");
    actions.className = "zf-actions";

    const saveBtn = document.createElement("button");
    saveBtn.textContent = isEdit ? "Save Changes" : "Save Zone";
    saveBtn.className = "sub-btn save-btn";
    saveBtn.addEventListener("click", () => {
        if (!nameInput.value) {
            alert("Incomplete Zone Data. Please enter a zone name.");
            return;
        }

        // --- Gather common field values ---
        const name = nameInput.value;
        const description = descriptionInput.value;
        const selectedParent = parentSelect.value || "none";

        // Pointclouds
        const selectedIDs = Array.from(pcSelect.selectedOptions).map(o => o.value);
        const selectedPointclouds = selectedIDs.map(id => window.pointcloudMap[id]);

        // Bounding boxes: use scene volumes if redefined, otherwise keep existing
        let volumesList;
        if (redefineBoxes) {
            volumesList = [];
            for (let volume of viewer.scene.volumes) {
                volumesList.push({
                    position: [volume.position.x, volume.position.y, volume.position.z],
                    rotation: [volume.rotation.x, volume.rotation.y, volume.rotation.z, 'XYZ'],
                    scale: [volume.scale.x, volume.scale.y, volume.scale.z]
                });
            }
        } else {
            volumesList = isEdit ? zone.boundingBoxes : [];
            if (!isEdit) {
                for (let volume of viewer.scene.volumes) {
                    volumesList.push({
                        position: [volume.position.x, volume.position.y, volume.position.z],
                        rotation: [volume.rotation.x, volume.rotation.y, volume.rotation.z, 'XYZ'],
                        scale: [volume.scale.x, volume.scale.y, volume.scale.z]
                    });
                }
            }
        }

        // Beacon
        const beaconPoint = measurement?.points?.[0]?.position
            || (isEdit && !toClearBeacon && zone.beacon ? zone.beacon.position : new THREE.Vector3(-999999, -999999, -999999));
        const beacon = {
            position: { x: beaconPoint.x, y: beaconPoint.y, z: beaconPoint.z },
            cameraPosition: cameraPosition,
            cameraTarget: cameraTarget
        };

        console.log(beacon);

        // background
        const background = backgroundSelect.value;

        // Oriented images handlers (one per image set in the form)
        const oihs = [];
        for (const entry of oiEntries) {
            const setName = entry.setNameInput.value.trim();
            const camParams = entry.camParamsInput.value.trim();
            const imgParams = entry.imgParamsInput.value.trim();
            if (!camParams || !imgParams) continue; // incomplete set => dropped

            const existing = entry.existingHandler;
            const unchanged = existing
                && existing.cameraParamsPath === camParams
                && existing.imageParamsPath === imgParams;
            if (unchanged) {
                existing.name = setName; // renaming never needs a reload
                oihs.push(existing);
            } else {
                try {
                    oihs.push(new orientedImagesHandler(camParams, imgParams, setName));
                } catch (err) {
                    console.warn("Failed to initialise orientedImagesHandler:", err);
                    if (existing) oihs.push(existing);
                }
            }
        }

        // Take any dropped/replaced handler's images off screen right away —
        // they may already be in the scene if the zone is currently visible.
        if (isEdit) {
            const previous = zone.orientedImagesHandlers
                || (zone.orientedImagesHandler ? [zone.orientedImagesHandler] : []);
            for (const old of previous) {
                if (!oihs.includes(old) && old && old.images) {
                    setZoneOrientedImagesVisibility(old.images, false);
                }
            }
        }

        // --- Apply to zone or create new ---
        if (isEdit) {
            zone.name = name;
            zone.description = description;
            zone.parent = selectedParent;
            zone.pointclouds = selectedPointclouds;
            zone.boundingBoxes = volumesList;
            zone.beacon = beacon;
            zone.background = background;
            zone.isDefault = defaultChk.checked;
            zone.orientedImagesHandlers = oihs;
            delete zone.orientedImagesHandler; // clear legacy single-handler field
            // New sets start hidden; sync them to the zone's current visibility.
            resetZoneOrientedImages(zone, getZoneVisibility(zone));
            // annotations, layerMaps, marker360s are already mutated in-place via their arrays
        } else {
            const newZone = new Zone(
                name,
                selectedParent,
                0,                          // priority (resolved later)
                selectedPointclouds,
                volumesList,
                annotationsList,            // window.annotationsTemp
                currentLayerMaps,           // [] for new zones unless managed
                currentMarker360s,          // [] for new zones unless managed
                beacon,
                description,
                background,
                defaultChk.checked,
                oihs
            );
            window.zones.push(newZone);
            inheritSceneDataset([newZone]);
            resetZoneOrientedImages(newZone, getZoneVisibility(newZone));
        }

        console.log("Saved zones:", window.zones);

        const badge = document.getElementById("zoneCountBadge");
        if (badge) badge.innerHTML = window.zones.length;

        viewer.scene.removeAllClipVolumes();
        resolveZoneParents();
        updateZoneList();
        form.remove();
        setAutoSwitchState(true);
        toggleZoneCreationMenu();
        toggleZoneSearchMenu();
    });

    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Cancel";
    cancelBtn.className = "sub-btn clear-btn";
    cancelBtn.addEventListener("click", () => {
        const ann = document.getElementById("annotationForm");
        if (ann) ann.remove();
        setAutoSwitchState(true);
        form.remove();
        toggleZoneCreationMenu();
    });

    actions.appendChild(saveBtn);
    actions.appendChild(cancelBtn);
    form.appendChild(actions);

    // ═══════════════════════════════════════════════════════
    //  MOUNT THE FORM
    // ═══════════════════════════════════════════════════════
    const panel = document.getElementById("zoneCreationMenu");
    if (panel) {
        panel.innerHTML = "";
        panel.appendChild(form);
    } else {
        document.body.appendChild(form);
    }
}

function addAnnotationForm(annotation) {

    console.log(annotation);
    // Remove any existing form if open
    const oldForm = document.getElementById("annotationForm");
    if (oldForm) oldForm.remove();

    // Create form container
    const form = document.createElement("div");
    form.id = "annotationForm";
    form.className = "zone-form floating";

    const title = document.createElement("h3");
    title.textContent = (annotation) ? "Edit Annotation" : "Add new Annotation";
    form.appendChild(title);

    // --- Close form button ---
    const closeFormBtn = document.createElement("button");
    closeFormBtn.textContent = "×";
    closeFormBtn.className = "zone-form-close";
    closeFormBtn.title = "Close";
    closeFormBtn.addEventListener("click", () => form.remove());
    form.appendChild(closeFormBtn);

    // --- Title ---
    const titleLabel = document.createElement("label");
    titleLabel.textContent = "Annotation Title *";
    const titleInput = document.createElement("input");
    titleInput.type = "text";
    titleInput.placeholder = "Enter annotation title";
    titleInput.id = "annotationTitle";
    if(annotation) titleInput.value = annotation._title;
    form.appendChild(titleLabel);
    form.appendChild(titleInput);

    // --- Type ---
    const typeLabel = document.createElement("label");
    typeLabel.textContent = "Annotation Type:";
    form.appendChild(typeLabel);

    const typeSelect = document.createElement("select");
    typeSelect.id = "annotationType";
    typeSelect.className = "annotation-type-select";

    // Add options
    const types = ["None", "Painting", "Sculpture", "Room", "Building", "Landscape"];
    types.forEach(t => {
        const opt = document.createElement("option");
        opt.value = t.toLowerCase();
        opt.textContent = t;
        typeSelect.appendChild(opt);
    });

    if(annotation) typeSelect.value = annotation.userData.type;

    form.appendChild(typeSelect);

    // --- Description ---
    const descLabel = document.createElement("label");
    descLabel.textContent = "Description (optional)";
    const descInput = document.createElement("textarea");
    descInput.placeholder = "Enter description (optional)";
    descInput.id = "annotationDescription";
    descInput.rows = 3;
    descInput.style.minHeight = "40px";

    if(annotation) descInput.value = annotation._description;
    form.appendChild(descLabel);
    form.appendChild(descInput);

    // --- Position section ---
    const posLabel = document.createElement("label");
    posLabel.textContent = "Annotation Position:";
    form.appendChild(posLabel);

    const posHint = document.createElement("p");
    posHint.textContent = "Click 'Select Point' to define annotation position.";
    posHint.className = "hint";
    form.appendChild(posHint);

    let measurement = null;
    let annotationPosition = null;
    let check = null;
    
    const posBtn = document.createElement("button");
    posBtn.textContent = "Select Point";
    posBtn.className = "sub-btn";
    posBtn.addEventListener("click", () => {
    measurement = this.viewer.scene.removeAllMeasurements();
    measurement = viewer.measuringTool.startInsertion({
            showDistances: false,
            showAngles: false,
            showCoordinates: true,
            showArea: false,
            closed: true,
            maxMarkers: 1,
            name: 'AnnotationPoint'
        });

        posHint.textContent = "Selecting point... click in the scene.";

        check = setInterval(() => {
            if (measurement.points.length > 0) {
                const p = measurement.points[0].position;
                annotationPosition = [p.x, p.y, p.z];
                posHint.textContent = `Position: [${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}]`;
            }
        }, 300);
    });

    if(annotation){
        const p = annotation.position;
        posHint.textContent = `Position: [${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}]`;

        // measurement = new Potree.Measurement();

    }

    form.appendChild(posBtn);

    // --- Camera Target & Position ---
    const camLabel = document.createElement("label");
    camLabel.textContent = "Camera Settings:";
    form.appendChild(camLabel);

    const camHint = document.createElement("p");
    camHint.textContent = "Capture current camera target and position.";
    camHint.className = "hint";
    form.appendChild(camHint);

    let cameraPosition = null;
    let cameraTarget = null;
    const camBtn = document.createElement("button");
    camBtn.textContent = "Capture Camera";
    camBtn.className = "sub-btn";
    camBtn.addEventListener("click", () => {
        const cam = viewer.scene.getActiveCamera();
        const pos = cam.position;
        const tar = viewer.scene.view.getPivot();

        // Round to 3 decimals
        const posStr = `[${pos.x.toFixed(3)}, ${pos.y.toFixed(3)}, ${pos.z.toFixed(3)}]`;
        const tarStr = `[${tar.x.toFixed(3)}, ${tar.y.toFixed(3)}, ${tar.z.toFixed(3)}]`;

        // Nicely formatted display
        camHint.innerHTML = `
            <b>Camera Position:</b> ${posStr}<br>
            <b>Camera Target:</b> ${tarStr}
        `;

        // Optionally store for later use
        cameraPosition = [pos.x, pos.y, pos.z];
        cameraTarget = [tar.x, tar.y, tar.z];
    });

    if(annotation){
        // Round to 3 decimals
        const pos = annotation.cameraPosition;
        const tar = annotation.cameraTarget;
        const posStr = `[${pos.x.toFixed(3)}, ${pos.y.toFixed(3)}, ${pos.z.toFixed(3)}]`;
        const tarStr = `[${tar.x.toFixed(3)}, ${tar.y.toFixed(3)}, ${tar.z.toFixed(3)}]`;

        // Nicely formatted display
        camHint.innerHTML = `
            <b>Camera Position:</b> ${posStr}<br>
            <b>Camera Target:</b> ${tarStr}
        `;

        cameraPosition = [pos.x, pos.y, pos.z];
        cameraTarget = [tar.x, tar.y, tar.z];
    }

    form.appendChild(camBtn);

    // --- Save Button ---
    const saveBtn = document.createElement("button");
    saveBtn.textContent = "Save Annotation";
    saveBtn.className = "sub-btn save-btn";
    saveBtn.addEventListener("click", () => {

        console.log('measuremnt: ', measurement);
        if (annotation) {
            annotation._title = titleInput.value || "";
            annotation._description = descInput.value || "";
            annotation.cameraPosition = cameraPosition || null;
            annotation.cameraTarget = cameraTarget || null;
            annotation.position = measurement?.points[0].position || annotation.position;

        }
        else {
            const annotationNew = viewer.scene.addAnnotation(measurement?.points[0].position || new THREE.Vector3(-999999, -999999, -999999), {
                title: titleInput.value || "",
                description: descInput.value || "",
                cameraPosition: cameraPosition || null,
                cameraTarget: cameraTarget || null
            });
            annotationNew.visible = false;
            console.log("typeselect ", typeSelect.value);
            annotationNew.userData = annotationNew.userData || {};
            annotationNew.userData.type = typeSelect.value;

            window.annotationsTemp.push(annotationNew);

        }


        // reset the menu

        clearInterval(check);

        viewer.scene.removeMeasurement(measurement);

        setTimeout(() => form.remove(), 100);
        posHint.textContent = "Click 'Select Point' to define annotation position.";
        titleInput.value = "";
        descInput.value = "";
        camHint.textContent = "Capture current camera target and position.";

        measurement = null;
        annotationPosition = null;
        cameraPosition = null;
        cameraTarget = null;
    });
    form.appendChild(saveBtn);

    // --- Cancel Button ---
    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Cancel";
    cancelBtn.className = "sub-btn clear-btn";
    cancelBtn.addEventListener("click", () => form.remove());
    form.appendChild(cancelBtn);

    // Mount as an independent floating panel to the LEFT of the main zone
    // menu so it never crowds the zone form. Falls back to the panel edge
    // if the creation menu happens to be closed.
    document.body.appendChild(form);
    if (!document.getElementById("zoneCreationMenu")) {
        form.style.right = "10px";
    }

}




function updateBoundingBoxList() {
    const bboxList = document.querySelector(".bbox-list");
    const bboxHint = document.querySelector(".bbox-container .hint");
    if (!bboxList || !viewer || !viewer.scene) return;

    const volumes = viewer.scene.volumes;
    bboxList.innerHTML = "";

    if (volumes.length === 0) {
        bboxHint.style.display = "";
        bboxList.style.display = "none";
        return;
    }

    bboxHint.style.display = "none";
    bboxList.style.display = "block";

    volumes.forEach((v, i) => {
        const pos = v.position;
        const li = document.createElement("li");
        li.textContent = `Box ${i + 1}: Position (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})`;
        bboxList.appendChild(li);
    });
}

function buildZoneTree() {

    // Reset children
    window.zones.forEach(z => z.children = []);

    resolveZoneParents();

    // Assign children
    window.zones.forEach(z => {
        if (z.parent && z.parent != 'none') {
            if(z) {
                z.parent.children.push(z);
                if(z.isDefault){
                    z.parent.defaultChild = z;
                }
            }
        }
    });

    const childrenLoaded = new Event("zoneChildrenLoaded");
    document.dispatchEvent(childrenLoaded);

    // Return only root zones
    return window.zones.filter(z => !z.parent);
}


function updateZoneList() {

    updateGlobalOrientedImageToggle();
    // scene_config_panel.js keeps its start-zone list in sync with this
    document.dispatchEvent(new Event("zones-changed"));

    const roots = buildZoneTree();

    const zoneList = document.getElementById("zoneList");
    if (!zoneList) return;

    zoneList.innerHTML = "";

    if (!window.zones || window.zones.length === 0) {
        zoneList.innerHTML = "<li class='zone-empty'>No zones defined yet.</li>";
        return;
    }


    roots.forEach(root => {
        renderZoneNode(root, zoneList, 0);
    });
}

function renderZoneNode(zone, container, depth) {

    const li = document.createElement("li");
    li.className = "zone-item";
    li.draggable = true;
    li.dataset.zoneName = zone.name;

    // Indentation
    li.style.paddingLeft = `${depth * 20}px`;

    // Tree line
    const branch = document.createElement("span");
    branch.textContent = depth > 0 ? "└─ " : "";
    branch.style.color = "#888";
    li.appendChild(branch);

    // Zone label
    const info = document.createElement("span");
    info.textContent =
        `${zone.name} (${zone.pointclouds.length} PCs, ${zone.boundingBoxes?.length || 0} boxes)`;
    li.appendChild(info);

    // Edit button
    const editBtn = document.createElement("button");
    editBtn.textContent = "Edit";
    editBtn.className = "zone-btn edit-btn";
    editBtn.onclick = () => openZoneForm(zone);
    li.appendChild(editBtn);

    // Delete button
    const delBtn = document.createElement("button");
    delBtn.textContent = "Delete";
    delBtn.className = "zone-btn delete-btn";
    delBtn.onclick = () => deleteZone(zone);
    li.appendChild(delBtn);

    addDragHandlers(li);

    container.appendChild(li);

    zone.children.forEach(child => {
        renderZoneNode(child, container, depth + 1);
    });
}

let draggedZoneName = null;

function addDragHandlers(li) {

    li.addEventListener("dragstart", e => {
        draggedZoneName = li.dataset.zoneName;
        li.classList.add("dragging");
    });

    li.addEventListener("dragend", e => {
        li.classList.remove("dragging");
    });

    li.addEventListener("dragover", e => {
        e.preventDefault();
    });

    li.addEventListener("drop", e => {
        e.preventDefault();

        const targetZoneName = li.dataset.zoneName;

        if (draggedZoneName === targetZoneName) return;

        reorderZones(draggedZoneName, targetZoneName);
        updateZoneList();
    });
}

function reorderZones(dragName, targetName) {

    const zones = window.zones;

    const dragIndex = zones.findIndex(z => z.name === dragName);
    const targetIndex = zones.findIndex(z => z.name === targetName);

    if (dragIndex === -1 || targetIndex === -1) return;

    const [dragged] = zones.splice(dragIndex, 1);
    zones.splice(targetIndex, 0, dragged);
}

function findZoneIndex (zoneToFind){
    for(let i = 0; i < window.zones.length; i++){
        const zone = window.zones[i];
        if(zoneToFind === zone) return i;
    }
    return -1;
}

function deleteZone(zone) {
    // console.log(index);
    // const zone = window.zones[index];
    const confirmDel = confirm(`Delete zone "${zone.name}"?`);
    if (!confirmDel) return;
    const index = findZoneIndex(zone);
    window.zones.splice(index, 1);
    updateZoneList();
    console.log(`Deleted zone: ${zone.name}`);

    const badge = document.getElementById("zoneCountBadge");
    badge.innerHTML = window.zones.length;
}


function resolveZoneParents() {

    // Create a map: name -> zone object
    const zoneMap = {};
    window.zones.forEach(z => {
        zoneMap[z.name] = z;
    });

    // Replace parent string with actual object reference
    window.zones.forEach(zone => {
        if (typeof zone.parent === "string" && zone.parent !== "none") {
            zone.parent = zoneMap[zone.parent] || null;
        }
    });
    resolveZonePriorities();


}

function resolveZonePriorities () {
    window.zones.forEach(zone => {
        zone.priority = getZonePriority(zone);
    });
}

function getZonePriority(zone, visited = new Set()) {

    // Prevent circular references
    if (visited.has(zone)) {
        console.warn("Circular parent reference detected:", zone.name);
        return 1;
    }

    visited.add(zone);

    // Root case
    if (!zone.parent || zone.parent == "none") {
        return 1;
    }

    return getZonePriority(zone.parent, visited) + 1;
}

/**
 * Export all zones to a downloadable JSON file. When the scene has a
 * sceneConfig (scene_config.js) the file is schema 2 and carries it too;
 * otherwise it is the old-style array.
 */
function exportZonesToJSON() {
    const sceneConfig = window.sceneConfig;
    if (!sceneConfig && (!window.zones || window.zones.length === 0)) {
        alert("No zones to export!");
        return;
    }

    // Picks up zones made since the scene loaded, and a DOI set in Scene Setup since.
    inheritSceneDataset();
    const zonesData = zonesToJSON();
    const fileData = sceneConfig
        ? { schema: 2, sceneConfig: sceneConfig.toJSON(), zones: zonesData }
        : zonesData;

    const blob = new Blob([JSON.stringify(fileData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "zones.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Plain JSON data for window.zones (no circular refs, only the essentials)
function zonesToJSON() {
    return (window.zones || []).map(z => ({
        name: z.name,
        priority: z.priority,
        parent: z.parent?.name || null,
        pointclouds: z.pointclouds.map(pc => pc.name || pc.id || pc),
        boundingBoxes: z.boundingBoxes,
        layerMaps: (z.layerMaps || []).map(lm => ({
            name: lm.name,
            boundingBoxes: lm.boundingBoxes,
            layersList: (lm.layersList || []).map(layer => ({
                name: layer.name,
                pointcloud: layer.pointcloud?.name || layer.pointcloud
            }))
        })),
        marker360s: (z.marker360s || []).map(mk => ({
            name: mk.name,
            position: mk.position,
            image: mk.image,
            sphereCorrection: mk.sphereCorrection,
            tiles: mk.tiles
        })),
        annotations: (z.annotations || []).map(a => ({
        position: a.position ? [a.position.x, a.position.y, a.position.z] : a.annotationPosition || [0, 0, 0],
        title: a.title || "",
        type: a.userData?.type || "none",
        description: a.description || "",
        cameraPosition: a.cameraPosition || [0, 0, 0],
        cameraTarget: a.cameraTarget || [0, 0, 0],
        })), 
        description: z.description || ``,
        beacon: (z.beacon) ? {cameraPosition: z.beacon.cameraPosition, cameraTarget: z.beacon.cameraTarget, position: z.beacon.position} : null,
        background: z.background || 'gradient',
        isDefault: z.isDefault || false,
        doi: z.doi ?? null,
        vtype: z.vtype ?? null,
        orientedImagesHandlers: (z.orientedImagesHandlers
            || (z.orientedImagesHandler ? [z.orientedImagesHandler] : [])
        ).map(h => ({
            name: h.name || "",
            cameraParamsPath: h.cameraParamsPath,
            imageParamsPath: h.imageParamsPath
        }))

    }));
}

function resolvePointCloudByName(name) {
    if(!name) return null;
    if (!viewer || !viewer.scene || !viewer.scene.pointclouds) return null;
    return viewer.scene.pointclouds.find(pc => pc.name.trim() === name.trim()) || null;
}

// A zone of the scene's own dataset takes the sceneConfig's doi and vtype. Only empty values are
// filled in: a zone that names another dataset keeps it, and a vtype is only filled in beside the
// scene's own doi, so a zone never ends up pointing at another dataset in this scene's archive.
function inheritSceneDataset(zones = window.zones) {
    const sc = window.sceneConfig;
    if (!sc?.doi) return;
    for (const zone of zones) {
        if (zone.doi == null) zone.doi = sc.doi;
        if (zone.vtype == null && zone.doi === sc.doi) zone.vtype = sc.vtype;
    }
}

// The zone list of a zones.json: the file itself in the old format, its
// `zones` in schema 2.
function zonesArrayOf(data) {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.zones)) return data.zones;
    throw new Error("Invalid zone data format.");
}

// Build Zone objects from zones.json data. Point clouds are matched on
// pc.name, so they must already be in the scene.
function zonesFromJSON(list) {
    return list.map(z => {
        // Reconstruct bounding boxes as plain data objects
        const boxes = z.boundingBoxes;

        // Re-link pointclouds if they exist in viewer
        const pcs = [];
        if (viewer && viewer.scene && viewer.scene.pointclouds) {
            for (let pc of viewer.scene.pointclouds) {
                if (z.pointclouds.includes(pc.name)) pcs.push(pc);
            }
        }

        const layerMaps = [];

        if (Array.isArray(z.layerMaps)) {
            for (const lm of z.layerMaps) {
                const layersList = [];

                if (Array.isArray(lm.layersList)) {
                    for (const l of lm.layersList) {                                
                        const pc = resolvePointCloudByName(l.pointcloud);
                        layersList.push({
                            name: l.name,
                            pointcloud: pc
                        });
                    }
                }

                layerMaps.push({
                    name: lm.name,
                    boundingBoxes: lm.boundingBoxes || [],
                    layersList
                });
            }
        }

        const marker360s = [];

        if (Array.isArray(z.marker360s)){
            for(const mk of z.marker360s){
                marker360s.push(new Marker360(
                    mk.name,
                    mk.position,
                    mk.image,
                    mk.sphereCorrection,
                    mk.tiles
                ));
            }
        }


        const annotations = [];
        if (Array.isArray(z.annotations)) {
            for (const a of z.annotations) {
                const ann = viewer.scene.addAnnotation(a.position, {
                title: a.title,
                type: a.type,
                description: a.description,
                cameraPosition: a.cameraPosition,
                cameraTarget: a.cameraTarget
                });
                ann.visible = false;
                ann.userData = { type: a.type || "none" };
                // console.log(ann);
                annotations.push(ann);
            }
        }


        const orientedHandlers = buildOrientedImagesHandlers(z);
        return new Zone(z.name, z.parent, Number(z.priority), pcs, boxes, annotations, layerMaps, marker360s, z.beacon || null, z.description || ``, z.background || "gradient", z.isDefault || false, orientedHandlers, z.doi ?? null, z.vtype ?? null);
    });
}


/**
 * Import zones from a JSON file and merge them into the existing ones.
 */
function importZonesFromJSON() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";

    input.addEventListener("change", (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
        try {
            const summary = await importZonesData(JSON.parse(e.target.result));
            alert(`Zones imported: ${summary}`);
        } catch (err) {
            console.error(err);
            alert("Failed to import zones: " + err.message);
        }

        };

        reader.readAsText(file);
    });

    input.click();
}

/**
 * Import the zones.json of a dataset in one of the archives (index.html's
 * VTYPE_CONFIG), found the way index.html finds a scene's own.
 */
async function importZonesFromDataset(vtype, doi, name = null) {
    const url = new URL(VTYPE_CONFIG[vtype].datasetPrefix + doi + "/potree/zones.json", window.location.href).href;
    const data = await fetchZonesFile(url);
    if (!data) throw new Error(`no zones.json could be read from ${url}`);
    // A typed DOI can still have a name in the archive's project list.
    if (!name) name = (await fetchProjectList(vtype))?.find(p => p.doi === doi)?.name || null;
    return importZonesData(data, { vtype, doi, name });
}

/**
 * Merge zones.json data (old-style array or schema 2) into the scene. When
 * some names are already taken, the user picks whether the imported zones
 * replace those or are skipped. `dataset` ({ vtype, doi, name }) is where the
 * file came from, if not this scene's own dataset: its zones are then tagged
 * with it and gathered under one zone for it. Returns a summary for the user.
 */
async function importZonesData(importedData, dataset = null) {
    const list = zonesArrayOf(importedData);

    // Zones are matched by name (parents, start zones and share links refer to them that way).
    const existing = new Map(window.zones.map(z => [z.name, z]));
    const clashes = list.filter(z => existing.has(z.name)).map(z => z.name);
    const replace = clashes.length > 0 && confirm(
        `These zones already exist: ${clashes.join(", ")}.\n\n` +
        "OK: replace them with the imported ones.\n" +
        "Cancel: keep the existing ones and skip these.");
    const incoming = list.filter(z => replace || !existing.has(z.name));
    const skipped = list.length - incoming.length;

    // From a dataset: every imported zone gets its doi and vtype (one that already names a dataset keeps
    // its own), and the top-level ones go under a zone for the dataset, reused when it's imported again.
    let groupName = null, groupCreated = false;
    if (dataset && incoming.length) {
        groupName = dataset.name ? `${dataset.name} (${dataset.doi})` : dataset.doi;
        const names = new Set(list.map(z => z.name));
        for (let i = 0; i < incoming.length; i++) {
            const z = incoming[i] = { ...incoming[i] };
            z.doi = z.doi ?? dataset.doi;
            z.vtype = z.vtype ?? dataset.vtype;
            if (!z.parent || z.parent === "none" || !names.has(z.parent)) z.parent = groupName;
        }
        if (!existing.has(groupName)) {
            groupCreated = true;
            incoming.unshift({
                name: groupName, priority: 1, parent: null, pointclouds: [], boundingBoxes: [], layerMaps: [],
                marker360s: [], annotations: [], description: "", beacon: null, background: "gradient",
                isDefault: false, doi: dataset.doi, vtype: dataset.vtype,
            });
        }
    }

    // A schema-2 file brings its own clouds. They go in first: zones match clouds by name.
    const schema2 = typeof isSceneConfigFile === "function" && isSceneConfigFile(importedData);
    const cloudIds = schema2 ? await mergeImportedSceneConfig(importedData.sceneConfig, dataset) : [];

    const added = zonesFromJSON(incoming);
    const reshow = [];
    let replaced = 0;
    for (const zone of added) {
        const old = existing.get(zone.name);
        if (!old) {
            window.zones.push(zone);
            continue;
        }
        // Same place in the list, same children, and still on if it was.
        if (window.newVisibleZones.has(old)) reshow.push(zone);
        disposeZone(old);
        window.zones[window.zones.indexOf(old)] = zone;
        for (const z of window.zones) if (z.parent === old) z.parent = zone;
        replaced++;
    }
    initAddedZones(added);
    for (const zone of reshow) setZoneVisibility(zone, true);

    const parts = [`${added.length - replaced - (groupCreated ? 1 : 0)} added` + (groupName ? ` under "${groupName}"` : "")];
    if (replaced) parts.push(`${replaced} replaced`);
    if (skipped) parts.push(`${skipped} skipped`);
    if (cloudIds.length) parts.push(`${cloudIds.length} point cloud${cloudIds.length === 1 ? "" : "s"} added`);
    let summary = parts.join(", ") + ".";

    // Zones can only hold clouds that are in the scene; say which ones they asked for and didn't get.
    const missing = [...new Set(incoming.flatMap(z => z.pointclouds || []))].filter(name => !resolvePointCloudByName(name));
    if (missing.length) {
        summary += `\n\n${missing.length} point cloud${missing.length === 1 ? " the zones use is" : "s the zones use are"} ` +
            `not in this scene, so ${missing.length === 1 ? "it was" : "they were"} left out: ` +
            missing.slice(0, 8).join(", ") + (missing.length > 8 ? ", …" : "") + ".";
        if (dataset && !schema2) {
            summary += " That dataset's zones.json is the old format, which doesn't say where its point clouds are.";
        }
    }
    return summary;
}

// Each archive's projects, from its website's api/potree_projects.php ({ doi: project name }), as
// [{ doi, name }] sorted by name, or null when the archive's site doesn't serve the list. Fetched once
// per page, failures included, so archives without one aren't asked again on every keystroke.
const _projectLists = new Map();
function fetchProjectList(vtype) {
    if (!_projectLists.has(vtype)) {
        const site = VTYPE_CONFIG[vtype]?.website;
        _projectLists.set(vtype, !site ? Promise.resolve(null) : fetch(`${site}/api/potree_projects.php`)
            .then(res => res.ok ? res.json() : null)
            .then(data => data && typeof data === "object" && !Array.isArray(data)
                ? Object.entries(data)
                    .map(([doi, name]) => ({ doi, name: String(name || doi) }))
                    .sort((a, b) => a.name.localeCompare(b.name))
                : null)
            .catch(() => null));
    }
    return _projectLists.get(vtype);
}

// "Import from a dataset": an archive from index.html's VTYPE_CONFIG and one of its projects, picked
// from a searchable list (or typed as a DOI when the archive has no list); that dataset's zones.json is
// merged in, then onImported() runs. Null on pages without VTYPE_CONFIG (standalone.html, other sites).
function createDatasetImportRow(onImported = null) {
    if (typeof VTYPE_CONFIG === "undefined") return null;
    const MAX_ROWS = 200;

    const box = document.createElement("div");
    box.className = "zone-dataset-import";

    const label = document.createElement("div");
    label.className = "zone-dataset-import-label";
    label.textContent = "Import zones from a dataset";
    box.appendChild(label);

    const row = document.createElement("div");
    row.className = "zone-dataset-import-row";
    box.appendChild(row);

    const archive = document.createElement("select");
    archive.title = "Archive";
    for (const [key, cfg] of Object.entries(VTYPE_CONFIG)) {
        const opt = document.createElement("option");
        opt.value = key;
        opt.textContent = cfg.websiteName || key;
        archive.appendChild(opt);
    }
    // Start on the archive this scene is from.
    const current = Object.keys(VTYPE_CONFIG).find(k => VTYPE_CONFIG[k].datasetPrefix === window.datasetPrefix);
    if (current) archive.value = current;
    row.appendChild(archive);

    const search = document.createElement("input");
    search.type = "text";
    search.placeholder = "Search or type a DOI";
    search.spellcheck = false;
    search.autocomplete = "off";
    row.appendChild(search);

    const btn = document.createElement("button");
    btn.className = "close-btn";
    btn.textContent = "Import";
    row.appendChild(btn);

    // In the panel's flow rather than floating: the window frame clips anything that overflows it.
    const list = document.createElement("div");
    list.className = "zone-dataset-list";
    list.hidden = true;
    box.appendChild(list);

    const status = document.createElement("div");
    status.className = "zone-dataset-status";
    box.appendChild(status);

    let loadedFor = null;     // archive whose list was asked for
    let loading = false;
    let projects = null;      // that archive's [{ doi, name }], or null if it has none
    let chosen = null;        // the project picked from the list
    let matches = [];
    let active = -1;          // highlighted row

    const showStatus = () => {
        if (loading) status.textContent = "Loading projects…";
        else if (chosen) status.textContent = `DOI ${chosen.doi}`;
        else if (projects) status.textContent = `${projects.length} projects. Search by name or DOI.`;
        else if (loadedFor) status.textContent = "This archive has no project list. Type a DOI.";
        else status.textContent = "";
    };

    const highlight = i => {
        active = i;
        [...list.children].forEach((el, j) => el.classList.toggle("active", j === i));
        list.children[i]?.scrollIntoView({ block: "nearest" });
    };

    const pick = project => {
        chosen = project;
        search.value = project.name;
        list.hidden = true;
        showStatus();
    };

    const showList = () => {
        const q = search.value.trim().toLowerCase();
        matches = (projects || []).filter(p => !q || p.name.toLowerCase().includes(q) || p.doi.toLowerCase().includes(q));
        const rows = matches.slice(0, MAX_ROWS).map(project => {
            const item = document.createElement("div");
            item.className = "zone-dataset-item";
            const name = document.createElement("span");
            name.className = "zone-dataset-name";
            name.textContent = project.name;
            name.title = project.name;
            const doi = document.createElement("span");
            doi.className = "zone-dataset-doi";
            doi.textContent = project.doi;
            item.append(name, doi);
            // mousedown, not click: it fires before the input loses focus and closes the list
            item.addEventListener("mousedown", e => { e.preventDefault(); pick(project); });
            return item;
        });
        if (matches.length > MAX_ROWS) {
            const more = document.createElement("div");
            more.className = "zone-dataset-more";
            more.textContent = `${matches.length - MAX_ROWS} more. Keep typing to narrow it down.`;
            rows.push(more);
        }
        list.replaceChildren(...rows);
        list.hidden = matches.length === 0;
        highlight(matches.length ? 0 : -1);
    };

    const load = async () => {
        const vtype = archive.value;
        loadedFor = vtype;
        loading = true;
        showStatus();
        const result = await fetchProjectList(vtype);
        if (archive.value !== vtype) return;     // switched archives meanwhile
        loading = false;
        projects = result;
        showStatus();
        if (document.activeElement === search) showList();
    };

    const run = async () => {
        const typed = search.value.trim();
        const lower = typed.toLowerCase();
        const project = chosen || projects?.find(p => p.doi.toLowerCase() === lower || p.name.toLowerCase() === lower);
        const doi = project ? project.doi : typed;
        if (!doi) { search.focus(); return; }

        list.hidden = true;
        btn.disabled = true;
        btn.textContent = "Importing…";
        try {
            const summary = await importZonesFromDataset(archive.value, doi, project?.name);
            alert(`Zones imported from ${project ? `${project.name} (${doi})` : doi}: ${summary}`);
            if (onImported) onImported();
        } catch (err) {
            console.error(err);
            alert("Failed to import zones: " + err.message);
        } finally {
            btn.disabled = false;
            btn.textContent = "Import";
        }
    };

    archive.addEventListener("change", () => {
        chosen = null;
        search.value = "";
        projects = null;
        load();
    });
    search.addEventListener("focus", () => {
        if (loadedFor !== archive.value) load();
        else if (!chosen) showList();
    });
    search.addEventListener("blur", () => { list.hidden = true; });
    search.addEventListener("input", () => {
        chosen = null;
        showStatus();
        showList();
    });
    search.addEventListener("keydown", e => {
        const listOpen = !list.hidden && matches.length > 0;
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            if (!listOpen) showList();
            else highlight((active + (e.key === "ArrowDown" ? 1 : -1) + Math.min(matches.length, MAX_ROWS)) % Math.min(matches.length, MAX_ROWS));
        } else if (e.key === "Enter") {
            // First Enter picks the highlighted project, the next one imports it.
            if (listOpen && active >= 0) pick(matches[active]);
            else run();
        } else if (e.key === "Escape") {
            list.hidden = true;
        } else {
            return;
        }
        e.preventDefault();
        e.stopPropagation();     // keep these keys away from the viewer's own shortcuts
    });
    btn.addEventListener("click", run);

    return box;
}

style.textContent += `
/* Import zones from a dataset: a full-width row under the export/import buttons */
.zone-dataset-import {
    grid-column: 1 / -1;
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 2px;
    padding-top: 8px;
    border-top: 1px solid rgba(255,255,255,0.09);
}
.zone-dataset-import-label { font-size: 12px; color: #a1a1aa; }
.zone-dataset-import-row { display: flex; gap: 6px; }
.zone-dataset-import select,
.zone-dataset-import input {
    min-width: 0;
    padding: 6px 8px;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.14);
    border-radius: 7px;
    color: #f0f0f5;
    font-size: 12px;
    outline: none;
}
.zone-dataset-import select { flex: 0 1 36%; cursor: pointer; }
.zone-dataset-import select option { background: #1b1c20; color: #fff; }
.zone-dataset-import input { flex: 1 1 auto; }
.zone-dataset-import input::placeholder { color: #71717a; }
.zone-dataset-import select:focus,
.zone-dataset-import input:focus { border-color: #6e6bff; }
.zone-io-container .zone-dataset-import .close-btn { width: auto; flex: 0 0 auto; }
.zone-io-container .zone-dataset-import .close-btn:disabled { opacity: 0.6; cursor: default; }

.zone-dataset-list {
    max-height: 200px;
    overflow-y: auto;
    padding: 3px;
    background: rgba(0,0,0,0.35);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 7px;
}
.zone-dataset-list::-webkit-scrollbar { width: 5px; }
.zone-dataset-list::-webkit-scrollbar-thumb { background: #444; border-radius: 3px; }
.zone-dataset-item {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 5px 7px;
    border-radius: 5px;
    color: #e5e7eb;
    font-size: 12px;
    cursor: pointer;
}
.zone-dataset-item:hover,
.zone-dataset-item.active { background: rgba(79,70,229,0.35); }
.zone-dataset-name { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.zone-dataset-doi { flex: 0 0 auto; color: #9ca3af; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 11px; }
.zone-dataset-more { padding: 5px 7px; color: #8b8b98; font-size: 11.5px; }
.zone-dataset-status { font-size: 11.5px; color: #8b8b98; }
.zone-dataset-status:empty { display: none; }

/* Inside the zone form it sits in its own section, under the form's input/button styles */
.zone-form .zone-dataset-import { margin: 0; padding: 0; border-top: none; }
.zone-form .zone-dataset-import-label { display: none; }
.zone-form .zone-dataset-import select,
.zone-form .zone-dataset-import input { margin: 0; padding: 6px 8px; font-size: 12px; }
.zone-form .zone-dataset-import .close-btn { width: auto; flex: 0 0 auto; margin: 0; padding: 6px 12px; font-size: 12px; }
.zone-form .zone-dataset-import .close-btn:disabled { opacity: 0.6; cursor: default; }
`;


/**
 * Automatically load "zones.json" from the same directory (if present)
 * and import it using the same logic as importZonesFromJSON.
 */
async function autoLoadZonesJSON(json) {
    // Fetched again even though index.html already has it: initZones() only waits for the clouds
    // added so far, and this round trip is what gives config.js time to add the rest before
    // zones match them by name.
    const importedData = await fetchZonesFile(json);
    if (!importedData) return false;

    try {
        window.zones = zonesFromJSON(zonesArrayOf(importedData));

        initZonesOps();
        document.addEventListener("pointermove", onPointerMove, { passive: true });

        console.log("zones.json loaded successfully.");
        return true;
    } catch (err) {
        console.error("Error parsing zones.json:", err);
        return false;
    }
}

// Fetch and parse a zones.json; null when it is missing or unreadable.
async function fetchZonesFile(url) {
    try {
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) {
            console.warn("zones.json not found or failed to load.");
            return null;
        }
        return await response.json();
    } catch (err) {
        console.warn("No zones.json found or failed to load:", err);
        return null;
    }
}


function setAnnotationVisibility(annotation, visibility){
    annotation.visible = (annotation.position.x === -999999) ? false : visibility;
}

function enableFirstZone () {
    if(window.zones.length === 1){
        zoneOnlyToggle(window.zones[0]);
    }
}

function initZonesOps () {
    createLayerBoxes();
    loadMarker360s();
    updateZoneList();
    updateZoneCount();
    loadBeacons();
    resolveZoneParents();
    enableFirstZone();
    // One-time startup restore: zone visibility from the URL, or inferred
    // from the default pointcloud visibility (viewer_state_retainer.js).
    if (typeof applyZoneVisibilityFromURL === "function") applyZoneVisibilityFromURL();
    // Oriented images start disabled — zone activation above may have
    // switched some sets on; mask everything off via the same global
    // toggle the user would otherwise click.
    setAllOrientedImagesVisibility(false);
}

// Set up zones added after startup (an import). initZonesOps() is for a whole new zone list: its
// loaders walk every zone in window.zones and would duplicate the objects of zones already set up.
function initAddedZones(added) {
    // createLayerBoxes() and loadMarker360s() set up every zone in window.zones, so for the
    // moment they run, that is just the added ones.
    const all = window.zones;
    window.zones = added;
    try {
        createLayerBoxes();
        loadMarker360s();
    } finally {
        window.zones = all;
    }
    updateZoneList();       // also resolves parents and rebuilds zone.children, which beacons hang off
    updateZoneCount();
    rebuildZoneBeacons();
    enableFirstZone();
    if (typeof _refreshZoneSearchPanel === "function") _refreshZoneSearchPanel();
}

// Take a zone that is being replaced out of the scene: switch it off, then remove
// what it added (annotations, layer-map boxes, 360 markers, its beacon).
function disposeZone(zone) {
    if (window.newVisibleZones.has(zone)) setZoneVisibility(zone, false);
    _currentlyVisibleZones.delete(zone);
    if (window._isolatedZone === zone) window._isolatedZone = null;
    resetZoneOrientedImages(zone, false);

    for (const ann of zone.annotations || []) viewer.scene.removeAnnotation(ann);
    for (const lm of zone.layerMaps || []) lm._triggerBox?.parent?.remove(lm._triggerBox);
    for (const mk of zone.marker360s || []) mk._sphereMarker?.parent?.remove(mk._sphereMarker);
    zone.beacon?._sphere?.parent?.remove(zone.beacon._sphere);
}

// A zone's beacon is built by its parent's createBeacons(), so when the tree changes the
// beacons are rebuilt from the roots down rather than patched. Beacons that existed keep
// their visibility; new ones show when their parent zone is on.
function rebuildZoneBeacons() {
    const shown = new Map();
    for (const zone of window.zones) {
        const beacon = zone.beacon;
        if (!beacon?._sphere) continue;
        shown.set(zone, beacon._sphere.visible);
        beacon._sphere.parent?.remove(beacon._sphere);
        delete beacon._sphere;
        delete beacon._hitMesh;
        delete beacon._raycast;
    }
    for (const root of window.zones.filter(z => !z.parent || z.parent === "none")) createBeacons(root);

    for (const zone of window.zones) {
        const beacon = zone.beacon;
        if (!beacon?._sphere) continue;
        const visible = shown.has(zone) ? shown.get(zone) : window.newVisibleZones.has(zone.parent);
        beacon._sphere.visible = visible;
        if (beacon._hitMesh) beacon._hitMesh.raycast = visible ? beacon._raycast : () => {};
    }
}



// document.addEventListener("DOMContentLoaded", autoLoadZonesJSON);


// ── Pre-allocated reusables (never GC'd) ──
const _boxPos = new THREE.Vector3();
const _boxRot = new THREE.Euler();
const _boxScale = new THREE.Vector3();
const _boxObj = new THREE.Object3D();
const _invMatrix = new THREE.Matrix4();
const _localPt = new THREE.Vector3();

function isPointInsideBox(point, box) {
    _boxPos.fromArray(box.position);
    _boxRot.set(box.rotation[0], box.rotation[1], box.rotation[2], box.rotation[3] || 'XYZ');
    _boxScale.fromArray(box.scale);

    _boxObj.position.copy(_boxPos);
    _boxObj.rotation.copy(_boxRot);
    _boxObj.scale.copy(_boxScale);
    _boxObj.updateMatrixWorld(true);

    _invMatrix.copy(_boxObj.matrixWorld).invert();
    _localPt.copy(point).applyMatrix4(_invMatrix);

    return (
        Math.abs(_localPt.x) <= 0.5 &&
        Math.abs(_localPt.y) <= 0.5 &&
        Math.abs(_localPt.z) <= 0.5
    );
}

// ── Persistent state ──
const _currentlyVisibleZones = new Set();

// ── Helpers to avoid duplication ──
function _addZoneVolumes(zone) {
    zone._volumes = [];
    for (const box of zone.boundingBoxes) {
        const vol = new Potree.BoxVolume();
        vol.position.set(...box.position);
        vol.rotation.set(...box.rotation.slice(0, 3));
        vol.scale.set(...box.scale);
        vol.clip = true;
        vol.visible = false;
        vol.name = zone.name;
        vol._isZoneVol = true;
        zone._volumes.push(vol);
        viewer.scene.addVolume(vol);
    }
}

function _removeZoneVolumes(zone) {
    if (zone._volumes) {
        for (const vol of zone._volumes) viewer.scene.removeVolume(vol);
        zone._volumes = [];
    }
}

// ══════════════════════════════════════════════════════════════
//  Oriented images (per-zone) visibility
// ══════════════════════════════════════════════════════════════

// All of a zone's oriented-image handlers (image sets). Also picks up the
// legacy single-handler field on zones built by old code.
function _zoneOrientedImageHandlers(zone) {
    if (!zone) return [];
    const handlers = zone.orientedImagesHandlers
        || (zone.orientedImagesHandler ? [zone.orientedImagesHandler] : []);
    return handlers.filter(h => h);
}

// All of a zone's oriented-image collections whose images finished loading.
function _zoneOrientedCollections(zone) {
    return _zoneOrientedImageHandlers(zone)
        .map(h => h.images)
        .filter(c => c && c.images && c.images.length);
}

// True when the zone has at least one handler whose images have finished loading.
function zoneHasOrientedImages(zone) {
    return _zoneOrientedCollections(zone).length > 0;
}

// Per-set UI preference: is this image set allowed on screen?
// Default true; the search-menu toggle flips handler._hidden. The global
// toolbar toggle masks every set while it is off.
function orientedImageSetEnabled(handler) {
    if (window.imageMarkersGloballyHidden) return false;
    return !!handler && handler._hidden !== true;
}

// Show / hide ONE oriented-image collection of a zone. Pointclouds, boxes,
// beacons, annotations and 360 markers are left untouched.
function setZoneOrientedImagesVisibility(collection, visible) {
    if (!(collection && collection.images && collection.images.length)) return;

    // The global toolbar toggle is a render mask: while it is off nothing may
    // be shown, no matter which path asks (zone switches, set toggles, load
    // completion). Per-set _hidden state keeps tracking underneath so the
    // right sets come back when the mask lifts.
    if (visible && window.imageMarkersGloballyHidden) visible = false;

    if (visible) {
        if (!viewer.scene.orientedImages.includes(collection)) {
            viewer.scene.addOrientedImages(collection);
        }
        if (collection.node) collection.node.visible = true;
    } else {
        if (viewer.scene.orientedImages.includes(collection)) {
            viewer.scene.removeOrientedImages(collection);
        }
        // removeOrientedImages() only updates bookkeeping; the marker node may
        // have been adopted into the oriented-image overlay scene, so hide it
        // directly to actually take it off screen.
        if (collection.node) collection.node.visible = false;
    }

    // The interaction raycaster in potree.js tests the image meshes directly,
    // and this THREE build's intersectObject() checks object.layers, NOT
    // object.visible. So toggling visibility (node or mesh) does not stop
    // hover/click picking. Move each mesh/line on/off the default layer so
    // hidden oriented images are neither drawn nor pickable.
    if (collection.images) {
        for (const img of collection.images) {
            for (const obj of [img.mesh, img.line]) {
                if (!obj) continue;
                obj.layers.mask = visible ? 1 : 0;  // 1 = layer 0 (default), 0 = no layers
                obj.visible = visible;
            }
        }
    }
}

// UI-facing toggle used by the zone-search menu. Flips just ONE image set's
// visibility. Independent of whether the zone itself is currently shown or
// hidden — a set's checkbox can always be operated on its own; it's only the
// zone's own visibility toggle that forces all sets back in sync
// (see setZoneVisibility / _enableZone / _disableZone).
function toggleOrientedImageSet(handler, visible) {
    if (!handler) return;

    // Enabling one set while the global toggle is off: lift the global mask
    // but switch every other set off, so exactly this set becomes visible.
    if (visible && window.imageMarkersGloballyHidden) {
        window.imageMarkersGloballyHidden = false;
        for (const z of window.zones || []) {
            for (const h of _zoneOrientedImageHandlers(z)) {
                if (h === handler) continue;
                h._hidden = true;
                if (h.images) setZoneOrientedImagesVisibility(h.images, false);
            }
        }
        _syncGlobalOIBubble();
    }

    handler._hidden = !visible;
    if (handler.images) setZoneOrientedImagesVisibility(handler.images, visible);
    refreshZoneCheckboxStates();
}

// Force ALL of a zone's image sets to `visible`, clearing any per-set manual
// override. Used when the zone itself is switched on/off. While the global
// toggle is off, _hidden still tracks the intended state; the render mask in
// setZoneOrientedImagesVisibility keeps everything off screen.
function resetZoneOrientedImages(zone, visible) {
    for (const handler of _zoneOrientedImageHandlers(zone)) {
        handler._hidden = !visible;
        if (handler.images) setZoneOrientedImagesVisibility(handler.images, visible);
    }
}

// ══════════════════════════════════════════════════════════════
//  Global oriented-image toggle (inline toolbar button, between
//  Material and Zones — markup lives in index.html as
//  #oiToggleSection/#oiToggleSeparator/#globalOIToggle)
// ══════════════════════════════════════════════════════════════

window.imageMarkersGloballyHidden = false;

// Master switch for every image set and 360 marker of every zone.
// Turning it ON is a genuine "force everything on", not just lifting a mask
// over whatever state zone activation happened to leave behind — a set
// whose owning zone was never actually entered via _enableZone (e.g. the
// scene's starting zone, which the startup URL/pointcloud-visibility
// inference in applyZoneVisibilityFromURL() can mark "visible" without ever
// calling _enableZone) would otherwise be stuck on its constructor default
// of _hidden = true forever, no matter how many times the button is pressed.
// Turning it OFF is still just a mask: per-set/per-zone state is left alone
// so zone switches keep tracking it underneath while everything is hidden.
function setAllOrientedImagesVisibility(visible) {
    window.imageMarkersGloballyHidden = !visible;

    for (const z of window.zones || []) {
        for (const h of _zoneOrientedImageHandlers(z)) {
            if (visible) h._hidden = false;
            if (!h.images) continue;
            setZoneOrientedImagesVisibility(h.images, visible);
        }
        if (z.marker360s && z.marker360s.length) {
            if (visible) z._marker360sVisible = true;
            _applyMarker360sVisibility(z, visible);
        }
    }
    _syncGlobalOIBubble();
    refreshZoneCheckboxStates();
}

// ══════════════════════════════════════════════════════════════
//  Immersive image view (oriented image / 360 photo)
//
//  While the user is standing inside a photo, every OTHER marker reads as
//  clutter, so it is hidden for the duration. This is a raw visual mask —
//  it never touches handler._hidden / zone._marker360sVisible / the global
//  toggle — so on exit, recomputing visibility from that untouched tracked
//  state (which already factors in the global toggle) puts back exactly
//  what was visible before immersion started, nothing more.
//
//  exceptCollection lets the oriented-image set the just-focused photo
//  belongs to opt out: its own sibling markers are already managed by
//  showOnly()/showAll() in potree.js, so this only clears every OTHER set.
// ══════════════════════════════════════════════════════════════

function hideOtherImageMarkersForImmersion(exceptCollection) {
    for (const z of window.zones || []) {
        for (const h of _zoneOrientedImageHandlers(z)) {
            if (h.images === exceptCollection) continue;
            if (h.images) setZoneOrientedImagesVisibility(h.images, false);
        }
        if (z.marker360s && z.marker360s.length) {
            _applyMarker360sVisibility(z, false);
        }
    }
}

function restoreImageMarkerVisibility() {
    for (const z of window.zones || []) {
        for (const h of _zoneOrientedImageHandlers(z)) {
            if (h.images) setZoneOrientedImagesVisibility(h.images, !h._hidden);
        }
        if (z.marker360s && z.marker360s.length) {
            _applyMarker360sVisibility(z, z._marker360sVisible !== false);
        }
    }
}

window.hideOtherImageMarkersForImmersion = hideOtherImageMarkersForImmersion;
window.restoreImageMarkerVisibility = restoreImageMarkerVisibility;

// Mirror the global flag onto the button's visual state.
function _syncGlobalOIBubble() {
    const btn = document.getElementById("globalOIToggle");
    if (btn) btn.classList.toggle("oi-off", window.imageMarkersGloballyHidden === true);
}

// Keep the toolbar button in sync with the zone data: shown only when at
// least one zone defines an image set or a 360 marker. Called from
// updateZoneList(), which runs on zone import, save and delete.
function updateGlobalOrientedImageToggle() {
    const section = document.getElementById("oiToggleSection");
    const separator = document.getElementById("oiToggleSeparator");
    const btn = document.getElementById("globalOIToggle");
    if (!section || !separator || !btn) return;

    const hasAny = (window.zones || []).some(z =>
        _zoneOrientedImageHandlers(z).length > 0 ||
        (Array.isArray(z.marker360s) && z.marker360s.length > 0)
    );

    section.style.display = hasAny ? "" : "none";
    separator.style.display = hasAny ? "" : "none";

    if (!btn.dataset.wired) {
        btn.dataset.wired = "1";
        btn.addEventListener("click", () => {
            setAllOrientedImagesVisibility(window.imageMarkersGloballyHidden === true);
        });
    }

    _syncGlobalOIBubble();
}

function _enableZone(zone) {
    for (const pc of zone.pointclouds) pc.visible = true;
    _addZoneVolumes(zone);
    for (const ann of zone.annotations) setAnnotationVisibility(ann, true);
    for (const lm of zone.layerMaps) setLayerMapVisibility(lm, true);
    if (zone.marker360s.length) setMarker360sVisibilityByZone(zone, true);
    setBeaconVisibilitybyZone(zone, true);
    // Oriented images are linked to zone visibility: turning the zone on
    // always brings its images along, resetting any prior manual override.
    resetZoneOrientedImages(zone, true);

    const defaultChild = getDefaultChild(zone);
    if(defaultChild) {
        _enableZone(defaultChild);
        setBeaconVisibility(defaultChild.beacon, false);
    }
}

function getDefaultChild(zone){
    return zone.defaultChild;
}

function _disableZone(zone) {
    _removeZoneVolumes(zone);
    for (const pc of zone.pointclouds) pc.visible = false;
    for (const ann of zone.annotations) setAnnotationVisibility(ann, false);
    for (const lm of zone.layerMaps) setLayerMapVisibility(lm, false);
    if (zone.marker360s.length) setMarker360sVisibilityByZone(zone, false);
    setBeaconVisibilitybyZone(zone, false);
    // Oriented images are linked to zone visibility: turning the zone off
    // always takes its images with it, resetting any prior manual override.
    resetZoneOrientedImages(zone, false);


    const defaultChild = getDefaultChild(zone);
    if(defaultChild) {
        _disableZone(defaultChild);
    }

    // If default zone going off, hide parent's sibling beacons too
    if (zone.isDefault && zone.parent && typeof zone.parent === "object") {
        zone.parent.children.forEach(sibling => {
            if (sibling === zone) return;
            const beacon = sibling.beacon;
            setBeaconVisibility(beacon, false);
        }); 
    }
}
window.newVisibleZones = new Set();
function updateZoneVisibility() {
    if (!viewer || !viewer.scene || !window.zones) return;

    const camPos = viewer.scene.getActiveCamera().position;

    // ── Find active zones & highest priority ──
    let highestPriority = -Infinity;
    const activeZones = [];

    for (const zone of window.zones) {
        if (!zone.boundingBoxes || zone.boundingBoxes.length === 0) continue;

        for (const box of zone.boundingBoxes) {
            if (isPointInsideBox(camPos, box)) {
                activeZones.push(zone);
                if (zone.priority > highestPriority) highestPriority = zone.priority;
                break;
            }
        }
    }

    if (activeZones.length === 0) return;

    // ── Build new visible set (only highest priority) ──
    window.newVisibleZones = new Set();
    for (const z of activeZones) {
        if (z.priority === highestPriority) newVisibleZones.add(z);
    }

    // console.log("Active: ", activeZones);
    // console.log("visible: ", newVisibleZones);

    // ── Early exit if nothing changed ──
    if (setsEqual(_currentlyVisibleZones, newVisibleZones)) return;

    // ── Diff and apply ──
    // Disable zones that are no longer visible
    for (const zone of _currentlyVisibleZones) {
        if (!newVisibleZones.has(zone)) {
            _disableZone(zone);
        }
    }

    // Enable zones that are newly visible
    for (const zone of newVisibleZones) {
        if (!_currentlyVisibleZones.has(zone)) {
            _enableZone(zone);
        }
    }
    // (Zones in both sets: no action needed)

    // ── Update persistent state ──
    _currentlyVisibleZones.clear();
    for (const z of newVisibleZones) _currentlyVisibleZones.add(z);

    // ── Post-switch updates ──
    setZoneBackground(newVisibleZones.values().next().value);

    // console.log(newVisibleZones);
    if(newVisibleZones.size == 1){
        const tempZone = newVisibleZones.values().next().value;
        const zoneDefaultChild = getDefaultChild(tempZone);
        if(zoneDefaultChild) window._isolatedZone = zoneDefaultChild;
        else window._isolatedZone = tempZone;
    }
    else {
        window._isolatedZone = null;
    }

    _refreshIsolatedHighlight();
    refreshZoneCheckboxStates();
}
function setZoneBackground(zone){
    if(zone.background === "cesium"){
        // cesium_basemap.js draws the basemap when the page loads it; a scene without a projection
        // for it has nothing to show through, so the zone gets the gradient instead.
        if (window.CesiumBasemap && !CesiumBasemap.setActive(true)) {
            window.cesiumActive = false;
            viewer.setBackground("gradient");
            return;
        }
        viewer.setBackground("");
        window.cesiumActive = true;
    }
    else {
        window.cesiumActive = false;
        if (window.CesiumBasemap) CesiumBasemap.setActive(false);
        if(!zone.background) zone.background = "gradient";
        viewer.setBackground(zone.background);
    }
}

window.zoneAutoSwitchState = true; // logical state

function setAutoSwitchState(newState) {
    window.zoneAutoSwitchState = newState;

    // Update menu button
    const menuBtnCreation = document.getElementById("autoSwitchButtonCreation");
    if (menuBtnCreation) {
        menuBtnCreation.textContent = newState ? "Auto-Switch: ON" : "Auto-Switch: OFF";
        menuBtnCreation.style.background = newState ? "#16a34a" : "#dc2626";
        menuBtnCreation.dataset.state = newState ? "on" : "off";
    }

    const menuBtnSearch = document.getElementById("autoSwitchButtonSearch");
    if (menuBtnSearch) {
        menuBtnSearch.textContent = newState ? "Auto-Switch: ON" : "Auto-Switch: OFF";
        menuBtnSearch.style.background = newState ? "#16a34a" : "#dc2626";
        menuBtnSearch.dataset.state = newState ? "on" : "off";
    }

    // ✅ Apply viewer behavior with the SAME state (not inverted)
    toggleAutoPointCloudSwitching(newState);
}



let autoSwitchInterval = null; // Start ON

window.toggleAutoPointCloudSwitching = function (enabled) {
    // enabled: true => turn autoswitch ON
    // enabled: false => turn autoswitch OFF

    if (enabled) {
        // turn ON
        if (!autoSwitchInterval) {
            autoSwitchInterval = setInterval(updateZoneVisibility, 400);
        }
        // If you want clipping only-inside zones when ON:

        viewer.scene.removeAllClipVolumes();
        viewer.setClipTask(2);
    } else {
        // turn OFF
        if (autoSwitchInterval) {
            clearInterval(autoSwitchInterval);
            autoSwitchInterval = null;
        }

        // Hide annotations when autoswitch is off
        // if (window.zones) {
        //     for (const z of window.zones) {
        //         if (!z.annotations) continue;
        //         for (const ann of z.annotations) {
        //             ann.visible = false;
        //         }
        //     }
        // }
        // viewer.setBackground("gradient");
        viewer.setClipTask(2);
    }
};

function moveCameraToPC(pointcloud){
    let box = viewer.getBoundingBox([pointcloud]);
    let node = new THREE.Object3D();
    node.boundingBox = box;
    viewer.zoomTo(node, 1, 500);
}

function moveCameraToClose360(cameraPosition, cameraTarget) {
    
    if (window.in360View) window.close360();

    moveCameraTo(cameraPosition, cameraTarget);
}


function moveCameraTo(cameraPosition, cameraTarget) {

    let cameraPositionVector = cameraPosition;
    let cameraTargetVector = cameraTarget;

    // Convert things to vectors if needed
    if (cameraPosition instanceof Array) {
        cameraPositionVector = new THREE.Vector3().fromArray(cameraPosition);
    }

    if (cameraTarget instanceof Array) {
        cameraTargetVector = new THREE.Vector3().fromArray(cameraTarget);
    }

    // Actually move the camera
    Potree.Utils.moveTo(
        viewer.scene,
        cameraPositionVector,
        cameraTargetVector
    );
}


function setsEqual(a, b) {
    if (a.size !== b.size) return false;
    for (const x of a) {
        if (!b.has(x)) return false;
    }
    return true;
}