 let pTime = Cesium.JulianDate.fromIso8601('2021-02-12T08:45:00+03');

        // let clock = new Cesium.Clock({
        //     startTime: pTime,
        //     currentTime: pTime,
        //     clockRange: Cesium.ClockRange.LOOP_STOP,
        //     clockStep: Cesium.ClockStep.SYSTEM_CLOCK_MULTIPLIER,
        //     multiplier: 3600.0
        // });

        const providerViewModels = Cesium.createDefaultImageryProviderViewModels();


        Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI0YjA5NWU1YS00MTE0LTQ5YTctOWFhNy0xN2EwNmU2NzgwZjkiLCJpZCI6NTYzOTUsImlhdCI6MTY0MjQzODc4MH0.3yyDeYbXe0TPJHNobfwSL5WFXhnTLwn9yz6LOu79tBc';
        window.cesiumViewer = new Cesium.Viewer('cesiumContainer', {
            // useDefaultRenderLoop: false,
            animation: false,
            // baseLayerPicker: false,
            fullscreenButton: false,
            geocoder: false,
            homeButton: false,
            // infoBox: false,
            // sceneModePicker: false,
            // selectionIndicator: false,
            // skyAtmosphere: false,
            // groundAtmosphere: false,
            // timeline: false,
            navigationHelpButton: false,
            // clockViewModel: new Cesium.ClockViewModel(clock),
            imageryProviderViewModels: providerViewModels,
            // imageryProvider: Cesium.createWorldImagery({
            // 	style: Cesium.IonWorldImageryStyle.AERIAL_WITH_LABELS
            // }),
            sceneMode: Cesium.SceneMode.COLUMBUS_VIEW,
            terrainProvider: Cesium.createWorldTerrain({
                requestWaterMask: false,
                requestVertexNormals: true
            }),

            terrainShadows: Cesium.ShadowMode.ENABLED,

        });


        function createNewViewModel({ name, tooltip, layer, id, format, units, min, max, legend = true }) {
            const now = Cesium.JulianDate.now();
            const past = Cesium.JulianDate.now();
            // Cesium.JulianDate.addDays(now, -7, now);
            Cesium.JulianDate.addDays(now, -2, past);
            const times = Cesium.TimeIntervalCollection.fromIso8601({
                iso8601: `${Cesium.JulianDate.toIso8601(past, 0)}/${Cesium.JulianDate.toIso8601(now, 0)}`,
                leadingInterval: true,
                trailingInterval: true,
                isStopIncluded: false,
                dataCallback: dataCallback,
            });
            let providerViewModel = new Cesium.ProviderViewModel({
                name: name,
                tooltip: tooltip,
                category: "Other",
                iconUrl: "libs/Cesium/Widgets/Images/ImageryProviders/bingAerial.png",
                creationFunction: () => {
                    const provider = new Cesium.WebMapTileServiceImageryProvider({
                        url:
                            `https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/${layer}/default/{Time}/{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}.${format}`,
                        layer: layer,
                        style: "default",
                        tileMatrixSetID: id,
                        maximumLevel: 5,
                        format: `image/${format}`,
                        clock: cesiumViewer.clock,
                        times: times,
                        credit: "NASA Global Imagery Browse Services for EOSDIS",
                        tilingScheme: gibs.GeographicTilingScheme()
                    });
                    // update legend
                    if (legend) {
                        var qs = document.querySelector.bind(document);
                        qs('.scale .legend-title').textContent = units
                        qs('.legend-colorbar').setAttribute('src', `images/${layer}.png`);
                        qs('.legend-max').innerHTML = max;
                        qs('.legend-min').innerHTML = min;
                        qs('#legend .single').style.display = 'none';
                        qs('#legend .scale').style.display = 'block';
                        qs('#legend').style.display = 'block';
                    } else {
                        var qs = document.querySelector.bind(document);
                        qs('#legend').style.display = 'none';
                    }
                    // Make the weather layer semi-transparent to see the underlying geography.
                    provider.defaultAlpha = .5;
                    return [providerViewModels[1].creationCommand(), provider]

                }
            })
            providerViewModels.push(providerViewModel);
            cesiumViewer.baseLayerPicker.viewModel.imageryProviderViewModels = providerViewModels;
        }

        createNewViewModel({
            name: "MODIS Terra Corrected Reflectance",
            tooltip: "Realtime weather data from NASA Global Imagery",
            layer: "MODIS_Terra_CorrectedReflectance_TrueColor",
            id: "250m",
            format: "jpg",
            legend: false
        });

        createNewViewModel({
            name: "Aerosols",
            tooltip: "Realtime aerosols data",
            layer: "MODIS_Terra_Aerosol",
            id: "2km",
            format: "png",
            units: "Optical Depth",
            min: "0.0",
            max: "⩾ 5.0",
        });
        createNewViewModel({
            name: "Infrared",
            tooltip: "Infrared",
            layer: "GOES-East_ABI_Band13_Clean_Infrared",
            id: "2km",
            format: "png",
            units: "Temperature",
            min: "-92℃",
            max: "> 57℃"
        });

        createNewViewModel({
            name: "Carbon Monoxide",
            tooltip: "Carbon Monoxide (L2, 500hPa, Day, v6, Near Real-Time, AIRS, Aqua)",
            layer: "AIRS_L2_Carbon_Monoxide_500hPa_Volume_Mixing_Ratio_Day",
            id: "2km",
            format: "png",
            units: "Concentration",
            min: "0.0 ppbv",
            max: "> 350.0 ppbv"
        });

        // Remove non-functional layers from baseLayerPicker
        cesiumViewer.baseLayerPicker.viewModel.imageryProviderViewModels =
            cesiumViewer.baseLayerPicker.viewModel.imageryProviderViewModels.filter((providerViewModel) => {
                let itemsToRemove = ["Blue Marble", "Earth at night", "Sentinel-2"];
                return !itemsToRemove.includes(providerViewModel.name)
            });

        let cp = new Cesium.Cartesian3(4303414.154026048, 552161.235598733, 4660771.704035539);
        cesiumViewer.camera.setView({
            destination: cp,
            orientation: {
                heading: 10,
                pitch: -Cesium.Math.PI_OVER_TWO * 0.5,
                roll: 0.0
            }
        });

        function dataCallback(interval, index) {
            let time;
            if (index === 0) {
                // leading
                time = Cesium.JulianDate.toIso8601(interval.stop);
            } else {
                time = Cesium.JulianDate.toIso8601(interval.start);
            }

            return {
                Time: time,
            };
        }