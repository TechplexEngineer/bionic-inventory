# Product Owner Skill Design

## Goal

Create a repository-local `product-owner` skill that turns a rough product idea, existing feature request, product change request, or enhancement request into an approved, implementation-neutral Product Requirements Brief. The brief becomes the product input to `superpowers:brainstorming`.

## Location and Deliverable

The skill lives at `.agents/skills/product-owner/`. Approved briefs are saved to `docs/product/briefs/YYYY-MM-DD-<topic>.md`.

The skill contains:

- `.agents/skills/product-owner/SKILL.md` for triggering, interviewing, completeness checks, the brief contract, boundaries, and handoff;
- `.agents/skills/product-owner/agents/openai.yaml` for discovery metadata.

No script, reference, or separate template is included unless validation demonstrates that the inline brief contract is insufficient.

## Inputs and Output

Supported inputs are:

- a rough product idea;
- an existing feature request;
- a product change request;
- an enhancement request.

The only product artifact produced is an approved Product Requirements Brief.

## Workflow

1. Accept the initial request.
2. When the request concerns an existing application, inspect available repository documentation and current behavior before interviewing.
3. Track confirmed and unresolved product information in an internal completeness ledger.
4. Ask one concise clarifying question at a time, choosing the unresolved question with the greatest effect on scope, user value, or downstream requirements.
5. Follow ambiguous, incomplete, or conflicting answers with another single question. Do not infer the missing decision.
6. Do not routinely restate answers. Restate only when necessary to resolve ambiguity, expose a contradiction, or confirm a consequential interpretation.
7. Draft the brief once every required area is confirmed, confirmed not applicable, or explicitly deferred without preventing a coherent MVP boundary.
8. Present the full brief for user review.
9. Reopen and revise affected areas when the user requests changes, then present the complete updated brief again.
10. Save only the user-approved brief.
11. Invoke `superpowers:brainstorming` with the approved brief as product input, then stop.

## Completeness Ledger

Every required area has exactly one status:

- **Confirmed:** The user explicitly established the answer.
- **Confirmed not applicable:** The user explicitly agreed that the area does not apply.
- **Unresolved:** The answer is missing, ambiguous, or explicitly deferred.
- **Contradictory:** Available answers conflict and require clarification.

The skill cannot present a final brief while an essential area is contradictory. An unresolved item may remain in the brief only when the user explicitly defers it and it does not prevent defining a coherent MVP. Repository evidence can establish current behavior, terminology, and constraints, but desired product behavior always requires user confirmation. Any inference about desired behavior must become a question.

## Product Requirements Brief Contract

The brief contains:

1. **Title and status**
2. **Why:** The problem or opportunity and intended outcome
3. **Actors:** Affected personas or system actors and their relevant needs
4. **Goals:** Observable or measurable outcomes for each actor
5. **Capabilities:** What the product must enable without specifying implementation
6. **User stories:** Actor, intent, and value
7. **Behaviors:** Observable responses to user actions and relevant events
8. **Business rules:** Policies, permissions, limits, and invariants
9. **States:** Meaningful product states and allowed transitions
10. **Edge cases:** Exceptional inputs, interrupted flows, conflicts, and boundary conditions
11. **Scope:** Explicitly included and excluded work
12. **Assumptions:** Only assumptions explicitly confirmed by the user
13. **Open questions:** Explicitly deferred decisions, their impact, and owner when known
14. **MVP boundary:** The minimum coherent outcome and explicitly deferred capabilities
15. **Handoff note:** Direction for `superpowers:brainstorming` to treat the brief as product input and determine technical design separately

Requirements use stable identifiers such as `ACT-1`, `CAP-1`, `US-1`, `BEH-1`, and `BR-1` so downstream specifications can trace decisions to the brief. User stories are supported by observable behaviors rather than implementation-oriented acceptance criteria.

## Product and Technical Boundaries

The skill must determine:

- why;
- actors;
- goals;
- capabilities;
- user stories;
- behaviors;
- business rules;
- states;
- edge cases;
- scope;
- assumptions;
- open questions;
- MVP boundary.

The skill must not determine:

- application architecture;
- framework;
- database schema;
- API design;
- class or component structure;
- implementation plan;
- source code.

If the user requests a prohibited technical decision during discovery, the skill records the underlying product need when relevant and defers the technical decision to `superpowers:brainstorming`.

## Interview Behavior

Questions are singular, concise, and purposeful. Multiple-choice answers may be offered only when the choice set is grounded in known context; the skill does not narrow the user's answer to invented alternatives. Brief acknowledgements are allowed, but routine summaries are not.

The interview continues until the ledger is complete under the stated decision rules. The full brief, rather than incremental restatement, is the consolidated record of the conversation.

## Validation

Skill development follows test-driven skill authoring with baseline and post-authoring scenarios:

1. A vague new-product idea missing actors, rules, states, and an MVP boundary.
2. An enhancement to an existing application where repository facts differ from requested future behavior.
3. A request that asks the product-owner skill to choose architecture or implementation details.
4. An interview containing an ambiguous answer, a contradiction, and an explicitly deferred decision.

The skill succeeds when it:

- asks exactly one concise question at a time;
- minimizes restatement;
- distinguishes repository evidence from desired behavior;
- makes no unconfirmed product assumptions;
- covers every required brief area;
- exposes contradictions and consequential ambiguity;
- preserves only explicitly deferred open questions;
- stays outside technical design and implementation;
- obtains approval before saving;
- saves the approved brief at the defined location;
- hands the brief to `superpowers:brainstorming` and stops.

