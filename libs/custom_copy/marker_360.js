style.textContent += `
.marker360-hover-dialog {
    position: fixed;
    pointer-events: none;
    z-index: 9999;

    background: rgba(20, 25, 30, 0.92);
    color: #fff;
    padding: 8px 12px;
    border-radius: 6px;

    font-size: 13px;
    font-family: system-ui, sans-serif;
    white-space: nowrap;

    box-shadow: 0 4px 12px rgba(0,0,0,0.4);
    transition: opacity 0.15s ease;
}

.marker360-card {
    border: 1px solid #333;
    border-radius: 6px;
    padding: 10px;
    margin-bottom: 10px;
    background: #1a1b1f;
}

.marker360-actions {
    display: flex;
    gap: 8px;
    margin-top: 8px;
}

.danger-btn {
    background: #7a1f1f;
}

.sphere-correction-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
    margin-bottom: 8px;
}

.sphere-correction-grid span {
    font-size: 12px;
    opacity: 0.8;
    color: #fff;
}

.sphere-correction-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
    margin-bottom: 8px;
}

.angle-input span {
    font-size: 12px;
    opacity: 0.8;
}

.angle-input-wrap {
    display: flex;
    align-items: center;
    gap: 4px;
}

.angle-input-wrap input {
    width: 56px;          /* short but usable */
    padding: 4px 6px;
    text-align: right;
}

.angle-suffix {
    font-size: 12px;
    opacity: 0.7;
}


`;

class Marker360 {
    constructor (name, position, image, sphereCorrection, tiles){
        this.name = name;
        this.position = position;
        this.image = image;
        this.sphereCorrection = sphereCorrection;
        this.tiles = tiles;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    viewer.addEventListener('camera_changed', () => {
        updateCameraLight();
        createMarker360HoverDialog();
    });
});


function openMarker360ManagerPanel(zone) {
    const existing = document.getElementById("marker360ManagerPanel");
    if (existing) existing.remove();

    const panel = document.createElement("div");
    panel.id = "marker360ManagerPanel";
    panel.className = "zone-panel open";

    /* ---------- Header ---------- */
    const title = document.createElement("h3");
    title.textContent = `Marker 360s — ${zone.name}`;
    panel.appendChild(title);

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "×";
    closeBtn.className = "zone-form-close";
    closeBtn.onclick = () => panel.remove();
    panel.appendChild(closeBtn);

    const content = document.createElement("div");
    content.className = "zone-form";

    zone.marker360s = zone.marker360s || [];

    /* ---------- List ---------- */
    if (zone.marker360s.length === 0) {
        const empty = document.createElement("p");
        empty.className = "hint";
        empty.textContent = "No Marker 360s added yet.";
        content.appendChild(empty);
    }

    zone.marker360s.forEach((marker, index) => {
        const card = document.createElement("div");
        card.className = "marker360-card";

        card.style.display = "flex";
        card.style.flexDirection = "column";
        card.style.gap = "2px";

        /* ---- Name ---- */
        const nameLabel = document.createElement("label");
        nameLabel.textContent = "Name";
        const nameInput = document.createElement("input");
        nameInput.value = marker.name;

        /* ---- Image ---- */
        const imgLabel = document.createElement("label");
        imgLabel.textContent = "360 Image URL";
        const imgInput = document.createElement("input");
        imgInput.value = marker.image;

        /* ---- tiles ---- */
        const tilesLabel = document.createElement("label");
        tilesLabel.textContent = "360 Tiles URL (ending with 'tiles')";
        const tilesInput = document.createElement("input");
        tilesInput.value = marker.tiles;

        /* ---- Sphere Correction ---- */
        const sphereLabel = document.createElement("label");
        sphereLabel.textContent = "Sphere Correction (degrees)";

        const sphereWrap = document.createElement("div");
        sphereWrap.className = "sphere-correction-grid";

        function makeAngleInput(labelText, key) {
            const wrap = document.createElement("div");
            wrap.className = "angle-input";

            const label = document.createElement("span");
            label.textContent = labelText;

            const inputWrap = document.createElement("div");
            inputWrap.className = "angle-input-wrap";

            const input = document.createElement("input");
            input.type = "number";
            input.step = "0.1";
            input.value = marker.sphereCorrection[key] ?? 0;
            input.style.width = "40%";
            input.style.textAlign = 'left';
            input.oninput = () => {
                marker.sphereCorrection[key] = parseFloat(input.value) || 0;

            viewer360.setOption('sphereCorrection', {
                    pan: `${marker.sphereCorrection.pan}deg`,
                    tilt: `${marker.sphereCorrection.tilt}deg`,
                    roll: `${marker.sphereCorrection.roll}deg`
                });                   
            };

            const suffix = document.createElement("span");
            suffix.className = "angle-suffix";
            suffix.textContent = "deg";

            inputWrap.append(input);
            wrap.append(label, inputWrap);
            return wrap;
        }

        sphereWrap.append(
            makeAngleInput("Pan", "pan"),
            makeAngleInput("Roll", "roll"),
            makeAngleInput("Tilt", "tilt")
        );

        /* ---- Position ---- */
        const pos = marker.position;
        const posText = document.createElement("p");
        posText.className = "hint";
        posText.textContent = `Position: [${pos[0].toFixed(2)}, ${pos[1].toFixed(2)}, ${pos[2].toFixed(2)}]`;

        let measurement = null;

        const setPosBtn = document.createElement("button");
        setPosBtn.textContent = "Re-pick Position";
        setPosBtn.className = "sub-btn";
        setPosBtn.onclick = () => {
            viewer.scene.removeAllMeasurements();

            measurement = viewer.measuringTool.startInsertion({
                maxMarkers: 1,
                showCoordinates: true,
                name: "Marker360_Edit"
            });

            const check = setInterval(() => {
                if (measurement.points.length > 0) {
                    const p = measurement.points[0].position;
                    marker.position = [p.x, p.y, p.z];
                    posText.textContent =
                        `Position: [${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}]`;
                    viewer.scene.removeMeasurement(measurement);
                    clearInterval(check);
                }
            }, 300);
        };

        /* ---- Actions ---- */
        const actions = document.createElement("div");
        actions.className = "marker360-actions";

        const saveBtn = document.createElement("button");
        saveBtn.textContent = "Save";
        saveBtn.className = "sub-btn save-btn";
        saveBtn.onclick = () => {
            marker.name = nameInput.value;
            marker.image = imgInput.value;
            marker.tiles = tilesInput.value;
            console.log("Updated Marker360:", marker);
        };

        const deleteBtn = document.createElement("button");
        deleteBtn.textContent = "Delete";
        deleteBtn.className = "sub-btn danger-btn";
        deleteBtn.onclick = () => {
            if (!confirm("Delete this Marker 360?")) return;
            zone.marker360s.splice(index, 1);
            panel.remove();
            openMarker360ManagerPanel(zone);
        };

        actions.append(saveBtn, deleteBtn);

        card.append(
            nameLabel, nameInput,
            imgLabel, imgInput,
            tilesLabel, tilesInput,
            sphereLabel, sphereWrap,
            posText,
            setPosBtn,
            actions
        );

        content.appendChild(card);
    });

    /* ---------- Add New ---------- */
    const addBtn = document.createElement("button");
    addBtn.textContent = "+ Add Marker 360";
    addBtn.className = "sub-btn";
    addBtn.onclick = () => {
        panel.remove();
        openAddMarker360Panel(zone);
    };

    content.appendChild(addBtn);
    panel.appendChild(content);
    document.body.appendChild(panel);
}


function openAddMarker360Panel(zone) {
    const existing = document.getElementById("addMarker360Panel");
    if (existing) existing.remove();

    const panel = document.createElement("div");
    panel.id = "addMarker360Panel";
    panel.className = "zone-panel open";

    const title = document.createElement("h3");
    title.textContent = `Marker 360s — ${zone.name}`;
    panel.appendChild(title);

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "×";
    closeBtn.className = "zone-form-close";
    closeBtn.onclick = () => panel.remove();
    panel.appendChild(closeBtn);

    /* ---------- Form ---------- */
    const form = document.createElement("div");
    form.className = "zone-form";

    /* ---- Name ---- */
    const nameLabel = document.createElement("label");
    nameLabel.textContent = "Marker Name:";
    const nameInput = document.createElement("input");
    nameInput.placeholder = "e.g. Ceiling Fresco View";
    form.append(nameLabel, nameInput);

    /* ---- Image ---- */
    const imgLabel = document.createElement("label");
    imgLabel.textContent = "360 Image (URL):";
    const imgInput = document.createElement("input");
    imgInput.placeholder = "panorama_01.jpg";
    form.append(imgLabel, imgInput);

    /* ---- Position ---- */
    const posLabel = document.createElement("label");
    posLabel.textContent = "Marker Position:";
    form.appendChild(posLabel);

    const posHint = document.createElement("p");
    posHint.className = "hint";
    posHint.textContent = "Click to select position in scene.";
    form.appendChild(posHint);

    let markerPos = null;
    let measurement = null;

    let check = null;

    const posBtn = document.createElement("button");
    posBtn.textContent = "Select Position";
    posBtn.className = "sub-btn";
    posBtn.onclick = () => {
        viewer.scene.removeAllMeasurements();
        measurement = viewer.measuringTool.startInsertion({
            maxMarkers: 1,
            showCoordinates: true,
            name: "Marker360"
        });

        check = setInterval(() => {
            if (measurement.points.length > 0) {
                const p = measurement.points[0].position;
                markerPos = [p.x, p.y, p.z];
                posHint.textContent = `Position: [${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}]`;
            }
        }, 300);
    };
    form.appendChild(posBtn);

    /* ---- Save ---- */
    const saveBtn = document.createElement("button");
    saveBtn.textContent = "Save Marker 360";
    saveBtn.className = "sub-btn save-btn";
    saveBtn.onclick = () => {
        if (!nameInput.value || !markerPos || !imgInput.value) {
            alert("Incomplete Marker360 data.");
            return;
        }

        zone.marker360s = zone.marker360s || [];

        const p = measurement.points[0].position;
        markerPos = [p.x, p.y, p.z];
        clearInterval(check);

        const newMarker360 = new Marker360(nameInput.value, markerPos, imgInput.value);
        zone.marker360s.push(newMarker360);

        console.log(newMarker360);

        viewer.scene.removeMeasurement(measurement);
        panel.remove();
    };

    form.appendChild(saveBtn);
    panel.appendChild(form);
    document.body.appendChild(panel);
}


function loadMarker360s() {

    console.log("loading marksers");
    const loader = new THREE.TextureLoader();

    const gradientTex = loader.load("gradient.png", tex => {
        tex.minFilter = THREE.NearestFilter;
        tex.magFilter = THREE.NearestFilter;
        tex.generateMipmaps = false;
    });

    // Main toon material (shared)
    const mainMat = new THREE.MeshToonMaterial({
        color: 0xffffff,
        gradientMap: gradientTex
    });

    // Outline material (shared)
    const outlineMat = new THREE.MeshToonMaterial({
        color: 0x325b73,
        side: THREE.BackSide
    });

    window.zones.forEach(zone => {
        if (!Array.isArray(zone.marker360s)) return;

        zone.marker360s.forEach(marker360 => {
            const pos = marker360.position;
            if (!pos) return;

            /* ---------- Main Sphere ---------- */
            const sphereGeom = new THREE.SphereGeometry(1, 16, 12);
            const marker = new THREE.Mesh(sphereGeom, mainMat.clone());

            /* ---------- Outline Sphere ---------- */
            const outlineGeom = new THREE.SphereGeometry(1.3, 16, 12);
            const outline = new THREE.Mesh(outlineGeom, outlineMat.clone());
            outline.scale.set(1.05, 1.05, 1.05);

            outline.raycast = () => {};

            marker.add(outline);

            /* ---------- Transform ---------- */
            marker.position.set(pos[0], pos[1], pos[2]+2);
            marker.rotation.x = Math.PI;

            /* ---------- Metadata ---------- */
            marker.userData.type = "marker360";
            marker.userData.marker360 = marker360;
            marker.userData.zone = zone;

            marker360._raycast = marker.raycast;

            marker360._sphereMarker = marker;
            /* ---------- Add to scene ---------- */
            viewer.scene.scene.add(marker);
        });

        setMarker360sVisibilityByZone(zone, getZoneVisibility(zone));
    });

    /* ---------- Camera-following light (same as before) ---------- */
    if (!window.markerCamLight && !window.lightCreated) {
        window.markerCamLight = new THREE.DirectionalLight(0xffffff, 1.2);
        viewer.scene.scene.add(markerCamLight.target);
        viewer.scene.scene.add(markerCamLight);
    }
}


function updateCameraLight() {
    const target = viewer.scene.view.getPivot();
    const position = viewer.scene.view.position;
    if(window.markerCamLight){
      window.markerCamLight.position.copy(position);
      window.markerCamLight.target.position.copy(target);
    }
}

window.isHoveringDialog = false;

window.currentHoveredMarker360 = null;
let markerHoverStartTime = 0;


function onMarker360Hover(markerMesh, event) {
    // console.log('markerMesh: ', markerMesh);
    // console.log(currentHoveredMarker360);
    
    updateMarker360HoverPosition(event);

    if (!markerMesh || markerMesh === currentHoveredMarker360) return;

    // Restore previous
    if (currentHoveredMarker360) {
        restoreMarker360Appearance(currentHoveredMarker360);
    }

    currentHoveredMarker360 = markerMesh;
    markerHoverStartTime = performance.now();

    // Visual feedback
    highlightMarker360(markerMesh);
    showMarker360HoverDialog(markerMesh, event);

    // Optional: show tooltip / UI
    // showMarker360Tooltip(markerMesh, event);
}

function createMarker360HoverDialog() {
    if (document.getElementById("marker360HoverDialog")) return;

    const dialog = document.createElement("div");
    dialog.id = "marker360HoverDialog";
    dialog.className = "marker360-hover-dialog";
    dialog.style.display = "none";

    document.body.appendChild(dialog);
}

function showMarker360HoverDialog(markerMesh, event) {
    const dialog = document.getElementById("marker360HoverDialog");
    if (!dialog) return;

    const marker360 = markerMesh.userData.marker360;
    const zone = markerMesh.userData.zone;

    dialog.innerHTML = `
        <strong>${marker360?.name}</strong><br>
        <span style="opacity:0.8">${zone?.name || ""}</span><br>
        <span style="opacity:0.6">Click to open 360° image</span>
    `;

    dialog.style.display = "block";
    dialog.style.opacity = "1";

    if (event?.clientX !== undefined) {
        dialog.style.left = `${event.clientX + 12}px`;
        dialog.style.top  = `${event.clientY + 12}px`;
    }
}


function updateMarker360HoverPosition(event) {
    const dialog = document.getElementById("marker360HoverDialog");
    if (!dialog || !currentHoveredMarker360) return;

    dialog.style.left = `${event.clientX + 12}px`;
    dialog.style.top  = `${event.clientY + 12}px`;
}

function hideMarker360HoverDialog() {
    const dialog = document.getElementById("marker360HoverDialog");
    if (!dialog) return;

    dialog.style.opacity = "0";
    dialog.style.display = "none";

}




function highlightMarker360(marker) {

    if (marker.material?.color) {
        marker.material.color.set(0x325b73);
    }
}

function restoreMarker360Appearance(marker) {
    if (!marker) return;

    if (marker.material?.color) {
        marker.material.color.set(0xffffff);
    }

    if (marker.userData.baseScale) {
        marker.scale.copy(marker.userData.baseScale);
    }
}

window.animateHoveredMarker360 = function () {
    if (!currentHoveredMarker360) return;

    const t = (performance.now() - markerHoverStartTime) / 1000;
    const scale = 1 + Math.sin(t * Math.PI * 2) * 0.1;

    currentHoveredMarker360.scale.setScalar(scale);
};


window.addEventListener("pointerdown", () => {
    if (currentHoveredMarker360) {
        window.open360(currentHoveredMarker360);
    }
});


function setMarker360sVisibilityByZone(zone, visibility){
    if(zone.marker360s.length == 0) return;

    // console.log('marker vis: ', visibility );

    if(window.in360View) return;

    zone?.marker360s.forEach(marker360 => {
        marker360._sphereMarker.visible = visibility;

        if(visibility){
            marker360._sphereMarker.raycast = marker360._raycast;
        }
        else {
            marker360._sphereMarker.raycast = () => {};
        }
    });
}