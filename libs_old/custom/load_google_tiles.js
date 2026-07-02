import * as THREE from "./libs/three.js/build/three.module.js";

import { TilesRenderer } from "./libs/3d-tiles-renderer/build/index.three.js";
import { DRACOLoader } from "./libs/three.js/examples/jsm/loaders/DRACOLoader.js";

import {
    TilesFadePlugin,
    GLTFExtensionsPlugin,
    TileCompressionPlugin,
    ReorientationPlugin,
    DebugTilesPlugin
} from "./libs/3d-tiles-renderer/build/index.three-plugins.js";


window.setupTiles = () => {
    //tile set up
    const API_KEY = "AIzaSyC2fiTkaaE_VdbSi5J286d-deBe88unVGs";
    // AIzaSyD2im4uSnZQefEFJIlfSpSD39apMdiiKFE iconem key
    // Extract session once, from the root URL
    const rootUrl = `https://tile.googleapis.com/v1/3dtiles/root.json?key=${API_KEY}`;
    let SESSION = new URL(rootUrl).searchParams.get("session");

    const tiles = new TilesRenderer(rootUrl);

    // const dracoLoader = new DRACOLoader();
    // dracoLoader.setDecoderPath("./libs/three.js/examples/jsm/libs/draco/gltf/"); 
    // // This directory must contain draco_decoder.js and draco_wasm_wrapper.js

    // tiles.manager.getHandler("gltf").parser.dracoLoader = dracoLoader;

    tiles.preprocessURL = (uri) => {

        if (uri.startsWith("/")) {
            uri = "https://tile.googleapis.com" + uri;
        }

        const u = new URL(uri);

        // Capture session when Google provides it
        if (u.searchParams.has("session") && !SESSION) {
            SESSION = u.searchParams.get("session");
            console.log("Captured Google session:", SESSION);
        }

        // Inject session everywhere else
        if (!u.searchParams.has("session") && SESSION) {
            u.searchParams.set("session", SESSION);
        }

        // Always add API key
        if (!u.searchParams.has("key")) {
            u.searchParams.set("key", API_KEY);
        }

        return u.toString();
    };




    tiles.setCamera(viewer.scene.getActiveCamera());
    tiles.setResolutionFromRenderer(viewer.scene.getActiveCamera(), viewer.renderer);

    tiles.registerPlugin(new TilesFadePlugin());
    tiles.registerPlugin(new ReorientationPlugin());
    tiles.registerPlugin(new TileCompressionPlugin());
    tiles.registerPlugin(new GLTFExtensionsPlugin());
    tiles.registerPlugin(new DebugTilesPlugin());

    // tiles.addEventListener("tile-download-start", (e) => {
    // 	console.log("Fetching tile:", e);
    // });

    let sphere;
    let pointOnSurface
            
    tiles.addEventListener("load-root-tileset", (e) => {

        console.log('loading root: ', e);
        sphere = new THREE.Sphere();
        tiles.getBoundingSphere(sphere);
        console.log('sphere: ', sphere);
        pointOnSurface = new THREE.Vector3(1,0,0).multiplyScalar(sphere.radius);
        // Center Google tiles
        tiles.group.position.copy(sphere.center).multiplyScalar(-1);

        // Force Potree camera to Google space
        const cam = viewer.scene.getActiveCamera();

        cam.position.set(
            sphere.center.x * -1,
            sphere.center.y * -1,
            sphere.center.z * -1 + sphere.radius * 1.5
        );

        cam.lookAt(0, 0, 0);

        // // Potree's internal view also must be updated
        // viewer.scene.view.position.copy(cam.position);
        // viewer.scene.view.lookAt(new THREE.Vector3(0,0,0));
    });



    tiles.addEventListener("load-model", e => {
        // console.log("Loaded model tile", e.tile);
    });
    console.log(tiles);


    viewer.scene.scene.add(tiles.group);

    renderTiles();

    viewer.scene.getActiveCamera().updateMatrixWorld();

    function renderTiles(){
        requestAnimationFrame(renderTiles);
        

        tiles.update();
    }

}
