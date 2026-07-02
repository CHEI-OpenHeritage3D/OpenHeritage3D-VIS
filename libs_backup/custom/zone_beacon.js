// ══════════════════════════════════════════════════════════════
//  beacons.js – Animated glowing beacon markers for zones
//  Creates wireframe icosahedrons with glow, pulse & hover card
// ══════════════════════════════════════════════════════════════

// ── Beacon Styles ────────────────────────────────────────────
style.textContent += `

/* ── Hover Card ─────────────────────────────────────────── */
.beacon-hover-card {
    position: fixed;
    pointer-events: none;
    z-index: 9999;
    opacity: 0;
    transform: translateY(6px) scale(0.96);
    transition: opacity 0.2s ease, transform 0.2s ease;
    font-family: 'Segoe UI', system-ui, sans-serif;
    max-width: 280px;
}

.beacon-hover-card.visible {
    opacity: 1;
    transform: translateY(0) scale(1);
}

.beacon-hover-card-inner {
    background: rgba(12, 12, 18, 0.88);
    backdrop-filter: blur(20px) saturate(150%);
    -webkit-backdrop-filter: blur(20px) saturate(150%);
    border: 1px solid rgba(120, 180, 255, 0.18);
    border-radius: 12px;
    padding: 14px 18px;
    box-shadow:
        0 0 24px rgba(80, 140, 255, 0.12),
        0 8px 32px rgba(0, 0, 0, 0.5),
        inset 0 1px 0 rgba(255, 255, 255, 0.06);
    position: relative;
    overflow: hidden;
}

/* Subtle animated shimmer line at top */
.beacon-hover-card-inner::before {
    content: "";
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 2px;
    background: linear-gradient(90deg,
        transparent 0%,
        rgba(100, 180, 255, 0.6) 30%,
        rgba(160, 120, 255, 0.8) 50%,
        rgba(100, 180, 255, 0.6) 70%,
        transparent 100%
    );
    animation: beacon-shimmer 2.5s ease-in-out infinite;
}

@keyframes beacon-shimmer {
    0%, 100% { opacity: 0.4; transform: translateX(-30%); }
    50% { opacity: 1; transform: translateX(30%); }
}

/* Glow dot indicator */
.beacon-hover-dot {
    width: 8px; height: 8px;
    border-radius: 50%;
    background: #64b5ff;
    box-shadow: 0 0 8px rgba(100, 180, 255, 0.8), 0 0 16px rgba(100, 180, 255, 0.4);
    flex-shrink: 0;
    animation: beacon-dot-pulse 1.5s ease-in-out infinite;
}

@keyframes beacon-dot-pulse {
    0%, 100% { box-shadow: 0 0 6px rgba(100,180,255,0.6), 0 0 12px rgba(100,180,255,0.3); }
    50% { box-shadow: 0 0 10px rgba(100,180,255,1), 0 0 24px rgba(100,180,255,0.5); }
}

.beacon-hover-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
}

.beacon-hover-title {
    font-size: 15px;
    font-weight: 700;
    color: #f0f4ff;
    letter-spacing: 0.02em;
    line-height: 1.3;
    text-shadow: 0 0 12px rgba(100, 160, 255, 0.3);
}

.beacon-hover-subtitle {
    font-size: 12px;
    color: rgba(180, 200, 240, 0.7);
    letter-spacing: 0.03em;
    text-transform: uppercase;
    font-weight: 500;
}

.beacon-hover-divider {
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(100, 160, 255, 0.25), transparent);
    margin: 8px 0;
}

.beacon-hover-meta {
    display: flex;
    gap: 14px;
    font-size: 12px;
    color: rgba(170, 195, 240, 0.65);
}

.beacon-hover-meta-item {
    display: flex;
    align-items: center;
    gap: 5px;
}

.beacon-hover-meta-icon {
    width: 12px; height: 12px;
    opacity: 0.6;
}

.beacon-hover-hint {
    margin-top: 8px;
    font-size: 11px;
    color: rgba(150, 180, 230, 0.45);
    font-style: italic;
}

.beacon-hover-desc {
    font-size: 12px;
    color: rgba(190, 210, 245, 0.75);
    line-height: 1.5;
    max-height: 60px;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
}
`;

// ── Hover Card DOM ───────────────────────────────────────────

function _ensureHoverCard() {
    if (document.getElementById("beaconHoverCard")) return;
    const card = document.createElement("div");
    card.id = "beaconHoverCard";
    card.className = "beacon-hover-card";
    document.body.appendChild(card);
}

function showBeaconHoverCard(markerMesh, event) {
    _ensureHoverCard();
    const card = document.getElementById("beaconHoverCard");
    if (!card) return;

    const zone = markerMesh.userData.zone;
    const annCount = zone?.annotations?.length || 0;
    const m360Count = zone?.marker360s?.length || 0;
    const pcCount = zone?.pointclouds?.length || 0;

const descText = zone?.description
        ? `<div class="beacon-hover-divider"></div>
           <div class="beacon-hover-desc">${zone.description}</div>`
        : '';

    card.innerHTML = `
        <div class="beacon-hover-card-inner">
            <div class="beacon-hover-header">
                <div class="beacon-hover-dot"></div>
                <div>
                    <div class="beacon-hover-title">${zone?.name || "Unknown"}</div>
                    <div class="beacon-hover-subtitle">${zone?.parent?.name || ""}</div>
                </div>
            </div>
            <div class="beacon-hover-divider"></div>
            <div class="beacon-hover-meta">
                ${pcCount ? `<span class="beacon-hover-meta-item">
                    <svg class="beacon-hover-meta-icon" viewBox="0 0 16 16" fill="currentColor"><path d="M8 .6l7 3.5v7.8l-7 3.5-7-3.5V4.1L8 .6z"/></svg>
                    ${pcCount} pointcloud${pcCount !== 1 ? 's' : ''}
                </span>` : ''}
                ${annCount ? `<span class="beacon-hover-meta-item">
                    <svg class="beacon-hover-meta-icon" viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="8" r="7"/></svg>
                    ${annCount} annotation${annCount !== 1 ? 's' : ''}
                </span>` : ''}
                ${m360Count ? `<span class="beacon-hover-meta-item">
                    <svg class="beacon-hover-meta-icon" viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.5"/><ellipse cx="8" cy="8" rx="3" ry="7" fill="none" stroke="currentColor" stroke-width="1"/></svg>
                    ${m360Count} 360°
                </span>` : ''}
            </div>
            ${descText}
            <div class="beacon-hover-hint">Click to navigate</div>
        </div>
    `;

    // Position
    if (event?.clientX !== undefined) {
        _positionCard(card, event.clientX, event.clientY);
    }

    requestAnimationFrame(() => card.classList.add("visible"));
}

function _positionCard(card, cx, cy) {
    const pad = 16;
    const cardW = 280;
    const cardH = 160;

    let left = cx + pad;
    let top = cy + pad;

    // Flip if too close to edges
    if (left + cardW > window.innerWidth - pad) left = cx - cardW - pad;
    if (top + cardH > window.innerHeight - pad) top = cy - cardH - pad;

    card.style.left = `${Math.max(pad, left)}px`;
    card.style.top = `${Math.max(pad, top)}px`;
}

function updateBeaconHoverPosition(event) {
    const card = document.getElementById("beaconHoverCard");
    if (!card || !currentHoveredBeacon) return;
    _positionCard(card, event.clientX, event.clientY);
}

function hideBeaconHoverCard() {
    const card = document.getElementById("beaconHoverCard");
    if (card) card.classList.remove("visible");
}

// ── Three.js Beacon Geometry ─────────────────────────────────

beaconObjects = [];


/**
 * Creates an animated beacon marker consisting of:
 * 1. Wireframe icosahedron (inner, brighter)
 * 2. Wireframe icosahedron (outer, faded, counter-rotating)
 * 3. Glow sprite
 * 4. Vertical pulse ring
 */
// Pre-load the fleur de lis texture once
const _fleurTexture = new THREE.TextureLoader().load(
    'https://pointcloud.ucsd.edu/archive_temp/oh3d_store/oh3d-vis/base_potree_template/images/fleur_de_lis.png'
);

function _createBeaconObject(beacon) {
    const group = new THREE.Group();
    group.renderOrder = 999;

// ── White dot with thin dark outline (single canvas) ──
    const dotCanvas = document.createElement("canvas");
    dotCanvas.width = 256;
    dotCanvas.height = 256;
    const dctx = dotCanvas.getContext("2d");

    // Dark outline
    dctx.beginPath();
    dctx.arc(128, 128, 58, 0, Math.PI * 2);
    dctx.strokeStyle = "rgba(0, 0, 0, 0.8)";
    dctx.lineWidth = 6;
    dctx.stroke();

    // White fill
    dctx.beginPath();
    dctx.arc(128, 128, 54, 0, Math.PI * 2);
    dctx.fillStyle = "#ffffff";
    dctx.fill();

    const dotTexture = new THREE.CanvasTexture(dotCanvas);
    const dotMat = new THREE.SpriteMaterial({
        map: dotTexture,
        transparent: true,
        opacity: 1.0,
        depthWrite: false,
        depthTest: false,
    });
    const dotSprite = new THREE.Sprite(dotMat);
    dotSprite.scale.set(2.4, 2.4, 1);
    group.add(dotSprite);

    // ── Fleur de lis icon ──
    const fleurMat = new THREE.SpriteMaterial({
        map: _fleurTexture,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        depthTest: false,
    });
    const fleurSprite = new THREE.Sprite(fleurMat);
    fleurSprite.scale.set(1.0, 1.0, 1.0);
    group.add(fleurSprite);

    // ── Store references ──
    group.userData._dotMat = dotMat;
    group.userData._fleurMat = fleurMat;
    group.userData._glowMat = dotMat;
    group.userData._baseY = beacon.position.y || 0;
    group.userData._phase = Math.random() * Math.PI * 2;

    // Stubs
    group.userData._inner = null;
    group.userData._outer = null;
    group.userData._ring = null;
    group.userData._innerMat = null;
    group.userData._outerMat = null;
    group.userData._ringMat = null;

    beaconObjects.push(group);
    return group;
}
// ── Beacon Creation ──────────────────────────────────────────

function createBeacons(zone) {
    if (!zone?.children || zone.children.length === 0) return;

    zone.children.forEach(child => {
        const beacon = child.beacon;
        if (!beaconHasPosition(beacon)) return;

        const beaconGroup = _createBeaconObject(beacon);
        beaconGroup.position.set(beacon.position.x, beacon.position.y, beacon.position.z);
        beaconGroup.visible = false;

        // Metadata
        beaconGroup.userData.type = "beacon";
        beaconGroup.userData.beacon = beacon;
        beaconGroup.userData.zone = child;

        // Raycast target: invisible sphere for hit detection
        const hitGeo = new THREE.SphereGeometry(1.2, 8, 6);
        const hitMat = new THREE.MeshBasicMaterial({ visible: false });
        const hitMesh = new THREE.Mesh(hitGeo, hitMat);
        hitMesh.userData.type = "beacon";
        hitMesh.userData.beacon = beacon;
        hitMesh.userData.zone = child;
        hitMesh.userData._beaconGroup = beaconGroup;
        beaconGroup.add(hitMesh);

        // Store references
        child.beacon._sphere = beaconGroup;
        beacon._raycast = hitMesh.raycast.bind(hitMesh);
        hitMesh.raycast = () => {}; // disabled until visible

        child.beacon._hitMesh = hitMesh;

        viewer.scene.scene.add(beaconGroup);
        createBeacons(child);
    });
}

function beaconHasPosition(beacon) {
    return beacon && beacon.position && beacon.position.x !== -999999;
}

function setBeaconVisibilitybyZone(zone, visibility) {
    if (!zone?.children || zone.children.length === 0) return;

    zone.children.forEach(child => {
        const beacon = child.beacon;
        if (!beaconHasPosition(beacon) || !beacon?._sphere) return;

        beacon._sphere.visible = visibility;

        if (beacon._hitMesh) {
            beacon._hitMesh.raycast = visibility ? beacon._raycast : () => {};
        }
    });

    // If this is a default zone, also show parent's other children's beacons
    if (visibility && zone.isDefault && zone.parent && typeof zone.parent === "object") {
        zone.parent.children.forEach(sibling => {
            if (sibling === zone) return; // skip self
            const beacon = sibling.beacon;
            if (!beaconHasPosition(beacon) || !beacon?._sphere) return;

            beacon._sphere.visible = true;
            if (beacon._hitMesh) {
                beacon._hitMesh.raycast = beacon._raycast;
            }
        });
    }
}

function setBeaconVisibility(beacon, visibility){
        if (!beaconHasPosition(beacon) || !beacon?._sphere) return;

        beacon._sphere.visible = visibility;

        if (beacon._hitMesh) {
            beacon._hitMesh.raycast = visibility ? beacon._raycast : () => {};
        }
}

function loadBeacons() {
    window.zones.forEach(zone => createBeacons(zone));
    viewer.addEventListener("camera_changed", toggleBeaconScale);
}

// ── Hover / Interaction ──────────────────────────────────────

window.currentHoveredBeacon = null;
// let markerHoverStartTime = 0;

function onBeaconHover(markerMesh, event) {
    updateBeaconHoverPosition(event);

    // Resolve to the beacon group if we hit the hitMesh
    const beaconGroup = markerMesh.userData._beaconGroup || markerMesh;

    if (!beaconGroup || beaconGroup === currentHoveredBeacon) return;

    // Restore previous
    if (currentHoveredBeacon) {
        restoreBeaconAppearance(currentHoveredBeacon);
    }

    currentHoveredBeacon = beaconGroup;
    markerHoverStartTime = performance.now();

    highlightBeacon(beaconGroup);
    showBeaconHoverCard(beaconGroup, event);
}

function onBeaconUnhover() {
    if (currentHoveredBeacon) {
        restoreBeaconAppearance(currentHoveredBeacon);
        currentHoveredBeacon = null;
    }
    beaconObjects.forEach(beacon => restoreBeaconAppearance(beacon));
    hideBeaconHoverCard();
}

// ── Animation Loop ───────────────────────────────────────────

window.animateBeacons = function () {
    const t = performance.now() / 1000;

    viewer.scene.scene.children.forEach(obj => {
        if (obj.userData?.type !== "beacon" || !obj.userData._glowMat) return;

        const phase = obj.userData._phase || 0;
        const isHovered = obj.userData._isHovered;

        // ── Opacity pulse ──
        const opBase = isHovered ? 0.9 : 0.5;
        const opAmp = isHovered ? 0.1 : 0.25;
        const opSpeed = isHovered ? 3.0 : 1.0;
        obj.userData._glowMat.opacity = opBase + Math.sin(t * opSpeed + phase) * opAmp;
        if (obj.userData._fleurMat) {
            obj.userData._fleurMat.opacity = opBase + Math.sin(t * opSpeed + phase) * opAmp;
        }
        // ── Scale pulse ──
        const radiusScale = obj.userData._radiusScale || 1.0;
        const scaleBase = isHovered ? 1.3 : 1.0;
        const scaleAmp = isHovered ? 0.15 : 0.1;
        const scaleSpeed = isHovered ? 3.0 : 1.0;
        const pulse = scaleBase + Math.sin(t * scaleSpeed + phase) * scaleAmp;
        obj.scale.setScalar(radiusScale * pulse);
    });
};

window.animateHoveredBeacon = window.animateBeacons;

function highlightBeacon(group) {
    if (!group.userData._glowMat) return;
    group.userData._isHovered = true;
}

function restoreBeaconAppearance(group) {
    if (!group.userData._glowMat) return;
    group.userData._isHovered = false;
}
// Alias for backwards compatibility
window.animateHoveredBeacon = window.animateBeacons;

// ── Click Handler ────────────────────────────────────────────
window.addEventListener("pointerdown", () => {
    if (currentHoveredBeacon) {
        const zone = currentHoveredBeacon.userData.zone;
        if (window.zoneAutoSwitchState || zone.pointclouds.length === 0) {
            moveCameraToClose360(
                currentHoveredBeacon.userData.beacon.cameraPosition,
                currentHoveredBeacon.userData.beacon.cameraTarget
            );
        } else {
            zoneOnlyToggleMoveCamera(zone);
            moveCameraToClose360(
                currentHoveredBeacon.userData.beacon.cameraPosition,
                currentHoveredBeacon.userData.beacon.cameraTarget
            );
        }
    }
});



function toggleBeaconScale() {
    const speed = viewer.getMoveSpeed();

    const SPEED_LOW  = 5.0;
    const SPEED_HIGH = 717.5;

    const R_MIN = 75;   // when speed is LOW
    const R_MAX = 1500;   // when speed is HIGH

    // Normalize speed → 0 to 1
    let t = (speed - SPEED_LOW) / (SPEED_HIGH - SPEED_LOW);
    t = Math.min(Math.max(t, 0), 1);

    // Linear interpolation: low speed → small radius, high speed → large radius
    const radius = R_MIN + t * (R_MAX - R_MIN);

    beaconObjects.forEach(beacon => {
        updateBeaconRadius(beacon, radius);
    });
}



function updateBeaconRadius(beacon, newRadius) {
    const baseRadius = 75; // your original cone radius
    const scale = newRadius / baseRadius;
    beacon.userData._radiusScale = scale;
    beacon.scale.set(scale, scale, scale);  // scale X and Y only because I am using Euler and I rotated in Y axis
}