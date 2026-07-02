// Written by jo-chemla of Iconem

  const computeCrsTransform = (
    sourceCrsOriginCoords,
    sourceCrsProj,
    targetCrsProj
  ) => {
    let sourceCrsDefinition =
      sourceCrsProj || "+proj=longlat +datum=WGS84 +no_defs";
    const targetCrsDefinition =
      targetCrsProj || "+proj=longlat +datum=WGS84 +no_defs";
    
    // Attempt to use sourceCrsProj if defined; otherwise, define and use 'sourceCRS'
    let sourceCRS = proj4.defs(sourceCrsProj) ? sourceCrsProj : "sourceCRS";
    if (!proj4.defs(sourceCrsProj)) {
        console.log('source undeinfed');
      proj4.defs(sourceCRS, sourceCrsDefinition);
    }

    // Attempt to use targetCrsProj if defined; otherwise, define and use 'targetCRS'
    let targetCRS = proj4.defs(targetCrsProj) ? targetCrsProj : "targetCRS";
    if (!proj4.defs(targetCrsProj)) {
      proj4.defs(targetCRS, targetCrsDefinition);
    }

    const transformProj = proj4(sourceCRS, targetCRS);
    // Use first scene position as origin of transformation

    const originInSourceCoords = Array.isArray(sourceCrsOriginCoords) ? new THREE.Vector3(...sourceCrsOriginCoords) : sourceCrsOriginCoords; // converts to vector3 if not already

    const originInTargetCoords = new THREE.Vector3().fromArray(
      transformProj.forward(originInSourceCoords.toArray())
    );

    const scale = 1000;

    const xVector = new THREE.Vector3().fromArray(
      transformProj.forward(
        originInSourceCoords
          .clone()
          .add(new THREE.Vector3(scale, 0, 0))
          .toArray()
      )
    );
    const yVector = new THREE.Vector3().fromArray(
      transformProj.forward(
        originInSourceCoords
          .clone()
          .add(new THREE.Vector3(0, scale, 0))
          .toArray()
      )
    );
    // Optionally compute zVector for full 3D transformation
    // const zVector = new THREE.Vector3().fromArray(
    //   transformProj.forward(
    //     originInSourceCoords.clone().add(new THREE.Vector3(0, 0, scale)).toArray()
    //   )
    // );

    const ox = xVector.clone().sub(originInTargetCoords.clone());
    const oy = yVector.clone().sub(originInTargetCoords.clone());

    // For oz, seems like we can cross-vectors and results are almost similar
    // + remove warning of non unit scale in all directions by 3dtilesrenderer
    // const oz = z.clone().sub(origin_datasetCrs.clone());
    // oz.divideScalar(scale);
    ox.divideScalar(scale);
    oy.divideScalar(scale);
    const oz = new THREE.Vector3().crossVectors(ox, oy);

    const rot_scene_to_dataset = new THREE.Matrix4().makeBasis(ox, oy, oz);
    const rot_dataset_to_scene = rot_scene_to_dataset.clone().invert();
    const trans_zeroToScene = new THREE.Matrix4().makeTranslation(
      ...originInSourceCoords.toArray()
    );
    const minus_origin_datasetCrs = originInTargetCoords
      .clone()
      .multiplyScalar(-1);
    const trans_datasetToZero = new THREE.Matrix4().makeTranslation(
      ...minus_origin_datasetCrs.toArray()
    );

    const matrixTransform = new THREE.Matrix4()
      .multiply(trans_zeroToScene)
      .multiply(rot_dataset_to_scene)
      .multiply(trans_datasetToZero);

    return matrixTransform;
  };