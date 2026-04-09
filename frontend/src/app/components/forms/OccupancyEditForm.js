"use client"

import { useRef, useState } from "react";
import { DataGrid, GridEditInputCell } from "@mui/x-data-grid";
import { MenuItem, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Select } from "@mui/material";
import { DateField, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";

import { addOccupancyEndpoint, deleteOccupanciesEndpoint, saveOccupanciesEndpoint } from "@/app/utilities/endpoints";
import { getRentalData } from "@/app/utilities/processor";
import NumberInput from "@/app/components/ui/NumberInput";

function AddOccupancyForm({ stackingData, formData, setFormData, tenantValueOptions, leaseTypeValueOptions, isInputValidRefs }) {
    const [squareFootRefreshToggle, setSquareFootRefreshToggle] = useState(false);

    const floorSFRemainingMap = Object.fromEntries(stackingData?.floors?.map((floor) => {
        return [
            floor.floorNumber,
            (
                floor.occupancies ?
                floor.occupancies.reduce((acc, occupancy) => {
                    return acc - occupancy.squareFeet;
                }, floor.squareFeet) :
                floor.squareFeet
            )
        ]
    }));

    return (
        <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
                <span>Floor</span>
                <NumberInput
                    value={formData.floorNumber ?? ""}
                    min={1}
                    max={stackingData?.building?.metadata.totalFloors || 0}
                    isValidOverride={(val) => {
                        isInputValidRefs.current.floorNumber = val;
                    }}
                    isIntOnly={true}
                    showIncrementButton={false}
                    onChange={(val) => {
                        setFormData((prev) => {
                            return {
                                ...prev,
                                "floorNumber": val
                            };
                        });
                        setSquareFootRefreshToggle(!squareFootRefreshToggle);
                    }}
                />
            </div>
            <div className="flex flex-col gap-2">
                <span>Room Number</span>
                <input
                    value={formData.roomNumber ?? ""}
                    onChange={(e) => {
                        setFormData((prev) => {
                            return {
                                ...prev,
                                "roomNumber": e.target.value
                            };
                        });
                        isInputValidRefs.current.roomNumber = Boolean(e.target.value?.length);
                    }}
                    className="flex flex-row px-4 py-2 gap-2 justify-between items-center outline rounded-sm focus-within:outline-blue-500 focus-within:outline-2"
                />
            </div>
            <div className="flex flex-col gap-2">
                <span>Lease Type</span>
                <Select
                    labelId="tenant-select-label"
                    id="tenant-select"
                    value={formData.leaseType}
                    onChange={(e) => {
                        setFormData((prev) => {
                            return {
                                ...prev,
                                "leaseType": e.target.value
                            };
                        });
                        isInputValidRefs.current.leaseType = Boolean(e.target.value?.length);
                    }}
                >
                    {leaseTypeValueOptions.map((leaseType) => <MenuItem value={leaseType}>{leaseType}</MenuItem>)}
                </Select>
            </div>
            <div className="flex flex-col gap-2">
                <span>Tenant</span>
                <Select
                    labelId="tenant-select-label"
                    id="tenant-select"
                    value={formData.tenantId}
                    onChange={(e) => {
                        setFormData((prev) => {
                            return {
                                ...prev,
                                "tenantId": e.target.value
                            };
                        });
                        isInputValidRefs.current.tenantId = Boolean(e.target.value?.length);
                    }}
                >
                    {tenantValueOptions.map((tenant) => <MenuItem value={tenant.value}>{tenant.label}</MenuItem>)}
                    <MenuItem value="new">New Tenant</MenuItem>
                </Select>
            </div>
            {
                formData.tenantId === "new" &&
                <div className="grid grid-cols-2 gap-4 col-span-2">
                    <div className="flex flex-col gap-2">
                        <span>New Tenant Name</span>
                        <input
                            value={formData.newTenantName ?? ""}
                            onChange={(e) => {
                                setFormData((prev) => {
                                    return {
                                        ...prev,
                                        "newTenantName": e.target.value
                                    };
                                });
                                isInputValidRefs.current.newTenantName = Boolean(e.target.value?.length);
                            }}
                            className="flex flex-row px-4 py-2 gap-2 justify-between items-center outline rounded-sm focus-within:outline-blue-500 focus-within:outline-2"
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <span>New Tenant Color</span>
                        <input
                            value={formData.newTenantColor ?? ""}
                            onChange={(e) => {
                                setFormData((prev) => {
                                    return {
                                        ...prev,
                                        "newTenantColor": e.target.value
                                    };
                                });
                                isInputValidRefs.current.newTenantColor = Boolean(e.target.value?.length);
                            }}
                            className="flex flex-row px-4 py-2 gap-2 justify-between items-center outline rounded-sm focus-within:outline-blue-500 focus-within:outline-2"
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <span>New Tenant Email</span>
                        <input
                            value={formData.newTenantContactEmail ?? ""}
                            onChange={(e) => {
                                setFormData((prev) => {
                                    return {
                                        ...prev,
                                        "newTenantContactEmail": e.target.value
                                    };
                                });
                                isInputValidRefs.current.newTenantContactEmail = Boolean(e.target.value?.length);
                            }}
                            className="flex flex-row px-4 py-2 gap-2 justify-between items-center outline rounded-sm focus-within:outline-blue-500 focus-within:outline-2"
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <span>New Tenant Phone</span>
                        <input
                            value={formData.newTenantContactPhone ?? ""}
                            onChange={(e) => {
                                setFormData((prev) => {
                                    return {
                                        ...prev,
                                        "newTenantContactPhone": e.target.value
                                    };
                                });
                                isInputValidRefs.current.newTenantContactPhone = Boolean(e.target.value?.length);
                            }}
                            className="flex flex-row px-4 py-2 gap-2 justify-between items-center outline rounded-sm focus-within:outline-blue-500 focus-within:outline-2"
                        />
                    </div>
                </div>
            }
            <LocalizationProvider dateAdapter={AdapterDayjs}>
                <div className="grid grid-cols-2 gap-4 col-span-2">
                    <div className="flex flex-col gap-2">
                        <span>Lease Start</span>
                        <DateField
                            value={formData.leaseStart}
                            slotProps={{
                                textField: {
                                    error: !isInputValidRefs.current.leaseStart,
                                    helperText: !isInputValidRefs.current.leaseStart && "Date must be before lease end."
                                }
                            }}
                            onChange={(val) => {
                                setFormData((prev) => {
                                    return {
                                        ...prev,
                                        "leaseStart": val
                                    };
                                });
                                const isDateOrdered = formData.leaseEnd?.isValid() && val?.isBefore(formData.leaseEnd)
                                isInputValidRefs.current.leaseStart = !!(val?.isValid() && isDateOrdered);
                                isInputValidRefs.current.leaseEnd = !!isDateOrdered;
                            }}
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <span>Lease End</span>
                        <DateField
                            value={formData.leaseEnd}
                            slotProps={{
                                textField: {
                                    error: !isInputValidRefs.current.leaseEnd,
                                    helperText: !isInputValidRefs.current.leaseEnd && "Date must be after lease start."
                                }
                            }}
                            onChange={(val) => {
                                setFormData((prev) => {
                                    return {
                                        ...prev,
                                        "leaseEnd": val
                                    };
                                });
                                const isDateOrdered = formData.leaseStart?.isValid() && val?.isAfter(formData.leaseStart)
                                isInputValidRefs.current.leaseEnd = !!(val?.isValid() && isDateOrdered);
                                isInputValidRefs.current.leaseStart = !!isDateOrdered;
                            }}
                        />
                    </div>
                </div>
            </LocalizationProvider>
            <div className="flex flex-col gap-2">
                <span>Square Feet</span>
                <NumberInput
                    value={formData.squareFeet ?? ""}
                    min={0}
                    max={floorSFRemainingMap[formData.floorNumber] || 0}
                    isValidOverride={(val) => {
                        isInputValidRefs.current.squareFeet = val;
                    }}
                    showIncrementButton={false}
                    refreshToggle={squareFootRefreshToggle}
                    onChange={(val) => {
                        setFormData((prev) => {
                            return {
                                ...prev,
                                "squareFeet": val
                            };
                        });
                    }}
                />
            </div>
            <div className="flex flex-col gap-2">
                <span>Base Rent (USD)</span>
                <NumberInput
                    value={formData.baseRent ?? ""}
                    min={0}
                    isValidOverride={(val) => {
                        isInputValidRefs.current.baseRent = val;
                    }}
                    showIncrementButton={false}
                    onChange={(val) => {
                        setFormData((prev) => {
                            return {
                                ...prev,
                                "baseRent": val
                            };
                        });
                    }}
                />
            </div>
        </div>
    );
}

export default function OccupancyEditForm({ stackingData, setStackingData, isDarkMode = false, rentalData, setRentalData, visualizationProps }) {

    const [rentRoll, setRentRoll] = useState(rentalData.rentRoll);
    const tenantValueOptions = stackingData?.tenants.map((tenant) => {
        return { value: tenant.id, label: tenant.name };
    }) || [];
    const leaseTypeValueOptions = ["Gross", "Modified Gross", "Full-Service", "Single Net", "Double Net", "Triple Net"];


    const [saveState, setSaveState] = useState({ status: "", message: "" });

    const [editedRentalDataMap, setEditedRentalDataMap] = useState({});

    const [rowSelectionModel, setRowSelectionModel] = useState({});
    const [isDeleteConfirmationOpen, setIsDeleteConfirmationOpen] = useState(false);

    const defaultNewOccupancyData = {
        "floorNumber": "",
        "roomNumber": "",
        "tenantId": "",
        "leaseType": "",
        "leaseStart": null,
        "leaseEnd": null,
        "squareFeet": "",
        "baseRent": "",
        "newTenantName": "",
        "newTenantColor": "",
        "newTenantContactEmail": "",
        "newTenantContactPhone": "",
    }

    const [isAddFormOpen, setIsAddFormOpen] = useState(false);
    const isNewOccupancyInputValidRefs = useRef(Object.fromEntries(Object.keys(defaultNewOccupancyData).map((key) => [key, false])));
    const [newOccupancyData, setNewOccupancyData] = useState(defaultNewOccupancyData);

    async function saveOccupancies() {
        setSaveState({ status: "saving", message: "Saving..." });
        try {

            const changedFloors = new Set();

            const changesByOccupancyId = Object.fromEntries(
                Object.entries(editedRentalDataMap).map(([occupancyId, changes]) => {
                    if ("floorNumber" in changes) {
                        changedFloors.add(changes["floorNumber"].originalValue);
                        changedFloors.add(changes["floorNumber"].value);
                    }

                    return [
                        occupancyId,
                        Object.fromEntries(
                            Object.entries(changes).filter(([key, value]) => {
                                return value.value !== value.originalValue;
                            }).map(([key, value]) => {
                                return [key, value.value];
                            })
                        )
                    ];
                })
            );

            if (!changesByOccupancyId || !Object.values(changesByOccupancyId).some((val) => Object.values(val).length > 0)) {
                setSaveState({ status: "error", message: "No changes to save." });
                return;
            }
            
            const movedStackingData = {}
            const newStackingData = {
                ...stackingData,
                floors: stackingData.floors.map((floor) => ({
                    ...floor,
                    occupancies: floor.occupancies
                        .filter((occupancy) => {
                            const notMoved = !(occupancy.id in changesByOccupancyId) || changesByOccupancyId[occupancy.id].floorNumber === floor.floorNumber
                            if (!notMoved) {
                                const newOccupancyData = {
                                    ...occupancy,
                                    ...changesByOccupancyId[occupancy.id],
                                };
                    
                                if (changesByOccupancyId[occupancy.id].floorNumber in movedStackingData) {
                                    movedStackingData[changesByOccupancyId[occupancy.id].floorNumber].push(newOccupancyData);
                                }
                                else {
                                    movedStackingData[changesByOccupancyId[occupancy.id].floorNumber] = [newOccupancyData];
                                }
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
                    occupancies: [...floor.occupancies, ...movedStackingData[floor.floorNumber]],
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
            
            const newRentalData = getRentalData(newStackingData);
            setRentalData(newRentalData);
            setRentRoll(newRentalData.rentRoll);
            setStackingData(newStackingData);
            setEditedRentalDataMap({});
            visualizationProps.setRerenderFloors(changedFloors);
            setSaveState({ status: "success", message: "Saved." });
        }
        catch (error) {
            setSaveState({ status: "error", message: `Failed to save changes: ${error.message}` });
        }
    }

    async function deleteOccupancies() {
        try {
            if (!(rowSelectionModel?.ids?.size)) {
                setSaveState({ status: "error", message: "No occupancies to delete." });
            }

            setSaveState({ status: "saving", message: "Deleting..." });

            await deleteOccupanciesEndpoint(stackingData.building.id, [...rowSelectionModel.ids]);

            const changedFloors = new Set();

            const newStackingData = {
                ...stackingData,
                floors: stackingData.floors.map((floor) => ({
                    ...floor,
                    occupancies: floor.occupancies
                    .filter((occupancy) => {
                        const isDeleted = rowSelectionModel.ids.has(occupancy.id)
                        if (isDeleted) {
                            changedFloors.add(floor.floorNumber);
                        }
                        return !isDeleted
                    })
                }))
            }
            const newRentalData = getRentalData(newStackingData);
            setRentalData(newRentalData);
            setRentRoll(newRentalData.rentRoll);
            setStackingData(newStackingData);
            visualizationProps.setRerenderFloors(changedFloors);
            setRowSelectionModel((prev) => {
                return {...prev, ids: new Set()}
            })
            setSaveState({ status: "success", message: "Deleted." });
        }
        catch (error) {
            setSaveState({ status: "error", message: `Failed to save changes: ${error.message}` });
        }

    }

    async function addOccupancy() {
        try {
            setSaveState({ status: "saving", message: "Adding..." });

            const addOccupancyData = await addOccupancyEndpoint(stackingData.building.id, newOccupancyData);

            const changedFloors = new Set([addOccupancyData.floorData.floorNumber]);

            const newStackingData = {
                ...stackingData,
                floors: stackingData.floors.map((floor) => (
                    floor.floorNumber === addOccupancyData.floorData.floorNumber ? 
                    {...(addOccupancyData.floorData)} :
                    {...floor}
                ))
            }

            if (addOccupancyData.tenantData) {
                newStackingData.tenants.push(addOccupancyData.tenantData);
            }

            const newRentalData = getRentalData(newStackingData);
            setRentalData(newRentalData);
            setRentRoll(newRentalData.rentRoll);
            setStackingData(newStackingData);
            visualizationProps.setRerenderFloors(changedFloors);

            setSaveState({ status: "success", message: "Added." });
            setIsAddFormOpen(false);
        }
        catch (error) {
            setSaveState({ status: "error", message: `Failed to save changes: ${error.message}` });
        }
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
            valueOptions: tenantValueOptions,
        },
        {
            field: "leaseType",
            headerName: "Lease Type",
            type: "string",
            width: 120,
            editable: true,
            type: "singleSelect",
            valueOptions: leaseTypeValueOptions,
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
            <div className="flex flex-col items-center gap-2 px-8 py-4">
                <div className="flex flex-row justify-between w-full gap-3">
                    <div className="flex flex-row gap-3">
                        <button
                            type="button"
                            className="h-10 px-4 border rounded-lg hover:bg-red-500 hover:text-white transition-all disabled:bg-transparent disabled:text-black/50 dark:disabled:bg-transparent dark:disabled:text-white/50 disabled:cursor-not-allowed"
                            onClick={() => setIsDeleteConfirmationOpen(true)}
                            disabled={saveState?.status === "saving" || !rowSelectionModel?.ids?.size}
                        >
                            Delete
                        </button>
                        <Dialog
                            open={isDeleteConfirmationOpen}
                            onClose={() => setIsDeleteConfirmationOpen(false)}
                            aria-labelledby="delete-occupancy-alert-dialog-title"
                            aria-describedby="delete-occupancy-alert-dialog-description"
                        >
                            <DialogTitle id="delete-occupancy-alert-dialog-title">
                                Delete?
                            </DialogTitle>
                            <DialogContent>
                                <DialogContentText id="delete-occupancy-alert-dialog-description">
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
                            onClick={() => {
                                isNewOccupancyInputValidRefs.current = Object.fromEntries(Object.keys(defaultNewOccupancyData).map((key) => [key, false]))
                                setNewOccupancyData(defaultNewOccupancyData);
                                setIsAddFormOpen(true);
                            }}
                            disabled={saveState?.status === "saving"}
                        >
                            Add
                        </button>
                        <Dialog
                            open={isAddFormOpen}
                            onClose={() => setIsAddFormOpen(false)}
                            aria-labelledby="add-occupancy-dialog-title"
                            aria-describedby="delete-alert-dialog-description"
                        >
                            <DialogTitle id="delete-alert-dialog-title">
                                Add Occupancy
                            </DialogTitle>
                            <DialogContent>
                                <AddOccupancyForm
                                    stackingData={stackingData}
                                    tenantValueOptions={tenantValueOptions}
                                    leaseTypeValueOptions={leaseTypeValueOptions}
                                    formData={newOccupancyData}
                                    setFormData={setNewOccupancyData}
                                    isInputValidRefs={isNewOccupancyInputValidRefs}
                                />
                            </DialogContent>
                            <DialogActions>
                                <div className="flex flex-row justify-between items-end w-full px-4 pb-3">
                                    <div>
                                        {
                                            saveState?.message && (
                                            <span className={saveState.status === "error" ? "text-sm text-red-600 dark:text-red-300" : "text-sm text-green-700 dark:text-green-300"}>
                                                {saveState.message}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex flex-row gap-2">
                                        <button
                                            className="h-10 px-4 border rounded-lg hover:bg-red-500 hover:text-white transition-all"
                                            onClick={() => setIsAddFormOpen(false)}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            className="h-10 px-4 border rounded-lg hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all"
                                            onClick={() => {
                                                if (Object.entries(isNewOccupancyInputValidRefs.current).some(([key, val]) => !val && !(newOccupancyData.tenantId !== "new" && key.includes("newTenant")) && key !== "newTenantContactEmail" && key !== "newTenantContactPhone")) {
                                                    setSaveState({ status: "error", message: "Incomplete data." });
                                                }
                                                else {
                                                    addOccupancy();
                                                }
                                            }}
                                        >
                                            Create
                                        </button>
                                    </div>
                                </div>
                            </DialogActions>
                        </Dialog>
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