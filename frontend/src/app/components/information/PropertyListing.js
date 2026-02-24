"use client"

import clsx from "clsx";
import { useState } from "react";
import { Search } from "@mui/icons-material";
import { useRouter } from "next/navigation";

export default function PropertyListing({ className, propertyListingData, mapRef }) {
    const router = useRouter();

    return (
        <div className={clsx(className, "w-full h-full")}>
            <div className="w-full h-full flex flex-col gap-4 rounded-lg">
                <div className="flex flex-col gap-2 pt-6 px-6">
                    <span className="text-lg font-medium">Properties managed by you.</span>
                    <div className="flex flex-row w-full p-2 gap-2 outline rounded-sm focus-within:outline-blue-500 focus-within:outline-2">
                        <Search />
                        <input type="text" placeholder="Search" className="border-0 outline-0 group" />
                    </div>
                </div>
                <div className="w-full h-full flex flex-col px-6 pt-2 gap-4 overflow-y-scroll">
                    {propertyListingData.data.map((building) => 
                        <div
                            key={building.id}
                            id={`building-listing-${building.id}`}
                            className="flex flex-col w-full px-3 py-2 outline rounded-md cursor-pointer"
                            onClick={(e) => {
                                if (e.ctrlKey || e.metaKey) {
                                    mapRef.current.easeTo({
                                        center: [
                                            building.location.longitude.parsedValue,
                                            building.location.latitude.parsedValue
                                        ],
                                        zoom: 16,
                                        pitch: 60
                                    });
                                }
                                else {
                                    router.push(`/property/${building.id}`);
                                }
                            }}
                        >
                            <span className="text-lg font-medium">{building.name}</span>
                            <span className="text-sm text-black/50 dark:text-white/75">{building.address.street}</span>
                            <span className="text-sm text-black/50 dark:text-white/75">{building.address.city}, {building.address.state}, {building.address.zip} {building.address.country}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}