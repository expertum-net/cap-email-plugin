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

  it("escapes HTML entities in placeholder values", () => {
    const template = "<p>{{description}}</p>";
    const result = renderTemplate(template, { description: '<img src=x onerror="alert(1)">' });
    expect(result).toBe("<p>&lt;img src=x onerror=&quot;alert(1)&quot;&gt;</p>");
  });

  it("escapes all five HTML special characters", () => {
    const template = "<p>{{val}}</p>";
    const result = renderTemplate(template, { val: `& < > " '` });
    expect(result).toBe("<p>&amp; &lt; &gt; &quot; &#39;</p>");
  });

  it("renders object values as empty string", () => {
    const template = "<p>{{nested}}</p>";
    const result = renderTemplate(template, { nested: { a: 1 } });
    expect(result).toBe("<p></p>");
  });

  it("renders array values as empty string", () => {
    const template = "<p>{{items}}</p>";
    const result = renderTemplate(template, { items: [1, 2, 3] });
    expect(result).toBe("<p></p>");
  });
});

describe("resolveTemplatePath", () => {
  it("returns correct path using cds.root, template dir, and extension", () => {
    const result = resolveTemplatePath("Orders");
    expect(result).toBe(path.join(cds.root, TEMPLATE_DIR, `Orders${TEMPLATE_EXT}`));
  });

  it("accepts valid names with dots, hyphens, and underscores", () => {
    expect(() => resolveTemplatePath("Order.v2")).not.toThrow();
    expect(() => resolveTemplatePath("ticket-update")).not.toThrow();
    expect(() => resolveTemplatePath("my_template")).not.toThrow();
  });

  it("rejects path traversal attempts", () => {
    expect(() => resolveTemplatePath("../../etc/passwd")).toThrow("Invalid template name");
    expect(() => resolveTemplatePath("../secret")).toThrow("Invalid template name");
  });

  it("rejects names with slashes", () => {
    expect(() => resolveTemplatePath("sub/dir")).toThrow("Invalid template name");
    expect(() => resolveTemplatePath("sub\\dir")).toThrow("Invalid template name");
  });

  it("rejects names with spaces or special characters", () => {
    expect(() => resolveTemplatePath("my template")).toThrow("Invalid template name");
    expect(() => resolveTemplatePath("template<script>")).toThrow("Invalid template name");
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

  it("fallback template renders valid HTML end-to-end", async () => {
    const template = await loadTemplate("nonexistent");
    const rendered = renderTemplate(template, {});
    expect(rendered).toContain("<!doctype html>");
    expect(rendered).toContain("@expertum/cap-email-plugin");
    expect(rendered).not.toContain("{{");
  });

  it("does not fall back when implementer template exists", async () => {
    const content = await loadTemplate("Orders");
    expect(content).toContain("{{orderNumber}}");
    expect(content).not.toContain("default fallback template");
  });

  it("logs warning with template path when falling back to default", async () => {
    const LOG = cds.log("email:template");
    const originalWarn = LOG.warn;
    const warnCalls: unknown[][] = [];
    LOG.warn = ((...args: unknown[]) => {
      warnCalls.push(args);
    }) as typeof LOG.warn;

    try {
      await loadTemplate("nonexistent");
      expect(warnCalls).toHaveLength(1);
      expect(warnCalls[0][0]).toContain("nonexistent.html");
      expect(warnCalls[0][0]).toContain("falling back to default");
    } finally {
      LOG.warn = originalWarn;
    }
  });
});
