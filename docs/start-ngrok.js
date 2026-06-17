const { spawn } = require('child_process');
const domain = 'apply-happiness-margarine.ngrok-free.dev';
const proc = spawn('ngrok', ['http', '80', '--domain=' + domain], { stdio: 'inherit' });
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
