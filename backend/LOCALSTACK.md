# LocalStack Setup for Local Development

LocalStack allows you to test AWS services (S3, SQS) locally without connecting to real AWS.

## Setup

1. **Copy environment file:**
   ```bash
   cp .env.example .env
   ```

2. **Configure for LocalStack (in .env):**
   ```bash
   AWS_ENDPOINT_URL=http://localhost:4566
   AWS_REGION=us-east-1
   S3_BUCKET_NAME=stackbox-uploads
   ```

3. **Start LocalStack:**
   ```bash
   docker-compose up -d
   ```

4. **Verify it's running:**
   ```bash
   docker-compose ps  # Shows container status (doesn't start containers)
   curl http://localhost:4566/_localstack/health
   ```

   The container should show status as "Up" and "healthy".

## Using LocalStack

The init script automatically creates:
- S3 bucket: `stackbox-uploads`
- SQS queue: `stl-processing-queue`

### Test S3 bucket:
```bash
pip install awscli awscli-local

# List buckets
awslocal s3 ls

# Upload test file
echo "test" > test.txt
awslocal s3 cp test.txt s3://stackbox-uploads/

# Verify upload
awslocal s3 ls s3://stackbox-uploads/
```

## Managing LocalStack

**Stop LocalStack:**
```bash
docker-compose down
```

**Stop and remove volumes (fresh start):**
```bash
docker-compose down -v
```

**Restart LocalStack:**
```bash
docker-compose restart
```

**View logs:**
```bash
docker-compose logs localstack
```

## Switching to Real AWS

1. Update .env:
   ```bash
   # Comment out or remove AWS_ENDPOINT_URL
   # AWS_ENDPOINT_URL=http://localhost:4566

   # Set real credentials
   AWS_ACCESS_KEY_ID=your_key
   AWS_SECRET_ACCESS_KEY=your_secret
   ```

2. Restart the application

## Troubleshooting

- Port already in use: Stop LocalStack with `docker-compose down` or change the port in docker-compose.yml
- Init script not running: Check logs with `docker-compose logs localstack`
- Connection refused: Make sure LocalStack is running with `docker-compose ps`
- Container keeps restarting: Check logs with `docker-compose logs localstack`. If you see "Device or resource busy" errors, run `docker-compose down -v` to remove old volumes, then `docker-compose up -d` to start fresh
