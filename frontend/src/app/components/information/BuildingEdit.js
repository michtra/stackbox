"use client"

import TenantEditForm from "../forms/TenantEditForm";
import OccupancyEditForm from "../forms/OccupancyEditForm";

export default function BuildingEdit({ stackingData, setStackingData, isDarkMode = false, rentalData, setRentalData, visualizationProps }) {
    return (
        <div className="flex flex-col gap-8">
            <TenantEditForm stackingData={stackingData} setStackingData={setStackingData} />
            <OccupancyEditForm stackingData={stackingData} setStackingData={setStackingData} isDarkMode={isDarkMode} rentalData={rentalData} setRentalData={setRentalData} visualizationProps={visualizationProps} />
        </div>
    );
}