"use client"

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import clsx from "clsx";

import BuildingVisualization from "@/app/components/visuals/BuildingVisualization";
import BuildingInformation from "@/app/components/information/BuildingInformation";
import ResizableWindows from "@/app/components/ui/ResizableWindows";
import ThemeToggle from "@/app/components/ui/ThemeToggle";

import stacking from '../../../../test/stacking.json';

export default function Page() {
    const router = useRouter();
    const [isDarkMode, setIsDarkMode] = useState(false);

    return (
        <div className="relative w-full min-h-screen overflow-hidden">
            <ResizableWindows>
                <BuildingVisualization stackingData={stacking} isDarkMode={isDarkMode} />
                <BuildingInformation stackingData={stacking} isDarkMode={isDarkMode} />
            </ResizableWindows>
            <div className="absolute left-4 bottom-4">
                <ThemeToggle setIsDarkMode={setIsDarkMode} />
            </div>
        </div>
    );
}