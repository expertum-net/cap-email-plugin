# Configuration Reference

All plugin configuration lives in the implementer's `package.json` under the `cds` section. There are two configuration
surfaces: **service configuration** (which provider to use and how it connects) and **entity annotations** (which
entities trigger emails and how).

## Service Configuration

Configure the email service in `cds.requires.email`:

```jsonc
// package.json
{
  "cds": {
    "requires": {
      "email": {
        "kind": "graph",
        "destination": "microsoft-graph",
        "retryAttempts": 3,
      },
    },
  },
}
```

### Provider Selection

| Property | Type                   | Default   | Description                                                                                                             |
| -------- | ---------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------- |
| `kind`   | `"basic"` \| `"graph"` | `"basic"` | Selects the email provider. `basic` logs emails to the database without sending. `graph` sends via Microsoft Graph API. |

### Graph Provider Options

These options apply when `kind` is `"graph"`. All are set under `cds.requires.email`.

| Property        | Type     | Default | Required | Description                                                                                                                                                                                                                                        |
| --------------- | -------- | ------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `destination`   | `string` | —       | Yes      | Name of the BTP destination that points to Microsoft Graph. Passed to `cds.connect.to()`.                                                                                                                                                          |
| `email.from`    | `string` | —       | No       | Dev-time override for the sender address. In production, the sender is read from the BTP destination additional property `mail.from`. This local override takes precedence when set (see [Sender Address Resolution](#sender-address-resolution)). |
| `retryAttempts` | `number` | `3`     | No       | Max retry attempts for transient Graph API failures. Retries apply to HTTP status codes `429`, `503`, and `504` with exponential backoff (`2^attempt × 1000ms`). Set to `0` to disable retrying.                                                   |

Missing required options cause the service to throw at startup with a descriptive error message.

### Sender Address Resolution

The sender address (`from`) is resolved in the following order:

1. `cds.requires.email.email.from` — local override, useful for development
2. BTP destination additional property `mail.from` — production configuration
3. Throw if neither is set

This allows production deployments to manage the sender address alongside the destination config in BTP cockpit, while
local development can use a simple `package.json` override without BTP connectivity.

> **Note:** BTP destination resolution is tracked in [#50](https://github.com/MVansteenhuyse/cap-email/issues/50) and
> not yet implemented. Currently only `email.from` is supported.

### BTP Destination

The Graph provider connects to Microsoft Graph through a BTP destination. This destination must be registered separately
in `cds.requires`:

```jsonc
{
  "cds": {
    "requires": {
      "microsoft-graph": {
        "kind": "rest",
        "credentials": {
          "destination": "<BTP_DESTINATION_NAME>",
        },
      },
    },
  },
}
```

The destination name under `cds.requires` must match the `destination` value in the email config.

The BTP destination should include a `mail.from` **Additional Property** with the sender email address (valid M365
mailbox). See [Graph Demo App](graph-demo-app.md) for the full BTP destination setup including Azure AD app
registration.

### Basic Provider Options

The basic provider has no configuration options. It logs all emails to the `EmailLog` entity without sending them,
making it useful for development and testing.

```jsonc
{
  "cds": {
    "requires": {
      "email": {
        "kind": "basic",
      },
    },
  },
}
```

## Entity Annotations

Annotate CDS entities with `@email` to trigger emails on lifecycle events. All annotation properties have defaults —
`@email.enabled: true` is the minimum required.

```cds
entity Orders : cuid, managed {
  title    : String;
  quantity : Integer;
}

annotate Orders with @email.enabled: true;
```

### Annotation Properties

| Annotation               | Type       | Default        | Description                                                                                                                                                                  |
| ------------------------ | ---------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@email.enabled`         | `Boolean`  | `false`        | Enables email dispatch for this entity.                                                                                                                                      |
| `@email.template`        | `String`   | `{EntityName}` | Template filename (without extension). Resolved from the `email-templates/` directory. Defaults to the entity's short name (e.g., `Orders` → `email-templates/Orders.html`). |
| `@email.trigger`         | `String[]` | `["INSERT"]`   | Lifecycle events that trigger email dispatch. Valid values: `INSERT`, `UPDATE`.                                                                                              |
| `@email.subject`         | `String`   | —              | Email subject line. Supports `{{placeholder}}` substitution with entity data.                                                                                                |
| `@email.recipient`       | `String`   | —              | Static recipient email address. Mutually exclusive with `recipientField`.                                                                                                    |
| `@email.recipientField`  | `String`   | —              | Entity field name containing the recipient email. Mutually exclusive with `recipient`.                                                                                       |
| `@email.rollback`        | `Boolean`  | `false`        | Whether to roll back the entity transaction when email dispatch fails.                                                                                                       |
| `@email.saveToSentItems` | `Boolean`  | `true`         | Whether to save the sent email in the sender's M365 Sent Items folder (Graph provider only).                                                                                 |

### Recipient Resolution Order

When neither `recipient` nor `recipientField` is set, the plugin resolves the recipient from the request context:

1. `req.user.id` — if it contains a valid email address
2. `req.user.attr.email` — fallback from XSUAA user attributes

### Annotation Syntax

Annotations support both flat and object syntax. Flat annotations override object annotations for the same property.

```cds
// Flat syntax
annotate Orders with @email.enabled: true;
annotate Orders with @email.trigger: ['INSERT', 'UPDATE'];
annotate Orders with @email.subject: 'New order: {{title}}';

// Object syntax
annotate Orders with @(email: {
  enabled: true,
  trigger: ['INSERT', 'UPDATE'],
  subject: 'New order: {{title}}'
});
```

## Logging

The plugin registers three log channels via `cds.log`. Configure their levels in `cds.log.levels`:

```jsonc
{
  "cds": {
    "log": {
      "levels": {
        "email": "info",
        "email:graph": "debug",
        "email-template": "info",
      },
    },
  },
}
```

| Channel          | Source                   | Description                                                 |
| ---------------- | ------------------------ | ----------------------------------------------------------- |
| `email`          | `lib/basic.ts`           | Base service: email log entries, send status                |
| `email:graph`    | `lib/graph-mail.ts`      | Graph provider: init, handler registration, retries, errors |
| `email-template` | `lib/template-engine.ts` | Template loading and rendering                              |

## Templates

Email templates live in the implementer's project under `email-templates/` (relative to `cds.root`). Templates are HTML
files with `{{placeholder}}` syntax for entity data substitution.

```
project-root/
└── email-templates/
    ├── Orders.html        ← used by default for entity "Orders"
    └── CustomName.html    ← used when @email.template: 'CustomName'
```

Placeholders are replaced with the corresponding entity field values. Missing fields resolve to an empty string.

## Full Example

```jsonc
// package.json
{
  "cds": {
    "log": {
      "levels": {
        "email": "info",
        "email:graph": "debug",
      },
    },
    "requires": {
      "email": {
        "kind": "graph",
        "destination": "microsoft-graph",
        // Optional: dev-time override; production uses BTP destination mail.from
        "email": {
          "from": "noreply@example.com",
        },
        "retryAttempts": 5,
      },
      "microsoft-graph": {
        "kind": "rest",
        "credentials": {
          "destination": "my-graph-destination",
        },
      },
    },
  },
}
```

```cds
entity Orders : cuid, managed {
  title         : String;
  quantity      : Integer;
  customerEmail : String;
}

annotate Orders with @(email: {
  enabled: true,
  trigger: ['INSERT'],
  template: 'OrderConfirmation',
  subject: 'Order received: {{title}}',
  recipientField: 'customerEmail',
  rollback: false,
  saveToSentItems: true
});
```
