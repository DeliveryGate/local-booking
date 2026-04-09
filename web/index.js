import express from "express";
import compression from "compression";
import { PrismaClient } from "@prisma/client";
import path from "path";
import { fileURLToPath } from "url";
import serveStatic from "serve-static";
import { verifyWebhookHmac, shopifyGraphQL, PLANS, CREATE_SUBSCRIPTION } from "./shopify.js";
import { verifyRequest } from "./middleware/verify-request.js";
import { safeJson, getMonthlyBookingCount } from "./lib/bookingHelpers.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient();
const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);
const IS_PROD = process.env.NODE_ENV === "production";

app.use(compression());
app.use("/api/webhooks", express.raw({ type: "application/json" }));
app.use(express.json());
app.get("/health", (req, res) => res.json({ status: "ok", app: "local-booking" }));

// ─────────────────────────────────────────────
// Webhooks (GDPR + app/uninstalled)
// ─────────────────────────────────────────────
app.post("/api/webhooks/:topic", async (req, res) => {
  const hmac = req.headers["x-shopify-hmac-sha256"];
  if (!hmac || !verifyWebhookHmac(req.body.toString(), hmac, process.env.SHOPIFY_API_SECRET)) {
    return res.status(401).send("Unauthorized");
  }
  const shop = req.headers["x-shopify-shop-domain"];
  try {
    const topic = req.params.topic;
    if (topic === "app-uninstalled" || topic === "shop-redact" || topic === "customers-redact") {
      await prisma.booking.deleteMany({ where: { shop } });
      await prisma.serviceType.deleteMany({ where: { shop } });
      await prisma.addOn.deleteMany({ where: { shop } });
      await prisma.timeSlotConfig.deleteMany({ where: { shop } });
      await prisma.merchantPlan.deleteMany({ where: { shop } });
      await prisma.session.deleteMany({ where: { shop } });
    }
    res.status(200).send("OK");
  } catch (err) {
    console.error("[webhook] error:", err);
    res.status(500).send("Error");
  }
});

// ─────────────────────────────────────────────
// Config (full booking config for the widget)
// ─────────────────────────────────────────────
app.get("/api/config", verifyRequest, async (req, res) => {
  const { shop } = req.shopSession;
  try {
    const [services, addOns, slotConfig, merchant] = await Promise.all([
      prisma.serviceType.findMany({ where: { shop, active: true }, orderBy: { sortOrder: "asc" } }),
      prisma.addOn.findMany({ where: { shop, active: true } }),
      prisma.timeSlotConfig.findUnique({ where: { shop } }),
      prisma.merchantPlan.findUnique({ where: { shop } }),
    ]);
    res.json({
      services,
      addOns,
      dropoffSlots: safeJson(slotConfig?.dropoffSlots, []),
      collectionSlots: safeJson(slotConfig?.collectionSlots, []),
      operatingHours: safeJson(slotConfig?.operatingHours, {}),
      slotCapacity: slotConfig?.slotCapacity || 10,
      locationAddress: merchant?.locationAddress || "",
      locationMapsUrl: merchant?.locationMapsUrl || "",
      locationWazeUrl: merchant?.locationWazeUrl || "",
      overnightEnabled: merchant?.overnightEnabled || false,
      trustMessages: safeJson(merchant?.trustMessages, []),
      pickupInstructions: merchant?.pickupInstructions || "",
      plan: merchant?.plan || "free",
    });
  } catch (err) {
    console.error("[api/config] error:", err);
    res.status(500).json({ error: "Failed to fetch config" });
  }
});

app.post("/api/config", verifyRequest, async (req, res) => {
  const { shop } = req.shopSession;
  const { locationAddress, locationMapsUrl, locationWazeUrl, overnightEnabled, trustMessages, pickupInstructions } = req.body;
  try {
    const data = {};
    if (locationAddress !== undefined) data.locationAddress = locationAddress;
    if (locationMapsUrl !== undefined) data.locationMapsUrl = locationMapsUrl;
    if (locationWazeUrl !== undefined) data.locationWazeUrl = locationWazeUrl;
    if (overnightEnabled !== undefined) data.overnightEnabled = Boolean(overnightEnabled);
    if (trustMessages !== undefined) data.trustMessages = JSON.stringify(trustMessages);
    if (pickupInstructions !== undefined) data.pickupInstructions = pickupInstructions;
    const updated = await prisma.merchantPlan.upsert({ where: { shop }, create: { shop, ...data }, update: data });
    res.json(updated);
  } catch (err) {
    console.error("[api/config POST] error:", err);
    res.status(500).json({ error: "Failed to save config" });
  }
});

// ─────────────────────────────────────────────
// Services
// ─────────────────────────────────────────────
app.get("/api/services", verifyRequest, async (req, res) => {
  const { shop } = req.shopSession;
  try {
    const services = await prisma.serviceType.findMany({ where: { shop }, orderBy: { sortOrder: "asc" } });
    res.json(services);
  } catch (err) { res.status(500).json({ error: "Failed to fetch services" }); }
});

app.post("/api/services", verifyRequest, async (req, res) => {
  const { shop } = req.shopSession;
  const { name, pricePerDay, icon, sortOrder } = req.body;
  if (!name || pricePerDay === undefined) return res.status(400).json({ error: "name and pricePerDay required" });

  // Free plan: max 1 service type
  const merchant = await prisma.merchantPlan.findUnique({ where: { shop } });
  const plan = merchant?.plan || "free";
  if (plan === "free") {
    const count = await prisma.serviceType.count({ where: { shop } });
    if (count >= 1) return res.status(403).json({ error: "Free plan limited to 1 service type", upgrade: true });
  }

  try {
    const service = await prisma.serviceType.create({
      data: { shop, name, pricePerDay: parseFloat(pricePerDay), icon: icon || "🧳", sortOrder: parseInt(sortOrder || "0") },
    });
    res.json(service);
  } catch (err) { res.status(500).json({ error: "Failed to create service" }); }
});

app.put("/api/services/:id", verifyRequest, async (req, res) => {
  const { shop } = req.shopSession;
  const { name, pricePerDay, icon, active, sortOrder } = req.body;
  try {
    const existing = await prisma.serviceType.findFirst({ where: { id: req.params.id, shop } });
    if (!existing) return res.status(404).json({ error: "Service not found" });
    const data = {};
    if (name !== undefined) data.name = name;
    if (pricePerDay !== undefined) data.pricePerDay = parseFloat(pricePerDay);
    if (icon !== undefined) data.icon = icon;
    if (active !== undefined) data.active = Boolean(active);
    if (sortOrder !== undefined) data.sortOrder = parseInt(sortOrder);
    const updated = await prisma.serviceType.update({ where: { id: req.params.id }, data });
    res.json(updated);
  } catch (err) { res.status(500).json({ error: "Failed to update service" }); }
});

app.delete("/api/services/:id", verifyRequest, async (req, res) => {
  const { shop } = req.shopSession;
  try {
    const existing = await prisma.serviceType.findFirst({ where: { id: req.params.id, shop } });
    if (!existing) return res.status(404).json({ error: "Service not found" });
    await prisma.serviceType.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: "Failed to delete service" }); }
});

// ─────────────────────────────────────────────
// Add-ons
// ─────────────────────────────────────────────
app.get("/api/addons", verifyRequest, async (req, res) => {
  const { shop } = req.shopSession;
  try {
    const addOns = await prisma.addOn.findMany({ where: { shop } });
    res.json(addOns);
  } catch (err) { res.status(500).json({ error: "Failed to fetch add-ons" }); }
});

app.post("/api/addons", verifyRequest, async (req, res) => {
  const { shop } = req.shopSession;
  const { name, price, paidAt } = req.body;
  if (!name || price === undefined) return res.status(400).json({ error: "name and price required" });

  // Starter+ only
  const merchant = await prisma.merchantPlan.findUnique({ where: { shop } });
  const plan = merchant?.plan || "free";
  if (plan === "free") return res.status(403).json({ error: "Add-ons require Starter plan or above", upgrade: true });

  try {
    const addon = await prisma.addOn.create({
      data: { shop, name, price: parseFloat(price), paidAt: paidAt || "online" },
    });
    res.json(addon);
  } catch (err) { res.status(500).json({ error: "Failed to create add-on" }); }
});

app.put("/api/addons/:id", verifyRequest, async (req, res) => {
  const { shop } = req.shopSession;
  const { name, price, paidAt, active } = req.body;
  try {
    const existing = await prisma.addOn.findFirst({ where: { id: req.params.id, shop } });
    if (!existing) return res.status(404).json({ error: "Add-on not found" });
    const data = {};
    if (name !== undefined) data.name = name;
    if (price !== undefined) data.price = parseFloat(price);
    if (paidAt !== undefined) data.paidAt = paidAt;
    if (active !== undefined) data.active = Boolean(active);
    const updated = await prisma.addOn.update({ where: { id: req.params.id }, data });
    res.json(updated);
  } catch (err) { res.status(500).json({ error: "Failed to update add-on" }); }
});

app.delete("/api/addons/:id", verifyRequest, async (req, res) => {
  const { shop } = req.shopSession;
  try {
    const existing = await prisma.addOn.findFirst({ where: { id: req.params.id, shop } });
    if (!existing) return res.status(404).json({ error: "Add-on not found" });
    await prisma.addOn.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: "Failed to delete add-on" }); }
});

// ─────────────────────────────────────────────
// Time Slots
// ─────────────────────────────────────────────
app.get("/api/timeslots", verifyRequest, async (req, res) => {
  const { shop } = req.shopSession;
  try {
    const config = await prisma.timeSlotConfig.findUnique({ where: { shop } });
    if (!config) return res.json({ dropoffSlots: [], collectionSlots: [], operatingHours: {}, slotCapacity: 10 });
    res.json({
      dropoffSlots: safeJson(config.dropoffSlots, []),
      collectionSlots: safeJson(config.collectionSlots, []),
      operatingHours: safeJson(config.operatingHours, {}),
      slotCapacity: config.slotCapacity,
    });
  } catch (err) { res.status(500).json({ error: "Failed to fetch time slots" }); }
});

app.post("/api/timeslots", verifyRequest, async (req, res) => {
  const { shop } = req.shopSession;
  const { dropoffSlots, collectionSlots, operatingHours, slotCapacity } = req.body;

  // Custom time slots require Starter+
  const merchant = await prisma.merchantPlan.findUnique({ where: { shop } });
  const plan = merchant?.plan || "free";

  try {
    const data = {};
    if (dropoffSlots !== undefined) data.dropoffSlots = JSON.stringify(dropoffSlots);
    if (collectionSlots !== undefined) data.collectionSlots = JSON.stringify(collectionSlots);
    if (operatingHours !== undefined) {
      if (plan === "free") return res.status(403).json({ error: "Custom operating hours require Starter plan", upgrade: true });
      data.operatingHours = JSON.stringify(operatingHours);
    }
    if (slotCapacity !== undefined) {
      if (!["pro", "enterprise"].includes(plan)) return res.status(403).json({ error: "Capacity limits require Pro plan", upgrade: true });
      data.slotCapacity = parseInt(slotCapacity);
    }
    const config = await prisma.timeSlotConfig.upsert({ where: { shop }, create: { shop, ...data }, update: data });
    res.json(config);
  } catch (err) { res.status(500).json({ error: "Failed to save time slots" }); }
});

// ─────────────────────────────────────────────
// Bookings
// ─────────────────────────────────────────────
app.get("/api/bookings", verifyRequest, async (req, res) => {
  const { shop } = req.shopSession;
  const page = parseInt(req.query.page || "1");
  const status = req.query.status;
  const where = { shop };
  if (status) where.status = status;

  // Calendar view is pro+
  const merchant = await prisma.merchantPlan.findUnique({ where: { shop } });
  const plan = merchant?.plan || "free";

  try {
    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * 20, take: 20 }),
      prisma.booking.count({ where }),
    ]);
    const monthlyCount = await getMonthlyBookingCount(prisma, shop);
    res.json({ bookings, total, page, pages: Math.ceil(total / 20), monthlyCount, plan });
  } catch (err) { res.status(500).json({ error: "Failed to fetch bookings" }); }
});

// ─────────────────────────────────────────────
// Settings
// ─────────────────────────────────────────────
app.get("/api/settings", verifyRequest, async (req, res) => {
  const { shop } = req.shopSession;
  try {
    const merchant = await prisma.merchantPlan.findUnique({ where: { shop } });
    const monthlyCount = await getMonthlyBookingCount(prisma, shop);
    res.json({
      plan: merchant?.plan || "free",
      locationAddress: merchant?.locationAddress || "",
      locationMapsUrl: merchant?.locationMapsUrl || "",
      locationWazeUrl: merchant?.locationWazeUrl || "",
      overnightEnabled: merchant?.overnightEnabled || false,
      trustMessages: safeJson(merchant?.trustMessages, []),
      pickupInstructions: merchant?.pickupInstructions || "",
      monthlyCount,
      bookingLimit: PLANS[merchant?.plan || "free"]?.bookingLimit,
    });
  } catch (err) { res.status(500).json({ error: "Failed to fetch settings" }); }
});

app.post("/api/settings", verifyRequest, async (req, res) => {
  const { shop } = req.shopSession;
  const { locationAddress, locationMapsUrl, locationWazeUrl, overnightEnabled, trustMessages, pickupInstructions } = req.body;
  const data = {};
  if (locationAddress !== undefined) data.locationAddress = locationAddress;
  if (locationMapsUrl !== undefined) data.locationMapsUrl = locationMapsUrl;
  if (locationWazeUrl !== undefined) data.locationWazeUrl = locationWazeUrl;
  if (overnightEnabled !== undefined) data.overnightEnabled = Boolean(overnightEnabled);
  if (trustMessages !== undefined) data.trustMessages = JSON.stringify(trustMessages);
  if (pickupInstructions !== undefined) data.pickupInstructions = pickupInstructions;
  try {
    const updated = await prisma.merchantPlan.upsert({ where: { shop }, create: { shop, ...data }, update: data });
    res.json(updated);
  } catch (err) { res.status(500).json({ error: "Failed to save settings" }); }
});

// ─────────────────────────────────────────────
// Billing
// ─────────────────────────────────────────────
app.get("/api/billing/status", verifyRequest, async (req, res) => {
  const { shop } = req.shopSession;
  const merchant = await prisma.merchantPlan.findUnique({ where: { shop } });
  const plan = merchant?.plan || "free";
  const monthlyCount = await getMonthlyBookingCount(prisma, shop);
  res.json({
    plan,
    price: PLANS[plan]?.price || 0,
    bookingLimit: PLANS[plan]?.bookingLimit,
    monthlyCount,
  });
});

app.post("/api/billing/subscribe", verifyRequest, async (req, res) => {
  const { shop, accessToken } = req.shopSession;
  const { plan } = req.body;
  if (!plan || !PLANS[plan] || plan === "free") return res.status(400).json({ error: "Invalid plan" });
  const returnUrl = `${process.env.SHOPIFY_APP_URL}/api/billing/callback?shop=${shop}&plan=${plan}`;
  try {
    const result = await shopifyGraphQL(shop, accessToken, CREATE_SUBSCRIPTION, {
      name: `Local Booking ${PLANS[plan].name}`,
      returnUrl,
      test: !IS_PROD,
      lineItems: [{ plan: { appRecurringPricingDetails: { price: { amount: PLANS[plan].price, currencyCode: "USD" }, interval: "EVERY_30_DAYS" } } }],
    });
    const { confirmationUrl, userErrors } = result.data.appSubscriptionCreate;
    if (userErrors.length > 0) return res.status(400).json({ error: "Failed", details: userErrors });
    res.json({ confirmationUrl });
  } catch (err) { res.status(500).json({ error: "Subscription failed" }); }
});

app.get("/api/billing/callback", async (req, res) => {
  const { shop, plan, charge_id } = req.query;
  if (charge_id && plan && shop) {
    await prisma.merchantPlan.upsert({ where: { shop }, create: { shop, plan, subscriptionId: charge_id }, update: { plan, subscriptionId: charge_id } });
  }
  res.redirect(`/?shop=${shop}`);
});

// ─────────────────────────────────────────────
// Static frontend
// ─────────────────────────────────────────────
if (IS_PROD) {
  app.use(serveStatic(path.join(__dirname, "frontend", "dist")));
  app.get("*", (req, res) => res.sendFile(path.join(__dirname, "frontend", "dist", "index.html")));
}

app.listen(PORT, () => console.log(`Local Booking backend running on port ${PORT}`));
