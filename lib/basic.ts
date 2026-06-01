import cds from "@sap/cds";
import { emailEntities, type EmailLog } from "./entities.js";
import { evaluateCondition } from "./condition.js";
import { EMAIL_PATTERN, TRIGGER_TO_EVENT } from "./constants.js";
import { loadTemplate, renderTemplate } from "./template-engine.js";
import type { EmailAnnotationConfig, EmailPayload, IEmailService } from "./types.js";

const LOG = cds.log("email:basic");

export default class EmailService extends cds.Service implements IEmailService {
  protected from: string = "";

  registerHandlers(
    srv: cds.ApplicationService,
    entity: cds.linked.classes.entity,
    config: EmailAnnotationConfig,
  ): void {
    for (const trigger of config.trigger) {
      const event = TRIGGER_TO_EVENT[trigger];
      if (!event) {
        LOG.warn(`Unknown trigger '${trigger}' on ${entity.name} — skipping`);
        continue;
      }

      srv.after(event, entity.name, async (_data: unknown, req: cds.Request) => {
        const rows = Array.isArray(_data) ? _data : [_data];

        for (const data of rows as Record<string, unknown>[]) {
          if (!data || typeof data !== "object") {
            LOG.warn(`Received non-object data (${typeof data}) — skipping email for ${entity.name}`);
            continue;
          }

          try {
            if (!evaluateCondition(config.conditionAst, data)) {
              LOG.info(`Condition not met for ${entity.name} — skipping email`);
              continue;
            }
            const payload = await this.prepareEmail(config, entity, data, req);
            if (!payload) continue;
            await this.sendEmail(payload);
          } catch (err) {
            LOG.error(`Email failed for ${entity.name}:`, err);
            if (config.rollback) throw err;
          }
        }
      });

      LOG.info(`Registered ${event} handler for ${entity.name}`);
    }
  }

  protected async prepareEmail(
    config: EmailAnnotationConfig,
    entity: cds.linked.classes.entity,
    data: Record<string, unknown>,
    req: cds.Request,
  ): Promise<EmailPayload | null> {
    const to = this.resolveRecipient(config, data, req);
    if (!to || to.length === 0) {
      LOG.debug(`No recipient resolved for ${entity.name} — skipping email`);
      return null;
    }

    LOG.debug(`Resolved recipient(s) for ${entity.name}:`, to);

    const templateContent = await loadTemplate(config.template);
    const body = renderTemplate(templateContent, data);
    const subject = this.resolveSubject(config, data);
    const entityKey = this.resolveEntityKey(entity, data);

    LOG.debug(`Prepared email for ${entity.name} [${entityKey}]: subject="${subject}", to=${to.join(", ")}`);

    return {
      from: this.from,
      to,
      cc: config.cc,
      bcc: config.bcc,
      subject,
      body,
      entityName: entity.name,
      entityKey,
      saveToSentItems: config.saveToSentItems,
    };
  }

  protected resolveRecipient(
    config: EmailAnnotationConfig,
    data: Record<string, unknown>,
    req: cds.Request,
  ): string[] | null {
    // Static recipient — already validated and normalized to string[] by parseEmailAnnotation
    if (config.recipient) {
      LOG.debug("Using static recipient from annotation");
      return config.recipient;
    }

    let recipient: unknown;
    let source: string;

    if (config.recipientField) {
      recipient = data[config.recipientField];
      source = `recipientField '${config.recipientField}'`;
    } else if (req.user?.id && EMAIL_PATTERN.test(req.user.id)) {
      recipient = req.user.id;
      source = "req.user.id";
    } else {
      recipient = req.user?.attr?.email;
      source = "req.user.attr.email";
    }

    if (typeof recipient !== "string" || recipient.length === 0) {
      LOG.warn(`No recipient resolved from ${source} — skipping email`);
      return null;
    }

    if (!EMAIL_PATTERN.test(recipient)) {
      LOG.warn(`Invalid email format from ${source}: '${recipient}' — skipping email`);
      return null;
    }

    LOG.debug(`Resolved recipient from ${source}: '${recipient}'`);
    return [recipient];
  }

  protected resolveSubject(config: EmailAnnotationConfig, data: Record<string, unknown>): string {
    if (config.subject) {
      return renderTemplate(config.subject, data);
    }
    const parts = config.template.split("/");
    return parts[parts.length - 1];
  }

  protected resolveEntityKey(entity: cds.linked.classes.entity, data: Record<string, unknown>): string {
    const keys = Object.keys(entity.keys);
    return keys.map((k) => String(data[k] ?? "")).join(",");
  }

  async sendEmail(payload: EmailPayload): Promise<void> {
    const { EmailLog } = emailEntities();
    const logFields = {
      entityName: payload.entityName,
      entityKey: payload.entityKey,
      recipient: payload.to,
      cc: payload.cc,
      bcc: payload.bcc,
      subject: payload.subject,
    };
    try {
      LOG.debug(`Dispatching email for ${payload.entityName} [${payload.entityKey}]`);
      await this.dispatchEmail(payload);
      LOG.info(`Email sent successfully for ${payload.entityName} [${payload.entityKey}]`);
      await this.logEmail({
        ...logFields,
        status: EmailLog.status.sent,
      });
    } catch (err) {
      await this.logEmail({
        ...logFields,
        status: EmailLog.status.failed,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  async dispatchEmail(_payload: EmailPayload): Promise<void> {
    // No-op — subclasses override for provider-specific dispatch
  }

  async logEmail(entry: EmailLog): Promise<void> {
    const { EmailLog } = emailEntities();
    try {
      LOG.debug(`Writing EmailLog entry: status=${entry.status}, entity=${entry.entityName}`);
      await INSERT.into(EmailLog).entries(entry);
    } catch (err) {
      LOG.error("Failed to write email log:", err);
    }
  }
}
