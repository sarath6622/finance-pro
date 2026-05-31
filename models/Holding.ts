import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const HoldingLotSchema = new Schema(
  {
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    quantity: { type: Number, required: true, min: 0 },
    unitCostPaise: { type: Number, required: true },
    txnId: { type: Schema.Types.ObjectId, ref: "Transaction" },
  },
  { _id: false },
);

const CorporateActionSchema = new Schema(
  {
    at: { type: Date, required: true },
    kind: { type: String, required: true, enum: ["split", "bonus"] },
    ratioNumerator: { type: Number, required: true, min: 1 },
    ratioDenominator: { type: Number, required: true, min: 1 },
    notes: { type: String, maxlength: 500 },
  },
  { _id: false },
);

const HoldingSchema = new Schema(
  {
    assetType: { type: String, required: true, enum: ["crypto", "stock", "mutual_fund"] },
    symbol: { type: String, required: true, maxlength: 40 },
    name: { type: String, required: true, maxlength: 120 },
    platform: { type: String, required: true, maxlength: 80 },
    quantity: { type: Number, required: true, default: 0, min: 0 },
    lots: { type: [HoldingLotSchema], default: [] },
    currentUnitPricePaise: { type: Number },
    priceCurrency: { type: String, enum: ["INR", "USD"], default: "INR" },
    fxRateToInr: { type: Number, min: 0 },
    fxRateAt: { type: Date },
    priceUpdatedAt: { type: Date },
    priceSource: { type: String, enum: ["manual", "auto"], default: "manual" },
    realizedPnLPaise: { type: Number, default: 0 },
    corporateActions: { type: [CorporateActionSchema], default: [] },
    notes: { type: String, maxlength: 2000 },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  { timestamps: true, collection: "holdings" },
);

HoldingSchema.index({ assetType: 1, platform: 1 });
HoldingSchema.index({ symbol: 1, platform: 1 });
HoldingSchema.index({ isDeleted: 1 });

export type HoldingDoc = InferSchemaType<typeof HoldingSchema>;
export const HoldingModel: Model<HoldingDoc> =
  (mongoose.models.Holding as Model<HoldingDoc>) ||
  mongoose.model<HoldingDoc>("Holding", HoldingSchema);
