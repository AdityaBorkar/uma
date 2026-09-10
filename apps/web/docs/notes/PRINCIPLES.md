# Principles

## Mental Model

A useful mental model for project work is:

```
Outcome → Scope → Sequence → Constraints → Feedback → Decisions → Completion
```

Most project failures aren't because people don't know how to create a Jira board. They happen because one of these is poorly managed.

Each stage answers a distinct question:

| Stage | Question |
|-------|----------|
| **Outcome** | What result are we trying to achieve, and why does it matter? |
| **Scope** | What is included and — equally important — what is not? |
| **Sequence** | In what order must work happen? What depends on what? |
| **Constraints** | What limits us — people, time, money, capacity, approvals, information? |
| **Feedback** | How quickly do we learn if we're on the right track? |
| **Decisions** | What choices are unresolved, who owns them, and by when? |
| **Completion** | What constitutes "done" and who accepts it? |

When a project stalls, diagnose it by walking this chain. The break is usually not in execution — it's in an earlier link that was left vague.

---

## Principles Worth Learning

### 1. Define the Finish Line

- What exactly constitutes "done"?
- What observable result exists when the project is complete?
- Who accepts it?

If the finish line is fuzzy, progress is unmeasurable and scope expands indefinitely. Define done in observable, verifiable terms before work begins.

### 2. Reduce Work in Progress

Starting more things feels productive but slows completion. Finish existing work before starting more.

Multitasking across too many parallel efforts increases context switching, delays feedback, and hides bottlenecks. Limit WIP to increase flow and shorten time-to-done.

### 3. Control Dependencies

A project is often limited by the longest dependency chain, not by total work. Identify what blocks what.

Map dependencies early. The critical chain determines the earliest possible finish — optimizing unrelated tasks won't help if the bottleneck remains.

### 4. Shorten Feedback Loops

Don't spend 3 months building something before discovering that the premise was wrong. Produce progressively more complete versions.

Small, frequent increments expose wrong assumptions while they are still cheap to fix. Prefer iterative delivery over big-bang reveals.

### 5. Make Decisions Explicit

Unresolved decisions become invisible blockers. Every important ambiguity should have an owner and a deadline.

A decision without an owner drifts. A decision without a deadline blocks silently. Track open decisions the same way you track open tasks.

### 6. Manage Constraints, Not Just Tasks

People, money, time, technical capacity, approvals, information — these are the real limiters of progress.

A task list without constraint awareness creates unrealistic plans. Identify which constraint is binding at any given time and manage it deliberately.

### 7. Prioritize the Critical Path

Not every task deserves equal management attention.

Focus energy on the sequence of tasks that determines the project's end date. Slack elsewhere is normal — over-managing non-critical work wastes attention and creates false urgency.

### 8. Separate Discovery from Execution

Some uncertainty needs investigation before committing to implementation.

When the solution is unclear, invest in discovery — prototypes, spikes, research, validation — before locking in scope and sequence. Conflating the two leads to rework or premature commitments.

### 9. Optimize for Throughput, Not Utilization

Keeping everyone 100% busy can make the entire system slower. A partially idle team can sometimes finish projects faster.

High utilization creates queues, delays handoffs, and amplifies variability. Throughput — completed, valuable outcomes per unit time — is the metric that matters.

### 10. Finish Before Optimizing

A completed mediocre project often teaches you more than a beautifully optimized project that never ships.

Get to done, learn from reality, then improve. Premature optimization delays feedback and often optimizes the wrong thing.

---

## How to Use These Principles

1. **At project start:** Walk `Outcome → Completion` and ensure each stage has an explicit answer.
2. **When stuck:** Identify which stage is failing — that is where to intervene.
3. **In reviews:** Ask which principle is being violated rather than adding more tasks or process.

> Process tools (boards, tickets, charts) support these principles — they don't replace them.
