  import { Viewer as PhotoSphereViewer } from '@photo-sphere-viewer/core';
  import { Vector3 } from 'three';
  import { CompassPlugin } from '@photo-sphere-viewer/compass-plugin';
  import { AutorotatePlugin } from '@photo-sphere-viewer/autorotate-plugin';
  import { OverlaysPlugin } from '@photo-sphere-viewer/overlays-plugin';
  import { GyroscopePlugin } from '@photo-sphere-viewer/gyroscope-plugin';



  // --- CONFIG ---
  const TRIGGER_RADIUS = 100;                     // meters (tune to your data scale)
  const TRIGGER_DIST_SQ = TRIGGER_RADIUS * TRIGGER_RADIUS;
  const REOPEN_COOLDOWN_MS = 1200;                // avoid immediate retrigger after closing
  const BOUNCE_MARGIN = 1000;

  // --- STATE ---
  let viewer360 = null;
  let pre360View = null;                          // { pos: Vector3, target: Vector3 }
  let reopenBlockUntil = 0;
  let last360Node = null;
  window.viewer360 = viewer360;

  // Make a tiny helper that gets the Potree view target/pivot safely
  function getViewTarget(view) {
    try {
      if (typeof view.getPivot === 'function') return view.getPivot().clone();
      if (typeof view.getFocus === 'function') return view.getFocus().clone();
    } catch {}
    return new Vector3();
  }

  function _open360(node) {
    // const now = performance.now();
    // if (now < reopenBlockUntil) return;           // still in cooldown
    window.in360View = true;

    // Save current Potree view (before moving)
    const pView = viewer.scene.view;
    pre360View = {
      pos: pView.position.clone(),
      target: getViewTarget(pView)
    };

    // Show overlay and init/set PSV
    document.getElementById('photo360').style.display = 'block';
    
    // console.log(node.images60);

    showAnnPanorama(node);
    window.in360View = true;

    last360Node = node || null;
  }
  
//#################### For 360 image loading ########################


  function _close360() {
    document.getElementById('photo360').style.display = 'none';
    window.in360View = false;
    playOn = false;
    bounceBackFromAnn();

    last360Node.coneMarker.visible = true;
    // Start cooldown so proximity check won’t instantly reopen
    reopenBlockUntil = performance.now() + REOPEN_COOLDOWN_MS;

    // Clear state
    pre360View = null;
    last360Node = null;
  }

  
  // Expose to global so inline handlers / other scripts can call these
  window.open360  = _open360;
  window.close360 = _close360;

  // Proximity trigger (call this from your onViewerUpdate hook)
//   Deprecated, switched away from auto trigger
//   window.cameraOpen360 = function () {
//     const now = performance.now();
//     if (window.in360View) return;
//     if (now < reopenBlockUntil) return;
//     console.log('inside cameraOpen360');
//     const cam = viewer.scene.getActiveCamera();
//     if (!cam) return;

//     const camPos = cam.position;

//     // Find first annotation within radius (or find nearest if you prefer)
//     for (const node of (window.cameras_ann_list || [])) {
//       const nodePos = node?.position;
//       if (!nodePos) continue;

//       const d2 = nodePos.distanceToSquared(camPos);
//       if (d2 <= TRIGGER_DIST_SQ) {
//         _open360(node);
//         break; // open once
//       }
//     }
//   };

    window.open360CameraIndex = function (idx){
        const node = window.cameras_ann_list[idx];
        if(window.in360View) close360();
        ann_list_moveto(node.position);
        window.open360(node);
    }

    window.open360CameraObject = function (node){
        if(window.in360View) close360();
        ann_list_moveto(node.position);
        window.open360(node);
    }

    window.open360CameraObjectColocated = function (node){
        if(window.in360View) close360();
        window.open360(node);
    }

  function bounceBackFromAnn() {
    const cam = viewer.scene.getActiveCamera();
    if (!cam) return;

    // Where we were looking / standing when we opened 360
    const camPos = cam.position.clone();

    // If we know the annotation, push away from it
    const nodePos = last360Node?.position?.clone?.();
    if (nodePos && nodePos.isVector3) {
        // direction = from ann to current cam
        let dir = camPos.clone().sub(nodePos);
        if (dir.lengthSq() < 1e-12) dir.set(0, 0, 1); // avoid zero-length
        
        dir.normalize();

        dir = dir.sub(new THREE.Vector3(0, 3, 0));

        const newPos    = nodePos.clone().addScaledVector(dir, TRIGGER_RADIUS + BOUNCE_MARGIN);
        const newTarget = nodePos; // look back at the annotation (or use pre360View.target)

    
        viewer.scene.getActiveCamera().up.set(0, 0, 1);

        moveCameraTo(newPos, newTarget);
        return;
    }

    // Fallback: if no last360Node, nudge backwards along camera look direction
    const fwd = new THREE.Vector3();
    cam.getWorldDirection(fwd); // points forward
    const back = fwd.clone().negate().normalize();

    const nudge = TRIGGER_RADIUS + BOUNCE_MARGIN;
    const newPos = camPos.clone().addScaledVector(back, nudge);
    const newTarget = camPos; // look roughly where we were

    moveCameraTo(newPos, newTarget);

    }


// headingDeg = 0 means "north" (+Y). 90 = east (+X).
function cameraAboveFacing(nodePos, height = 10, headingDeg = 0, lookDistance = 50) {
  const rad = THREE.MathUtils.degToRad(headingDeg);
  
  // compute where "north" lies relative to the point (ground-plane)
  const dir = new THREE.Vector3(Math.sin(rad), Math.cos(rad), 0).normalize();

  // camera position: directly above annotation
  const camPos = nodePos.clone().add(new THREE.Vector3(0, 0, height));

  // target point: some distance away horizontally, same elevation
  const lookAt = camPos.clone().addScaledVector(dir, lookDistance);

  return { camPos, lookAt };
}

window.cameraAboveFacing = cameraAboveFacing;

window.psvDecoupled = false;
window.pitchDecoupleOffset = 0;
window.yawDecoupleOffset = 0;
window.yawStart = 0;
window.yawEnd = 0;
window.pitchStart = 0;
window.pitchEnd = 0;


// helper to build an <img> icon sized for the navbar
function makeIcon(src, alt='') {
  const img = document.createElement('img');
  img.src = src;        // e.g. '/icons/close.svg'
  img.alt = alt;
  img.width = 20;       // PSV buttons are square; 20–24px works well
  img.height = 20;
  img.style.display = 'block';
  return img;
}

// --- singletons at module scope ---
let timestampMenuEl = null;
let timestampInputEl = null;
let timestampKeyHandler = null;
let timestampInputLabelEl = null;
let timestampInputIncrementEl = null;
let timestampInputIncrementLabelEl = null;
let timestampPlayEl = null;
let playOn = false;

// helper: set/replace a query param safely
function setQueryParam(url, key, value) {
  const u = new URL(url, window.location.href);
  u.searchParams.set(key, value);
  return u.toString();
}

    /**
     * Given an annotation with six images, build (or fetch cached) stitched pano
     * and show in PSV. Optionally align initial yaw.
     */
async function showAnnPanorama(node) {
    

    let currentTimestamp = null;

    //move camera
    const nodePos = node.position;

    // camera a few meters above annotation, facing north
    const { camPos, lookAt } = cameraAboveFacing(nodePos, 10, 0, 50);

    // keep upright orientation
    viewer.scene.getActiveCamera().up.set(0, 0, 1);

    // move camera and look level
    moveCameraTo(camPos, lookAt);

    // const { url, panoData } = await buildEquirectBandFromSix(node.images60);

    const ensureTransparent = () => {
      const r = viewer360?.renderer;
      if (!r) return;
      r.setClearColor?.(0x000000, 0);     // fully transparent
      r.setClearAlpha?.(0);
      // belt & suspenders for CSS
      r.domElement && (r.domElement.style.background = 'transparent');
  };

    const closeIconEl     = makeIcon('images/icons/exit-svgrepo-com.svg', 'Close');
    const timestampIconEl = makeIcon('images/icons/time-svgrepo-com.svg', 'Timestamp');

    // build custom elements *before* creating the viewer

    const opacityEl = document.createElement('input');
    opacityEl.type  = 'range';
    opacityEl.min   = '0';
    opacityEl.max   = '100';
    opacityEl.value = '100';
    opacityEl.style.width = '120px';

    // 1) One function to apply opacity to the current pano mesh
    function applyOpacity(viewer, valToApply) {
    
        const val = valToApply ?? (Number(opacityEl.value) / 100);
        const mesh = viewer?.renderer?.mesh;
        if (!mesh) return; // mesh not ready yet

        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mat of mats) {
            if (!mat) continue;
            mat.transparent = val < 1;
            mat.opacity     = val;
            mat.needsUpdate = true;
        }

        viewer._opacity = val;

        viewer.needsUpdate();
    }




    if (!timestampMenuEl) {
        timestampMenuEl = document.createElement('div');
        timestampMenuEl.id = 'timestampMenu';
        timestampMenuEl.style.display = 'none';

        timestampInputLabelEl = document.createElement('label');
        timestampInputLabelEl.innerHTML = "Timestamp: ";

        timestampInputEl = document.createElement('input');

        timestampInputIncrementLabelEl = document.createElement('label');
        timestampInputIncrementLabelEl.innerHTML = "+/-: ";
        timestampInputIncrementEl = document.createElement('input');

        timestampPlayEl = document.createElement('button');
        timestampPlayEl.innerHTML = "▶︎";

        timestampMenuEl.appendChild(document.createElement('center'));
        timestampMenuEl.appendChild(timestampInputLabelEl);
        timestampMenuEl.appendChild(timestampInputEl);
        timestampMenuEl.appendChild(document.createElement('br'));
        timestampMenuEl.appendChild(timestampInputIncrementLabelEl);
        timestampMenuEl.appendChild(timestampInputIncrementEl);
        timestampMenuEl.appendChild(timestampPlayEl);
    }

    const viewerContainer = document.querySelector('#viewer-360');
    if (!timestampMenuEl.isConnected) viewerContainer.appendChild(timestampMenuEl);

  if (!viewer360) {
    viewer360 = new PhotoSphereViewer({
      container: document.querySelector('#viewer-360'),
      panorama: viaProxy(node.url),
      sphereCorrection: {pan: '210deg', tilt: 0, roll: 0},
      caption: getCaption(node),
    // caption: node.name,
      navbar: [
        'zoom',
        'move',
        'download',
        { id: 'psv-opacity', content: opacityEl, title: 'Transparency' },
        {
          id: 'psv-timestamp-button',
          content: timestampIconEl,
          title: 'Enter Timestamp',
          onClick() {
            // toggle the SINGLETON menu
            timestampMenuEl.style.display =
              (timestampMenuEl.style.display === 'none') ? 'block' : 'none';
            // focus input when opening
            if (timestampMenuEl.style.display === 'block') {
              setTimeout(() => timestampInputEl.focus(), 0);
            }
          }
        },
        'caption',
        'gyroscope',
        { id: 'psv-close360',   content: closeIconEl,   title: 'Close', onClick(viewer) { close360(); } },
        'fullscreen',
      ],
      plugins: [
        CompassPlugin.withConfig({
          // size: '200px',
          // position: 'top center'
        }),
        AutorotatePlugin.withConfig({
            autostartOnIdle: false,
            autostartDelay: 1000000,
        }),
        GyroscopePlugin,
    ],
      rendererParameters: {
        alpha: true,
        antialias: true,
        premultipliedAlpha: false   // <— important
      },
      canvasBackground: 'transparent',
    });

    viewer360._base360 = node.url;

    // 2) Hook once at init
    opacityEl.addEventListener('input', () => applyOpacity(viewer360));

    // also re-apply whenever a pano finishes loading (hook ONCE)
    viewer360.addEventListener('ready', () => {
      requestAnimationFrame(() => applyOpacity(viewer360, viewer360._opacity));
    });

    // initial application (first pano)
    // applyOpacity(viewer360);

    viewer360._currentAnn = node;

  } 
else {
// when changing the image
    viewer360._base360 = node.url; // update base
    
    const cacheBusted = setQueryParam(viewer360._base360, 'v', Date.now());

    if(timestampInputEl.value){
        await changeImgTimestamp();
        await viewer360.setOptions({
            caption: getCaption(node),
            sphereCorrection: { pan: '210deg', tilt: 0, roll: 0 },
            transition: { effect: 'black', speed: 0, rotation: false },
            showLoader: true
        });
        viewer360._currentAnn = node;
    }
    else{
        await viewer360.setPanorama(viaProxy(cacheBusted), {
            caption: getCaption(node),
            sphereCorrection: { pan: '210deg', tilt: 0, roll: 0 },
            transition: { effect: 'black', speed: 0, rotation: false },
            showLoader: true
        });
        viewer360._currentAnn = node;
    }

    applyOpacity(viewer360, viewer360._opacity);
    console.log(viewer360);

    viewerPosOffset = {yaw : 0.0, pitch: 0.0};


  }

  async function changeImgTimestamp(){
    if(currentTimestamp == null) currentTimestamp = Date.now();

    const raw = timestampInputEl.value.trim();
    const parsed_time = parse_time(raw, currentTimestamp); // seconds!
    currentTimestamp = parsed_time;
    
    if (!parsed_time || typeof parsed_time !== 'number') {
      alert('Invalid Date input');
      return;
    }

    const base = viewer360._base360 || node.url;
    const withTs = setQueryParam(base, 'timestamp', parsed_time);
    const finalUrl = setQueryParam(withTs, 'v', Date.now()); // optional cache-bust
    console.log(finalUrl);
    await viewer360.setPanorama(viaProxy(finalUrl), {
      sphereCorrection: { pan: '210deg', tilt: 0, roll: 0 },
      transition: { effect: 'black', speed: 0, rotation: false },
      showLoader: false
    });

    applyOpacity(viewer360, viewer360._opacity);
    // keep base as the URL *without* cache-buster; keep timestamp if you want it sticky
    viewer360._base360 = withTs;

  }

    //timestamp control
  if (timestampKeyHandler) {
    timestampInputEl.removeEventListener('keydown', timestampKeyHandler);
  }

  timestampKeyHandler = async (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();

    changeImgTimestamp();
  };

  timestampInputEl.addEventListener('keydown', timestampKeyHandler);

  timestampPlayEl.onclick = async function (){

    // Toggle play/pause
    if (playOn) {
        playOn = false;
        timestampPlayEl.innerHTML = "▶︎";  // show play symbol
        return;
    }

    playOn = true;  

    const incdec = timestampInputIncrementEl.value.trim();
    const startTimestamp = timestampInputEl.value.trim();


    if(currentTimestamp == null) currentTimestamp = Date.now();

    currentTimestamp = parse_time(startTimestamp, currentTimestamp);

    const now = parse_time("today", Date.now());

    if (!currentTimestamp || typeof currentTimestamp !== 'number' || !incdec) {
      alert('Invalid Date input');
      return;
    }

    
    timestampPlayEl.innerHTML = "❚❚";

    while(currentTimestamp <= now && playOn){
        const base = viewer360._base360 || node.url;
        const withTs = setQueryParam(base, 'timestamp', currentTimestamp);
        const finalUrl = setQueryParam(withTs, 'v', Date.now()); // optional cache-bust

        await viewer360.setPanorama(viaProxy(finalUrl), {
        sphereCorrection: { pan: '210deg', tilt: 0, roll: 0 },
        transition: { effect: 'black', speed: 0, rotation: false },
        showLoader: false
        });
        applyOpacity(viewer360, viewer360._opacity);
        // keep base as the URL *without* cache-buster; keep timestamp if you want it sticky
        viewer360._base360 = withTs;

        currentTimestamp = parse_time(incdec, currentTimestamp);
        if(!currentTimestamp){
          alert('Invalid Date input');
          playOn = false;
          timestampPlayEl.innerHTML = "▶︎";
          break;
        }
    }

    playOn = false;
    timestampPlayEl.innerHTML = "▶︎";
  };




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

    //commented out for now


  function getColocatedCamera(node) {
      const nodes = node.coneMarker._sensorNodes; // exactly 2 nodes
      return nodes.find(n => n !== node) || null;
  }



  function getCaption(node) {
      const colocated = getColocatedCamera(node);

      console.log(node, colocated);
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

        const divider = `<span style="margin: 0 6px; color: #888;">|</span>`;
        let colocatedCam = ``;
      if (colocated) {
        colocatedCam = `
          <button
            style="
              font-family: inherit;
              font-size: 13px;
              padding: 3px 10px;
              background: linear-gradient(180deg, #3a3a3a, #2a2a2a);
              color: #eee;
              border: 1px solid #555;
              border-radius: 5px;
              cursor: pointer;
              transition: all 0.15s ease;
            "
            onmouseover="this.style.background='linear-gradient(180deg,#4a4a4a,#333)'; this.style.color='#fff';"
            onmouseout="this.style.background='linear-gradient(180deg,#3a3a3a,#2a2a2a)'; this.style.color='#eee';"
            onclick="window.onSensorNodeClick(window.sensorNodes.find(c => c.id === '${colocated.id}'))"
          >
            Switch to ${colocated.name}
          </button>
        `;
      }

      if(colocated){
        if(node.name.toLowerCase() < colocated.name.toLowerCase()){
            html += currentCam + divider + colocatedCam;
        }
        else{
            html += colocatedCam + divider + currentCam;
        }
      }
      else html += currentCam;


      html += `</div>`;
      return html;
    }
}

function viaProxy(url){
  return 'ac-proxy.php?url=' + encodeURIComponent(url);
}