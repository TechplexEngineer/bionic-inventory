# Product Owner Skill Validation

**Date:** 2026-08-12

**Mode:** Fresh agent contexts with the repository-local skill available. Each initial invocation received only its scenario and the absolute location of `.agents/skills/product-owner`; agents did not receive the design, baseline responses, expected answers, scorecard, or failure matrix. Follow-up messages supplied only user answers and review instructions needed to exercise the multi-turn workflow.

**Scoring reference:** [Product Owner Skill Design](../specs/2026-08-12-product-owner-skill-design.md), consulted by the scorer after responses were collected.

## Scoring method

Each response was checked for exactly one purposeful question during discovery, minimal restatement, separation of repository facts from desired behavior, no unconfirmed assumptions, progression across all completeness-ledger areas, explicit deferral of technical design, review before save, the defined dated save path, and an intended handoff to `superpowers:brainstorming` followed by a stop. A ledger-coverage result is `Discovery` when the agent correctly continued interviewing rather than claiming the brief was complete.

## Initial scorecard

| Run | One question | Minimal restatement | Current vs desired | No assumptions | Ledger coverage | Technical boundary | Review/save/handoff | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FV-01 vague product | Pass | Pass | N/A | Pass | Discovery | Pass | N/A | Pass |
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

Every discovery turn asked exactly one concise, consequential question and introduced no claimed product facts. The response stayed in discovery rather than drafting from a vague idea.

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

**GREEN.** All four scenario categories pass after observed-failure refinements. The tests demonstrate one-information-gap questioning, restrained restatement, current-versus-desired separation, no unconfirmed assumptions or product taxonomies, complete brief coverage, explicit technical deferral, contradiction resolution, coherent deferral, review and revision before approval, save only after approval at the defined dated path, and the intended `superpowers:brainstorming` handoff with a stop boundary. Metadata remained aligned with the skill trigger and did not require regeneration.
