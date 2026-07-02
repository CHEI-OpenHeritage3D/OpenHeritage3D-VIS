const annotationIcons = {
    none: "images/none.png",
    building: "images/building.png",
    painting: "images/painting.png",
    sculpture: "images/sculpture.png",
    room: "images/room.png",
    landscape: "images/landscape.png",
    marker360: "images/marker360.png"
};

document.addEventListener("DOMContentLoaded", () => {
    const zoneSearchButton = document.getElementById("searchZonesButton");
    zoneSearchButton.addEventListener("click", toggleZoneSearchMenu);
});

window.zoneCheckboxes = [];

style.textContent += `

/* ==========================================================
   HIGH CONTRAST • GLASS DARK THEME FOR ZONE TREE / SEARCH
   ========================================================== */

#zoneSearchMenu {
    position: fixed;
    top: 80px;
    right: -420px; /* slide-off position to match sizes better */
    width: clamp(300px, 32vw, 420px);

    /* allow content-determined height */
    height: auto;
    max-height: 85vh;

    padding: 18px 20px;
    box-sizing: border-box;

    /* --- Glassmorphic transparent background --- */
    background: rgba(20, 20, 26, 0.55);
    backdrop-filter: blur(12px) saturate(140%);
    -webkit-backdrop-filter: blur(12px) saturate(140%);

    /* --- Soft glowing border like search menu --- */
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 14px;

    /* --- Shadow for float effect --- */
    box-shadow: 0 0 28px rgba(0,0,0,0.55);

    z-index: 10000;
    transition: right 0.28s ease, opacity 0.25s ease;

    font-family: sans-serif;
    display: flex;
    flex-direction: column;

    opacity: 0; /* fade-in for consistency */
}

#zoneSearchMenu.open {
    right: 10px; /* aligned with toolbar like #zoneSearchMenu */
    opacity: 1;
}


/* Prevent empty list from stretching the panel */
.zone-list-container {
    flex: unset !important;
    max-height: 60vh;
    overflow-y: auto;
}



#zoneSearchMenu h3 {
    margin: 0 0 8px 0;
    font-size: 19px;
    font-weight: 600;
    color: #f2f2f7; /* brighter for contrast */
    text-shadow: 0 0 4px rgba(0,0,0,0.6);
}

/* ======================= SEARCH BAR ======================= */

.zone-search-input {
    margin-bottom: 12px;
    padding: 8px 12px;
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(255,255,255,0.2);
    color: #fafafa;
    border-radius: 8px;
    width: 100%;
    box-sizing: border-box;
    transition: border-color .15s, background .15s;
}

.zone-search-input:focus {
    border-color: #6e6bff;
    background: rgba(255,255,255,0.12);
    box-shadow: 0 0 0 3px rgba(79,70,229,0.3);
    outline: none;
}

/* ======================= ZONE LIST ======================= */

.zone-list-container {
    flex: 1;
    overflow-y: auto;
    padding-right: 8px;
    margin-top: 4px;
}

/* ======================= ZONE BLOCK ======================= */

.zone-block {
    position: relative;
    margin-bottom: 18px;
    padding-left: 24px;
}

/* Vertical connector line */
.zone-block::before {
    content: "";
    position: absolute;
    left: 22px;
    top: 3.4em;
    bottom: 10px;
    width: 2px;
    background: rgba(255,255,255,0.2);
    backdrop-filter: blur(4px);
}

/* ======================= ZONE TITLE ======================= */

.zone-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 4px 0 8px 0;
    padding-right: 6px;
}

.zone-title-btn {
    flex-grow: 1;
    // margin-right: 10px;

    background: linear-gradient(
        145deg,
        rgba(50, 52, 63, 0.75),
        rgba(30, 31, 38, 0.75)
    );
    border: 1px solid rgba(255,255,255,0.15);
    color: #f9f9ff;
    padding: 10px 16px;
    font-size: 16px;
    font-weight: 600;
    border-radius: 8px;
    cursor: pointer;
    transition: background .15s, box-shadow .15s, border-color .15s;
}

.zone-title-btn:hover {
    background: #4f46e5;
    border-color: #867fff;
    box-shadow: 0 0 10px rgba(79,70,229,0.6);
}

/* Checkbox */
.zone-checkbox {
    width: 20px;
    height: 20px;
    cursor: pointer;
    accent-color: #6f6bff;
}

/* ======================= ANNOTATION ITEMS ======================= */

.annotation-item {
    position: relative;
    margin: 6px 0;
    padding: 8px 12px;

    display: flex;
    align-items: center;
    gap: 8px;

    background: rgba(0,0,0,0.55);
    backdrop-filter: blur(8px) saturate(150%);
    border: 1px solid rgba(255,255,255,0.12);
    color: #ffffff;

    border-radius: 8px;
    cursor: pointer;

    transition: background .12s, box-shadow .12s;
}

.annotation-item:hover {
    background: rgba(79,70,229,0.55);
    box-shadow: 0 0 10px rgba(79,70,229,0.5);
}

/* Horizontal connector to vertical line */
.annotation-item::before {
    content: "";
    position: absolute;
    left: -52px;
    top: 50%;
    width: 52px;
    height: 2px;
    background: rgba(255,255,255,0.25);
    backdrop-filter: blur(3px);
    transform: translateY(-50%);
}

/* Icon */
.annotation-icon {
    width: 20px;
    height: 20px;
    object-fit: contain;
    filter: drop-shadow(0 0 2px rgba(0,0,0,0.7));
    opacity: 1;
}

/* ======================= TEXT IMPROVEMENTS ======================= */

.annotation-description,
.annotation-description-content,
.annotation-titlebar .annotation-label {
    color: #ffffff !important;
    font-weight: 600 !important;
    text-shadow: 0 0 4px rgba(0,0,0,0.6) !important;
    text-align: center;
}

.annotation-item,
.annotation-item * {
    color: #ffffff;
    text-shadow: 0 0 4px rgba(0,0,0,0.9);
}

.annotation-item {
    background: rgba(0,0,0,0.55);
    backdrop-filter: blur(10px) saturate(160%);
    border: 1px solid rgba(255,255,255,0.12);
}

.annotation-item,
.annotation-item * {
    color: #ffffff;
    text-shadow: 0 0 4px rgba(0,0,0,0.9);
}

.annotation-icon {
    filter: brightness(2.0) drop-shadow(0 0 3px rgba(0,0,0,0.9));
}

#autoSwitchButtonSearch {
    margin-bottom: 14px;
    align-self: center;
}

.zone-search-input {
    width: 90% !important;
    margin: 0 auto 12px auto;
    display: block;
}


.zone-title-row {
    display: flex;
    align-items: center;
    gap: 6px;
}

.zone-collapse-btn {
    background: none;
    border: none;
    color: #bbb;
    cursor: pointer;
    font-size: 20px;
    padding: 1px 1px;
    width: 18px;
}

.zone-collapse-btn:hover {
    color: #fff;
}

.annotation-container {

    overflow: hidden;

    opacity: 1;

    transition:
        max-height 0.25s ease,
        opacity 0.2s ease;
}

.annotation-container.collapsed {
    max-height: 0;
    opacity: 0;
}

.zone-collapse-btn {
    transition: transform 0.2s ease;
}

.zone-collapse-btn.collapsed {
    transform: rotate(-90deg);
}


`;

function toggleZoneSearchMenu() {
    let existingMenu = document.getElementById("zoneSearchMenu");

    // --- Close if open ---
    if (existingMenu) {
        existingMenu.classList.remove("open");
        setTimeout(() => existingMenu.remove(), 300);
        return;
    }


    // --- Otherwise create it ---
    const panel = document.createElement("div");
    panel.id = "zoneSearchMenu";
    panel.className = "zone-panel";
    panel.innerHTML = "<h3>Zone & Annotation Browser</h3>";

    // --- Close button ---
    const closeBtn = document.createElement("button");
    closeBtn.textContent = "×";
    closeBtn.className = "zone-form-close";
    closeBtn.title = "Close";
    closeBtn.addEventListener("click", () => {
        panel.classList.remove("open");
        setTimeout(() => panel.remove(), 300);
    });
    panel.appendChild(closeBtn);


        // --- Auto-Switch Toggle ---
    const autoSwitchButton = document.createElement("button");
    autoSwitchButton.id = "autoSwitchButtonSearch";
    autoSwitchButton.className = "close-btn";

    if(window.zoneAutoSwitchState){
        autoSwitchButton.style.background = "#16a34a";
        autoSwitchButton.textContent = "Auto-Switch: ON";
    }
    else {
        autoSwitchButton.textContent = "Auto-Switch: OFF";
        autoSwitchButton.style.background = "#dc2626";
    }

    autoSwitchButton.addEventListener("click", () => {
        setAutoSwitchState(!window.zoneAutoSwitchState);
    });

    panel.appendChild(autoSwitchButton);

    // --- Search input ---
    const searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.placeholder = "Search annotations...";
    searchInput.className = "zone-search-input";
    searchInput.style.marginBottom = "8px";
    searchInput.style.width = "95%";
    searchInput.style.padding = "6px";
    searchInput.style.border = "1px solid #ccc";
    searchInput.style.borderRadius = "6px";

    panel.appendChild(searchInput);

    // --- Content container ---
    const listContainer = document.createElement("div");
    listContainer.className = "zone-list-container";
    panel.appendChild(listContainer);


    // --- Populate zones and annotations ---
    if (!window.zones || window.zones.length === 0) {
        const empty = document.createElement("p");
        empty.textContent = "No zones have been defined yet.";
        empty.className = "hint";
        listContainer.appendChild(empty);
    } else {
        for (const zone of window.zones) {
            const zoneBlock = document.createElement("div");
            zoneBlock.className = "zone-block";

            // indent based on priority (e.g. 20px per level)
            const indent = Math.max(0, (zone.priority - 1) * 10);
            zoneBlock.style.marginLeft = `${indent}px`;

            // Create a container row
            const titleRow = document.createElement("div");
            titleRow.className = "zone-title-row";

            // Collapse toggle button
            const collapseBtn = document.createElement("button");
            collapseBtn.className = "zone-collapse-btn";
            collapseBtn.textContent = "▾"; // expanded by default
            collapseBtn.title = "Collapse / Expand";


            // Create the title button
            const titleBtn = document.createElement("button");
            titleBtn.className = "zone-title-btn";
            titleBtn.textContent = zone.name;

            // Example action
            titleBtn.addEventListener("click", () => {
                zoneOnlyToggle(zone);
            });

            // Create the visibility checkbox
            const chk = document.createElement("input");
            chk.type = "checkbox";
            chk.className = "zone-checkbox";
            chk.checked = getZoneVisibility(zone);   // or default based on your logic

            chk.zone = zone;    // attach zone reference
            window.zoneCheckboxes.push(chk);


            chk.addEventListener("change", () => {
                setAutoSwitchState(false);
                viewer.setClipTask(2);
                setZoneVisibility(zone, chk.checked);
            });

            // Build the row
            titleRow.appendChild(collapseBtn);
            titleRow.appendChild(titleBtn);
            titleRow.appendChild(chk);


            // Add to zone block
            zoneBlock.appendChild(titleRow);

            // Annotation list
            if ((!zone.annotations || zone.annotations.length === 0) && zone.marker360s.length === 0) {
                // const emptyAnn = document.createElement("p");
                // emptyAnn.textContent = "No annotations.";
                // emptyAnn.className = "hint";
                // zoneBlock.appendChild(emptyAnn);
            } else {

            const annContainer = document.createElement("div");
            annContainer.className = "annotation-container";

            const annList = document.createElement("ul");
            annList.className = "annotation-list";

            annContainer.appendChild(annList);

            for (const ann of zone.annotations) {
                const li = document.createElement("li");
                li.className = "annotation-item";
                li._ref = ann;
                
                li.title = ann.description || ann.userData?.description || "";

                const type = ann.userData?.type || "none";    // default type
                const iconSrc = annotationIcons[type];

                // Create icon element
                const icon = document.createElement("img");
                icon.src = iconSrc;
                icon.className = "annotation-icon";

                const title = document.createElement("span");
                title.textContent = ann.title;

                // Click to fly camera
                li.addEventListener("click", () => {
                    if (ann.cameraPosition && ann.cameraTarget) {
                        if(window.in360View) window.close360();
                        moveCameraTo(ann.cameraPosition, ann.cameraTarget);
                    }
                });

                // Append icon + title
                li.appendChild(icon);
                li.appendChild(title);

                annList.appendChild(li);
            }

            for (const marker360 of zone.marker360s) {

                console.log('maker123');
                const li = document.createElement("li");
                li.className = "annotation-item";
                li._ref = marker360;
                
                li.title = marker360.name || "360 Image";

                const type = "marker360"    // default type;
                const iconSrc = annotationIcons[type];

                // Create icon element
                const icon = document.createElement("img");
                icon.src = iconSrc;
                icon.className = "annotation-icon";

                const title = document.createElement("span");
                title.textContent = marker360.name;

                // Click to fly camera
                li.addEventListener("click", () => {
                    window.open360(marker360._sphereMarker);
                });

                // Append icon + title
                li.appendChild(icon);
                li.appendChild(title);

                annList.appendChild(li);
            }
                console.log(annList);

                // zoneBlock.appendChild(annList);
                zoneBlock.appendChild(annContainer);

                let collapsed = false;

                collapseBtn.addEventListener("click", (e) => {
                    e.stopPropagation();

                    collapsed = !collapsed;

                    annContainer.classList.toggle("collapsed", collapsed);
                    collapseBtn.textContent = collapsed ? "▸" : "▾";
                });


            }

            listContainer.appendChild(zoneBlock);
        }
    }


// --- Annotation + Zone + Description search filtering ---
searchInput.addEventListener("input", () => {
    const query = searchInput.value.toLowerCase();

    const allZoneBlocks = listContainer.querySelectorAll(".zone-block");

    allZoneBlocks.forEach(zoneBlock => {
        const zoneName = zoneBlock.querySelector("h4")?.textContent.toLowerCase() || "";
        const annItems = zoneBlock.querySelectorAll(".annotation-item");

        // Zone name match?
        const zoneMatches = zoneName.includes(query);

        let visibleAnnotations = 0;

        annItems.forEach(li => {
            const ann = li._ref;   // We'll attach the annotation object when building
            const title = ann.title?.toLowerCase() || "";
            const desc = ann.description?.toLowerCase() || ann.userData?.description?.toLowerCase() || "";

            const matches =
                zoneMatches ||                      // zone name match
                title.includes(query) ||            // annotation title match
                desc.includes(query);               // annotation description match

            if (matches) {
                li.style.display = "";
                visibleAnnotations++;
            } else {
                li.style.display = "none";
            }
        });

        // Hide zone entirely if no matches
        if (query && !zoneMatches && visibleAnnotations === 0) {
            zoneBlock.style.display = "none";
        } else {
            zoneBlock.style.display = "";
        }
    });
});





    document.body.appendChild(panel);
    requestAnimationFrame(() => panel.classList.add("open"));
}

function setZoneVisibility(zone, visibility){
    for(const pc of zone.pointclouds){
      pc.visible = visibility;
    }
    // if to turn off remove volumes
    if(!visibility){
        if(zone._volumes){
            for ( const vol of zone._volumes){
                viewer.scene.removeVolume(vol);
            }
        }

        for (const layerMap of zone.layerMaps) setLayerMapVisibility(layerMap, false);

        setMarker360sVisibilityByZone(zone, false);
    }
    else{
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

            if(!zone._volumes) zone._volumes = []; //creating a reference to not rely on names
            
            zone._volumes.push(vol);

            // Add it to the viewer
            viewer.scene.addVolume(vol);

            // Set clipping behavior globally
        }
        viewer.setClipTask(2);
    }

    if(visibility){
      if (zone.annotations) {
        for (const ann of zone.annotations) ann.visible = true;
      }
      if (zone.layerMaps) {
        for (const layerMap of zone.layerMaps) setLayerMapVisibility(layerMap, true);
      }
      setMarker360sVisibilityByZone(zone, true);
    }


    refreshZoneCheckboxStates();
}

function getZoneVisibility(zone){
//   return zone.pointclouds.every(pc => pc._visible) &&
//         window.zones.every(z => z === zone || z.pointclouds.every(pc => !pc._visible));

    return zone.pointclouds.every(pc => pc._visible);


}


function zoneOnlyToggle(zoneToShow) {
    setAutoSwitchState(false);
    viewer.setClipTask(2);

    const isCurrentlyOnlyVisible = getZoneVisibility(zoneToShow);
        

    if (isCurrentlyOnlyVisible) {
        // Restore all zones
        for (const zone of window.zones)
            setZoneVisibility(zone, true);
        return;
    }

    // Otherwise: show only this zone
    for (const zone of window.zones)
        setZoneVisibility(zone, zone === zoneToShow);

    refreshZoneCheckboxStates();
}

function refreshZoneCheckboxStates() {
    for (const chk of window.zoneCheckboxes) {
        const zone = chk.zone;

        // A zone is considered visible if ANY of its pointclouds is visible
        const visible = zone.pointclouds.some(pc => pc._visible);

        chk.checked = visible;
    }
}
