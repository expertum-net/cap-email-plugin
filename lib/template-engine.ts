import { readFile } from "node:fs/promises";
import path from "node:path";
import cds from "@sap/cds";
import { DEFAULT_TEMPLATE_PATH, PLACEHOLDER_PATTERN, TEMPLATE_DIR, TEMPLATE_EXT } from "./constants.js";

const LOG = cds.log("email-template");

export function resolveTemplatePath(templateName: string): string {
  return path.join(cds.root, TEMPLATE_DIR, `${templateName}${TEMPLATE_EXT}`);
}

export async function loadTemplate(templateName: string): Promise<string> {
  const templatePath = resolveTemplatePath(templateName);
  LOG.debug("Loading template from:", templatePath);

  try {
    return await readFile(templatePath, "utf-8");
  } catch {
    LOG.warn(
      `Template "${templateName}${TEMPLATE_EXT}" not found at ${templatePath} — falling back to default template`,
    );
    return readFile(DEFAULT_TEMPLATE_PATH, "utf-8");
  }
}

export function renderTemplate(template: string, data: Record<string, unknown>): string {
  LOG.debug("Rendering template with data:", data);
  return template.replace(PLACEHOLDER_PATTERN, (_, key) => {
    const value = data[key];
    return value !== null && value !== undefined ? String(value) : "";
  });
}
