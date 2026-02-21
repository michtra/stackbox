'use client'

import { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';

import 'mapbox-gl/dist/mapbox-gl.css'

import OccupancyPieChart from './components/charts/OccupancyPieChart';
import FloorOccupancyChart from './components/charts/FloorOccupancyChart';
import ChartExportButton from './components/charts/ChartExportButton';
import stacking from '../../test/stacking-legacy.json';

/**
 * (Deprecated) Finds point intersecting GeoJSON geometry side using line-line intersection calculation
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
 * (Deprecated) Splits GeoJSON shape into pie slices and returns list of GeoJSON shapes
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
        // In case GeoJSON index ends in between percentages
        // (e.g. GeoJSON coordinate list length 10, pie slice has index 8, 9, 0, 1, 2, convert to 8, 9, 10, 11, 12 so that the for loop below this works)
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

export default function Page() {
    const mapRef = useRef();
    const mapContainerRef = useRef();
    const pieChartRef = useRef(null);
    const floorChartRef = useRef(null);
    const [activeTab, setActiveTab] = useState('map');
    const [chartTab, setChartTab] = useState('pie');
    const [isDarkMode, setIsDarkMode] = useState(false);

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
        <div className='w-full min-h-screen flex flex-col overflow-hidden' style={{ backgroundColor: isDarkMode ? '#0f172a' : '#ffffff', minHeight: '100dvh' }}>
            <div className="flex border-b z-10 relative" style={{ backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', borderColor: isDarkMode ? '#334155' : '#e5e7eb' }}>
                <button
                    onClick={() => setActiveTab('map')}
                    className={`flex-1 px-4 py-2 text-sm font-medium transition-colors duration-200 ${activeTab === 'map' ? 'text-blue-500 border-b-2 border-blue-500' : ''}`}
                    style={{ 
                        color: activeTab === 'map' ? '#3b82f6' : (isDarkMode ? '#94a3b8' : '#4b5563'),
                        backgroundColor: activeTab === 'map' ? (isDarkMode ? '#1e3a5f' : '#eff6ff') : 'transparent'
                    }}
                >
                    Map
                </button>
                <button
                    onClick={() => setActiveTab('charts')}
                    className={`flex-1 px-4 py-2 text-sm font-medium transition-colors duration-200 ${activeTab === 'charts' ? 'text-blue-500 border-b-2 border-blue-500' : ''}`}
                    style={{ 
                        color: activeTab === 'charts' ? '#3b82f6' : (isDarkMode ? '#94a3b8' : '#4b5563'),
                        backgroundColor: activeTab === 'charts' ? (isDarkMode ? '#1e3a5f' : '#eff6ff') : 'transparent'
                    }}
                >
                    Charts
                </button>
                <button
                    onClick={() => setIsDarkMode(!isDarkMode)}
                    className="px-4 py-2 text-sm font-medium transition-colors duration-200 hover:bg-opacity-10"
                    style={{ color: isDarkMode ? '#94a3b8' : '#4b5563' }}
                    title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                >
                    {isDarkMode ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="5"/>
                            <line x1="12" y1="1" x2="12" y2="3"/>
                            <line x1="12" y1="21" x2="12" y2="23"/>
                            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                            <line x1="1" y1="12" x2="3" y2="12"/>
                            <line x1="21" y1="12" x2="23" y2="12"/>
                            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                        </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                        </svg>
                    )}
                </button>
            </div>
            {activeTab === 'map' && <div id='map-container' ref={mapContainerRef} className='w-full flex-1 min-h-0'></div>}
            {activeTab === 'charts' && (
                <div className='w-full flex-1 min-h-0 flex flex-col' style={{ 
                    background: isDarkMode ? 'linear-gradient(to bottom right, #0f172a, #1e293b)' : 'linear-gradient(to bottom right, #f9fafb, #ffffff)'
                }}>
                    <div className="flex border-b shadow-sm" style={{ 
                        backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                        borderColor: isDarkMode ? '#334155' : '#e5e7eb'
                    }}>
                        <button
                            onClick={() => setChartTab('pie')}
                            className={`flex-1 px-6 py-3 text-sm font-semibold transition-all duration-200 ${chartTab === 'pie' ? 'border-b-2 border-blue-500' : ''}`}
                            style={{ 
                                color: chartTab === 'pie' ? '#3b82f6' : (isDarkMode ? '#cbd5e1' : '#374151'),
                                backgroundColor: chartTab === 'pie' ? (isDarkMode ? '#1e3a5f' : '#eff6ff') : 'transparent'
                            }}
                        >
                            Overview
                        </button>
                        <button
                            onClick={() => setChartTab('floor')}
                            className={`flex-1 px-6 py-3 text-sm font-semibold transition-all duration-200 ${chartTab === 'floor' ? 'border-b-2 border-blue-500' : ''}`}
                            style={{ 
                                color: chartTab === 'floor' ? '#3b82f6' : (isDarkMode ? '#cbd5e1' : '#374151'),
                                backgroundColor: chartTab === 'floor' ? (isDarkMode ? '#1e3a5f' : '#eff6ff') : 'transparent'
                            }}
                        >
                            By Floor
                        </button>
                    </div>
                    <div className="flex-1 min-h-0 overflow-auto px-2 md:px-0">
                        {chartTab === 'pie' && (
                            <div ref={pieChartRef} className="min-h-full p-6 md:p-8">
                                <div className="max-w-6xl mx-auto rounded-xl shadow-lg p-8 h-full flex flex-col" style={{ 
                                    backgroundColor: isDarkMode ? '#1e293b' : '#ffffff'
                                }}>
                                    <div className="mb-6">
                                        <h2 className="text-2xl font-bold mb-3" style={{ color: isDarkMode ? '#f1f5f9' : '#111827' }}>Building Occupancy by Tenant</h2>
                                        <ChartExportButton 
                                            targetRef={pieChartRef}
                                            filename="building-occupancy-pie"
                                            isDarkMode={isDarkMode}
                                        >
                                            Export
                                        </ChartExportButton>
                                    </div>
                                    <div className="flex-1 flex items-center justify-center">
                                        <OccupancyPieChart stackingData={stacking} isDarkMode={isDarkMode} />
                                    </div>
                                </div>
                            </div>
                        )}
                        {chartTab === 'floor' && (
                            <div ref={floorChartRef} className="min-h-full p-6 md:p-8">
                                <div className="max-w-6xl mx-auto rounded-xl shadow-lg p-8 overflow-x-auto" style={{ 
                                    backgroundColor: isDarkMode ? '#1e293b' : '#ffffff'
                                }}>
                                    <div className="mb-6">
                                        <h2 className="text-2xl font-bold mb-3" style={{ color: isDarkMode ? '#f1f5f9' : '#111827' }}>Occupancy by Floor</h2>
                                        <ChartExportButton 
                                            targetRef={floorChartRef}
                                            filename="occupancy-by-floor"
                                            isDarkMode={isDarkMode}
                                        >
                                            Export
                                        </ChartExportButton>
                                    </div>
                                    <div className="mt-4">
                                        <FloorOccupancyChart stackingData={stacking} isDarkMode={isDarkMode} />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="shrink-0 px-6 md:px-8 py-4 border-t shadow-lg" style={{ 
                        backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                        borderColor: isDarkMode ? '#334155' : '#e5e7eb'
                    }}>
                        <div className="max-w-6xl mx-auto flex justify-between text-sm font-medium" style={{ color: isDarkMode ? '#cbd5e1' : '#374151' }}>
                            <span className="flex items-center gap-2">
                                <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: '#3b82f6' }}></span>
                                Total Floors: <span className="font-bold" style={{ color: isDarkMode ? '#f1f5f9' : '#111827' }}>{stacking.floors}</span>
                            </span>
                            <span className="flex items-center gap-2">
                                <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: '#3b82f6' }}></span>
                                Tenants: <span className="font-bold" style={{ color: isDarkMode ? '#f1f5f9' : '#111827' }}>{Object.keys(stacking.tenants).length}</span>
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

