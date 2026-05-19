# Architecture Decision Records (ADRs)

All non-trivial changes to this project — features, bugs, refactors, dependency swaps, tooling changes — must go through the ADR process before any code is written.

## ADR Process

1. **Define** — Open a new ADR using `000-template.md`. State the problem, constraints, and success criteria.
2. **Explore** — Deeply investigate all viable options. Include trade-offs, risks, and estimated effort for each.
3. **Propose** — Fill in the "Proposal" section with the recommended path and a clear rationale.
4. **Approve** — ADR is submitted for human review and must be explicitly approved before work starts.
5. **Implement** — Code changes are made against the approved ADR.
6. **Verify** — All gates below must pass before merging.

## Quality Gates (must pass before any ADR ships)

- Test suite passes in all affected packages
- Test coverage stays above 80% in all affected packages; create tests as needed to maintain this
- `oxlint` passes (or is added and passes) in all affected packages
- `tsc --noEmit` (typecheck) passes in all affected packages
- `build` passes if the package has a build step
- Documentation updated if the change affects user-facing behavior, architecture, or deployment workflow

## Status Values

- `proposed` — Under exploration, not yet approved
- `approved` — Human-approved, ready for implementation
- `implemented` — Code merged, ADR updated with any deviations
- `superseded` — Replaced by a newer ADR

## Index

| # | Title | Status | Date |
|---|-------|--------|------|
| 001 | LangGraph Migration for Agent Orchestration | implemented | 2026-05-18 |
| 002 | Monorepo Restructure and Shared Package Extraction | implemented | 2026-05-18 |
| 003 | Factory-Paid Table Creation + Auto-Shutdown on Empty | implemented | 2026-05-18 |
| 004 | Poker Table UI Polish — Chips, Depth, Empty Seats, and Spectator Flow | implemented | 2026-05-18 |
| 005 | Auto-Claim MockSKL in JoinPanel — Remove Misleading FaucetPanel Stub | implemented | 2026-05-19 |
| 006 | Viewer Key Loss Recovery — Fix Rejoin Mode When localStorage Is Cleared | implemented | 2026-05-19 |
| 007 | Allow Joining During Active Hand + Fix Create Table Revert | implemented | 2026-05-19 |
