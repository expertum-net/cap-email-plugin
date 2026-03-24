import path from "node:path";
import cds from "@sap/cds";
import { renderTemplate, resolveTemplatePath, loadTemplate } from "../../lib/template-engine.js";
import { TEMPLATE_DIR, TEMPLATE_EXT } from "../../lib/constants.js";

describe("renderTemplate", () => {
  it("replaces all placeholders with matching data values", () => {
    const template = "<p>Order {{orderNumber}} — Status: {{status}}</p>";
    const result = renderTemplate(template, { orderNumber: "ORD-1", status: "APPROVED" });
    expect(result).toBe("<p>Order ORD-1 — Status: APPROVED</p>");
  });

  it("replaces missing keys with empty string", () => {
    const template = "<p>{{name}} — {{missing}}</p>";
    const result = renderTemplate(template, { name: "Test" });
    expect(result).toBe("<p>Test — </p>");
  });

  it("converts non-string values via String()", () => {
    const template = "<p>{{count}} — {{active}}</p>";
    const result = renderTemplate(template, { count: 42, active: true });
    expect(result).toBe("<p>42 — true</p>");
  });

  it("returns template as-is when no placeholders present", () => {
    const template = "<p>No placeholders here</p>";
    const result = renderTemplate(template, { key: "value" });
    expect(result).toBe("<p>No placeholders here</p>");
  });

  it("replaces null and undefined values with empty string", () => {
    const template = "<p>{{a}} — {{b}}</p>";
    const result = renderTemplate(template, { a: null, b: undefined });
    expect(result).toBe("<p> — </p>");
  });
});

describe("resolveTemplatePath", () => {
  it("returns correct path using cds.root, template dir, and extension", () => {
    const result = resolveTemplatePath("Orders");
    expect(result).toBe(path.join(cds.root, TEMPLATE_DIR, `Orders${TEMPLATE_EXT}`));
  });
});

describe("loadTemplate", () => {
  beforeAll(() => {
    cds.root = path.resolve(import.meta.dirname, "../test-app");
  });

  it("loads existing template file contents", async () => {
    const content = await loadTemplate("Orders");
    expect(content).toContain("{{orderNumber}}");
  });

  it("falls back to default template when implementer template is missing", async () => {
    const content = await loadTemplate("nonexistent");
    expect(content).toContain("@expertum/cap-email-plugin");
    expect(content).toContain("default fallback template");
  });

  it("does not fall back when implementer template exists", async () => {
    const content = await loadTemplate("Orders");
    expect(content).toContain("{{orderNumber}}");
    expect(content).not.toContain("default fallback template");
  });
});
