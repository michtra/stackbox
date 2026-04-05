"use client"

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Slider } from "@mui/material";
import { Upload } from "@mui/icons-material";
import { Apartment } from "@mui/icons-material";
import { ListAlt } from "@mui/icons-material";
import { AddressAutofill, useAddressAutofillCore } from "@mapbox/search-js-react";
import { SessionToken } from "@mapbox/search-js-core";

import { createBuilding, getBuildingMetadata } from "@/app/utilities/endpoints";
import NumberInput from "@/app/components/ui/NumberInput";
import { loadAdjustmentsBuildingMesh } from "@/app/utilities/processor";

export default function BuildingForm({ srcProps, isDarkMode = false, mapRef, modelProps }) {
    // TODO: Google Maps Platform Place Autocomplete integration.
    const router = useRouter();
    const autofill = useAddressAutofillCore({
        accessToken: process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
    });
    const sessionToken = new SessionToken()

    const [modelFileName, setModelFileName] = useState();
    const [excelFileName, setExcelFileName] = useState();
    const [modelFileURL, setModelFileURL] = useState();
    const [excelFileURL, setExcelFileURL] = useState();
    const [buildingMetadata, setBuildingMetadata] = useState();

    const isInputValidRefs = {
        isLatValidRef: useRef(true),
        isLngValidRef: useRef(true),
    }

    const handleSubmit = async () => {
        if (srcProps.modelSrc && srcProps.excelSrc && Object.values(isInputValidRefs).every((ref) => ref.current)) {
            const metadata = {
                building: {
                    ...buildingMetadata,
                    location: {
                        latitude: modelProps.coordLat,
                        longitude: modelProps.coordLng,
                    }
                },
                adjustments: {
                    scale: 10 ** modelProps.scale,
                    rotation: modelProps.rotation
                }
            };
            
            // TODO: Cache building metadata somewhere.
            createBuilding(srcProps.modelSrc, srcProps.excelSrc, metadata).then((buildingId) => {
                if (buildingId) {
                    router.push(`/property/${buildingId}`);
                }
            });
        }
    }

    useEffect(() => {
        getBuildingMetadata(srcProps.excelSrc).then((val) => {
            const newMetadata = val;
            autofill.suggest(
                `${val.address.street}, ${val.address.city}, ${val.address.state} ${val.address.zip}, ${val.address.country}`,
                { 
                    limit: 1, 
                    sessionToken: sessionToken,
                }
            ).then((suggestRes) => {
                if (suggestRes.suggestions?.length > 0) {
                    autofill.retrieve(suggestRes.suggestions[0], { sessionToken: sessionToken }).then((retrieveRes) => {
                        if (retrieveRes.features?.length > 0) {
                            newMetadata.address = {
                                street: retrieveRes.features[0].properties.address_line1,
                                city: retrieveRes.features[0].properties.address_level2,
                                state: retrieveRes.features[0].properties.address_level1,
                                zip: retrieveRes.features[0].properties.postcode,
                                country: retrieveRes.features[0].properties.country_code.toUpperCase(),
                            }
                            modelProps.setCoordLng(retrieveRes.features[0]?.geometry.coordinates[0]);
                            modelProps.setCoordLat(retrieveRes.features[0]?.geometry.coordinates[1]);
                            modelProps.modelRef.current.setCoords([retrieveRes.features[0]?.geometry.coordinates[0], retrieveRes.features[0]?.geometry.coordinates[1]]);
                            mapRef.current.easeTo({
                                center: [retrieveRes.features[0]?.geometry.coordinates[0], retrieveRes.features[0]?.geometry.coordinates[1]],
                                duration: 200,
                                easing: (n) => n
                            });
                            mapRef.current.triggerRepaint();
                        }
                    });
                }
            })
            .finally(() => {
                setBuildingMetadata(newMetadata);
            });
        });
    }, []);

    return (
        <div className="flex flex-col w-full h-full p-6 gap-8 overflow-y-scroll">
            <div className="flex flex-col gap-2">
                <span>Name of Building</span>
                <input
                    type="text"
                    className="p-2 gap-2 outline rounded-sm focus-within:outline-blue-500 focus-within:outline-2"
                    value={buildingMetadata?.name ? buildingMetadata.name : ""}
                    onChange={(e) => {
                        setBuildingMetadata((val) => {
                            return {
                                ...val,
                                name: e.target.value,
                            }
                        });
                    }}
                />
            </div>
            <AddressAutofill
                accessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
                onRetrieve={(res) => {
                    setBuildingMetadata((val) => {
                        return {
                            ...val,
                            address: {
                                street: res.features[0]?.properties.address_line1,
                                city: res.features[0]?.properties.address_level2,
                                state: res.features[0]?.properties.address_level1,
                                zip: res.features[0]?.properties.postcode,
                                country: res.features[0]?.properties.country_code.toUpperCase(),
                            },
                        }
                    });
                    if (res.features[0]?.geometry?.coordinates && res.features[0]?.geometry?.coordinates.length == 2) {
                        modelProps.setCoordLng(res.features[0]?.geometry.coordinates[0]);
                        modelProps.setCoordLat(res.features[0]?.geometry.coordinates[1]);
                        modelProps.modelRef.current.setCoords([res.features[0]?.geometry.coordinates[0], res.features[0]?.geometry.coordinates[1]]);
                        mapRef.current.easeTo({
                            center: [res.features[0]?.geometry.coordinates[0], res.features[0]?.geometry.coordinates[1]],
                            duration: 200,
                            easing: (n) => n
                        });
                        mapRef.current.triggerRepaint();
                    }
                }}
            >
                <div className="flex flex-col gap-2">
                    <div className="flex flex-col gap-2">
                        <span>Address</span>
                        <input
                            value={buildingMetadata?.address.street ?? ""}
                            onChange={(e) => {
                                setBuildingMetadata((val) => {
                                    return {
                                        ...val,
                                        address: {
                                            ...val.address,
                                            street: e.target.value,
                                        }
                                    }
                                })
                            }}
                            className="flex flex-row w-84 p-2 gap-2 justify-between items-center outline rounded-sm focus-within:outline-blue-500 focus-within:outline-2"
                            autoComplete="address-line1"
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <span>City</span>
                        <input
                            value={buildingMetadata?.address.city ?? ""}
                            onChange={(e) => {
                                setBuildingMetadata((val) => {
                                    return {
                                        ...val,
                                        address: {
                                            ...val.address,
                                            city: e.target.value,
                                        }
                                    }
                                })
                            }}
                            className="flex flex-row w-84 p-2 gap-2 justify-between items-center outline rounded-sm focus-within:outline-blue-500 focus-within:outline-2"
                            autoComplete="address-level2"
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <span>State</span>
                        <input
                            value={buildingMetadata?.address.state ?? ""}
                            onChange={(e) => {
                                setBuildingMetadata((val) => {
                                    return {
                                        ...val,
                                        address: {
                                            ...val.address,
                                            state: e.target.value,
                                        }
                                    }
                                })
                            }}
                            className="flex flex-row w-84 p-2 gap-2 justify-between items-center outline rounded-sm focus-within:outline-blue-500 focus-within:outline-2"
                            autoComplete="address-level1"
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <span>Postal Code</span>
                        <input
                            value={buildingMetadata?.address.zip ?? ""}
                            onChange={(e) => {
                                setBuildingMetadata((val) => {
                                    return {
                                        ...val,
                                        address: {
                                            ...val.address,
                                            zip: e.target.value,
                                        }
                                    }
                                })
                            }}
                            className="flex flex-row w-84 p-2 gap-2 justify-between items-center outline rounded-sm focus-within:outline-blue-500 focus-within:outline-2"
                            autoComplete="postal-code"
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <span>Country</span>
                        <input
                            value={buildingMetadata?.address.country ?? ""}
                            onChange={(e) => {
                                setBuildingMetadata((val) => {
                                    return {
                                        ...val,
                                        address: {
                                            ...val.address,
                                            country: e.target.value,
                                        }
                                    }
                                })
                            }}
                            className="flex flex-row w-84 p-2 gap-2 justify-between items-center outline rounded-sm focus-within:outline-blue-500 focus-within:outline-2"
                            autoComplete="country"
                        />
                    </div>
                </div>
            </AddressAutofill>
            <div className="flex flex-col">
                <span>Scale</span>
                <Slider
                    value={modelProps.scale ?? 1}
                    valueLabelDisplay="auto"
                    valueLabelFormat={(val) => {return `${10 ** val}`}}
                    step={0.01}
                    min={-1}
                    max={3}
                    marks={[
                        {value: -1, label: "0.01"},
                        {value: 0, label: "1"},
                        {value: 1, label: "10"},
                        {value: 2, label: "100"},
                        {value: 3, label: "1000"},
                    ]}
                    sx={{
                        '& .MuiSlider-markLabel': {
                            color: clsx(isDarkMode ? "#ffffff" : "#000000")
                        }
                    }}
                    onChange={(e, val) => {
                        modelProps.setScale(val);
                        const newScale = 10 ** val;
                        modelProps.modelRef.current.model.scale.set(newScale, newScale, newScale);
                        mapRef.current.triggerRepaint();
                    }}
                />
            </div>
            <div className="flex flex-col">
                <span>Rotation</span>
                <Slider
                    value={modelProps.rotation ?? 0}
                    valueLabelDisplay="auto"
                    step={0.01}
                    min={0}
                    max={360}
                    marks={[
                        {value: 0, label: "0°"},
                        {value: 90, label: "90°"},
                        {value: 180, label: "180°"},
                        {value: 270, label: "270°"},
                        {value: 360, label: "360°"}
                    ]}
                    sx={{
                        '& .MuiSlider-markLabel': {
                            color: clsx(isDarkMode ? "#ffffff" : "#000000")
                        }
                    }}
                    onChange={(e, val) => {
                        modelProps.setRotation(val);
                        modelProps.modelRef.current.setRotation({ x: 0, y: 0, z: val });
                        mapRef.current.triggerRepaint();
                    }}
                />
            </div>
            <div className="flex flex-col gap-2">
                <span>Latitude</span>
                <NumberInput
                    value={modelProps.coordLat}
                    increment={0.0001}
                    min={-90}
                    max={90}
                    isValid={isInputValidRefs.isLatValidRef}
                    onChange={(val) => {
                        modelProps.setCoordLat(val);
                        modelProps.modelRef.current.setCoords([modelProps.coordLng, val]);
                        mapRef.current.triggerRepaint();
                    }}
                />
            </div>
            <div className="flex flex-col gap-2">
                <span>Longitude</span>
                <NumberInput
                    value={modelProps.coordLng}
                    increment={0.0001}
                    min={-180}
                    max={180}
                    isValid={isInputValidRefs.isLngValidRef}
                    onChange={(val) => {
                        modelProps.setCoordLng(val);
                        modelProps.modelRef.current.setCoords([val, modelProps.coordLat]);
                        mapRef.current.triggerRepaint();
                    }}
                />
            </div>
            <div className="flex flex-col w-full h-full gap-4">
                <label htmlFor="model_file_uploader" className="relative flex flex-col w-full h-full">
                    {
                        modelFileName ?
                        <div className="flex flex-col w-full h-full gap-2 justify-center items-center p-4 border-2 border-blue-400 rounded-xl shadow-blue-400 shadow-[0_0_16px]">
                            <Apartment sx={{ fontSize: 48 }} />
                            {modelFileName}
                        </div> :
                        <div className="flex flex-col w-full h-full gap-2 justify-center items-center p-4 border-2 rounded-xl border-dashed">
                            <Upload sx={{ fontSize: 48 }} />
                            Upload STL Model
                        </div>
                    }
                    <input
                        id="model_file_uploader"
                        type="file"
                        accept=".stl"
                        className="absolute left-0 top-0 w-full h-full opacity-0 cursor-pointer"
                        onChange={(e) => {
                            if (e.target.files[0].type == "application/stl") {
                                setModelFileURL(URL.createObjectURL(e.target.files[0]));
                                setModelFileName(e.target.files[0].name);
                            }
                        }}
                    />
                </label>
                <button
                    className="flex flex-col justify-center items-center w-full h-12 p-2 gap-2 outline rounded-sm cursor-pointer hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black disabled:bg-black/25 disabled:text-black/40 dark:disabled:bg-white/25 dark:disabled:text-white/40 disabled:outline-0 disabled:cursor-not-allowed transition-all"
                    disabled={!modelFileURL}
                    onClick={() => {
                        if (modelFileURL) {
                            srcProps.setModelSrc(modelFileURL);
                            setModelFileURL(null);
                            setModelFileName(null);
                            
                            loadAdjustmentsBuildingMesh(modelFileURL, modelProps, mapRef);
                        }
                    }}
                >
                    Reupload
                </button>
            </div>
            <div className="flex flex-col w-full h-full gap-4">
                <label htmlFor="excel_file_uploader" className="relative flex flex-col w-full h-full">
                    {
                        excelFileName ?
                        <div className="flex flex-col w-full h-full gap-2 justify-center items-center p-4 border-2 border-blue-400 rounded-xl shadow-blue-400 shadow-[0_0_16px]">
                            <ListAlt sx={{ fontSize: 48 }} />
                            {excelFileName}
                        </div> :
                        <div className="flex flex-col w-full h-full gap-2 justify-center items-center p-4 border-2 rounded-xl border-dashed">
                            <Upload sx={{ fontSize: 48 }} />
                            Upload Excel File
                        </div>
                    }
                    <input
                        id="excel_file_uploader"
                        type="file"
                        accept=".xlsx"
                        className="absolute left-0 top-0 w-full h-full opacity-0 cursor-pointer"
                        onChange={(e) => {
                            if (e.target.files[0].type == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
                                setExcelFileURL(URL.createObjectURL(e.target.files[0]));
                                setExcelFileName(e.target.files[0].name);
                            }
                        }}
                    />
                </label>
                <button
                    className="flex flex-col justify-center items-center w-full h-12 p-2 gap-2 outline rounded-sm cursor-pointer hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black disabled:bg-black/25 disabled:text-black/40 dark:disabled:bg-white/25 dark:disabled:text-white/40 disabled:outline-0 disabled:cursor-not-allowed transition-all"
                    disabled={!excelFileURL}
                    onClick={() => {
                        if (excelFileURL) {
                            srcProps.setExcelSrc(excelFileURL);
                            setExcelFileURL(null);
                            setExcelFileName(null);
                        }
                    }}
                >
                    Reupload
                </button>
            </div>
            <button
                className="flex flex-col justify-center items-center w-full h-12 p-2 gap-2 outline rounded-sm cursor-pointer hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all"
                onClick={() => {
                    handleSubmit();
                }}
            >
                Submit
            </button>
        </div>
    );
}