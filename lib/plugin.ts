import cds from "@sap/cds";
import { ANNOTATION_PREFIX, EMAIL_PATTERN } from "./constants.js";
import { validateCondition } from "./condition.js";
import { type EmailAnnotationConfig, type IEmailService, EMAIL_DEFAULTS } from "./types.js";

const LOG = cds.log("email:plugin");

export function parseEmailAnnotation(entity: cds.linked.classes.entity): EmailAnnotationConfig | null {
  const entityAny = entity as unknown as Record<string, unknown>;
  const objectAnnotation = entityAny[ANNOTATION_PREFIX] as Partial<EmailAnnotationConfig> | undefined;

  const flatEnabled = entityAny[`${ANNOTATION_PREFIX}.enabled`] as boolean | undefined;

  const enabled = objectAnnotation?.enabled ?? flatEnabled ?? EMAIL_DEFAULTS.enabled;
  if (!enabled) {
    LOG.debug(`Entity ${entity.name}: @email not enabled — skipping`);
    return null;
  }

  const parts = entity.name.split(".");
  const entityName = parts[parts.length - 1];

  const flat: Partial<EmailAnnotationConfig> = {};
  for (const key of Object.keys(EMAIL_DEFAULTS) as (keyof EmailAnnotationConfig)[]) {
    const value = entityAny[`${ANNOTATION_PREFIX}.${key}`];
    if (value !== undefined) {
      flat[key] = value as never;
    }
  }

  const merged = {
    ...EMAIL_DEFAULTS,
    ...objectAnnotation,
    ...flat,
    enabled,
  };

  if (merged.recipient && merged.recipientField) {
    throw new Error(
      `Entity ${entity.name} specifies both 'recipient' and 'recipientField' — they are mutually exclusive.`,
    );
  }

  if (merged.recipient !== undefined) {
    merged.recipient = normalizeRecipientList(merged.recipient, "recipient", entity.name);
  }
  if (merged.cc !== undefined) {
    merged.cc = normalizeRecipientList(merged.cc, "cc", entity.name);
  }
  if (merged.bcc !== undefined) {
    merged.bcc = normalizeRecipientList(merged.bcc, "bcc", entity.name);
  }

  const conditionAst = validateCondition(merged.condition, entity.name);

  const template = objectAnnotation?.template ?? flat.template ?? EMAIL_DEFAULTS.template;

  const config = {
    ...merged,
    conditionAst,
    template: template === EMAIL_DEFAULTS.template ? entityName : template,
  };

  LOG.debug(`Parsed @email config for ${entity.name}:`, config);

  return config;
}

function normalizeRecipientList(value: unknown, field: string, entityName: string): string[] {
  const addresses = typeof value === "string" ? [value] : value;
  if (!Array.isArray(addresses) || !addresses.every((v) => typeof v === "string")) {
    throw new Error(`Invalid @email.${field} on ${entityName}: expected string or string[], got ${typeof value}`);
  }
  if (addresses.length === 0) {
    throw new Error(`Empty @email.${field} on ${entityName}: at least one address required`);
  }
  for (const addr of addresses) {
    if (!EMAIL_PATTERN.test(addr)) {
      throw new Error(`Invalid email in @email.${field} on ${entityName}: '${addr}'`);
    }
  }
  return addresses as string[];
}

export async function registerEmailHandlers() {
  LOG.debug("Connecting to email service");
  const emailService = (await cds.connect.to("email")) as IEmailService;

  for (const srv of Object.values(cds.services)) {
    if (!(srv instanceof cds.ApplicationService)) continue;
    LOG.debug(`Scanning service '${srv.name}' for @email annotations`);

    for (const entity of Object.values(srv.entities)) {
      try {
        const config = parseEmailAnnotation(entity);
        if (!config) continue;

        emailService.registerHandlers(srv, entity, config);
      } catch (err) {
        LOG.error(`Invalid @email annotation on ${entity.name}:`, err);
        throw err;
      }
    }
  }
}
