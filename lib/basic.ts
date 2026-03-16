import cds from "@sap/cds";
import { EmailLog } from "#cds-models/expertum/cap/email";
import type { EmailPayload, IEmailService } from "./types.js";

const LOG = cds.log("email");

export default class EmailService extends cds.Service implements IEmailService {
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
