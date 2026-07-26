import crypto from 'crypto';

const securityKey = "c8ddf499-d747-46f8-a5339f818320-0511-405f";
const cdnHost = "vz-c0ccc0cb-03a.b-cdn.net";
const videoId = "a0000000-0000-0000-0000-000000000000"; // Dummy video ID
const expiry = Math.floor(Date.now() / 1000) + 7200;

const token = crypto.createHash('sha256').update(securityKey + videoId + expiry).digest('hex');
const url = `https://${cdnHost}/${videoId}/playlist.m3u8?token=${token}&expires=${expiry}`;

console.log("Testing token hex digest:");
console.log(url);

fetch(url, { method: 'HEAD' })
  .then(res => {
    console.log("Status:", res.status);
    console.log("If 403, signature might be invalid. If 404, signature is valid but video not found.");
  })
  .catch(err => console.error(err));
