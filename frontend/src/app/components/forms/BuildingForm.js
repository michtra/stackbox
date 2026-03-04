"use client"

import { useState } from "react";
import { Slider } from "@mui/material";
import { Upload } from "@mui/icons-material";
import { Apartment } from "@mui/icons-material";
import { ListAlt } from "@mui/icons-material";

import { uploadFile } from "@/app/utilities/endpoints";
import NumberInput from "@/app/components/ui/NumberInput";

export default function BuildingForm({ mapRef, modelRef, setScale, scale, setCoordLng, coordLng, setCoordLat, coordLat, setRotation, rotation }) {
    const [modelFile, setModelFile] = useState();
    const [excelFile, setExcelFile] = useState();

    return (
        <div className="flex flex-col w-full h-full p-6 gap-8 overflow-y-scroll">
            <div className="flex flex-col">
                <span>Scale</span>
                <Slider
                    value={scale ?? 1}
                    valueLabelDisplay="auto"
                    step={0.01}
                    min={0.1}
                    max={100}
                    marks={[
                        {value: 0.01, label: "0.01"},
                        {value: 1, label: "1"},
                        {value: 10, label: "10"},
                        {value: 100, label: "100"}
                    ]}
                    onChange={(e, val) => {
                        setScale(val);
                        modelRef.current.model.scale.set(val, val, val);
                        mapRef.current.triggerRepaint();
                    }}
                />
            </div>
            <div className="flex flex-col">
                <span>Rotation</span>
                <Slider
                    value={rotation ?? 0}
                    valueLabelDisplay="auto"
                    step={0.01}
                    min={0}
                    max={360}
                    marks={[
                        {value: 0, label: "0°"},
                        {value: 90, label: "90°"},
                        {value: 180, label: "180°"},
                        {value: 270, label: "270°"},
                        {value: 360, label: "360°"}
                    ]}
                    onChange={(e, val) => {
                        setRotation(val);
                        modelRef.current.setRotation({ x: 0, y: 0, z: val });
                        mapRef.current.triggerRepaint();
                    }}
                />
            </div>
            <div className="flex flex-col gap-2">
                <span>Latitude</span>
                <NumberInput
                    value={coordLat}
                    increment={0.0001}
                    min={-90}
                    max={90}
                    onChange={(val) => {
                        setCoordLat(val);
                        modelRef.current.setCoords([coordLng, val]);
                        mapRef.current.triggerRepaint();
                    }}
                />
            </div>
            <div className="flex flex-col gap-2">
                <span>Longitude</span>
                <NumberInput
                    value={coordLng}
                    increment={0.0001}
                    min={-180}
                    max={180}
                    onChange={(val) => {
                        setCoordLng(val);
                        modelRef.current.setCoords([val, coordLat]);
                        mapRef.current.triggerRepaint();
                    }}
                />
            </div>
            <div className="flex flex-col gap-4">
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
                    Reupload
                </button>
            </div>
        </div>
    );
}