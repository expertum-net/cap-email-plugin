import cds from "@sap/cds";

const LOG = cds.log("email-template");

export function renderTemplate(template: string, data: Record<string, unknown>): string {
  LOG.debug("Rendering template with data:", data);
  // TODO: Load and render email templates with {{placeholder}} substitution
  return template;
}
