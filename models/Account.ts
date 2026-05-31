import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const AccountSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    kind: {
      type: String,
      required: true,
      enum: ["bank", "credit_card", "cash", "investment", "loan", "wallet"],
    },
    classification: { type: String, required: true, enum: ["asset", "liability"] },
    currency: { type: String, required: true, default: "INR", enum: ["INR"] },
    openingBalancePaise: { type: Number, required: true, default: 0 },
    openingDate: { type: Date },
    creditLimitPaise: { type: Number },
    statementDay: { type: Number, min: 1, max: 31 },
    dueDay: { type: Number, min: 1, max: 31 },
    interestRatePA: { type: Number, min: 0, max: 100 },
    tenureMonths: { type: Number, min: 1 },
    emiAmountPaise: { type: Number },
    institution: { type: String, maxlength: 100 },
    last4Label: {
      type: String,
      maxlength: 10,
      validate: {
        validator: (v: string) => !v || /^[A-Za-z0-9\-\.\s]{0,10}$/.test(v),
        message: "Use a masked label only — never full numbers (S1)",
      },
    },
    isActive: { type: Boolean, default: true },
    archivedAt: { type: Date },
  },
  { timestamps: true, collection: "accounts" },
);

AccountSchema.index({ isActive: 1, kind: 1 });

export type AccountDoc = InferSchemaType<typeof AccountSchema>;
export const AccountModel: Model<AccountDoc> =
  (mongoose.models.Account as Model<AccountDoc>) ||
  mongoose.model<AccountDoc>("Account", AccountSchema);
