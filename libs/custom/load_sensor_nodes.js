document.addEventListener("DOMContentLoaded", () => {
    const zoneSearchButton = document.getElementById("searchCamerasButton");
    zoneSearchButton.addEventListener("click", toggleSearchCameraMenu);
    document.addEventListener('mousemove', onMouseMove, false);
    document.addEventListener('pointerdown', onSensorPointerDown, true);
    document.addEventListener('pointerup', onSensorPointerUp, true);
    document.addEventListener('keydown', onSensorKeyDown);
    window.addEventListener('resize', repositionSensorDialog);

    viewer.addEventListener('camera_changed', () => {
      toggleConeRadius();
      toggleEDLOpactiy();
      updateCameraLight();
    }); 
    viewer.addEventListener('camera_changed', debouncedSearchList);
    viewer.addEventListener('camera_changed', repositionSensorDialog);


});

style.textContent += `
/* Search Camera Panel Layout */
#searchCameraMenu {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-start;
  height: auto;
  max-height: 420px;       /* ✅ shorter menu */
  width: 390px;
  padding: 12px;
  box-sizing: border-box;
  overflow: hidden;        /* prevents entire menu from expanding */
}

/* Container for the search bar + results */
#ann_search_container {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
}

/* The input field itself */
#ann_search_bar {
  width: 90%;
  padding: 8px 10px;
  border: 1px solid #ccc;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.2s ease;
  flex-shrink: 0;          /* ✅ keeps it fixed */
}

#ann_search_bar:focus {
  outline: none;
  border-color: #0078ff;
  box-shadow: 0 0 4px rgba(0, 120, 255, 0.3);
}

/* The scrollable list */
#ann_search_bar_list {
  list-style: none;
  margin: 8px 0 0 0;
  padding: 0;
  flex: 1;                 /* ✅ fills remaining height */
  overflow-y: auto;        /* ✅ scrolls independently */
  border-top: 1px solid #ddd;
}

/* Individual items */
#ann_search_bar_list li {
  list-style: none;
  margin: 0;
}

#ann_search_bar_list li a {
  display: block;
  padding: 8px 12px;
  text-decoration: none;
  font-size: 14px;
  transition: background 0.2s ease, color 0.2s ease;
  color: #ffffff;
}

/* Hover effect */
#ann_search_bar_list li a:hover {
  background: rgba(0, 120, 255, 0.3);
  color: #fff;
}

/* Optional scrollbar styling */
#ann_search_bar_list::-webkit-scrollbar {
  width: 6px;
}
#ann_search_bar_list::-webkit-scrollbar-thumb {
  background: rgba(100, 100, 100, 0.5);
  border-radius: 3px;
}
`;
style.textContent += `
/* Force search camera menu to behave correctly */
#searchCameraMenu.zone-panel {
  overflow: visible !important;      /* allow child scrolling */
  max-height: 400px;
  display: flex;
  flex-direction: column;
}

/* Make the inner container fill available height */
#ann_search_container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ✅ Make the list scroll */
#ann_search_bar_list {
  flex: 1;
  overflow-y: auto !important;
  overflow-x: hidden;
  margin-top: 8px;
}
`;
style.textContent += `
/* Style the annotation description panel */
.annotation-description {
  background: rgba(0, 0, 0, 0.65) !important;  /* translucent black */
  color: #f1f1f1 !important;                   /* light text for contrast */
  border-radius: 6px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.4);
  max-width: 140px !important;                 /* smaller footprint */
  max-height: 300px !important;
  overflow-y: auto;
  white-space: normal;
  font-size: 14px;
  padding: 6px 8px;
  backdrop-filter: blur(6px);                  /* subtle frosted effect */
}

/* Remove default bullets if any */
.annotation-description ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

/* Each camera entry as a button */
.annotation-description button {
  display: block;
  width: 100%;
  margin: 4px 0;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255,255,255,0.25);
  color: #f1f1f1;
  font-size: 13px;
  text-align: left;
  border-radius: 4px;
  padding: 4px 6px;
  cursor: pointer;
  transition: background 0.2s, transform 0.1s;
}

.annotation-description button:hover {
  background: rgba(255,255,255,0.2);
  transform: scale(1.02);
}
`;
style.textContent += `
#zoneSearchMenu {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-start;
  height: auto;
  max-height: 100%;
  width: 400px;
  padding: 10px 14px;
  box-sizing: border-box;
}

/* Title (reduce top/bottom spacing) */
#zoneSearchMenu h3 {
  margin: 0;
  margin-bottom: 6px;   /* ✅ Tight gap below title */
  font-size: 18px;
  font-weight: 600;
}

/* Search input right below the title */
.zone-search-input {
  flex-shrink: 0;
  margin-bottom: 8px;
  padding: 6px 10px;
  border: 1px solid #ccc;
  border-radius: 6px;
  width: 100%;
  box-sizing: border-box;
}

/* Scrollable list immediately below the search bar */
.zone-list-container {
  flex: 1;
  overflow-y: auto;
  padding-right: 6px;
  margin: 0;
  align-self: stretch;
}
`;

style.textContent += `
.sensor-btn {
    display: block;
    width: 100%;
    margin: 4px 0;
    padding: 6px 10px;
    border-radius: 4px;
    border: none;
    cursor: pointer;
    background: #4f9bea;
    color: white;
    text-align: left;
    font-size: 14px;
    transition: 
        background 0.2s ease,
        transform 0.15s ease,
        box-shadow 0.15s ease;
}

.sensor-btn:hover {
    background: #76b8ff;
    transform: scale(1.05);
    box-shadow: 0 0 6px rgba(118, 184, 255, 0.7);
}
`;

style.textContent += `
#searchCameraMenu {
    position: fixed;
    top: 80px;
    right: -420px;
    width: clamp(300px, 32vw, 420px);
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

#searchCameraMenu.open {
    right: 10px;
    opacity: 1;
}

#searchCameraMenu h3 {
    margin: 0 0 8px 0;
    font-size: 19px;
    font-weight: 600;
    color: #f2f2f7;
}

.sc-toggle-row {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    margin: 4px 0 14px 0;
    padding: 12px 14px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 10px;
    cursor: pointer;
    transition: background 0.12s, border-color 0.12s, box-shadow 0.12s;
}

.sc-toggle-row:hover {
    background: rgba(79,70,229,0.12);
    border-color: rgba(79,70,229,0.28);
    box-shadow: 0 0 12px rgba(79,70,229,0.18);
}

.sc-checkbox {
    width: 18px;
    height: 18px;
    margin-top: 2px;
    flex-shrink: 0;
    cursor: pointer;
    accent-color: #6f6bff;
}

.sc-toggle-text {
    display: flex;
    flex-direction: column;
    min-width: 0;
}

.sc-toggle-title {
    font-size: 14px;
    font-weight: 600;
    color: #f0f0f5;
    line-height: 1.3;
}

.sc-toggle-subtitle {
    font-size: 12px;
    color: #9ca3af;
    line-height: 1.35;
    margin-top: 2px;
}

.sc-search-container {
    display: flex;
    flex-direction: column;
    min-height: 0;
}

.sc-results-list {
    list-style: none;
    margin: 0;
    padding: 0;
    overflow-y: auto;
    max-height: 50vh;
}

.sc-results-list::-webkit-scrollbar {
    width: 5px;
}

.sc-results-list::-webkit-scrollbar-thumb {
    background: #444;
    border-radius: 3px;
}
`;

style.textContent += `

/* ══════════════════════════════════════════════════════════
   Sensor hover dialog
   Same glass treatment as #searchCameraMenu and the 360 panel.
   ══════════════════════════════════════════════════════════ */

#sensor-hover-dialog {
    position: fixed;
    z-index: 9998;
    display: none;
    box-sizing: border-box;

    min-width: 210px;
    max-width: 300px;
    padding: 12px 14px;

    background: rgba(20, 20, 26, 0.62);
    backdrop-filter: blur(14px) saturate(140%);
    -webkit-backdrop-filter: blur(14px) saturate(140%);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 14px;
    box-shadow: 0 0 28px rgba(0,0,0,0.55);

    font-family: 'Segoe UI', system-ui, sans-serif;
    color: #f2f2f7;

    opacity: 0;
    transform: translateY(6px) scale(0.98);
    transition: opacity 0.16s ease, transform 0.16s ease;
}
#sensor-hover-dialog * { box-sizing: border-box; }

#sensor-hover-dialog.visible {
    opacity: 1;
    transform: translateY(0) scale(1);
}

/* A generous invisible skirt: the cursor can cut a corner on its way over
   without the dialog deciding it has been abandoned. It is a positioned
   pseudo-element, so it would otherwise paint OVER the contents and eat every
   click — the rows below are positioned too, which puts them back on top of
   it in tree order. */
#sensor-hover-dialog::before {
    content: "";
    position: absolute;
    inset: -18px;
    border-radius: 24px;
    z-index: 0;
}

.sensor-hover-header,
#sensor-hover-list,
.sensor-hover-hint {
    position: relative;
    z-index: 1;
}

.sensor-hover-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
}

.sensor-hover-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
    background: #6e6bff;
    box-shadow: 0 0 8px rgba(110, 107, 255, 0.8);
}

.sensor-hover-title {
    flex: 1 1 auto;
    min-width: 0;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #888;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.sensor-hover-close {
    display: none;
    flex: 0 0 auto;
    width: 22px;
    height: 22px;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 6px;
    background: rgba(255,255,255,0.05);
    color: #cfcfd6;
    font: 14px/1 'Segoe UI', system-ui, sans-serif;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
}
#sensor-hover-dialog.pinned .sensor-hover-close { display: inline-flex; }
.sensor-hover-close:hover {
    background: rgba(220, 38, 38, 0.4);
    border-color: rgba(239, 68, 68, 0.5);
    color: #fecaca;
}

#sensor-hover-list {
    display: flex;
    flex-direction: column;
    gap: 5px;
    max-height: 46vh;
    overflow-y: auto;
    overflow-x: hidden;
    margin: 0 -4px 0 0;
    padding-right: 4px;
}
#sensor-hover-list::-webkit-scrollbar { width: 5px; }
#sensor-hover-list::-webkit-scrollbar-thumb {
    background: rgba(255,255,255,0.18);
    border-radius: 3px;
}

.sensor-hover-hint {
    margin-top: 10px;
    font-size: 11px;
    color: #777;
}
#sensor-hover-dialog.pinned .sensor-hover-hint::after {
    content: " — Esc to close";
}

/* ── Camera rows, here and in the search results ─────────── */

.sensor-btn,
#ann_search_bar_list li a {
    display: block;
    width: 100%;
    margin: 0;
    padding: 8px 11px;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 9px;
    background: rgba(255,255,255,0.04);
    color: #f0f0f5;
    font-family: 'Segoe UI', system-ui, sans-serif;
    font-size: 13.5px;
    font-weight: 500;
    text-align: left;
    text-decoration: none;
    cursor: pointer;
    transition: background 0.12s, border-color 0.12s, color 0.12s, box-shadow 0.12s;
}

.sensor-btn:hover,
.sensor-btn:focus-visible,
#ann_search_bar_list li a:hover,
#ann_search_bar_list li a:focus-visible {
    background: rgba(79,70,229,0.28);
    border-color: rgba(79,70,229,0.45);
    color: #fff;
    box-shadow: 0 0 12px rgba(79,70,229,0.18);
    outline: none;
    transform: none;        /* the old rule scaled these; it jittered the list */
}

#ann_search_bar_list li { margin: 0 0 5px 0; }
#ann_search_bar_list { border-top: 1px solid rgba(255,255,255,0.1); padding-top: 8px; }

/* The legacy #ann_search_bar rules above are an ID selector, so they beat
   .zs-search-input and left a white box sitting on the dark panel. Restate
   the dark treatment here (last block wins) rather than relying on
   zone_search.js being loaded. */
#ann_search_bar {
    width: 100%;
    box-sizing: border-box;
    padding: 9px 14px;
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(255,255,255,0.2);
    border-radius: 8px;
    color: #fafafa;
    font-family: 'Segoe UI', system-ui, sans-serif;
    font-size: 14px;
    transition: border-color .15s, background .15s, box-shadow .15s;
}
#ann_search_bar::placeholder { color: #888; }
#ann_search_bar:focus {
    border-color: #6e6bff;
    background: rgba(255,255,255,0.12);
    box-shadow: 0 0 0 3px rgba(79,70,229,0.3);
    outline: none;
}
`;

function toggleSearchCameraMenu() {
    let existingMenu = document.getElementById("searchCameraMenu");
    if (existingMenu) {
        existingMenu.classList.remove("open");
        setTimeout(() => existingMenu.remove(), 300);
        return;
    }

    const panel = document.createElement("div");
    panel.id = "searchCameraMenu";
    panel.className = "zone-panel sc-menu";

    const title = document.createElement("h3");
    title.textContent = "Camera Search";
    panel.appendChild(title);

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "×";
    closeBtn.className = "zone-form-close";
    closeBtn.title = "Close";
    closeBtn.addEventListener("click", () => {
        panel.classList.remove("open");
        setTimeout(() => panel.remove(), 300);
    });
    panel.appendChild(closeBtn);

    // ── Camera visibility toggle ─────────────────────────────
    const toggleRow = document.createElement("label");
    toggleRow.className = "sc-toggle-row";

    const cameraCheckbox = document.createElement("input");
    cameraCheckbox.type = "checkbox";
    cameraCheckbox.className = "sc-checkbox";
    cameraCheckbox.id = "toggle_cameras_checkbox";
    cameraCheckbox.checked = !!(window.coneMarkers?.length && window.coneMarkers[0].visible);

    cameraCheckbox.addEventListener("change", () => {
        toggleCameras();
    });

    const toggleTextWrap = document.createElement("div");
    toggleTextWrap.className = "sc-toggle-text";

    const toggleTitle = document.createElement("span");
    toggleTitle.className = "sc-toggle-title";
    toggleTitle.textContent = "Show Cameras";

    const toggleSubtitle = document.createElement("span");
    toggleSubtitle.className = "sc-toggle-subtitle";
    toggleSubtitle.textContent = "Toggle camera markers in the scene";

    toggleTextWrap.appendChild(toggleTitle);
    toggleTextWrap.appendChild(toggleSubtitle);

    toggleRow.appendChild(cameraCheckbox);
    toggleRow.appendChild(toggleTextWrap);
    panel.appendChild(toggleRow);

    // ── Search UI ────────────────────────────────────────────
    const container = document.createElement("div");
    container.id = "ann_search_container";
    container.className = "sc-search-container";

    const searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.id = "ann_search_bar";
    searchInput.className = "zs-search-input";
    searchInput.placeholder = "Search cameras…";
    searchInput.addEventListener("keyup", searchList);
    container.appendChild(searchInput);

    const searchListContainer = document.createElement("ul");
    searchListContainer.id = "ann_search_bar_list";
    searchListContainer.className = "sc-results-list";
    container.appendChild(searchListContainer);

    panel.appendChild(container);

    document.body.appendChild(panel);
    requestAnimationFrame(() => panel.classList.add("open"));

    loadSearchList();
}


function toggleCameras(){

  const show = !window.coneMarkers[0].visible;

  window.coneMarkers.forEach(cone => {
      cone.visible = show;

      if (show) {
          cone.raycast = cone.userData._raycast;
      } else {
          cone.raycast = () => {};
      }
  });

}


//################### NEW Annotation System ######################################


window.sensorNodes = [];
window.cameraMap = null;
window.coneMarkers = [];

window.isHoveringDialog = false;

window.currentHoveredCone = null;
window.hoverStartTime = 0;


async function loadCSV() {
    const response = await fetch("camera_albers_new.csv");
    const text = await response.text();

    const parsed = Papa.parse(text, {
        header: true,
        dynamicTyping: true,   // converts numbers automatically
        skipEmptyLines: true
    });
    return parsed.data.map(row => ({
        x: row.X,
        y: row.Y,
        elev: row.Z ?? row.Elevation ?? row.elev,
        nodes: JSON.parse(row.Nodes)   // ← parse the JSON array
    }));
}

window.hoverHideTimeout = null;
let camLight;

loadCSV().then(points => {
    const loader = new THREE.TextureLoader();

    const gradientTex = loader.load('images/gradient.png', (tex) => {
        tex.minFilter = THREE.NearestFilter;
        tex.magFilter = THREE.NearestFilter;
        tex.generateMipmaps = false;
    });


    points.forEach(p => {
      const pos = new THREE.Vector3(p.x, p.y, p.elev);

      const coneGeom = new THREE.ConeGeometry(5000, 20000, 12);
      // Main mesh
      const mainMat = new THREE.MeshToonMaterial({
        color: 0xffffff,     // base color
        gradientMap: gradientTex
      });
      mainMat.transparent = true;
      mainMat.opacity = 0.75;
      const marker = new THREE.Mesh(coneGeom, mainMat);

      // Outline mesh (black, slightly larger)
      const outlineGeom = new THREE.ConeGeometry(6000, 18750, 12);
      const outlineMat = new THREE.MeshToonMaterial({
          color: 0x325b73,
          side: THREE.BackSide
      });

      outlineMat.transparent = true;
      outlineMat.opacity = 0.5;
      const outline = new THREE.Mesh(outlineGeom, outlineMat);
      outline.scale.set(1.1, 1.1, 1.1);

      // Attach outline to marker
      marker.add(outline);

      // Add to Potree scene
      viewer.scene.scene.add(marker);

      marker.position.set(pos.x, pos.y, pos.z+10000);
      marker.rotation.x = -Math.PI/2;

      marker.userData.basePosition = marker.position.clone();

      marker.userData._raycast = marker.raycast;

      marker._sensorNodes = p.nodes;

      p.nodes.forEach( (node) => {
        node.position = pos;
        node.coneMarker = marker;
        sensorNodes.push(node);
      });

      coneMarkers.push(marker);
    });

    camLight = new THREE.DirectionalLight(0xffffff, 1.2);
    viewer.scene.scene.add(camLight.target);
    viewer.scene.scene.add(camLight);
    
    loadSearchList();
});

window.lightCreated = false;

function updateCameraLight() {
    const target = viewer.scene.view.getPivot();
    const position = viewer.scene.view.position;
    if(camLight){
      camLight.position.copy(position);
      camLight.target.position.copy(target);
    }
    
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
        if(intersection.object._sensorNodes) return intersection;
    }

    if(intersections.lenth === 0) return [];
  }
  

  // intersections = getFirstValue ? intersections[0] : intersections;

  return intersections;
}

function onMouseMove(event) {
    if (isHoveringDialog || sensorDialogPinned) return;   // dialog stays open

    // The 360 overlay covers the scene; don't pop cone menus behind it.
    if (window.in360View) {
        cancelSensorDialogOpen();
        hideSensorDialogNow();
        return;
    }

    const mousePointer = getMouseVector2(event);
    const raycaster = new THREE.Raycaster();

    const intersections = checkRayIntersections(
        mousePointer,
        viewer.scene.getActiveCamera(),
        raycaster,
        viewer.scene.scene,
        true
    );
    

    if (intersections.length != 0) {
        onSensorNodeHover([intersections], event);
    } else {
        // Keep the cone lit while the dialog is still on its way out, so the
        // marker and its menu disappear together.
        cancelSensorDialogOpen();
        hideSensorDialog();
    }
}

function clearHover() {
    if (currentHoveredCone) {
        restoreConeAppearance(currentHoveredCone);
    }
}

// ══════════════════════════════════════════════════════════════
//  Sensor hover dialog
//
//  The old version rebuilt the button list and re-anchored the dialog to the
//  cursor on every single mousemove, so the menu slid away as you reached for
//  it and the button under the pointer was replaced mid-click. It also relied
//  on isHoveringDialog to hold the dialog open, but nothing ever set that flag
//  — there were no listeners on the dialog at all — so it always timed out.
//
//  Now: the dialog opens after a short hover so brushing past a cone doesn't
//  flash it, anchors itself to the cone and stays put, only touches the DOM
//  when the set of cameras actually changes, and stays open while the pointer
//  is on it. Clicking a cone pins it until Esc, a click on empty space, or the
//  close button.
// ══════════════════════════════════════════════════════════════

const SENSOR_HOVER_OPEN_DELAY  = 130;   // ms of dwell before the dialog appears
const SENSOR_HOVER_CLOSE_DELAY = 420;   // ms of grace to reach the dialog

let sensorDialogEl = null;
let sensorDialogListEl = null;
let sensorDialogHintEl = null;
let sensorHoverOpenTimeout = null;
let sensorDialogKey = null;        // which cameras are currently listed
let sensorDialogPinned = false;

function ensureSensorDialog() {
    if (sensorDialogEl && sensorDialogEl.isConnected) return sensorDialogEl;

    // The host page may already provide the markup; adopt it if so.
    sensorDialogEl = document.getElementById("sensor-hover-dialog");
    if (!sensorDialogEl) {
        sensorDialogEl = document.createElement("div");
        sensorDialogEl.id = "sensor-hover-dialog";
        document.body.appendChild(sensorDialogEl);
    }

    sensorDialogListEl = document.getElementById("sensor-hover-list");
    if (!sensorDialogListEl) {
        sensorDialogEl.innerHTML = "";

        const header = document.createElement("div");
        header.className = "sensor-hover-header";

        const dot = document.createElement("span");
        dot.className = "sensor-hover-dot";

        const title = document.createElement("span");
        title.className = "sensor-hover-title";
        title.textContent = "Cameras";

        const close = document.createElement("button");
        close.className = "sensor-hover-close";
        close.type = "button";
        close.title = "Close (Esc)";
        close.textContent = "×";
        close.addEventListener("click", (e) => {
            e.stopPropagation();
            unpinSensorDialog();
            hideSensorDialogNow();
        });

        header.appendChild(dot);
        header.appendChild(title);
        header.appendChild(close);
        sensorDialogEl.appendChild(header);

        sensorDialogListEl = document.createElement("div");
        sensorDialogListEl.id = "sensor-hover-list";
        sensorDialogEl.appendChild(sensorDialogListEl);

        sensorDialogHintEl = document.createElement("div");
        sensorDialogHintEl.className = "sensor-hover-hint";
        sensorDialogHintEl.textContent = "Click to open the 360° view";
        sensorDialogEl.appendChild(sensorDialogHintEl);
    }

    // This is what was missing: while the pointer is on the dialog it must not
    // be allowed to close, and onMouseMove must stop raycasting behind it.
    sensorDialogEl.addEventListener("mouseenter", () => {
        window.isHoveringDialog = true;
        cancelSensorDialogHide();
    });
    sensorDialogEl.addEventListener("mouseleave", () => {
        window.isHoveringDialog = false;
        if (!sensorDialogPinned) scheduleSensorDialogHide();
    });

    return sensorDialogEl;
}

// A click on a marker pins its menu open — hovering is fine for a glance,
// but picking from a list wants the menu to stay put. Anything that counts as
// a drag (orbiting the scene) is not a click.
let sensorPointerDownAt = null;

function onSensorPointerDown(event) {
    sensorPointerDownAt = { x: event.clientX, y: event.clientY };
}

function onSensorPointerUp(event) {
    const from = sensorPointerDownAt;
    sensorPointerDownAt = null;
    if (!from || event.button !== 0) return;
    if (Math.abs(event.clientX - from.x) > 4 || Math.abs(event.clientY - from.y) > 4) return;
    if (window.in360View) return;

    // Clicks inside the dialog are the dialog's own business.
    if (sensorDialogEl && sensorDialogEl.contains(event.target)) return;

    // Only care about clicks on the 3D scene, not on panels above it.
    const overPanel = event.target && event.target.closest
        && event.target.closest('#searchCameraMenu, #zoneSearchMenu, #photo360, #potree_sidebar_container, #potree_toolbar');
    if (overPanel) return;

    const hit = checkRayIntersections(
        getMouseVector2(event),
        viewer.scene.getActiveCamera(),
        new THREE.Raycaster(),
        viewer.scene.scene,
        true
    );

    const cone = (hit && hit.object && hit.object._sensorNodes) ? hit.object : null;
    if (cone) {
        if (currentHoveredCone !== cone) {
            if (currentHoveredCone) restoreConeAppearance(currentHoveredCone);
            currentHoveredCone = cone;
            hoverStartTime = performance.now();
        }
        cancelSensorDialogOpen();
        showSensorDialog([cone], viewer.scene.getActiveCamera());
        pinSensorDialog();
    } else if (sensorDialogPinned) {
        unpinSensorDialog();
        hideSensorDialogNow();
    }
}

function onSensorKeyDown(event) {
    if (event.key !== 'Escape') return;
    if (!isSensorDialogVisible()) return;
    unpinSensorDialog();
    hideSensorDialogNow();
}

function cancelSensorDialogHide() {
    if (hoverHideTimeout) {
        clearTimeout(hoverHideTimeout);
        hoverHideTimeout = null;
    }
}

function cancelSensorDialogOpen() {
    if (sensorHoverOpenTimeout) {
        clearTimeout(sensorHoverOpenTimeout);
        sensorHoverOpenTimeout = null;
    }
}

function isSensorDialogVisible() {
    return !!(sensorDialogEl && sensorDialogEl.style.display === "block");
}

function pinSensorDialog() {
    sensorDialogPinned = true;
    if (sensorDialogEl) sensorDialogEl.classList.add("pinned");
    cancelSensorDialogHide();
}

function unpinSensorDialog() {
    sensorDialogPinned = false;
    if (sensorDialogEl) sensorDialogEl.classList.remove("pinned");
}

// Anchor on the cone's resting place, not its live position — the hover
// animation bobs the cone, which would make the dialog jitter.
function getConeAnchor(cone, camera) {
    const base = (cone.userData && cone.userData.basePosition) || cone.position;
    const v = base.clone().project(camera);
    return {
        x: (v.x * 0.5 + 0.5) * window.innerWidth,
        y: (-v.y * 0.5 + 0.5) * window.innerHeight
    };
}

function placeSensorDialog(cone, camera) {
    if (!sensorDialogEl || !cone) return;

    const anchor = getConeAnchor(cone, camera);
    const rect = sensorDialogEl.getBoundingClientRect();
    const margin = 12;

    // Prefer sitting to the lower-right of the marker, flipping when there is
    // no room, so the dialog never covers the marker it belongs to.
    let x = anchor.x + 18;
    if (x + rect.width + margin > window.innerWidth) x = anchor.x - rect.width - 18;

    let y = anchor.y + 14;
    if (y + rect.height + margin > window.innerHeight) y = anchor.y - rect.height - 14;

    x = Math.min(Math.max(x, margin), Math.max(margin, window.innerWidth - rect.width - margin));
    y = Math.min(Math.max(y, margin), Math.max(margin, window.innerHeight - rect.height - margin));

    sensorDialogEl.style.left = x + "px";
    sensorDialogEl.style.top = y + "px";
}

// One string identifying exactly which cameras are on show, so the list is
// only rebuilt when it would actually change.
function sensorConesKey(cones) {
    return cones
        .map(c => (c._sensorNodes || []).map(n => n.id ?? n.name).join(","))
        .join("|");
}

function buildSensorDialogList(cones) {
    sensorDialogListEl.innerHTML = "";

    const ordered = cones.slice().sort((a, b) => String(a.name).localeCompare(String(b.name)));

    for (const cone of ordered) {
        for (const node of (cone._sensorNodes || [])) {
            const btn = document.createElement("button");
            btn.className = "sensor-btn";
            btn.type = "button";
            btn.textContent = node.name;
            btn.title = `Open ${node.name}`;
            btn.addEventListener("click", () => {
                unpinSensorDialog();
                hideSensorDialogNow();
                onSensorNodeClick(node);
            });
            sensorDialogListEl.appendChild(btn);
        }
    }
}


function onSensorNodeHover(intersections, event) {
    if (isHoveringDialog || sensorDialogPinned) return;

    if (!Array.isArray(intersections) || intersections.length === 0) {
        hideSensorDialog();
        return;
    }

    const cones = intersections
        .map(int => int.object)
        .filter(obj => obj?._sensorNodes);

    if (cones.length === 0) {
        hideSensorDialog();
        return;
    }

    const cone_main = cones[0];

    if(cone_main !== currentHoveredCone){
      if(currentHoveredCone) restoreConeAppearance(currentHoveredCone);

      currentHoveredCone = cone_main;
      hoverStartTime = performance.now();
    }

    // We are back on a cone, so any pending close is off.
    cancelSensorDialogHide();

    const camera = viewer.scene.getActiveCamera();

    // Already showing these same cameras: don't touch the DOM and don't move
    // the dialog — that is what made it feel like it was running away.
    if (isSensorDialogVisible() && sensorConesKey(cones) === sensorDialogKey) return;

    if (isSensorDialogVisible()) {
        showSensorDialog(cones, camera);   // different cameras: swap contents now
        return;
    }

    // Opening from nothing: wait out a short dwell so a cursor merely crossing
    // the marker doesn't flash the menu.
    if (sensorHoverOpenTimeout) return;
    sensorHoverOpenTimeout = setTimeout(() => {
        sensorHoverOpenTimeout = null;
        if (currentHoveredCone !== cone_main) return;
        showSensorDialog(cones, viewer.scene.getActiveCamera());
    }, SENSOR_HOVER_OPEN_DELAY);
}

function restoreConeAppearance(cone) {
    if(!cone?.material) return;
    if (cone.material && cone.material.color) {
        cone.material.color.set(0xffffff);
    }

    cone.position.copy(cone.userData.basePosition);
}


window.animateHoveredCone = function() {
    if (!currentHoveredCone) return;

    if (currentHoveredCone.material && currentHoveredCone.material.color) {
        currentHoveredCone.material.color.set(0x325b73);
    }

    const t = (performance.now() - hoverStartTime) / 1000;
    const amplitude = 500;
    const speed = 1;

    const offset = Math.sin(t * speed * Math.PI * 2) * amplitude;

    // Move along world-up (Z axis in your coordinate system)
    currentHoveredCone.position.copy(currentHoveredCone.userData.basePosition);
    currentHoveredCone.position.z += offset;   // <—— THIS WORKS VISUALLY
}




function getScreenPosition(obj, camera) {
    const vector = obj.position.clone();
    vector.project(camera); // convert to NDC -1 to +1

    const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-vector.y * 0.5 + 0.5) * window.innerHeight;

    return { x, y };
}


function showSensorDialog(cones, camera) {
    if (!cones || cones.length === 0) return;

    ensureSensorDialog();
    cancelSensorDialogHide();

    const key = sensorConesKey(cones);
    if (key !== sensorDialogKey) {
        buildSensorDialogList(cones);
        sensorDialogKey = key;
    }

    sensorDialogEl.style.display = "block";   // must be laid out before measuring
    placeSensorDialog(cones[0], camera);
    requestAnimationFrame(() => sensorDialogEl.classList.add("visible"));
}

// Follow the marker when the scene moves underneath an open dialog.
function repositionSensorDialog() {
    if (!isSensorDialogVisible() || !currentHoveredCone) return;
    placeSensorDialog(currentHoveredCone, viewer.scene.getActiveCamera());
}

function onSensorNodeClick(node) {
  // if(window.in360View) window.close360();
  unpinSensorDialog();
  hideSensorDialogNow();
  node.coneMarker.visible = false;
  window.open360(node);
}

window.onSensorNodeClick = onSensorNodeClick;


function hideSensorDialogNow() {
    cancelSensorDialogHide();
    if (currentHoveredCone) {
        restoreConeAppearance(currentHoveredCone);
        currentHoveredCone = null;
    }
    if (!sensorDialogEl) return;
    sensorDialogEl.classList.remove("visible");
    sensorDialogEl.style.display = "none";
    sensorDialogKey = null;
}

function scheduleSensorDialogHide() {
    if (sensorDialogPinned || hoverHideTimeout) return;
    hoverHideTimeout = setTimeout(() => {
        hoverHideTimeout = null;
        if (isHoveringDialog || sensorDialogPinned) return;
        hideSensorDialogNow();
    }, SENSOR_HOVER_CLOSE_DELAY);
}

// Kept under its old name because other code calls it.
function hideSensorDialog() {
    if (isHoveringDialog || sensorDialogPinned) return;
    scheduleSensorDialogHide();
}

function getVisibleNodesFromCones(camera) {
    const frustum = new THREE.Frustum();
    const projScreenMatrix = new THREE.Matrix4();

    projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(projScreenMatrix);

    const visibleCones = coneMarkers.filter(cone => frustum.intersectsObject(cone));

    const visibleNodes = [];
    
    visibleCones.forEach( (cone) => {
      const nodes = cone._sensorNodes;
      nodes.forEach((node) => {
        visibleNodes.push(node);
      });
    });
    return visibleNodes;
}



function loadSearchList() {
const list = document.getElementById("ann_search_bar_list");
list.innerHTML = ""; // clear any previous items

console.log("list loading");

for (const node of sensorNodes || []) {
  const item = document.createElement("li");
  const link = document.createElement("a");
  // link.href = "#";
  link.textContent = node.name;

  link.addEventListener("click", (e) => {
      e.preventDefault();
      onSensorNodeClick(node);
  })

  item.appendChild(link);
  // hide all by default
  item.style.display = "none";
  list.appendChild(item);
  }
}


function searchList() {
  const input = document.getElementById("ann_search_bar");
  const list = document.getElementById("ann_search_bar_list");
  if(!list) return;
  const items = list.getElementsByTagName("li");

  // console.log('searching list');
  // If the search box is empty → show only cameras with visible annotation
  if (!input.value) {
    list.style.display = "block";

    // Get visible nodes
    const visibleNodes = getVisibleNodesFromCones(viewer.scene.getActiveCamera());

    for (const item of items) {
      // Find the camera object associated with this <li>
      const node = (sensorNodes || []).find(
        a => a.name === item.textContent || a.camera_name === item.textContent
      );

      // Show if this camera's annotation is visible, hide otherwise
      item.style.display = visibleNodes.includes(node) ? "block" : "none";
    }
    return;
  }

  const filter = input.value.trim().toUpperCase();

  // Otherwise, normal filtering by name
  list.style.display = "block";
  for (const item of items) {
    const text = item.textContent || item.innerText;
    item.style.display = text.toUpperCase().includes(filter) ? "block" : "none";
  }
}

function debounce(fn, delay) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn.apply(this, args), delay);
  };
}

const debouncedSearchList = debounce(searchList, 40);


function toggleConeRadius() {
    const speed = viewer.getMoveSpeed();

    const SPEED_LOW  = 136805.4;
    const SPEED_HIGH = 875735.9;

    const R_MIN = 1000;   // when speed is LOW
    const R_MAX = 5000;   // when speed is HIGH

    // Normalize speed → 0 to 1
    let t = (speed - SPEED_LOW) / (SPEED_HIGH - SPEED_LOW);
    t = Math.min(Math.max(t, 0), 1);

    // Linear interpolation: low speed → small radius, high speed → large radius
    const radius = R_MIN + t * (R_MAX - R_MIN);

    coneMarkers.forEach(cone => {
        updateConeRadius(cone, radius);
    });
}



function updateConeRadius(cone, newRadius) {
    const baseRadius = 5000; // your original cone radius
    const scale = newRadius / baseRadius;

    cone.scale.set(scale, 1, scale);  // scale X and Y only because I am using Euler and I rotated in Y axis
}


function toggleConeMarkers() {
    const visible = window.coneMarkers[0].visible;

    window.coneMarkers.forEach(cone => {
        cone.visible = !visible;
    });

    if (visible) {
        viewer.renderer.raycaster.layers.disable(CONE_LAYER);
    } else {
        viewer.renderer.raycaster.layers.enable(CONE_LAYER);
    }
}
