// ══════════════════════════════════════════════════════════════
//  marker360.js – 360° Markers with rotating wireframe torus
//  and themed hover card matching beacon style
// ══════════════════════════════════════════════════════════════

style.textContent += `

/* ── Marker360 Hover Card (matches beacon style) ─────────── */
.marker360-hover-card {
    position: fixed;
    pointer-events: none;
    z-index: 9999;
    opacity: 0;
    transform: translateY(6px) scale(0.96);
    transition: opacity 0.2s ease, transform 0.2s ease;
    font-family: 'Segoe UI', system-ui, sans-serif;
    max-width: 260px;
}

.marker360-hover-card.visible {
    opacity: 1;
    transform: translateY(0) scale(1);
}

.marker360-hover-card-inner {
    background: rgba(12, 12, 18, 0.88);
    backdrop-filter: blur(20px) saturate(150%);
    -webkit-backdrop-filter: blur(20px) saturate(150%);
    border: 1px solid rgba(100, 220, 180, 0.18);
    border-radius: 12px;
    padding: 14px 18px;
    box-shadow:
        0 0 24px rgba(60, 200, 160, 0.12),
        0 8px 32px rgba(0, 0, 0, 0.5),
        inset 0 1px 0 rgba(255, 255, 255, 0.06);
    position: relative;
    overflow: hidden;
}

.marker360-hover-card-inner::before {
    content: "";
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 2px;
    background: linear-gradient(90deg,
        transparent 0%,
        rgba(60, 200, 160, 0.6) 30%,
        rgba(80, 220, 255, 0.8) 50%,
        rgba(60, 200, 160, 0.6) 70%,
        transparent 100%
    );
    animation: m360-shimmer 2.5s ease-in-out infinite;
}

@keyframes m360-shimmer {
    0%, 100% { opacity: 0.4; transform: translateX(-30%); }
    50% { opacity: 1; transform: translateX(30%); }
}

.marker360-hover-dot {
    width: 8px; height: 8px;
    border-radius: 50%;
    background: #4eedc0;
    box-shadow: 0 0 8px rgba(78, 237, 192, 0.8), 0 0 16px rgba(78, 237, 192, 0.4);
    flex-shrink: 0;
    animation: m360-dot-pulse 1.5s ease-in-out infinite;
}

@keyframes m360-dot-pulse {
    0%, 100% { box-shadow: 0 0 6px rgba(78,237,192,0.6), 0 0 12px rgba(78,237,192,0.3); }
    50% { box-shadow: 0 0 10px rgba(78,237,192,1), 0 0 24px rgba(78,237,192,0.5); }
}

.marker360-hover-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 6px;
}

.marker360-hover-title {
    font-size: 15px;
    font-weight: 700;
    color: #f0f4ff;
    letter-spacing: 0.02em;
    line-height: 1.3;
    text-shadow: 0 0 12px rgba(60, 200, 160, 0.3);
}

.marker360-hover-subtitle {
    font-size: 12px;
    color: rgba(180, 220, 210, 0.7);
    letter-spacing: 0.03em;
    text-transform: uppercase;
    font-weight: 500;
}

.marker360-hover-divider {
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(60, 200, 160, 0.25), transparent);
    margin: 8px 0;
}

.marker360-hover-hint {
    margin-top: 6px;
    font-size: 11px;
    color: rgba(150, 210, 200, 0.45);
    font-style: italic;
}

/* ── Manager panel styles ───────────────────────────────── */
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
    width: 56px;
    padding: 4px 6px;
    text-align: right;
}

.angle-suffix {
    font-size: 12px;
    opacity: 0.7;
}

.marker360-hover-card-inner {
    border: 1px solid rgba(120, 180, 255, 0.18);
    box-shadow:
        0 0 24px rgba(80, 140, 255, 0.12),
        0 8px 32px rgba(0, 0, 0, 0.5),
        inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

.marker360-hover-card-inner::before {
    background: linear-gradient(90deg,
        transparent 0%,
        rgba(100, 180, 255, 0.6) 30%,
        rgba(160, 120, 255, 0.8) 50%,
        rgba(100, 180, 255, 0.6) 70%,
        transparent 100%
    );
}

.marker360-hover-dot {
    background: #64b5ff;
    box-shadow: 0 0 8px rgba(100, 180, 255, 0.8), 0 0 16px rgba(100, 180, 255, 0.4);
}

@keyframes m360-dot-pulse {
    0%, 100% { box-shadow: 0 0 6px rgba(100,180,255,0.6), 0 0 12px rgba(100,180,255,0.3); }
    50% { box-shadow: 0 0 10px rgba(100,180,255,1), 0 0 24px rgba(100,180,255,0.5); }
}

.marker360-hover-title {
    text-shadow: 0 0 12px rgba(100, 160, 255, 0.3);
}

.marker360-hover-subtitle {
    color: rgba(180, 200, 240, 0.7);
}

.marker360-hover-divider {
    background: linear-gradient(90deg, transparent, rgba(100, 160, 255, 0.25), transparent);
}

.marker360-hover-hint {
    color: rgba(150, 180, 230, 0.45);
}
`;

// ══════════════════════════════════════════════════════════════
//  Marker360 Class & Data
// ══════════════════════════════════════════════════════════════

class Marker360 {
    constructor(name, position, image, sphereCorrection, tiles) {
        this.name = name;
        this.position = position;
        this.image = image;
        this.sphereCorrection = sphereCorrection || { pan: 0, tilt: 0, roll: 0 };
        this.tiles = tiles;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    viewer.addEventListener('camera_changed', () => {
        updateCameraLight();
    });
});

// ══════════════════════════════════════════════════════════════
//  Three.js Marker Geometry – Wireframe Torus Ring
// ══════════════════════════════════════════════════════════════

const marker360Objects = [];

function _createMarker360Object(marker360) {
    const group = new THREE.Group();
    group.renderOrder = 998;

    const primaryColor = new THREE.Color(0x64b5ff);
    const secondaryColor = new THREE.Color(0xa78bfa);

    // ── Primary open cylinder (wireframe, no caps) ──
    const cylGeo1 = new THREE.CylinderGeometry(1.4, 1.4, 0.8, 16, 2, true);
    const cylMat1 = new THREE.MeshBasicMaterial({
        color: primaryColor,
        wireframe: false,
        transparent: true,
        opacity: 0.7,
        depthWrite: true,
        depthTest: true,
        side: THREE.DoubleSide,
    });
    const cyl1 = new THREE.Mesh(cylGeo1, cylMat1);
    group.add(cyl1);

    // ── Secondary open cylinder (larger, faded) ──
    const cylGeo2 = new THREE.CylinderGeometry(1.6, 1.6, 0.6, 12, 1, true);
    const cylMat2 = new THREE.MeshBasicMaterial({
        color: secondaryColor,
        wireframe: true,
        transparent: true,
        opacity: 0.3,
        depthWrite: true,
        depthTest: true,
    });
    const cyl2 = new THREE.Mesh(cylGeo2, cylMat2);
    group.add(cyl2);

    // ── Store for animation ──
    group.userData._torus1 = cyl1;
    group.userData._torus2 = cyl2;
    group.userData._mat1 = cylMat1;
    group.userData._mat2 = cylMat2;
    group.userData._phase = Math.random() * Math.PI * 2;
    group.userData._baseY = marker360.position ? marker360.position[1] : 0;

    marker360Objects.push(group);
    group.rotateX(Math.PI/2);
    return group;
}
// ══════════════════════════════════════════════════════════════
//  Load / Visibility
// ══════════════════════════════════════════════════════════════

function loadMarker360s() {
    console.log("loading markers");

    window.zones.forEach(zone => {
        if (!Array.isArray(zone.marker360s)) return;

        zone.marker360s.forEach(marker360 => {
            const pos = marker360.position;
            if (!pos) return;

            const markerGroup = _createMarker360Object(marker360);
            markerGroup.position.set(pos[0], pos[1], pos[2] + 2);

            // Metadata
            markerGroup.userData.type = "marker360";
            markerGroup.userData.marker360 = marker360;
            markerGroup.userData.zone = zone;

            // Raycast hit sphere (invisible)
            const hitGeo = new THREE.SphereGeometry(1.5, 8, 6);
            const hitMat = new THREE.MeshBasicMaterial({ visible: false, depthTest: false });
            const hitMesh = new THREE.Mesh(hitGeo, hitMat);
            hitMesh.userData.type = "marker360";
            hitMesh.userData.marker360 = marker360;
            hitMesh.userData.zone = zone;
            hitMesh.userData._markerGroup = markerGroup;
            markerGroup.add(hitMesh);

            marker360._raycast = hitMesh.raycast.bind(hitMesh);
            marker360._sphereMarker = markerGroup;
            marker360._hitMesh = hitMesh;

            hitMesh.raycast = () => {};

            viewer.scene.scene.add(markerGroup);
        });

        setMarker360sVisibilityByZone(zone, getZoneVisibility(zone));
    });

    // Camera-following light
    if (!window.markerCamLight && !window.lightCreated) {
        window.markerCamLight = new THREE.DirectionalLight(0xffffff, 1.2);
        viewer.scene.scene.add(markerCamLight.target);
        viewer.scene.scene.add(markerCamLight);
    }
}

function updateCameraLight() {
    const target = viewer.scene.view.getPivot();
    const position = viewer.scene.view.position;
    if (window.markerCamLight) {
        window.markerCamLight.position.copy(position);
        window.markerCamLight.target.position.copy(target);
    }
}

function setMarker360sVisibilityByZone(zone, visibility) {
    if (!zone.marker360s || zone.marker360s.length === 0) return;
    // Remember the zone-driven state so the global toolbar toggle can
    // restore it when its mask lifts.
    zone._marker360sVisible = visibility;
    if (window.in360View) return;

    _applyMarker360sVisibility(zone, visibility);
}

// Raw application — also called by the global image-marker toggle, which
// masks visibility without touching the tracked per-zone state.
function _applyMarker360sVisibility(zone, visibility) {
    // The global toolbar toggle wins: while it is off no marker may show.
    if (visibility && window.imageMarkersGloballyHidden) visibility = false;

    zone.marker360s.forEach(marker360 => {
        if (!marker360._sphereMarker) return;
        marker360._sphereMarker.visible = visibility;

        if (marker360._hitMesh) {
            marker360._hitMesh.raycast = visibility ? marker360._raycast : () => {};
        }
    });
}

// ══════════════════════════════════════════════════════════════
//  Animation
// ══════════════════════════════════════════════════════════════

window.animateMarker360s = function () {
    const t = performance.now() / 1000;

    marker360Objects.forEach(obj => {
        if (!obj.userData._torus1) return;
        if (!obj.visible) return;

        const phase = obj.userData._phase;
        const isHovered = obj.userData._isHovered;

        // Rotation
        const speed = isHovered ? 2.0 : 0.5;
        obj.userData._torus1.rotation.y = t * speed + phase;
        
        obj.userData._torus2.rotation.y = -t * (speed * 0.7) + phase;
        obj.userData._torus2.rotation.x = -t * (speed * 0.7) + phase;
        obj.userData._torus2.rotation.z = -t * (speed * 0.7) + phase;

        // Scale pulse
        const scaleBase = isHovered ? 1.2 : 1.0;
        const scaleAmp = isHovered ? 0.1 : 0.05;
        const pulse = scaleBase + Math.sin(t * 1.5 + phase) * scaleAmp;
        const radiusScale = obj.userData._radiusScale || 1.0;
        obj.scale.setScalar(radiusScale * pulse);

        // Opacity pulse
        const op1Base = isHovered ? 0.9 : 0.6;
        const op1Amp = isHovered ? 0.1 : 0.15;
        obj.userData._mat1.opacity = op1Base + Math.sin(t * 1.2 + phase) * op1Amp;

        const op2Base = isHovered ? 0.55 : 0.3;
        const op2Amp = isHovered ? 0.1 : 0.1;
        obj.userData._mat2.opacity = op2Base + Math.sin(t * 1.8 + phase) * op2Amp;
    });
};

// ══════════════════════════════════════════════════════════════
//  Hover Card
// ══════════════════════════════════════════════════════════════

function _ensureMarker360HoverCard() {
    if (document.getElementById("marker360HoverCard")) return;
    const card = document.createElement("div");
    card.id = "marker360HoverCard";
    card.className = "marker360-hover-card";
    document.body.appendChild(card);
}

function showMarker360HoverCard(markerGroup, event) {
    _ensureMarker360HoverCard();
    const card = document.getElementById("marker360HoverCard");
    if (!card) return;

    const marker360 = markerGroup.userData.marker360;
    const zone = markerGroup.userData.zone;

    card.innerHTML = `
        <div class="marker360-hover-card-inner">
            <div class="marker360-hover-header">
                <div class="marker360-hover-dot"></div>
                <div>
                    <div class="marker360-hover-title">${marker360?.name || "360° View"}</div>
                    <div class="marker360-hover-subtitle">${zone?.name || ""}</div>
                </div>
            </div>
            <div class="marker360-hover-divider"></div>
            <div class="marker360-hover-hint">Click to open 360° view</div>
        </div>
    `;

    if (event?.clientX !== undefined) {
        _positionMarker360Card(card, event.clientX, event.clientY);
    }

    requestAnimationFrame(() => card.classList.add("visible"));
}

function _positionMarker360Card(card, cx, cy) {
    const pad = 16;
    const cardW = 260;
    const cardH = 120;

    let left = cx + pad;
    let top = cy + pad;

    if (left + cardW > window.innerWidth - pad) left = cx - cardW - pad;
    if (top + cardH > window.innerHeight - pad) top = cy - cardH - pad;

    card.style.left = `${Math.max(pad, left)}px`;
    card.style.top = `${Math.max(pad, top)}px`;
}

function updateMarker360HoverPosition(event) {
    const card = document.getElementById("marker360HoverCard");
    if (!card || !currentHoveredMarker360) return;
    _positionMarker360Card(card, event.clientX, event.clientY);
}

function hideMarker360HoverCard() {
    const card = document.getElementById("marker360HoverCard");
    if (card) card.classList.remove("visible");
}

// ══════════════════════════════════════════════════════════════
//  Hover / Interaction
// ══════════════════════════════════════════════════════════════

window.currentHoveredMarker360 = null;
window.isHoveringDialog = false;

function onMarker360Hover(markerMesh, event) {
    updateMarker360HoverPosition(event);

    const markerGroup = markerMesh.userData._markerGroup || markerMesh;
    if (!markerGroup || markerGroup === currentHoveredMarker360) return;

    if (currentHoveredMarker360) {
        restoreMarker360Appearance(currentHoveredMarker360);
    }

    currentHoveredMarker360 = markerGroup;
    highlightMarker360(markerGroup);
    showMarker360HoverCard(markerGroup, event);
}

function onMarker360Unhover() {
    if (currentHoveredMarker360) {
        restoreMarker360Appearance(currentHoveredMarker360);
        currentHoveredMarker360 = null;
    }
    hideMarker360HoverCard();
}

function highlightMarker360(group) {
    if (!group.userData._mat1) return;
    group.userData._isHovered = true;
    group.userData._mat1.color.set(0xffffff);
    group.userData._mat2.color.set(0x93c5fd);
}

function restoreMarker360Appearance(group) {
    if (!group?.userData || !group.userData._mat1) return;
    group.userData._isHovered = false;
    group.userData._mat1.color.set(0x64b5ff);
    group.userData._mat2.color.set(0xa78bfa);
}

// Click
window.addEventListener("pointerdown", () => {
    if (currentHoveredMarker360) {
        window.open360(currentHoveredMarker360);
    }
});

// ══════════════════════════════════════════════════════════════
//  Manager Panels (unchanged logic, preserved)
// ══════════════════════════════════════════════════════════════

function openMarker360ManagerPanel(zone) {
    const existing = document.getElementById("marker360ManagerPanel");
    if (existing) existing.remove();

    const panel = document.createElement("div");
    panel.id = "marker360ManagerPanel";
    panel.className = "zone-panel open";

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

        const nameLabel = document.createElement("label");
        nameLabel.textContent = "Name";
        const nameInput = document.createElement("input");
        nameInput.value = marker.name;

        const imgLabel = document.createElement("label");
        imgLabel.textContent = "360 Image URL";
        const imgInput = document.createElement("input");
        imgInput.value = marker.image;

        const tilesLabel = document.createElement("label");
        tilesLabel.textContent = "360 Tiles URL (ending with 'tiles')";
        const tilesInput = document.createElement("input");
        tilesInput.value = marker.tiles || "";

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
            input.value = marker.sphereCorrection?.[key] ?? 0;
            input.style.width = "40%";
            input.style.textAlign = "left";
            input.oninput = () => {
                marker.sphereCorrection[key] = parseFloat(input.value) || 0;
                if (typeof viewer360 !== "undefined") {
                    viewer360.setOption("sphereCorrection", {
                        pan: `${marker.sphereCorrection.pan}deg`,
                        tilt: `${marker.sphereCorrection.tilt}deg`,
                        roll: `${marker.sphereCorrection.roll}deg`,
                    });
                }
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

        const pos = marker.position;
        const posText = document.createElement("p");
        posText.className = "hint";
        posText.textContent = `Position: [${pos[0].toFixed(2)}, ${pos[1].toFixed(2)}, ${pos[2].toFixed(2)}]`;

        const setPosBtn = document.createElement("button");
        setPosBtn.textContent = "Re-pick Position";
        setPosBtn.className = "sub-btn";
        setPosBtn.onclick = () => {
            viewer.scene.removeAllMeasurements();
            const measurement = viewer.measuringTool.startInsertion({
                maxMarkers: 1, showCoordinates: true, name: "Marker360_Edit",
            });
            const check = setInterval(() => {
                if (measurement.points.length > 0) {
                    const p = measurement.points[0].position;
                    marker.position = [p.x, p.y, p.z];
                    posText.textContent = `Position: [${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}]`;
                    viewer.scene.removeMeasurement(measurement);
                    clearInterval(check);
                }
            }, 300);
        };

        const actions = document.createElement("div");
        actions.className = "marker360-actions";

        const saveBtn = document.createElement("button");
        saveBtn.textContent = "Save";
        saveBtn.className = "sub-btn save-btn";
        saveBtn.onclick = () => {
            marker.name = nameInput.value;
            marker.image = imgInput.value;
            marker.tiles = tilesInput.value;
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
            posText, setPosBtn, actions
        );

        content.appendChild(card);
    });

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
    title.textContent = `Add Marker 360 — ${zone.name}`;
    panel.appendChild(title);

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "×";
    closeBtn.className = "zone-form-close";
    closeBtn.onclick = () => panel.remove();
    panel.appendChild(closeBtn);

    const form = document.createElement("div");
    form.className = "zone-form";

    const nameLabel = document.createElement("label");
    nameLabel.textContent = "Marker Name:";
    const nameInput = document.createElement("input");
    nameInput.placeholder = "e.g. Ceiling Fresco View";
    form.append(nameLabel, nameInput);

    const imgLabel = document.createElement("label");
    imgLabel.textContent = "360 Image (URL):";
    const imgInput = document.createElement("input");
    imgInput.placeholder = "panorama_01.jpg";
    form.append(imgLabel, imgInput);

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
            maxMarkers: 1, showCoordinates: true, name: "Marker360",
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
        viewer.scene.removeMeasurement(measurement);
        panel.remove();
    };

    form.appendChild(saveBtn);
    panel.appendChild(form);
    document.body.appendChild(panel);
}