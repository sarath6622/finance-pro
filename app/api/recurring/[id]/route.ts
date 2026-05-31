import { NextResponse, type NextRequest } from "next/server";
import { connectMongo } from "@/lib/db/mongo";
import { requireSession } from "@/lib/auth/session";
import { errorResponse, notFound } from "@/lib/http/errors";
import { RecurringRuleModel } from "@/models";
import { recurringRulePatchInput } from "@/lib/recurring/validate";

export const dynamic = "force-dynamic";

function shape(doc: Record<string, unknown>) {
  return {
    _id: String(doc._id),
    label: doc.label,
    accountId: String(doc.accountId),
    counterpartyId: doc.counterpartyId ? String(doc.counterpartyId) : undefined,
    categoryId: doc.categoryId ? String(doc.categoryId) : undefined,
    flowType: doc.flowType,
    amountPaise: doc.amountPaise,
    frequency: doc.frequency,
    dayOfMonth: doc.dayOfMonth,
    startDate: doc.startDate,
    endDate: doc.endDate,
    arrearsPolicy: doc.arrearsPolicy,
    status: doc.status,
    autoGenerate: doc.autoGenerate,
  };
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireSession();
    const body = await req.json();
    const patch = recurringRulePatchInput.parse(body);
    await connectMongo();
    const updated = await RecurringRuleModel.findByIdAndUpdate(
      params.id,
      { $set: patch },
      { new: true },
    ).lean();
    if (!updated) throw notFound("Recurring rule not found");
    return NextResponse.json(shape(updated as Record<string, unknown>));
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireSession();
    await connectMongo();
    // Soft delete: mark ended (preserves history; transactions keep their recurringRuleId).
    const updated = await RecurringRuleModel.findByIdAndUpdate(
      params.id,
      { $set: { status: "ended" } },
      { new: true },
    ).lean();
    if (!updated) throw notFound("Recurring rule not found");
    return NextResponse.json(shape(updated as Record<string, unknown>));
  } catch (e) {
    return errorResponse(e);
  }
}
