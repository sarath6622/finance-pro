import { NextResponse, type NextRequest } from "next/server";
import { connectMongo } from "@/lib/db/mongo";
import { requireSession } from "@/lib/auth/session";
import { errorResponse, notFound } from "@/lib/http/errors";
import { BudgetModel } from "@/models";

export const dynamic = "force-dynamic";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireSession();
    await connectMongo();
    const deleted = await BudgetModel.findByIdAndDelete(params.id).lean();
    if (!deleted) throw notFound("Budget not found");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
