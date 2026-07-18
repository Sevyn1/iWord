// Wipes the podcast-ingested catalog so it can be rebuilt from scratch through
// the current ingestion pipeline (real-church identity + website-matched hues).
//
// Deletes every sermon/pastor/church with source='podcast' and clears the
// cached church_id/pastor_id on the feeds table so the next ingest run
// re-resolves each feed's real church identity from scratch. Manual/demo
// content (source='manual') is left untouched.
//
// Usage:  env -u OPENAI_API_KEY node --env-file=.env.local scripts/reset-catalog.mjs

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "Missing env. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function wipe(table) {
  const { error, count } = await admin
    .from(table)
    .delete({ count: "exact" })
    .eq("source", "podcast");
  if (error) throw new Error(`${table}: ${error.message}`);
  console.log(`deleted ${count ?? "?"} rows from ${table}`);
}

// Order matters if FKs are enforced: sermons -> pastors -> churches.
await wipe("sermons");
await wipe("pastors");
await wipe("churches");

// Reset every feed so the next ingest run re-resolves identity from scratch,
// including feeds we previously deactivated as "not a real church".
const { error: feedErr, count: feedCount } = await admin
  .from("feeds")
  .update(
    { active: true, church_id: null, pastor_id: null, last_status: null },
    { count: "exact" }
  )
  .eq("kind", "podcast");
if (feedErr) throw new Error(`feeds: ${feedErr.message}`);
console.log(`reset ${feedCount ?? "?"} feed rows`);

console.log("catalog reset complete");
