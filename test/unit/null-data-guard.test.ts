import cds from "@sap/cds";
import EmailService from "../../lib/basic.js";
import { EMAIL_DEFAULTS, type EmailAnnotationConfig, type EmailPayload } from "../../lib/types.js";

const config = (overrides: Partial<EmailAnnotationConfig> = {}): EmailAnnotationConfig => ({
  ...EMAIL_DEFAULTS,
  enabled: true,
  template: "Orders",
  ...overrides,
});

type AfterHandler = (data: unknown, req: cds.Request) => Promise<void>;

class TrackingEmailService extends EmailService {
  sendEmailCalls: EmailPayload[] = [];

  async sendEmail(payload: EmailPayload): Promise<void> {
    this.sendEmailCalls.push(payload);
  }
}

function captureAfterHandler(
  service: TrackingEmailService,
  entityConfig?: Partial<EmailAnnotationConfig>,
): AfterHandler {
  let captured: AfterHandler | undefined;

  const fakeSrv = {
    after: (_event: string, _entity: string, handler: AfterHandler) => {
      captured = handler;
    },
  } as unknown as cds.ApplicationService;

  const fakeEntity = {
    name: "TestEntity",
    keys: { ID: {} },
  } as unknown as cds.linked.classes.entity;

  service.registerHandlers(fakeSrv, fakeEntity, config(entityConfig));
  return captured!;
}

function fakeRequest(): cds.Request {
  return {
    user: { id: "test@example.com", attr: {} },
  } as unknown as cds.Request;
}

describe("null/undefined data guard in handler loop", () => {
  let service: TrackingEmailService;

  beforeEach(() => {
    service = Object.create(TrackingEmailService.prototype) as TrackingEmailService;
    service.sendEmailCalls = [];
  });

  it("skips null data without crashing", async () => {
    const handler = captureAfterHandler(service);
    await handler(null, fakeRequest());
    expect(service.sendEmailCalls).toHaveLength(0);
  });

  it("skips undefined data without crashing", async () => {
    const handler = captureAfterHandler(service);
    await handler(undefined, fakeRequest());
    expect(service.sendEmailCalls).toHaveLength(0);
  });

  it("skips non-object data (string) without crashing", async () => {
    const handler = captureAfterHandler(service);
    await handler("not-an-object", fakeRequest());
    expect(service.sendEmailCalls).toHaveLength(0);
  });

  it("skips non-object data (number) without crashing", async () => {
    const handler = captureAfterHandler(service);
    await handler(42, fakeRequest());
    expect(service.sendEmailCalls).toHaveLength(0);
  });

  it("skips null entries in an array", async () => {
    const handler = captureAfterHandler(service);
    await handler([null, undefined], fakeRequest());
    expect(service.sendEmailCalls).toHaveLength(0);
  });

  it("processes valid object data normally", async () => {
    const handler = captureAfterHandler(service);
    await handler({ ID: "1", orderNumber: "ORD-001" }, fakeRequest());
    expect(service.sendEmailCalls).toHaveLength(1);
  });

  it("processes valid entries and skips null in mixed array", async () => {
    const handler = captureAfterHandler(service);
    await handler([{ ID: "1" }, null, { ID: "2" }], fakeRequest());
    expect(service.sendEmailCalls).toHaveLength(2);
  });
});
