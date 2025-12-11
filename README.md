# Checkout Demo (Part 2)

Checkout.com sandbox demo for selling iPhone cases in Hong Kong and the Netherlands. Includes secure card capture (Frames), iDEAL for EUR, and a wallet button (Google Pay test) for one-touch checkout. No database required.

## Setup

1. Copy `.env.example` to `.env` and fill sandbox keys:
   - `CHECKOUT_PUBLIC_KEY`
   - `CHECKOUT_SECRET_KEY`
   - `CHECKOUT_PROCESSING_CHANNEL`
   - Optional: `SUCCESS_URL`, `FAILURE_URL`, `PORT`, `HOST`
2. Install Node.js 18+.
3. Install dependencies:
   ```bash
   npm install
   ```
4. Run the server:
   ```bash
   npm start
   ```
5. Open `http://localhost:3000`.

## Flows
- Card: Frames tokenizes card data, backend creates payment via Checkout.com.
- iDEAL: Enabled for EUR (Netherlands). Backend returns redirect; success/failure returns to the app.
- Wallet: Google Pay test environment. If available, it tokenizes and sends to the backend payment endpoint.

## Notes
- Amounts are hard-coded (HKD 188.00, EUR 25.00) in minor units.
- Backend uses the sandbox Payments API and your processing channel. No data is persisted.
- Frames mounting notes:
  - Card fields use Frames-required class names (`card-number-frame`, `expiry-date-frame`, `cvv-frame`) and fixed height; scripts are lazy-loaded to avoid blockers.
  - If payment fields fail to render, check that `Frames` is defined, the containers exist, and no ad/privacy blocker is blocking `cdn.checkout.com`.
- Wallet test notes:
  - Google Pay runs in TEST mode. If availability check is blocked, allow `pay.google.com` and `play.google.com` in your ad/privacy blocker or try an incognito window.
