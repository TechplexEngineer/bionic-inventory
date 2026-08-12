# Product Owner Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create and validate a repository-local product-owner skill that interviews users one question at a time and produces an approved, implementation-neutral Product Requirements Brief for `superpowers:brainstorming`.

**Architecture:** Keep the skill self-contained in `SKILL.md`, with discovery metadata in `agents/openai.yaml`. Develop it test-first by recording how a fresh agent handles representative requests without the skill, then author the minimum workflow and output contract needed to correct observed failures and forward-test the finished skill.

**Tech Stack:** Agent Skills Markdown, YAML metadata, Codex skill-creator validation scripts, Superpowers skill-testing workflow, Git.

## Global Constraints

- Install the skill at `.agents/skills/product-owner/`.
- Save approved briefs to `docs/product/briefs/YYYY-MM-DD-<topic>.md`.
- Ask exactly one clarifying question at a time.
- Minimize restatement during interviews.
- Never invent product decisions or convert repository evidence into desired behavior without user confirmation.
- Cover Why, Actors, Goals, Capabilities, User stories, Behaviors, Business rules, States, Edge cases, Scope, Assumptions, Open questions, and MVP boundary.
- Do not determine application architecture, framework, database schema, API design, class/component structure, implementation plans, or source code.
- Obtain user approval before saving a brief.
- Hand the approved brief to `superpowers:brainstorming` and stop.
- Preserve all unrelated working-tree changes.

---

### Task 1: Establish baseline behavior without the skill

**Files:**
- Create: `docs/superpowers/skill-tests/product-owner-baseline.md`

**Interfaces:**
- Consumes: the approved design and four representative user scenarios.
- Produces: raw baseline prompts, observed outputs, and a failure matrix that the skill must address.

- [ ] **Step 1: Define four baseline scenarios**

Cover a vague new-product idea; an existing-application enhancement where current and desired behavior differ; pressure to select technical design; and an interview containing ambiguity, contradiction, and an explicitly deferred decision. Prompts must not reveal the planned skill rules.

- [ ] **Step 2: Run baseline scenarios without the skill**

Use fresh agent contexts where available. Do not provide the design, intended solution, suspected failures, or future `SKILL.md`. Capture each raw response.

- [ ] **Step 3: Record observed failures**

Create the baseline document with each prompt, relevant raw output, and a matrix scoring question count, unnecessary restatement, invented assumptions, missing brief areas, technical leakage, and premature drafting or handoff.

- [ ] **Step 4: Verify RED**

Confirm at least one baseline behavior violates the approved contract. If none does, revise the scenario instead of authoring unnecessary guidance.

- [ ] **Step 5: Commit baseline evidence**

```bash
git add docs/superpowers/skill-tests/product-owner-baseline.md
git commit -m "test: capture product owner skill baseline"
```

---

### Task 2: Initialize and author the minimal skill

**Files:**
- Create: `.agents/skills/product-owner/SKILL.md`
- Create: `.agents/skills/product-owner/agents/openai.yaml`

**Interfaces:**
- Consumes: Task 1 failures and the approved design.
- Produces: a discoverable skill with an interview workflow, completeness ledger, brief contract, and Superpowers handoff.

- [ ] **Step 1: Initialize the skill**

```bash
python /home/techplex/.codex/skills/.system/skill-creator/scripts/init_skill.py product-owner \
  --path .agents/skills \
  --interface 'display_name=Product Owner' \
  --interface 'short_description=Turn product requests into approved requirements briefs' \
  --interface 'default_prompt=Use $product-owner to interview me and produce an approved Product Requirements Brief.'
```

Do not create scripts, references, assets, or examples.

- [ ] **Step 2: Replace the placeholder with the minimal workflow**

Write triggering conditions, the product/technical boundary, repository inspection, the adaptive interview loop, the four-state ledger, the brief contract and identifiers, approval/save/handoff rules, and concise safeguards for failures observed in Task 1.

- [ ] **Step 3: Check discovery metadata**

Confirm `agents/openai.yaml` contains the specified display name, short description, and default prompt with no unrequested branding fields.

- [ ] **Step 4: Run structural validation**

```bash
python /home/techplex/.codex/skills/.system/skill-creator/scripts/quick_validate.py .agents/skills/product-owner
```

Expected: the skill is valid.

- [ ] **Step 5: Run static checks**

```bash
rg -n 'TBD|TODO|implement later' .agents/skills/product-owner
wc -w .agents/skills/product-owner/SKILL.md
git diff --check -- .agents/skills/product-owner
```

Expected: no placeholders, a concise document, and no whitespace errors.

- [ ] **Step 6: Commit the skill**

```bash
git add .agents/skills/product-owner
git commit -m "feat: add product owner skill"
```

---

### Task 3: Forward-test and refine the skill

**Files:**
- Modify: `.agents/skills/product-owner/SKILL.md`
- Modify if stale: `.agents/skills/product-owner/agents/openai.yaml`
- Create: `docs/superpowers/skill-tests/product-owner-validation.md`

**Interfaces:**
- Consumes: the authored skill and the four scenario categories.
- Produces: fresh-context evidence plus minimal corrections for observed gaps.

- [ ] **Step 1: Run scenarios with the skill**

Use fresh contexts and prompts shaped as:

```text
Use $product-owner at .agents/skills/product-owner to help with: <scenario>
```

Pass only the task and skill location. Do not leak expected answers or the failure matrix.

- [ ] **Step 2: Score outputs**

Verify one question per response, minimal restatement, correct separation of current facts and desired behavior, no unconfirmed assumptions, complete ledger coverage, deferral of technical decisions, review before save, the defined save path, and handoff to `superpowers:brainstorming`.

- [ ] **Step 3: Record GREEN evidence**

Create the validation document with prompts, relevant raw outputs, scorecards, and failures found.

- [ ] **Step 4: Refactor only for observed failures**

Update `SKILL.md` with the smallest positive instruction or observable conditional that corrects each failure. Regenerate metadata only if stale.

- [ ] **Step 5: Re-run failed scenarios**

Repeat each failure in a fresh context until its scorecard passes. Append the new raw output and result to the validation document.

- [ ] **Step 6: Re-run validation**

```bash
python /home/techplex/.codex/skills/.system/skill-creator/scripts/quick_validate.py .agents/skills/product-owner
git diff --check -- .agents/skills/product-owner docs/superpowers/skill-tests
```

Expected: validation passes and no whitespace errors appear.

- [ ] **Step 7: Commit validation and refinements**

```bash
git add .agents/skills/product-owner docs/superpowers/skill-tests/product-owner-validation.md
git commit -m "test: validate product owner workflow"
```

---

### Task 4: Final verification and handoff

**Files:**
- Verify: `.agents/skills/product-owner/SKILL.md`
- Verify: `.agents/skills/product-owner/agents/openai.yaml`
- Verify: `docs/superpowers/skill-tests/product-owner-baseline.md`
- Verify: `docs/superpowers/skill-tests/product-owner-validation.md`

**Interfaces:**
- Consumes: all authored and validation artifacts.
- Produces: a verified repository-local skill ready for use.

- [ ] **Step 1: Verify required content**

Search for every required product area, every prohibited technical area, the one-question rule, approval, save path, and `superpowers:brainstorming` handoff in `SKILL.md`.

- [ ] **Step 2: Verify repository scope**

```bash
git status --short
git log --oneline -4
git diff --check HEAD~3..HEAD
```

Confirm only planned skill and test artifacts belong to this work. Preserve pre-existing unrelated changes.

- [ ] **Step 3: Report the handoff**

Link the skill and validation artifacts, summarize proven behavior and accepted limitations, and provide a sample `$product-owner` invocation.

