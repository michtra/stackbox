
/**
 * Perimeter-based proportioning method for tenant relative proportion visualization.
 * @param {float[][]} floorPlanShapes List of floor plan shapes (made of lat-lng coordinates) for single floor
 * @param {Object} tenantList List of square footage of each tenant (key: tenant name, value: { sf: square footage, color: HEX color } )
 * @param {float} totalSF Total square footage of the floor
 * @param {number} floorNum Floor number (used for determining extrusion height, starts at 1)
 * @param {float} buildingFloorHeight Height of each floor in the building (used for determining extrusion height)
 * @param {float} wallThickness Thickness of the "wall" (default is 1e-6 which is like a third of a foot (approximately))
 * @returns List of GeoJSON Features representing an extrusion of the tenant's "wall"
 */
function proportionWall(floorPlanShapes, tenantList, totalSF, floorNum, buildingFloorHeight, wallThickness=1e-6) {
    if(Object.keys(tenantList).length === 0) {
        return floorPlanShapes.map((shape) => {
            return {
                'type': 'Feature',
                'properties': {
                    'floor': floorNum,
                    'height': floorNum*buildingFloorHeight,
                    'base_height': (floorNum-1)*buildingFloorHeight + 0.5,
                    'color': '#ffffff',
                    'tenant': 'Vacancy'
                },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': [shape]
                }
            };
        });
    }

    const edgeLengths = floorPlanShapes.map((shape) => Array(shape.length).fill(0));
    const edgeOffsets = floorPlanShapes.map((shape) => Array(shape.length).fill([0, 0]));
    /*
    Calculating cumulative edge lengths for each shape to determine where tenant boundaries should be placed based on their square footage proportion.
    Also calculates edge offset vector for pushing the lines inwards and outwards for wall shape.
    */
    let edgeLength = 0;
    let [edgeX, edgeY] = [0, 0];
    floorPlanShapes.forEach((shape, shapeIndex) => {
        if(shapeIndex > 0) {
            edgeLengths[shapeIndex][0] = edgeLengths[shapeIndex-1].at(-1);
        }
        for(let i = 1; i < shape.length; i++) {
            [edgeX, edgeY] = [shape[i][0] - shape[i-1][0], shape[i][1] - shape[i-1][1]];
            edgeLength = Math.sqrt(Math.pow(edgeX, 2) + Math.pow(edgeY, 2));
            edgeLengths[shapeIndex][i] = edgeLength + edgeLengths[shapeIndex][i-1];
            // Using right hand normal for offset direction
            edgeOffsets[shapeIndex][i-1] = [edgeY / edgeLength * wallThickness, -edgeX / edgeLength * wallThickness];
        }
        edgeOffsets[shapeIndex][edgeOffsets[shapeIndex].length - 1] = edgeOffsets[shapeIndex][0];
    });

    /*
    Calculating cumulative tenant "wall" lengths based on their square footage proportion.
    */
    const tenantWallLengths = Array(Object.keys(tenantList).length).fill(0);
    Object.entries(tenantList).forEach(([tenant, tenantInfo]) => {
        tenantWallLengths.push([tenant, tenantInfo['sf'] / totalSF * edgeLengths.at(-1).at(-1) + tenantWallLengths.at(-1)])
    });

    /*
    Using binary search to find the tenant wall ends.
    */
    currShapeIndex = 0;
    // Tenant position array, stores [shape index, edge index, proportion within edge after edge index].
    const tenantPositions = Array(Object.keys(tenantList).length).fill(["", 0, 0, 0]);
    tenantWallLengths.forEach(([tenant, wallPosition], tenantIndex) => {
        while(wallPosition > edgeLengths[currShapeIndex].at(-1)) {
            currShapeIndex++;
        }
        let [low, high] = [0, edgeLengths[currShapeIndex].length - 1];
        while(low < high) {
            mid = Math.floor((low + high) / 2);
            if(edgeLengths[currShapeIndex][mid] < wallPosition) {
                low = mid + 1;
            } else {
                high = mid;
            }
        }
        tenantPositions[tenantIndex] = [tenant, currShapeIndex, low - 1, (wallPosition - edgeLengths[currShapeIndex][low-1]) / (edgeLengths[currShapeIndex][low] - edgeLengths[currShapeIndex][low-1])];
    });

    /*
    Generating GeoJSON Feature for each tenant wall.
    Separates shapes if there are multiple.
    Creates "wall" shape using wall coordinates and reverse of wall coordinates with offset.
    */
    tenantGeoJSONFeatures = [];
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
                'type': 'Feature',
                'properties': {
                    'floor': floorNum,
                    'height': floorNum*buildingFloorHeight,
                    'base_height': (floorNum-1)*buildingFloorHeight + 0.5,
                    'color': tenantList[tenant]['color'],
                    'tenant': tenant
                },
                'geometry': {
                    'coordinates': [
                        ...wall,
                        ...tenantWallCoordinatesOffset[wallIndex].reverse()
                    ],
                    'type': 'Polygon'
                }
            });
        });
    });
}