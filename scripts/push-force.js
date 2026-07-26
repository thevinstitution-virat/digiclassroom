const { spawn } = require('child_process');

const p = spawn('npx', ['drizzle-kit', 'push'], { stdio: ['pipe', 'inherit', 'inherit'], shell: true });

// Prompt 1: status column in google_drive_folders (create column)
setTimeout(() => {
  console.log('Sending Enter for prompt 1...');
  p.stdin.write('\r\n');
}, 3000);

// Prompt 2: uq_member_user_org constraint (no truncate)
setTimeout(() => {
  console.log('Sending Enter for prompt 2...');
  p.stdin.write('\r\n');
}, 5000);

// Prompt 3: execute statements (Yes, execute)
setTimeout(() => {
  console.log('Sending Down Arrow + Enter for prompt 3...');
  p.stdin.write('\x1B\x5B\x42\r\n');
}, 7000);

p.on('close', (code) => {
  console.log(`Child exited with code ${code}`);
});
