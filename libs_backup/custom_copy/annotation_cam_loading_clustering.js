document.addEventListener("DOMContentLoaded", () => {
    const zoneSearchButton = document.getElementById("searchCamerasButton");
    zoneSearchButton.addEventListener("click", toggleSearchCameraMenu);
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

function toggleSearchCameraMenu() {
    // check if already open
    let existingMenu = document.getElementById("searchCameraMenu");
    if (existingMenu) {
        existingMenu.classList.remove("open");
        setTimeout(() => existingMenu.remove(), 300);
        return;
    }

    // --- create new panel ---
    const panel = document.createElement("div");
    panel.id = "searchCameraMenu";
    panel.className = "zone-panel";

    panel.style.overflow = "visible";
    panel.style.maxHeight = "400px";


    // --- Title ---
    const title = document.createElement("h3");
    title.textContent = "Camera Search";
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

    // --- Container for search UI ---
    const container = document.createElement("div");
    container.id = "ann_search_container";

    // --- Search input ---
    const searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.id = "ann_search_bar";
    searchInput.placeholder = "Search";
    searchInput.addEventListener("keyup", searchList);
    container.appendChild(searchInput);

    // --- Results list ---
    const searchListContainer = document.createElement("ul");
    searchListContainer.id = "ann_search_bar_list";
    container.appendChild(searchListContainer);

    // --- Add container to panel ---
    panel.appendChild(container);

    // --- Append and open ---
    document.body.appendChild(panel);
    requestAnimationFrame(() => panel.classList.add("open"));

    // --- Populate list ---
    loadSearchList();
}


//################### NEW Annotation System ######################################

window.cameras_ann_list = [];
window.cameraMap = null;


async function loadCSV() {
const response = await fetch("camera_albers.csv");
const text = await response.text();

const rows = text.trim().split("\n").slice(1); // skip header row
const points = rows.map(row => {
const [camera_id, camera_name, x, y, elev] = row.split(",");
return { 
    camera_id : camera_id.trim(),
    camera_name: camera_name.trim(), 
    x: Number(x), 
    y: Number(y), 
    elev: Number(elev) 
};
});
return points;
}

loadCSV().then(points => {
points.forEach(p => {
    const pos = new THREE.Vector3(p.x, p.y, p.elev);

    const annotation = viewer.scene.addAnnotation(
        pos,
        {
            title: "●",
            // cameraPosition: null,
            // cameraTarget: null,
            description: p.camera_name,
        }
    )
    const ann_obj = {
        annotation: annotation,
        camera_id: p.camera_id,
        position: annotation.position,
        x: 0,
        y: 0,
        visited: false,
        og_description: annotation.description,
        image360 : `https://tools.alertcalifornia.org/frame360?id=${p.camera_id}`
    }
    // console.log(ann_obj);
    cameras_ann_list.push(ann_obj);
});
initAnnotationClustering();
loadSearchList();
});

setTimeout(() => {
  if(window.cameras_ann_list.length == 0){
    loadCSV().then(points => {
      points.forEach(p => {
          const pos = new THREE.Vector3(p.x, p.y, p.elev);

          const annotation = viewer.scene.addAnnotation(
              pos,
              {
                  title: "●",
                  // cameraPosition: null,
                  // cameraTarget: null,
                  description: p.camera_name,
              }
          )
          const ann_obj = {
              annotation: annotation,
              camera_id: p.camera_id,
              position: annotation.position,
              x: 0,
              y: 0,
              visited: false,
              og_description: annotation.description,
              image360 : `https://tools.alertcalifornia.org/frame360?id=${p.camera_id}`
          }
          // console.log(ann_obj);
          cameras_ann_list.push(ann_obj);
      });
      initAnnotationClustering();
      loadSearchList();
      });
  }
}, 3000);


function buildCameraMap() {
  console.log("building map");
  const map = new Map();

  for (const cam of window.cameras_ann_list) {
    const key = `${cam.position.x},${cam.position.y},${cam.position.z}`;

    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(cam);
  }

  window.cameraMap = map;
}





function loadSearchList() {
const list = document.getElementById("ann_search_bar_list");
list.innerHTML = ""; // clear any previous items

console.log("list loading");

for (const ann_obj of window.cameras_ann_list || []) {
  const item = document.createElement("li");
  const link = document.createElement("a");
  // link.href = "#";
  link.textContent = ann_obj.og_description || ann_obj.camera_name || "Unnamed Camera";

  link.addEventListener("click", (e) => {
      e.preventDefault();
      window.open360CameraObject(ann_obj);
  })

  item.appendChild(link);
  // hide all by default
  item.style.display = "none";
  list.appendChild(item);
  }
}


function searchList() {
  const input = document.getElementById("ann_search_bar");
  const filter = input.value.trim().toUpperCase();
  const list = document.getElementById("ann_search_bar_list");
  const items = list.getElementsByTagName("li");

  // If the search box is empty → show only cameras with visible annotation
  if (!input.value) {
    list.style.display = "block";

    // Get visible annotations
    const visibleAnns = (window.cameras_ann_list || []).filter(
      ann => ann.annotation?.visible
    );

    for (const item of items) {
      // Find the camera object associated with this <li>
      const annObj = (window.cameras_ann_list || []).find(
        a => a.og_description === item.textContent || a.camera_name === item.textContent
      );

      // Show if this camera's annotation is visible, hide otherwise
      item.style.display = visibleAnns.includes(annObj) ? "block" : "none";
    }

    return;
  }

  // Otherwise, normal filtering by name
  list.style.display = "block";
  for (const item of items) {
    const text = item.textContent || item.innerText;
    item.style.display = text.toUpperCase().includes(filter) ? "block" : "none";
  }
}



function ann_list_moveto(annPos){
  // const annPos = new THREE.Vector3(x, y, z);
  // if(window.in360View) close360();
  const { camPos, lookAt } = cameraAboveFacing(annPos, 10, 0, 50);
  moveCameraTo(camPos, lookAt);
  // onViewerUpdate();
  // viewer.scene.view.pitch = 0.0001;
  
}

window.searchList = searchList;

// ---------- CONFIG ----------
const CLUSTER_RADIUS_PX = 30;      // pixel radius for clustering
const MIN_INTERVAL_MS    = 700;    // throttle
const SHOW_ONLY_ONSCREEN = true;   // skip offscreen annotations

// ---------- STATE ----------
const ClusterState = {
nodes: [],              // { ann, world:Vector3, sx, sy, visible, clusterId, isAnchor, origTitle }
buckets: new Map(),     // "cx,cy" -> [idx, ...]
lastCamHash: null,
lastRunTs: 0,
W: 0, H: 0,
R: CLUSTER_RADIUS_PX,
R2: CLUSTER_RADIUS_PX * CLUSTER_RADIUS_PX,
};

// Call once AFTER cameras_ann_list is filled
function initAnnotationClustering() {

  buildCameraMap();
  // Build internal nodes array once
  ClusterState.nodes = cameras_ann_list.map((o, idx) => {
    const ann = o.annotation;
    // preserve original title once
    if (!ann._origTitle) ann._origTitle = (ann.options?.title ?? ann.title ?? "●");
    return {
        ann,
        world: o.position,   // THREE.Vector3 (world)
        sx: 0, sy: 0,        // screen coords
        visible: true,
        clusterId: -1,
        isAnchor: false,
        origTitle: ann._origTitle,
        origDesc: o.og_description,
    };
  });

  // Hook into Potree update loop
  viewer.addEventListener('camera_changed', onViewerUpdate);

  // Optional: initial run
  reclusterNow();
}

function onViewerUpdate() {
toggleEDLOpactiy();

const now = performance.now();
// Throttle
if (now - ClusterState.lastRunTs < MIN_INTERVAL_MS) return;

if(window.in360View) return;


// Only run if camera (or viewport) changed
const camHash = makeCameraHash();
if (camHash === ClusterState.lastCamHash) return;

ClusterState.lastCamHash = camHash;
ClusterState.lastRunTs = now;
console.log('reclustering');

reclusterNow();
const searchInput = document.getElementById("ann_search_bar");
if(searchInput && !searchInput.value) searchList();



}

// ---------- CAMERA / PROJECTION ----------
function makeCameraHash() {
const cam = viewer.scene.getActiveCamera();
const r = viewer.renderer;
const e = cam; // alias

// Hash position, rotation, fov and viewport size (cheap & stable)
const p = e.position, q = e.quaternion;
const W = r.domElement.clientWidth, H = r.domElement.clientHeight;
return [
p.x.toFixed(3), p.y.toFixed(3), p.z.toFixed(3),
q.x.toFixed(5), q.y.toFixed(5), q.z.toFixed(5), q.w.toFixed(5),
(e.fov ?? 0).toFixed(3),
W, H
].join('|');
}

function projectAllToScreen() {
const cam = viewer.scene.getActiveCamera();
cam.updateMatrixWorld();
if (cam.projectionMatrix) cam.updateProjectionMatrix();

const { clientWidth: W, clientHeight: H } = viewer.renderer.domElement;
ClusterState.W = W; ClusterState.H = H;

for (let n of ClusterState.nodes) {
const ndc = n.world.clone().project(cam);
n.sx = ( ndc.x * 0.5 + 0.5) * W;
n.sy = (-ndc.y * 0.5 + 0.5) * H;
}
}

// ---------- BUCKETING ----------
function rebuildBuckets() {
ClusterState.buckets.clear();
const R = ClusterState.R;

for (let i = 0; i < ClusterState.nodes.length; i++) {
const n = ClusterState.nodes[i];

// Optionally skip offscreen
if (SHOW_ONLY_ONSCREEN) {
    if (n.sx < 0 || n.sx > ClusterState.W || n.sy < 0 || n.sy > ClusterState.H) {
    n.clusterId = -2; // mark as offscreen/unclustered
    continue;
    }
}

const cx = Math.floor(n.sx / R);
const cy = Math.floor(n.sy / R);
const key = cx + ',' + cy;

let arr = ClusterState.buckets.get(key);
if (!arr) {
    arr = [];
    ClusterState.buckets.set(key, arr);
}
arr.push(i);
n.clusterId = -1; // reset visit
}
}

// ---------- CLUSTERING ----------
function buildClusters() {
const R2 = ClusterState.R2;
const clusters = [];
const visited = new Uint8Array(ClusterState.nodes.length);

// helper: yield candidates from 9 neighboring buckets
function* candidatesFor(i) {
const R = ClusterState.R;
const sx = ClusterState.nodes[i].sx;
const sy = ClusterState.nodes[i].sy;
const cx = Math.floor(sx / R);
const cy = Math.floor(sy / R);
for (let ox = -1; ox <= 1; ox++) {
    for (let oy = -1; oy <= 1; oy++) {
    const key = (cx + ox) + ',' + (cy + oy);
    const arr = ClusterState.buckets.get(key);
    if (!arr) continue;
    for (let j of arr) yield j;
    }
}
}

for (let i = 0; i < ClusterState.nodes.length; i++) {
if (ClusterState.nodes[i].clusterId === -2) continue; // offscreen
if (visited[i]) continue;

// start a new cluster and BFS from i
visited[i] = 1;
const cluster = [i];
const q = [i];

while (q.length) {
    const u = q.pop();

    for (let v of candidatesFor(u)) {
    if (visited[v]) continue;
    if (ClusterState.nodes[v].clusterId === -2) continue;

    const dx = ClusterState.nodes[u].sx - ClusterState.nodes[v].sx;
    const dy = ClusterState.nodes[u].sy - ClusterState.nodes[v].sy;
    if ((dx*dx + dy*dy) <= R2) {
        visited[v] = 1;
        cluster.push(v);
        q.push(v); // <-- expand transitively through v
    }
    }
}

clusters.push(cluster);
}

return clusters;
}


// ---------- APPLY (minimal DOM changes) ----------
function applyClusters(clusters) {
// Clear previous anchor flags
for (let n of ClusterState.nodes) n.isAnchor = false;

let clusterId = 0;

for (let group of clusters) {
if (group.length <= 1) {
    // Singletons: show as "●" with original description/title
    const i = group[0];
    const n = ClusterState.nodes[i];
    if (n.clusterId !== clusterId || !n.visible || n.isAnchor) {
    setAnnotationVisible(n.ann, true);
    setAnnotationTitle(n.ann, "●", n.origTitle);
    setAnnotationDescList(n.ann, group);
    }
    n.clusterId = clusterId++;
    n.isAnchor = true; // singleton is its own anchor
    continue;
}

// Choose a stable anchor: closest to screen-centroid
let cx = 0, cy = 0;
for (let idx of group) { cx += ClusterState.nodes[idx].sx; cy += ClusterState.nodes[idx].sy; }
cx /= group.length; cy /= group.length;

let bestIdx = group[0], bestD2 = Infinity;
for (let idx of group) {
    const n = ClusterState.nodes[idx];
    const dx = n.sx - cx, dy = n.sy - cy;
    const d2 = dx*dx + dy*dy;
    if (d2 < bestD2) { bestD2 = d2; bestIdx = idx; }
}

// Hide all non-anchors, show anchor with count
for (let idx of group) {
    const n = ClusterState.nodes[idx];
    if (idx === bestIdx) {
      if (n.clusterId !== clusterId || !n.visible || !n.isAnchor) {
          setAnnotationVisible(n.ann, true);
          setAnnotationTitle(n.ann, String(group.length), n.origTitle);
          n.ann.description = "";
          setAnnotationDescList(n.ann, group);
          n.ann.children = [];  // prevent Potree from nesting its child annotations
          n.ann._isClusterAnchor = true;
      }
      n.isAnchor = true;
    } else {
    if (n.visible || n.isAnchor) {
        setAnnotationVisible(n.ann, false);
    }
    n.isAnchor = false;
    }
    n.clusterId = clusterId;
}
clusterId++;
}

// Optionally hide any offscreen nodes we marked -2
  if (SHOW_ONLY_ONSCREEN) {
  for (let n of ClusterState.nodes) {
      if (n.clusterId === -2 && n.visible) setAnnotationVisible(n.ann, false);
  }
  }
}

// Helper: set visibility with minimal DOM churn
function setAnnotationVisible(ann, show) {
  ann.visible = !!show; // always set the Potree flag

  const el = ann.domElement || ann.elRoot || ann.element;
  if (el && el.style) {
  el.style.display = show ? '' : 'none';
  }
}

// Helper: set title safely across Potree variants
function setAnnotationTitle(ann, label, fallbackDesc) {
  // Prefer API if Potree provides it
  if (typeof ann.setTitle === 'function') {
  ann.setTitle(label);
  return;
  }

  ann.title = label;

  // Try DOM element if present
  const el = ann.domElement || ann.elRoot || ann.element;
  if (el && el.nodeType === 1) { // only if it's really an element
  // try to find a child title node, fallback to setting text directly
  const titleEl =
      el.querySelector?.('.annotation-title') ||
      el.querySelector?.('.title') ||
      el;
  if (titleEl && titleEl.textContent !== String(label)) {
      titleEl.textContent = String(label);
  }
  }

  // keep description unchanged for clusters; optional restore
  if (fallbackDesc != null && ann.description == null) {
  ann.description = fallbackDesc;
  }
}

function setAnnotationDescList(ann, group) {
    if (!ann) return;

    // Collect valid camera names
    const camera_entries = [];
    for (const idx of group) {
        const camObj = window.cameras_ann_list[idx];
        if (!camObj) continue;
        // Prefer original description or fallback to title
        const desc = (camObj.og_description || "").trim();
        // const pos = camObj.position;
        // Only add non-empty entries
        if (desc.length > 0 && idx ) {
            camera_entries.push({desc, idx});
        }
    }
    camera_entries.sort((a, b) => a.desc.localeCompare(b.desc));
    // Build a compact HTML list

    // Build clickable list — passing positions into the onclick handler
    const html = camera_entries.map(entry => {
        // const { x, y, z } = entry.pos;
        return `<button onclick="open360CameraIndex(${entry.idx}); return false;">
            <center>${entry.desc}</center>
        </button>`;
    }).join("");


    
    // Update the annotation safely
    // ann.description = "";           // avoid Potree duplication
    // ann._customHTML = html;

    ann.description = html;
    ann.domDescription = ann._description;

    // Optional: prevent Potree from nesting children
    ann.children = [];
}




// ---------- MASTER ----------
function reclusterNow() {
// 1) project once
projectAllToScreen();

// 2) bucket
rebuildBuckets();

// 3) cluster using local-neighborhood scan
const clusters = buildClusters();

// 4) apply (diff-y)
applyClusters(clusters);
}

// Expose init for your code to call after annotations are created
window.initAnnotationClustering = initAnnotationClustering;
  