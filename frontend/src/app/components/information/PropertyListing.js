"use client"

import clsx from "clsx";
import { useState } from "react";
import { Search, Delete } from "@mui/icons-material";
import { useRouter } from "next/navigation";
import { Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Pagination } from "@mui/material";

import SetupUploadForm from "@/app/components/forms/SetupUploadForm";
import { deleteBuildingEndpoint } from "@/app/utilities/endpoints";

export default function PropertyListing({ className, propertyListingData, setPropertyListingData, mapRef, paginationProps, setSearch }) {
    const router = useRouter();

    const [isUploadPanelOpen, setIsUploadPanelOpen] = useState(false);
    const [selectedProperty, setSelectedProperty] = useState();
    const [isDeleteConfirmationOpen, setIsDeleteConfirmationOpen] = useState(false);
    const [searchText, setSearchText] = useState("");

    const [anchorEl, setAnchorEl] = useState();
    const open = Boolean(anchorEl);

    async function deleteBuilding() {
        try {
            if (!selectedProperty) {
                return;
            }

            await deleteBuildingEndpoint(selectedProperty);

            setPropertyListingData((prev) => {
                return {
                    ...prev,
                    data: prev.data.filter((building) => building.id !== selectedProperty)
                }
            });

            setSelectedProperty();
        }
        catch (error) {
            console.error(`Failed to delete building: ${error}`)
        }

    }

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
                                <input
                                    type="text"
                                    placeholder="Search"
                                    className="w-full border-0 outline-0 group"
                                    value={searchText}
                                    onChange={(e) => setSearchText(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            if (searchText) {
                                                setSearch(searchText);
                                            }
                                            else {
                                                setSearch();
                                            }
                                        }
                                    }}
                                />
                            </div>
                            <button
                                type="button"
                                className={clsx("p-2 outline rounded-sm hover:bg-red-500 hover:outline-white transition-all group", selectedProperty ? "w-10" : "w-0 hidden opacity-0")}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsDeleteConfirmationOpen(true);
                                }}
                            >
                                <Delete className="group-hover:text-white" />
                            </button>
                            <Dialog
                                open={isDeleteConfirmationOpen}
                                onClose={() => setIsDeleteConfirmationOpen(false)}
                                aria-labelledby="delete-occupancy-alert-dialog-title"
                                aria-describedby="delete-occupancy-alert-dialog-description"
                            >
                                <DialogTitle id="delete-occupancy-alert-dialog-title">
                                    Delete?
                                </DialogTitle>
                                <DialogContent>
                                    <DialogContentText id="delete-occupancy-alert-dialog-description">
                                        Are you sure you want to delete the selected occupancies? This action cannot be undone.
                                    </DialogContentText>
                                </DialogContent>
                                <DialogActions>
                                    <button
                                        className="h-10 px-4 mb-3 border rounded-lg hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all"
                                        onClick={() => setIsDeleteConfirmationOpen(false)}
                                    >
                                        NO!
                                    </button>
                                    <button
                                        className="h-10 px-4 mr-4 mb-3 border rounded-lg hover:bg-red-500 hover:text-white transition-all"
                                        onClick={() => {
                                            deleteBuilding();
                                            setIsDeleteConfirmationOpen(false);
                                        }}
                                    >
                                        Yes, delete them!
                                    </button>
                                </DialogActions>
                            </Dialog>
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