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
    constructor(name, parent, priority, pointclouds = [], boundingBoxes = [], annotations = [], layerMaps = [], marker360s = [], beacon, description, background, isDefault = false) {
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
    right: -420px; /* slide-off position to match sizes better */
    width: clamp(300px, 32vw, 420px);

    overflow: hidden;

    /* allow content-determined height */
    height: auto;
    max-height: 85vh;

    padding: 18px 20px;
    box-sizing: border-box;

    /* --- Glassmorphic transparent background --- */
    background: rgba(20, 20, 26, 0.55);
    backdrop-filter: blur(12px) saturate(140%);
    -webkit-backdrop-filter: blur(12px) saturate(140%);

    /* --- Soft glowing border like search menu --- */
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 14px;

    /* --- Shadow for float effect --- */
    box-shadow: 0 0 28px rgba(0,0,0,0.55);

    z-index: 10000;
    transition: right 0.28s ease, opacity 0.25s ease;

    font-family: sans-serif;
    display: flex;
    flex-direction: column;

    opacity: 0; /* fade-in for consistency */
}

.zone-panel.open {
    right: 10px; /* aligned with toolbar like #zoneSearchMenu */
    opacity: 1;
}


.zone-panel h3 {
    margin-top: 0;
    text-align: center;
    font-size: 17px;
    font-weight: 600;
    color: #e5e5e5;
}

/* --------- FORM --------- */
.zone-form {
    display: flex;
    flex-direction: column;
    flex-grow: 1;
    padding: 12px 8px;
    margin-top: 12px;
    background: #232328;
    border: 1px solid #333;
    border-radius: 8px;
    overflow-y: auto;
}

.zone-form::-webkit-scrollbar {
    width: 6px;
}
.zone-form::-webkit-scrollbar-thumb {
    background: #444;
    border-radius: 4px;
}
.zone-form::-webkit-scrollbar-thumb:hover {
    background: #555;
}

.zone-form label {
    font-weight: 600;
    color: #ddd;
    margin-top: 10px;
    margin-bottom: 4px;
}

.zone-form h4 {
    font-weight: 600;
    color: #ddd;
    margin-top: 10px;
    margin-bottom: 4px;
}

.zone-form input,
.zone-form select,
.zone-form textarea {
    padding: 8px;
    border: 1px solid #444;
    border-radius: 6px;
    background: #1f2024;
    color: #ddd;
    margin-bottom: 12px;
    font-size: 14px;
}
.zone-form input:focus,
.zone-form select:focus,
.zone-form textarea:focus {
    outline: 1px solid #4f46e5;
    border-color: #4f46e5;
}

.zone-form .hint {
    font-size: 12px;
    color: #888;
    margin-bottom: 6px;
}

/* --------- FORM CLOSE (X) --------- */
.zone-form-close {
    position: absolute;
    top: 6px;
    right: 10px;
    font-size: 20px;
    color: #888;
    background: none;
    border: none;
    cursor: pointer;
}
.zone-form-close:hover {
    color: #ccc;
}

/* --------- BUTTONS --------- */
.sub-btn {
    background: #4f46e5;
    color: white;
    border: none;
    border-radius: 6px;
    padding: 8px 10px;
    margin-top: 8px;
    cursor: pointer;
    font-weight: 500;
    transition: background .2s;
}
.sub-btn:hover {
    background: #6a62f7;
}

.save-btn {
    background: #16a34a !important;
}
.save-btn:hover {
    background: #15803d !important;
}

/* Bottom Close button */
.close-btn {
    margin-top: 10px;
    background: #333;
    color: white;
    border: none;
    border-radius: 6px;
    padding: 8px;
    cursor: pointer;
    transition: background .2s;
}
.close-btn:hover {
    background: #444;
}

/* --------- BBOX LIST --------- */
.bbox-container {
    margin: 10px 0;
    background: #1f2024;
    padding: 10px;
    border-radius: 6px;
    border: 1px solid #333;
}

.bbox-list {
    list-style: none;
    padding-left: 0;
    max-height: 150px;
    overflow-y: auto;
}

.bbox-list li {
    background: #2a2b30;
    color: #ddd;
    padding: 4px 6px;
    border-radius: 4px;
    font-family: monospace;
    margin-bottom: 4px;
}

/* --------- ZONE LIST --------- */
.zone-list-container {
    margin-top: 12px;
    padding: 10px;
    background: #232328;
    border-radius: 6px;
    border: 1px solid #333;
    flex: 1;
}

.zone-list-container h4 {
    color: #ddd;
    margin: 0 0 8px 0;
    font-size: 15px;
}

.zone-list {
    list-style: none;
    padding-left: 0;
    margin: 0;
    overflow-y: auto;
    max-height: 100%;
}

.zone-empty {
    color: #777;
    font-style: italic;
    text-align: center;
}

.zone-item {
    background: #1f2024;
    border: 1px solid #333;
    color: #ddd;
    padding: 6px 8px;
    margin-bottom: 6px;
    border-radius: 6px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    transition: background .15s ease;
}
.zone-item:hover {
    background: #2a2b30;
}

.zone-btn {
    font-size: 11px;
    padding: 4px 7px;
    border-radius: 4px;
    border: none;
    cursor: pointer;
    color: white;
}

.edit-btn {
    background: #2563eb;
}
.edit-btn:hover {
    background: #1d4ed8;
}

.delete-btn {
    background: #dc2626;
}
.delete-btn:hover {
    background: #b91c1c;
}

/* --------- Annotation Description --------- */
.annotation-description {
  background: rgba(0,0,0,0.7) !important;
  color: #eee !important;
  border-radius: 6px;
  max-width: 160px !important;
  max-height: 280px !important;
  font-size: 14px;
  padding: 6px 8px;
  overflow-y: auto;
  backdrop-filter: blur(6px);
}

/* Annotation select */
.annotation-type-select {
    width: 100%;
    background: #1f2024;
    border: 1px solid #444;
    color: #ddd;
    padding: 6px;
    border-radius: 6px;
    margin-bottom: 8px;
}

.zone-io-container {
    display: flex;
    justify-content: center;   /* center the buttons */
    gap: 10px;                 /* space between buttons */
    margin-top: 10px;
}

.zone-io-container .close-btn {
    width: auto;
    padding: 8px 14px;
}

.zone-panel .add-zone-btn {
    margin-bottom: 12px;   /* or 16px if you want more spacing */
}


#zonePointclouds {
    min-height: 140px;
}

.zone-item {
    list-style: none;
    position: relative;
    margin: 4px 0;
    padding: 6px;
    background: rgba(255,255,255,0.04);
    border-radius: 6px;
}

.zone-item.dragging {
    opacity: 0.5;
}

.zone-item::before {
    content: "";
    position: absolute;
    left: 8px;
    top: 0;
    bottom: 0;
    width: 1px;
    background: rgba(255,255,255,0.15);
}

textarea {
    width: 99%;
    min-height: 50px;
    resize: vertical;
}
`;

document.head.appendChild(style);
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
function openZoneForm(zone = null) 
{

    if(document.getElementById("zoneSearchMenu")) document.getElementById("zoneSearchMenu").remove();

    const isEdit = !!zone;

    // Disable auto-switch while editing/creating
    if (window.zoneAutoSwitchState) setAutoSwitchState(false);
    viewer.scene.removeAllMeasurements();

    // If creating, set up a fresh temp annotations array
    if (!isEdit) {
        window.annotationsTemp = [];
    }

    // Remove any existing form
    const oldForm = document.getElementById("zoneForm");
    if (oldForm) oldForm.remove();

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
        setAutoSwitchState(true);
        form.remove();
        toggleZoneCreationMenu(); // rebuild the main panel
    });
    form.appendChild(closeFormBtn);

    // ═══════════════════════════════════════════════════════
    //  1. NAME
    // ═══════════════════════════════════════════════════════
    const nameLabel = document.createElement("label");
    nameLabel.textContent = "Zone Name:";
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.placeholder = "Enter zone name";
    nameInput.id = "zoneName";
    if (isEdit) nameInput.value = zone.name;
    form.appendChild(nameLabel);
    form.appendChild(nameInput);

    // ═══════════════════════════════════════════════════════
    //  2. DESCRIPTION
    // ═══════════════════════════════════════════════════════
    const descriptionLabel = document.createElement("label");
    descriptionLabel.textContent = "Zone Description:";
    const descriptionInput = document.createElement("textarea");
    descriptionInput.placeholder = "Enter zone description";
    descriptionInput.id = "zoneDescription";
    descriptionInput.rows = 4;
    descriptionInput.cols = 40;
    if (isEdit) descriptionInput.value = zone.description || "";
    form.appendChild(descriptionLabel);
    form.appendChild(descriptionInput);


    // ── Default Zone Toggle ──
    const defaultLabel = document.createElement("label");
    defaultLabel.textContent = "Default zone:";
    const defaultChk = document.createElement("input");
    defaultChk.type = "checkbox";
    defaultChk.id = "zoneIsDefault";
    defaultChk.checked = isEdit ? (zone.isDefault || false) : false;
    defaultChk.style.cssText = "width:18px; height:18px; margin-left:8px; accent-color:#6f6bff;";
    const defaultHint = document.createElement("p");
    defaultHint.className = "hint";
    defaultHint.textContent = "Default zone acts as the ambient/lobby state of its parent, showing sibling beacons.";
    form.appendChild(defaultLabel);
    form.appendChild(defaultChk);
    form.appendChild(defaultHint);


    // ═══════════════════════════════════════════════════════
    //  3. PARENT ZONE
    // ═══════════════════════════════════════════════════════
    const parentLabel = document.createElement("label");
    parentLabel.textContent = "Zone Parent:";

    const parentSearch = document.createElement("input");
    parentSearch.type = "text";
    parentSearch.placeholder = "Search zones...";
    parentSearch.style.cssText = "margin-bottom:6px; padding:6px; border:1px solid #ccc; border-radius:5px;";

    const parentSelect = document.createElement("select");
    parentSelect.multiple = false;
    parentSelect.id = "zonePointclouds";
    parentSelect.size = 6;

    // "None" option
    const noneOpt = document.createElement("option");
    noneOpt.value = "none";
    noneOpt.textContent = "None";
    parentSelect.appendChild(noneOpt);

    // Populate parent options (exclude self when editing)
    window.zones.forEach(z => {
        if (isEdit && z === zone) return; // don't allow self-parenting
        const opt = document.createElement("option");
        opt.value = z.name;
        opt.textContent = z.name;
        parentSelect.appendChild(opt);
    });

    // Pre-select current parent
    if (isEdit && zone.parent) {
        parentSelect.value = zone.parent?.name || zone.parent || "none";
    } else {
        parentSelect.value = "none";
    }

    // Filter
    parentSearch.addEventListener("input", () => {
        const filter = parentSearch.value.toLowerCase();
        for (const option of parentSelect.options) {
            option.style.display = option.textContent.toLowerCase().includes(filter) ? "" : "none";
        }
    });

    form.appendChild(parentLabel);
    form.appendChild(parentSearch);
    form.appendChild(parentSelect);

    // ═══════════════════════════════════════════════════════
    //  4. POINTCLOUDS
    // ═══════════════════════════════════════════════════════
    const pcLabel = document.createElement("label");
    pcLabel.textContent = "Select Pointclouds:";

    const pcSearch = document.createElement("input");
    pcSearch.type = "text";
    pcSearch.placeholder = "Search pointclouds...";
    pcSearch.style.cssText = "margin-bottom:6px; padding:6px; border:1px solid #ccc; border-radius:5px;";

    const pcSelect = document.createElement("select");
    pcSelect.id = "zonePointclouds";
    pcSelect.multiple = true;
    pcSelect.size = 6;

    // Build pointcloud map & options
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

    // Filter
    pcSearch.addEventListener("input", () => {
        const filter = pcSearch.value.toLowerCase();
        for (const option of pcSelect.options) {
            option.style.display = option.textContent.toLowerCase().includes(filter) ? "" : "none";
        }
    });

    // Auto-select visible
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

    form.appendChild(pcLabel);
    form.appendChild(pcSearch);
    form.appendChild(pcSelect);
    form.appendChild(selectVisibleBtn);

    // ═══════════════════════════════════════════════════════
    //  5. BOUNDING BOXES
    // ═══════════════════════════════════════════════════════
    const bboxLabel = document.createElement("label");
    bboxLabel.textContent = "Bounding Boxes:";
    form.appendChild(bboxLabel);

    const bboxContainer = document.createElement("div");
    bboxContainer.className = "bbox-container";

    const bboxHint = document.createElement("p");
    bboxHint.className = "hint";
    bboxContainer.appendChild(bboxHint);

    const bboxList = document.createElement("ul");
    bboxList.className = "bbox-list";
    bboxContainer.appendChild(bboxList);

    // Show existing boxes (edit mode)
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

    form.appendChild(bboxContainer);

    let redefineBoxes = false;

    const bboxBtn = document.createElement("button");
    bboxBtn.textContent = isEdit ? "Redefine Boxes" : "Choose Bounding Boxes";
    bboxBtn.className = "sub-btn";
    bboxBtn.addEventListener("click", () => {
        viewer.volumeTool.startInsertion({ clip: true });
        setTimeout(updateBoundingBoxList, 500);
        redefineBoxes = true;
    });
    form.appendChild(bboxBtn);

    const clearBboxBtn = document.createElement("button");
    clearBboxBtn.textContent = "Clear All Boxes";
    clearBboxBtn.className = "sub-btn clear-btn";
    clearBboxBtn.addEventListener("click", () => {
        viewer.scene.removeAllClipVolumes();
        if (isEdit) zone.boundingBoxes = [];
        redefineBoxes = true;
        updateBoundingBoxList();
    });
    form.appendChild(clearBboxBtn);

    // ═══════════════════════════════════════════════════════
    //  6. LAYER MAPS
    // ═══════════════════════════════════════════════════════
    const layerMapLabel = document.createElement("label");
    layerMapLabel.textContent = "Layer Maps:";
    form.appendChild(layerMapLabel);

    const currentLayerMaps = isEdit ? (zone.layerMaps || []) : [];

    if (currentLayerMaps.length === 0) {
        const empty = document.createElement("p");
        empty.textContent = "No layer maps defined.";
        empty.className = "hint";
        form.appendChild(empty);
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
        form.appendChild(layerMapList);
    }

    const addLayerMapBtn = document.createElement("button");
    addLayerMapBtn.textContent = "Manage Layer Maps";
    addLayerMapBtn.className = "sub-btn";
    addLayerMapBtn.onclick = () => openLayerMapPanel(zone || {layerMaps: currentLayerMaps});
    form.appendChild(addLayerMapBtn);

    // ═══════════════════════════════════════════════════════
    //  7. MARKER 360s
    // ═══════════════════════════════════════════════════════
    const m360Label = document.createElement("label");
    m360Label.textContent = "360 Markers:";
    form.appendChild(m360Label);

    const currentMarker360s = isEdit ? (zone.marker360s || []) : [];

    if (currentMarker360s.length === 0) {
        const empty = document.createElement("p");
        empty.textContent = "No 360 markers defined.";
        empty.className = "hint";
        form.appendChild(empty);
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
        form.appendChild(m360List);
    }

    const addM360Btn = document.createElement("button");
    addM360Btn.textContent = "Manage Marker 360s";
    addM360Btn.className = "sub-btn";
    addM360Btn.onclick = () => openMarker360ManagerPanel(zone || {marker360s: currentMarker360s});
    form.appendChild(addM360Btn);

    // ═══════════════════════════════════════════════════════
    //  8. ANNOTATIONS
    // ═══════════════════════════════════════════════════════
    const annLabel = document.createElement("label");
    annLabel.textContent = "Annotations:";
    form.appendChild(annLabel);

    // The working list: for edit mode use zone.annotations, for create use the temp array
    const annotationsList = isEdit ? zone.annotations : window.annotationsTemp;

    if (annotationsList.length === 0) {
        const hint = document.createElement("p");
        hint.textContent = "No annotations yet.";
        hint.className = "hint";
        form.appendChild(hint);
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

                // Remove from Potree scene if present
                if (ann && viewer.scene.annotations.hasChild(ann)) {
                    viewer.scene.annotations.remove(ann);
                }

                annotationsList.splice(i, 1);

                // Refresh the form
                updateZoneList();
                form.remove();
                openZoneForm(zone);
            });

            li.appendChild(editAnnBtn);
            li.appendChild(delAnnBtn);
            annList.appendChild(li);
        }
        form.appendChild(annList);
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
    form.appendChild(addAnnBtn);

    // ═══════════════════════════════════════════════════════
    //  9. BEACON (position + camera)
    // ═══════════════════════════════════════════════════════
    const beaconLabel = document.createElement("label");
    beaconLabel.textContent = "Beacon";
    form.appendChild(beaconLabel);

    const beaconHint = document.createElement("p");
    beaconHint.textContent = "Create a marker for this zone";
    beaconHint.className = "hint";
    form.appendChild(beaconHint);

    // --- Beacon Position ---
    const posHint = document.createElement("p");
    posHint.className = "hint";
    form.appendChild(posHint);

    let measurement = null;
    let annotationPosition = null;
    let check = null;

    // Pre-fill beacon position if editing
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
    form.appendChild(posBtn);
    // ── Z adjust buttons ──
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
    form.appendChild(zRow);

    const clearBeaconBtn = document.createElement("button");
    clearBeaconBtn.textContent = "Remove Beacon";
    clearBeaconBtn.className = "sub-btn";
    
    clearBeaconBtn.addEventListener("click", () => {
        posHint.textContent = "Selecting point... click in the scene.";
        toClearBeacon = true;
    });

    form.appendChild(clearBeaconBtn);

    // --- Beacon Camera ---
    const camHint = document.createElement("p");
    camHint.className = "hint";
    form.appendChild(camHint);

    let cameraPosition = null;
    let cameraTarget = null;

    // Pre-fill beacon camera if editing
    if (isEdit && zone.beacon && zone.beacon.cameraPosition && zone.beacon.cameraTarget) {
        const pos = zone.beacon.cameraPosition;
        const tar = zone.beacon.cameraTarget;
        const posStr = `[${pos.x.toFixed(3)}, ${pos.y.toFixed(3)}, ${pos.z.toFixed(3)}]`;
        const tarStr = `[${tar.x.toFixed(3)}, ${tar.y.toFixed(3)}, ${tar.z.toFixed(3)}]`;
        camHint.innerHTML = `<b>Camera Position:</b> ${posStr}<br><b>Camera Target:</b> ${tarStr}`;
        cameraPosition = {x: pos.x, y: pos.y, z: pos.z};
        cameraTarget = {x: tar.x, y: tar.y, z: tar.z};
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

        cameraPosition = {x: pos.x, y: pos.y, z: pos.z};
        cameraTarget = {x: tar.x, y: tar.y, z: tar.z};
    });
    form.appendChild(camBtn);


    // ═══════════════════════════════════════════════════════
    //  10. Background
    // ═══════════════════════════════════════════════════════

    // --- Type ---
    const typeLabel = document.createElement("label");
    typeLabel.textContent = "Zone Background:";
    form.appendChild(typeLabel);

    const backgroundSelect = document.createElement("select");
    backgroundSelect.id = "annotationType";
    backgroundSelect.className = "annotation-type-select";

    // Add options
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

    form.appendChild(backgroundSelect);


    // ═══════════════════════════════════════════════════════
    //  SAVE BUTTON
    // ═══════════════════════════════════════════════════════
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
            // For new zones with no explicit box action, also grab scene volumes
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
            position: {x: beaconPoint.x, y: beaconPoint.y, z: beaconPoint.z},
            cameraPosition: cameraPosition,
            cameraTarget: cameraTarget
        };

        console.log(beacon);
        // background

        const background = backgroundSelect.value;

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
                defaultChk.checked
            );
            window.zones.push(newZone);
        }

        console.log("Saved zones:", window.zones);
        viewer.scene.removeAllClipVolumes();
        resolveZoneParents();
        updateZoneList();
        form.remove();
        setAutoSwitchState(true);
        toggleZoneCreationMenu();
        toggleZoneSearchMenu();
    });
    form.appendChild(saveBtn);

    // ═══════════════════════════════════════════════════════
    //  CANCEL BUTTON
    // ═══════════════════════════════════════════════════════
    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Cancel";
    cancelBtn.className = "sub-btn clear-btn";
    cancelBtn.addEventListener("click", () => {
        setAutoSwitchState(true);
        form.remove();
        toggleZoneCreationMenu();
    });
    form.appendChild(cancelBtn);

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
    form.className = "zone-form";

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

    // Append form to main panel
    // Append form just below zone form
    const zoneForm = document.getElementById("zoneForm");
    if (zoneForm) zoneForm.after(form);
    else document.getElementById("zoneCreationMenu").appendChild(form);

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


function deleteZone(index) {
    const zone = window.zones[index];
    const confirmDel = confirm(`Delete zone "${zone.name}"?`);
    if (!confirmDel) return;

    window.zones.splice(index, 1);
    updateZoneList();
    console.log(`Deleted zone: ${zone.name}`);
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
        isDefault: z.isDefault || false

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


                return new Zone(z.name, z.parent, Number(z.priority), pcs, boxes, annotations, layerMaps, marker360s, z.beacon || null, z.description || ``, z.background || "gradient", z.isDefault || false);
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

                return new Zone(z.name, z.parent, Number(z.priority), pcs, boxes, annotations, layerMaps, marker360s, z.beacon || null, z.description || ``, z.background || "gradient", z.isDefault || false);
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

function _enableZone(zone) {
    for (const pc of zone.pointclouds) pc.visible = true;
    _addZoneVolumes(zone);
    for (const ann of zone.annotations) setAnnotationVisibility(ann, true);
    for (const lm of zone.layerMaps) setLayerMapVisibility(lm, true);
    if (zone.marker360s.length) setMarker360sVisibilityByZone(zone, true);
    setBeaconVisibilitybyZone(zone, true);

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
