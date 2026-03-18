"use client"

import { useEffect, useMemo, useState } from "react";

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

function normalizeColor(inputColor) {
    if (typeof inputColor !== "string") {
        return "#808080";
    }

    const trimmed = inputColor.trim();
    return HEX_COLOR_REGEX.test(trimmed) ? trimmed.toUpperCase() : "#808080";
}

export default function TenantColors({ stackingData }) {
    const [rows, setRows] = useState([]);
    const [saveStateByTenantId, setSaveStateByTenantId] = useState({});

    const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL;

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
                draftColor: tenant.color,
            }))
        );
    }, [tenants]);

    async function saveTenantColor(tenantId) {
        const row = rows.find((item) => item.id === tenantId);

        if (!row || !HEX_COLOR_REGEX.test(row.draftColor)) {
            setSaveStateByTenantId((prev) => ({
                ...prev,
                [tenantId]: { status: "error", message: "Color must be a valid hex value like #1A2B3C." },
            }));
            return;
        }

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
            const response = await fetch(`${serverUrl}/api/tenants/${tenantId}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    color: row.draftColor,
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || response.statusText);
            }

            setRows((prev) =>
                prev.map((item) =>
                    item.id === tenantId
                        ? {
                            ...item,
                            color: item.draftColor,
                        }
                        : item
                )
            );

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

    if (rows.length === 0) {
        return (
            <div className="px-8 py-4">
                <h2 className="text-2xl font-semibold mb-2">Tenant Colors</h2>
                <p className="text-black/75 dark:text-white/75">No tenants found for this building.</p>
            </div>
        );
    }

    return (
        <div className="px-8 py-4">
            <h2 className="text-2xl font-semibold mb-2">Tenant Colors</h2>
            <p className="text-black/75 dark:text-white/75 mb-6">Choose a color for each tenant. Colors must use #RRGGBB format.</p>
            <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse">
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
                            const isValid = HEX_COLOR_REGEX.test(row.draftColor);
                            const hasChanges = row.draftColor !== row.color;
                            const saveState = saveStateByTenantId[row.id];
                            const isSaving = saveState?.status === "saving";

                            return (
                                <tr key={row.id} className="border-b border-black/10 dark:border-white/10">
                                    <td className="py-3 pr-4">{row.name}</td>
                                    <td className="py-3 pr-4">
                                        <input
                                            type="color"
                                            value={isValid ? row.draftColor : normalizeColor(row.draftColor)}
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
                                        {!isValid && (
                                            <div className="text-xs text-red-600 dark:text-red-300 mt-1">Invalid hex format</div>
                                        )}
                                    </td>
                                    <td className="py-3">
                                        <div className="flex items-center gap-3">
                                            <button
                                                type="button"
                                                className="h-10 px-4 border rounded-lg transition-all disabled:opacity-50"
                                                onClick={() => saveTenantColor(row.id)}
                                                disabled={!hasChanges || !isValid || isSaving}
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
        </div>
    );
}
