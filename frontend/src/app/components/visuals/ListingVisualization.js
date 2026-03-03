"use client"

import { useRef, useEffect } from "react";
import mapboxgl from "mapbox-gl";
import clsx from "clsx";

import { propertyListingToGeoJSONFeatures } from "@/app/utilities/processor";

/**
 * 
 * @typedef {Object} BuildingVisualizationProps
 * @property {String} className - Styling
 * @property {Object} propertyListingData - JSON endpoint output from data of a user member building listing.
 * @property {RefObject} mapRef - Reference object to MapBox GL JS map
 * @property {Boolean} isDarkMode - For dark mode adjustments.
 * 
 * @param {BuildingVisualizationProps} props
 * @returns {JSX.Element}
 */
export default function ListingVisualization({ className, propertyListingData, mapRef, isDarkMode = false }) {
    const mapContainerRef = useRef();
    const pointData = propertyListingToGeoJSONFeatures(propertyListingData);

    let userInteracting = false;
    let inAnimation = false;

    const spinGlobe = () => {
        const zoom = mapRef.current.getZoom();
        if (zoom < 4) {
            const center = mapRef.current.getCenter();
            center.lng-=2;
            // Ease to animation for spinning globe
            mapRef.current.easeTo({ center, duration: 1000, easing: (n) => n });
        }
    }

    const showInfo = (e) => {
        console.log("Click!", e);
    }

    useEffect(() => {
        mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
        mapRef.current = new mapboxgl.Map({
            container: mapContainerRef.current,
            style: "mapbox://styles/mapbox/standard",
            center: [
                -95.36237027373588,
                29.759345588704043
            ],
            zoom: 2,
            pitch: 0,
        });

        mapRef.current.on("click", "not-clusters", (e) => showInfo(e));

        mapRef.current.on("load", () => {
            // Setting userInteracting to true for drag/zoom
            mapRef.current.on("mousedown", () => {
                userInteracting = true;
            });

            mapRef.current.on("wheel", () => {
                userInteracting = true;
            });

            // userInteracting to false once zoom/move/drag ends
            const movementDelay = 1000;

            mapRef.current.on("mouseup", () => {
                if(!inAnimation) {
                    userInteracting = false;
                    spinGlobe();
                }
            });

            mapRef.current.on("zoomend", () => {
            setTimeout(() => {
                if(!inAnimation) {
                        userInteracting = false;
                        spinGlobe();
                    }
                }, movementDelay);
            });

            mapRef.current.on("moveend", () => {
                if(!userInteracting) {
                    spinGlobe();
                }
            });

            // Zoom in when cluster is clicked
            mapRef.current.on("click", "clusters", (e) => {
                userInteracting = true;
                inAnimation = true;
                const features = mapRef.current.queryRenderedFeatures(e.point, {
                    layers: ["clusters"]
                });
                const clusterId = features[0].properties.cluster_id;
                mapRef.current.getSource("propertylisting").getClusterExpansionZoom(
                    clusterId,
                    (err, zoom) => {
                        if (err) return;

                        mapRef.current.easeTo({
                            center: features[0].geometry.coordinates,
                            zoom: zoom
                        });
                    }
                );
                setTimeout(() => {
                    userInteracting = false;
                    inAnimation = false;
                    spinGlobe();
                }, 2000);
            });

            // Color change when mouse hovered cluster circle
            let hoverId = null;
            mapRef.current.on("mousemove", "clusters", (e) => {
                if (e.features.length > 0) {
                    if (hoverId!=null) {
                        mapRef.current.setFeatureState(
                            { source: "propertylisting", id: hoverId },
                            { hover: false }
                        );
                    }
                    hoverId = e.features[0].id;
                    mapRef.current.setFeatureState(
                        { source: "propertylisting", id: hoverId },
                        { hover: true }
                    );
                }
            });

            // Color change when mouse leaves cluster circle
            mapRef.current.on("mouseleave", "clusters", () => {
                if (hoverId!=null) {
                    mapRef.current.setFeatureState(
                        { source: "propertylisting", id: hoverId },
                        { hover: false }
                    );
                }
                hoverId = null;
            });
        })

        return () => mapRef.current.remove();
    }, []);

    useEffect(() => {
        mapRef.current.setConfigProperty("basemap", "lightPreset", isDarkMode ? "night" : "day")
        mapRef.current.on("style.load", () => {
            mapRef.current.setConfigProperty("basemap", "lightPreset", isDarkMode ? "night" : "day")
            if (!mapRef.current.getSource("propertylisting")) {
                mapRef.current.addSource("propertylisting", pointData);
                
                // Map layer for cluster circles only from cluster source
                mapRef.current.addLayer({
                    id: "clusters",
                    type: "circle",
                    source: "propertylisting",
                    filter: ["has", "point_count"],
                    layout: {
                        "visibility": "visible",
                    },
                    paint: {
                        "circle-radius": [
                            "step",
                            ["get", "point_count"],
                            15,
                            10, 20,
                            20, 25,
                            40, 30,
                            80, 35,
                            160, 40,
                            320, 45,
                            640, 50,
                        ],
                        "circle-color": [
                            "case",
                            ["boolean", ["feature-state", "hover"], false],
                            "#fe395f",
                            "#17212b",
                        ],
                        "circle-emissive-strength": 1.0,
                    }
                });
                
                // Cluster size layer on top of cluster circle layer
                mapRef.current.addLayer({
                    id: "cluster-size",
                    type: "symbol",
                    source: "propertylisting",
                    filter: ["has", "point_count"],
                    layout: {
                        "visibility": "visible",
                        "text-field": ["get", "point_count_abbreviated"],
                        "text-font": ["Source Sans Pro Bold", "Arial Unicode MS Bold"],
                        "text-size": 12
                    },
                    paint: {
                        "text-color": "#ffffff",
                    },
                });
                // Layer for unclustered individual points in source with cluster
                mapRef.current.addLayer({
                    id: "not-clusters",
                    type: "circle",
                    source: "propertylisting",
                    filter: ["!", ["has", "point_count"]],
                    layout: {
                        "visibility": "visible",
                    },
                    paint: {
                        "circle-radius": 5,
                        "circle-stroke-color": "#fe395f",
                        "circle-stroke-width": 5,
                        "circle-color": "#ffffff",
                        "circle-emissive-strength": 1.0,
                    },
                });
            }
            spinGlobe();
        });
    }, [isDarkMode]);

    return (
        <div className={clsx(className, "overflow-hidden")}>
            <div id="map-container" ref={mapContainerRef} className="w-screen h-screen"></div>
        </div>
    );
}