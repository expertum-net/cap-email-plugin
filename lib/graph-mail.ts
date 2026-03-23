import cds from "@sap/cds";
import { EmailLog } from "#cds-models/expertum/cap/email";
import EmailService from "./basic.js";
import { DEFAULT_RETRY_ATTEMPTS, RETRYABLE_STATUS_CODES } from "./constants.js";
import type {
  EmailAnnotationConfig,
  EmailPayload,
  GraphMailOptions,
  GraphPayload,
  GraphRecipient,
  IGraphMailService,
} from "./types.js";

const LOG = cds.log("email:graph");

export default class GraphMailService extends EmailService implements IGraphMailService {
  declare readonly options: GraphMailOptions;
  private from!: string;
  private graphApi!: cds.Service;

  /**
   * Provider hook point for Graph-specific handler registration.
   * Follows the @cap-js/attachments pattern where each provider overrides
   * registerHandlers() to control which event hooks are registered on the
   * ApplicationService. Currently delegates to the base class; override
   * with Graph-specific handlers as the provider's needs diverge.
   */
  registerHandlers(
    srv: cds.ApplicationService,
    entity: cds.linked.classes.entity,
    config: EmailAnnotationConfig,
  ): void {
    super.registerHandlers(srv, entity, config);
  }

  async init(): Promise<void> {
    const credentials = this.options?.credentials;
    if (!credentials) {
      throw new Error("No credentials configured for GraphMailService");
    }

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

  async sendEmail(payload: EmailPayload): Promise<void> {
    const graphPayload = this.buildGraphPayload(payload);

    try {
      await this.sendWithRetry(this.from, graphPayload);
      await super.sendEmail(payload);
    } catch (err) {
      LOG.error("Failed to send email via Microsoft Graph", err);
      await this.logEmail({
        entityName: payload.entityName,
        entityKey: payload.entityKey,
        recipient: payload.to,
        subject: payload.subject,
        status: EmailLog.status.failed,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  buildGraphPayload(payload: EmailPayload): GraphPayload {
    return {
      message: {
        subject: payload.subject,
        body: { contentType: "HTML", content: payload.body },
        toRecipients: this.formatGraphRecipients(payload.to),
        importance: "normal",
      },
      saveToSentItems: payload.saveToSentItems,
    };
  }

  formatGraphRecipients(email: string): GraphRecipient[] {
    return [{ emailAddress: { address: email } }];
  }

  async sendWithRetry(from: string, payload: GraphPayload, attempt = 0): Promise<void> {
    const maxRetries = this.options?.retryAttempts ?? DEFAULT_RETRY_ATTEMPTS;

    try {
      await this.graphApi.send("POST", `/users/${from}/sendMail`, payload);
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;

      if (status && RETRYABLE_STATUS_CODES.includes(status) && attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        LOG.warn(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms (status ${status})`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.sendWithRetry(from, payload, attempt + 1);
      }

      throw err;
    }
  }
}
