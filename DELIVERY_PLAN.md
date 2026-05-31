# Finance Tracker — Phased Delivery Plan

Detailed expansion of [FINANCE_APP_PRD.md](FINANCE_APP_PRD.md) §13. Each phase ships independently and is usable on its own. Conventions and stack are locked in [CLAUDE.md](CLAUDE.md).

**Total estimate (solo dev, focused):** ~43–56 working days end-to-end.

**Workflow per phase:**
1. Branch `pN-<slug>` off main.
2. Spawn `Plan` subagent with the phase spec + linked PRD sections → file-level plan.
3. Implement, with Vitest red→green for pure logic.
4. `/run` for UI iteration; `/verify` for offline/PWA validation.
5. `/code-review high` → address findings via `/simplify` or by hand.
6. `/security-review` where the matrix below marks it required.
7. Open PR; merge; append a "What shipped" note at the bottom of this file.

---

## P0 — Foundation
**Estimate:** 2–3 days · **Depends on:** none · **Security review:** **required** (auth)

### Scope
Project scaffold + locked stack wiring + auth + money utils + base schemas + seed data.

### Deliverables
- Next.js 14 (App Router) project, TypeScript strict, ESLint, Prettier.
- MongoDB Atlas connection (`/lib/db.ts`) with connection-pool reuse for serverless.
- NextAuth.js single-owner config (credentials or Google; session stored in MongoDB).
- `/lib/money` — `Money` value object: `fromRupees`, `fromPaise`, `add`, `sub`, `mul`, `div`, `format` (Indian grouping), `parse`. Integer paise throughout. **No floats.**
- `/lib/schemas` — Zod schemas for `Account`, `Counterparty`, `Category`, `Transaction`, `RecurringRule`, `Receivable`, `SplitBill`, `Holding`, `Budget`, `Setting`.
- `/models` — Mongoose schemas mirroring Zod, with virtuals/indexes.
- Seed script `/scripts/seed.ts`: HDFC Bank, HDFC/Kotak/Axis Cards, Cash, INDmoney, Jumbo Loan, PL ...8012; counterparties (Dad, Devanand, Sarathchandran, Augustine); base category tree (Appendix A).
- MUI theme + base layout shell (top bar, bottom nav placeholder).
- Vitest + Playwright configured; first money tests green.
- `next-pwa` installed (full PWA wiring deferred to P10).

### Acceptance
- `npm run dev` boots; sign-in works; seeded data visible in a `/debug` page.
- `Money.format(100000_00)` → `₹1,00,000.00`. Round-trip `parse → format` lossless.
- `npm test` runs Vitest; coverage report generated.

### Risks
- Mongoose/Zod type duplication drift → mitigate by generating TS types from Zod and asserting Mongoose docs satisfy them.

---

## P1 — Manual transaction CRUD + flowType + accounts + balances
**Estimate:** 4–5 days · **Depends on:** P0 · **Security review:** required (first write endpoints)

### Scope
The atomic record works end-to-end. Daily logging is possible (online-only here; offline lands in P10).

### FRs in scope
FR-1 quick add, FR-2 flow-type aware suggestions (basic), FR-5 soft edit/delete, FR-7 running balance, FR-8 credit-card model (charge vs settlement), FR-9 transfer nets to zero.

### Edge cases addressed
E1 (split parent/child — schema only; UI in P3?... actually wire UI here), E4 (card charge vs settlement), E13 (edit recomputes), E17 (paise rounding), E18 (self-transfer), E19 (UTC + valueDate), E23 (per-account openingBalance).

### Deliverables
- `/app/add` — amount-first quick-add form (MUI); account picker, counterparty picker, flowType selector with `needWant` sub-flag for `spend`.
- `/app/accounts` — list with derived balances; per-account drill-in with paginated transactions.
- `/server/api/transactions` — POST/PATCH/DELETE (soft); audit trail appended.
- `/lib/balances` — pure function `computeBalances(transactions, accounts)`; called by API and view layer.
- "Split one bank line" UI: parent transaction → N children whose sum equals parent.
- Card-settlement excluded from "spending" report aggregates.

### Acceptance
- Adding a `spend` from HDFC Card increases HDFC Card liability and does not change HDFC Bank.
- Paying that card via `card_settlement` from HDFC Bank reduces both; spend totals unchanged.
- Editing a 2-week-old txn updates all downstream balance views.
- Splitting a ₹60,000 parent into 3 children sums exactly; parent excluded from totals.

### Risks
- Mistakes here cascade into every later phase. Spend extra time on `/lib/balances` test fixtures.

---

## P2 — Categories, budgets, basic month dashboard
**Estimate:** 3–4 days · **Depends on:** P1 · **Security review:** not required

### Scope
First moment of insight. Categories settable per txn; monthly budgets; R2/R3 dashboards.

### FRs in scope
FR-23 monthly budget + variance + rollover.

### Reports built
R2 (month overview big buckets), R3 (budget vs actual per category).

### Edge cases addressed
E11 (pay-cycle anchor, configurable), E25 (Indian currency grouping in all displays).

### Deliverables
- `/app/settings/categories` — manage hierarchical categories (seed from Appendix A).
- `/app/budgets` — set monthly budget per category; rollover toggle.
- `/app/dashboard` — landing page with R2 + R3 + this-month spend.
- `/lib/reports/month-overview.ts` + `/lib/reports/budget-vs-actual.ts` — pure functions.
- Pay-cycle vs calendar-month toggle in dashboard.

### Acceptance
- R2 separates: income / true spend / family_support / debt_repayment / investment / lending_out / card_settlement.
- Setting budget on "Dining & Eating Out" shows correct variance for the month.
- Toggling pay-cycle changes the period boundaries by salary day (5th default).

---

## P3 — Recurring rules + arrears + obligation reminders
**Estimate:** 3–4 days · **Depends on:** P2 · **Security review:** not required

### Scope
Dad ₹25k on the 5th, rent, SIP, EMIs, AC EMI with end date — all automated.

### FRs in scope
FR-10 generate upcoming obligations, FR-11 arrears policy `accumulate`/`skip`, FR-12 pay-cycle anchor (also surfaces here), FR-32 obligation reminders.

### Edge cases addressed
E2 (skipped recurring → arrears), E3 (recurring with fixed end), E24 (future-dated pending), E5 (cashback/refund handled as income or negative-spend, configurable).

### Deliverables
- `/app/recurring` — manage RecurringRule list; create from a template.
- `/lib/recurring` — pure rule engine: `generateUpcoming(rules, fromDate, toDate)` → pending txns; `computeArrears(rule, history)`.
- Daily cron / on-app-open generator: materializes pending transactions for upcoming cycles.
- Arrears UI prominent banner: "Dad ₹25k from April is unpaid — add now?"
- AC EMI seeded with `endDate` showing "1 of 3", "2 of 3", auto-stopping.
- Cashback/refund quick action on any historical spend → posts an `income` linked back.

### Acceptance
- Skipping Dad in month N shows arrears in month N+1; paying both clears both cleanly.
- AC EMI auto-stops after cycle 3; doesn't generate cycle 4.
- Upcoming obligations list shows next 30 days with due dates.

---

## P4 — Unified receivables (cash loans + GPay split IOUs)
**Estimate:** 4–5 days · **Depends on:** P3 · **Security review:** not required

### Scope
The "everything owed to me" ledger. Cash loans and unsettled GPay-split shares appear together in one report.

> **Use the `Plan` subagent first.** This phase has the most interlocking state and is where naive design choices haunt later phases.

### FRs in scope
FR-13 create Receivable on `lending_out` or per unsettled split participant, FR-14 repayment matching (partial, multiple, same-day collapse), FR-14b pay-when-able, FR-15 unified exposure + aging, FR-15b per-person view + opt-in reminder, FR-16 write-off → reclassified as spend (gift), FR-16b overpayment flagged as advance.

### Reports built
R14 (receivables exposure + aging 0–30 / 30–90 / 90+ + pay-when-able sublist).

### Edge cases addressed
E6 (lend then repaid same day), E7 (partial/multiple repayments), E8 (never repaid → write-off), E26 (pay-when-able never auto-written-off), E27 (multiple inbound across periods), E28 (overpayment → advance/credit).

### Deliverables
- `/app/lending` — unified ledger; group by counterparty; aging bucket badges.
- `/app/lending/[counterpartyId]` — per-person drill-in across loans + splits.
- `/lib/receivables` — pure functions: `applyRepayment`, `computeOutstanding`, `ageBucket`.
- `lending_out` flow creates a `Receivable{kind:'cash_loan'}`.
- `lending_repaid` (and `reimbursement_in` for split IOUs) reduces the receivable atomically.
- Write-off action → posts a `spend` linked via `reimbursesTransactionId` semantics; receivable marked `written_off`.
- Overpayment detection → UI flag on incoming amount, choice: "credit to next" or "leave as advance."

### Acceptance
- Lending ₹500 to Devanand and receiving ₹500 same day shows the loan as `closed` and nets to zero in all reports.
- Adding 3 partial repayments leaves status `partial` until the last brings outstanding to 0.
- Pay-when-able loans never disappear from the aging view, regardless of age.
- Total in R14 = sum of cash_loan + split_iou outstanding, matched to per-counterparty rollups.

---

## P5 — Splits + reimbursement matching + turf template
**Estimate:** 3–4 days · **Depends on:** P4 · **Security review:** not required

### Scope
Pass-through money problem solved. Owner pays a bill in full; others owe shares; matched to inbound payments.

### FRs in scope
FR-17 convert spend → SplitBill (incl. GPay paste), FR-18 cross-period reimbursement matching, FR-19 turf template + unequal-share support.

### Reports built
R15 (splits status: open/partial/settled, turf history).

### Edge cases addressed
E9 (reimbursement different month than spend), E10 (some never pay → write-off to own spend).

### Deliverables
- `/app/splits` — list of all SplitBills; status filters.
- Convert any `spend` transaction into a SplitBill in 2 taps: pick participants, default equal share, override per row.
- Turf template (`₹1,500 / N players`) — one-tap creation; saved as preferred default.
- Reimbursement matching: an incoming `reimbursement_in` proposes to match the largest open share for that counterparty.
- Cross-period: split in month A, reimbursement in month B; both reports honor the original spend month, R14/R15 reflect the reimbursement.

### Acceptance
- ₹1,200 dinner split 4 ways → owner share ₹300 stays as `spend`; 3 `Receivable{split_iou}` created.
- Roommate pays rent share 2 weeks later → SplitBill participant marked settled; original spend month untouched.
- Turf template: one tap creates 6-way ₹1,500 split.

---

## P6 — Debt accounts + amortization + payoff projection
**Estimate:** 3–4 days · **Depends on:** P5 · **Security review:** not required

### Scope
Loans behave like loans, not bank lines. Per-loan schedule; avalanche/snowball comparison.

### FRs in scope
FR-20 amortization schedule per loan, FR-21 avalanche & snowball payoff with interest saved + debt-free date, FR-22 card-in-full guard.

### Reports built
R11 (net worth over time — partial: cash + receivables; investments later in P8), R12 (debt payoff projection w/ freed-EMI redirect), R13 (EMI calendar).

### Edge cases addressed
E22 (EMI principal/interest split).

### Deliverables
- `/lib/projection/amortization.ts` — pure: `schedule(principal, ratePA, tenureMonths)`.
- `/lib/projection/payoff.ts` — pure: `avalanche(loans, surplusPerMonth)`, `snowball(...)`.
- `/app/debts` — per-loan view + comparative payoff scenario builder.
- EMI payments auto-split into principal (liability ↓) and interest (cost flagged separately).
- Card-in-full guard: if a `card_settlement` is below statement balance, prompt.
- R11 net worth — first usable version (assets = cash + receivables; liabilities = card + loan balances). Investments slot in P8.

### Acceptance
- Avalanche vs snowball on owner's debt set shows interest saved differential and debt-free dates within ~₹100 of a spreadsheet.
- Freed-EMI redirect projection illustrates "after Jumbo Loan, redirect ₹X/mo to SIP."

---

## P7 — Liquidity floor + cash-flow forecast + lend-safety
**Estimate:** 2–3 days · **Depends on:** P6 · **Security review:** not required

### Scope
Guardrails. App warns before money decisions break the next pay cycle.

### FRs in scope
FR-24 liquidity floor + breach alert, FR-25 lend-safety check.

### Reports built
R8 (cash-flow statement), R9 (liquidity forecast w/ floor-breach), R10 (pay-cycle burn-down).

### Edge cases addressed
E15 (overdraft allowed but flagged; escalates floor alert).

### Deliverables
- `/lib/projection/liquidity.ts` — pure: `forecast(currentBalance, upcomingRecurring, knownObligations, paydayDate)` → projected min balance per day.
- Floor setting (default ₹50k) in `/app/settings`.
- Lend-safety: on `lending_out` form, simulated forecast — if projected min < floor, warn.
- R9 chart: balance projection line + floor band; floor-breach day highlighted.

### Acceptance
- Adding a ₹20k upcoming obligation drops the projection; if min < ₹50k, dashboard banner shows "floor breach risk."
- Attempting a ₹30k loan when projected min would dip to ₹15k triggers the lend-safety warning.

---

## P8 — Investments & portfolio (crypto + stocks + mutual funds)
**Estimate:** 5–6 days · **Depends on:** P7 · **Security review:** required (if auto-price uses external API keys)

### Scope
Holdings tracked across CoinDCX / Zerodha / INDmoney with FIFO cost basis and live (or last-known) value feeding net worth.

> **Use the `Plan` subagent first.** FIFO + corporate actions + USD/INR FX is interlocking math.

### FRs in scope
FR-33 holdings, FR-34 buy/sell with FIFO + realized P&L, FR-35 valuation (unrealized + realized), FR-36 manual + auto price (CoinGecko crypto, equity provider TBD), FR-37 crypto specifics (8dp, USD→INR), FR-38 stock corporate actions, FR-39 holding transfer, FR-40 allocation, FR-41 net-worth inclusion.

### Reports built
R20 (portfolio value over time), R21 (allocation donut by type + platform), R22 (gains overall + per holding), R23 (contributions vs value). Updates R11 net worth.

### Edge cases addressed
E30 (8dp + stale price badge + manual override wins), E31 (USD price + timestamped FX), E32 (stock split/bonus adjusts qty+cost-basis, no P&L), E33 (dividend → `income` linked to holding, not a sale), E34 (sell partial → FIFO lot reduction), E35 (move asset between platforms → `transfer`, no P&L), E36 (price API down → cached + "as of"), E37 (same asset on multi platforms → per-platform + combined view).

### Deliverables
- `/lib/holdings` — pure: `applyBuy`, `applySell` (FIFO), `applyCorporateAction`, `valueAt(price, fxRate)`.
- `/app/portfolio` — list + per-holding view + allocation.
- Price source abstraction: `PriceProvider` interface; manual provider always present; CoinGecko + chosen equity provider as plugins. Cache with `priceUpdatedAt`; stale → badge.
- FX rate store (timestamped); USD-priced rollups convert at the stored rate.
- Corporate actions: in-app log entry; quantity/cost adjusted without P&L event.
- R11 net worth now includes holdings at live (or last-known) value.

### Acceptance
- Buy 0.5 BTC at ₹50L, sell 0.2 BTC at ₹60L → FIFO realized P&L = `0.2 × (60L − 50L)` = ₹2L exactly (paise-precise).
- 1:2 stock split on a 100-qty holding → qty becomes 200, avg cost halves, no P&L change.
- Crypto move CoinDCX → wallet shows as `transfer`; no realized P&L; cost basis preserved.
- Net worth = cash + portfolio value + receivables − card − loans.

### Risks
- Price provider rate-limits → cache aggressively; manual must always work offline.

---

## P9 — Statement import + dedupe + classification suggestions
**Estimate:** 4–5 days · **Depends on:** P8 · **Security review:** **required** (parsing untrusted text + write to financial DB)

### Scope
Fast monthly catch-up. Paste/upload statement → review queue → confirm.

### FRs in scope
FR-26 paste/CSV import, FR-27 counterparty mapping learned over time, FR-28 hash-based dedupe, FR-29 classification suggestions.

### Edge cases addressed
E12 (duplicate from import + manual → hash dedupe + merge prompt), E16 (many tiny auto-debits → rule-based auto-confirm), E21 (UPI ambiguity → review queue).

### Deliverables
- `/lib/import/parsers/` — HDFC bank, HDFC/Kotak/Axis card statement parsers (text + CSV).
- `/lib/import/dedupe.ts` — `importHash(date, amountPaise, normalizedDesc)`; check against existing.
- `/lib/import/classify.ts` — heuristic + learned mapping: `INDMONEY` → investment, `CRED CLUB` → card_settlement, etc. (seed from PRD Appendix A).
- `/app/import` — paste box / file upload → draft txns in review queue with proposed flowType + classification + dedupe status.
- Counterparty mapping store: confirmed mappings persist; next time `S M ENTERPRISES` arrives, suggestion is auto-filled.
- Auto-confirm rule UI for high-volume repeats (e.g. daily ₹100 SIP).

### Acceptance
- Pasting a real HDFC statement parses each line; classification correct ≥ 80% on first run; ≥ 95% after one round of mappings.
- Importing a line that matches a manual entry shows merge prompt; never double-inserts.

### Risks
- Statement format drift across banks → keep parsers narrow and well-tested; add new format = add a parser, not modify existing.

---

## P10 — Full PWA: offline sync queue + conflict log + install + daily notification
**Estimate:** 3–4 days · **Depends on:** P9 · **Security review:** required (service worker is a high-trust surface)

### Scope
Habit-ready. App works fully offline; writes queue and replay; one daily nudge.

> **Use the `Plan` subagent first.** Sync conflict resolution is subtle.

### FRs in scope
FR-30 daily local notification, FR-31 streak indicator (lightweight), PWA-1 installable, PWA-2 offline-first, PWA-3 sync queue (Workbox), PWA-4 conflict resolution + log, PWA-5 Workbox caching, PWA-6 local notification, PWA-7 lean store + archive.

### Edge cases addressed
E20 (offline edit conflict → per-field last-write-wins + log).

### Deliverables
- Service worker via `next-pwa`/Workbox: app shell precache + runtime caching for read APIs (stale-while-revalidate for reports).
- IndexedDB stores (`/db/local`) mirror server schemas for: transactions, accounts, categories, receivables, splits, holdings.
- Sync queue: mutations recorded locally, replayed on connectivity. Idempotency keys per mutation.
- Conflict resolution: per-field LWW using `bookedAt`/version. Conflicts written to `/app/data-health` log.
- Install prompt; manifest + icons.
- Daily local notification at configurable time (Settings); permission flow.
- "Logged N days" streak indicator on dashboard.
- Archive policy: months older than M kept on server only; on-demand fetch.

### Acceptance
- Airplane mode: add 5 txns, edit one, delete one → all succeed locally. Reconnect → all replay; balances match online-only equivalent.
- Edit same txn on two devices offline → conflict surfaces in data-health log with both values + chosen winner.
- App installs to home screen; reload offline still works.
- Daily notification fires at the set time.

### Risks
- Service worker bugs are user-invisible until catastrophic → require `/verify` walkthrough on real device.

---

## P11 — Reporting suite completion + export/PDF
**Estimate:** 4–5 days · **Depends on:** P10 · **Security review:** not required

### Scope
All remaining reports + export.

### FRs in scope
(Reporting consolidation.)

### Reports built (any remaining from R1–R23)
R1 (today/this-week summary), R4 (category trend), R5 (50/30/20 need/want/save), R6 (subscription audit + last-used hint), R7 (merchant leaderboard), R16 (true savings rate), R17 (investment contributions over time), R18 (CSV + monthly PDF), R19 stub (digest model — full endpoint lands in P12).

### Deliverables
- Recharts components for trend/area/bar/donut consolidated under `/components/charts`.
- Subscription audit detector: heuristic over recurring spend categories; "last used" inferred from interaction or marked manually.
- Export: CSV for any report; print/PDF monthly summary via headless render.
- All reports honor pay-cycle vs calendar-month toggle + include/exclude pass-through toggle.

### Acceptance
- 50/30/20 tracking adds correctly: need + want + (save/debt) = 100% of income for the cycle (within paise tolerance).
- PDF monthly export visually matches the in-app month overview.
- CSV export round-trips: import the CSV back → no diffs (excluding ids).

---

## P12 — AI digest endpoint + MCP server + LifeEvent emission
**Estimate:** 3–4 days · **Depends on:** P11 · **Security review:** **required** (AI/MCP endpoints expose financial data)

### Scope
Ecosystem integration. The master AI can query finance safely; cross-domain events emit upstream.

### FRs in scope
R19 full implementation (`GET /api/digest?cycle=current`), §10.1 LifeEvent stream, §10.2 MCP server with read-only tools.

### Deliverables
- `GET /api/digest?cycle=current|<YYYY-MM>` → exact shape of PRD Appendix B sample object. Cached.
- LifeEvent emitter: every confirmed `Transaction` (and `liquidity_alert`, `digest`) writes a canonical event to a shared stream/collection. Source = `'finance'`.
- MCP server (read-only) exposing: `get_balance`, `get_budget_status`, `get_liquidity_forecast`, `list_open_receivables`, `get_portfolio`, `get_debt_payoff`, `get_month_digest`.
- Auth on all AI-facing endpoints; per-query scope check; default returns digests, not raw transactions.

### Acceptance
- Digest JSON for the current cycle matches expected structure; numbers reconcile against R2/R9/R11/R14.
- MCP server responds to each tool call with documented schema; `list_open_receivables` total = R14 total.
- Raw transactions never returned without explicit per-query authorization.

### Risks
- Leaking sensitive data through digest fields → schema each endpoint output and snapshot-test it; deny-by-default for new fields.

---

## Cross-cutting workstreams (run continuously, not phases)

| Stream | What | When |
|---|---|---|
| **Pure-function test coverage** | `/lib/money`, `/lib/flow`, `/lib/projection`, `/lib/recurring`, `/lib/receivables`, `/lib/holdings` ≥ 90% | Every phase |
| **`/code-review high`** | On every phase PR | Every phase |
| **`/security-review`** | P0, P1, P8 (if external API), P9, P10, P12 | As marked |
| **`/verify` PWA walkthrough** | Install, offline write, online sync, conflict log surface | P10 onward, every phase |
| **Performance budgets** | add-txn < 200 ms; 2yr report < 1 s; synthetic 2yr fixture | From P2 onward |
| **Data health view** | unreviewed imports, unmatched reimbursements, open receivables, stale holding prices | Build from P4; extend each phase |
| **Backup / export** | Full JSON export ships once; tested each phase | First in P0 (stub), full in P11 |

## Risk register (top items)

1. **Derived-balance drift** between client (IndexedDB) and server (Mongo) after offline sync. **Mitigation:** balances never stored as authority; replay recomputes deterministically; integration tests for sync replay.
2. **Receivable model corruption** when a linked transaction is edited or deleted. **Mitigation:** edit/delete cascades go through `/lib/receivables` invariant-checks; never raw DB writes from route handlers.
3. **FIFO math regressions on corporate actions / partial sells.** **Mitigation:** snapshot tests on a fixed lot ledger; property test that sum of realized + unrealized P&L is conserved across each action.
4. **Statement parser format drift.** **Mitigation:** narrow per-bank parsers; fixture each known format; new format = new parser, never edit an existing one.
5. **Service-worker bugs.** **Mitigation:** `/verify` on a real device every release; SW version bump on each merge; cache-bust strategy documented.

## What shipped (append per phase)

> Append a 2–4 line note per phase as it merges: what landed, anything deferred, links to test fixtures used.

### P8 — Investments & portfolio (crypto + stocks + mutual funds) (2026-05-31)
Pure logic in `/lib/holdings/`: `quantity.ts` builds an 8-decimal-place fixed-point layer (toMicroUnits/fromMicroUnits/qtyAdd/qtySub/qtyTimesPaise/qtyTimesRatio/paiseDivideRatio) so crypto arithmetic stays exact — `qtyAdd(0.1, 0.2) === 0.3`, and the PRD's acceptance value `0.2 × (60L − 50L)` lands on exactly **20_000_000 paise** with no float drift; `applyBuy` appends an integer-paise lot and re-sorts insertion-stably by date so a backfill buy with an earlier date slots into the right FIFO slot; `applySell` consumes lots in date order, partial-consumes the next-best lot, returns a per-lot consumption breakdown + total realizedPnL + proceeds, and throws `SellOverflowError` if requested qty exceeds the position (E34); `applyCorporateAction` runs N:M splits/bonuses — each lot's qty ×N/M, unit cost ×M/N, total basis conserved, **no P&L event** (E32); `applyTransfer` FIFO-carves lots into a "movedLots" patch with cost basis preserved (E35 — no P&L), and `mergeTransferredLots` consolidates into a destination holding sorted by date (E37); `valuation.ts` resolves the unit price in INR (override → INR currentPrice → USD × fxRate fallback per E31), flags stale prices older than 24h (E36), and surfaces `isInvestmentPartial` when no price is known so reports show cost-basis as the "no-price" placeholder; `buildPortfolioSnapshot` aggregates totals + byAssetType + byPlatform allocations with pct (sums to 1 within rounding). **39 new pure tests** (13 quantity, 10 buy/sell incl. the PRD acceptance, 4 corporate actions, 4 transfer, 8 valuation) — full suite **312/312 green**, typecheck clean.

Schema: `Holding` gained `corporateActions` (an append-only audit log of split/bonus events), `notes`, `isDeleted/deletedAt` for soft delete. Mongoose model picks up an `isDeleted` index. `flowDirectionCoherent` in transaction validate now lets `investment` be **either** direction so a sell can be `direction: in` (was forced to `out` previously — this would have rejected every sell). `Transaction` already had `holdingId`; we use it as the back-link from each buy/sell txn to its position.

Lifecycle `/lib/holdings/lifecycle.ts`:
- `createHolding` — refuses duplicates by symbol+platform (the E37 separate-platform rule still lets you create the same symbol on a different platform).
- `createBuy` — creates the `investment` outflow txn first, then `applyBuy`s the lot; rollback hard-deletes the orphan txn if the holding write fails (best-effort atomicity).
- `createSell` — runs `applySell` *before* persisting (so we 409 cleanly on overflow), then writes the `investment` inflow txn with proceeds + persists the reduced lots + bumped `realizedPnLPaise`.
- `recordCorporateAction` — applies the ratio, appends to `corporateActions` log, persists.
- `createTransfer` — carves source lots, **finds-or-creates** the destination holding (same symbol+assetType, different platform), merges lots there.
- `updatePrice` — sets `currentUnitPricePaise + priceUpdatedAt + priceSource` (and optional fxRate); manual always overrides any auto value (E30).
- `softDeleteHolding` — refuses to archive a position with `quantity > 0` (you must sell or transfer first).

R11 net worth updated (FR-41): `buildNetWorth` accepts a `holdings` parameter; when present it skips the `investment`-kind account ledger contribution (which double-counts buys) and uses `buildPortfolioSnapshot(holdings).totals.marketValuePaise` instead. Per-holding rows appear in `assets.perAccount` as `{accountId: holdingId, name: "SYMBOL (Platform)", kind: "investment"}`. `isInvestmentPartial` flips to **false** once holdings are wired, and `stalePriceCount` surfaces in the response for an "as of" warning on the dashboard tile (E36).

API: `/api/holdings` GET (enriched with valuation per row), POST (create); `/api/holdings/:id` GET (returns holding + valuation + corporateActions log + last 100 linked txns) + DELETE (soft archive, blocks on qty>0); `/api/holdings/:id/buy` POST, `/api/holdings/:id/sell` POST (409 on overflow), `/api/holdings/:id/corporate-action` POST, `/api/holdings/:id/transfer` POST, `/api/holdings/:id/price` PATCH; `/api/reports/portfolio` GET (R20/R21/R22, 30s cache).

UI: `/portfolio` page (`PortfolioScreen` + `CreateHoldingDialog`) — total value tile with unrealized/realized chips + stale-price warning + a **Recharts donut** for asset-type allocation, by-asset-type and by-platform chip strips with pct, per-holding cards with stale/no-price badges and click-through; new-holding dialog (asset type chips → symbol/name/platform → price currency). `/portfolio/[id]` page (`HoldingScreen` + 5 dialogs) — header with asset/platform/symbol/USD/stale chips, market-value + unrealized-PnL header, **action row (Buy / Sell / Update price / Transfer / Corp. action)** that disables Sell/Transfer when qty=0; FIFO lots table (date, qty, unit cost, basis); corporate-actions log; linked transactions list; archive button appears when qty=0. Dialogs: `BuyDialog` (date + quantity 8dp + unit-cost MoneyInput + payer account, live total preview), `SellDialog` (max-qty validation + receiver account + proceeds preview + warning button color), `PriceDialog` (manual override always available; surfaces FX-rate input when priceCurrency=USD), `TransferDialog` (different-platform validation + carve preview), `CorporateActionDialog` (split/bonus toggle + numerator/denominator + live "qty ×n/m, cost ×m/n, no P&L" explainer). AppShell nav: added **Portfolio** between Debts and Recurring.

Smoke against live Mongo (asOf 2026-05-31): created BTC@CoinDCX → buy 0.5 BTC @ ₹50L → sell 0.2 BTC @ ₹60L → response `realizedPnLPaise: 20_000_000, totalProceedsPaise: 120_000_000, newQuantity: 0.3` — **₹2L exact, matches PRD acceptance to the paise**; created TCS@Zerodha → buy 100 @ ₹2000 → 1:2 split → response `newQuantity: 200` with the lot now `qty: 200, unitCostPaise: 100_000`, `realizedPnLPaise: 0`, total basis 200 × 100000 = 20_000_000 paise (identical to pre-split 100 × 200000); split logged in `corporateActions` array; transferred 0.1 BTC CoinDCX → Wallet → created destination holding `BTC@Wallet` with carved lot `{date: 2026-01-01, quantity: 0.1, unitCostPaise: 500_000_000}` — same cost basis, no P&L event; updated prices to ₹65L/BTC and ₹1200/TCS-post-split → `/api/reports/portfolio` returned `{marketValuePaise: 21_900_000, costBasisPaise: 17_000_000, unrealizedPnLPaise: 4_900_000, realizedPnLPaise: 2_000_000, holdingCount: 3, stalePriceCount: 0}`; allocation crypto 89% / stock 11%; by-platform CoinDCX 59.4% / Wallet 29.7% / Zerodha 11.0%. `/api/reports/net-worth` returned `isInvestmentPartial: false, stalePriceCount: 0, assets.investmentPaise: 21_900_000` — holdings now feed net worth at live value. All 5 pages (/portfolio, /portfolio/:id ×2, /dashboard, /debts, /settings) return 200 authed.

**Deviations & risks:** Auto-price providers are out of scope for this phase; the `PriceProvider` interface is implicit in the lifecycle (manual updates always overwrite, source is recorded as "manual"|"auto") but no CoinGecko/equities provider is wired — `priceSource` and `priceUpdatedAt` fields exist so an auto plugin can be added later without breaking the audit trail. The contributions-vs-value series (R23) shows totals + per-holding cost vs market but the time-series chart (R23-strict) is deferred to P11's reporting pass when we backfill historical holding states from txn replay. Dividend tracking (E33) isn't modeled yet — the workaround for now is to log a manual `income` transaction tagged to the holding via the existing `holdingId` field on Transaction; per-holding dividend rollup lands with the rest of R23 in P11. USD-priced holdings store `currentUnitPricePaise` as a USD-base-unit-×100 value with `fxRateToInr` to convert at render time; the test exercises this path but the smoke didn't because we don't have a USD-priced holding seeded yet.

### P7 — Liquidity floor + cash-flow forecast + lend-safety (2026-05-30)
Pure logic in `/lib/projection/liquidity.ts`: `forecast` projects end-of-day balance for every day in [asOf, horizonEnd] by walking a sorted signed-paise flow list (out negative, in positive), flagging per-day `belowFloor` and `overdrawn` booleans, surfacing `minPaise/minDate`, `firstFloorBreachDate` (FR-24), and `firstOverdraftDate` (E15 — overdraft allowed but flagged); `lendSafetyCheck` re-runs the projection with an extra outflow on a proposed date and reports `wouldBreachFloor`, `wouldOverdraw`, `hypotheticalMinPaise`, and a `safeLendCeilingPaise = max(0, baselineMin − floor)` so the UI can answer "how much *can* I safely lend?" (FR-25); `burnDown` builds the salary-to-zero curve with an idealised linear target for R10. In `/lib/liquidity/assemble.ts`: `totalLiquidPaiseAt` sums asset-kind (bank/cash/wallet) balances via the existing `accountBalanceAt` ledger (negative balances clamped to 0 — overdrawn bank is "0 liquid + already breaching"); `buildScheduledFlows` expands every active recurring rule's occurrences in the window and DEDUPES against already-paid txns (greedy nearest-match within ±14 days for monthly, ±3 for weekly — mirrors the obligations engine so the same payment isn't double-counted), plus single-shot booked future txns; `nextPaydayFrom` / `priorPaydayFrom` resolve the pay-cycle anchor with month-end clamping (day 31 → Feb-28/29). `/lib/reports/cash-flow.ts` (R8): pure `cashFlow` aggregates per-flow-type inflow vs outflow + net, breaks out `trueIn/trueOut/netCashFlow` excluding `transfer`+`card_settlement` (neutral), and re-attributes SplitBill source spend so only the owner's portion counts as true spend (matches monthOverview/budgetVsActual semantics). **27 new tests** (15 liquidity, 4 cash-flow, 8 assemble) — full suite **273/273 green**, typecheck clean.

API: `/api/reports/liquidity-forecast` GET (asOf + horizon defaults to `nextPayday+1`; 30s cache) returns the full day-by-day curve plus a deduplicated flow stream + the per-account liquid breakdown + next-payday date — feeds R9; `/api/reports/cash-flow?year=&month=&mode=` GET (R8 with split-aware spend); `/api/reports/burn-down?asOf=` GET (R10 — anchors on `priorPaydayFrom(asOf)`, seeds with whatever income credit hit on payday); `/api/lend-safety?amountPaise=&date=` GET runs `lendSafetyCheck` against the current forecast and returns the hypothetical-min + breach booleans + safe-lend ceiling.

UI:
- `/settings` page — floor amount (MoneyInput, default ₹50k), payday day-of-month, calendar/pay-cycle toggle, reminder time. PATCH triggers a TanStack cache invalidation of `reports` so the dashboard updates immediately.
- Dashboard gains `LiquidityTile` (R9) above the net-worth tile: heading "Cash to next payday · asOf → nextPayday", starting → minimum balance with the day-of-min, status chip (`success` / `warning floor breach on YYYY-MM-DD` / `error overdraft on YYYY-MM-DD`), an inline warning Alert when below floor; a Recharts `LineChart` with a dashed red ReferenceLine at the floor and a soft-red `ReferenceArea` for the breach band; below the chart, a one-line "next scheduled flow" summary. Caption shows the deduplicated flow count.
- `AddTransactionForm` lend-safety integration — when `flowType: 'lending_out'` and `amountPaise > 0`, the form calls `useLendSafety(amountPaise)` (10s stale time, debounced by query key change). If the result is `wouldBreachFloor` or `wouldOverdraw`, a warning/error Alert appears showing `hypotheticalMinPaise` on `hypotheticalMinDate`, the floor, and the suggested safe-to-lend ceiling. When clear, a quiet success Alert confirms the projected min after the lend. The submit button isn't blocked — this is advisory per PRD §5.4 (FR-25 says "warn", not "prevent").
- AppShell nav: added **Settings**.

Smoke against live Mongo (today = 2026-05-30, payday=5th, floor=₹50k):
- `GET /api/settings` returned `{liquidityFloorPaise: 5000000, paydayDayOfMonth: 5, payCycleMode: "pay_cycle"}`.
- `GET /api/reports/liquidity-forecast` (no params) returned an 8-day window through 2026-06-06, starting cash ₹0 (bank ledger), min −₹35,000 on 2026-06-05 (the upcoming Dad ₹25k + AC EMI ₹10k both hit on payday before the salary credit lands), `firstFloorBreachDate = 2026-05-30` (today is already below floor), `firstOverdraftDate = 2026-06-05`. The flow stream correctly de-duped previously-recorded May obligations and only carried the unsettled future occurrences.
- `GET /api/lend-safety?amountPaise=500000` (₹5k) → wouldBreachFloor=true + wouldOverdraw=true + safeLendCeiling=0 (because baseline min was already negative). `?amountPaise=5000000` (₹50k) deepened the hypothetical min to −₹85,000.
- `GET /api/reports/cash-flow?year=2026&month=5&mode=pay_cycle` → trueIn ₹16,350, trueOut ₹55,200, net −₹38,850 across 22 transactions — transfer + card_settlement correctly excluded from the "true" rollup.
- `GET /api/reports/burn-down` → cycleStart 2026-05-05, cycleEnd 2026-06-04, totalDays 31, elapsed 26, totalOutflow ₹39,650 — curve traces the ledger.
- `PATCH /api/settings` `{liquidityFloorPaise: 2000000}` → next forecast reflected the new ₹20k floor with `firstFloorBreachDate: 2026-05-30` (still below). Restored to ₹50k.
- All 6 pages (/dashboard, /debts, /settings, /add, /splits, /lending) return 200 authed.

**Deviations & risks:** the `card_settlement` flow is treated as neutral for liquid-cash projection because the bank-leg outflow is already on the ledger; the card-leg is on a `credit_card` account (not in LIQUID_KINDS), so it doesn't double-count — but a single-leg `card_settlement` written with `direction: out` on the card account itself (the modeling quirk we hit during P6 smoke) won't reduce the projected card liability in this forecast. R8 reports it correctly as neutral; R9 ignores it. Lend-safety doesn't yet honour `dueModel: 'when_able'` — every lend is treated as a single outflow at the proposed date; refinement (estimated repayment cadence based on counterparty history) is a P12 polish. The forecast uses ledger balance for liquid cash, so an unrecorded inflow (cash on hand) won't show up — we may add an "unrecorded cash" manual override on `/settings` if it becomes a friction point.

### P6 — Debt accounts + amortization + payoff projection (2026-05-30)
Pure logic in `/lib/projection/`: `emiForLoan` (standard reducing-balance formula, paise-rounded), `amortizationSchedule` (closing balance lands exactly on 0 by collapsing rounding drift into the final payment; supports EMI override; verifies Σprincipal === starting principal and Σpayment === Σ(P+I) invariants per E22), `splitEmiPayment` (used by the txn lifecycle to split a debt_repayment into interest/principal portions based on current outstanding × rate/12; never produces negative principal even when payment < accrued interest), `projectPayoff` (month-by-month: accrue interest → pay contractual EMI on every live loan → apply surplus + freed-EMI cascade to the strategy's target loan; deterministic order: avalanche=highest rate first, snowball=smallest balance first, ties broken by original list order; runaway guard at 600 months), `comparePayoff` + `redirectProjection` (after debt-free, invests the freed monthly amount at a given annual return for N months via monthly compounding — matches the annuity-end FV formula within rounding), `loanOutstandingAt` (loan balance derived from `debt_repayment` txns where `debtAccountId === loan._id`; supports an `asOf` cutoff), `loanInterestTotalsInRange` for the "interest paid this period" tile. **27 projection tests + 4 net-worth tests + 3 EMI-calendar tests** — full suite **246/246 green**, typecheck clean.

Schema: `Transaction` gained `debtAccountId` + `interestPortionPaise` (Zod + Mongoose) with a sparse index on `debtAccountId`. `RecurringRule` gained `debtAccountId` so an EMI rule knows which loan it pays down — propagates to R13 rows. Validate enforces: `debtAccountId` only on `debt_repayment`, `acceptUnderpayment` only on `card_settlement`. `TxnLite` extended with `debtAccountId` + `interestPortionPaise` so pure compute can derive loan outstanding without DB access.

Lifecycle `/lib/loans/lifecycle.ts`:
- `createDebtRepayment` validates the loan account is `kind: 'loan'` + `classification: 'liability'`, computes current outstanding from the live txn list, caps the payment at outstanding + accrued so it never goes negative, splits principal/interest via the pure `splitEmiPayment` (or accepts an explicit `interestPortionPaise` override), and persists the txn with both portions. Refuses payments on already-closed loans with 409.
- `cardInFullCheck` is pure: given the card's owed balance and the proposed settlement amount, returns shortfall + isFull. The transactions POST route invokes it whenever a `card_settlement` targets a `credit_card` account, computing the card's *actually owed* balance via `accountBalanceAt` (liability ledger → flipped to positive paise) and throwing 409 with `{shortfallPaise, cardBalancePaise}` unless the caller passes `acceptUnderpayment: true`.

Reports:
- `lib/reports/net-worth.ts` (R11 partial): pure `buildNetWorth` joins accounts + transactions + receivables to compute assets (cash + investments + receivables outstanding) − liabilities (card balances + loan outstanding via `loanOutstandingAt`). Surfaces `isInvestmentPartial: true` until P8 ships holdings live values. Tested for: zero-debt happy path, multi-EMI loan reduction, cutoff-respecting projection at an as-of date (txns dated after asOf excluded), and receivable rollup with written_off + soft-deleted exclusion.
- `lib/reports/emi-calendar.ts` (R13): pure `buildEmiCalendar` takes computed obligations (already filtered to debt_repayment), buckets per YYYY-MM, attaches `debtAccountId` via a rule→loan map, returns totals + per-month rows sorted ascending. Tested for bucketing, non-debt skipping, and debt-account propagation.

API: `/api/accounts/[id]/schedule` GET (full contractual schedule + remaining-balance forward schedule estimated from EMI/outstanding/rate), `/api/accounts/[id]/outstanding` GET (raw outstanding + optional `?from=&to=` interest/principal totals for the dashboard tile), `/api/reports/net-worth` GET (30s cache), `/api/reports/payoff?surplusPerMonthPaise=&redirectAnnualReturnPct=&redirectHorizonMonths=` GET returning avalanche + snowball + recommendation + optional redirect projection, `/api/reports/emi-calendar?asOf=&horizonDays=180` GET (30s cache). `POST /api/transactions` now branches: `debt_repayment` with `debtAccountId` → `createDebtRepayment` (returns the txn + a `debtSplit` summary in the response); `card_settlement` → card-in-full guard (409 unless `acceptUnderpayment: true`).

UI: `/debts` page (`DebtsScreen` + `LoanScheduleCard`) — net-worth tile grid (8 buckets: cash / investments / receivables / cards / loans / assets total / liabilities total / net worth), payoff scenario builder (surplus slider 0–₹50k, avalanche/snowball toggle, side-by-side comparison alert that recommends the cheaper strategy by interest saved, per-loan payoff order, redirect-horizon + return sliders feeding the freed-EMI investing projection), per-loan amortization cards with paid-down progress bar and collapsible 60-row schedule preview (interest/principal/balance columns), EMI calendar section (first 6 months, status chips + cycle indices). Dashboard gains `NetWorthTile` (clickable to `/debts`) above the OwedToMeTile. `AddTransactionForm` extended: when `flowType: 'debt_repayment'`, presents a loan-account button row (you pick which loan this pays) — disables submit until one is picked; when `flowType: 'card_settlement'`, exposes an "allow partial settlement" switch that sets `acceptUnderpayment: true`. AppShell nav extended with **Debts**.

Smoke against live Mongo (seeded loans: Jumbo ₹5L @ 12% × 36mo / EMI ₹16,600; Personal ₹2L @ 18% × 24mo / EMI ₹9,980): `GET /api/accounts/jumbo/schedule` returned a 36-row schedule with first row {interest ₹5,000, principal ₹11,600, balance ₹4,88,400} and last row balance=0; net-worth showed liabilities.loan=₹7,00,000, isInvestmentPartial=true; payoff with ₹5k surplus + 12% return + 24mo horizon ran in <100ms, recommendation=`tied` (because Personal Loan is both highest-rate and smallest-balance — both strategies hit the same target first; both completed in 26 months); EMI auto-split test: POST `debt_repayment` ₹16,600 against Jumbo → response carried `debtSplit: {interestPortionPaise: 500000, principalPortionPaise: 1160000, outstandingBefore: 50000000, outstandingAfter: 48840000}`; subsequent net-worth dropped loan outstanding to ₹6,88,400 (Δ matches the principal portion exactly). Card-in-full guard: spend ₹10,000 on HDFC Card → attempt to settle with ₹4,000 → 409 with `{shortfallPaise: 600000, cardBalancePaise: 1000000}`; retry with `acceptUnderpayment=true` → 201. All P6 pages (/debts, /dashboard, /add, /accounts, /splits, /lending) return 200 authed.

**Deviations & risks:** Accounts have no PATCH route yet — loan parameters (`openingBalancePaise`, `interestRatePA`, `tenureMonths`, `emiAmountPaise`) were seeded directly into Mongo via `scripts/p6_loan_seed.mjs` for the smoke test; building a settings/loan-edit UI is queued as a follow-up. The card-in-full guard reads the card balance from txn ledger at request time (the credit-card account's `openingBalancePaise + Σ debits − Σ credits`); for cards that store their own statement-due as authoritative this might diverge from what the issuer's statement shows — fine for the single-owner case but flagged for P9 (statement import) to surface official statement balance. Net worth investments use account balance (not live market value) — explicitly flagged with `isInvestmentPartial: true` until P8 wires holdings. Payoff cascade math assumes EMI is paid in full every month; for "I skipped an EMI" we rely on the obligations engine + arrears bucket from P3 to surface the problem in the dashboard before payoff projection compounds the error.

### P5 — Splits + reimbursement matching + turf template (2026-05-30)
Pure logic in `/lib/splits/`: `equalShares` distributes paise remainder to early shares so the rupee sum stays exact; `turfShares` reuses it for the ₹1,500/player template; `validateShares` enforces ownShare + Σ participant.share === totalPaise with negative/non-integer rejection; `proposeEqualParticipants` builds an equal-split draft (`includeOwner` toggle for rent-style reimbursements); `deriveParticipantStatus`/`deriveBillStatus` compute open/partial/settled from settledPaise vs sharePaise; `proposeMatch` ranks open split_iou receivables for a counterparty by largest outstanding, ties broken by earliest dateIncurred — naturally handles E9 (cross-period reimbursement: receivable persists across months). E10 (some never pay) reuses the P4 receivable write-off path, which already emits a compensating spend draft tied via receivableId. **35 new split tests** (`compute-shares`, `derive-status`, `match-reimbursement`) + **5 new R15 tests** + **4 new balances tests** + **1 new month-overview test** — full suite **211/211 green**. `TxnLite` extended with `splitId` + `splitOwnSharePaise`; `flowTotals`, `spendTotal`, `monthOverview`, and `budgetVsActual` re-attribute split-bill source spend so only the owner's share counts as spend and the rest as `lending_out` exposure (balances stay −fullPaid because the bank actually moved that much). Schema: SplitBill gained `isDeleted/deletedAt/editHistory` with index; Zod merged `softDeleteFields`. Lifecycle `/lib/splits/lifecycle.ts`: `convertSpendToSplitBill` creates N receivables and the bill in best-effort atomic pair, rollback hard-deletes orphans; `createTurfBill` is a one-tap wrapper (creates the source spend, then converts); `writeOffParticipant` calls the receivable write-off and marks the bill participant settled + recomputes bill status; `recomputeBillStatus` re-derives every participant's settled/status by joining receivable + repayments (called from `POST /api/transactions` after every successful split-IOU reimbursement and from `DELETE` cascade); `proposeMatchForCounterparty` + `previewReimbursement` for UI/import use; cascade-on-delete soft-deletes the bill + all linked split_iou receivables when the source spend is deleted, hard-blocks deletion when live reimbursements exist (config 409 with explicit "delete repayments first" message). API: `/api/split-bills` GET/POST, `/api/split-bills/:id` GET (joined participants with computed outstanding + receivableStatus, written_off rows surface as outstanding=0), `/api/split-bills/turf` POST, `/api/split-bills/:id/participants/:counterpartyId/write-off` POST, `/api/receivables/match-proposal?counterpartyId=…` GET, `/api/reports/splits` GET with 30s cache (R15: bills bucketed open/partial/settled with totals + outstanding, turf detection via case-insensitive description match). `POST /api/transactions` now invokes `recomputeBillStatus` whenever a repayment targets a split-linked receivable; `DELETE /api/transactions/:id` extended for splitId cascade + propagation. UI: `/splits` list (R15 totals tile + status toggle group + per-bill cards with progress bar / outstanding / turf chip), `/splits/[id]` (per-participant cards with status chip, age chip, "Mark paid" → opens the existing `AddRepaymentDialog` scoped to that participant's receivable, "Write off" with inline confirmation), `app/(app)/splits/TurfQuickAdd` (₹1,500/player default, friend/roommate chip-picker, includeOwner switch, live preview of total + IOU recipients). `components/TransactionRow` gained a `bill split` chip and a `Split with others (bill split)` menu item that's disabled for non-spend / already-split / split-child rows; `SplitBillDialog` in `app/(app)/accounts/[id]` picks participants by chip, propagates equal-split via `proposeEqualParticipants`, supports unequal overrides per row, runs a live sum-check, surfaces validation errors with the precise message from `validateShares`. AppShell nav extended with Splits. Smoke verified against live Mongo: ₹1,200 dinner split 4 ways (owner ₹300 + 3 friends) → bill OK with status=open outstanding=₹900; partial reimbursement ₹150 from Augustine → bill status=partial Augustine.outstanding=₹150; full reimbursement ₹300 from Devanand → receivable closed, bill still partial; write-off Sarathchandran's ₹300 → status=written_off, compensating spend ₹300 created with receivableId back-link, bill detail surfaces outstanding=0 for written_off participants; match-proposal for Augustine correctly returned the ₹150 outstanding IOU; turf quick-add (₹1,500 × 4) created ₹6,000 source spend + 3 IOUs + bill in one POST; R15 marked the turf bill `isTurf=true` via description regex; cascade-delete of source spend on a no-repayment bill soft-deleted bill + 3 linked receivables (verified by their absence from list endpoints); cascade-delete on a bill with live reimbursements was rejected 409 with the expected message. Month overview correctly reattributed the dinner: spend dropped 280000 → 190000 (−₹900) and lending_out grew 580000 → 670000 (+₹900); all 4 pages (/splits, /splits/:id, /lending, /dashboard, /add) return 200 authed. **Deviations & risks:** atomicity is best-effort across the create-bill flow (acceptable on standalone mongod; replica-set sessions deferred to a P10 hardening pass); turf detection is description-regex only (`\bturf\b`) — could grow into a `template` field on SplitBill if more templates land; reimbursement match-proposal is read-only — the existing `AddRepaymentDialog` is the actual UX entry point, so importer-driven auto-matching lands with P9.

### P4 — Unified receivables (cash loans + GPay split IOUs) (2026-05-30)
Pure logic in `/lib/receivables/`: `applyRepayment` + `recomputeReceivableState` (E6 same-day close, E7 multi-partial transition, E27 cross-period, E28 overpayment surface — never silently absorbs); `computeOutstanding` (ignores soft-deleted repayments); `ageBucket` (E26 pay-when-able short-circuits regardless of age); `groupByCounterparty` + `summarizeExposure` (R14 totals reconcile: outstanding == Σ per-counterparty == Σ buckets); `writeOff` returns a compensating spend draft linked via `receivableId`. 34 new tests; full suite **167/167 green**. Schema: added `isDeleted/deletedAt/editHistory` to Receivable (Zod + Mongoose, indexed). `TxnLite` gained `receivableId` and `counterpartyId`. `lib/receivables/lifecycle.ts` orchestrates: `createLendingOutWithReceivable` (best-effort atomicity — txn first, receivable second, hard-delete orphan txn on rollback), `applyRepaymentToReceivable` (cross-validates `cash_loan↔lending_repaid` vs `split_iou↔reimbursement_in`, throws 409 with `overpaymentPaise` details when over-repaying without `acceptOverpayment`), `cascadeOnTxnDelete` (hard-blocks lending_out deletion when live repayments exist; cleanly soft-deletes the receivable when parent deleted alone; reopens status when repayments are removed). Validate: lending_out requires counterpartyId+dueModel; expectedReturnDate only with on_date; lending_repaid/reimbursement_in require receivableId; receivableId forbidden on lending_out. API: `/api/receivables` GET (tolerant `isDeleted: {$ne:true}` filter so older docs missing the field still appear), `/api/receivables/:id` GET with joined repayments, `/api/receivables/exposure` GET (30s cache header) with per-counterparty + age bucket rollups, `/api/receivables/by-counterparty/:id` GET, `/api/receivables/:id/write-off` POST (counterparty's `defaultCategoryId` as fallback, else categoryId unset). Wired `POST /api/transactions` to lifecycle on lending_out and lending_repaid/reimbursement_in; `DELETE /api/transactions/:id` runs `cascadeOnTxnDelete` (replaces the P1 "cascade in P4" stub); PATCH allowlist for receivable-linked txns includes description/notes/valueDate/categoryId — amount edits routed via delete+recreate for P4. UI: `components/AgeBucketChip`, `components/ReceivableCard` (status chip + age chip + advance chip + progress bar + per-card "Add repayment"/"Write off" CTAs), `components/DueModelSelector` (Pay-when-able / By a date / No expectation chips); `/lending` (R14 summary tile + per-counterparty cards grouped by total owed, with kind/age sub-chips), `/lending/[counterpartyId]` (per-person screen splitting Open/Closed/Written-off lists), `AddRepaymentDialog` (pre-fills outstanding, inline amber overpayment warning + checkbox required to record as advance, picks flowType from `receivable.kind`), `WriteOffDialog`. `AddTransactionForm` extended: when `flowType: 'lending_out'`, surfaces `DueModelSelector` + conditional expectedReturnDate input + reminderOptIn toggle; rejects manual `lending_repaid`/`reimbursement_in` (those go through the Add Repayment dialog). Dashboard gains a clickable `OwedToMeTile` between obligations and month overview. Nav extended (Dashboard/Accounts/Add/Lending/Recurring/Budgets/Debug). Smoke verified against live Mongo: lent ₹2k to Devanand pay-when-able → receivable created → partial repay ₹800 → status=partial outstanding=₹1.2k → final repay ₹1.2k → closed; overpayment test (lend ₹500, repay ₹700) → 409 without flag, accepted with `acceptOverpayment=true` → status=closed `overpaymentPaise=20000`; write-off test (lend ₹300 → POST /write-off) → status=written_off, compensating spend ₹300 created with `receivableId` back-link. Per-counterparty endpoint for Devanand correctly returned 2 closed + 1 written-off. All four pages (/dashboard, /lending, /lending/[id], /add) return 200 authed. **Deviations & risks:** amount edits on receivable-linked transactions are routed via delete+recreate rather than full cascade (lower priority, well-documented in the 409 message); receivable creation uses best-effort atomicity rather than Mongoose sessions per Q1 (works on standalone mongod, safe on Atlas replica set); the soft-delete tolerance filter `{$ne: true}` is required for legacy docs created before the schema added `isDeleted`.

### P3 — Recurring rules + arrears + obligation reminders (2026-05-30)
Pure engine `/lib/recurring/engine.ts`: `expectedOccurrences` (monthly with day-clamp for 31→Feb-28, weekly stepping, endDate cap), `computeObligations` (bucketed upcoming/arrears/paid; per-frequency tolerance window ±14d monthly / ±3d weekly; greedy nearest-match consumption so a single txn pays at most one occurrence; `cycleIndex/totalCycles` for fixed-end rules per E3). `arrearsPolicy: 'accumulate'` produces overdue rows; `'skip'` silently classifies them paid-as-skipped (E2). 17 new tests; full suite **133/133 green**. Backend: `/api/recurring` GET/POST + `/api/recurring/:id` PATCH/DELETE (DELETE = soft via status='ended', preserving transaction back-links), `/api/obligations` GET with `?asOf=&horizonDays=` defaulting to IST today + 30. `TxnLite` and `transactionCreateInput` extended with `recurringRuleId`. UI: `/recurring` (rules list with status chips, pause/resume/end menu; `NewRuleDialog` with label, account/counterparty/category pickers, flow-type chips, monthly day-of-month or weekly toggle, start/end dates, accumulate switch); dashboard now leads with `ObligationsCard` (red banner totaling arrears, per-row "Mark paid" CTA that POSTs a back-linked transaction with the rule's defaults pre-filled and the value-date set to the expected date for overdue items). Nav extended (Dashboard/Accounts/Add/Recurring/Budgets/Debug). Smoke verified against live Mongo: created "Dad support" rule (₹25k monthly day-5, start 2026-01-05); GET /api/obligations returned 5 overdue (Jan–May) + 1 upcoming (Jun 5); marked April paid → arrears dropped to 4 and paid bucket gained April 5 → txn-id round-trip. **Deferred:** autoGenerate materialization (pre-creating `needs_review` rows) is parked — derive-on-read is cleaner and avoids polluting reports with unconfirmed amounts. **Risk:** for very long-lived rules with many missed cycles, the arrears list can be huge; UI doesn't paginate yet (defer until the first user hits it).

### P2 — Categories, budgets, month dashboard (2026-05-30)
Pure-logic core: `/lib/reports/period.ts` (calendar + pay-cycle with month-end clamping for anchorDay 31; `periodForDate` + `shiftPeriod` + `isInPeriod` helpers), `/lib/reports/month-overview.ts` (R2 with need/want/unclassified spend breakdown and split-parent exclusion), `/lib/reports/budget-vs-actual.ts` (R3 with budgeted vs actual + variance + over/under/at status, unbudgeted-activity list, rollover flag preserved). 26 new tests for the pure layer; full suite **116/116 green**. Backend: `/api/settings` GET/PATCH (singleton with `key: "default"` and upsert), `/api/budgets` GET/POST (upsert by `categoryId+month`) plus `/api/budgets/:id` DELETE, `/api/reports/month-overview` and `/api/reports/budget-vs-actual` taking `year/month/mode` with the user's Setting as default. UI: `(app)/dashboard` (period selector chevrons + calendar/pay-cycle toggle, R2 big-buckets grid with need/want summary line + `cardSettlement` "excluded from spend" hint, R3 per-category rows with progress bar / variance chip / rollover badge / unbudgeted activity list), `(app)/budgets` (per-category inline MoneyInput with on-blur upsert + rollover checkbox + delete). Top nav extended (Dashboard/Accounts/Add/Budgets/Debug); home tiles updated. Smoke verified against live local Mongo: sign-in, /api/settings, month-overview returned May 2026 cycle (2026-05-05 → 2026-06-04) with the user's existing 2 transactions (₹500 spend + ₹10k income), budget upsert + list round-trip, all 4 protected pages return 200 with the auth cookie. **Deferred:** rollover *computation* (carry-over from prior period variance) — flag is stored and surfaced; the actual carry math lands in P7 alongside the liquidity forecast. Per-category default-flow filter on Budgets page lists spend/fee/unclassified categories only.

### P1 — Manual transaction CRUD + flowType + accounts + balances (2026-05-30)
Pure-logic core landed: `/lib/balances` (flow-rules, filters, compute) + `/lib/transactions` (validate, mutations) with 53 new tests covering E1, E4, E13, E17, E18, E19, E23 and the paired-leg sum-to-zero property. Test suite: **90/90 green**. Backend: 7 auth-gated API routes (`accounts`, `accounts/:id`, `transactions` GET/POST, `transactions/:id` GET/PATCH/DELETE with cascade rules, `transactions/:id/split`, `transactions/transfer` two-leg with `reimbursesTransactionId` back-link), plus `counterparties` and `categories` GET. UI: `(app)` route group with auth-gated layout + top nav; pages `/accounts` (list with derived balances), `/accounts/[id]` (drill-in with `TransactionRow` + `EditDialog` + `SplitDialog` live sum-check), `/add` (amount-first form with `FlowTypeSelector`, `NeedWantToggle`, `AccountPicker`, `CounterpartyPicker`, `CategoryPicker`, last-used persistence). Shared components in `/components`. TanStack Query client + hooks in `/lib/api`. Smoke verified: auth gate redirects `/accounts`, `/add`, `/debug` → `/signin`; API endpoints return 401 without session. **Deviations:** `needWant` made optional at API (UI defaults to `want` on spend) per fast-logging principle (PRD §3); the integrated `/tests/api/*.spec.ts` suite deferred until Playwright lands. **Risks to revisit:** transfer `insertMany` not yet in a Mongo session (need replica set / Atlas); PATCH child-amount sum-check has a defensive null-conditional that's unreachable in practice — flag for `/code-review`.

### P0 — Foundation (2026-05-30)
Project scaffolded (Next.js 14.2.18 App Router, TS strict, ESLint+Prettier, Vitest+jsdom, coverage thresholds 90/90/85/90). `Money` value object shipped with 37 passing tests covering paise arithmetic, banker-rounded `mulRate`, `splitEqually`/`splitByShares` (exact-sum invariants for P5 turf splits), Indian-grouping format, parse round-trip. All 10 Zod schemas + 10 Mongoose models with indexes; `lib/db/mongo.ts` cached for serverless; NextAuth credentials provider with scrypt password hashing; MUI v5 theme + AppRouterCache + TanStack Query + SessionProvider wired; pages `/`, `/signin`, `/debug`; idempotent seed script for owner's accounts/counterparties/Appendix A categories; `hash-password` helper. Verified: `npm test` 37/37, `npm run typecheck` clean, dev server boots and serves `/` + `/signin`. **Deferred:** Playwright config (lands in a later phase when there's a flow to drive); `npm run seed` not run against a real Mongo yet (no `.env.local` provisioned). **Note:** npm reports Next 14.2.18 has a CVE — recommend bumping to latest 14.2.x patch before P1 begins (separate ticket).
