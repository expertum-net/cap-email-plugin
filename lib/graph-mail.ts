import cds from "@sap/cds";
import EmailService from "./basic.js";
import { DEFAULT_MAX_RETRY_DELAY, DEFAULT_RETRY_ATTEMPTS, RETRYABLE_STATUS_CODES } from "./constants.js";
import type { EmailPayload, GraphMailOptions, GraphPayload, GraphRecipient, IGraphMailService } from "./types.js";

const LOG = cds.log("email:graph");

export default class GraphMailService extends EmailService implements IGraphMailService {
  declare readonly options: GraphMailOptions;
  private graphApi!: cds.Service;

  async init(): Promise<void> {
    const from = this.options?.email?.from;
    if (!from) {
      throw new Error("No sender address configured (cds.requires.email.email.from)");
    }

    const destination = this.options?.destination;
    if (!destination) {
      throw new Error("No destination configured (cds.requires.email.destination)");
    }

    this.from = from;
    this.graphApi = await cds.connect.to(destination);

    LOG.info("Microsoft Graph email service initialized", { from: this.from, destination });

    return super.init();
  }

  async dispatchEmail(payload: EmailPayload): Promise<void> {
    const graphPayload = this.buildGraphPayload(payload);
    await this.sendWithRetry(this.from, graphPayload);
  }

  buildGraphPayload(payload: EmailPayload): GraphPayload {
    const message: GraphPayload["message"] = {
      subject: payload.subject,
      body: { contentType: "HTML", content: payload.body },
      toRecipients: this.formatGraphRecipients(payload.to),
      importance: "normal",
    };

    if (payload.cc?.length) {
      message.ccRecipients = this.formatGraphRecipients(payload.cc);
    }
    if (payload.bcc?.length) {
      message.bccRecipients = this.formatGraphRecipients(payload.bcc);
    }

    return { message, saveToSentItems: payload.saveToSentItems };
  }

  formatGraphRecipients(recipients: string[]): GraphRecipient[] {
    return recipients.map((addr) => ({
      emailAddress: { address: addr },
    }));
  }

  async sendWithRetry(from: string, payload: GraphPayload, attempt = 0): Promise<void> {
    const maxRetries = this.options?.retryAttempts ?? DEFAULT_RETRY_ATTEMPTS;

    try {
      await this.graphApi.send("POST", `/v1.0/users/${from}/sendMail`, payload);
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;

      if (status && RETRYABLE_STATUS_CODES.includes(status) && attempt < maxRetries) {
        const maxDelay = this.options?.maxRetryDelay ?? DEFAULT_MAX_RETRY_DELAY;
        const delay = Math.min(Math.pow(2, attempt) * 1000, maxDelay);
        LOG.warn(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms (status ${status})`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.sendWithRetry(from, payload, attempt + 1);
      }

      throw err;
    }
  }
}
