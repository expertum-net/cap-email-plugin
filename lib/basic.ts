import cds from "@sap/cds";
import type { EmailPayload } from "./types.js";

const LOG = cds.log("email");

export default class EmailService extends cds.Service {
  async send(payload: EmailPayload): Promise<void> {
    LOG.warn("No real email provider configured. Email not sent:", payload.subject);
  }
}
