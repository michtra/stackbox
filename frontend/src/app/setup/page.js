'use client'

import { useState } from "react";

import { uploadFile } from "../../../utilities/endpoints";

export default function Page() {
    const [file, setFile] = useState();

    return (
        <div>
            <input
                id='file_uploader'
                type='file'
                className=''
                onChange={(e) => {
                    console.log(e.target.files[0])
                    setFile(e.target.files[0])
                }}
            >
            </input>
            <button
                onClick={() => {
                    uploadFile(file, 'stl', 20)
                }}
            >
                Upload test
            </button>
        </div>
    );
}