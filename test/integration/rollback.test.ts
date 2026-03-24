import cds from "@sap/cds";
import path from "node:path";
import { EmailLog, EmailLog_ } from "#cds-models/expertum/cap/email";
import type EmailService from "../../lib/basic.js";

const { POST, GET } = cds.test(path.resolve(import.meta.dirname, "../test-app"));

describe("@email.rollback transaction behavior", () => {
  let emailService: EmailService;
  let originalSendEmail: EmailService["sendEmail"];

  beforeAll(async () => {
    emailService = (await cds.connect.to("email")) as EmailService;
    originalSendEmail = emailService.sendEmail.bind(emailService);
  });

  afterEach(async () => {
    emailService.sendEmail = originalSendEmail;
    await DELETE.from(EmailLog_);
  });

  function stubSendEmailToFail(): void {
    emailService.sendEmail = async () => {
      throw new Error("Simulated email failure");
    };
  }

  const auth = { username: "alice", password: "" };

  describe("rollback: false (Orders — default)", () => {
    it("persists entity despite email sending failure", async () => {
      stubSendEmailToFail();

      const { status } = await POST(
        "/odata/v4/test/Orders",
        { orderNumber: "ORD-ROLLBACK-OFF", status: "NEW" },
        { auth },
      );
      expect(status).toBe(201);

      const { data } = await GET("/odata/v4/test/Orders?$filter=orderNumber eq 'ORD-ROLLBACK-OFF'", { auth });
      expect(data.value).toHaveLength(1);
      expect(data.value[0].orderNumber).toBe("ORD-ROLLBACK-OFF");
    });

    it("does not create EmailLog entry when sendEmail throws", async () => {
      stubSendEmailToFail();

      await POST("/odata/v4/test/Orders", { orderNumber: "ORD-ROLLBACK-NOLOG", status: "NEW" }, { auth });

      const logs = await SELECT.from(EmailLog);
      expect(logs).toHaveLength(0);
    });
  });

  describe("rollback: true (Tickets)", () => {
    it("does not persist entity or EmailLog when email sending fails", async () => {
      stubSendEmailToFail();

      const res = await POST(
        "/odata/v4/test/Tickets",
        { ticketNumber: "TKT-ROLLBACK", status: "RESOLVED", contactEmail: "bob@example.com" },
        { auth, validateStatus: () => true },
      );
      expect(res.status).toBe(500);

      const { data } = await GET("/odata/v4/test/Tickets?$filter=ticketNumber eq 'TKT-ROLLBACK'", { auth });
      expect(data.value).toHaveLength(0);

      const logs = await SELECT.from(EmailLog);
      expect(logs).toHaveLength(0);
    });
  });
});
