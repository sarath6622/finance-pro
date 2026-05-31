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

const ReceivableSchema = new Schema(
  {
    counterpartyId: { type: Schema.Types.ObjectId, ref: "Counterparty", required: true },
    kind: { type: String, required: true, enum: ["cash_loan", "split_iou"] },
    principalPaise: { type: Number, required: true, min: 1 },
    dateIncurred: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    accountId: { type: Schema.Types.ObjectId, ref: "Account" },
    repaymentTxnIds: { type: [Schema.Types.ObjectId], default: [] },
    status: {
      type: String,
      enum: ["open", "partial", "closed", "written_off"],
      default: "open",
    },
    dueModel: {
      type: String,
      enum: ["on_date", "when_able", "none"],
      default: "none",
    },
    expectedReturnDate: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
    reminderOptIn: { type: Boolean, default: false },
    splitId: { type: Schema.Types.ObjectId, ref: "SplitBill" },
    notes: { type: String, maxlength: 2000 },
    closedAt: { type: Date },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    editHistory: { type: [EditEntrySchema], default: [] },
    ...syncFields,
  },
  { timestamps: true, collection: "receivables" },
);

applyClientEntityIdIndex(ReceivableSchema);
ReceivableSchema.index({ counterpartyId: 1, status: 1, isDeleted: 1 });
ReceivableSchema.index({ status: 1, dateIncurred: 1 });
ReceivableSchema.index({ splitId: 1 }, { sparse: true });
ReceivableSchema.index({ isDeleted: 1 });

export type ReceivableDoc = InferSchemaType<typeof ReceivableSchema>;
export const ReceivableModel: Model<ReceivableDoc> =
  (mongoose.models.Receivable as Model<ReceivableDoc>) ||
  mongoose.model<ReceivableDoc>("Receivable", ReceivableSchema);
