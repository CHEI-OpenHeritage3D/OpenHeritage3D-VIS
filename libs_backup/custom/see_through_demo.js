// document.addEventListener('DOMContentLoaded', () => {
//     const seeThroughDemoButton = document.getElementById("seeThroughDemoButton");
//     seeThroughDemoButton.addEventListener("click", triggerSeeThrough);
// })

function triggerSeeThrough(){
    moveCameraTo(new THREE.Vector3(-28.150, 151.223, 3.438), new THREE.Vector3(-29.704, 115.100, 20.953));

    setAutoSwitchState(false);
    viewer.scene.removeAllClipVolumes();

    viewer.scene.pointclouds.forEach(pc => {
        if(pc.name != "blk360_battlements_pole_6_2025_potree" && pc.name != "rtc360_exterior_april2025") pc.visible = true;
    });

    viewer.setBackground("white");

    viewer.setClipTask(2);

    let vol = new Potree.BoxVolume();
    vol.position.set(-20.677, 83.789, 41.961);
    vol.rotation.set(0.000, 0.000, 0.248);
    vol.scale.set(60, 20, 95.484);

    vol.clip = true;
    vol.visible = false;

    viewer.scene.addVolume(vol);
    

    const startPos = vol.position.y;
    const targetPos = -20;
    const duration = 20000;

    let start_time;

    requestAnimationFrame(incrementVolYScale);

    function incrementVolYScale(timestamp){
        if(!start_time) start_time = timestamp;

        const t = Math.min((timestamp - start_time) / duration, 1);
        const eased = t * t * ( 3 - 2 * t);

        const posY = THREE.MathUtils.lerp(startPos, targetPos, eased);

        vol.position.set(vol.position.x, posY, vol.position.z);

        if(t < 1){
            requestAnimationFrame(incrementVolYScale);
        }
    }

    setTimeout(() => {
        viewer.scene.removeAllClipVolumes();
        setAutoSwitchState(true);
        viewer.setBackground("gradient");
    }, duration);
}