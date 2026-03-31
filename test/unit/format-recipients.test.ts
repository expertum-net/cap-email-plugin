import EmailService from "../../lib/basic.js";

class TestableEmailService extends EmailService {
  public formatRecipients(input: string | string[]): string[] {
    return super.formatRecipients(input);
  }
}

const service = Object.create(TestableEmailService.prototype) as TestableEmailService;

describe("formatRecipients", () => {
  it("wraps a single string in an array", () => {
    expect(service.formatRecipients("a@b.com")).toEqual(["a@b.com"]);
  });

  it("returns an array as-is", () => {
    expect(service.formatRecipients(["a@b.com", "c@d.com"])).toEqual(["a@b.com", "c@d.com"]);
  });

  it("returns a single-element array as-is", () => {
    expect(service.formatRecipients(["a@b.com"])).toEqual(["a@b.com"]);
  });

  it("returns an empty array as-is", () => {
    expect(service.formatRecipients([])).toEqual([]);
  });
});
