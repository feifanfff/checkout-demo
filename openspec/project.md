# Project Context

## Purpose
Build a demo checkout experience for selling iPhone cases in Hong Kong and the Netherlands. The page must capture card details securely to stay PCI compliant, support the Dutch bank transfer method iDEAL, and offer a mobile-friendly one-touch wallet option. The deliverable should let a tester complete payments end-to-end in the Checkout.com sandbox.

## Tech Stack
- Frontend: Static HTML/CSS/JavaScript with the provided palette (`#323416`, `#8C9E6E`, `#FFFFFD`) and mobile-first layout.
- Payments UI: Checkout.com Frames (or Elements) for secure card data capture; Checkout.com Wallets for Apple Pay / Google Pay where available.
- Backend: Lightweight Node.js (Express) service to create payments with the Checkout.com Payments API.
- Tooling: npm scripts, fetch-based API calls, optional Postman collection for manual verification.

## Project Conventions

### Code Style
- JavaScript/TypeScript with async/await, semicolons, and 2-space indentation.
- Keep UI logic small and readable; prefer descriptive function names over comments.
- Environment variables for secrets (`CHECKOUT_SECRET_KEY`, `CHECKOUT_PUBLIC_KEY`, `CHECKOUT_PROCESSING_CHANNEL`); never hard-code secrets in the frontend.

### Architecture Patterns
- Frontend served as static assets; backend exposes minimal endpoints for payment intents/captures and webhook handling.
- Payment flows rely on tokenization from Checkout.com components; server-side handles payment creation using tokens to avoid PCI scope.
- Keep features isolated: one module per payment method (cards, iDEAL, wallets).

### Testing Strategy
- Manual sandbox runs per payment method (card, iDEAL, wallet) with happy-path and decline-path scenarios.
- Lightweight integration checks via Postman collection against local backend.
- Add focused unit tests only where logic grows (e.g., payload builders, validation helpers).

### Git Workflow
- Main branch is stable; feature branches use `feature/<change-id>` or `chore/<task>`.
- Conventional commits preferred (`feat:`, `fix:`, `chore:`, `docs:`).
- Proposals/changes follow the OpenSpec workflow before implementation.

## Domain Context
- Products: iPhone cases, sold in HK and NL; cart can be hard-coded for the demo.
- Currencies: HKD for Hong Kong; EUR for Netherlands/iDEAL.
- Majority of traffic is mobile; UX should minimize friction (wallets / one-touch).
- Compliance: PCI handled by Checkout.com hosted fields/tokenization.

## Important Constraints
- No database required; keep state client-side or in-memory.
- Use Checkout.com sandbox keys and processing channel provided in the brief.
- Avoid storing or logging raw card data; rely on tokens only.
- Keep UI responsive and accessible; optimize for mobile-first viewport.

## External Dependencies
- Checkout.com Payments API, Frames/Elements, Wallets (Apple Pay / Google Pay), and iDEAL support.
- Postman collection from the brief for API validation during investigation tasks.
