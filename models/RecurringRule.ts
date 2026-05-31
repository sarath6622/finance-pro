import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const RecurringRuleSchema = new Schema(
  {
    label: { type: String, required: true, trim: true, maxlength: 100 },
    accountId: { type: Schema.Types.ObjectId, ref: "Account", required: true },
    counterpartyId: { type: Schema.Types.ObjectId, ref: "Counterparty" },
    categoryId: { type: Schema.Types.ObjectId, ref: "Category" },
    flowType: { type: String, required: true },
    amountPaise: { type: Number, required: true },
    frequency: { type: String, required: true, enum: ["monthly", "weekly", "custom"] },
    dayOfMonth: { type: Number, min: 1, max: 31 },
    startDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    endDate: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
    debtAccountId: { type: Schema.Types.ObjectId, ref: "Account" },
    autoGenerate: { type: Boolean, default: true },
    arrearsPolicy: { type: String, enum: ["accumulate", "skip"], default: "accumulate" },
    status: { type: String, enum: ["active", "paused", "ended"], default: "active" },
  },
  { timestamps: true, collection: "recurring_rules" },
);

RecurringRuleSchema.index({ status: 1, startDate: 1 });

export type RecurringRuleDoc = InferSchemaType<typeof RecurringRuleSchema>;
export const RecurringRuleModel: Model<RecurringRuleDoc> =
  (mongoose.models.RecurringRule as Model<RecurringRuleDoc>) ||
  mongoose.model<RecurringRuleDoc>("RecurringRule", RecurringRuleSchema);
