-- Private bucket for sermon audio. Files are never public; the gated
-- /api/stream/[id] handler mints short-lived signed URLs (service role) after
-- checking the listener's plan + monthly quota. The upload script
-- (`npm run upload:audio`) also ensures this bucket exists.
insert into storage.buckets (id, name, public)
values ('sermons', 'sermons', false)
on conflict (id) do nothing;
