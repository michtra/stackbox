'use client'

import { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';

import 'mapbox-gl/dist/mapbox-gl.css'

import stacking from '../../data/stacking.json';
import OccupancyPieChart from './components/charts/OccupancyPieChart';
import FloorOccupancyChart from './components/charts/FloorOccupancyChart';
import ChartExportButton from './components/charts/ChartExportButton';

/**
 * Finds point intersecting GeoJSON geometry side using line-line intersection calculation
 * @param {float[]} centerCoord Center of floor plan
 * @param {float} percentCircle Value 0.0 to 1.0 representing percent of circle from 0 to 2*PI radians
 * @param {int} floorPlan Floor plan index of building from JSON
 * @returns List of length 2 with interesection point and larger index of endpoint if found, else null
 */
function findIntersection(centerCoord, percentCircle, floorPlan) {
    // Margin of error else won't detect intersection of PI/2 multiples
    const marginOfError = 1e-10;
    const radialCoord = [Math.cos(2*Math.PI*percentCircle)+centerCoord[0], Math.sin(2*Math.PI*percentCircle)+centerCoord[1]]

    for(const [i, currCoord] of stacking.coordinates[floorPlan].entries()) {
        const prevCoord = stacking.coordinates[floorPlan].slice(i-1)[0]

        const det12 = centerCoord[0]*radialCoord[1]-centerCoord[1]*radialCoord[0];
        const det34 = currCoord[0]*prevCoord[1]-currCoord[1]*prevCoord[0];
        const diffx12 = centerCoord[0]-radialCoord[0];
        const diffx34 = currCoord[0]-prevCoord[0];
        const diffy12 = centerCoord[1]-radialCoord[1];
        const diffy34 = currCoord[1]-prevCoord[1];
        const den = (diffx12*diffy34 - diffy12*diffx34);

        // If denominator is 0, parallel or coincident
        if(den===0) {
            continue;
        }

        const interPoint = [(det12*diffx34 - diffx12*det34)/den, (det12*diffy34 - diffy12*det34)/den]
        // On the basis that sum of absolute distances between endpoint and intersection
        // should be equal to distance between endpoints if intersecting
        if(Math.abs(interPoint[0]-currCoord[0])+Math.abs(interPoint[0]-prevCoord[0])<=Math.abs(currCoord[0]-prevCoord[0])+marginOfError &&
           Math.abs(interPoint[1]-currCoord[1])+Math.abs(interPoint[1]-prevCoord[1])<=Math.abs(currCoord[1]-prevCoord[1])+marginOfError &&
           Math.abs(interPoint[0]-centerCoord[0])+Math.abs(interPoint[0]-radialCoord[0])<=Math.abs(centerCoord[0]-radialCoord[0])+marginOfError &&
           Math.abs(interPoint[1]-centerCoord[1])+Math.abs(interPoint[1]-radialCoord[1])<=Math.abs(centerCoord[1]-radialCoord[1])+marginOfError) {
            return [interPoint, i];
        }
    }
    console.log('cannot find intersection for percentage: '+percentCircle);
    return null;
}

/**
 * Splits GeoJSON shape into pie slices and returns list of GeoJSON shapes
 * @param {float[]} centerCoord Center of floor plan
 * @param {float[]} percentageList List of values from 0.0 to 1.0 that should add up 1.0
 * @param {*} floorPlan Floor plan index of building from JSON
 * @returns List of GeoJSON shapes radially split
 */
function proportionGeojson(centerCoord, percentageList, floorPlan) {
    var geoJsonList = [];
    var percentSum = 0.0;

    // Detects if GeoJSON is counterclockwise, uses shoelace formula
    var area = 0;
    stacking.coordinates[floorPlan].forEach((e, i) => {
        const nextCoord = stacking.coordinates[floorPlan][(i+1)%stacking.coordinates[floorPlan].length];
        area += e[0]*nextCoord[1] - e[1]*nextCoord[0];
    });
    const isClockwise = area<0;

    // Normalization in case the sum isn't 1.0
    const percentageListSum = percentageList.reduce((a, b) => a+b, 0);
    if(percentageListSum!==1.0) {
        percentageList = percentageList.map((e) => e/percentageListSum);
    }

    percentageList.forEach((percent) => {
        var geoJsonSlice = [];

        var [lowerPercentInterPoint, lowerPercentInd] = findIntersection(centerCoord, percentSum, floorPlan);
        percentSum += percent;
        var [higherPercentInterPoint, higherPercentInd] = findIntersection(centerCoord, percentSum, floorPlan);

        // Makes sure we add points in the same direction as GeoJSON shape
        if(isClockwise) {
            [lowerPercentInterPoint, lowerPercentInd, higherPercentInterPoint, higherPercentInd] = [higherPercentInterPoint, higherPercentInd, lowerPercentInterPoint, lowerPercentInd];
        }
        // In case GeoJSON ends in between percentages
        if(lowerPercentInd>higherPercentInd) {
            higherPercentInd = stacking.coordinates[floorPlan].length + higherPercentInd;
        }

        // Pushes one side of slice, points in between, other side of slice
        geoJsonSlice.push(centerCoord, lowerPercentInterPoint);
        for(var i=lowerPercentInd;i<higherPercentInd;i++) {
            geoJsonSlice.push(stacking.coordinates[floorPlan][i%stacking.coordinates[floorPlan].length]);
        }
        geoJsonSlice.push(higherPercentInterPoint, centerCoord);

        geoJsonList.push(geoJsonSlice);
    });

    return geoJsonList;
}

export default function Home() {
    const mapRef = useRef();
    const mapContainerRef = useRef();
    const pieChartRef = useRef(null);
    const floorChartRef = useRef(null);
    const [activeTab, setActiveTab] = useState('map');
    const [chartTab, setChartTab] = useState('pie');

    const buildingFloorHeight = stacking.height/stacking.floors;
    const showInfo = (e) => {
        const floor = e.features[0].properties.floor;
        const vacancy = stacking.stackingplan[floor-1].reduce((a, e) => a-e[1], 1)*100;

        floorPopup = new mapboxgl.Popup().setLngLat(e.lngLat).setHTML(`
        <div class="min-w-52 text-black">
            <div class="font-bold">Floor ${floor}</div>
            <div class="text-lg">
                ${stacking.stackingplan[floor-1].map(e => '<div>'+e[0]+' - '+(e[1]*100).toFixed(2)+'%</div>').join('')}
                ${vacancy>0 ? '<div>Vacancy - '+vacancy.toFixed(2)+'%</div>' : ''}
            </div>
        </div>
        `).addTo(mapRef.current);
    }
    
    var floorPopup = new mapboxgl.Popup();

    useEffect(() => {
        if (activeTab !== 'map') {
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
            return;
        }
        if (mapRef.current) return;

        var centerCoord = []
        stacking.coordinates.forEach((floorPlan) => {
            var maxCoord = [-Infinity, -Infinity];
            var minCoord = [Infinity, Infinity];
            floorPlan.forEach((e) => {
                if(maxCoord[0]<e[0]) {
                    maxCoord[0] = e[0];
                }
                else if(minCoord[0]>e[0]) {
                    minCoord[0] = e[0];
                }
                if(maxCoord[1]<e[1]) {
                    maxCoord[1] = e[1];
                }
                else if(minCoord[1]>e[1]) {
                    minCoord[1] = e[1];
                }
            });
            centerCoord.push([(maxCoord[0]+minCoord[0])/2, (maxCoord[1]+minCoord[1])/2]);
        });

        var jasons = [];
        var stackingPlanIndex;
        [...Array(stacking.floors).keys()].forEach(e => {
            var vacancy = 1.0;
            var percentageList = [];
            stacking.stackingplan[e].forEach((tenant) => {
                percentageList.push(tenant[1]);
                vacancy -= tenant[1];
            });
            if(vacancy!==0.0) {
                percentageList.push(vacancy);
            }

            stackingPlanIndex = stacking.coordinatefloors.findIndex(floor => e+1<=floor);
            
            // Prevents unnecessary slicing computations for 0 or 1 tenant floors
            if(percentageList.length<=1) {
                jasons.push({
                    'type': 'Feature',
                    'properties': {
                        'floor': e+1,
                        'height': (e+1)*buildingFloorHeight, // I think this is in meters
                        'base_height': e*buildingFloorHeight + 0.5, // Removes bottom, doesn't move it up
                        'color': stacking.stackingplan[e].length ? stacking.tenants[stacking.stackingplan[e][0][0]].color : '#ffffff'
                    },
                    'geometry': {
                        'coordinates': [
                            stacking.coordinates[stackingPlanIndex]
                        ],
                        'type': 'Polygon'
                    }
                });
            }
            else {
                proportionGeojson(centerCoord[stackingPlanIndex], percentageList, stackingPlanIndex).forEach((geoJsonSlice, tenantInd) => {
                    jasons.push({
                        'type': 'Feature',
                        'properties': {
                            'floor': e+1,
                            'height': (e+1)*buildingFloorHeight,
                            'base_height': e*buildingFloorHeight + 0.5,
                            'color': vacancy!==0.0 && tenantInd===percentageList.length-1 ? '#ffffff' : stacking.tenants[stacking.stackingplan[e][tenantInd][0]].color
                        },
                        'geometry': {
                            'coordinates': [
                                geoJsonSlice
                            ],
                            'type': 'Polygon'
                        }
                    });
                });
            }
        });

        // Roof of building so that slices are hidden
        jasons.push({
            'type': 'Feature',
            'properties': {
                'floor': stacking.floors,
                'height': stacking.floors*buildingFloorHeight + 1,
                'base_height': stacking.floors*buildingFloorHeight + 0.5,
                'color': '#ffffff'
            },
            'geometry': {
                'coordinates': [
                    stacking.coordinates[stackingPlanIndex]
                ],
                'type': 'Polygon'
            }
        });

        mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
        mapRef.current = new mapboxgl.Map({
            container: mapContainerRef.current,
            style: 'mapbox://styles/mapbox/light-v11',
            center: [-95.3656135755987, 29.76014807317625],
            zoom: 17,
            pitch: 60,
        });

        mapRef.current.on('style.load', () => {
            mapRef.current.addSource('stackingplan', {
                'type': 'geojson',
                'data': {
                    'type': 'FeatureCollection',
                    'features': jasons
                }
            });
            mapRef.current.addLayer({
                'id': 'stackingplan-layer',
                'type': 'fill-extrusion',
                'source': 'stackingplan',
                'paint': {
                    'fill-extrusion-color': ['get', 'color'],
                    'fill-extrusion-height': ['get', 'height'],
                    'fill-extrusion-base': ['get', 'base_height'],
                    'fill-extrusion-opacity': 1
                }
            });

            // mapRef.current.addLayer({
            //     id: 'pennzoil-place',
            //     type: 'custom',
            //     renderingMode: '3d',
            //     paint: {
            //         'fill-color': '#ff0000'
            //     },
            //     onAdd: () => {
            //         window.tb = new Threebox(
            //             mapRef.current,
            //             mapRef.current.getCanvas().getContext('webgl'),
            //             { defaultLights: true }
            //         );
            //         const scale = 20;
            //         const options = {
            //             obj: '/tower.glb',
            //             type: 'glb',
            //             scale: { x: scale, y: scale, z: scale },
            //             units: 'meters',
            //             rotation: { x: 90, y: 45, z: 0 },
            //         };

            //         var dl = new THREE.DirectionalLight(0xff0000);
            //         dl.position.set(0, -70, 100).normalize();
            //         window.tb.scene.add(dl);
            //         var dl2 = new THREE.DirectionalLight(0xff0000);
            //         dl2.position.set(0, 70, 100).normalize();
            //         window.tb.scene.add(dl2);

            //         window.tb.loadObj(options, (model) => {
            //             model.setCoords([-95.36576714742297, 29.76046335699732]);
            //             model.setRotation({ x: 0, y: 0, z: 235 });
            //             window.tb.add(model);
            //         });
            //     },
            //     render: () => {
            //         window.tb.update();
            //     }
            // });

            // mapRef.current.addLayer({
            //     id: '609-main',
            //     type: 'custom',
            //     renderingMode: '3d',
            //     paint: {
            //         'fill-color': '#ff0000'
            //     },
            //     onAdd: () => {
            //         window.tb = new Threebox(
            //             mapRef.current,
            //             mapRef.current.getCanvas().getContext('webgl'),
            //             { defaultLights: true }
            //         );
            //         const scale = 50;
            //         const options = {
            //             obj: '/ps5.glb',
            //             type: 'glb',
            //             scale: { x: scale, y: scale, z: scale },
            //             units: 'meters',
            //             rotation: { x: 90, y: 0, z: 0 },
            //         };

            //         var dl = new THREE.DirectionalLight(0xffffff);
            //         dl.position.set(0, -70, 100).normalize();
            //         window.tb.scene.add(dl);
            //         var dl2 = new THREE.DirectionalLight(0xffffff);
            //         dl2.position.set(0, 70, 100).normalize();
            //         window.tb.scene.add(dl2);

            //         window.tb.loadObj(options, (model) => {
            //             model.setCoords([-95.36270621978426, 29.759467367489187]);
            //             model.setRotation({ x: 0, y: 0, z: 235 });
            //             window.tb.add(model);
            //         });
            //     },
            //     render: () => {
            //         window.tb.update();
            //     }
            // });
        });
            
        mapRef.current.on('click', 'stackingplan-layer', (e) => showInfo(e));

        return () => {
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, [activeTab]);

    return (
        <div className='h-screen overflow-hidden'>
            <div className="flex border-b border-gray-200 bg-white z-10 relative">
                <button
                    onClick={() => setActiveTab('map')}
                    className={`flex-1 px-4 py-2 text-sm font-medium transition-colors duration-200 ${activeTab === 'map' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'}`}
                >
                    Map
                </button>
                <button
                    onClick={() => setActiveTab('charts')}
                    className={`flex-1 px-4 py-2 text-sm font-medium transition-colors duration-200 ${activeTab === 'charts' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'}`}
                >
                    Charts
                </button>
            </div>
            {activeTab === 'map' && <div id='map-container' ref={mapContainerRef} className='w-screen h-full'></div>}
            {activeTab === 'charts' && (
                <div className='w-screen h-full flex flex-col bg-white'>
                    <div className="flex border-b border-gray-200">
                        <button
                            onClick={() => setChartTab('pie')}
                            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors duration-200 ${chartTab === 'pie' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'}`}
                        >
                            Overview
                        </button>
                        <button
                            onClick={() => setChartTab('floor')}
                            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors duration-200 ${chartTab === 'floor' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'}`}
                        >
                            By Floor
                        </button>
                    </div>
                    <div className="flex-1 overflow-auto p-4">
                        {chartTab === 'pie' && (
                            <div ref={pieChartRef}>
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-lg font-bold text-gray-800">Building Occupancy by Tenant</h2>
                                    <ChartExportButton 
                                        targetRef={pieChartRef}
                                        filename="building-occupancy-pie"
                                    >
                                        Export
                                    </ChartExportButton>
                                </div>
                                <OccupancyPieChart stackingData={stacking} />
                            </div>
                        )}
                        {chartTab === 'floor' && (
                            <div ref={floorChartRef}>
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-lg font-bold text-gray-800">Occupancy by Floor</h2>
                                    <ChartExportButton 
                                        targetRef={floorChartRef}
                                        filename="occupancy-by-floor"
                                    >
                                        Export
                                    </ChartExportButton>
                                </div>
                                <FloorOccupancyChart stackingData={stacking} />
                            </div>
                        )}
                    </div>
                    <div className="p-3 border-t border-gray-200 bg-gray-50 text-xs text-gray-600">
                        <div className="flex justify-between">
                            <span>Total Floors: {stacking.floors}</span>
                            <span>Tenants: {Object.keys(stacking.tenants).length}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
