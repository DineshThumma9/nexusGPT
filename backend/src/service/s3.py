import os
import tempfile

import boto3
from botocore.exceptions import ClientError
from fastapi import UploadFile
from loguru import logger


def _get_s3_client():
    return boto3.client(
        "s3",
        region_name=os.getenv("AWS_REGION"),
    )


def _bucket() -> str:
    bucket = os.getenv("AWS_BUCKET")
    if not bucket:
        raise RuntimeError("AWS_BUCKET environment variable is not set")
    return bucket


async def upload_file_to_s3(file: UploadFile, kb_id: str) -> str:
    """
    Upload an UploadFile object to S3 under the given kb_id prefix.
    Returns the S3 key (e.g. 'kb_id/filename.pdf').
    Raises Exception on failure.
    """
    s3_key = f"{kb_id}/{file.filename}"
    try:
        s3 = _get_s3_client()
        s3.upload_fileobj(file.file, _bucket(), s3_key)
        logger.info(f"Uploaded file to S3: s3://{_bucket()}/{s3_key}")
        return s3_key
    except Exception as e:
        logger.error(f"S3 upload failed for key '{s3_key}': {e}", exc_info=True)
        raise


def download_s3_to_tempfile(s3_key: str) -> str:
    """
    Download an S3 object to a local temporary file.
    Returns the path of the temp file. Caller is responsible for deleting it.
    """
    suffix = os.path.splitext(s3_key)[1].lower()
    try:
        s3 = _get_s3_client()
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            s3.download_fileobj(_bucket(), s3_key, tmp)
            tmp_path = tmp.name
        logger.info(f"Downloaded S3 key '{s3_key}' to temp file '{tmp_path}'")
        return tmp_path
    except ClientError as e:
        logger.error(f"S3 download failed for key '{s3_key}': {e}")
        raise


def delete_prefix_from_s3(kb_id: str) -> None:
    """
    Delete all S3 objects under the kb_id/ prefix.
    Used when a knowledge base is removed.
    """
    s3 = _get_s3_client()
    bucket = _bucket()
    prefix = f"{kb_id}/"
    try:
        paginator = s3.get_paginator("list_objects_v2")
        pages = paginator.paginate(Bucket=bucket, Prefix=prefix)

        objects_to_delete = []
        for page in pages:
            for obj in page.get("Contents", []):
                objects_to_delete.append({"Key": obj["Key"]})

        if objects_to_delete:
            s3.delete_objects(
                Bucket=bucket, Delete={"Objects": objects_to_delete, "Quiet": True}
            )
            logger.info(
                f"Deleted {len(objects_to_delete)} objects from S3 prefix '{prefix}'"
            )
        else:
            logger.info(
                f"No objects found under S3 prefix '{prefix}', nothing to delete"
            )
    except ClientError as e:
        logger.error(f"S3 deletion failed for prefix '{prefix}': {e}")
        raise
