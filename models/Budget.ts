import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { applyClientEntityIdIndex, syncFields } from "./syncFields";

const BudgetSchema = new Schema(
  {
    categoryId: { type: Schema.Types.ObjectId, ref: "Category", required: true },
    month: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ },
    amountPaise: { type: Number, required: true, min: 0 },
    rollover: { type: Boolean, default: false },
    ...syncFields,
  },
  { timestamps: true, collection: "budgets" },
);

applyClientEntityIdIndex(BudgetSchema);
BudgetSchema.index({ categoryId: 1, month: 1 }, { unique: true });
BudgetSchema.index({ month: 1 });

export type BudgetDoc = InferSchemaType<typeof BudgetSchema>;
export const BudgetModel: Model<BudgetDoc> =
  (mongoose.models.Budget as Model<BudgetDoc>) ||
  mongoose.model<BudgetDoc>("Budget", BudgetSchema);
