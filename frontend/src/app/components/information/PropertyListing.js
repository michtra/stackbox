"use client"

import clsx from "clsx";
import { useState } from "react";
import { Search } from "@mui/icons-material";
import { useRouter } from "next/navigation";
import { Pagination } from "@mui/material";
import { Delete } from "@mui/icons-material";
import { FilterAlt } from "@mui/icons-material";

import SetupUploadForm from "@/app/components/forms/SetupUploadForm";

export default function PropertyListing({ className, propertyListingData, mapRef, paginationProps }) {
    const router = useRouter();
    const [isUploadPanelOpen, setIsUploadPanelOpen] = useState(false);
    const [selectedProperty, setSelectedProperty] = useState();

    return (
        <div
            className={clsx(className, "w-full h-full")}
            onClick={() => {
                setSelectedProperty();
            }}
        >
            <div className="w-full h-full flex flex-col justify-between rounded-lg">
                <div className="flex flex-col h-[calc(100%-4.5rem)] gap-4">
                    <div className="flex flex-col gap-2 pt-6 px-6">
                        <span className="text-lg font-medium">Properties managed by you.</span>
                        <div className="flex flex-row gap-2">
                            <div className="flex flex-row w-full p-2 gap-2 items-center outline rounded-sm focus-within:outline-blue-500 focus-within:outline-2 transition-all">
                                <Search />
                                <input type="text" placeholder="Search" className="w-full border-0 outline-0 group" />
                            </div>
                            <div className={clsx("p-2 outline rounded-sm hover:bg-red-500 hover:outline-white transition-all group", selectedProperty ? "w-10" : "w-0 hidden opacity-0")}>
                                <Delete className="group-hover:text-white" />
                            </div>
                            <div className="p-2 outline rounded-sm hover:bg-black dark:hover:bg-white transition-all group">
                                <FilterAlt className="group-hover:text-white dark:group-hover:text-black" />
                            </div>
                        </div>
                    </div>
                    <div className="w-full h-full flex flex-col items-center px-6 py-2 gap-4 overflow-y-scroll">
                        {
                            propertyListingData.data.length != 0 ?
                            [
                                ...propertyListingData.data.map((building) => 
                                    <div
                                        key={building.id}
                                        id={`building-listing-${building.id}`}
                                        className={clsx("flex flex-col w-full px-3 py-2 outline rounded-md cursor-pointer", building.id === selectedProperty && "outline-blue-500 outline-2 shadow-blue-500 shadow-md")}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (e.ctrlKey || e.metaKey) {
                                                if (building.id !== selectedProperty) {
                                                    mapRef.current.easeTo({
                                                        center: [
                                                            building.location.longitude,
                                                            building.location.latitude
                                                        ],
                                                        zoom: 16,
                                                        pitch: 60
                                                    });
                                                    setSelectedProperty(building.id);
                                                }
                                                else {
                                                    setSelectedProperty();
                                                }
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