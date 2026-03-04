"use client"

import clsx from "clsx";
import { useState } from "react";
import { Search } from "@mui/icons-material";
import { useRouter } from "next/navigation";
import { Upload } from "@mui/icons-material";
import { Apartment } from "@mui/icons-material";
import { ListAlt } from "@mui/icons-material";

import { uploadFile } from "@/app/utilities/endpoints";

export default function PropertyListing({ className, propertyListingData, mapRef }) {
    const router = useRouter();

    const [isUploadPanelOpen, setIsUploadPanelOpen] = useState(false);
    const [modelFile, setModelFile] = useState();
    const [excelFile, setExcelFile] = useState();

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
                                <span className="text-sm text-black/75 dark:text-white/75">{building.address.street}</span>
                                <span className="text-sm text-black/75 dark:text-white/75">{building.address.city}, {building.address.state}, {building.address.zip} {building.address.country}</span>
                            </div>
                        )}
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
            <div
                className={clsx("absolute left-0 top-0 w-screen h-screen p-8 backdrop-blur-sm backdrop-brightness-50 dark:backdrop-brightness-200 transition-all", isUploadPanelOpen ? "z-20 opacity-100" : "-z-20 opacity-0 pointer-events-none")}
                onClick={() => {
                    setIsUploadPanelOpen(false);
                }}
            >
                <div
                    className="w-full h-full bg-white dark:bg-slate-900 rounded-xl"
                    onClick={(e) => {
                        e.stopPropagation();
                    }}
                >
                    <div className="flex flex-col w-full h-full p-4 gap-4">
                        <div className="flex flex-col">
                            <span className="text-xl font-medium">Add New Property</span>
                            <span className="text-sm text-black/75 dark:text-white/75">It takes just two files!</span>
                        </div>
                        <div className="flex flex-row w-full h-full gap-4">
                            <label htmlFor="model_file_uploader" className="relative flex flex-col w-full h-full">
                                {
                                    modelFile ?
                                    <div className="flex flex-col w-full h-full gap-2 justify-center items-center p-4 border-2 border-blue-400 rounded-xl shadow-blue-400 shadow-[0_0_16px]">
                                        <Apartment sx={{ fontSize: 48 }} />
                                        {modelFile.name}
                                    </div> :
                                    <div className="flex flex-col w-full h-full gap-2 justify-center items-center p-4 border-2 rounded-xl border-dashed">
                                        <Upload sx={{ fontSize: 48 }} />
                                        Upload STL Model
                                    </div>
                                }
                                <input
                                    id="model_file_uploader"
                                    type="file"
                                    accept=".stl"
                                    className="absolute left-0 top-0 w-full h-full opacity-0"
                                    onChange={(e) => {
                                        if (e.target.files[0].type == "application/stl") {
                                            setModelFile(e.target.files[0]);
                                        }
                                    }}
                                />
                            </label>
                            <label htmlFor="excel_file_uploader" className="relative flex flex-col w-full h-full">
                                {
                                    excelFile ?
                                    <div className="flex flex-col w-full h-full gap-2 justify-center items-center p-4 border-2 border-blue-400 rounded-xl shadow-blue-400 shadow-[0_0_16px]">
                                        <ListAlt sx={{ fontSize: 48 }} />
                                        {excelFile.name}
                                    </div> :
                                    <div className="flex flex-col w-full h-full gap-2 justify-center items-center p-4 border-2 rounded-xl border-dashed">
                                        <Upload sx={{ fontSize: 48 }} />
                                        Upload Excel File
                                    </div>
                                }
                                <input
                                    id="excel_file_uploader"
                                    type="file"
                                    accept=".xlsx"
                                    className="absolute left-0 top-0 w-full h-full opacity-0"
                                    onChange={(e) => {
                                        if (e.target.files[0].type == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
                                            setExcelFile(e.target.files[0]);
                                        }
                                    }}
                                />
                            </label>
                        </div>
                        <button
                            className="flex flex-col justify-center items-center w-full h-12 p-2 gap-2 outline rounded-sm cursor-pointer hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all"
                            onClick={() => {
                                if (modelFile && excelFile) {
                                    uploadFile(excelFile, "xlsx", "b8c0233b-069d-44b9-bd28-b60255448678").then((excelUploadResponse) => {
                                        console.log(excelUploadResponse);
                                        uploadFile(modelFile, "stl", "b8c0233b-069d-44b9-bd28-b60255448678", 20).then((modelUploadResponse) => {
                                            console.log(modelUploadResponse);
                                        });
                                    });
                                }
                            }}
                        >
                            Upload
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}