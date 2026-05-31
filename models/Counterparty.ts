import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

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
  },
  { timestamps: true, collection: "counterparties" },
);

CounterpartySchema.index({ displayName: 1 });
CounterpartySchema.index({ aliases: 1 });

export type CounterpartyDoc = InferSchemaType<typeof CounterpartySchema>;
export const CounterpartyModel: Model<CounterpartyDoc> =
  (mongoose.models.Counterparty as Model<CounterpartyDoc>) ||
  mongoose.model<CounterpartyDoc>("Counterparty", CounterpartySchema);
