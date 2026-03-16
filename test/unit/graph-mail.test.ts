import GraphMailService from "../../lib/graph-mail.js";
import type { EmailPayload } from "../../lib/types.js";

const proto = GraphMailService.prototype;

const basePayload: EmailPayload = {
  from: "sender@example.com",
  to: "recipient@example.com",
  subject: "Test Subject",
  body: "<p>Hello</p>",
  entityName: "Orders",
  entityKey: "order-1",
  saveToSentItems: true,
};

describe("buildGraphPayload", () => {
  it("builds correct Graph API message structure", () => {
    const result = proto.buildGraphPayload(basePayload);

    expect(result).toEqual({
      message: {
        subject: "Test Subject",
        body: { contentType: "HTML", content: "<p>Hello</p>" },
        toRecipients: [{ emailAddress: { address: "recipient@example.com" } }],
        importance: "normal",
      },
      saveToSentItems: true,
    });
  });

  it("sets contentType to HTML", () => {
    const result = proto.buildGraphPayload(basePayload);
    expect(result.message.body.contentType).toBe("HTML");
  });

  it("passes saveToSentItems true from payload", () => {
    const result = proto.buildGraphPayload({ ...basePayload, saveToSentItems: true });
    expect(result.saveToSentItems).toBe(true);
  });

  it("passes saveToSentItems false from payload", () => {
    const result = proto.buildGraphPayload({ ...basePayload, saveToSentItems: false });
    expect(result.saveToSentItems).toBe(false);
  });

  it("sets importance to normal", () => {
    const result = proto.buildGraphPayload(basePayload);
    expect(result.message.importance).toBe("normal");
  });
});

describe("formatGraphRecipients", () => {
  it("maps a single email to Graph recipient format", () => {
    const result = proto.formatGraphRecipients("alice@example.com");

    expect(result).toEqual([{ emailAddress: { address: "alice@example.com" } }]);
  });

  it("preserves the exact email address", () => {
    const result = proto.formatGraphRecipients("Bob.Smith+tag@sub.domain.com");

    expect(result[0].emailAddress.address).toBe("Bob.Smith+tag@sub.domain.com");
  });
});
