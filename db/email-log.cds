namespace expertum.cap.email;

using { cuid, managed } from '@sap/cds/common';

entity EmailLog : cuid, managed {
  entityName : String;
  entityKey  : String;
  recipient  : many String;
  cc         : many String;
  bcc        : many String;
  subject    : String;
  status     : String enum { sent; failed; pending };
  error      : String;
}
