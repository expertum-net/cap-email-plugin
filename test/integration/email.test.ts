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
          status: "OPEN",
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

    it("renders subject placeholders for Tickets", async () => {
      await POST(
        "/odata/v4/test/Tickets",
        {
          ticketNumber: "TKT-100",
          status: "OPEN",
          contactEmail: "bob@example.com",
        },
        { auth: { username: "alice", password: "" } },
      );

      const [log] = await SELECT.from(EmailLog);
      expect(log.subject).toBe("Ticket TKT-100 — OPEN");
    });
  });

  describe("recipient resolution", () => {
    it("resolves recipient from recipientField annotation", async () => {
      await POST(
        "/odata/v4/test/Tickets",
        {
          ticketNumber: "TKT-200",
          status: "OPEN",
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
  });
});
