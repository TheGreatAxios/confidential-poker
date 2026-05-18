# ADR-004: Poker Table UI Polish — Chips, Depth, Empty Seats, and Spectator Flow

## Status

proposed

## Context

The live poker table UI (`apps/web`) is functionally complete but visually sparse. A screenshot review identified several gaps that make the table feel empty and hard to read at a glance:

- Only 2 of 6 seats occupied; the oval looks lopsided and abandoned
- No chip visuals — pot and balances are plain text labels
- Community cards are small and lack phase context (no "Flop" / "Turn" / "River" label)
- Active player is indicated by an "ACTING" badge, but there is no turn timer or motion cue
- Raw truncated hex addresses are hard to scan quickly
- The spectating CTA is plain text instead of a button
- The table surface is flat green with no depth, shadows, or felt texture
- Footer credit competes with the primary CTA for attention

These are all presentational changes — no contract or agent logic is affected.

## Constraints

- Must remain direct-to-chain via wagmi/viem; no backend dependency introduced
- Must not increase bundle size significantly (>50KB uncompressed) — favor CSS/SVG over heavy images
- Must keep existing responsive behavior (table scales down on mobile)
- Must not break existing Storybook stories or component tests
- Must pass `oxlint` and `tsc --noEmit` in `apps/web`

## Options Considered

### Option A: Incremental CSS/SVG polish (recommended)
- Add ghosted "Seat Open" placeholders for empty seats using existing player-position math
- Render SVG chip stacks for pot and player bets; keep text as labels
- Add CSS radial gradients, inner shadows, and box-shadows on cards/chips for depth
- Enlarge community cards ~25% and add a street label banner
- Add a radial turn-timer SVG around the active player's avatar
- Integrate `jazzicon` or `blo` for wallet identicons (both are tiny, MIT-licensed)
- Convert spectating CTA to a styled button; move footer into a subtle fixed footer
- **Pros:** Zero new runtime dependencies except a tiny identicon lib; all changes are additive and reversible; fast iteration
- **Cons:** Requires careful SVG work for chips; some CSS gradient tweaking for felt texture
- **Effort:** Medium — 1-2 days focused frontend work
- **Risks:** Chip SVGs may look toy-like if not tuned; mitigated by keeping text labels alongside

### Option B: Full 2D canvas renderer (Pixi/Phaser)
- Replace DOM-based table with a Canvas 2D/WebGL layer for smoother animations and realistic chip physics
- **Pros:** Maximum visual fidelity; easy particle effects for all-in, pot rakes, etc.
- **Cons:** Heavy dependency (~500KB+); breaks accessibility and SEO; requires rewriting interaction layer; overkill for current scope
- **Effort:** Large — 1-2 weeks
- **Risks:** Significant bundle bloat; harder to maintain; debugging canvas hit regions is painful

### Option C: Do Nothing
- **Pros:** Zero risk, zero effort
- **Cons:** Table continues to look unfinished to users and spectators; onboarding friction remains high; poor demo impression

## Proposal

Adopt **Option A** — incremental DOM-based polish. Work in this order:

1. **Empty seat placeholders** — render a muted "Seat Open" circle + dashed border at unoccupied positions using existing `playerPositions` array
2. **Table depth** — apply a CSS radial gradient overlay and subtle inner box-shadow to the felt ellipse; add drop-shadows to all card and chip elements
3. **Community cards** — increase card size 25%, add a small pill banner above them showing the current street ("Pre-Flop", "Flop", "Turn", "River", "Showdown")
4. **Chip visuals** — create a reusable `ChipStack` SVG component (cylinders with gradients) used for the main pot and current bets; overlay numeric labels on top
5. **Active player UX** — add a pulsing CSS ring around the acting avatar; overlay a 30-second radial countdown SVG (stroke-dashoffset animation)
6. **Identicons** — add `blo` (~1KB) or `jazzicon` (~3KB) next to every wallet address; keep truncated text as fallback/tooltip
7. **Spectator CTA** — replace text banner with a primary-styled `<Button>`; move the credit footer to a `fixed bottom-0` subtle bar or collapse it into a settings/about modal
8. **Network status** — add a small "Live" dot + chain name pill in the top-right near the table ID

## Impact

- `apps/web/src/components/table/` — all table surface, card layout, and seat components
- `apps/web/src/components/ui/chip-stack.tsx` — new
- `apps/web/src/components/ui/identicon.tsx` — new
- `apps/web/src/components/ui/countdown-ring.tsx` — new
- `apps/web/src/components/ui/street-banner.tsx` — new
- `apps/web/src/hooks/useGamePhase.ts` — derive street from community card count (0=Pre-Flop, 3=Flop, etc.) or expose from contract events
- `apps/web/package.json` — add `blo` or `jazzicon` dependency
- `apps/web/src/App.tsx` or layout root — footer placement change
- Storybook stories updated for any modified components

## Test Plan

1. Visual regression via Storybook — add stories for `ChipStack`, `SeatOpen`, `StreetBanner`, and `ActivePlayerRing`
2. Component tests for `useGamePhase` hook — assert correct street labels for 0, 3, 4, 5 community cards
3. `tsc --noEmit` and `oxlint` must pass in `apps/web`
4. Build must pass: `bun run build:frontend`
5. Manual check on mobile viewport (375px) to confirm table scaling and chips remain readable

## Rollback Plan

All changes are additive CSS/component modifications. Rollback is a single revert commit. No ABI or contract changes are involved.

## Decision Log

| Date | Actor | Action |
|------|-------|--------|
| 2026-05-18 | Agent | Drafted ADR from UI screenshot review |
