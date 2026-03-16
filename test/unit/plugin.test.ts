import cds from "@sap/cds";
import { resolveRecipient } from "../../lib/plugin.js";
import { EMAIL_DEFAULTS, type EmailAnnotationConfig } from "../../lib/types.js";

const config = (overrides: Partial<EmailAnnotationConfig> = {}): EmailAnnotationConfig => ({
  ...EMAIL_DEFAULTS,
  enabled: true,
  ...overrides,
});

function fakeRequest(email?: string): cds.Request {
  return { user: { attr: { email } } } as unknown as cds.Request;
}

describe("resolveRecipient", () => {
  it("defaults to req.user.email when toField is not set", () => {
    const result = resolveRecipient(config(), {}, fakeRequest("alice@example.com"));
    expect(result).toBe("alice@example.com");
  });

  it("reads from entity data field when toField is specified", () => {
    const result = resolveRecipient(
      config({ toField: "contactEmail" }),
      { contactEmail: "bob@example.com" },
      fakeRequest("alice@example.com"),
    );
    expect(result).toBe("bob@example.com");
  });

  it("returns null and logs warning when req.user.email is undefined", () => {
    const result = resolveRecipient(config(), {}, fakeRequest(undefined));
    expect(result).toBeNull();
  });

  it("returns null and logs warning when toField points to missing field", () => {
    const result = resolveRecipient(config({ toField: "contactEmail" }), {}, fakeRequest("alice@example.com"));
    expect(result).toBeNull();
  });

  it("returns null when toField value is an empty string", () => {
    const result = resolveRecipient(
      config({ toField: "contactEmail" }),
      { contactEmail: "" },
      fakeRequest("alice@example.com"),
    );
    expect(result).toBeNull();
  });

  it("returns null when req.user.email is an empty string", () => {
    const result = resolveRecipient(config(), {}, fakeRequest(""));
    expect(result).toBeNull();
  });

  it("returns null when toField value is not a string", () => {
    const result = resolveRecipient(
      config({ toField: "contactEmail" }),
      { contactEmail: 42 },
      fakeRequest("alice@example.com"),
    );
    expect(result).toBeNull();
  });

  it("uses toField over req.user.email when both are available", () => {
    const result = resolveRecipient(
      config({ toField: "contactEmail" }),
      { contactEmail: "bob@example.com" },
      fakeRequest("alice@example.com"),
    );
    expect(result).toBe("bob@example.com");
  });
});
