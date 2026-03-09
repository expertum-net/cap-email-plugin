import cds from "@sap/cds";
import type { EmailPayload, IEmailService } from "./types.js";

const LOG = cds.log("email");

export default class EmailService extends cds.Service implements IEmailService {
  async sendEmail(payload: EmailPayload): Promise<void> {
    LOG.warn("No real email provider configured. Email not sent:", payload.subject);
  }
}
