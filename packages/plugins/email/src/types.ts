export interface EmailAddress {
  name?: string;
  address?: string;
}

export interface EmailAttachment {
  filename: string;
  mimeType: string;
  size: number;
  contentId?: string;
  data?: Uint8Array | ArrayBuffer | string;
}

export interface ParsedEmail {
  format: 'eml' | 'msg';
  subject: string;
  from?: EmailAddress;
  to: EmailAddress[];
  cc: EmailAddress[];
  bcc: EmailAddress[];
  date?: string;
  messageId?: string;
  headers: Record<string, string | string[]>;
  rawHeaders?: string;
  htmlBody?: string;
  textBody?: string;
  attachments: EmailAttachment[];
}
