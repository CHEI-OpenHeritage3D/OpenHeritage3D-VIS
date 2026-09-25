/**
 * oriented_image_panel.js
 *
 * Description:
 *   "Oriented Image Mode" UI for a Potree viewer. When the user clicks an
 *   oriented image, the camera locks to that photo's pose (handled in
 *   potree.js / OrientedImageControls) and this panel appears, providing:
 *
 *     - An opacity slider that cross-fades the photo against the point cloud
 *       (the photo is rendered in a post-composite overlay pass so lowering
 *       opacity reveals the actual cloud behind it, not the background).
 *     - Previous / Next navigation through the image set without leaving mode.
 *     - Download of the original full-resolution image.
 *     - An Exit button that unlocks the camera and restores all markers.
 *
 *   Keyboard (while in image mode):
 *     Esc            exit image mode
 *     ← / →          previous / next image
 *     Space (hold)   "peek" — momentarily hide the photo to reveal the cloud
 *     [ / ]          nudge opacity down / up
 *     W              cycle opacity: 100% -> 50% -> 0% -> 50% -> 100% ...
 *
 * Usage:
 *   Include this file AFTER Potree, the viewer, and the modified potree.js
 *   (the one that dispatches oriented_image_* events). No function call is
 *   needed — it wires itself to the viewer's events.
 *
 * Dependencies:
 *   - Potree viewer (global `viewer`)
 *   - Three.js (global `THREE`)
 *   - Modified potree.js exposing:
 *       events: oriented_image_captured / changed / released
 *               oriented_image_texture_loaded / texture_error
 *       controls.orientedImagesInstance, controls.release()
 *       collection.images, collection.imageParamsPath,
 *       collection.focusByOffset(offset)
 *       the oriented-image ShaderMaterial must have a `uMode` uniform
 *       (0 = glass marker, 1 = focused photo); see createMaterial() in
 *       potree.js. This module renders the markers post-composite so the
 *       point cloud shows through the glass.
 */

(function () {
    "use strict";

    // ══════════════════════════════════════════════════════════════
    //  Styles
    // ══════════════════════════════════════════════════════════════

    const oiStyle = document.createElement("style");
    oiStyle.textContent = `

/* ── ORIENTED IMAGE PANEL ────────────────────────────────── */

#oiPanel {
    position: fixed;
    left: 50%;
    bottom: 24px;
    transform: translateX(-50%) translateY(24px);
    z-index: 10000;

    display: flex;
    align-items: center;
    gap: 14px;
    padding: 10px 16px;
    box-sizing: border-box;
    max-width: min(720px, 94vw);

    background: rgba(20, 20, 26, 0.55);
    backdrop-filter: blur(12px) saturate(140%);
    -webkit-backdrop-filter: blur(12px) saturate(140%);

    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 14px;
    box-shadow: 0 0 28px rgba(0,0,0,0.55);

    font-family: 'Segoe UI', system-ui, sans-serif;
    color: #f2f2f7;

    opacity: 0;
    pointer-events: none;
    transition: opacity 0.25s ease, transform 0.28s ease;
}

#oiPanel.open {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
    pointer-events: auto;
}

/* ── Nav buttons ─────────────────────────────────────────── */

.oi-nav-btn {
    width: 34px;
    height: 34px;
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 8px;
    background: rgba(255,255,255,0.05);
    color: #e0e0e5;
    cursor: pointer;
    font-size: 20px;
    line-height: 1;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
}
.oi-nav-btn:hover {
    background: rgba(79,70,229,0.3);
    border-color: rgba(79,70,229,0.45);
    color: #fff;
}

/* ── Title block ─────────────────────────────────────────── */

.oi-title {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 120px;
    max-width: 200px;
}
.oi-title-name {
    font-size: 13px;
    font-weight: 600;
    color: #f2f2f7;
    font-family: monospace;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.oi-title-index {
    font-size: 11px;
    color: #888;
    font-variant-numeric: tabular-nums;
}

/* ── Divider ─────────────────────────────────────────────── */

.oi-sep {
    width: 1px;
    align-self: stretch;
    margin: 2px 0;
    background: rgba(255,255,255,0.12);
    flex-shrink: 0;
}

/* ── Opacity control ─────────────────────────────────────── */

.oi-opacity {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 180px;
}
.oi-opacity-label {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #888;
    flex-shrink: 0;
}
.oi-slider {
    flex: 1;
    min-width: 90px;
    -webkit-appearance: none;
    appearance: none;
    height: 6px;
    border-radius: 3px;
    background: rgba(255,255,255,0.12);
    outline: none;
    transition: background 0.15s;
}
.oi-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #6e6bff;
    border: 2px solid rgba(255,255,255,0.2);
    cursor: pointer;
    box-shadow: 0 0 8px rgba(79, 70, 229, 0.4);
    transition: transform 0.12s, box-shadow 0.12s;
}
.oi-slider::-webkit-slider-thumb:hover {
    transform: scale(1.15);
    box-shadow: 0 0 14px rgba(79, 70, 229, 0.6);
}
.oi-slider::-moz-range-thumb {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #6e6bff;
    border: 2px solid rgba(255,255,255,0.2);
    cursor: pointer;
}
.oi-opacity-value {
    min-width: 38px;
    text-align: right;
    font-size: 13px;
    color: #ccc;
    font-variant-numeric: tabular-nums;
    flex-shrink: 0;
}

/* ── Icon action buttons ─────────────────────────────────── */

.oi-icon-btn {
    width: 34px;
    height: 34px;
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 8px;
    background: rgba(255,255,255,0.05);
    color: #e0e0e5;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
}
.oi-icon-btn svg { width: 18px; height: 18px; display: block; }
.oi-icon-btn:hover {
    background: rgba(79,70,229,0.3);
    border-color: rgba(79,70,229,0.45);
    color: #fff;
}
.oi-icon-btn.oi-exit:hover {
    background: rgba(220, 38, 38, 0.4);
    border-color: rgba(239, 68, 68, 0.5);
    color: #fecaca;
}

/* ── Loading spinner ─────────────────────────────────────── */

.oi-spinner {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    border: 2px solid rgba(255,255,255,0.18);
    border-top-color: #a5a0ff;
    border-radius: 50%;
    animation: oi-spin 0.7s linear infinite;
    display: none;
}
.oi-spinner.active { display: block; }

@keyframes oi-spin { to { transform: rotate(360deg); } }

.oi-opacity-value {
    min-width: 38px;
    text-align: right;
    font-size: 13px;
    color: #ccc;
    font-variant-numeric: tabular-nums;
    flex-shrink: 0;
    cursor: pointer;
    user-select: none;
    transition: color 0.15s;
}
.oi-opacity-value:hover { color: #fff; }

.oi-key {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 20px;
    height: 20px;
    padding: 0 5px;
    border-radius: 4px;
    background: rgba(255,255,255,0.1);
    border: 1px solid rgba(255,255,255,0.15);
    color: #aaa;
    font-size: 11px;
    font-weight: 600;
    font-family: monospace;
    letter-spacing: normal;   /* shield from the label's uppercase/tracking */
    text-transform: none;
    flex-shrink: 0;
}

/* ── ORIENTED IMAGE HOVER CARD ───────────────────────────── */
/* Deliberately the same card as .marker360-hover-card in marker_360.js, in
   this panel's indigo instead of the markers' blue, so hovering a photo and
   hovering a 360 marker read as one gesture. */

#oiHoverCard {
    position: fixed;
    pointer-events: none;
    z-index: 9999;
    opacity: 0;
    transform: translateY(6px) scale(0.96);
    transition: opacity 0.2s ease, transform 0.2s ease;
    font-family: 'Segoe UI', system-ui, sans-serif;
    max-width: 260px;
}

#oiHoverCard.visible {
    opacity: 1;
    transform: translateY(0) scale(1);
}

.oi-hover-card-inner {
    background: rgba(12, 12, 18, 0.88);
    backdrop-filter: blur(20px) saturate(150%);
    -webkit-backdrop-filter: blur(20px) saturate(150%);
    border: 1px solid rgba(140, 130, 255, 0.18);
    border-radius: 12px;
    padding: 14px 18px;
    box-shadow:
        0 0 24px rgba(110, 107, 255, 0.12),
        0 8px 32px rgba(0, 0, 0, 0.5),
        inset 0 1px 0 rgba(255, 255, 255, 0.06);
    position: relative;
    overflow: hidden;
}

.oi-hover-card-inner::before {
    content: "";
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 2px;
    background: linear-gradient(90deg,
        transparent 0%,
        rgba(110, 107, 255, 0.6) 30%,
        rgba(165, 160, 255, 0.8) 50%,
        rgba(110, 107, 255, 0.6) 70%,
        transparent 100%
    );
    animation: oi-shimmer 2.5s ease-in-out infinite;
}

@keyframes oi-shimmer {
    0%, 100% { opacity: 0.4; transform: translateX(-30%); }
    50% { opacity: 1; transform: translateX(30%); }
}

.oi-hover-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 6px;
    min-width: 0;
}

/* Holds the title + subtitle. min-width:0 lets it shrink below its content's
   natural width so the wrapping below can actually take effect — a flex item
   defaults to min-width:auto and would otherwise push the card wider than its
   max-width, where .oi-hover-card-inner's overflow:hidden clips it. */
.oi-hover-text {
    min-width: 0;
}

.oi-hover-dot {
    width: 8px; height: 8px;
    border-radius: 50%;
    background: #6e6bff;
    box-shadow: 0 0 8px rgba(110, 107, 255, 0.8), 0 0 16px rgba(110, 107, 255, 0.4);
    flex-shrink: 0;
    animation: oi-dot-pulse 1.5s ease-in-out infinite;
}

@keyframes oi-dot-pulse {
    0%, 100% { box-shadow: 0 0 6px rgba(110,107,255,0.6), 0 0 12px rgba(110,107,255,0.3); }
    50% { box-shadow: 0 0 10px rgba(110,107,255,1), 0 0 24px rgba(110,107,255,0.5); }
}

.oi-hover-title {
    font-size: 14px;
    font-weight: 700;
    color: #f0f4ff;
    font-family: monospace;
    letter-spacing: 0.02em;
    line-height: 1.3;
    text-shadow: 0 0 12px rgba(110, 107, 255, 0.3);
    overflow-wrap: anywhere;
}

/* Set and zone names run long and often carry no spaces to break at, so allow
   a break mid-token rather than losing the tail of the name. */
.oi-hover-subtitle {
    font-size: 12px;
    color: rgba(200, 200, 240, 0.7);
    letter-spacing: 0.03em;
    text-transform: uppercase;
    font-weight: 500;
    line-height: 1.35;
    overflow-wrap: anywhere;
}

.oi-hover-divider {
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(110, 107, 255, 0.25), transparent);
    margin: 8px 0;
}

.oi-hover-hint {
    margin-top: 6px;
    font-size: 11px;
    color: rgba(180, 180, 230, 0.45);
    font-style: italic;
}
`;
    document.head.appendChild(oiStyle);

    // ══════════════════════════════════════════════════════════════
    //  State
    // ══════════════════════════════════════════════════════════════

    window.orientedImageState = {
        controls: null,        // active OrientedImageControls
        collection: null,      // active OrientedImages instance
        currentImage: null,    // focused OrientedImage
        opacity: 1.0,          // current photo opacity (sticky during navigation)
        opacityToggleDir: -1,  // -1 = W is heading toward 0%, 1 = heading toward 100%
        peeking: false,        // Space-to-peek active
        peekPrevOpacity: 1.0,
    };

    // ══════════════════════════════════════════════════════════════
    //  Overlay rendering
    //
    //  All oriented-image geometry is drawn in a post-composite pass so it
    //  blends over the FINISHED point cloud rather than the background:
    //    - markersScene : the translucent glass markers (always present)
    //    - overlayScene : the single focused photo (full-screen, on top)
    //
    //  This pass runs after the point cloud is composited, which also leaves
    //  the cloud's depth in the framebuffer — so glass markers with depthTest
    //  on are correctly occluded by the cloud (real glass) instead of floating
    //  on top of walls, and the cloud is visible THROUGH them.
    // ══════════════════════════════════════════════════════════════

    const markersScene = new THREE.Scene();
    const overlayScene = new THREE.Scene();

    // Brush cursor sphere: while a photo is focused, draw it in this same
    // post-composite pass (after the photo) so it sits ON TOP of the image but
    // is still occluded by the point cloud. It is only borrowed during focus, so
    // the normal (no-image) brush rendering is left untouched.
    const sphereScene = new THREE.Scene();

    function borrowBrushSphere() {
        const sphere = window.brushState && window.brushState.sphere;
        if (sphere && sphere.parent !== sphereScene) sphereScene.add(sphere);
    }
    function returnBrushSphere() {
        const sphere = window.brushState && window.brushState.sphere;
        if (sphere && sphere.parent === sphereScene) viewer.scene.scene.add(sphere);
    }

    // addOrientedImages() drops each collection's marker node into
    // viewer.scene.scene (pre-composite). Move it into our markers scene so it
    // renders post-composite instead.
    function adoptMarkers(images) {
        if (images && images.node) {
            markersScene.add(images.node);   // THREE reparents (detaches from old scene)
        }
    }
    viewer.scene.addEventListener("oriented_images_added", (e) => adoptMarkers(e.images));
    for (const images of viewer.scene.orientedImages) adoptMarkers(images); // pre-existing

    let _overlayImage = null;     // OrientedImage currently shown as the focused photo
    let _overlayHome = null;      // marker node its mesh belongs to

    // Return a focused image's mesh to its quiet translucent glass-marker state.
    function restoreToGlass(image) {
        const mat = image.mesh.material;
        mat.uniforms.uMode.value = 0.0;      // glass, not photo
        mat.uniforms.uOpacity.value = 1.0;
        mat.transparent = true;
        mat.depthTest = true;                // occlude against the point cloud
        mat.depthWrite = false;
        mat.needsUpdate = true;
    }

    // Decide what the focused mesh shows right now. If the photo isn't loaded
    // yet, stay in the on-brand glass state (cloud visible from the photo's
    // vantage) — no placeholder image. The dissolve happens on texture load.
    function applyFocusVisual(image) {
        const mat = image.mesh.material;
        if (image.texture !== null) {
            mat.uniforms.uMode.value = 1.0;             // photo ready
            mat.uniforms.uOpacity.value = orientedImageState.opacity;
        } else {
            mat.uniforms.uMode.value = 0.0;             // still loading → glass
        }
        mat.needsUpdate = true;
    }

    // Cross-dissolve the photo in over the glass/cloud once it arrives.
    let _fadeRAF = null;
    function dissolvePhotoIn(image, to, ms) {
        if (_fadeRAF) cancelAnimationFrame(_fadeRAF);
        const mat = image.mesh.material;
        mat.uniforms.uMode.value = 1.0;
        mat.uniforms.uOpacity.value = 0.0;
        const start = performance.now();
        const step = (now) => {
            if (_overlayImage !== image) { _fadeRAF = null; return; } // navigated away
            const t = Math.min(1, (now - start) / ms);
            mat.uniforms.uOpacity.value = to * t;
            _fadeRAF = (t < 1) ? requestAnimationFrame(step) : null;
        };
        _fadeRAF = requestAnimationFrame(step);
    }

    // Make exactly one image the focused full-screen photo (or null to clear).
    function setOverlayImage(image) {
        if (_overlayImage && _overlayImage !== image) {
            if (_overlayHome) _overlayHome.add(_overlayImage.mesh);
            restoreToGlass(_overlayImage);
            _overlayImage = null;
            _overlayHome = null;
        }

        if (image && _overlayImage !== image) {
            _overlayHome = image.mesh.parent;   // its marker node
            overlayScene.add(image.mesh);        // borrow it into the overlay
            const mat = image.mesh.material;
            mat.transparent = true;
            mat.depthTest = false;               // fills the screen, always on top
            mat.depthWrite = false;
            mat.needsUpdate = true;
            _overlayImage = image;
            borrowBrushSphere();                 // draw the brush cursor over the photo
            applyFocusVisual(image);             // photo if ready, else glass
        }

        if (!image) returnBrushSphere();         // release: hand the sphere back to the normal pass
    }

    // Single post-composite pass (no renderTarget) — fires after the point
    // cloud is on screen in every renderer (Potree / EDL / HQSplat).
    viewer.addEventListener("render.pass.scene", (e) => {
        if (e.renderTarget !== undefined) return;
        const camera = viewer.scene.getActiveCamera();
        viewer.renderer.render(markersScene, camera);          // glass markers first
        if (_overlayImage) {
            viewer.renderer.render(overlayScene, camera);      // focused photo on top

            const sphere = window.brushState && window.brushState.sphere;
            if (sphere && sphere.visible && sphere.parent === sphereScene) {
                viewer.renderer.render(sphereScene, camera);   // on top of the photo, still occluded by the cloud
            }
        }
    });

    // ══════════════════════════════════════════════════════════════
    //  Panel DOM
    // ══════════════════════════════════════════════════════════════

    let panel, elPrev, elNext, elName, elIndex, elSlider, elOpacityVal,
        elDownload, elExit, elSpinner;

    const SVG_DOWNLOAD =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
        'stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>' +
        '<polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';

    const SVG_EXIT =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
        'stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/>' +
        '<line x1="6" y1="6" x2="18" y2="18"/></svg>';

    function buildPanel() {
        panel = document.createElement("div");
        panel.id = "oiPanel";

        // Prev
        elPrev = document.createElement("button");
        elPrev.className = "oi-nav-btn";
        elPrev.title = "Previous image (←)";
        elPrev.textContent = "‹";
        elPrev.addEventListener("click", () => navigate(-1));
        panel.appendChild(elPrev);

        // Next
        elNext = document.createElement("button");
        elNext.className = "oi-nav-btn";
        elNext.title = "Next image (→)";
        elNext.textContent = "›";
        elNext.addEventListener("click", () => navigate(1));
        panel.appendChild(elNext);

        // Title (filename + index)
        const title = document.createElement("div");
        title.className = "oi-title";
        elName = document.createElement("div");
        elName.className = "oi-title-name";
        elName.textContent = "—";
        elIndex = document.createElement("div");
        elIndex.className = "oi-title-index";
        elIndex.textContent = "";
        title.appendChild(elName);
        title.appendChild(elIndex);
        panel.appendChild(title);

        // Loading spinner (texture load)
        elSpinner = document.createElement("div");
        elSpinner.className = "oi-spinner";
        elSpinner.title = "Loading full-resolution image…";
        panel.appendChild(elSpinner);

        panel.appendChild(makeSep());

        // Opacity control
        const opacity = document.createElement("div");
        opacity.className = "oi-opacity";

        const opLabel = document.createElement("span");
        opLabel.className = "oi-opacity-label";
        opLabel.innerHTML = 'Opacity <span class="oi-key">W</span>';
        opLabel.title = "Toggle photo on/off (W)";
        opacity.appendChild(opLabel);

        elSlider = document.createElement("input");
        elSlider.className = "oi-slider";
        elSlider.type = "range";
        elSlider.min = "0";
        elSlider.max = "1";
        elSlider.step = "0.01";
        elSlider.value = String(orientedImageState.opacity);
        elSlider.title = "Cross-fade photo against the point cloud";
        elSlider.addEventListener("input", () => setOpacity(parseFloat(elSlider.value)));
        opacity.appendChild(elSlider);

        elOpacityVal = document.createElement("span");
        elOpacityVal.className = "oi-opacity-value";
        elOpacityVal.textContent = "100%";
        elOpacityVal.title = "Cycle photo opacity: 100% / 50% / 0% (W)";
        elOpacityVal.addEventListener("click", () => toggleOpacityCycle());
        opacity.appendChild(elOpacityVal);

        panel.appendChild(opacity);

        panel.appendChild(makeSep());

        // Download
        elDownload = document.createElement("button");
        elDownload.className = "oi-icon-btn";
        elDownload.title = "Download original image";
        elDownload.innerHTML = SVG_DOWNLOAD;
        elDownload.addEventListener("click", downloadCurrent);
        panel.appendChild(elDownload);

        // Exit
        elExit = document.createElement("button");
        elExit.className = "oi-icon-btn oi-exit";
        elExit.title = "Exit image mode (Esc)";
        elExit.innerHTML = SVG_EXIT;
        elExit.addEventListener("click", exitMode);
        panel.appendChild(elExit);

        document.body.appendChild(panel);
    }

    function makeSep() {
        const s = document.createElement("div");
        s.className = "oi-sep";
        return s;
    }

    // ══════════════════════════════════════════════════════════════
    //  Actions
    // ══════════════════════════════════════════════════════════════

    function setOpacity(a) {
        a = Math.min(1, Math.max(0, a));
        orientedImageState.opacity = a;
        if (_overlayImage) {
            _overlayImage.mesh.material.uniforms.uOpacity.value = a;
        }
        if (elSlider) elSlider.value = String(a);
        if (elOpacityVal) elOpacityVal.textContent = Math.round(a * 100) + "%";
    }

    // Cycles opacity 100% -> 50% -> 0% -> 50% -> 100% -> ... on each call.
    function toggleOpacityCycle() {
        const a = orientedImageState.opacity;
        let next;
        if (a > 0.5) {
            next = 0.5;
            orientedImageState.opacityToggleDir = -1; // next stop is 0%
        } else if (a < 0.5) {
            next = 0.5;
            orientedImageState.opacityToggleDir = 1; // next stop is 100%
        } else {
            next = orientedImageState.opacityToggleDir < 0 ? 0 : 1.0;
        }
        setOpacity(next);
    }

    function navigate(offset) {
        if (orientedImageState.collection && typeof orientedImageState.collection.focusByOffset === "function") {
            orientedImageState.collection.focusByOffset(offset);
        }
    }

    function downloadCurrent() {
        const c = orientedImageState.collection;
        if (!c || !orientedImageState.currentImage) return;
        const url = `${c.imageParamsPath}/../${orientedImageState.currentImage.id}`;
        window.open(url, "_blank", "noopener");
    }

    function exitMode() {
        if (orientedImageState.controls) orientedImageState.controls.release();
    }

    function showSpinner(on) {
        if (!elSpinner) return;
        elSpinner.classList.toggle("active", !!on);
    }

    function updateHeader(image) {
        if (!image) return;
        elName.textContent = image.id;
        const imgs = orientedImageState.collection ? orientedImageState.collection.images : null;
        if (imgs) {
            const i = imgs.indexOf(image);
            elIndex.textContent = (i >= 0) ? `${i + 1} / ${imgs.length}` : "";
        } else {
            elIndex.textContent = "";
        }
    }

    function showPanel() { panel.classList.add("open"); }
    function hidePanel() { panel.classList.remove("open"); }

    // ══════════════════════════════════════════════════════════════
    //  Hover card
    //
    //  The counterpart of the 360 markers' card (marker_360.js): hover a
    //  photo marker, get its name and a reminder of the gesture that opens
    //  it. Fed by the oriented_image_hover / _unhover events potree.js
    //  dispatches from its own hover raycast.
    // ══════════════════════════════════════════════════════════════

    let hoverCard = null, hoverCardTitle = null, hoverCardSubtitle = null;

    function ensureHoverCard() {
        if (hoverCard) return hoverCard;

        hoverCard = document.createElement("div");
        hoverCard.id = "oiHoverCard";
        hoverCard.innerHTML = `
            <div class="oi-hover-card-inner">
                <div class="oi-hover-header">
                    <div class="oi-hover-dot"></div>
                    <div class="oi-hover-text">
                        <div class="oi-hover-title"></div>
                        <div class="oi-hover-subtitle"></div>
                    </div>
                </div>
                <div class="oi-hover-divider"></div>
                <div class="oi-hover-hint">Double-click to open image</div>
            </div>
        `;
        document.body.appendChild(hoverCard);

        // Filenames and set names are author-supplied data, so they go in as
        // text, never as markup.
        hoverCardTitle = hoverCard.querySelector(".oi-hover-title");
        hoverCardSubtitle = hoverCard.querySelector(".oi-hover-subtitle");
        return hoverCard;
    }

    function positionHoverCard(card, cx, cy) {
        const pad = 16;
        // Measured, not assumed: a wrapped name makes the card taller than any
        // fixed guess, which would flip it at the wrong distance from the edge.
        const rect = card.getBoundingClientRect();
        const cardW = rect.width || 260;
        const cardH = rect.height || 120;

        let left = cx + pad;
        let top = cy + pad;

        if (left + cardW > window.innerWidth - pad) left = cx - cardW - pad;
        if (top + cardH > window.innerHeight - pad) top = cy - cardH - pad;

        card.style.left = `${Math.max(pad, left)}px`;
        card.style.top = `${Math.max(pad, top)}px`;
    }

    // Which image set this photo belongs to, for the subtitle line.
    function setNameOf(collection) {
        if (typeof _zoneOrientedImageHandlers !== "function") return "";
        for (const zone of window.zones || []) {
            for (const handler of _zoneOrientedImageHandlers(zone)) {
                if (handler.images === collection) return handler.name || zone.name || "";
            }
        }
        return "";
    }

    // The brush's Shift tooltip (brush_selection.js) already names an image at
    // the cursor; two cards stacked on the same spot would just collide.
    function brushTooltipShowing() {
        const tip = document.querySelector(".brush-oi-tooltip");
        return !!tip && tip.style.display === "block";
    }

    function showHoverCard(image, collection, event) {
        if (!image || brushTooltipShowing()) {
            hideHoverCard();
            return;
        }

        const card = ensureHoverCard();
        const images = collection ? collection.images : null;
        const index = images ? images.indexOf(image) : -1;

        hoverCardTitle.textContent = image.id;
        hoverCardSubtitle.textContent = [
            setNameOf(collection),
            index >= 0 ? `${index + 1} / ${images.length}` : "",
        ].filter(Boolean).join(" · ");

        if (event) positionHoverCard(card, event.clientX, event.clientY);
        requestAnimationFrame(() => card.classList.add("visible"));
    }

    function hideHoverCard() {
        if (hoverCard) hoverCard.classList.remove("visible");
    }

    // Enter or update the panel for a focused image.
    function enterPanel(image, resetOpacity) {
        orientedImageState.currentImage = image;
        setOverlayImage(image);

        if (resetOpacity) setOpacity(1.0);
        else setOpacity(orientedImageState.opacity);

        updateHeader(image);
        showSpinner(image.texture === null);
        showPanel();
    }

    // ══════════════════════════════════════════════════════════════
    //  Viewer event wiring
    // ══════════════════════════════════════════════════════════════

    viewer.addEventListener("oriented_image_hover", (e) => {
        showHoverCard(e.image, e.collection, e.event);
    });

    viewer.addEventListener("oriented_image_unhover", () => hideHoverCard());

    // Drop the card the moment the gesture lands. oriented_image_captured fires
    // only after the 500ms fly-in, and potree.js keeps dispatching hover until
    // then, so relying on that alone leaves the card sitting over the photo.
    viewer.renderer.domElement.addEventListener("dblclick", () => hideHoverCard());

    viewer.addEventListener("oriented_image_captured", (e) => {
        orientedImageState.controls = e.controls;
        orientedImageState.collection = e.controls.orientedImagesInstance;
        // potree.js stops its hover raycast while a photo is captured, so no
        // unhover is coming — drop the card here or it stays on screen.
        hideHoverCard();
        enterPanel(e.image, /* resetOpacity */ true);
        // Hide every OTHER image set and every 360 marker for the duration —
        // this set's own siblings are already handled by showOnly()/showAll()
        // in potree.js. Restored in full on oriented_image_released below.
        if (typeof hideOtherImageMarkersForImmersion === "function") {
            hideOtherImageMarkersForImmersion(orientedImageState.collection);
        }
        if(document.getElementById("brushPanel")) {
            setPCMaterial("classification");
            if (typeof enterClassBlendForOrientedImage === "function") enterClassBlendForOrientedImage();
        }
    });

    viewer.addEventListener("oriented_image_changed", (e) => {
        // navigation within image mode — keep current opacity
        orientedImageState.controls = e.controls;
        orientedImageState.collection = e.controls.orientedImagesInstance;
        enterPanel(e.image, /* resetOpacity */ false);
        if(document.getElementById("brushPanel")) {
            setPCMaterial("classification");
            if (typeof enterClassBlendForOrientedImage === "function") enterClassBlendForOrientedImage();
        }
    });

    viewer.addEventListener("oriented_image_released", () => {
        setOverlayImage(null);
        hidePanel();
        showSpinner(false);
        orientedImageState.controls = null;
        orientedImageState.collection = null;
        orientedImageState.currentImage = null;
        setPCMaterial("rgba classes");
        if (typeof exitClassBlendForOrientedImage === "function") exitClassBlendForOrientedImage();
        // Bring every other image set and 360 marker back to whatever
        // visibility their own zone/set state (and the global toggle) says
        // they should have right now — undoes hideOtherImageMarkersForImmersion.
        if (typeof restoreImageMarkerVisibility === "function") restoreImageMarkerVisibility();
        // Undo the global OI toggle only if Shift+click was the one that
        // flipped it on — leave a manually-enabled toggle alone.
        if (window.brushState && window.brushState._globalOIForcedByShiftClick) {
            window.brushState._globalOIForcedByShiftClick = false;
            if (typeof setAllOrientedImagesVisibility === "function") setAllOrientedImagesVisibility(false);
        }
    });

    viewer.addEventListener("oriented_image_texture_loaded", (e) => {
        if (e.image !== orientedImageState.currentImage) return;
        showSpinner(false);
        // if it's the focused overlay and we were showing glass, dissolve in
        if (_overlayImage === e.image &&
            e.image.mesh.material.uniforms.uMode.value < 0.5) {
            dissolvePhotoIn(e.image, orientedImageState.opacity, 350);
        }
    });
    viewer.addEventListener("oriented_image_texture_error", (e) => {
        if (e.image === orientedImageState.currentImage) showSpinner(false);
        // stays in the glass state — nothing ugly to show
    });

    // ══════════════════════════════════════════════════════════════
    //  Keyboard
    // ══════════════════════════════════════════════════════════════

    function isTyping(t) {
        return t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT");
    }

    document.addEventListener("keydown", (e) => {
        if (!orientedImageState.controls || isTyping(e.target)) return;

        switch (e.key) {
            case "Escape":
                exitMode();
                break;
            case "ArrowLeft":
                navigate(-1);
                e.preventDefault();
                break;
            case "ArrowRight":
                navigate(1);
                e.preventDefault();
                break;
            case "[":
                setOpacity(orientedImageState.opacity - 0.1);
                break;
            case "]":
                setOpacity(orientedImageState.opacity + 0.1);
                break;
            case "w":
            case "W":
                // cycle photo opacity: 100% -> 50% -> 0% -> 50% -> 100% ...
                toggleOpacityCycle();
                e.preventDefault();
                break;
            case " ":
                // hold to "peek" the point cloud
                if (!orientedImageState.peeking) {
                    orientedImageState.peeking = true;
                    orientedImageState.peekPrevOpacity = orientedImageState.opacity;
                    if (_overlayImage) {
                        _overlayImage.mesh.material.uniforms.uOpacity.value = 0;
                    }
                    if (elOpacityVal) elOpacityVal.textContent = "peek";
                }
                e.preventDefault();
                break;
        }
    });

    document.addEventListener("keyup", (e) => {
        if (e.key === " " && orientedImageState.peeking) {
            orientedImageState.peeking = false;
            setOpacity(orientedImageState.peekPrevOpacity);
        }
    });

    // ══════════════════════════════════════════════════════════════
    //  Init
    // ══════════════════════════════════════════════════════════════

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", buildPanel);
    } else {
        buildPanel();
    }

})();