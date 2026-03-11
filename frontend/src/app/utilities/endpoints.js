"use client"

/**
 * (Deprecated) Uploads file to backend using the /uploadfile endpoint.
 * @param {File} file File object to be uploaded.
 * @param {string} type Type of file being uploaded (e.g. 'stl', 'xlsx').
 * @param {string} buildingId Building ID to associate the file with.
 * @param {number|null} floors Optional number of floors to associate with the file (only applicable for model files).
 * @returns File metadata (and data if applicable).
 */
async function uploadFile(file, type, buildingId, floors = null) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/uploadfile?type=${type}&buildingId=${buildingId}${floors !== null ? "&floors=" + floors : ""}`, {
        method: 'POST',
        body: formData
    });
    return response;
}

async function urlToFile(url) {
    const response = await fetch(url);
    const blob = await response.blob();
    return new File([blob], "", blob.type);
}

async function getBuildingMetadata(excelSrc) {
    const formData = new FormData();
    formData.append("file", await urlToFile(excelSrc));
    const response = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/buildings/metadata`, {
        method: "POST",
        body: formData
    });
    return response.data;
}

async function createBuilding(modelSrc, excelSrc, metadata) {
    try {
        const formData = new FormData();
        formData.append("building", metadata.building);
        const buildingCreateResponse = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/buildings`, {
            method: "POST",
            body: formData
        });

        if (!buildingCreateResponse.ok) {
            console.error("Network error when creating building:", buildingCreateResponse.statusText);
            return false;
        }

        const stlFormData = new FormData();
        stlFormData.append("file", await urlToFile(modelSrc));
        stlFormData.append("baseElevation", 0); // Trimesh already sets min height as 0 height. Although, maybe I'll do something with this query.
        stlFormData.append("centerX", metadata.building.location.longitude);
        stlFormData.append("centerY", metadata.building.location.latitude);
        stlFormData.append("scale", metadata.adjustments.scale);
        stlFormData.append("rotation", metadata.adjustments.rotation);
        const stlUploadResponse = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/buildings/${buildingCreateResponse.data.id}/upload/stl`, {
            method: "POST",
            body: stlFormData
        });

        if (!stlUploadResponse.ok) {
            console.error("Network error when uploading STL file:", stlUploadResponse.statusText);
            return false;
        }

        const excelFormData = new FormData();
        excelFormData.append("file", await urlToFile(excelSrc));
        const excelUploadResponse = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/buildings/${buildingCreateResponse.data.id}/upload/excel`, {
            method: "POST",
            body: excelFormData
        });

        if (!excelUploadResponse.ok) {
            console.error("Network error when uploading Excel file:", excelUploadResponse.statusText);
            return false;
        }
    }
    catch (error) {
        console.error("Error when creating building:", error);
        return false;
    }
    return true;
}

async function getBuilding(id) {
    try {
        const stackingDataResponse = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/buildings/${id}/stacking-plan`);
        if (!stackingDataResponse.ok) {
            console.error("Network error when getting building data:", stackingDataResponse.statusText);
            return;
        }
        return stackingDataResponse.data;
    }
    catch (error) {
        console.error("Error when creating building:", error);
        return;
    }
}

export { urlToFile, createBuilding, getBuilding };