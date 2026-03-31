namespace expertum.cap.email;

using { cuid, managed } from '@sap/cds/common';

entity EmailLog : cuid, managed {
  entityName : String;
  entityKey  : String;
  recipient  : String;
  cc         : String;
  bcc        : String;
  subject    : String;
  status     : String enum { sent; failed; pending };
  error      : String;
}
