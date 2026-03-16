import cds from "@sap/cds";
import { ANNOTATION_PREFIX, EMAIL_PATTERN, TRIGGER_TO_EVENT } from "./constants.js";
import { loadTemplate, renderTemplate } from "./template-engine.js";
import { type EmailAnnotationConfig, type IEmailService, EMAIL_DEFAULTS } from "./types.js";

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

export function resolveRecipient(
  config: EmailAnnotationConfig,
  data: Record<string, unknown>,
  req: cds.Request,
): string | null {
  let recipient: unknown;

  if (config.toField) {
    recipient = data[config.toField];
  } else if (EMAIL_PATTERN.test(req.user.id)) {
    recipient = req.user.id;
  } else {
    recipient = req.user.attr.email;
  }

  if (typeof recipient === "string" && recipient.length > 0) {
    return recipient;
  }

  const source = config.toField ? `toField '${config.toField}'` : "req.user";
  LOG.warn(`No recipient resolved from ${source} — skipping email`);
  return null;
}

function resolveEntityKey(entity: cds.linked.classes.entity, data: Record<string, unknown>): string {
  const keys = Object.keys(entity.keys);
  return keys.map((k) => String(data[k] ?? "")).join(",");
}

function resolveSubject(config: EmailAnnotationConfig, data: Record<string, unknown>): string {
  if (config.subject) {
    return renderTemplate(config.subject, data);
  }
  const parts = config.template.split("/");
  return parts[parts.length - 1];
}

export async function registerEmailHandlers() {
  const emailService = (await cds.connect.to("email")) as IEmailService;

  for (const srv of Object.values(cds.services)) {
    if (!(srv instanceof cds.ApplicationService)) continue;

    for (const entity of Object.values(srv.entities)) {
      const config = parseEmailAnnotation(entity);
      if (!config) continue;

      for (const trigger of config.trigger) {
        const event = TRIGGER_TO_EVENT[trigger];
        if (!event) {
          LOG.warn(`Unknown trigger '${trigger}' on ${entity.name} — skipping`);
          continue;
        }

        srv.after(event, entity.name, async (_data: unknown, req: cds.Request) => {
          const rows = Array.isArray(_data) ? _data : [_data];

          for (const data of rows as Record<string, unknown>[]) {
            const to = resolveRecipient(config, data, req);
            if (!to) continue;

            try {
              const templateContent = await loadTemplate(config.template);
              const body = renderTemplate(templateContent, data);
              const subject = resolveSubject(config, data);
              const entityKey = resolveEntityKey(entity, data);

              await emailService.sendEmail({
                from: "",
                to,
                subject,
                body,
                entityName: entity.name,
                entityKey,
                saveToSentItems: config.saveToSentItems,
              });
            } catch (err) {
              LOG.error(`Email failed for ${entity.name}:`, err);
              if (config.rollback) throw err;
            }
          }
        });

        LOG.info(`Registered ${event} handler for ${entity.name}`);
      }
    }
  }
}
