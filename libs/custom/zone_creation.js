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
    constructor(name, parent, priority, pointclouds = [], boundingBoxes = [], annotations = [], layerMaps = [], marker360s = [], beacon, description, background, isDefault = false, orientedImagesHandler) {
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
        this.orientedImagesHandler = orientedImagesHandler;
    }
}

class orientedImagesHandler {
    constructor(cameraParamsPath, imageParamsPath){
        this.cameraParamsPath = cameraParamsPath;
        this.imageParamsPath = imageParamsPath;

        Potree.OrientedImageLoader.load(cameraParamsPath, imageParamsPath, viewer).then( images => {
            this.images = images;
	    });
    }
}

// Inject styles
const style = document.createElement("style");

style.textContent += `
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
    display: flex;
    justify-content: center;
    gap: 8px;
    margin-top: 8px;
    flex-wrap: wrap;
}

.zone-io-container .close-btn {
    width: auto;
    flex: 1 1 auto;
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
    parentSelect.appendChild(noneOpt);

    window.zones.forEach(z => {
        if (isEdit && z === zone) return; // don't allow self-parenting
        const opt = document.createElement("option");
        opt.value = z.name;
        opt.textContent = z.name;
        parentSelect.appendChild(opt);
    });

    if (isEdit && zone.parent) {
        parentSelect.value = zone.parent?.name || zone.parent || "none";
    } else {
        parentSelect.value = "none";
    }

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

    window.pointcloudMap = {};
    viewer.scene.pointclouds.forEach((pc, i) => {
        const id = `pc_${i}`;
        window.pointcloudMap[id] = pc;
        const opt = document.createElement("option");
        opt.value = id;
        opt.textContent = pc.name || `PointCloud ${i + 1}`;
        if (isEdit) opt.selected = zone.pointclouds.includes(pc);
        pcSelect.appendChild(opt);
    });

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
    //  SECTION 9 · ORIENTED IMAGES (camera params + image params)
    // ═══════════════════════════════════════════════════════
    const oiBody = makeSection("Oriented Images");

    const oiHint = document.createElement("p");
    oiHint.className = "hint";
    oiHint.textContent = "Paths to the oriented-image parameter files. Both must be set to load oriented images for this zone.";
    oiBody.appendChild(oiHint);

    const camParamsLabel = document.createElement("label");
    camParamsLabel.textContent = "Camera Params Path:";
    const camParamsInput = document.createElement("input");
    camParamsInput.type = "text";
    camParamsInput.placeholder = "e.g. path/to/cameras.json";
    camParamsInput.id = "zoneCameraParamsPath";
    if (isEdit && zone.orientedImagesHandler) {
        camParamsInput.value = zone.orientedImagesHandler.cameraParamsPath || "";
    }
    oiBody.appendChild(camParamsLabel);
    oiBody.appendChild(camParamsInput);

    const imgParamsLabel = document.createElement("label");
    imgParamsLabel.textContent = "Image Params Path:";
    const imgParamsInput = document.createElement("input");
    imgParamsInput.type = "text";
    imgParamsInput.placeholder = "e.g. path/to/images.json";
    imgParamsInput.id = "zoneImageParamsPath";
    if (isEdit && zone.orientedImagesHandler) {
        imgParamsInput.value = zone.orientedImagesHandler.imageParamsPath || "";
    }
    oiBody.appendChild(imgParamsLabel);
    oiBody.appendChild(imgParamsInput);

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

        // Oriented images handler
        const camParams = camParamsInput.value.trim();
        const imgParams = imgParamsInput.value.trim();
        const existingOIH = isEdit ? zone.orientedImagesHandler : null;
        let oih;
        if (camParams && imgParams) {
            const changed = !existingOIH
                || existingOIH.cameraParamsPath !== camParams
                || existingOIH.imageParamsPath !== imgParams;
            if (changed) {
                try {
                    oih = new orientedImagesHandler(camParams, imgParams);
                } catch (err) {
                    console.warn("Failed to initialise orientedImagesHandler:", err);
                    oih = existingOIH || undefined;
                }
            } else {
                oih = existingOIH;
            }
        } else {
            oih = undefined; // no (complete) paths => no handler
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
            zone.orientedImagesHandler = oih;
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
                oih
            );
            window.zones.push(newZone);
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
 * Export all zones to a downloadable JSON file.
 */
function exportZonesToJSON() {
    if (!window.zones || window.zones.length === 0) {
        alert("No zones to export!");
        return;
    }

    // Prepare plain JSON data (remove circular refs, only store essentials)
    const zonesData = window.zones.map(z => ({
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
        orientedImagesHandler: z.orientedImagesHandler ? {
            cameraParamsPath: z.orientedImagesHandler.cameraParamsPath,
            imageParamsPath: z.orientedImagesHandler.imageParamsPath
        } : null

    }));


    const blob = new Blob([JSON.stringify(zonesData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "zones.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function resolvePointCloudByName(name) {
    if(!name) return null;
    if (!viewer || !viewer.scene || !viewer.scene.pointclouds) return null;
    return viewer.scene.pointclouds.find(pc => pc.name.trim() === name.trim()) || null;
}


/**
 * Import zones from a JSON file and refresh the list.
 */
function importZonesFromJSON() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";

    input.addEventListener("change", (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
        try {
            const importedData = JSON.parse(e.target.result);
            if (!Array.isArray(importedData)) throw new Error("Invalid zone data format.");

            window.zones = importedData.map(z => {
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


                let orientedHandler;
                if (z.orientedImagesHandler && z.orientedImagesHandler.cameraParamsPath && z.orientedImagesHandler.imageParamsPath) {
                    try { orientedHandler = new orientedImagesHandler(z.orientedImagesHandler.cameraParamsPath, z.orientedImagesHandler.imageParamsPath); }
                    catch (e) { console.warn("orientedImagesHandler failed to load on import:", e); }
                }
                return new Zone(z.name, z.parent, Number(z.priority), pcs, boxes, annotations, layerMaps, marker360s, z.beacon || null, z.description || ``, z.background || "gradient", z.isDefault || false, orientedHandler);
            });

            initZonesOps();
            alert("Zones imported successfully!");
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
 * Automatically load "zones.json" from the same directory (if present)
 * and import it using the same logic as importZonesFromJSON.
 */
async function autoLoadZonesJSON(json) {
    return fetch(json, { cache: "no-store" })
        .then(response => {
            if (!response.ok) {
                console.warn("zones.json not found or failed to load.");
                return null;
            }
            return response.json();
        })
        .then(importedData => {
            if (!importedData) return false;

            try {
                if (!Array.isArray(importedData)) throw new Error("Invalid zone data format.");

                // This block is identical to what your importZonesFromJSON() does internally.
                window.zones = importedData.map(z => {
                    const boxes = z.boundingBoxes;

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
                
                //temporary system

                let orientedHandler;
                if (z.orientedImagesHandler && z.orientedImagesHandler.cameraParamsPath && z.orientedImagesHandler.imageParamsPath) {
                    try { orientedHandler = new orientedImagesHandler(z.orientedImagesHandler.cameraParamsPath, z.orientedImagesHandler.imageParamsPath); }
                    catch (e) { console.warn("orientedImagesHandler failed to load on import:", e); }
                }
                return new Zone(z.name, z.parent, Number(z.priority), pcs, boxes, annotations, layerMaps, marker360s, z.beacon || null, z.description || ``, z.background || "gradient", z.isDefault || false, orientedHandler);
                });
                

                initZonesOps();
                document.addEventListener("pointermove", onPointerMove, { passive: true });

                console.log("zones.json loaded successfully.");
                return true;
            } catch (err) {
                console.error("Error parsing zones.json:", err);
                return false;
            }
        })
        .catch(err => {
            console.warn("No zones.json found or failed to load:", err);
            return false;
        });
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

// True when the zone has a handler whose images have finished loading.
function zoneHasOrientedImages(zone) {
    const c = zone && zone.orientedImagesHandler && zone.orientedImagesHandler.images;
    return !!(c && c.images && c.images.length);
}

// Per-zone UI preference: are this zone's oriented images allowed on screen?
// Default true; the search-menu toggle flips zone._orientedImagesHidden.
function zoneOrientedImagesEnabled(zone) {
    return !!zone && zone._orientedImagesHidden !== true;
}

// Show / hide ONLY this zone's oriented images. Pointclouds, boxes, beacons,
// annotations and 360 markers are left untouched.
function setZoneOrientedImagesVisibility(zone, visible) {
    if (!zoneHasOrientedImages(zone)) return;
    const collection = zone.orientedImagesHandler.images;

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

// UI-facing toggle used by the zone-search menu. Flips just the oriented-image
// visibility for a zone. Independent of whether the zone itself is currently
// shown or hidden — the images checkbox can always be operated on its own;
// it's only the zone's own visibility toggle that forces this back in sync
// (see setZoneVisibility / _enableZone / _disableZone).
function toggleZoneOrientedImages(zone, visible) {
    if (!zone) return;
    zone._orientedImagesHidden = !visible;
    setZoneOrientedImagesVisibility(zone, visible);
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
    zone._orientedImagesHidden = false;
    setZoneOrientedImagesVisibility(zone, true);

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
    zone._orientedImagesHidden = true;
    setZoneOrientedImagesVisibility(zone, false);


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
        viewer.setBackground("");
        window.cesiumActive = true;
    }
    else {
        window.cesiumActive = false;
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