import cds from "@sap/cds";
import { parseEmailAnnotation } from "../../lib/plugin.js";
import { EMAIL_DEFAULTS } from "../../lib/types.js";

function fakeEntity(name: string, annotations: Record<string, unknown> = {}): cds.linked.classes.entity {
  return { name, ...annotations } as unknown as cds.linked.classes.entity;
}

describe("parseEmailAnnotation", () => {
  describe("enabled detection", () => {
    it("returns null when entity has no @email annotation", () => {
      expect(parseEmailAnnotation(fakeEntity("test.Orders"))).toBeNull();
    });

    it("returns null when @email.enabled is false", () => {
      expect(parseEmailAnnotation(fakeEntity("test.Orders", { "@email.enabled": false }))).toBeNull();
    });

    it("returns null when @email object has enabled: false", () => {
      expect(parseEmailAnnotation(fakeEntity("test.Orders", { "@email": { enabled: false } }))).toBeNull();
    });

    it("returns config when @email.enabled is true (flat syntax)", () => {
      const result = parseEmailAnnotation(fakeEntity("test.Orders", { "@email.enabled": true }));
      expect(result).toHaveProperty("enabled", true);
    });

    it("returns config when @email object has enabled: true", () => {
      const result = parseEmailAnnotation(fakeEntity("test.Orders", { "@email": { enabled: true } }));
      expect(result).toHaveProperty("enabled", true);
    });

    it("object annotation enabled takes precedence over flat", () => {
      const result = parseEmailAnnotation(
        fakeEntity("test.Orders", {
          "@email": { enabled: true },
          "@email.enabled": false,
        }),
      );
      expect(result).not.toBeNull();
    });
  });

  describe("defaults", () => {
    it("applies all defaults when only enabled is set", () => {
      const result = parseEmailAnnotation(fakeEntity("test.email.Orders", { "@email.enabled": true }));
      expect(result).toMatchObject({
        enabled: true,
        template: "Orders",
        trigger: ["INSERT"],
        condition: undefined,
        recipient: undefined,
        recipientField: undefined,
        cc: undefined,
        bcc: undefined,
        subject: undefined,
        rollback: false,
        saveToSentItems: true,
      });
    });
  });

  describe("template name resolution", () => {
    it("uses entity short name as template when no template specified", () => {
      const result = parseEmailAnnotation(fakeEntity("some.namespace.Invoices", { "@email.enabled": true }));
      expect(result).toHaveProperty("template", "Invoices");
    });

    it("uses entity name directly when no namespace", () => {
      const result = parseEmailAnnotation(fakeEntity("Orders", { "@email.enabled": true }));
      expect(result).toHaveProperty("template", "Orders");
    });

    it("uses explicit template when specified via object annotation", () => {
      const result = parseEmailAnnotation(
        fakeEntity("test.Orders", {
          "@email": { enabled: true, template: "custom-order" },
        }),
      );
      expect(result).toHaveProperty("template", "custom-order");
    });

    it("uses explicit template when specified via flat annotation", () => {
      const result = parseEmailAnnotation(
        fakeEntity("test.Orders", {
          "@email.enabled": true,
          "@email.template": "custom-order",
        }),
      );
      expect(result).toHaveProperty("template", "custom-order");
    });
  });

  describe("flat annotation overrides", () => {
    it("reads trigger from flat annotation", () => {
      const result = parseEmailAnnotation(
        fakeEntity("test.Orders", {
          "@email.enabled": true,
          "@email.trigger": ["INSERT", "UPDATE"],
        }),
      );
      expect(result).toHaveProperty("trigger", ["INSERT", "UPDATE"]);
    });

    it("reads recipientField from flat annotation", () => {
      const result = parseEmailAnnotation(
        fakeEntity("test.Orders", {
          "@email.enabled": true,
          "@email.recipientField": "contactEmail",
        }),
      );
      expect(result).toHaveProperty("recipientField", "contactEmail");
    });

    it("reads subject from flat annotation", () => {
      const result = parseEmailAnnotation(
        fakeEntity("test.Orders", {
          "@email.enabled": true,
          "@email.subject": "Order {{orderNumber}}",
        }),
      );
      expect(result).toHaveProperty("subject", "Order {{orderNumber}}");
    });

    it("reads rollback from flat annotation", () => {
      const result = parseEmailAnnotation(
        fakeEntity("test.Orders", {
          "@email.enabled": true,
          "@email.rollback": true,
        }),
      );
      expect(result).toHaveProperty("rollback", true);
    });

    it("reads saveToSentItems from flat annotation", () => {
      const result = parseEmailAnnotation(
        fakeEntity("test.Orders", {
          "@email.enabled": true,
          "@email.saveToSentItems": false,
        }),
      );
      expect(result).toHaveProperty("saveToSentItems", false);
    });
  });

  describe("object annotation overrides", () => {
    it("reads all properties from object annotation", () => {
      const result = parseEmailAnnotation(
        fakeEntity("test.Tickets", {
          "@email": {
            enabled: true,
            template: "ticket-update",
            trigger: ["INSERT", "UPDATE"],
            condition: "status = 'RESOLVED'",
            recipientField: "contactEmail",
            subject: "Ticket {{ticketNumber}} — {{status}}",
            rollback: true,
            saveToSentItems: false,
          },
        }),
      );
      expect(result).toMatchObject({
        enabled: true,
        template: "ticket-update",
        trigger: ["INSERT", "UPDATE"],
        condition: "status = 'RESOLVED'",
        recipientField: "contactEmail",
        subject: "Ticket {{ticketNumber}} — {{status}}",
        rollback: true,
        saveToSentItems: false,
      });
    });
  });

  describe("recipient / recipientField XOR validation", () => {
    it("normalizes recipient string to array (object annotation)", () => {
      const result = parseEmailAnnotation(
        fakeEntity("test.Orders", {
          "@email": { enabled: true, recipient: "support@company.com" },
        }),
      );
      expect(result?.recipient).toEqual(["support@company.com"]);
      expect(result).toHaveProperty("recipientField", undefined);
    });

    it("normalizes recipient string to array (flat annotation)", () => {
      const result = parseEmailAnnotation(
        fakeEntity("test.Orders", {
          "@email.enabled": true,
          "@email.recipient": "support@company.com",
        }),
      );
      expect(result?.recipient).toEqual(["support@company.com"]);
    });

    it("reads recipient as array from object annotation", () => {
      const result = parseEmailAnnotation(
        fakeEntity("test.Orders", {
          "@email": { enabled: true, recipient: ["a@co.com", "b@co.com"] },
        }),
      );
      expect(result?.recipient).toEqual(["a@co.com", "b@co.com"]);
    });

    it("throws when recipient contains invalid email", () => {
      expect(() =>
        parseEmailAnnotation(
          fakeEntity("test.Orders", {
            "@email": { enabled: true, recipient: "not-an-email" },
          }),
        ),
      ).toThrow("Invalid email in @email.recipient");
    });

    it("returns config when only recipientField is set", () => {
      const result = parseEmailAnnotation(
        fakeEntity("test.Orders", {
          "@email": { enabled: true, recipientField: "contactEmail" },
        }),
      );
      expect(result).toHaveProperty("recipientField", "contactEmail");
      expect(result).toHaveProperty("recipient", undefined);
    });

    it("throws when both recipient and recipientField are set (object annotation)", () => {
      expect(() =>
        parseEmailAnnotation(
          fakeEntity("test.Orders", {
            "@email": {
              enabled: true,
              recipient: "support@company.com",
              recipientField: "contactEmail",
            },
          }),
        ),
      ).toThrow("mutually exclusive");
    });

    it("throws when both recipient and recipientField are set (flat annotation)", () => {
      expect(() =>
        parseEmailAnnotation(
          fakeEntity("test.Orders", {
            "@email.enabled": true,
            "@email.recipient": "support@company.com",
            "@email.recipientField": "contactEmail",
          }),
        ),
      ).toThrow("mutually exclusive");
    });

    it("throws when both are set across object and flat annotations", () => {
      expect(() =>
        parseEmailAnnotation(
          fakeEntity("test.Orders", {
            "@email": { enabled: true, recipient: "support@company.com" },
            "@email.recipientField": "contactEmail",
          }),
        ),
      ).toThrow("mutually exclusive");
    });
  });

  describe("condition validation", () => {
    it("throws when @email.condition has invalid syntax", () => {
      expect(() =>
        parseEmailAnnotation(
          fakeEntity("test.Orders", {
            "@email": { enabled: true, condition: "not valid %%% syntax" },
          }),
        ),
      ).toThrow(/Invalid @email\.condition/);
    });
  });

  describe("merge precedence", () => {
    it("flat annotation overrides object annotation for same property", () => {
      const result = parseEmailAnnotation(
        fakeEntity("test.Orders", {
          "@email": { enabled: true, recipientField: "fromObject" },
          "@email.recipientField": "fromFlat",
        }),
      );
      expect(result).toHaveProperty("recipientField", "fromFlat");
    });

    it("flat annotation overrides defaults", () => {
      const result = parseEmailAnnotation(
        fakeEntity("test.Orders", {
          "@email.enabled": true,
          "@email.rollback": true,
        }),
      );
      expect(result).toHaveProperty("rollback", true);
      expect(EMAIL_DEFAULTS.rollback).toBe(false);
    });
  });

  describe("cc and bcc annotations", () => {
    it("normalizes cc string to array from flat annotation", () => {
      const result = parseEmailAnnotation(
        fakeEntity("test.Orders", {
          "@email.enabled": true,
          "@email.cc": "cc@example.com",
        }),
      );
      expect(result).toHaveProperty("cc", ["cc@example.com"]);
    });

    it("reads cc as array from object annotation", () => {
      const result = parseEmailAnnotation(
        fakeEntity("test.Orders", {
          "@email": { enabled: true, cc: ["a@b.com", "c@d.com"] },
        }),
      );
      expect(result).toHaveProperty("cc", ["a@b.com", "c@d.com"]);
    });

    it("normalizes bcc string to array from flat annotation", () => {
      const result = parseEmailAnnotation(
        fakeEntity("test.Orders", {
          "@email.enabled": true,
          "@email.bcc": "bcc@example.com",
        }),
      );
      expect(result).toHaveProperty("bcc", ["bcc@example.com"]);
    });

    it("reads bcc as array from object annotation", () => {
      const result = parseEmailAnnotation(
        fakeEntity("test.Orders", {
          "@email": { enabled: true, bcc: ["a@b.com", "c@d.com"] },
        }),
      );
      expect(result).toHaveProperty("bcc", ["a@b.com", "c@d.com"]);
    });

    it("defaults cc and bcc to undefined", () => {
      const result = parseEmailAnnotation(fakeEntity("test.Orders", { "@email.enabled": true }));
      expect(result).toHaveProperty("cc", undefined);
      expect(result).toHaveProperty("bcc", undefined);
    });

    it("throws when cc contains invalid email", () => {
      expect(() =>
        parseEmailAnnotation(
          fakeEntity("test.Orders", {
            "@email": { enabled: true, cc: ["not-an-email"] },
          }),
        ),
      ).toThrow("Invalid email in @email.cc");
    });

    it("throws when bcc contains invalid email", () => {
      expect(() =>
        parseEmailAnnotation(
          fakeEntity("test.Orders", {
            "@email": { enabled: true, bcc: ["not-an-email"] },
          }),
        ),
      ).toThrow("Invalid email in @email.bcc");
    });

    it("throws when cc is not string or string[]", () => {
      expect(() =>
        parseEmailAnnotation(
          fakeEntity("test.Orders", {
            "@email": { enabled: true, cc: 42 },
          }),
        ),
      ).toThrow("Invalid @email.cc");
    });

    it("throws when bcc is not string or string[]", () => {
      expect(() =>
        parseEmailAnnotation(
          fakeEntity("test.Orders", {
            "@email": { enabled: true, bcc: true },
          }),
        ),
      ).toThrow("Invalid @email.bcc");
    });

    it("throws when recipient is an empty array", () => {
      expect(() =>
        parseEmailAnnotation(
          fakeEntity("test.Orders", {
            "@email": { enabled: true, recipient: [] },
          }),
        ),
      ).toThrow("Empty @email.recipient");
    });

    it("throws when cc is an empty array", () => {
      expect(() =>
        parseEmailAnnotation(
          fakeEntity("test.Orders", {
            "@email": { enabled: true, cc: [] },
          }),
        ),
      ).toThrow("Empty @email.cc");
    });

    it("throws when bcc is an empty array", () => {
      expect(() =>
        parseEmailAnnotation(
          fakeEntity("test.Orders", {
            "@email": { enabled: true, bcc: [] },
          }),
        ),
      ).toThrow("Empty @email.bcc");
    });
  });
});
