# @expertum/cap-email-plugin

> **Status:** POC

A SAP CAP plugin that provides annotation-driven email automation for CAP entities. Emails are triggered on entity
lifecycle events (INSERT, UPDATE) and dispatched via configurable email clients.

## Features

- **Annotation-based configuration** — no custom handler code required
- **Automatic trigger handling** — emails sent on entity INSERT/UPDATE
- **Template support** — HTML templates with `{{placeholder}}` substitution
- **BTP integration** — leverages Destination Service for OAuth2 authentication
- **Extensible architecture** — swappable email clients via `cds.requires.kinds`
- **Email logging** — plugin-owned log entity tracks send status and errors

## Prerequisites

- SAP CAP (`@sap/cds` >= 9)
- Node.js >= 22 (required for ESM + `@cap-js/cds-test` compatibility)
- BTP Destination Service (for Microsoft Graph provider)

## Installation

```bash
npm install @expertum/cap-email-plugin
```

## Quick Start

### 1. Annotate your entity

```cds
@email.enabled: true
entity Orders {
  key ID     : UUID;
  orderNumber : String;
  status      : String;
  contactEmail: String;
}
```

That's it for a minimal setup. The plugin defaults to:

- Template: `Orders.html` (convention-based on entity name)
- Trigger: `INSERT`
- Recipient: `req.user.email` (from XSUAA context)

### 2. Create a template

Place an HTML template in your project:

```
email-templates/Orders.html
```

```html
<h1>Order Confirmation</h1>
<p>Your order {{orderNumber}} has been received.</p>
```

Placeholders use `{{fieldName}}` syntax, where `fieldName` matches a field on the annotated entity. When an email is
triggered, the plugin replaces each placeholder with the corresponding value from the entity record. Missing fields are
replaced with an empty string.

### 3. Configure the email provider

In your application's `package.json`:

```jsonc
{
  "cds": {
    "requires": {
      "email": {
        "kind": "graph",
        "email": {
          "from": "noreply@example.com",
        },
      },
    },
  },
}
```

The `graph` kind uses Microsoft Graph API via a BTP destination. Configure the destination with OAuth2ClientCredentials
in your BTP subaccount.

## Annotation Reference

All `@email` properties have sensible defaults. Only specify what you need to override.

| Property    | Type    | Default        | Description                                                          |
| ----------- | ------- | -------------- | -------------------------------------------------------------------- |
| `enabled`   | Boolean | `false`        | Activates email for the entity                                       |
| `template`  | String  | `{EntityName}` | Template file name (without extension)                               |
| `trigger`   | Array   | `['INSERT']`   | Lifecycle events: `INSERT`, `UPDATE`                                 |
| `condition` | String  | _(none)_       | Optional CDS expression for conditional sending                      |
| `toField`   | String  | _(none)_       | Entity field containing recipient email (overrides `req.user.email`) |
| `subject`   | String  | _(none)_       | Subject line (supports `{{placeholder}}` syntax)                     |
| `rollback`  | Boolean | `false`        | If `true`, roll back the originating transaction on email failure    |

### Full annotation example

```cds
@email: {
  enabled: true,
  template: 'order-confirmation',
  trigger: ['INSERT', 'UPDATE'],
  condition: 'status = ''APPROVED''',
  toField: 'contactEmail',
  subject: 'Order {{orderNumber}} confirmed',
  rollback: true
}
entity Orders { ... }
```

## Email Providers

Providers are registered as CAP service kinds. The plugin ships with:

| Kind    | Description                                                            |
| ------- | ---------------------------------------------------------------------- |
| `basic` | Base email service class                                               |
| `graph` | Microsoft Graph API via `cds.connect.to()` and BTP Destination Service |

Select your provider in `package.json` under `cds.requires.email.kind`.

## How It Works

1. Entity INSERT/UPDATE triggers an `after` handler
2. Plugin evaluates `@email` annotations and optional conditions
3. Template is loaded from your project and rendered with entity data
4. Recipient resolved from `req.user.email` or `@email.toField`
5. Email dispatched asynchronously via the configured provider
6. Status logged; failures recorded in the plugin-owned log entity

Emails are sent **after** successful operations only. Failed transactions never trigger emails. By default, email
failures do not roll back the originating transaction, but this is configurable via `@email.rollback`.

## Plugin Architecture

```
cds-plugin.ts          → Entry point; registers handlers
lib/plugin.ts          → Core logic; attaches after handlers for @email entities
lib/basic.ts           → Base EmailService class (extends cds.Service)
lib/graph-mail.ts      → Microsoft Graph implementation
lib/template-engine.ts → Template loading and {{placeholder}} rendering
```

## Development

```bash
npm install
npm test
```

### Test App

A minimal CAP application lives at `test/test-app/` for testing the plugin end-to-end. It depends on the plugin via
`"file:../../."` so changes are picked up immediately without publishing.

```
test/test-app/
  package.json               ← plugin dependency + basic kind config
  db/schema.cds              ← Orders (minimal), Tickets (full), Products (control)
  srv/services.cds           ← TestService exposing all entities
  email-templates/           ← templates for annotated entities
```

To run the test app standalone:

```bash
cd test/test-app
npm install
npx cds serve
```

### Tech Stack

- TypeScript (ESM)
- Node.js >= 22
- oxlint + Prettier
- `@cap-js/cds-test` + `@types/jest` (jest-style assertions)
- Conventional Commits (`feat:`, `fix:`, `chore:`, etc.)

## License

[MIT](LICENSE)
