namespace test.email;

using {cuid, managed} from '@sap/cds/common';
using from '@expertum/cap-email-plugin';

/**
 * Minimal annotation — tests all defaults.
 * Template: Orders.html, trigger: INSERT, recipient: req.user.email
 */
@email.enabled: true
entity Orders : cuid, managed {
  orderNumber  : String;
  status       : String;
  contactEmail : String;
}

/**
 * Full annotation — tests all overrides.
 */
@email: {
  enabled:   true,
  template:  'ticket-update',
  trigger:   ['INSERT', 'UPDATE'],
  condition: 'status = ''RESOLVED''',
  recipientField: 'contactEmail',
  subject:   'Ticket {{ticketNumber}} — {{status}}',
  rollback:  true
}
entity Tickets : cuid, managed {
  ticketNumber : String;
  status       : String;
  contactEmail : String;
}

/**
 * Static recipient — always sends to a fixed address.
 */
@email: {
  enabled:   true,
  recipient: 'alerts@company.com'
}
entity Alerts : cuid, managed {
  message  : String;
  severity : String;
}

/**
 * No template file — tests default template fallback.
 */
@email.enabled: true
entity Notifications : cuid, managed {
  title   : String;
  content : String;
}

/**
 * CC/BCC annotations — tests multiple recipients.
 */
@email: {
  enabled:   true,
  recipient: 'to@example.com',
  cc:        ['cc1@example.com', 'cc2@example.com'],
  bcc:       'bcc@example.com'
}
entity Reports : cuid, managed {
  title    : String;
  category : String;
}

/**
 * No annotation — control entity. Should never trigger emails.
 */
entity Products : cuid, managed {
  name  : String;
  price : Decimal;
}
