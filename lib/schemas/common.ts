import { z } from "zod";

export const objectIdString = z
  .string()
  .regex(/^[a-f0-9]{24}$/i, "Expected 24-char hex ObjectId");

export const isoDateTime = z.string().datetime({ offset: true });
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const yyyyMm = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

export const paiseAmount = z
  .number()
  .int("amounts must be integer paise — no floats (CLAUDE.md invariant #1)")
  .finite();

export const currencyCode = z.literal("INR");

export const flowType = z.enum([
  "spend",
  "income",
  "family_support",
  "investment",
  "debt_repayment",
  "lending_out",
  "lending_repaid",
  "reimbursement_in",
  "card_settlement",
  "transfer",
  "fee",
]);
export type FlowType = z.infer<typeof flowType>;

export const needWant = z.enum(["need", "want"]);
export type NeedWant = z.infer<typeof needWant>;

export const accountKind = z.enum([
  "bank",
  "credit_card",
  "cash",
  "investment",
  "loan",
  "wallet",
]);
export type AccountKind = z.infer<typeof accountKind>;

export const accountClassification = z.enum(["asset", "liability"]);
export type AccountClassification = z.infer<typeof accountClassification>;

export const counterpartyType = z.enum([
  "family",
  "roommate",
  "friend",
  "merchant",
  "employer",
  "self",
  "institution",
]);
export type CounterpartyType = z.infer<typeof counterpartyType>;

export const txnDirection = z.enum(["out", "in"]);
export type TxnDirection = z.infer<typeof txnDirection>;

export const txnSource = z.enum(["manual", "import", "recurring", "split_child"]);
export type TxnSource = z.infer<typeof txnSource>;

export const reviewStatus = z.enum(["confirmed", "needs_review"]);
export type ReviewStatus = z.infer<typeof reviewStatus>;

export const editEntry = z.object({
  at: isoDateTime,
  field: z.string(),
  from: z.unknown(),
  to: z.unknown(),
});

export const softDeleteFields = z.object({
  isDeleted: z.boolean().default(false),
  deletedAt: isoDateTime.optional(),
  editHistory: z.array(editEntry).default([]),
});

export const clientEntityId = z.string().uuid();

export const syncFields = z.object({
  version: z.number().int().nonnegative().default(0),
  bookedAt: isoDateTime.default(() => new Date().toISOString()),
  clientEntityId: clientEntityId.optional(),
});

export const syncFieldsSingleton = z.object({
  version: z.number().int().nonnegative().default(0),
  bookedAt: isoDateTime.default(() => new Date().toISOString()),
});

export const recurringFrequency = z.enum(["monthly", "weekly", "custom"]);
export const arrearsPolicy = z.enum(["accumulate", "skip"]);
export const recurringStatus = z.enum(["active", "paused", "ended"]);

export const receivableKind = z.enum(["cash_loan", "split_iou"]);
export const receivableStatus = z.enum(["open", "partial", "closed", "written_off"]);
export const dueModel = z.enum(["on_date", "when_able", "none"]);

export const splitParticipantStatus = z.enum(["open", "partial", "settled"]);
export const splitBillStatus = z.enum(["open", "partial", "settled"]);

export const assetType = z.enum(["crypto", "stock", "mutual_fund"]);
export const priceCurrency = z.enum(["INR", "USD"]);
export const priceSource = z.enum(["manual", "auto"]);
