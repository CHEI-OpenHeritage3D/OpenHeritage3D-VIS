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
        elOpacityVal.title = "Toggle photo on/off (W)";
        elOpacityVal.addEventListener("click", () => setOpacity(orientedImageState.opacity > 0 ? 0 : 1.0));
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

    viewer.addEventListener("oriented_image_captured", (e) => {
        orientedImageState.controls = e.controls;
        orientedImageState.collection = e.controls.orientedImagesInstance;
        enterPanel(e.image, /* resetOpacity */ true);
        if(document.getElementById("brushPanel")) setPCMaterial("classification");
    });

    viewer.addEventListener("oriented_image_changed", (e) => {
        // navigation within image mode — keep current opacity
        orientedImageState.controls = e.controls;
        orientedImageState.collection = e.controls.orientedImagesInstance;
        enterPanel(e.image, /* resetOpacity */ false);
        if(document.getElementById("brushPanel")) setPCMaterial("classification");
    });

    viewer.addEventListener("oriented_image_released", () => {
        setOverlayImage(null);
        hidePanel();
        showSpinner(false);
        orientedImageState.controls = null;
        orientedImageState.collection = null;
        orientedImageState.currentImage = null;
        setPCMaterial("rgba classes");
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
                // toggle photo fully off / fully on
                setOpacity(orientedImageState.opacity > 0 ? 0 : 1.0);
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