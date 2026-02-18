#!/bin/bash
# LocalStack initialization script. Creates S3 bucket and SQS queue

# S3 bucket
awslocal s3 mb s3://stackbox-uploads
echo "Created S3 bucket: stackbox-uploads"

# SQS queue for STL processing jobs
awslocal sqs create-queue --queue-name stl-processing-queue
echo "Created SQS queue: stl-processing-queue"

# Optional: Configure S3 event notification to SQS
# awslocal s3api put-bucket-notification-configuration \
#   --bucket stackbox-uploads \
#   --notification-configuration file:///etc/localstack/init/notification-config.json

echo "LocalStack initialization complete"
