import cds from "@sap/cds";
import { EmailLog } from "#cds-models/expertum/cap/email";

export interface EmailPayload {
  from: string;
  to: string;
  subject: string;
  body: string;
  entityName: string;
  entityKey: string;
  saveToSentItems: boolean;
}

export interface IEmailService extends cds.Service {
  registerHandlers(srv: cds.ApplicationService, entity: cds.linked.classes.entity, config: EmailAnnotationConfig): void;
  sendEmail(payload: EmailPayload): Promise<void>;
  logEmail(entry: EmailLog): Promise<void>;
}

export interface GraphRecipient {
  emailAddress: { address: string };
}

export interface GraphPayload {
  message: {
    subject: string;
    body: { contentType: "HTML"; content: string };
    toRecipients: GraphRecipient[];
    importance: "normal";
  };
  saveToSentItems: boolean;
}

export interface GraphMailOptions {
  credentials: Record<string, unknown>;
  destination: string;
  email: { from: string };
  retryAttempts?: number;
}

export interface IGraphMailService extends IEmailService {
  buildGraphPayload(payload: EmailPayload): GraphPayload;
  formatGraphRecipients(email: string): GraphRecipient[];
  sendWithRetry(from: string, payload: GraphPayload, attempt?: number): Promise<void>;
}

export interface EmailAnnotationConfig {
  enabled: boolean;
  template: string;
  trigger: string[];
  condition: string | undefined;
  recipient: string | undefined;
  recipientField: string | undefined;
  subject: string | undefined;
  rollback: boolean;
  saveToSentItems: boolean;
}

export const EMAIL_DEFAULTS: EmailAnnotationConfig = {
  enabled: false,
  template: "{EntityName}",
  trigger: ["INSERT"],
  condition: undefined,
  recipient: undefined,
  recipientField: undefined,
  subject: undefined,
  rollback: false,
  saveToSentItems: true,
};
