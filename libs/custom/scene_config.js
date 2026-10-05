// SceneConfig — the `sceneConfig` block of a schema-2 zones.json.
class SceneConfig {

    constructor(json = {}, baseURL = window.location.href) {
        this.raw = json;
        this.baseURL = baseURL;                          // URL of zones.json; relative cloud URLs resolve against it
        this.viewerSettings = json.viewer || {};
        this.camera = json.camera || null;               // { position: [x,y,z], target: [x,y,z] }
        this.startZones = json.startZones || [];
        this.classificationEdits = json.classificationEdits || [];
        this.pointclouds = json.pointclouds || {};       // id -> { label, url, visible, transform, material }
        this.loaded = new Map();                         // id -> Potree point cloud
    }

    resolveURL(url) {
        return new URL(url, this.baseURL).href;
    }

    applyViewerSettings(viewer) {
        const v = this.viewerSettings;
        if (v.pointBudget !== undefined) viewer.setPointBudget(v.pointBudget);
        if (v.fov !== undefined) viewer.setFOV(v.fov);
        if (v.background !== undefined) viewer.setBackground(v.background);
        if (v.edl?.enabled !== undefined) viewer.setEDLEnabled(v.edl.enabled);
        if (v.clipTask !== undefined) viewer.setClipTask(v.clipTask);
    }

    applyCamera(viewer) {
        if (!this.camera) return;
        viewer.scene.view.position.set(...this.camera.position);
        viewer.scene.view.lookAt(new THREE.Vector3(...this.camera.target));
    }

    async loadPointClouds(viewer) {
        const ids = Object.keys(this.pointclouds);

        // Potree.loadPointCloud's promise never settles on failure, so each load gets a timeout.
        const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);

        const results = await Promise.allSettled(ids.map(id =>
            withTimeout(Potree.loadPointCloud(this.resolveURL(this.pointclouds[id].url), id), 60000)
        ));

        // add in declaration order, not completion order
        results.forEach((r, i) => {
            const id = ids[i];
            if (r.status !== "fulfilled") {
                console.warn(`[SceneConfig] failed to load "${id}":`, r.reason);
                return;
            }
            const entry = this.pointclouds[id];
            const pc = r.value.pointcloud;

            pc.name = id;
            pc.userData.label = entry.label || id;
            this.applyTransform(pc, entry.transform);
            this.applyMaterial(pc, entry.material);
            pc.visible = entry.visible !== false;

            viewer.scene.addPointCloud(pc);
            this.loaded.set(id, pc);
        });
    }

    // translation is a delta from the octree offset; rotation in degrees
    applyTransform(pc, t) {
        if (!t) return;
        if (t.translation) pc.position.add(new THREE.Vector3(...t.translation));
        if (t.rotation) pc.rotation.set(...t.rotation.map(d => d * Math.PI / 180));
        if (t.scale) pc.scale.set(...t.scale);
    }

    applyMaterial(pc, m) {
        if (!m) return;
        const mat = pc.material;
        if (m.ranges?.intensity) mat.intensityRange = m.ranges.intensity;
        if (m.ranges?.elevation) mat.elevationRange = m.ranges.elevation;
        if (m.gradient) mat.gradient = m.gradient.map(([t, c]) => [t, new THREE.Color(...c)]);
        if (m.color) mat.color = new THREE.Color(...m.color);
        if (m.shape) mat.shape = Potree.PointShape[m.shape.toUpperCase()];
        if (m.sizeType) mat.pointSizeType = Potree.PointSizeType[m.sizeType.toUpperCase()];
        if (m.minSize !== undefined) mat.minSize = m.minSize;
        if (m.attribute) mat.activeAttributeName = m.attribute;
    }

    toJSON() {
        return this.raw;
    }
}