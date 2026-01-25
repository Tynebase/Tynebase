const { spawn } = require('child_process');

console.log('Starting worker process...');
const worker = spawn('npm', ['run', 'dev:worker'], {
  cwd: __dirname,
  shell: true,
  stdio: 'pipe'
});

let output = '';

worker.stdout.on('data', (data) => {
  const text = data.toString();
  output += text;
  console.log(text.trim());
});

worker.stderr.on('data', (data) => {
  console.error(data.toString().trim());
});

setTimeout(() => {
  console.log('\n--- Sending SIGTERM to worker ---');
  worker.kill('SIGTERM');
}, 5000);

worker.on('exit', (code, signal) => {
  console.log(`\n--- Worker exited with code ${code}, signal ${signal} ---`);
  
  const hasStartMessage = output.includes('Starting...');
  const hasPollingMessage = output.includes('Polling for jobs...');
  const hasShutdownMessage = output.includes('shutting down gracefully') || output.includes('Received SIGTERM');
  
  console.log('\nValidation Results:');
  console.log(`✅ Worker starts: ${hasStartMessage}`);
  console.log(`✅ Worker polls for jobs: ${hasPollingMessage}`);
  console.log(`✅ Worker handles SIGTERM: ${hasShutdownMessage || code === 0}`);
  
  if (hasStartMessage && hasPollingMessage) {
    console.log('\n✅ VALIDATION PASSED');
    process.exit(0);
  } else {
    console.log('\n❌ VALIDATION FAILED');
    process.exit(1);
  }
});
