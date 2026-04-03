"use client"

import { getSession } from "next-auth/react";
import { meterToLatLng } from "@/app/utilities/processor";

/** Returns Authorization header if a session with an access token exists. */
async function authHeaders(isId = false) {
    const session = await getSession();
    if (!isId && session?.accessToken) {
        return { Authorization: `Bearer ${session.accessToken}` };
    }
    else if (isId && session?.idToken) {
        return { Authorization: `Bearer ${session.idToken}` };
    }
    return {};
}

/** Gets user credentials from current id_token */
async function getUserCredentials() {
    const credentials = {
        sub: "",
        email: "",
        name: "",
    }
    try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/me`, {
            method: "GET",
            headers: await authHeaders(true)
        });
        if (response.ok) {
            return (await response.json()).data
        }
        else {
            console.error("Network error when getting user credential:", response.statusText);
        }
    }
    catch (error) {
        console.error("Error when getting user credential:", error);
    }
    return credentials;
}

/**
 * Converts Blob URL into File object.
 * @param {string} url Blob URL of file.
 * @returns File object.
 */
async function urlToFile(url, ext) {
    const response = await fetch(url);
    const blob = await response.blob();
    return new File([blob], `building.${ext}`, { type: blob.type });
}

/**
 * Checks whether Blob URL is valid.
 * @param {string} url Blob URL of file.
 * @returns Whether Blob is still in memory.
 */
async function isBlobUrlValid(url) {
    try {
        const response = await fetch(url);
        return response.ok;
    }
    catch (e) {
        return false;
    }
}

/**
 * Gets building metadata without processing the entire Excel file. Used for retrieving STL upload queries like initial center coords and number of floors.
 * @param {string} excelSrc Blob URL of Excel file.
 * @returns Metadata ("building" part of StackingPlan model) of the building according to the Excel data.
 */
async function getBuildingMetadata(excelSrc) {
    const formData = new FormData();
    formData.append("file", await urlToFile(excelSrc, "xlsx"));
    const response = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/buildings/metadata`, {
        method: "POST",
        headers: await authHeaders(),
        body: formData
    });
    return (await response.json()).data.building;
}

/**
 * Uploads STL and Excel files to S3. Creates building in RDS.
 * @param {string} modelSrc Blob URL of STL file.
 * @param {string} excelSrc Blob URL of Excel file.
 * @param {Object} metadata Data required as input to create a building.
 * @param {Object} metadata.building The "building" part of StackingPlan model.
 * @param {Object} metadata.adjustments 3D model adjustments data.
 * @param {float} metadata.adjustments.scale 3D model scale (map scale to model scale).
 * @param {float} metadata.adjustments.rotation 3D model rotation (degrees).
 * @returns Undefined if error, building ID if successful
 */
async function createBuilding(modelSrc, excelSrc, metadata) {
    try {
        const formData = new FormData();
        formData.append("building", JSON.stringify(metadata.building));
        const buildingCreateResponse = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/buildings`, {
            method: "POST",
            headers: await authHeaders(),
            body: formData
        });

        if (!buildingCreateResponse.ok) {
            console.error("Network error when creating building:", buildingCreateResponse.statusText);
            return;
        }

        const buildingData = (await buildingCreateResponse.json()).data;
        const scale = meterToLatLng(metadata.adjustments.scale, metadata.building.location.latitude);

        const stlFormData = new FormData();
        stlFormData.append("file", await urlToFile(modelSrc, "stl"));
        stlFormData.append("baseElevation", 0); // Trimesh already sets min height as 0 height. Although, maybe I'll do something with this query.
        stlFormData.append("centerX", metadata.building.location.longitude);
        stlFormData.append("centerY", metadata.building.location.latitude);
        stlFormData.append("scaleX", scale.lng);
        stlFormData.append("scaleY", scale.lat);
        stlFormData.append("scaleZ", metadata.adjustments.scale);
        stlFormData.append("rotation", metadata.adjustments.rotation);
        const stlUploadResponse = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/buildings/${buildingData.id}/upload/stl`, {
            method: "POST",
            headers: await authHeaders(),
            body: stlFormData
        });

        if (!stlUploadResponse.ok) {
            console.error("Network error when uploading STL file:", stlUploadResponse.statusText);
            return;
        }

        const excelFormData = new FormData();
        excelFormData.append("file", await urlToFile(excelSrc, "xlsx"));
        const excelUploadResponse = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/buildings/${buildingData.id}/upload/excel`, {
            method: "POST",
            headers: await authHeaders(),
            body: excelFormData
        });

        if (!excelUploadResponse.ok) {
            console.error("Network error when uploading Excel file:", excelUploadResponse.statusText);
            return;
        }

        return buildingData.id;
    }
    catch (error) {
        console.error("Error when creating building:", error);
        return;
    }
}

/**
 * Gets building data according to StackingPlan model.
 * @param {string} id UUID of building.
 * @returns Undefined if error, StackingPlan model if successful.
 */
async function getBuilding(id) {
    try {
        const stackingDataResponse = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/buildings/${id}/stacking-plan`, {
            headers: await authHeaders()
        });
        if (!stackingDataResponse.ok) {
            console.error("Network error when getting building data:", stackingDataResponse.statusText);
            return;
        }
        return (await stackingDataResponse.json()).data;
    }
    catch (error) {
        console.error("Error when creating building:", error);
        return;
    }
}

/**
 * Provides listing data. Has pagination.
 * @param {int} page Current page number.
 * @param {int} limit Max number of buildings on one page.
 * @returns Pagination data according to BuildingListResponse.
 */
async function getBuildingListing(page, limit) {
    try {
        const headers = await authHeaders();
        const buildingListingResponse = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/buildings?page=${page}&limit=${limit}`, { headers });
        if (!buildingListingResponse.ok) {
            console.error("Network error when getting building list:", buildingListingResponse.statusText);
            return;
        }
        return await buildingListingResponse.json();
    }
    catch (error) {
        console.error("Error when getting building list:", error);
    }
}

export { urlToFile, createBuilding, getBuilding, getBuildingListing, getUserCredentials, getBuildingMetadata, isBlobUrlValid };