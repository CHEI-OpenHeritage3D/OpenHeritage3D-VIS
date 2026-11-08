style.textContent+=`.misc-panel {
    position: absolute;
    width: 150px;
    background: #1a1b1f;
    border: 1px solid #333;
    border-radius: 6px;
    padding: 6px 0;
    z-index: 99999;
    opacity: 0;
    transform: translateY(-4px);
    transition: opacity .15s ease, transform .15s ease;
}

.misc-panel.open {
    opacity: 1;
    transform: translateY(0);
}

.misc-item {
    padding: 8px 14px;
    color: white;
    font-size: 14px;
    cursor: pointer;
    user-select: none;
}

.misc-item:hover {
    background: #4f46e5;
}

.misc-item:focus-visible {
    outline: 2px solid #a5b4fc;
    outline-offset: -2px;
}

#viewer-title {
    top: 10px;
    position: absolute;
    padding: 6px 16px;
    background: rgba(0,0,0,0.45);
    backdrop-filter: blur(4px);
    border-radius: 8px;
    color: white;
    font-size: 18px;
    font-weight: 600;
    white-space: nowrap;
    z-index: 9999;
    transition: top 0.25s ease, bottom 0.25s ease, left 0.25s ease;
}

/* When embedded: title at bottom center */
.embedded #viewer-title {
    top: auto !important;
    bottom: 20px !important;
    left: 50% !important;
    transform: translateX(-50%);
}

#viewer-title a {
    color: white !important;
    text-decoration: none !important;
    opacity: 0.9;
}

#viewer-title a:hover {
    opacity: 1.0;
    text-decoration: underline;   /* optional */
}



#toolbar-wrapper {
    position: absolute;
    top: 10px;
    right: 10px;

    display: flex;
    align-items: flex-start;
    gap: 6px;

    z-index: 9999;
}

/* Toggle Button */
#toolbar-toggle {
    background: rgba(0,0,0,0.5);
    color: white;
    font-weight: bold;
    padding: 6px 10px;
    border-radius: 6px;
    cursor: pointer;
    user-select: none;
    transition: background 0.2s ease;
}

#toolbar-toggle:hover {
    background: rgba(255,255,255,0.15);
}

/* Toolbar slide animation */
#potree_toolbar {
    background: rgba(0,0,0,0.55);
    backdrop-filter: blur(4px);
    border-radius: 6px;
    padding: 6px 10px;

    overflow: hidden;
    max-height: 200px;        /* expanded height */
    transition: max-height 0.35s ease, opacity 0.25s ease;
    opacity: 1;
}

#potree_toolbar.collapsed {
    max-height: 0;
    opacity: 0;
}

#toolbar-wrapper {
    position: absolute;
    top: 10px;
    right: 10px;

    display: flex;
    flex-direction: row;
    align-items: flex-start;
    gap: 8px;

    z-index: 9999;
}


/* Key fix to prevent squishing */
#potree_toolbar {
    display: flex;
    flex-direction: row;
    align-items: center;
    white-space: nowrap;

    background: rgba(0,0,0,0.55);
    backdrop-filter: blur(4px);
    border-radius: 6px;
    padding: 8px 12px;

    /* Prevent collapse when toolbar toggles */
    max-height: 200px;
    transition: max-height .35s ease, opacity .25s ease;
    opacity: 1;

    /* Prevent shrinking inside flex parent */
    flex-shrink: 0;
}

#potree_toolbar.collapsed {
    max-height: 0;
    opacity: 0;
}

#toolbar-toggle {
    position: relative;      /* important: creates stacking context */
    z-index: 10001;          /* higher than toolbar */
    background: rgba(0,0,0,0.55);
    color: white;
    font-weight: bold;
    padding: 6px 10px;
    border-radius: 6px;
    cursor: pointer;
    user-select: none;

    transition: background 0.2s ease;
}

#toolbar-toggle:hover {
    background: rgba(255,255,255,0.15);
}

#fullscreen-btn {
    position: absolute;
    bottom: 14px;
    right: 14px;

    width: 42px;
    height: 42px;

    background: rgba(0,0,0,0.55);
    backdrop-filter: blur(6px);
    border-radius: 8px;

    display: none; /* hidden by default */
    align-items: center;
    justify-content: center;
    cursor: pointer;

    z-index: 10000;
    transition: transform 0.15s ease, background 0.2s ease;
}

#fullscreen-btn img {
    width: 22px;
    height: 22px;
    opacity: 0.9;
    pointer-events: none;
}

#fullscreen-btn:hover {
    background: rgba(0,0,0,0.75);
    transform: scale(1.07);
}

#fullscreen-btn {
    opacity: 0;
    animation: fsFade 0.35s ease forwards;
}

@keyframes fsFade {
    from { opacity: 0; transform: scale(0.9); }
    to   { opacity: 1; transform: scale(1); }
}

#potree_toolbar.collapsed {
    max-height: 0;
    opacity: 0;
    pointer-events: none;   /* ⛔ disable all clicks */
}


`;

style.textContent+=`
#optMaterial {
    appearance: none;
    background: rgba(30, 30, 35, 0.75);
    backdrop-filter: blur(6px);
    border: 1px solid #444;
    border-radius: 6px;
    color: #fff;
    padding: 6px 30px 6px 10px;
    font-size: 13px;
    cursor: pointer;
    width: 80px;
    outline: none;
    transition: background .15s ease, border-color .15s ease;
}

#optMaterial:hover {
    background: rgba(55, 55, 70, 0.85);
    border-color: #666;
}

#optMaterial:focus {
    border-color: #4f46e5;
}

#optMaterial option {
    background: #1b1c20;
    color: #ffffff;
}

#optMaterial {
    background-image: url("images/icons8-dropdown-20.png");
    background-repeat: no-repeat;
    background-size: 12px;
    background-position: right 8px center;
}

`;


style.textContent += `
.zone-search-icon-wrapper {
    position: relative;
    display: inline-block;
}

#zoneCountBadge {
    position: absolute;

    /* tweak these two values to perfectly hit the glass “eye” */
    top: 39.5%;
    left: 42.5%;
    transform: translate(-50%, -50%);

    min-width: 1.5em;
    height: 1.5em;
    line-height: 1.5em;

    background: rgba(255, 255, 255, 0.9);
    color: #111;
    border-radius: 100%;

    font-size: 0.7em;
    font-weight: bold;
    text-align: center;

    pointer-events: none; /* important: doesn’t block clicks */
}

`;


let miscButtonsList;
document.addEventListener("DOMContentLoaded", () => {
    const miscToolsButton  = document.getElementById("miscToolsButton");
    miscToolsButton.addEventListener("click", toggleMiscToolsMenu);

    miscButtonsList = (window.miscButtons) ? miscButtons : [
			{
				name: "Zone Management", id: "createZoneButton", onClick: () => toggleZoneCreationMenu()
			},
			// scene_config_panel.js isn't loaded by the external sites that use this menu
			...(typeof toggleSceneSetup === "function" ? [{
				name: "Scene Setup", id: "sceneSetupBtn", onClick: () => toggleSceneSetup()
			}] : []),
			{
				name: "Download Selection", id: "downloadVolumeBtn", onClick: () => {
					openDownloadPanel();
					setAutoSwitchState(false);
					viewer.scene.removeAllClipVolumes();
				}
			},
			{
				name: "Transformation", id: "transformPCBtn", onClick: () => openTransformPanel()
			},
			{
				name: "Classification Brush", id: "brushModeBtn", onClick: () => openBrushPanel()
			},
			// class_legend.js isn't loaded by every page that uses this menu
			...(window.ClassLegend?.toggle ? [{
				name: "Class Legend", id: "classLegendBtn", onClick: () => window.ClassLegend.toggle()
			}] : []),
			// nor is gamepad_controls.js
			...(window.GamepadControls?.toggleHelp ? [{
				name: "Gamepad Controls", id: "gamepadControlsBtn", onClick: () => window.GamepadControls.toggleHelp()
			}] : []),
			// touch_controls.js only runs on phones and tablets
			...(window.TouchControls?.toggleHelp ? [{
				name: "Touch Gestures", id: "touchGesturesBtn", onClick: () => window.TouchControls.toggleHelp()
			}] : []),
			// class_hover_picker.js isn't loaded by every page that uses this menu
			// ...(typeof togglePointInspector === "function" ? [{
			// 	name: "Point Inspector", id: "pointInspectorBtn", onClick: () => togglePointInspector()
			// }] : []),
			// {
			// 	name: "More Options Coming Soon", id: "extraBtn", onClick: () => {}
			// },
		];
    
    console.log(miscButtonsList);

    updateZoneCount();
    
});





// e: the click on the Tools button, if that's what opened it
function toggleMiscToolsMenu(e) {
    let existing = document.getElementById("miscToolsMenu");
    const toolsBtn = document.getElementById("miscToolsButton");

    if (existing) {
        existing.classList.remove("open");
        setTimeout(() => existing.remove(), 200);
        if (toolsBtn) toolsBtn.setAttribute("aria-expanded", "false");
        return;
    }

    const menu = document.createElement("div");
    menu.id = "miscToolsMenu";
    menu.className = "misc-panel";
    menu.setAttribute("role", "menu");
    menu.setAttribute("aria-label", "Tools");
    
    miscButtonsList.forEach(button => {
        const btn = document.createElement("div");
        btn.className = "misc-item";
        btn.id = button.id;
        btn.innerHTML = button.name;
        btn.setAttribute("role", "menuitem");
        btn.tabIndex = 0;

        btn.addEventListener("click", () => {
            button.onClick();
            toggleMiscToolsMenu();
        });

        menu.appendChild(btn);
        
    });



    // menu.innerHTML = `
    //     <div class="misc-item" id="createZoneButton">Create Zones</div>
    //     <div class="misc-item" id="downloadVolumeBtn">Download Volume Selection</div>
    //     <div class="misc-item" id="transformPCBtn">Transform Point Cloud</div>
    //     <div class="misc-item" id="abc">More Options Coming Soon</div>
    // `;
    // <div class="misc-item" id="seeThroughDemoBtn">See-Through</div>
    // Keyboard: Enter or Space picks a tool, the arrows move, Escape goes back to the Tools button
    menu.addEventListener("keydown", (ev) => {
        const items = [...menu.querySelectorAll(".misc-item")];
        const i = items.indexOf(document.activeElement);
        if ((ev.key === "Enter" || ev.key === " ") && i >= 0) {
            ev.preventDefault();
            items[i].click();
        } else if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
            ev.preventDefault();
            const down = ev.key === "ArrowDown";
            const next = i < 0 ? (down ? 0 : items.length - 1) : (i + (down ? 1 : items.length - 1)) % items.length;
            if (items[next]) items[next].focus();
        } else if (ev.key === "Escape") {
            ev.preventDefault();
            ev.stopPropagation();
            toggleMiscToolsMenu();
            if (toolsBtn) toolsBtn.focus();
        }
    });

    document.body.appendChild(menu);

    // position below the button, right-aligned with the toolbar
    const btn = document.getElementById("miscToolsButton");
    const r = btn.getBoundingClientRect();

    const toolbar = document.getElementById("potree_toolbar");
    const rightEdge = toolbar ? toolbar.getBoundingClientRect().right : r.right;

    menu.style.top = (r.bottom + 6) + "px";
    menu.style.left = (rightEdge - menu.offsetWidth) + "px";
    menu.classList.add("open");
    if (toolsBtn) toolsBtn.setAttribute("aria-expanded", "true");

    // Opened from the keyboard or a controller (a click with no mouse behind it): onto the first tool
    if (e && e.detail === 0) {
        const first = menu.querySelector(".misc-item");
        if (first) first.focus({ preventScroll: true });
    }

    // === Close when clicking outside ===
    setTimeout(() => {
        const handleClickOutside = (event) => {
            const menuEl = document.getElementById("miscToolsMenu");
            const btnEl  = document.getElementById("miscToolsButton");

            if (!menuEl) {
                document.removeEventListener("click", handleClickOutside);
                return;
            }

            // If click is outside menu and outside the button → close
            if (!menuEl.contains(event.target) && !btnEl.contains(event.target)) {
                menuEl.classList.remove("open");
                setTimeout(() => menuEl.remove(), 200);
                btnEl.setAttribute("aria-expanded", "false");
                document.removeEventListener("click", handleClickOutside);
            }
        };

        document.addEventListener("click", handleClickOutside);
    }, 0);  // allow the click event for opening to finish
}

function positionTitle() {
    if (document.body.classList.contains("embedded")) {
        return;
    }
    const sidebar = document.getElementById("potree_sidebar_container");
    const toolbar = document.getElementById("potree_toolbar");
    const title = document.getElementById("viewer-title");
    const render = document.getElementById("potree_render_area");

    const sidebarRect = sidebar.getBoundingClientRect();
    const toolbarRect = toolbar.getBoundingClientRect();
    const renderRect = render.getBoundingClientRect();

    const toolbarOpen = !toolbar.classList.contains("collapsed");
    const titleWidth = title.offsetWidth;

    // 1. Natural centered position (center of render area)
    const naturalCenterX = renderRect.left + (renderRect.width / 2);
    let desiredLeft = naturalCenterX - titleWidth / 2;

    // If toolbar is collapsed → always center
    if (!toolbarOpen) {
        title.style.left = desiredLeft + "px";
        return;
    }

    // 2. Determine the safe maximum-left position (right edge of sidebar)
    const safeLeftBound = sidebarRect.right + 12;  
    // extra padding of 12px so it never "touches"

    // 3. Determine the safe maximum-right position (left edge of toolbar)
    const safeRightBound = toolbarRect.left - 12;

    // 4. Check for collision with toolbar
    const desiredRight = desiredLeft + titleWidth;

    const overlapsToolbar = desiredRight > safeRightBound;
    const overlapsSidebar = desiredLeft < safeLeftBound;

    if (!overlapsToolbar && !overlapsSidebar) {
        // No collision → keep centered
        title.style.left = desiredLeft + "px";
        return;
    }

    // 5. Collision → shift into valid range
    // Clamp the title so it fits exactly between sidebar and toolbar
    const midSpaceCenter = (safeLeftBound + safeRightBound) / 2;
    desiredLeft = midSpaceCenter - (titleWidth / 2);

    title.style.left = desiredLeft + "px";
}


function updateZoneCount() {
    const count = window.zones?.length ?? 0;
    const badge = document.getElementById("zoneCountBadge");

    if (!badge) return;

    badge.innerHTML = count;
    // badge.style.display = count > 0 ? "block" : "none";
}
