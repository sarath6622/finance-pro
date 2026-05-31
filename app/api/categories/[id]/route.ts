import { NextResponse, type NextRequest } from "next/server";
import { connectMongo } from "@/lib/db/mongo";
import { requireSession } from "@/lib/auth/session";
import { conflict, errorResponse, notFound, validation } from "@/lib/http/errors";
import { CategoryModel, TransactionModel } from "@/models";
import { categoryUpdateInput } from "@/lib/schemas/category-input";
import { isValidObjectId } from "mongoose";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireSession();
    if (!isValidObjectId(params.id)) throw notFound("Category not found");
    const body = await req.json();
    const input = categoryUpdateInput.parse(body);
    await connectMongo();

    const cat = await CategoryModel.findById(params.id);
    if (!cat) throw notFound("Category not found");

    if (input.slug && input.slug !== cat.slug) {
      const dupe = await CategoryModel.findOne({
        slug: input.slug,
        _id: { $ne: cat._id },
      }).lean();
      if (dupe) throw conflict(`Category slug "${input.slug}" already exists`);
    }

    for (const [k, v] of Object.entries(input)) {
      if (v === undefined) continue;
      (cat as unknown as Record<string, unknown>)[k] = v;
    }
    cat.version = (cat.version ?? 0) + 1;
    cat.bookedAt = new Date();
    await cat.save();
    return NextResponse.json({ _id: String(cat._id) });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireSession();
    if (!isValidObjectId(params.id)) throw notFound("Category not found");
    const restore = req.nextUrl.searchParams.get("restore") === "1";
    await connectMongo();

    const cat = await CategoryModel.findById(params.id);
    if (!cat) throw notFound("Category not found");

    if (restore) {
      cat.isActive = true;
    } else {
      if (cat.isActive === false) throw conflict("Category is already archived");
      const live = await TransactionModel.countDocuments({
        categoryId: cat._id,
        isDeleted: false,
      });
      if (live > 0) {
        throw validation(
          `Cannot archive — ${live} live transaction${live === 1 ? "" : "s"} reference this category. Reassign first.`,
        );
      }
      cat.isActive = false;
    }
    cat.version = (cat.version ?? 0) + 1;
    cat.bookedAt = new Date();
    await cat.save();
    return NextResponse.json({ _id: String(cat._id), isActive: cat.isActive });
  } catch (e) {
    return errorResponse(e);
  }
}
