# Architecture Analysis: cap-email vs @cap-js/attachments

Comparison of the current cap-email plugin architecture against the @cap-js/attachments plugin pattern, with a focus on
handler registration and provider extensibility.

## @cap-js/attachments — Reference Architecture

### File Structure

```
cds-plugin.js          → Pure loader: require('./lib/plugin')
lib/plugin.js          → cds.once("served") — iterates services, delegates to AttachmentsSrv
lib/basic.js           → Base class (AttachmentsService extends cds.Service)
lib/aws-s3.js          → S3 provider (overrides registerUpdateHandlers + put/get/delete)
lib/azure-blob-storage → Azure provider (overrides registerUpdateHandlers + put/get/delete)
```

### Boot Sequence

```mermaid
sequenceDiagram
    participant CDS as CAP Runtime
    participant CP as cds-plugin.js
    participant PL as lib/plugin.js
    participant SRV as AttachmentsSrv<br/>(resolved via cds.connect.to)

    CDS->>CP: load plugin
    CP->>PL: require('./lib/plugin')
    Note over PL: registers cds.once("served", ...)

    CDS->>CDS: bootstrap services
    CDS->>PL: "served" event fires
    PL->>PL: iterate ApplicationServices
    PL->>PL: find attachment-annotated entities
    PL->>SRV: cds.connect.to("attachments")
    Note over SRV: resolves to basic / s3 / azure<br/>based on cds.requires.attachments.kind

    PL->>SRV: registerUpdateHandlers(srv, entity, target)
    PL->>SRV: registerDraftUpdateHandlers(srv, entity, target)
    Note over SRV: provider registers its own<br/>handlers on the ApplicationService
```

### Handler Registration — Polymorphic Override

The critical pattern: **each provider overrides `registerUpdateHandlers()`** to register the exact handlers it needs on
the ApplicationService.

```mermaid
classDiagram
    class AttachmentsService {
        +put(attachments, data, content, isDraft)
        +get(attachments, keys)
        +update(attachments, key, data)
        +getStatus(attachments, key)
        +registerUpdateHandlers(srv, entity, target)*
        +registerDraftUpdateHandlers(srv, entity, target)*
        -nonDraftHandler(req, attachment, srv)
        -draftSaveHandler(attachments)
    }

    class AWSAttachmentsService {
        +init()
        +put(attachments, data, content, isDraft)
        +get(attachments, keys)
        +delete(key)
        +registerUpdateHandlers(srv, entity, target)
        +registerDraftUpdateHandlers(srv, entity, target)
        -updateContentHandler(req, next)
        -attachDeletionData(req)
        -deleteAttachmentsWithKeys(records, req)
    }

    class AzureAttachmentsService {
        +init()
        +put(attachments, data, content, isDraft, req)
        +get(attachments, keys)
        +delete(blobName)
        +registerUpdateHandlers(srv, entity, target)
        +registerDraftUpdateHandlers(srv, entity, mediaElements)
        -updateContentHandler(req, next)
    }

    AttachmentsService <|-- AWSAttachmentsService
    AttachmentsService <|-- AzureAttachmentsService
```

### What Each Provider Registers

The base class and each subclass register **completely different** handlers on the ApplicationService:

```mermaid
flowchart TB
    subgraph basic ["basic.js (db)"]
        B1["before PUT → log"]
        B2["on PUT → pass-through or metadata"]
        B3["after PUT → nonDraftHandler → this.put()"]
    end

    subgraph s3 ["aws-s3.js"]
        S1["before DELETE/UPDATE → attachDeletionData"]
        S2["after DELETE/UPDATE → deleteAttachmentsWithKeys"]
        S3["on PUT → updateContentHandler (S3 upload)"]
    end

    subgraph azure ["azure-blob-storage.js"]
        A1["before PUT → log"]
        A2["on PUT → pass-through or metadata"]
        A3["after PUT → nonDraftHandler → this.put() (Azure upload)"]
    end

    plugin["plugin.js calls<br/>AttachmentsSrv.registerUpdateHandlers()"]
    plugin -->|"kind: db"| basic
    plugin -->|"kind: s3"| s3
    plugin -->|"kind: azure"| azure
```

### Key Takeaway

The plugin never decides _how_ to handle events. It only decides _which entities_ need handlers. The resolved service
class controls everything: which events to listen to, what handlers to register, and how to process the data. This makes
providers fully independent.

---

## cap-email — Current Architecture

### File Structure

```
cds-plugin.ts          → cds.once("served", registerEmailHandlers)
lib/plugin.ts          → parseEmailAnnotation + registerEmailHandlers (delegates to service)
lib/basic.ts           → EmailService (base): registerHandlers + sendEmail + logEmail
lib/graph-mail.ts      → GraphMailService: overrides sendEmail() only
lib/types.ts           → Interfaces + annotation config
lib/constants.ts       → Shared constants
lib/template-engine.ts → Template loading + rendering
```

### Boot Sequence

```mermaid
sequenceDiagram
    participant CDS as CAP Runtime
    participant CP as cds-plugin.ts
    participant PL as lib/plugin.ts
    participant SRV as EmailService<br/>(resolved via cds.connect.to)

    CDS->>CP: load plugin
    Note over CP: cds.once("served", registerEmailHandlers)

    CDS->>CDS: bootstrap services
    CDS->>CP: "served" event fires
    CP->>PL: registerEmailHandlers()
    PL->>SRV: cds.connect.to("email")
    Note over SRV: resolves to basic / graph<br/>based on cds.requires.email.kind
    PL->>PL: iterate ApplicationServices
    PL->>PL: parseEmailAnnotation(entity)

    PL->>SRV: registerHandlers(srv, entity, config)
    Note over SRV: base class registers handlers<br/>and orchestrates full email flow
```

### Current Class Hierarchy

```mermaid
classDiagram
    class EmailService {
        +registerHandlers(srv, entity, config)
        +resolveRecipient(config, data, req)
        +sendEmail(payload)
        +logEmail(entry)
        -resolveSubject(config, data)
        -resolveEntityKey(entity, data)
    }

    class GraphMailService {
        -from: string
        -graphApi: cds.Service
        +init()
        +sendEmail(payload)
        +buildGraphPayload(payload)
        +formatGraphRecipients(email)
        +sendWithRetry(from, payload, attempt)
    }

    EmailService <|-- GraphMailService

    note for GraphMailService "Only overrides sendEmail().\nDoes NOT override registerHandlers().\nCannot customize which handlers\nget registered on the AppService."
```

### Current Handler Registration Flow

```mermaid
flowchart TB
    subgraph plugin ["plugin.ts"]
        P1["iterate ApplicationServices"]
        P2["parseEmailAnnotation(entity)"]
        P1 --> P2
    end

    subgraph basic ["basic.ts — registerHandlers()"]
        R1["for each trigger → srv.after(event, entity)"]
        R2["resolveRecipient()"]
        R3["loadTemplate() + renderTemplate()"]
        R4["resolveSubject()"]
        R5["this.sendEmail(payload)"]
        R1 --> R2 --> R3 --> R4 --> R5
    end

    subgraph send ["sendEmail — polymorphic dispatch"]
        SE1["EmailService.sendEmail()<br/>→ logEmail(status: sent)"]
        SE2["GraphMailService.sendEmail()<br/>→ buildGraphPayload → sendWithRetry<br/>→ super.sendEmail() for logging"]
    end

    plugin -->|"emailService.registerHandlers(srv, entity, config)"| basic
    basic -->|"kind: basic"| SE1
    basic -->|"kind: graph"| SE2
```

---

## Gap Analysis

| Concern                                     | @cap-js/attachments                                                    | cap-email (current)                                              |
| ------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Plugin entry point                          | Thin loader                                                            | Thin — `cds.once("served", fn)`                                  |
| Plugin logic                                | Iterates + delegates                                                   | Iterates + delegates (after refactor)                            |
| Base class registers handlers               | `registerUpdateHandlers()`                                             | `registerHandlers()`                                             |
| **Subclass overrides handler registration** | **Yes — S3 and Azure register completely different handlers**          | **No — GraphMailService does not override `registerHandlers()`** |
| Provider-specific behavior                  | Via overridden `registerUpdateHandlers()` + overridden `put()`/`get()` | Via overridden `sendEmail()` only                                |
| Provider controls which events to listen to | Yes                                                                    | No — base class decides for all providers                        |

### The Problem

Currently, `registerHandlers()` lives entirely on the base `EmailService`. Every provider gets the exact same handler
registration: `srv.after(event, entity)` → resolve recipient → load template → `this.sendEmail()`.

This means:

- A provider **cannot** register additional handlers (e.g., batch queue handler, webhook callback)
- A provider **cannot** change the orchestration flow (e.g., skip template rendering for API-driven emails)
- A provider **cannot** register different event hooks (e.g., `before` handlers for validation)
- All provider-specific behavior is funneled through a single `sendEmail()` override

In the attachments plugin, S3 registers deletion-tracking handlers that the base class doesn't have. Azure registers
draft-specific blob handlers. Each provider is fully autonomous in what it registers.

---

## Target Architecture

Apply the attachments pattern: **each provider overrides `registerHandlers()`** to control its own handler registration
on the ApplicationService.

```mermaid
classDiagram
    class EmailService {
        +registerHandlers(srv, entity, config)*
        +resolveRecipient(config, data, req)
        +sendEmail(payload)
        +logEmail(entry)
        #resolveSubject(config, data)
        #resolveEntityKey(entity, data)
    }

    class GraphMailService {
        -from: string
        -graphApi: cds.Service
        +init()
        +registerHandlers(srv, entity, config)
        +sendEmail(payload)
        +buildGraphPayload(payload)
        +formatGraphRecipients(email)
        +sendWithRetry(from, payload, attempt)
    }

    class FutureProvider {
        +init()
        +registerHandlers(srv, entity, config)
        +sendEmail(payload)
    }

    EmailService <|-- GraphMailService
    EmailService <|-- FutureProvider

    note for EmailService "Base: default handler registration.\nProviders override to customize."
    note for GraphMailService "Overrides registerHandlers().\nCan add graph-specific hooks,\nbatch handling, etc."
```

### Target Handler Registration Flow

```mermaid
flowchart TB
    subgraph plugin ["plugin.ts (thin)"]
        P1["iterate ApplicationServices"]
        P2["parseEmailAnnotation(entity)"]
        P1 --> P2
    end

    subgraph basic ["EmailService.registerHandlers()"]
        B1["srv.after(event, entity)"]
        B2["resolveRecipient → loadTemplate → sendEmail"]
        B1 --> B2
    end

    subgraph graphMail ["GraphMailService.registerHandlers()"]
        G1["srv.after(event, entity)"]
        G2["resolveRecipient → loadTemplate → sendEmail"]
        G3["(future: batch queue, webhook, etc.)"]
        G1 --> G2
        G1 --> G3
    end

    subgraph future ["FutureProvider.registerHandlers()"]
        F1["completely custom handler registration"]
    end

    plugin -->|"emailService.registerHandlers()"| decision{resolved kind}
    decision -->|"kind: basic"| basic
    decision -->|"kind: graph"| graphMail
    decision -->|"kind: future"| future
```

### What Changes

1. **`lib/graph-mail.ts`** — Override `registerHandlers()`. Initially calls `super.registerHandlers()` (same behavior),
   but now has the hook point for graph-specific customization.
2. **`lib/basic.ts`** — No change needed. Base `registerHandlers()` stays as the default.
3. **`lib/plugin.ts`** — No change needed. Already delegates to the resolved service.

This is a low-cost change that unlocks provider autonomy for future providers.
