const { spawn } = require('child_process');
const domain = 'apply-happiness-margarine.ngrok-free.dev';
// Absolute path required: PM2 runs this under the SYSTEM account (via Task
// Scheduler on boot), whose PATH does not include the user-installed ngrok.
const NGROK_PATH = 'C:\\Users\\project\\AppData\\Local\\Microsoft\\WinGet\\Links\\ngrok.exe';
const proc = spawn(NGROK_PATH, ['http', '80', '--domain=' + domain], { stdio: 'inherit' });
proc.on('error', (err) => {
  console.error('[ngrok] failed to start:', err.message);
  process.exit(1);
});
proc.on('exit', (code, signal) => {
  if (signal) {
    console.error('[ngrok] killed by signal:', signal);
    process.exit(1);
  }
  process.exit(code ?? 1);
});
