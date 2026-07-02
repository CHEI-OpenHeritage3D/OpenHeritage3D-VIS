import { TransformControls } 
    from 'https://unpkg.com/three@0.118.0/examples/jsm/controls/TransformControls.js';

style.textContent += `
.transform-panel {
    position: absolute;
    top: 80px;
    right: 20px;
    width: 340px;
    background: #1a1b1f;
    border: 1px solid #333;
    border-radius: 8px;
    padding: 12px;
    z-index: 99999;

    opacity: 0;
    transform: translateY(-6px);
    transition: opacity .15s ease, transform .15s ease;
}

.transform-panel.open {
    opacity: 1;
    transform: translateY(0);
}

.transform-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: white;
    margin-bottom: 8px;
}

.transform-title {
    font-size: 16px;
    font-weight: 600;
}

.transform-close {
    cursor: pointer;
    font-size: 20px;
    padding: 2px 6px;
    border-radius: 4px;
    transition: background .15s ease;
}

.transform-close:hover {
    background: rgba(255,255,255,0.15);
}

/* Content layout */

.transform-section {
    margin-top: 6px;
    padding-top: 4px;
    border-top: 1px solid #333;
}

.transform-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 0;
}

.transform-label {
    color: #aaa;
    font-size: 13px;
}

.transform-value {
    color: #f3f3f3;
    font-size: 13px;
    font-family: monospace;
}
.transform-subtitle {
    color: #ddd;
    font-size: 13px;
    margin-bottom: 6px;
    font-weight: 600;
}

.transform-search {
    width: 95%;
    padding: 6px 8px;
    margin-bottom: 6px;
    border-radius: 4px;
    border: 1px solid #333;
    background: #111;
    color: white;
}

.transform-select {
    width: 100%;
    height: 100px;
    background: #111;
    border: 1px solid #333;
    border-radius: 4px;
    color: white;
    margin-bottom: 10px;
    padding: 4px;
    font-size: 13px;
}

.transform-select option {
    padding: 3px 6px;
}
`;
style.textContent += `
.transform-button {
    width: 50%;
    padding: 8px 14px;
    margin-top: 6px;

    background: #333;
    color: white;
    border: none;

    border-radius: 10px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;

    transition: background .15s ease, transform .12s ease;
}

.transform-button:hover {
    background: #444;
}

.transform-button:active {
    transform: scale(0.97);
}
`;

style.textContent += `
.transform-shortcuts {
    margin-top: 4px;
    padding: 8px 10px;
    border-radius: 6px;
    background: #111;
    border: 1px solid #333;
}

.shortcut-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
}

.shortcut-row:last-child {
    margin-bottom: 0;
}

.shortcut-key {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 22px;
    padding: 2px 6px;
    border-radius: 4px;
    background: #333;
    color: #fff;
    font-size: 12px;
    font-family: monospace;
    border: 1px solid #555;
}

.shortcut-desc {
    color: #ccc;
    font-size: 12px;
}
`;

style.textContent += `
.transform-header-right {
    display: flex;
    align-items: center;
    gap: 6px;
}

.coupled-pill {
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 9999px;
    border: 1px solid #4b5563;
    text-transform: uppercase;
    letter-spacing: 0.04em;
}

.coupled-pill.coupled {
    background: rgba(34, 197, 94, 0.18);   /* greenish */
    color: #bbf7d0;
    border-color: #22c55e;
}

.coupled-pill.decoupled {
    background: rgba(148, 163, 184, 0.18);  /* greyish */
    color: #e5e7eb;
    border-color: #6b7280;
}
`;
style.textContent += `
.transform-offset {
    font-size: 11px;
    color: #999;
    margin-left: 4px;
    margin-bottom: 6px;
    font-family: monospace;
}
`;
style.textContent += `
.export-textarea {
    width: 92%;
    height: 125px;
    background: #111;
    color: #eee;
    border: 1px solid #333;
    border-radius: 6px;
    padding: 8px;
    font-size: 12px;
    font-family: monospace;
    resize: none;
}
`;
style.textContent += `
.export-copy-btn {
    width: 100%;
    background: #4f46e5;
    color: white;
    border: none;
    padding: 6px 10px;
    border-radius: 6px;
    cursor: pointer;
    margin-bottom: 8px;
    font-size: 13px;
    font-weight: 500;
    transition: background .15s ease;
}

.export-copy-btn:hover {
    background: #6a62f7;
}

.export-copy-btn.copied {
    background: #22c55e !important;
}
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

    viewer.setEDLEnabled(false);
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

    control.attach(proxy);
    viewer.scene.scene.add(control);

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
    viewer.setEDLEnabled(true);
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
