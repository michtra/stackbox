"use client"

import { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';

import 'mapbox-gl/dist/mapbox-gl.css'

import ListingVisualization from "@/app/components/visuals/ListingVisualization";
import PropertyListing from '@/app/components/information/PropertyListing';
import ResizableWindows from '@/app/components/ui/ResizableWindows';
import ThemeToggle from '@/app/components/ui/ThemeToggle';

import buildings from "../../test/buildings.json";

export default function Page() {
    const mapRef = useRef();
    const [isDarkMode, setIsDarkMode] = useState(false);

    return (
        <div className="relative w-full min-h-screen overflow-hidden">
            <ResizableWindows>
                <ListingVisualization propertyListingData={buildings} isDarkMode={isDarkMode} mapRef={mapRef} />
                <PropertyListing propertyListingData={buildings} mapRef={mapRef} />
            </ResizableWindows>
            <div className="absolute left-4 bottom-4">
                <ThemeToggle setIsDarkMode={setIsDarkMode} />
            </div>
        </div>
    );
}

