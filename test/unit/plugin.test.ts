import cds from "@sap/cds";
import EmailService from "../../lib/basic.js";
import { EMAIL_DEFAULTS, type EmailAnnotationConfig } from "../../lib/types.js";

// Expose protected methods for unit testing
class TestableEmailService extends EmailService {
  public resolveRecipient(
    config: EmailAnnotationConfig,
    data: Record<string, unknown>,
    req: cds.Request,
  ): string | string[] | null {
    return super.resolveRecipient(config, data, req);
  }

  public resolveSubject(config: EmailAnnotationConfig, data: Record<string, unknown>): string {
    return super.resolveSubject(config, data);
  }

  public resolveEntityKey(entity: cds.linked.classes.entity, data: Record<string, unknown>): string {
    return super.resolveEntityKey(entity, data);
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
      config({ recipient: ["support@company.com"] }),
      {},
      fakeRequest({ id: "alice@example.com" }),
    );
    expect(result).toEqual(["support@company.com"]);
  });

  it("returns multiple static recipients as array", () => {
    const result = service.resolveRecipient(
      config({ recipient: ["a@co.com", "b@co.com"] }),
      {},
      fakeRequest({ id: "alice@example.com" }),
    );
    expect(result).toEqual(["a@co.com", "b@co.com"]);
  });

  it("uses static recipient over recipientField and req.user", () => {
    const result = service.resolveRecipient(
      config({ recipient: ["support@company.com"], recipientField: "contactEmail" }),
      { contactEmail: "bob@example.com" },
      fakeRequest({ id: "alice@example.com" }),
    );
    expect(result).toEqual(["support@company.com"]);
  });

  it("returns null when recipientField value is explicitly null", () => {
    const result = service.resolveRecipient(
      config({ recipientField: "contactEmail" }),
      { contactEmail: null },
      fakeRequest({ id: "alice@example.com" }),
    );
    expect(result).toBeNull();
  });

  it("returns null when recipientField value is explicitly undefined", () => {
    const result = service.resolveRecipient(
      config({ recipientField: "contactEmail" }),
      { contactEmail: undefined },
      fakeRequest({ id: "alice@example.com" }),
    );
    expect(result).toBeNull();
  });

  it("returns null when req.user is undefined", () => {
    const result = service.resolveRecipient(config(), {}, { user: undefined } as unknown as cds.Request);
    expect(result).toBeNull();
  });

  it("returns null when req.user.attr is undefined", () => {
    const result = service.resolveRecipient(config(), {}, {
      user: { id: "not-an-email", attr: undefined },
    } as unknown as cds.Request);
    expect(result).toBeNull();
  });
});

function fakeEntity(keyNames: string[]): cds.linked.classes.entity {
  return {
    name: "TestEntity",
    keys: Object.fromEntries(keyNames.map((k) => [k, {}])),
  } as unknown as cds.linked.classes.entity;
}

describe("resolveSubject", () => {
  it("renders placeholders when config.subject is set", () => {
    const result = service.resolveSubject(config({ subject: "Order {{orderNumber}} confirmed" }), {
      orderNumber: "ORD-001",
    });
    expect(result).toBe("Order ORD-001 confirmed");
  });

  it("returns subject as-is when no placeholders exist", () => {
    const result = service.resolveSubject(config({ subject: "New order received" }), {});
    expect(result).toBe("New order received");
  });

  it("derives subject from template name when no subject configured", () => {
    const result = service.resolveSubject(config({ subject: undefined, template: "Orders" }), {});
    expect(result).toBe("Orders");
  });

  it("uses last segment of template path with slashes", () => {
    const result = service.resolveSubject(config({ subject: undefined, template: "notifications/alert" }), {});
    expect(result).toBe("alert");
  });
});

describe("resolveEntityKey", () => {
  it("returns single key value", () => {
    const result = service.resolveEntityKey(fakeEntity(["ID"]), { ID: "abc-123" });
    expect(result).toBe("abc-123");
  });

  it("returns comma-separated composite keys", () => {
    const result = service.resolveEntityKey(fakeEntity(["tenant", "ID"]), { tenant: "t1", ID: "abc" });
    expect(result).toBe("t1,abc");
  });

  it("returns empty string for missing key values", () => {
    const result = service.resolveEntityKey(fakeEntity(["ID"]), {});
    expect(result).toBe("");
  });

  it("returns empty string when entity has no keys", () => {
    const result = service.resolveEntityKey(fakeEntity([]), { ID: "abc" });
    expect(result).toBe("");
  });

  it("coerces non-string key values to string", () => {
    const result = service.resolveEntityKey(fakeEntity(["seq"]), { seq: 42 });
    expect(result).toBe("42");
  });
});
