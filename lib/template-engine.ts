import { readFile } from "node:fs/promises";
import path from "node:path";
import cds from "@sap/cds";
import {
  DEFAULT_TEMPLATE_PATH,
  PLACEHOLDER_PATTERN,
  SAFE_TEMPLATE_NAME_PATTERN,
  TEMPLATE_DIR,
  TEMPLATE_EXT,
} from "./constants.js";

const LOG = cds.log("email:template");

export function resolveTemplatePath(templateName: string): string {
  if (!SAFE_TEMPLATE_NAME_PATTERN.test(templateName)) {
    throw new Error(
      `Invalid template name: "${templateName}". Only alphanumerics, dots, hyphens, and underscores are allowed.`,
    );
  }
  return path.join(cds.root, TEMPLATE_DIR, `${templateName}${TEMPLATE_EXT}`);
}

async function readTemplateFile(filePath: string, label: string): Promise<string> {
  try {
    return await readFile(filePath, "utf-8");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    throw new Error(`Failed to read ${label} template at ${filePath} (${code ?? "unknown error"})`, { cause: err });
  }
}

export async function loadTemplate(templateName: string): Promise<string> {
  const templatePath = resolveTemplatePath(templateName);
  LOG.debug("Loading template from:", templatePath);

  try {
    const content = await readTemplateFile(templatePath, `"${templateName}"`);
    LOG.info(`Loaded template "${templateName}" from ${templatePath}`);
    return content;
  } catch {
    LOG.warn(
      `Template "${templateName}${TEMPLATE_EXT}" not found at ${templatePath} — falling back to default template`,
    );
    return await readTemplateFile(DEFAULT_TEMPLATE_PATH, "default");
  }
}

const HTML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (ch) => HTML_ESCAPE_MAP[ch]);
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    LOG.warn("Placeholder received a non-primitive value — rendering as empty string:", value);
    return "";
  }
  return escapeHtml(String(value));
}

export function renderTemplate(template: string, data: Record<string, unknown>): string {
  LOG.debug("Rendering template with data keys:", Object.keys(data));
  return template.replace(PLACEHOLDER_PATTERN, (_, key) => formatValue(data[key]));
}
