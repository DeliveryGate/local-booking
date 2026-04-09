/**
 * Parse JSON safely, returning fallback on error.
 */
export function safeJson(str, fallback) {
  try { return JSON.parse(str); } catch { return fallback; }
}

/**
 * Calculate total price for a booking.
 * services: { [serviceId]: { qty, pricePerDay } }
 * addOns:   [{ price, paidAt }]
 * days:     number of calendar days (min 1)
 */
export function calcBookingTotal(services, addOns, days = 1) {
  const d = Math.max(1, days);
  let total = 0;
  for (const [, { qty, pricePerDay }] of Object.entries(services)) {
    total += (qty || 0) * (pricePerDay || 0) * d;
  }
  for (const addon of addOns) {
    if (addon.paidAt === "online") total += addon.price || 0;
  }
  return Math.round(total * 100) / 100;
}

/**
 * Count bookings this month for a shop.
 */
export async function getMonthlyBookingCount(prisma, shop) {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  return prisma.booking.count({ where: { shop, createdAt: { gte: start } } });
}
