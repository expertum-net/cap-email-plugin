import EmailService from "../../lib/basic.js";

const proto = EmailService.prototype;

function callResolveFieldRecipients(
  staticList: string[] | undefined,
  field: string | undefined,
  fieldName: string,
  data: Record<string, unknown> = {},
): string[] | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- calling protected method for testing
  return (proto as any).resolveFieldRecipients(staticList, field, fieldName, data);
}

describe("resolveFieldRecipients", () => {
  it("returns static list when provided", () => {
    const result = callResolveFieldRecipients(["a@b.com"], "someField", "ccField");
    expect(result).toEqual(["a@b.com"]);
  });

  it("returns undefined when neither static list nor field is provided", () => {
    const result = callResolveFieldRecipients(undefined, undefined, "ccField");
    expect(result).toBeUndefined();
  });

  it("resolves valid email from entity data field", () => {
    const result = callResolveFieldRecipients(undefined, "managerEmail", "ccField", {
      managerEmail: "manager@company.com",
    });
    expect(result).toEqual(["manager@company.com"]);
  });

  it("returns undefined when field value is missing from entity data", () => {
    const result = callResolveFieldRecipients(undefined, "managerEmail", "ccField", {});
    expect(result).toBeUndefined();
  });

  it("returns undefined when field value is empty string", () => {
    const result = callResolveFieldRecipients(undefined, "managerEmail", "ccField", { managerEmail: "" });
    expect(result).toBeUndefined();
  });

  it("returns undefined when field value is not a string", () => {
    const result = callResolveFieldRecipients(undefined, "managerEmail", "ccField", { managerEmail: 42 });
    expect(result).toBeUndefined();
  });

  it("returns undefined when field value has invalid email format", () => {
    const result = callResolveFieldRecipients(undefined, "managerEmail", "ccField", {
      managerEmail: "not-an-email",
    });
    expect(result).toBeUndefined();
  });
});
