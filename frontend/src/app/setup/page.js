'use client'

import { useState } from "react";

import { uploadFile } from "../../../utilities/endpoints";

export default function Page() {
    const [modelFile, setModelFile] = useState();
    const [excelFile, setExcelFile] = useState();

    return (
        <div className="flex flex-col">
            <input
                id='file_uploader'
                type='file'
                className=''
                onChange={(e) => {
                    console.log(e.target.files[0]);
                    setModelFile(e.target.files[0]);
                }}
            >
            </input>
            <button
                onClick={() => {
                    uploadFile(modelFile, 'stl', 'b8c0233b-069d-44b9-bd28-b60255448678', 20)
                }}
            >
                Upload test model
            </button>
            <input
                id='file_uploader'
                type='file'
                className=''
                onChange={(e) => {
                    console.log(e.target.files[0]);
                    setExcelFile(e.target.files[0]);
                }}
            >
            </input>
            <button
                onClick={() => {
                    uploadFile(excelFile, 'xlsx', 'b8c0233b-069d-44b9-bd28-b60255448678').then((e) => {
                        console.log(e);
                    });
                }}
            >
                Upload test Excel
            </button>
        </div>
    );
}