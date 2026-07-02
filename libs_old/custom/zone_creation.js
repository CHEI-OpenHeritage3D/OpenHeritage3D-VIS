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
    constructor(name, priority, pointclouds = [], boundingBoxes = [], annotations = [], layerMaps = [], marker360s = []) {
        this.name = name;                    // name of the zone
        this.pointclouds = pointclouds;      // list of pointcloud IDs/names
        this.boundingBoxes = boundingBoxes;  // list of bounding box objects
        this.annotations = annotations;      // list of annotation IDs or data
        this.priority = priority;
        this.layerMaps = layerMaps;
        this.marker360s = marker360s;
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
        addZoneForm();
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
    updateZoneList();

    panel.appendChild(zoneListContainer);

    updateZoneList();

    // Placeholder description
    const desc = document.createElement("p");
    if(!window.zones) desc.textContent = "Define zone name, bounding boxes, and annotations here.";
    panel.appendChild(desc);

    // Append to body and animate
    document.body.appendChild(panel);
    requestAnimationFrame(() => panel.classList.add("open"));

    updateZoneList();

}

function addZoneForm() {
    // Remove existing form if already open
    const oldForm = document.getElementById("zoneForm");
    if (oldForm) oldForm.remove();

    // Create form container
    const form = document.createElement("div");
    form.id = "zoneForm";
    form.className = "zone-form";
    
    const title = document.createElement("h3");
    title.textContent = "Add new Zone";
    form.appendChild(title);

    // --- Close form button ---
    const closeFormBtn = document.createElement("button");
    closeFormBtn.textContent = "×";
    closeFormBtn.className = "zone-form-close";
    closeFormBtn.title = "Close";
    closeFormBtn.addEventListener("click", () => 
    {
        setAutoSwitchState(true);
        form.remove();
    });
    form.appendChild(closeFormBtn);


    // --- Zone Name ---
    const nameLabel = document.createElement("label");
    nameLabel.textContent = "Zone Name:";
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.placeholder = "Enter zone name";
    nameInput.id = "zoneName";
    form.appendChild(nameLabel);
    form.appendChild(nameInput);



    // --- Zone Priority ---
    const priorityLabel = document.createElement("label");
    priorityLabel.textContent = "Zone Priority:";
    const priorityInput = document.createElement("input");
    priorityInput.type = "text";
    priorityInput.placeholder = "Enter priority (1 for lowest, generally the exterior)";
    priorityInput.id = "priorityPriority";
    form.appendChild(priorityLabel);
    form.appendChild(priorityInput);


    // --- Pointcloud Selection ---
    // Global map of pointcloud IDs to actual objects
    window.pointcloudMap = {};

    // --- Pointcloud Selection ---
    const pcLabel = document.createElement("label");
    pcLabel.textContent = "Select Pointclouds:";

    // Search input
    const pcSearch = document.createElement("input");
    pcSearch.type = "text";
    pcSearch.placeholder = "Search pointclouds...";
    pcSearch.id = "zonePointcloudSearch";
    pcSearch.style.marginBottom = "6px";
    pcSearch.style.padding = "6px";
    pcSearch.style.border = "1px solid #ccc";
    pcSearch.style.borderRadius = "5px";

    // Dropdown
    const pcSelect = document.createElement("select");
    pcSelect.id = "zonePointclouds";
    pcSelect.multiple = true;
    pcSelect.size = 6;

    // Global map for lookup
    window.pointcloudMap = {};

    // Populate dropdown
    for (let i = 0; i < viewer.scene.pointclouds.length; i++) {
        const pc = viewer.scene.pointclouds[i];
        const id = `pc_${i}`;
        window.pointcloudMap[id] = pc;

        const opt = document.createElement("option");
        opt.value = id;
        opt.textContent = pc.name || `PointCloud ${i + 1}`;
        pcSelect.appendChild(opt);
    }

    // Filtering logic
    pcSearch.addEventListener("input", () => {
        const filter = pcSearch.value.toLowerCase();
        for (const option of pcSelect.options) {
            const text = option.textContent.toLowerCase();
            option.style.display = text.includes(filter) ? "" : "none";
        }
    });

    // --- Button: Auto-select visible pointclouds ---
    const selectVisibleBtn = document.createElement("button");
    selectVisibleBtn.textContent = "Select Visible Pointclouds";
    selectVisibleBtn.className = "sub-btn";
    selectVisibleBtn.style.marginTop = "6px";

    selectVisibleBtn.addEventListener("click", (e) => {
        e.preventDefault(); // prevent form submission if inside <form>
        for (const [id, pc] of Object.entries(window.pointcloudMap)) {
            const option = pcSelect.querySelector(`option[value="${id}"]`);
            if (!option) continue;
            option.selected = !!pc.visible;
        }
    });

    form.appendChild(pcLabel);
    form.appendChild(pcSearch);
    form.appendChild(pcSelect);
    form.appendChild(selectVisibleBtn);


    // --- Bounding Box Selection ---
    const bboxLabel = document.createElement("label");
    bboxLabel.textContent = "Bounding Boxes:";

    const bboxContainer = document.createElement("div");
    bboxContainer.className = "bbox-container";

    // Hint text (shown when no volumes yet)
    const bboxHint = document.createElement("p");
    bboxHint.textContent = "Click below to select or draw bounding boxes.";
    bboxHint.className = "hint";
    bboxContainer.appendChild(bboxHint);

    // Bounding box list (hidden until boxes exist)
    const bboxList = document.createElement("ul");
    bboxList.className = "bbox-list";
    bboxList.style.display = "none"; // hidden until boxes exist
    bboxContainer.appendChild(bboxList);

    // Add Bounding Box button
    const bboxBtn = document.createElement("button");
    bboxBtn.textContent = "Choose Bounding Boxes";
    bboxBtn.className = "sub-btn";
    bboxBtn.addEventListener("click", () => {
        viewer.volumeTool.startInsertion({ clip: true });
        // Give Potree a moment to register the new volume
        setTimeout(updateBoundingBoxList, 500);
    });

    // Clear All button
    const clearBboxBtn = document.createElement("button");
    clearBboxBtn.textContent = "Clear All Boxes";
    clearBboxBtn.className = "sub-btn clear-btn";
    clearBboxBtn.addEventListener("click", () => {
        viewer.scene.removeAllClipVolumes();
        updateBoundingBoxList(); // refresh UI
    });

    form.appendChild(bboxLabel);
    form.appendChild(bboxContainer);
    form.appendChild(bboxBtn);
    form.appendChild(clearBboxBtn);


    // --- Annotations ---
    const annotationLabel = document.createElement("label");
    annotationLabel.textContent = "Annotations:";
    form.appendChild(annotationLabel);

    const annotationHint = document.createElement("p");
    annotationHint.textContent = "Create points of interest within this zone.";
    annotationHint.className = "hint";
    form.appendChild(annotationHint);

    // Button to create annotation
    const addAnnBtn = document.createElement("button");
    addAnnBtn.textContent = "Create Annotation";
    addAnnBtn.className = "sub-btn";
    addAnnBtn.addEventListener("click", (e) => {
        e.preventDefault();
        addAnnotationForm();
    });
    form.appendChild(addAnnBtn);



    // --- Save Button ---
    const saveBtn = document.createElement("button");
    saveBtn.textContent = "Save Zone";
    saveBtn.className = "sub-btn save-btn";
    saveBtn.addEventListener("click", () => {
        if(nameInput.value && pcSelect.selectedOptions.length > 0 && priorityInput.value){
            // get name
            const name = nameInput.value;

            const priority = Number(priorityInput.value);

            // Get selected IDs
            const selectedIDs = Array.from(
                pcSelect.selectedOptions
            ).map(opt => opt.value);

            // Retrieve the actual pointcloud objects
            const selectedPointclouds = selectedIDs.map(id => window.pointcloudMap[id]);


            const volumesList = [];
            for(let volume of viewer.scene.volumes){
                volumesList.push(
                    {
                        position: [volume.position.x, volume.position.y, volume.position.z],
                        rotation: [volume.rotation.x, volume.rotation.y, volume.rotation.z, 'XYZ'],
                        scale: [volume.scale.x, volume.scale.y, volume.scale.z]
                    }

                );
            }

            const annotationList = window.annotationsTemp || [];

            const newZone = new Zone(name, priority, selectedPointclouds, volumesList, annotationList, []);
            window.zones.push(newZone);
            console.log(window.zones);
            viewer.scene.removeAllClipVolumes();

            setAutoSwitchState(true);
        }
        else alert("Incomplete Zone Data. Please try again.");

        updateZoneList();
    });
    form.appendChild(saveBtn);

    // Append form to the main side panel
    const panel = document.getElementById("zoneCreationMenu");
    panel.appendChild(form);
}

function addAnnotationForm() {
    // Remove any existing form if open
    const oldForm = document.getElementById("annotationForm");
    if (oldForm) oldForm.remove();

    // Create form container
    const form = document.createElement("div");
    form.id = "annotationForm";
    form.className = "zone-form";

    const title = document.createElement("h3");
    title.textContent = "Add new Annotation";
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

    form.appendChild(typeSelect);

    // --- Description ---
    const descLabel = document.createElement("label");
    descLabel.textContent = "Description (optional)";
    const descInput = document.createElement("textarea");
    descInput.placeholder = "Enter description (optional)";
    descInput.id = "annotationDescription";
    descInput.rows = 3;
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
    form.appendChild(camBtn);

    // --- Save Button ---
    const saveBtn = document.createElement("button");
    saveBtn.textContent = "Save Annotation";
    saveBtn.className = "sub-btn save-btn";
    saveBtn.addEventListener("click", () => {
        const annotation = viewer.scene.addAnnotation(measurement?.points[0].position || new THREE.Vector3(-999999, -999999, -999999), {
            title: titleInput.value || "",
            description: descInput.value || "",
            cameraPosition: cameraPosition || null,
            cameraTarget: cameraTarget || null
        });
        annotation.visible = false;
        console.log("typeselect ", typeSelect.value);
        annotation.userData = annotation.userData || {};
        annotation.userData.type = typeSelect.value;


        window.annotationsTemp.push(annotation);

        console.log('new annottation', annotation);



        // reset the menu

        clearInterval(check);

        viewer.scene.removeMeasurement(measurement);
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

function updateZoneList() {
    const zoneList = document.getElementById("zoneList");
    if (!zoneList) return;

    zoneList.innerHTML = "";

    if (!window.zones || window.zones.length === 0) {
        const emptyItem = document.createElement("li");
        emptyItem.textContent = "No zones defined yet.";
        emptyItem.className = "zone-empty";
        zoneList.appendChild(emptyItem);
        return;
    }

    window.zones.forEach((z, i) => {
        const li = document.createElement("li");
        li.className = "zone-item";

        // Zone info
        const info = document.createElement("span");
        info.textContent = `${i + 1}. ${z.name} (${z.pointclouds.length} PCs, ${z.boundingBoxes?.length || 0} boxes)`;
        li.appendChild(info);

        // --- Edit button ---
        const editBtn = document.createElement("button");
        editBtn.textContent = "Edit";
        editBtn.className = "zone-btn edit-btn";
        editBtn.addEventListener("click", () => editZone(i));
        li.appendChild(editBtn);

        // --- Delete button ---
        const delBtn = document.createElement("button");
        delBtn.textContent = "Delete";
        delBtn.className = "zone-btn delete-btn";
        delBtn.addEventListener("click", () => deleteZone(i));
        li.appendChild(delBtn);

        zoneList.appendChild(li);
    });
}
function deleteZone(index) {
    const zone = window.zones[index];
    const confirmDel = confirm(`Delete zone "${zone.name}"?`);
    if (!confirmDel) return;

    window.zones.splice(index, 1);
    updateZoneList();
    console.log(`Deleted zone: ${zone.name}`);
}

function editZone(index) {
    const zone = window.zones[index];
    if (!zone) return;

    console.log("Editing zone:", zone);
    setAutoSwitchState(false);

    // Remove any existing open form
    const oldForm = document.getElementById("zoneForm");
    if (oldForm) oldForm.remove();

    const form = document.createElement("div");
    form.id = "zoneForm";
    form.className = "zone-form";

    // --- Close form button ---
    const closeFormBtn = document.createElement("button");
    closeFormBtn.textContent = "×";
    closeFormBtn.className = "zone-form-close";
    closeFormBtn.title = "Close";
    closeFormBtn.addEventListener("click", () => {
        setAutoSwitchState(true);
        form.remove();
    });
    form.appendChild(closeFormBtn);

    // --- Header ---
    const editTitle = document.createElement("h4");
    editTitle.textContent = `Edit Zone: ${zone.name}`;
    form.appendChild(editTitle);

    // --- Name ---
    const nameLabel = document.createElement("label");
    nameLabel.textContent = "Zone Name:";
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.value = zone.name;
    form.appendChild(nameLabel);
    form.appendChild(nameInput);

    // --- Priority ---
    const priorityLabel = document.createElement("label");
    priorityLabel.textContent = "Priority:";
    const priorityInput = document.createElement("input");
    priorityInput.type = "number";
    priorityInput.value = zone.priority;
    form.appendChild(priorityLabel);
    form.appendChild(priorityInput);

    // --- Pointcloud selection ---
    const pcLabel = document.createElement("label");
    pcLabel.textContent = "Select Pointclouds:";
    form.appendChild(pcLabel);

    const pcSearch = document.createElement("input");
    pcSearch.type = "text";
    pcSearch.placeholder = "Search pointclouds...";
    pcSearch.className = "sub-input";
    pcSearch.style.marginBottom = "6px";
    form.appendChild(pcSearch);

    const pcSelect = document.createElement("select");
    pcSelect.multiple = true;
    pcSelect.size = 6;
    form.appendChild(pcSelect);

    // Build options
    window.pointcloudMap = {};
    viewer.scene.pointclouds.forEach((pc, i) => {
        const id = `pc_${i}`;
        window.pointcloudMap[id] = pc;
        const opt = document.createElement("option");
        opt.value = id;
        opt.textContent = pc.name || `PointCloud ${i + 1}`;
        opt.selected = zone.pointclouds.includes(pc);
        pcSelect.appendChild(opt);
    });

    // Filter pointclouds
    pcSearch.addEventListener("input", () => {
        const filter = pcSearch.value.toLowerCase();
        for (const option of pcSelect.options) {
            const text = option.textContent.toLowerCase();
            option.style.display = text.includes(filter) ? "" : "none";
        }
    });

    // --- Bounding Boxes list ---
    const bboxLabel = document.createElement("label");
    bboxLabel.textContent = "Bounding Boxes:";
    form.appendChild(bboxLabel);

    const bboxList = document.createElement("ul");
    bboxList.className = "bbox-list";
    if (zone.boundingBoxes.length === 0) {
        const empty = document.createElement("p");
        empty.textContent = "No bounding boxes defined.";
        empty.className = "hint";
        form.appendChild(empty);
    } else {
        for (const b of zone.boundingBoxes) {
            const li = document.createElement("li");
            li.textContent = `Pos: [${b.position[0].toFixed(2)}, ${b.position[1].toFixed(2)}, ${b.position[2].toFixed(2)}]`;
            bboxList.appendChild(li);
        }
        form.appendChild(bboxList);
    }

    // Button to redefine bounding boxes
    const bboxBtn = document.createElement("button");
    bboxBtn.textContent = "Redefine Boxes";
    bboxBtn.className = "sub-btn";
    bboxBtn.addEventListener("click", () => {
        viewer.volumeTool.startInsertion({ clip: true });
        setTimeout(updateBoundingBoxList, 500);
    });
    form.appendChild(bboxBtn);

    const clearBboxBtn = document.createElement("button");
    clearBboxBtn.textContent = "Clear All Boxes";
    clearBboxBtn.className = "sub-btn clear-btn";
    clearBboxBtn.addEventListener("click", () => {
        viewer.scene.removeAllClipVolumes();
        zone.boundingBoxes = [];
        updateBoundingBoxList(); // refresh UI
    });
    form.appendChild(clearBboxBtn);

    // --- Layer Maps ---
    const layerMapLabel = document.createElement("label");
    layerMapLabel.textContent = "Layer Maps:";
    form.appendChild(layerMapLabel);

    const layerMapList = document.createElement("ul");
    layerMapList.className = "bbox-list";

    if (!zone.layerMaps || zone.layerMaps.length === 0) {
        const empty = document.createElement("p");
        empty.textContent = "No layer maps defined.";
        empty.className = "hint";
        form.appendChild(empty);
    } else {
        zone.layerMaps.forEach((lm, idx) => {
            const li = document.createElement("li");
            li.textContent = `${lm.name} (${lm.layersList.length} layers)`;

            const del = document.createElement("button");
            del.textContent = "×";
            del.className = "zone-btn delete-btn";
            del.style.marginLeft = "8px";
            del.onclick = () => {
                zone.layerMaps.splice(idx, 1);
                form.remove();
                editZone(index);
            };

            li.appendChild(del);
            layerMapList.appendChild(li);
        });

        form.appendChild(layerMapList);
    }

    const addLayerMapBtn = document.createElement("button");
    addLayerMapBtn.textContent = "Manage Layer Maps";
    addLayerMapBtn.className = "sub-btn";
    addLayerMapBtn.onclick = () => openLayerMapPanel(zone, index);
    form.appendChild(addLayerMapBtn);

    /* ---------- Marker 360s ---------- */
    const m360Label = document.createElement("label");
    m360Label.textContent = "360 Markers:";
    form.appendChild(m360Label);

    const m360List = document.createElement("ul");
    m360List.className = "bbox-list";

    if (!zone.marker360s || zone.marker360s.length === 0) {
        const empty = document.createElement("p");
        empty.textContent = "No 360 markers defined.";
        empty.className = "hint";
        form.appendChild(empty);
    } else {
        zone.marker360s.forEach((m, i) => {
            const li = document.createElement("li");
            li.textContent = `${m.name}`;

            const del = document.createElement("button");
            del.textContent = "×";
            del.className = "zone-btn delete-btn";
            del.onclick = () => {
                zone.marker360s.splice(i, 1);
                form.remove();
                editZone(index);
            };

            li.appendChild(del);
            m360List.appendChild(li);
        });

        form.appendChild(m360List);
    }

    const addM360Btn = document.createElement("button");
    addM360Btn.textContent = "Add Marker 360";
    addM360Btn.className = "sub-btn";
    addM360Btn.onclick = () => openMarker360Panel(zone);
    form.appendChild(addM360Btn);



    // --- Annotation Management ---
    const annLabel = document.createElement("label");
    annLabel.textContent = "Annotations:";
    form.appendChild(annLabel);

    const annList = document.createElement("ul");
    annList.className = "annotation-list";
    if (zone.annotations.length === 0) {
        const hint = document.createElement("p");
        hint.textContent = "No annotations yet.";
        hint.className = "hint";
        form.appendChild(hint);
    } else {
        for (let i = 0; i < zone.annotations.length; i++) {
            const a = zone.annotations[i];
            const li = document.createElement("li");
            li.innerHTML = `<b>${a.title}</b> —`;

            const del = document.createElement("button");
            del.textContent = "x";
            del.className = "mini-delete";
            del.title = "Delete annotation";
            del.addEventListener("click", () => {
            const ann = zone.annotations[i];

            // remove from Potree scene if it’s an actual annotation object
            if (ann && viewer.scene.annotations.hasChild(ann)) {
                viewer.scene.annotations.remove(ann);
            }

            // remove from this zone’s list
            zone.annotations.splice(i, 1);

            // refresh UI
            updateZoneList();
            form.remove();
            editZone(index);
            });


            li.appendChild(del);
            annList.appendChild(li);
        }
        form.appendChild(annList);
    }

    const addAnnBtn = document.createElement("button");
    addAnnBtn.textContent = "Add Annotation";
    addAnnBtn.className = "sub-btn";
    addAnnBtn.addEventListener("click", () => {
        window.annotationsTemp = zone.annotations;
        addAnnotationForm();
    });
    form.appendChild(addAnnBtn);

    // --- Save changes ---
    const saveBtn = document.createElement("button");
    saveBtn.textContent = "Save Changes";
    saveBtn.className = "sub-btn save-btn";
    saveBtn.addEventListener("click", () => {
        zone.name = nameInput.value;
        zone.priority = Number(priorityInput.value);

        // Update selected pointclouds
        const selectedIDs = Array.from(pcSelect.selectedOptions).map(o => o.value);
        zone.pointclouds = selectedIDs.map(id => window.pointcloudMap[id]);

        const volumesList = [];
        for(let volume of viewer.scene.volumes){
            volumesList.push(
                {
                    position: [volume.position.x, volume.position.y, volume.position.z],
                    rotation: [volume.rotation.x, volume.rotation.y, volume.rotation.z, 'XYZ'],
                    scale: [volume.scale.x, volume.scale.y, volume.scale.z]
                }

            );
        }
        console.log('old box ', zone.boundingBoxes);
        zone.boundingBoxes = volumesList;
        console.log('new box ', zone.boundingBoxes);


        updateZoneList();
        form.remove();

        setAutoSwitchState(true);


    });
    form.appendChild(saveBtn);

    // --- Cancel ---
    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Cancel";
    cancelBtn.className = "sub-btn clear-btn";
    cancelBtn.addEventListener("click", () => form.remove());
    form.appendChild(cancelBtn);

    const panel = document.getElementById("zoneCreationMenu");
    panel.appendChild(form);
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
            image: mk.image
        })),
        annotations: (z.annotations || []).map(a => ({
        position: a.position ? [a.position.x, a.position.y, a.position.z] : a.annotationPosition || [0, 0, 0],
        title: a.title || "",
        type: a.userData?.type || "none",
        description: a.description || "",
        cameraPosition: a.cameraPosition || [0, 0, 0],
        cameraTarget: a.cameraTarget || [0, 0, 0],
        }))

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
                            mk.image
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
                createLayerBoxes(layerMaps);

                return new Zone(z.name, Number(z.priority), pcs, boxes, annotations, layerMaps, marker360s);
            });

            updateZoneList();
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
                            mk.image
                        ));
                    }
                }

                loadMarker360s();

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
                createLayerBoxes(layerMaps);

                return new Zone(z.name, Number(z.priority), pcs, boxes, annotations, layerMaps, marker360s);
                });

                updateZoneList();
                updateZoneCount();
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



// document.addEventListener("DOMContentLoaded", autoLoadZonesJSON);


function isPointInsideBox(point, box) {
    const pos = new THREE.Vector3(...box.position);
    const rot = new THREE.Euler(...box.rotation);
    const scale = new THREE.Vector3(...box.scale);

    const object = new THREE.Object3D();
    object.position.copy(pos);
    object.rotation.copy(rot);
    object.scale.copy(scale);
    object.updateMatrixWorld(true);

    // Inverse transform point into the box's local space
    const inverseMatrix = new THREE.Matrix4().copy(object.matrixWorld).invert();
    const localPoint = point.clone().applyMatrix4(inverseMatrix);

    // Check if within unit cube bounds (scaled box is unit cube in local space)
    return (
        Math.abs(localPoint.x) <= 0.5 &&
        Math.abs(localPoint.y) <= 0.5 &&
        Math.abs(localPoint.z) <= 0.5
    );
}

/**
 * updateZoneVisibility()
 * 
 * Dynamically shows/hides pointclouds based on camera position within zone bounding boxes.
 * - Supports multiple active zones.
 * - Respects "priority" to handle overlaps (e.g. interior > exterior).
 * - Zones with same priority can be active together.
 */
function updateZoneVisibility() {
    if (!viewer || !viewer.scene || !window.zones) return;

    const camPos = viewer.scene.getActiveCamera().position;
    const activeZones = [];

    // --- Step 1: Find all zones whose boxes contain the camera ---
    viewer.scene.removeAllClipVolumes();
    for (const zone of window.zones) {
        if (!zone.boundingBoxes || zone.boundingBoxes.length === 0) continue;

        for (const box of zone.boundingBoxes) {
            if (isPointInsideBox(camPos, box)) {
                activeZones.push(zone);
                break; // no need to check more boxes in this zone
            }
        }
    }


    // --- Step 2: Resolve priorities ---
    if (activeZones.length === 0) return;

    const highestPriority = Math.max(...activeZones.map(z => z.priority));
    const visibleZones = activeZones.filter(z => z.priority === highestPriority);

    // --- Step 3: Determine visible pointclouds and annotations ---
    const visiblePointclouds = new Set();

    // First hide all annotations globally
    for (const z of window.zones) {
        if (!z.annotations) continue;
        for (const ann of z.annotations) ann.visible = false;
        for (const layerMap of z.layerMaps) setLayerMapVisibility(layerMap, false);
    }

    // Now activate pointclouds + annotations for visible zones
    for (const zone of visibleZones) {
        for(let box of zone.boundingBoxes){
                // Recreate box as a Potree.BoxVolume if it’s a plain data object
                let vol = box instanceof Potree.BoxVolume ? box : (() => {
                    const v = new Potree.BoxVolume();
                    v.position.set(...box.position);
                    v.rotation.set(...box.rotation.slice(0, 3));
                    v.scale.set(...box.scale);
                    return v;
                })();

                // Make sure this box clips the scene from outside → only show interior
                vol.clip = true;
                vol.visible = true;
                vol.visible = false;

                vol.name = zone.name;

                // Add it to the viewer
                viewer.scene.addVolume(vol);

        }
        
        for (const pc of zone.pointclouds) {
            visiblePointclouds.add(pc);
            visiblePointclouds.add(pc.name);
        }
        if (zone.annotations) {
            for (const ann of zone.annotations) ann.visible = true;
        }

        for(const layerMap of zone.layerMaps){
            setLayerMapVisibility(layerMap, true);
        }
    }

                    // Set clipping behavior globally
                viewer.setClipTask(2);

    // --- Step 4: Apply visibility to all pointclouds in the viewer ---
    for (const pc of viewer.scene.pointclouds) {
        if (!pc) continue;
        const shouldShow = visiblePointclouds.has(pc) || visiblePointclouds.has(pc.name);
        pc.visible = shouldShow;
    }

    // Optional debug
    // console.log("Visible zones:", visibleZones.map(z => z.name));
    refreshZoneCheckboxStates();
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
            autoSwitchInterval = setInterval(updateZoneVisibility, 200);
        }
        // If you want clipping only-inside zones when ON:
        viewer.setClipTask(2);
    } else {
        // turn OFF
        if (autoSwitchInterval) {
            clearInterval(autoSwitchInterval);
            autoSwitchInterval = null;
        }

        // Hide annotations when autoswitch is off
        if (window.zones) {
            for (const z of window.zones) {
                if (!z.annotations) continue;
                for (const ann of z.annotations) {
                    ann.visible = false;
                }
            }
        }

        viewer.setClipTask(1);
    }
};

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