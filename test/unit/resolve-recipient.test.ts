import EmailService from "../../lib/basic.js";
import type { EmailAnnotationConfig } from "../../lib/types.js";

const proto = EmailService.prototype;

function callResolveRecipient(
  config: Partial<EmailAnnotationConfig>,
  data: Record<string, unknown> = {},
  req: { user: { id: string; attr: Record<string, unknown> } } = { user: { id: "", attr: {} } },
): string | string[] | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- calling protected method for testing
  return (proto as any).resolveRecipient(config, data, req);
}

describe("resolveRecipient — email validation", () => {
  it("returns static recipient array as-is", () => {
    const result = callResolveRecipient({ recipient: ["admin@company.com"] });
    expect(result).toEqual(["admin@company.com"]);
  });

  it("returns multiple static recipients as array", () => {
    const result = callResolveRecipient({ recipient: ["a@co.com", "b@co.com"] });
    expect(result).toEqual(["a@co.com", "b@co.com"]);
  });

  it("accepts valid recipientField value from entity data", () => {
    const result = callResolveRecipient({ recipientField: "contactEmail" }, { contactEmail: "contact@example.com" });
    expect(result).toBe("contact@example.com");
  });

  it("rejects recipientField value with invalid email format", () => {
    const result = callResolveRecipient({ recipientField: "contactEmail" }, { contactEmail: "just-a-name" });
    expect(result).toBeNull();
  });

  it("returns null when recipientField value is missing from entity data", () => {
    const result = callResolveRecipient({ recipientField: "contactEmail" }, {});
    expect(result).toBeNull();
  });

  it("accepts valid req.user.id when it matches email pattern", () => {
    const result = callResolveRecipient({}, {}, { user: { id: "alice@example.com", attr: {} } });
    expect(result).toBe("alice@example.com");
  });

  it("falls through to req.user.attr.email when req.user.id is not an email", () => {
    const result = callResolveRecipient(
      {},
      {},
      {
        user: { id: "some-guid-123", attr: { email: "alice@example.com" } },
      },
    );
    expect(result).toBe("alice@example.com");
  });

  it("accepts valid req.user.attr.email", () => {
    const result = callResolveRecipient(
      {},
      {},
      {
        user: { id: "guid", attr: { email: "bob@example.com" } },
      },
    );
    expect(result).toBe("bob@example.com");
  });

  it("rejects req.user.attr.email with invalid email format", () => {
    const result = callResolveRecipient(
      {},
      {},
      {
        user: { id: "guid", attr: { email: "invalid-email" } },
      },
    );
    expect(result).toBeNull();
  });

  it("returns null when no recipient source has a value", () => {
    const result = callResolveRecipient({}, {}, { user: { id: "", attr: {} } });
    expect(result).toBeNull();
  });
});
