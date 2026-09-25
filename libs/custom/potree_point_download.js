/**
 * download_module.js
 *
 * Author: Aviral Agarwal (CHEI / OpenHeritage3D)
 * Lead Developer, Cultural Heritage Engineering Initiative (UC San Diego)
 *
 * Description:
 *   Tiled in-browser download of points within selected clipping volumes
 *   from Potree-based viewers. Splits the user's selection into a grid of
 *   smaller LAS tiles to handle very large point clouds without exhausting
 *   memory. Uses the File System Access API when available so all tiles
 *   land in a single user-chosen folder; otherwise falls back to staggered
 *   individual downloads.
 *
 *   A "Level of Detail" slider lets the user cap octree traversal depth.
 *   Lower depths produce smaller, faster, lower-resolution downloads.
 *
 * Usage:
 *   1. Add <div id="download-function"></div> in your HTML.
 *   2. Include this file after Potree and viewer initialization:
 *        <script src="download_module.js"></script>
 *   3. Call openDownloadPanel() from your viewer UI (e.g. a toolbar button).
 *
 * Dependencies:
 *   - Potree (viewer.scene, LASExporter, Points)
 *   - Three.js (THREE.Box3, THREE.Vector3, etc.)
 *   - Use potree.js with the 64-bit position array fix.
 */

/* =====================================================================
   STYLES
   ===================================================================== */

style.textContent += `
/* ---------- Glassmorphic Download Panel ---------- */

.download-panel {
    position: absolute;
    top: 80px;
    right: 10px;

    width: clamp(300px, 30vw, 420px);
    padding: 16px 18px;

    background: rgba(20, 20, 26, 0.55);
    backdrop-filter: blur(12px) saturate(140%);
    -webkit-backdrop-filter: blur(12px) saturate(140%);

    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 12px;
    box-shadow: 0 0 28px rgba(0,0,0,0.55);

    z-index: 99999;

    opacity: 0;
    transform: translateY(-6px);
    transition: opacity .25s ease, transform .25s ease;
}
.download-panel.open { opacity: 1; transform: translateY(0); }

.download-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: #f1f1f1;
    margin-bottom: 12px;
    text-shadow: 0 0 6px rgba(0,0,0,0.6);
}
.download-title    { font-size: 18px; font-weight: 600; }
.download-subtitle {
    font-size: 12px;
    color: #b6b6c0;
    margin: -6px 0 12px;
    line-height: 1.4;
}
.download-close {
    cursor: pointer;
    font-size: 22px;
    padding: 2px 8px;
    border-radius: 6px;
    transition: background .15s ease;
}
.download-close:hover { background: rgba(255,255,255,0.15); }

/* ---------- Buttons ---------- */

.dl-btn {
    width: 100%;
    padding: 10px 14px;
    margin-bottom: 8px;

    border: none;
    border-radius: 8px;

    font-weight: 100;
    cursor: pointer;
    color: white;
    transition: background .2s ease, box-shadow .2s ease, opacity .15s ease;
}
.dl-btn:disabled { opacity: 0.45; cursor: not-allowed; }

.dl-btn-volume   { background: rgba(45, 160, 80, 0.85); }
.dl-btn-volume:hover:not(:disabled) {
    background: rgba(55, 180, 95, 1);
    box-shadow: 0 0 12px rgba(55, 180, 95, 0.45);
}

.dl-btn-primary  { background: rgba(79, 70, 229, 0.85); }
.dl-btn-primary:hover:not(:disabled) {
    background: rgba(99, 90, 245, 1);
    box-shadow: 0 0 12px rgba(99, 90, 245, 0.45);
}

.dl-btn-cancel {
    background: rgba(255,255,255,0.12);
    margin-top: 6px;
    margin-bottom: 0;
    font-size: 13px;
    padding: 7px 10px;
}
.dl-btn-cancel:hover:not(:disabled) {
    background: rgba(255, 90, 90, 0.55);
    box-shadow: 0 0 10px rgba(255, 90, 90, 0.35);
}

/* ---------- Detail slider ---------- */

.dl-slider-wrap {
    margin: 4px 0 10px;
    padding: 10px 0;
    border-top: 1px solid rgba(255,255,255,0.08);
    border-bottom: 1px solid rgba(255,255,255,0.08);
}
.dl-slider-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    color: #d4d4d4;
    font-size: 13px;
    margin-bottom: 8px;
}
.dl-slider-label  { font-weight: 500; }
.dl-slider-value  {
    font-family: ui-monospace, "SF Mono", Menlo, monospace;
    color: rgba(180, 175, 255, 0.95);
}

.dl-slider {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 6px;
    background: rgba(255,255,255,0.1);
    border-radius: 3px;
    outline: none;
    cursor: pointer;
}
.dl-slider:disabled { opacity: 0.45; cursor: not-allowed; }

.dl-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: rgba(99, 90, 245, 1);
    border: 2px solid rgba(255,255,255,0.25);
    box-shadow: 0 0 8px rgba(99, 90, 245, 0.45);
    transition: transform .1s ease;
}
.dl-slider:not(:disabled)::-webkit-slider-thumb:hover { transform: scale(1.15); }

.dl-slider::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: rgba(99, 90, 245, 1);
    border: 2px solid rgba(255,255,255,0.25);
    box-shadow: 0 0 8px rgba(99, 90, 245, 0.45);
}

.dl-slider-hint {
    color: #a0a0aa;
    font-size: 11px;
    margin-top: 6px;
    line-height: 1.3;
}

/* ---------- Progress ---------- */

.dl-progress-wrap { margin-top: 10px; }

.dl-progress {
    width: 100%;
    height: 10px;
    background: rgba(255,255,255,0.1);
    border-radius: 6px;
    overflow: hidden;
    margin-bottom: 6px;
}
.dl-progress .dl-bar {
    width: 0%;
    height: 100%;
    background: rgba(99, 90, 245, 1);
    transition: width .25s ease;
}

.dl-status {
    color: #d4d4d4;
    font-size: 13px;
    text-shadow: 0 0 4px rgba(0,0,0,0.6);
    line-height: 1.4;
    min-height: 1.4em;
}
.dl-status.error    { color: #ff8b8b; }
.dl-status.success  { color: #8effb1; }

/* ---------- License modal ---------- */

.license-overlay {
    position: fixed; left: 0; top: 0;
    width: 100%; height: 100%;
    background: rgba(0,0,0,0.55);
    backdrop-filter: blur(10px);
    display: flex; align-items: center; justify-content: center;
    z-index: 99999;
    opacity: 0; transform: translateY(-6px);
    transition: opacity .25s ease, transform .25s ease;
}
.license-overlay.open { opacity: 1; transform: translateY(0); }

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
.license-title {
    font-size: 20px; font-weight: 200;
    margin-bottom: 12px;
    text-shadow: 0 0 6px rgba(0,0,0,0.5);
}
.license-text {
    font-size: 15px;
    margin-bottom: 10px;
    color: #e5e5e5;
    line-height: 1.45;
}
.license-checkbox {
    display: flex; align-items: center; gap: 10px;
    margin-top: 12px;
    font-size: 15px;
}
.license-checkbox input { width: 18px; height: 18px; accent-color: #665eff; }

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
.btn-license[disabled] { opacity: 0.45; cursor: not-allowed; }
.btn-license.cancel { background: rgba(255,255,255,0.15); color: #eee; }
.btn-license.cancel:hover { background: rgba(255,255,255,0.25); }

.license-citation {
    font-size: 13.5px;
    line-height: 1.5;
    color: #e5e5e5;
    background: rgba(255,255,255,0.06);
    border-left: 3px solid rgba(99, 90, 245, 0.75);
    padding: 10px 12px;
    margin: 4px 0 12px;
    border-radius: 4px 8px 8px 4px;
    word-break: break-word;
}

.license-text a {
    color: rgba(160, 150, 255, 0.95);
    text-decoration: underline;
    text-decoration-color: rgba(160, 150, 255, 0.4);
    text-underline-offset: 2px;
    transition: color .15s ease, text-decoration-color .15s ease;
}
.license-text a:hover {
    color: rgba(190, 180, 255, 1);
    text-decoration-color: rgba(190, 180, 255, 0.8);
}
.license-text a:visited {
    color: rgba(160, 150, 255, 0.95);
}
`;

/* =====================================================================
   MODULE STATE
   ===================================================================== */

window.acceptedTerms = false;

// Single source of truth for an active download. Keeps UI in sync.
const DownloadState = {
    active: false,
    cancelled: false,
    completedTiles: 0,
    totalTiles: 0,
    totalPoints: 0,
    filesWritten: 0,
};

function resetDownloadState() {
    DownloadState.active = false;
    DownloadState.cancelled = false;
    DownloadState.completedTiles = 0;
    DownloadState.totalTiles = 0;
    DownloadState.totalPoints = 0;
    DownloadState.filesWritten = 0;
}

/* =====================================================================
   PANEL OPEN / CLOSE
   ===================================================================== */

function openDownloadPanel() {
    const existing = document.getElementById("downloadPanel");

    if (!window.acceptedTerms) {
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
            <span class="download-close" title="Close">&times;</span>
        </div>
        <div class="download-subtitle">
            Selections are split into a grid of LAS tiles for memory safety.
        </div>
        <div id="download-function"></div>
    `;

    document.body.appendChild(panel);

    panel.querySelector(".download-close").onclick = () => {
        if (DownloadState.active) {
            // Don't let the panel close mid-download silently.
            if (!confirm("A download is in progress. Cancel it and close?")) return;
            DownloadState.cancelled = true;
        }
        panel.classList.remove("open");
        setTimeout(() => panel.remove(), 150);
    };

    panel.classList.add("open");
    initializeDownloadUI();
}

async function openLicenseForm() {
    const overlay = document.createElement("div");
    overlay.className = "license-overlay";

    // Fetch metadata; tolerate either an array or a fallback string.
    let license = null;
    try {
        license = await fetchProjectCitationLicense(window.doi);
    } catch (e) {
        console.warn("fetchProjectLicense failed:", e);
    }

    const citation    = (license && license.citation)    || "the project citation";
    const licenseName = (license && license.licenseName) || "the project license";
    const licenseUrl  = (license && license.licenseUrl)  || "#";
    window.projectCitation = citation;

    const box = document.createElement("div");
    box.className = "license-box";
    box.innerHTML = `
        <div class="license-title">Terms and Conditions</div>

        <div class="license-text">
            Users must agree to the dataset's terms and conditions before
            using the download tool.
        </div>
        <div class="license-text">
            This data is licensed under the
            <a href="${licenseUrl}" target="_blank" rel="noopener">${licenseName}</a>
            license. Please take note of the license terms.
        </div>
        <div class="license-text">
            Please include the following citation when referencing this dataset:
        </div>
        <div class="license-citation">${window.projectCitation}</div>
        <div class="license-text">
            This is a test feature. Very large selections may be slow,
            and data shown in the 3D viewer may differ from the raw
            download.
        </div>

        <label class="license-checkbox">
            <input type="checkbox" id="tosCheck">
            I agree to the terms of this license
        </label>

        <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:14px;">
            <button class="btn-license cancel" id="cancelBtn">Cancel</button>
            <button class="btn-license" id="downloadBtn" disabled>Accept</button>
        </div>
    `;

    overlay.appendChild(box);
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("open"));

    const checkbox     = box.querySelector("#tosCheck");
    const acceptBtn    = box.querySelector("#downloadBtn");
    const cancelBtn    = box.querySelector("#cancelBtn");

    checkbox.addEventListener("change", () => {
        acceptBtn.disabled = !checkbox.checked;
    });

    const close = () => {
        overlay.classList.remove("open");
        setTimeout(() => overlay.remove(), 150);
    };

    acceptBtn.onclick = () => {
        window.acceptedTerms = checkbox.checked;
        close();
        if (window.acceptedTerms) openDownloadPanel();
    };
    cancelBtn.onclick = close;
}


/**
 * Level-of-detail hint under the depth slider.
 *
 * This deliberately reports no point count. A count can't be derived here:
 * the octree metadata gives a total for the whole cloud only, and per-node
 * counts exist solely for the hierarchy pages the browser has already
 * fetched — at load time that's levels 0..hierarchy.stepSize (4 for our
 * datasets, out of a depth of 12-14). The point totals for the deeper
 * levels an export actually walks, and for the parts of the cloud inside a
 * selection volume, are unknown until the export loads them. The status
 * line reports the real running count while tiles are written.
 *
 * What the metadata does state exactly is the spacing each level samples
 * at: level L has spacing = rootSpacing / 2^L, which is how Potree builds
 * the octree in the first place. That is what the slider actually controls,
 * so that is what we show.
 */
function updateDepthHint(depth) {
    const hint = document.getElementById("dl-depth-hint");
    if (!hint) return;

    const d = parseInt(depth, 10);
    const visiblePCs = viewer.scene.pointclouds.filter(p => p.visible);
    if (visiblePCs.length === 0) {
        hint.textContent = "No visible point clouds.";
        return;
    }

    // Spacing at the chosen level, per cloud, in world units. Each cloud has
    // its own root spacing and its own depth, so a shared slider value can
    // mean different things in different clouds — show the range if so.
    let minSpacing = Infinity, maxSpacing = -Infinity;
    let coarsest = 1;          // largest 2^(cloudDepth - d) across clouds
    let anyClamped = false;    // slider is at/past some cloud's own depth

    for (const pc of visiblePCs) {
        pc.updateMatrixWorld(true);
        const worldScale = new THREE.Vector3().setFromMatrixScale(pc.matrixWorld);
        const unit = Math.max(worldScale.x, worldScale.y, worldScale.z) || 1;

        const rootSpacing = pc.pcoGeometry?.spacing;
        if (!Number.isFinite(rootSpacing) || rootSpacing <= 0) continue;

        const cloudDepth = getMaxDepth(pc);
        const level = cloudDepth != null ? Math.min(d, cloudDepth) : d;
        if (cloudDepth != null && d >= cloudDepth) anyClamped = true;

        const spacing = (rootSpacing * unit) / Math.pow(2, level);
        minSpacing = Math.min(minSpacing, spacing);
        maxSpacing = Math.max(maxSpacing, spacing);

        if (cloudDepth != null) {
            coarsest = Math.max(coarsest, Math.pow(2, Math.max(0, cloudDepth - d)));
        }
    }

    if (!Number.isFinite(minSpacing)) {
        hint.textContent = "Level of detail " + d + ".";
        return;
    }

    const spacingStr = (fmtSpacing(minSpacing) === fmtSpacing(maxSpacing))
        ? fmtSpacing(minSpacing)
        : `${fmtSpacing(minSpacing)}–${fmtSpacing(maxSpacing)}`;

    const detail = anyClamped && coarsest === 1
        ? "full detail"
        : `${coarsest}× coarser than full detail`;

    const volumes = viewer.scene.volumes.filter(v => v instanceof Potree.BoxVolume);
    const scope = volumes.length > 0
        ? `${volumes.length} volume${volumes.length > 1 ? "s" : ""} selected`
        : "no volume selected — whole scene";

    hint.innerHTML =
        `Samples at <strong style="color:#c4c0ff">${spacingStr}</strong> point spacing ` +
        `&nbsp;·&nbsp; <span style="color:#888">${detail}</span><br>` +
        `<span style="color:#666; font-size:10px;">${scope}. ` +
        `Point count is only known once the export runs.</span>`;
}

// Distance in world units (metres for our datasets), ~3 significant digits.
function fmtSpacing(m) {
    if (!Number.isFinite(m) || m <= 0) return "?";
    if (m < 0.001) return (m * 1000).toFixed(2) + " mm";
    if (m < 0.01)  return (m * 1000).toFixed(1) + " mm";
    if (m < 1)     return (m * 100).toFixed(1)  + " cm";
    return m.toFixed(2) + " m";
}

/* =====================================================================
   UI INITIALIZATION
   ===================================================================== */

function initializeDownloadUI() {
    const root = document.getElementById("download-function");
    if (!root) return;

    // Snapshot scene depth at panel-open time. If clouds load later or the
    // scene changes, the user can close+reopen to refresh the slider range.
    const sceneMaxDepth = getMaxDepthFromScene();

    root.innerHTML = `
            <button id="dl-volume-btn"   class="dl-btn dl-btn-volume">Create Volume Selection(s)</button>
            <button id="dl-selected-btn" class="dl-btn dl-btn-primary">Download Selected Points</button>

            <div class="dl-slider-wrap">
                <div class="dl-slider-header">
                    <span class="dl-slider-label">Level of Detail</span>
                    <span class="dl-slider-value">
                        <span id="dl-depth-val">${sceneMaxDepth}</span> / ${sceneMaxDepth}
                    </span>
                </div>
                <input id="dl-depth-slider" class="dl-slider" type="range"
                    min="1" max="${sceneMaxDepth}" value="${sceneMaxDepth}" step="1">
                <div id="dl-depth-hint" class="dl-slider-hint" style="margin-top:8px; line-height:1.6;"></div>
            </div>

            <div class="dl-progress-wrap">
                <div class="dl-progress"><div id="dl-bar" class="dl-bar"></div></div>
                <div id="dl-status" class="dl-status">Ready.</div>
                <button id="dl-cancel-btn" class="dl-btn dl-btn-cancel" style="display:none;">Cancel</button>
            </div>
        `;

    // ---- listeners (each null-guarded so a missing element doesn't break init) ----

    const volumeBtn   = document.getElementById("dl-volume-btn");
    const selectedBtn = document.getElementById("dl-selected-btn");
    const allBtn      = document.getElementById("dl-all-btn");
    const cancelBtn   = document.getElementById("dl-cancel-btn");
    const slider      = document.getElementById("dl-depth-slider");
    const valEl       = document.getElementById("dl-depth-val");

    if (volumeBtn) volumeBtn.addEventListener("click", () => {
        viewer.setClipTask(1);
        viewer.volumeTool.startInsertion({ clip: true });
        if (slider) updateDepthHint(slider.value);
    });

    if (selectedBtn) selectedBtn.addEventListener("click",
        async (e) => onDownloadClick(e.currentTarget, "selected"));

    if (allBtn) allBtn.addEventListener("click",
        async (e) => onDownloadClick(e.currentTarget, "all"));

    if (cancelBtn) cancelBtn.addEventListener("click", () => {
        DownloadState.cancelled = true;
        setStatus("Cancelling after current tile…");
    });

    if (slider && valEl) slider.addEventListener("input", () => {
        updateDepthHint(slider.value);
        valEl.textContent = slider.value;
    });

    // Fill the hint immediately; otherwise it stays blank until the slider moves.
    if (slider) updateDepthHint(slider.value);
}

/* =====================================================================
   UI UPDATE HELPERS
   ===================================================================== */

function setStatus(text, tone = "") {
    const el = document.getElementById("dl-status");
    if (!el) return;
    el.textContent = text;
    el.className = "dl-status" + (tone ? " " + tone : "");
}

function setProgress(fraction) {
    const bar = document.getElementById("dl-bar");
    if (!bar) return;
    const pct = Math.max(0, Math.min(100, fraction * 100));
    bar.style.width = pct + "%";
}

function setActive(isActive) {
    DownloadState.active = isActive;
    // Disable inputs while a download is in flight.
    const ids = ["dl-volume-btn", "dl-selected-btn", "dl-all-btn", "dl-depth-slider"];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = isActive;
    });
    const cancel = document.getElementById("dl-cancel-btn");
    if (cancel) cancel.style.display = isActive ? "block" : "none";
}

function fmt(n) { return n.toLocaleString(); }

// Read the depth slider's current value, or null if no slider is rendered.
function readDepthSlider() {
    const slider = document.getElementById("dl-depth-slider");
    if (!slider) return null;
    const v = parseInt(slider.value, 10);
    return Number.isFinite(v) ? v : null;
}

/* =====================================================================
   FILE SYSTEM ACCESS HELPERS
   ===================================================================== */

function supportsFSA() { return "showDirectoryPicker" in window; }

async function pickOutputDirectory() {
    if (!supportsFSA()) return null;
    try {
        return await window.showDirectoryPicker({
            mode: "readwrite",
            startIn: "downloads",
            id: "oh3d-pointcloud",
        });
    } catch (e) {
        if (e.name === "AbortError") return null;
        throw e;
    }
}

async function writeToDirectory(dirHandle, filename, buffer) {
    const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
    const writable   = await fileHandle.createWritable();
    await writable.write(buffer);
    await writable.close();
}

function triggerBrowserDownload(buffer, filename) {
    const blob = new Blob([buffer], { type: "application/octet-binary" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

async function writeOutput(dirHandle, filename, buffer) {
    if (dirHandle) {
        await writeToDirectory(dirHandle, filename, buffer);
    } else {
        triggerBrowserDownload(buffer, filename);
        // Stagger so Chrome doesn't throttle or pop the multi-download prompt
        await new Promise(r => setTimeout(r, 250));
    }
}

/* =====================================================================
   OCTREE / BOX HELPERS
   ===================================================================== */

// Count octree nodes (per cloud) intersecting `box`. Used both as a
// cheap empty-tile skip and as a rough total-points estimator
// (~4-5k points/node is Potree's typical node size).
function countIntersectingNodes(pointcloud, box, maxDepth) {
    const stack = [pointcloud.pcoGeometry.root];
    let count = 0;
    while (stack.length) {
        const node = stack.pop();
        if (!node) continue;
        const bbWorld = node.boundingBox.clone().applyMatrix4(pointcloud.matrixWorld);
        if (!bbWorld.intersectsBox(box)) continue;
        count++;
        if (node.level < maxDepth) {
            for (let i = 0; i < 8; i++) if (node.children[i]) stack.push(node.children[i]);
        }
    }
    return count;
}

// World-space AABB of a (possibly rotated) BoxVolume.
function buildSelectionBox(volume) {
    volume.updateMatrixWorld(true);
    const corners = [
        [-.5,-.5,-.5],[+.5,-.5,-.5],[-.5,+.5,-.5],[+.5,+.5,-.5],
        [-.5,-.5,+.5],[+.5,-.5,+.5],[-.5,+.5,+.5],[+.5,+.5,+.5],
    ].map(c => new THREE.Vector3(...c).applyMatrix4(volume.matrixWorld));
    return new THREE.Box3().setFromPoints(corners);
}

// Union of bounding boxes of all visible point clouds, in world space.
function buildAllVisibleBox(visiblePCs) {
    const box = new THREE.Box3();
    for (const pc of visiblePCs) {
        pc.updateMatrixWorld(true);
        const bb = pc.boundingBox.clone().applyMatrix4(pc.matrixWorld);
        box.union(bb);
    }
    return box;
}

// Auto-pick a tile grid that targets ~targetPointsPerTile per tile,
// distributed across X/Y proportional to box dimensions. Heritage data
// is usually flat, so we leave Z at 1 unless the caller overrides.
function pickTileGrid(box, estimatedPoints, targetPointsPerTile) {
    const totalTiles = Math.max(1, Math.ceil(estimatedPoints / targetPointsPerTile));
    if (totalTiles === 1) return { tilesX: 1, tilesY: 1, tilesZ: 1 };

    const size    = box.getSize(new THREE.Vector3());
    const aspect  = (size.x || 1) / (size.y || 1);
    const tilesY  = Math.max(1, Math.round(Math.sqrt(totalTiles / aspect)));
    const tilesX  = Math.max(1, Math.ceil(totalTiles / tilesY));
    return { tilesX, tilesY, tilesZ: 1 };
}

// Deepest level present in the hierarchy as currently known. For COPC that
// grows as hierarchy pages load, so it is a lower bound, not the file's depth.
function deepestKnownLevel(root) {
    let deepest = 0;
    const stack = [root];
    while (stack.length) {
        const node = stack.pop();
        if (!node) continue;
        if (node.level > deepest) deepest = node.level;
        for (let i = 0; i < 8; i++) if (node.children[i]) stack.push(node.children[i]);
    }
    return deepest;
}

// Pull hierarchy.depth from the loaded metadata (Potree v2). Returns
// null for v1 clouds, where there's no single authoritative number.
function getMaxDepth(pc) {
    const v2 = pc.pcoGeometry?.loader?.metadata?.hierarchy?.depth;
    if (v2 != null) return v2;
    // COPC has no depth field. Use what the hierarchy shows so the LOD slider and
    // its spacing hint stay meaningful; effectiveMaxDepth() below keeps that
    // lower bound from truncating an export.
    if (pc.pcoGeometry?.type === "copc") return deepestKnownLevel(pc.pcoGeometry.root);
    return null;
}

/**
 * Per-cloud depth cap for an export. A COPC file only reveals deeper levels as
 * its hierarchy pages load, which happens *while* the export runs — so capping at
 * the depth known beforehand would silently drop the finest points. When the user
 * hasn't asked for anything shallower than that, export without a cap; a lower
 * slider value is still honoured.
 */
function effectiveMaxDepth(pc, maxDepth) {
    if (pc.pcoGeometry?.type !== "copc") return maxDepth;
    return maxDepth >= deepestKnownLevel(pc.pcoGeometry.root) ? Number.MAX_SAFE_INTEGER : maxDepth;
}

// Take the deepest depth across visible clouds. maxDepth is a cap, so
// passing a value larger than a given cloud's depth is harmless.
function getMaxDepthFromScene() {
    let maxDepth = 0;
    for (const pc of viewer.scene.pointclouds) {
        if (!pc.visible) continue;
        const d = getMaxDepth(pc);
        if (d != null) maxDepth = Math.max(maxDepth, d);
    }
    return maxDepth || 10;   // fallback for v1 or empty scenes
}

/* =====================================================================
   TILED DOWNLOAD CORE
   ===================================================================== */

/**
 * Split `fullBox` into a grid of tiles and download each tile as a
 * separate LAS file (one per visible point cloud per tile).
 *
 * @param {THREE.Box3}     fullBox      - world-space selection box
 * @param {?FileSystemDirectoryHandle} dirHandle - or null for browser fallback
 * @param {object}         opts         - tilesX/Y/Z, maxDepth, targetPointsPerTile, namePrefix
 */
async function downloadBoxInTiles(fullBox, dirHandle, opts = {}) {
    const {
        maxDepth             = getMaxDepthFromScene(),
        targetPointsPerTile  = 5_000_000,
        namePrefix           = "selection",
    } = opts;

    const visiblePCs = viewer.scene.pointclouds.filter(p => p.visible);
    if (visiblePCs.length === 0) {
        setStatus("No visible point clouds.", "error");
        return;
    }

    // Estimate total points and pick a grid (caller can override).
    const totalNodesAll = visiblePCs.reduce(
        (acc, pc) => acc + countIntersectingNodes(pc, fullBox, maxDepth), 0);

    const estimatedPoints = totalNodesAll * 5_000;

    const grid = (opts.tilesX && opts.tilesY)
        ? { tilesX: opts.tilesX, tilesY: opts.tilesY, tilesZ: opts.tilesZ || 1 }
        : pickTileGrid(fullBox, estimatedPoints, targetPointsPerTile);

    const { tilesX, tilesY, tilesZ } = grid;
    const totalTiles = tilesX * tilesY * tilesZ;

    DownloadState.totalTiles = totalTiles;
    setProgress(0);
    setStatus(`Preparing ${totalTiles} tile${totalTiles === 1 ? "" : "s"} (depth ${maxDepth})…`);

    const size     = fullBox.getSize(new THREE.Vector3());
    const tileSize = new THREE.Vector3(size.x / tilesX, size.y / tilesY, size.z / tilesZ);

    const tileManifest = [];

    const cls = viewer.classifications;
    const hiddenClassLUT = new Uint8Array(256);
    for (const k of Object.keys(cls)) {
        if (k === "DEFAULT") continue;
        if (cls[k].visible === false) hiddenClassLUT[Number(k)] = 1;
    }

    for (let iz = 0; iz < tilesZ; iz++) {
        for (let iy = 0; iy < tilesY; iy++) {
            for (let ix = 0; ix < tilesX; ix++) {
                if (DownloadState.cancelled) break;

                const min = fullBox.min.clone().add(new THREE.Vector3(
                    ix * tileSize.x,
                    iy * tileSize.y,
                    iz * tileSize.z,
                ));
                const max = min.clone().add(tileSize);
                const tileBox = new THREE.Box3(min, max);

                // Cheap skip: empty tile
                const nodesHere = visiblePCs.reduce(
                    (acc, pc) => acc + countIntersectingNodes(pc, tileBox, maxDepth), 0);
                if (nodesHere === 0) {
                    DownloadState.completedTiles++;
                    setProgress(DownloadState.completedTiles / totalTiles);
                    continue;
                }

                const written = await downloadSingleTile(
                    visiblePCs, tileBox, maxDepth,
                    namePrefix, ix, iy, iz, dirHandle, hiddenClassLUT
                );
                tileManifest.push(...written);

                DownloadState.completedTiles++;
                setProgress(DownloadState.completedTiles / totalTiles);

                // Let GC reclaim the previous tile's buffers before the next one.
                await new Promise(r => setTimeout(r, 50));
            }
            if (DownloadState.cancelled) break;
        }
        if (DownloadState.cancelled) break;
    }

    // Manifest only when we have a directory handle (otherwise it's
    // just another download prompt for the user).
    if (dirHandle && tileManifest.length > 0 && !DownloadState.cancelled) {
        try {
            await writeManifest(dirHandle, namePrefix, fullBox, grid, tileManifest, maxDepth);
        } catch (e) {
            console.warn("Failed to write manifest:", e);
        }
    }
}

// Add to download_module.js (relies on brushEdits + waitForLoad from brush_panel.js)

async function applyLedgerEditsForTile(pointcloud, tileBox, maxDepth) {
    if (typeof brushEdits === "undefined") return;          // brush module not loaded
    const pcEdits = brushEdits.get(pointcloud.name);
    if (!pcEdits || pcEdits.size === 0) return;

    // Walk the octree and collect nodes that (a) intersect this tile,
    // (b) are within the depth cap, and (c) need patching — either they
    // have their own ledger entry, or they inherit an "all" baseline from
    // an ancestor that was brushed at a coarser LOD. The inherited baseline
    // is threaded down through the traversal instead of re-walking parent
    // names per node (see getInheritedBaseline).
    const targets = [];
    const stack = [{ node: pointcloud.pcoGeometry.root, inherited: null }];
    while (stack.length) {
        const { node, inherited } = stack.pop();
        if (!node) continue;
        if (node.level > maxDepth) continue;

        const bbWorld = node.boundingBox.clone().applyMatrix4(pointcloud.matrixWorld);
        if (!bbWorld.intersectsBox(tileBox)) continue;

        const entry = pcEdits.get(node.name);
        const baseline = isAllEntry(entry) ? entry.classification : inherited;

        if (entry || baseline !== null) targets.push({ node, baseline, entry });

        if (node.level < maxDepth) {
            for (let i = 0; i < 8; i++) if (node.children[i]) stack.push({ node: node.children[i], inherited: baseline });
        }
    }
    if (targets.length === 0) return;

    // Force-load any that aren't in memory yet, then patch.
    await Promise.all(targets.map(t => waitForLoad(t.node)));

    for (const { node, baseline, entry } of targets) {
        applyLedgerToNode(node, pcEdits, baseline, entry);
    }
}

// Call once after viewer init, e.g. from openBrushPanel or app boot.
function installEditPersistence() {
    for (const pc of viewer.scene.pointclouds) instrumentSubtree(pc, pc.pcoGeometry.root);
}

function instrumentSubtree(pointcloud, geoNode) {
    if (!geoNode || geoNode.__editsHook) return;
    geoNode.__editsHook = true;

    const apply = () => {
        const pcEdits = brushEdits.get(pointcloud.name);
        if (!pcEdits) return;
        applyLedgerToNode(geoNode, pcEdits);
    };

    if (geoNode.loaded) apply();

    let _loaded = geoNode.loaded;
    Object.defineProperty(geoNode, "loaded", {
        get() { return _loaded; },
        set(v) {
            _loaded = v;
            if (v === true) {
                apply();
                // children only exist after this node has loaded its hierarchy
                for (let i = 0; i < 8; i++) {
                    if (geoNode.children[i]) instrumentSubtree(pointcloud, geoNode.children[i]);
                }
            }
        },
        configurable: true,
    });
}


function filterChunkByClassification(chunk, hiddenSet) {
    if (hiddenSet.size === 0) return chunk;

    const src = chunk.data;
    const classArr = src.classification;
    if (!classArr) return chunk;            // nothing to filter against

    const n = chunk.numPoints;
    const keep = new Uint32Array(n);
    let kept = 0;
    for (let i = 0; i < n; i++) {
        if (!hiddenSet.has(classArr[i])) keep[kept++] = i;
    }

    if (kept === n) return chunk;           // all visible — fast path
    if (kept === 0) return null;            // all hidden — caller skips

    // Rebuild each attribute array using the kept indices.
    const newData = {};
    for (const [key, srcArr] of Object.entries(src)) {
        const stride = srcArr.length / n;   // 1 for scalars, 3 for position, 4 for rgba
        const dst = new srcArr.constructor(kept * stride);
        for (let i = 0; i < kept; i++) {
            const srcOff = keep[i] * stride;
            const dstOff = i * stride;
            for (let s = 0; s < stride; s++) dst[dstOff + s] = srcArr[srcOff + s];
        }
        newData[key] = dst;
    }

    const filtered = new Potree.Points();
    filtered.data = newData;
    filtered.numPoints = kept;
    filtered.boundingBox = chunk.boundingBox;  // approximate; recomputing is rarely worth it
    return filtered;
}

/**
 * Download one tile box as one LAS file per visible point cloud.
 * Returns a list of {pointcloud, filename, points, bounds} entries
 * for the manifest.
 */
function downloadSingleTile(pointclouds, tileBox, maxDepth, namePrefix, ix, iy, iz, dirHandle, hiddenClassLUT) {
    return new Promise((resolve) => {
        const written = [];
        let pending = pointclouds.length;

        const finalize = () => { if (--pending === 0) resolve(written); };

        for (const pc of pointclouds) {

            // COPC discovers deeper levels mid-export; don't cap them away.
            const pcMaxDepth = effectiveMaxDepth(pc, maxDepth);

            applyLedgerEditsForTile(pc, tileBox, pcMaxDepth);

            const points = new Potree.Points();

            pc.getPointsInBox3(tileBox, pcMaxDepth, {
                onProgress: (e) => {
                    points.add(e.points);
                    
                    DownloadState.totalPoints += e.points.numPoints;
                    setStatus(
                        `Tile ${DownloadState.completedTiles + 1} of ${DownloadState.totalTiles}` +
                        ` · ${fmt(DownloadState.totalPoints)} points`
                    );
                },

                onFinish: async () => {
                    if (points.numPoints > 0) {
                        try {
                            console.log(points);
                            const buffer    = Potree.LASExporter.toLAS(points);
                            const safeCloud = (pc.name || "cloud").replace(/[^\w\-]/g, "_");
                            const safePref  = namePrefix.replace(/[^\w\-]/g, "_");
                            const filename  = `${safePref}_${safeCloud}_x${ix}_y${iy}_z${iz}.las`;

                            await writeOutput(dirHandle, filename, buffer);
                            DownloadState.filesWritten++;

                            written.push({
                                file: filename,
                                pointcloud: pc.name,
                                points: points.numPoints,
                                bounds: [
                                    [tileBox.min.x, tileBox.min.y, tileBox.min.z],
                                    [tileBox.max.x, tileBox.max.y, tileBox.max.z],
                                ],
                            });
                        } catch (err) {
                            console.error("Tile write failed:", err);
                            setStatus(`Tile write failed: ${err.message}`, "error");
                        }
                    }
                    finalize();
                },

                onCancel: () => finalize(),
            }, { hiddenClassLUT });
        }
    });
}

async function writeManifest(dirHandle, namePrefix, fullBox, grid, tiles, maxDepth) {
    const manifest = {
        source:           tiles[0]?.pointcloud || "unknown",
        doi:              window.doi || null,
        citation:         window.projectCitation || null,
        generated:        new Date().toISOString(),
        max_depth:        maxDepth,
        selection_bounds_world: [
            [fullBox.min.x, fullBox.min.y, fullBox.min.z],
            [fullBox.max.x, fullBox.max.y, fullBox.max.z],
        ],
        tile_grid:        grid,
        total_points:     tiles.reduce((a, t) => a + t.points, 0),
        tiles,
    };
    const buffer = new TextEncoder().encode(JSON.stringify(manifest, null, 2));
    await writeToDirectory(dirHandle, `${namePrefix}_manifest.json`, buffer);
}

/* =====================================================================
   HIGH-LEVEL ENTRY POINTS
   ===================================================================== */

/**
 * Click handler used by both "Download Selected" and "Download All".
 * Picks the folder up-front (must be in the same gesture), then runs
 * the actual download asynchronously.
 */
async function onDownloadClick(button, mode) {
    if (DownloadState.active) return;

    // Validate scene state before consuming the user gesture.
    const visiblePCs = viewer.scene.pointclouds.filter(p => p.visible);
    if (visiblePCs.length === 0) {
        setStatus("No visible point clouds.", "error");
        return;
    }
    if (mode === "selected" && viewer.scene.volumes.length < 1) {
        setStatus("Create a volume selection first.", "error");
        return;
    }

    // Snapshot the user's chosen detail level NOW (before any awaits).
    const userMaxDepth = readDepthSlider();

    // Folder picker / fallback prompt — must run during the user gesture.
    let dirHandle = null;
    if (supportsFSA()) {
        try {
            dirHandle = await pickOutputDirectory();
        } catch (e) {
            console.error("Folder picker failed:", e);
            setStatus(`Please open the viewer in fullscreen mode. Folder picker error: ${e.message}`, "error");
            return;
        }
        if (!dirHandle) return; // user cancelled
    } else {
        const proceed = confirm(
            "Your browser does not support direct folder writes.\n\n" +
            "Each tile will be downloaded as a separate file. For a better " +
            "experience, use Chrome or Edge.\n\n" +
            "Continue with individual downloads?"
        );
        if (!proceed) return;
    }

    // Run the download.
    resetDownloadState();
    setActive(true);
    setStatus("Starting…");
    setProgress(0);

    // Pass `maxDepth` only if the slider gave us a real number; otherwise
    // let downloadBoxInTiles pick its default via getMaxDepthFromScene().
    const sharedOpts = userMaxDepth != null ? { maxDepth: userMaxDepth } : {};

    try {
        if (mode === "selected") {
            // One tiled run per volume. Run sequentially to keep memory bounded.
            for (let i = 0; i < viewer.scene.volumes.length; i++) {
                if (DownloadState.cancelled) break;
                const vol     = viewer.scene.volumes[i];
                const fullBox = buildSelectionBox(vol);
                await downloadBoxInTiles(fullBox, dirHandle, {
                    ...sharedOpts,
                    namePrefix: `volume${i}`,
                });
            }
        } else { // mode === "all"
            const fullBox = buildAllVisibleBox(visiblePCs);
            await downloadBoxInTiles(fullBox, dirHandle, {
                ...sharedOpts,
                namePrefix: "all",
            });
        }

        if (DownloadState.cancelled) {
            setStatus(
                `Cancelled. ${DownloadState.filesWritten} file(s) saved, ` +
                `${fmt(DownloadState.totalPoints)} points.`,
                "error"
            );
        } else {
            setProgress(1);
            setStatus(
                `Done. ${DownloadState.filesWritten} file(s) saved, ` +
                `${fmt(DownloadState.totalPoints)} points.`,
                "success"
            );
        }
    } catch (err) {
        console.error("Download failed:", err);
        setStatus(`Download failed: ${err.message}`, "error");
    } finally {
        setActive(false);
        // Leave the final status visible for a moment, then reset the bar.
        setTimeout(() => {
            if (!DownloadState.active) setProgress(0);
        }, 5000);
    }
}