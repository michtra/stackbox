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
export default function BuildingVisualization({ stackingData, isDarkMode = false }) {
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

        mapRef.current.on("click", "stackingplan-layer", (e) => showInfo(e));

        return () => mapRef.current.remove();
    }, []);

    useEffect(() => {
        if (mapRef.current?.getSource("stackingplan")) {
            floorData.data.features = floorData.data.features.map((feature) => {
                return {
                    ...feature,
                    properties: {
                        ...feature.properties,
                        color: stackingData.tenants.find((tenant) => tenant.id === feature.properties.tenant)?.color || "#ffffff"
                    }
                }
            });
            mapRef.current.getSource("stackingplan")?.setData(floorData?.data);
        }
    }, [stackingData?.tenants]);

    useEffect(() => {
        if (mapRef.current?.getSource("stackingplan")) {
            floorData = proportionBuilding(stackingData);
            mapRef.current.getSource("stackingplan")?.setData(floorData?.data);
        }
    }, [stackingData?.floors]);

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