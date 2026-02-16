"use client"

/**
 * Uploads file to backend using the /uploadfile endpoint.
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

export { uploadFile };