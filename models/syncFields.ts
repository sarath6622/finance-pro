import type { Schema } from "mongoose";

export const syncFields = {
  version: { type: Number, default: 0 },
  bookedAt: { type: Date, default: () => new Date() },
  clientEntityId: { type: String },
} as const;

export const syncFieldsSingleton = {
  version: { type: Number, default: 0 },
  bookedAt: { type: Date, default: () => new Date() },
} as const;

export function applyClientEntityIdIndex(schema: Schema): void {
  schema.index(
    { clientEntityId: 1 },
    { unique: true, sparse: true, name: "clientEntityId_unique" },
  );
}
