# Architecture Overview

`@expertum/cap-email-plugin` — annotation-driven email automation for SAP CAP entities.

## System Context

The plugin is installed as an npm dependency in a consumer CAP application. It has no opinion on database, deployment
target, or template files — those belong to the implementer.

```mermaid
C4Context
    title System Context — @expertum/cap-email-plugin

    Person(developer, "CAP Developer", "Annotates entities with @email, provides HTML templates")
    Person(endUser, "End User", "Triggers entity lifecycle events via the CAP application")

    System(plugin, "@expertum/cap-email-plugin", "Annotation-driven email automation for CDS entities")

    System_Ext(capApp, "Consumer CAP Application", "Installs the plugin, owns entities, templates, and deployment")
    System_Ext(btpDest, "BTP Destination Service", "OAuth2 token management for external APIs")
    System_Ext(graphApi, "Microsoft Graph API", "POST /users/{from}/sendMail")
    System_Ext(db, "Database", "SQLite / HANA — stores EmailLog")

    Rel(developer, capApp, "Adds @email annotations + templates")
    Rel(endUser, capApp, "INSERT / UPDATE entities")
    Rel(capApp, plugin, "npm dependency, @email annotations")
    Rel(plugin, btpDest, "Resolves destination via cds.connect.to()")
    Rel(plugin, graphApi, "Sends email via Graph API")
    Rel(plugin, db, "Writes EmailLog entries")
    Rel(btpDest, graphApi, "Proxies authenticated requests")
```

## Plugin Internals

```mermaid
flowchart TB
    subgraph entry ["Entry Point"]
        CP["cds-plugin.ts"]
    end

    subgraph core ["Core (lib/)"]
        PL["plugin.ts\nAnnotation discovery + delegation"]
        BASIC["basic.ts\nEmailService — base class"]
        GRAPH["graph-mail.ts\nGraphMailService — Graph API provider"]
        TE["template-engine.ts\nTemplate loading + rendering"]
    end

    subgraph shared ["Shared (lib/)"]
        TYPES["types.ts\nInterfaces + EMAIL_DEFAULTS"]
        CONST["constants.ts\nAll constants"]
    end

    subgraph data ["Data Layer"]
        CDS["db/email-log.cds\nEmailLog entity"]
        GEN["@cds-models/\nGenerated types (gitignored)"]
    end

    CP -->|"cds.once('served')"| PL
    PL -->|"emailService.registerHandlers()"| BASIC
    BASIC -->|"extends"| GRAPH
    BASIC --> TE
    BASIC --> TYPES
    BASIC --> CONST
    GRAPH --> TYPES
    GRAPH --> CONST
    PL --> TYPES
    PL --> CONST
    BASIC --> GEN
    GRAPH --> GEN
    GEN -.->|"generated from"| CDS

    style CP fill:#4a90d9,color:#fff
    style PL fill:#7b68ee,color:#fff
    style BASIC fill:#3cb371,color:#fff
    style GRAPH fill:#ff8c00,color:#fff
    style TE fill:#cd5c5c,color:#fff
```

## Service Kind Resolution

CAP resolves the correct service class based on the implementer's `cds.requires.email.kind` configuration.

```mermaid
flowchart LR
    subgraph kinds ["package.json — cds.requires.kinds"]
        K_BASIC["basic\nimpl: lib/basic"]
        K_GRAPH["graph\nimpl: lib/graph-mail"]
        K_FUTURE["future-provider\nimpl: lib/future-provider"]
    end

    subgraph config ["Implementer's package.json"]
        DEV["[development]\nkind: basic"]
        PROD["[production]\nkind: graph"]
    end

    subgraph runtime ["Runtime"]
        CONNECT["cds.connect.to('email')"]
    end

    DEV --> K_BASIC
    PROD --> K_GRAPH

    K_BASIC --> CONNECT
    K_GRAPH --> CONNECT
    K_FUTURE --> CONNECT

    CONNECT -->|"kind: basic"| I1["EmailService"]
    CONNECT -->|"kind: graph"| I2["GraphMailService"]
    CONNECT -->|"kind: future"| I3["FutureProvider"]

    style K_FUTURE stroke-dasharray: 5 5
    style I3 stroke-dasharray: 5 5
```

## Class Hierarchy

Follows the `@cap-js/attachments` base/subclass pattern: the base class provides default handler registration and shared
logic, subclasses override to add provider-specific behavior.

```mermaid
classDiagram
    direction TB

    class IEmailService {
        <<interface>>
        +registerHandlers(srv, entity, config) void
        +sendEmail(payload) Promise~void~
        +logEmail(entry) Promise~void~
    }

    class IGraphMailService {
        <<interface>>
        +buildGraphPayload(payload) GraphPayload
        +formatGraphRecipients(email) GraphRecipient[]
        +sendWithRetry(from, payload, attempt?) Promise~void~
    }

    class EmailService {
        +registerHandlers(srv, entity, config) void
        +resolveRecipient(config, data, req) string | null
        -resolveSubject(config, data) string
        -resolveEntityKey(entity, data) string
        +sendEmail(payload) Promise~void~
        +logEmail(entry) Promise~void~
    }

    class GraphMailService {
        -from: string
        -graphApi: cds.Service
        +registerHandlers(srv, entity, config) void
        +init() Promise~void~
        +sendEmail(payload) Promise~void~
        +buildGraphPayload(payload) GraphPayload
        +formatGraphRecipients(email) GraphRecipient[]
        +sendWithRetry(from, payload, attempt?) Promise~void~
    }

    IEmailService <|.. EmailService : implements
    IGraphMailService <|.. GraphMailService : implements
    IEmailService <|-- IGraphMailService : extends
    EmailService <|-- GraphMailService : extends
```

### Why subclasses override `registerHandlers()`

This follows the `@cap-js/attachments` pattern where S3 and Azure each override `registerUpdateHandlers()` to register
completely different event hooks on the ApplicationService. Each provider controls:

- **Which events** to listen to (e.g., a batch provider might skip per-entity handlers entirely)
- **What orchestration** to perform (e.g., skip template rendering for API-driven emails)
- **What additional hooks** to register (e.g., `before` handlers for validation, webhook callbacks)

The base class provides a sensible default. Subclasses override when they need different behavior.

## Boot Sequence

```mermaid
sequenceDiagram
    participant CDS as CAP Runtime
    participant CP as cds-plugin.ts
    participant PL as plugin.ts
    participant SRV as EmailService / GraphMailService
    participant APP as ApplicationService

    CDS->>CP: Load plugin
    Note over CP: cds.once("served", registerEmailHandlers)

    CDS->>CDS: Bootstrap all services
    CDS->>SRV: init()
    Note over SRV: GraphMailService validates credentials,<br/>connects to BTP destination

    CDS->>CP: "served" event fires
    CP->>PL: registerEmailHandlers()
    PL->>CDS: cds.connect.to("email")
    CDS-->>PL: Resolved service instance (basic or graph)

    loop Each ApplicationService
        PL->>PL: Iterate srv.entities
        loop Each entity
            PL->>PL: parseEmailAnnotation(entity)
            alt @email.enabled = true
                PL->>SRV: registerHandlers(srv, entity, config)
                SRV->>APP: srv.after("CREATE" / "UPDATE", handler)
            end
        end
    end
```

## Email Dispatch Flow

The full flow from entity event to email delivery and logging.

```mermaid
flowchart TD
    A["Entity INSERT / UPDATE"] --> B{{"@email.enabled?"}}
    B -->|No| Z["No action"]
    B -->|Yes| C["after handler fires"]

    C --> D["resolveRecipient()"]
    D --> E{{"Valid recipient?"}}
    E -->|No| F["Log warning, skip"]
    E -->|Yes| G["loadTemplate()"]

    G --> H{{"Template exists?"}}
    H -->|No| I["Throw: template not found"]
    H -->|Yes| J["renderTemplate() — {{placeholder}} substitution"]

    J --> K["resolveSubject()"]
    K --> L["resolveEntityKey()"]
    L --> M["this.sendEmail(payload)"]

    M --> N{{"Provider kind"}}

    N -->|basic| O["logEmail(status: sent)"]

    N -->|graph| P["buildGraphPayload()"]
    P --> Q["sendWithRetry()"]
    Q --> R{{"Success?"}}
    R -->|Yes| S["super.sendEmail() → logEmail(status: sent)"]
    R -->|Retryable 429/503/504| T{{"Attempts left?"}}
    T -->|Yes| U["Wait 2^n seconds"] --> Q
    T -->|No| V["logEmail(status: failed, error)"]
    R -->|Non-retryable| V

    I --> W{{"@email.rollback?"}}
    W -->|true| X["Throw → rollback transaction"]
    W -->|false| Y["Log error, continue"]
```

## Data Model

The plugin owns a single entity for email delivery tracking.

```mermaid
erDiagram
    EmailLog {
        UUID ID PK "cuid — auto-generated"
        Timestamp createdAt "managed"
        String createdBy "managed"
        Timestamp modifiedAt "managed"
        String modifiedBy "managed"
        String entityName "Source entity (e.g. Orders)"
        String entityKey "Entity primary key value(s)"
        String recipient "Email recipient address"
        String subject "Rendered subject line"
        String_enum status "sent | failed | pending"
        String error "Error message on failure"
    }
```

The relationship to consumer entities is intentionally **logical** (via `entityName` + `entityKey` strings) rather than
a CDS composition. The plugin doesn't know the consumer's entities at design time.

## Email Status Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Triggered : Entity INSERT / UPDATE

    Triggered --> Skipped : No valid recipient
    Triggered --> Sending : Recipient + template resolved

    state Sending {
        [*] --> BasicPath : kind = basic
        [*] --> GraphPath : kind = graph

        BasicPath --> Sent : logEmail(sent)

        GraphPath --> GraphAPI : POST /sendMail
        GraphAPI --> Sent : 2xx
        GraphAPI --> Retrying : 429 / 503 / 504
        Retrying --> GraphAPI : attempts remaining
        Retrying --> Failed : max retries exceeded
        GraphAPI --> Failed : non-retryable error
    }

    state Sent {
        [*] --> LoggedSent : EmailLog status = sent
    }

    state Failed {
        [*] --> LoggedFailed : EmailLog status = failed + error
    }

    Triggered --> ErrorState : Template not found / other error
    ErrorState --> RolledBack : @email.rollback = true
    ErrorState --> ErrorLogged : @email.rollback = false

    Skipped --> [*]
    LoggedSent --> [*]
    LoggedFailed --> [*]
    RolledBack --> [*]
    ErrorLogged --> [*]
```

## Annotation Defaults

All `@email` properties have sensible defaults. `@email.enabled: true` is the only required annotation.

| Property          | Default        | Description                                                    |
| ----------------- | -------------- | -------------------------------------------------------------- |
| `enabled`         | `false`        | Activate email automation for this entity                      |
| `template`        | `{EntityName}` | Template file name (resolved to `email-templates/{name}.html`) |
| `trigger`         | `["INSERT"]`   | Lifecycle events: `INSERT`, `UPDATE`                           |
| `condition`       | `undefined`    | Expression to evaluate before sending (not yet implemented)    |
| `toField`         | `undefined`    | Entity field containing the recipient email                    |
| `subject`         | `undefined`    | Subject line with `{{placeholder}}` support                    |
| `rollback`        | `false`        | Rollback transaction on email failure                          |
| `saveToSentItems` | `true`         | Save to sender's Sent Items (Graph provider)                   |

## File Reference

| File                     | Responsibility                                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `cds-plugin.ts`          | Entry point — `cds.once("served", registerEmailHandlers)`                                                          |
| `lib/plugin.ts`          | Annotation discovery (`parseEmailAnnotation`) + delegation                                                         |
| `lib/basic.ts`           | `EmailService` — base class with handler registration, recipient resolution, template orchestration, email logging |
| `lib/graph-mail.ts`      | `GraphMailService` — Microsoft Graph provider with retry logic                                                     |
| `lib/template-engine.ts` | Template loading from implementer's `email-templates/` directory + `{{placeholder}}` rendering                     |
| `lib/types.ts`           | All interfaces (`IEmailService`, `IGraphMailService`, `EmailPayload`, etc.) + `EMAIL_DEFAULTS`                     |
| `lib/constants.ts`       | All constants (annotation prefix, patterns, retry config, trigger-to-event mapping)                                |
| `db/email-log.cds`       | Plugin-owned `EmailLog` entity definition                                                                          |
