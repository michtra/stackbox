"use client"

import { useEffect, useState } from "react";
import clsx from "clsx";
import { Menu, MenuItem } from "@mui/material";
import { KeyboardArrowDown } from "@mui/icons-material";

import BuildingStatistics from "@/app/components/information/BuildingStatistics";
import BuildingComposition from "@/app/components/information/BuildingComposition";
import BuildingEdit from "@/app/components/information/BuildingEdit";
import { getRentalData } from "@/app/utilities/processor";

export default function BuildingInformation({ stackingData, setStackingData, isDarkMode = false, visualizationProps }) {
    const [selectedTab, setSelectedTab] = useState("Statistics and Assumptions");
    const [timeUnit, setTimeUnit] = useState("Month");
    const [anchorEl, setAnchorEl] = useState(null);
    const [rentalData, setRentalData] = useState(getRentalData(stackingData));

    const isTabMenuOpen = Boolean(anchorEl);

    useEffect(() => {
        visualizationProps.setSelectedFloors([]);
        visualizationProps.setSelectedTenants([]);
        visualizationProps.setSelectedLayers([]);
    }, [selectedTab]);

    return (
        <div className="w-full h-full flex flex-col overflow-hidden">
            <div className="w-full flex-1 min-h-0 flex flex-col gap-6">
                <div className="flex flex-col px-8 pt-2">
                    <span className="text-2xl font-medium">{stackingData.building.name}</span>
                    <span className="text-black/75 dark:text-white/75">{stackingData.building.address.street}</span>
                    <span className="text-black/75 dark:text-white/75">{stackingData.building.address.city}, {stackingData.building.address.state} {stackingData.building.address.zip}, {stackingData.building.address.country}</span>
                </div>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] px-8 gap-4 max-w-160">
                    <div>
                        <button
                            className="flex flex-row justify-between items-center w-full max-w-72 h-10 px-4 border rounded-lg transition-all"
                            id="tab-button"
                            aria-controls={isTabMenuOpen ? "tab-menu" : undefined}
                            aria-haspopup={true}
                            aria-expanded={isTabMenuOpen ? true : undefined}
                            onClick={(e) => {
                                setAnchorEl(e.currentTarget);
                            }}
                        >
                            {selectedTab}
                            <KeyboardArrowDown />
                        </button>
                        <Menu
                            id="tab-menu"
                            anchorEl={anchorEl}
                            open={isTabMenuOpen}
                            onClose={() => setAnchorEl(null)}
                            slotProps={{
                                list: {
                                    "aria-labelledby": "tab-button",
                                }
                            }}
                        >
                            <MenuItem
                                onClick={() => {
                                    setSelectedTab("Statistics and Assumptions");
                                    setAnchorEl(null);
                                }}
                            >
                                Statistics and Assumptions
                            </MenuItem>
                            <MenuItem
                                onClick={() => {
                                    setSelectedTab("Tenant Composition");
                                    setAnchorEl(null);
                                }}
                            >
                                Tenant Composition
                            </MenuItem>
                            <MenuItem
                                onClick={() => {
                                    setSelectedTab("Edit");
                                    setAnchorEl(null);
                                }}
                            >
                                Edit
                            </MenuItem>
                        </Menu>
                    </div>
                    <div className="w-48 h-10 flex flex-row bg-black/10 dark:bg-white/10 p-1 rounded-lg">
                        <div
                            className={clsx("w-full h-full flex flex-col justify-center items-center px-3 rounded-lg font-medium transition-all", timeUnit == "Month" ? "bg-white dark:bg-slate-500 text-black dark:text-white" : "bg-transparent text-black/50 dark:text-white/50")}
                            onClick={() => setTimeUnit("Month")}
                        >
                            Month
                        </div>
                        <div
                            className={clsx("w-full h-full flex flex-col justify-center items-center px-3 rounded-lg font-medium transition-all", timeUnit == "Year" ? "bg-white dark:bg-slate-500 text-black dark:text-white" : "bg-transparent text-black/50 dark:text-white/50")}
                            onClick={() => setTimeUnit("Year")}
                        >
                            Year
                        </div>
                    </div>
                </div>
                <div className="w-full flex-1 overflow-y-scroll px-2 pb-8 md:px-0">
                    {selectedTab === "Statistics and Assumptions" && (
                        <BuildingStatistics stackingData={stackingData} isDarkMode={isDarkMode} timeUnit={timeUnit} rentalData={rentalData} visualizationProps={visualizationProps} />
                    )}
                    {selectedTab === "Tenant Composition" && (
                        <BuildingComposition stackingData={stackingData} isDarkMode={isDarkMode} timeUnit={timeUnit} rentalData={rentalData} visualizationProps={visualizationProps} />
                    )}
                    {selectedTab === "Edit" && (
                        <BuildingEdit stackingData={stackingData} setStackingData={setStackingData} isDarkMode={isDarkMode} rentalData={rentalData} setRentalData={setRentalData} visualizationProps={visualizationProps} />
                    )}
                </div>
            </div>
        </div>
    );
}