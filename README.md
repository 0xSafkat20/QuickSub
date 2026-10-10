# QuickSub

QuickSub is a full-stack digital subscription storefront for streaming, gaming, music, productivity, and AI services. It combines a responsive React storefront with customer accounts, cart and checkout flows, order tracking, subscriptions, loyalty rewards, payment handling, and an operations dashboard.

The application uses a React frontend, a Node API, and Supabase-backed persistent data, with a disposable simulation available for development and automated testing.

## Features

### Storefront and customers

- Searchable, filterable product catalog with package comparison and wishlists
- English and Bangla interface
- Customer signup, email confirmation, login, password recovery, and two-hour sessions
- Account-based cart plus browser-local guest checkout drafts
- Checkout, private order tracking, saved receipts, and PDF receipt export
- Subscription status and cancellation requests
- Loyalty points, referral codes, rewards, verified reviews, and support requests
- Responsive layouts, accessibility support, SEO metadata, and legal/cookie controls

### Payments

- Manual payment submission and administrator verification
- SSLCommerz online checkout with sandbox and production modes
- Idempotent order creation and verified payment callbacks
- Optional receipt emails through Resend
- Safe simulated checkout for local development and browser tests

### Administration

- Protected `/admin` dashboard with optional email-based two-step verification
- Product and package management backed by Supabase
- Order, payment, customer, and subscription operations
- Reporting, CSV exports, notifications, offers, reviews, and support inbox
- Configurable loyalty and referral policy

### Support assistant

- Gemini-powered chat when an API key is configured
- Catalog and help fallback when Gemini is unavailable
- Generated knowledge files kept in sync by the build process

## Tech stack

- React 18, TypeScript, Vite, and Tailwind CSS
- Framer Motion and Lucide React
- Node.js and Express
- Supabase/PostgreSQL
- PGlite for disposable local and integration-test databases
- Node test runner and Puppeteer
- Vercel and GitHub Actions

## Application routes

| Route | Purpose |
| --- | --- |
| `/` | Storefront and product catalog |
| `/account` | Customer authentication, profile, orders, rewards, and subscriptions |
| `/cart` | Saved account cart |
| `/checkout` | Package checkout |
| `/track` | Private order tracking |
| `/subscriptions/:id` | Subscription details |
| `/forgot-password` and `/reset-password` | Account recovery |
| `/admin` | Administration dashboard |

## Project structure

```text
QuickSub/
├── api/                 # Vercel serverless API entry point
├── public/              # Static assets
├── scripts/             # Local runtime, seeding, verification, and browser checks
├── server/              # Express API and domain modules
├── src/
│   ├── admin/           # Administration dashboard
│   ├── components/      # Storefront, account, checkout, and shared UI
│   ├── context/         # Client-side React state
│   ├── data/            # Catalog fallbacks and static content
│   ├── i18n/            # English and Bangla translations
│   └── utils/           # API, session, navigation, cart, and receipt helpers
├── supabase/
│   ├── functions/       # Supabase Edge Functions
│   ├── migrations/      # Ordered database migrations
│   └── templates/       # Authentication email templates
├── vercel.json          # Rewrites, serverless function, and scheduled jobs
└── package.json
```
