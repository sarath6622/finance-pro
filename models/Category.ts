import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const CategorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    slug: { type: String, required: true, lowercase: true, match: /^[a-z0-9-]+$/, unique: true },
    parentId: { type: Schema.Types.ObjectId, ref: "Category" },
    defaultFlowType: { type: String },
    icon: { type: String, maxlength: 40 },
    color: { type: String, match: /^#[0-9a-fA-F]{6}$/ },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true, collection: "categories" },
);

CategorySchema.index({ parentId: 1, sortOrder: 1 });

export type CategoryDoc = InferSchemaType<typeof CategorySchema>;
export const CategoryModel: Model<CategoryDoc> =
  (mongoose.models.Category as Model<CategoryDoc>) ||
  mongoose.model<CategoryDoc>("Category", CategorySchema);
