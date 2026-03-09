namespace test.email;

using {cuid, managed} from '@sap/cds/common';

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
  toField:   'contactEmail',
  subject:   'Ticket {{ticketNumber}} — {{status}}',
  rollback:  true
}
entity Tickets : cuid, managed {
  ticketNumber : String;
  status       : String;
  contactEmail : String;
}

/**
 * No annotation — control entity. Should never trigger emails.
 */
entity Products : cuid, managed {
  name  : String;
  price : Decimal;
}
