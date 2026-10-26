// Top toolbar: Measure, Material, Images, Zones and Tools buttons, plus the
// collapse toggle. Loaded from index.html after the other libs/custom scripts.
//
// 1: define html of toolbar first
// 2: then populate with content and actions
//
// Following files can be used as references on how to add certain functionality to the toolbar:
// - sidebar.html
// - sidebar.js
// - PropertiesPanel.html and its dependencies (DistancePanel, ProfilePanel, ...)

(function () {

	const elToolbar = $("#potree_toolbar");

	const toggleBtn = document.getElementById("toolbar-toggle");
	const toolbar = document.getElementById("potree_toolbar");

	toggleBtn.addEventListener("click", () => {
	    const collapsed = toolbar.classList.toggle("collapsed");

	    toggleBtn.textContent = collapsed ? "▲" : "▼";

	    // Reposition title after animation completes
	    setTimeout(positionTitle, 350);
	});

		elToolbar.html(`

			<span>
				<div class="potree_toolbar_label">
					Measure
				</div>
				<div>
					<img name="action_point_inspector" src="images/icons/point-inspector.svg" class="annotation-action-icon" title="Point Inspector (I)" style="width: 2em; height: auto;"/>
					<img name="action_measure_distance" src="${Potree.resourcePath}/icons/distance.svg" class="annotation-action-icon" style="width: 2em; height: auto;"/>
					<img name="action_measure_height" src="${Potree.resourcePath}/icons/height.svg" class="annotation-action-icon" style="width: 2em; height: auto;"/>
					<img name="action_reset_tools" src="${Potree.resourcePath}/icons/reset_tools.svg" class="annotation-action-icon" style="width: 2em; height: auto;"/>
				</div>
			</span>

			<span class="potree_toolbar_separator" />

			<span>
				<div class="potree_toolbar_label" style="width: 6em">
					Material
				</div>
				<div>
					<center>
					<select id="optMaterial" name="optMaterial"></select>
					</center>
				</div>
			</span>

	        <span class="potree_toolbar_separator" />
			<div id="oiToggleSection" style="display: none;">
				<div class="potree_toolbar_label" style="width: 6em">
					Images
				</div>
				<div>
					<center>
						<img
							id="globalOIToggle"
							title="Show/hide all oriented images and 360 markers"
							src="images/orientedImage.png"
							class="annotation-action-icon"
							style="width: 1.7em; height: auto;"
						/>
					</center>
				</div>
			</div>

	        <span class="potree_toolbar_separator" id="oiToggleSeparator" style="display: none;" />
			<div>
				<div class="potree_toolbar_label" style="width: 6em">
					Zones
				</div>
				<div>
					<center>
						<div class="zone-search-icon-wrapper">
							<img
								id="searchZonesButton"
								title="Search Zones"
								src="images/icons8-magnifying-glass-50.png"
								class="annotation-action-icon"
								style="width: 2em; height: auto;"
							/>
							<div id="zoneCountBadge">0</div>
						</div>
					</center>
				</div>
			</div>

			<span class="potree_toolbar_separator" />
	        <div>
				<div class="potree_toolbar_label" style="width: 6em">
	                Tools
	            </div>
	            <div>
	                <center>
	                    <img id="miscToolsButton" src="images/icons8-settings-50.png" class="annotation-action-icon" style="width: 2em; height: auto;"/>
	                </center>
	            </div>
	        </div>

		`);


		{ // MEASURE
			elToolbar.find("img[name=action_point_inspector]").click( () => togglePointInspector() );

			// Light the button while the inspector is open, however it was toggled
			// (this button, the I key, or the Tools menu).
			document.addEventListener("point-inspector-changed", (e) => {
				elToolbar.find("img[name=action_point_inspector]").toggleClass("active", e.detail.open);
			});

			elToolbar.find("img[name=action_measure_distance]").click( () => {
				const measurement = viewer.measuringTool.startInsertion({
					showDistances: true,
					showArea: false,
					closed: false,
					name: 'Distance'
				});
			});
		
			elToolbar.find("img[name=action_measure_height]").click( () => {
				const measurement = viewer.measuringTool.startInsertion({
					showDistances: false,
					showHeight: true,
					showArea: false,
					closed: false,
					maxMarkers: 2,
					name: 'Height'
				});
			});
			elToolbar.find("img[name=action_reset_tools]").click( () => {
					const measurement = viewer.scene.removeAllMeasurements();
			});

		}

		{ // MATERIAL
			let options = [
				"Default",
				"RGBA", 
				"Classification",
				"RGBA Classes",
				"Intensity Classes",
				"Composite Classes",
				"Elevation",
				"Intensity",
				"Color",
				//"indices",
				// "intensity",
				// "source id",
			];

			let attributeSelection = elToolbar.find('#optMaterial');
			for(let option of options){
				let elOption = $(`<option>${option}</option>`);
				attributeSelection.append(elOption);
			}

			const updateMaterialSelection = (event, ui) => {
				let selectedValue = attributeSelection.selectmenu().val();

				for(const pointcloud of viewer.scene.pointclouds){
					pointcloud.material.activeAttributeName = selectedValue;
				}
			};

			// The cloud's material from sceneConfig, else the one it started with
			// (updateMaterialMenuOnStart in brush_selection.js records it; config.js scenes have no sceneConfig).
			const configuredMaterial = pc =>
				window.sceneConfig?.pointclouds[pc.name]?.material || pc.userData.startMaterial || {};
			// sceneConfig only stores an intensity range that differs from the data's, so fall back to that.
			const configuredIntensityRange = pc =>
				configuredMaterial(pc).ranges?.intensity ?? pc.getAttribute?.("intensity")?.range;

			attributeSelection.on("change", () => {
				const selected = attributeSelection.val();
				const pointclouds = viewer.scene.pointclouds;

				if(selected === "Default"){
					for(const pc of pointclouds){
						const attribute = configuredMaterial(pc).attribute || "rgba";
						pc.material.activeAttributeName = attribute;
						if(attribute === "intensity" || attribute === "intensity gradient"){
							pc.material.intensityRange = configuredIntensityRange(pc);
						}
					}
				}
				else if(selected === "RGBA Classes"){
					for(const pc of pointclouds){
						pc.material.activeAttributeName = "composite";
						pc.material.weightRGBA = [100];
						pc.material.weightIntensity = [0];
						pc.material.intensityRange = configuredIntensityRange(pc);
						pc.material.weightClassification = [0.75];
					}
				}
				else if(selected === "Intensity Classes"){
					for(const pc of pointclouds){
						pc.material.activeAttributeName = "composite";
						pc.material.weightRGBA = [0];
						pc.material.weightIntensity = [90];
						pc.material.intensityRange = configuredIntensityRange(pc);
						pc.material.weightClassification = [10];
					}
				}
				else if(selected === "Composite Classes"){
					// Already loops over the visible clouds itself.
					applyClassBlendToVisiblePointclouds();
				}
				else {
					const attribute = selected.toLowerCase();
					for(const pc of pointclouds){
						pc.material.activeAttributeName = attribute;
					}
				}
			});

		}

})();
