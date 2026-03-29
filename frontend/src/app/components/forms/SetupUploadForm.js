import { useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Upload } from "@mui/icons-material";
import { Apartment } from "@mui/icons-material";
import { ListAlt } from "@mui/icons-material";

export default function SetupUploadForm({ isUploadPanelOpen, setIsUploadPanelOpen }) {
    const router = useRouter();

    const [modelFileName, setModelFileName] = useState();
    const [excelFileName, setExcelFileName] = useState();
    const [modelFileURL, setModelFileURL] = useState();
    const [excelFileURL, setExcelFileURL] = useState();

    return (
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
                    </div>
                    <div className="flex flex-row w-full h-full gap-4">
                        <label htmlFor="model_file_uploader" className="relative flex flex-col w-full h-full">
                            {
                                modelFileName ?
                                <div className="flex flex-col w-full h-full gap-2 justify-center items-center p-4 border-2 border-blue-400 rounded-xl shadow-blue-400 shadow-[0_0_16px]">
                                    <Apartment sx={{ fontSize: 48 }} />
                                    {modelFileName}
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
                                className="absolute left-0 top-0 w-full h-full opacity-0 cursor-pointer"
                                onChange={(e) => {
                                    if (e.target.files[0].type == "application/stl") {
                                        setModelFileURL(URL.createObjectURL(e.target.files[0]));
                                        setModelFileName(e.target.files[0].name);
                                    }
                                }}
                            />
                        </label>
                        <label htmlFor="excel_file_uploader" className="relative flex flex-col w-full h-full">
                            {
                                excelFileName ?
                                <div className="flex flex-col w-full h-full gap-2 justify-center items-center p-4 border-2 border-blue-400 rounded-xl shadow-blue-400 shadow-[0_0_16px]">
                                    <ListAlt sx={{ fontSize: 48 }} />
                                    {excelFileName}
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
                                className="absolute left-0 top-0 w-full h-full opacity-0 cursor-pointer"
                                onChange={(e) => {
                                    if (e.target.files[0].type == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
                                        setExcelFileURL(URL.createObjectURL(e.target.files[0]));
                                        setExcelFileName(e.target.files[0].name);
                                    }
                                }}
                            />
                        </label>
                    </div>
                    <button
                        className="flex flex-col justify-center items-center w-full h-12 p-2 gap-2 outline rounded-sm cursor-pointer hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all"
                        onClick={() => {
                            if (modelFileURL && excelFileURL) {
                                const setupParams = new URLSearchParams();
                                setupParams.append("model_url", modelFileURL);
                                setupParams.append("excel_url", excelFileURL);
                                router.push(`/setup?${setupParams.toString()}`);
                            }
                        }}
                    >
                        Upload
                    </button>
                </div>
            </div>
        </div>
    );
}