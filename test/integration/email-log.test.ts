import cds from "@sap/cds";
import path from "node:path";
import { EmailLog, EmailLog_ } from "#cds-models/expertum/cap/email";
import type EmailService from "../../lib/basic.js";

cds.test(path.resolve(import.meta.dirname, "../test-app"));

describe("EmailService.logEmail", () => {
  let emailService: EmailService;

  beforeAll(async () => {
    emailService = (await cds.connect.to("email")) as EmailService;
  });

  afterEach(async () => {
    await DELETE.from(EmailLog_);
  });

  it("creates a log entry on successful email send", async () => {
    await emailService.logEmail({
      entityName: "Orders",
      entityKey: "order-123",
      recipient: "test@example.com",
      subject: "Order Confirmed",
      status: EmailLog.status.sent,
    });

    const logs = await SELECT.from(EmailLog);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      entityName: "Orders",
      entityKey: "order-123",
      recipient: "test@example.com",
      subject: "Order Confirmed",
      status: "sent",
    });
    expect(logs[0].error).toBeNull();
  });

  it("creates a log entry on failed email send with error details", async () => {
    await emailService.logEmail({
      entityName: "Tickets",
      entityKey: "ticket-456",
      recipient: "user@example.com",
      subject: "Ticket Update",
      status: EmailLog.status.failed,
      error: "SMTP connection refused",
    });

    const logs = await SELECT.from(EmailLog);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      entityName: "Tickets",
      entityKey: "ticket-456",
      recipient: "user@example.com",
      subject: "Ticket Update",
      status: "failed",
      error: "SMTP connection refused",
    });
  });

  it("populates all fields including auto-generated ID and timestamps", async () => {
    await emailService.logEmail({
      entityName: "Orders",
      entityKey: "key-789",
      recipient: "alice@example.com",
      subject: "Full Fields Test",
      status: EmailLog.status.sent,
    });

    const [log] = await SELECT.from(EmailLog);
    expect(log.entityName).toBe("Orders");
    expect(log.entityKey).toBe("key-789");
    expect(log.recipient).toBe("alice@example.com");
    expect(log.subject).toBe("Full Fields Test");
    expect(log.status).toBe("sent");
    expect(log.ID).toBeDefined();
    expect(log.createdAt).toBeDefined();
  });

  it("does not throw when log insert fails", async () => {
    // Pass an object that will cause a DB error (status exceeds enum values)
    // logEmail should catch internally and not propagate
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- intentionally invalid data
      emailService.logEmail({ invalid: "data" } as unknown as EmailLog),
    ).resolves.toBeUndefined();
  });
});

describe("EmailService.sendEmail", () => {
  let emailService: EmailService;

  beforeAll(async () => {
    emailService = (await cds.connect.to("email")) as EmailService;
  });

  afterEach(async () => {
    await DELETE.from(EmailLog_);
  });

  it("logs a sent entry with entity context from payload", async () => {
    await emailService.sendEmail({
      from: "sender@example.com",
      to: "recipient@example.com",
      subject: "Test Subject",
      body: "<p>Hello</p>",
      entityName: "Orders",
      entityKey: "order-001",
      saveToSentItems: true,
    });

    const [log] = await SELECT.from(EmailLog);
    expect(log).toMatchObject({
      entityName: "Orders",
      entityKey: "order-001",
      recipient: "recipient@example.com",
      subject: "Test Subject",
      status: "sent",
    });
    expect(log.error).toBeNull();
  });

  it("logs a failed entry when dispatchEmail throws", async () => {
    const original = emailService.dispatchEmail.bind(emailService);
    emailService.dispatchEmail = async () => {
      throw new Error("Provider connection failed");
    };

    try {
      await emailService.sendEmail({
        from: "sender@example.com",
        to: "recipient@example.com",
        subject: "Test Failure",
        body: "<p>Hello</p>",
        entityName: "Orders",
        entityKey: "order-fail",
        saveToSentItems: true,
      });
    } catch {
      // Expected — sendEmail re-throws after logging
    } finally {
      emailService.dispatchEmail = original;
    }

    const [log] = await SELECT.from(EmailLog);
    expect(log).toMatchObject({
      entityName: "Orders",
      entityKey: "order-fail",
      recipient: "recipient@example.com",
      subject: "Test Failure",
      status: "failed",
      error: "Provider connection failed",
    });
  });

  it("re-throws error after logging failure", async () => {
    const original = emailService.dispatchEmail.bind(emailService);
    emailService.dispatchEmail = async () => {
      throw new Error("Provider connection failed");
    };

    await expect(
      emailService.sendEmail({
        from: "sender@example.com",
        to: "recipient@example.com",
        subject: "Test",
        body: "",
        entityName: "Orders",
        entityKey: "order-fail-2",
        saveToSentItems: true,
      }),
    ).rejects.toThrow("Provider connection failed");

    emailService.dispatchEmail = original;
  });
});
