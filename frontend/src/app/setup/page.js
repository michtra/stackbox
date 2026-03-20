"use client"

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import BuildingAdjustments from "@/app/components/visuals/BuildingAdjustments";
import ResizableWindows from "@/app/components/ui/ResizableWindows";
import BuildingForm from "@/app/components/forms/BuildingForm";
import ThemeToggle from "@/app/components/ui/ThemeToggle";
import { isBlobUrlValid } from "@/app/utilities/endpoints";

export default function Page() {
    const router = useRouter();
    const setupParams = useSearchParams();

    const [isDarkMode, setIsDarkMode] = useState(false);

    const [modelSrc, setModelSrc] = useState(setupParams.get("model_url"));
    const [excelSrc, setExcelSrc] = useState(setupParams.get("excel_url"));

    const [scale, setScale] = useState(0);
    const [coordLng, setCoordLng] = useState(-95.36576714742297);
    const [coordLat, setCoordLat] = useState(29.76046335699732);
    const [rotation, setRotation] = useState(0);

    const mapRef = useRef();
    const modelRef = useRef();
    const meshRef = useRef();

    const modelProps = {
        modelRef: modelRef,
        meshRef: meshRef,
        scale: scale,
        setScale: setScale,
        coordLng: coordLng,
        setCoordLng: setCoordLng,
        coordLat: coordLat,
        setCoordLat: setCoordLat,
        rotation: rotation,
        setRotation: setRotation,
    };

    const srcProps = {
        modelSrc: modelSrc,
        setModelSrc: setModelSrc,
        excelSrc: excelSrc,
        setExcelSrc: setExcelSrc,
    }

    useEffect(() => {
        async function checkBlobValid() {
            if (!(await isBlobUrlValid(modelSrc)) || !(await isBlobUrlValid(excelSrc))) {
                router.push("/");
            }
        }
        checkBlobValid();
    }, []);

    return (        
        <div className="relative w-full min-h-screen overflow-hidden">
            <ResizableWindows>
                <BuildingAdjustments
                    srcProps={srcProps}
                    isDarkMode={isDarkMode}
                    mapRef={mapRef}
                    modelProps={modelProps}
                />
                <BuildingForm
                    srcProps={srcProps}
                    isDarkMode={isDarkMode}
                    mapRef={mapRef}
                    modelProps={modelProps}
                />
            </ResizableWindows>
            <div className="absolute left-4 bottom-4">
                <ThemeToggle setIsDarkMode={setIsDarkMode} />
            </div>
        </div>
    );
}