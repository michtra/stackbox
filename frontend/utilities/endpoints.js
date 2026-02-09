
async function uploadFile(file, type, floors = None) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/uploadfile?type=${type}&floors=${floors}`, {
        method: 'POST',
        body: formData
    });
    return response;
}

export { uploadFile }