using {test.email as my} from '../db/schema';

service TestService {
  entity Orders   as projection on my.Orders;
  entity Tickets  as projection on my.Tickets;
  entity Alerts   as projection on my.Alerts;
  entity Products as projection on my.Products;
}
