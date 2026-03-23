"use client"

import { useRef, useEffect, useState, Fragment } from 'react';
import mapboxgl from 'mapbox-gl';

import 'mapbox-gl/dist/mapbox-gl.css'

import ListingVisualization from "@/app/components/visuals/ListingVisualization";
import PropertyListing from '@/app/components/information/PropertyListing';
import ResizableWindows from '@/app/components/ui/ResizableWindows';
import ThemeToggle from '@/app/components/ui/ThemeToggle';
import { CircularProgress } from "@mui/material";

import { getBuildingListing } from '@/app/utilities/endpoints';

export default function Page() {
    const mapRef = useRef();
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [propertyListingData, setPropertyListingData] = useState();
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(20);

    const paginationProps = {
        page: page,
        setPage: setPage,
        limit: limit,
        setLimit: setLimit,
    }
    
    useEffect(() => {
        getBuildingListing(page, limit).then((val) => {
            setPropertyListingData(val);
        });
    }, [page, limit]);

    return (
        <div className="relative w-full min-h-screen overflow-hidden">
            {
                propertyListingData ?
                <ResizableWindows>
                    <ListingVisualization propertyListingData={propertyListingData} isDarkMode={isDarkMode} mapRef={mapRef} />
                    <PropertyListing propertyListingData={propertyListingData} mapRef={mapRef} paginationProps={paginationProps} />
                </ResizableWindows> :
                <div className="w-full h-screen flex flex-col justify-center items-center">
                    <CircularProgress size="3rem" />
                </div>
            }
            <div className="absolute left-4 bottom-4">
                <ThemeToggle setIsDarkMode={setIsDarkMode} />
            </div>
        </div>
    );
}

