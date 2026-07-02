document.addEventListener("DOMContentLoaded", () => {
    viewer.addEventListener('camera_changed', () => {
        updateDynamicCamera();
    })
});

let oldYaw = 0;
let oldPitch = 0;

function updateDynamicCamera(){
    const view = viewer.scene.view;

    console.log(`Δyaw: ${((view.yaw - oldYaw) * 180 / Math.PI).toFixed(4)}°  Δpitch: ${((view.pitch - oldPitch) * 180 / Math.PI).toFixed(4)}°  yaw: ${(view.yaw * 180 / Math.PI).toFixed(2)}°  pitch: ${(view.pitch * 180 / Math.PI).toFixed(2)}°`);
    oldYaw = view.yaw;
    oldPitch = view.pitch;

    const up = {vector: view.getUp(), color: 0xff0000};
    const north = {vector: view.getNorth(), color: 0x00ff00};
    const east = {vector: view.getEast(), color: 0x0000ff};
    const direction = {vector: view.direction.clone(), color: 0xff00ff};
    vectors = [up, north, east, direction];

    drawDebugVectors(new THREE.Vector3(4523928.848, 900265.366, 4390413.454), vectors);
}

function drawDebugVectors(origin, vectors) {

    // Remove old helpers if needed
    if (window._debugHelpers) {
        window._debugHelpers.forEach(h => viewer.scene.scene.remove(h));
    }
    window._debugHelpers = [];

    vectors.forEach(v => {
        const arrow = new THREE.ArrowHelper(
            v.vector.clone().normalize(),
            origin,
            10000000000000,
            v.color ?? 0xffffff
        );
        viewer.scene.scene.add(arrow);
        window._debugHelpers.push(arrow);
    });
}
