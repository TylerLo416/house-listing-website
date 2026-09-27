import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { parseEnv } from 'node:util';
import { spawn } from 'node:child_process';
import { S3Client, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

let local = {};
try { local = parseEnv(await fs.readFile('.env', 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const env = { ...local, ...process.env };
for (const key of ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY']) {
  if (!env[key]) throw new Error(`Missing ${key}; set it in .env or the deployment environment.`);
}

const config = JSON.parse(await fs.readFile('wrangler.json', 'utf8'));
const bucket = config.r2_buckets.find(binding => binding.binding === 'VIDEOS').bucket_name;
const videos = JSON.parse(await fs.readFile('cloudflare/video-manifest.json', 'utf8'));
const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
});

// Upload before publishing the Worker, so every released video URL already exists.
for (const [url, video] of Object.entries(videos)) {
  const file = url.slice(1);
  const data = await fs.readFile(file);
  const hash = createHash('sha256').update(data).digest('hex');
  if (hash !== video.sha256 || data.length !== video.size) throw new Error(`Rebuild before deploying: ${file} changed.`);
  let existing;
  try { existing = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: video.key })); }
  catch (error) { if (error.$metadata?.httpStatusCode !== 404) throw error; }
  if (existing?.Metadata?.sha256 === hash && existing.ContentLength === video.size) {
    console.log(`Already uploaded: ${file}`);
    continue;
  }
  await s3.send(new PutObjectCommand({
    Bucket: bucket, Key: video.key, Body: createReadStream(file), ContentLength: video.size,
    ContentType: 'video/mp4', CacheControl: 'public, max-age=31536000, immutable', Metadata: { sha256: hash },
  }));
  console.log(`Uploaded: ${file}`);
}

// Pass management credentials only to the CLI; no secrets become Worker bindings.
const child = spawn(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'deploy'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    CLOUDFLARE_API_TOKEN: env.CLOUDFLARE_API_TOKEN,
    CLOUDFLARE_ACCOUNT_ID: env.CLOUDFLARE_ACCOUNT_ID,
    CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: 'false',
    CLOUDFLARE_INCLUDE_PROCESS_ENV: 'false',
    WRANGLER_SEND_METRICS: 'false',
    CI: 'true',
  },
});
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
