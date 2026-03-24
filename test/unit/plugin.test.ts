import cds from "@sap/cds";
import EmailService from "../../lib/basic.js";
import { EMAIL_DEFAULTS, type EmailAnnotationConfig } from "../../lib/types.js";

// Expose protected methods for unit testing
class TestableEmailService extends EmailService {
  public resolveRecipient(
    config: EmailAnnotationConfig,
    data: Record<string, unknown>,
    req: cds.Request,
  ): string | null {
    return super.resolveRecipient(config, data, req);
  }
}

const service = Object.create(TestableEmailService.prototype) as TestableEmailService;

const config = (overrides: Partial<EmailAnnotationConfig> = {}): EmailAnnotationConfig => ({
  ...EMAIL_DEFAULTS,
  enabled: true,
  ...overrides,
});

function fakeRequest(opts: { id?: string; attrEmail?: string } = {}): cds.Request {
  return {
    user: {
      id: opts.id ?? "",
      attr: { email: opts.attrEmail },
    },
  } as unknown as cds.Request;
}

describe("resolveRecipient", () => {
  it("uses req.user.id when it contains a valid email", () => {
    const result = service.resolveRecipient(config(), {}, fakeRequest({ id: "alice@example.com" }));
    expect(result).toBe("alice@example.com");
  });

  it("falls back to req.user.attr.email when req.user.id is not an email", () => {
    const result = service.resolveRecipient(
      config(),
      {},
      fakeRequest({ id: "alice123", attrEmail: "alice@example.com" }),
    );
    expect(result).toBe("alice@example.com");
  });

  it("reads from entity data field when recipientField is specified", () => {
    const result = service.resolveRecipient(
      config({ recipientField: "contactEmail" }),
      { contactEmail: "bob@example.com" },
      fakeRequest({ id: "alice@example.com" }),
    );
    expect(result).toBe("bob@example.com");
  });

  it("returns null when neither req.user.id nor req.user.attr.email resolve", () => {
    const result = service.resolveRecipient(config(), {}, fakeRequest({ id: "alice123" }));
    expect(result).toBeNull();
  });

  it("returns null when recipientField points to missing field", () => {
    const result = service.resolveRecipient(
      config({ recipientField: "contactEmail" }),
      {},
      fakeRequest({ id: "alice@example.com" }),
    );
    expect(result).toBeNull();
  });

  it("returns null when recipientField value is an empty string", () => {
    const result = service.resolveRecipient(
      config({ recipientField: "contactEmail" }),
      { contactEmail: "" },
      fakeRequest({ id: "alice@example.com" }),
    );
    expect(result).toBeNull();
  });

  it("returns null when recipientField value is not a string", () => {
    const result = service.resolveRecipient(
      config({ recipientField: "contactEmail" }),
      { contactEmail: 42 },
      fakeRequest({ id: "alice@example.com" }),
    );
    expect(result).toBeNull();
  });

  it("uses recipientField over req.user when both are available", () => {
    const result = service.resolveRecipient(
      config({ recipientField: "contactEmail" }),
      { contactEmail: "bob@example.com" },
      fakeRequest({ id: "alice@example.com" }),
    );
    expect(result).toBe("bob@example.com");
  });

  it("uses static recipient when configured", () => {
    const result = service.resolveRecipient(
      config({ recipient: "support@company.com" }),
      {},
      fakeRequest({ id: "alice@example.com" }),
    );
    expect(result).toBe("support@company.com");
  });

  it("uses static recipient over recipientField and req.user", () => {
    const result = service.resolveRecipient(
      config({ recipient: "support@company.com", recipientField: "contactEmail" }),
      { contactEmail: "bob@example.com" },
      fakeRequest({ id: "alice@example.com" }),
    );
    expect(result).toBe("support@company.com");
  });
});
