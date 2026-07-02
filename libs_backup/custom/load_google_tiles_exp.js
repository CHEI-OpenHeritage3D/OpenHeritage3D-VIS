
import * as THREE from "https://pointcloud.ucsd.edu/aviral/dev/florence_digital_atlas/libs/three.js/build/three.module.js";

import { TilesRenderer } from "https://pointcloud.ucsd.edu/aviral/dev/florence_digital_atlas/libs/3d-tiles-renderer/build/index.three.js";
import { GLTFLoader } from "https://pointcloud.ucsd.edu/aviral/dev/florence_digital_atlas/libs/three.js/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "https://pointcloud.ucsd.edu/aviral/dev/florence_digital_atlas/libs/three.js/examples/jsm/loaders/DRACOLoader.js";

import {
    TilesFadePlugin,
    GLTFExtensionsPlugin,
    TileCompressionPlugin,
    ReorientationPlugin,
    DebugTilesPlugin
} from "https://pointcloud.ucsd.edu/aviral/dev/florence_digital_atlas/libs/3d-tiles-renderer/build/index.three-plugins.js";




    //tile set up
    const API_KEY = "AIzaSyC2fiTkaaE_VdbSi5J286d-deBe88unVGs";
    // AIzaSyD2im4uSnZQefEFJIlfSpSD39apMdiiKFE iconem key
    // Extract session once, from the root URL
    const rootUrl = `https://tile.googleapis.com/v1/3dtiles/root.json?key=${API_KEY}`;
    let SESSION = new URL(rootUrl).searchParams.get("session");


    const tiles = new TilesRenderer(rootUrl);

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath(
    "https://pointcloud.ucsd.edu/aviral/dev/florence_digital_atlas/libs/three.js/examples/jsm/libs/draco/gltf/"
);

const loader = new GLTFLoader(tiles.manager);
loader.setDRACOLoader(dracoLoader);

tiles.manager.addHandler(/\.(gltf|glb)$/g, loader);



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
    tiles.registerPlugin(new TileCompressionPlugin());
    tiles.registerPlugin(new GLTFExtensionsPlugin());
    tiles.registerPlugin(new DebugTilesPlugin());

    // const lat = THREE.MathUtils.degToRad(43.7697307769089);
    // const lon = THREE.MathUtils.degToRad(11.255632597357678);
    // const height = 123;

    // const reorientPlugin = new ReorientationPlugin({
    //         lon,
    //         lat,
    //         height,
    //         up: '+y',
    //         recenter: false,
    //     });
    // tiles.registerPlugin(reorientPlugin);

    // tiles.addEventListener("tile-download-start", (e) => {
    // 	console.log("Fetching tile:", e);
    // });

    let sphere;
    let pointOnSurface;
    let siteLocal;

    const sourceCoordsFlorence = [4524469.187, 900688.653, 4389749.887];

    const sourceCoordsTikal = [39870.289, -6094141.722, 1876174.601];

    const sourceCoordsAC = [-2,497,823.652,	-4,667,400.773,	3,545,753.227];


    const sourceCrs = "EPSG:4978";


    const targetCrsFlorence = "EPSG:32632";

    const targetCrsTikal = "EPSG:32615";

    const targetCrsAC = "Albers";


    proj4.defs("EPSG:4978", "+proj=geocent +datum=WGS84 +units=m +no_defs");

    proj4.defs("EPSG:32632", "+proj=utm +zone=32 +datum=WGS84 +units=m +no_defs");

    proj4.defs("EPSG:32615", "+proj=utm +zone=15 +datum=WGS84 +units=m +no_defs");

    proj4.defs("Albers", "+proj=aea +lat_0=0 +lon_0=-120 +lat_1=34 +lat_2=40.5 +x_0=0 +y_0=-4000000 +datum=NAD83 +units=m +no_defs +type=crs");

    console.log(proj4("EPSG:4978", "EPSG:4326", sourceCoordsTikal));

    const transformMatrix = computeCrsTransform(sourceCoordsAC, sourceCrs, targetCrsAC);

    console.log('transformation matrix: ', transformMatrix);

    // console.log(proj4("EPSG:4978", "EPSG:4326", sourceCoords));

    viewer.scene.pointclouds.forEach(pc => {
        if(pc.name === "nv5_la_county_2023") pc.applyMatrix4(transformMatrix);
        
    });
    
            
    tiles.addEventListener("load-root-tileset", () => {

        console.log('tiles laodig');

        sphere = new THREE.Sphere();
        tiles.getBoundingSphere(sphere);
        console.log(sphere);

        // const florencePivot = new THREE.Object3D();
        // viewer.scene.scene.add(florencePivot);

        // Attach globe to pivot
        // florencePivot.add(tiles.group);

        // Rotate about Florence ENU axis
        // florencePivot.rotateY(Math.PI);

        // reorientPlugin.transformLatLonHeightToOrigin(lat, lon, height);
        // 681542.150, 4848758.050, 79.830
        // tiles.group.position.set(tiles.group.position.x + 681542.150, tiles.group.position.y - 79.830, tiles.group.position.z - 4848758.050);
        // tiles.group.position.add(new THREE.Vector3(-681533.41, 79.830, 4848770.57));
        // tiles.group.position.add(new THREE.Vector3(-681536.150, 79.830, 4848768.050));

        
        // tiles.group.applyMatrix4(transformMatrix);

        console.log('rotation: ', tiles.group.rotation);
// THREE.MathUtils.degToRad(11.254260)

        console.log(tiles);
    });



    tiles.addEventListener("load-model", e => {
        // console.log("Loaded model tile", e.tile);
    });
    console.log(tiles);


    viewer.scene.scene.add(tiles.group);
    tiles.group.position.set(0,0,0);

    renderTiles();

    viewer.scene.getActiveCamera().updateMatrixWorld();

    function renderTiles(){
        requestAnimationFrame(renderTiles);
        

        tiles.update();
    }
