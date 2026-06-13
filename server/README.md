QuickSub backend

This small Express backend exposes two endpoints to keep your WhatsApp contact number out of the frontend code.

- GET /api/contact
  - Returns JSON: { whatsapp: "https://wa.me/..." }
  - Optional query `text` to prefill the WhatsApp message (URL-encoded or plain; server will encode).

- GET /buy
  - Redirects (302) to WhatsApp with the configured number and default message.
  - Optional query `text` to override the default message.

Run:

```bash
cd server
npm install
npm start
```

Notes:
- Configure the number in `server/config.json`. The file currently contains your number as provided and assumes country `880` (Bangladesh). If you want a different country code, update `country`.
- Frontend can call `/api/contact` or link to `/buy` on the same origin (or point to this server's URL in production).