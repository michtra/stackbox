"use client"

import { useRef, useEffect } from "react";
import mapboxgl from "mapbox-gl";

import { proportionBuilding } from "../utilities/processor";

function Visualization({ stackingData }) {
    const mapRef = useRef();
    const mapContainerRef = useRef();

    const showInfo = (e) => {
        console.log("Click!", e);
    }

    useEffect(() => {
        mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
        mapRef.current = new mapboxgl.Map({
            container: mapContainerRef.current,
            style: "mapbox://styles/mapbox/light-v11",
            center: [stackingData["building"]["location"]["longitude"]["parsedValue"], stackingData["building"]["location"]["latitude"]["parsedValue"]],
            zoom: 17,
            pitch: 60,
        });

        mapRef.current.on("style.load", () => {
            mapRef.current.addSource("stackingplan", proportionBuilding(stackingData));
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
        });
            
        mapRef.current.on("click", "stackingplan-layer", (e) => showInfo(e));

        return () => mapRef.current.remove();
    }, []);

    return (
        <div className="overflow-hidden">
            <div id="map-container" ref={mapContainerRef} className="w-screen h-screen"></div>
        </div>
    );
}

export { Visualization };