async function urlExists(url) {
    try {
        const res = await fetch(url, { method: "HEAD" });
        if (res.ok) return true;
    } catch (_) {}

    // fallback if HEAD is not supported
    try {
        const res2 = await fetch(url, { method: "GET" });
        return res2.ok;
    } catch (_) {
        return false;
    }
}


async function loadPotreeIfExists(doi, dataType) {
    const base = "https://pointcloud.ucsd.edu/archive_temp/oh3d_store/oh3d-vis/datasets/";
    const metaURL = `${base}${doi}/potree/${doi}_${dataType}/metadata.json`;

    if (!(await urlExists(metaURL))) {
        console.log(`[SKIP] ${dataType} does not exist for ${doi}`);
        return;
    }

    console.log(`[LOAD] ${dataType} for ${doi}`);

    Potree.loadPointCloud(metaURL, `${doi}_${dataType}`, e => {
	let pointcloud = e.pointcloud;
	let material = pointcloud.material;
	
	material.activeAttributeName = "rgba";
	//pointcloud.material.intensityRange = [0,32000];
	material.minSize = 2;
	//material.rgbGamma = 0.66;
	//material.rgbContrast = 0.6;
	//material.rgbBrightness = 0.16;
	material.pointSizeType = Potree.PointSizeType.ADAPTIVE;
	material.shape = Potree.PointShape.CIRCLE;
	
	viewer.scene.addPointCloud(pointcloud);
	// e.pointcloud.visible = true;
	viewer.fitToScreen();

    });
}


async function loadAllAvailableDataTypes(doi) {

    const dataTypes = [
	"lidar_terrestrial",
	"photogrammetry_aerial",
	"photogrammetry_terrestrial"
];

	const oh3dLink = "https://openheritage3d.org/project.php?id=" + window.doi;



    const promises = dataTypes.map(type => loadPotreeIfExists(doi, type));
    await Promise.all(promises);   // runs all existence checks & loads in parallel
    
    console.log(window.zoneURL);
    autoLoadZonesJSON(window.zoneURL);

    // Starting camera position
    // moveCameraTo(new THREE.Vector3(0,0,10), new THREE.Vector3(0,0,0));


}
