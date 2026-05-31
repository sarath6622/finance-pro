import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const SettingSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: "default" },
    liquidityFloorPaise: { type: Number, required: true, default: 5000000 },
    reminderTime: { type: String, required: true, default: "21:00" },
    paydayDayOfMonth: { type: Number, required: true, default: 5, min: 1, max: 31 },
    baseCurrency: { type: String, required: true, enum: ["INR"], default: "INR" },
    payCycleMode: { type: String, enum: ["calendar", "pay_cycle"], default: "pay_cycle" },
    includePassthroughInReports: { type: Boolean, default: false },
  },
  { timestamps: true, collection: "settings" },
);

export type SettingDoc = InferSchemaType<typeof SettingSchema>;
export const SettingModel: Model<SettingDoc> =
  (mongoose.models.Setting as Model<SettingDoc>) ||
  mongoose.model<SettingDoc>("Setting", SettingSchema);
