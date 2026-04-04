"use client"

import { useEffect, useMemo, useRef, useState } from "react";
import { DataGrid, GridEditInputCell } from "@mui/x-data-grid";
import { createTheme, ThemeProvider } from "@mui/material";
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';

import { saveOccupanciesEndpoint } from "@/app/utilities/endpoints";
import { getRentalData } from "@/app/utilities/processor";

export default function OccupancyEditForm({ stackingData, setStackingData, isDarkMode, rentalData, setRentalData }) {
    // TODO: Add ability to add/delete occupancies

    const [rentRoll, setRentRoll] = useState(rentalData.rentRoll);
    const [saveState, setSaveState] = useState({ status: "", message: "" });
    const [editedRentalDataMap, setEditedRentalDataMap] = useState({});
    const [rowSelectionModel, setRowSelectionModel] = useState([]);
    const [isDeleteConfirmationOpen, setIsDeleteConfirmationOpen] = useState(false);
    const [isAddFormOpen, setIsAddFormOpen] = useState(false);
    const [newOccupancyData, setNewOccupancyData] = useState({});

    const newOccupancyList = useRef([]);

    console.log(rentalData)

    const theme = useMemo(() => 
        createTheme({
            palette: {
                mode: isDarkMode ? "dark" : "light",
                DataGrid: {
                    bg: isDarkMode ? "#0f172b" : "#ffffff",
                }
            },
        }),
    [isDarkMode]);

    async function saveOccupancies() {
        setSaveState({ status: "saving", message: "Saving..." });
        try {
            if (!editedRentalDataMap || Object.keys(editedRentalDataMap).length === 0) {
                setSaveState({ status: "error", message: "No changes to save." });
                return;
            }

            const changesByOccupancyId = Object.fromEntries(
                Object.entries(editedRentalDataMap).map(([occupancyId, changes]) => {
                    return [
                        occupancyId,
                        Object.fromEntries(
                            Object.entries(changes).map(([key, value]) => {
                                return [key, value.value];
                            })
                        )
                    ];
                })
            );
            const movedStackingData = {}
            const newStackingData = {
                ...stackingData,
                floors: stackingData.floors.map((floor) => ({
                    ...floor,
                    occupancies: floor.occupancies
                        .filter((occupancy) => {
                            const notMoved = !(occupancy.id in changesByOccupancyId) || changesByOccupancyId[occupancy.id].floorNumber === floor.floorNumber
                            if (!notMoved) {
                                movedStackingData[changesByOccupancyId[occupancy.id].floorNumber] = {
                                    ...occupancy,
                                    ...changesByOccupancyId[occupancy.id],
                                };
                            }
                            return notMoved
                        })
                        .map((occupancy) => 
                            occupancy.id in changesByOccupancyId ?
                            {
                                ...occupancy,
                                ...changesByOccupancyId[occupancy.id],
                            } : occupancy
                        )
                }))
            }

            newStackingData.floors = newStackingData.floors.map((floor) =>
                floor.floorNumber in movedStackingData ?
                {
                    ...floor,
                    occupancies: [...floor.occupancies, movedStackingData[floor.floorNumber]],
                } :
                floor
            );

            const floorsExceeding = [];
            const exceedsMaxSF = newStackingData.floors.some((floor) => {
                const totalSF = floor.occupancies.reduce((acc, occupancy) => acc + occupancy.squareFeet, 0);
                const exceeds = totalSF > floor.squareFeet;
                if (exceeds) {
                    floorsExceeding.push(floor.floorNumber);
                }
                return exceeds;
            });

            if (exceedsMaxSF) {
                setSaveState({ status: "error", message: `Floors ${floorsExceeding.join(", ")} exceed their maximum square footage.` });
                return;
            }

            await saveOccupanciesEndpoint(stackingData.building.id, changesByOccupancyId)

            setRentalData(getRentalData(newStackingData));
            setStackingData(newStackingData);
            setEditedRentalDataMap({});
            setSaveState({ status: "success", message: "Saved." });
        }
        catch (error) {
            setSaveState({ status: "error", message: `Failed to save changes: ${error.message}` });
        }
    }

    async function deleteOccupancies() {
        setSaveState({ status: "saving", message: "Deleting..." });
        console.log(rowSelectionModel);
        setSaveState({ status: "success", message: "Deleted." });
    }

    const rentRollCols = [
        {
            field: "floorNumber",
            headerName: "Floor",
            type: "number",
            width: 100,
            editable: true,
            renderEditCell: (params) => (
                <GridEditInputCell
                    {...params}
                    inputProps={{
                        min: 1,
                        max: stackingData?.building?.metadata.totalFloors || 0,
                    }}
                />
            ),
            preProcessEditCellProps: (params) => {
                const hasError = params.props.value < 1 || params.props.value > (stackingData?.building?.metadata.totalFloors || 0);
                return { ...params.props, error: hasError };
            }
        },
        {
            field: "roomNumber",
            headerName: "Room/Suite Number",
            type: "string",
            width: 150,
            editable: true,
            preProcessEditCellProps: (params) => {
                const hasError = !params.props.value || params.props.value.toString().trim() === "";
                return { ...params.props, error: hasError };
            }
        },
        {
            field: "tenantId",
            headerName: "Tenant",
            type: "string",
            width: 200,
            editable: true,
            type: "singleSelect",
            valueOptions: stackingData?.tenants.map((tenant) => {
                return { value: tenant.id, label: tenant.name };
            }) || []
        },
        {
            field: "leaseType",
            headerName: "Lease Type",
            type: "string",
            width: 120,
            editable: true,
            type: "singleSelect",
            valueOptions: ["Gross", "Modified Gross", "Full-Service", "Single Net", "Double Net", "Triple Net"],
        },
        {
            field: "leaseStart",
            headerName: "Lease Start",
            type: "date",
            width: 120,
            editable: true,
            preProcessEditCellProps: (params) => {
                const hasError = !params.props.value || isNaN(new Date(params.props.value).getTime()) || (new Date(params.props.value) > new Date(rentRoll.find((row) => row.id === params.id)?.leaseEnd));
                return { ...params.props, error: hasError };
            }
        },
        {
            field: "leaseEnd",
            headerName: "Lease End",
            type: "date",
            width: 120,
            editable: true,
            preProcessEditCellProps: (params) => {
                const hasError = !params.props.value || isNaN(new Date(params.props.value).getTime()) || (new Date(params.props.value) < new Date(rentRoll.find((row) => row.id === params.id)?.leaseStart));
                return { ...params.props, error: hasError };
            }
        },
        {
            field: "squareFeet",
            headerName: "SF",
            type: "number",
            width: 100,
            editable: true,
            preProcessEditCellProps: (params) => {
                const row = rentRoll.find((row) => row.id === params.id);
                const totalFloorSF = stackingData.floors.find((f) => f.floorNumber === row.floor)?.squareFeet || 0;
                const currentFloorOccupancy = stackingData.floors.find((f) => f.floorNumber === row.floor)?.occupancies.reduce((acc, occupancy) => acc + occupancy.squareFeet, 0) || 0;
                const hasError = params.props.value <= 0 || params.props.value + currentFloorOccupancy - (row?.squareFeet || 0) > totalFloorSF;
                return { ...params.props, error: hasError };
            }
        },
        {
            field: "baseRent",
            headerName: "Base Rent (Month)",
            type: "number",
            width: 150,
            editable: true,
            preProcessEditCellProps: (params) => {
                const hasError = params.props.value < 0;
                return { ...params.props, error: hasError };
            }
        }
    ]

    return (
        <div className="flex flex-col">
            <div className="flex flex-col px-8">
                <h2 className="text-2xl font-semibold mb-2">Occupancy</h2>
                <p className="text-black/75 dark:text-white/75 mb-6">Edit each leases.</p>
            </div>
            <ThemeProvider theme={theme}>
                <DataGrid
                    className="mx-8 px-4 max-h-[65vh]"
                    rows={rentRoll}
                    columns={rentRollCols}
                    initialState={{ pagination: { page: 0, pageSize: 50 } }}
                    pageSizeOptions={[50, 100, 200, 500]}
                    checkboxSelection
                    disableRowSelectionOnClick
                    processRowUpdate={(newRow, oldRow) => {
                        setEditedRentalDataMap((prev) => ({
                            ...prev,
                            [newRow.id]: {
                                ...editedRentalDataMap[newRow.id],
                                ...Object.fromEntries(
                                    Object.entries(newRow).filter(([key, value]) => {
                                        return value !== oldRow[key];
                                    }).map(([key, value]) => {
                                        return [key, {
                                            value: value,
                                            originalValue: prev[newRow.id]?.[key]?.originalValue || oldRow[key],
                                        }]
                                    })
                                ),
                            }
                        }));

                        return newRow;
                    }}
                    onRowSelectionModelChange={(model) => {
                        setRowSelectionModel(model);
                    }}
                />
            </ThemeProvider>
            <div className="flex flex-col items-center gap-2 px-8 py-4">
                <div className="flex flex-row justify-between w-full gap-3">
                    <div className="flex flex-row gap-3">
                        <button
                            type="button"
                            className="h-10 px-4 border rounded-lg hover:bg-red-500 hover:text-white transition-all disabled:bg-transparent disabled:text-black/50 dark:disabled:bg-transparent dark:disabled:text-white/50 disabled:cursor-not-allowed"
                            onClick={() => setIsDeleteConfirmationOpen(true)}
                            disabled={saveState?.status === "saving"}
                        >
                            Delete
                        </button>
                        <Dialog
                            open={isDeleteConfirmationOpen}
                            onClose={() => setIsDeleteConfirmationOpen(false)}
                            aria-labelledby="alert-dialog-title"
                            aria-describedby="alert-dialog-description"
                        >
                            <DialogTitle id="alert-dialog-title">
                                Delete?
                            </DialogTitle>
                            <DialogContent>
                                <DialogContentText id="alert-dialog-description">
                                    Are you sure you want to delete the selected occupancies? This action cannot be undone.
                                </DialogContentText>
                            </DialogContent>
                            <DialogActions>
                                <button
                                    className="h-10 px-4 mb-3 border rounded-lg hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all"
                                    onClick={() => setIsDeleteConfirmationOpen(false)}
                                >
                                    NO!
                                </button>
                                <button
                                    className="h-10 px-4 mr-4 mb-3 border rounded-lg hover:bg-red-500 hover:text-white transition-all"
                                    onClick={() => {
                                        deleteOccupancies();
                                        setIsDeleteConfirmationOpen(false);
                                    }}
                                >
                                    Yes, delete them!
                                </button>
                            </DialogActions>
                        </Dialog>
                        <button
                            type="button"
                            className="h-10 px-4 border rounded-lg hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all disabled:bg-transparent disabled:text-black/50 dark:disabled:bg-transparent dark:disabled:text-white/50 disabled:cursor-not-allowed"
                            onClick={() => saveOccupancies()}
                            disabled={saveState?.status === "saving"}
                        >
                            Add
                        </button>
                    </div>
                    <button
                        type="button"
                        className="h-10 px-4 border rounded-lg hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all disabled:bg-transparent disabled:text-black/50 dark:disabled:bg-transparent dark:disabled:text-white/50 disabled:cursor-not-allowed"
                        onClick={() => saveOccupancies()}
                        disabled={saveState?.status === "saving"}
                    >
                        {saveState?.status === "saving" ? "Saving..." : "Save"}
                    </button>
                </div>
                <div className="flex flex-row w-full">
                    {saveState?.message && (
                        <span className={saveState.status === "error" ? "text-sm text-red-600 dark:text-red-300" : "text-sm text-green-700 dark:text-green-300"}>
                            {saveState.message}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}