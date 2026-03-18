"use client"

import { useState } from "react";
import clsx from "clsx";
import { Menu, MenuItem } from "@mui/material";
import { KeyboardArrowDown } from "@mui/icons-material";

import BuildingStatistics from "@/app/components/information/BuildingStatistics";
import BuildingComposition from "@/app/components/information/BuildingComposition";
import TenantColors from "@/app/components/information/TenantColors";

/**
 * 
 * @param {Object} stackingData - JSON endpoint output from data of a singular building. 
 * @returns 
 */
function getRentalData(stackingData) {
    let totalOccupiedSF = 0;
    let rentalIncome = 0;
    let weightedTotalLeaseTerm = 0;
    let rentRoll = [];
    const tenantNames = {};
    const now = new Date();

    stackingData.tenants.forEach((tenant) => {
        tenantNames[tenant.id] = tenant.name;
    });

    stackingData.floors.forEach((floor) => {
        floor.occupancies.forEach((occupancy) => {
            const leaseStart = new Date(occupancy.leaseStart);
            const leaseEnd = new Date(occupancy.leaseEnd);
            if (leaseStart <= now <= leaseEnd) {
                
                // Calculating months until lease end, takes fractional months into account
                let leaseLeftMonths = 0;
                const daysInCurrMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
                if (leaseEnd.getFullYear() !== now.getFullYear() || leaseEnd.getMonth() !== now.getMonth()) {
                    const daysInLeaseEndMonth = new Date(leaseEnd.getFullYear(), leaseEnd.getMonth() + 1, 0).getDate();
                    const monthFractionCurrMonth = (daysInCurrMonth - now.getDate()) / daysInCurrMonth;
                    const monthFractionLeaseEndMonth = (leaseEnd.getDate() - daysInLeaseEndMonth) / daysInLeaseEndMonth;
                    leaseLeftMonths = ((leaseEnd.getFullYear() - now.getFullYear()) * 12) + (leaseEnd.getMonth() - now.getMonth()) + monthFractionLeaseEndMonth + monthFractionCurrMonth;
                }
                else {
                    leaseLeftMonths = (leaseEnd.getDate() - now.getDate()) / daysInCurrMonth;
                }

                // Calculating weighted total lease term, later divided by total occupied SF
                weightedTotalLeaseTerm += leaseLeftMonths * occupancy.squareFeet.parsedValue;

                totalOccupiedSF += occupancy.squareFeet.parsedValue;
                rentalIncome += occupancy.baseRent.parsedValue;

                rentRoll.push({
                    "id": `${floor.floorNumber}-${occupancy.roomNumber}-${occupancy.tenantId}`,
                    "floor": floor.floorNumber,
                    "roomNumber": occupancy.roomNumber,
                    "tenantId": occupancy.tenantId,
                    "tenantName": tenantNames[occupancy.tenantId],
                    "leaseType": occupancy.leaseType,
                    "leaseStart": leaseStart,
                    "leaseEnd": leaseEnd,
                    "leaseLeftMonths": leaseLeftMonths,
                    "squareFeet": occupancy.squareFeet.parsedValue,
                    "baseRent": occupancy.baseRent.parsedValue,
                    "psfRent": occupancy.baseRent.parsedValue / occupancy.squareFeet.parsedValue,
                });
            }
        });
    });

    return {
        "rentRoll": rentRoll,
        "totalOccupiedSF": totalOccupiedSF,
        "rentalIncome": rentalIncome,
        "walt": totalOccupiedSF === 0 ? 0 : weightedTotalLeaseTerm / totalOccupiedSF,
    }
}

export default function BuildingInformation({ stackingData, isDarkMode }) {
    const [selectedTab, setSelectedTab] = useState("Statistics and Assumptions");
    const [timeUnit, setTimeUnit] = useState("Month");
    const [anchorEl, setAnchorEl] = useState(null);
    const isTabMenuOpen = Boolean(anchorEl);

    const rentalData = getRentalData(stackingData);

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
                            className="flex flex-row justify-center items-center h-10 px-4 border rounded-lg transition-all"
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
                                    setSelectedTab("Tenant Colors");
                                    setAnchorEl(null);
                                }}
                            >
                                Tenant Colors
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
                        <BuildingStatistics stackingData={stackingData} isDarkMode={isDarkMode} timeUnit={timeUnit} rentalData={rentalData} />
                    )}
                    {selectedTab === "Tenant Composition" && (
                        <BuildingComposition stackingData={stackingData} isDarkMode={isDarkMode} timeUnit={timeUnit} rentalData={rentalData} />
                    )}
                    {selectedTab === "Tenant Colors" && (
                        <TenantColors stackingData={stackingData} />
                    )}
                </div>
            </div>
        </div>
    );
}