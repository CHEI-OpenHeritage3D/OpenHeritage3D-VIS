document.addEventListener("DOMContentLoaded", () => {
    
    viewer.addEventListener('camera_changed', () => {
        updateDynaCamera();
    })
});


function updateDynaCamera(){

    const normal = viewer.scene.getActiveCamera().position.clone().normalize();

    const view = viewer.scene.view;

    view.up.copy(normal);

    view.east = new THREE.Vector3().crossVectors(view.worldNorth, view.up).normalize();
    view.north = new THREE.Vector3().crossVectors(view.up, view.east).normalize();

    view.right = new THREE.Vector3().crossVectors(view.direction, view.up).normalize();
    view.forward = new THREE.Vector3().crossVectors(view.up, view.right).normalize();


    // console.log(viewer.scene.view.up);]

    // drawDebugVectors(viewer.scene.view.getPivot().clone(), [view.up, view.east]);
}


function drawDebugVectors(origin, vectors) {

    // Remove old helpers if needed
    if (window._debugHelpers) {
        window._debugHelpers.forEach(h => viewer.scene.scene.remove(h));
    }
    window._debugHelpers = [];

    vectors.forEach(v => {
        const arrow = new THREE.ArrowHelper(
            v.dir.clone().normalize(),
            origin,
            v.length ?? 10,
            v.color ?? 0xffffff
        );
        viewer.scene.scene.add(arrow);
        window._debugHelpers.push(arrow);
    });
}
