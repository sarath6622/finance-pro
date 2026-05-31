import { z } from "zod";
import { expectedDirection } from "@/lib/balances/flow-rules";
import {
  dueModel,
  flowType,
  isoDate,
  isoDateTime,
  needWant,
  objectIdString,
  paiseAmount,
  reviewStatus,
  txnDirection,
  txnSource,
} from "@/lib/schemas/common";

const baseCreate = z.object({
  valueDate: isoDate,
  bookedAt: isoDateTime.optional(),
  amountPaise: paiseAmount.refine((n) => n > 0, "amountPaise must be > 0"),
  direction: txnDirection,
  flowType,
  needWant: needWant.optional(),
  categoryId: objectIdString.optional(),
  accountId: objectIdString,
  counterpartyId: objectIdString.optional(),
  recurringRuleId: objectIdString.optional(),
  receivableId: objectIdString.optional(),
  // Receivable-create-side fields, only when flowType === 'lending_out':
  dueModel: dueModel.optional(),
  expectedReturnDate: isoDate.optional(),
  reminderOptIn: z.boolean().optional(),
  // Overpayment confirmation on repayments:
  acceptOverpayment: z.boolean().optional(),
  // Debt EMI link (only when flowType === 'debt_repayment'):
  debtAccountId: objectIdString.optional(),
  // Card-in-full override (when flowType === 'card_settlement' and amount < balance):
  acceptUnderpayment: z.boolean().optional(),
  source: txnSource.optional(),
  description: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
  reviewStatus: reviewStatus.optional(),
});

const RECEIVABLE_REPAYMENT_FLOWS = new Set<z.infer<typeof flowType>>([
  "lending_repaid",
  "reimbursement_in",
]);

function flowDirectionCoherent(data: { flowType: z.infer<typeof flowType>; direction: z.infer<typeof txnDirection> }): boolean {
  const expected = expectedDirection(data.flowType);
  if (expected === "either") return true;
  return data.direction === expected;
}

export const transactionCreateInput = baseCreate
  .refine((d) => d.flowType !== "transfer", {
    message: "Use POST /api/transactions/transfer to create a transfer (two legs).",
    path: ["flowType"],
  })
  .refine(flowDirectionCoherent, {
    message: "direction does not match flowType (e.g., income=in, spend=out).",
    path: ["direction"],
  })
  .refine(
    (d) => d.flowType !== "lending_out" || !!d.counterpartyId,
    { message: "lending_out requires counterpartyId", path: ["counterpartyId"] },
  )
  .refine(
    (d) => d.flowType !== "lending_out" || !!d.dueModel,
    { message: "lending_out requires dueModel", path: ["dueModel"] },
  )
  .refine(
    (d) => d.flowType !== "lending_out" || !d.receivableId,
    {
      message: "receivableId is auto-created for lending_out — do not pass one",
      path: ["receivableId"],
    },
  )
  .refine(
    (d) => !d.dueModel || d.flowType === "lending_out",
    { message: "dueModel only valid on lending_out", path: ["dueModel"] },
  )
  .refine(
    (d) => !d.expectedReturnDate || d.dueModel === "on_date",
    {
      message: "expectedReturnDate requires dueModel='on_date'",
      path: ["expectedReturnDate"],
    },
  )
  .refine(
    (d) => !d.receivableId || RECEIVABLE_REPAYMENT_FLOWS.has(d.flowType),
    {
      message: "receivableId only allowed on lending_repaid or reimbursement_in",
      path: ["receivableId"],
    },
  )
  .refine(
    (d) => !RECEIVABLE_REPAYMENT_FLOWS.has(d.flowType) || !!d.receivableId,
    {
      message: "lending_repaid / reimbursement_in require receivableId",
      path: ["receivableId"],
    },
  )
  .refine(
    (d) => !d.debtAccountId || d.flowType === "debt_repayment",
    {
      message: "debtAccountId is only valid on debt_repayment",
      path: ["debtAccountId"],
    },
  )
  .refine(
    (d) => d.flowType !== "card_settlement" || d.acceptUnderpayment === undefined || d.acceptUnderpayment !== null,
    {
      message: "acceptUnderpayment must be boolean when supplied",
      path: ["acceptUnderpayment"],
    },
  );

export type TransactionCreateInput = z.infer<typeof transactionCreateInput>;

export const transactionPatchInput = z
  .object({
    valueDate: isoDate.optional(),
    bookedAt: isoDateTime.optional(),
    amountPaise: paiseAmount.refine((n) => n > 0, "amountPaise must be > 0").optional(),
    direction: txnDirection.optional(),
    flowType: flowType.optional(),
    needWant: needWant.optional(),
    categoryId: objectIdString.optional(),
    accountId: objectIdString.optional(),
    counterpartyId: objectIdString.optional(),
    description: z.string().max(500).optional(),
    notes: z.string().max(2000).optional(),
  })
  .refine(
    (d) => Object.values(d).some((v) => v !== undefined),
    "patch must include at least one field",
  )
  .refine(
    (d) => {
      if (d.flowType && d.direction) {
        return flowDirectionCoherent({ flowType: d.flowType, direction: d.direction });
      }
      return true;
    },
    { message: "direction does not match flowType", path: ["direction"] },
  );

export type TransactionPatchInput = z.infer<typeof transactionPatchInput>;

export const splitChildInput = z.object({
  amountPaise: paiseAmount.refine((n) => n > 0, "child amountPaise must be > 0"),
  flowType: flowType.refine((f) => f !== "transfer" && f !== "card_settlement", {
    message: "Split children cannot be transfer or card_settlement (use dedicated endpoints)",
  }),
  needWant: needWant.optional(),
  categoryId: objectIdString.optional(),
  counterpartyId: objectIdString.optional(),
  description: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
});

export const splitInput = z.object({
  children: z.array(splitChildInput).min(2, "split requires at least 2 children"),
});

export type SplitChildInput = z.infer<typeof splitChildInput>;
export type SplitInput = z.infer<typeof splitInput>;

export const transferInput = z
  .object({
    fromAccountId: objectIdString,
    toAccountId: objectIdString,
    amountPaise: paiseAmount.refine((n) => n > 0, "amountPaise must be > 0"),
    valueDate: isoDate,
    bookedAt: isoDateTime.optional(),
    description: z.string().max(500).optional(),
    notes: z.string().max(2000).optional(),
  })
  .refine((d) => d.fromAccountId !== d.toAccountId, {
    message: "fromAccountId and toAccountId must differ",
    path: ["toAccountId"],
  });

export type TransferInput = z.infer<typeof transferInput>;

export const listFilters = z.object({
  accountId: objectIdString.optional(),
  flowType: flowType.optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().optional(),
  includeDeleted: z.coerce.boolean().default(false),
});

export type ListFilters = z.infer<typeof listFilters>;
