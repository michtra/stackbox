'use client'

import { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';

import 'mapbox-gl/dist/mapbox-gl.css'

import ListingVisualization from "@/app/components/visuals/ListingVisualization";

import buildings from "../../test/buildings.json";

export default function Page() {

    return (
        <div className="w-full min-h-screen flex flex-col overflow-hidden">
            <ListingVisualization propertyListingData={buildings} />
        </div>
    );
}

