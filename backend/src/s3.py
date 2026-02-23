"""boto3 S3 client helpers."""

import boto3
from botocore.exceptions import ClientError, NoCredentialsError
from config import settings


_s3_client = None


def _get_client():
    """Return a cached S3 client, creating it lazily on first use.

    Prefers explicit credentials from settings when provided; otherwise lets
    boto3 resolve credentials via its default chain (env vars, shared
    credentials file, IAM role, etc.).
    """
    global _s3_client
    if _s3_client is None:
        client_kwargs: dict = {"region_name": settings.aws_region}
        if settings.aws_access_key_id and settings.aws_secret_access_key:
            client_kwargs["aws_access_key_id"] = settings.aws_access_key_id
            client_kwargs["aws_secret_access_key"] = settings.aws_secret_access_key
            if settings.aws_session_token:
                client_kwargs["aws_session_token"] = settings.aws_session_token
        _s3_client = boto3.client("s3", **client_kwargs)
    return _s3_client


def upload_file(key: str, content: bytes, content_type: str) -> None:
    try:
        _get_client().put_object(
            Bucket=settings.s3_bucket_name,
            Key=key,
            Body=content,
            ContentType=content_type,
        )
    except NoCredentialsError as exc:
        raise RuntimeError("AWS credentials not configured.") from exc
    except ClientError as exc:
        raise RuntimeError(f"Failed to upload '{key}' to S3: {exc}") from exc


def generate_presigned_url(key: str, expiration: int | None = None) -> str:
    if expiration is None:
        expiration = settings.presigned_url_expiration
    try:
        return _get_client().generate_presigned_url(
            "get_object",
            Params={"Bucket": settings.s3_bucket_name, "Key": key},
            ExpiresIn=expiration,
        )
    except NoCredentialsError as exc:
        raise RuntimeError("AWS credentials not configured.") from exc
    except ClientError as exc:
        raise RuntimeError(f"Failed to generate presigned URL for '{key}': {exc}") from exc


def download_file(key: str) -> bytes:
    try:
        response = _get_client().get_object(Bucket=settings.s3_bucket_name, Key=key)
        return response["Body"].read()
    except NoCredentialsError as exc:
        raise RuntimeError("AWS credentials not configured.") from exc
    except ClientError as exc:
        raise RuntimeError(f"Failed to download '{key}' from S3: {exc}") from exc


def delete_file(key: str) -> None:
    try:
        _get_client().delete_object(Bucket=settings.s3_bucket_name, Key=key)
    except NoCredentialsError as exc:
        raise RuntimeError("AWS credentials not configured.") from exc
    except ClientError as exc:
        raise RuntimeError(f"Failed to delete '{key}' from S3: {exc}") from exc


def list_objects(prefix: str) -> list[dict]:
    objects: list[dict] = []
    kwargs: dict = {"Bucket": settings.s3_bucket_name, "Prefix": prefix}
    try:
        while True:
            response = _get_client().list_objects_v2(**kwargs)
            contents = response.get("Contents", [])
            objects.extend(
                {"key": obj["Key"], "size": obj["Size"], "last_modified": obj["LastModified"]}
                for obj in contents
            )
            if not response.get("IsTruncated"):
                break
            continuation_token = response.get("NextContinuationToken")
            if not continuation_token:
                break
            kwargs["ContinuationToken"] = continuation_token
    except NoCredentialsError as exc:
        raise RuntimeError("AWS credentials not configured.") from exc
    except ClientError as exc:
        raise RuntimeError(f"Failed to list S3 objects under '{prefix}': {exc}") from exc
    return objects
