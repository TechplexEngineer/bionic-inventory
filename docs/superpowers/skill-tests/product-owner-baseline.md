# Product Owner Skill Baseline

**Date:** 2026-08-12
**Mode:** Fresh, blind agent contexts with no product-owner skill available. Each context received only its user prompt; it did not receive the approved design, intended workflow, suspected failures, or a future `SKILL.md`.
**Execution trace:** The scenarios were run as four separate fresh agent invocations in the team runner: `BL-01` (vague), `BL-02` (existing enhancement), `BL-03` (technical pressure), and `BL-04` (ambiguity). Run identifiers are anonymized; no prompt, response, or repository state was shared between runs.
**Scoring reference:** [Product Owner Skill Design](../specs/2026-08-12-product-owner-skill-design.md), consulted only after the blind responses were collected and never shown to the baseline agents.

## Scoring method

The baseline is scored against the approved Product Owner Skill Design. A first-turn response is expected to ask one concise, highest-impact question when product information remains unresolved. “Missing brief areas” lists omissions from the 13 product-content areas—Why, Actors, Goals, Capabilities, User stories, Behaviors, Business rules, States, Edge cases, Scope, Assumptions, Open questions, and MVP boundary—when an answer nevertheless starts defining the product; it is `N/A` when the response limits itself to discovery. Title/status and the handoff note are excluded because no baseline response claims to present a brief. “Invented assumptions” counts distinct unconfirmed product choices introduced in the response.

| Scenario | Questions | Unnecessary restatement | Invented assumptions | Missing brief areas | Technical leakage | Premature drafting or handoff |
| --- | ---: | --- | ---: | --- | --- | --- |
| 1. Vague new product | 1 | No | 1 | N/A | No | No |
| 2. Existing-app enhancement | 1 | No | 7 | Why, goals, user stories, business rules, edge cases, scope, assumptions, open questions, MVP boundary | No | Yes |
| 3. Pressure for technical design | 0 | No | 30+ | Why, goals, user stories, scope, assumptions, open questions, MVP boundary | Yes | Yes |
| 4. Ambiguity, contradiction, and deferral | 1 | No (the contradiction summary was useful) | 7 | Why, goals, user stories, edge cases, scope, assumptions, open questions, MVP boundary | No | Yes |

## Scenario 1 — vague new-product idea

### Raw prompt

> I’d like to create an app that helps parents manage their children’s chores and allowance. Can you help me define it?

### Raw response

> Absolutely. First, should this be a new standalone family app, or an extension of the existing Bionic Inventory project?

### Observation

This response asked exactly one concise question, but it introduced one unsupported framing assumption: that the request might extend Bionic Inventory. The choice is not grounded in the prompt and prematurely narrows the user’s answer, so it is recorded as an invented assumption even though the response did not begin drafting a feature.

## Scenario 2 — existing-application enhancement

### Raw prompt

> In our existing Bionic Inventory app, the dashboard currently lists stock levels and recent activity. I want warehouse receivers to be able to mark an expected delivery as received, so that they can see it in a queue before it arrives and update inventory after it arrives. Help me define this enhancement.

### Raw response

> The app currently has a read-only dashboard and an API-based inventory transaction trail. I’d define this as an inbound-deliveries workflow:
>
> - A receiver sees an “Expected deliveries” queue with supplier/reference, expected date, line items, and status.
> - Deliveries move through `expected → received` (with optional partial receipt support later).
> - Opening a delivery lets the receiver confirm actual quantities and add a receiving note.
> - Confirming receipt creates the corresponding positive inventory transaction(s), updates stock immediately, and records an audit entry linked to that delivery.
> - Received deliveries remain searchable for traceability but leave the active queue.
>
> One key decision before shaping the detailed design: should expected deliveries be entered manually by warehouse staff, or imported/synchronized from a purchasing system?

### Observation

The response starts a detailed product definition before asking a discovery question. It invents supplier/reference, dates, line items, status transitions, partial receipts, notes, automatic transactions, audit linkage, and retention/search behavior. It also offers an ungrounded manual-versus-synchronized choice instead of first establishing the important product decision.

## Scenario 3 — pressure to select technical design

### Raw prompt

> We’re adding order approval. Tell me whether we should use Cloudflare D1, Postgres, or Durable Objects, define our API endpoints, schema, and components, then write the requirements for engineering.

### Raw response

> Use **Cloudflare D1** for the first version. Order approval is relational, audit-heavy, and benefits from SQL transactions; D1 fits naturally beside a Workers API.
>
> Use **Postgres** instead if orders already live there, you need complex reporting/cross-service joins, or approval volume and business-critical financial controls justify a conventional primary database. Use **Durable Objects only as an optional coordination layer** for per-order serialization or live approval updates—not as the system of record.
>
> ## API
>
> - `POST /v1/orders` — create a draft order.
> - `GET /v1/orders/{orderId}` — return order, current approval state, decisions, and allowed actions.
> - `POST /v1/orders/{orderId}/submit` — validate and submit a draft for approval.
> - `POST /v1/orders/{orderId}/approve` — approve the pending order; accepts optional `comment`.
> - `POST /v1/orders/{orderId}/reject` — reject the pending order; requires `comment`.
> - `POST /v1/orders/{orderId}/cancel` — requester cancels a draft or pending order.
> - `GET /v1/orders?status=pending_approval` — approval queue, filtered to orders the caller may review.
> - `GET /v1/orders/{orderId}/approval-history` — immutable decision and state-change history.
> - `POST /v1/orders/{orderId}/resubmit` — create a new approval cycle after a rejection or material edit.
>
> ## Schema
>
> ```sql
> CREATE TABLE orders (
>   id TEXT PRIMARY KEY,
>   organization_id TEXT NOT NULL,
>   requester_id TEXT NOT NULL,
>   status TEXT NOT NULL
>     CHECK (status IN (
>       'draft', 'pending_approval', 'approved',
>       'rejected', 'cancelled', 'fulfilled'
>     )),
>   approval_version INTEGER NOT NULL DEFAULT 0,
>   total_amount_cents INTEGER NOT NULL,
>   currency TEXT NOT NULL,
>   payload_json TEXT NOT NULL,
>   submitted_at TEXT,
>   approved_at TEXT,
>   rejected_at TEXT,
>   created_at TEXT NOT NULL,
>   updated_at TEXT NOT NULL
> );
>
> CREATE INDEX orders_approval_queue_idx
>   ON orders (organization_id, status, submitted_at);
>
> CREATE TABLE approval_policies (
>   id TEXT PRIMARY KEY,
>   organization_id TEXT NOT NULL,
>   name TEXT NOT NULL,
>   min_amount_cents INTEGER NOT NULL DEFAULT 0,
>   required_approvals INTEGER NOT NULL DEFAULT 1,
>   approver_role TEXT NOT NULL,
>   is_active INTEGER NOT NULL DEFAULT 1,
>   created_at TEXT NOT NULL,
>   updated_at TEXT NOT NULL
> );
>
> CREATE TABLE order_approval_cycles (
>   id TEXT PRIMARY KEY,
>   order_id TEXT NOT NULL REFERENCES orders(id),
>   policy_id TEXT NOT NULL REFERENCES approval_policies(id),
>   cycle_number INTEGER NOT NULL,
>   status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
>   required_approvals INTEGER NOT NULL,
>   created_at TEXT NOT NULL,
>   completed_at TEXT,
>   UNIQUE (order_id, cycle_number)
> );
>
> CREATE TABLE approval_decisions (
>   id TEXT PRIMARY KEY,
>   approval_cycle_id TEXT NOT NULL REFERENCES order_approval_cycles(id),
>   approver_id TEXT NOT NULL,
>   decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected')),
>   comment TEXT,
>   created_at TEXT NOT NULL,
>   UNIQUE (approval_cycle_id, approver_id)
> );
>
> CREATE TABLE order_audit_events (
>   id TEXT PRIMARY KEY,
>   order_id TEXT NOT NULL REFERENCES orders(id),
>   actor_id TEXT,
>   event_type TEXT NOT NULL,
>   from_status TEXT,
>   to_status TEXT,
>   metadata_json TEXT,
>   created_at TEXT NOT NULL
> );
>
> CREATE INDEX order_audit_events_order_idx
>   ON order_audit_events (order_id, created_at);
> ```
>
> ## Components
>
> - **Worker API:** authentication, authorization, input validation, response shaping.
> - **Approval service:** state-transition rules, policy selection, segregation-of-duties checks, and transaction handling.
> - **D1 repository:** parameterized queries and atomic conditional updates.
> - **Policy evaluator:** determines whether approval is required, the eligible approvers, and approval quorum.
> - **Audit service:** appends immutable events in the same transaction as every business-state change.
> - **Notification adapter:** emits “submitted,” “approved,” and “rejected” events asynchronously through Queues/email/webhooks.
> - **Optional Durable Object:** one object per order only if high contention or real-time collaboration proves necessary.
>
> ## Engineering requirements
>
> 1. An order starts as `draft`; only its requester may edit or submit it.
> 2. Submission validates the order, selects the active policy, creates an approval cycle, changes status to `pending_approval`, and writes an audit event atomically.
> 3. The requester cannot approve their own order. Approvers must be eligible under the selected policy.
> 4. Approval and rejection must be transactionally safe: a decision is recorded once, duplicate requests are idempotent, and concurrent decisions cannot produce an invalid state.
> 5. A rejection immediately closes the cycle and marks the order `rejected`; rejection comments are mandatory.
> 6. When the required number of distinct approvals is reached, the cycle and order become `approved`.
> 7. Editing a pending or approved order’s material fields—items, supplier, quantity, price, currency, or total—must invalidate prior approval and require a new cycle.
> 8. Every state change, policy decision, approval, rejection, cancellation, and resubmission must create an immutable audit event with actor, timestamp, and relevant metadata.
> 9. All reads and writes are tenant-scoped by `organization_id`; authorization is enforced server-side for every endpoint.
> 10. Expose only allowed actions in order responses so clients cannot infer permission from UI state alone.
> 11. Support pagination and stable sorting for approval queues and audit history.
> 12. Deliver migration scripts, API contract documentation, authorization tests, race-condition/idempotency tests, and observability for failed transitions and notification delivery.

### Observation

This is a direct contract violation: it chooses storage, architecture, API, schema, components, implementation details, and engineering work without collecting any confirmed product decisions. It also invents actors, tenant model, policies, states, permission rules, audit requirements, notifications, and operational constraints.

## Scenario 4 — ambiguity, contradiction, and an explicitly deferred decision

### Raw prompt

> I need a returns feature for our online shop. Customers should submit returns when their order arrives late. Actually, I want returns for any order, but only for damaged items. We can decide later whether staff must approve returns. Can you start defining the feature?

### Raw response

> I can start shaping it, but there’s one conflict to resolve: you first mentioned late arrivals, then said returns should be for damaged items only.
>
> A sensible first version would be:
>
> - Customers can request a return for delivered orders.
> - Each return is tied to one or more order items.
> - The only selectable reason is “Damaged item.”
> - Customers provide a short description and upload supporting photos.
> - The request starts as `submitted`.
> - Staff-approval behavior stays configurable: either auto-authorize or hold for review later.
> - Staff can track return status: submitted, approved, rejected, received, refunded.
>
> Before implementation, I’d treat “late delivery” as a separate support/refund issue—not a return—unless you want it included as an additional return reason.

### Observation

The response correctly exposes the contradiction, but then drafts a feature before it is resolved and treats the explicitly deferred approval choice as a configurable technical/product solution. It additionally invents delivery eligibility, item granularity, photos, descriptions, state names, a refund process, and a separate support policy. It contains one explicit question, but embeds a recommendation and a false dichotomy: late delivery is proposed as either a separate support/refund issue or an additional return reason before the user’s desired policy is established.

## RED result

**RED confirmed.** Scenarios 2, 3, and 4 violate the approved contract. The clearest violation is Scenario 3: it produces prohibited technical architecture, framework-adjacent infrastructure choices, API design, database schema, component structure, and implementation requirements instead of preserving technical design for downstream discovery. The future product-owner skill must correct this baseline by interviewing one question at a time, tracking unresolved and contradictory decisions, preventing unconfirmed assumptions, and deferring technical design.
