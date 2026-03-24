using { sap.capire.bookshop as my } from '../db/schema';

service CatalogService {
  @readonly entity Books as projection on my.Books excluding { createdBy, modifiedBy };
  @readonly entity Authors as projection on my.Authors excluding { createdBy, modifiedBy };
}

service OrderService {
  entity Orders as projection on my.Orders;
  entity Books as projection on my.Books;
}
