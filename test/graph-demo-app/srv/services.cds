using { sap.capire.bookshop as my } from '../db/schema';

service CatalogService {
  @readonly entity Books as projection on my.Books excluding { createdBy, modifiedBy };
  @readonly entity Authors as projection on my.Authors excluding { createdBy, modifiedBy };
}

service OrderService {
  entity OrdersAnnotatedInSchema as projection on my.OrdersAnnotatedInSchema;

  /**
 * OrdersWithRecipientField — recipient looked up from entity data field.
 */
  @email: {
    enabled: true,
    recipientField: 'contactEmail',
    subject: 'Dynamic recipient - Order Alert: {{title}} (x{{quantity}})'
  }
  entity OrdersWithRecipientField as projection on my.Orders;

  /**
 * OrdersStatic — recipient is a hardcoded static address.
 */
  @email: {
    enabled: true,
    recipient: 'matthis.vansteenhuyse+static@expertum.net',
    subject: 'Static recipient - Order Alert: {{title}} (x{{quantity}})'
  }
  entity OrdersStatic            as projection on my.Orders;
  
  entity Books                   as projection on my.Books;
}
