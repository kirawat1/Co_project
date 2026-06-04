const { spawn } = require('child_process');
const domain = 'apply-happiness-margarine.ngrok-free.dev';
const proc = spawn('ngrok', ['http', '80', '--domain=' + domain], { stdio: 'inherit' });
proc.on('exit', (code) => process.exit(code ?? 0));
