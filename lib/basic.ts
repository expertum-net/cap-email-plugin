import cds from "@sap/cds";
import { EmailLog } from "#cds-models/expertum/cap/email";
import { evaluateCondition } from "./condition.js";
import { EMAIL_PATTERN, TRIGGER_TO_EVENT } from "./constants.js";
import { loadTemplate, renderTemplate } from "./template-engine.js";
import type { EmailAnnotationConfig, EmailPayload, IEmailService } from "./types.js";

const LOG = cds.log("email");

export default class EmailService extends cds.Service implements IEmailService {
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
          try {
            if (!evaluateCondition(config.condition, data)) {
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
    if (!to) return null;

    const templateContent = await loadTemplate(config.template);
    const body = renderTemplate(templateContent, data);
    const subject = this.resolveSubject(config, data);
    const entityKey = this.resolveEntityKey(entity, data);

    return {
      from: "",
      to,
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
  ): string | null {
    let recipient: unknown;
    let source: string;

    if (config.recipient) {
      recipient = config.recipient;
      source = `recipient '${config.recipient}'`;
    } else if (config.recipientField) {
      recipient = data[config.recipientField];
      source = `recipientField '${config.recipientField}'`;
    } else if (EMAIL_PATTERN.test(req.user.id)) {
      recipient = req.user.id;
      source = "req.user.id";
    } else {
      recipient = req.user.attr.email;
      source = "req.user.attr.email";
    }

    if (typeof recipient === "string" && recipient.length > 0) {
      return recipient;
    }

    LOG.warn(`No recipient resolved from ${source} — skipping email`);
    return null;
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
    await this.logEmail({
      entityName: payload.entityName,
      entityKey: payload.entityKey,
      recipient: payload.to,
      subject: payload.subject,
      status: EmailLog.status.sent,
    });
  }

  async logEmail(entry: EmailLog): Promise<void> {
    try {
      await INSERT.into(EmailLog).entries(entry);
    } catch (err) {
      LOG.error("Failed to write email log:", err);
    }
  }
}
