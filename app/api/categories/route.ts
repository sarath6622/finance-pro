import { NextResponse } from "next/server";
import { connectMongo } from "@/lib/db/mongo";
import { requireSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http/errors";
import { CategoryModel } from "@/models";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireSession();
    await connectMongo();
    const docs = await CategoryModel.find({ isActive: true })
      .sort({ sortOrder: 1, name: 1 })
      .lean();
    return NextResponse.json({
      items: docs.map((d) => ({
        _id: String(d._id),
        name: d.name,
        slug: d.slug,
        defaultFlowType: d.defaultFlowType,
        sortOrder: d.sortOrder,
      })),
    });
  } catch (e) {
    return errorResponse(e);
  }
}
