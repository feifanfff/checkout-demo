# Change: Add checkout demo (card, iDEAL, wallets)

## Why
We need the Part 2 coding demo: a functional checkout page for iPhone case sales in HK and NL that keeps PCI scope low, supports Dutch iDEAL bank transfer, and offers a one-touch wallet experience for mobile-first shoppers.

## What Changes
- Add a responsive checkout page with product summary, palette, and payment method selection.
- Integrate Checkout.com Frames to capture and tokenize card data securely, then create payments server-side with the provided processing channel.
- Add iDEAL as a bank transfer option for EUR orders, handling redirect/return URLs and status polling.
- Add wallet support (Apple Pay / Google Pay where available) for one-touch mobile checkout.
- Provide minimal backend endpoints for payment creation and optional webhook stub for status updates, no database required.

## Impact
- Affected specs: checkout/payments (new capability)
- Affected code: frontend checkout UI, payment method components, backend payment endpoints, env configuration for Checkout.com keys/channel
