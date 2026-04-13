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
      env: { PORT: '3000', NODE_ENV: 'production' }
    }
  ]
};
