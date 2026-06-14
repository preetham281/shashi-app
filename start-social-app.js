const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const root = path.join(__dirname, 'shashi-app-social-run');
const backend = path.join(root, 'backend');
const nodeModules = path.join(backend, 'node_modules');
const port = Number(process.env.PORT) || 5000;
const appUrl = `http://127.0.0.1:${port}`;

function checkExistingServer(){
  return new Promise((resolve) => {
    const req = http.get(`${appUrl}/api/health`, { timeout: 2500 }, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        if(res.statusCode === 200){
          try{
            return resolve(JSON.parse(body));
          }catch(error){
            return resolve({ backend: 'online' });
          }
        }
        resolve(null);
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
    req.on('error', () => resolve(null));
  });
}

function start(name, command, args, options) {
  const child = spawn(command, args, {
    ...options,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: false
  });

  child.stdout.on('data', (data) => process.stdout.write(`[${name}] ${data}`));
  child.stderr.on('data', (data) => process.stderr.write(`[${name}] ${data}`));
  child.on('exit', (code) => {
    console.log(`[${name}] stopped with code ${code}`);
  });

  return child;
}

async function main(){
  const existing = await checkExistingServer();
  if(existing){
    console.log('shashi backend is already running.');
    console.log(`Backend: ${existing.backend || 'online'} | MongoDB: ${existing.mongo || 'unknown'}`);
    console.log(`Open ${appUrl}/?resetBackend=1`);
    return;
  }

  const backendProcess = start('backend', process.execPath, ['server.js'], {
    cwd: backend,
    env: {
      ...process.env,
      NODE_PATH: nodeModules
    }
  });

  console.log('shashi is starting...');
  console.log(`Open ${appUrl}/?resetBackend=1`);
  console.log('Keep this window open. Press Ctrl+C to stop.');

  process.on('SIGINT', () => {
    backendProcess.kill();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
