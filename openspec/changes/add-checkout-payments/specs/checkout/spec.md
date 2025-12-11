## ADDED Requirements
### Requirement: Secure card payments via Checkout.com
The checkout SHALL capture card details using Checkout.com Frames (or Elements) and create payments server-side with the provided sandbox processing channel for HK and NL shoppers.

#### Scenario: Card payment authorized
- **WHEN** a shopper selects card, enters valid details, and submits an order for HK or NL
- **THEN** card data is tokenized client-side via Checkout.com hosted fields and only the token is sent to the backend
- **THEN** the backend creates a payment for the order total in HKD or EUR with the configured processing channel and returns authorization or 3DS instructions

### Requirement: iDEAL bank transfer support
The checkout SHALL offer iDEAL for EUR-denominated orders and guide shoppers through the redirect flow without storing state in a database.

#### Scenario: iDEAL payment completed
- **WHEN** a shopper in NL selects iDEAL and submits the EUR order
- **THEN** the backend creates an iDEAL payment and responds with success and cancel redirect URLs
- **THEN** the shopper completes the redirect and the checkout shows a paid confirmation once the payment status is authorized

### Requirement: Mobile wallet one-touch checkout
The checkout SHALL surface Apple Pay or Google Pay when the shopper's device/browser supports it to enable one-touch payment.

#### Scenario: Wallet payment succeeds
- **WHEN** a supported wallet is available and the shopper chooses it
- **THEN** the wallet sheet displays the order total and merchant details and returns a tokenized payment payload
- **THEN** the backend creates the payment using the wallet payload and the shopper sees a success state after authorization

### Requirement: Payment status feedback
The checkout SHALL present clear success, pending, or decline states for every payment method.

#### Scenario: Decline surfaced to shopper
- **WHEN** the payment API responds with a decline or unrecoverable failure
- **THEN** the checkout shows an error with retry guidance and leaves the cart intact
