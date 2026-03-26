import { fileURLToPath } from "node:url";

export const ANNOTATION_PREFIX = "@email";
export const TEMPLATE_DIR = "email-templates";
export const TEMPLATE_EXT = ".html";
export const PLACEHOLDER_PATTERN = /\{\{(\w+)\}\}/g;
export const SAFE_TEMPLATE_NAME_PATTERN = /^[\w.-]+$/;
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const DEFAULT_RETRY_ATTEMPTS = 3;
export const DEFAULT_TEMPLATE_PATH = fileURLToPath(new URL("../templates/default.html", import.meta.url));
export const RETRYABLE_STATUS_CODES = [429, 503, 504];

export const TRIGGER_TO_EVENT: Record<string, string> = {
  INSERT: "CREATE",
  UPDATE: "UPDATE",
};
