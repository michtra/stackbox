"use client"

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import clsx from "clsx";

import BuildingVisualization from "@/app/components/visuals/BuildingVisualization";
import OccupancyPieChart from "@/app/components/charts/OccupancyPieChart";
import FloorOccupancyChart from "@/app/components/charts/FloorOccupancyChart";
import ChartExportButton from '../../components/charts/ChartExportButton';
import ThemeToggle from "@/app/components/ui/ThemeToggle";

import stacking from '../../../../test/stacking.json';
import stackingLegacy from '../../../../test/stacking-legacy.json';

export default function Page() {
    const router = useRouter();

    const pieChartRef = useRef(null);
    const floorChartRef = useRef(null);

    const [activeTab, setActiveTab] = useState('map');
    const [chartTab, setChartTab] = useState('pie');
    const [isDarkMode, setIsDarkMode] = useState(false);

    return (
        <div className='w-full min-h-screen flex flex-col overflow-hidden bg-white dark:slate-900' style={{ minHeight: '100dvh' }}>
            <div className="flex border-b z-10 relative bg-white dark:bg-slate-800 border-black/15 dark:border-slate-700">
                <button
                    onClick={() => setActiveTab('map')}
                    className={clsx("flex-1 px-4 py-2 text-sm font-medium transition-colors duration-200", activeTab === 'map' ? "text-blue-500 border-b-2 border-blue-500 bg-blue-500/15" : "text-black/75 dark:text-white/85")}
                >
                    Map
                </button>
                <button
                    onClick={() => setActiveTab('charts')}
                    className={clsx("flex-1 px-4 py-2 text-sm font-medium transition-colors duration-200", activeTab === 'charts' ? "text-blue-500 border-b-2 border-blue-500 bg-blue-500/15" : "text-black/75 dark:text-white/85")}
                >
                    Charts
                </button>
                <ThemeToggle setIsDarkMode={setIsDarkMode} />
            </div>
            {activeTab === 'map' && <BuildingVisualization stackingData={stacking} isDarkMode={isDarkMode} />}
            {activeTab === 'charts' && (
                <div className="w-full flex-1 min-h-0 flex flex-col bg-slate-200/25 dark:bg-slate-900">
                    <div className="flex border-b shadow-sm bg-white dark:bg-slate-800 border-black/15 dark:border-slate-700">
                        <button
                            onClick={() => setChartTab('pie')}
                            className={clsx("flex-1 px-6 py-3 text-sm font-semibold transition-all duration-200", chartTab === 'pie' ? "text-blue-500 border-b-2 border-blue-500 bg-blue-500/15" : "text-black/75 dark:text-white/85")}
                        >
                            Overview
                        </button>
                        <button
                            onClick={() => setChartTab('floor')}
                            className={clsx("flex-1 px-6 py-3 text-sm font-semibold transition-all duration-200", chartTab === 'floor' ? "text-blue-500 border-b-2 border-blue-500 bg-blue-500/15" : "text-black/75 dark:text-white/85")}
                        >
                            By Floor
                        </button>
                    </div>
                    <div className="flex-1 min-h-0 overflow-auto px-2 md:px-0">
                        {chartTab === 'pie' && (
                            <div ref={pieChartRef} className="min-h-full p-6 md:p-8">
                                <div className="max-w-6xl mx-auto rounded-xl shadow-lg p-8 h-full flex flex-col bg-white dark:bg-slate-800">
                                    <div className="mb-6">
                                        <h2 className="text-2xl font-bold mb-3">Building Occupancy by Tenant</h2>
                                        <ChartExportButton 
                                            targetRef={pieChartRef}
                                            filename="building-occupancy-pie"
                                            isDarkMode={isDarkMode}
                                        >
                                            Export
                                        </ChartExportButton>
                                    </div>
                                    <div className="flex-1 flex items-center justify-center">
                                        <OccupancyPieChart stackingData={stacking} isDarkMode={isDarkMode} />
                                    </div>
                                </div>
                            </div>
                        )}
                        {chartTab === 'floor' && (
                            <div ref={floorChartRef} className="min-h-full p-6 md:p-8">
                                <div className="max-w-6xl mx-auto rounded-xl shadow-lg p-8 overflow-x-auto bg-white dark:bg-slate-800">
                                    <div className="mb-6">
                                        <h2 className="text-2xl font-bold mb-3">Occupancy by Floor</h2>
                                        <ChartExportButton 
                                            targetRef={floorChartRef}
                                            filename="occupancy-by-floor"
                                            isDarkMode={isDarkMode}
                                        >
                                            Export
                                        </ChartExportButton>
                                    </div>
                                    <div className="mt-4">
                                        <FloorOccupancyChart stackingData={stacking} isDarkMode={isDarkMode} />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="shrink-0 px-6 md:px-8 py-4 border-t shadow-lg bg-white dark:bg-slate-800 border-black/15 dark:border-slate-700">
                        <div className="max-w-6xl mx-auto flex justify-between text-sm font-medium text-black/75 dark:text-white/85">
                            <span className="flex items-center gap-2">
                                <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: '#3b82f6' }}></span>
                                Total Floors: <span className="font-bold text-black dark:text-white">{stacking.building.metadata.totalFloors}</span>
                            </span>
                            <span className="flex items-center gap-2">
                                <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: '#3b82f6' }}></span>
                                Tenants: <span className="font-bold text-black dark:text-white">{stacking.tenants.length}</span>
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}