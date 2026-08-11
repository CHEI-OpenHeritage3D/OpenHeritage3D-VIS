function waitForPointCloudsLoaded() {
    return new Promise(resolve => {
        function check() {
            const pcs = viewer.scene.pointclouds;

            // Must exist first
            if (pcs.length === 0) {
                return requestAnimationFrame(check);
            }

            // Potree point clouds are considered "loaded" when metadata + root node exist
            const ready = pcs.every(pc =>
                pc.boundingBox &&
                pc.root !== null && pc.root !== undefined
            );

            if (!ready) {
                return requestAnimationFrame(check);
            }

            resolve();
        }

        check();
    });
}


function createZones(){
    console.log("new zones");
    console.log(viewer.scene.pointclouds);

    for(let pc of viewer.scene.pointclouds){
        console.log(pc);
        const name = pc.name;
        const priority = 1;
        const zone = new Zone(name, null, priority, [pc], [], []);
        window.zones.push(zone);
    }
    enableFirstZone();
    // One-time startup restore: zone visibility from the URL, or inferred
    // from the default pointcloud visibility (viewer_state_retainer.js).
    if (typeof applyZoneVisibilityFromURL === "function") applyZoneVisibilityFromURL();
}

async function initZones() {
    await waitForPointCloudsLoaded();

    const loaded = await autoLoadZonesJSON(window.zoneURL);
    importEditsFromCSV(window.classificationURL);
    updateMaterialMenuOnStart();
    console.log("zones loaded?", loaded);

    if (!loaded) {
        createZones();
    }
}