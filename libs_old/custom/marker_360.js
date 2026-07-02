class Marker360 {
    constructor (name, position, image){
        this.name = name;
        this.position = position;
        this.image = image;
    }
}


document.addEventListener("DOMContentLoaded", () => {
    viewer.addEventListener('camera_changed', () => {
      updateCameraLight();
    });
});

function openMarker360Panel(zone) {
    const existing = document.getElementById("marker360Panel");
    if (existing) existing.remove();

    const panel = document.createElement("div");
    panel.id = "marker360Panel";
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

            marker.add(outline);

            /* ---------- Transform ---------- */
            marker.position.set(pos[0], pos[1], pos[2]+2);
            marker.rotation.x = Math.PI;

            /* ---------- Metadata ---------- */
            marker.userData.type = "marker360";
            marker.userData.marker360 = marker360;
            marker.userData.zone = zone;

            marker360._sphereMarker = marker;
            /* ---------- Add to scene ---------- */
            viewer.scene.scene.add(marker);
        });
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
    
    if (!markerMesh || markerMesh === currentHoveredMarker360) return;

    // Restore previous
    if (currentHoveredMarker360) {
        restoreMarker360Appearance(currentHoveredMarker360);
    }

    currentHoveredMarker360 = markerMesh;
    markerHoverStartTime = performance.now();

    // Visual feedback
    highlightMarker360(markerMesh);

    // Optional: show tooltip / UI
    // showMarker360Tooltip(markerMesh, event);
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
