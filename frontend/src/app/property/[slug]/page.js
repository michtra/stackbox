"use client"

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CircularProgress } from "@mui/material";

import BuildingVisualization from "@/app/components/visuals/BuildingVisualization";
import BuildingInformation from "@/app/components/information/BuildingInformation";
import ResizableWindows from "@/app/components/ui/ResizableWindows";
import ThemeToggle from "@/app/components/ui/ThemeToggle";
import { getBuilding } from "@/app/utilities/endpoints";

export default function Page() {
    const params = useParams();

    const [isDarkMode, setIsDarkMode] = useState(false);
    const [stacking, setStacking] = useState();

    useEffect(() => {
        getBuilding(params.slug).then((val) => {
            if (val.building && val.tenants && val.floors && val.geometries) {
                setStacking(val);
            }
        });
    }, [params.slug]);

    return (
        <div className="relative w-full min-h-screen overflow-hidden">
            {
                stacking ?
                <ResizableWindows>
                    <BuildingVisualization stackingData={stacking} isDarkMode={isDarkMode} />
                    <BuildingInformation stackingData={stacking} setStackingData={setStacking} isDarkMode={isDarkMode} />
                </ResizableWindows> :
                <div className="w-full h-screen flex flex-col justify-center items-center">
                    <CircularProgress size="3rem" />
                </div>
            }
            <div className="absolute left-4 bottom-4">
                <ThemeToggle setIsDarkMode={setIsDarkMode} />
            </div>
        </div>
    );
}