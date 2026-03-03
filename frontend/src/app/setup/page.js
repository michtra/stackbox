"use client"

import { useRef, useState } from "react";

import BuildingAdjustments from "@/app/components/visuals/BuildingAdjustments";
import ResizableWindows from "@/app/components/ui/ResizableWindows";
import BuildingForm from "@/app/components/forms/BuildingForm";

export default function Page() {
    const [scale, setScale] = useState(1);
    const [coords, setCoords] = useState([-95.36576714742297, 29.76046335699732]);
    const [rotation, setRotation] = useState(0);

    const mapRef = useRef();
    const modelRef = useRef();
    return (
        <ResizableWindows>
            <BuildingAdjustments
                src="tower.stl"
                mapRef={mapRef}
                modelRef={modelRef}
                scale={scale}
                setCoords={setCoords}
                coords={coords}
                setRotation={setRotation}
                rotation={rotation}
            />
            <BuildingForm
                mapRef={mapRef}
                modelRef={modelRef}
                setScale={setScale}
                scale={scale}
                setCoords={setCoords}
                coords={coords}
                setRotation={setRotation}
                rotation={rotation}
            />
        </ResizableWindows>
    );
}