"use client"

import { useRef, useEffect } from "react";
import mapboxgl from "mapbox-gl";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader";

export default function BuildingAdjustments({ src, isDarkMode, mapRef, modelRef, scale, setCoords, coords, setRotation, rotation }) {
    const mapContainerRef = useRef();

    useEffect(() => {
        mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
        mapRef.current = new mapboxgl.Map({
            container: mapContainerRef.current,
            center: [-95.36576714742297, 29.76046335699732],
            zoom: 17,
            pitch: 60,
        });

        mapRef.current.on("style.load", () => {
            mapRef.current.addLayer({
                id: 'pennzoil-place',
                type: 'custom',
                renderingMode: '3d',
                onAdd: () => {
                    window.tb = new window.Threebox(
                        mapRef.current,
                        mapRef.current.getCanvas().getContext("webgl"),
                        {
                            defaultLights: true,
                            enableSelectingObjects: true,
                            enableDraggingObjects: true,
                            enableRotatingObjects: true,
                            mousetrack: true,
                        }
                    );

                    const loader = new STLLoader();
                    loader.load(src, (geometry) => {
                        // Compensating for the fact that Trimesh starts z-axis on min bounding box
                        geometry.computeBoundingBox();
                        geometry.translate(0, 0, -geometry.boundingBox.min.z);

                        const material = new THREE.MeshPhongMaterial({ color: 0xffffff });
                        const mesh = new THREE.Mesh(geometry, material);

                        modelRef.current = window.tb.Object3D({
                            obj: mesh,
                            units: 'meters',
                            draggable: true,
                        });
                        modelRef.current.setCoords(coords);
                        modelRef.current.setRotation({ x: 0, y: 0, z: rotation });
                        modelRef.current.model.scale.set(scale, scale, scale);

                        window.tb.add(modelRef.current);
                        window.tb.altitudeStep = 0;

                        // Drag listener
                        modelRef.current.addEventListener("ObjectDragged", (e) => {
                            console.log(e.detail.draggedObject.coordinates)
                            console.log(e.detail.draggedObject.rotation)
                        });
                    });
                },
                render: () => {
                    window.tb.update();
                }
            });
        });

        return () => mapRef.current.remove();
    }, []);

    useEffect(() => {
        mapRef.current.setStyle(isDarkMode ? "mapbox://styles/mapbox/dark-v11" : "mapbox://styles/mapbox/light-v11");
    }, [isDarkMode]);

    return (
        <div className="overflow-hidden">
            <div id="map-container" ref={mapContainerRef} className="w-screen h-screen"></div>
        </div>
    );
}