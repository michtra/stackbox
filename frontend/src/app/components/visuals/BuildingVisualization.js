"use client"

import { useRef, useEffect } from "react";
import mapboxgl from "mapbox-gl";

import { proportionBuilding } from "../../utilities/processor";

/**
 * 
 * @typedef {Object} BuildingVisualizationProps
 * @property {Object} stackingData - JSON endpoint output from data of a singular building.
 * @property {Boolean} isDarkMode - For dark mode adjustments.
 * 
 * @param {BuildingVisualizationProps} props
 * @returns {JSX.Element}
 */
export default function BuildingVisualization({ stackingData, isDarkMode = false }) {
    const mapRef = useRef();
    const mapContainerRef = useRef();
    const floorData = proportionBuilding(stackingData);

    const showInfo = (e) => {
        console.log("Click!", e);
    }

    useEffect(() => {
        mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
        mapRef.current = new mapboxgl.Map({
            container: mapContainerRef.current,
            center: [
                stackingData["building"]["location"]["longitude"]["parsedValue"],
                stackingData["building"]["location"]["latitude"]["parsedValue"]
            ],
            zoom: 17,
            pitch: 60,
        });

        mapRef.current.on("click", "stackingplan-layer", (e) => showInfo(e));

        return () => mapRef.current.remove();
    }, []);

    useEffect(() => {
        mapRef.current.setStyle(isDarkMode ? "mapbox://styles/mapbox/dark-v11" : "mapbox://styles/mapbox/light-v11");
        mapRef.current.on("style.load", () => {
            if (!mapRef.current.getSource("stackingplan")) {
                mapRef.current.addSource("stackingplan", floorData);
                mapRef.current.addLayer({
                    "id": "stackingplan-layer",
                    "type": "fill-extrusion",
                    "source": "stackingplan",
                    "paint": {
                        "fill-extrusion-color": ["get", "color"],
                        "fill-extrusion-height": ["get", "height"],
                        "fill-extrusion-base": ["get", "base_height"],
                        "fill-extrusion-opacity": 1
                    }
                });
            }
        });
    }, [isDarkMode]);

    return (
        <div className="overflow-hidden">
            <div id="map-container" ref={mapContainerRef} className="w-screen h-screen"></div>
        </div>
    );
}