import cds from "@sap/cds";
import path from "node:path";
import { EmailLog, EmailLog_ } from "#cds-models/expertum/cap/email";

const { POST, PATCH } = cds.test(path.resolve(import.meta.dirname, "../test-app"));

describe("email plugin (integration)", () => {
  afterEach(async () => {
    await DELETE.from(EmailLog_);
  });

  describe("handler registration", () => {
    it("registers handlers for @email.enabled entities", async () => {
      const { TestService } = cds.services;
      expect(TestService).toBeDefined();
    });

    it("sends email on INSERT for Orders (default trigger)", async () => {
      await POST(
        "/odata/v4/test/Orders",
        {
          orderNumber: "ORD-001",
          status: "NEW",
        },
        { auth: { username: "alice", password: "" } },
      );

      const logs = await SELECT.from(EmailLog);
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        recipient: "alice@example.com",
        status: "sent",
      });
      expect(logs[0].entityName).toContain("Orders");
    });

    it("sends email on INSERT for Tickets (multi-trigger)", async () => {
      await POST(
        "/odata/v4/test/Tickets",
        {
          ticketNumber: "TKT-001",
          status: "RESOLVED",
          contactEmail: "bob@example.com",
        },
        { auth: { username: "alice", password: "" } },
      );

      const logs = await SELECT.from(EmailLog);
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        recipient: "bob@example.com",
        status: "sent",
      });
    });

    it("sends email on UPDATE for Tickets (multi-trigger)", async () => {
      const { data } = await POST(
        "/odata/v4/test/Tickets",
        {
          ticketNumber: "TKT-002",
          status: "OPEN",
          contactEmail: "bob@example.com",
        },
        { auth: { username: "alice", password: "" } },
      );

      await DELETE.from(EmailLog_);

      await PATCH(
        `/odata/v4/test/Tickets(${data.ID})`,
        {
          status: "RESOLVED",
          contactEmail: "bob@example.com",
        },
        { auth: { username: "alice", password: "" } },
      );

      const logs = await SELECT.from(EmailLog);
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        recipient: "bob@example.com",
        status: "sent",
      });
    });

    it("does NOT send email for unannotated entities", async () => {
      await POST(
        "/odata/v4/test/Products",
        {
          name: "Widget",
          price: 9.99,
        },
        { auth: { username: "alice", password: "" } },
      );

      const logs = await SELECT.from(EmailLog);
      expect(logs).toHaveLength(0);
    });
  });

  describe("template rendering", () => {
    it("renders template with entity data in log body", async () => {
      await POST(
        "/odata/v4/test/Orders",
        {
          orderNumber: "ORD-042",
          status: "CONFIRMED",
        },
        { auth: { username: "alice", password: "" } },
      );

      const [log] = await SELECT.from(EmailLog);
      expect(log.subject).toBe("Orders");
    });

    it("falls back to default template when entity template is missing", async () => {
      await POST(
        "/odata/v4/test/Notifications",
        {
          title: "Test",
          content: "Hello",
        },
        { auth: { username: "alice", password: "" } },
      );

      const [log] = await SELECT.from(EmailLog);
      expect(log.status).toBe("sent");
      expect(log.recipient).toBe("alice@example.com");
    });

    it("escapes HTML entities in subject placeholders", async () => {
      await POST(
        "/odata/v4/test/Tickets",
        {
          ticketNumber: '<script>alert("xss")</script>',
          status: "RESOLVED",
          contactEmail: "bob@example.com",
        },
        { auth: { username: "alice", password: "" } },
      );

      const [log] = await SELECT.from(EmailLog);
      expect(log.status).toBe("sent");
      expect(log.subject).toContain("&lt;script&gt;");
      expect(log.subject).not.toContain("<script>");
    });

    it("renders subject placeholders for Tickets", async () => {
      await POST(
        "/odata/v4/test/Tickets",
        {
          ticketNumber: "TKT-100",
          status: "RESOLVED",
          contactEmail: "bob@example.com",
        },
        { auth: { username: "alice", password: "" } },
      );

      const [log] = await SELECT.from(EmailLog);
      expect(log.subject).toBe("Ticket TKT-100 — RESOLVED");
    });
  });

  describe("condition evaluation", () => {
    it("skips email when condition is not met (Tickets: status != RESOLVED)", async () => {
      await POST(
        "/odata/v4/test/Tickets",
        {
          ticketNumber: "TKT-COND-SKIP",
          status: "OPEN",
          contactEmail: "bob@example.com",
        },
        { auth: { username: "alice", password: "" } },
      );

      const logs = await SELECT.from(EmailLog);
      expect(logs).toHaveLength(0);
    });

    it("sends email when condition is met (Tickets: status = RESOLVED)", async () => {
      await POST(
        "/odata/v4/test/Tickets",
        {
          ticketNumber: "TKT-COND-SEND",
          status: "RESOLVED",
          contactEmail: "bob@example.com",
        },
        { auth: { username: "alice", password: "" } },
      );

      const logs = await SELECT.from(EmailLog);
      expect(logs).toHaveLength(1);
      expect(logs[0].recipient).toBe("bob@example.com");
    });

    it("always sends when no condition is set (Orders)", async () => {
      await POST(
        "/odata/v4/test/Orders",
        {
          orderNumber: "ORD-COND-ALWAYS",
          status: "ANY-STATUS",
        },
        { auth: { username: "alice", password: "" } },
      );

      const logs = await SELECT.from(EmailLog);
      expect(logs).toHaveLength(1);
    });

    it("evaluates condition on UPDATE trigger", async () => {
      const { data } = await POST(
        "/odata/v4/test/Tickets",
        {
          ticketNumber: "TKT-COND-UPD",
          status: "OPEN",
          contactEmail: "bob@example.com",
        },
        { auth: { username: "alice", password: "" } },
      );

      await DELETE.from(EmailLog_);

      // Update but condition still not met
      await PATCH(
        `/odata/v4/test/Tickets(${data.ID})`,
        { status: "IN_PROGRESS", contactEmail: "bob@example.com" },
        { auth: { username: "alice", password: "" } },
      );

      let logs = await SELECT.from(EmailLog);
      expect(logs).toHaveLength(0);

      // Update with condition met
      await PATCH(
        `/odata/v4/test/Tickets(${data.ID})`,
        { status: "RESOLVED", contactEmail: "bob@example.com" },
        { auth: { username: "alice", password: "" } },
      );

      logs = await SELECT.from(EmailLog);
      expect(logs).toHaveLength(1);
    });
  });

  describe("recipient resolution", () => {
    it("resolves recipient from recipientField annotation", async () => {
      await POST(
        "/odata/v4/test/Tickets",
        {
          ticketNumber: "TKT-200",
          status: "RESOLVED",
          contactEmail: "custom@example.com",
        },
        { auth: { username: "alice", password: "" } },
      );

      const [log] = await SELECT.from(EmailLog);
      expect(log.recipient).toBe("custom@example.com");
    });

    it("resolves static recipient from annotation", async () => {
      await POST(
        "/odata/v4/test/Alerts",
        {
          message: "Disk usage critical",
          severity: "HIGH",
        },
        { auth: { username: "alice", password: "" } },
      );

      const [log] = await SELECT.from(EmailLog);
      expect(log.recipient).toBe("alerts@company.com");
    });

    it("resolves recipient from req.user for Orders (default)", async () => {
      await POST(
        "/odata/v4/test/Orders",
        {
          orderNumber: "ORD-100",
          status: "NEW",
        },
        { auth: { username: "alice", password: "" } },
      );

      const [log] = await SELECT.from(EmailLog);
      expect(log.recipient).toBe("alice@example.com");
    });

    it("skips email gracefully when user has no resolvable email", async () => {
      await POST(
        "/odata/v4/test/Orders",
        {
          orderNumber: "ORD-NO-EMAIL",
          status: "NEW",
        },
        { auth: { username: "bob", password: "" } },
      );

      const logs = await SELECT.from(EmailLog);
      expect(logs).toHaveLength(0);
    });
  });

  describe("bulk insert", () => {
    it("handles multiple sequential INSERTs with per-row email logging", async () => {
      await POST(
        "/odata/v4/test/Orders",
        { orderNumber: "BULK-001", status: "NEW" },
        { auth: { username: "alice", password: "" } },
      );
      await POST(
        "/odata/v4/test/Orders",
        { orderNumber: "BULK-002", status: "NEW" },
        { auth: { username: "alice", password: "" } },
      );
      await POST(
        "/odata/v4/test/Orders",
        { orderNumber: "BULK-003", status: "NEW" },
        { auth: { username: "alice", password: "" } },
      );

      const logs = await SELECT.from(EmailLog);
      expect(logs).toHaveLength(3);
      expect(logs.every((l) => l.status === "sent")).toBe(true);
    });
  });

  describe("cc/bcc recipients", () => {
    it("logs to, cc, and bcc separately in EmailLog", async () => {
      await POST(
        "/odata/v4/test/Reports",
        { title: "Q1 Report", category: "Finance" },
        { auth: { username: "alice", password: "" } },
      );

      const [log] = await SELECT.from(EmailLog);
      expect(log.recipient).toBe("to1@example.com,to2@example.com");
      expect(log.cc).toBe("cc1@example.com,cc2@example.com");
      expect(log.bcc).toBe("bcc@example.com");
      expect(log.status).toBe("sent");
    });

    it("logs only to recipient when cc/bcc are not configured", async () => {
      await POST(
        "/odata/v4/test/Alerts",
        { message: "Test", severity: "LOW" },
        { auth: { username: "alice", password: "" } },
      );

      const [log] = await SELECT.from(EmailLog);
      expect(log.recipient).toBe("alerts@company.com");
      expect(log.cc).toBeNull();
      expect(log.bcc).toBeNull();
    });
  });
});
