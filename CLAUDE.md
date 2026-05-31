# Finance Tracker — Claude Code Guide

Single-owner personal finance PWA, part of a "Life OS" ecosystem of standalone self-tracking apps that feed a master AI layer. Authoritative scope: [FINANCE_APP_PRD.md](FINANCE_APP_PRD.md). Execution roadmap: [DELIVERY_PLAN.md](DELIVERY_PLAN.md).

## What makes this app non-generic
Off-the-shelf trackers treat every debit as spending. This app's whole reason to exist is that the owner's real cash flow contains huge volumes of **pass-through money** — credit-card settlements, cash loans to friends, GPay split IOUs, rent reimbursements, one bank line that represents three economic events. Every architectural decision must protect the **"flowType is the truth, sign is not"** principle.

## Stack (locked — do not substitute)
- **Framework**: Next.js 14 (App Router, React Server Components where sensible)
- **DB**: MongoDB Atlas + Mongoose
- **Auth**: NextAuth.js (single-owner; still real auth — financial data)
- **UI**: MUI v5; charts via Recharts
- **State**: Zustand (UI/session), TanStack Query (server cache, optimistic updates)
- **Offline**: IndexedDB via `idb`; PWA via `next-pwa` / Workbox
- **Validation**: Zod schemas shared client + server + import parser
- **Tests**: Vitest (pure functions), Playwright (PWA flows)
- **Deploy**: Vercel (app) + MongoDB Atlas (data)

## Module layout
```
/app                    routes: dashboard, add, accounts, lending, debts, reports, import, settings
/lib/money              paise math, formatting, Money value-object
/lib/flow               flowType rules, classification heuristics
/lib/import             statement parsers + dedupe + counterparty mapping
/lib/recurring          rule engine, arrears
/lib/projection         amortization, payoff, liquidity forecast
/lib/schemas            Zod schemas (shared client/server)
/models                 Mongoose schemas
/db/local               IndexedDB stores, sync queue
/server/api             route handlers; also AI digest + MCP feed
/components             MUI components
/lib/test-utils         fixtures, factories
```

## Non-negotiable invariants
1. **Money is integer paise.** Never floats anywhere. All arithmetic via `lib/money`. Display rounds only at the edge.
2. **Balances are derived, never stored as authority.** Replay/recompute deterministically from transactions. Protects offline sync against tampering and drift.
3. **`flowType` is the source of report truth**, not sign/direction. Reports filter by flowType, not by amount sign.
4. **All deletes are soft.** Every mutation appended to `editHistory: [{at, field, from, to}]`. Hard deletes never reachable from the UI.
5. **No raw card/account numbers.** Only masked `last4` labels. Enforced at schema level.
6. **Offline-first.** Writes hit IndexedDB first, then sync queue. UI never blocks on network.
7. **Time:** store ISO UTC timestamps + `valueDate` (date-only, IST-normalized). Reports use `valueDate`.
8. **Receivables are unified:** cash loans + GPay split IOUs share one `Receivable` ledger and one "owed to me" view.
9. **Imports never auto-confirm** classifications that change net worth (lending, write-off, settlement). Always user-confirmed in a review queue.
10. **Pure functions only** in `/lib/money`, `/lib/flow`, `/lib/projection`, `/lib/recurring` — no `Date.now()`, no DB access. Inject clock/state. Unit-tested ≥ 90% lines.
11. **Sync conflict rule:** last-write-wins per *field* using `bookedAt`/version; conflicts logged for user review. Balances recompute on replay — never synced as source-of-truth.
12. **Edit a historical transaction → cascade recompute** downstream balances/budgets/receivables. Block (or warn-cascade) deletes that would orphan a receivable.

## Conventions
- One PR per phase from [DELIVERY_PLAN.md](DELIVERY_PLAN.md). Phase number in the branch name (e.g. `p4-receivables`).
- Mongoose models in `/models` mirror Zod schemas in `/lib/schemas`. The Zod schema is the source of truth; generate types from it.
- Route handlers in `/server/api/` are thin; logic lives in `/lib/*`.
- Currency display: `₹` with Indian lakh/crore grouping. Use the `Money` formatter — never `Intl.NumberFormat` directly.
- Component naming: PascalCase. Hooks: `useThing`. Server actions: `verbNoun` (e.g. `splitTransaction`).
- Test naming: `<unit>.test.ts` colocated; integration `<feature>.spec.ts` under `/tests`.

## Claude Code workflow for this repo

### Subagents to use
- **Plan** — at the start of each phase, hand it the phase spec + PRD section refs and ask for a file-level implementation plan. Critical for phases P4 (receivables), P8 (investments), P10 (sync), P12 (MCP).
- **Explore** — once `/app`, `/lib`, `/models` each exceed ~20 files, use it for "where is X" lookups rather than burning the main context on greps.
- **general-purpose** — multi-step research like "audit all places that read `currentBalance`" before refactoring derived-balance logic.

### Skills to invoke
- **`/code-review high`** — required before merging any phase PR.
- **`/security-review`** — required before merging anything touching auth (P0), import (P9), write endpoints, or AI/MCP endpoints (P12). Financial data is the most sensitive in the ecosystem.
- **`/verify`** — drive the PWA in a real browser before declaring a phase done. Type checks won't catch offline-sync regressions or PWA install issues.
- **`/run`** — launch dev server when iterating on UI/PWA behavior.
- **`/simplify`** — apply code-review fixes to the working tree.
- **`/init`** — refresh this CLAUDE.md after any phase that changes conventions or module layout.

### Definition of Done (per phase)
- All FRs in scope satisfied.
- All edge cases (E#) in scope explicit-tested with named cases.
- Pure functions ≥ 90% line coverage.
- `/code-review high` shows no high-severity findings.
- `/security-review` clean where relevant.
- Manual PWA verification via `/verify`: install, offline write, online sync, conflict-log surface.
- Perf: add-transaction interaction < 200 ms locally; reports render < 1 s on a 2-year dataset (synthetic fixture).
- A short note appended to [DELIVERY_PLAN.md](DELIVERY_PLAN.md) on what shipped and any deviations.

## Don't do
- Don't introduce a new state library, charting library, or UI kit. Stack is locked.
- Don't add multi-currency support before P12. Design hooks are in place; implementation isn't scoped.
- Don't add bank API aggregation (Plaid/AA). Import is paste/CSV only in v1.
- Don't auto-write-off receivables. `dueModel: 'when_able'` exists precisely to prevent this.
- Don't store `currentBalance` as authoritative anywhere. It's a view, not a fact.
- Don't add features beyond the current phase's scope — even if "while I'm here." Phases ship independently for a reason.

## Reference
- [FINANCE_APP_PRD.md](FINANCE_APP_PRD.md) — domain model, FRs, edge cases (E1–E37), reports (R1–R23)
- [DELIVERY_PLAN.md](DELIVERY_PLAN.md) — phase-by-phase execution plan
