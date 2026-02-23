# test_s3.py
import sys
import os
import json
import pytest
from uuid import UUID

# add the parent directory to the path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src')))

# check if S3 credentials are configured before importing modules that create a client
try:
    from botocore.exceptions import NoCredentialsError, ClientError
    from s3 import _get_client, download_file
    from config import settings
    _get_client().list_buckets()
    S3_AVAILABLE = True
except Exception:
    S3_AVAILABLE = False

skip_no_s3 = pytest.mark.skipif(not S3_AVAILABLE, reason="AWS S3 credentials not configured")

# Only import file_storage if S3 is available (it creates a client at module level)
if S3_AVAILABLE:
    from utilities.file_storage import save_upload, save_processed_json, list_files, get_file_url

TEST_BUILDING_ID = UUID("00000000-0000-0000-0000-0000000000ff")


@skip_no_s3
def test_s3_upload_and_download():
    content = b"solid test\nendsolid test\n"
    result = save_upload(TEST_BUILDING_ID, "stl", "test_cube.stl", content)
    s3_key = result["s3_key"]
    print(f"Uploaded S3 key: {s3_key}")

    downloaded = download_file(s3_key)
    assert downloaded == content
    print("Download content matches upload")


@skip_no_s3
def test_s3_save_processed_json():
    data = json.dumps({"floors": [{"id": 1, "elevation": 0.0}]})
    s3_key = save_processed_json(TEST_BUILDING_ID, data)
    print(f"Saved JSON S3 key: {s3_key}")

    downloaded = download_file(s3_key)
    assert json.loads(downloaded.decode("utf-8")) == json.loads(data)
    print("Downloaded JSON matches original")


@skip_no_s3
def test_s3_list_files():
    content = b"solid list_test\nendsolid list_test\n"
    save_upload(TEST_BUILDING_ID, "stl", "list_test.stl", content)

    files = list_files(TEST_BUILDING_ID, "stl")
    print(f"Files under stl/: {files}")
    assert len(files) > 0


@skip_no_s3
def test_s3_presigned_url():
    content = b"solid url_test\nendsolid url_test\n"
    result = save_upload(TEST_BUILDING_ID, "stl", "url_test.stl", content)

    url = get_file_url(result["s3_key"])
    print(f"Presigned URL: {url}")
    assert "https://" in url
    assert settings.s3_bucket_name in url


if __name__ == "__main__":
    test_s3_upload_and_download()
    test_s3_save_processed_json()
    test_s3_list_files()
    test_s3_presigned_url()
