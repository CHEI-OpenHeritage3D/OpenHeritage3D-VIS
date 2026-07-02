document.addEventListener("DOMContentLoaded", () => {
    const zoneSearchButton = document.getElementById("searchCamerasButton");
    zoneSearchButton.addEventListener("click", toggleSearchCameraMenu);
    document.addEventListener('mousemove', onMouseMove, false);

    viewer.addEventListener('camera_changed', () => {
      toggleConeRadius();
      toggleEDLOpactiy();
      updateCameraLight();
    }); 
    viewer.addEventListener('camera_changed', debouncedSearchList);


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

    const gradientTex = loader.load('gradient.png', (tex) => {
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
    if (isHoveringDialog) return;   // dialog stays open

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
        restoreConeAppearance(currentHoveredCone);
        currentHoveredCone = null;
        hideSensorDialog();
        clearHover();
    }
}

function clearHover() {
    if (currentHoveredCone) {
        restoreConeAppearance(currentHoveredCone);
    }
}

function onSensorNodeHover(intersections, event) {
    if (isHoveringDialog) return;

    if (!Array.isArray(intersections) || intersections.length === 0) {
        hideSensorDialog();
        if(currentHoveredCone){
          restoreConeAppearance(currentHoveredCone);
          currentHoveredCone = null;
          clearHover(); 
        }
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


    showSensorDialog(cones, viewer.scene.getActiveCamera(), event);
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


function showSensorDialog(cones, camera, event) {
    const dialog = document.getElementById("sensor-hover-dialog");
    const list = document.getElementById("sensor-hover-list");

    // Cancel any pending hide timeout
    if (hoverHideTimeout) {
        clearTimeout(hoverHideTimeout);
        hoverHideTimeout = null;
    }

    // Clear old entries
    list.innerHTML = "";

    cones.sort((a,b) => a.name.localeCompare(b.name));
    cones.forEach(cone => {
    cone._sensorNodes.forEach((node) =>{

      const btn = document.createElement("button");
      btn.className = "sensor-btn";

      btn.textContent = node.name;

      btn.onclick = () => onSensorNodeClick(node);

      list.appendChild(btn);

    })
  });


    // Position dialog near the first cone
    const anchor = getScreenPosition(cones[0], camera);
    const mousePointer = getMouseVector2(event);

    const mousePointerScreen = new THREE.Vector2(
        (mousePointer.x * 0.5 + 0.5) * window.innerWidth,
        (-mousePointer.y * 0.5 + 0.5) * window.innerHeight
    );
    // Now clamp dialog
    dialog.style.display = "block"; // must be visible so we can measure size
    const rect = dialog.getBoundingClientRect();

    let x = mousePointerScreen.x;
    let y = mousePointerScreen.y;

    // Clamp to screen edges
    x = Math.min(Math.max(x, 10), window.innerWidth - rect.width  - 10);
    y = Math.min(Math.max(y, 10), window.innerHeight - rect.height - 10);

    dialog.style.left = x + "px";
    dialog.style.top  = y + "px";
}

function onSensorNodeClick(node) {
  // if(window.in360View) window.close360();
  node.coneMarker.visible = false;
  window.open360(node);
}

window.onSensorNodeClick = onSensorNodeClick;


function hideSensorDialog() {
    if (isHoveringDialog) return;

    // Delay hiding so the user can move the mouse to the dialog
    hoverHideTimeout = setTimeout(() => {
        if (!isHoveringDialog) {
            document.getElementById("sensor-hover-dialog").style.display = "none";
        }
    }, 500);  // 200ms grace period
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
