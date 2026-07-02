/**
 * download_module.js
 * 
 * Author: Aviral Agarwal (CHEI / OpenHeritage3D)
 * Lead Developer, Cultural Heritage Engineering Initiative (UC San Diego)
 * 
 * Description:
 *   Adds a dynamic Download Selected Points interface and supporting logic
 *   for Potree-based viewers. This module creates a progress bar, integrates
 *   with Potree.LASExporter, and automatically downloads all points contained
 *   within selected clipping volumes.
 * 
 * Usage:
 *   1. Add <div id="download-function"></div> in your HTML.
 *   2. Include this file after Potree and viewer initialization:
 *        <script src="download_module.js"></script>
 *   3. The UI and logic will initialize automatically once the DOM is ready.
 * 
 * Dependencies:
 *   - Potree (viewer.scene, LASExporter)
 *   - Three.js (THREE.Box3, THREE.Vector3, etc.)
 *   - Use potree.js with fix 64 bit array fix
 */

style.textContent+=`
/* ==========================================================
   GLASSMORPHIC DARK THEME — DOWNLOAD PANEL
   Matches Zone Search + Zone Creation Panels
   ========================================================== */

.download-panel {
    position: absolute;
    top: 80px;
    right: 10px;

    width: clamp(280px, 28vw, 400px);
    padding: 16px 18px;

    /* Glass background */
    background: rgba(20, 20, 26, 0.55);
    backdrop-filter: blur(12px) saturate(140%);
    -webkit-backdrop-filter: blur(12px) saturate(140%);

    /* Soft glow border */
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 12px;

    /* Floating shadow */
    box-shadow: 0 0 28px rgba(0,0,0,0.55);

    z-index: 99999;

    /* Fade + slide */
    opacity: 0;
    transform: translateY(-6px);
    transition: opacity .25s ease, transform .25s ease;
}

.download-panel.open {
    opacity: 1;
    transform: translateY(0);
}

/* ===================== HEADER ===================== */

.download-header {
    display: flex;
    justify-content: space-between;
    align-items: center;

    color: #f1f1f1;
    margin-bottom: 12px;

    text-shadow: 0 0 6px rgba(0,0,0,0.6);
}

.download-title {
    font-size: 18px;
    font-weight: 600;
}

.download-close {
    cursor: pointer;
    font-size: 22px;
    padding: 2px 8px;
    border-radius: 6px;
    transition: background .15s ease;
}

.download-close:hover {
    background: rgba(255,255,255,0.15);
}

/* ===================== BUTTONS ===================== */

#create-volume-btn,
#download-status {
    width: 100%;
    padding: 10px 14px;

    border: none;
    border-radius: 8px;

    font-weight: 100;
    cursor: pointer;

    color: white;
    transition: background .2s ease, box-shadow .2s ease;
}

/* Green “Create volume” button */
#create-volume-btn {
    background: rgba(45, 160, 80, 0.85);
}
#create-volume-btn:hover {
    background: rgba(55, 180, 95, 1);
    box-shadow: 0 0 12px rgba(55, 180, 95, 0.45);
}

/* Purple “Download” button */
#download-status {
    background: rgba(79,70,229,0.85);
}
#download-status:hover {
    background: rgba(99, 90, 245, 1);
    box-shadow: 0 0 12px rgba(99, 90, 245, 0.45);
}

/* ===================== PROGRESS BAR ===================== */

.progress {
    width: 100%;
    height: 10px;
    background: rgba(255,255,255,0.1);

    border-radius: 6px;
    overflow: hidden;

    margin-top: 6px;
    margin-bottom: 6px;

    backdrop-filter: blur(4px);
}

.progress .bar {
    width: 0%;
    height: 100%;
    background: rgba(99, 90, 245, 1);
    transition: width .25s ease;
}

#progress-percent {
    color: #d4d4d4;
    font-size: 13px;
    text-shadow: 0 0 4px rgba(0,0,0,0.6);
}

/* ==========================================================
   LICENSE AGREEMENT OVERLAY (Glass Dark Modal)
   ========================================================== */

.license-overlay {
    position: fixed;
    left: 0;
    top: 0;

    width: 100%;
    height: 100%;

    background: rgba(0,0,0,0.55);
    backdrop-filter: blur(10px);

    display: flex;
    align-items: center;
    justify-content: center;

    z-index: 99999;

    opacity: 0;
    transform: translateY(-6px);
    transition: opacity .25s ease, transform .25s ease;
}

.license-overlay.open {
    opacity: 1;
    transform: translateY(0);
}

/* Modal Box */

.license-box {
    width: clamp(300px, 32vw, 480px);
    padding: 22px 26px;

    background: rgba(25, 25, 32, 0.65);
    backdrop-filter: blur(14px) saturate(160%);
    -webkit-backdrop-filter: blur(14px) saturate(160%);

    border: 1px solid rgba(255,255,255,0.18);
    border-radius: 16px;

    color: white;
    box-shadow: 0 0 28px rgba(0,0,0,0.55);
}

/* Titles & Text */
.license-title {
    font-size: 20px;
    font-weight: 200;
    margin-bottom: 12px;
    text-shadow: 0 0 6px rgba(0,0,0,0.5);
}

.license-text {
    font-size: 15px;
    margin-bottom: 12px;
    color: #e5e5e5;
    line-height: 1.45;
}

/* Checkbox */
.license-checkbox {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 12px;
    font-size: 15px;
}

.license-checkbox input {
    width: 18px;
    height: 18px;
    accent-color: #665eff;
}

/* Modal Buttons */
.btn-license {
    padding: 10px 18px;
    border-radius: 8px;

    border: none;
    font-weight: 100;
    cursor: pointer;

    background: rgba(99, 90, 245, 0.9);
    color: white;

    transition: background .2s ease, box-shadow .2s ease;
}

.btn-license:hover:not([disabled]) {
    background: rgba(120,110,255,1);
    box-shadow: 0 0 10px rgba(120,110,255,0.45);
}

.btn-license[disabled] {
    opacity: 0.45;
    cursor: not-allowed;
}

.btn-license.cancel {
    background: rgba(255,255,255,0.15);
    color: #eee;
}
.btn-license.cancel:hover {
    background: rgba(255,255,255,0.25);
}

/* end */
`;


window.acceptedTerms = false;


function openDownloadPanel() {
    const existing = document.getElementById("downloadPanel");

    if(!window.acceptedTerms) {
        openLicenseForm();
        return;
    }

    if (existing) {
        existing.classList.remove("open");
        setTimeout(() => existing.remove(), 150);
        return;
    }

    const panel = document.createElement("div");
    panel.id = "downloadPanel";
    panel.className = "download-panel";

    panel.innerHTML = `
        <div class="download-header">
            <span class="download-title">Download Points</span>
            <span class="download-close">&times;</span>
        </div>

        <div id="download-function"></div>
    `;

    document.body.appendChild(panel);

    // Attach close behavior
    panel.querySelector(".download-close").onclick = () => {
        panel.classList.remove("open");
        setTimeout(() => panel.remove(), 150);
    };

    panel.classList.add("open");

    initializeDownloadUI();
}

async function openLicenseForm() {
    // Create overlay
    const overlay = document.createElement("div");
    overlay.className = "license-overlay";

    // Fetch metadata
    const license = await fetchProjectLicense(window.doi) || "No license available.";
    const citation = window.projectCitation || "Citation text missing.";

    // Create modal box
    const box = document.createElement("div");
    box.className = "license-box";


box.innerHTML = `
    <div class="license-title">Terms and Conditions</div>

    <div style="margin-bottom: 10px;" class="license-text">
        Users must agree to a dataset’s terms and conditions before using the download tool.
    </div>

    <div style="margin-bottom: 10px;" class="license-text">
        This data is licensed under the 
        <a href="${license[1]}" target="_blank">${license[0]}</a> 
        license. Please take note of the license terms.
    </div>

    <div class="license-text" style="margin-bottom: 10px;">
        Please include the citation from the project page when referencing this dataset.
    </div>

    <div style="margin-bottom: 10px;" class="license-text">
        This is a test feature. Please note that large selections may fail and use within very large point clouds may be slow.
    </div>

    <div class="license-text" style="margin-bottom: 10px;">
        Data shown within the 3D viewer may differ from the raw data which is available via download links.
    </div>

    <label class="license-checkbox">
        <input type="checkbox" id="tosCheck">
        I agree to the terms of this license
    </label>

    <div style="display:flex; justify-content:flex-end; gap:8px; margin-top: 14px;">
        <button class="btn-license cancel" id="cancelBtn">Cancel</button>
        <button class="btn-license" id="downloadBtn" disabled>Accept</button>
    </div>
`;

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    // Animate in
    requestAnimationFrame(() => overlay.classList.add("open"));

    const checkbox = box.querySelector("#tosCheck");
    const downloadBtn = box.querySelector("#downloadBtn");
    const cancelBtn = box.querySelector("#cancelBtn");

    // Enable the button when user checks the box
    checkbox.addEventListener("change", () => {
        downloadBtn.disabled = !checkbox.checked;
    });

    // Accept → close dialog
    downloadBtn.onclick = () => {
        overlay.classList.remove("open");
        setTimeout(() => overlay.remove(), 150);
        window.acceptedTerms = checkbox.checked;
        openDownloadPanel();
    };

    // Cancel → close dialog
    cancelBtn.onclick = () => {
        overlay.classList.remove("open");
        setTimeout(() => overlay.remove(), 150);
    };
}




function initializeDownloadUI() {
    const download_div = document.getElementById("download-function");
    if (!download_div) return;

    // --- Create Volume Button ---
    const volumeBtn = document.createElement("button");
    volumeBtn.id = "create-volume-btn";
    volumeBtn.textContent = "Create Volume Selection(s)";
    volumeBtn.addEventListener("click", () => {
        viewer.setClipTask(1);
        viewer.volumeTool.startInsertion({ clip: true });
    });

    // --- Download Button ---
    const downloadButton = document.createElement("button");
    downloadButton.id = "download-status";
    downloadButton.textContent = "Download Selected Points";
    downloadButton.addEventListener("click", preparePoints);

    // --- Progress Bar ---
    const progressDiv = document.createElement("div");
    progressDiv.className = "progress";

    const progressBar = document.createElement("div");
    progressBar.id = "progress-bar";
    progressBar.className = "bar";
    progressDiv.appendChild(progressBar);

    const progressPercent = document.createElement("span");
    progressPercent.id = "progress-percent";

    download_div.appendChild(volumeBtn);
    download_div.appendChild(downloadButton);
    download_div.appendChild(progressDiv);
    download_div.appendChild(progressPercent);
}


// Count nodes that intersect clipBox up to maxDepth (fast, rough)
// Uses the same AABB test Potree uses.
function countIntersectingNodes(pointcloud, clipBox, maxDepth){
const stack = [pointcloud.pcoGeometry.root];
let count = 0;
while (stack.length){
    const node = stack.pop();
    if (!node) continue;
    // node.boundingBox is in local; bring to world
    const bbWorld = node.boundingBox.clone().applyMatrix4(pointcloud.matrixWorld);
    if (!bbWorld.intersectsBox(clipBox)) continue;
    count++;
    if (node.level < maxDepth){
    for (let i=0;i<8;i++) if (node.children[i]) stack.push(node.children[i]);
    }
}
return count;
}

let preparePoints = () => {
    const btn = document.getElementById("download-status");
    if(viewer.scene.volumes.length < 1){
        btn.disabled = true;
        btn.innerText = "No Volumes in Scene!";
        setTimeout( function (){
            btn.innerText = "Download Selected Points";
            btn.disabled = false;
        }, 3000);
    }
    for(let volume of viewer.scene.volumes){

        btn.disabled = true;
        // letvolume = viewer.scene.volumes[0];
        // let clipBox = new THREE.Box3();
        let curPoint = new THREE.Vector3().copy(volume.position);
        
        // console.log('volumes length', viewer.scene.volumes.length)

        let width = volume.scale.x;
        let length = volume.scale.y;
        let height = volume.scale.z;

        let volume_size = width * length * height;

        let rotationMatrix = new THREE.Matrix4().makeRotationFromEuler(volume.rotation);

        let points = new Potree.Points();

        // make sure transforms are current
        volume.updateMatrixWorld(true);

        // corners of a unit cube centered at origin
        const localCorners = [
        new THREE.Vector3(-0.5, -0.5, -0.5),
        new THREE.Vector3(+0.5, -0.5, -0.5),
        new THREE.Vector3(-0.5, +0.5, -0.5),
        new THREE.Vector3(+0.5, +0.5, -0.5),
        new THREE.Vector3(-0.5, -0.5, +0.5),
        new THREE.Vector3(+0.5, -0.5, +0.5),
        new THREE.Vector3(-0.5, +0.5, +0.5),
        new THREE.Vector3(+0.5, +0.5, +0.5),
        ];

        // transform into world space (matrixWorld already includes scale, rotation, translation)
        const worldCorners = localCorners.map(v => v.clone().applyMatrix4(volume.matrixWorld));

        // build an AABB that encloses those corners
        const clipBox = new THREE.Box3().setFromPoints(worldCorners);


        window.requests = [];

        let maxDepth = 10;

        let pointclouds_name = "";
        // Loop through all visible pointclouds
        
        const clouds = viewer.scene.pointclouds.filter(p => p.visible);

        const total_nodes = clouds.reduce((acc, pc) => acc + countIntersectingNodes(pc, clipBox, maxDepth), 0);
        total_points = total_nodes * 4000;

        console.log('totalNodes', total_nodes);
        for (let pointcloud of viewer.scene.pointclouds.filter(p => p.visible)) {
            let request = pointcloud.getPointsInBox3(clipBox, maxDepth, {
                'onProgress': (event) => {
                    // console.log('working...', points);
                    points.add(event.points);
                    btn.innerText = "Downloading... "+ points.numPoints+" points so far";
                    let progress = points.numPoints/total_points;
                    if(progress <= 0.99){
                        document.getElementById("progress-bar").style.width = progress*100 + "%";
                        document.getElementById("progress-percent").innerText = Math.round(progress*100) + "%";
                    }
                },
                'onFinish': (event) => {
                    let buffer = Potree.LASExporter.toLAS(points);

                    let blob = new Blob([buffer], { type: "application/octet-binary" });
                    document.getElementById("progress-bar").style.width = "100%";
                    document.getElementById("progress-percent").innerText = "100%";


                    btn.innerText = "Download Complete! "+ points.numPoints + " points downloaded.";
                    let url = URL.createObjectURL(blob);
                    let a = document.createElement("a");
                    a.href = url;
                    
                    a.download = pointclouds_name.trim()+".las";
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);    // free memory
                    // $('#download-points').attr('href', URL.createObjectURL(blob));
                    
                    setTimeout(function (){
                        btn.disabled = false;
                        btn.innerText = "Download Selected Points";
                        document.getElementById("progress-bar").style.width = "0%";
                        document.getElementById("progress-percent").innerText = "";
                    }, 5000)

                },
                'onCancel': () => {

                }
            });
            pointclouds_name += pointcloud.name + " ";
            requests.push(request);
        }
    }
}
