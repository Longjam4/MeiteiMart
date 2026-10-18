# Database Design

The API uses MongoDB through Mongoose. The schemas live in `services/api/src/modules/`; Mongoose adds `createdAt` and `updatedAt` timestamps to the primary documents unless noted otherwise. References below are ObjectId references, not database-enforced foreign keys. Application code is responsible for keeping related documents consistent.

## Collections

| Collection | Purpose and principal relationships |
| --- | --- |
| `Role` | Unique role name, permission strings, portal access, and system-role flag. Referenced by `User.role`. |
| `User` | Account identity and verification state, role reference, embedded addresses, and optional seller/delivery profile references. Email and phone are separately unique sparse indexes. |
| `Otp` | Hashed one-time code, identifier and channel, attempts, use time, and expiry. A TTL index removes documents after `expiresAt`. |
| `Category` | Catalog category with unique slug and optional parent reference to another category. |
| `Store` | Seller-owned store, approval/serviceability state, address and GeoJSON point, rating, and operating details. `owner` references `User`. |
| `Product` | Store catalog item with category reference, price, stock, approval and activity flags, images, and tags. |
| `DeliveryProfile` | One-to-one delivery-partner profile referencing `User`, vehicle and approval information, current GeoJSON location, and rating aggregates. |
| `Order` | Customer purchase from one store, optional assigned delivery partner, embedded item snapshots, totals, shipping-address snapshot, payment state, order state history, and ratings. |
| `Ticket` | Support conversation raised by a user, optionally linked to an order and assigned to an agent. Messages and attachment URLs are embedded. |

## Relationships

```text
Role 1 --- many User
User 1 --- 0..1 Store (seller profile / owner)
User 1 --- 0..1 DeliveryProfile
Category 1 --- many Product
Category 1 --- many Category (parent / child)
Store 1 --- many Product
User 1 --- many Order (customer)
Store 1 --- many Order
User 0..1 --- many Order (assigned delivery partner)
User 1 --- many Ticket (requester or assigned agent)
Order 0..1 --- many Ticket
Product references in Order.items; purchased name, unit, and price are also embedded as a snapshot
```

Addresses belong to the user or are copied into an order's `shippingAddress`. Order items, status history, and ticket messages are embedded subdocuments because they are read and updated with their owning document.

## Indexes

- `User`: unique sparse indexes on `email` and `phone`; `2dsphere` index on embedded address locations.
- `Role`: unique index on `name`.
- `Category`: unique index on `slug`.
- `Product`: unique compound index on `(store, slug)` and text index on `name` and `tags`.
- `Store`: `2dsphere` index on `address.location`.
- `DeliveryProfile`: unique index on `user` and `2dsphere` index on `currentLocation`.
- `Order`: unique index on `orderNumber`; descending-created-time query indexes for `customer`, `store`, and `deliveryPartner`.
- `Ticket`: unique index on `ticketNumber`; indexes on `(raisedBy, createdAt)` and `(assignedAgent, status)`.
- `Otp`: index on `identifier` and TTL index on `expiresAt`.

GeoJSON coordinates use MongoDB's `[longitude, latitude]` order. Status and payment values are constrained by enums shared from `packages/shared` where applicable. These schemas do not currently define a payment-provider transaction collection or a separate inventory ledger.