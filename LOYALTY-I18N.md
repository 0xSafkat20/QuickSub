# Customer loyalty, referrals, and Bangla support

QuickSub now includes a verified-purchase loyalty program, customer referral links, and a Bangla/English storefront.

## Production activation

1. Apply `supabase/migrations/20261003000000_loyalty_referrals_locale.sql` to the production Supabase project.
2. Set `CRON_SECRET` in the production environment to a long random value. Vercel calls `/api/jobs/loyalty` daily; that route processes referral rewards after the configured waiting period.
3. Deploy the application. Existing customers and orders remain compatible because all new columns have safe defaults.
4. Sign in as the owner, open **Admin → Rewards**, review the defaults, and save the policy you want to use.

Do not expose the Supabase service-role key or `CRON_SECRET` in any variable whose name begins with `VITE_`.

## Default reward policy

- 1 point for every ৳10 on a paid, delivered order.
- Each point is worth ৳0.50.
- Redemption starts at 100 points and is capped at 20% of an order.
- The referrer receives 100 points and the referred customer receives 50 points.
- Referral rewards wait 7 days after the referred customer's first eligible purchase.
- A referrer can receive rewards for up to 10 referrals per calendar month.

Only the server and database calculate balances and discounts. The browser never decides how many points a customer owns. Refunds reverse earned points and completed referral rewards; cancelling an unpaid order returns redeemed points.

## Customer experience

- A signed-in customer sees their balance, point history, referral code, referral link, WhatsApp share action, and referral status under **My account**.
- A referral link uses `?ref=CODE`. The code is saved locally until signup and is rejected for self-referrals or invalid accounts.
- Eligible points can be applied during checkout. The receipt records the original subtotal, point discount, points redeemed, and final total.
- The language selector appears in the storefront navigation and account profile. The preference is saved in the browser and in the customer profile.
- Bangla pages set the document language, localized SEO metadata, canonical URL, and `hreflang` alternatives. Customer operational pages use localized dates, numbers, and BDT prices.

Product names and merchant-authored descriptions remain exactly as entered in the catalog, so brand names and delivery instructions are never machine-translated. The admin workspace remains English to keep operational terminology consistent.

## Admin controls

The **Rewards** section is owner-only. It provides program totals, configurable earning and referral rules, manual balance adjustments with a required reason, recent point transactions, and referral status. Staff accounts cannot access or change loyalty policy.

## Verification

Run:

```bash
npm run verify
npm run check:loyalty-language
```

The integration suite covers referral validation, verified-order earning, delayed referral processing, point redemption, cancellation restoration, refund reversal, locale persistence, owner permissions, staff denial, and cron authentication. The browser check validates the customer rewards panel, Bangla UI and SEO tags, and the checkout discount flow.
