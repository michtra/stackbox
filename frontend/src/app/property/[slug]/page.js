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

    const [rerenderFloors, setRerenderFloors] = useState(new Set());

    const [selectedFloors, setSelectedFloors] = useState([]);
    // TODO: Change this so that it includes all tenants initially.
    const [selectedTenants, setSelectedTenants] = useState([]);
    const [selectedLayers, setSelectedLayers] = useState([]);

    const visualizationProps = {
        rerenderFloors: rerenderFloors,
        setRerenderFloors: setRerenderFloors,
        selectedFloors: selectedFloors,
        setSelectedFloors: setSelectedFloors,
        selectedTenants: selectedTenants,
        setSelectedTenants: setSelectedTenants,
        selectedLayers: selectedLayers,
        setSelectedLayers: setSelectedLayers,
    }

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
                <ResizableWindows isDarkMode={isDarkMode}>
                    <BuildingVisualization stackingData={stacking} isDarkMode={isDarkMode} visualizationProps={visualizationProps} />
                    <BuildingInformation stackingData={stacking} setStackingData={setStacking} isDarkMode={isDarkMode} visualizationProps={visualizationProps} />
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