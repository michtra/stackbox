"use client"

import { STLLoader } from "three/examples/jsm/loaders/STLLoader";

/**
 * Perimeter-based proportioning method for tenant relative proportion visualization.
 * @param {float[][]} floorPlanShapes List of floor plan shapes (made of lat-lng coordinates) for single floor.
 * @param {Object} tenantList List of square footage of each tenant (key: tenant UUID, value: { sf: square footage, color: HEX color } ).
 * @param {float} totalSF Total square footage of the floor.
 * @param {number} floorNum Floor number (used for determining extrusion height, starts at 1).
 * @param {float} buildingFloorHeightMin Minimum height of floor. Determines base height of extrusion. Added for future flexibility.
 * @param {float} buildingFloorHeightMax Maximum height of floor. Determines roof of floor extrusion. Added for future flexibility.
 * @param {float} wallThickness Thickness of the wall (default is 1e-6 which is like a third of a foot (approximately)).
 * @returns List of GeoJSON Features representing an extrusion of the tenant"s wall.
 */
function proportionWall(floorPlanShapes, tenantList, totalSF, floorNum, buildingFloorHeightMin, buildingFloorHeightMax, wallThickness=1e-6) {
    if(Object.keys(tenantList).length === 0) {
        return floorPlanShapes.map((shape) => {
            return {
                "type": "Feature",
                "properties": {
                    "floor": floorNum,
                    "height": buildingFloorHeightMax - 0.5,
                    "base_height": buildingFloorHeightMin,
                    "color": "#ffffff",
                    "tenant": "Vacancy"
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [shape]
                }
            };
        });
    }

    const edgeLengths = floorPlanShapes.map((shape) => Array(shape.length).fill(0));
    const edgeOffsets = floorPlanShapes.map((shape) => Array(shape.length).fill([0, 0]));
    /*
    Calculating cumulative edge lengths for each shape to determine where tenant boundaries should be placed based on their square footage proportion.
    Also calculates edge offset vector for pushing the lines inwards and outwards for wall shape. Done by calculating normal vector of the two surrounding edges and adding them together.
    */
    let [edgeXPrev, edgeYPrev] = [0, 0];
    let [edgeX, edgeY] = [0, 0];
    let edgeLengthPrev = 0;
    let edgeLength = 0;
    floorPlanShapes.forEach((shape, shapeIndex) => {
        if(shapeIndex > 0) {
            edgeLengths[shapeIndex][0] = edgeLengths[shapeIndex-1].at(-1);
        }
        [edgeX, edgeY] = [shape[1][0] - shape[0][0], shape[1][1] - shape[0][1]];
        edgeLength = Math.sqrt(Math.pow(edgeX, 2) + Math.pow(edgeY, 2));
        for(let i = 1; i < shape.length; i++) {
            [edgeXPrev, edgeYPrev] = [edgeX, edgeY];
            edgeLengthPrev = edgeLength;
            [edgeX, edgeY] = [shape[i === shape.length - 1 ? 1 : (i+1)][0] - shape[i][0], shape[i === shape.length - 1 ? 1 : (i+1)][1] - shape[i][1]];
            edgeLength = Math.sqrt(Math.pow(edgeX, 2) + Math.pow(edgeY, 2));
            edgeLengths[shapeIndex][i] = (i === 1 ? 0 : edgeLengthPrev) + edgeLengths[shapeIndex][i-1];
            // Using right hand normal for offset direction
            edgeOffsets[shapeIndex][i] = [-((edgeYPrev / edgeLengthPrev) + (edgeY / edgeLength)) * wallThickness, ((edgeXPrev / edgeLengthPrev) + (edgeX / edgeLength)) * wallThickness];
        }
        edgeOffsets[shapeIndex][0] = edgeOffsets[shapeIndex][edgeOffsets[shapeIndex].length - 1];
    });

    /*
    Calculating cumulative tenant wall lengths based on their square footage proportion.
    */
    const tenantWallLengths = Array(Object.keys(tenantList).length).fill([0, 0]);
    Object.entries(tenantList).forEach(([tenant, tenantInfo], tenantIndex) => {
        tenantWallLengths[tenantIndex] = [tenant, edgeLengths.at(-1).at(-1) * tenantInfo["sf"] / totalSF + (tenantIndex === 0 ? 0 : tenantWallLengths[tenantIndex - 1][1])];
    });
    if(tenantWallLengths.at(-1)[1] < edgeLengths.at(-1).at(-1)) {
        tenantWallLengths.push(["Vacancy", edgeLengths.at(-1).at(-1)]);
    }

    /*
    Using binary search to find the tenant wall ends.
    */
    let currShapeIndex = 0;
    // Tenant position array, stores [shape index, edge index, proportion within edge after edge index].
    const tenantPositions = Array(Object.keys(tenantList).length).fill(["", 0, 0, 0]);
    tenantWallLengths.forEach(([tenant, wallPosition], tenantIndex) => {
        while(wallPosition > edgeLengths[currShapeIndex].at(-1)) {
            currShapeIndex++;
        }
        let [low, high, mid] = [0, edgeLengths[currShapeIndex].length - 1, 0];
        while(low < high) {
            mid = Math.floor((low + high) / 2);
            if(edgeLengths[currShapeIndex][mid] < wallPosition) {
                low = mid + 1;
            } else {
                high = mid;
            }
        }
        tenantPositions[tenantIndex] = [tenant, currShapeIndex, low <= 0 ? 0 : low - 1, (wallPosition - edgeLengths[currShapeIndex][low-1]) / (edgeLengths[currShapeIndex][low] - edgeLengths[currShapeIndex][low-1])];
    });

    /*
    Generating GeoJSON Feature for each tenant wall.
    Separates shapes if there are multiple.
    Creates wall shape using wall coordinates and reverse of wall coordinates with offset.
    */
    let tenantGeoJSONFeatures = [];
    tenantPositions.forEach(([tenant, shapeIndex, edgeIndex, edgeProportion], tenantIndex) => {
        const [prevShapeIndex, prevEdgeIndex, prevEdgeProportion] = tenantIndex === 0 ? [0, 0, 0] : [tenantPositions[tenantIndex - 1][1], tenantPositions[tenantIndex - 1][2], tenantPositions[tenantIndex - 1][3]];
        const tenantWallCoordinates = [
            [
                [
                    floorPlanShapes[prevShapeIndex][prevEdgeIndex][0] + (prevEdgeProportion * (floorPlanShapes[prevShapeIndex][prevEdgeIndex + 1][0] - floorPlanShapes[prevShapeIndex][prevEdgeIndex][0])),
                    floorPlanShapes[prevShapeIndex][prevEdgeIndex][1] + (prevEdgeProportion * (floorPlanShapes[prevShapeIndex][prevEdgeIndex + 1][1] - floorPlanShapes[prevShapeIndex][prevEdgeIndex][1]))
                ]
            ]
        ];
        const tenantWallCoordinatesOffset = [
            [
                [
                    floorPlanShapes[prevShapeIndex][prevEdgeIndex][0] + (prevEdgeProportion * (floorPlanShapes[prevShapeIndex][prevEdgeIndex + 1][0] - floorPlanShapes[prevShapeIndex][prevEdgeIndex][0])) + edgeOffsets[prevShapeIndex][prevEdgeIndex][0],
                    floorPlanShapes[prevShapeIndex][prevEdgeIndex][1] + (prevEdgeProportion * (floorPlanShapes[prevShapeIndex][prevEdgeIndex + 1][1] - floorPlanShapes[prevShapeIndex][prevEdgeIndex][1])) + edgeOffsets[prevShapeIndex][prevEdgeIndex][1]
                ]
            ]
        ];
        if(shapeIndex === prevShapeIndex) {
            for(let i = prevEdgeIndex + 1; i <= edgeIndex; i++) {
                tenantWallCoordinates[0].push([
                    floorPlanShapes[shapeIndex][i][0],
                    floorPlanShapes[shapeIndex][i][1]
                ]);
                tenantWallCoordinatesOffset[0].push([
                    floorPlanShapes[shapeIndex][i][0] + edgeOffsets[shapeIndex][i][0],
                    floorPlanShapes[shapeIndex][i][1] + edgeOffsets[shapeIndex][i][1]
                ]);
            }
        }
        else {
            for(let i = prevEdgeIndex + 1; i < floorPlanShapes[prevShapeIndex].length; i++) {
                tenantWallCoordinates[0].push([
                    floorPlanShapes[prevShapeIndex][i][0],
                    floorPlanShapes[prevShapeIndex][i][1]
                ]);
                tenantWallCoordinatesOffset[0].push([
                    floorPlanShapes[prevShapeIndex][i][0] + edgeOffsets[prevShapeIndex][i][0],
                    floorPlanShapes[prevShapeIndex][i][1] + edgeOffsets[prevShapeIndex][i][1]
                ]);
            }
            for(let i = prevShapeIndex + 1; i < shapeIndex; i++) {
                tenantWallCoordinates.push(floorPlanShapes[i]);
                tenantWallCoordinatesOffset.push(floorPlanShapes[i].map(([x, y], interShapeEdgeIndex) => [x + edgeOffsets[i][interShapeEdgeIndex][0], y + edgeOffsets[i][interShapeEdgeIndex][1]]));
            }
            tenantWallCoordinates.push([]);
            tenantWallCoordinatesOffset.push([]);
            for(let i = 0; i <= edgeIndex; i++) {
                tenantWallCoordinates[tenantWallCoordinates.length - 1].push([
                    floorPlanShapes[shapeIndex][i][0],
                    floorPlanShapes[shapeIndex][i][1]
                ]);
                tenantWallCoordinatesOffset[tenantWallCoordinatesOffset.length - 1].push([
                    floorPlanShapes[shapeIndex][i][0] + edgeOffsets[shapeIndex][i][0],
                    floorPlanShapes[shapeIndex][i][1] + edgeOffsets[shapeIndex][i][1]
                ]);
            }
        }
        tenantWallCoordinates[tenantWallCoordinates.length - 1].push([
            floorPlanShapes[shapeIndex][edgeIndex][0] + (edgeProportion * (floorPlanShapes[shapeIndex][edgeIndex + 1][0] - floorPlanShapes[shapeIndex][edgeIndex][0])),
            floorPlanShapes[shapeIndex][edgeIndex][1] + (edgeProportion * (floorPlanShapes[shapeIndex][edgeIndex + 1][1] - floorPlanShapes[shapeIndex][edgeIndex][1]))
        ]);
        tenantWallCoordinatesOffset[tenantWallCoordinatesOffset.length - 1].push([
            floorPlanShapes[shapeIndex][edgeIndex][0] + (edgeProportion * (floorPlanShapes[shapeIndex][edgeIndex + 1][0] - floorPlanShapes[shapeIndex][edgeIndex][0])) + edgeOffsets[shapeIndex][edgeIndex][0],
            floorPlanShapes[shapeIndex][edgeIndex][1] + (edgeProportion * (floorPlanShapes[shapeIndex][edgeIndex + 1][1] - floorPlanShapes[shapeIndex][edgeIndex][1])) + edgeOffsets[shapeIndex][edgeIndex][1]
        ]);

        tenantWallCoordinates.forEach((wall, wallIndex) => {
            tenantGeoJSONFeatures.push({
                "type": "Feature",
                "properties": {
                    "floor": floorNum,
                    "height": buildingFloorHeightMax - 0.5,
                    "base_height": buildingFloorHeightMin,
                    "color": tenant !== "Vacancy" ? tenantList[tenant]["color"] : "#ffffff", // TODO: Implement color system
                    "tenant": tenant
                },
                "geometry": {
                    "coordinates": [
                        [
                            ...wall,
                            ...tenantWallCoordinatesOffset[wallIndex].reverse(),
                            wall[0]
                        ]
                    ],
                    "type": "Polygon"
                }
            });
        });
    });
    floorPlanShapes.map((shape) => {
        tenantGeoJSONFeatures.push({
            "type": "Feature",
            "properties": {
                "floor": floorNum,
                "height": buildingFloorHeightMax - 0.4,
                "base_height": buildingFloorHeightMax - 0.5,
                "color": "#ffffff",
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [shape]
            }
        });
    });
    return tenantGeoJSONFeatures;
}

/**
 * Proportioning all floors. Assumes JSON has data for each floors.
 * @param {Object} stackingData JSON data from building data retrieval endpoint. Requires tenant and floor data. See schema for details.
 * @returns List of GeoJSON Features representing an extrusion of the tenant"s wall for all floors.
 */
function proportionBuilding(stackingData) {
    const floorPlanShapesList = stackingData["geometries"];
    const tenantList = Array(Object.keys(stackingData["floors"]).length);
    const totalSFList = Array(Object.keys(stackingData["floors"]).length).fill(0);
    const buildingFloorHeightMinList = Array(Object.keys(stackingData["floors"]).length).fill(0);
    const buildingFloorHeightMaxList = Array(Object.keys(stackingData["floors"]).length).fill(0);

    /*
    Extracting tenant and floor data from JSON for each floor.
    */
    const tenantObject = tenantJSONToObject(stackingData["tenants"]);
    stackingData["floors"].forEach((floorData) => {
        tenantList[floorData["floorNumber"] - 1] = {};
        floorData["occupancies"].forEach((occupancyData) => {
            tenantList[floorData["floorNumber"] - 1][`${occupancyData["tenantId"]}`] = {
                "sf": occupancyData["squareFeet"]["parsedValue"],
                "color": tenantObject[occupancyData["tenantId"]]["color"]
            };
        });
        totalSFList[floorData["floorNumber"] - 1] = floorData["squareFeet"]["parsedValue"];
    });

    /*
    Calculating base and roof heights for each floor.
    */
    const buildingFloorHeight = stackingData["building"]["metadata"]["heightMeters"]["parsedValue"] / stackingData["building"]["metadata"]["totalFloors"];
    let currHeight = 0;
    for(let i = 0; i < buildingFloorHeightMinList.length; i++) {
        buildingFloorHeightMinList[i] = currHeight;
        currHeight += buildingFloorHeight;
        buildingFloorHeightMaxList[i] = currHeight;
    }

    const geoJSONFeatures = {
        "type": "geojson",
        "data": {
            "type": "FeatureCollection",
            "features": []
        }
    };

    for(let i = 0; i < stackingData["building"]["metadata"]["totalFloors"]; i++) {
        geoJSONFeatures["data"]["features"].push(...proportionWall(floorPlanShapesList[i], tenantList[i], totalSFList[i], i + 1, buildingFloorHeightMinList[i], buildingFloorHeightMaxList[i]));
    }
    return geoJSONFeatures;
}

function tenantJSONToObject(tenantJSON) {
    let tenantObject = {};
    tenantJSON.forEach((tenant) => {
        tenantObject[tenant["id"]] = {
            "name": tenant["name"],
            "color": tenant["color"],
            "contact": tenant["contact"],
            "createdAt": tenant["createdAt"],
            "updatedAt": tenant["updatedAt"]
        };
    });
    return tenantObject;
}


function propertyListingToGeoJSONFeatures(propertyListingData) {
    const geoJSONFeatures = {
        "type": "geojson",
        "data": {
            "type": "FeatureCollection",
            "features": []
        },
        "cluster": true,
        "clusterMaxZoom": 20,
        "clusterRadius": 50
    };
    propertyListingData.data.forEach((building) => {
        geoJSONFeatures.data.features.push({
            "type": "Feature",
            "properties": {
                "id": building.id,
                "name": building.name,
                "street": building.street,
                "city": building.city,
                "state": building.state,
                "zip": building.zip,
                "country": building.country,
            },
            "geometry": {
                "coordinates": [
                    building.location.longitude.parsedValue,
                    building.location.latitude.parsedValue,
                ],
                "type": "Point"
            }
        });
    });
    return geoJSONFeatures;
}


function loadAdjustmentsBuildingMesh(src, modelProps, mapRef=null) {
    const loader = new STLLoader();
    loader.load(src, (geometry) => {
        if (mapRef) {
            // Removing the old model
            if (modelProps.modelRef.current) {
                modelProps.modelRef.current.removeFromParent?.();
                if (modelProps.modelRef.current.parent) {
                    modelProps.modelRef.current.parent.remove(modelRef.current);
                }
                modelProps.modelRef.current = null;
            }

            if (modelProps.meshRef.current) {
                modelProps.meshRef.current.geometry?.dispose?.();
                if (Array.isArray(modelProps.meshRef.current.material)) {
                    modelProps.meshRef.current.material.forEach((m) => m?.dispose?.());
                } else {
                    modelProps.meshRef.current.material?.dispose?.();
                }
                modelProps.meshRef.current = null;
            }
        }

        // Compensating for the fact that Trimesh starts z-axis on min bounding box
        geometry.computeBoundingBox();
        geometry.translate(0, 0, -geometry.boundingBox.min.z);

        const material = new THREE.MeshPhongMaterial({ color: 0xeeeeee });
        modelProps.meshRef.current = new THREE.Mesh(geometry, material);

        modelProps.modelRef.current = window.tb.Object3D({
            obj: modelProps.meshRef.current,
            units: 'meters',
            draggable: true,
        });
        modelProps.modelRef.current.setCoords([modelProps.coordLng, modelProps.coordLat]);
        modelProps.modelRef.current.setRotation({ x: 0, y: 0, z: modelProps.rotation });
        const currScale = 10 ** modelProps.scale;
        modelProps.modelRef.current.model.scale.set(currScale, currScale, currScale);

        window.tb.add(modelProps.modelRef.current);
        window.tb.altitudeStep = 0;

        // Drag listener
        modelProps.modelRef.current.addEventListener("ObjectDragged", (e) => {
            modelProps.setCoordLng(e.detail.draggedObject.coordinates[0])
            modelProps.setCoordLat(e.detail.draggedObject.coordinates[1])
            const newRotation = e.detail.draggedObject.rotation.z * 180 / Math.PI % 360; // For some reason, setting rotation is in degrees and getting rotation is in radians
            modelProps.setRotation(newRotation)
            modelProps.modelRef.current.setRotation({ x: 0, y: 0, z: newRotation }); // In case someone Beyblades the building
        });

        if (mapRef) {
            mapRef.current.triggerRepaint();
        }
    });
}

export { proportionBuilding, propertyListingToGeoJSONFeatures, loadAdjustmentsBuildingMesh };