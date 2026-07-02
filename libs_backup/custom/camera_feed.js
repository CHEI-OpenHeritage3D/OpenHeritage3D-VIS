
style.textContent += `
#ar-container {
    position: fixed;
    inset: 0;
    overflow: hidden;
}

#webcam {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    z-index: 0;
}

#potree_render_area {
    position: absolute;
    inset: 0;
    z-index: 1;
}
`;

async function createWebcamBackground() {
    const video = document.createElement("video");


    viewer.setBackground("transparent");
    viewer.renderer.setClearColor(0x000000, 0); // alpha = 0


    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;

    video.style.position = "absolute";
    video.style.top = "0";
    video.style.left = "0";
    video.style.width = "100%";
    video.style.height = "100%";
    video.style.objectFit = "cover";
    video.style.zIndex = "0";

    const stream = await navigator.mediaDevices.getUserMedia({
        video: {
            facingMode: "environment", // rear camera on mobile
            width: { ideal: 1280 },
            height: { ideal: 720 }
        },
        audio: false
    });

    video.srcObject = stream;
    document.body.appendChild(video);

    return video;
}
