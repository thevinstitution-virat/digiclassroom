/**
 * Step 0: Verify Bunny HLS token signing format before building BunnyHLSPlayer.
 * 
 * Tests two signing approaches:
 *   A) hex digest, input = securityKey + videoId + expiry (matches existing embed token)
 *   B) hex digest, input = securityKey + /videoId/playlist.m3u8 + expiry (CDN Pull Zone style)
 * 
 * Whichever returns HTTP 200 is the correct signing format for HLS.
 */
import crypto from 'crypto';
import mysql from 'mysql2/promise';

async function main() {
  // 1. Read env vars
  const securityKey = process.env.BUNNY_STREAM_SECURITY_KEY;
  const cdnHost = process.env.BUNNY_CDN_HOSTNAME;

  if (!securityKey || !cdnHost) {
    console.error('Missing BUNNY_STREAM_SECURITY_KEY or BUNNY_CDN_HOSTNAME in env');
    process.exit(1);
  }

  // 2. Get a real video ID from the DB
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3310,
    user: 'root',
    password: 'rootpassword123',
    database: 'virat_gyankosh',
  });

  const [rows] = await conn.query(
    "SELECT provider_video_id FROM video_assets WHERE status = 'ready' AND provider = 'bunny' LIMIT 1"
  );
  await conn.end();

  if (!rows || /** @type {any[]} */ (rows).length === 0) {
    console.log('⚠️  No ready Bunny videos found in DB. Cannot test HLS signing.');
    console.log('   This is expected if no videos have been uploaded yet.');
    console.log('   Proceeding with documentation-based signing (approach A — hex, no path).');
    console.log('   Will verify at runtime when first Bunny video is available.');
    return;
  }

  const videoId = /** @type {any} */ (rows)[0].provider_video_id;
  console.log(`Testing with video ID: ${videoId}`);
  console.log(`CDN hostname: ${cdnHost}`);
  console.log();

  const expiry = Math.floor(Date.now() / 1000) + 7200; // 2 hours

  // Approach A: securityKey + videoId + expiry (hex) — matches current iframe embed signing
  const tokenA = crypto.createHash('sha256')
    .update(securityKey + videoId + expiry)
    .digest('hex');
  const urlA = `https://${cdnHost}/${videoId}/playlist.m3u8?token=${tokenA}&expires=${expiry}`;

  // Approach B: securityKey + /videoId/playlist.m3u8 + expiry (hex) — CDN Pull Zone style
  const path = `/${videoId}/playlist.m3u8`;
  const tokenB = crypto.createHash('sha256')
    .update(securityKey + path + expiry)
    .digest('hex');
  const urlB = `https://${cdnHost}${path}?token=${tokenB}&expires=${expiry}`;

  // Approach C: Same as A but base64url encoding
  const tokenC = crypto.createHash('sha256')
    .update(securityKey + videoId + expiry)
    .digest('base64url');
  const urlC = `https://${cdnHost}/${videoId}/playlist.m3u8?token=${tokenC}&expires=${expiry}`;

  console.log('=== Approach A (hex, no path — matches existing embed signing) ===');
  try {
    const resA = await fetch(urlA, { method: 'HEAD' });
    console.log(`Status: ${resA.status} ${resA.statusText}`);
    if (resA.status === 200) console.log('✅ APPROACH A WORKS — use hex digest, input = securityKey + videoId + expiry');
  } catch (e) {
    console.log('❌ Network error:', e.message);
  }

  console.log();
  console.log('=== Approach B (hex, with path — CDN Pull Zone style) ===');
  try {
    const resB = await fetch(urlB, { method: 'HEAD' });
    console.log(`Status: ${resB.status} ${resB.statusText}`);
    if (resB.status === 200) console.log('✅ APPROACH B WORKS — use hex digest, input = securityKey + path + expiry');
  } catch (e) {
    console.log('❌ Network error:', e.message);
  }

  console.log();
  console.log('=== Approach C (base64url, no path) ===');
  try {
    const resC = await fetch(urlC, { method: 'HEAD' });
    console.log(`Status: ${resC.status} ${resC.statusText}`);
    if (resC.status === 200) console.log('✅ APPROACH C WORKS — use base64url digest, input = securityKey + videoId + expiry');
  } catch (e) {
    console.log('❌ Network error:', e.message);
  }
}

main().catch(console.error);
