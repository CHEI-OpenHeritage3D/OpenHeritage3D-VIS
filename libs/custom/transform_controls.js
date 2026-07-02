import { TransformControls } 
    from 'https://unpkg.com/three@0.118.0/examples/jsm/controls/TransformControls.js';

style.textContent += `
/* ═══════════════════════════════════════════════════════════
   TRANSFORM PANEL — glassmorphic dark theme
   (matches brush / zone / download / search panels)
   Managed by panel_window_manager.js when present; the outer
   frame styling below is a graceful fallback if it is not.
   ═══════════════════════════════════════════════════════════ */

.transform-panel {
    position: fixed;
    top: 80px;
    right: 10px;
    width: clamp(300px, 26vw, 360px);
    box-sizing: border-box;
    padding: 18px 20px;

    background: rgba(20, 20, 26, 0.55);
    backdrop-filter: blur(12px) saturate(140%);
    -webkit-backdrop-filter: blur(12px) saturate(140%);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 14px;
    box-shadow: 0 0 28px rgba(0,0,0,0.55);

    z-index: 10000;
    font-family: 'Segoe UI', system-ui, sans-serif;
    color: #f2f2f7;

    opacity: 0;
    transform: translateY(-6px);
    transition: opacity .18s ease, transform .18s ease;
}
.transform-panel.open { opacity: 1; transform: translateY(0); }

/* Header */
.transform-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
}
.transform-title {
    font-size: 19px;
    font-weight: 600;
    color: #f2f2f7;
    text-shadow: 0 0 6px rgba(0,0,0,0.6);
}
.transform-header-right {
    display: flex;
    align-items: center;
    gap: 8px;
}
.transform-close {
    width: 28px; height: 28px;
    display: inline-flex; align-items: center; justify-content: center;
    cursor: pointer;
    font-size: 20px;
    color: #999;
    border-radius: 6px;
    transition: background .15s ease, color .15s ease;
}
.transform-close:hover { background: rgba(220, 38, 38, 0.3); color: #f87171; }

/* Sections */
.transform-section {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid rgba(255,255,255,0.08);
}
.transform-subtitle {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #888;
    margin-bottom: 8px;
}

.transform-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 0;
}
.transform-label { color: #9ca3af; font-size: 13px; }
.transform-value {
    color: #f3f3f3;
    font-size: 13px;
    font-family: ui-monospace, "SF Mono", Menlo, monospace;
}
.transform-offset {
    font-size: 11px;
    color: #7f7f8a;
    margin: 2px 0 6px;
    font-family: ui-monospace, "SF Mono", Menlo, monospace;
}

/* Inputs */
.transform-search {
    width: 100%;
    box-sizing: border-box;
    padding: 9px 12px;
    margin-bottom: 8px;
    border-radius: 8px;
    border: 1px solid rgba(255,255,255,0.2);
    background: rgba(255,255,255,0.08);
    color: #fafafa;
    font-size: 14px;
    transition: border-color .15s, background .15s, box-shadow .15s;
}
.transform-search::placeholder { color: #888; }
.transform-search:focus {
    outline: none;
    border-color: #6e6bff;
    background: rgba(255,255,255,0.12);
    box-shadow: 0 0 0 3px rgba(79,70,229,0.3);
}

.transform-select {
    width: 100%;
    box-sizing: border-box;
    height: 108px;
    padding: 6px;
    background: rgba(0,0,0,0.28);
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 8px;
    color: #e8e8ee;
    font-size: 13px;
    margin-bottom: 4px;
}
.transform-select:focus { outline: none; border-color: #6e6bff; }
.transform-select option { padding: 4px 6px; background: #16171c; color: #e8e8ee; }
.transform-select option:checked { background: #4f46e5; color: #fff; }

/* Action buttons */
.transform-button {
    width: 50%;
    padding: 9px 14px;
    margin-top: 8px;
    background: rgba(255,255,255,0.08);
    color: #f2f2f7;
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: background .15s ease, border-color .15s ease, transform .1s ease;
}
.transform-button:hover {
    background: rgba(79,70,229,0.28);
    border-color: rgba(79,70,229,0.45);
}
.transform-button:active { transform: scale(0.97); }

/* Coupled / decoupled pill */
.coupled-pill {
    font-size: 11px;
    padding: 3px 9px;
    border-radius: 9999px;
    border: 1px solid #4b5563;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-weight: 600;
}
.coupled-pill.coupled {
    background: rgba(34, 197, 94, 0.18);
    color: #bbf7d0;
    border-color: rgba(34,197,94,0.6);
}
.coupled-pill.decoupled {
    background: rgba(148, 163, 184, 0.16);
    color: #e5e7eb;
    border-color: rgba(148,163,184,0.5);
}

/* Shortcuts */
.transform-shortcuts {
    margin-top: 12px;
    padding: 12px 14px;
    border-radius: 10px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
}
.shortcut-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 6px;
}
.shortcut-row:last-child { margin-bottom: 0; }
.shortcut-key {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 24px;
    padding: 3px 7px;
    border-radius: 6px;
    background: rgba(255,255,255,0.08);
    color: #f2f2f7;
    font-size: 12px;
    font-family: ui-monospace, "SF Mono", Menlo, monospace;
    border: 1px solid rgba(255,255,255,0.18);
}
.shortcut-desc { color: #c7c7d1; font-size: 12px; }

/* Export sub-panel */
.export-textarea {
    width: 100%;
    box-sizing: border-box;
    height: 130px;
    background: rgba(0,0,0,0.3);
    color: #e8e8ee;
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 8px;
    padding: 10px;
    font-size: 12px;
    font-family: ui-monospace, "SF Mono", Menlo, monospace;
    resize: none;
}
.export-copy-btn {
    width: 100%;
    background: rgba(79, 70, 229, 0.85);
    color: white;
    border: none;
    padding: 9px 10px;
    border-radius: 8px;
    cursor: pointer;
    margin-bottom: 10px;
    font-size: 13px;
    font-weight: 500;
    transition: background .15s ease, box-shadow .15s ease;
}
.export-copy-btn:hover {
    background: rgba(99, 90, 245, 1);
    box-shadow: 0 0 12px rgba(99, 90, 245, 0.45);
}
.export-copy-btn.copied { background: #22c55e !important; }
`;


let control;
let axesHelper;

let pcStartingTransforms = [];
let pcStartingTransformsLoad = [];

let pcStartingTransformsLoadcomputed = false;

function initPCStartingTransforms (){
    for(let i = 0; i < viewer.scene.pointclouds.length; i++){
        const pc = viewer.scene.pointclouds[i];
        const position = pc.position.clone();
        const quaternion = pc.quaternion.clone();
        const scale = pc.scale.clone();

        const id = `pc_${i}`;
        pcStartingTransforms[id] = {position, quaternion, scale };

    }

    if (window.earth) {
        pcStartingTransforms["earth"] = {
            position: window.earth.position.clone(),
            quaternion: window.earth.quaternion.clone(),
            scale: window.earth.scale.clone()
        };
    }
}

function initPCStartingTransformsLoad (){
    for(let i = 0; i < viewer.scene.pointclouds.length; i++){
        const pc = viewer.scene.pointclouds[i];
        const position = pc.position.clone();
        const quaternion = pc.quaternion.clone();
        const scale = pc.scale.clone();

        const id = `pc_${i}`;
        pcStartingTransformsLoad[id] = {position, quaternion, scale };

    }
    pcStartingTransformsLoadcomputed = true;
    console.log(pcStartingTransformsLoad);
}

function rotateAroundPointWithQuaternion(obj, point, q) {
    obj.position.sub(point);
    obj.position.applyQuaternion(q);
    obj.position.add(point);

    obj.quaternion.premultiply(q);
}

function scaleAroundPoint(obj, point, deltaScale) {
    obj.position.sub(point); 
    obj.position.multiply(deltaScale);
    obj.position.add(point);

    obj.scale.multiply(deltaScale);
}

function resetPCTransform (id) {
    if(!id) return;
    const startingPC = pcStartingTransforms[id];
    const pc = window.pointcloudMap[id];

    pc.position.x = startingPC.position.x;
    pc.position.y = startingPC.position.y;
    pc.position.z = startingPC.position.z;

    pc.quaternion.x = startingPC.quaternion.x;
    pc.quaternion.y = startingPC.quaternion.y;
    pc.quaternion.z = startingPC.quaternion.z;

    pc.scale.x = startingPC.scale.x;
    pc.scale.y = startingPC.scale.y;
    pc.scale.z = startingPC.scale.z;
    
    updateTransformPanel(pc);
}

function movePCtoProxy(pc){
    const camPos = viewer.scene.view.getPivot().clone();
    console.log('proxypos: ', camPos);
    pc.position.set(camPos.x, camPos.y, camPos.z);
}

function toggleTransformControls(pc) {

    if (selectedID !== "earth") {
        viewer.setEDLEnabled(false);
    }

    axesHelper = new THREE.AxesHelper(10000);

    const geometry = new THREE.BoxGeometry( 0.01, 0.01, 0.01);
    const material = new THREE.MeshBasicMaterial({visible: false});
    const proxy = new THREE.Mesh(geometry, material);

    const camPos = viewer.scene.view.getPivot().clone();
    proxy.position.copy(camPos);
    axesHelper.position.copy(camPos);

    viewer.scene.scene.add(proxy);
    viewer.scene.scene.add(axesHelper);

    control = new TransformControls(
        viewer.scene.getActiveCamera(),
        viewer.renderer.domElement
    );

    control.rotation.set(viewer.scene.scene.rotation.x, viewer.scene.scene.rotation.y, viewer.scene.scene.rotation.z);
    console.log('control: ',control);

    control.attach(proxy);
    viewer.scene.scene.add(control);

    const isEarth = (selectedID === "earth");

    // if (isEarth) {
    //     proxy.position.copy(pc.position);     // pivot at Earth center
    //     axesHelper.position.copy(pc.position);
    // } else {
    //     const camPos = viewer.scene.view.getPivot().clone();
    //     proxy.position.copy(camPos);
    //     axesHelper.position.copy(camPos);
    // }



    let proxyInitPos;
    let proxyInitQuat;
    let proxyInitScale;

    function coupleProxyToPC(){
        if(!coupled) return;
        
        const proxyPos = proxy.position.clone();
        const proxyPosChange = proxyPos.sub(proxyInitPos);
        
        const currentQuat = proxy.quaternion.clone();
        const deltaQuat = proxyInitQuat.clone().invert().multiply(currentQuat);

        const currentScale = proxy.scale.clone();
        const deltaScale = currentScale.divide(proxyInitScale);


        pc.translateX(proxyPosChange.clone().x);
        pc.translateY(proxyPosChange.clone().y);
        pc.translateZ(proxyPosChange.clone().z);

        const pivot = proxy.position.clone();    // cube position

        rotateAroundPointWithQuaternion(pc, pivot, deltaQuat);

        scaleAroundPoint(pc, pivot, deltaScale);

        proxyInitPos = proxy.position.clone();
        proxyInitQuat = proxy.quaternion.clone();
        proxyInitScale = proxy.scale.clone();

        updateTransformPanel(pc);

    }


    let coupled = true;
    proxyInitPos = proxy.position.clone();
    proxyInitQuat = proxy.quaternion.clone();
    proxyInitScale = proxy.scale.clone();
    control.addEventListener( 'change', coupleProxyToPC );
    setCoupledState(true);

    window.addEventListener( 'keydown', e => {
        switch(e.key.toLowerCase()){

            case 'd':
                if(!coupled){
                    coupled = true;
                    setCoupledState(true);
                    proxyInitPos = proxy.position.clone();
                    proxyInitQuat = proxy.quaternion.clone();
                    proxyInitScale = proxy.scale.clone();
                    control.addEventListener( 'change', coupleProxyToPC );
                }
                else{
                    coupled = false;
                    setCoupledState(false);
                    control.removeEventListener( 'change', coupleProxyToPC);
                    proxyInitPos = null;
                }
                break;

            case 'w':
                control.setMode('translate');
                break;
            case 'r':
                control.setMode('rotate');
                break;
            case 's':
                control.setMode('scale');
                break;
        }
    });


    control.addEventListener( 'mouseDown', e => {
        viewer.controls.enabled = false;
        viewer.inputHandler.removeInputListener(viewer.controls);


    });

    control.addEventListener( 'mouseUp', () => {
        viewer.controls.enabled = true;
        viewer.inputHandler.addInputListener(viewer.controls);
    })
}

function openTransformPanel() {
    const existing = document.getElementById("transformPanel");

    if (existing) {
        existing.classList.remove("open");
        setTimeout(() => existing.remove(), 150);
        return;
    }

    initPCStartingTransforms();

    if(!pcStartingTransformsLoadcomputed) initPCStartingTransformsLoad();

    const panel = document.createElement("div");
    panel.id = "transformPanel";
    panel.className = "transform-panel";

    panel.innerHTML = `
    <div class="transform-header">
        <span class="transform-title">Transform Point Cloud</span>
        <div class="transform-header-right">
            <span id="transform-coupled-status" class="coupled-pill decoupled">
                Decoupled
            </span>
            <span class="transform-close">&times;</span>
        </div>
    </div>


        <div class="transform-section">
            <div class="transform-subtitle">Select Point Cloud</div>

            <input 
                id="pc-search" 
                class="transform-search" 
                type="text" 
                placeholder="Search point clouds..."
            />

            <select id="pc-select" size="4" class="transform-select"></select>
        </div>

        <div id="transform-function" class="transform-section">
            <div class="transform-row">
                <span class="transform-label">Position</span>
                <span class="transform-value" id="transform-pos">x: 0, y: 0, z: 0</span>
            </div>
            <div class="transform-offset" id="transform-pos-offset">Δx: 0, Δy: 0, Δz: 0</div>

            <div class="transform-row">
                <span class="transform-label">Rotation</span>
                <span class="transform-value" id="transform-rot">x: 0°, y: 0°, z: 0°</span>
            </div>
            <div class="transform-offset" id="transform-rot-offset">Δx: 0°, Δy: 0°, Δz: 0°</div>

            <div class="transform-row">
                <span class="transform-label">Scale</span>
                <span class="transform-value" id="transform-scale">x: 1, y: 1, z: 1</span>
            </div>
            <div class="transform-offset" id="transform-scale-offset">Δsx: 0, Δsy: 0, Δsz: 0</div>
            
        </div>

        <div class="transform-section">
            <button class="transform-button" id="move-pc-to-proxy-btn">Move PC</button><button class="transform-button" id="reset-transform-btn"   >Reset</button><button class="transform-button" id="export-transform-btn"   >Export</button>
        </div>

            <div class="transform-section transform-shortcuts">
        <div class="transform-subtitle">Controls</div>

        <div class="shortcut-row">
            <span class="shortcut-key">D</span>
            <span class="shortcut-desc">Couple / decouple proxy</span>
        </div>
        <div class="shortcut-row">
            <span class="shortcut-key">W</span>
            <span class="shortcut-desc">Translate mode</span>
        </div>
        <div class="shortcut-row">
            <span class="shortcut-key">R</span>
            <span class="shortcut-desc">Rotate mode</span>
        </div>
        <div class="shortcut-row">
            <span class="shortcut-key">S</span>
            <span class="shortcut-desc">Scale mode</span>
        </div>
    </div>

    `;


    document.body.appendChild(panel);

    // Close button
    panel.querySelector(".transform-close").onclick = () => {
        panel.classList.remove("open");
        closeTransformPanel();
        setTimeout(() => panel.remove(), 150);
    };

    panel.classList.add("open");

    initializeTransformPCSelector();
}

function toggleExportPanel() {
    const existing = document.getElementById('exportPanel');
    if (existing) {
        existing.classList.remove("open");
        setTimeout(() => existing.remove(), 150);
        return;
    }

    const panel = document.createElement("div");
    panel.id = "exportPanel";
    panel.className = "transform-panel";

    panel.innerHTML = `
        <div class="transform-header">
            <span class="transform-title">Export Transform Code</span>
            <span class="transform-close">&times;</span>
        </div>

        <div class="transform-section">
            <button id="copy-export-btn" class="export-copy-btn">Copy</button>
            <textarea id="export-code-box" class="export-textarea" readonly></textarea>
        </div>
    `;


    document.body.appendChild(panel);

    // CLOSE FUNCTION
    panel.querySelector(".transform-close").onclick = () => {
        panel.classList.remove("open");
        setTimeout(() => panel.remove(), 150);
    };

    // Position relative to Transform Panel
    const transformPanel = document.getElementById("transformPanel");
    if (transformPanel) {
        const rect = transformPanel.getBoundingClientRect();
        panel.style.position = "absolute";
        panel.style.top = (rect.bottom + 10) + "px";
        panel.style.left = rect.left + "px";
    }


    const copyBtn = panel.querySelector("#copy-export-btn");

    copyBtn.onclick = async () => {
        try {
            await navigator.clipboard.writeText(window.exportCode);

            // Temporary visual feedback
            copyBtn.textContent = "Copied!";
            copyBtn.classList.add("copied");

            setTimeout(() => {
                copyBtn.textContent = "Copy";
                copyBtn.classList.remove("copied");
            }, 1200);

        } catch (err) {
            console.error("Clipboard copy failed:", err);
            copyBtn.textContent = "Error";
        }
    };


//     window.exportCode = `pointcloud.translateX(0.0000);
// pointcloud.translateY(0.0000);
// pointcloud.translateZ(0.0000);

// pointcloud.rotateX(0.0000);
// pointcloud.rotateY(0.0000);
// pointcloud.rotateZ(0.0000);

// pointcloud.scale.set(1.0000, 1.0000, 1.0000);`;

window.exportCode =`pointcloud.position.set(0.0000, 0.0000, 0.0000);

pointcloud.rotation.set(0.0000, 0.0000, 0.0000);

pointcloud.scale.set(1.0000, 1.0000, 1.0000);`;

    if(selectedPC) updateTransformPanel(selectedPC);

    updateExportPanel();
    panel.classList.add("open");
}

function updateExportPanel(){
    const existing = document.getElementById('exportPanel');
    if (!existing) {
        return;
    }
    const innerCode = document.getElementById("export-code-box");
    innerCode.value = window.exportCode;
}

function updateTransformPanel(pc) {
    if (!pc) return;

    const p = pc.position;
    const r = pc.rotation;
    const s = pc.scale;

    document.getElementById("transform-pos").textContent =
        `x: ${p.x.toFixed(3)}, y: ${p.y.toFixed(3)}, z: ${p.z.toFixed(3)}`;

    document.getElementById("transform-rot").textContent =
        `x: ${(r.x*180/Math.PI).toFixed(1)}°, y: ${(r.y*180/Math.PI).toFixed(1)}°, z: ${(r.z*180/Math.PI).toFixed(1)}°`;

    document.getElementById("transform-scale").textContent =
        `x: ${s.x.toFixed(3)}, y: ${s.y.toFixed(3)}, z: ${s.z.toFixed(3)}`;

    // -------------------------------
    // ORIGINAL VALUES AT LOAD TIME
    // -------------------------------
    const og = pcStartingTransformsLoad[selectedID];
    if (!og) return;

    // POS OFFSET
    const dp = {
        x: p.x - og.position.x,
        y: p.y - og.position.y,
        z: p.z - og.position.z
    };

    document.getElementById("transform-pos-offset").textContent =
        `Δx: ${dp.x.toFixed(3)}, Δy: ${dp.y.toFixed(3)}, Δz: ${dp.z.toFixed(3)}`;

    // ROTATION OFFSET (rad)
    const dr_rad = {
        x: (r.x - og.quaternion.x),
        y: (r.y - og.quaternion.y),
        z: (r.z - og.quaternion.z)
    };

    // ROTATION OFFSET (degrees)
    const dr = {
        x: dr_rad.x * 180/Math.PI,
        y: dr_rad.y * 180/Math.PI,
        z: dr_rad.z * 180/Math.PI
    };

    document.getElementById("transform-rot-offset").textContent =
        `Δx: ${dr.x.toFixed(1)}°, Δy: ${dr.y.toFixed(1)}°, Δz: ${dr.z.toFixed(1)}°`;

    // SCALE OFFSET (ratio)
    const ds = {
        x: s.x / og.scale.x,
        y: s.y / og.scale.y,
        z: s.z / og.scale.z
    };

    document.getElementById("transform-scale-offset").textContent =
        `Δsx: ${ds.x.toFixed(3)}, Δsy: ${ds.y.toFixed(3)}, Δsz: ${ds.z.toFixed(3)}`;




    //export panel

//     window.exportCode = `pointcloud.translateX(${p.x.toFixed(4)});
// pointcloud.translateY(${p.y.toFixed(4)});
// pointcloud.translateZ(${p.z.toFixed(4)});

// pointcloud.rotateX(${r.x.toFixed(4)});
// pointcloud.rotateY(${r.y.toFixed(4)});
// pointcloud.rotateZ(${r.z.toFixed(4)});

// pointcloud.scale.set(${s.x.toFixed(4)}, ${s.y.toFixed(4)}, ${s.z.toFixed(4)});`;

    window.exportCode =
`pointcloud.position.set(${p.x.toFixed(4)}, ${p.y.toFixed(4)}, ${p.z.toFixed(4)});

pointcloud.rotation.set(${r.x.toFixed(4)}, ${r.y.toFixed(4)}, ${r.z.toFixed(4)});

pointcloud.scale.set(${s.x.toFixed(4)}, ${s.y.toFixed(4)}, ${s.z.toFixed(4)});`;

updateExportPanel();


    updateExportPanel();
}


let selectedPC;
let selectedID;

function initializeTransformPCSelector() {
    const pcSelect = document.getElementById("pc-select");
    const pcSearch = document.getElementById("pc-search");

    window.pointcloudMap = {}; // store ID → pointcloud reference

    // Fill dropdown
    for (let i = 0; i < viewer.scene.pointclouds.length; i++) {
        const pc = viewer.scene.pointclouds[i];
        const id = `pc_${i}`;
        window.pointcloudMap[id] = pc;

        const opt = document.createElement("option");
        opt.value = id;
        opt.textContent = pc.name || `PointCloud ${i + 1}`;
        pcSelect.appendChild(opt);
    }

    if (window.earth) {
        const id = "earth";
        window.pointcloudMap[id] = window.earth;

        const opt = document.createElement("option");
        opt.value = id;
        opt.textContent = "🌍 Earth";
        pcSelect.appendChild(opt);
    }

    // Filter options
    pcSearch.addEventListener("input", () => {
        const filter = pcSearch.value.toLowerCase();
        for (const option of pcSelect.options) {
            const text = option.textContent.toLowerCase();
            option.style.display = text.includes(filter) ? "" : "none";
        }
    });

    const resetBtn = document.getElementById("reset-transform-btn");
    resetBtn.onclick = () =>{
        resetPCTransform(selectedID);
    }

    const exportBtn = document.getElementById("export-transform-btn");
    exportBtn.onclick = () =>{
        toggleExportPanel();
    }

    const movePCtoProxyBtn = document.getElementById("move-pc-to-proxy-btn");
    movePCtoProxyBtn.onclick = () => {
        movePCtoProxy(selectedPC);
    }

    // When user selects a PC
    pcSelect.addEventListener("change", () => {
        selectedID = pcSelect.value;
        selectedPC = window.pointcloudMap[selectedID];
        window.activeTransformPC = selectedPC;

        if(control) control.detach();

        toggleTransformControls(selectedPC);
        updateTransformPanel(selectedPC);
    });
}

function setCoupledState(isCoupled) {

    // Update UI pill in the panel if it exists
    const pill = document.getElementById("transform-coupled-status");
    if (pill) {
        pill.textContent = isCoupled ? "Coupled" : "Decoupled";
        pill.classList.toggle("coupled", isCoupled);
        pill.classList.toggle("decoupled", !isCoupled);
    }
}


function closeTransformPanel(){
    if(control) control.detach();
    removeAllAxisHelpers()

    if (selectedID !== "earth") {
        viewer.setEDLEnabled(true);
    }
    console.log(pcStartingTransforms);
    pcStartingTransforms = [];
    console.log(pcStartingTransforms);

    const exportPanel = document.getElementById("exportPanel")
    if(exportPanel){
        exportPanel.classList.remove("open");
        setTimeout(() => exportPanel.remove(), 150);
    }

}

function removeAllAxisHelpers(){
    const scene = viewer.scene.scene;

    for(let i = scene.children.length - 1; i >= 0; i --){
        const obj = scene.children[i];

        if(obj instanceof THREE.AxesHelper) scene.remove(obj);
    }
}

window.openTransformPanel = openTransformPanel;
export { openTransformPanel };
