import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { applyClientEntityIdIndex, syncFields } from "./syncFields";

const CounterpartySchema = new Schema(
  {
    displayName: { type: String, required: true, trim: true, maxlength: 100 },
    type: {
      type: String,
      required: true,
      enum: ["family", "roommate", "friend", "merchant", "employer", "self", "institution"],
    },
    aliases: { type: [String], default: [] },
    defaultCategoryId: { type: Schema.Types.ObjectId, ref: "Category" },
    defaultFlowType: { type: String },
    notes: { type: String, maxlength: 1000 },
    isActive: { type: Boolean, default: true },
    archivedAt: { type: Date },
    ...syncFields,
  },
  { timestamps: true, collection: "counterparties" },
);

applyClientEntityIdIndex(CounterpartySchema);
CounterpartySchema.index({ displayName: 1 });
CounterpartySchema.index({ aliases: 1 });
CounterpartySchema.index({ isActive: 1 });

export type CounterpartyDoc = InferSchemaType<typeof CounterpartySchema>;
export const CounterpartyModel: Model<CounterpartyDoc> =
  (mongoose.models.Counterparty as Model<CounterpartyDoc>) ||
  mongoose.model<CounterpartyDoc>("Counterparty", CounterpartySchema);
