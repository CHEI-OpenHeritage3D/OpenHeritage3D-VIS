	
	
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
			
				<img name="action_measure_point" src="build/potree/resources/icons/point.svg" class="annotation-action-icon" style="width: 2em; height: auto;"/>
				<img name="action_measure_distance" src="build/potree/resources/icons/distance.svg" class="annotation-action-icon" style="width: 2em; height: auto;"/>
				<img name="action_measure_height" src="build/potree/resources/icons/height.svg" class="annotation-action-icon" style="width: 2em; height: auto;"/>
				<img name="action_reset_tools" src="build/potree/resources/icons/reset_tools.svg" class="annotation-action-icon" style="width: 2em; height: auto;"/>
				<a href="#" onclick="toggleAnnotations()"><img src="build/potree/resources/icons/annotation.svg" alt="labels" style="width:25px ;height:auto;"></a>
							</div>
			
		</span>
		<div class="potree_toolbar_separator" /></div>

		<span>
			<div class="potree_toolbar_label" style="width: 6em">
				Shading
			</div>
			<div style=" text-align:center;">
			
	<a style="color:white" href="#"  onclick=" viewer.setEDLStrength(0.2); viewer.setEDLRadius(1.2); "> 1</a>  |
	<a style="color:darkgrey" href="#"  onclick=" viewer.setEDLStrength(2.5); viewer.setEDLRadius(2.5); "> 2</a> |
	<a style="color:grey" href="#"  onclick=" viewer.setEDLStrength(5); viewer.setEDLRadius(4); "> 3</a>
					 </div>
					 </span>
		<span class="potree_toolbar_separator" /></span>

		<span>
			<div class="potree_toolbar_label" style="width: 6em">
				Material
			</div>
			<div>
				<select id="optMaterial" name="optMaterial"></select>
				
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
	}

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
		elToolbar.find("img[name=action_reset_tools]").click( () => {
				const measurement = this.viewer.scene.removeAllMeasurements();
		});
	}

	{ // MATERIAL
		let options = [
			"rgba", 
			"color",
			"elevation",
			"intensity",
			//"classification",
			//"indices",
			 
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

		attributeSelection.selectmenu({change: updateMaterialSelection});
	
}