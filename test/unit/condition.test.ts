import cds from "@sap/cds";
import { evaluateCondition, validateCondition } from "../../lib/condition.js";

describe("evaluateCondition()", () => {
  describe("no condition (always send)", () => {
    it("returns true when condition is undefined", () => {
      expect(evaluateCondition(undefined, { status: "OPEN" })).toBe(true);
    });
  });

  describe("equality (=)", () => {
    it("returns true when field matches string value", () => {
      expect(evaluateCondition("status = 'RESOLVED'", { status: "RESOLVED" })).toBe(true);
    });

    it("returns false when field does not match", () => {
      expect(evaluateCondition("status = 'RESOLVED'", { status: "OPEN" })).toBe(false);
    });

    it("returns true when field matches numeric value", () => {
      expect(evaluateCondition("priority = 1", { priority: 1 })).toBe(true);
    });

    it("returns false when field is missing from data", () => {
      expect(evaluateCondition("status = 'RESOLVED'", {})).toBe(false);
    });
  });

  describe("inequality (!=, <>)", () => {
    it("returns true when field does not equal value (!=)", () => {
      expect(evaluateCondition("status != 'DRAFT'", { status: "OPEN" })).toBe(true);
    });

    it("returns false when field equals value (!=)", () => {
      expect(evaluateCondition("status != 'DRAFT'", { status: "DRAFT" })).toBe(false);
    });

    it("supports <> operator", () => {
      expect(evaluateCondition("status <> 'DRAFT'", { status: "OPEN" })).toBe(true);
    });
  });

  describe("numeric comparisons", () => {
    it("evaluates > correctly", () => {
      expect(evaluateCondition("amount > 100", { amount: 150 })).toBe(true);
      expect(evaluateCondition("amount > 100", { amount: 50 })).toBe(false);
    });

    it("evaluates < correctly", () => {
      expect(evaluateCondition("amount < 100", { amount: 50 })).toBe(true);
      expect(evaluateCondition("amount < 100", { amount: 150 })).toBe(false);
    });

    it("evaluates >= correctly", () => {
      expect(evaluateCondition("amount >= 100", { amount: 100 })).toBe(true);
      expect(evaluateCondition("amount >= 100", { amount: 99 })).toBe(false);
    });

    it("evaluates <= correctly", () => {
      expect(evaluateCondition("amount <= 100", { amount: 100 })).toBe(true);
      expect(evaluateCondition("amount <= 100", { amount: 101 })).toBe(false);
    });
  });

  describe("numeric type guards", () => {
    it("returns false when > operands are non-numeric strings", () => {
      expect(evaluateCondition("name > 'abc'", { name: "def" })).toBe(false);
    });

    it("returns false when < left operand is undefined", () => {
      expect(evaluateCondition("amount < 100", {})).toBe(false);
    });

    it("returns false when >= operand is NaN", () => {
      expect(evaluateCondition("amount >= 100", { amount: NaN })).toBe(false);
    });

    it("returns false when <= operands are strings", () => {
      expect(evaluateCondition("amount <= 100", { amount: "fifty" })).toBe(false);
    });
  });

  describe("null checks", () => {
    it("evaluates 'is null' for null value", () => {
      expect(evaluateCondition("email is null", { email: null })).toBe(true);
    });

    it("evaluates 'is null' for undefined value", () => {
      expect(evaluateCondition("email is null", {})).toBe(true);
    });

    it("evaluates 'is null' for non-null value", () => {
      expect(evaluateCondition("email is null", { email: "a@b.com" })).toBe(false);
    });

    it("evaluates 'is not null' for non-null value", () => {
      expect(evaluateCondition("email is not null", { email: "a@b.com" })).toBe(true);
    });

    it("evaluates 'is not null' for null value", () => {
      expect(evaluateCondition("email is not null", { email: null })).toBe(false);
    });
  });

  describe("in (list)", () => {
    it("returns true when value is in list", () => {
      expect(evaluateCondition("status in ('OPEN','CLOSED')", { status: "OPEN" })).toBe(true);
    });

    it("returns false when value is not in list", () => {
      expect(evaluateCondition("status in ('OPEN','CLOSED')", { status: "DRAFT" })).toBe(false);
    });
  });

  describe("between", () => {
    it("returns true when value is in range", () => {
      expect(evaluateCondition("amount between 10 and 100", { amount: 50 })).toBe(true);
    });

    it("returns true on boundary values", () => {
      expect(evaluateCondition("amount between 10 and 100", { amount: 10 })).toBe(true);
      expect(evaluateCondition("amount between 10 and 100", { amount: 100 })).toBe(true);
    });

    it("returns false when value is out of range", () => {
      expect(evaluateCondition("amount between 10 and 100", { amount: 5 })).toBe(false);
    });

    it("returns false when operands are not numeric", () => {
      expect(evaluateCondition("amount between 10 and 100", { amount: "fifty" })).toBe(false);
    });
  });

  describe("logical operators", () => {
    it("evaluates 'and' — both true", () => {
      expect(
        evaluateCondition("status = 'RESOLVED' and priority = 1", {
          status: "RESOLVED",
          priority: 1,
        }),
      ).toBe(true);
    });

    it("evaluates 'and' — one false", () => {
      expect(
        evaluateCondition("status = 'RESOLVED' and priority = 1", {
          status: "RESOLVED",
          priority: 2,
        }),
      ).toBe(false);
    });

    it("evaluates 'or' — one true", () => {
      expect(
        evaluateCondition("status = 'OPEN' or status = 'RESOLVED'", {
          status: "RESOLVED",
        }),
      ).toBe(true);
    });

    it("evaluates 'or' — both false", () => {
      expect(
        evaluateCondition("status = 'OPEN' or status = 'RESOLVED'", {
          status: "DRAFT",
        }),
      ).toBe(false);
    });

    it("respects 'and' over 'or' precedence", () => {
      // a=1 and b=2 or c=3  →  (a=1 AND b=2) OR c=3
      expect(evaluateCondition("a = 1 and b = 2 or c = 3", { a: 1, b: 2, c: 0 })).toBe(true); // first AND group true

      expect(evaluateCondition("a = 1 and b = 2 or c = 3", { a: 0, b: 0, c: 3 })).toBe(true); // second OR group true

      expect(evaluateCondition("a = 1 and b = 2 or c = 3", { a: 1, b: 0, c: 0 })).toBe(false); // neither group true
    });
  });

  describe("nested expressions (parentheses)", () => {
    it("evaluates nested xpr", () => {
      // a = 1 and (b = 2 or c = 3)
      expect(evaluateCondition("a = 1 and (b = 2 or c = 3)", { a: 1, b: 0, c: 3 })).toBe(true);

      expect(evaluateCondition("a = 1 and (b = 2 or c = 3)", { a: 1, b: 0, c: 0 })).toBe(false);
    });
  });

  describe("error handling", () => {
    it("returns false for malformed condition", () => {
      expect(evaluateCondition("not a valid %%% expression &&&", { status: "OPEN" })).toBe(false);
    });

    it("logs error via cds.log on parse failure", () => {
      const LOG = cds.log("email:condition");
      const originalError = LOG.error;
      const errorCalls: unknown[][] = [];
      LOG.error = ((...args: unknown[]) => {
        errorCalls.push(args);
      }) as typeof LOG.error;

      try {
        evaluateCondition("not a valid %%% expression &&&", { status: "OPEN" });
        expect(errorCalls).toHaveLength(1);
        expect(errorCalls[0][0]).toContain("Failed to parse condition");
      } finally {
        LOG.error = originalError;
      }
    });
  });
});

describe("validateCondition()", () => {
  it("does nothing when condition is undefined", () => {
    expect(() => validateCondition(undefined, "TestEntity")).not.toThrow();
  });

  it("does nothing for valid condition syntax", () => {
    expect(() => validateCondition("status = 'RESOLVED'", "TestEntity")).not.toThrow();
  });

  it("throws on invalid condition syntax with entity name", () => {
    expect(() => validateCondition("not a valid %%% expression &&&", "MyService.Tickets")).toThrow(
      /Invalid @email\.condition on MyService\.Tickets.*not a valid %%% expression &&&/,
    );
  });
});
