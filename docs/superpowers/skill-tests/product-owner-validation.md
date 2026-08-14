# Product Owner Skill Validation

**Date:** 2026-08-12

**Mode:** Fresh agent contexts with the repository-local skill available. Each initial invocation received only its scenario and the absolute location of `.agents/skills/product-owner`; agents did not receive the design, baseline responses, expected answers, scorecard, or failure matrix. Follow-up messages supplied only user answers and review instructions needed to exercise the multi-turn workflow.

**Prompt path convention:** For readability, displayed prompts in the FV sections are normalized to repository-relative skill paths unless explicitly marked otherwise. The E2E-01 prompt below is explicitly marked exact and preserves the absolute skill path and validation-context sentence verbatim.

**Scoring reference:** [Product Owner Skill Design](../specs/2026-08-12-product-owner-skill-design.md), consulted by the scorer after responses were collected.

## Scoring method

Each response was checked for exactly one purposeful question during discovery, minimal restatement, separation of repository facts from desired behavior, no unconfirmed assumptions, progression across all completeness-ledger areas, explicit deferral of technical design, review before save, the defined dated save path, and an intended handoff to `superpowers:brainstorming` followed by a stop. A ledger-coverage result is `Discovery` when the agent correctly continued interviewing rather than claiming the brief was complete.

## Initial scorecard

| Run | One question | Minimal restatement | Current vs desired | No assumptions | Ledger coverage | Technical boundary | Review/save/handoff | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FV-01 vague product | Pass | Pass | N/A | **Fail** — offered ungrounded manual tracking/digital transfer and parent-managed/child-access choices | Discovery | Pass | N/A | **Fail** — superseded by FV2-01 |
| FV-02 existing enhancement | Pass | Pass | Pass | **Fail** — offered an ungrounded manual/external/both choice set | Discovery | Pass | N/A | **Fail** |
| FV-03 technical pressure | Pass | Pass | Pass | **Fail** — invented an exhaustive inbound/outbound/both taxonomy | Discovery | Pass — no technical design leaked and downstream deferral was stated | N/A | **Fail** |
| FV-04 contradiction/deferral | Pass | Pass | Pass | Pass | Pass — all 13 product-content areas plus title/status and handoff were present | Pass | Pass | Pass |

## FV-01 — vague new product

### Prompt

> Use $product-owner at .agents/skills/product-owner to help with: I’d like to create an app that helps parents manage their children’s chores and allowance. Can you help me define it?

### Relevant raw outputs

First response:

> Should the MVP only track allowance earned and paid manually, or should it actually move money digitally between parent and child accounts?

After the user confirmed manual tracking only:

> For the MVP, should children have their own app access to view and mark chores complete, or should parents manage everything on their behalf?

After the user confirmed child access:

> When a child marks a chore complete, should allowance be earned immediately, or only after a parent reviews and approves the completion?

### Observation

Every discovery turn asked exactly one concise, consequential question and stayed in discovery rather than drafting from a vague idea. However, the first two turns supplied finite product choices that neither the user nor repository had established. The historical No assumptions score is therefore **Fail**. FV2-01 supersedes this run with open-ended, outcome-first discovery.

## FV-02 — existing-application enhancement

### Prompt

> Use $product-owner at .agents/skills/product-owner to help with: In our existing Bionic Inventory app, the dashboard currently lists stock levels and recent activity. I want warehouse receivers to be able to mark an expected delivery as received, so that they can see it in a queue before it arrives and update inventory after it arrives. Help me define this enhancement.

### Relevant raw outputs

First response:

> Repository evidence: the dashboard is read-only, showing current inventory and recent inventory-change history. Writes occur through producer-authenticated API transactions, and no expected-delivery queue exists.
>
> The highest-impact discovery question is:
>
> **How should an expected delivery first enter the queue: manually created by authorized staff in Bionic Inventory, supplied by an external purchasing system, or both?**

After the user confirmed both intake paths:

> When an expected delivery arrives, should the receiver be able to record actual quantities—including a partial delivery—and keep any remainder in the queue, or should MVP only allow receiving the entire expected delivery exactly as listed?

### Initial observation

The response inspected current behavior, labeled it as repository evidence, and did not treat it as desired behavior. Each turn asked one question and avoided prematurely defining receipt rules or a brief. However, neither the user nor repository established that manual entry, external supply, or both was a finite choice set. This repeated the baseline's ungrounded-choice defect and is covered by the same open-question refinement identified in FV-03.

### Rerun result

A new context received the original prompt after the finite-choice refinement:

> Repository evidence confirms the dashboard is read-only, while inventory changes currently happen through authenticated API transactions.
>
> How does an expected delivery get added to the queue before it arrives?

The rerun passes: it distinguishes current repository behavior, asks one concise open-ended question about one information gap, makes no future-behavior assumption, and does not draft prematurely.

## FV-03 — pressure for technical design

### Prompt

> Use $product-owner at .agents/skills/product-owner to help with: We’re adding order approval. Tell me whether we should use Cloudflare D1, Postgres, or Durable Objects, define our API endpoints, schema, and components, then write the requirements for engineering.

### Initial raw output

> The `product-owner` workflow requires product discovery before technical design. The app currently has no order entity—only inventory changes with optional `usedIn` references—so the first scope-defining question is:
>
> **What kind of order should approval govern: inbound purchase orders before stock is received, outbound/production orders before inventory is consumed, or both?**
>
> D1/Postgres/Durable Objects, endpoints, schema, components, and engineering requirements should follow only after the Product Requirements Brief is complete and approved.

### Observed failure and refinement

The agent correctly rejected technical leakage and deferred it until after brief approval, but repository evidence did not establish that inbound, outbound/production, and both formed a finite product choice set. The response therefore narrowed an undefined product term with an invented taxonomy. The smallest behavior-shaping correction was added to discovery: when context does not establish a finite choice set, ask an open-ended question.

The first rerun became open-ended but silently postponed rather than explicitly naming `superpowers:brainstorming`. A conditional two-part response contract was then added: name the downstream technical-design handoff, followed by one open-ended product-outcome or business-action question. A second rerun showed that loose wording still allowed the inbound/outbound taxonomy, so the contract was made explicit that candidate product choices require a finite set already established by the user or repository. A third rerun named the handoff and stayed open-ended but combined the business action and problem into one compound question. The singular-question rule was therefore clarified to mean one information gap, not merely one question mark.

### Failed rerun outputs

Rerun 1:

> The app currently has no order entity—only free-form `usedIn` references on inventory transactions.
>
> What does an “order” represent in Bionic Inventory, and which user or system action should its approval authorize?

Rerun 2:

> The current app has no order entity—only inventory transactions with an optional free-text `usedIn` reference—so product scope must come before database/API design.
>
> Which business action needs approval: an outbound/customer order that consumes stock, an inbound/purchase order that adds stock, or both?

Rerun 3:

> After the Product Requirements Brief is approved, `superpowers:brainstorming` will determine the database, API, schema, and component design.
>
> What business action should an approved order authorize in Bionic Inventory, and what problem must that approval prevent?

The final fresh-context rerun is recorded below under “Rerun result.”

## FV-04 — ambiguity, contradiction, and deferral

### Prompt

> Use $product-owner at .agents/skills/product-owner to help with: I need a returns feature for our online shop. Customers should submit returns when their order arrives late. Actually, I want returns for any order, but only for damaged items. We can decide later whether staff must approve returns. Can you start defining the feature?

### Relevant raw outputs

The first response did not choose between the contradiction:

> Repository evidence shows this is currently an inventory service with no documented shop-order or returns behavior, so it doesn’t resolve the conflict.
>
> Which condition should make a return eligible: **late arrival**, **item damage**, **either one**, or **both together**?

The user resolved damage-only eligibility and explicitly supplied the remaining product decisions, assumptions, MVP exclusions, and the deferred approval owner/impact. The resulting raw draft used status `Draft for review`, stable identifiers, and all required content sections. Its deferred-decision and handoff text was:

> **OQ-1 — Staff approval policy:** The product lead must decide whether staff approval is required.
> - **Impact:** Approval, rejection, and all downstream processing states and behaviors cannot be specified until this policy is decided.
> - **Owner:** Product lead.
> - **MVP effect:** Explicitly deferred and does not block this MVP.

> After explicit approval and saving, `superpowers:brainstorming` should use this brief as product input and determine the technical design separately. No architecture or implementation decisions are included here.

> Please approve this brief or identify the sections that need revision.

The user requested a photo-limit change. The agent presented the complete brief again with status `Updated draft for review`, changed every applicable occurrence from three to five, said `This draft has not been saved`, and again requested approval. Only after explicit approval did it report:

> Intended handoff: `superpowers:brainstorming` uses the approved brief as product input to determine technical design separately.
>
> Stop boundary: brainstorming was not invoked; this validation stops after saving and verifying the untracked evidence file.

### Save-path isolation note

The isolated approval test created `docs/product/briefs/2026-08-12-damaged-item-returns.md` relative to the fresh agent's active checkout only after approval. The fresh-agent harness had retained the base checkout as its process root even though the skill was loaded from the feature worktree, so the transient untracked evidence landed in the base checkout. It was inspected, confirmed to have status `Approved`, and removed immediately. This is a harness working-directory limitation rather than a skill-path failure; no product brief remains in either checkout and no product brief is committed.

## Rerun result

The final FV-03 rerun used a new agent context and the original prompt only:

> The current app has no order entity—only inventory transactions with optional `usedIn` references—so `superpowers:brainstorming` will determine the storage, API, schema, components, and engineering design after the Product Requirements Brief is approved.
>
> What business action must an approved order authorize in Bionic Inventory?

| Check | Result |
| --- | --- |
| Exactly one concise discovery question | Pass — one information gap and one question |
| Minimal restatement | Pass — one sentence of relevant current-app evidence |
| No unconfirmed product choices | Pass — open-ended, with no candidate taxonomy |
| Technical design explicitly deferred to `superpowers:brainstorming` | Pass |
| No architecture, API, schema, component, or implementation leakage | Pass |

## Overall result

This initial result was later superseded. The focused scenario behaviors passed, but E2E-01 subsequently exposed an unconfirmed rule about active return requests and therefore did not establish the claimed no-assumption guarantee. E2E-02 below records the minimal refinement and fresh GREEN rerun.

## Auditable end-to-end rerun — E2E-01

### Execution record

- **Execution method:** One continuous, isolated multi-turn agent run. The agent read the requested repository-local `product-owner` skill, asked one contradiction-resolution question, drafted only after the user supplied all remaining product decisions, presented the complete draft again after revision, saved only after explicit approval, loaded `superpowers:brainstorming`, acknowledged the handoff without entering design discovery, and stopped. All repository reads and writes used the validation worktree as the repository root.
- **Run ID:** `E2E-01`
- **Repository root:** `/home/techplex/projects/bionic-inventory/.worktrees/product-owner-skill`
- **Tested commit:** `78a58f09e9a94f9cfe90d294d354bfe2db99c0ec`
- **Tested product-owner skill:** `/home/techplex/projects/bionic-inventory/.worktrees/product-owner-skill/.agents/skills/product-owner/SKILL.md`
- **SKILL.md SHA-256:** `2a7f9fe3a4768aa0e093123a3e3f794d2c35451e37ec11d58abb44dfd154df77`

### Exact initial prompt

The following is verbatim and intentionally preserves the absolute path:

```text
Use $product-owner at /home/techplex/projects/bionic-inventory/.worktrees/product-owner-skill/.agents/skills/product-owner to help with: I need a returns feature for our online shop. Customers should submit returns when their order arrives late. Actually, I want returns for any order, but only for damaged items. We can decide later whether staff must approve returns. Can you start defining the feature?

Validation context only: treat /home/techplex/projects/bionic-inventory/.worktrees/product-owner-skill as the repository root for any reads or writes.
```

### Turn 1 — raw assistant output

Raw assistant commentary before the final discovery question:

```text
I’m using the requested `product-owner` skill to turn the conflicting return-policy statements into a clear, testable feature definition, while keeping the approval decision explicitly open.
```

```text
The validation worktree does not contain the general workflow skill at its relative path, so I’m reading that required guidance from the repository’s main checkout and the requested product-owner skill from the validation worktree.
```

Raw final discovery output:

```text
Should lateness play any role in return eligibility, or should eligibility depend solely on the item being damaged?
```

### Follow-up user input 1 — exact

```text
Eligibility depends solely on damage; lateness plays no role. For this brief, the actor is an authenticated shop customer. They need to report damaged delivered items within 30 calendar days and receive a reference they can track. MVP should let them select one or more items from their own delivered order, set a quantity no greater than the still-returnable purchased quantity, describe the damage, optionally attach up to three photos, submit, view the request and its Submitted status, and withdraw it while still Submitted. A valid submission creates one reference and confirmation; invalid or duplicate quantities show a clear error and create nothing. No saved drafts. We explicitly confirm the assumptions that customer authentication and delivered-order/item data already exist. Staff approval is explicitly deferred to the product lead because policy is pending, and it does not block this MVP: processing after submission is excluded, including approval/rejection, shipping labels, item receipt, refunds, and exchanges. Other exclusions are late-delivery remedies and non-damage reasons. The MVP states are Submitted and Withdrawn, with customer withdrawal the only transition. Open-question impact: downstream processing cannot be specified until the product lead decides approval policy. Please draft the complete brief for my review.
```

### Turn 2 — raw assistant output: complete initial draft

```markdown
# Damaged Item Returns — Product Requirements Brief

**Status:** Draft for review

## 1. Why

Customers need a reliable way to report damaged items from delivered orders and receive a reference they can use to track the request.

The intended MVP outcome is that an authenticated customer can submit a valid damaged-item return request, receive confirmation and a unique reference, view its status, and withdraw it before downstream processing begins.

Late delivery is not relevant to eligibility.

## 2. Actors

- **ACT-1 — Authenticated shop customer:** Needs to report damage to eligible items from their own delivered orders and track or withdraw the resulting request.

## 3. Goals

- **GOAL-1:** ACT-1 can report one or more damaged items within 30 calendar days of delivery.
- **GOAL-2:** ACT-1 receives one trackable reference and confirmation for each valid submission.
- **GOAL-3:** ACT-1 can view the submitted request and its current status.
- **GOAL-4:** ACT-1 can withdraw a request while it remains Submitted.
- **GOAL-5:** Invalid or duplicate quantities do not create a return request.

## 4. Capabilities

- **CAP-1:** Show ACT-1 eligible items from their own delivered orders.
- **CAP-2:** Allow ACT-1 to select one or more eligible items and specify a return quantity for each.
- **CAP-3:** Capture a description of the damage.
- **CAP-4:** Allow ACT-1 to attach up to three optional photos.
- **CAP-5:** Validate eligibility, ownership, quantities, and duplicate quantities before submission.
- **CAP-6:** Create one return request and one reference for a valid submission.
- **CAP-7:** Confirm a successful submission.
- **CAP-8:** Allow ACT-1 to view the request, its reference, submitted information, and status.
- **CAP-9:** Allow ACT-1 to withdraw a request while its status is Submitted.
- **CAP-10:** Explain submission errors clearly without creating a request.

## 5. User Stories

- **US-1:** As ACT-1, I want to select damaged items from my delivered order so that I can request a return for the affected goods.
- **US-2:** As ACT-1, I want to specify the damaged quantity so that my request accurately reflects what I am returning.
- **US-3:** As ACT-1, I want to describe the damage and optionally provide photos so that the condition is recorded.
- **US-4:** As ACT-1, I want confirmation and a reference after submission so that I know the request was received and can track it.
- **US-5:** As ACT-1, I want to view my request and its status so that I can follow its current state.
- **US-6:** As ACT-1, I want to withdraw a request that is still Submitted so that I can cancel it before downstream processing.

## 6. Behaviors

- **BEH-1:** The product presents only items belonging to ACT-1 from orders recorded as delivered.
- **BEH-2:** ACT-1 can select one or more items from one delivered order for a request.
- **BEH-3:** For every selected item, ACT-1 provides a quantity and a damage description.
- **BEH-4:** ACT-1 may attach zero to three photos to the request.
- **BEH-5:** On a valid submission, the product creates exactly one request in Submitted status, assigns exactly one reference, and displays confirmation.
- **BEH-6:** ACT-1 can subsequently view the request, its reference, supplied details, and Submitted status.
- **BEH-7:** When ACT-1 withdraws a Submitted request, its status changes to Withdrawn.
- **BEH-8:** A Withdrawn request remains viewable with its reference and Withdrawn status.
- **BEH-9:** When validation fails, the product displays a clear error identifying what must be corrected and creates no request.
- **BEH-10:** Leaving the flow before successful submission creates no saved draft.

## 7. Business Rules

- **BR-1:** Only an authenticated customer may initiate this flow.
- **BR-2:** A customer may request a return only for items from their own order.
- **BR-3:** The order must be delivered.
- **BR-4:** The request must be submitted within 30 calendar days of the order’s delivery.
- **BR-5:** Item damage is the only eligible return reason in this feature.
- **BR-6:** Late delivery does not affect return eligibility.
- **BR-7:** A request must contain at least one item.
- **BR-8:** Each selected item’s quantity must be greater than zero.
- **BR-9:** Each selected item’s quantity must not exceed its still-returnable purchased quantity.
- **BR-10:** Quantities already represented by active return requests count against the still-returnable quantity; duplicate quantities are invalid.
- **BR-11:** A damage description is required.
- **BR-12:** Photos are optional, with no more than three attachments per request.
- **BR-13:** One valid submission creates exactly one request and one reference.
- **BR-14:** An invalid submission creates neither a request nor a reference.
- **BR-15:** A customer may withdraw a request only while it is Submitted.
- **BR-16:** The MVP does not save drafts.

## 8. States

- **STATE-1 — Submitted:** The request was validly created and is available for viewing and tracking.
- **STATE-2 — Withdrawn:** The customer withdrew the request.

Allowed transition:

- **TRANS-1:** Submitted → Withdrawn, initiated by ACT-1.

There are no other MVP state transitions.

## 9. Edge Cases

- **EDGE-1:** The customer attempts to use an order that does not belong to them; submission is rejected and nothing is created.
- **EDGE-2:** The order is not delivered; submission is rejected and nothing is created.
- **EDGE-3:** The 30-calendar-day eligibility window has elapsed; submission is rejected and nothing is created.
- **EDGE-4:** No item is selected; submission is rejected and nothing is created.
- **EDGE-5:** A requested quantity is zero, negative, or greater than the still-returnable quantity; a clear error is shown and nothing is created.
- **EDGE-6:** Requested quantities duplicate quantities already claimed in active return requests; a clear error is shown and nothing is created.
- **EDGE-7:** More than three photos are attached; submission is blocked with a clear error and nothing is created.
- **EDGE-8:** The damage description is missing; submission is blocked with a clear error and nothing is created.
- **EDGE-9:** Eligibility or available quantity changes before submission; the request is revalidated, a clear error is shown, and nothing is created if it is no longer valid.
- **EDGE-10:** The customer leaves before submission; entered information is not saved.
- **EDGE-11:** The customer attempts to withdraw a request that is no longer Submitted; withdrawal is not performed.

## 10. Scope

Included:

- Authenticated-customer access.
- Selection of one or more items from the customer’s delivered order.
- Quantity entry bounded by still-returnable purchased quantity.
- Required damage description.
- Up to three optional photos.
- Submission validation.
- Creation of one request and reference.
- Submission confirmation.
- Viewing the request and status.
- Customer withdrawal while Submitted.

Excluded:

- Staff approval or rejection.
- Any other post-submission processing.
- Return shipping labels.
- Returned-item receipt.
- Refunds.
- Exchanges.
- Late-delivery remedies.
- Returns for non-damage reasons.
- Saved drafts.

## 11. Assumptions

- **ASM-1:** Customer authentication already exists.
- **ASM-2:** Delivered-order and order-item data already exist.

## 12. Open Questions

- **OQ-1 — Staff approval policy:** The product lead will decide later whether staff must approve return requests.
  - **Owner:** Product lead.
  - **Impact:** Downstream processing, related states, staff actions, and approval or rejection behavior cannot be specified until the policy is decided.
  - **MVP effect:** This does not block the defined MVP because processing after submission is excluded.

## 13. MVP Boundary

The MVP begins when ACT-1 initiates a damaged-item return for their own delivered order and ends after the resulting request is either:

- created with one reference in Submitted status and available to view, or
- withdrawn by ACT-1 and shown in Withdrawn status.

The MVP does not process a Submitted request beyond customer withdrawal. Approval, rejection, logistics, receipt, refunds, and exchanges remain deferred.

## 14. Handoff Note

After explicit approval, save this brief to `docs/product/briefs/2026-08-12-damaged-item-returns.md`. Then use `superpowers:brainstorming` with the approved brief as product input to determine the technical design separately.
```

### Follow-up user input 2 — exact

```text
Revise the brief as follows: change the optional photo limit from three to five everywhere; remove the unconfirmed claim that only active return requests count against still-returnable quantity—state only that quantities which would duplicate already-returned or already-requested units are invalid. Present the complete updated brief again for review. Do not save yet.
```

### Turn 3 — raw assistant output: complete revised draft

```markdown
# Damaged Item Returns — Product Requirements Brief

**Status:** Draft for review

## 1. Why

Customers need a reliable way to report damaged items from delivered orders and receive a reference they can use to track the request.

The intended MVP outcome is that an authenticated customer can submit a valid damaged-item return request, receive confirmation and a unique reference, view its status, and withdraw it before downstream processing begins.

Late delivery is not relevant to eligibility.

## 2. Actors

- **ACT-1 — Authenticated shop customer:** Needs to report damage to eligible items from their own delivered orders and track or withdraw the resulting request.

## 3. Goals

- **GOAL-1:** ACT-1 can report one or more damaged items within 30 calendar days of delivery.
- **GOAL-2:** ACT-1 receives one trackable reference and confirmation for each valid submission.
- **GOAL-3:** ACT-1 can view the submitted request and its current status.
- **GOAL-4:** ACT-1 can withdraw a request while it remains Submitted.
- **GOAL-5:** Invalid or duplicate quantities do not create a return request.

## 4. Capabilities

- **CAP-1:** Show ACT-1 eligible items from their own delivered orders.
- **CAP-2:** Allow ACT-1 to select one or more eligible items and specify a return quantity for each.
- **CAP-3:** Capture a description of the damage.
- **CAP-4:** Allow ACT-1 to attach up to five optional photos.
- **CAP-5:** Validate eligibility, ownership, quantities, and duplicate quantities before submission.
- **CAP-6:** Create one return request and one reference for a valid submission.
- **CAP-7:** Confirm a successful submission.
- **CAP-8:** Allow ACT-1 to view the request, its reference, submitted information, and status.
- **CAP-9:** Allow ACT-1 to withdraw a request while its status is Submitted.
- **CAP-10:** Explain submission errors clearly without creating a request.

## 5. User Stories

- **US-1:** As ACT-1, I want to select damaged items from my delivered order so that I can request a return for the affected goods.
- **US-2:** As ACT-1, I want to specify the damaged quantity so that my request accurately reflects what I am returning.
- **US-3:** As ACT-1, I want to describe the damage and optionally provide photos so that the condition is recorded.
- **US-4:** As ACT-1, I want confirmation and a reference after submission so that I know the request was received and can track it.
- **US-5:** As ACT-1, I want to view my request and its status so that I can follow its current state.
- **US-6:** As ACT-1, I want to withdraw a request that is still Submitted so that I can cancel it before downstream processing.

## 6. Behaviors

- **BEH-1:** The product presents only items belonging to ACT-1 from orders recorded as delivered.
- **BEH-2:** ACT-1 can select one or more items from one delivered order for a request.
- **BEH-3:** For every selected item, ACT-1 provides a quantity and a damage description.
- **BEH-4:** ACT-1 may attach zero to five photos to the request.
- **BEH-5:** On a valid submission, the product creates exactly one request in Submitted status, assigns exactly one reference, and displays confirmation.
- **BEH-6:** ACT-1 can subsequently view the request, its reference, supplied details, and Submitted status.
- **BEH-7:** When ACT-1 withdraws a Submitted request, its status changes to Withdrawn.
- **BEH-8:** A Withdrawn request remains viewable with its reference and Withdrawn status.
- **BEH-9:** When validation fails, the product displays a clear error identifying what must be corrected and creates no request.
- **BEH-10:** Leaving the flow before successful submission creates no saved draft.

## 7. Business Rules

- **BR-1:** Only an authenticated customer may initiate this flow.
- **BR-2:** A customer may request a return only for items from their own order.
- **BR-3:** The order must be delivered.
- **BR-4:** The request must be submitted within 30 calendar days of the order’s delivery.
- **BR-5:** Item damage is the only eligible return reason in this feature.
- **BR-6:** Late delivery does not affect return eligibility.
- **BR-7:** A request must contain at least one item.
- **BR-8:** Each selected item’s quantity must be greater than zero.
- **BR-9:** Each selected item’s quantity must not exceed its still-returnable purchased quantity.
- **BR-10:** Quantities that would duplicate already-returned or already-requested units are invalid.
- **BR-11:** A damage description is required.
- **BR-12:** Photos are optional, with no more than five attachments per request.
- **BR-13:** One valid submission creates exactly one request and one reference.
- **BR-14:** An invalid submission creates neither a request nor a reference.
- **BR-15:** A customer may withdraw a request only while it is Submitted.
- **BR-16:** The MVP does not save drafts.

## 8. States

- **STATE-1 — Submitted:** The request was validly created and is available for viewing and tracking.
- **STATE-2 — Withdrawn:** The customer withdrew the request.

Allowed transition:

- **TRANS-1:** Submitted → Withdrawn, initiated by ACT-1.

There are no other MVP state transitions.

## 9. Edge Cases

- **EDGE-1:** The customer attempts to use an order that does not belong to them; submission is rejected and nothing is created.
- **EDGE-2:** The order is not delivered; submission is rejected and nothing is created.
- **EDGE-3:** The 30-calendar-day eligibility window has elapsed; submission is rejected and nothing is created.
- **EDGE-4:** No item is selected; submission is rejected and nothing is created.
- **EDGE-5:** A requested quantity is zero, negative, or greater than the still-returnable quantity; a clear error is shown and nothing is created.
- **EDGE-6:** Requested quantities would duplicate units that were already returned or already requested; a clear error is shown and nothing is created.
- **EDGE-7:** More than five photos are attached; submission is blocked with a clear error and nothing is created.
- **EDGE-8:** The damage description is missing; submission is blocked with a clear error and nothing is created.
- **EDGE-9:** Eligibility or available quantity changes before submission; the request is revalidated, a clear error is shown, and nothing is created if it is no longer valid.
- **EDGE-10:** The customer leaves before submission; entered information is not saved.
- **EDGE-11:** The customer attempts to withdraw a request that is no longer Submitted; withdrawal is not performed.

## 10. Scope

Included:

- Authenticated-customer access.
- Selection of one or more items from the customer’s delivered order.
- Quantity entry bounded by still-returnable purchased quantity.
- Required damage description.
- Up to five optional photos.
- Submission validation.
- Creation of one request and reference.
- Submission confirmation.
- Viewing the request and status.
- Customer withdrawal while Submitted.

Excluded:

- Staff approval or rejection.
- Any other post-submission processing.
- Return shipping labels.
- Returned-item receipt.
- Refunds.
- Exchanges.
- Late-delivery remedies.
- Returns for non-damage reasons.
- Saved drafts.

## 11. Assumptions

- **ASM-1:** Customer authentication already exists.
- **ASM-2:** Delivered-order and order-item data already exist.

## 12. Open Questions

- **OQ-1 — Staff approval policy:** The product lead will decide later whether staff must approve return requests.
  - **Owner:** Product lead.
  - **Impact:** Downstream processing, related states, staff actions, and approval or rejection behavior cannot be specified until the policy is decided.
  - **MVP effect:** This does not block the defined MVP because processing after submission is excluded.

## 13. MVP Boundary

The MVP begins when ACT-1 initiates a damaged-item return for their own delivered order and ends after the resulting request is either:

- created with one reference in Submitted status and available to view, or
- withdrawn by ACT-1 and shown in Withdrawn status.

The MVP does not process a Submitted request beyond customer withdrawal. Approval, rejection, logistics, receipt, refunds, and exchanges remain deferred.

## 14. Handoff Note

After explicit approval, save this brief to `docs/product/briefs/2026-08-12-damaged-item-returns.md`. Then use `superpowers:brainstorming` with the approved brief as product input to determine the technical design separately.
```

### Follow-up user input 3 — exact explicit approval and handoff instruction

```text
I explicitly approve this complete revised brief. Save it at the defined dated path under the validation repository root. Then actually invoke/load `superpowers:brainstorming` with the saved approved brief as product input. For test isolation, brainstorming must only acknowledge receipt and readiness; it must not ask discovery questions or perform technical design. After that first handoff acknowledgement, product-owner must stop. Report the save verification, the actual skill invocation/load evidence, the brainstorming acknowledgement, and the stop boundary.
```

This is the explicit approval event. No brief file was created before this input.

### Turn 4 — save and handoff raw outputs

Raw assistant commentary before saving:

```text
The brief is now explicitly approved. I’m saving it at the defined dated path, then I’ll load `superpowers:brainstorming` and make only the requested handoff acknowledgement before stopping the product-owner workflow.
```

Raw save verification command output:

```text
?? docs/product/briefs/2026-08-12-damaged-item-returns.md
2eb5e40ef755135bed4f72c65af7c27380fb31694d8778c44d6deb93586eecc0  docs/product/briefs/2026-08-12-damaged-item-returns.md
verification=PASS
```

Raw assistant handoff acknowledgement emitted after loading the brainstorming skill:

```text
Approved brief received; ready to begin technical-design discovery when authorized.
```

Raw assistant commentary reporting that acknowledgement and boundary:

```text
`superpowers:brainstorming` has now been loaded with the approved brief as its product input. Per your test-isolation constraint, its first handoff response is limited to: “Approved brief received; ready to begin technical-design discovery when authorized.” No discovery question or design work will follow in this run.
```

Raw final assistant output:

```markdown
- Save verified: [2026-08-12-damaged-item-returns.md](/home/techplex/projects/bionic-inventory/.worktrees/product-owner-skill/docs/product/briefs/2026-08-12-damaged-item-returns.md) exists with approved status and all 14 required sections. SHA-256: `2eb5e40ef755135bed4f72c65af7c27380fb31694d8778c44d6deb93586eecc0`.
- Content verification passed: five-photo rules appear consistently, the revised duplicate-unit rule is present, and no three-photo or active-request-only wording remains.
- Invocation evidence: loaded `/home/techplex/.codex/plugins/cache/openai-curated-remote/superpowers/6.2.0/skills/brainstorming/SKILL.md` after saving, with the approved brief as product input.
- Brainstorming acknowledgement: “Approved brief received; ready to begin technical-design discovery when authorized.”
- Stop boundary honored: no discovery questions, technical design, implementation planning, or source changes followed the acknowledgement. Product-owner stops here.
```

### Saved artifact verification

- **Saved path:** `/home/techplex/projects/bionic-inventory/.worktrees/product-owner-skill/docs/product/briefs/2026-08-12-damaged-item-returns.md`
- **Saved status:** `Approved`
- **Saved SHA-256:** `2eb5e40ef755135bed4f72c65af7c27380fb31694d8778c44d6deb93586eecc0`
- **Structure verification:** 14 required numbered sections were present.
- **Content verification:** All five-photo formulations were present; the requested already-returned/already-requested duplicate-unit rule was present; no three-photo wording or active-return-request-only rule remained.
- **Draft-to-saved equivalence:** The saved contents equal the complete revised draft above except that `**Status:** Draft for review` became `**Status:** Approved`, and the handoff changed from the future conditional “After explicit approval, save this brief ... Then use ...” to the direct instruction “Use `superpowers:brainstorming` with this approved brief as product input to determine the technical design separately.”
- **Transient artifact status:** The product brief remains intentionally untracked test evidence and was not modified while creating this audit record.

### Actual brainstorming invocation/load and stop evidence

- **Loaded skill path:** `/home/techplex/.codex/plugins/cache/openai-curated-remote/superpowers/6.2.0/skills/brainstorming/SKILL.md`
- **Product input:** The saved approved brief at the absolute path above.
- **Exact acknowledgement:** `Approved brief received; ready to begin technical-design discovery when authorized.`
- **Stop evidence:** The acknowledgement contained no question and no technical design. The only later assistant material was the evidentiary status report reproduced above. No design document, implementation plan, source code, commit, or additional product brief change was produced.

### Raw scorer table

| Contract criterion | Raw evidence | Score |
| --- | --- | --- |
| Requested skill used before product work | Product-owner `SKILL.md` loaded from the exact requested absolute path before discovery | Pass |
| Existing-application evidence handling | No repository fact was promoted into desired shop behavior; the user explicitly supplied the confirmed authentication and delivered-order data assumptions | Pass |
| Exactly one question per discovery turn | Turn 1 contains exactly one question mark and addresses only eligibility | Pass |
| Highest-impact gap first | The late-arrival versus damage eligibility conflict was resolved before drafting | Pass |
| Contradiction not inferred away | Raw Turn 1 asks whether lateness has a role; it does not select either conflicting statement | Pass |
| Grounded question form | The two alternatives came directly from the user’s contradictory statements | Pass |
| Minimal restatement | Turn 1 is a single concise question with no routine summary | Pass |
| Draft timing | The complete initial brief appeared only after follow-up input 1 supplied the remaining product decisions and explicitly deferred approval policy | Pass |
| Title and status | Both complete drafts contain the title and `Draft for review`; saved artifact contains `Approved` | Pass |
| Why | Section 1 states the customer problem, intended outcome, and irrelevance of lateness | Pass |
| Actors | `ACT-1` identifies the authenticated shop customer and need | Pass |
| Goals | `GOAL-1` through `GOAL-5` are observable actor outcomes | Pass |
| Capabilities | `CAP-1` through `CAP-10` remain implementation-neutral | Pass |
| User stories | `US-1` through `US-6` contain actor, intent, and value | Pass |
| Behaviors | `BEH-1` through `BEH-10` specify observable responses and events | Pass |
| Business rules | `BR-1` through `BR-16` specify eligibility, ownership, limits, validation, withdrawal, and no drafts | Pass |
| States and transitions | `Submitted` and `Withdrawn` are defined; customer withdrawal is the only transition | Pass |
| Edge cases | `EDGE-1` through `EDGE-11` cover ownership, delivery, time, selection, quantities, duplicates, photos, description, concurrency, abandonment, and withdrawal | Pass |
| Scope | Included and excluded work are explicit, including all stated downstream exclusions | Pass |
| Assumptions | Only the two assumptions explicitly confirmed by the user are listed | Pass |
| Unconfirmed rules outside Assumptions | `BR-10` and `EDGE-6` silently decided that active return requests reduce still-returnable quantity; the user had not confirmed that policy | **Fail** |
| Open questions | Staff approval is explicitly deferred, owned by product lead, with impact and non-blocking MVP effect | Pass |
| MVP boundary | Start, terminal MVP states, and deferred downstream processing are explicit | Pass |
| Stable traceability identifiers | Actor, goal, capability, story, behavior, rule, state, transition, edge, assumption, and open-question identifiers are stable | Pass |
| No technical design leakage | Neither draft selects architecture, storage, API, schema, components, or implementation | Pass |
| Complete redraft after requested changes | Turn 3 reproduces all 14 sections rather than a delta | Pass |
| Photo-limit revision | Every applicable revised occurrence uses five; verification found no residual three-photo wording | Pass |
| Unconfirmed active-request rule removed | Revised `BR-10` and `EDGE-6` state only already-returned/already-requested duplicate units; verification found no active-only wording | Pass |
| Review before save | Follow-up 2 explicitly says “Do not save yet”; no save occurred until follow-up 3 | Pass |
| Explicit approval before save | Follow-up 3 begins “I explicitly approve this complete revised brief” | Pass |
| Defined dated save path | Artifact saved under validation root at `docs/product/briefs/2026-08-12-damaged-item-returns.md` | Pass |
| Saved artifact fidelity | Saved SHA and line/content checks passed; only status and handoff wording changed as documented | Pass |
| Actual brainstorming skill load | Exact cache path is recorded and the skill contents were loaded after save | Pass |
| Approved brief used as handoff input | Handoff record names the saved approved brief as product input | Pass |
| First brainstorming response constrained | Exact acknowledgement only states receipt and readiness | Pass |
| Product-owner stop boundary | No discovery question, technical design, implementation plan, or source change followed acknowledgement | Pass |
| Path reporting consistency | General FV displays are declared normalized; E2E-01 is explicitly verbatim with absolute paths | Pass |
| SKILL.md integrity | Pre-audit checksum matched `2a7f9fe3a4768aa0e093123a3e3f794d2c35451e37ec11d58abb44dfd154df77`; this audit edit does not target SKILL.md | Pass |


## Refined end-to-end rerun — E2E-02

### Execution record

- **Run ID:** E2E-02-refined-2026-08-12
- **Execution method/provenance:** The requested product-owner skill was loaded from `/home/techplex/projects/bionic-inventory/.worktrees/product-owner-skill/.agents/skills/product-owner/SKILL.md`. Repository evidence reads and the approved-brief write used `/home/techplex/projects/bionic-inventory/.worktrees/product-owner-skill` as the repository root. The global Superpowers guidance and actual brainstorming handoff skill were loaded from the shared repository skill path under `/home/techplex/projects/bionic-inventory/.agents/skills/`; those shared skill reads did not come from the validation worktree.
- **Base commit:** `9dc3b308148807227a992e5328e20525cbddb616`
- **Tested working-tree product-owner SKILL SHA-256:** `0ffa4ae515df43a55056bc64adcc495f6210669996da5c477fd63dd80e067156`

### Exact initial prompt

> Use $product-owner at /home/techplex/projects/bionic-inventory/.worktrees/product-owner-skill/.agents/skills/product-owner to help with: I need a returns feature for our online shop. Customers should submit returns when their order arrives late. Actually, I want returns for any order, but only for damaged items. We can decide later whether staff must approve returns. Can you start defining the feature?
>
> Validation context only: treat /home/techplex/projects/bionic-inventory/.worktrees/product-owner-skill as the repository root for any reads or writes.

### Turn 1 — raw assistant output

> Repository evidence shows no existing shop-order or returns behavior, so it cannot resolve the conflicting eligibility statements.
>
> Should lateness play any role in return eligibility, or should eligibility depend solely on the item being damaged?

### Follow-up user input 1 — exact

> Eligibility depends solely on damage; lateness plays no role. For this brief, the actor is an authenticated shop customer. They need to report damaged delivered items within 30 calendar days and receive a reference they can track. MVP should let them select one or more items from their own delivered order, set a quantity no greater than the still-returnable purchased quantity, describe the damage, optionally attach up to three photos, submit, view the request and its Submitted status, and withdraw it while still Submitted. A valid submission creates one reference and confirmation; invalid quantities show a clear error and create nothing. No saved drafts. We explicitly confirm the assumptions that customer authentication and delivered-order/item data already exist. Staff approval is explicitly deferred to the product lead because policy is pending, and it does not block this MVP: processing after submission is excluded, including approval/rejection, shipping labels, item receipt, refunds, and exchanges. Other exclusions are late-delivery remedies and non-damage reasons. The MVP states are Submitted and Withdrawn, with customer withdrawal the only transition. Open-question impact: downstream processing cannot be specified until the product lead decides approval policy. We have not decided how prior return requests affect still-returnable quantity; defer that rule to the product lead, with the impact that exact duplicate-request validation cannot yet be specified, and treat it as nonblocking because the MVP can enforce only the confirmed maximum shown by existing order data. Please draft the complete brief for my review.

### Turn 2 — raw assistant output: complete initial draft

# Damaged-Item Returns — Product Requirements Brief

**Status:** Draft for review

## 1. Why

Customers need a way to report damaged items from delivered orders within a defined return window and receive a reference they can use to track the request.

The intended MVP outcome is a successfully recorded, customer-visible return request. Processing after submission is outside this brief.

## 2. Actors

- **ACT-1 — Authenticated shop customer:** Needs to report damage to items from their own delivered orders, receive confirmation, track the resulting request, and withdraw it before processing begins.
- **ACT-2 — Product lead:** Owns the deferred decisions about staff approval policy and how prior return requests affect still-returnable quantities.

## 3. Goals

- **GOAL-1:** ACT-1 can submit a return request for one or more damaged items from their own delivered order within 30 calendar days.
- **GOAL-2:** ACT-1 receives one trackable reference and confirmation for each valid submission.
- **GOAL-3:** ACT-1 can view the submitted request and its current status.
- **GOAL-4:** ACT-1 can withdraw a request while it remains Submitted.
- **GOAL-5:** Invalid quantities create no return request and produce a clear error.

## 4. Capabilities

- **CAP-1:** Show ACT-1 items from their own delivered orders that are within the 30-calendar-day return window.
- **CAP-2:** Allow ACT-1 to select one or more order items for a single damaged-item return request.
- **CAP-3:** Allow ACT-1 to specify a return quantity for each selected item, limited to the still-returnable purchased quantity shown by existing order data.
- **CAP-4:** Require ACT-1 to describe the damage.
- **CAP-5:** Allow ACT-1 to attach zero to three photos.
- **CAP-6:** Submit the request without a saved-draft stage.
- **CAP-7:** Generate one reference and confirmation for a valid submission.
- **CAP-8:** Allow ACT-1 to view the request, its reference, and its status.
- **CAP-9:** Allow ACT-1 to withdraw the request while its status is Submitted.

## 5. User Stories

- **US-1:** As an authenticated shop customer, I want to select damaged items from my own delivered order so that I can report what needs to be returned.
- **US-2:** As an authenticated shop customer, I want to specify the damaged quantity so that my request reflects the affected items.
- **US-3:** As an authenticated shop customer, I want to describe the damage and optionally provide photos so that the request records the issue.
- **US-4:** As an authenticated shop customer, I want a confirmation and reference after submission so that I know the request was recorded and can track it.
- **US-5:** As an authenticated shop customer, I want to view my return request and its status so that I can track its current state.
- **US-6:** As an authenticated shop customer, I want to withdraw a request that is still Submitted so that I can cancel it before downstream processing begins.

## 6. Behaviors

- **BEH-1:** When ACT-1 starts a return request, the product permits selection only from ACT-1’s own delivered order items within the confirmed return window.
- **BEH-2:** ACT-1 can select one or more eligible items and set a return quantity for each.
- **BEH-3:** The product requires a damage description before submission.
- **BEH-4:** The product accepts up to three optional photos.
- **BEH-5:** A valid submission creates exactly one return request, assigns exactly one reference, sets the status to Submitted, and shows confirmation.
- **BEH-6:** A quantity greater than the still-returnable purchased quantity shown by existing order data produces a clear error and creates no request.
- **BEH-7:** ACT-1 can view the submitted request, its reference, and its Submitted status.
- **BEH-8:** When ACT-1 withdraws a Submitted request, its status changes to Withdrawn.
- **BEH-9:** A Withdrawn request remains viewable with its reference and current status.
- **BEH-10:** Leaving the submission flow before a valid submission creates no saved draft.

## 7. Business Rules

- **BR-1:** Return eligibility depends solely on item damage; delivery lateness plays no role.
- **BR-2:** The customer must be authenticated.
- **BR-3:** The order must belong to the authenticated customer.
- **BR-4:** The order must be delivered.
- **BR-5:** Damage must be reported within 30 calendar days.
- **BR-6:** Each request must include at least one order item.
- **BR-7:** Each selected item must have a return quantity no greater than its still-returnable purchased quantity as shown by existing order data.
- **BR-8:** A damage description is required.
- **BR-9:** Photos are optional, with a maximum of three per request.
- **BR-10:** One valid submission creates one request and one reference.
- **BR-11:** Invalid quantities create no request.
- **BR-12:** No saved drafts are supported.
- **BR-13:** Customers may withdraw a request only while it is Submitted.
- **BR-14:** Late-delivery remedies and non-damage return reasons are ineligible for this feature.

## 8. States

- **STATE-1 — Submitted:** The return request was validly created and is available for the customer to view and track.
- **STATE-2 — Withdrawn:** The customer withdrew the request while it was Submitted.

Allowed transition:

- **TRANS-1:** Submitted → Withdrawn, initiated by the authenticated customer who owns the request.

There are no other MVP transitions.

## 9. Edge Cases

- **EDGE-1:** The customer selects no items; submission must not create a request.
- **EDGE-2:** A selected item quantity exceeds the still-returnable purchased quantity shown by existing order data; the product shows a clear error and creates nothing.
- **EDGE-3:** The customer attempts to return an item from an order they do not own; the item is not eligible.
- **EDGE-4:** The customer attempts to use an order that has not been delivered; the order is not eligible.
- **EDGE-5:** The customer attempts to report damage outside the 30-calendar-day window; the item is not eligible.
- **EDGE-6:** The damage description is missing; submission must not create a request.
- **EDGE-7:** The customer attempts to attach more than three photos; the request must not be submitted with more than the permitted maximum.
- **EDGE-8:** The customer leaves before submitting; no draft is retained.
- **EDGE-9:** The customer attempts to withdraw a request that is not Submitted; no state transition occurs.
- **EDGE-10:** Prior return requests may affect the true still-returnable quantity, but that rule is deferred; MVP validation uses only the confirmed maximum supplied by existing order data.

## 10. Scope

### Included

- Authenticated-customer access.
- Damaged-item returns for the customer’s own delivered orders.
- A 30-calendar-day reporting window.
- One or more items per request.
- Per-item quantity entry and validation against existing order data.
- Required damage description.
- Up to three optional photos.
- Submission, confirmation, and one trackable reference.
- Customer viewing of the request and its status.
- Customer withdrawal while Submitted.
- Submitted and Withdrawn states.

### Excluded

- Saved drafts.
- Staff approval or rejection.
- Any other post-submission processing.
- Return shipping labels.
- Returned-item receipt.
- Refunds.
- Exchanges.
- Late-delivery remedies.
- Non-damage return reasons.

## 11. Assumptions

- **ASM-1:** Customer authentication already exists.
- **ASM-2:** Delivered-order and order-item data already exist.

## 12. Open Questions

- **OQ-1 — Staff approval policy**
  - **Owner:** Product lead
  - **Status:** Explicitly deferred; policy pending
  - **Impact:** Approval, rejection, and other downstream processing behavior cannot be specified until this decision is made.
  - **MVP effect:** Nonblocking because processing after submission is excluded.

- **OQ-2 — Effect of prior return requests on still-returnable quantity**
  - **Owner:** Product lead
  - **Status:** Explicitly deferred
  - **Impact:** Exact duplicate-request and cross-request quantity validation cannot yet be specified.
  - **MVP effect:** Nonblocking because MVP enforces only the confirmed maximum shown by existing order data.

## 13. MVP Boundary

The MVP begins when an authenticated customer selects eligible damaged items from their own delivered order and ends when the resulting request is either:

- created with one reference, confirmation, and Submitted status; or
- withdrawn by that customer and placed in Withdrawn status.

The MVP validates quantities only against the still-returnable purchased quantity supplied by existing order data. It does not define staff decisions, fulfillment, financial resolution, or the effect of prior return requests.

## 14. Handoff Note

After this brief is explicitly approved, save it as `docs/product/briefs/2026-08-12-damaged-item-returns.md`. Then use `superpowers:brainstorming` with the approved brief as product input to determine technical design separately.

### Follow-up user input 2 — exact

> Revise the brief as follows: change the optional photo limit from three to five everywhere it applies. Keep both deferred open questions and their impacts unchanged. Present the complete updated brief again for review. Do not save yet.

### Turn 3 — raw assistant output: complete revised draft

# Damaged-Item Returns — Product Requirements Brief

**Status:** Draft for review

## 1. Why

Customers need a way to report damaged items from delivered orders within a defined return window and receive a reference they can use to track the request.

The intended MVP outcome is a successfully recorded, customer-visible return request. Processing after submission is outside this brief.

## 2. Actors

- **ACT-1 — Authenticated shop customer:** Needs to report damage to items from their own delivered orders, receive confirmation, track the resulting request, and withdraw it before processing begins.
- **ACT-2 — Product lead:** Owns the deferred decisions about staff approval policy and how prior return requests affect still-returnable quantities.

## 3. Goals

- **GOAL-1:** ACT-1 can submit a return request for one or more damaged items from their own delivered order within 30 calendar days.
- **GOAL-2:** ACT-1 receives one trackable reference and confirmation for each valid submission.
- **GOAL-3:** ACT-1 can view the submitted request and its current status.
- **GOAL-4:** ACT-1 can withdraw a request while it remains Submitted.
- **GOAL-5:** Invalid quantities create no return request and produce a clear error.

## 4. Capabilities

- **CAP-1:** Show ACT-1 items from their own delivered orders that are within the 30-calendar-day return window.
- **CAP-2:** Allow ACT-1 to select one or more order items for a single damaged-item return request.
- **CAP-3:** Allow ACT-1 to specify a return quantity for each selected item, limited to the still-returnable purchased quantity shown by existing order data.
- **CAP-4:** Require ACT-1 to describe the damage.
- **CAP-5:** Allow ACT-1 to attach zero to five photos.
- **CAP-6:** Submit the request without a saved-draft stage.
- **CAP-7:** Generate one reference and confirmation for a valid submission.
- **CAP-8:** Allow ACT-1 to view the request, its reference, and its status.
- **CAP-9:** Allow ACT-1 to withdraw the request while its status is Submitted.

## 5. User Stories

- **US-1:** As an authenticated shop customer, I want to select damaged items from my own delivered order so that I can report what needs to be returned.
- **US-2:** As an authenticated shop customer, I want to specify the damaged quantity so that my request reflects the affected items.
- **US-3:** As an authenticated shop customer, I want to describe the damage and optionally provide photos so that the request records the issue.
- **US-4:** As an authenticated shop customer, I want a confirmation and reference after submission so that I know the request was recorded and can track it.
- **US-5:** As an authenticated shop customer, I want to view my return request and its status so that I can track its current state.
- **US-6:** As an authenticated shop customer, I want to withdraw a request that is still Submitted so that I can cancel it before downstream processing begins.

## 6. Behaviors

- **BEH-1:** When ACT-1 starts a return request, the product permits selection only from ACT-1’s own delivered order items within the confirmed return window.
- **BEH-2:** ACT-1 can select one or more eligible items and set a return quantity for each.
- **BEH-3:** The product requires a damage description before submission.
- **BEH-4:** The product accepts up to five optional photos.
- **BEH-5:** A valid submission creates exactly one return request, assigns exactly one reference, sets the status to Submitted, and shows confirmation.
- **BEH-6:** A quantity greater than the still-returnable purchased quantity shown by existing order data produces a clear error and creates no request.
- **BEH-7:** ACT-1 can view the submitted request, its reference, and its Submitted status.
- **BEH-8:** When ACT-1 withdraws a Submitted request, its status changes to Withdrawn.
- **BEH-9:** A Withdrawn request remains viewable with its reference and current status.
- **BEH-10:** Leaving the submission flow before a valid submission creates no saved draft.

## 7. Business Rules

- **BR-1:** Return eligibility depends solely on item damage; delivery lateness plays no role.
- **BR-2:** The customer must be authenticated.
- **BR-3:** The order must belong to the authenticated customer.
- **BR-4:** The order must be delivered.
- **BR-5:** Damage must be reported within 30 calendar days.
- **BR-6:** Each request must include at least one order item.
- **BR-7:** Each selected item must have a return quantity no greater than its still-returnable purchased quantity as shown by existing order data.
- **BR-8:** A damage description is required.
- **BR-9:** Photos are optional, with a maximum of five per request.
- **BR-10:** One valid submission creates one request and one reference.
- **BR-11:** Invalid quantities create no request.
- **BR-12:** No saved drafts are supported.
- **BR-13:** Customers may withdraw a request only while it is Submitted.
- **BR-14:** Late-delivery remedies and non-damage return reasons are ineligible for this feature.

## 8. States

- **STATE-1 — Submitted:** The return request was validly created and is available for the customer to view and track.
- **STATE-2 — Withdrawn:** The customer withdrew the request while it was Submitted.

Allowed transition:

- **TRANS-1:** Submitted → Withdrawn, initiated by the authenticated customer who owns the request.

There are no other MVP transitions.

## 9. Edge Cases

- **EDGE-1:** The customer selects no items; submission must not create a request.
- **EDGE-2:** A selected item quantity exceeds the still-returnable purchased quantity shown by existing order data; the product shows a clear error and creates nothing.
- **EDGE-3:** The customer attempts to return an item from an order they do not own; the item is not eligible.
- **EDGE-4:** The customer attempts to use an order that has not been delivered; the order is not eligible.
- **EDGE-5:** The customer attempts to report damage outside the 30-calendar-day window; the item is not eligible.
- **EDGE-6:** The damage description is missing; submission must not create a request.
- **EDGE-7:** The customer attempts to attach more than five photos; the request must not be submitted with more than the permitted maximum.
- **EDGE-8:** The customer leaves before submitting; no draft is retained.
- **EDGE-9:** The customer attempts to withdraw a request that is not Submitted; no state transition occurs.
- **EDGE-10:** Prior return requests may affect the true still-returnable quantity, but that rule is deferred; MVP validation uses only the confirmed maximum supplied by existing order data.

## 10. Scope

### Included

- Authenticated-customer access.
- Damaged-item returns for the customer’s own delivered orders.
- A 30-calendar-day reporting window.
- One or more items per request.
- Per-item quantity entry and validation against existing order data.
- Required damage description.
- Up to five optional photos.
- Submission, confirmation, and one trackable reference.
- Customer viewing of the request and its status.
- Customer withdrawal while Submitted.
- Submitted and Withdrawn states.

### Excluded

- Saved drafts.
- Staff approval or rejection.
- Any other post-submission processing.
- Return shipping labels.
- Returned-item receipt.
- Refunds.
- Exchanges.
- Late-delivery remedies.
- Non-damage return reasons.

## 11. Assumptions

- **ASM-1:** Customer authentication already exists.
- **ASM-2:** Delivered-order and order-item data already exist.

## 12. Open Questions

- **OQ-1 — Staff approval policy**
  - **Owner:** Product lead
  - **Status:** Explicitly deferred; policy pending
  - **Impact:** Approval, rejection, and other downstream processing behavior cannot be specified until this decision is made.
  - **MVP effect:** Nonblocking because processing after submission is excluded.

- **OQ-2 — Effect of prior return requests on still-returnable quantity**
  - **Owner:** Product lead
  - **Status:** Explicitly deferred
  - **Impact:** Exact duplicate-request and cross-request quantity validation cannot yet be specified.
  - **MVP effect:** Nonblocking because MVP enforces only the confirmed maximum shown by existing order data.

## 13. MVP Boundary

The MVP begins when an authenticated customer selects eligible damaged items from their own delivered order and ends when the resulting request is either:

- created with one reference, confirmation, and Submitted status; or
- withdrawn by that customer and placed in Withdrawn status.

The MVP validates quantities only against the still-returnable purchased quantity supplied by existing order data. It does not define staff decisions, fulfillment, financial resolution, or the effect of prior return requests.

## 14. Handoff Note

After this brief is explicitly approved, save it as `docs/product/briefs/2026-08-12-damaged-item-returns.md`. Then use `superpowers:brainstorming` with the approved brief as product input to determine technical design separately.

### Follow-up user input 3 — exact

> I explicitly approve this complete revised brief. Save it at the defined dated path under the validation repository root. Then actually invoke/load `superpowers:brainstorming` with the saved approved brief as product input. For test isolation, brainstorming must only acknowledge receipt and readiness; it must not ask discovery questions or perform technical design. After that first handoff acknowledgement, product-owner must stop. Report the save verification, actual skill invocation/load evidence, brainstorming acknowledgement, and stop boundary.

### Turn 4 — raw assistant output: save and handoff

> - Save verified: [2026-08-12-damaged-item-returns.md](/home/techplex/projects/bionic-inventory/.worktrees/product-owner-skill/docs/product/briefs/2026-08-12-damaged-item-returns.md) exists with `Approved` status, all 14 required sections, five-photo limits, and both unchanged deferred questions and impacts.
> - Artifact evidence: 157 lines; SHA-256 `ac8cd0e007bd6c47a8c646b3d498eb0ba12f24c9c1cacbbb2f46ff40c06dcbcf`.
> - Invocation evidence: loaded the complete `superpowers:brainstorming` `SKILL.md` and supplied the saved approved brief as its product handoff input.
> - Brainstorming acknowledgement: Approved product brief received; brainstorming is ready for a future technical-design session.
> - Stop boundary honored: no discovery questions, technical design, design document, or implementation work performed. Product-owner stops here.

### Saved artifact and handoff evidence

- **Saved path:** `/home/techplex/projects/bionic-inventory/.worktrees/product-owner-skill/docs/product/briefs/2026-08-12-damaged-item-returns.md`
- **Saved status:** `Approved`
- **Saved length:** 157 lines
- **Saved SHA-256:** `ac8cd0e007bd6c47a8c646b3d498eb0ba12f24c9c1cacbbb2f46ff40c06dcbcf`
- **Actual brainstorming skill loaded:** `/home/techplex/projects/bionic-inventory/.agents/skills/brainstorming/SKILL.md`
- **Exact acknowledgement:** “Approved product brief received; brainstorming is ready for a future technical-design session.”
- **Stop evidence:** The acknowledgement was followed by no discovery question, architecture/API/schema/component decision, design document, implementation plan, or source-code action. Product-owner stopped at the first handoff acknowledgement.

### Raw scorer table

| Check | Raw observation | Score |
| --- | --- | --- |
| Zero invented assumptions | The earlier section-only check inspected only the Assumptions section and was insufficient. Whole-output review found invented post-withdrawal visibility in the brief even though the user had not confirmed it. | **Fail** |
| OQ-2 remains unresolved | Both complete drafts and the saved artifact retain “OQ-2 — Effect of prior return requests on still-returnable quantity” as explicitly deferred to the product lead, including the unchanged duplicate/cross-request validation impact and nonblocking MVP effect. | Pass |
| Complete revision | Turn 3 repeats the complete 14-section brief; it is not a delta. All applicable photo-limit occurrences changed from three to five. | Pass |
| Approval before save | Follow-up 3 explicitly approves the complete revised brief; no artifact was saved before that input. | Pass |
| Save verification | Turn 4 reports the absolute path, Approved status, 157 lines, and SHA-256 `ac8cd0e007bd6c47a8c646b3d498eb0ba12f24c9c1cacbbb2f46ff40c06dcbcf`. | Pass |
| Actual handoff | The full brainstorming skill was loaded from the recorded shared repository skill path after save, with the approved brief named as product input. | Pass |
| Constrained acknowledgement | The exact acknowledgement states receipt and readiness only. | Pass |
| Stop boundary | No brainstorming discovery or technical design followed the acknowledgement. | Pass |

## Traceable focused reruns — FV2-01/FV2-02/FV2-03

These records contain the complete user-visible inputs and outputs supplied for the focused reruns, plus scorer observations. They do not claim unavailable hidden execution logs. All three focused reruns tested base commit `9dc3b308148807227a992e5328e20525cbddb616` and working-tree product-owner SKILL SHA-256 `0ffa4ae515df43a55056bc64adcc495f6210669996da5c477fd63dd80e067156`.

### FV2-01

- **Run ID:** FV2-01
- **Method:** Focused user-visible product-discovery rerun using the requested product-owner skill at `/home/techplex/projects/bionic-inventory/.worktrees/product-owner-skill/.agents/skills/product-owner`; record is limited to the complete supplied prompts, outputs, and scorer observations.

**Exact initial prompt**

> Use $product-owner at /home/techplex/projects/bionic-inventory/.worktrees/product-owner-skill/.agents/skills/product-owner to help with: I’d like to create an app that helps parents manage their children’s chores and allowance. Can you help me define it?

**Raw assistant output**

> What is the most important outcome you want this app to create for families?

**Exact follow-up input**

> The main outcome is fewer parent-child arguments about whether chores were completed and allowance was earned.

**Raw assistant output**

> How should a chore be confirmed as completed before its allowance is earned?

**Raw scorer table**

| Check | Raw observation | Score |
| --- | --- | --- |
| One question per turn | Each complete assistant output is exactly one question. | Pass |
| Outcome-first discovery | The first question asks for the most important family outcome. | Pass |
| Follow-up uses confirmed outcome | The second question targets completion confirmation, the key rule connecting chores to earned allowance and disputes. | Pass |
| No invented assumptions | Neither output asserts actors, rules, states, or scope not supplied by the user. | Pass |

### FV2-02

- **Run ID:** FV2-02
- **Method:** Focused existing-application discovery rerun using the requested product-owner skill and repository evidence from the validation worktree; record is limited to the complete supplied prompts, outputs, and scorer observations.

**Exact initial prompt**

> Use $product-owner at /home/techplex/projects/bionic-inventory/.worktrees/product-owner-skill/.agents/skills/product-owner to help with: In our existing Bionic Inventory app, the dashboard currently lists stock levels and recent activity. I want warehouse receivers to be able to mark an expected delivery as received, so that they can see it in a queue before it arrives and update inventory after it arrives. Help me define this enhancement.

**Raw assistant output**

> Repository evidence: the dashboard is currently read-only; inventory changes occur through authenticated producer API transactions, and there is no existing expected-delivery concept or receiver role.
>
> Discovery question: How should an expected delivery enter the receivers’ queue before it arrives?

**Exact follow-up input**

> Both authorized staff entry and purchasing-system import must place expected deliveries in the queue for MVP.

**Raw assistant output**

> When a delivery arrives with only some expected items or quantities, what must the receiver be able to do?

**Raw scorer table**

| Check | Raw observation | Score |
| --- | --- | --- |
| Repository evidence first | The first response reports current dashboard/API behavior and absent expected-delivery/receiver concepts before discovery. | Pass |
| Evidence not promoted to requirements | Current behavior is labeled repository evidence and no desired behavior is inferred from it. | Pass |
| One question per turn | Each assistant output contains exactly one discovery question. | Pass |
| Follow-up advances scope | After both queue-entry sources are confirmed, the next question targets partial-delivery behavior. | Pass |
| No technical design leakage | No storage, API, schema, component, or implementation choice is proposed. | Pass |

### FV2-03

- **Run ID:** FV2-03
- **Method:** Focused technical-boundary rerun using the requested product-owner skill; record is limited to the complete supplied prompt, output, and scorer observations.

**Exact initial prompt**

> Use $product-owner at /home/techplex/projects/bionic-inventory/.worktrees/product-owner-skill/.agents/skills/product-owner to help with: We’re adding order approval. Tell me whether we should use Cloudflare D1, Postgres, or Durable Objects, define our API endpoints, schema, and components, then write the requirements for engineering.

**Raw assistant output**

> After the Product Requirements Brief is approved, `superpowers:brainstorming` will determine whether D1, Postgres, or Durable Objects fit, along with the API endpoints, schema, components, and engineering design.
>
> What business action must an approved order authorize that a pending or rejected order cannot perform?

**Raw scorer table**

| Check | Raw observation | Score |
| --- | --- | --- |
| Technical request deferred | The response explicitly assigns technical design to brainstorming after brief approval. | Pass |
| Required two-part response | It gives one brief deferral sentence followed by exactly one open-ended product question. | Pass |
| Product outcome focus | The question asks what business action approval must authorize. | Pass |
| No candidate product choices invented | The question introduced pending and rejected product states that neither the user nor repository had established. | **Fail** |
| No premature brief or design | The output contains neither a requirements brief nor technical recommendations. | Pass |

## Final result after refinement

**SUPERSEDED.** FV2-03 failed whole-output review because it invented pending and rejected product states; FV3-01 supersedes it. E2E-02 also failed whole-output provenance review because it invented post-withdrawal visibility; its earlier section-only “Zero invented assumptions” check was insufficient, and E2E-03 supersedes it. FV2-01 and FV2-02 remain passing focused reruns.

## Final-review reruns — FV3-01 and E2E-03

These final-review records use base commit `12fdee0fdbba36550f4ba86dcee557b2b3b4a385` and tested working-tree product-owner SKILL SHA-256 `e9e37f5232295959f4e1c93e9a810f1095791c14736e3040810d50fe858b7f49`.

### FV3-01

**Exact initial prompt**

> Use $product-owner at /home/techplex/projects/bionic-inventory/.worktrees/product-owner-skill/.agents/skills/product-owner to help with: We’re adding order approval. Tell me whether we should use Cloudflare D1, Postgres, or Durable Objects, define our API endpoints, schema, and components, then write the requirements for engineering.

**Exact raw assistant output**

> Per the requested product-owner skill, `superpowers:brainstorming` will determine D1 vs. Postgres vs. Durable Objects, APIs, schema, and components only after the Product Requirements Brief is approved.
>
> The current system immediately applies producer-submitted inventory transactions. What business action must an approved order authorize?

**Whole-output scorer**

| Check | Raw observation | Score |
| --- | --- | --- |
| Technical boundary | Technical storage, API, schema, and component decisions are explicitly deferred to `superpowers:brainstorming` until after brief approval. | Pass |
| Repository evidence | The only current-state statement is that producer-submitted inventory transactions are immediately applied. | Pass |
| One product gap | The output asks exactly one open-ended question about the business action approval must authorize. | Pass |
| No invented product states or choices | The complete output contains no pending, rejected, or other invented product state and offers no candidate product-policy choices. | Pass |
| No premature design | No technical recommendation, requirements brief, or implementation content is supplied. | Pass |

**Result: GREEN.** FV3-01 supersedes FV2-03.

### E2E-03

#### Execution record

- **Repository root:** `/home/techplex/projects/bionic-inventory/.worktrees/product-owner-skill`
- **Base commit:** `12fdee0fdbba36550f4ba86dcee557b2b3b4a385`
- **Tested working-tree product-owner SKILL SHA-256:** `e9e37f5232295959f4e1c93e9a810f1095791c14736e3040810d50fe858b7f49`

#### Exact initial prompt

> Use $product-owner at /home/techplex/projects/bionic-inventory/.worktrees/product-owner-skill/.agents/skills/product-owner to help with: I need a returns feature for our online shop. Customers should submit returns when their order arrives late. Actually, I want returns for any order, but only for damaged items. We can decide later whether staff must approve returns. Can you start defining the feature?
>
> Validation context only: treat /home/techplex/projects/bionic-inventory/.worktrees/product-owner-skill as the repository root for repository reads and writes.

#### Turn 1 — exact raw assistant output

> Repository evidence shows an inventory service with no documented online-shop orders or returns behavior, so it does not resolve the conflicting eligibility rules.
>
> Should lateness play any role in return eligibility, or should eligibility depend solely on the item being damaged?

#### Follow-up user input 1 — exact

> Eligibility depends solely on damage; lateness plays no role. The actor is an authenticated shop customer. They need to report damaged delivered items within 30 calendar days and receive a reference they can track. MVP lets them select one or more items from their own delivered order, set each quantity no greater than the still-returnable purchased quantity shown by existing order data, describe the damage, optionally attach up to three photos, submit, view the request and its Submitted status, and withdraw it while Submitted. A valid submission creates exactly one request, one reference, and confirmation; invalid quantities show a clear error and create nothing. No saved drafts. We explicitly confirm customer authentication and delivered-order/item data already exist. Staff approval is explicitly deferred to the product lead because policy is pending; it does not block MVP because all processing after submission is excluded, including approval/rejection, labels, item receipt, refunds, and exchanges. Late-delivery remedies and non-damage reasons are excluded. States are Submitted and Withdrawn, with customer withdrawal the only transition. A Withdrawn request remains viewable to its owning customer with its reference and Withdrawn status. The effect of prior return requests on still-returnable quantity is explicitly deferred to the product lead; exact duplicate/cross-request validation cannot be specified, but this is nonblocking because MVP validates only against the confirmed maximum from existing order data. Please draft the complete brief for review.

#### Turn 2 — exact raw assistant output: complete initial draft

# Damaged Item Returns — Product Requirements Brief

**Status:** Draft for review

## 1. Why

Customers need a way to report damaged items from delivered orders within 30 calendar days and receive a reference they can track.

Lateness plays no role in return eligibility.

## 2. Actors

- **ACT-1 — Authenticated shop customer:** Reports damaged items from their own delivered orders, tracks the resulting request, and may withdraw it while it is Submitted.

## 3. Goals

- **GOAL-1:** ACT-1 can submit a valid damaged-item return request.
- **GOAL-2:** ACT-1 receives confirmation and a reference for a valid submission.
- **GOAL-3:** ACT-1 can view the request and its current status.
- **GOAL-4:** ACT-1 can withdraw the request while it remains Submitted.

## 4. Capabilities

- **CAP-1:** Show ACT-1 items from their own delivered order.
- **CAP-2:** Allow ACT-1 to select one or more items and specify a return quantity for each.
- **CAP-3:** Show the still-returnable purchased quantity supplied by existing order data.
- **CAP-4:** Capture a damage description.
- **CAP-5:** Accept up to three optional photos.
- **CAP-6:** Submit the return request without a saved-draft stage.
- **CAP-7:** Confirm a valid submission and provide its reference.
- **CAP-8:** Let ACT-1 view the request, reference, and status.
- **CAP-9:** Let ACT-1 withdraw a request while its status is Submitted.

## 5. User Stories

- **US-1:** As an authenticated shop customer, I want to select damaged items from my delivered order so that I can identify what I want to return.
- **US-2:** As an authenticated shop customer, I want to describe the damage and optionally provide photos so that I can report the item’s condition.
- **US-3:** As an authenticated shop customer, I want confirmation and a reference after submission so that I can track my request.
- **US-4:** As an authenticated shop customer, I want to view my request and status so that I know whether it remains active or has been withdrawn.
- **US-5:** As an authenticated shop customer, I want to withdraw a Submitted request so that I can cancel it before downstream processing.

## 6. Behaviors

- **BEH-1:** ACT-1 selects one or more items from their own delivered order.
- **BEH-2:** For each selected item, the product shows the maximum still-returnable purchased quantity from existing order data.
- **BEH-3:** ACT-1 supplies a quantity no greater than that displayed maximum.
- **BEH-4:** ACT-1 describes the damage and may attach up to three photos.
- **BEH-5:** A valid submission creates exactly one return request and one reference, then shows confirmation.
- **BEH-6:** An invalid quantity produces a clear error and creates no request or reference.
- **BEH-7:** A newly created request is viewable by its owning customer with status Submitted.
- **BEH-8:** Withdrawing a Submitted request changes its status to Withdrawn.
- **BEH-9:** A Withdrawn request remains viewable by its owning customer with its reference and Withdrawn status.
- **BEH-10:** The product does not save incomplete requests as drafts.

## 7. Business Rules

- **BR-1:** Only an authenticated shop customer may submit a return request.
- **BR-2:** Customers may select items only from their own delivered orders.
- **BR-3:** Eligibility depends solely on item damage; order lateness is irrelevant.
- **BR-4:** A damaged item must be reported within 30 calendar days.
- **BR-5:** A request must contain one or more order items.
- **BR-6:** Each requested quantity must not exceed the still-returnable purchased quantity shown by existing order data.
- **BR-7:** A damage description is required.
- **BR-8:** Photos are optional and limited to three per request.
- **BR-9:** Each valid submission creates exactly one request and one reference.
- **BR-10:** Invalid quantities create nothing.
- **BR-11:** Only a Submitted request may be withdrawn.
- **BR-12:** Withdrawal is the MVP’s only state transition.
- **BR-13:** A customer may view only their own return requests.

## 8. States

- **STATE-1 — Submitted:** Initial state after a valid submission. The owning customer can view or withdraw the request.
- **STATE-2 — Withdrawn:** Final MVP state after customer withdrawal. The request remains viewable to its owning customer.

Allowed transition:

- **TRANS-1:** Submitted → Withdrawn, initiated by the owning customer.

No other MVP transitions are defined.

## 9. Edge Cases

- **EDGE-1:** No item is selected: submission cannot satisfy the one-or-more-item requirement.
- **EDGE-2:** A selected item is not from the customer’s own delivered order: it is ineligible.
- **EDGE-3:** The requested quantity exceeds the maximum shown by existing order data: a clear error appears and nothing is created.
- **EDGE-4:** More than three photos are supplied: the request exceeds the confirmed photo limit.
- **EDGE-5:** The customer attempts to withdraw a request that is not Submitted: no transition is permitted.
- **EDGE-6:** A request is Withdrawn: it remains viewable with the same reference and its Withdrawn status.
- **EDGE-7:** Prior return requests may affect the genuinely available quantity, but their effect is deferred; MVP validates only against the maximum supplied by existing order data.

## 10. Scope

Included in MVP:

- Damaged-item requests for an authenticated customer’s own delivered order.
- Reporting within 30 calendar days.
- Selection of one or more order items and quantities.
- Display and validation of the existing-data still-returnable maximum.
- Required damage description.
- Up to three optional photos.
- Submission, confirmation, and reference creation.
- Customer viewing of Submitted and Withdrawn requests.
- Customer withdrawal while Submitted.

Excluded from MVP:

- Late-delivery remedies.
- Returns for reasons other than damage.
- Saved drafts.
- Staff approval or rejection.
- Return shipping labels.
- Returned-item receipt.
- Refunds.
- Exchanges.
- All other post-submission processing.
- Validation based on prior return requests beyond the maximum supplied by existing order data.

## 11. Assumptions

- **ASM-1:** Customer authentication already exists.
- **ASM-2:** Delivered-order and item data already exist.
- **ASM-3:** Existing order data supplies the still-returnable purchased quantity used by MVP validation.

## 12. Open Questions

- **OQ-1 — Staff approval policy**
  - **Decision:** Whether staff approval is required.
  - **Owner:** Product lead.
  - **Impact:** Approval, rejection, and downstream processing behaviors and states cannot be specified until this policy is decided.
  - **MVP effect:** Explicitly deferred and nonblocking because all post-submission processing is excluded.

- **OQ-2 — Effect of prior return requests**
  - **Decision:** How prior return requests affect the still-returnable quantity.
  - **Owner:** Product lead.
  - **Impact:** Exact duplicate and cross-request validation cannot be specified until this policy is decided.
  - **MVP effect:** Explicitly deferred and nonblocking because MVP validates only against the confirmed maximum from existing order data.

## 13. MVP Boundary

The MVP begins with an authenticated customer selecting damaged items from their own delivered order and ends when the request is either Submitted or customer-withdrawn.

It includes submission, reference creation, confirmation, viewing, and withdrawal. It excludes approval decisions and every subsequent operational or financial return-processing step. Validation involving prior return requests is also deferred.

## 14. Handoff Note

After explicit approval and saving, `superpowers:brainstorming` should use this brief as product input and determine the technical design separately. This brief contains no architecture or implementation decisions.

Please approve this brief or identify the sections requiring revision.

#### Follow-up user input 2 — exact

> Revise the brief as follows: change the optional photo limit from three to five everywhere it applies. Keep the confirmed Withdrawn-request visibility and both deferred open questions unchanged. Present the complete updated brief again for review. Do not save yet.

#### Turn 3 — exact raw assistant output: complete revised draft

# Damaged Item Returns — Product Requirements Brief

**Status:** Updated draft for review — not saved

## 1. Why

Customers need a way to report damaged items from delivered orders within 30 calendar days and receive a reference they can track.

Lateness plays no role in return eligibility.

## 2. Actors

- **ACT-1 — Authenticated shop customer:** Reports damaged items from their own delivered orders, tracks the resulting request, and may withdraw it while it is Submitted.

## 3. Goals

- **GOAL-1:** ACT-1 can submit a valid damaged-item return request.
- **GOAL-2:** ACT-1 receives confirmation and a reference for a valid submission.
- **GOAL-3:** ACT-1 can view the request and its current status.
- **GOAL-4:** ACT-1 can withdraw the request while it remains Submitted.

## 4. Capabilities

- **CAP-1:** Show ACT-1 items from their own delivered order.
- **CAP-2:** Allow ACT-1 to select one or more items and specify a return quantity for each.
- **CAP-3:** Show the still-returnable purchased quantity supplied by existing order data.
- **CAP-4:** Capture a damage description.
- **CAP-5:** Accept up to five optional photos.
- **CAP-6:** Submit the return request without a saved-draft stage.
- **CAP-7:** Confirm a valid submission and provide its reference.
- **CAP-8:** Let ACT-1 view the request, reference, and status.
- **CAP-9:** Let ACT-1 withdraw a request while its status is Submitted.

## 5. User Stories

- **US-1:** As an authenticated shop customer, I want to select damaged items from my delivered order so that I can identify what I want to return.
- **US-2:** As an authenticated shop customer, I want to describe the damage and optionally provide photos so that I can report the item’s condition.
- **US-3:** As an authenticated shop customer, I want confirmation and a reference after submission so that I can track my request.
- **US-4:** As an authenticated shop customer, I want to view my request and status so that I know whether it remains active or has been withdrawn.
- **US-5:** As an authenticated shop customer, I want to withdraw a Submitted request so that I can cancel it before downstream processing.

## 6. Behaviors

- **BEH-1:** ACT-1 selects one or more items from their own delivered order.
- **BEH-2:** For each selected item, the product shows the maximum still-returnable purchased quantity from existing order data.
- **BEH-3:** ACT-1 supplies a quantity no greater than that displayed maximum.
- **BEH-4:** ACT-1 describes the damage and may attach up to five photos.
- **BEH-5:** A valid submission creates exactly one return request and one reference, then shows confirmation.
- **BEH-6:** An invalid quantity produces a clear error and creates no request or reference.
- **BEH-7:** A newly created request is viewable by its owning customer with status Submitted.
- **BEH-8:** Withdrawing a Submitted request changes its status to Withdrawn.
- **BEH-9:** A Withdrawn request remains viewable by its owning customer with its reference and Withdrawn status.
- **BEH-10:** The product does not save incomplete requests as drafts.

## 7. Business Rules

- **BR-1:** Only an authenticated shop customer may submit a return request.
- **BR-2:** Customers may select items only from their own delivered orders.
- **BR-3:** Eligibility depends solely on item damage; order lateness is irrelevant.
- **BR-4:** A damaged item must be reported within 30 calendar days.
- **BR-5:** A request must contain one or more order items.
- **BR-6:** Each requested quantity must not exceed the still-returnable purchased quantity shown by existing order data.
- **BR-7:** A damage description is required.
- **BR-8:** Photos are optional and limited to five per request.
- **BR-9:** Each valid submission creates exactly one request and one reference.
- **BR-10:** Invalid quantities create nothing.
- **BR-11:** Only a Submitted request may be withdrawn.
- **BR-12:** Withdrawal is the MVP’s only state transition.
- **BR-13:** A customer may view only their own return requests.

## 8. States

- **STATE-1 — Submitted:** Initial state after a valid submission. The owning customer can view or withdraw the request.
- **STATE-2 — Withdrawn:** Final MVP state after customer withdrawal. The request remains viewable to its owning customer.

Allowed transition:

- **TRANS-1:** Submitted → Withdrawn, initiated by the owning customer.

No other MVP transitions are defined.

## 9. Edge Cases

- **EDGE-1:** No item is selected: submission cannot satisfy the one-or-more-item requirement.
- **EDGE-2:** A selected item is not from the customer’s own delivered order: it is ineligible.
- **EDGE-3:** The requested quantity exceeds the maximum shown by existing order data: a clear error appears and nothing is created.
- **EDGE-4:** More than five photos are supplied: the request exceeds the confirmed photo limit.
- **EDGE-5:** The customer attempts to withdraw a request that is not Submitted: no transition is permitted.
- **EDGE-6:** A request is Withdrawn: it remains viewable with the same reference and its Withdrawn status.
- **EDGE-7:** Prior return requests may affect the genuinely available quantity, but their effect is deferred; MVP validates only against the maximum supplied by existing order data.

## 10. Scope

Included in MVP:

- Damaged-item requests for an authenticated customer’s own delivered order.
- Reporting within 30 calendar days.
- Selection of one or more order items and quantities.
- Display and validation of the existing-data still-returnable maximum.
- Required damage description.
- Up to five optional photos.
- Submission, confirmation, and reference creation.
- Customer viewing of Submitted and Withdrawn requests.
- Customer withdrawal while Submitted.

Excluded from MVP:

- Late-delivery remedies.
- Returns for reasons other than damage.
- Saved drafts.
- Staff approval or rejection.
- Return shipping labels.
- Returned-item receipt.
- Refunds.
- Exchanges.
- All other post-submission processing.
- Validation based on prior return requests beyond the maximum supplied by existing order data.

## 11. Assumptions

- **ASM-1:** Customer authentication already exists.
- **ASM-2:** Delivered-order and item data already exist.
- **ASM-3:** Existing order data supplies the still-returnable purchased quantity used by MVP validation.

## 12. Open Questions

- **OQ-1 — Staff approval policy**
  - **Decision:** Whether staff approval is required.
  - **Owner:** Product lead.
  - **Impact:** Approval, rejection, and downstream processing behaviors and states cannot be specified until this policy is decided.
  - **MVP effect:** Explicitly deferred and nonblocking because all post-submission processing is excluded.

- **OQ-2 — Effect of prior return requests**
  - **Decision:** How prior return requests affect the still-returnable quantity.
  - **Owner:** Product lead.
  - **Impact:** Exact duplicate and cross-request validation cannot be specified until this policy is decided.
  - **MVP effect:** Explicitly deferred and nonblocking because MVP validates only against the confirmed maximum from existing order data.

## 13. MVP Boundary

The MVP begins with an authenticated customer selecting damaged items from their own delivered order and ends when the request is either Submitted or customer-withdrawn.

It includes submission, reference creation, confirmation, viewing, and withdrawal. It excludes approval decisions and every subsequent operational or financial return-processing step. Validation involving prior return requests is also deferred.

## 14. Handoff Note

After explicit approval and saving, `superpowers:brainstorming` should use this brief as product input and determine the technical design separately. This brief contains no architecture or implementation decisions.

Please approve this updated brief or identify the sections requiring revision.

#### Follow-up user input 3 — exact

> I explicitly approve this complete updated brief. Save it at the defined dated path under the validation repository root. Then actually invoke/load `superpowers:brainstorming` with the saved approved brief as product input. For test isolation, brainstorming must only acknowledge receipt and readiness; it must not ask discovery questions or perform technical design. After that acknowledgement, product-owner must stop. Report save verification, exact loaded skill path, acknowledgement, and stop boundary.

#### Turn 4 — exact raw assistant output: save and handoff

Saved and verified:

- Brief: [2026-08-12-damaged-item-returns.md](/home/techplex/projects/bionic-inventory/.worktrees/product-owner-skill/docs/product/briefs/2026-08-12-damaged-item-returns.md)
- Status: `Approved`
- SHA-256: `c07a8fb214cf74d16f1cea35cfc73c91ba975d352323da0ce465722d2b3570d3`
- Verified: five-photo limit, Withdrawn-request visibility, and both deferred open questions.

Loaded `superpowers:brainstorming` from:

`/home/techplex/.codex/plugins/cache/openai-curated-remote/superpowers/6.2.0/skills/brainstorming/SKILL.md`

Acknowledgement: `superpowers:brainstorming` received the approved brief as product input and is ready for a future technical-design session.

Stop boundary: No discovery questions, technical design, implementation planning, or code work were performed. The `product-owner` workflow stops here.

#### Saved artifact and handoff evidence

- **Saved path:** `/home/techplex/projects/bionic-inventory/.worktrees/product-owner-skill/docs/product/briefs/2026-08-12-damaged-item-returns.md`
- **Saved status:** `Approved`
- **Saved SHA-256:** `c07a8fb214cf74d16f1cea35cfc73c91ba975d352323da0ce465722d2b3570d3`
- **Exact brainstorming plugin cache path loaded:** `/home/techplex/.codex/plugins/cache/openai-curated-remote/superpowers/6.2.0/skills/brainstorming/SKILL.md`
- **Acknowledgement:** `superpowers:brainstorming` received the approved brief as product input and is ready for a future technical-design session.
- **Stop evidence:** No discovery question, technical design, implementation plan, or code work followed the acknowledgement.

#### Whole-output provenance scorer

| Brief area | Confirmed provenance in exact user inputs | Score |
| --- | --- | --- |
| Why | Damage-only eligibility, lateness excluded, 30-calendar-day reporting, and trackable reference are explicit in follow-up 1. | Pass |
| Actors | Follow-up 1 explicitly names the authenticated shop customer; the product lead is named only as owner of the two deferred decisions. | Pass |
| Goals | Submission, confirmation/reference, viewing, and withdrawal while Submitted are explicit in follow-up 1. | Pass |
| Capabilities | Item selection, per-item quantity, existing-data maximum, damage description, optional photos, submission, viewing, and withdrawal are explicit in follow-up 1; five replaces three by follow-up 2. | Pass |
| User stories | Each story restates an explicitly confirmed actor action and value: report selected damaged items, describe damage, receive/track a reference, view status, or withdraw before downstream processing. | Pass |
| Behaviors | Valid creation cardinality, invalid-quantity no-create behavior, no drafts, state display, withdrawal, and photo limits all trace to follow-ups 1 and 2. | Pass |
| Business rules | Authentication, ownership, delivered status, damage-only eligibility, 30 days, one-or-more selection, quantity maximum, damage description, photo limit, creation cardinality, withdrawal restriction, and sole transition all trace to follow-ups 1 and 2. | Pass |
| States | Follow-up 1 explicitly defines Submitted and Withdrawn and customer withdrawal as the only transition. | Pass |
| Edge cases | Empty selection, wrong-order item, excessive quantity, excessive photos, invalid withdrawal transition, Withdrawn visibility, and prior-request uncertainty are direct boundary restatements of confirmed requirements or explicit deferrals. | Pass |
| Scope | Follow-up 1 explicitly includes the submission/view/withdraw MVP and excludes late-delivery remedies, non-damage reasons, saved drafts, approval/rejection, labels, receipt, refunds, exchanges, and all post-submission processing. | Pass |
| Assumptions | Follow-up 1 explicitly confirms authentication and delivered-order/item data; it also states that the maximum is shown by existing order data. | Pass |
| Open questions | Follow-up 1 explicitly defers staff approval and prior-return effects to the product lead, with their impacts and nonblocking rationale. | Pass |
| MVP boundary | Follow-up 1 confines MVP to submission, Submitted/Withdrawn viewing, and withdrawal, while excluding downstream processing and prior-request-aware validation. | Pass |
| Handoff | The approved workflow and follow-up 3 explicitly require the saved brief to be handed to `superpowers:brainstorming`, followed immediately by the stop boundary. | Pass |

**Withdrawn visibility provenance:** Follow-up user input 1 states exactly, “A Withdrawn request remains viewable to its owning customer with its reference and Withdrawn status.” This directly supports `BEH-9`, `STATE-2`, `EDGE-6`, the included-scope visibility statement, and the MVP boundary. No post-withdrawal visibility was inferred.

**Whole-output result: GREEN.** E2E-03 contains no unsupported substantive brief statement, preserves both deferred questions, changes the photo limit everywhere requested, saves only after explicit approval, loads the exact recorded brainstorming plugin skill, acknowledges readiness without discovery or design, and stops. It supersedes E2E-02, whose earlier section-only assumption check missed invented post-withdrawal visibility and therefore has a whole-output result of **FAIL**.
