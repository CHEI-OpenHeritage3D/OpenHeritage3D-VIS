// ══════════════════════════════════════════════════════════════
//  zone_search.js – Zone & Annotation Browser (read-only tree)
//  Uses parent→child relationships. No drag/reorder.
// ══════════════════════════════════════════════════════════════

const annotationIcons = {
    none: "images/none.png", building: "images/building.png", painting: "images/painting.png",
    sculpture: "images/sculpture.png", room: "images/room.png", landscape: "images/landscape.png",
    marker360: "images/marker360.png"
};

document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("searchZonesButton");
    if (btn) btn.addEventListener("click", toggleZoneSearchMenu);
});

window.zoneCheckboxes = [];
const _collapsedSearch = new Set();
const _autoExpandedSearch = new Set();
const _expandedSearch = new Set();

// ── Styles ───────────────────────────────────────────────────
style.textContent += `
#zoneSearchMenu {
    position: fixed; top: 80px; right: -420px; width: clamp(300px, 32vw, 420px);
    height: auto; max-height: 85vh; padding: 18px 20px; box-sizing: border-box;
    background: rgba(20, 20, 26, 0.55); backdrop-filter: blur(12px) saturate(140%);
    -webkit-backdrop-filter: blur(12px) saturate(140%);
    border: 1px solid rgba(255,255,255,0.12); border-radius: 14px;
    box-shadow: 0 0 28px rgba(0,0,0,0.55); z-index: 10000;
    transition: right 0.28s ease, opacity 0.25s ease;
    font-family: 'Segoe UI', system-ui, sans-serif; display: flex; flex-direction: column; opacity: 0;
}
#zoneSearchMenu.open { right: 10px; opacity: 1; }
#zoneSearchMenu h3 { margin: 0 0 8px 0; font-size: 19px; font-weight: 600; color: #f2f2f7; }

.zs-search-input {
    margin: 0 auto 12px auto; display: block; width: 100%; box-sizing: border-box;
    padding: 9px 14px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.2);
    color: #fafafa; border-radius: 8px; font-size: 14px;
    transition: border-color .15s, background .15s, box-shadow .15s;
}
.zs-search-input::placeholder { color: #888; }
.zs-search-input:focus { border-color: #6e6bff; background: rgba(255,255,255,0.12); box-shadow: 0 0 0 3px rgba(79,70,229,0.3); outline: none; }

.zs-scroll { flex: 1; overflow-y: auto; padding-right: 4px; margin-top: 4px; }
.zs-scroll::-webkit-scrollbar { width: 5px; }
.zs-scroll::-webkit-scrollbar-thumb { background: #444; border-radius: 3px; }
#autoSwitchButtonSearch { margin-bottom: 14px; align-self: center; }

.zs-node {}
.zs-zone-row {
    display: flex; align-items: flex-start; gap: 6px; padding: 6px 10px; margin: 2px 0;
    border-radius: 7px; transition: background 0.12s; position: relative;
}
.zs-zone-row:hover { background: rgba(255,255,255,0.04); }

.zs-chevron {
    width: 18px; height: 18px; display: inline-flex; align-items: center; justify-content: center;
    border: none; border-radius: 4px; background: transparent; color: #999;
    cursor: pointer; flex-shrink: 0; transition: background 0.12s, color 0.12s; margin-top: 1px;
}
.zs-chevron:hover { background: rgba(99, 145, 255, 0.15); color: #5b8def; }
.zs-chevron svg { transition: transform 0.2s; }
.zs-chevron.collapsed svg { transform: rotate(-90deg); }
.zs-chevron-spacer { width: 18px; flex-shrink: 0; }

.zs-icon {
    flex-shrink: 0; width: 22px; height: 22px; display: inline-flex; align-items: center;
    justify-content: center; border-radius: 5px; margin-top: 1px;
}
.zs-icon.root  { background: #1e3a5f; color: #7abaff; }
.zs-icon.child { background: #3b2f1a; color: #f0c060; }

/* NEVER truncate names */
.zs-name-btn {
    flex: 1; min-width: 0; background: none; border: none;
    color: #f0f0f5; font-weight: 600; font-size: 14px;
    cursor: pointer; text-align: left; padding: 4px 6px; border-radius: 5px;
    transition: background 0.12s, color 0.12s;
    word-break: break-word; line-height: 1.35;
}
.zs-name-btn:hover { background: #4f46e5; color: #fff; }
/* Highlight when this zone is isolated */
.zs-name-btn.isolated { background: #4f46e5; color: #fff; }

.zs-checkbox { width: 18px; height: 18px; cursor: pointer; accent-color: #6f6bff; flex-shrink: 0; margin-top: 3px; }

.zs-annotations { overflow: hidden; transition: max-height 0.25s ease, opacity 0.2s ease; opacity: 1; }
.zs-annotations.collapsed { max-height: 0 !important; opacity: 0; }

.zs-ann-wrap { position: relative; padding-left: 18px; margin-left: 11px; }
.zs-ann-wrap::before { content: ""; position: absolute; left: 0; top: 0; bottom: 8px; width: 2px; background: rgba(255,255,255,0.12); border-radius: 1px; }

.zs-ann-item {
    position: relative; display: flex; align-items: flex-start; gap: 8px;
    padding: 7px 12px; margin: 3px 0;
    background: rgba(0,0,0,0.4); backdrop-filter: blur(8px);
    border: 1px solid rgba(255,255,255,0.08); border-radius: 7px;
    cursor: pointer; color: #fff; font-size: 13px;
    transition: background 0.12s, box-shadow 0.12s, border-color 0.12s;
}
.zs-ann-item:hover { background: rgba(79,70,229,0.45); border-color: rgba(79,70,229,0.5); box-shadow: 0 0 10px rgba(79,70,229,0.4); }
.zs-ann-item::before { content: ""; position: absolute; left: -18px; top: 50%; width: 16px; height: 2px; background: rgba(255,255,255,0.15); transform: translateY(-50%); }

.zs-ann-icon { width: 18px; height: 18px; object-fit: contain; filter: brightness(1.8) drop-shadow(0 0 2px rgba(0,0,0,0.8)); flex-shrink: 0; margin-top: 1px; }
/* NEVER truncate annotation names */
.zs-ann-title { flex: 1; word-break: break-word; line-height: 1.35; text-shadow: 0 0 4px rgba(0,0,0,0.8); }

.zs-children { position: relative; margin-left: 12px; padding-left: 10px; border-left: 2px solid rgba(255,255,255,0.08); }
.zs-empty { color: #888; font-style: italic; text-align: center; padding: 24px 12px; }
.zs-no-results { color: #888; font-style: italic; text-align: center; padding: 16px; display: none; }

/* Prevent list container from stretching panel */
.zone-list-container { flex: unset !important; max-height: 60vh; overflow-y: auto; }

.zs-action-btn {
    width: 26px; height: 26px; display: inline-flex; align-items: center; justify-content: center;
    border: none; border-radius: 5px; background: transparent; color: #999;
    cursor: pointer; flex-shrink: 0; transition: background 0.12s, color 0.12s; margin-top: 0px; padding: 0;
}
.zs-action-btn:hover { background: rgba(99, 145, 255, 0.15); color: #5b8def; }

.zs-edit-btn:hover { background: rgba(37, 99, 235, 0.25); color: #60a5fa; }

.zs-edit-toggle {
    position: absolute;
    top: 14px;
    right: 46px; /* leaves room for the close "×" button */
    padding: 4px 10px;
    font-size: 12px;
    border-radius: 6px;
    background: #333;
    color: #ddd;
    border: 1px solid rgba(255,255,255,0.15);
    cursor: pointer;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
}

.zs-edit-toggle:hover {
    background: rgba(37, 99, 235, 0.25);
    color: #60a5fa;
    border-color: rgba(96,165,250,0.4);
}



/* --------- Annotation Description --------- */
.annotation-description {
  background: rgba(0,0,0,0.7) !important;
  color: #eee !important;
  border-radius: 6px;
  max-width: 160px !important;
  max-height: 280px !important;
  font-size: 14px;
  padding: 6px 8px;
  overflow-y: auto;
  backdrop-filter: blur(6px);
}

/* Annotation select */
.annotation-type-select {
    width: 100%;
    background: #1f2024;
    border: 1px solid #444;
    color: #ddd;
    padding: 6px;
    border-radius: 6px;
    margin-bottom: 8px;
}


.zs-desc-window {
    position: fixed;
    top: 80px;
    right: 440px;
    width: 380px;
    max-height: 70vh;
    background: rgba(20, 20, 26, 0.92);
    backdrop-filter: blur(16px) saturate(140%);
    -webkit-backdrop-filter: blur(16px) saturate(140%);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 14px;
    box-shadow: 0 0 28px rgba(0,0,0,0.55);
    z-index: 10001;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    font-family: 'Segoe UI', system-ui, sans-serif;
    animation: zs-desc-fadein 0.2s ease;
}
@keyframes zs-desc-fadein { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

.zs-desc-titlebar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: rgba(255,255,255,0.04);
    border-bottom: 1px solid rgba(255,255,255,0.08);
    cursor: grab;
    user-select: none;
}
.zs-desc-titlebar:active { cursor: grabbing; }

.zs-desc-titlebar h4 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    color: #f2f2f7;
    flex: 1;
    min-width: 0;
    word-break: break-word;
}

.zs-desc-close {
    width: 26px; height: 26px;
    display: inline-flex; align-items: center; justify-content: center;
    border: none; border-radius: 6px;
    background: transparent; color: #999;
    cursor: pointer; font-size: 18px; flex-shrink: 0;
    transition: background 0.12s, color 0.12s;
}
.zs-desc-close:hover { background: rgba(220, 38, 38, 0.3); color: #f87171; }

.zs-desc-body {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    color: #ddd;
    font-size: 14px;
    line-height: 1.6;
}
.zs-desc-body::-webkit-scrollbar { width: 5px; }
.zs-desc-body::-webkit-scrollbar-thumb { background: #444; border-radius: 3px; }

.zs-desc-body img { max-width: 100%; border-radius: 8px; margin: 8px 0; }
.zs-desc-body a { color: #7abaff; }
.zs-desc-body h1, .zs-desc-body h2, .zs-desc-body h3 { color: #f2f2f7; }


.zs-ann-info-btn {
    width: 22px; height: 22px;
    flex-shrink: 0;
    margin-top: -1px;
    opacity: 0.5;
    transition: opacity 0.12s, background 0.12s, color 0.12s;
}
.zs-ann-item:hover .zs-ann-info-btn { opacity: 1; }


/* ══════════════════════════════════════════════════════
   Annotation Titlebar – Glassmorphic Dark Theme
   ══════════════════════════════════════════════════════ */

.annotation {
    position: absolute;
    pointer-events: auto;
    z-index: 100;
    transition: z-index 0s;
}

.annotation-titlebar {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 5px 10px;
    border-radius: 8px;

    background: rgba(12, 12, 18, 0.75);
    backdrop-filter: blur(12px) saturate(140%);
    -webkit-backdrop-filter: blur(12px) saturate(140%);
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow:
        0 2px 12px rgba(0, 0, 0, 0.4),
        inset 0 1px 0 rgba(255, 255, 255, 0.05);

    cursor: pointer;
    transition: background 0.2s, border-color 0.2s, box-shadow 0.2s, transform 0.15s;
    transform-origin: center center;
    white-space: nowrap;
}

.annotation-titlebar:hover {
    background: rgba(79, 70, 229, 0.55);
    border-color: rgba(79, 70, 229, 0.5);
    box-shadow:
        0 0 14px rgba(79, 70, 229, 0.35),
        0 4px 16px rgba(0, 0, 0, 0.4),
        inset 0 1px 0 rgba(255, 255, 255, 0.08);
    transform: scale(1.04);
}

.annotation-highlighted .annotation-titlebar {
    background: rgba(79, 70, 229, 0.6);
    border-color: rgba(120, 110, 255, 0.5);
    box-shadow:
        0 0 18px rgba(79, 70, 229, 0.4),
        0 4px 20px rgba(0, 0, 0, 0.45),
        inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

.annotation .annotation-label {
    font-family: 'Segoe UI', system-ui, sans-serif;
    font-size: 13px;
    font-weight: 600;
    color: #f0f0f5;
    letter-spacing: 0.01em;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
    line-height: 1;
}

/* ── Info (i) Button ─────────────────────────────── */
.annotation-info-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.08);
    color: rgba(200, 210, 240, 0.6);
    cursor: pointer;
    flex-shrink: 0;
    transition: background 0.15s, color 0.15s, box-shadow 0.15s;
}

.annotation-info-btn:hover {
    background: rgba(79, 70, 229, 0.4);
    color: #fff;
    box-shadow: 0 0 8px rgba(79, 70, 229, 0.4);
}

.annotation-info-btn.pinned {
    background: rgba(79, 70, 229, 0.7);
    color: #fff;
    box-shadow: 0 0 12px rgba(79, 70, 229, 0.5);
}

.annotation-info-btn svg {
    display: block;
}

/* ── Hide default description panel (we use openDescriptionWindow) ── */
.annotation-description {
    display: none !important;
}

/* ── Action icons in titlebar ────────────────────── */
.annotation-action-icon {
    width: 16px;
    height: 16px;
    filter: brightness(2) drop-shadow(0 0 2px rgba(0,0,0,0.5));
    opacity: 0.6;
    transition: opacity 0.15s;
    cursor: pointer;
}

.annotation-action-icon:hover {
    opacity: 1;
}

/* ── Override Potree defaults we don't want ───────── */
.annotation-titlebar .annotation-label {
    background: none !important;
    border: none !important;
    box-shadow: none !important;
    padding: 0 !important;
    margin: 0 !important;
}

`;

// ── SVG helpers (same as creation panel) ─────────────────────
const _S = "http://www.w3.org/2000/svg";
function _sChevron(){const s=document.createElementNS(_S,"svg");s.setAttribute("width","12");s.setAttribute("height","12");s.setAttribute("viewBox","0 0 12 12");s.setAttribute("fill","none");s.style.transition="transform 0.2s";const p=document.createElementNS(_S,"path");p.setAttribute("d","M4.5 2.5L8 6L4.5 9.5");p.setAttribute("stroke","currentColor");p.setAttribute("stroke-width","1.5");p.setAttribute("stroke-linecap","round");p.setAttribute("stroke-linejoin","round");s.appendChild(p);return s;}
function _sGlobe(){const s=document.createElementNS(_S,"svg");s.setAttribute("width","14");s.setAttribute("height","14");s.setAttribute("viewBox","0 0 16 16");s.setAttribute("fill","currentColor");const p=document.createElementNS(_S,"path");p.setAttribute("d","M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zm5.29 5H11.1a13.5 13.5 0 0 0-1.2-3.23A6.02 6.02 0 0 1 13.29 5zM8 1.06c.68.9 1.22 1.93 1.58 3.06H6.42A11.5 11.5 0 0 1 8 1.06zM1.26 9a6.6 6.6 0 0 1 0-2h2.52a13 13 0 0 0 0 2H1.26zm.45 1h2.2a13.5 13.5 0 0 0 1.2 3.23A6.02 6.02 0 0 1 1.71 10zM3.91 6H1.71a6.02 6.02 0 0 1 3.19-4.23c-.55.93-.97 2.03-1.2 3.23h.21zm4.09 8.94A11.5 11.5 0 0 1 6.42 11h3.16A11.5 11.5 0 0 1 8 14.94zM9.84 10H6.16a12 12 0 0 1 0-4h3.68a12 12 0 0 1 0 4zm.26 3.23A13.5 13.5 0 0 0 11.31 10h2.2a6.02 6.02 0 0 1-3.41 3.23zM12.22 9a13 13 0 0 0 0-2h2.52a6.6 6.6 0 0 1 0 2h-2.52z");s.appendChild(p);return s;}
function _sLayers(){const s=document.createElementNS(_S,"svg");s.setAttribute("width","14");s.setAttribute("height","14");s.setAttribute("viewBox","0 0 16 16");s.setAttribute("fill","currentColor");const p1=document.createElementNS(_S,"path");p1.setAttribute("d","M8 1L0 5l8 4 8-4-8-4z");const p2=document.createElementNS(_S,"path");p2.setAttribute("d","M0 8l8 4 8-4");p2.setAttribute("fill","none");p2.setAttribute("stroke","currentColor");p2.setAttribute("stroke-width","1.3");const p3=document.createElementNS(_S,"path");p3.setAttribute("d","M0 11l8 4 8-4");p3.setAttribute("fill","none");p3.setAttribute("stroke","currentColor");p3.setAttribute("stroke-width","1.3");s.appendChild(p1);s.appendChild(p2);s.appendChild(p3);return s;}
function _sCube(){const s=document.createElementNS(_S,"svg");s.setAttribute("width","14");s.setAttribute("height","14");s.setAttribute("viewBox","0 0 16 16");s.setAttribute("fill","currentColor");const p=document.createElementNS(_S,"path");p.setAttribute("d","M8 .6l7 3.5v7.8l-7 3.5-7-3.5V4.1L8 .6zm0 1.18L2.36 4.6 8 7.42l5.64-2.82L8 1.78zM1.8 5.38v6.44L7.5 14.6V8.18L1.8 5.38zm12.4 0L8.5 8.18v6.42l5.7-2.78V5.38z");s.appendChild(p);return s;}
function _sMagnify(){const s=document.createElementNS(_S,"svg");s.setAttribute("width","14");s.setAttribute("height","14");s.setAttribute("viewBox","0 0 24 24");s.setAttribute("fill","none");const c=document.createElementNS(_S,"circle");c.setAttribute("cx","10.5");c.setAttribute("cy","10.5");c.setAttribute("r","7");c.setAttribute("stroke","currentColor");c.setAttribute("stroke-width","2");s.appendChild(c);const l=document.createElementNS(_S,"line");l.setAttribute("x1","15.5");l.setAttribute("y1","15.5");l.setAttribute("x2","22");l.setAttribute("y2","22");l.setAttribute("stroke","currentColor");l.setAttribute("stroke-width","2");l.setAttribute("stroke-linecap","round");s.appendChild(l);return s;}
function _sInfo(){const s=document.createElementNS(_S,"svg");s.setAttribute("width","14");s.setAttribute("height","14");s.setAttribute("viewBox","0 0 24 24");s.setAttribute("fill","none");s.setAttribute("stroke","currentColor");s.setAttribute("stroke-width","2");s.setAttribute("stroke-linecap","round");s.setAttribute("stroke-linejoin","round");const c=document.createElementNS(_S,"circle");c.setAttribute("cx","12");c.setAttribute("cy","12");c.setAttribute("r","10");s.appendChild(c);const l1=document.createElementNS(_S,"line");l1.setAttribute("x1","12");l1.setAttribute("y1","16");l1.setAttribute("x2","12");l1.setAttribute("y2","12");s.appendChild(l1);const l2=document.createElementNS(_S,"line");l2.setAttribute("x1","12");l2.setAttribute("y1","8");l2.setAttribute("x2","12.01");l2.setAttribute("y2","8");s.appendChild(l2);return s;}

function _buildSearchTree() {
    window.zones.forEach(z => (z.children = []));
    window.zones.forEach(z => { if (z.parent && z.parent !== "none" && typeof z.parent === "object") z.parent.children.push(z); });
    return window.zones.filter(z => !z.parent || z.parent === "none" || typeof z.parent === "string");
}

window.zoneEditMode = false;

function toggleZoneEditMode(state) {
    window.zoneEditMode = !window.zoneEditMode;

    // Toggle edit buttons on each zone row
    document.querySelectorAll(".zs-edit-btn").forEach(btn => {
        btn.style.display = window.zoneEditMode ? "" : "none";
    });

    // Toggle export/import container
    const ioContainer = document.getElementById("zoneSearchIOContainer");
    if (ioContainer) ioContainer.style.display = window.zoneEditMode ? "" : "none";

    // Update the edit mode button text
    const editBtn = document.getElementById("editModeButtonSearch");
    if (editBtn) {
        editBtn.textContent = window.zoneEditMode ? "Edit Mode: ON" : "Edit Mode: OFF";
        editBtn.style.background = window.zoneEditMode ? "#2563eb" : "#333";
    }
}

// ── Main toggle ──────────────────────────────────────────────
function toggleZoneSearchMenu() {
    let existingMenu = document.getElementById("zoneSearchMenu");
    if (existingMenu) { existingMenu.classList.remove("open"); setTimeout(() => {closeDescriptionWindow(); existingMenu.remove()}, 300); return; }

    repositionDescriptionWindow();



    const panel = document.createElement("div"); panel.id = "zoneSearchMenu";
    const title = document.createElement("h3"); title.textContent = "Zones"; panel.appendChild(title);

    const closeBtn = document.createElement("button"); closeBtn.textContent = "×"; closeBtn.className = "zone-form-close";
    closeBtn.addEventListener("click", () => { panel.classList.remove("open"); setTimeout(() => {closeDescriptionWindow(); panel.remove()}, 300); }); panel.appendChild(closeBtn);

    const autoSwitchButton = document.createElement("button"); autoSwitchButton.id = "autoSwitchButtonSearch"; autoSwitchButton.className = "close-btn";
    if(window.zoneAutoSwitchState){
        autoSwitchButton.style.background="#16a34a";
        autoSwitchButton.textContent="Auto-Switch: ON";
    }else{
        autoSwitchButton.textContent="Auto-Switch: OFF";
        autoSwitchButton.style.background="#dc2626";
    }
    autoSwitchButton.addEventListener("click", () => 
        setAutoSwitchState(!window.zoneAutoSwitchState)); 
    panel.appendChild(autoSwitchButton);

    // Edit mode toggle
    const editModeButton = document.createElement("button");
    editModeButton.id = "editModeButtonSearch";
    editModeButton.className = "zs-edit-toggle";
    editModeButton.textContent = window.zoneEditMode ? "Edit Mode: ON" : "Edit Mode: OFF";
    editModeButton.style.background = window.zoneEditMode ? "#2563eb" : "#333";
    editModeButton.addEventListener("click", toggleZoneEditMode);
    panel.appendChild(editModeButton);

    // Export / Import (hidden unless edit mode is on)
    const ioContainer = document.createElement("div");
    ioContainer.id = "zoneSearchIOContainer";
    ioContainer.className = "zone-io-container";
    ioContainer.style.display = window.zoneEditMode ? "" : "none";

    const exportBtn = document.createElement("button");
    exportBtn.textContent = "Export Zones (JSON)";
    exportBtn.className = "close-btn";
    exportBtn.addEventListener("click", exportZonesToJSON);
    ioContainer.appendChild(exportBtn);

    const importBtn = document.createElement("button");
    importBtn.textContent = "Import Zones (JSON)";
    importBtn.className = "close-btn";
    importBtn.addEventListener("click", importZonesFromJSON);
    ioContainer.appendChild(importBtn);
    
    const newZoneBtn = document.createElement("button");
    newZoneBtn.textContent = "New Zone";
    newZoneBtn.className = "close-btn";
    newZoneBtn.addEventListener("click", () => {
        toggleZoneCreationMenu();
        openZoneForm();
    });
    ioContainer.appendChild(newZoneBtn);

    panel.appendChild(ioContainer);


    const searchInput = document.createElement("input"); searchInput.type = "text"; searchInput.placeholder = "Search zones & annotations…"; searchInput.className = "zs-search-input"; panel.appendChild(searchInput);
    const scrollContainer = document.createElement("div"); scrollContainer.className = "zs-scroll"; panel.appendChild(scrollContainer);
    const noResults = document.createElement("p"); noResults.className = "zs-no-results"; noResults.textContent = "No matching zones or annotations."; scrollContainer.appendChild(noResults);

    if (!window.zones || window.zones.length === 0) {
        const empty = document.createElement("p"); empty.className = "zs-empty"; empty.textContent = "No zones have been defined yet."; scrollContainer.appendChild(empty);
    } else {
        const roots = _buildSearchTree();
        roots.forEach(root => _renderSearchNode(root, scrollContainer, 0));
    }

    // Search filtering
    searchInput.addEventListener("input", () => {
        const query = searchInput.value.toLowerCase().trim();
        const allNodes = scrollContainer.querySelectorAll(".zs-node");

        allNodes.forEach(node => {
            const zoneName = (node.dataset.zoneName || "").toLowerCase();
            const annContainer = node.querySelector(":scope > .zs-annotations");
            const zoneMatches = !query || zoneName.includes(query);
            let anyAnnMatch = false;

            if (annContainer) {
                const directAnns = annContainer.querySelectorAll(".zs-ann-item");
                directAnns.forEach(li => {
                    const ref = li._ref;
                    const t = (ref?.title || ref?.name || "").toLowerCase();
                    const d = (ref?.description || ref?.userData?.description || "").toLowerCase();
                    const matches = !query || zoneMatches || t.includes(query) || d.includes(query);
                    li.style.display = matches ? "" : "none";
                    if (matches) anyAnnMatch = true;
                });
                if (query && (zoneMatches || anyAnnMatch)) {
                    annContainer.classList.remove("collapsed");
                    const chev = node.querySelector(".zs-chevron");
                    if (chev) chev.classList.remove("collapsed");
                }
            }
            node.style.display = (!query || zoneMatches || anyAnnMatch) ? "" : "none";
        });

        // Bottom-up: show parent if any descendant visible
        if (query) {
            const arr = Array.from(allNodes);
            for (let i = arr.length - 1; i >= 0; i--) {
                const childC = arr[i].querySelector(":scope > .zs-children");
                if (childC) for (const child of childC.querySelectorAll(":scope > .zs-node")) {
                    if (child.style.display !== "none") { arr[i].style.display = ""; break; }
                }
            }
        }

        let rootVisible = 0;
        scrollContainer.querySelectorAll(":scope > .zs-node").forEach(n => { if (n.style.display !== "none") rootVisible++; });
        noResults.style.display = (query && rootVisible === 0) ? "" : "none";
    });

    document.body.appendChild(panel);
    requestAnimationFrame(() => panel.classList.add("open"));
    _refreshIsolatedHighlight();
}

// ── Recursive tree renderer ──────────────────────────────────
function _renderSearchNode(zone, container, depth) {
    const hasChildren = zone.children && zone.children.length > 0;
    const hasAnnotations = (zone.annotations && zone.annotations.length > 0) || (zone.marker360s && zone.marker360s.length > 0);
    const isCollapsed = !_expandedSearch.has(zone.name);
    const isExpandable = hasChildren || hasAnnotations;

    const node = document.createElement("div"); node.className = "zs-node"; node.dataset.zoneName = zone.name;
    const row = document.createElement("div"); row.className = "zs-zone-row"; row.style.paddingLeft = `${depth * 4}px`;

    if (isExpandable) {
        const chevron = document.createElement("button"); chevron.className = `zs-chevron${isCollapsed ? " collapsed" : ""}`;
        chevron.appendChild(_sChevron());
        chevron.addEventListener("click", (e) => {
            e.stopPropagation();
            const currentlyCollapsed = chevron.classList.contains("collapsed");
            if (currentlyCollapsed) { _collapsedSearch.delete(zone.name); _expandedSearch.add(zone.name); chevron.classList.remove("collapsed"); }
            else { _collapsedSearch.add(zone.name); _expandedSearch.delete(zone.name); chevron.classList.add("collapsed"); }
            const annC = node.querySelector(":scope > .zs-annotations"); if (annC) annC.classList.toggle("collapsed", _collapsedSearch.has(zone.name));
            const childC = node.querySelector(":scope > .zs-children"); if (childC) childC.style.display = _collapsedSearch.has(zone.name) ? "none" : "";
        });
        row.appendChild(chevron);
    } else { const spacer = document.createElement("span"); spacer.className = "zs-chevron-spacer"; row.appendChild(spacer); }

    const icon = document.createElement("span"); icon.className = `zs-icon ${depth === 0 ? "root" : "child"}`;
    if (depth === 0) icon.appendChild(_sGlobe()); else if (hasChildren) icon.appendChild(_sLayers()); else icon.appendChild(_sCube());
    row.appendChild(icon);

    // Name button – click to isolate/show all
    const nameBtn = document.createElement("button"); nameBtn.className = "zs-name-btn"; nameBtn.textContent = zone.name;
    nameBtn.dataset.zoneName = zone.name;
    if (window._isolatedZone === zone) nameBtn.classList.add("isolated");
    if(zone.pointclouds.length != 0){   // normal zone
        nameBtn.addEventListener("click", () => zoneOnlyToggleMoveCamera(zone));  
    }
    else if(zone.pointclouds.length == 0 && zone.beacon){
        nameBtn.addEventListener("click", () => zoneOnlyToggle(zone));
    }
    row.appendChild(nameBtn);

        // Edit button (only visible in edit mode)
    const editBtn = document.createElement("button");
    editBtn.className = "zs-action-btn zs-edit-btn";
    editBtn.title = "Edit zone";
    editBtn.style.display = window.zoneEditMode ? "" : "none";
    editBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
    editBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleZoneCreationMenu();
        openZoneForm(zone);
    });
    row.appendChild(editBtn);

        // Inspect button (magnifying glass) – navigates camera to the zone's beacon
    const inspectBtn = document.createElement("button");
    inspectBtn.className = "zs-action-btn";
    inspectBtn.title = "Go to zone";
    inspectBtn.appendChild(_sMagnify());
    inspectBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        inspectZone(zone);
    });
    if(zone.beacon) row.appendChild(inspectBtn);

// Description button – opens a draggable floating window
    const descBtn = document.createElement("button");
    descBtn.className = "zs-action-btn";
    descBtn.title = "View description";
    descBtn.appendChild(_sInfo());
    descBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openDescriptionWindow(zone);
    });
    if (zone.description) row.appendChild(descBtn);


    // Visibility checkbox
    const chk = document.createElement("input"); chk.type = "checkbox"; chk.className = "zs-checkbox";
    chk.checked = getZoneVisibility(zone); chk.zone = zone; window.zoneCheckboxes.push(chk);
    chk.addEventListener("change", () => {
        setAutoSwitchState(false); viewer.setClipTask(2);
        window._isolatedZone = null; // checkbox = manual multi-select mode
        setZoneVisibility(zone, chk.checked);
        _refreshIsolatedHighlight(true);
    });
    if(zone.pointclouds.length != 0) row.appendChild(chk);
    node.appendChild(row);

    container.appendChild(node);

    if (hasChildren) {
        const childContainer = document.createElement("div"); childContainer.className = "zs-children";
        childContainer.style.marginLeft = `${10 + depth * 4}px`; childContainer.style.display = isCollapsed ? "none" : "";
        zone.children.forEach(child => _renderSearchNode(child, childContainer, depth + 1));
        node.appendChild(childContainer);
    }

    // Annotations
    if (hasAnnotations) {
        const annContainer = document.createElement("div"); annContainer.className = `zs-annotations${isCollapsed ? " collapsed" : ""}`;
        const annWrap = document.createElement("div"); annWrap.className = "zs-ann-wrap"; annWrap.style.marginLeft = `${10 + depth * 4}px`;
        if (zone.annotations) for (const ann of zone.annotations) annWrap.appendChild(_createAnnItem(ann, "annotation"));
        if (zone.marker360s) for (const mk of zone.marker360s) annWrap.appendChild(_createAnnItem(mk, "marker360"));
        annContainer.appendChild(annWrap);
        if (!isCollapsed) requestAnimationFrame(() => { annContainer.style.maxHeight = annContainer.scrollHeight + "px"; });
        node.appendChild(annContainer);
    }
}

function _createAnnItem(ref, type) {
    const item = document.createElement("div"); item.className = "zs-ann-item"; item._ref = ref;
    if (type === "annotation") {
        item.title = ref.description || ref.userData?.description || "";
        const iconSrc = annotationIcons[ref.userData?.type || "none"];
        const icon = document.createElement("img"); icon.src = iconSrc; icon.className = "zs-ann-icon"; item.appendChild(icon);
        const t = document.createElement("span"); t.className = "zs-ann-title"; t.textContent = ref.title || "Untitled"; item.appendChild(t);

        // Description info button
        const desc = ref.description || ref._description || "";
        if (desc) {
            const infoBtn = document.createElement("button");
            infoBtn.className = "zs-action-btn zs-ann-info-btn";
            infoBtn.title = "View description";
            infoBtn.appendChild(_sInfo());
            infoBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                openDescriptionWindow(ref);
            });
            item.appendChild(infoBtn);
        }

        item.addEventListener("click", () => { if (ref.cameraPosition && ref.cameraTarget) { if (window.in360View) window.close360(); moveCameraToClose360(ref.cameraPosition, ref.cameraTarget); } });
    } else {
        item.title = ref.name || "360 Image";
        const icon = document.createElement("img"); icon.src = annotationIcons["marker360"]; icon.className = "zs-ann-icon"; item.appendChild(icon);
        const t = document.createElement("span"); t.className = "zs-ann-title"; t.textContent = ref.name || "360 Marker"; item.appendChild(t);
        item.addEventListener("click", () => { if (window.open360 && ref._sphereMarker) window.open360(ref._sphereMarker); });
    }
    return item;
}

// ══════════════════════════════════════════════════════════════
//  Visibility helpers
// ══════════════════════════════════════════════════════════════

function inspectZone(zone){
    if(!window.zoneAutoSwitchState) zoneOnlyToggleMoveCamera(zone, true);
    if (zone.beacon && zone.beacon.cameraPosition && zone.beacon.cameraTarget) {
        if (window.in360View) window.close360();
        moveCameraToClose360(zone.beacon.cameraPosition, zone.beacon.cameraTarget);
    }
}

function setZoneVisibility(zone, visibility) {
    if (visibility) {
        for (const pc of zone.pointclouds) pc.visible = true;
    } else {
        for (const pc of zone.pointclouds) {
            // Only hide if no other visible zone uses this pointcloud
            let usedElsewhere = false;
            for (const other of newVisibleZones) {
                if (other !== zone && other.pointclouds.includes(pc)) {
                    usedElsewhere = true;
                    break;
                }
            }
            if (!usedElsewhere) pc.visible = false;
        }
    }
    // if to turn off remove volumes
    if(!visibility){
        if(zone._volumes){
            for ( const vol of zone._volumes){
                viewer.scene.removeVolume(vol);
            }
        }

        for (const ann of zone.annotations) setAnnotationVisibility(ann, false);

        for (const layerMap of zone.layerMaps) setLayerMapVisibility(layerMap, false);

        setMarker360sVisibilityByZone(zone, false);
        setBeaconVisibilitybyZone(zone, false);

        newVisibleZones.delete(zone);
    }
    else{
        if(zone.boundingBoxes.length != 0){
            for(let box of zone.boundingBoxes){
                // Recreate box as a Potree.BoxVolume if it’s a plain data object
                let vol = new Potree.BoxVolume();
                vol.position.set(...box.position);
                vol.rotation.set(...box.rotation.slice(0, 3));
                vol.scale.set(...box.scale);

                // Make sure this box clips the scene from outside → only show interior
                vol.clip = true;
                vol.visible = true;
                vol.visible = false;

                vol.name = zone.name;

                vol._isZoneVol = true;

                if(!zone._volumes) zone._volumes = []; //creating a reference to not rely on names
                
                zone._volumes.push(vol);

                // Add it to the viewer
                viewer.scene.addVolume(vol);

                // Set clipping behavior globally
            }
        }

        viewer.setClipTask(2);
        setZoneBackground(zone);

        for (const ann of zone.annotations) setAnnotationVisibility(ann, true);

        if (zone.layerMaps) {
            for (const layerMap of zone.layerMaps) setLayerMapVisibility(layerMap, true);
        }

        setMarker360sVisibilityByZone(zone, true);
        setBeaconVisibilitybyZone(zone, true);
        newVisibleZones.add(zone);
    }

    refreshZoneCheckboxStates();
}

function getZoneVisibility(zone) {
    // if(window.zoneAutoSwitchState && newVisibleZones.size !== 0) return (zone.isDefault && newVisibleZones.has(zone.parent)) ? true : newVisibleZones.has(zone);
    // else return (zone.pointclouds.length != 0) ? zone.pointclouds.every(pc => pc._visible) : false;
    return newVisibleZones.has(zone);
    }

/**
 * zoneOnlyToggle – intuitive isolate/show-all behavior:
 *
 * - Click a zone name → isolate it (hide everything else, show only this zone)
 * - Click same zone name again → show ALL zones
 * - Click a different zone name → isolate the new zone instead
 *
 * The checkbox is independent: it lets you manually toggle individual zones
 * without affecting isolation state.
 */
function zoneOnlyToggle(zoneToShow) {
    if (zoneToShow.pointclouds.length == 0) {
        // Find default child, or fall back to first child with pointclouds
        const defaultChild = zoneToShow.children?.find(c => c.isDefault)
            || zoneToShow.children?.find(c => c.pointclouds.length > 0);

        if (defaultChild) {
            if (zoneToShow.beacon) moveCameraToClose360(zoneToShow.beacon.cameraPosition, zoneToShow.beacon.cameraTarget);
            zoneOnlyToggle(defaultChild);
            return;
        }
        // If truly no children, try parent
        if (zoneToShow.parent) {
            zoneOnlyToggle(zoneToShow.parent);
            setZoneVisibility(zoneToShow, true);
            return;
        }
    }

    setAutoSwitchState(false);
    viewer.setClipTask(2);

    if (window._isolatedZone === zoneToShow) {
        moveCameraToClose360(zoneToShow.beacon.cameraPosition, zoneToShow.beacon.cameraTarget);
    } else {
        window._isolatedZone = zoneToShow;
        for (const zone of window.zones) setZoneVisibility(zone, zone === zoneToShow);
    }

    refreshZoneCheckboxStates();
    _refreshIsolatedHighlight();
}


function zoneOnlyToggleMoveCamera(zoneToShow) {
    setAutoSwitchState(false);
    viewer.setClipTask(2);

    if (window._isolatedZone === zoneToShow) {
        // Already isolated on this zone → show ALL zones

        moveCameraToClose360(zoneToShow.beacon.cameraPosition, zoneToShow.beacon.cameraTarget);
        // window._isolatedZone = null;
        // for (const zone of window.zones) setZoneVisibility(zone, true);
    } else {
        // Isolate this zone (hide everything else)
        window._isolatedZone = zoneToShow;
        for (const zone of window.zones) setZoneVisibility(zone, zone === zoneToShow);
        if(zoneToShow.pointclouds.length == 0) showParent(zoneToShow);
    }

    refreshZoneCheckboxStates();
    _refreshIsolatedHighlight();
}

function showParent(zone){
    if(!zone) return;
    if(zone.pointclouds.length != 0){
        setZoneVisibility(zone, true);
        return;
    }
    showParent(zone?.parent);
}

/**
 * Update the visual highlight on zone name buttons to show which zone is isolated.
 */
function _refreshIsolatedHighlight(blockCollapse) {
    if(!blockCollapse) _collapseAutoExpanded();

    if (window._isolatedZone) {
        _autoExpandToZone(window._isolatedZone);
    }

    document.querySelectorAll(".zs-name-btn").forEach(btn => {
        if (window._isolatedZone && btn.dataset.zoneName === window._isolatedZone.name) {
            btn.classList.add("isolated");
        } else {
            btn.classList.remove("isolated");
        }
    });
}

function refreshZoneCheckboxStates() {
    for (const chk of window.zoneCheckboxes) {
        const zone = chk.zone; if (!zone) continue;
        chk.checked = getZoneVisibility(zone);
    }
}

function repositionDescriptionWindow(){
    const existing = document.getElementById("zoneDescWindow");
    if(!existing) return;

    if(document.getElementById("zoneSearchMenu")){
        existing.style.right = '440px';
    }
    else {
        existing.style.right = '10px';
    }

}


function _autoExpandToZone(zone) {
    // Expand the zone itself to show its direct children
    const selfName = zone.name;
    if (!_expandedSearch.has(selfName)) {
        const node = document.querySelector(`.zs-node[data-zone-name="${CSS.escape(selfName)}"]`);
        if (node) {
            const chevron = node.querySelector(":scope > .zs-zone-row > .zs-chevron");
            const annC = node.querySelector(":scope > .zs-annotations");
            const childC = node.querySelector(":scope > .zs-children");

            if (chevron) chevron.classList.remove("collapsed");
            if (annC) annC.classList.remove("collapsed");
            if (childC) childC.style.display = "";

            _collapsedSearch.delete(selfName);
            _autoExpandedSearch.add(selfName);
        }
    }

    // Walk up and expand ancestors
    let current = zone?.parent;
    while (current && typeof current === "object") {
        const name = current.name;
        if (!_expandedSearch.has(name)) {
            const node = document.querySelector(`.zs-node[data-zone-name="${CSS.escape(name)}"]`);
            if (node) {
                const chevron = node.querySelector(":scope > .zs-zone-row > .zs-chevron");
                const annC = node.querySelector(":scope > .zs-annotations");
                const childC = node.querySelector(":scope > .zs-children");

                if (chevron) chevron.classList.remove("collapsed");
                if (annC) annC.classList.remove("collapsed");
                if (childC) childC.style.display = "";

                _collapsedSearch.delete(name);
                _autoExpandedSearch.add(name);
            }
        }
        current = current.parent;
    }
}

function _collapseAutoExpanded() {
    for (const name of _autoExpandedSearch) {
        if (_expandedSearch.has(name)) continue;

        const node = document.querySelector(`.zs-node[data-zone-name="${CSS.escape(name)}"]`);
        if (node) {
            const chevron = node.querySelector(":scope > .zs-zone-row > .zs-chevron");
            const annC = node.querySelector(":scope > .zs-annotations");
            const childC = node.querySelector(":scope > .zs-children");

            if (chevron) chevron.classList.add("collapsed");
            if (annC) annC.classList.add("collapsed");
            if (childC) childC.style.display = "none";
        }
        _collapsedSearch.add(name);
    }
    _autoExpandedSearch.clear();
}

/**
 * Opens a draggable floating window displaying zone.description as HTML.
 * Only one description window is open at a time.
 */
function openDescriptionWindow(zone) {
    // Close any existing description window
    const existing = document.getElementById("zoneDescWindow");
    if (existing && window.currentZoneDescWindow == zone) {
        existing.remove();
        window.currentZoneDescWindow = null;
        return;
    }
    else if(existing && window.currentZoneDescWindow != zone){
        existing.remove();
    }

    window.currentZoneDescWindow = zone;

    if(!zone.name) zone = { name: zone._title || "Untitled", description: zone._description };

    const win = document.createElement("div");
    win.id = "zoneDescWindow";
    win.className = "zs-desc-window";

    // ── Titlebar (draggable handle) ──
    const titlebar = document.createElement("div");
    titlebar.className = "zs-desc-titlebar";

    const titleEl = document.createElement("h4");
    titleEl.textContent = zone.name;
    titlebar.appendChild(titleEl);

    const closeBtn = document.createElement("button");
    closeBtn.className = "zs-desc-close";
    closeBtn.textContent = "×";
    closeBtn.addEventListener("click", () => {win.remove()});
    titlebar.appendChild(closeBtn);

    win.appendChild(titlebar);

    // ── Body (HTML content) ──
    const body = document.createElement("div");
    body.className = "zs-desc-body";
    body.innerHTML = zone.description;
    win.appendChild(body);

    document.body.appendChild(win);

    // ── Drag logic ──
    let isDragging = false;
    let offsetX = 0, offsetY = 0;

    titlebar.addEventListener("pointerdown", (e) => {

        // If clicking the close button → do NOT start drag
        if (e.target.closest(".zs-desc-close")) return;

        isDragging = true;

        const rect = win.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;

        titlebar.setPointerCapture(e.pointerId);

        if (win.style.right !== "auto") {
            win.style.left = rect.left + "px";
            win.style.top = rect.top + "px";
            win.style.right = "auto";
        }
    });

    repositionDescriptionWindow();


    titlebar.addEventListener("pointermove", (e) => {
        if (!isDragging) return;
        const newLeft = e.clientX - offsetX;
        const newTop = e.clientY - offsetY;

        // Clamp within viewport
        const maxX = window.innerWidth - win.offsetWidth;
        const maxY = window.innerHeight - win.offsetHeight;
        win.style.left = Math.max(0, Math.min(newLeft, maxX)) + "px";
        win.style.top = Math.max(0, Math.min(newTop, maxY)) + "px";
    });

    titlebar.addEventListener("pointerup", (e) => {
        isDragging = false;
        titlebar.releasePointerCapture(e.pointerId);
    });
}

function closeDescriptionWindow() {
    const win = document.getElementById("zoneDescWindow");

    if(win) win.remove();
}

window.currentZoneDescWindow;
