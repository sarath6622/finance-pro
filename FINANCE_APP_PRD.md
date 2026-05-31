# Personal Finance Tracker — Product Requirements Document (PRD)

| | |
|---|---|
| **Product** | Finance module of the personal "Life OS" ecosystem |
| **Owner** | Sarath S Kumar |
| **Status** | Draft v1.1 |
| **Last updated** | 30 May 2026 |
| **Related docs** | `PRD.md` (wellness tracker), `DELIVERY_PLAN.md` |
| **Platform** | PWA (installable, offline-first) |

---

## 1. Vision & Context

This is the **Finance** app in a planned ecosystem of standalone, single-purpose self-tracking apps (Fitness, Diet, Daily Routine, Finance, …). Each app owns its data but exposes a **normalized event stream** to a shared **master aggregation layer** so that a single AI assistant can reason across all domains ("given my spend, sleep, and training load this week, what's the right amount to invest / eat / spend?").

The Finance app's job is narrow and deep: let one person (the owner) **log money movements daily as a habit**, and turn that log into **honest insight** — separating real spending from the large volume of pass-through money (lending, splits, card settlements, transfers) that otherwise pollutes every off-the-shelf budgeting app.

### Why a custom app (the core problem)
Generic trackers treat every debit as "spending." The owner's real financial life breaks that assumption hard:
- A single ₹60,000 bank transfer was actually **₹25k recurring family support + ₹25k arrears + ₹10k informal AC EMI**.
- ~₹1 lakh/month flows out as **credit-card settlements** that must NOT be counted as spending (the underlying purchases are already logged).
- Tens of thousands move out as **interest-free loans to friends** and return days later — a receivable, not an expense.
- **Rent and turf** are paid in full by the owner then **partially reimbursed** by roommates/friends, often in a different week.

The app must model these as first-class concepts so reports reflect **economic reality**, not raw bank lines.

### Design principles
1. **Truthful accounting over raw transactions** — every entry carries an economic *flow type*, not just a sign.
2. **Daily-habit friendly** — logging today's money takes < 20 seconds; offline-first; one reminder a day.
3. **Edge-case complete** — the messy real cases (arrears, partial repayments, cross-period reimbursements, split single transactions) are handled, not ignored.
4. **Report-first** — the value is in the dashboards and projections, not the data entry.
5. **Ecosystem-ready** — clean, queryable, normalized data exposed to the master AI layer.
6. **Private by default** — financial data is the most sensitive in the ecosystem; never store raw card/account numbers.

---

## 2. Goals & Non-Goals

### Goals
- Capture all money movements (manual quick-add + statement import) with correct economic classification.
- Track multiple accounts (bank, 3 credit cards, cash, investment, loans) and their balances.
- Model recurring obligations (salary, Dad support, rent, SIP, EMIs) with arrears handling.
- Maintain a **lending ledger** (receivables) and a **splits ledger** with reimbursement matching.
- Track debts/EMIs with payoff projection (avalanche/snowball).
- Provide a **liquidity floor** guard and cash-flow forecast to next payday.
- Deliver rich reporting: budget vs actual, trends, net worth, savings rate, debt payoff, lending exposure.
- Expose a normalized read API + MCP server for the master AI ecosystem.

### Non-Goals (v1)
- No bank/card API aggregation (Account Aggregator / Plaid-style) — manual + paste/import only.
- No multi-user / shared households (single owner; roommates are *counterparties*, not users).
- No tax filing, no investment brokerage execution, no bill payment.
- No multi-currency in v1 (INR only; design leaves room — see §9).
- Not formal financial advice; projections are informational.

---

## 3. User & Usage Model

**Single user (owner).** Everyone else (Dad, roommates, friends, merchants, employer) is a **Counterparty**, never an app user.

**Primary daily flow:** open app → "Add" → pick a recent merchant/counterparty or type amount → category & flow type auto-suggested → save. Offline-capable. A daily push/local notification at a configurable time nudges logging.

**Secondary flows:** monthly statement import & review; reconciling lending repayments; reviewing dashboards; adjusting budgets.

---

## 4. Domain Model (the heart of the app)

### 4.1 Flow types (economic classification)
Every `Transaction` has exactly one `flowType`. This is what makes reporting honest.

| flowType | Meaning | Affects "spending"? | Affects net worth? |
|---|---|---|---|
| `spend` | Real consumption (food, fuel, subs, etc.) | **Yes** | ↓ |
| `income` | Salary, refunds, cashback, interest | No (it's income) | ↑ |
| `family_support` | Money to Dad (recurring + arrears) | Tracked separately | ↓ |
| `investment` | SIP / stocks / RD (asset move) | No | neutral (cash→asset) |
| `debt_repayment` | EMI / loan / card principal+interest | No (separate bucket) | ↑ (liability ↓) net of interest |
| `lending_out` | Money lent to a friend | No | neutral (cash→receivable) |
| `lending_repaid` | Repayment received on a loan given | No | neutral (receivable→cash) |
| `reimbursement_in` | Split/rent/roommate money received | Offsets prior spend | ↑ cash |
| `card_settlement` | Paying a credit-card bill | **No** (excluded) | neutral (cash↓, card liability↓) |
| `transfer` | Between own accounts | No | neutral |
| `fee` | Bank/GST/charges | Yes (a spend subtype) | ↓ |

`spend` carries a `need_want` sub-flag (`need` / `want`) for 50/30/20-style analysis.

### 4.2 Core entities

**Account** — anything that holds or owes money.
```
Account {
  _id, name, kind: 'bank'|'credit_card'|'cash'|'investment'|'loan'|'wallet',
  classification: 'asset'|'liability',
  currency: 'INR',
  openingBalance, currentBalance (derived),
  creditLimit?, statementDay?, dueDay?,          // for cards
  interestRatePA?, tenureMonths?, emiAmount?,    // for loans/card-EMIs
  institution, last4? (masked label only — never full numbers),
  isActive, archivedAt?
}
```
Seed for owner: HDFC Bank (bank), HDFC Card, Kotak Card, Axis Card, Cash, INDmoney (investment), Jumbo Loan, Personal Loan ...8012, plus per-EMI loan sub-accounts.

**Counterparty** — Dad, roommates (Devanand, Sarathchandran, Augustine), friends, merchants, employer.
```
Counterparty {
  _id, displayName, type: 'family'|'roommate'|'friend'|'merchant'|'employer'|'self'|'institution',
  aliases: [string],            // statement strings that map here (e.g. "S M ENTERPRISES")
  defaultCategory?, defaultFlowType?, notes
}
```

**Transaction** — the atomic record.
```
Transaction {
  _id, date (value date), bookedAt (timestamp),
  amount (paise, integer), direction: 'out'|'in',
  flowType, needWant?,
  categoryId, accountId, counterpartyId?,
  source: 'manual'|'import'|'recurring'|'split_child',
  description, notes,
  // linkage
  parentTransactionId?,         // for split-of-one-transaction (the ₹60k case)
  receivableId?,                 // links lending_out / lending_repaid / split repayment to a Receivable
  splitId?,                      // links to a SplitBill
  holdingId?,                    // links investment buy/sell to a Holding
  reimbursesTransactionId?,      // a reimbursement_in pointing at the original spend
  recurringRuleId?,
  // import/dedupe
  importBatchId?, importHash?,   // for duplicate detection
  reviewStatus: 'confirmed'|'needs_review',
  // soft-delete & audit
  isDeleted, deletedAt?, editHistory: [{at, field, from, to}]
}
```

**Category** — hierarchical, owner-tailored (see Appendix A).

**RecurringRule** — scheduled obligations.
```
RecurringRule {
  _id, label, accountId, counterpartyId?, categoryId, flowType,
  amount, frequency: 'monthly'|'weekly'|'custom',
  dayOfMonth?, startDate, endDate?,           // endDate for the 3-month AC EMI
  autoGenerate: bool,                          // create a pending txn each cycle
  arrearsPolicy: 'accumulate'|'skip',          // Dad = accumulate
  status: 'active'|'paused'|'ended'
}
```

**Receivable** — the unified "money owed *to* me" record. Covers BOTH formal cash loans AND informal split IOUs (the GPay-style "pay me back when you have money" case). Every receivable rolls up into one "owed to me" view regardless of how it arose.
```
Receivable {
  _id, counterpartyId, kind: 'cash_loan'|'split_iou',
  principalPaise, dateIncurred, accountId?,
  repayments: [transactionId],                 // each lending_repaid / reimbursement_in
  outstandingPaise (derived),
  status: 'open'|'partial'|'closed'|'written_off',
  dueModel: 'on_date'|'when_able'|'none',      // 'when_able' = GPay split, no fixed date
  expectedReturnDate?,                          // omitted when dueModel='when_able'
  reminderOptIn: bool,                          // gentle nudge list, off by default
  splitId?,                                     // set when kind='split_iou'
  notes
}
```
"Pay back when they have money" → `dueModel:'when_able'`, no due date, never auto-written-off, surfaced in an aging view so nothing is silently forgotten.

**SplitBill** — owner pays a bill in full (often via GPay), others owe shares.
```
SplitBill {
  _id, sourceTransactionId, totalPaise, payerAccountId, category,
  participants: [{ counterpartyId, sharePaise, settledPaise, status, dueModel }],
  ownSharePaise,                               // the part that is genuinely the owner's spend
  receivableIds: [Receivable],                 // one split_iou Receivable per unpaid participant
  status: 'open'|'partial'|'settled', notes
}
```
Each unsettled participant share generates a `split_iou` **Receivable**, so GPay splits and cash loans appear together in the "owed to me" report. Turf sessions and the "Story Box" group outing are SplitBills.

**Holding** — a tracked investment position (crypto, stock, or mutual fund).
```
Holding {
  _id, assetType: 'crypto'|'stock'|'mutual_fund',
  symbol, name, platform,                       // e.g. CoinDCX, Zerodha, INDmoney
  quantity (decimal, up to 8dp for crypto),
  lots: [{ date, quantity, unitCostPaise, txnId }],  // FIFO cost basis
  avgCostPaise (derived),
  currentUnitPricePaise, priceCurrency: 'INR'|'USD',
  priceUpdatedAt, priceSource: 'manual'|'auto',
  marketValuePaise (derived), unrealizedPnLPaise (derived),
  realizedPnLPaise, isActive
}
```
A `flowType:'investment'` Transaction that is a **buy** adds a lot and is a cash→asset move; a **sell** reduces lots (FIFO), moves asset→cash, and books realized P&L. Holdings feed net worth at live (or last-known) value. Crypto priced in USD is converted to INR for all rollups (see edge cases).

**DebtAccount projection** — derived amortization schedule per loan/EMI for payoff reports.

**Budget** — per category per month.
```
Budget { _id, categoryId, month (YYYY-MM), amount, rollover: bool }
```

**Setting** — liquidity floor (₹50,000 default), reminder time, payday, base currency, etc.

### 4.3 The "split one bank line into many" rule
A single bank/card transaction may represent multiple economic flows (the ₹60k = support + arrears + AC). The app supports **splitting one raw transaction into child transactions** whose amounts must sum to the parent. Parent is marked `isDeleted=false, source='import'` but excluded from totals (it becomes a container); children carry the real `flowType`s. This is distinct from a **SplitBill** (which is about *other people owing the owner*).

---

## 5. Functional Requirements

### 5.1 Logging
- **FR-1 Quick add**: amount-first entry; smart suggestions for counterparty, category, flowType from history (e.g. "S M Enterprises" → Daily Tea/Snacks / spend-want).
- **FR-2 Flow-type aware**: choosing a counterparty of type `family` defaults to `family_support`; `merchant` → `spend`; a known lending counterparty offers "lend" vs "repaid".
- **FR-3 Recent & favorites**: top merchants/counterparties surfaced for one-tap entry (daily tea, fuel, turf).
- **FR-4 Multi-flow split**: split a single entry into multiple children (§4.3).
- **FR-5 Edit/delete**: edits are soft (audit trail); deletes are soft; both recompute balances/budgets retroactively.
- **FR-6 Attachments (optional)**: photo of a receipt stored as a blob ref (no OCR in v1).

### 5.2 Accounts & balances
- **FR-7** Track running balance per account from openingBalance + transactions.
- **FR-8** Credit-card model: charges accrue to card liability; `card_settlement` from bank reduces both bank cash and card liability without counting as spend.
- **FR-9** Transfers between own accounts net to zero in all spend/income reports.

### 5.3 Recurring & obligations
- **FR-10** Generate upcoming obligations from `RecurringRule` (Dad ₹25k on the 5th, rent, SIP, EMIs, AC EMI with end date).
- **FR-11 Arrears**: if a `accumulate` recurring obligation isn't marked paid in its cycle, auto-create an **arrears item** carried to next cycle (the skipped-Dad scenario), and surface it prominently.
- **FR-12 Payday anchor**: the financial month is anchored to salary day (5th), configurable; reports can use calendar month or pay-cycle.

### 5.4 Receivables — lending & split IOUs ("money owed to me")
A single unified ledger for everything friends owe you, whether a deliberate cash loan or a leftover GPay split.
- **FR-13** Create a `Receivable` on any `lending_out` (cash loan) and one per unsettled participant on a SplitBill (split IOU).
- **FR-14 Repayment matching**: incoming money reduces a specific receivable; supports **partial** and **multiple** repayments; same-day lend-and-return collapses to closed.
- **FR-14b Pay-when-able**: receivables can have `dueModel:'when_able'` (no due date) — the GPay-split case where friends pay "when they have money." Never auto-written-off; always visible.
- **FR-15 Unified exposure & aging**: one report of total owed to you across loans + split IOUs, grouped by counterparty, with age buckets (0–30 / 30–90 / 90+ days) so nothing is forgotten.
- **FR-15b Per-person view**: tap a friend → everything they owe across all bills/loans, with optional one-tap reminder (opt-in, off by default).
- **FR-16 Write-off**: mark a receivable unrecoverable → reclassified as `spend` (gift) so net worth stays honest.
- **FR-16b Overpayment**: if a repayment exceeds outstanding, the excess is flagged (credit/advance) rather than silently absorbed.

### 5.5 Splits
- **FR-17** Convert a spend into a SplitBill (incl. a GPay-import paste); define participants & shares; the owner's own share stays `spend`, each other share becomes a `split_iou` Receivable.
- **FR-18 Reimbursement matching**: incoming money tags to a participant's share (full/partial); cross-period supported (split in month A, paid in month B).
- **FR-19 Turf template**: reusable split (₹1,500 / N players) for one-tap creation; unequal-share support for irregular splits.

### 5.6 Debt management
- **FR-20** Per-loan amortization schedule (rate, tenure, EMI).
- **FR-21 Payoff strategies**: compute avalanche (highest rate first) and snowball (smallest balance first) plans; show interest saved and debt-free date for a given monthly surplus.
- **FR-22 Card-in-full guard**: warn if a card is about to be paid below full statement balance.

### 5.7 Budgets & guards
- **FR-23** Monthly budget per category; variance vs actual; optional rollover.
- **FR-24 Liquidity floor**: configurable floor (₹50k); alert when projected balance before next payday will breach it (uses upcoming recurring + known obligations).
- **FR-25 Lend-safety check**: warn if a proposed `lending_out` would push projected balance below the floor.

### 5.8 Import
- **FR-26 Paste/upload import**: parse pasted statement text or CSV (HDFC/Kotak/Axis/bank formats) into draft transactions in a **review queue**.
- **FR-27 Counterparty mapping**: learn statement-string → counterparty/category mappings over time.
- **FR-28 Dedupe**: detect duplicates via `importHash` (date+amount+normalized-desc) and against manual entries; never double-insert.
- **FR-29 Classification suggestions**: pre-classify flowType (e.g. "CRED CLUB" → card_settlement, "INDMONEY" → investment, "OFFUS EMI" → debt_repayment) for the user to confirm.

### 5.9 Notifications & habit
- **FR-30** Daily local notification (configurable time) to log the day.
- **FR-31** Streak / "logged N days" habit indicator (lightweight, non-gamified).
- **FR-32** Obligation reminders (Dad due on 5th, EMI due dates, card due dates).

### 5.10 Investments & portfolio (crypto + stocks + mutual funds)
- **FR-33 Holdings**: track positions across platforms (e.g. crypto on CoinDCX, stocks on Zerodha, MFs on INDmoney) with quantity, FIFO lots, and cost basis.
- **FR-34 Buy/sell**: an `investment` buy adds a lot and links to the Holding; a sell reduces lots FIFO, books realized P&L, and returns cash to an account.
- **FR-35 Valuation**: market value = quantity × current price; show unrealized and realized P&L per holding and overall.
- **FR-36 Price updates**: two modes — (a) **manual** (always available, offline-friendly), and (b) optional **auto-refresh** via public market data (crypto via CoinGecko; Indian equities via a market-data provider). Prices are cached with `priceUpdatedAt`; auto prices are clearly marked "indicative."
- **FR-37 Crypto specifics**: fractional quantities (up to 8 dp); USD-priced assets converted to INR using a stored FX rate; support multiple wallets/exchanges per asset.
- **FR-38 Stock specifics**: NSE/BSE symbols; handle corporate actions — stock split/bonus (adjust quantity & cost basis), dividends (booked as `income`).
- **FR-39 Holding transfer**: moving an asset between platforms/wallets is a `transfer` (no P&L), not a sale.
- **FR-40 Allocation**: classify portfolio by asset type and platform for the allocation report.
- **FR-41 Net-worth inclusion**: live (or last-known) holding values feed net worth and the AI digest.
- *Non-goal:* no in-app trade execution and no buy/sell recommendations — tracking and reporting only.

---

## 6. Edge Cases (explicit requirement)

| # | Edge case | Required behavior |
|---|---|---|
| E1 | One transaction = multiple obligations (₹60k) | Split into child transactions summing to parent; parent excluded from totals. |
| E2 | Skipped recurring (Dad missed a month) | Auto-create arrears, carry forward, flag; double-payment month handled cleanly. |
| E3 | Recurring with fixed end (AC = 3 EMIs) | `endDate`; auto-stop after final cycle; show "X of 3". |
| E4 | Credit-card charge vs bill settlement | Charge = spend on card; settlement = `card_settlement`, excluded from spend; no double count. |
| E5 | Cashback / refund | `income` (or negative-spend against original category) — configurable per case. |
| E6 | Lend then repaid same day | Loan opens and closes; nets to zero; not spend/income. |
| E7 | Partial / multiple repayments | Loan stays `partial` until outstanding = 0. |
| E8 | Loan never repaid | Manual write-off → reclassified as `spend` (gift). |
| E9 | Reimbursement in a different month than spend | Cross-period link; spend stays in its month, reimbursement in its own; net view available. |
| E10 | Split where some never pay | Unsettled shares remain; can be written off to own spend. |
| E11 | Salary late / on a different day | Pay-cycle is date-anchored to the actual credit, not a fixed calendar assumption. |
| E12 | Duplicate from import + manual | Hash-based dedupe with a merge/ignore prompt. |
| E13 | Editing a historical transaction | Recompute downstream balances/budgets; keep audit history. |
| E14 | Deleting a transaction linked to a loan/split | Block or cascade-with-warning; never orphan a receivable. |
| E15 | Negative / overdraft balance | Allowed; flagged; floor alert escalates. |
| E16 | Many tiny auto-debits (daily ₹100 SIP) | Optional aggregation/grouping in reports; rule-based auto-confirm on import. |
| E17 | Paise rounding | Store integer paise; round only at display. |
| E18 | Self-transfer between own accounts | `transfer`; net-zero everywhere. |
| E19 | Timezone / value date vs booking date | Store both; reports use value date; entry uses device-local then normalized to IST. |
| E20 | Offline edit conflict | Last-write-wins per field with conflict log; see §8. |
| E21 | Statement string ambiguity (UPI to a person) | Lands in review queue; user resolves spend vs lending vs reimbursement. |
| E22 | Interest portion of an EMI | EMI split into principal (liability ↓) and interest (cost) for net-worth accuracy. |
| E23 | Mid-month app adoption / opening balances | Per-account openingBalance + opening date; reports respect it. |
| E24 | Future-dated / scheduled transactions | Supported as `pending`; excluded from actuals until confirmed. |
| E25 | Currency formatting (Indian grouping) | `₹` with lakh/crore grouping; configurable. |
| E26 | GPay split, friend pays "when able" | `dueModel:'when_able'`, no due date, never auto-written-off, always shown in aging. |
| E27 | Friend pays back part of a split, rest later | Receivable stays `partial`; multiple inbound payments allowed across periods. |
| E28 | Friend pays more than owed | Excess flagged as advance/credit, not silently absorbed. |
| E29 | Split IOU vs cash loan in one view | Both are `Receivable`s; unified "owed to me" report regardless of source. |
| E30 | Crypto fractional units & volatile/stale price | 8-dp quantity; price carries `priceUpdatedAt`; stale prices badged; manual override always wins. |
| E31 | Crypto priced in USD | Store USD price + FX rate; all rollups in INR; FX rate is itself timestamped. |
| E32 | Stock split / bonus | Adjust quantity and per-unit cost basis without creating P&L; log the action. |
| E33 | Dividend received | Booked as `income`, linked to the holding (not a sale). |
| E34 | Selling part of a position | FIFO lot reduction; realized P&L on the sold portion only. |
| E35 | Moving an asset between wallets/exchanges | `transfer` of the holding; no realized P&L. |
| E36 | Price API down / offline | Fall back to last-known cached price; never block; show "as of" time. |
| E37 | Same asset on multiple platforms | One logical Holding may aggregate, or keep per-platform with a combined view (configurable). |

---

## 7. Reporting & Analytics (explicit requirement)

All reports support a date range and a **pay-cycle vs calendar-month** toggle, and an **include/exclude pass-through** toggle.

### 7.1 Dashboards
- **R1 Today/This-week summary** — logged spend, remaining budget, floor headroom.
- **R2 Month overview** — the "big buckets": income, true spending (need/want), family support, debt repayment, investments, lending out, card settlements; plus normalized "typical month" view that strips flagged one-offs.
- **R3 Budget vs actual** — per category, variance, % of spend, over/under highlight.

### 7.2 Trends
- **R4 Category trend** — line/area over months (Recharts).
- **R5 Need vs Want vs Save/Debt** — 50/30/20 tracking.
- **R6 Subscription audit** — all recurring subs, total monthly bleed, last-used hint.
- **R7 Merchant/counterparty leaderboard** — top outflows.

### 7.3 Cash flow & forecast
- **R8 Cash-flow statement** — inflows, outflows, net, by period.
- **R9 Liquidity forecast** — projected balance to next payday using upcoming recurring + obligations; floor-breach early warning.
- **R10 Pay-cycle burn-down** — how the salary depletes across the cycle.

### 7.4 Net worth & debt
- **R11 Net worth over time** — assets − liabilities, where assets = cash + **investment holdings (live/last-known value)** + **receivables (loans + split IOUs)**, and liabilities = card balances + payable loans.
- **R12 Debt payoff projection** — avalanche & snowball, debt-free date, interest saved, with a "freed-EMI redirect" projection into investing.
- **R13 EMI calendar** — upcoming EMIs and due dates.

### 7.5 Receivables & splits ("owed to me")
- **R14 Receivables exposure** — total owed to you across cash loans + GPay split IOUs, grouped by counterparty, with aging buckets (0–30 / 30–90 / 90+ days) and a "pay-when-able" sub-list.
- **R15 Splits status** — open/partial/settled per bill; who still owes and how much; turf history.

### 7.6 Investments & portfolio
- **R20 Portfolio value over time** — total holdings value (crypto + stocks + MF), with "as of" price timestamps.
- **R21 Allocation** — breakdown by asset type and platform (donut), and crypto-vs-equity split.
- **R22 Gains** — unrealized and realized P&L overall and per holding; best/worst performers; cost basis vs market value.
- **R23 Contributions vs value** — money invested over time (the SIP/buy flow) against current value; data only, no advice.

### 7.7 Savings & investing
- **R16 True savings rate** — (income − true spend − family support − net debt interest) / income, with investments shown explicitly.
- **R17 Investment contributions** — SIP totals over time (data only; no advice).

### 7.8 Export & AI
- **R18 Export** — CSV and a print/PDF monthly report.
- **R19 AI summary endpoint** — a structured monthly digest object the master AI can consume (see §10).

---

## 8. PWA & Offline Requirements

- **PWA-1** Installable (manifest, icons, splash); standalone display.
- **PWA-2 Offline-first**: all reads/writes work offline against IndexedDB (`idb`); UI never blocks on network.
- **PWA-3 Sync queue**: mutations queued locally and replayed to the server when online (Workbox background sync).
- **PWA-4 Conflict resolution**: per-field last-write-wins using `bookedAt`/version; conflicts written to a log the user can review. Financial integrity rule: balances are always **derived**, never synced as a source of truth, so a replay recomputes deterministically.
- **PWA-5 Caching**: Workbox runtime caching for app shell + read APIs; stale-while-revalidate for reports.
- **PWA-6 Local notifications** for the daily logging reminder (with server push fallback where supported).
- **PWA-7 Data size**: keep on-device store lean; archive old months to server with on-demand fetch.

---

## 9. Architecture & Tech Stack

Aligned with the ecosystem's locked stack so the Finance app drops in beside the others.

- **Framework**: Next.js 14 (App Router), React Server Components where sensible.
- **DB**: MongoDB Atlas via Mongoose. Collections per §4.
- **Auth**: NextAuth.js (single-owner; still real auth — financial data).
- **UI**: MUI v5; charts via Recharts.
- **State**: Zustand (local UI/session), TanStack Query (server cache, optimistic updates).
- **Offline**: IndexedDB via `idb`; PWA via `next-pwa` / Workbox.
- **Deploy**: Vercel (app) + MongoDB Atlas (data).
- **Money**: store integer **paise**; a `Money` value-object utility for arithmetic & formatting (avoid float drift).
- **Validation**: shared Zod schemas for transactions/imports (reused client + server + import parser).
- **Time**: store ISO timestamps in UTC + `valueDate` (date-only, IST-normalized).

### Suggested module layout
```
/app            (routes: dashboard, add, accounts, lending, debts, reports, import, settings)
/lib/money      (paise math, formatting)
/lib/flow       (flowType rules, classification heuristics)
/lib/import     (statement parsers + dedupe + counterparty mapping)
/lib/recurring  (rule engine, arrears)
/lib/projection (amortization, payoff, liquidity forecast)
/models         (Mongoose schemas)
/db/local       (idb stores, sync queue)
/server/api     (route handlers; also the AI digest + MCP feed)
```

---

## 10. Ecosystem & AI Integration

### 10.1 Normalized event stream
Beyond its own rich schema, the Finance app emits **canonical events** to the master layer so the AI can reason cross-domain without parsing finance internals:
```
LifeEvent {
  source: 'finance',
  type: 'spend'|'income'|'investment'|'debt'|'obligation'|'liquidity_alert'|'digest',
  date, amountPaise?, category?, flowType?, tags: [],
  summary: string,           // human/AI-readable
  refId                      // back-reference into finance DB
}
```

### 10.2 Master query support
The master AI answers holistic questions ("what's the right amount to spend on a trip this month?") by combining the **finance digest** (liquidity headroom to next payday, floor, upcoming obligations, budget remaining) with other apps (fitness load, diet, routine). Finance exposes:
- **`GET /api/digest?cycle=current`** → structured object: income, committed obligations, discretionary remaining, floor headroom, lending exposure, debt status, savings rate.
- **MCP server** (read-only) exposing tools: `get_balance`, `get_budget_status`, `get_liquidity_forecast`, `list_open_receivables`, `get_portfolio`, `get_debt_payoff`, `get_month_digest`. This lets the ecosystem AI (or Claude) query finances safely.

### 10.3 Access & privacy
- Finance data is **scoped**; the master layer receives **digests/events**, not raw transactions, unless explicitly authorized per-query.
- No raw card/account numbers ever stored or emitted — only masked labels.
- All AI-facing endpoints are read-only and authenticated.

---

## 11. Security, Privacy & Integrity

- **S1** No full PAN/account numbers; store masked `last4` labels only.
- **S2** Auth required for all routes; session hardening via NextAuth.
- **S3** Data encrypted in transit (TLS) and at rest (Atlas encryption); consider field-level encryption for `notes`.
- **S4** Soft-delete + audit trail on all financial records; no hard deletes from UI.
- **S5** Balances are **derived**, never authoritative on the client — protects against sync tampering/drift.
- **S6** Import never auto-confirms money-moving classifications that change net worth (lending/write-off) — always user-confirmed.
- **S7** Backups: rely on Atlas automated backups; provide a full JSON export for user-owned offline backup.

---

## 12. Non-Functional Requirements
- **NFR-1 Performance**: add-transaction interaction < 200 ms locally; reports render < 1 s for a 2-year dataset.
- **NFR-2 Accessibility**: WCAG AA; full keyboard; large tap targets for daily mobile use.
- **NFR-3 Reliability**: offline writes never lost; deterministic recompute on replay.
- **NFR-4 Maintainability**: shared Zod/types; pure functions for money & projections (unit-tested).
- **NFR-5 Observability**: structured logs for import/sync; an in-app "data health" view (unreviewed imports, unmatched reimbursements, open receivables, stale holding prices).

---

## 13. Delivery Plan (phased)

| Phase | Scope | Outcome |
|---|---|---|
| **P0** | Project scaffold, stack wiring, auth, money utils, schemas, seed accounts/counterparties | Foundation |
| **P1** | Manual transaction CRUD + flowType + accounts + balances | Can log daily, offline |
| **P2** | Categories, budgets, basic month dashboard (R2/R3) | First insight |
| **P3** | Recurring rules + arrears + obligation reminders (Dad/rent/SIP/EMI) | Obligations automated |
| **P4** | Unified receivables: cash loans + GPay split IOUs, repayment matching, "pay-when-able", aging & per-person view (R14) | Everything owed to you tracked |
| **P5** | Splits + reimbursement matching + turf template (R15) | Pass-through solved |
| **P6** | Debt accounts + amortization + payoff projection (R11–R13) | Debt strategy |
| **P7** | Liquidity floor + cash-flow forecast + lend-safety (R8–R10) | Liquidity guardrails |
| **P8** | Investments & portfolio: holdings, buy/sell, FIFO, manual + auto prices, allocation & P&L (R20–R23) | Crypto + stocks + MF tracked |
| **P9** | Statement import + dedupe + classification suggestions (FR-26–29) | Fast monthly entry |
| **P10** | Full PWA: offline sync queue, conflict log, install, daily notification | Habit-ready |
| **P11** | Reporting suite completion + export/PDF (R1–R23) | Reporting capability |
| **P12** | AI digest endpoint + MCP server + LifeEvent emission (§10) | Ecosystem integration |

Each phase ships independently and is usable on its own.

---

## 14. Open Questions / Assumptions
- **A1** Base currency INR. Crypto often priced in USD → a lightweight FX layer is needed (stored, timestamped rate); full multi-currency for spending still deferred.
- **A2** No live bank APIs; import is paste/CSV. Revisit Account Aggregator later.
- **A3** Receipt OCR and auto-categorization-by-ML are future (v2).
- **A4** Investments ARE tracked as holdings with valuation (crypto + stocks + MF), not contribution-only. Prices via manual entry with optional public-API auto-refresh (CoinGecko for crypto; a market-data provider for equities). Auto prices are indicative.
- **Q1** Which exact price/FX providers and refresh cadence? (manual always works; auto is best-effort, rate-limit aware.)
- **Q2** Does the master AI get raw transactions on explicit consent, or only digests? (default: digests.)
- **Q3** Cash account discipline — how strictly to track physical cash? (optional, low priority.)
- **Q4** For an asset held on multiple platforms, aggregate into one Holding or keep per-platform with a combined view? (default: per-platform + combined view.)

---

## Appendix A — Category & Type Taxonomy (owner-tailored)

**Spend categories**: Dining & Eating Out · Daily Tea/Snacks · Groceries · Fuel · Subscriptions · Telecom · Insurance · Household & Shopping · Entertainment / Outings · Misc / People · Fees & Charges
**Non-spend categories**: Family Support (Dad) · Investment — SIP/MF · Investment — Stocks · Investment — Crypto · Credit Card Payment · Loan / Card EMI · Lending (cash loan) · Split IOU (owed to me) · Salary · Dividend / Interest · Reimbursement / Split · Self Transfer

**flowType ↔ default category** seeds (for import classification):
- `CRED CLUB`, `BBPS`, `BPPY CC PAYMENT` → `card_settlement` / Credit Card Payment
- `INDMONEY`, `INDSTOCKS` → `investment` / Investment (SIP)
- `OFFUS EMI`, `EMI`, `CC … AUTOPAY SI-TAD` → `debt_repayment` / Loan or Card EMI
- `SWIGGY`, `BUNDL`, `INSTAMART`, hotels/cafes → `spend` / Dining or Groceries
- fuel station names → `spend(need)` / Fuel
- `S M ENTERPRISES`, daily small repeats → `spend(want)` / Daily Tea/Snacks
- `CHANDAN KT` (Dad) → `family_support`
- roommate names → `reimbursement_in` (rent) / Reimbursement
- `BRIGHT SPORTS CENTRE`, turf → `spend` via SplitBill (turf template)

## Appendix B — Sample digest object (AI-facing)
```json
{
  "cycle": "2026-05",
  "incomePaise": 13243300,
  "committedObligationsPaise": 7000000,
  "discretionaryRemainingPaise": 2800000,
  "liquidityFloorPaise": 5000000,
  "projectedMinBalancePaise": 350,
  "floorBreachRisk": "high",
  "lendingOutstandingPaise": 2842100,
  "receivables": { "cashLoansPaise": 1500000, "splitIOUsPaise": 1342100, "payWhenAblePaise": 980000, "over90dPaise": 350000 },
  "portfolio": { "valuePaise": 0, "byType": { "crypto": 0, "stocks": 0, "mutual_fund": 0 }, "unrealizedPnLPaise": 0, "priceAsOf": null },
  "debt": { "totalOwedPaise": 17444200, "monthlyEmiPaise": 2745600, "nextPriority": "HDFC 17%" },
  "trueSavingsRate": 0.07,
  "notes": ["Dad arrears cleared this cycle", "balance hit floor on the 24th", "₹9.8k owed by friends, pay-when-able"]
}
```

---
*This document is tailored to the owner's real financial patterns observed as of May 2026. It is a build spec, not financial advice; projections are informational.*
