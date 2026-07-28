const { spawn } = require('child_process');

const cp = spawn('npx.cmd', ['drizzle-kit', 'push'], { shell: true });

cp.stdout.on('data', (data) => {
  const str = data.toString();
  process.stdout.write(str);
  
  if (str.includes('Do you want to truncate member table?')) {
    console.log('[Script] Answering first prompt...');
    setTimeout(() => { cp.stdin.write('\n'); }, 500);
  }
  
  if (str.includes('Yes, I want to execute all statements')) {
    console.log('[Script] Answering second prompt...');
    setTimeout(() => { cp.stdin.write('\x1B[B\n'); }, 500);
  }
});

cp.stderr.on('data', (data) => {
  process.stderr.write(data);
});

cp.on('close', (code) => {
  console.log(`Child process exited with code ${code}`);
  process.exit(code);
});
