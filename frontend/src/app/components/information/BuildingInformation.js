"use client"

import { useRef, useState } from "react";
import clsx from "clsx";

import OccupancyPieChart from "@/app/components/charts/OccupancyPieChart";
import FloorOccupancyChart from "@/app/components/charts/FloorOccupancyChart";
import ChartExportButton from '../../components/charts/ChartExportButton';
import ThemeToggle from "@/app/components/ui/ThemeToggle";

export default function BuildingInformation({ stackingData, isDarkMode }) {
    const pieChartRef = useRef(null);
    const floorChartRef = useRef(null);

    const [chartTab, setChartTab] = useState('pie');

    return (
        <div className='w-full h-full flex flex-col overflow-hidden'>
            <div className="w-full flex-1 min-h-0 flex flex-col">
                <div className="flex flex-col px-6 pt-2 pb-6">
                    <span className="text-2xl font-medium">{stackingData.building.name}</span>
                    <span className="text-black/50 dark:text-white/75">{stackingData.building.address.street}</span>
                    <span className="text-black/50 dark:text-white/75">{stackingData.building.address.city}, {stackingData.building.address.state} {stackingData.building.address.zip}, {stackingData.building.address.country}</span>
                </div>
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
                <div className="w-full flex-1 overflow-y-scroll px-2 md:px-0">
                    {chartTab === 'pie' && (
                        <div ref={pieChartRef} className="min-h-full">
                            <div className="max-w-6xl mx-auto p-8 h-full flex flex-col">
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
                                    <OccupancyPieChart stackingData={stackingData} isDarkMode={isDarkMode} />
                                </div>
                            </div>
                        </div>
                    )}
                    {chartTab === 'floor' && (
                        <div ref={floorChartRef} className="min-h-full">
                            <div className="max-w-6xl mx-auto p-8 overflow-x-auto">
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
                                    <FloorOccupancyChart stackingData={stackingData} isDarkMode={isDarkMode} />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                <div className="shrink-0 px-6 md:px-8 py-4 border-t shadow-lg bg-white dark:bg-slate-800 border-black/15 dark:border-slate-700">
                    <div className="max-w-6xl mx-auto flex justify-between text-sm font-medium text-black/75 dark:text-white/85">
                        <span className="flex items-center gap-2">
                            <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: '#3b82f6' }}></span>
                            Total Floors: <span className="font-bold text-black dark:text-white">{stackingData.building.metadata.totalFloors}</span>
                        </span>
                        <span className="flex items-center gap-2">
                            <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: '#3b82f6' }}></span>
                            Tenants: <span className="font-bold text-black dark:text-white">{stackingData.tenants.length}</span>
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}