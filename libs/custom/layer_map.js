style.textContent += `

/* ==========================================================
   HIGH CONTRAST • GLASS DARK THEME FOR LAYER MAP PANEL
   ========================================================== */

#layerMapSelectionPanel {
    position: fixed;
    top: 80px;
    right: -420px;
    width: clamp(300px, 32vw, 420px);

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

    font-family: sans-serif;
    display: flex;
    flex-direction: column;

    opacity: 0;
}

#layerMapSelectionPanel.open {
    right: 10px;
    opacity: 1;
}

/* ======================= HEADER ======================= */

#layerMapSelectionPanel h3 {
    margin: 0 0 6px 0;
    font-size: 19px;
    font-weight: 600;
    color: #f2f2f7;
    text-shadow: 0 0 4px rgba(0,0,0,0.6);
}

/* Subtitle / metadata */
.layer-map-meta {
    font-size: 13px;
    color: #b5b5c5;
    margin-bottom: 12px;
}

/* ======================= SEARCH ======================= */

.layer-search-input {
    margin-bottom: 12px;
    padding: 8px 12px;
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(255,255,255,0.2);
    color: #fafafa;
    border-radius: 8px;
    width: 100%;
    box-sizing: border-box;
}

.layer-search-input:focus {
    border-color: #6e6bff;
    background: rgba(255,255,255,0.12);
    box-shadow: 0 0 0 3px rgba(79,70,229,0.3);
    outline: none;
}

/* ======================= LAYER LIST ======================= */

.layer-list {
    flex: 1;
    overflow-y: auto;
    padding-right: 6px;
}

/* Individual layer row */
.layer-item {
    display: flex;
    align-items: center;
    justify-content: space-between;

    margin: 6px 0;
    padding: 8px 12px;

    background: rgba(0,0,0,0.55);
    backdrop-filter: blur(8px) saturate(150%);
    border: 1px solid rgba(255,255,255,0.12);

    border-radius: 8px;
    cursor: pointer;

    transition: background .12s, box-shadow .12s;
}

.layer-item:hover {
    background: rgba(79,70,229,0.55);
    box-shadow: 0 0 10px rgba(79,70,229,0.5);
}

.layer-name {
    font-size: 14px;
    font-weight: 600;
    color: #ffffff;
    text-shadow: 0 0 4px rgba(0,0,0,0.8);
}

/* Checkbox */
.layer-toggle {
    width: 18px;
    height: 18px;
    cursor: pointer;
    accent-color: #6f6bff;
}

/* ======================= FOOTER ======================= */

.layer-panel-footer {
    margin-top: 12px;
    display: flex;
    justify-content: flex-end;
    gap: 10px;
}

.layer-btn {
    padding: 8px 14px;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    font-weight: 600;
    color: white;
    background: rgba(79,70,229,0.85);
    transition: background .2s ease, box-shadow .2s ease;
}

.layer-btn:hover {
    background: rgba(99,90,245,1);
    box-shadow: 0 0 10px rgba(99,90,245,0.45);
}

.layer-btn.cancel {
    background: rgba(255,255,255,0.15);
}

.layer-btn.cancel:hover {
    background: rgba(255,255,255,0.25);
}

/* ======================= OPACITY SLIDER ======================= */

.layer-opacity {
    width: 110px;
    margin-left: 12px;
    appearance: none;
    height: 6px;
    border-radius: 6px;
    background: rgba(255,255,255,0.25);
    backdrop-filter: blur(6px);
    cursor: pointer;
    outline: none;
}

/* Track hover */
.layer-opacity:hover {
    background: rgba(255,255,255,0.35);
}

/* WebKit thumb */
.layer-opacity::-webkit-slider-thumb {
    appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #6f6bff;
    box-shadow: 0 0 8px rgba(111,107,255,0.7);
    cursor: pointer;
    border: none;
}

/* Firefox thumb */
.layer-opacity::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #6f6bff;
    box-shadow: 0 0 8px rgba(111,107,255,0.7);
    border: none;
    cursor: pointer;
}

`;


class LayerMap {
    constructor(name, boundingBoxes = [], layersList = [], override){
        this.name = name;   //name of layer map
        this.boundingBoxes = boundingBoxes; //bounding boxes coordinates which will be used to create threejs boxes which will be used in raycaster detection
        this.layersList = layersList;   // a simple object with just {name, pointcloud} this is the list of layers
    }
}



window.inLayerMode = false;
window.selectedBox = null;

function toggleLayerMapSelectionPanel(layerMap) {
    const existing = document.getElementById("layerMapSelectionPanel");

    // ---- CLOSE ----
    if (existing) {
        existing.classList.remove("open");
        existing.addEventListener("transitionend", function handler(e) {
            if (e.propertyName === "right") {
                existing.remove();
                existing.removeEventListener("transitionend", handler);
            }
        });
        return;
    }

    // ---- CREATE ----
    const panel = document.createElement("div");
    panel.id = "layerMapSelectionPanel";

    panel.innerHTML = `
        <h3>${layerMap.name}</h3>

        <input
            type="text"
            class="layer-search-input"
            placeholder="Search layers..."
        />

        <div class="layer-list"></div>
    `;


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

    document.body.appendChild(panel);

    const listEl = panel.querySelector(".layer-list");

    // Populate layers
    for (const layer of layerMap.layersList) {
        const row = document.createElement("div");
        row.className = "layer-item";

        row.innerHTML = `
            <span class="layer-name">${layer.name}</span>
            <input
                type="range"
                class="layer-opacity"
                min="0"
                max="100"
                value="100"
            />
        `;

        const slider = row.querySelector(".layer-opacity");

        // Row click (not slider)
        row.addEventListener("click", () => {
            console.log("Row clicked:", layer.name);
            setLayerOn(layer, layerMap);
        });

        // Slider interaction (block bubbling)
        ["mousedown", "click", "input", "pointerdown"].forEach(evt => {
            slider.addEventListener(evt, e => e.stopPropagation());
        });

        // Slider opacity logic
        slider.addEventListener("input", () => {
            const opacity = slider.value / 100;

            if (layer.pointcloud && layer.pointcloud.material) {
                layer.pointcloud.material.transparent = true;
                layer.pointcloud.material.opacity = opacity;
                layer.pointcloud.material.needsUpdate = true;
            }
        });

        listEl.appendChild(row);
    }



    // Close button


    // Animate in
    requestAnimationFrame(() => panel.classList.add("open"));
}

function setLayerOn(layer, layerMap){
    let pcs = [];
    layerMap.layersList.forEach(layer => {
        pcs.push(layer.pointcloud);
    });

    pcs.forEach(pc => {
        if(pc) pc.visible = false
    });
    
    if(layer.pointcloud) layer.pointcloud.visible = true;
}

function openLayerMapPanel(zone, zoneIndex) {
    // Close existing
    const existing = document.getElementById("layerMapPanel");
    if (existing) existing.remove();

    const panel = document.createElement("div");
    panel.id = "layerMapPanel";
    panel.className = "zone-panel open";

    /* ---------- Title ---------- */
    const title = document.createElement("h3");
    title.textContent = `Layer Maps — ${zone.name}`;
    panel.appendChild(title);

    /* ---------- Close ---------- */
    const closeBtn = document.createElement("button");
    closeBtn.textContent = "×";
    closeBtn.className = "zone-form-close";
    closeBtn.onclick = () => panel.remove();
    panel.appendChild(closeBtn);

    /* ---------- List ---------- */
    const listContainer = document.createElement("div");
    listContainer.className = "zone-list-container";

    const listTitle = document.createElement("h4");
    listTitle.textContent = "Existing Layer Maps";
    listContainer.appendChild(listTitle);

    const list = document.createElement("ul");
    list.className = "zone-list";

    if (!zone.layerMaps || zone.layerMaps.length === 0) {
        const empty = document.createElement("li");
        empty.textContent = "No layer maps defined.";
        empty.className = "zone-empty";
        list.appendChild(empty);
    } else {
        zone.layerMaps.forEach((lm, i) => {
            const li = document.createElement("li");
            li.className = "zone-item";

            const label = document.createElement("span");
            label.textContent = `${lm.name} (${lm.layersList.length} layers)`;
            li.appendChild(label);

            const edit = document.createElement("button");
            edit.textContent = "Edit";
            edit.className = "zone-btn edit-btn";
            edit.onclick = () => openLayerMapForm(zone, lm, i);
            li.appendChild(edit);

            const del = document.createElement("button");
            del.textContent = "Delete";
            del.className = "zone-btn delete-btn";
            del.onclick = () => {
                zone.layerMaps.splice(i, 1);
                panel.remove();
                openLayerMapPanel(zone, zoneIndex);
            };
            li.appendChild(del);

            list.appendChild(li);
        });
    }

    listContainer.appendChild(list);
    panel.appendChild(listContainer);

    /* ---------- Add ---------- */
    const addBtn = document.createElement("button");
    addBtn.textContent = "Create New Layer Map";
    addBtn.className = "close-btn";
    addBtn.onclick = () => openLayerMapForm(zone);
    panel.appendChild(addBtn);

    document.body.appendChild(panel);
}


function openLayerMapForm(zone, existing = null, index = null) {
    const old = document.getElementById("layerMapForm");
    if (old) old.remove();

    viewer.scene.removeAllMeasurements();

    const form = document.createElement("div");
    form.id = "layerMapForm";
    form.className = "zone-panel open";

    const title = document.createElement("h3");
    title.textContent = existing ? "Edit Layer Map" : "Create Layer Map";
    form.appendChild(title);

    const close = document.createElement("button");
    close.textContent = "×";
    close.className = "zone-form-close";
    close.onclick = () => form.remove();
    form.appendChild(close);

    const body = document.createElement("div");
    body.className = "zone-form";

    /* ---------- Name ---------- */
    const name = document.createElement("input");
    name.placeholder = "Layer Map Name";
    name.value = existing?.name || "";
    body.appendChild(name);

    /* ---------- Bounding Boxes ---------- */
    const bboxLabel = document.createElement("label");
    bboxLabel.textContent = "Activation Volumes";
    body.appendChild(bboxLabel);

    const bboxBtn = document.createElement("button");
    bboxBtn.textContent = "Draw Bounding Boxes";
    bboxBtn.className = "sub-btn";
    bboxBtn.onclick = () => viewer.volumeTool.startInsertion({ clip: false });
    body.appendChild(bboxBtn);

    /* ---------- Layers ---------- */
    const layersLabel = document.createElement("label");
    layersLabel.textContent = "Layers (Scroll Order)";
    body.appendChild(layersLabel);

    const layersHint = document.createElement("p");
    layersHint.className = "hint";
    layersHint.textContent = "Each layer maps a pointcloud to a named scroll step.";
    body.appendChild(layersHint);

    const layerList = document.createElement("ul");
    layerList.className = "bbox-list";
    body.appendChild(layerList);

    let layerRows = [];

    /* Existing layers (edit mode) */
    if (existing?.layersList) {
        existing.layersList.forEach(l => {
            const row = createLayerRow(l);
            layerRows.push(row);
            layerList.appendChild(row.element);
        });
    }

    /* Add layer button */
    const addLayerBtn = document.createElement("button");
    addLayerBtn.textContent = "Add Layer";
    addLayerBtn.className = "sub-btn";
    addLayerBtn.onclick = () => {
        const row = createLayerRow();
        layerRows.push(row);
        layerList.appendChild(row.element);
    };
    body.appendChild(addLayerBtn);


    /* ---------- Save ---------- */
    let boxes;
    const save = document.createElement("button");
    save.textContent = "Save";
    save.className = "sub-btn save-btn";
    save.onclick = () => {
        boxes = viewer.scene.volumes.map(v => ({
            position: [v.position.x, v.position.y, v.position.z],
            rotation: [v.rotation.x, v.rotation.y, v.rotation.z, "XYZ"],
            scale: [v.scale.x, v.scale.y, v.scale.z]
        }));

        let layerRowsMap = [];

        const noneLayer = {
            name: 'None',
            pointcloud: null
        };

        layerRowsMap.push(noneLayer);

        layerRows.forEach(row => {
            layerRowsMap.push(row.getValue());
        });

        console.log('layerRows: ', layerRowsMap);

        const map = new LayerMap(
            name.value,
            boxes,
            layerRowsMap
        );
        
        console.log(map);

        zone.layerMaps = zone.layerMaps || [];
        existing ? zone.layerMaps[index] = map : zone.layerMaps.push(map);

        viewer.scene.removeAllMeasurements();
        form.remove();

        setTimeout(() => {
            createLayerBoxes(zone.layerMaps);
        }, 200);
    };

    body.appendChild(save);
    form.appendChild(body);
    document.body.appendChild(form);
}

function createLayerBoxes (){

    window.zones.forEach(zone => {
        layerMaps = zone.layerMaps;

        layerMaps.forEach(layerMap => {
            layerMap.boundingBoxes.forEach(box => {
            // --- Geometry ---
            const geometry = new THREE.BoxGeometry(...box.scale);

            const edges = new THREE.EdgesGeometry(geometry);

            // --- Material (bright emissive look) ---
            const material = new THREE.LineBasicMaterial({
                color: 0x4f46e5,      // indigo glow color
                linewidth: 1000,        // NOTE: ignored on most platforms
                transparent: true,
                opacity: 0.9
            });

            const materialBox = new THREE.MeshBasicMaterial({ visible: false});

            const triggerBox = new THREE.Mesh(geometry, materialBox);

            const line = new THREE.LineSegments(edges, material);
            line.raycast = () => {};



            // --- Transform ---
            triggerBox.position.set(...box.position);
            triggerBox.rotation.set(...box.rotation.slice(0, 3));

            // line._layerMap = layerMap;
            triggerBox._layerMap = layerMap;
            triggerBox.userData._raycast = triggerBox.raycast;
            triggerBox.userData.type = "layermap";

            triggerBox.raycast = () => {}; //disables raycast initially
            line.visible = false; //hides initially

            viewer.scene.scene.add(triggerBox);
            triggerBox.add(line);
            layerMap._triggerBox = triggerBox;
            layerMap._lines = line;

            // document.addEventListener('mousemove', onMouseMove, false);

        });
    });
    })

}


// from https://github.com/ClassOutside/H
function getMouseVector2(event){
  const mousePointer = new THREE.Vector2();

  mousePointer.x = (event.clientX / window.innerWidth) * 2 -1;
  mousePointer.y = -(event.clientY / window.innerHeight)*2 + 1;

  return mousePointer;
}
// from https://github.com/ClassOutside/H 
function checkRayIntersections(mousePointer, camera, raycaster, scene, getFirstValue){
  
  raycaster.setFromCamera(mousePointer, camera);

  let intersections = raycaster.intersectObjects(scene.children, true);
  
  if(getFirstValue){
    for(const intersection of intersections){
        if(intersection.object instanceof THREE.Mesh) return intersection;  //returns only collision box
    }

    if(intersections.length === 0) return [];
  }
  

  // intersections = getFirstValue ? intersections[0] : intersections;

  return intersections;
}

function onPointerMove(event) {

    const mousePointer = getMouseVector2(event);
    const raycaster = new THREE.Raycaster();

    const intersections = checkRayIntersections(
        mousePointer,
        viewer.scene.getActiveCamera(),
        raycaster,
        viewer.scene.scene,
        true
    );
    
    if (intersections.length != 0 && intersections.object?.geometry) {
        switch(intersections.object.userData?.type){
            case "layermap":
                triggerLayerMode(intersections.object);
                break;
            case "marker360":
                onMarker360Hover(intersections.object, event);
                break;
            case "beacon":
                onBeaconHover(intersections.object, event);
                break;
        }
    } else {
        restoreMarker360Appearance(currentHoveredMarker360);
        currentHoveredMarker360 = null;
        currentHoveredBeacon = null;
        onMarker360Unhover();
        onBeaconUnhover();
        exitLayerMode();
    }

    // console.log('layermod: ', window.inLayerMode);
}

function exitLayerMode(){
    if(!window.inLayerMode) return;

    window.inLayerMode = false;
}

function triggerLayerMode(boxObject){
    if(window.inLayerMode) return;

    window.inLayerMode = true;
    // console.log(boxObject);

    // make box outline glow or something

    // use scroll wheel to change pc visibility

    toggleLayerMapSelectionPanel(boxObject._layerMap);
}



function createLayerRow(existing = null) {
    const li = document.createElement("li");
    li.style.display = "flex";
    li.style.gap = "6px";
    li.style.alignItems = "center";

    /* ---- Layer Name ---- */
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.placeholder = "Layer name (e.g. IR)";
    nameInput.style.flex = "1";
    nameInput.value = existing?.name || "";

    /* ---- Pointcloud Select ---- */
    const pcSelect = document.createElement("select");
    pcSelect.style.flex = "1";

    let selectedPC = null;

    /* ---- None option ---- */
    const none_opt = document.createElement("option");
    none_opt.textContent = "— None —";
    none_opt._pc = null;
    pcSelect.appendChild(none_opt);

    /* ---- Pointcloud options ---- */
    viewer.scene.pointclouds.forEach(pc => {
        const opt = document.createElement("option");
        opt.textContent = pc.name ?? "(unnamed)";
        opt._pc = pc;

        if (existing && existing.pointcloud === pc) {
            opt.selected = true;
            selectedPC = pc;
        }

        pcSelect.appendChild(opt);
    });

    /* ---- Track selection ---- */
    pcSelect.addEventListener("change", () => {
        const opt = pcSelect.selectedOptions[0];
        selectedPC = opt?._pc ?? null;
    });

    /* ---- Delete ---- */
    const delBtn = document.createElement("button");
    delBtn.textContent = "×";
    delBtn.className = "zone-btn delete-btn";
    delBtn.onclick = () => li.remove();

    li.append(nameInput, pcSelect, delBtn);

    return {
        element: li,
        getValue: () => ({
            name: nameInput.value.trim(),
            pointcloud: selectedPC   // always correct
        })
    };

}


function setLayerMapVisibility(layerMap, visibility){
    if(visibility){
        layerMap._lines.visible = true;
        layerMap._triggerBox.raycast = layerMap._triggerBox.userData._raycast;

        for(const layer of layerMap.layersList){
            if(!layer.pointcloud) continue;
            if (layer.name === "None") {
                layer.pointcloud.visible = true;
            } else {
                layer.pointcloud.visible = false;
            }
        }
    }
    else {
        layerMap._lines.visible = false;
        layerMap._triggerBox.raycast = () => {};

        for(const layer of layerMap.layersList){
            if(!layer.pointcloud) continue;
            if (layer.name === "None") {
                layer.pointcloud.visible = true;
            } else {
                layer.pointcloud.visible = false;
            }
        }

        if(document.getElementById("layerMapSelectionPanel")) toggleLayerMapSelectionPanel(layerMap);
    }
}