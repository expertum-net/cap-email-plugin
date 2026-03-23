# Graph Email Demo App

Local demo app for testing the `@expertum/cap-email-plugin` with Microsoft Graph API via a BTP destination.

Based on the CAP bookshop sample. Creating an order sends a real email via Graph API.

## Prerequisites

- BTP subaccount with a Destination Service instance
- BTP destination pointing to `https://graph.microsoft.com` with OAuth2 client credentials
- Microsoft 365 sender mailbox

## Setup

1. Install dependencies:

   ```sh
   npm install
   ```

2. Copy the credentials template and fill in your BTP destination name:

   ```sh
   cp .cdsrc-private.json.sample .cdsrc-private.json
   ```

   Alternatively, use `cds bind` to bind to your BTP Destination Service instance.

3. Update `package.json`:
   - Set `cds.requires.email.email.from` to your M365 sender address
   - Set `cds.requires.auth.[development].users.alice.attr.email` to your recipient address

## Run

```sh
npm start
```

Then create an order via the API:

```sh
curl -X POST http://localhost:4004/odata/v4/order/Orders \
  -H "Content-Type: application/json" \
  -u alice: \
  -d '{"title": "Wuthering Heights", "quantity": 2, "book_ID": 201}'
```

Check your inbox for the order confirmation email.

## What happens

1. `POST /odata/v4/order/Orders` triggers entity INSERT
2. Plugin detects `@email.enabled: true` on Orders entity
3. `email-templates/Orders.html` is loaded and rendered with order data
4. Subject line `Order Confirmation: {{title}} (x{{quantity}})` is rendered
5. Email is dispatched via GraphMailService → Microsoft Graph API
6. Result logged to `EmailLog` (visible in the SQLite DB)
