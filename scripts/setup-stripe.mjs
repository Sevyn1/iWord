// Creates the iWord subscription products + monthly prices in Stripe and prints
// the Price ids to paste into your env (STRIPE_PRICE_DEVOTED / STRIPE_PRICE_PATRON).
//
// Usage:  npm run setup:stripe
// Requires STRIPE_SECRET_KEY (loaded from .env.local by the npm script).
// Safe to re-run: it reuses products/prices with the same lookup_key.

import Stripe from "stripe";

const secret = process.env.STRIPE_SECRET_KEY;
if (!secret) {
  console.error("Missing STRIPE_SECRET_KEY in .env.local");
  process.exit(1);
}

const stripe = new Stripe(secret);

const PLANS = [
  { key: "devoted", name: "iWord Devoted", amount: 600 }, // $6.00 / month
  { key: "patron", name: "iWord Patron", amount: 1800 }, // $18.00 / month
];

async function ensurePrice({ key, name, amount }) {
  const lookupKey = `iword_${key}_monthly`;

  // Reuse an existing price with this lookup key if present.
  const existing = await stripe.prices.list({
    lookup_keys: [lookupKey],
    active: true,
    limit: 1,
  });
  if (existing.data[0]) return { key, priceId: existing.data[0].id, reused: true };

  const product = await stripe.products.create({
    name,
    metadata: { iword_plan: key },
  });

  const price = await stripe.prices.create({
    product: product.id,
    currency: "usd",
    unit_amount: amount,
    recurring: { interval: "month" },
    lookup_key: lookupKey,
    metadata: { iword_plan: key },
  });

  return { key, priceId: price.id, reused: false };
}

const results = [];
for (const plan of PLANS) {
  results.push(await ensurePrice(plan));
}

console.log("\nStripe prices ready:\n");
for (const r of results) {
  console.log(`  ${r.key.padEnd(8)} ${r.priceId}  ${r.reused ? "(reused)" : "(created)"}`);
}
console.log("\nAdd these to .env.local and Vercel:\n");
console.log(`STRIPE_PRICE_DEVOTED=${results.find((r) => r.key === "devoted").priceId}`);
console.log(`STRIPE_PRICE_PATRON=${results.find((r) => r.key === "patron").priceId}\n`);
