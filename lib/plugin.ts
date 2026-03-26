import cds from "@sap/cds";
import { ANNOTATION_PREFIX } from "./constants.js";
import { validateCondition } from "./condition.js";
import { type EmailAnnotationConfig, type IEmailService, EMAIL_DEFAULTS } from "./types.js";

const LOG = cds.log("email");

export function parseEmailAnnotation(entity: cds.linked.classes.entity): EmailAnnotationConfig | null {
  const entityAny = entity as unknown as Record<string, unknown>;
  const objectAnnotation = entityAny[ANNOTATION_PREFIX] as Partial<EmailAnnotationConfig> | undefined;

  const flatEnabled = entityAny[`${ANNOTATION_PREFIX}.enabled`] as boolean | undefined;

  const enabled = objectAnnotation?.enabled ?? flatEnabled ?? EMAIL_DEFAULTS.enabled;
  if (!enabled) return null;

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

  validateCondition(merged.condition, entity.name);

  const template = objectAnnotation?.template ?? flat.template ?? EMAIL_DEFAULTS.template;

  return {
    ...merged,
    template: template === EMAIL_DEFAULTS.template ? entityName : template,
  };
}

export async function registerEmailHandlers() {
  const emailService = (await cds.connect.to("email")) as IEmailService;

  for (const srv of Object.values(cds.services)) {
    if (!(srv instanceof cds.ApplicationService)) continue;

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
