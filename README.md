# Local Booking — Service and Slot Booking

**Built and proven in production at Vanda's Kitchen, running live luggage storage in the City of London.**

A Shopify app for local service booking: luggage storage, equipment hire, bike storage, parcel collection, click-and-collect, and more. Customers select service quantities, choose drop-off and collection time slots, add optional add-ons, and check out via Shopify using the Pickup shipping method.

Developer: **SaltCore** | [saltai.app](https://saltai.app) | support@saltai.app

---

## Plans

| Plan       | Price     | Features |
|------------|-----------|----------|
| Free       | $0/month  | 1 service type, basic time slots, up to 20 bookings/month |
| Starter    | $19/month | Unlimited service types, add-ons, custom time slots, unlimited bookings |
| Pro        | $39/month | Booking calendar, capacity limits per slot, confirmation emails, analytics |
| Enterprise | $79/month | Multi-location, custom branding, API access |

---

## Setup

### Environment variables (Railway)

```
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
SHOPIFY_API_KEY=...
SHOPIFY_API_SECRET=...
SHOPIFY_APP_URL=https://your-app.up.railway.app
NODE_ENV=production
PORT=3000
```

### Deploy

Push to `main` — Railway builds from the Dockerfile automatically.

```bash
git push origin main
```

### Database

```bash
cd web && npx prisma db push --schema=../prisma/schema.prisma
```

---

## Theme Extension Setup

1. Install the app on your Shopify store.
2. Go to **Online Store → Themes → Customize**.
3. Add the **Local Booking Widget** block to any section.
4. Set the **App backend URL** to your Railway deployment URL.
5. Add FAQ blocks as needed.

The widget fetches live config (services, add-ons, time slots, location) from the app backend and renders the full booking form.

---

## Architecture

```
local-booking/
├── Dockerfile
├── package.json
├── railway.json
├── shopify.app.toml
├── prisma/
│   └── schema.prisma
├── web/
│   ├── index.js              # Express backend
│   ├── shopify.js            # GraphQL, HMAC, plan definitions
│   ├── package.json
│   ├── middleware/
│   │   └── verify-request.js
│   ├── lib/
│   │   └── bookingHelpers.js
│   └── frontend/
│       ├── index.html
│       ├── vite.config.js
│       ├── App.jsx
│       └── pages/
│           ├── index.jsx     # Dashboard
│           ├── services.jsx  # Service types & add-ons
│           ├── timeslots.jsx # Time slot config
│           ├── bookings.jsx  # Booking list
│           └── settings.jsx  # Location, trust, billing
└── extensions/
    └── local-booking/
        ├── shopify.extension.toml
        └── blocks/
            └── booking_widget.liquid
```
