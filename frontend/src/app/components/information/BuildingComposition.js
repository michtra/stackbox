"use client"

import { useEffect, useRef, useState } from "react";
import { DataGrid } from "@mui/x-data-grid";

import FloorOccupancyChart from "@/app/components/charts/FloorOccupancyChart";
import ChartExportButton from "@/app/components/charts/ChartExportButton";

export default function BuildingComposition({ stackingData, isDarkMode, timeUnit, rentalData }) {
    const floorChartRef = useRef(null);
    const [rentRoll, setRentRoll] = useState(rentalData.rentRoll);

    const leaseLeftYearsList = rentalData.rentRoll.map((row) => row.leaseLeftMonths / 12);
    const baseRentYearList = rentalData.rentRoll.map((row) => row.baseRent * 12);

    const rentRollCols = [
        {
            field: "floor",
            headerName: "Floor",
            type: "number",
            width: 70,
        },
        {
            field: "roomNumber",
            headerName: "Room/Suite Number",
            type: "number",
            width: 70,
        },
        {
            field: "tenantName",
            headerName: "Tenant",
            type: "string",
            width: 200,
        },
        {
            field: "leaseType",
            headerName: "Lease Type",
            type: "string",
            width: 100,
        },
        {
            field: "leaseStart",
            headerName: "Lease Start",
            type: "date",
            width: 100,
        },
        {
            field: "leaseEnd",
            headerName: "Lease End",
            type: "date",
            width: 100,
        },
        {
            field: "leaseLeftMonths",
            headerName: `Lease Left (${timeUnit}s)`,
            type: "number",
            format: (value) => value / (timeUnit === "Year" ? 12 : 1),
            width: 150,
        },
        {
            field: "squareFeet",
            headerName: "SF",
            type: "number",
            width: 100,
        },
        {
            field: "baseRent",
            headerName: `Base Rent (${timeUnit})`,
            type: "number",
            format: (value) => value.toFixed(2) * (timeUnit === "Year" ? 12 : 1),
            width: 150,
        },
        {
            field: "psfRent",
            headerName: "PSF Rent",
            type: "number",
            format: (value) => value.toFixed(2),
            width: 100,
        }
    ]

    useEffect(() => {
        setRentRoll(rentRoll.map((row, i) => {
            return {
                ...row,
                leaseLeftMonths: timeUnit === "Year" ? leaseLeftYearsList[i] : rentalData.rentRoll[i].leaseLeftMonths,
                baseRent: timeUnit === "Year" ? baseRentYearList[i] : rentalData.rentRoll[i].baseRent,
            }
        }));
    }, [timeUnit]);

    return (
        <div className="flex flex-col gap-8">
            <div ref={floorChartRef} className="min-h-full">
                <div className="max-w-6xl mx-auto px-8 overflow-x-auto">
                    <div className="mb-6">
                        <h2 className="text-2xl font-semibold mb-3">Occupancy by Floor</h2>
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
            <DataGrid
                className="mx-8 px-4 max-h-[65vh]"
                rows={rentRoll}
                columns={rentRollCols}
                initialState={{ pagination: { page: 0, pageSize: 50 } }}
                pageSizeOptions={[50, 100, 200, 500]}
            />
        </div>
    );
}