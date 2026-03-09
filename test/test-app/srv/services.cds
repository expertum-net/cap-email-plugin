using {test.email as my} from '../db/schema';

service TestService {
  entity Orders   as projection on my.Orders;
  entity Tickets  as projection on my.Tickets;
  entity Products as projection on my.Products;
}
