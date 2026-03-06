import { readFile } from "node:fs/promises";
import path from "node:path";
import cds from "@sap/cds";
import { TEMPLATE_DIR, TEMPLATE_EXT } from "./constants.js";

const LOG = cds.log("email-template");

export function resolveTemplatePath(templateName: string): string {
  return path.join(cds.root, TEMPLATE_DIR, `${templateName}${TEMPLATE_EXT}`);
}

export async function loadTemplate(templateName: string): Promise<string> {
  const templatePath = resolveTemplatePath(templateName);
  LOG.debug("Loading template from:", templatePath);

  try {
    return await readFile(templatePath, "utf-8");
  } catch (cause) {
    LOG.warn(`Template file not found: ${templatePath}`);
    throw new Error(`Email template not found: ${templateName}${TEMPLATE_EXT}`, { cause });
  }
}

export function renderTemplate(template: string, data: Record<string, unknown>): string {
  LOG.debug("Rendering template with data:", data);
  // TODO: Implement {{placeholder}} substitution
  return template;
}
