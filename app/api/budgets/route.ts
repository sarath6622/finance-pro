import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { connectMongo } from "@/lib/db/mongo";
import { requireSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http/errors";
import { BudgetModel } from "@/models";
import { budgetUpsertInput } from "@/lib/reports/api-input";
import { yyyyMm } from "@/lib/schemas/common";

export const dynamic = "force-dynamic";

const listQuery = z.object({ month: yyyyMm.optional() });

function shape(doc: Record<string, unknown>) {
  return {
    _id: String(doc._id),
    categoryId: String(doc.categoryId),
    month: doc.month,
    amountPaise: doc.amountPaise,
    rollover: doc.rollover,
  };
}

export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const sp = req.nextUrl.searchParams;
    const q = listQuery.parse({ month: sp.get("month") ?? undefined });
    await connectMongo();
    const filter: Record<string, unknown> = {};
    if (q.month) filter.month = q.month;
    const docs = await BudgetModel.find(filter).lean();
    return NextResponse.json({ items: docs.map(shape) });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireSession();
    const body = await req.json();
    const input = budgetUpsertInput.parse(body);
    await connectMongo();
    const updated = await BudgetModel.findOneAndUpdate(
      { categoryId: input.categoryId, month: input.month },
      { $set: { amountPaise: input.amountPaise, rollover: input.rollover } },
      { upsert: true, new: true },
    ).lean();
    return NextResponse.json(shape(updated as Record<string, unknown>), { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
