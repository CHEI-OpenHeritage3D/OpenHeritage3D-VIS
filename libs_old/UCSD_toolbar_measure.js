
	
	// 1: define html of toolbar first 
	// 2: then populate with content and actions 
	//
	// Following files can be used as references on how to add certain functionality to the toolbar:
	// - sidebar.html
	// - sidebar.js
	// - PropertiesPanel.html and its dependencies (DistancePanel, ProfilePanel, ...)
	// 

	// HTML
	const elToolbar = $("#potree_toolbar");
	elToolbar.html(`
		
		<span>
			<div class="potree_toolbar_label">
				Measure
			</div>
			<div>
				<img name="action_measure_point" src="${Potree.resourcePath}/icons/point.svg" class="annotation-action-icon" style="width: 2em; height: auto;"/>
				<img name="action_measure_distance" src="${Potree.resourcePath}/icons/distance.svg" class="annotation-action-icon" style="width: 2em; height: auto;"/>
				<img name="action_measure_height" src="${Potree.resourcePath}/icons/height.svg" class="annotation-action-icon" style="width: 2em; height: auto;"/>
				<img name="action_reset_tools" src="${Potree.resourcePath}/icons/reset_tools.svg" class="annotation-action-icon" style="width: 2em; height: auto;"/>
			</div>
		</span>

	`);

	// CONTENT & ACTIONS



	{ // MEASURE
		elToolbar.find("img[name=action_measure_point]").click( () => {
			const measurement = viewer.measuringTool.startInsertion({
				showDistances: false,
				showAngles: false,
				showCoordinates: true,
				showArea: false,
				closed: true,
				maxMarkers: 1,
				name: 'Point'
			});
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
				const measurement = this.viewer.scene.removeAllMeasurements();
		});

	}

	