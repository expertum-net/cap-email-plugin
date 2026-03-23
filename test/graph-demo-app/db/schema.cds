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

/**
 * Orders — sends an email on every new order via Microsoft Graph.
 * Uses the authenticated user's email as recipient (req.user).
 */
@email: {
  enabled: true,
  subject: 'Order Confirmation: {{title}} (x{{quantity}})'
}
entity Orders : cuid, managed {
  book     : Association to Books;
  title    : String;
  quantity : Integer;
}
