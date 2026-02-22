"""boto3 S3 client helpers."""

import boto3
from config import settings


def _get_client():
    # Let boto3 resolve credentials via its default chain:
    # env vars (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_SESSION_TOKEN),
    # shared credentials file, IAM role, etc.
    return boto3.client("s3", region_name=settings.aws_region)


_client = _get_client()


def upload_file(key: str, content: bytes, content_type: str) -> None:
    _client.put_object(
        Bucket=settings.s3_bucket_name,
        Key=key,
        Body=content,
        ContentType=content_type,
    )


def generate_presigned_url(key: str, expiration: int | None = None) -> str:
    if expiration is None:
        expiration = settings.presigned_url_expiration
    return _client.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.s3_bucket_name, "Key": key},
        ExpiresIn=expiration,
    )


def download_file(key: str) -> bytes:
    response = _client.get_object(Bucket=settings.s3_bucket_name, Key=key)
    return response["Body"].read()


def list_objects(prefix: str) -> list[dict]:
    response = _client.list_objects_v2(
        Bucket=settings.s3_bucket_name, Prefix=prefix
    )
    contents = response.get("Contents", [])
    return [
        {"key": obj["Key"], "size": obj["Size"], "last_modified": obj["LastModified"]}
        for obj in contents
    ]
