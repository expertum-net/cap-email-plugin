import cds from "@sap/cds";
import { resolveRecipient } from "../../lib/plugin.js";
import { EMAIL_DEFAULTS, type EmailAnnotationConfig } from "../../lib/types.js";

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
    const result = resolveRecipient(config(), {}, fakeRequest({ id: "alice@example.com" }));
    expect(result).toBe("alice@example.com");
  });

  it("falls back to req.user.attr.email when req.user.id is not an email", () => {
    const result = resolveRecipient(config(), {}, fakeRequest({ id: "alice123", attrEmail: "alice@example.com" }));
    expect(result).toBe("alice@example.com");
  });

  it("reads from entity data field when toField is specified", () => {
    const result = resolveRecipient(
      config({ toField: "contactEmail" }),
      { contactEmail: "bob@example.com" },
      fakeRequest({ id: "alice@example.com" }),
    );
    expect(result).toBe("bob@example.com");
  });

  it("returns null when neither req.user.id nor req.user.attr.email resolve", () => {
    const result = resolveRecipient(config(), {}, fakeRequest({ id: "alice123" }));
    expect(result).toBeNull();
  });

  it("returns null when toField points to missing field", () => {
    const result = resolveRecipient(config({ toField: "contactEmail" }), {}, fakeRequest({ id: "alice@example.com" }));
    expect(result).toBeNull();
  });

  it("returns null when toField value is an empty string", () => {
    const result = resolveRecipient(
      config({ toField: "contactEmail" }),
      { contactEmail: "" },
      fakeRequest({ id: "alice@example.com" }),
    );
    expect(result).toBeNull();
  });

  it("returns null when toField value is not a string", () => {
    const result = resolveRecipient(
      config({ toField: "contactEmail" }),
      { contactEmail: 42 },
      fakeRequest({ id: "alice@example.com" }),
    );
    expect(result).toBeNull();
  });

  it("uses toField over req.user when both are available", () => {
    const result = resolveRecipient(
      config({ toField: "contactEmail" }),
      { contactEmail: "bob@example.com" },
      fakeRequest({ id: "alice@example.com" }),
    );
    expect(result).toBe("bob@example.com");
  });
});
