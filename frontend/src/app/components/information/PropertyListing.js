"use client"

import clsx from "clsx";
import { useState } from "react";
import { Search } from "@mui/icons-material";
import { useRouter } from "next/navigation";
import { Pagination } from "@mui/material";

import SetupUploadForm from "@/app/components/forms/SetupUploadForm";

export default function PropertyListing({ className, propertyListingData, mapRef, paginationProps }) {
    const router = useRouter();
    const [isUploadPanelOpen, setIsUploadPanelOpen] = useState(false);

    return (
        <div className={clsx(className, "w-full h-full")}>
            <div className="w-full h-full flex flex-col justify-between rounded-lg">
                <div className="flex flex-col h-[calc(100%-4.5rem)] gap-4">
                    <div className="flex flex-col gap-2 pt-6 px-6">
                        <span className="text-lg font-medium">Properties managed by you.</span>
                        <div className="flex flex-row w-full p-2 gap-2 outline rounded-sm focus-within:outline-blue-500 focus-within:outline-2">
                            <Search />
                            <input type="text" placeholder="Search" className="border-0 outline-0 group" />
                        </div>
                    </div>
                    <div className="w-full h-full flex flex-col px-6 py-2 gap-4 overflow-y-scroll">
                        {
                            propertyListingData.data.length != 0 ?
                            [
                                ...propertyListingData.data.map((building) => 
                                    <div
                                        key={building.id}
                                        id={`building-listing-${building.id}`}
                                        className="flex flex-col w-full px-3 py-2 outline rounded-md cursor-pointer"
                                        onClick={(e) => {
                                            if (e.ctrlKey || e.metaKey) {
                                                mapRef.current.easeTo({
                                                    center: [
                                                        building.location.longitude,
                                                        building.location.latitude
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
                                        <span className="text-sm text-black/75 dark:text-white/75">{building.address.street}</span>
                                        <span className="text-sm text-black/75 dark:text-white/75">{building.address.city}, {building.address.state}, {building.address.zip} {building.address.country}</span>
                                    </div>
                                ),
                                <Pagination
                                    key="page-selector"
                                    count={propertyListingData.pagination.totalPages}
                                    page={paginationProps.page} 
                                    onChange={(e, val) => {
                                        // TODO: Add backend integration after adding test data into RDS
                                        paginationProps.setPage(val);
                                    }}
                                />
                            ] :
                            <div className="w-full h-full flex justify-center items-center">
                                <span>No properties</span>
                            </div>
                        }
                    </div>
                </div>
                <div className="flex flex-row gap-2 pb-6 px-6">
                    <button
                        className="flex flex-col justify-center items-center w-full h-12 p-2 gap-2 outline rounded-sm cursor-pointer hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all"
                        onClick={() => {
                            setIsUploadPanelOpen(true);
                        }}
                    >
                        Add New Property
                    </button>
                </div>
            </div>
            <SetupUploadForm isUploadPanelOpen={isUploadPanelOpen} setIsUploadPanelOpen={setIsUploadPanelOpen} />
        </div>
    );
}