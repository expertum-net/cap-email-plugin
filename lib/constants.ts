export const ANNOTATION_PREFIX = "@email";
export const TEMPLATE_DIR = "email-templates";
export const TEMPLATE_EXT = ".html";
export const PLACEHOLDER_PATTERN = /\{\{(\w+)\}\}/g;
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const GRAPH_API_BASE = "https://graph.microsoft.com/v1.0";
export const DEFAULT_RETRY_ATTEMPTS = 3;
export const RETRYABLE_STATUS_CODES = [429, 503, 504];
