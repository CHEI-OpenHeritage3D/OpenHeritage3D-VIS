		// Add annotations to pointcloud
		function addAnnotations(annotations) {
			// Recursively add children
			let addChildren = function (parent, children) {
				children.forEach((child) => {
					let childAnnotation = new Potree.Annotation(child);
					childAnnotation.addEventListener('click', onClickAnnotation);
					parent.add(childAnnotation);
					addChildren(childAnnotation, child.children);
				});
			};
			annotations.forEach((annotation) => {
				let processedAnnotation = new Potree.Annotation(annotation);
				processedAnnotation.addEventListener('click', onClickAnnotation);
				viewer.scene.annotations.add(processedAnnotation);
				addChildren(processedAnnotation, annotation.children);
			})
		}


		// Add measurements to pointcloud
		function addMeasurements(measurements) {
			measurements.forEach((measurement) => {
				// Create a new measure and copy the attributes from the JSON
				let newMeasure = new Potree.Measure();
				Object.keys(measurement).forEach((key) => {
					// Special case: points
					if (key === 'points') {
						// Make a new vector with the point
						measurement[key].forEach((point) => {
							newMeasure.addMarker(new THREE.Vector3(point[0], point[1], point[2]));
						});
					} else if (key !== 'color') { // Copy everything except color
						newMeasure[key] = measurement[key];
					}
				});
				// Add the measurement to the actual scene
				viewer.scene.addMeasurement(newMeasure);
			});
		}

		// Add clipping boxes and other volume-related things
		function addVolumes(volumes) {
			volumes.forEach((volume) => {
				let newVolume;
				// Determine which type of volume we need to create
				if (volume.type === "BoxVolume") {
					newVolume = new Potree.BoxVolume();
				} else {
					newVolume = new Potree.SphereVolume();
				}
				// Set attributes from JSON
				newVolume.position.set(volume.position[0], volume.position[1], volume.position[2]);
				newVolume.rotation.set(volume.rotation[0], volume.rotation[1], volume.rotation[2]);
				newVolume.scale.set(volume.scale[0], volume.scale[1], volume.scale[2]);
				newVolume.visible = volume.visible;
				newVolume.clip = volume.clip;
				// Add the volume to the actual scene
				viewer.scene.addVolume(newVolume);
			});
		}

		// Clears all annotations, measurements, and volumes from scene
		function clear() {
			viewer.scene.annotations.removeAllChildren();
			viewer.scene.removeAllMeasurements();
			viewer.scene.removeAllClipVolumes();
		}

		// File uploads
		function onFileUpload(event) {
			let fr = new FileReader();
			fr.onload = () => {
				// Clear the current annotations, measurements, and volumes
				clear();
				let imported = JSON5.parse(fr.result);
				// Add the parsed data to the scene
				addAnnotations(imported.annotations);
				addMeasurements(imported.measurements);
				addVolumes(imported.volumes);
			};
			fr.readAsText(event.files[0]);
		}

		function onClickAnnotation(event) {
			viewer.sidebar.propertiesPanel.set(event.target);
		}