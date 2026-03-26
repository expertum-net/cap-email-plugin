import cds from "@sap/cds";

/**
 * Typed entity access for plugin-owned CDS entities.
 *
 * Compile-time: `import type` resolves via @cds-models (generated locally, erased by tsc).
 * Runtime: entities resolved dynamically via cds.entities() — no @cds-models dependency.
 *
 * Enum values (e.g. EmailLog.status.sent) are extracted from CDS element definitions
 * and attached to the entity object, mirroring what cds-typer's createEntityProxy does.
 */

export type EmailLog = import("#cds-models/expertum/cap/email").EmailLog;

type EmailLogEntity = typeof import("#cds-models/expertum/cap/email").EmailLog;

interface EmailEntities {
  EmailLog: EmailLogEntity;
}

let _cached: EmailEntities;

export function emailEntities(): EmailEntities {
  if (!_cached) {
    const def = cds.entities("expertum.cap.email")["EmailLog"];
    const entity = Object.create(def);
    for (const [name, elem] of Object.entries(def.elements)) {
      const enumDef = (elem as unknown as Record<string, unknown>).enum as
        | Record<string, Record<string, unknown>>
        | undefined;
      if (enumDef) {
        entity[name] = Object.fromEntries(Object.entries(enumDef).map(([k, v]) => [k, v.val ?? k]));
      }
    }
    _cached = { EmailLog: entity as unknown as EmailLogEntity };
  }
  return _cached;
}
