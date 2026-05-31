import { NextResponse, type NextRequest } from "next/server";
import { connectMongo } from "@/lib/db/mongo";
import { requireSession } from "@/lib/auth/session";
import { conflict, errorResponse } from "@/lib/http/errors";
import { CounterpartyModel } from "@/models";
import { counterpartyCreateInput } from "@/lib/schemas/counterparty-input";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await requireSession();
    await connectMongo();
    const includeInactive = req.nextUrl.searchParams.get("includeInactive") === "1";
    const query = includeInactive ? {} : { isActive: { $ne: false } };
    const docs = await CounterpartyModel.find(query)
      .sort({ isActive: -1, displayName: 1 })
      .lean();
    return NextResponse.json({
      items: docs.map((d) => ({
        _id: String(d._id),
        displayName: d.displayName,
        type: d.type,
        aliases: d.aliases,
        defaultFlowType: d.defaultFlowType,
        defaultCategoryId: d.defaultCategoryId ? String(d.defaultCategoryId) : undefined,
        notes: d.notes,
        isActive: d.isActive ?? true,
        archivedAt: d.archivedAt ? new Date(d.archivedAt).toISOString() : undefined,
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
    const input = counterpartyCreateInput.parse(body);
    await connectMongo();

    const existing = await CounterpartyModel.findOne({
      displayName: input.displayName,
      type: input.type,
    }).lean();
    if (existing)
      throw conflict(`Counterparty "${input.displayName}" (${input.type}) already exists`);

    const doc = await CounterpartyModel.create({
      ...input,
      isActive: true,
    });
    return NextResponse.json({ _id: String(doc._id) }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
