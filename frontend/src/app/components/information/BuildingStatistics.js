"use client"

import { useRef } from "react";

import OccupancyPieChart from "@/app/components/charts/OccupancyPieChart";
import ChartExportButton from '../../components/charts/ChartExportButton';

export default function BuildingStatistics({ stackingData, isDarkMode, timeUnit, rentalData }) {
    const pieChartRef = useRef(null);

    return (
        <div className="flex flex-col gap-8">
            <div className="flex flex-col px-8 gap-4">
                <span className="text-2xl font-semibold">Statistics</span>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-2">
                    <div className="flex flex-col">
                        <span className="text-black/75 dark:text-white/75 text-sm font-bold">Expected Rental Revenue</span>
                        <span className="text-2xl font-medium">{(rentalData.rentalIncome * (timeUnit === "Year" ? 12 : 1)).toLocaleString("en-US", {style: "currency", currency: "USD"})} / {timeUnit}</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-black/75 dark:text-white/75 text-sm font-bold">WALT (By Rent)</span>
                        <span className="text-2xl font-medium">{(rentalData.walt / (timeUnit === "Year" ? 12 : 1)).toFixed(2)} {timeUnit}s</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-black/75 dark:text-white/75 text-sm font-bold">Vacancy Rate</span>
                        <span className="text-2xl font-medium">{(100 * rentalData.totalOccupiedSF / stackingData.building.metadata.grossSquareFeet).toFixed(2)}%</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-black/75 dark:text-white/75 text-sm font-bold">PSF Rent</span>
                        <span className="text-2xl font-medium">${(rentalData.rentalIncome / rentalData.totalOccupiedSF).toFixed(2)} PSF</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-black/75 dark:text-white/75 text-sm font-bold">Net Rentable Area</span>
                        <span className="text-2xl font-medium">{stackingData.building.metadata.grossSquareFeet.toLocaleString()} SF</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-black/75 dark:text-white/75 text-sm font-bold">Total Floors</span>
                        <span className="text-2xl font-medium">{stackingData.building.metadata.totalFloors}</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-black/75 dark:text-white/75 text-sm font-bold">Tenants</span>
                        <span className="text-2xl font-medium">{stackingData.tenants.length}</span>
                    </div>
                </div>
            </div>
            <div ref={pieChartRef} className="min-h-full">
                <div className="max-w-6xl mx-auto px-8 h-full flex flex-col">
                    <div className="mb-6">
                        <h2 className="text-2xl font-semibold mb-3">Tenant Pro Rata Share</h2>
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
        </div>
    );
}