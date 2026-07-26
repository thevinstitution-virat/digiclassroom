import fs from 'fs';
import crypto from 'crypto';
import fetch from 'node-fetch';

/**
 * Proof of Concept: Bunny Stream Upload & Signed URL Generation
 * 
 * Usage: 
 * BUNNY_LIBRARY_ID=123 BUNNY_LIBRARY_API_KEY=xxx BUNNY_STREAM_SECURITY_KEY=xxx BUNNY_CDN_HOSTNAME=vz-xyz.b-cdn.net node poc-stream-upload.mjs ./test-video.mp4
 */

const {
  BUNNY_LIBRARY_ID,
  BUNNY_LIBRARY_API_KEY,
  BUNNY_STREAM_SECURITY_KEY,
  BUNNY_CDN_HOSTNAME
} = process.env;

if (!BUNNY_LIBRARY_ID || !BUNNY_LIBRARY_API_KEY || !BUNNY_STREAM_SECURITY_KEY || !BUNNY_CDN_HOSTNAME) {
  console.error("Missing required Bunny Stream environment variables.");
  process.exit(1);
}

const filePath = process.argv[2];
if (!filePath || !fs.existsSync(filePath)) {
  console.error("Please provide a valid path to an MP4 file as the first argument.");
  process.exit(1);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
  try {
    console.log("1. Creating video entry in Bunny Stream...");
    const createRes = await fetch(`https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}/videos`, {
      method: 'POST',
      headers: {
        'AccessKey': BUNNY_LIBRARY_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        title: `POC Upload ${Date.now()}`
      })
    });

    if (!createRes.ok) throw new Error(`Create failed: ${await createRes.text()}`);
    const createData = await createRes.json();
    const videoId = createData.guid;
    console.log(`✅ Created videoId: ${videoId}`);

    console.log(`2. Uploading raw MP4 binary (${filePath})...`);
    const fileStream = fs.createReadStream(filePath);
    
    const uploadRes = await fetch(`https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}/videos/${videoId}`, {
      method: 'PUT',
      headers: {
        'AccessKey': BUNNY_LIBRARY_API_KEY,
        'Content-Type': 'application/octet-stream',
      },
      body: fileStream
    });

    if (!uploadRes.ok) throw new Error(`Upload failed: ${await uploadRes.text()}`);
    console.log(`✅ Upload complete.`);

    console.log("3. Polling for processing completion...");
    let isReady = false;
    while (!isReady) {
      await sleep(3000);
      const statusRes = await fetch(`https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}/videos/${videoId}`, {
        headers: { 'AccessKey': BUNNY_LIBRARY_API_KEY, 'Accept': 'application/json' }
      });
      const statusData = await statusRes.json();
      
      console.log(`   Status: ${statusData.status} (Encoding Progress: ${statusData.encodeProgress}%)`);
      // status 4 = finished
      if (statusData.status === 4) {
        isReady = true;
      } else if (statusData.status === 5 || statusData.status === 6) {
        throw new Error("Video processing failed or was cancelled.");
      }
    }
    console.log(`✅ Video is ready.`);

    console.log("4. Generating Time-Limited Signed URL...");
    // Bunny token auth
    const expiry = Math.floor(Date.now() / 1000) + 3600; // 1hr
    // Bunny Stream Token Auth is designed for their embed player
    // Formula: SHA256_HEX(SecurityKey + VideoId + Expiry)
    const dataToSign = BUNNY_STREAM_SECURITY_KEY + videoId + expiry;
    const token = crypto
      .createHash('sha256')
      .update(dataToSign)
      .digest('hex'); 
      
    // Use the official iframe embed URL
    const signedUrl = `https://iframe.mediadelivery.net/embed/${BUNNY_LIBRARY_ID}/${videoId}?token=${token}&expires=${expiry}`;
    
    console.log("\n=======================================================");
    console.log("SUCCESS! Here is your 1-hour signed playback URL:");
    console.log(signedUrl);
    console.log("=======================================================\n");

  } catch (err) {
    console.error("POC Error:", err);
  }
}

run();
