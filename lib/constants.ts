export const ANNOTATION_PREFIX = "@email";
export const TEMPLATE_DIR = "email-templates";
export const TEMPLATE_EXT = ".html";
export const PLACEHOLDER_PATTERN = /\{\{(\w+)\}\}/g;
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const DEFAULT_RETRY_ATTEMPTS = 3;
export const DEFAULT_TEMPLATE_PATH = new URL("../templates/default.html", import.meta.url);
export const RETRYABLE_STATUS_CODES = [429, 503, 504];

export const TRIGGER_TO_EVENT: Record<string, string> = {
  INSERT: "CREATE",
  UPDATE: "UPDATE",
};
