import crypto from "crypto";

export function verifyWebhookHmac(rawBody, hmacHeader, secret) {
  const digest = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmacHeader));
}

export async function shopifyGraphQL(shop, accessToken, query, variables = {}) {
  const res = await fetch(`https://${shop}/admin/api/2026-01/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": accessToken },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Shopify API error: ${res.status}`);
  return res.json();
}

export const PLANS = {
  free:       { name: "Free",       price: 0,  bookingLimit: 20 },
  starter:    { name: "Starter",    price: 19, bookingLimit: null },
  pro:        { name: "Pro",        price: 39, bookingLimit: null },
  enterprise: { name: "Enterprise", price: 79, bookingLimit: null },
};

export const CREATE_SUBSCRIPTION = `
  mutation AppSubscriptionCreate($name: String!, $lineItems: [AppSubscriptionLineItemInput!]!, $returnUrl: URL!, $test: Boolean) {
    appSubscriptionCreate(name: $name, returnUrl: $returnUrl, lineItems: $lineItems, test: $test) {
      userErrors { field message } confirmationUrl appSubscription { id status }
    }
  }
`;
