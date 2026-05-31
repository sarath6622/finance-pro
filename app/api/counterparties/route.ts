import { NextResponse } from "next/server";
import { connectMongo } from "@/lib/db/mongo";
import { requireSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http/errors";
import { CounterpartyModel } from "@/models";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireSession();
    await connectMongo();
    const docs = await CounterpartyModel.find({})
      .sort({ displayName: 1 })
      .lean();
    return NextResponse.json({
      items: docs.map((d) => ({
        _id: String(d._id),
        displayName: d.displayName,
        type: d.type,
        aliases: d.aliases,
        defaultFlowType: d.defaultFlowType,
        defaultCategoryId: d.defaultCategoryId ? String(d.defaultCategoryId) : undefined,
      })),
    });
  } catch (e) {
    return errorResponse(e);
  }
}
