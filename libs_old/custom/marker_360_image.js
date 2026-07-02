import { Viewer as PhotoSphereViewer } from '@photo-sphere-viewer/core';
import { Vector3 } from 'three';
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

function applyPanoOpacity(viewer) {
    if (!viewer) return;

    const val = Number(opacityEl.value) / 100;
    const mesh = viewer.renderer?.mesh;
    if (!mesh) return;

    const materials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];

    for (const mat of materials) {
        if (!mat) continue;
        mat.transparent = val < 1;
        mat.opacity = val;
        mat.needsUpdate = true;
    }

    viewer.needsUpdate();
}

function _open360(sphereMarker) {
    const marker360 = sphereMarker.userData.marker360;
    if (!marker360 || !marker360.image) return;

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
    opacityEl.max   = '100';
    opacityEl.value = '100';
    opacityEl.style.width = '120px';

    // 1) One function to apply opacity to the current pano mesh
    function applyOpacity(viewer) {
        const val  = Number(opacityEl.value) / 100;
        const mesh = viewer?.renderer?.mesh;
        if (!mesh) return; // mesh not ready yet

        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mat of mats) {
            if (!mat) continue;
            mat.transparent = val < 1;
            mat.opacity     = val;
            mat.needsUpdate = true;
        }
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

    console.log(marker360.image);
    if (!viewer360) {
        viewer360 = new PhotoSphereViewer({
            container: document.getElementById("viewer-360"),
            panorama: marker360.image,
            caption: marker360.name,
            sphereCorrection: {pan: '210deg', tilt: '-15deg', roll: 0},
            navbar: [
                'zoom',
                'move',
                {
                    id: 'psv-opacity',
                    content: opacityEl,
                    title: 'Transparency'
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

        opacityEl.addEventListener('input', () => applyOpacity(viewer360));


        viewer360.addEventListener('ready', () => {
    requestAnimationFrame(() => applyPanoOpacity(viewer360));


        // also re-apply whenever a pano finishes loading (hook ONCE)
    viewer360.addEventListener('ready', () => {
        requestAnimationFrame(() => applyOpacity(viewer360));
    });

    // initial application (first pano)
    applyOpacity(viewer360);
});

    } else {
        viewer360.setPanorama(marker360.image);

        requestAnimationFrame(() => applyPanoOpacity(viewer360));

        viewerPosOffset = {yaw : 0.0, pitch: 0.0};
    }



let viewerPosOffset = { yaw: 0, pitch: 0 };
let psvStartPos = null;
let psvEndPos = null;

viewer360.addEventListener('position-updated', ({ position }) => {
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

    sphereMarker1.visible = true;

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
