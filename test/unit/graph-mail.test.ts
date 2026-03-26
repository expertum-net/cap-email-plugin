import GraphMailService from "../../lib/graph-mail.js";
import { DEFAULT_MAX_RETRY_DELAY, DEFAULT_RETRY_ATTEMPTS } from "../../lib/constants.js";
import type { EmailPayload, GraphPayload } from "../../lib/types.js";

const proto = GraphMailService.prototype;

describe("init", () => {
  it("throws when email.from is missing", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- testing init validation
    const ctx: any = Object.create(proto);
    ctx.options = {};

    await expect(ctx.init()).rejects.toThrow("No sender address configured");
  });

  it("throws when email.from is missing but other options exist", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- testing init validation
    const ctx: any = Object.create(proto);
    ctx.options = { destination: "graph-api" };

    await expect(ctx.init()).rejects.toThrow("No sender address configured");
  });

  it("throws when destination is missing", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- testing init validation
    const ctx: any = Object.create(proto);
    ctx.options = { email: { from: "sender@example.com" } };

    await expect(ctx.init()).rejects.toThrow("No destination configured");
  });
});

const basePayload: EmailPayload = {
  from: "sender@example.com",
  to: "recipient@example.com",
  subject: "Test Subject",
  body: "<p>Hello</p>",
  entityName: "Orders",
  entityKey: "order-1",
  saveToSentItems: true,
};

type MockResult = { type: "resolve"; value: unknown } | { type: "reject"; value: unknown };

function createMockSend() {
  const calls: unknown[][] = [];
  const results: MockResult[] = [];
  let defaultResult: MockResult = { type: "resolve", value: undefined };

  const fn = async (...args: unknown[]) => {
    calls.push(args);
    const result = results.shift() ?? defaultResult;
    if (result.type === "reject") throw result.value;
    return result.value;
  };

  fn.calls = calls;
  fn.rejectOnce = (value: unknown) => {
    results.push({ type: "reject", value });
    return fn;
  };
  fn.alwaysReject = (value: unknown) => {
    defaultResult = { type: "reject", value };
    return fn;
  };

  return fn;
}

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

describe("sendWithRetry", () => {
  const from = "sender@example.com";
  const graphPayload: GraphPayload = {
    message: {
      subject: "Test",
      body: { contentType: "HTML", content: "<p>Test</p>" },
      toRecipients: [{ emailAddress: { address: "recipient@example.com" } }],
      importance: "normal",
    },
    saveToSentItems: true,
  };

  let mockSend: ReturnType<typeof createMockSend>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- testing private/readonly members
  let ctx: any;
  let recordedDelays: number[];
  const nativeSetTimeout = globalThis.setTimeout;

  beforeEach(() => {
    mockSend = createMockSend();
    ctx = Object.create(proto);
    ctx.graphApi = { send: mockSend };
    ctx.options = {};
    recordedDelays = [];
    globalThis.setTimeout = ((fn: () => void, ms: number) => {
      recordedDelays.push(ms);
      return nativeSetTimeout(fn, 0);
    }) as typeof globalThis.setTimeout;
  });

  afterEach(() => {
    globalThis.setTimeout = nativeSetTimeout;
  });

  it("sends successfully on first attempt without retrying", async () => {
    await ctx.sendWithRetry(from, graphPayload);

    expect(mockSend.calls).toHaveLength(1);
    expect(recordedDelays).toHaveLength(0);
  });

  it("calls correct Graph API endpoint", async () => {
    await ctx.sendWithRetry(from, graphPayload);

    expect(mockSend.calls[0]).toEqual(["POST", `/v1.0/users/${from}/sendMail`, graphPayload]);
  });

  it.each([429, 503, 504])("retries on %i status code", async (status) => {
    mockSend.rejectOnce({ status });

    await ctx.sendWithRetry(from, graphPayload);

    expect(mockSend.calls).toHaveLength(2);
  });

  it.each([400, 401, 403, 500])("does not retry on %i status code", async (status) => {
    mockSend.alwaysReject({ status });

    try {
      await ctx.sendWithRetry(from, graphPayload);
      expect("should have thrown").toBe(true);
    } catch (err: unknown) {
      expect((err as { status: number }).status).toBe(status);
    }
    expect(mockSend.calls).toHaveLength(1);
  });

  it("does not retry errors without status code", async () => {
    mockSend.alwaysReject(new Error("Network error"));

    await expect(ctx.sendWithRetry(from, graphPayload)).rejects.toThrow("Network error");
    expect(mockSend.calls).toHaveLength(1);
  });

  it("applies exponential backoff delays", async () => {
    mockSend.rejectOnce({ status: 429 }).rejectOnce({ status: 429 }).rejectOnce({ status: 429 });

    await ctx.sendWithRetry(from, graphPayload);

    expect(recordedDelays).toEqual([1000, 2000, 4000]);
  });

  it("throws after exhausting default max retries", async () => {
    mockSend.alwaysReject({ status: 429 });

    try {
      await ctx.sendWithRetry(from, graphPayload);
      expect("should have thrown").toBe(true);
    } catch (err: unknown) {
      expect((err as { status: number }).status).toBe(429);
    }
    expect(mockSend.calls).toHaveLength(DEFAULT_RETRY_ATTEMPTS + 1);
  });

  it("respects configurable retryAttempts from options", async () => {
    ctx.options = { retryAttempts: 1 };
    mockSend.alwaysReject({ status: 503 });

    try {
      await ctx.sendWithRetry(from, graphPayload);
      expect("should have thrown").toBe(true);
    } catch (err: unknown) {
      expect((err as { status: number }).status).toBe(503);
    }
    expect(mockSend.calls).toHaveLength(2);
  });

  it("retryAttempts: 0 disables retrying", async () => {
    ctx.options = { retryAttempts: 0 };
    mockSend.alwaysReject({ status: 429 });

    try {
      await ctx.sendWithRetry(from, graphPayload);
      expect("should have thrown").toBe(true);
    } catch (err: unknown) {
      expect((err as { status: number }).status).toBe(429);
    }
    expect(mockSend.calls).toHaveLength(1);
  });

  it("succeeds after transient failures within retry limit", async () => {
    mockSend.rejectOnce({ status: 503 }).rejectOnce({ status: 504 });

    await ctx.sendWithRetry(from, graphPayload);

    expect(mockSend.calls).toHaveLength(3);
    expect(recordedDelays).toEqual([1000, 2000]);
  });

  it("caps delay at DEFAULT_MAX_RETRY_DELAY", async () => {
    ctx.options = { retryAttempts: 20 };
    // Attempt 17 would produce 2^17 * 1000 = 131_072_000ms without the cap
    mockSend.rejectOnce({ status: 429 });

    await ctx.sendWithRetry(from, graphPayload, 17);

    expect(recordedDelays).toEqual([DEFAULT_MAX_RETRY_DELAY]);
  });

  it("respects configurable maxRetryDelay from options", async () => {
    ctx.options = { retryAttempts: 10, maxRetryDelay: 5000 };
    // Attempt 3 would produce 2^3 * 1000 = 8000ms, capped to 5000ms
    mockSend.rejectOnce({ status: 429 });

    await ctx.sendWithRetry(from, graphPayload, 3);

    expect(recordedDelays).toEqual([5000]);
  });

  it("does not cap delay when under the ceiling", async () => {
    ctx.options = { maxRetryDelay: 10000 };
    // Attempt 0 produces 1000ms, attempt 1 produces 2000ms — both under 10000ms
    mockSend.rejectOnce({ status: 429 }).rejectOnce({ status: 429 });

    await ctx.sendWithRetry(from, graphPayload);

    expect(recordedDelays).toEqual([1000, 2000]);
  });
});
