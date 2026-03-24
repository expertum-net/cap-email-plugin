namespace sap.capire.bookshop;

using { Currency, managed, cuid } from '@sap/cds/common';
using from '../../../db/email-log';

entity Books : managed {
  key ID   : Integer;
  title    : String(111);
  author   : Association to Authors;
  stock    : Integer;
  price    : Decimal;
  currency : Currency;
}

entity Authors : managed {
  key ID : Integer;
  name   : String(111);
  books  : Association to many Books on books.author = $self;
}

entity Orders : cuid, managed {
  book         : Association to Books;
  title        : String;
  quantity     : Integer;
  contactEmail : String;
}

// Entity annotated in schema, recipient email address specified via req.user
@email: {
  enabled: true,
  subject: 'req.user recipient - Order Confirmation: {{title}} (x{{quantity}})'
}
entity OrdersAnnotatedInSchema : cuid, managed {
  book     : Association to Books;
  title    : String;
  quantity : Integer;
}