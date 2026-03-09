import cds from "@sap/cds";
import { ANNOTATION_PREFIX } from "./constants.js";
import { type EmailAnnotationConfig, EMAIL_DEFAULTS } from "./types.js";

const LOG = cds.log("email-plugin");

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

  const template = objectAnnotation?.template ?? flat.template ?? EMAIL_DEFAULTS.template;

  return {
    ...EMAIL_DEFAULTS,
    ...objectAnnotation,
    ...flat,
    enabled,
    template: template === EMAIL_DEFAULTS.template ? entityName : template,
  };
}

export function registerEmailHandlers() {
  LOG.info("Registering email handlers...");
  // TODO: Iterate ApplicationService entities and attach after handlers for @email annotated entities
}
