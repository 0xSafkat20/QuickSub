# Gemini and Supabase setup

For the current admin dashboard and customer order integration, follow [ADMIN-SETUP.md](ADMIN-SETUP.md), including the additional admin/orders migration. This guide covers the original catalog and Gemini setup.

The support chatbot now uses Gemini. The existing design is retained. The product grid, search, saved products and comparison picker load the catalog through `/api/products`. Chat uses the same database snapshot. Products include numeric BDT starting prices, image URLs, stock status, descriptions, categories, badges, popular plans and existing package/sales data. Store FAQ/policy knowledge is saved separately.

## Private configuration

Edit `server/.env` locally (never send keys in chat):

```env
GEMINI_API_KEY=your_private_gemini_key
GEMINI_MODEL=gemini-2.5-flash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_private_supabase_service_role_key
PORT=4000
```

Get a Gemini key through Google AI Studio. Use your own Supabase project's URL and service-role key. Existing OpenAI settings are no longer used. No privileged key is sent to the browser. Keys are not included in the downloadable ZIP. Production hosting can set these as private environment variables instead.

## Initialize the database

1. In your selected Supabase project's SQL Editor, run `supabase/migrations/20260916000000_product_catalog.sql` once. It creates `quicksub_products`, `quicksub_content`, and the public `quicksub-products` image bucket. It does not modify newsletter data.
2. From the project folder run `npm run db:seed -- --upload-images`. This imports all 21 initial products and copies their current Pexels images to Supabase Storage. The image URLs in the database then point to Storage.
3. If you want to keep the current remote images instead, run `npm run db:seed` without the flag. Image URLs will still be saved in the database.
4. Run `npm run build`, then `npm start`. Open `http://localhost:4000`.

The importer preserves existing product IDs and store content; rerunning it does not overwrite your database edits. Imports run product-by-product and can be safely resumed. If you previously imported URL-only rows, the importer skips them: upload replacements through the Supabase Storage dashboard and update their `image_url` fields, or migrate them explicitly. Images have a 6 MB limit; no customer can upload through the website.

## Manage products

Use Supabase Table Editor:

- `price_bdt`: numeric starting price, with no currency symbol.
- `image_url`: public HTTPS image URL, including a Supabase Storage URL.
- `in_stock`: current stock status.
- `active`: hide a product by setting false.
- `sort_order`: display order.
- `data`: existing descriptive product fields. Keep `data.id` equal to the row ID. Server-side validation rejects malformed data and retains the last valid catalog.
- `quicksub_content`, row `store`: supported FAQs, policies and operational information used by the chatbot.

No public insert/update policies or admin dashboard are added. All database reads go through your server. RLS prevents anonymous/authenticated database access; the private service role handles server access and imports. The Storage bucket contains only public product images.

## Reliability and deployment

The server caches database reads for 60 seconds and shares concurrent requests. The page refreshes its catalog every 60 seconds while visible, so edits may take about two minutes to appear. Network failures keep the last working catalog or bundled fallback and mark the chatbot's data as potentially outdated. Nothing is uploaded automatically during builds or ordinary website visits.

Deploy the full Node project, including `server`, `dist` and private environment variables, using `npm start`. Static-only hosting cannot run the database/chat endpoints. Set `PUBLIC_ORIGIN` to your HTTPS website origin. Configure `TRUST_PROXY_HOPS` only for your actual proxy topology. Use Node 22.18+; install root dependencies with `npm ci` and backend dependencies with `npm ci --prefix server`.

Chat history remains temporary server memory; it is NOT saved as customer data in Supabase. Gemini processes customer messages according to Google's terms for your account/tier. Do not send credentials or payment secrets. Set provider billing limits. AI answers and precise package prices still need business review. Session/rate limits remain per server process.

## Test

`npm run test:chat`, `npm run typecheck`, `npm run lint`, `npm run build`, then `node scripts/check-chat.mjs`.

Automated tests simulate Gemini and Supabase; they do not prove live connectivity. After entering credentials and importing data, verify database edits appear at `/api/products`, try the support chat in English and Bangla, and confirm unavailable products are not offered for purchase.

Official references:
- https://ai.google.dev/gemini-api/docs/generate-content/structured-output
- https://supabase.com/docs/guides/api
- https://supabase.com/docs/guides/storage/uploads/standard-uploads
