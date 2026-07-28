import crypto from 'crypto';

const securityKey = "c8ddf499-d747-46f8-a5339f818320-0511-405f";
const cdnHost = "vz-c0ccc0cb-03a.b-cdn.net";
const videoId = "a0000000-0000-0000-0000-000000000000"; // Dummy video ID
const expiry = Math.floor(Date.now() / 1000) + 7200;

console.log("=== Approach B: Path ===");
const path = `/${videoId}/playlist.m3u8`;
const tokenB = crypto.createHash('sha256').update(securityKey + path + expiry).digest('base64');
const urlB = `https://${cdnHost}${path}?token=${tokenB
  .replace(/\n/g, '')
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=/g, '')}&expires=${expiry}`;
console.log(urlB);

fetch(urlB, { method: 'HEAD' }).then(res => console.log("Status B:", res.status));

console.log("=== Approach C: Base64 ===");
const tokenC = crypto.createHash('sha256').update(securityKey + path + expiry).digest('hex');
const urlC = `https://${cdnHost}${path}?token=${tokenC}&expires=${expiry}`;
console.log(urlC);

fetch(urlC, { method: 'HEAD' }).then(res => console.log("Status C:", res.status));
