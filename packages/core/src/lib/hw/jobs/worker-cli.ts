// `npm run hw:worker` (from apps/api): drains the hw job queue in a loop. For local
// development and as an option if the queue outgrows the per-minute cron route.

import { hostname } from 'node:os';
import { drain } from './runner';

const workerId = `cli:${hostname()}:${process.pid}`;
let stopping = false;
process.on('SIGINT', () => { stopping = true; });
process.on('SIGTERM', () => { stopping = true; });

async function main(): Promise<void> {
  console.log(`[hw] worker ${workerId} started`);
  while (!stopping) {
    const s = await drain(workerId, 50_000);
    const busy = s.readTaken + s.gradeTaken + s.readPolled + s.gradePolled;
    if (busy || s.errors.length) console.log('[hw] drain', JSON.stringify(s));
    if (!busy) await new Promise((r) => setTimeout(r, 15_000));
  }
  console.log('[hw] worker stopped');
  process.exit(0);
}

main().catch((e) => {
  console.error('[hw] worker crashed:', e);
  process.exit(1);
});
