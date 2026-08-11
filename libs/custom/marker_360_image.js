import { Viewer as PhotoSphereViewer, EquirectangularAdapter } from '@photo-sphere-viewer/core';
import { EquirectangularTilesAdapter } from '@photo-sphere-viewer/equirectangular-tiles-adapter';

// import { Vector3 } from 'three';
import { GyroscopePlugin } from '@photo-sphere-viewer/gyroscope-plugin';

// --- STATE ---
let viewer360 = null;
let pre360View = null;                          // { pos: Vector3, target: Vector3 }
let reopenBlockUntil = 0;
window.viewer360 = viewer360;

let sphereMarker1 = null;

function getViewTarget(view) {
    try {
        if (typeof view.getPivot === 'function') return view.getPivot().clone();
        if (typeof view.getFocus === 'function') return view.getFocus().clone();
    } catch {}
    return new Vector3();
}


// deprecated
// function applyPanoOpacity(viewer) {
//     if (!viewer) return;

//     const val = Number(opacityEl.value) / 100;
//     const root = viewer.renderer?.mesh;
//     if (!mesh) return;


//     const materials = Array.isArray(mesh.material)
//         ? mesh.material
//         : [mesh.material];

//     for (const mat of materials) {
//         if (!mat) continue;
//         mat.transparent = val < 1;
//         mat.opacity = val;
//         mat.needsUpdate = true;
//     }

//     viewer.needsUpdate();
// }

function _open360(sphereMarker) {
    const marker360 = sphereMarker.userData.marker360;
    if (!marker360 || !marker360.image) return;

    // Track which marker is being viewed so UIs (zone search) can highlight it.
    window.viewing360Marker = marker360;
    document.dispatchEvent(new CustomEvent("viewing-360-changed"));

    if(sphereMarker1 && !sphereMarker1.visible && !window.imageMarkersGloballyHidden) sphereMarker1.visible = true;

    sphereMarker1 = sphereMarker;

    sphereMarker.visible = false;

    // Save current Potree view (optional, for restore later)
    const pView = viewer.scene.view;
    pre360View = {
        pos: pView.position.clone(),
        target: pView.getPivot().clone()
    };

    const ensureTransparent = () => {
    const r = viewer360?.renderer;
    if (!r) return;
    r.setClearColor?.(0x000000, 0);     // fully transparent
    r.setClearAlpha?.(0);
    // belt & suspenders for CSS
    r.domElement && (r.domElement.style.background = 'transparent');
  };

// --- Opacity UI (singleton) ---
    const opacityEl = document.createElement('input');
    opacityEl.type  = 'range';
    opacityEl.min   = '0';
    opacityEl.max   = '99.5';
    opacityEl.value = '100';
    opacityEl.style.width = '120px';

    // 1) One function to apply opacity to the current pano mesh
    function applyOpacity(viewer, valToApply) {
        // console.log(viewer);
        if(!opacityEl) return;
        if(!viewer) return;

        const val = (Number(opacityEl.value) / 100) || valToApply;
        const meshes = viewer.renderer?.mesh.children;
        if (!meshes) return; // mesh not ready yet

        let baseMesh, tilesMesh;

        meshes.forEach(mesh => {
            if(Array.isArray(mesh.material)) tilesMesh = mesh;
            else baseMesh = mesh;
        });
        
        if(!viewer360._hasTiles){   // no tiles
            
            const mat = baseMesh.material;
            mat.transparent = val < 1;
            mat.opacity = val;
            mat.depthWrite = val === 1;
            mat.needsUpdate = true;


            const mats = tilesMesh.material;
            for (const mat of mats) {
                // console.log(mat);
                if (!mat) continue;
                mat.transparent = val < 1;
                mat.opacity = 0;
                mat.depthWrite = val === 1;
                mat.needsUpdate = true;
            }

        }
        else {
            // console.log('editing tiles');
            const baseMat = baseMesh.material;
            baseMat.opacity = 0;

            const mats = tilesMesh.material;
            // console.log(mats)
            for (const mat of mats) {
                if (!mat) continue;
                if(!mat.map){
                    mat.opacity = 0;
                    continue;
                }
                mat.transparent = val < 1;
                mat.opacity = val;
                mat.depthWrite = val === 1;
                mat.needsUpdate = true;
                baseMat.opacity = 0;
            }
        }
        viewer._opacity = val;

        viewer.needsUpdate();
    }


    // --- MOVE CAMERA TO MARKER ---
    const { camPos, lookAt } = cameraAtMarker(marker360.position);

    // Keep Z-up orientation
    viewer.scene.getActiveCamera().up.set(0, 0, 1);

    // Smooth move
    moveCameraTo(camPos, lookAt);

    // --- OPEN 360 VIEW ---
    window.in360View = true;
    document.getElementById("photo360").style.display = "block";
    
    if (!viewer360) {

        viewer360 = new PhotoSphereViewer({
            container: document.getElementById("viewer-360"),
            adapter: [
                EquirectangularTilesAdapter,
                {
                    baseBlur: false,
                    showErrorTile: false,
                    antialias: false,
                }
            ],
            panorama: {
                width: 2000000,
                cols: 16,
                rows: 8,
                baseUrl: (marker360.tiles) ? null : marker360.image,
                tileUrl: (col, row) => {
                    if(!marker360.tiles) return;
                    const url = marker360.tiles + `-${col}-${row}.png`;
                    return url;
                }
            },
            caption: getCaption(marker360),
            sphereCorrection: {
                pan: `${marker360.sphereCorrection.pan}deg`,
                tilt: `${marker360.sphereCorrection.tilt}deg`,
                roll: `${marker360.sphereCorrection.roll}deg`
            },
            navbar: [
                'zoom',
                'move',
                {
                    id: 'psv-opacity',
                    content: opacityEl,
                    title: 'Transparency'
                },
                {

                },
                'caption',
                'gyroscope',
                'fullscreen',
                {
                    id: 'close-360',
                    title: 'Close',
                    content: '✕',
                    onClick: close360
                }
            ],

            plugins: [
                GyroscopePlugin
            ],
            rendererParameters: {
                alpha: true,
                antialias: true,
                premultipliedAlpha: false   // <— important
            },
            canvasBackground: 'transparent',
        });

        viewer360._hasTiles = Boolean(marker360.tiles && marker360.tiles !== "");


        // 2) Hook once at init
        opacityEl.addEventListener('input', () => applyOpacity(viewer360, viewer360._opacity));

        // also re-apply whenever a pano finishes loading (hook ONCE)
        viewer360.addEventListener('ready', () => {
            viewer360.renderer.renderer.setClearColor(0x000000, 0);
        requestAnimationFrame(() => applyOpacity(viewer360, viewer360._opacity));
        });

        console.log(viewer360);

    //     opacityEl.addEventListener('input', () => applyOpacity(viewer360));


    //     viewer360.addEventListener('ready', () => {
    // requestAnimationFrame(() => applyPanoOpacity(viewer360));


    //     // also re-apply whenever a pano finishes loading (hook ONCE)
    // viewer360.addEventListener('ready', () => {
    //     requestAnimationFrame(() => applyOpacity(viewer360));
    // });

    // // initial application (first pano)
    // applyOpacity(viewer360);
    //     });

    } else {
        // viewer360.setPanorama(marker360.image).then(() => {
        viewer360.setPanorama({
                width: 2000000,
                cols: 16,
                rows: 8,
                baseUrl: (marker360.tiles) ? null : marker360.image,
                tileUrl: (col, row) => {
                    if(!marker360.tiles) return;
                    const url = marker360.tiles + `-${col}-${row}.png`;
                    return url;
                }
            }
        ).then(() => {
            

            viewer360.setOptions(
                {
                    'sphereCorrection': {
                    pan: `${marker360.sphereCorrection.pan}deg`,
                    tilt: `${marker360.sphereCorrection.tilt}deg`,
                    roll: `${marker360.sphereCorrection.roll}deg`
                },
                'caption': getCaption(marker360)   
        });
        
        viewer360._hasTiles = Boolean(marker360.tiles && marker360.tiles !== "");
        applyOpacity(viewer360, viewer360._opacity);
        });

        // console.log('correction to apply: ', marker360.sphereCorrection.pan + 'deg');
        
        // console.log(viewer360);



        // applyOpacity(viewer360, viewer360._opacity);

        requestAnimationFrame(() => {
            applyOpacity(viewer360, viewer360._opacity);
        });


        if(viewerPosOffset) viewerPosOffset = {yaw : 0.0, pitch: 0.0};
    }

    window.viewer360 = viewer360;



let viewerPosOffset = { yaw: 0, pitch: 0 };
let psvStartPos = null;
let psvEndPos = null;

viewer360.addEventListener('position-updated', ({ position }) => {
    if(viewer360._hasTiles) applyOpacity(viewer360, viewer360._opacity);
    if (window.in360View) movePSVPotreeCam(position);
});

function movePSVPotreeCam(position) {
    if (window.psvDecoupled) return;

    const baseYaw = -position.yaw;
    const basePitch = position.pitch;

    viewer.scene.view.yaw = baseYaw + (viewerPosOffset?.yaw || 0);
    viewer.scene.view.pitch = basePitch - (viewerPosOffset?.pitch || 0);
    viewer.scene.view.roll = position.roll;
}

// When Control is pressed: start decoupling mode
document.addEventListener('keydown', (e) => {
    if (e.key === 'Control' && !window.psvDecoupled) {
        window.psvDecoupled = true;
        // Save the starting PSV position
        psvStartPos = viewer360.getPosition(); // {yaw, pitch}
        console.log('Decouple start', psvStartPos);
    }
});

// When Control is released: compute new offset and re-couple
document.addEventListener('keyup', (e) => {
    if (e.key === 'Control' && window.psvDecoupled) {
        psvEndPos = viewer360.getPosition(); // {yaw, pitch}
        console.log('Decouple end', psvEndPos);

        // Compute the delta between the two cameras
        viewerPosOffset = {
            yaw: (viewerPosOffset?.yaw || 0) + (psvEndPos.yaw - psvStartPos.yaw),
            pitch: (viewerPosOffset?.pitch || 0) + (psvEndPos.pitch - psvStartPos.pitch),
        };

        console.log('Updated offset', viewerPosOffset);
        window.psvDecoupled = false;
    }
});


}
window.open360 = _open360;

function close360() {
    document.getElementById("photo360").style.display = "none";
    window.in360View = false;

    window.viewing360Marker = null;
    document.dispatchEvent(new CustomEvent("viewing-360-changed"));

    // Re-show the sphere hidden on open — unless the global image-marker
    // toggle went off in the meantime (a 360 can be opened from the zone
    // search list even while markers are masked).
    const mk360 = sphereMarker1 && sphereMarker1.userData && sphereMarker1.userData.marker360;
    sphereMarker1.visible = !window.imageMarkersGloballyHidden;
    if (window.imageMarkersGloballyHidden && mk360 && mk360._hitMesh) {
        mk360._hitMesh.raycast = () => {};
    }

    // Restore Potree camera
    if (pre360View) {
        moveCameraTo(pre360View.pos, pre360View.target);
        pre360View = null;
    }

}
window.close360 = close360;


function cameraAtMarker(markerPos, height = 2, lookDistance = 10) {
    const nodePos = new THREE.Vector3(...markerPos);

    // Camera slightly above marker
    const camPos = nodePos.clone().add(new THREE.Vector3(0, 0, height));

    // Look forward along +Y by default (north-ish)
    const lookDir = new THREE.Vector3(0, 1, 0);
    const lookAt = camPos.clone().addScaledVector(lookDir, lookDistance);

    return { camPos, lookAt };
}


  function getCaption(node) {

    console.log(node);

      // Create a dark, consistent style matching the PSV UI
      let html = `
        <div style="
          font-family: 'Inter', 'Segoe UI', sans-serif;
          color: #ddd;
          text-align: center;
          background: rgba(20, 20, 20, 0.3);
          padding: 6px 12px;
          border-radius: 6px;
          display: inline-block;
          backdrop-filter: blur(4px);
        ">`;

        const currentCam = `
          <span style="font-weight: 600; color: #f1f1f1;">
            ${node.name}
          </span>`;
        
          html += currentCam;


      html += `</div>`;
      return html;
    }
