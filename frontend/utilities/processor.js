
/**
 * Perimeter-based proportioning method for tenant relative proportion visualization.
 * @param {float[][]} floorPlanShapes List of floor plan shapes (made of lat-lng coordinates) for single floor
 * @param {Object} tenantSFList List of square footage of each tenant (key: tenant name, value: square footage)
 * @param {float} totalSF Total square footage of the floor
 * @param {number} floorNum Floor number (used for determining extrusion height)
 * @param {float} buildingFloorHeight Height of each floor in the building (used for determining extrusion height)
 * @returns List of GeoJSON Features representing an extrusion of the tenant's "wall"
 */
function proportionWall(floorPlanShapes, tenantSFList, totalSF, floorNum, buildingFloorHeight) {
    const edgeLengths = floorPlanShapes.map((shape) => Array(shape.length - 1));
    // Calculating cumulative edge lengths for each shape to determine where tenant boundaries should be placed based on their square footage proportion
    floorPlanShapes.forEach((shape, shapeIndex) => {
        for(let i = 0; i < shape.length - 1; i++) {
            edgeLengths[shapeIndex][i] = Math.sqrt(Math.pow(shape[i+1][0] - shape[i][0], 2) + Math.pow(shape[i+1][1] - shape[i][1], 2)) + (
                i === 0 && shapeIndex === 0 ? 
                0 : 
                (i === 0 ? edgeLengths[shapeIndex-1].at(-1) : edgeLengths[shapeIndex][i-1])
            );
        }
    });

    // TODO: Handle floors with no tenants

    // Calculating cumulative tenant "wall" lengths based on their square footage proportion
    const tenantWallLengths = Array(Object.keys(tenantSFList).length).fill(0);
    Object.entries(tenantSFList).forEach(([tenant, sf]) => {
        tenantWallLengths.push([tenant, sf / totalSF * edgeLengths.at(-1).at(-1) + tenantWallLengths.at(-1)])
    });

    // Using binary search to find the tenant wall ends
    currShapeIndex = 0;
    // Tenant position array, stores [shape index, edge index, proportion within edge after edge index]
    const tenantPositions = Array(Object.keys(tenantSFList).length).fill(["", 0, 0, 0]);
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

    // Generating GeoJSON Feature for each tenant wall
    tenantGeoJSONFeatures = [];
    tenantPositions.forEach(([tenant, shapeIndex, edgeIndex, edgeProportion], tenantIndex) => {
        const [prevShapeIndex, prevEdgeIndex, prevEdgeProportion] = tenantIndex === 0 ? [0, 0, 0] : [tenantPositions[tenantIndex - 1][1], tenantPositions[tenantIndex - 1][2], tenantPositions[tenantIndex - 1][3]];
        // TODO: Implement two coordinates where one is pushed inwards and another is pushed outwards, reverse one of them to create a closed shape
        const tenantWallCoordinates = [
            [
                [
                    floorPlanShapes[prevShapeIndex][prevEdgeIndex][0] + (prevEdgeProportion * (floorPlanShapes[prevShapeIndex][prevEdgeIndex + 1][0] - floorPlanShapes[prevShapeIndex][prevEdgeIndex][0])),
                    floorPlanShapes[prevShapeIndex][prevEdgeIndex][1] + (prevEdgeProportion * (floorPlanShapes[prevShapeIndex][prevEdgeIndex + 1][1] - floorPlanShapes[prevShapeIndex][prevEdgeIndex][1]))
                ]
            ]
        ];
        if(shapeIndex === prevShapeIndex) {
            for(let i = prevEdgeIndex + 1; i <= edgeIndex; i++) {
                tenantWallCoordinates[0].push([
                    floorPlanShapes[shapeIndex][i][0],
                    floorPlanShapes[shapeIndex][i][1]
                ]);
            }
            tenantWallCoordinates[0].push([
                floorPlanShapes[shapeIndex][edgeIndex][0] + (edgeProportion * (floorPlanShapes[shapeIndex][edgeIndex + 1][0] - floorPlanShapes[shapeIndex][edgeIndex][0])),
                floorPlanShapes[shapeIndex][edgeIndex][1] + (edgeProportion * (floorPlanShapes[shapeIndex][edgeIndex + 1][1] - floorPlanShapes[shapeIndex][edgeIndex][1]))
            ]);
        }
        else {
            for(let i = prevEdgeIndex + 1; i < floorPlanShapes[prevShapeIndex].length; i++) {
                tenantWallCoordinates[0].push([
                    floorPlanShapes[prevShapeIndex][i][0],
                    floorPlanShapes[prevShapeIndex][i][1]
                ]);
            }
            for(let i = prevShapeIndex + 1; i < shapeIndex; i++) {
                tenantWallCoordinates.push(floorPlanShapes[i]);
            }
            tenantWallCoordinates.push([]);
            for(let i = 0; i <= edgeIndex; i++) {
                tenantWallCoordinates.at(-1).push([
                    floorPlanShapes[shapeIndex][i][0],
                    floorPlanShapes[shapeIndex][i][1]
                ]);
            }
            tenantWallCoordinates.at(-1).push([
                floorPlanShapes[shapeIndex][edgeIndex][0] + (edgeProportion * (floorPlanShapes[shapeIndex][edgeIndex + 1][0] - floorPlanShapes[shapeIndex][edgeIndex][0])),
                floorPlanShapes[shapeIndex][edgeIndex][1] + (edgeProportion * (floorPlanShapes[shapeIndex][edgeIndex + 1][1] - floorPlanShapes[shapeIndex][edgeIndex][1]))
            ]);
        }

        tenantWallCoordinates.forEach((wall) => {
            tenantGeoJSONFeatures.push({
                'type': 'Feature',
                'properties': {
                    'floor': e+1,
                    'height': (e+1)*buildingFloorHeight,
                    'base_height': e*buildingFloorHeight + 0.5,
                    'color': '#ffffff' // TODO: Implement color generation
                },
                'geometry': {
                    'coordinates': [
                        // TODO: Push wall geometry here
                    ],
                    'type': 'Polygon'
                }
            });
        });
    });
}