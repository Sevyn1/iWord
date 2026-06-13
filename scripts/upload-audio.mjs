// Uploads the local demo audio in private/audio/ to the private Supabase Storage
// bucket used by the gated stream endpoint.
//
// Usage:  npm run upload:audio
// Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (the npm
// script loads them from .env.local via `node --env-file`).

import { createClient } from "@supabase/supabase-js";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "Missing env. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
  process.exit(1);
}

const BUCKET = "sermons";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUDIO_DIR = path.join(__dirname, "..", "private", "audio");

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Ensure the bucket exists (idempotent; migration 003 also creates it).
const { error: bucketError } = await supabase.storage.createBucket(BUCKET, {
  public: false,
});
if (bucketError && !/already exists/i.test(bucketError.message)) {
  console.error(`Could not ensure bucket: ${bucketError.message}`);
  process.exit(1);
}

const files = (await readdir(AUDIO_DIR)).filter((f) => f.endsWith(".wav"));
if (files.length === 0) {
  console.error(`No .wav files found in ${AUDIO_DIR}`);
  process.exit(1);
}

let failures = 0;
for (const file of files) {
  const body = await readFile(path.join(AUDIO_DIR, file));
  const { error } = await supabase.storage.from(BUCKET).upload(file, body, {
    contentType: "audio/wav",
    upsert: true,
  });
  if (error) {
    failures += 1;
    console.error(`\u2717 ${file}: ${error.message}`);
  } else {
    console.log(`\u2713 uploaded ${file} (${body.length} bytes)`);
  }
}

console.log(
  failures === 0
    ? `Done \u2014 ${files.length} file(s) in bucket "${BUCKET}".`
    : `Finished with ${failures} failure(s).`
);
process.exit(failures === 0 ? 0 : 1);
