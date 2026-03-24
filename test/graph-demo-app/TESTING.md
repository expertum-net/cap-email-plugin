# Recipient Resolution — Manual Test Curls

Start the app:

```bash
npx cds-tsx watch --profile hybrid
```

Base URL: `http://localhost:4004`

---

## 1. OrdersAnnotatedInSchema — `req.user` fallback (annotated in schema)

No `recipient` or `recipientField` configured. The plugin resolves the recipient from `req.user.attr.email` (alice's
email from the auth config).

```bash
curl -X POST http://localhost:4004/odata/v4/order/OrdersAnnotatedInSchema \
  -H "Content-Type: application/json" \
  -u alice: \
  -d '{
    "title": "Wuthering Heights",
    "quantity": 2,
    "book_ID": 201
  }'
```

**Expected:** Email sent to `alice@example.com` (alice's `attr.email` from `.env`).

---

## 2. OrdersWithRecipientField — dynamic lookup (annotated in service)

`recipientField: 'contactEmail'` — the plugin reads the recipient from the `contactEmail` field in the POST body. This
is a projection on `Orders` with an added `contactEmail` column at the service layer.

```bash
curl -X POST http://localhost:4004/odata/v4/order/OrdersWithRecipientField \
  -H "Content-Type: application/json" \
  -u alice: \
  -d '{
    "title": "Jane Eyre",
    "quantity": 1,
    "book_ID": 207,
    "contactEmail": "bob+dynamic@example.com"
  }'
```

**Expected:** Email sent to `bob+dynamic@example.com` (from the `contactEmail` field, NOT from `req.user`).

---

## 3. OrdersStatic — hardcoded static recipient (annotated in service)

`recipient: 'alerts@example.com'` — the plugin always sends to this fixed address, regardless of `req.user` or entity
data. This is a projection on `Orders` with no extra fields.

```bash
curl -X POST http://localhost:4004/odata/v4/order/OrdersStatic \
  -H "Content-Type: application/json" \
  -u alice: \
  -d '{
    "title": "The Raven",
    "quantity": 5,
    "book_ID": 251
  }'
```

**Expected:** Email sent to `alerts@example.com` (hardcoded in the annotation, ignores `req.user`).

---

## Verify: Check EmailLog

After each POST, query the email log to confirm the recipient and status:

```bash
curl http://localhost:4004/odata/v4/order/OrdersAnnotatedInSchema -u alice: | jq
```

Or check the SQLite DB directly via the CDS REPL or logs.
