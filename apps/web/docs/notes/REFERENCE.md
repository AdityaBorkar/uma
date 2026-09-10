# Reference — Planner Q3 Domain Reference

A working reference for building **Planner Q3**, a project management tool that encodes project-management theory into its data model, workflows, and analytics.

This document is the *facts* layer: definitions, terminology, and formulas the code may implement. It complements:

- [`PRINCIPLES.md`](./PRINCIPLES.md) — the *philosophy* (mental model, guiding principles).
- [`../CONTEXT.md`](../CONTEXT.md) — the canonical glossary (prefer its terms).

**How to use it:** Formulas here are the shared math for current and future engines. Domain IDs are historical (SOW) and now just labels: **A** Project Management, **B** Theory of Constraints, **D** Kanban/Flow, **E** Software Engineering, **3** Estimation & Uncertainty, **5** Systems Thinking. Engines marked **Implemented** exist in `src/lib/*`; those marked **🔮 Future** are theory only — not yet in code.

---

## 1. Domains at a Glance

| ID | Domain | One-line purpose in this tool | Status |
|---|---|---|---|
| A | Project Management | Structure work, find the critical path, schedule people & time, manage risk/change/stakeholders | 🔮 Future (WBS/CPM not yet in code) |
| B | Theory of Constraints | Identify the binding constraint and manage it deliberately, not the whole system equally | 🔮 Future |
| D | Kanban / Flow | Optimize work *flow* via WIP limits, queueing math, and flow metrics | 🔮 Future |
| E | Software Engineering | Manage completion through architecture, modularity, and technical debt | 🔮 Future |
| 3 | Estimation & Uncertainty | Quantify uncertainty probabilistically and plan under it | 🔮 Future |
| 5 | Systems Thinking | Reason about feedback loops, delays, and second-order effects | 🔮 Future |

> **Implemented now:** Projects (`src/schemas/db/projects.ts`), Documents single primitive (`src/schemas/db/documents.ts`, `src/components/mdx.server.ts`, ADR 004), Signals/Tasks lifecycle (`src/schemas/db/tasks.ts`), Connections, Auth. Navigation is project-scoped — `/:projectSlug/*` or `/~` (ADR 006, plan 005). Everything else in this file is theory awaiting implementation — the `Tool encoding:` blocks and any `src/lib/*` names they mention (e.g. `cpm.ts`, `montecarlo.ts`) are aspirational targets for future engines, **not existing files**; do not assume tables/engines exist.

---

## A. Project Management

**Overarching idea:** A project is a finite, goal-directed effort. Failure usually traces to a vague finish line, uncontrolled scope, hidden dependencies, or ignored constraints — not to execution skill.

### A.1 Work Breakdown Structure (WBS)

- **Definition:** A deliverable-oriented hierarchical decomposition of the total scope of work into smaller components.
- **Properties of a good WBS:**
  - **100% Rule:** the sum of child items *exactly* equals the parent scope (no more, no less).
  - Every level is unambiguous and, at the leaf level, independently schedulable and measurable.
  - Owned, verifiable items; every node has a definition of "done."
- **WBS nodes are not tasks** — they are deliverables. Several tasks may be required to complete a deliverable.
- **WBS Dictionary:** the written record per node — scope, acceptance criteria, assumptions, constraints, owner.

> Tool encoding: `wbs_nodes` hierarchy (`kind: phase | deliverable | task | spike`), acceptance criteria per node, tree drag-drop. Enforces `Outcome → Scope → Completion`.

### A.2 Critical Path Method (CPM)

A deterministic scheduling algorithm that identifies the **longest dependency chain** in a network of activities — the sequence that sets the earliest project completion.

- **Dependencies (linked on *finish-to-start* by default):**
  - **FS** Finish-to-Start — successor starts after predecessor finishes.
  - **SS** Start-to-Start — successor starts after predecessor starts.
  - **FF** Finish-to-Finish — successor finishes after predecessor finishes.
  - **SF** Start-to-Finish — successor finishes after predecessor starts.
  - Each may carry **lag** (delay offset, positive or negative = lead).
- **Forward pass** computes **ES/EF** (earliest start/finish):
  - `EF = ES + duration`; `ES = max(EF of all predecessors) + lag[FS]`.
- **Backward pass** computes **LS/LF** (latest start/finish):
  - `LS = LF − duration`; `LF = min(LS of all successors) − lag[FS]`.
- **Total Float (slack):** `TF = LS − ES = LF − EF` — how much a task can slip without delaying project end.
- **Free Float:** how much a task can slip without delaying the next task's start: `FF = min(ES of successors) − EF`.
- **Critical path** = the path of activities with **zero total float** (longest chain). It determines project end date.
- Requires a **DAG** — cycles must be rejected at write time (DFS cycle detection + DB constraint).

> Tool encoding: `src/lib/cpm.ts` (forward/backward pass, float calc, critical-path highlight), timeline view. Acceptance lens: `Principles #3 (Control Dependencies)` and `#7 (Prioritize the Critical Path)`.

### A.3 Critical Chain Project Management (CCPM)

CPM assumes unlimited resources. CCPM recognizes that **resource contention** and **student's syndrome** (people start work only near deadlines) extend the critical path.

- **Critical chain** = the *resource-constrained* longest chain.
- **Buffers** absorb variability instead of padding every task:
  - **Project buffer:** placed at end of the critical chain.
  - **Feeding buffers:** placed where a non-critical chain feeds into the critical chain.
  - Buffers replace per-task "safety time" — estimates are aggressive (50% likely), safety is aggregated.
- **Buffer management:** track buffer *consumption* vs *chain-progress* how-big (fever chart):
  - **Green** — safe; **Yellow** — warn & investigate; **Red** — act / expedite.
- **Drum-Buffer-Rope (DBR):** drum = the constraint's schedule (pace-setter), buffer = protect against variation, rope = WIP release tied to constraint capacity (pull).

> Tool encoding: `src/lib/ccpm.ts`, `buffers` table, fever chart, five-step TOC workflow. Domain link: **B**.

### A.4 Estimation

Estimation is *not* commitment — it is a forecast under uncertainty. Full treatment in domain **3**; here: estimates belong at the task/leaf level and feed all higher aggregation. Store uncertainty *range*, never a single false-precise number.

### A.5 Risk Management

- **Risk** = future uncertainty with consequence. Model as `cause → event → impact`.
- **Exposure:** `exposure = probability × impact_score`.
- **Probability–Impact Matrix:** classify likelihood × severity into bands (usually 5×5) to prioritize.
- **Response strategies:** Avoid, Mitigate, Transfer, Accept (and *Exploit/Enhance/Share* for positive risks).
- **Linkage:** risks tie to tasks, buffers, and decisions. Every risk has an owner and a response.

> Tool encoding: `risks` table driven by `cause | event | impact`, auto-computed exposure, matrix view, response tracking.

### A.6 Scheduling

- Every task has duration + start/finish against a **calendar** (working days, holidays).
- Scheduling is *driven by* dependencies and constrained by resource availability.
- Auto-reschedule on any dependency/resource/calendar change; never let the user hand-draw inconsistent dates.
- Distinguish **effort** (person-days) from **duration** (elapsed calendar days) — they differ when allocation < 100%.

### A.7 Resource Allocation

- **Resources:** people or generic capacity pools; each has `capacity_per_day`.
- **Assignment:** `(task, resource, effort_days, allocation_pct)`.
- **Overload:** when a resource's committed effort across overlapping assignments exceeds capacity.
- **Trade-off:** *utilization* (time busy) ≠ *throughput* (items finished). Maximizing utilization of a non-constraint creates queues. See Principles #9 and domain **B**.

> Tool encoding: `resources`, `assignments`; overload flag; "utilization vs throughput" dashboard.

### A.8 Change Management

- **Change request** describes a *scope delta* and its **impact analysis** on schedule/cost/risk *before* approval.
- Impact is computed by re-running CPM (+ Monte Carlo delta) on the proposed change — numbers, not vibes.
- Approval is a state machine; approved changes re-baseline the plan.

> Tool encoding: `change_requests` storing `scope_delta`, `impact_schedule_days`, `impact_risk_delta`; diff view. Domain link: **5** (second-order effects).

### A.9 Stakeholder Management

- **Stakeholder** = anyone who affects or is affected by the project.
- **Power–Interest grid:** classify stakeholders (high/low power × high/low interest) to tune engagement.
- **Communication plan:** who gets what, how often, through what channel.
- **Decisions** link to owners/stakeholders with a due date; overdue decisions silently block work (Principles #5).

---

## B. Theory of Constraints (TOC)

**Core thesis:** Every system has a constraint limiting its throughput. Improving anywhere except the constraint does not improve the system.

### B.1 The Five Focusing Steps

1. **Identify** the constraint (the bottleneck limiting throughput).
2. **Exploit** it — get the maximum from the constraint without major change (reduce wasted time on it).
3. **Subordinate** everything else — align all non-constraint work to support the constraint.
4. **Elevate** it — add capacity or remove the constraint entirely.
5. **Repeat** — avoid inertia; the constraint moves, find the new one.

### B.2 Throughput vs Utilization

- **Throughput:** the rate at which the system produces completed, valuable units.
- **Utilization:** the fraction of time a resource is busy.
- **Misleading metric:** a resource can be 100% utilized yet produce nothing if it is *not* the constraint. Optimizing a non-constraint's utilization only creates WIP and queues.

### B.3 Drum-Buffer-Rope (DBR)

- **Drum:** the constraint's schedule — sets the system's pace (aka the *drum beat*).
- **Buffer:** protection placed ahead of the constraint against variation upstream.
- **Rope:** a WIP limit / release mechanism that ties the start of work to the constraint's capacity (a pull from the drum).

> Tool encoding: constraint detector, guided five-step workflow (`constraints.tsx`), CCPM buffers + fever chart, drum-buffer-rope WIP pull. Warning UI when the user optimizes a non-constraint. Tie to Principles #6 & #9.

---

## D. Kanban / Flow

**Core thesis:** Work should *flow* through the system continuously with low variance and minimal waiting. Slow/disorderly flow (not idle workers) is the enemy.

### D.1 WIP Limits

- Work In Progress = started-but-not-finished work.
- **WIP limit** caps how many items may reside in a column/state at once.
- Why: bounded WIP ⇒ shorter cycle time, faster feedback, visible bottlenecks.
- Two policies: **hard** (block new work) vs **soft** (allow but flag/warn).
- By pulling new work only when WIP frees up, the system self-paces (the "rope").

> Tool encoding: `board_columns` with `wip_limit` + `wip_policy`; hard/soft enforcement; swimlanes per class of service (each with its own WIP/SLA).

### D.2 Cycle Time, Lead Time, Throughput

- **Lead time:** total elapsed time from item *requested* to item *delivered* (includes waiting to start).
- **Cycle time:** elapsed time from work *actively started* to *delivered*.
- **Throughput:** number of items *delivered* per unit time.
- Moving an item backward (reopening) resets or distorts these metrics — track with clear transition rules.

### D.3 Queueing & Little's Law

- **Queueing** is why high utilization is costly: above a threshold, wait time grows non-linearly (explosively) as utilization → 100%.
- **Little's Law:** `L = λ · W`
  - `L` = average items in the system (WIP),
  - `λ` = average arrival/completion rate (throughput),
  - `W` = average time an item spends in the system (cycle/lead time).
  - Reliable only over a *steady-state* window with stable inflow; use as a *consistency check*, not false precision.

> Tool encoding: `src/lib/little.ts` — live validation panel showing predicted vs actual WIP given throughput and cycle time; warn when steady-state assumptions break.

### D.4 Flow Efficiency

```
Flow efficiency = Work time / (Work time + Wait time)
```
- The fraction of total clock time an item is actually being worked on vs waiting.
- Low flow efficiency reveals waiting (dependencies, approvals, queueing) — the area to attack.
- Requires a **wait-reason taxonomy** for why time was spent waiting (human, approval, dependency, capacity, info).

### D.5 Aging Work

- Items sitting past a threshold (e.g., > 85th percentile of cycle time) are **aging** and tend to rot (context loss, code drift, rework).
- SLA breaches on classes of service; aging chart flags items needing attention or explicit kill/re-scope.

### D.6 Classes of Service (CoS)

| Class | Policy |
|---|---|
| **Expedite** | Highest priority; limited to e.g. 1 at a time; SLA very short; explicitly constrained WIP |
| **Fixed Date** | Triggered by an external commitment; schedule to need-by date |
| **Standard** | First-in-first-out; normal SLA |
| **Intangible** | No direct customer value (refactors, debt, spikes); scheduled opportunistically |

Each class gets its own WIP limit, SLA, and scheduling policy. Visualization via color/swimlane.

### D.7 Charts

- **Cumulative Flow Diagram (CFD):** stacked line chart of items in each column over time; horizontal width of bands ⇒ WIP; vertical slope ⇒ throughput.
- **Throughput histogram:** distribution of completed items per period.
- **Cycle time scatterplot:** delivery date × cycle time with **85th/95th percentile lines** — the reliable "promise" lines.
- **Aging chart:** items vs time-in-column, highlight breaches.

> Tool encoding: `flow_events` on every column transition; `src/lib/flow-metrics.ts`; `analytics.cfd / throughput / cycleTime`; materialized `flow_metrics` view.

---

## E. Software Engineering

**Core thesis:** In software, *completion* depends as much on architecture and debt as on task tracking. A task list alone cannot make software shippable.

### E.1 Incremental Development

- Deliver in **small, vertical slices** — each slice crosses all layers and is independently usable/verifiable.
- Contrast with horizontal slices (all UI, then all API) which only test parts at the very end.
- Slice must carry a definition-of-done (DoD) at every level; keep each slice shippable.

### E.2 Modularity & Coupling

- **Modularity:** decompose the system into cohesive, replaceable modules with clear interfaces.
- **Coupling:** how much one module depends on another. High/accidental coupling multiplies the blast radius of change.
- **Co-change coupling indicator:** modules often edited together are coupled — flag for refactor.
- Modules/areas become tags on work items, enabling debt attribution.

### E.3 Technical Debt

- **Technical debt:** the future cost incurred by choosing an expedient, short-term implementation now.
- Use the metaphor of *financial debt*: interest accrues, it must be tracked and paid down deliberately — some debt is wise, unacknowledged debt is not.
- Ledger model: `debt_incurred` (principal added) vs `debt_paid` (principal reduced); **net debt = incurred − paid**.
- Refactoring is a *first-class work type*, not an act of god.

> Tool encoding: work types incl. Debt/R... ; debt ledger + wallboard grouped by module; co-change coupling stub.

### E.4 Testing, CI, Release Engineering

- **Testing:** automated tests make change cheap and safe — the enabler of refactoring and incremental delivery.
- **Continuous integration (CI):** integrate and validate each change automatically (build + tests) — shrinks the feedback loop.
- **Release engineering:** the path from committed code to deployed artifact is a first-class, repeatable pipeline (branches, PRs, tags).

> Tool encoding: work type enforcement (Feature/Bug/Debt/Spike), `branch`/`pr_url`/`release_tag` links, `ci_status` stub (later GitHub webhook), slicing checklist.

---

## 3. Estimation & Uncertainty

**Core thesis:** Estimates are probabilistic forecasts about an unknown future. Treat them as *distributions*, not single numbers. Plan for the range, not the hope.

### 3.1 Probabilistic Estimation

- Represent each task's duration as a **distribution**, not a point.
- Communicate "P50/P70/P85/P95" confidence, never "it will take 12 days."
- **Thinking in Bets (Annie Duke):** decisions under uncertainty are *bets*; good process (pre-mortem, calibration, separating outcome from decision quality) beats luck. Grade decisions by quality of reasoning given what was known then, not by outcome.

### 3.2 Three-Point Estimation (PERT)

Three values per activity: **Optimistic (O)**, **Most Likely (M)**, **Pessimistic (P)**.

- **Expected value (PERT weighted mean):**
  ```
  E = (O + 4·M + P) / 6
  ```
- **Variance (spread):**
  ```
  σ² = ((P − O) / 6)²
  ```

### 3.3 Monte Carlo Simulation

- Sample each task's duration from its distribution over many runs (N = 1k–20k), propagate through the dependency network, and record the resulting project end date each run.
- Output: a **distribution** of completion dates → **percentiles (P50/P70/P85/P95)** and a **probability of hitting a target date**.
- Deterministic seeding for reproducibility. Server-side; cache results.

> Tool encoding: `src/lib/montecarlo.ts` (triangular/PERT sampling), `simulations` table, histogram + percentile bar.

### 3.4 Reference Class Forecasting

- Don't estimate in a vacuum — compare against a **reference class** of comparable past projects.
- Compute an **uplift factor** from the ratio of actuals to estimates in that class, and apply it (anchoring correction).
- Shown as estimate-vs-actual scatterplot from in-workspace history.

### 3.5 Cone of Uncertainty

- Early in a project, uncertainty is wide (**cone** is wide); as work proceeds and facts emerge, the plausible range narrows.
- Re-estimate at **phase gates**; store `estimate_history` to plot the cone and prompt re-estimation.

### 3.6 Expected Value & Risk-Adjusted Planning

- **Expected value:** `EV = p(success) × value` — fold probability into value to compare work items fairly.
- **Risk-adjusted planning:** plan view sorts by exposed value; every date claim exposes its *probability*. Never present a single best-guess as the plan.

> Tool encoding: three-point fields on `wbs_nodes`, PERT display, Monte Carlo `estimation.simulate`, `estimation.referenceClass`, `estimation.cone`, EV column + sort. Bet-framing/pre-mortem prompts follow `Thinking in Bets`.

---

## 5. Systems Thinking

**Core thesis:** Work systems are dynamic, not static — causes loop back, delays mask effects, and optimizing a part can harm the whole.

### 5.1 Stocks & Flows

- **Stock:** a quantity that accumulates (e.g., backlog, WIP, done) — level at a point in time.
- **Flow:** a rate of change into/out of a stock (e.g., arrival rate, completion rate).
- `Stock(t+1) = Stock(t) + inflow − outflow` — conservation of items.

### 5.2 Feedback Loops & Delays

- **Reinforcing loop:** amplifies (compounding growth, runaway rework).
- **Balancing loop:** corrects toward a goal (capacity control).
- **Delay:** the time between a cause and its effect. Delays make systems oscillate and hide true causes.

### 5.3 Bottlenecks

- A **bottleneck** is a stock whose outflow is capped → queue builds. It *is* the TOC constraint (domain **B**), made visible through flow metrics (domain **D**).

### 5.4 Emergent Behavior & Second-Order Effects

- **Emergent behavior:** system-level results that arise from local interactions and are not predictable from any single component.
- **Second-order effects:** consequences of consequences — e.g., "adding people to a late project" (Brooks's Law) *slows* it via communication overhead and onboarding.

### 5.5 Local vs Global Optimization

- Optimizing a part (e.g., a fast but irrelevant resource, a non-constraint process) can *slow the whole*.
- The system optimum is not the sum of local optima. Always check: does this optimization move the *constraint*?

> Tool encoding: qualitative causal-loop / stock-and-flow mini-model per project; `what-if` sliders recomputing throughput via Little's Law + CPM; second-order-effects checklist on change approval; "optimizing non-constraint" warning.

---

## Cross-Domain Recipes (frequently used math)

These are the formulas the engines share.

**PERT expected value**
```
E = (O + 4M + P) / 6          ; variance σ² = ((P − O)/6)²
```

**CPM forward / backward pass**
```
EF = ES + duration                    ES = max(EF of predecessors) + FS-lag
LS = LF − duration                    LF = min(LS of successors) − FS-lag
Total float  = LS − ES  =  LF − EF
Free float   = min(ES of successors) − EF
Critical path = chain of zero total float
```

**Little's Law**
```
L = λ · W        (WIP = throughput × cycle/lead time)
```

**Flow efficiency**
```
Flow efficiency = Work time / (Work time + Wait time)
```

**Expected value / Exposure**
```
EV       = p(success) × value
Exposure = probability × impact_score
```

---

## Principle ⇄ Domain Mapping

Every principle in `docs/notes/PRINCIPLES.md` maps to one or more domains — use this to source the *rationale* behind any feature:

| Principle | Primary domains |
|---|---|
| 1. Define the Finish Line | A (DoD/scoping), E (DoD per slice) |
| 2. Reduce WIP | D (WIP limits, Little's Law) |
| 3. Control Dependencies | A (CPM), B (critical chain) |
| 4. Shorten Feedback Loops | D (cycle time), E (CI), 5 (delays) |
| 5. Make Decisions Explicit | A (stakeholders/decisions) |
| 6. Manage Constraints | B (TOC five steps) |
| 7. Prioritize the Critical Path | A (CPM/CCPM) |
| 8. Separate Discovery from Execution | E (spike work type), 3 (uncertainty) |
| 9. Optimize for Throughput, Not Utilization | B (throughput vs utilization), D (queueing) |
| 10. Finish Before Optimizing | E (incremental), 3 (estimate cost of done) |

---

## Glossary

Product terminology is owned and governed in [`../CONTEXT.md`](../CONTEXT.md)
(the tool's domain glossary). This document stays the *formulas and theory*
layer: acronyms are defined inline where the domain they belong to is covered
(CPM/CCPM in §A, WIP/CoS/CFD in §D, PERT/P50 in §3, DoD and EV in their
sections). Refer to `../CONTEXT.md` for canonical definitions of tool
concepts such as **Outcome**, **Signal**, and **Task**.

Minimal acronym map (from inspiration archive): **CPM** — Critical Path Method, **CCPM** — Critical Chain, **WBS** — Work Breakdown Structure, **TOC** — Theory of Constraints, **DBR** — Drum-Buffer-Rope, **WIP** — Work In Progress, **CoS** — Class of Service, **CFD** — Cumulative Flow Diagram, **PERT** — Program Evaluation and Review Technique, **P50/P85** — completion percentiles, **DoD** — Definition of Done, **EV** — Expected Value.

---

*Living document. Keep in sync with [`PRINCIPLES.md`](./PRINCIPLES.md) (philosophy) and [`../CONTEXT.md`](../CONTEXT.md) (glossary). Future engines are marked 🔮 — do not assume they exist in `src/lib/*.ts` until marked Implemented.*