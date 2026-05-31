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

const SplitParticipantSchema = new Schema(
  {
    counterpartyId: { type: Schema.Types.ObjectId, ref: "Counterparty", required: true },
    sharePaise: { type: Number, required: true, min: 0 },
    settledPaise: { type: Number, required: true, default: 0 },
    status: {
      type: String,
      enum: ["open", "partial", "settled"],
      default: "open",
    },
    dueModel: {
      type: String,
      enum: ["on_date", "when_able", "none"],
      default: "when_able",
    },
    receivableId: { type: Schema.Types.ObjectId, ref: "Receivable" },
  },
  { _id: false },
);

const SplitBillSchema = new Schema(
  {
    sourceTransactionId: { type: Schema.Types.ObjectId, ref: "Transaction", required: true },
    totalPaise: { type: Number, required: true, min: 1 },
    payerAccountId: { type: Schema.Types.ObjectId, ref: "Account", required: true },
    categoryId: { type: Schema.Types.ObjectId, ref: "Category" },
    participants: {
      type: [SplitParticipantSchema],
      required: true,
      validate: { validator: (v: unknown[]) => v.length >= 1, message: "at least 1 participant" },
    },
    ownSharePaise: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ["open", "partial", "settled"], default: "open" },
    notes: { type: String, maxlength: 2000 },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    editHistory: { type: [EditEntrySchema], default: [] },
    ...syncFields,
  },
  { timestamps: true, collection: "split_bills" },
);

applyClientEntityIdIndex(SplitBillSchema);
SplitBillSchema.index({ status: 1, createdAt: -1 });
SplitBillSchema.index({ "participants.counterpartyId": 1 });
SplitBillSchema.index({ isDeleted: 1 });

export type SplitBillDoc = InferSchemaType<typeof SplitBillSchema>;
export const SplitBillModel: Model<SplitBillDoc> =
  (mongoose.models.SplitBill as Model<SplitBillDoc>) ||
  mongoose.model<SplitBillDoc>("SplitBill", SplitBillSchema);
