# AWS Setup

## Testing the RDS Connection (`test_rds.py`)

`backend/test/test_rds.py` uses `sslmode=verify-full`, which requires the AWS RDS CA certificate bundle and that your IP is whitelisted in the RDS security group.

### 1. Download the RDS CA bundle

```bash
curl -o backend/global-bundle.pem https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem
```

Run `test_rds.py` from the `backend/` directory so the relative path `global-bundle.pem` resolves correctly.

### 2. Whitelist your IP

1. Go to the AWS Console and open **EC2 > Security Groups**.
2. Find the security group attached to your RDS instance.
3. Under **Inbound rules**, add a rule: **Type** PostgreSQL, **Port** 5432, **Source** your current IP (e.g. `203.0.113.10/32`).
4. Save the rule.

Once both steps are done, run the test:

```bash
cd backend
python test/test_rds.py
```

A successful connection prints the PostgreSQL server version.
