"use client"

import { useEffect, useMemo, useState } from "react";

import { saveTenantEndpoint, saveTenantAllEndpoint } from "@/app/utilities/endpoints";

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

function normalizeColor(inputColor) {
    if (typeof inputColor !== "string") {
        return "#808080";
    }

    const trimmed = inputColor.trim();
    return HEX_COLOR_REGEX.test(trimmed) ? trimmed.toUpperCase() : "#808080";
}

export default function TenantEditForm({ stackingData, setStackingData }) {
    const [rows, setRows] = useState([]);
    const [saveStateByTenantId, setSaveStateByTenantId] = useState({});
    const [saveStateAll, setSaveStateAll] = useState({ status: "", message: "" });

    const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL;

    const isSavingAll = Object.values(saveStateByTenantId).some((state) => state?.status === "saving");
    const isValidAll = rows.every((row) => HEX_COLOR_REGEX.test(row.draftColor) && row.draftName.trim() !== "");

    const tenants = useMemo(() => {
        if (!stackingData?.tenants) {
            return [];
        }

        return stackingData.tenants.map((tenant) => ({
            id: tenant.id,
            name: tenant.name,
            color: normalizeColor(tenant.color),
        }));
    }, [stackingData]);

    useEffect(() => {
        setRows(
            tenants.map((tenant) => ({
                ...tenant,
                draftName: tenant.name,
                draftColor: tenant.color,
            }))
        );
    }, [tenants]);

    async function saveTenant(tenantId) {
        const row = rows.find((item) => item.id === tenantId);

        if (!row || !HEX_COLOR_REGEX.test(row.draftColor) || row.draftName.trim() === "") {
            if (!HEX_COLOR_REGEX.test(row.draftColor)) {
                setSaveStateByTenantId((prev) => ({
                    ...prev,
                    [tenantId]: { status: "error", message: "Invalid input." },
                }));
            }
            return;
        }
        
        row.draftName = row.draftName.trim();

        if (!serverUrl) {
            setSaveStateByTenantId((prev) => ({
                ...prev,
                [tenantId]: { status: "error", message: "NEXT_PUBLIC_SERVER_URL is not configured." },
            }));
            return;
        }

        setSaveStateByTenantId((prev) => ({
            ...prev,
            [tenantId]: { status: "saving", message: "Saving..." },
        }));

        try {
            await saveTenantEndpoint(tenantId, { name: row.draftName !== row.name ? row.draftName : undefined, color: row.draftColor !== row.color ? row.draftColor : undefined });

            setRows((prev) =>
                prev.map((item) =>
                    item.id === tenantId
                        ? {
                            ...item,
                            name: item.draftName,
                            color: item.draftColor,
                        }
                        : item
                )
            );

            setStackingData((prev) => {
                const updatedTenants = prev.tenants.map((tenant) =>
                    tenant.id === tenantId
                        ? {
                            ...tenant,
                            name: row.draftName,
                            color: row.draftColor
                        }
                        : tenant
                );
                return { ...prev, tenants: updatedTenants };
            });

            setSaveStateByTenantId((prev) => ({
                ...prev,
                [tenantId]: { status: "success", message: "Saved." },
            }));
        }
        catch (error) {
            setSaveStateByTenantId((prev) => ({
                ...prev,
                [tenantId]: { status: "error", message: `Failed to save: ${error.message}` },
            }));
        }
    }

    async function saveTenantAll() {
        const rowsToSave = rows.filter((row) => (row.draftName.trim() !== row.name || row.draftColor.trim() !== row.color) && HEX_COLOR_REGEX.test(row.draftColor) && row.draftName.trim() !== "");
        if (rowsToSave.length === 0) {
            setSaveStateAll({ status: "error", message: "No changes to save or all are invalid inputs." });
            return;
        }

        if (!serverUrl) {
            setSaveStateAll({ status: "error", message: "NEXT_PUBLIC_SERVER_URL is not configured." });
            return;
        }

        if (!stackingData?.building?.id) {
            setSaveStateAll({ status: "error", message: "Building information is missing." });
            return;
        }

        const changesByTenantId = {};
        rowsToSave.forEach((row) => {
            changesByTenantId[row.id] = {
                name: row.draftName.trim() !== row.name ? row.draftName : undefined,
                color: row.draftColor !== row.color ? row.draftColor : undefined,
            }
        });

        setSaveStateAll({ status: "saving", message: "Saving..." });
        setSaveStateByTenantId((prev) => {
            const newState = { ...prev };
            rowsToSave.forEach((row) => {
                newState[row.id] = { status: "saving", message: "Saving..." };
            });
            return newState;
        });

        try {
            await saveTenantAllEndpoint(stackingData.building.id, changesByTenantId);

            setRows((prev) =>
                prev.map((item) => {
                    return item.id in changesByTenantId
                        ? {
                            ...item,
                            name: changesByTenantId[item.id].name || item.name,
                            color: changesByTenantId[item.id].color || item.color,
                        }
                        : item;
                })
            );

            setStackingData((prev) => {
                const updatedTenants = prev.tenants.map((tenant) =>
                    tenant.id in changesByTenantId
                        ? {
                            ...tenant,
                            name: changesByTenantId[tenant.id].name || tenant.name,
                            color: changesByTenantId[tenant.id].color || tenant.color
                        }
                        : tenant
                );
                return { ...prev, tenants: updatedTenants };
            });

            setSaveStateAll({ status: "success", message: "All changes saved." });
            setSaveStateByTenantId((prev) => {
                const newState = { ...prev };
                rowsToSave.forEach((row) => {
                    newState[row.id] = { status: "success", message: "All changes saved." };
                });
                return newState;
            });
        }
        catch (error) {
            setSaveStateAll({ status: "error", message: `Failed to save all changes: ${error.message}` });
            setSaveStateByTenantId((prev) => {
                const newState = { ...prev };
                rowsToSave.forEach((row) => {
                    newState[row.id] = { status: "error", message: `Failed to save: ${error.message}` };
                });
                return newState;
            });
        }
    }

    function resetTenant(tenantId) {
        const row = rows.find((item) => item.id === tenantId);
        if (!row) return;

        setRows((prev) =>
            prev.map((item) =>
                item.id === tenantId
                    ? { ...item, draftName: item.name, draftColor: item.color }
                    : item
            )
        );
    }


    if (rows.length === 0) {
        return (
            <div className="px-8 py-4">
                <h2 className="text-2xl font-semibold mb-2">Tenant Colors</h2>
                <p className="text-black/75 dark:text-white/75">No tenants found for this building.</p>
            </div>
        );
    }

    return (
        <div className="py-4">
            <div className="flex flex-col px-8">
                <h2 className="text-2xl font-semibold mb-2">Tenant</h2>
                <p className="text-black/75 dark:text-white/75 mb-6">Edit each tenant. Names cannot be empty. Colors must use #RRGGBB format.</p>
            </div>
            <div className="overflow-x-auto px-8">
                <table className="w-full min-w-160 border-collapse">
                    <thead>
                        <tr className="border-b border-black/10 dark:border-white/20">
                            <th className="text-left py-3">Tenant</th>
                            <th className="text-left py-3">Color Picker</th>
                            <th className="text-left py-3">Hex Value</th>
                            <th className="text-left py-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => {
                            const isNameValid = row.draftName.trim() !== "";
                            const isColorValid = HEX_COLOR_REGEX.test(row.draftColor);
                            const hasNameChanges = row.draftName !== row.name;
                            const hasColorChanges = row.draftColor !== row.color;
                            const saveState = saveStateByTenantId[row.id];
                            const isSaving = saveState?.status === "saving";

                            return (
                                <tr key={row.id} className="border-b border-black/10 dark:border-white/10">
                                    <td className="py-3 pr-4">
                                        <input
                                            type="text"
                                            value={row.draftName}
                                            onChange={(e) => {
                                                const nextName = e.target.value;
                                                setRows((prev) =>
                                                    prev.map((item) =>
                                                        item.id === row.id
                                                            ? { ...item, draftName: nextName }
                                                            : item
                                                    )
                                                );
                                            }}
                                            placeholder="Tenant Name"
                                            className="h-10 px-3 border border-black/20 dark:border-white/30 rounded bg-white/90 dark:bg-black/20"
                                        />
                                        {!isNameValid && (
                                            <div className="text-xs text-red-600 dark:text-red-300 mt-1">Invalid tenant name</div>
                                        )}
                                    </td>
                                    <td className="py-3 pr-4">
                                        <input
                                            type="color"
                                            value={isColorValid ? row.draftColor : normalizeColor(row.draftColor)}
                                            onChange={(e) => {
                                                const nextColor = e.target.value.toUpperCase();
                                                setRows((prev) =>
                                                    prev.map((item) =>
                                                        item.id === row.id
                                                            ? { ...item, draftColor: nextColor }
                                                            : item
                                                    )
                                                );
                                            }}
                                            className="h-10 w-16 p-0 border border-black/20 dark:border-white/30 rounded"
                                        />
                                    </td>
                                    <td className="py-3 pr-4">
                                        <input
                                            type="text"
                                            value={row.draftColor}
                                            onChange={(e) => {
                                                const nextColor = e.target.value.toUpperCase();
                                                setRows((prev) =>
                                                    prev.map((item) =>
                                                        item.id === row.id
                                                            ? { ...item, draftColor: nextColor }
                                                            : item
                                                    )
                                                );
                                            }}
                                            placeholder="#RRGGBB"
                                            className="h-10 w-32 px-3 border border-black/20 dark:border-white/30 rounded bg-white/90 dark:bg-black/20"
                                        />
                                        {!isColorValid && (
                                            <div className="text-xs text-red-600 dark:text-red-300 mt-1">Invalid hex format</div>
                                        )}
                                    </td>
                                    <td className="py-3">
                                        <div className="flex items-center gap-3">
                                            <button
                                                type="button"
                                                className="h-10 px-4 border rounded-lg hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all disabled:bg-transparent disabled:text-black/50 dark:disabled:bg-transparent dark:disabled:text-white/50 disabled:cursor-not-allowed"
                                                onClick={() => resetTenant(row.id)}
                                                disabled={!(hasNameChanges || hasColorChanges) || !isColorValid || isSaving}
                                            >
                                                Reset
                                            </button>
                                            <button
                                                type="button"
                                                className="h-10 px-4 border rounded-lg hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all disabled:bg-transparent disabled:text-black/50 dark:disabled:bg-transparent dark:disabled:text-white/50 disabled:cursor-not-allowed"
                                                onClick={() => saveTenant(row.id)}
                                                disabled={!(hasNameChanges || hasColorChanges) || !isColorValid || isSaving}
                                            >
                                                {isSaving ? "Saving..." : "Save"}
                                            </button>
                                            {saveState?.message && (
                                                <span className={saveState.status === "error" ? "text-sm text-red-600 dark:text-red-300" : "text-sm text-green-700 dark:text-green-300"}>
                                                    {saveState.message}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <div className="flex flex-row-reverse items-center justify-between gap-3 px-8 py-4">
                <button
                    type="button"
                    className="h-10 px-4 border rounded-lg hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all disabled:bg-transparent disabled:text-black/50 dark:disabled:bg-transparent dark:disabled:text-white/50 disabled:cursor-not-allowed"
                    onClick={() => saveTenantAll()}
                    disabled={!isValidAll || isSavingAll}
                >
                    {isSavingAll ? "Saving..." : "Save"}
                </button>
                {saveStateAll?.message && (
                    <span className={saveStateAll.status === "error" ? "text-sm text-red-600 dark:text-red-300" : "text-sm text-green-700 dark:text-green-300"}>
                        {saveStateAll.message}
                    </span>
                )}
            </div>
        </div>
    );
}
