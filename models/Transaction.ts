import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { applyClientEntityIdIndex, syncFields } from "./syncFields";

const EditEntrySchema = new Schema(
  {
    at: { type: Date, required: true },
    field: { type: String, required: true },
    from: { type: Schema.Types.Mixed },
    to: { type: Schema.Types.Mixed },
  },
  { _id: false },
);

const TransactionSchema = new Schema(
  {
    valueDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    amountPaise: { type: Number, required: true, min: 1 },
    direction: { type: String, required: true, enum: ["out", "in"] },
    flowType: {
      type: String,
      required: true,
      enum: [
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
      ],
    },
    needWant: { type: String, enum: ["need", "want"] },
    categoryId: { type: Schema.Types.ObjectId, ref: "Category" },
    accountId: { type: Schema.Types.ObjectId, ref: "Account", required: true },
    counterpartyId: { type: Schema.Types.ObjectId, ref: "Counterparty" },
    source: {
      type: String,
      required: true,
      enum: ["manual", "import", "recurring", "split_child"],
      default: "manual",
    },
    description: { type: String, default: "", maxlength: 500 },
    notes: { type: String, maxlength: 2000 },
    parentTransactionId: { type: Schema.Types.ObjectId, ref: "Transaction" },
    receivableId: { type: Schema.Types.ObjectId, ref: "Receivable" },
    splitId: { type: Schema.Types.ObjectId, ref: "SplitBill" },
    holdingId: { type: Schema.Types.ObjectId, ref: "Holding" },
    debtAccountId: { type: Schema.Types.ObjectId, ref: "Account" },
    interestPortionPaise: { type: Number, min: 0 },
    reimbursesTransactionId: { type: Schema.Types.ObjectId, ref: "Transaction" },
    recurringRuleId: { type: Schema.Types.ObjectId, ref: "RecurringRule" },
    importBatchId: { type: Schema.Types.ObjectId },
    importHash: { type: String, maxlength: 128 },
    reviewStatus: {
      type: String,
      required: true,
      enum: ["confirmed", "needs_review"],
      default: "confirmed",
    },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    editHistory: { type: [EditEntrySchema], default: [] },
    ...syncFields,
  },
  { timestamps: true, collection: "transactions" },
);

applyClientEntityIdIndex(TransactionSchema);
TransactionSchema.index({ valueDate: -1, isDeleted: 1 });
TransactionSchema.index({ accountId: 1, valueDate: -1 });
TransactionSchema.index({ flowType: 1, valueDate: -1 });
TransactionSchema.index({ counterpartyId: 1, valueDate: -1 });
TransactionSchema.index({ importHash: 1 }, { sparse: true });
TransactionSchema.index({ receivableId: 1 }, { sparse: true });
TransactionSchema.index({ splitId: 1 }, { sparse: true });
TransactionSchema.index({ parentTransactionId: 1 }, { sparse: true });
TransactionSchema.index({ debtAccountId: 1 }, { sparse: true });

export type TransactionDoc = InferSchemaType<typeof TransactionSchema>;
export const TransactionModel: Model<TransactionDoc> =
  (mongoose.models.Transaction as Model<TransactionDoc>) ||
  mongoose.model<TransactionDoc>("Transaction", TransactionSchema);
