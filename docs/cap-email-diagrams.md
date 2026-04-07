# cap-email Plugin - Technical Diagrams

## 1. C4 Context Diagram

```mermaid
C4Context
    title System Context Diagram - @expertum/cap-email-plugin

    Person(implementer, "CAP Application Developer", "Builds SAP CAP applications that require automated email sending")
    Person(endUser, "End User", "Triggers entity lifecycle events via the CAP application")

    System(capEmailPlugin, "@expertum/cap-email-plugin", "CAP plugin providing annotation-driven email automation for CDS entities")

    System_Ext(capApp, "Consumer CAP Application", "SAP CAP application that installs the plugin as a dependency")
    System_Ext(btpDestService, "BTP Destination Service", "Manages OAuth2 tokens and HTTP destinations for external APIs")
    System_Ext(graphApi, "Microsoft Graph API", "Sends emails via /users/{id}/sendMail endpoint")
    System_Ext(sqliteHana, "Database (SQLite / HANA)", "Stores application data and plugin-owned EmailLog table")

    Rel(implementer, capApp, "Annotates entities with @email, provides templates")
    Rel(endUser, capApp, "Creates/updates entities via OData/REST")
    Rel(capApp, capEmailPlugin, "Installs as npm dependency, uses @email annotations")
    Rel(capEmailPlugin, btpDestService, "Resolves destination credentials via cds.connect.to()")
    Rel(capEmailPlugin, graphApi, "POST /users/{from}/sendMail")
    Rel(capEmailPlugin, sqliteHana, "INSERT into EmailLog")
    Rel(btpDestService, graphApi, "Proxies authenticated requests")

    UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="1")
```

## 2. C4 Container Diagram

```mermaid
C4Container
    title Container Diagram - @expertum/cap-email-plugin Internals

    Person(endUser, "End User", "Triggers entity lifecycle events")

    System_Boundary(plugin, "@expertum/cap-email-plugin") {
        Container(cdsPlugin, "cds-plugin.ts", "TypeScript/ESM", "Plugin entry point. Hooks into cds 'served' event to trigger handler registration")
        Container(pluginModule, "lib/plugin.ts", "TypeScript/ESM", "Iterates ApplicationServices, parses @email annotations, registers after handlers via EmailService")
        Container(basicService, "lib/basic.ts", "TypeScript/ESM", "Base EmailService extending cds.Service. Handles recipient resolution, template rendering, email logging")
        Container(graphService, "lib/graph-mail.ts", "TypeScript/ESM", "GraphMailService extending EmailService. Sends emails via Microsoft Graph API with retry logic")
        Container(templateEngine, "lib/template-engine.ts", "TypeScript/ESM", "Loads HTML templates from implementer's project, renders {{placeholder}} substitution")
        Container(types, "lib/types.ts", "TypeScript/ESM", "Interfaces, types, and EMAIL_DEFAULTS for annotation config and payloads")
        Container(condition, "lib/condition.ts", "TypeScript/ESM", "CDS condition parsing (cds.parse.expr) and runtime evaluation against entity data")
        Container(entities, "lib/entities.ts", "TypeScript/ESM", "Typed entity access for plugin-owned CDS entities with runtime enum resolution")
        Container(constants, "lib/constants.ts", "TypeScript/ESM", "All constants: patterns, annotation prefix, retry config, trigger mappings")
        ContainerDb(emailLogCds, "db/email-log.cds", "CDS", "Plugin-owned EmailLog entity (cuid, managed) tracking send status, errors")
    }

    System_Ext(capRuntime, "SAP CAP Runtime (@sap/cds)", "Service framework, CDS model, event system")
    System_Ext(graphApi, "Microsoft Graph API", "Email sending endpoint")
    ContainerDb(db, "Database", "SQLite / HANA", "Stores EmailLog records")

    Rel(endUser, capRuntime, "INSERT/UPDATE entities")
    Rel(capRuntime, cdsPlugin, "Fires 'served' event")
    Rel(cdsPlugin, pluginModule, "Calls registerEmailHandlers()")
    Rel(pluginModule, basicService, "Calls registerHandlers() on EmailService")
    Rel(basicService, templateEngine, "loadTemplate() / renderTemplate()")
    Rel(basicService, condition, "evaluateCondition()")
    Rel(basicService, entities, "emailEntities()")
    Rel(pluginModule, condition, "validateCondition()")
    Rel(basicService, db, "INSERT into EmailLog")
    Rel(graphService, graphApi, "POST /users/{from}/sendMail")
    Rel(graphService, basicService, "Extends, calls super.sendEmail()")
    Rel(pluginModule, types, "Uses EmailAnnotationConfig, EMAIL_DEFAULTS")
    Rel(pluginModule, constants, "Uses ANNOTATION_PREFIX")
    Rel(basicService, constants, "Uses TRIGGER_TO_EVENT, EMAIL_PATTERN")
    Rel(graphService, constants, "Uses DEFAULT_RETRY_ATTEMPTS, RETRYABLE_STATUS_CODES")

    UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="1")
```

## 3. Detailed Class Diagram (UML)

```mermaid
classDiagram
    direction TB

    class `cds.Service` {
        <<CAP Framework>>
        +options: object
        +init(): Promise~void~
        +after(event, entity, handler): void
    }

    class IEmailService {
        <<interface>>
        +registerHandlers(srv, entity, config): void
        +sendEmail(payload: EmailPayload): Promise~void~
        +logEmail(entry: EmailLog): Promise~void~
    }

    class IGraphMailService {
        <<interface>>
        +buildGraphPayload(payload: EmailPayload): GraphPayload
        +formatGraphRecipients(email: string): GraphRecipient[]
        +sendWithRetry(from, payload, attempt?): Promise~void~
    }

    class EmailService {
        -LOG: cds.log
        +registerHandlers(srv: ApplicationService, entity: entity, config: EmailAnnotationConfig): void
        +resolveRecipient(config, data, req): string | null
        -resolveSubject(config, data): string
        -resolveEntityKey(entity, data): string
        +sendEmail(payload: EmailPayload): Promise~void~
        +logEmail(entry: EmailLog): Promise~void~
    }

    class GraphMailService {
        +options: GraphMailOptions
        -from: string
        -graphApi: cds.Service
        +init(): Promise~void~
        +sendEmail(payload: EmailPayload): Promise~void~
        +buildGraphPayload(payload: EmailPayload): GraphPayload
        +formatGraphRecipients(email: string): GraphRecipient[]
        +sendWithRetry(from, payload, attempt?): Promise~void~
    }

    class EmailAnnotationConfig {
        <<interface>>
        +enabled: boolean
        +template: string
        +trigger: string[]
        +condition: string | undefined
        +recipient: string | undefined
        +recipientField: string | undefined
        +subject: string | undefined
        +rollback: boolean
        +saveToSentItems: boolean
    }

    class EmailPayload {
        <<interface>>
        +from: string
        +to: string
        +subject: string
        +body: string
        +entityName: string
        +entityKey: string
        +saveToSentItems: boolean
    }

    class GraphPayload {
        <<interface>>
        +message: GraphMessage
        +saveToSentItems: boolean
    }

    class GraphRecipient {
        <<interface>>
        +emailAddress: ~address: string~
    }

    class GraphMailOptions {
        <<interface>>
        +credentials: Record~string, unknown~
        +destination: string
        +email: ~from: string~
        +retryAttempts?: number
    }

    class EmailLog {
        <<CDS Entity>>
        +ID: UUID
        +createdAt: Timestamp
        +createdBy: String
        +modifiedAt: Timestamp
        +modifiedBy: String
        +entityName: String
        +entityKey: String
        +recipient: String
        +subject: String
        +status: enum~sent, failed, pending~
        +error: String
    }

    class TemplateEngine {
        <<module>>
        +resolveTemplatePath(templateName): string
        +loadTemplate(templateName): Promise~string~
        +renderTemplate(template, data): string
    }

    class Plugin {
        <<module>>
        +parseEmailAnnotation(entity): EmailAnnotationConfig | null
        +registerEmailHandlers(): Promise~void~
    }

    `cds.Service` <|-- EmailService : extends
    EmailService <|-- GraphMailService : extends
    IEmailService <|.. EmailService : implements
    IGraphMailService <|.. GraphMailService : implements
    IEmailService <|-- IGraphMailService : extends

    EmailService ..> EmailPayload : uses
    EmailService ..> EmailAnnotationConfig : uses
    EmailService ..> EmailLog : writes to
    EmailService ..> TemplateEngine : calls

    GraphMailService ..> GraphPayload : builds
    GraphMailService ..> GraphRecipient : creates
    GraphMailService ..> GraphMailOptions : configured by

    Plugin ..> EmailAnnotationConfig : parses into
    Plugin ..> IEmailService : connects to via cds.connect.to()
```

## 4. Core Sequence Diagram: Entity INSERT Triggering Email (Basic Provider)

```mermaid
sequenceDiagram
    autonumber
    participant User as End User
    participant CAP as CAP Runtime
    participant App as ApplicationService
    participant Plugin as lib/plugin.ts
    participant ES as EmailService (basic)
    participant TE as TemplateEngine
    participant DB as Database (EmailLog)

    Note over CAP: Application startup
    CAP->>Plugin: cds.once("served") fires
    Plugin->>CAP: cds.connect.to("email")
    CAP-->>Plugin: EmailService instance

    loop For each ApplicationService
        Plugin->>App: Iterate srv.entities
        loop For each entity
            Plugin->>Plugin: parseEmailAnnotation(entity)
            alt @email.enabled = true
                Plugin->>ES: registerHandlers(srv, entity, config)
                ES->>App: srv.after("CREATE", entity.name, handler)
                Note over ES: Handler registered
            else No @email annotation
                Note over Plugin: Skip entity
            end
        end
    end

    Note over User: Runtime — Entity INSERT
    User->>CAP: POST /odata/v4/test/Orders
    CAP->>App: Process CREATE event
    App->>DB: INSERT entity data
    App-->>ES: after("CREATE") handler fires

    ES->>ES: resolveRecipient(config, data, req)
    alt static recipient configured
        ES->>ES: Use config.recipient
    else recipientField specified
        ES->>ES: Read data[config.recipientField]
    else No recipient/recipientField
        alt req.user.id matches email pattern
            ES->>ES: Use req.user.id
        else
            ES->>ES: Use req.user.attr.email
        end
    end

    ES->>TE: loadTemplate(config.template)
    TE->>TE: resolveTemplatePath(templateName)
    TE-->>ES: HTML template content

    ES->>TE: renderTemplate(template, data)
    TE-->>ES: Rendered HTML body

    ES->>ES: resolveSubject(config, data)
    ES->>ES: resolveEntityKey(entity, data)

    ES->>ES: sendEmail(payload)
    ES->>DB: INSERT into EmailLog (status: sent)
    DB-->>ES: OK

    ES-->>App: Handler complete
    App-->>CAP: Response
    CAP-->>User: 201 Created
```

## 5. Core Sequence Diagram: Graph Mail Provider with Retry

```mermaid
sequenceDiagram
    autonumber
    participant GMS as GraphMailService
    participant Base as EmailService (super)
    participant Graph as Microsoft Graph API
    participant DB as Database (EmailLog)

    Note over GMS: init() called during service startup
    GMS->>GMS: Validate credentials exist
    GMS->>GMS: Validate email.from configured
    GMS->>GMS: Validate destination configured
    GMS->>GMS: cds.connect.to(destination)
    GMS->>Base: super.init()

    Note over GMS: sendEmail() called from after handler
    GMS->>GMS: buildGraphPayload(payload)
    GMS->>GMS: formatGraphRecipients(payload.to)

    GMS->>GMS: sendWithRetry(from, graphPayload, attempt=0)
    GMS->>Graph: POST /users/{from}/sendMail

    alt Success (2xx)
        Graph-->>GMS: 200 OK
        GMS->>Base: super.sendEmail(payload)
        Base->>DB: INSERT EmailLog (status: sent)
    else Retryable error (429, 503, 504) & attempts remaining
        Graph-->>GMS: 429 Too Many Requests
        GMS->>GMS: Wait 2^attempt * 1000ms
        GMS->>GMS: sendWithRetry(from, payload, attempt+1)
        GMS->>Graph: POST /users/{from}/sendMail (retry)
        Graph-->>GMS: 200 OK
        GMS->>Base: super.sendEmail(payload)
        Base->>DB: INSERT EmailLog (status: sent)
    else Non-retryable error or max retries exceeded
        Graph-->>GMS: 500 / max retries hit
        GMS->>DB: INSERT EmailLog (status: failed, error: message)
        Note over GMS: Error logged, does NOT call super.sendEmail()
    end
```

## 6. Core Sequence Diagram: Annotation Parsing Flow

```mermaid
sequenceDiagram
    autonumber
    participant Plugin as parseEmailAnnotation()
    participant Entity as CDS Entity Definition
    participant Defaults as EMAIL_DEFAULTS
    participant Config as EmailAnnotationConfig

    Plugin->>Entity: Read entity["@email"] (object annotation)
    Plugin->>Entity: Read entity["@email.enabled"] (flat annotation)

    alt Object annotation has enabled
        Plugin->>Plugin: enabled = objectAnnotation.enabled
    else Flat annotation has enabled
        Plugin->>Plugin: enabled = flatEnabled
    else Neither present
        Plugin->>Defaults: enabled = EMAIL_DEFAULTS.enabled (false)
    end

    alt enabled = false
        Plugin-->>Plugin: return null (skip entity)
    end

    Plugin->>Entity: Extract short entity name from entity.name
    Note over Plugin: "test.email.Orders" -> "Orders"

    loop For each key in EMAIL_DEFAULTS
        Plugin->>Entity: Read entity["@email.{key}"] (flat values)
        alt Value defined
            Plugin->>Config: flat[key] = value
        end
    end

    Plugin->>Plugin: Merge: {...DEFAULTS, ...objectAnnotation, ...flat}
    Plugin->>Plugin: Resolve template name (use entity name if default)
    Plugin-->>Plugin: return EmailAnnotationConfig
```

## 7. System Flowchart: Email Dispatch Engine

```mermaid
flowchart TD
    A[Entity Lifecycle Event Fires<br>INSERT or UPDATE] --> B{Is entity annotated<br>with @email.enabled?}
    B -->|No| Z[No action]
    B -->|Yes| C[after handler invoked]

    C --> D{Is _data an array?}
    D -->|Yes| E[Iterate each row]
    D -->|No| F[Wrap in single-element array]
    F --> E

    E --> G[resolveRecipient]
    G --> H{static recipient?}
    H -->|Yes| I2[Use config.recipient]
    H -->|No| H2{recipientField configured?}
    H2 -->|Yes| I[Read data field: config.recipientField]
    H2 -->|No| J{req.user.id matches<br>email pattern?}
    J -->|Yes| K[Use req.user.id]
    J -->|No| L[Use req.user.attr.email]

    I2 --> M{Recipient is valid<br>non-empty string?}
    I --> M
    K --> M
    L --> M

    M -->|No| N[Log warning, skip row]
    M -->|Yes| O[loadTemplate from<br>email-templates directory]

    O --> P{Template file exists?}
    P -->|No| Q[Throw Error:<br>template not found]
    P -->|Yes| R[renderTemplate:<br>replace placeholders]

    R --> S[resolveSubject:<br>render or use template name]
    S --> T[resolveEntityKey:<br>extract key values]
    T --> U[Call sendEmail with payload]

    U --> V{Provider kind?}
    V -->|basic| W[Log to EmailLog<br>status: sent]
    V -->|graph| X[Build Graph payload]

    X --> Y[sendWithRetry]
    Y --> AA{Graph API call succeeds?}
    AA -->|Yes| AB[Call super.sendEmail<br>Log status: sent]
    AA -->|No| AC{Status retryable?<br>429/503/504}
    AC -->|Yes| AD{Attempts remaining?}
    AD -->|Yes| AE[Wait 2^n seconds<br>Retry]
    AE --> Y
    AD -->|No| AF[Log status: failed<br>with error message]
    AC -->|No| AF

    Q --> AG{config.rollback?}
    AG -->|Yes| AH[Throw error,<br>rollback transaction]
    AG -->|No| AI[Log error, continue]

    W --> AJ[Handler complete]
    AB --> AJ
    AF --> AJ
```

## 8. Entity Relationship Diagram (ERD)

```mermaid
erDiagram
    EmailLog {
        UUID ID PK "Auto-generated (cuid)"
        Timestamp createdAt "Auto-managed"
        String createdBy "Auto-managed"
        Timestamp modifiedAt "Auto-managed"
        String modifiedBy "Auto-managed"
        String entityName "Source entity name (e.g. Orders)"
        String entityKey "Composite key value(s)"
        String recipient "Email recipient address"
        String subject "Email subject line"
        String_enum status "sent | failed | pending"
        String error "Error message on failure"
    }

    Orders {
        UUID ID PK "cuid"
        Timestamp createdAt "managed"
        String createdBy "managed"
        Timestamp modifiedAt "managed"
        String modifiedBy "managed"
        String orderNumber
        String status
        String contactEmail
    }

    Tickets {
        UUID ID PK "cuid"
        Timestamp createdAt "managed"
        String createdBy "managed"
        Timestamp modifiedAt "managed"
        String modifiedBy "managed"
        String ticketNumber
        String status
        String contactEmail
    }

    Products {
        UUID ID PK "cuid"
        Timestamp createdAt "managed"
        String createdBy "managed"
        Timestamp modifiedAt "managed"
        String modifiedBy "managed"
        String name
        Decimal price
    }

    Orders ||--o{ EmailLog : "triggers email logging"
    Tickets ||--o{ EmailLog : "triggers email logging"
    Products ||--o| EmailLog : "no email annotation"
```

## 9. State Transition Diagram: Email Status Lifecycle

```mermaid
stateDiagram-v2
    [*] --> HandlerTriggered: Entity INSERT/UPDATE

    HandlerTriggered --> RecipientResolved: resolveRecipient()
    HandlerTriggered --> Skipped: No valid recipient

    RecipientResolved --> TemplateLoaded: loadTemplate() success
    RecipientResolved --> ErrorState: Template not found

    TemplateLoaded --> Sending: sendEmail() called

    state Sending {
        [*] --> BasicSend: kind = basic
        [*] --> GraphSend: kind = graph

        BasicSend --> Sent: Log to EmailLog

        GraphSend --> GraphAPICall
        GraphAPICall --> Sent: 2xx response
        GraphAPICall --> Retrying: 429/503/504
        Retrying --> GraphAPICall: attempt < maxRetries
        Retrying --> Failed: attempt >= maxRetries
        GraphAPICall --> Failed: Non-retryable error
    }

    state Sent {
        [*] --> LoggedSent: INSERT EmailLog status=sent
    }

    state Failed {
        [*] --> LoggedFailed: INSERT EmailLog status=failed + error
    }

    ErrorState --> RollbackCheck
    RollbackCheck --> TransactionRolledBack: @email.rollback = true
    RollbackCheck --> ErrorLogged: @email.rollback = false

    Skipped --> [*]
    LoggedSent --> [*]
    LoggedFailed --> [*]
    TransactionRolledBack --> [*]
    ErrorLogged --> [*]
```

## 10. Module/Package Dependency Graph

```mermaid
flowchart TD
    subgraph "Entry Point"
        CDS_PLUGIN["cds-plugin.ts"]
    end

    subgraph "Core Modules (lib/)"
        PLUGIN["lib/plugin.ts<br><i>Handler registration,<br>annotation parsing</i>"]
        BASIC["lib/basic.ts<br><i>EmailService base class</i>"]
        GRAPH["lib/graph-mail.ts<br><i>GraphMailService subclass</i>"]
        TEMPLATE["lib/template-engine.ts<br><i>Template loading & rendering</i>"]
        CONDITION["lib/condition.ts<br><i>CDS condition parsing & evaluation</i>"]
        ENTITIES["lib/entities.ts<br><i>Typed entity access & enum resolution</i>"]
        TYPES["lib/types.ts<br><i>Interfaces, EMAIL_DEFAULTS</i>"]
        CONSTANTS["lib/constants.ts<br><i>All constants</i>"]
    end

    subgraph "CDS Models (db/)"
        EMAIL_LOG_CDS["db/email-log.cds<br><i>EmailLog entity definition</i>"]
    end

    subgraph "Generated Types"
        CDS_MODELS["@cds-models/<br>expertum/cap/email<br><i>EmailLog, EmailLog_</i>"]
    end

    subgraph "External Dependencies"
        SAP_CDS["@sap/cds<br><i>CAP Runtime</i>"]
        NODE_FS["node:fs/promises"]
        NODE_PATH["node:path"]
    end

    CDS_PLUGIN -->|"imports registerEmailHandlers()"| PLUGIN
    CDS_PLUGIN -->|"imports cds"| SAP_CDS

    PLUGIN -->|"imports validateCondition"| CONDITION
    PLUGIN -->|"imports ANNOTATION_PREFIX"| CONSTANTS
    PLUGIN -->|"imports EmailAnnotationConfig,<br>IEmailService, EMAIL_DEFAULTS"| TYPES
    PLUGIN -->|"imports cds"| SAP_CDS

    TYPES -->|"imports type EmailLog"| ENTITIES
    ENTITIES -->|"imports cds"| SAP_CDS
    CONDITION -->|"imports cds"| SAP_CDS

    BASIC -->|"imports loadTemplate,<br>renderTemplate"| TEMPLATE
    BASIC -->|"imports evaluateCondition"| CONDITION
    BASIC -->|"imports emailEntities,<br>type EmailLog"| ENTITIES
    BASIC -->|"imports EMAIL_PATTERN,<br>TRIGGER_TO_EVENT"| CONSTANTS
    BASIC -->|"imports EmailAnnotationConfig,<br>EmailPayload, IEmailService"| TYPES
    BASIC -->|"extends cds.Service"| SAP_CDS

    GRAPH -->|"extends EmailService"| BASIC
    GRAPH -->|"imports DEFAULT_RETRY_ATTEMPTS,<br>RETRYABLE_STATUS_CODES"| CONSTANTS
    GRAPH -->|"imports EmailPayload,<br>GraphMailOptions, etc."| TYPES
    GRAPH -->|"imports cds"| SAP_CDS

    TEMPLATE -->|"imports PLACEHOLDER_PATTERN,<br>TEMPLATE_DIR, TEMPLATE_EXT"| CONSTANTS
    TEMPLATE -->|"imports cds"| SAP_CDS
    TEMPLATE -->|"imports readFile"| NODE_FS
    TEMPLATE -->|"imports path"| NODE_PATH

    ENTITIES -->|"imports type EmailLog"| CDS_MODELS
    CDS_MODELS -.->|"generated from"| EMAIL_LOG_CDS

    style CDS_PLUGIN fill:#4a90d9,color:#fff
    style CONDITION fill:#9370db,color:#fff
    style ENTITIES fill:#808080,color:#fff
    style PLUGIN fill:#7b68ee,color:#fff
    style BASIC fill:#3cb371,color:#fff
    style GRAPH fill:#ff8c00,color:#fff
    style TEMPLATE fill:#cd5c5c,color:#fff
    style TYPES fill:#808080,color:#fff
    style CONSTANTS fill:#808080,color:#fff
    style EMAIL_LOG_CDS fill:#daa520,color:#fff
    style CDS_MODELS fill:#daa520,color:#fff
```
