import cds from "@sap/cds";
import type { EmailPayload } from "./types.js";

const LOG = cds.log("email");

export default class EmailService extends cds.Service {
  async init(): Promise<void> {
    LOG.info("EmailService initialized (basic — no-op provider)");
    await super.init();
  }

  async send(payload: EmailPayload): Promise<void> {
    LOG.warn("No real email provider configured. Email not sent:", payload.subject);
  }
}
