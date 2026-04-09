"use client"

import { useRef, useEffect } from "react";
import mapboxgl from "mapbox-gl";

import { loadAdjustmentsBuildingMesh } from "@/app/utilities/processor";

export default function BuildingAdjustments({ srcProps, isDarkMode = false, mapRef, modelProps }) {
    const mapContainerRef = useRef();

    useEffect(() => {
        mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
        mapRef.current = new mapboxgl.Map({
            container: mapContainerRef.current,
            center: [modelProps.coordLng, modelProps.coordLat],
            zoom: 17,
            pitch: 60,
        });

        mapRef.current.on("style.load", () => {
            mapRef.current.addLayer({
                id: 'building-model',
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

                    loadAdjustmentsBuildingMesh(srcProps.modelSrc, modelProps);
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
        mapRef.current.on("style.load", () => {
            modelProps.modelRef.current.setCoords([modelProps.coordLng, modelProps.coordLat]);
            modelProps.modelRef.current.setRotation({ x: 0, y: 0, z: modelProps.rotation });
            const currScale = 10 ** modelProps.scale;
            modelProps.modelRef.current.model.scale.set(currScale, currScale, currScale);
            mapRef.current.triggerRepaint();
        })
    }, [isDarkMode]);

    return (
        <div className="overflow-hidden">
            <div id="map-container" ref={mapContainerRef} className="w-screen h-screen"></div>
        </div>
    );
}