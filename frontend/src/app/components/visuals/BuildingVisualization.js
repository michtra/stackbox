"use client"

import { useRef, useEffect, useMemo } from "react";
import mapboxgl from "mapbox-gl";

import { proportionBuilding } from "@/app/utilities/processor";

/**
 * 
 * @typedef {Object} BuildingVisualizationProps
 * @property {Object} stackingData - JSON endpoint output from data of a singular building.
 * @property {Boolean} isDarkMode - For dark mode adjustments.
 * 
 * @param {BuildingVisualizationProps} props
 * @returns {JSX.Element}
 */
export default function BuildingVisualization({ stackingData, isDarkMode = false, visualizationProps }) {
    const mapRef = useRef();
    const mapContainerRef = useRef();
    var floorData = proportionBuilding(stackingData);

    const showInfo = (e) => {
        console.log("Click!", e);
    }

    useEffect(() => {
        mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
        mapRef.current = new mapboxgl.Map({
            container: mapContainerRef.current,
            center: [
                stackingData["building"]["location"]["longitude"],
                stackingData["building"]["location"]["latitude"]
            ],
            zoom: 17,
            pitch: 60,
        });

        return () => mapRef.current.remove();
    }, []);

    useEffect(() => {
        for (const key of Object.keys(floorData)) {
            if (mapRef.current?.getSource(`${key}-floorplan`)) {
                mapRef.current.getSource(`${key}-floorplan`)?.setData(floorData[key]?.data);
            }
        }
    }, [stackingData?.tenants]);

    useEffect(() => {
        floorData = proportionBuilding(stackingData);

        if (mapRef.current.isStyleLoaded()) {
            const unloadSourceList = Object.keys(mapRef.current?.getStyle().sources).filter((sourceKey) => visualizationProps.rerenderFloors.has(parseInt(sourceKey.split("_")[0], 10)))
            const loadKeyList = Object.keys(floorData).filter((key) => visualizationProps.rerenderFloors.has(parseInt(key.split("_")[0], 10)))

            unloadSourceList.forEach((sourceKey) => {
                if (mapRef.current?.getLayer(`${sourceKey}-layer`)) {
                    mapRef.current.removeLayer(`${sourceKey}-layer`);
                }
                if (mapRef.current?.getSource(sourceKey)) {
                    mapRef.current.removeSource(sourceKey);
                }
            });

            loadKeyList.forEach((key) => {
                if (!(mapRef.current?.getSource(`${key}-floorplan`))) {
                    mapRef.current.addSource(`${key}-floorplan`, floorData[key]);
                    mapRef.current.addLayer({
                        "id": `${key}-floorplan-layer`,
                        "type": "fill-extrusion",
                        "source": `${key}-floorplan`,
                        "paint": {
                            "fill-extrusion-color": ["get", "color"],
                            "fill-extrusion-height": ["get", "height"],
                            "fill-extrusion-base": ["get", "base_height"],
                            "fill-extrusion-opacity": (
                                visualizationProps.selectedFloors.length === 0 || visualizationProps.selectedFloors.includes(parseInt(key.split("_")[0], 10)) ?
                                1.0 :
                                0.25
                            ),
                        }
                    });
                }
            })
        }
    }, [visualizationProps.rerenderFloors]);

    useEffect(() => {
        if (mapRef.current.isStyleLoaded()) {
            Object.keys(mapRef.current?.getStyle().sources).forEach((sourceKey) => {
                if (mapRef.current?.getLayer(`${sourceKey}-layer`)) {
                    const newOpacity = (
                        visualizationProps.selectedFloors.length === 0 || visualizationProps.selectedFloors.includes(parseInt(sourceKey.split("_")[0], 10)) ?
                        1.0 :
                        0.25
                    )
                    if (mapRef.current.getPaintProperty(`${sourceKey}-layer`, "fill-extrusion-opacity") !== newOpacity) {
                        mapRef.current.setPaintProperty(`${sourceKey}-layer`, "fill-extrusion-opacity", newOpacity);
                    }
                }
            });
        }
    }, [visualizationProps.selectedFloors]);

    useEffect(() => {
        mapRef.current.setStyle(isDarkMode ? "mapbox://styles/mapbox/dark-v11" : "mapbox://styles/mapbox/light-v11");
        mapRef.current.on("style.load", () => {
            for (const key of Object.keys(floorData)) {
                floorData[key].data.features = floorData[key].data.features.map((feature) => {
                    return {
                        ...feature,
                        properties: {
                            ...feature.properties,
                            color: feature.properties.tenant === "Vacancy" || feature.properties.tenant === "Plate" ?
                                    (
                                        isDarkMode ?
                                        (feature.properties.tenant !== "Plate" ? "#fffae6" : "#141725") :
                                        "#ffffff"
                                    ) :
                                    feature.properties.color
                        }
                    }
                });

                if (!mapRef.current.getSource(`${key}-floorplan`)) {
                    mapRef.current.addSource(`${key}-floorplan`, floorData[key]);
                    mapRef.current.addLayer({
                        "id": `${key}-floorplan-layer`,
                        "type": "fill-extrusion",
                        "source": `${key}-floorplan`,
                        "paint": {
                            "fill-extrusion-color": ["get", "color"],
                            "fill-extrusion-height": ["get", "height"],
                            "fill-extrusion-base": ["get", "base_height"],
                            "fill-extrusion-opacity": (
                                visualizationProps.selectedFloors.length === 0 || visualizationProps.selectedFloors.includes(parseInt(key.split("_")[0], 10)) ?
                                1.0 :
                                0.25
                            ),
                        }
                    });
                }
                else if (key.includes("Vacancy") || key.includes("Plate")) {
                    mapRef.current.getSource(`${key}-floorplan`)?.setData(floorData[key]?.data);
                }
            }
        });
    }, [isDarkMode]);

    return (
        <div className="overflow-hidden">
            <div id="map-container" ref={mapContainerRef} className="w-screen h-screen"></div>
        </div>
    );
}