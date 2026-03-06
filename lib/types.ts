export interface EmailAnnotationConfig {
  enabled: boolean;
  template: string;
  trigger: string[];
  condition: string | undefined;
  toField: string | undefined;
  subject: string | undefined;
  rollback: boolean;
}

export const EMAIL_DEFAULTS: EmailAnnotationConfig = {
  enabled: false,
  template: "{EntityName}",
  trigger: ["INSERT"],
  condition: undefined,
  toField: undefined,
  subject: undefined,
  rollback: false,
};
