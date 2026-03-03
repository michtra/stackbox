"use client"

import { useState } from "react";
import { Slider } from "@mui/material";

import { uploadFile } from "@/app/utilities/endpoints";

export default function BuildingForm({ mapRef, modelRef, setScale, scale, setCoords, coords, setRotation, rotation }) {
    const [modelFile, setModelFile] = useState();
    const [excelFile, setExcelFile] = useState();

    return (
        <div>
            <Slider
                value={scale ?? 1}
                valueLabelDisplay="auto"
                step={0.01}
                min={0.1}
                max={100}
                onChange={(e, val) => {
                    setScale(val);
                    modelRef.current.model.scale.set(val, val, val);
                    mapRef.current.triggerRepaint();
                }}
            />
            <div className="flex flex-col">
                <label htmlFor="model_file_uploader" className="w-16 h-16">Upload STL Model:</label>
                <input
                    id="model_file_uploader"
                    type="file"
                    className=""
                    onChange={(e) => {
                        console.log(e.target.files[0]);
                        setModelFile(e.target.files[0]);
                    }}
                >
                </input>
                <button
                    onClick={() => {
                        uploadFile(modelFile, "stl", "b8c0233b-069d-44b9-bd28-b60255448678", 20)
                    }}
                >
                    Upload test model
                </button>
                <label htmlFor="excel_file_uploader" className="w-16 h-16">Upload Excel Data:</label>
                <input
                    id="excel_file_uploader"
                    type="file"
                    className=""
                    onChange={(e) => {
                        console.log(e.target.files[0]);
                        setExcelFile(e.target.files[0]);
                    }}
                >
                </input>
                <button
                    onClick={() => {
                        uploadFile(excelFile, "xlsx", "b8c0233b-069d-44b9-bd28-b60255448678").then((e) => {
                            console.log(e);
                        });
                    }}
                >
                    Upload test Excel
                </button>
            </div>
        </div>
    );
}