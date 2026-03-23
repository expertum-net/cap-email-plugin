# Graph Email Demo App

Local demo app for testing the `@expertum/cap-email-plugin` with Microsoft Graph API via a BTP destination.

Based on the CAP bookshop sample. Creating an order sends a real email via Graph API.

## Prerequisites

- BTP subaccount with a Destination Service instance
- BTP destination (OAuth2ClientCredentials) pointing to `https://graph.microsoft.com`
  - Scope: `https://graph.microsoft.com/.default`
- Microsoft 365 sender mailbox with `Mail.Send` application permission
- Cloud Foundry CLI logged in (`cf login`)

## Setup

1. Install dependencies (run from repo root — uses npm workspaces):

   ```sh
   npm install
   ```

2. Update `test/graph-demo-app/package.json`:
   - Set `cds.requires.email.email.from` to your M365 sender address
   - Set `cds.requires.microsoft-graph.credentials.destination` to your BTP destination name
   - Set `cds.requires.auth.[development].users.alice.attr.email` to your recipient address

3. Bind to your BTP Destination Service instance:

   ```sh
   cd test/graph-demo-app
   cds bind -2 <YOUR_DESTINATION_SERVICE_INSTANCE>
   ```

## Run

```sh
cd test/graph-demo-app
npx cds-tsx watch --profile hybrid
```

Then create an order:

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
5. Email is dispatched via GraphMailService → BTP Destination Service → Microsoft Graph API
6. Result logged to `EmailLog` (visible in the SQLite DB)

## Troubleshooting

| Error                                                  | Fix                                                                 |
| ------------------------------------------------------ | ------------------------------------------------------------------- |
| `Could not find service binding of type 'destination'` | Run with `--profile hybrid` to activate `cds bind` credentials      |
| `The required field 'scope' is missing`                | Add scope `https://graph.microsoft.com/.default` to BTP destination |
| `client secret keys are expired`                       | Rotate the secret in Azure Portal for the app registration          |
| `@sap/cds was loaded from different locations`         | Run `npm install` from the repo root (workspaces hoist deps)        |
