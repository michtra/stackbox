# Deploy

VPS: `root@66.42.112.169`, app at `/opt/stackbox`, domain `stackbox.ttrraann.com`.

## One-time setup

1. Clone repo to `/opt/stackbox`.
2. Backend:
   ```bash
   cd /opt/stackbox/backend
   python3 -m venv venv && source venv/bin/activate
   pip install -r requirements.txt
   cp .env.example .env   # fill in values
   cp .env src/.env       # uvicorn runs from src/
   ```
3. Frontend:
   ```bash
   cd /opt/stackbox/frontend
   npm install
   cp .env.example .env   # fill in values
   npm run build
   ```
4. Database (RDS already provisioned):
   ```bash
   cd /opt/stackbox/backend && source venv/bin/activate
   alembic upgrade head
   # if tables already exist at head: alembic stamp head
   ```

## Process manager (pm2)

`/opt/stackbox/ecosystem.config.js`:

```js
module.exports = {
  apps: [
    {
      name: 'stackbox-backend',
      cwd: '/opt/stackbox/backend/src',
      script: '/opt/stackbox/backend/venv/bin/python',
      args: '-m uvicorn main:app --host 127.0.0.1 --port 8001',
      env: { PYTHONUNBUFFERED: '1' }
    },
    {
      name: 'stackbox-frontend',
      cwd: '/opt/stackbox/frontend',
      script: 'node_modules/.bin/next',
      args: 'start -p 3000',
      env: { NODE_ENV: 'production' }
    }
  ]
};
```

Start + persist across reboot:

```bash
pm2 start /opt/stackbox/ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root
```

## Nginx

`/etc/nginx/sites-enabled/stackbox` — TLS via certbot for `stackbox.ttrraann.com`.

Route order matters: `/api/auth/` (NextAuth) must come **before** `/api/` (FastAPI).

```nginx
proxy_buffer_size 16k;
proxy_buffers 8 16k;
proxy_busy_buffers_size 32k;

location / {
    proxy_pass http://127.0.0.1:3000;
    # websocket headers...
}

location /api/auth/ {
    proxy_pass http://127.0.0.1:3000;
}

location /api/ {
    proxy_pass http://127.0.0.1:8001/api/;
    client_max_body_size 100M;
}
```

Reload: `nginx -t && systemctl reload nginx`.

## Cognito

In the User Pool app client, add to hosted UI config:

- Allowed callback URL: `https://stackbox.ttrraann.com/api/auth/callback/cognito`
- Allowed sign-out URL: `https://stackbox.ttrraann.com`

## Redeploy

```bash
cd /opt/stackbox && git pull
cd backend && source venv/bin/activate && pip install -r requirements.txt && alembic upgrade head
cd ../frontend && npm install && npm run build
pm2 restart stackbox-backend stackbox-frontend
```

## Troubleshooting

- Backend logs: `pm2 logs stackbox-backend` or `/root/.pm2/logs/stackbox-backend-*.log`
- `EADDRINUSE :3000`: `ss -ltnp | grep 3000` then kill stray process.
- `.env` not loaded: uvicorn runs from `backend/src`, so `.env` must also be in `backend/src`.
- `/api/auth/*` returns FastAPI 404: nginx `/api/auth/` block missing or placed after `/api/`.
- 502 on `/api/auth/callback/cognito` with `upstream sent too big header`: Cognito JWT + NextAuth Set-Cookie exceed default proxy buffers. Raise `proxy_buffer_size` / `proxy_buffers`.
- Browser shows "This page couldn't load" with 200 OK on main document: check DevTools Console. If `Failed to initialize WebGL` from Mapbox, client has WebGL disabled. Enable Chrome hardware acceleration. Mapbox GL requires WebGL.
