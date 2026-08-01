# Payment & Order State — How It's Handled

Reference doc for the Razorpay checkout/booking flow: every `orders.status`
and `payments.status` value, what triggers each transition, and what admin
can/should do at each state. Written after closing the gaps found in this
session (stale-pending orders, silent refund failures, missing admin guards).

## order.status (Postgres enum `booking_status`)

```
pending ──┬─→ confirmed ──┬─→ pandit_assigned ──┬─→ in_progress ──→ completed
          │               │                     │                     │
          │               ├─→ disputed ◄────────┴─────────────────────┘
          │               │        (any post-payment state can be disputed)
          │               │
          └─→ payment_failed          cancelled ◄──┬── (from pending/confirmed/
                                                     │    pandit_assigned/in_progress,
                                       refunded ◄────┤    via cancel — see below)
                                                     │
                                       refund_failed ┘
```

| Status | Meaning | Set by |
|---|---|---|
| `pending` | Order row created, Razorpay order opened, payment not yet captured | `createOrder` — [checkout.controller.ts:160](src/controllers/checkout.controller.ts) (DB default) |
| `confirmed` | Payment signature verified & captured (or category doesn't require payment) | `finalizeSuccessfulPayment` via `verifyPayment`/webhook `payment.captured` — [checkout.controller.ts:225-264](src/controllers/checkout.controller.ts); or immediately for `requires_payment=false` categories — [checkout.controller.ts:173-184](src/controllers/checkout.controller.ts) |
| `pandit_assigned` | A pandit has been assigned/reassigned | `createAssignment`/`reassignPandit` — [assignment.controller.ts](src/controllers/admin/assignment.controller.ts) |
| `in_progress` | Puja underway | Admin, via `PATCH /admin/orders/:id/status` (no automatic trigger exists yet) |
| `completed` | Puja done | Admin status update, or `completeOrder` query |
| `cancelled` | Cancelled, no captured payment existed to refund | `cancelOrderWithRefund` — [booking.service.ts](src/services/booking.service.ts) |
| `refunded` | Cancelled **and** Razorpay refund succeeded | `cancelOrderWithRefund` (refund success path), or webhook `refund.created` |
| `payment_failed` | Payment never completed — signature mismatch, webhook `payment.failed`, Razorpay order-creation error, or expired (30 min, no payment) | `createOrder` catch block, `verifyPayment` signature-mismatch branch, webhook `payment.failed`, or the order-expiry cron — [order-expiry.cron.ts](src/jobs/order-expiry.cron.ts) |
| `refund_failed` | Cancellation requested, payment was captured, but the Razorpay refund call itself threw | `cancelOrderWithRefund` (refund failure path) |
| `disputed` | Razorpay chargeback/dispute raised on a captured payment | Webhook `payment.dispute.created` |

**Terminal states** (no further transition via the generic admin status PATCH):
`cancelled`, `refunded`, `payment_failed`, `refund_failed`, `disputed`.

## payment.status (Postgres enum `payment_status`)

| Status | Set by |
|---|---|
| `created` | `createPayment` right after the Razorpay order is opened |
| `captured` | `markPaymentCaptured` — signature verified, or webhook `payment.captured` |
| `failed` | `markPaymentFailed` — signature mismatch, webhook `payment.failed`, or expiry cron |
| `refunded` | `markPaymentRefunded` — refund succeeded (customer/admin cancel, retry-refund, or webhook `refund.created`) |

Note: a `refund_failed` **order** still has `payment.status = 'captured'` —
the money was taken, the refund attempt just didn't go through yet. That's
the signal `retryRefund` looks for.

## Scenario → automatic behavior → admin action

| Scenario | System does automatically | Admin can/should do |
|---|---|---|
| Normal successful payment | Signature verified → order `confirmed`, payment `captured` | Assign pandit once `confirmed` |
| Signature mismatch on verify-payment | Payment → `failed`, order → `payment_failed`, activity logged | Nothing required — customer can retry checkout (no longer blocked, see below) |
| Razorpay order-creation fails (auth/network/gateway error) | Order (already inserted) → `payment_failed` immediately, generic 502 to client | Check `logs/error.log` for the real Razorpay error if it recurs |
| Customer abandons checkout mid-payment | Order-expiry cron flips it to `payment_failed` after 30 min | Nothing — automatic |
| Webhook `payment.failed` arrives | Payment → `failed`, order → `payment_failed` | Nothing required |
| Cancel request, no captured payment | Order → `cancelled` | — |
| Cancel request, captured payment, refund succeeds | Order → `refunded`, payment → `refunded` | — |
| Cancel request, captured payment, refund call throws | Order → `refund_failed`, payment stays `captured`, response tells the caller refund didn't go through | Use **Retry Refund** (`POST /admin/orders/:id/retry-refund`) — re-attempts the Razorpay refund; stays `refund_failed` and logs again if it fails a second time, needs manual handling in the Razorpay dashboard at that point |
| Webhook `payment.dispute.created` (chargeback) | Order → `disputed`, raw dispute payload stored on the payment row, logged loudly | Respond to the dispute in the Razorpay dashboard before its deadline — this is not something the backend can resolve automatically |
| Any other webhook event type | Logged (`logger.warn`), otherwise ignored | Nothing — just visible in logs now instead of silently vanishing |
| Stale `pending`/`payment_failed`/`refund_failed` order | Excluded from `findDuplicateBooking` — customer can immediately retry booking the same service+date | — |

## Admin action matrix (what's guarded and why)

**`PATCH /admin/orders/:id/status`** — generic status change. Rejects
(`409 INVALID_STATUS_TRANSITION`) any move not in this table
([booking.service.ts `assertValidStatusTransition`](src/services/booking.service.ts)):

| From | Allowed to |
|---|---|
| `pending` | `payment_failed` only |
| `confirmed` | `pandit_assigned`, `in_progress`, `completed`, `disputed` |
| `pandit_assigned` | `in_progress`, `completed`, `disputed` |
| `in_progress` | `completed`, `disputed` |
| `completed` | `disputed` (post-completion chargeback) |
| anything terminal | nothing |

`cancelled`/`refunded`/`refund_failed` are **not settable** through this
endpoint at all — they're side-effecting (real Razorpay refund calls, pandit
un-assignment) and only reachable through:
- **`PATCH /admin/orders/:id/cancel`** — `{ reason?: string }`, no 24h time
  window (admin bypasses it, unlike the customer-facing cancel).
- **`POST /admin/orders/:id/retry-refund`** — only works on `refund_failed`
  orders.

**Assigning a pandit** (`POST /admin/pandit-assignments`,
`PATCH /admin/pandit-assignments/:id/reassign`) requires:
- `createAssignment`: order status must be `confirmed` — an unpaid `pending`
  order can no longer get a pandit assigned to it.
- `reassignPandit`: order status must be `pandit_assigned` or `in_progress`.

**`GET /admin/orders/:id/activity`** — every status change, cancellation,
refund attempt (success or failure), and dispute now writes a row to the
shared `activity_logs` table (`entity_type='order'`), readable here.

## Known non-goals (deliberately not built)

- **No "mark as paid offline" admin action.** There's no way today to record
  a non-Razorpay payment; a `pending → confirmed` override without one would
  make revenue dashboards under-report. If offline/cash payments become a
  real requirement, that's a distinct feature (needs its own payment-row
  shape), not a loosened status transition.
- **No automatic customer notification on refund failure or dispute** —
  currently visibility is via `activity_logs` and `logs/error.log` only.
