
async function uploadFile(file, type, buildingId, floors = null) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/uploadfile?type=${type}&buildingId=${buildingId}${floors !== null ? "&floors=" + floors : ""}`, {
        method: 'POST',
        body: formData
    });
    return response;
}

export { uploadFile }