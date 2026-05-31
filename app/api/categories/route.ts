import { NextResponse, type NextRequest } from "next/server";
import { connectMongo } from "@/lib/db/mongo";
import { requireSession } from "@/lib/auth/session";
import { conflict, errorResponse } from "@/lib/http/errors";
import { CategoryModel } from "@/models";
import { categoryCreateInput, slugify } from "@/lib/schemas/category-input";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await requireSession();
    await connectMongo();
    const includeInactive = req.nextUrl.searchParams.get("includeInactive") === "1";
    const query = includeInactive ? {} : { isActive: true };
    const docs = await CategoryModel.find(query)
      .sort({ isActive: -1, sortOrder: 1, name: 1 })
      .lean();
    return NextResponse.json({
      items: docs.map((d) => ({
        _id: String(d._id),
        name: d.name,
        slug: d.slug,
        parentId: d.parentId ? String(d.parentId) : undefined,
        defaultFlowType: d.defaultFlowType,
        icon: d.icon,
        color: d.color,
        sortOrder: d.sortOrder,
        isActive: d.isActive ?? true,
      })),
    });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireSession();
    const body = await req.json();
    const input = categoryCreateInput.parse(body);
    await connectMongo();

    const slug = input.slug ?? slugify(input.name);
    if (!slug) throw conflict("Could not derive a slug from name — set one manually");
    const existing = await CategoryModel.findOne({ slug }).lean();
    if (existing) throw conflict(`Category slug "${slug}" already exists`);

    const sortOrder = input.sortOrder ?? (await CategoryModel.countDocuments({}));
    const doc = await CategoryModel.create({
      ...input,
      slug,
      sortOrder,
      isActive: true,
    });
    return NextResponse.json({ _id: String(doc._id) }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
